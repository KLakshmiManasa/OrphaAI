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
const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "http://localhost:5000/api/v1";

const FALLBACK_API_BASE = "https://orphaai-backend-nebu.onrender.com/api/v1";

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
function storedAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

function storeFlaskSession(payload) {
  localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
  if (payload.refreshToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
}

function clearFlaskSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
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
      const data = await authRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      return finishFlaskLogin(data);
    },
    [finishFlaskLogin]
  );

  const registerWithPassword = useCallback(
    async ({ email, password, firstName, lastName, institution }) => {
      setError("");
      const data = await authRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, firstName, lastName, institution }),
      });
      return finishFlaskLogin(data);
    },
    [finishFlaskLogin]
  );

  // -------------------------------------------------------------------------
  // Direct Google ID Token Authentication via Flask API (/auth/google)
  // -------------------------------------------------------------------------
  const loginWithGoogleCredential = useCallback(
    async (credential) => {
      setError("");
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error || `Google authentication failed (${res.status})`;
        setError(msg);
        throw new Error(msg);
      }
      return finishFlaskLogin(data);
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
      if (supabaseUrl && !supabaseUrl.includes("rueqocfsletjyyvfzfdg")) {
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

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------
  const value = useMemo(
    () => ({
      user,
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
