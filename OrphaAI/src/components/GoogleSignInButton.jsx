import { useEffect, useRef } from "react";
import { useAuth } from "../auth/AuthContext";

/**
 * Native Google Sign-In Button powered by Google Identity Services (GIS).
 * Renders Google's official button directly into a dedicated placeholder div.
 * Dispatches verified credential to backend /api/v1/auth/google and stores JWT tokens.
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

  const handleGoogleCredentialResponse = async (response) => {
    try {
      if (!response?.credential) {
        throw new Error("No credential returned from Google.");
      }

      // Try primary relative route /api/v1/auth/google (proxied in dev / same-origin in prod),
      // falling back to configured VITE_API_BASE if relative fetch does not return JSON.
      let res;
      try {
        res = await fetch("/api/v1/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: response.credential }),
        });
        const contentType = res.headers.get("content-type") || "";
        if (!res.ok && !contentType.includes("application/json")) {
          throw new Error("Non-JSON API response");
        }
      } catch {
        const apiBase =
          import.meta.env.VITE_API_BASE ||
          "https://orphaai-backend-nebu.onrender.com/api/v1";
        const fallbackUrl = apiBase.startsWith("http")
          ? `${apiBase}/auth/google`
          : "/api/v1/auth/google";
        res = await fetch(fallbackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: response.credential }),
        });
      }

      const data = await res.json().catch(() => ({}));
      const token = data.access_token || data.accessToken;

      if (res.ok && token) {
        // Store access and refresh tokens across standard keys
        localStorage.setItem("orphaai_token", token);
        localStorage.setItem("orphaai_access_token", token);
        if (data.user) {
          localStorage.setItem("orphaai_user", JSON.stringify(data.user));
        }
        if (data.refresh_token || data.refreshToken) {
          localStorage.setItem(
            "orphaai_refresh_token",
            data.refresh_token || data.refreshToken
          );
        }

        // Update application authentication state
        if (loginWithGoogleCredential) {
          try {
            await loginWithGoogleCredential(response.credential);
          } catch {
            // Direct state storage above ensures credentials persist
          }
        }

        setIsLoggedIn?.(true);
        onClose?.();
      } else {
        const errorMsg =
          data.message || data.error || `Google authentication failed (${res.status})`;
        console.error("Google auth backend error:", errorMsg);
        onError?.(errorMsg);
      }
    } catch (err) {
      console.error("Network error during Google auth:", err);
      onError?.(err?.message || "Network error during Google authentication.");
    }
  };

  useEffect(() => {
    const googleClientId =
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      "645276021991-2npbgjkdq4ih7oumiqb632tcfc411eds.apps.googleusercontent.com";

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
  }, []);

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
