import { useEffect, useRef } from "react";
import { useAuth } from "../auth/AuthContext";

const COLORS = {
  white: "#FFFFFF",
  gray100: "#DADDD8",
  gray600: "#5F5E5A",
  gray800: "#333532",
};

/**
 * Native Google Sign-In Button powered by Google Identity Services (GIS).
 * Renders Google's official button & opens GIS in-page popup/prompt.
 */
export default function GoogleSignInButton({
  disabled = false,
  onError,
  // eslint-disable-next-line no-unused-vars
  onCredential,
}) {
  const { loginWithGoogleOAuth, loginWithGoogleCredential } = useAuth();
  const containerRef = useRef(null);

  useEffect(() => {
    const googleClientId =
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      "645276021991-2npbgjkdq4ih7oumiqb632tcfc411eds.apps.googleusercontent.com";

    const initGis = () => {
      if (typeof window !== "undefined" && window.google?.accounts?.id && containerRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: async (response) => {
              if (response?.credential) {
                try {
                  await loginWithGoogleCredential(response.credential);
                } catch (err) {
                  onError?.(err?.message || "Google sign-in failed.");
                }
              } else {
                onError?.("No credential returned from Google.");
              }
            },
          });

          containerRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(containerRef.current, {
            theme: "outline",
            size: "large",
            width: 360,
            text: "continue_with",
            shape: "rectangular",
          });
        } catch (err) {
          console.warn("[OrphaAI] GIS render error:", err);
        }
      }
    };

    initGis();
    const timer = setInterval(() => {
      if (window.google?.accounts?.id && containerRef.current) {
        initGis();
        clearInterval(timer);
      }
    }, 250);

    return () => clearInterval(timer);
  }, [loginWithGoogleCredential, onError]);

  const handleClickFallback = async () => {
    if (disabled) return;
    try {
      await loginWithGoogleOAuth();
    } catch (err) {
      onError?.(err?.message ?? "Google sign-in failed. Please try again.");
    }
  };

  return (
    <div style={{ width: "100%", margin: "8px 0" }}>
      <div
        ref={containerRef}
        style={{
          display: "flex",
          justifyContent: "center",
          minHeight: 44,
        }}
      />
      {typeof window !== "undefined" && !window.google?.accounts?.id && (
        <button
          id="google-oauth-btn"
          type="button"
          onClick={handleClickFallback}
          disabled={disabled}
          aria-label="Continue with Google"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            padding: "11px 16px",
            border: `1px solid ${COLORS.gray100}`,
            borderRadius: 8,
            background: disabled ? "#F5F5F5" : COLORS.white,
            color: COLORS.gray800,
            fontWeight: 600,
            fontSize: 15,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.62 : 1,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            boxSizing: "border-box",
            fontFamily: "inherit",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            width="20"
            height="20"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
            <path fill="none" d="M0 0h48v48H0z" />
          </svg>
          Continue with Google
        </button>
      )}
    </div>
  );
}
