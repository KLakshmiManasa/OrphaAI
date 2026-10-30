import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../supabaseClient";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const RAW_API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://orphaai-backend-nebu.onrender.com/api/v1";

const FALLBACK_API_BASE = 'https://orphaai-backend-nebu.onrender.com/api/v1';
const API_BASE = RAW_API_BASE;

const ACCESS_TOKEN_KEY  = "orphaai_access_token";
const REFRESH_TOKEN_KEY = "orphaai_refresh_token";
const OAUTH_CALLBACK_PATH = "/auth/callback";

function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("No window context"));
    if (window.google?.accounts?.oauth2 || window.google?.accounts?.id) {
      return resolve(window.google);
    }
    const existing = document.getElementById("google-gsi-script");
    if (existing) {
      if (window.google?.accounts) return resolve(window.google);
      existing.addEventListener("load", () => resolve(window.google));
      existing.addEventListener("error", (e) => reject(e));
      return;
    }
    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Failed to load Google Identity Services script."));
    document.head.appendChild(script);
  });
}

// ---------------------------------------------------------------------------
// Flask session helpers (used by BOTH email/password AND Google OAuth flows)
// ---------------------------------------------------------------------------
function extractAuthToken(payload) {
  if (!payload || typeof payload !== "object") return "";
  return (
    payload.access_token ||
    payload.token ||
    payload.jwt ||
    payload.accessToken ||
    payload.authToken ||
    payload.idToken ||
    payload.id_token ||
    (payload.data &&
      (payload.data.access_token ||
        payload.data.token ||
        payload.data.jwt ||
        payload.data.accessToken ||
        payload.data.authToken)) ||
    ""
  );
}

function extractAuthUser(payload) {
  if (!payload || typeof payload !== "object") return { email: "researcher" };
  return (
    payload.user ||
    (payload.data && payload.data.user) ||
    payload.profile ||
    (payload.data && payload.data.profile) ||
    { email: "researcher" }
  );
}

function storedAccessToken() {
  return (
    localStorage.getItem(ACCESS_TOKEN_KEY) ||
    localStorage.getItem("orphaai_token") ||
    ""
  );
}

function storeFlaskSession(payload) {
  const token = extractAuthToken(payload);
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    localStorage.setItem("orphaai_token", token);
    localStorage.setItem("orphaai_access_token", token);
  }
  const refresh =
    payload.refreshToken ||
    payload.refresh_token ||
    (payload.data && (payload.data.refreshToken || payload.data.refresh_token));
  if (refresh) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    localStorage.setItem("orphaai_refresh_token", refresh);
  }
  const user = extractAuthUser(payload);
  if (user) {
    localStorage.setItem("orphaai_user", JSON.stringify(user));
  }
}

function clearFlaskSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem("orphaai_token");
  localStorage.removeItem("orphaai_access_token");
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem("orphaai_refresh_token");
  localStorage.removeItem("orphaai_user");
}

function isOAuthRedirect() {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  const hasHashTokens = hash.includes("access_token=") || hash.includes("id_token=");
  const hasCode = search.includes("code=") || hash.includes("code=");
  const hasError = search.includes("error=") || hash.includes("error=");
  return hasHashTokens || hasCode || hasError;
}

