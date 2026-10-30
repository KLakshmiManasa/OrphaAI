import { useEffect, useRef } from "react";
import { useAuth } from "../auth/AuthContext";

/**
 * Web Google Sign-In Button.
 * Renders standard Google Identity Services (GIS) button with seamless Supabase & Backend synchronization.
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

      await loginWithGoogleCredential(credentialOrToken);
      setIsLoggedIn?.(true);
      onClose?.();
    } catch (err) {
      console.error("[OrphaAI] Google sign-in error:", err);
      onError?.(err?.message || "Google sign-in failed.");
    }
  };

  useEffect(() => {
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
  }, [googleClientId]);

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
