import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";

/**
 * Web Google Sign-In Button.
 * Renders standard Google Identity Services (GIS) button with seamless fallback.
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

      const remoteBase = "https://orphaai-backend-nebu.onrender.com/api/v1";
      const configuredBase = import.meta.env.VITE_API_BASE;
      const apiBase = configuredBase || "/api/v1";

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
      const token =
        data.access_token ||
        data.token ||
        data.jwt ||
        data.session_token ||
        data.data?.token ||
        data.data?.access_token ||
        data.session?.access_token;

      if (token) {
        localStorage.setItem("orphaai_token", token);
        localStorage.setItem("orphaai_access_token", token);
        if (data.refresh_token) {
          localStorage.setItem("orphaai_refresh_token", data.refresh_token);
        }

        const userPayload =
          data.user ||
          data.data?.user ||
          (data.email ? { email: data.email, name: data.name, role: data.role || "researcher" } : null) ||
          { email: "user@orphaai.org", name: "Researcher", role: "researcher" };

        localStorage.setItem("orphaai_user", JSON.stringify(userPayload));

        if (typeof loginWithGoogleCredential === "function") {
          try {
            await loginWithGoogleCredential(credentialOrToken);
          } catch (ctxErr) {
            console.warn("[OrphaAI] AuthContext credential sync notice:", ctxErr);
          }
        }

        setIsLoggedIn?.(true);
        onClose?.();
      } else {
        throw new Error(
          data.message ||
            data.msg ||
            `Authentication payload missing token key: ${JSON.stringify(data)}`
        );
      }
    } catch (err) {
      console.error("Network or JSON parsing error:", err);
      onError?.(`Sign-in error: ${err.message}`);
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
