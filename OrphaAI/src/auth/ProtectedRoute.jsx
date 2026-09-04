import { useEffect } from "react";

export default function ProtectedRoute({ children, loading, setPage, user }) {
  useEffect(() => {
    if (!loading && !user) setPage("login");
  }, [loading, setPage, user]);

  if (loading) {
    return (
      <main style={{ minHeight: "calc(100vh - 64px)", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ color: "#5F5E5A", fontWeight: 700 }}>Restoring secure session...</div>
      </main>
    );
  }

  if (!user) return null;
  return children;
}
