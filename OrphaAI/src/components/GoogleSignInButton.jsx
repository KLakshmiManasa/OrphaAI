import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";
import { useAuth } from "../auth/AuthContext";

/**
 * Native & Web Google Sign-In Button.
 * On Native Android: Uses Google Play Services & Chrome Custom Tabs (@capacitor/browser)
 * with deep-linking (com.orphaai.app://auth-callback) to bypass WebView GSI popup restrictions.
 * On Web/Browser: Renders standard Google Identity Services (GIS) button with seamless fallback.
 */
export default function GoogleSignInButton({
  disabled = false,
  onError,
  onClose,
  setIsLoggedIn,
}) {
  const { loginWithGoogleCredential } = useAuth();
  const buttonRef = useRef(null);
  const initializedRef = useRef(false);
  const isNative = Capacitor.isNativePlatform();
  const [nativeLoading, setNativeLoading] = useState(false);

  const googleClientId =
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    "645276021991-2npbgjkdq4ih7oumiqb632tcfc411eds.apps.googleusercontent.com";

  const handleGoogleCredentialResponse = async (response) => {
    try {
      const credentialOrToken =
        response?.credential ||
        response?.idToken ||
        response?.id_token ||
        response?.token ||
        response?.access_token ||
        (typeof response === "string" ? response : "");

      if (!credentialOrToken) {
        throw new Error("No credential returned from Google.");
      }

      const remoteBase = "https://orphaai-backend-nebu.onrender.com/api/v1";
      const isNative = Capacitor.isNativePlatform();
      const configuredBase = import.meta.env.VITE_API_BASE;

      // On native Android/iOS, localhost is unreachable on the device, route to remote backend
      const apiBase =
        isNative && (!configuredBase || configuredBase.includes("localhost") || configuredBase.includes("127.0.0.1"))
          ? remoteBase
          : (configuredBase || (isNative ? remoteBase : "/api/v1"));

      const endpoint = apiBase.endsWith("/auth/google")
        ? apiBase
        : `${apiBase.replace(/\/+$/, "")}/auth/google`;
      const fallbackEndpoint = `${remoteBase}/auth/google`;

      const requestBody = JSON.stringify({
        credential: credentialOrToken,
        token: credentialOrToken,
        id_token: credentialOrToken,
      });

      let res;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
        });

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error("Non-JSON API response from primary endpoint");
        }
      } catch (fetchErr) {
        console.warn("[OrphaAI] Primary auth/google endpoint failed, attempting fallback:", fetchErr);
        if (endpoint !== fallbackEndpoint) {
          res = await fetch(fallbackEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: requestBody,
          });
        } else {
          throw fetchErr;
        }
      }

      const data = await res.json().catch(() => ({}));
      console.log("Google Auth Response Payload:", data, "HTTP Status:", res?.status);

      // Check if backend flagged an internal failure
      if (data.success === false || data.error) {
        const errorMsg = data.message || data.error || "Authentication rejected by server";
        onError?.(errorMsg);
        return;
      }

      // Accommodate whichever key the backend provides
      const authToken =
        data.access_token ||
        data.token ||
        data.jwt ||
        data.accessToken ||
        data.authToken ||
        data.idToken ||
        (data.data &&
          (data.data.token ||
            data.data.access_token ||
            data.data.accessToken ||
            data.data.authToken ||
            data.data.jwt));

      const authUser =
        data.user ||
        (data.data && data.data.user) ||
        data.profile ||
        (data.data && data.data.profile) ||
        { email: "researcher" };

      if (authToken) {
        localStorage.setItem("orphaai_token", authToken);
        localStorage.setItem("orphaai_access_token", authToken);
        localStorage.setItem("orphaai_user", JSON.stringify(authUser));

        const refreshToken =
          data.refresh_token ||
          data.refreshToken ||
          (data.data && (data.data.refresh_token || data.data.refreshToken));
        if (refreshToken) {
          localStorage.setItem("orphaai_refresh_token", refreshToken);
        }

        // Synchronize with AuthContext
        if (loginWithGoogleCredential) {
          try {
            await loginWithGoogleCredential(credentialOrToken);
          } catch (ctxErr) {
            console.warn("[OrphaAI] AuthContext sync warning:", ctxErr);
          }
        }

        if (typeof setIsLoggedIn === "function") setIsLoggedIn(true);
        if (typeof onClose === "function") onClose();
      } else {
        console.error("No token key found in 200 response:", data);
        onError?.(
          data.message ||
            `Authentication payload missing token key: ${JSON.stringify(data)}`
        );
      }
    } catch (err) {
      console.error("Network or JSON parsing error:", err);
      onError?.(`Sign-in error: ${err.message}`);
    }
  };


  const handleNativeSignIn = async () => {
    if (disabled || nativeLoading) return;
    setNativeLoading(true);
    try {
      // 1. Try GoogleAuth plugin (Play Services native dialog)
      try {
        GoogleAuth.initialize({
          clientId: googleClientId,
          scopes: ["profile", "email"],
          grantOfflineAccess: true,
        });
        const googleUser = await GoogleAuth.signIn();
        const idToken =
          googleUser?.authentication?.idToken ||
          googleUser?.idToken ||
          googleUser?.serverAuthCode;

        if (idToken) {
          await handleGoogleCredentialResponse({ credential: idToken });
          return;
        }
      } catch (nativeErr) {
        console.warn("[OrphaAI] GoogleAuth Play Services fallback to Chrome Custom Tabs:", nativeErr);
      }

      // 2. Chrome Custom Tabs (CCT) fallback via @capacitor/browser
      const redirectUri = "com.orphaai.app://auth-callback";
      const nonce = Math.random().toString(36).substring(2);
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
        googleClientId
      )}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=token%20id_token&scope=openid%20profile%20email&nonce=${nonce}`;

      await Browser.open({ url: authUrl, windowName: "_self" });
    } catch (err) {
      console.error("[OrphaAI] Native Google Sign-In error:", err);
      const msg = err?.message || "";
      if (!msg.toLowerCase().includes("cancel") && !msg.toLowerCase().includes("12501")) {
        onError?.(msg || "Google Sign-In failed.");
      }
    } finally {
      setNativeLoading(false);
    }
  };

  // Deep Link handler for OAuth callback from Chrome Custom Tabs
  useEffect(() => {
    if (!isNative) return;

    let sub;
    try {
      sub = App.addListener("appUrlOpen", async (event) => {
        if (!event?.url) return;
        if (event.url.startsWith("com.orphaai.app://auth-callback")) {
          try {
            await Browser.close().catch(() => {});
          } catch {}

          const urlStr = event.url;
          const hashIndex = urlStr.indexOf("#");
          const queryIndex = urlStr.indexOf("?");
          const paramsStr =
            hashIndex !== -1
              ? urlStr.substring(hashIndex + 1)
              : queryIndex !== -1
              ? urlStr.substring(queryIndex + 1)
              : "";

          const params = new URLSearchParams(paramsStr);
          const idToken = params.get("id_token");
          const accessToken = params.get("access_token");

          if (idToken) {
            await handleGoogleCredentialResponse({ credential: idToken });
          } else if (accessToken) {
            try {
              const uInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { Authorization: `Bearer ${accessToken}` },
              });
              const uInfo = await uInfoRes.json();
              if (uInfo.sub) {
                await handleGoogleCredentialResponse({ credential: accessToken });
              }
            } catch (uErr) {
              console.error("[OrphaAI] Failed to fetch Google userinfo:", uErr);
            }
          }
        }
      });
    } catch (e) {
      console.warn("[OrphaAI] Failed to attach appUrlOpen listener:", e);
    }

    return () => {
      sub?.then?.((s) => s.remove?.())?.catch?.(() => {});
    };
  }, [isNative]);

  useEffect(() => {
    if (isNative) {
      try {
        GoogleAuth.initialize({
          clientId: googleClientId,
          scopes: ["profile", "email"],
          grantOfflineAccess: true,
        });
      } catch (e) {
        console.warn("[OrphaAI] GoogleAuth init:", e);
      }
      return;
    }

    // Web / Browser platform: render Google Identity Services button
    const renderOfficialButton = () => {
      const container =
        buttonRef.current || document.getElementById("googleSignInButton");

      if (window.google?.accounts?.id && container && !initializedRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredentialResponse,
          });

          container.innerHTML = "";
          window.google.accounts.id.renderButton(container, {
            theme: "outline",
            size: "large",
            width: "100%",
            text: "continue_with",
            shape: "rectangular",
          });

          initializedRef.current = true;
        } catch (err) {
          console.warn("[OrphaAI] Google Identity Services initialization error:", err);
        }
      }
    };

    if (window.google?.accounts?.id) {
      renderOfficialButton();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          renderOfficialButton();
          clearInterval(interval);
        }
      }, 150);

      return () => clearInterval(interval);
    }
  }, [isNative, googleClientId]);

  if (isNative) {
    return (
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "44px",
          opacity: disabled || nativeLoading ? 0.6 : 1,
          pointerEvents: disabled || nativeLoading ? "none" : "auto",
        }}
      >
        <button
          type="button"
          onClick={handleNativeSignIn}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700/80 active:scale-[0.99] transition-all cursor-pointer"
          style={{ minHeight: "42px" }}
        >
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{nativeLoading ? "Connecting to Google..." : "Continue with Google"}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "44px",
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      <div
        id="googleSignInButton"
        ref={buttonRef}
        className="w-full flex justify-center mt-2"
        style={{ width: "100%", display: "flex", justifyContent: "center" }}
      />
    </div>
  );
}
