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

const ACCESS_TOKEN_KEY  = "orphaai_access_token";
const REFRESH_TOKEN_KEY = "orphaai_refresh_token";
const OAUTH_CALLBACK_PATH = "/auth/callback";

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

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
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
  // Session restore on app load
  //
  // Order of precedence:
  //  1. Existing valid Flask JWT in localStorage → just validate with /auth/me
  //  2. Active Supabase session (returning from OAuth redirect, or persisted) →
  //     exchange for Flask JWT
  //  3. Nothing → user stays null (unauthenticated)
  // -------------------------------------------------------------------------
  const restoreSession = useCallback(async () => {
    setInitializing(true);
    setError("");
    try {
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

      // Step 2: check for a Supabase session (Google OAuth user)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.warn("[OrphaAI] getSession error:", sessionError.message);
      }
      if (session?.user) {
        await doExchange(session.user);
        clearOAuthCallbackUrl();
      } else {
        setUser(null);
        if (isRedirect) clearOAuthCallbackUrl();
      }
    } finally {
      setInitializing(false);
    }
  }, [doExchange]);

  // -------------------------------------------------------------------------
  // Supabase auth state listener
  //
  // SIGNED_IN fires when:
  //   • User completes Google OAuth redirect and lands back on the app
  //   • Supabase restores a persisted session on page load
  //
  // SIGNED_OUT fires when supabase.auth.signOut() is called.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          // If we already have a Flask JWT skip — restoreSession handled/handles it.
          // When returning from Google OAuth redirect, restoreSession clears the Flask session,
          // which ensures this exchange runs immediately.
          if (storedAccessToken()) return;
          await doExchange(session.user);
          clearOAuthCallbackUrl();
        } else if (event === "SIGNED_OUT") {
          clearFlaskSession();
          setUserRef.current(null);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [doExchange]);

  // Run once on mount
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // -------------------------------------------------------------------------
  // Flask email/password auth — completely unchanged from original
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
  // Google OAuth via GIS or Supabase fallback
  // -------------------------------------------------------------------------
  const loginWithGoogleOAuth = useCallback(async () => {
    setError("");
    exchangingRef.current = false; // reset guard for fresh attempt

    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    // Try Direct Google Identity Services (GIS) if available
    if (googleClientId && window.google?.accounts?.id) {
      return new Promise((resolve, reject) => {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: async (response) => {
              try {
                if (response.credential) {
                  const loggedInUser = await loginWithGoogleCredential(response.credential);
                  resolve(loggedInUser);
                } else {
                  const err = new Error("No credential returned from Google.");
                  setError(err.message);
                  reject(err);
                }
              } catch (err) {
                reject(err);
              }
            },
          });

          window.google.accounts.id.prompt(async (notification) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
              // If GIS prompt was blocked/dismissed, fall back to Supabase OAuth if available
              try {
                const { error: oauthError } = await supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: {
                    redirectTo: oauthRedirectTo(),
                    queryParams: { access_type: "offline", prompt: "consent" },
                  },
                });
                if (oauthError) {
                  setError(oauthError.message);
                  reject(oauthError);
                }
              } catch (err) {
                const errorMsg = "Supabase OAuth service is unreachable (invalid Supabase domain or network issue). Please check your Supabase configuration.";
                setError(errorMsg);
                reject(new Error(errorMsg));
              }
            }
          });
        } catch (err) {
          reject(err);
        }
      });
    }

    // Fallback: Supabase OAuth
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: oauthRedirectTo(),
          queryParams: {
            access_type: "offline",
            prompt:      "consent",
          },
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        throw oauthError;
      }
    } catch (err) {
      const errorMsg = err?.message?.includes("Failed to fetch") || err?.message?.includes("NetworkError") || !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes("rueqocfsletjyyvfzfdg")
        ? "Google OAuth service URL (Supabase) is unreachable or misconfigured. Please check VITE_SUPABASE_URL in .env."
        : (err?.message || "Google sign-in failed.");
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [loginWithGoogleCredential]);

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
      logout,
      refreshUser: restoreSession,
    }),
    [
      error,
      initializing,
      loginWithGoogleCredential,
      loginWithGoogleOAuth,
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