function getGoogleIdTokenFromHash() {
  if (typeof window === "undefined") return "";
  const hash = window.location.hash || "";
  if (!hash.includes("id_token=")) return "";
  const match = hash.match(/id_token=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function oauthRedirectTo() {
  const configured = import.meta.env.VITE_SUPABASE_REDIRECT_URL;
  if (configured) return configured;

  const { protocol, hostname, port, origin } = window.location;
  const normalizedHost = hostname === "127.0.0.1" ? "localhost" : hostname;
  const normalizedOrigin =
    hostname === normalizedHost
      ? origin
      : `${protocol}//${normalizedHost}${port ? `:${port}` : ""}`;

  return `${normalizedOrigin}${OAUTH_CALLBACK_PATH}`;
}

function clearOAuthCallbackUrl() {
  if (!isOAuthRedirect() && window.location.pathname !== OAUTH_CALLBACK_PATH) return;
  window.history.replaceState({}, document.title, window.location.origin);
}

// ---------------------------------------------------------------------------
// Flask API helper — always sends the Flask JWT as Authorization header
// ---------------------------------------------------------------------------
async function authRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = storedAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    if (API_BASE !== FALLBACK_API_BASE) {
      try {
        response = await fetch(`${FALLBACK_API_BASE}${path}`, { ...options, headers });
      } catch {
        throw new Error("Unable to connect to OrphaAI servers. Please check your network connection.");
      }
    } else {
      throw new Error("Unable to connect to OrphaAI servers. Please check your network connection.");
    }
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
}

// ---------------------------------------------------------------------------
// Exchange Supabase Google session → Flask JWT
// POST /api/v1/auth/google-supabase with the Google user's verified identity.
// Flask finds-or-creates the User row and returns Flask accessToken +
// refreshToken. All @jwt_required() endpoints then work normally.
// ---------------------------------------------------------------------------
async function exchangeSupabaseForFlaskJwt(supabaseUser) {
  if (!supabaseUser) throw new Error("No Supabase user provided");

  const meta = supabaseUser.user_metadata ?? {};

  const response = await fetch(`${API_BASE}/auth/google-supabase`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email:        supabaseUser.email ?? "",
      full_name:    meta.full_name ?? meta.name ?? "",
      avatar_url:   meta.avatar_url ?? meta.picture ?? "",
      supabase_uid: supabaseUser.id,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Token exchange failed (${response.status})`);
  }
  return response.json();
}

// ---------------------------------------------------------------------------
// Save Google user profile to Supabase public.profiles (best-effort)
// ---------------------------------------------------------------------------
async function upsertSupabaseProfile(supabaseUser) {
  if (!supabaseUser) return;
  const meta = supabaseUser.user_metadata ?? {};
  // Only send columns that are guaranteed to exist in the schema
  await supabase.from("profiles").upsert(
    {
      id:        supabaseUser.id,
      full_name: meta.full_name ?? meta.name ?? "",
      email:     supabaseUser.email ?? "",
      avatar_url: meta.avatar_url ?? meta.picture ?? null,
      role:      "user",
    },
    { onConflict: "id" }
  );
  // Ignore errors — profile save is non-blocking
}

// ---------------------------------------------------------------------------
// Normalise the Flask user object to a consistent camelCase shape
// ---------------------------------------------------------------------------
function normaliseFlaskUser(u) {
  if (!u) return null;
  const firstName = u.firstName ?? u.first_name ?? "";
  const lastName  = u.lastName  ?? u.last_name  ?? "";
  return {
    id:        u.id ?? null,
    email:     u.email ?? "",
    firstName,
    lastName,
    fullName:  u.fullName ?? `${firstName} ${lastName}`.trim(),
    avatarUrl: u.avatarUrl ?? u.avatar_url ?? null,
    role:      u.role ?? "user",
    source:    "flask",
  };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,         setUser]         = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [error,        setError]        = useState("");

  // Ref so the async Supabase listener can always call the latest setUser
  const setUserRef = useRef(setUser);
  setUserRef.current = setUser;

  // Prevent simultaneous exchange calls
  const exchangingRef = useRef(false);

  // -------------------------------------------------------------------------
  // Core helper: exchange a Supabase Google session for a Flask JWT, then
  // set the React user state. Called from both restoreSession() and
  // onAuthStateChange().
  // -------------------------------------------------------------------------
  const doExchange = useCallback(async (supabaseUser) => {
    if (exchangingRef.current) return;
    exchangingRef.current = true;
    try {
      const data = await exchangeSupabaseForFlaskJwt(supabaseUser);
      storeFlaskSession(data);
      setUserRef.current(normaliseFlaskUser(data.user));
      setError("");
      // Profile save is fire-and-forget
      upsertSupabaseProfile(supabaseUser).catch(() => {});
    } catch (err) {
      console.error("[OrphaAI] Google→Flask exchange failed:", err.message);
      // Sign out of Supabase so the broken session doesn't persist
      await supabase.auth.signOut().catch(() => {});
      clearFlaskSession();
      setUserRef.current(null);
      setError(err.message || "Google sign-in failed. Please try again.");
    } finally {
      exchangingRef.current = false;
    }
  }, []);

  // -------------------------------------------------------------------------
  // Logout — clears both Flask JWT and Supabase session
  // -------------------------------------------------------------------------
  const logout = useCallback(async () => {
    clearFlaskSession();
    await supabase.auth.signOut().catch(() => {});
    setUser(null);
    setError("");
    exchangingRef.current = false;
    window.google?.accounts?.id?.disableAutoSelect?.();
  }, []);

  // -------------------------------------------------------------------------
  // Flask session finish helper
  // -------------------------------------------------------------------------
  const finishFlaskLogin = useCallback((data) => {
    storeFlaskSession(data);
    const norm = normaliseFlaskUser(data.user);
    setUser(norm);
    setError("");
    return norm;
  }, []);

  const loginWithPassword = useCallback(
    async ({ email, password }) => {
      setError("");
      const cleanEmail = email.trim();

      // 1. Direct Supabase Authentication
      try {
        const { data: supaData, error: supaErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (!supaErr && supaData?.user) {
          const supaUser = supaData.user;
          const meta = supaUser.user_metadata || {};
          const firstName = meta.firstName || meta.first_name || (meta.name ? meta.name.split(" ")[0] : cleanEmail.split("@")[0]);
          const lastName = meta.lastName || meta.last_name || (meta.name ? meta.name.split(" ").slice(1).join(" ") : "");
          const fullName = meta.full_name || meta.name || `${firstName} ${lastName}`.trim();
          const institution = meta.institution || "Research Institution";
          const role = meta.role || "researcher";

          // Sync authenticated Supabase session with backend for API JWT
          let flaskData = null;
          try {
            const syncRes = await fetch(`${API_BASE}/auth/google-supabase`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: cleanEmail,
                full_name: fullName,
                avatar_url: meta.avatar_url || meta.picture || "",
                supabase_uid: supaUser.id,
              }),
            });
            if (syncRes.ok) {
              flaskData = await syncRes.json();
            }
          } catch (syncErr) {
            console.warn("[OrphaAI] Supabase session sync with backend:", syncErr);
          }

          if (flaskData && flaskData.user) {
            return finishFlaskLogin(flaskData);
          }

          // Direct Supabase Session fallback
          const norm = {
            id: supaUser.id,
            email: cleanEmail,
            firstName,
            lastName,
            fullName,
            role,
            institution,
            source: "supabase",
            isActive: true,
          };

          const token = supaData.session?.access_token || "";
          if (token) {
            localStorage.setItem(ACCESS_TOKEN_KEY, token);
            localStorage.setItem("orphaai_token", token);
            localStorage.setItem("orphaai_access_token", token);
          }
          if (supaData.session?.refresh_token) {
            localStorage.setItem(REFRESH_TOKEN_KEY, supaData.session.refresh_token);
            localStorage.setItem("orphaai_refresh_token", supaData.session.refresh_token);
          }
          localStorage.setItem("orphaai_user", JSON.stringify(norm));
          setUser(norm);
          setError("");
          return norm;
        } else if (supaErr) {
          console.warn("[OrphaAI] Supabase password sign-in notice:", supaErr.message);
        }
      } catch (supaEx) {
        console.warn("[OrphaAI] Supabase auth attempt:", supaEx);
      }

      // 2. Fallback to Flask backend (for seeded demo/admin or backend-synced accounts)
      const data = await authRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: cleanEmail, password }),
      });
      return finishFlaskLogin(data);
    },
    [finishFlaskLogin]
  );

  const registerWithPassword = useCallback(
    async ({ email, password, firstName, lastName, institution }) => {
      setError("");
      const cleanEmail = email.trim();

      // 1. Direct Supabase Registration
      try {
        const { data: supaData, error: supaErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              firstName,
              lastName,
              name: `${firstName} ${lastName}`.trim(),
              full_name: `${firstName} ${lastName}`.trim(),
              institution: institution || "Research Institution",
              role: "researcher",
            },
          },
        });

        if (!supaErr && supaData?.user) {
          const supaUser = supaData.user;
          const meta = supaUser.user_metadata || {};
          const fullName = `${firstName} ${lastName}`.trim();

          // Sync with backend
          let flaskData = null;
          try {
            const syncRes = await fetch(`${API_BASE}/auth/google-supabase`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: cleanEmail,
                full_name: fullName,
                avatar_url: meta.avatar_url || meta.picture || "",
                supabase_uid: supaUser.id,
              }),
            });
            if (syncRes.ok) {
              flaskData = await syncRes.json();
            }
          } catch (syncErr) {
            console.warn("[OrphaAI] Supabase register sync with backend:", syncErr);
          }

          if (flaskData && flaskData.user) {
            return finishFlaskLogin(flaskData);
          }

          const norm = {
            id: supaUser.id,
            email: cleanEmail,
            firstName,
            lastName,
            fullName,
            role: "researcher",
            institution: institution || "Research Institution",
            source: "supabase",
            isActive: true,
          };

          const token = supaData.session?.access_token || "";
          if (token) {
            localStorage.setItem(ACCESS_TOKEN_KEY, token);
            localStorage.setItem("orphaai_token", token);
            localStorage.setItem("orphaai_access_token", token);
          }
          if (supaData.session?.refresh_token) {
            localStorage.setItem(REFRESH_TOKEN_KEY, supaData.session.refresh_token);
            localStorage.setItem("orphaai_refresh_token", supaData.session.refresh_token);
          }
          localStorage.setItem("orphaai_user", JSON.stringify(norm));
          setUser(norm);
          setError("");

          // Also best-effort sync to Flask register
          authRequest("/auth/register", {
            method: "POST",
            body: JSON.stringify({ email: cleanEmail, password, firstName, lastName, institution }),
          }).catch(() => {});

          return norm;
        }
      } catch (e) {
        console.warn("[OrphaAI] Supabase signUp exception:", e);
      }

      // 2. Fallback to Flask backend registration
      const data = await authRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email: cleanEmail, password, firstName, lastName, institution }),
      });
      return finishFlaskLogin(data);
    },
    [finishFlaskLogin]
  );

  // -------------------------------------------------------------------------
  // Direct Google ID Token Authentication via Flask API (/auth/google)
  // -------------------------------------------------------------------------
  const loginWithGoogleCredential = useCallback(
    async (credentialOrToken) => {
      setError("");
      let res;
      const requestBody = JSON.stringify({
        credential: credentialOrToken,
        token: credentialOrToken,
        id_token: credentialOrToken,
      });

      try {
        res = await fetch(`${API_BASE}/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
        });
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error("Non-JSON API response from primary endpoint");
        }
      } catch (fetchErr) {
        console.warn("[OrphaAI] Primary auth/google failed, attempting fallback:", fetchErr);
        if (API_BASE !== FALLBACK_API_BASE) {
          try {
            res = await fetch(`${FALLBACK_API_BASE}/auth/google`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: requestBody,
            });
          } catch (fbErr) {
            console.error("[OrphaAI] Fallback auth/google failed:", fbErr);
            throw new Error("Unable to connect to OrphaAI servers. Please check your network connection.");
          }
        } else {
          throw new Error("Unable to connect to OrphaAI servers. Please check your network connection.");
        }
      }

      const data = await res.json().catch(() => ({}));
      console.log("Google Auth Response Payload:", data, "HTTP Status:", res?.status);

      // Check if backend flagged an internal failure
      if (data.success === false || data.error) {
        const errorMsg = data.message || data.error || "Authentication rejected by server";
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      // Accommodate whichever key the backend provides
      const authToken = extractAuthToken(data);
      const authUser = extractAuthUser(data);

      if (authToken) {
        localStorage.setItem("orphaai_token", authToken);
        localStorage.setItem("orphaai_access_token", authToken);
        localStorage.setItem("orphaai_user", JSON.stringify(authUser));
        return finishFlaskLogin({
          ...data,
          user: authUser,
          accessToken: authToken,
          access_token: authToken,
          token: authToken,
        });
      } else {
        console.error("No token key found in 200 response:", data);
        const errStr =
          data.message ||
          `Authentication payload missing token key: ${JSON.stringify(data)}`;
        setError(errStr);
        throw new Error(errStr);
      }
    },
    [finishFlaskLogin]
  );

  // -------------------------------------------------------------------------
  // Session restore on app load
  // -------------------------------------------------------------------------
  const restoreSession = useCallback(async () => {
    setInitializing(true);
    setError("");
    try {
      // Step 0: Check for direct Google ID token in URL hash
      const directGoogleToken = getGoogleIdTokenFromHash();
      if (directGoogleToken) {
        try {
          const loggedInUser = await loginWithGoogleCredential(directGoogleToken);
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", window.location.pathname);
          }
          setUser(loggedInUser);
          return;
        } catch (err) {
          console.error("Direct Google token authentication failed:", err);
          setError(err.message || "Google authentication failed.");
        }
      }

      const isRedirect = isOAuthRedirect();

      if (isRedirect) {
        // Clear any stale Flask session to ensure a clean Google OAuth exchange
        clearFlaskSession();
      }

      // Step 1: if we are NOT in a redirect, and we already have a Flask JWT, validate it first
      if (!isRedirect && storedAccessToken()) {
        try {
          const data = await authRequest("/auth/me");
          setUser(normaliseFlaskUser(data.user));
          return; // ✅ Flask session is valid — done
        } catch {
          // JWT is expired/invalid — clear it and fall through
          clearFlaskSession();
        }
      }

      // Step 2: check for a Supabase session (Google OAuth user) if Supabase URL is active
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (supabaseUrl && true) {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.warn("[OrphaAI] getSession error:", sessionError.message);
        }
        if (session?.user) {
          await doExchange(session.user);
          clearOAuthCallbackUrl();
          return;
        }
      }

      setUser(null);
      if (isRedirect) clearOAuthCallbackUrl();
    } finally {
      setInitializing(false);
    }
  }, [doExchange, loginWithGoogleCredential]);

  // -------------------------------------------------------------------------
  // Google OAuth via direct GIS Popup (No redirect_uri required)
  // -------------------------------------------------------------------------
  const loginWithGooglePopup = useCallback(async () => {
    setError("");
    await loadGisScript().catch(() => {});

    return new Promise((resolve, reject) => {
      const googleClientId =
        import.meta.env.VITE_GOOGLE_CLIENT_ID ||
        "645276021991-2npbgjkdq4ih7oumiqb632tcfc411eds.apps.googleusercontent.com";

      if (typeof window === "undefined" || !window.google?.accounts?.oauth2) {
        const err = new Error("Google Identity Services script is loading. Please try again in a moment.");
        setError(err.message);
        return reject(err);
      }

      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: "openid email profile",
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              const err = new Error(tokenResponse.error_description || tokenResponse.error || "Google sign-in cancelled.");
              setError(err.message);
              return reject(err);
            }
            if (tokenResponse.access_token) {
              try {
                const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                const info = await userInfoRes.json();

                const reqBody = JSON.stringify({
                  email: info.email,
                  full_name: info.name || `${info.given_name || ""} ${info.family_name || ""}`.trim(),
                  avatar_url: info.picture || "",
                  supabase_uid: info.sub,
                });

                let res;
                try {
                  res = await fetch(`${API_BASE}/auth/google-supabase`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: reqBody,
                  });
                } catch {
                  res = await fetch(`${FALLBACK_API_BASE}/auth/google-supabase`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: reqBody,
                  });
                }

                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  throw new Error(data.error || "Backend authentication failed.");
                }

                const loggedUser = finishFlaskLogin(data);
                resolve(loggedUser);
              } catch (err) {
                setError(err.message || "Failed to complete Google authentication.");
                reject(err);
              }
            }
          },
        });

        client.requestAccessToken();
      } catch (err) {
        setError(err.message || "Failed to initialize Google login popup.");
        reject(err);
      }
    });
  }, [finishFlaskLogin]);

  // -------------------------------------------------------------------------
  // Google OAuth via GIS or Supabase fallback
  // -------------------------------------------------------------------------
  const loginWithGoogleOAuth = useCallback(async () => {
    return loginWithGooglePopup();
  }, [loginWithGooglePopup]);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const setIsLoggedIn = useCallback((val) => {
    if (!val) {
      clearFlaskSession();
      setUser(null);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------
  const value = useMemo(
    () => ({
      user,
      isLoggedIn: Boolean(user),
      setIsLoggedIn,
      setUser,
      initializing,
      error,
      loginWithPassword,
      registerWithPassword,
      loginWithGoogleOAuth,
      loginWithGoogleCredential,
      loginWithGooglePopup,
      logout,
      refreshUser: restoreSession,
    }),
    [
      error,
      initializing,
      loginWithGoogleCredential,
      loginWithGoogleOAuth,
      loginWithGooglePopup,
      loginWithPassword,
      logout,
      registerWithPassword,
      restoreSession,
      setIsLoggedIn,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
