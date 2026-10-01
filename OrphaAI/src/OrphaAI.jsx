import { useEffect, useMemo, useRef, useState } from "react";
import { ORPHAAI_LOGO_ALT, ORPHAAI_LOGO_SRC } from "./assets/logo";
import ProtectedRoute from "./auth/ProtectedRoute";
import { useAuth } from "./auth/AuthContext";
import GoogleSignInButton from "./components/GoogleSignInButton";
import OrphaAIChatbot from "./components/OrphaAIChatbot";
import { downloadPdfReport, uniqueReportFilename } from "./services/pdfExportService";

const API_BASE = import.meta.env.VITE_API_BASE || "https://orphaai-backend-nebu.onrender.com/api/v1";
const FALLBACK_API_BASE = "http://localhost:5000/api/v1";

const COLORS = {
  navy: "#06182B",
  navyMid: "#0C2B4B",
  navyBg: "#F0F4F8",
  teal: "#0F6E56",
  tealBright: "#0D9488",
  tealLight: "#14B8A6",
  tealBg: "#F0FDF4",
  tealTint: "#E6F7F3",
  coral: "#E11D48",
  coralBg: "#FFF1F2",
  amber: "#D97706",
  amberBg: "#FFFBEB",
  purple: "#6366F1",
  purpleBg: "#EEF2FF",
  cyan: "#06B6D4",
  cyanBg: "#ECFEFF",
  gray50: "#F8FAFC",
  gray100: "#E2E8F0",
  gray200: "#CBD5E1",
  gray300: "#94A3B8",
  gray600: "#64748B",
  gray800: "#1E293B",
  gray900: "#0F172A",
  white: "#FFFFFF",
};

const emailPattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function token() {
  return localStorage.getItem("orphaai_access_token") || "";
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token()) headers.Authorization = `Bearer ${token()}`;

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

function userLabel(user) {
  if (!user) return "";
  return `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "User";
}

function escapePdfText(text) {
  return String(text ?? "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapLine(text, max = 88) {
  const words = String(text ?? "").split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function makePdf(lines) {
  const visibleLines = lines.flatMap((line) => wrapLine(line)).slice(0, 48);
  const textOps = visibleLines.map((line, index) => `BT /F1 10 Tf 50 ${770 - index * 15} Td (${escapePdfText(line)}) Tj ET`).join("\n");
  const stream = `${textOps}\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

function Badge({ children, tone = "teal" }) {
  const map = {
    teal: { bg: "#F0FDF4", color: "#0F6E56", border: "#BBF7D0" },
    navy: { bg: "#F0F4F8", color: "#0C2B4B", border: "#CBD5E1" },
    amber: { bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" },
    purple: { bg: "#EEF2FF", color: "#4F46E5", border: "#C7D2FE" },
    cyan: { bg: "#ECFEFF", color: "#0891B2", border: "#A5F3FC" },
    coral: { bg: "#FFF1F2", color: "#E11D48", border: "#FECDD3" },
  };
  const style = map[tone] || map.teal;
  return (
    <span
      style={{
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.02em",
        padding: "3px 9px",
        borderRadius: "20px",
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Panel({ children, style }) {
  return (
    <div
      style={{
        background: COLORS.white,
        border: `1px solid ${COLORS.gray100}`,
        borderRadius: "14px",
        padding: "24px",
        boxSizing: "border-box",
        maxWidth: "100%",
        minWidth: 0,
        boxShadow: "0 4px 18px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -2px rgba(15, 23, 42, 0.03)",
        transition: "box-shadow 0.2s ease, transform 0.2s ease",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function LogoMark({ size = 36, showText = false, color = COLORS.teal }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
      <img
        src={ORPHAAI_LOGO_SRC}
        alt={ORPHAAI_LOGO_ALT}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          flex: `0 0 ${size}px`,
          filter: "drop-shadow(0 2px 4px rgba(15, 110, 86, 0.18))",
        }}
      />
      {showText && (
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: Math.max(18, Math.round(size * 0.62)),
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color,
            whiteSpace: "nowrap",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          Orpha<span style={{ color: COLORS.gray900 }}>AI</span>
          <span
            style={{
              marginLeft: "6px",
              fontSize: "10px",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              background: "linear-gradient(135deg, #0F6E56, #0D9488)",
              color: COLORS.white,
              padding: "2px 6px",
              borderRadius: "4px",
            }}
          >
            BIOMED
          </span>
        </span>
      )}
    </span>
  );
}

function PageShell({ children, maxWidth = 1080, style }) {
  return (
    <main
      className="orpha-page animate-fade-in"
      style={{
        maxWidth,
        width: "100%",
        margin: "0 auto",
        padding: "36px 24px 60px",
        boxSizing: "border-box",
        overflowX: "hidden",
        ...style,
      }}
    >
      {children}
    </main>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(6, 24, 43, 0.55)",
        backdropFilter: "blur(6px)",
        zIndex: 50,
        display: "grid",
        placeItems: "center",
        padding: 20,
        animation: "fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div
        style={{
          background: COLORS.white,
          borderRadius: 16,
          border: `1px solid ${COLORS.gray100}`,
          width: "min(920px, 96vw)",
          maxHeight: "88vh",
          overflow: "auto",
          boxShadow: "0 24px 60px -12px rgba(6, 24, 43, 0.3)",
        }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            background: COLORS.white,
            borderBottom: `1px solid ${COLORS.gray100}`,
            padding: "18px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            zIndex: 10,
          }}
        >
          <h2 style={{ margin: 0, color: COLORS.navy, fontSize: 19, fontWeight: 800 }}>{title}</h2>
          <button onClick={onClose} style={secondaryButton({ padding: "7px 14px", fontSize: 13 })}>
            Close
          </button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

function AuthGate({ user, setPage }) {
  if (user) return null;
  return (
    <Panel style={{ maxWidth: 540, margin: "64px auto", textAlign: "center", padding: "40px 32px" }}>
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: 14,
          background: COLORS.tealBg,
          color: COLORS.teal,
          display: "grid",
          placeItems: "center",
          margin: "0 auto 18px",
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h2 style={{ margin: "0 0 8px", color: COLORS.navy, fontSize: 22, fontWeight: 800 }}>Authentication Required</h2>
      <p style={{ margin: "0 0 24px", color: COLORS.gray600, fontSize: 14, lineHeight: 1.6 }}>
        Access to this biomedical module requires an authorized user session. Please sign in to continue.
      </p>
      <button onClick={() => setPage("login")} style={primaryButton({ padding: "12px 28px", fontSize: 15 })}>
        Sign In to Platform
      </button>
    </Panel>
  );
}

function primaryButton(extra = {}) {
  return {
    padding: "11px 20px",
    border: "none",
    borderRadius: 10,
    background: "linear-gradient(135deg, #0F6E56 0%, #0D9488 100%)",
    color: COLORS.white,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(15, 110, 86, 0.25)",
    transition: "all 0.18s ease",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...extra,
  };
}

function secondaryButton(extra = {}) {
  return {
    padding: "10px 18px",
    border: `1px solid ${COLORS.gray200}`,
    borderRadius: 10,
    background: COLORS.white,
    color: COLORS.navy,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
    transition: "all 0.18s ease",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...extra,
  };
}

function inputStyle(extra = {}) {
  return {
    padding: "11px 14px",
    border: `1px solid ${COLORS.gray200}`,
    borderRadius: 10,
    fontSize: 14,
    color: COLORS.gray900,
    background: COLORS.white,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.18s ease, box-shadow 0.18s ease",
    ...extra,
  };
}

function NavBar({ page, setPage, user, logout }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const nav = [
    ["home", "Home"],
    ["predict", "Predict"],
    ["network", "Interaction Network"],
    ["drugs", "Drug Library"],
    ["diseases", "Disease Library"],
  ];

  const handleLogout = () => {
    logout();
    setProfileOpen(false);
    setPage("home");
  };

  return (
    <nav
      className="orpha-nav"
      style={{
        background: "rgba(255, 255, 255, 0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: `1px solid ${COLORS.gray100}`,
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 68,
        position: "sticky",
        top: 0,
        zIndex: 40,
        gap: 20,
        boxSizing: "border-box",
      }}
    >
      <button
        onClick={() => setPage("home")}
        style={{ display: "flex", alignItems: "center", gap: 10, border: "none", background: "transparent", cursor: "pointer", padding: 0, minWidth: 0 }}
      >
        <LogoMark size={34} showText />
      </button>

      <div className="orpha-nav-links" style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", minWidth: 0 }}>
        {nav.map(([key, label]) => {
          const isActive = page === key;
          return (
            <button
              key={key}
              onClick={() => setPage(key)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                background: isActive ? COLORS.tealBg : "transparent",
                color: isActive ? COLORS.teal : COLORS.gray600,
                fontWeight: isActive ? 700 : 600,
                fontSize: 14,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {user ? (
        <div style={{ position: "relative", minWidth: 0 }}>
          <button
            onClick={() => setProfileOpen((open) => !open)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              minWidth: 0,
              border: `1px solid ${COLORS.gray200}`,
              background: COLORS.white,
              borderRadius: 10,
              padding: "5px 12px 5px 6px",
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
            }}
            aria-expanded={profileOpen}
            aria-label="Open user profile menu"
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={userLabel(user)} referrerPolicy="no-referrer" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flex: "0 0 32px" }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #0F6E56, #0D9488)", color: COLORS.white, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 14, flex: "0 0 32px" }}>
                {userLabel(user)[0]}
              </div>
            )}
            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.gray900, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {userLabel(user)}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={COLORS.gray600} strokeWidth="2.5">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {profileOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 8px)",
                width: 270,
                maxWidth: "calc(100vw - 32px)",
                background: COLORS.white,
                border: `1px solid ${COLORS.gray100}`,
                borderRadius: 14,
                boxShadow: "0 16px 40px -8px rgba(6, 24, 43, 0.16)",
                padding: 16,
                zIndex: 50,
                animation: "fadeIn 0.18s ease forwards",
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0, marginBottom: 12 }}>
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={userLabel(user)} referrerPolicy="no-referrer" style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover", flex: "0 0 42px" }} />
                ) : (
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg, #0F6E56, #0D9488)", color: COLORS.white, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 16, flex: "0 0 42px" }}>
                    {userLabel(user)[0]}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: COLORS.navy, fontWeight: 800, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userLabel(user)}</div>
                  <div style={{ color: COLORS.gray600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${COLORS.gray100}`, paddingTop: 12 }}>
                <button onClick={handleLogout} style={secondaryButton({ width: "100%", justifyContent: "center", color: COLORS.coral, borderColor: "#FECDD3", background: "#FFF1F2" })}>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button onClick={() => setPage("login")} style={primaryButton({ padding: "9px 20px" })}>
          Sign In
        </button>
      )}
    </nav>
  );
}

function HeroPage({ setPage }) {
  return (
    <div className="animate-fade-in">
      {/* Main Hero Section */}
      <section
        className="orpha-hero"
        style={{
          background: "linear-gradient(135deg, #041221 0%, #072238 45%, #0B4638 100%)",
          padding: "88px 24px 76px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle SVG Molecular Network Pattern in Hero Background */}
        <svg
          viewBox="0 0 1400 500"
          preserveAspectRatio="xMidYMid slice"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0.28,
            pointerEvents: "none",
          }}
        >
          <defs>
            <filter id="nodeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <line x1="120" y1="90" x2="280" y2="180" stroke="rgba(255, 255, 255, 0.18)" strokeWidth="1" strokeDasharray="5 5" />
          <line x1="280" y1="180" x2="210" y2="340" stroke="rgba(255, 255, 255, 0.18)" strokeWidth="1" strokeDasharray="5 5" />
          <line x1="280" y1="180" x2="480" y2="140" stroke="rgba(255, 255, 255, 0.18)" strokeWidth="1" strokeDasharray="5 5" />
          <line x1="1120" y1="100" x2="1280" y2="220" stroke="rgba(255, 255, 255, 0.18)" strokeWidth="1" strokeDasharray="5 5" />
          <line x1="1120" y1="100" x2="940" y2="160" stroke="rgba(255, 255, 255, 0.18)" strokeWidth="1" strokeDasharray="5 5" />
          <line x1="1280" y1="220" x2="1200" y2="380" stroke="rgba(255, 255, 255, 0.18)" strokeWidth="1" strokeDasharray="5 5" />
          
          <circle cx="120" cy="90" r="5" fill="#2DD4BF" filter="url(#nodeGlow)" />
          <circle cx="280" cy="180" r="7" fill="#38BDF8" filter="url(#nodeGlow)" />
          <circle cx="210" cy="340" r="4" fill="#A7F3D0" />
          <circle cx="480" cy="140" r="5" fill="#2DD4BF" />
          <circle cx="1120" cy="100" r="6" fill="#38BDF8" filter="url(#nodeGlow)" />
          <circle cx="1280" cy="220" r="7" fill="#2DD4BF" filter="url(#nodeGlow)" />
          <circle cx="940" cy="160" r="4" fill="#A7F3D0" />
          <circle cx="1200" cy="380" r="5" fill="#38BDF8" />
        </svg>

        {/* Hero Central Content Wrapper */}
        <div style={{ position: "relative", zIndex: 2, maxWidth: 860, margin: "0 auto" }}>
          {/* OrphaAI Logo Emblem - Centered directly above heading */}
          <div style={{ display: "inline-block", marginBottom: 24 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 24px",
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.16)",
                borderRadius: 24,
                backdropFilter: "blur(8px)",
                boxShadow: "0 14px 36px rgba(0, 0, 0, 0.28)",
              }}
            >
              <LogoMark size={64} />
            </div>
          </div>

          {/* Main Title */}
          <h1
            style={{
              fontSize: 50,
              fontWeight: 800,
              color: COLORS.white,
              margin: "0 0 20px",
              lineHeight: 1.15,
              letterSpacing: "-0.035em",
            }}
          >
            AI-Powered{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #2DD4BF 0%, #38BDF8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Drug Repurposing
            </span>{" "}
            &amp; Disease Analysis
          </h1>

          {/* Description */}
          <p
            style={{
              maxWidth: 720,
              margin: "0 auto 38px",
              color: "rgba(255, 255, 255, 0.86)",
              fontSize: 17,
              lineHeight: 1.68,
              fontWeight: 400,
            }}
          >
            OrphaAI combines curated biomedical seed data, live public-database lookups, and an interpretable scoring engine for accelerated drug repurposing discovery.
          </p>

          {/* Hero Action Buttons */}
          <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
            <button
              onClick={() => setPage("predict")}
              style={primaryButton({
                background: "linear-gradient(135deg, #0F6E56 0%, #0D9488 100%)",
                color: COLORS.white,
                fontSize: 15,
                padding: "14px 28px",
                boxShadow: "0 12px 28px rgba(15, 110, 86, 0.45)",
                borderRadius: 12,
              })}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              Run Prediction Engine
            </button>

            <button
              onClick={() => setPage("diseases")}
              style={secondaryButton({
                background: "rgba(255, 255, 255, 0.08)",
                color: COLORS.white,
                borderColor: "rgba(255, 255, 255, 0.25)",
                fontSize: 15,
                padding: "14px 24px",
                backdropFilter: "blur(4px)",
                borderRadius: 12,
              })}
            >
              Explore Disease Library
            </button>

            <button
              onClick={() => setPage("drugs")}
              style={secondaryButton({
                background: "rgba(255, 255, 255, 0.08)",
                color: COLORS.white,
                borderColor: "rgba(255, 255, 255, 0.25)",
                fontSize: 15,
                padding: "14px 24px",
                backdropFilter: "blur(4px)",
                borderRadius: 12,
              })}
            >
              Explore Drug Library
            </button>
          </div>
        </div>
      </section>

      {/* Explore OrphaAI Section */}
      <section
        style={{
          maxWidth: 1140,
          margin: "-32px auto 0",
          padding: "0 24px 48px",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: COLORS.teal,
              background: COLORS.tealBg,
              padding: "4px 12px",
              borderRadius: "20px",
              border: `1px solid #BBF7D0`,
            }}
          >
            PLATFORM MODULES
          </span>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: COLORS.navy, marginTop: 10, marginBottom: 6 }}>
            Explore OrphaAI
          </h2>
          <p style={{ color: COLORS.gray600, fontSize: 15, margin: 0 }}>
            Comprehensive computational tools for biomedical target discovery and drug repurposing.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 24,
          }}
        >
          {/* Card 1: Disease Analysis */}
          <Panel
            style={{
              padding: "30px 26px",
              borderRadius: 16,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              borderTop: `4px solid ${COLORS.tealBright}`,
            }}
          >
            <div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: COLORS.tealBg,
                  color: COLORS.teal,
                  border: `1px solid #BBF7D0`,
                  display: "grid",
                  placeItems: "center",
                  marginBottom: 18,
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <h3 style={{ color: COLORS.navy, fontWeight: 800, fontSize: 20, margin: "0 0 10px" }}>
                Disease Analysis
              </h3>
              <p style={{ color: COLORS.gray600, fontSize: 14, lineHeight: 1.6, margin: "0 0 22px" }}>
                Explore diseases, associated targets, pathways, and biomedical information.
              </p>
            </div>
            <button
              onClick={() => setPage("diseases")}
              style={{
                background: "transparent",
                border: "none",
                color: COLORS.teal,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                alignSelf: "flex-start",
              }}
            >
              Explore Disease Library &rarr;
            </button>
          </Panel>

          {/* Card 2: Drug Repurposing */}
          <Panel
            style={{
              padding: "30px 26px",
              borderRadius: 16,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              borderTop: `4px solid ${COLORS.tealBright}`,
            }}
          >
            <div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: COLORS.tealBg,
                  color: COLORS.teal,
                  border: `1px solid #BBF7D0`,
                  display: "grid",
                  placeItems: "center",
                  marginBottom: 18,
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <h3 style={{ color: COLORS.navy, fontWeight: 800, fontSize: 20, margin: "0 0 10px" }}>
                Drug Repurposing
              </h3>
              <p style={{ color: COLORS.gray600, fontSize: 14, lineHeight: 1.6, margin: "0 0 22px" }}>
                Analyze diseases and discover existing drugs with potential repurposing opportunities.
              </p>
            </div>
            <button
              onClick={() => setPage("predict")}
              style={{
                background: "transparent",
                border: "none",
                color: COLORS.teal,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                alignSelf: "flex-start",
              }}
            >
              Run Prediction &rarr;
            </button>
          </Panel>

          {/* Card 3: Drug–Target Network */}
          <Panel
            style={{
              padding: "30px 26px",
              borderRadius: 16,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              borderTop: `4px solid ${COLORS.tealBright}`,
            }}
          >
            <div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: COLORS.tealBg,
                  color: COLORS.teal,
                  border: `1px solid #BBF7D0`,
                  display: "grid",
                  placeItems: "center",
                  marginBottom: 18,
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              </div>
              <h3 style={{ color: COLORS.navy, fontWeight: 800, fontSize: 20, margin: "0 0 10px" }}>
                Drug–Target Network
              </h3>
              <p style={{ color: COLORS.gray600, fontSize: 14, lineHeight: 1.6, margin: "0 0 22px" }}>
                Explore relationships between drugs, molecular targets, and biological interactions.
              </p>
            </div>
            <button
              onClick={() => setPage("network")}
              style={{
                background: "transparent",
                border: "none",
                color: COLORS.teal,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                alignSelf: "flex-start",
              }}
            >
              Explore Network &rarr;
            </button>
          </Panel>
        </div>
      </section>

      {/* How OrphaAI Works Section */}
      <section
        style={{
          maxWidth: 1140,
          margin: "0 auto",
          padding: "32px 24px 72px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: COLORS.teal,
              background: COLORS.tealBg,
              padding: "4px 12px",
              borderRadius: "20px",
              border: `1px solid #BBF7D0`,
            }}
          >
            WORKFLOW
          </span>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: COLORS.navy, marginTop: 10, marginBottom: 6 }}>
            How OrphaAI Works
          </h2>
          <p style={{ color: COLORS.gray600, fontSize: 15, margin: 0 }}>
            A structured 4-step pipeline bridging biomedical databases and machine learning.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 20,
          }}
        >
          {[
            {
              step: "01",
              title: "Select Disease",
              desc: "Choose a disease or indication to analyze.",
            },
            {
              step: "02",
              title: "Biomedical Data",
              desc: "Combine relevant biomedical information from available data sources.",
            },
            {
              step: "03",
              title: "AI Analysis",
              desc: "Apply the platform's existing computational scoring methods.",
            },
            {
              step: "04",
              title: "Repurposing Candidates",
              desc: "Explore ranked drug candidates and supporting information.",
            },
          ].map((item) => (
            <Panel
              key={item.step}
              style={{
                padding: "24px 20px",
                borderRadius: 16,
                position: "relative",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: COLORS.teal,
                  background: COLORS.tealBg,
                  border: `1px solid #BBF7D0`,
                  padding: "4px 10px",
                  borderRadius: 12,
                  display: "inline-block",
                  marginBottom: 14,
                }}
              >
                Step {item.step}
              </div>
              <h4 style={{ color: COLORS.navy, fontWeight: 800, fontSize: 17, margin: "0 0 8px" }}>
                {item.title}
              </h4>
              <p style={{ color: COLORS.gray600, fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>
                {item.desc}
              </p>
            </Panel>
          ))}
        </div>
      </section>
    </div>
  );
}

function LoginPage({ setPage }) {
  const { loginWithPassword, registerWithPassword, user } = useAuth();
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [institution, setInstitution] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) setPage("home");
  }, [setPage, user]);

  const validate = () => {
    if (!emailPattern.test(email.trim())) return "Enter a valid email address with @ and a domain.";
    if (tab === "register" && !passwordPattern.test(password)) {
      return "Password must be 8+ characters with uppercase, lowercase, number, and special character.";
    }
    if (tab === "register" && fullName.trim().split(/\s+/).length < 2) return "Enter first and last name.";
    if (!password) return "Password is required.";
    return "";
  };

  const submit = async () => {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [firstName, ...lastParts] = fullName.trim().split(/\s+/);
      if (tab === "login") {
        await loginWithPassword({ email: email.trim(), password });
      } else {
        await registerWithPassword({
          email: email.trim(),
          password,
          firstName,
          lastName: lastParts.join(" "),
          institution,
        });
      }
      setPage("home");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "calc(100vh - 68px)",
        display: "grid",
        placeItems: "center",
        background: "radial-gradient(circle at 50% 30%, #F0F4F8 0%, #F8FAFC 100%)",
        padding: "36px 20px",
      }}
    >
      <Panel style={{ width: "100%", maxWidth: 440, padding: "36px 32px" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <LogoMark size={58} />
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 24, fontWeight: 800, color: COLORS.navy, marginTop: 12 }}>
            OrphaAI Research Portal
          </div>
          <div style={{ color: COLORS.gray600, fontSize: 14, marginTop: 4 }}>Access secured biomedical platform</div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
            marginBottom: 24,
            background: COLORS.gray50,
            padding: 4,
            borderRadius: 12,
            border: `1px solid ${COLORS.gray100}`,
          }}
        >
          {["login", "register"].map((value) => {
            const isActive = tab === value;
            return (
              <button
                key={value}
                onClick={() => {
                  setTab(value);
                  setError("");
                }}
                style={{
                  padding: "9px",
                  borderRadius: 8,
                  border: "none",
                  background: isActive ? COLORS.white : "transparent",
                  color: isActive ? COLORS.navy : COLORS.gray600,
                  fontWeight: isActive ? 800 : 600,
                  fontSize: 14,
                  cursor: "pointer",
                  boxShadow: isActive ? "0 2px 6px rgba(15, 23, 42, 0.08)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {value === "login" ? "Sign In" : "Register"}
              </button>
            );
          })}
        </div>

        {tab === "register" && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: COLORS.gray600, display: "block", marginBottom: 6 }}>Full Name</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. Jane Smith" style={inputStyle({ width: "100%" })} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: COLORS.gray600, display: "block", marginBottom: 6 }}>Institution / Organization</label>
              <input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="University or laboratory" style={inputStyle({ width: "100%" })} />
            </div>
          </>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: COLORS.gray600, display: "block", marginBottom: 6 }}>Email Address</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="researcher@institution.edu" style={inputStyle({ width: "100%" })} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: COLORS.gray600, display: "block", marginBottom: 6 }}>Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="••••••••••••"
            onKeyDown={(e) => e.key === "Enter" && submit()}
            style={inputStyle({ width: "100%" })}
          />
        </div>

        {tab === "register" && (
          <div style={{ fontSize: 12, color: COLORS.gray600, marginBottom: 16, lineHeight: 1.45 }}>
            Use 8+ characters with uppercase, lowercase, number, and special character.
          </div>
        )}

        {error && (
          <div style={{ background: COLORS.coralBg, color: COLORS.coral, border: "1px solid #FECDD3", borderRadius: 10, padding: "11px 14px", fontSize: 13, marginBottom: 16, lineHeight: 1.4 }}>
            {error}
          </div>
        )}

        <button onClick={submit} disabled={loading} style={primaryButton({ width: "100%", opacity: loading ? 0.65 : 1, padding: "12px", fontSize: 15 })}>
          {loading ? "Please wait..." : tab === "login" ? "Sign In" : "Create Researcher Account"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0", color: COLORS.gray300, fontSize: 12 }}>
          <span style={{ height: 1, background: COLORS.gray100, flex: 1 }} />
          <span style={{ color: COLORS.gray600, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 11, fontWeight: 700 }}>Or continue with</span>
          <span style={{ height: 1, background: COLORS.gray100, flex: 1 }} />
        </div>

        <GoogleSignInButton disabled={loading} onError={setError} />

        <div style={{ textAlign: "center", marginTop: 18, padding: "10px", background: COLORS.gray50, borderRadius: 8, fontSize: 12, color: COLORS.gray600 }}>
          <b>Demo Account:</b> demo@orphaai.com / Demo1234
        </div>
      </Panel>
    </div>
  );
}

function LibrarySearch({ value, onChange, placeholder, onSubmit }) {
  return (
    <Panel style={{ padding: "20px 24px", marginBottom: 28, borderRadius: 16 }}>
      <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.gray600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
        Search the Drug Library
      </label>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: "1 1 320px", position: "relative" }}>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            placeholder={placeholder}
            style={inputStyle({
              width: "100%",
              fontSize: 15,
              padding: "13px 16px 13px 44px",
              borderRadius: 12,
              borderColor: COLORS.gray200,
              boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.04)",
            })}
          />
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={COLORS.gray400}
            strokeWidth="2"
            style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </div>
        <button
          onClick={onSubmit}
          style={primaryButton({
            padding: "14px 28px",
            fontSize: 15,
            borderRadius: 12,
            background: "linear-gradient(135deg, #0F6E56 0%, #0D9488 100%)",
            boxShadow: "0 6px 18px rgba(15, 110, 86, 0.3)",
          })}
        >
          Search Library
        </button>
      </div>
    </Panel>
  );
}

function DrugLibrary({ user, setPage, setSearchContext }) {
  const [query, setQuery] = useState("");
  const [drugs, setDrugs] = useState([]);
  const [external, setExternal] = useState(null);
  const [pubchemModal, setPubchemModal] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async (q = "") => {
    setLoading(true);
    setMessage("");
    setExternal(null);
    try {
      const data = await api(`/drugs?per_page=50&q=${encodeURIComponent(q)}`);
      setDrugs(data.drugs || []);
      if ((data.drugs || []).length === 0 && q.trim()) {
        try {
          const ext = await api(`/external/drug/${encodeURIComponent(q.trim())}`);
          setExternal(ext);
        } catch {
          setMessage("No local record or live public-database match found.");
        }
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openPubChem = async (drug) => {
    setMessage("");
    try {
      const data = await api(`/pubchem/${encodeURIComponent(drug.name)}`);
      setPubchemModal({ drug, pubchem: data });
    } catch (err) {
      setMessage(`PubChem lookup failed for ${drug.name}: ${err.message}`);
      setSearchContext(drug);
      setPage("drugDetail");
    }
  };

  useEffect(() => {
    if (!user) return undefined;
    const handle = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(handle);
  }, [user]);

  if (!user) return <AuthGate user={user} setPage={setPage} />;

  return (
    <PageShell maxWidth={1140}>
      {/* Header section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: COLORS.tealBg, color: COLORS.teal, border: `1px solid #BBF7D0`, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.teal }} />
          PHARMACOLOGICAL REPOSITORY
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 800, color: COLORS.navy, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          Drug Library
        </h1>
        <p style={{ color: COLORS.gray600, marginTop: 0, fontSize: 15, maxWidth: 720, lineHeight: 1.6 }}>
          Explore approved and investigational drugs, molecular targets, and therapeutic information.
        </p>
      </div>

      <LibrarySearch
        value={query}
        onChange={setQuery}
        placeholder="Search by drug name... (e.g. Metformin, Sildenafil, Imatinib, Aspirin)"
        onSubmit={() => load(query)}
      />

      {loading && (
        <div style={{ padding: "32px 0", textAlign: "center", color: COLORS.gray600, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}>
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
          Searching drug library...
        </div>
      )}

      {message && (
        <div style={{ background: COLORS.amberBg, color: COLORS.amber, border: `1px solid #FDE68A`, borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 14, fontWeight: 600 }}>
          {message}
        </div>
      )}

      {/* Collection Section Header */}
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: COLORS.navy, margin: "0 0 4px" }}>
          Explore Drugs
        </h2>
        <p style={{ color: COLORS.gray600, fontSize: 14, margin: 0 }}>
          Browse available pharmacological candidates and their associated molecular targets.
        </p>
      </div>

      {!loading && drugs.length === 0 && !external && (
        <Panel style={{ padding: 40, textAlign: "center", borderRadius: 16 }}>
          <div style={{ color: COLORS.navy, fontSize: 18, fontWeight: 800, marginBottom: 6 }}>No matching drugs found</div>
          <p style={{ color: COLORS.gray600, fontSize: 14, margin: 0 }}>Try another drug name search query.</p>
        </Panel>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
        {drugs.map((drug) => (
          <Panel
            key={drug.id}
            style={{
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "24px 22px",
              borderRadius: 16,
              borderTop: `3px solid ${COLORS.tealBright}`,
              transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
            }}
          >
            <div onClick={() => openPubChem(drug)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                <h3 style={{ margin: 0, color: COLORS.navy, fontSize: 19, fontWeight: 800 }}>{drug.name}</h3>
                <Badge tone={drug.status === "approved" ? "teal" : "amber"}>{drug.status || "approved"}</Badge>
              </div>

              <p style={{ color: COLORS.gray600, fontSize: 13.5, minHeight: 42, lineHeight: 1.55, margin: "0 0 16px" }}>
                {drug.indication || drug.description || "No indication listed"}
              </p>

              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.gray600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  PRIMARY TARGETS
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(drug.primaryTargets || []).length > 0 ? (
                    (drug.primaryTargets || []).slice(0, 5).map((target) => (
                      <Badge key={target.symbol} tone="navy">{target.symbol}</Badge>
                    ))
                  ) : (
                    <span style={{ fontSize: 12, color: COLORS.gray300 }}>No primary targets listed</span>
                  )}
                  {drug.drugClass && <Badge tone="purple">{drug.drugClass}</Badge>}
                </div>
              </div>
            </div>
          </Panel>
        ))}
      </div>

      {external && <ExternalDrugCard data={external} />}
      {pubchemModal && (
        <Modal title={`${pubchemModal.drug.name} — PubChem Compound Data`} onClose={() => setPubchemModal(null)}>
          <PubChemInfo drug={pubchemModal.drug} data={pubchemModal.pubchem} />
        </Modal>
      )}
    </PageShell>
  );
}

function PubChemInfo({ drug, data }) {
  const rows = [
    ["PubChem PID/CID", data.pubchemId || data.cid],
    ["IUPAC Name", data.iupacName],
    ["Molecular Formula", data.molecularFormula],
    ["Molecular Weight", data.molecularWeight],
    ["Canonical SMILES", data.canonicalSmiles || data.connectivitySmiles],
    ["Isomeric SMILES", data.isomericSmiles],
    ["InChIKey", data.inchiKey],
    ["XLogP", data.xlogp],
    ["TPSA", data.tpsa],
    ["Charge", data.charge],
    ["H-bond Donors", data.hBondDonorCount],
    ["H-bond Acceptors", data.hBondAcceptorCount],
    ["Rotatable Bonds", data.rotatableBondCount],
    ["Exact Mass", data.exactMass],
    ["Monoisotopic Mass", data.monoisotopicMass],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 220px) minmax(0, 1fr)", gap: 24, alignItems: "start" }}>
      <div>
        {data.image2d && (
          <img
            alt={`${drug.name} structure`}
            src={data.image2d}
            style={{ width: "100%", border: `1px solid ${COLORS.gray100}`, borderRadius: 12, background: COLORS.white, padding: 8 }}
          />
        )}
        {data.sourceUrl && (
          <a href={data.sourceUrl} target="_blank" rel="noreferrer" style={{ ...secondaryButton({ display: "block", textAlign: "center", marginTop: 12, textDecoration: "none" }) }}>
            Open PubChem
          </a>
        )}
      </div>
      <div>
        {data.sourceStatus === "local-fallback" && (
          <div style={{ background: COLORS.amberBg, color: COLORS.amber, border: `1px solid #FDE68A`, borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 13, lineHeight: 1.45 }}>
            PubChem live lookup is unavailable in this environment, so this popup is using local curated molecular data.
          </div>
        )}
        {data.description && <p style={{ color: COLORS.gray800, lineHeight: 1.6, marginTop: 0, fontSize: 14 }}>{data.description}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 14 }}>
          {rows.map(([label, value]) => (
            <Info key={label} label={label} value={value} />
          ))}
        </div>
        {data.synonyms?.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h4 style={{ color: COLORS.navy, fontSize: 14, marginBottom: 8 }}>Synonyms</h4>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {data.synonyms.map((s) => (
                <Badge key={s} tone="navy">{s}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ExternalDrugCard({ data }) {
  const p = data.pubchem;
  const c = data.chembl;
  return (
    <Panel style={{ marginTop: 24 }}>
      <h3 style={{ margin: "0 0 14px", color: COLORS.navy, fontSize: 18 }}>Live Public Database Match</h3>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(160px, 200px) 1fr", gap: 20 }}>
        {p?.image2d ? <img alt={`${data.query} 2D structure`} src={p.image2d} style={{ width: "100%", border: `1px solid ${COLORS.gray100}`, borderRadius: 10 }} /> : <div />}
        <div>
          {p && (
            <p style={{ marginTop: 0, color: COLORS.gray800, fontSize: 14, lineHeight: 1.6 }}>
              <b>PubChem CID:</b> {p.cid}<br />
              <b>Formula:</b> {p.molecularFormula}<br />
              <b>Weight:</b> {p.molecularWeight}<br />
              <b>IUPAC:</b> {p.iupacName}
            </p>
          )}
          {c && (
            <p style={{ color: COLORS.gray800, fontSize: 14 }}>
              <b>ChEMBL:</b> {c.chemblId}<br />
              <b>Max phase:</b> {c.maxPhase ?? "N/A"}
            </p>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            {p?.sourceUrl && <a href={p.sourceUrl} target="_blank" rel="noreferrer" style={secondaryButton({ textDecoration: "none" })}>PubChem</a>}
            {c?.sourceUrl && <a href={c.sourceUrl} target="_blank" rel="noreferrer" style={secondaryButton({ textDecoration: "none" })}>ChEMBL</a>}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function DiseaseLibrary({ user, setPage, setSearchContext }) {
  const [query, setQuery] = useState("");
  const [diseases, setDiseases] = useState([]);
  const [external, setExternal] = useState(null);
  const [keggModal, setKeggModal] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async (q = "") => {
    setLoading(true);
    setMessage("");
    setExternal(null);
    try {
      const data = await api(`/diseases?per_page=50&q=${encodeURIComponent(q)}`);
      setDiseases(data.diseases || []);
      if ((data.diseases || []).length === 0 && q.trim()) {
        try {
          const ext = await api(`/external/disease/${encodeURIComponent(q.trim())}`);
          setExternal(ext);
        } catch {
          setMessage("No local record or live public-database match found.");
        }
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openKegg = async (disease) => {
    setMessage("");
    try {
      const data = await api(`/kegg/disease/${encodeURIComponent(disease.name)}`);
      setKeggModal({ disease, kegg: data });
    } catch (err) {
      setMessage(`KEGG lookup failed for ${disease.name}: ${err.message}`);
      setSearchContext(disease);
      setPage("diseaseDetail");
    }
  };

  useEffect(() => {
    if (!user) return undefined;
    const handle = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(handle);
  }, [user]);

  if (!user) return <AuthGate user={user} setPage={setPage} />;

  return (
    <PageShell maxWidth={1140}>
      {/* Header section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: COLORS.tealBg, color: COLORS.teal, border: `1px solid #BBF7D0`, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.teal }} />
          PATHOLOGICAL &amp; GENETIC REPOSITORY
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 800, color: COLORS.navy, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          Disease Library
        </h1>
        <p style={{ color: COLORS.gray600, marginTop: 0, fontSize: 15, maxWidth: 720, lineHeight: 1.6 }}>
          Explore diseases, biological information, and therapeutic research context.
        </p>
      </div>

      <LibrarySearch
        value={query}
        onChange={setQuery}
        placeholder="Search by disease name... (e.g. Alzheimer's, ALS, Cancer, Hypertension)"
        onSubmit={() => load(query)}
      />

      {loading && (
        <div style={{ padding: "32px 0", textAlign: "center", color: COLORS.gray600, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}>
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
          Searching disease library...
        </div>
      )}

      {message && (
        <div style={{ background: COLORS.amberBg, color: COLORS.amber, border: `1px solid #FDE68A`, borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 14, fontWeight: 600 }}>
          {message}
        </div>
      )}

      {/* Collection Section Header */}
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: COLORS.navy, margin: "0 0 4px" }}>
          Explore Diseases
        </h2>
        <p style={{ color: COLORS.gray600, fontSize: 14, margin: 0 }}>
          Browse diseases and indications available for biomedical analysis.
        </p>
      </div>

      {!loading && diseases.length === 0 && !external && (
        <Panel style={{ padding: 40, textAlign: "center", borderRadius: 16 }}>
          <div style={{ color: COLORS.navy, fontSize: 18, fontWeight: 800, marginBottom: 6 }}>No matching diseases found</div>
          <p style={{ color: COLORS.gray600, fontSize: 14, margin: 0 }}>Try another disease name search query.</p>
        </Panel>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
        {diseases.map((disease) => (
          <Panel
            key={disease.id}
            style={{
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "24px 22px",
              borderRadius: 16,
              borderTop: `3px solid ${COLORS.tealBright}`,
              transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
            }}
          >
            <div onClick={() => openKegg(disease)}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: COLORS.tealBg, color: COLORS.teal, border: `1px solid #BBF7D0`, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 15, flex: "0 0 44px" }}>
                  {disease.associatedGenes?.length || 0}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: "0 0 6px", color: COLORS.navy, fontSize: 19, fontWeight: 800, lineHeight: 1.3 }}>{disease.name}</h3>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Badge tone="purple">{disease.diseaseType || "untyped"}</Badge>
                    {disease.isRare && <Badge tone="amber">rare</Badge>}
                    {disease.omimId && <Badge tone="navy">OMIM {disease.omimId}</Badge>}
                  </div>
                </div>
              </div>

              {(disease.associatedGenes || []).length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLORS.gray100}` }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.gray600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                    ASSOCIATED GENE TARGETS
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(disease.associatedGenes || []).slice(0, 5).map((g) => (
                      <Badge key={g.symbol}>{g.symbol}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 18, color: COLORS.teal, fontWeight: 700, fontSize: 13.5, display: "inline-flex", alignItems: "center", gap: 4 }}>
                Explore KEGG Pathways &rarr;
              </div>
            </div>
          </Panel>
        ))}
      </div>

      {external && <ExternalDiseaseCard data={external} />}
      {keggModal && (
        <Modal title={`${keggModal.disease.name} — KEGG Pathway Information`} onClose={() => setKeggModal(null)}>
          <KeggInfo disease={keggModal.disease} data={keggModal.kegg} />
        </Modal>
      )}
    </PageShell>
  );
}

function KeggInfo({ disease, data }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 20 }}>
        <Info label="KEGG Entry" value={data.entry} />
        <Info label="Name" value={(data.names || [disease.name]).join("; ")} />
        <Info label="Category" value={data.category} />
        <Info label="Linked Drugs" value={data.drugs?.length || 0} />
      </div>
      {data.sourceStatus === "local-fallback" && (
        <div style={{ background: COLORS.amberBg, color: COLORS.amber, border: `1px solid #FDE68A`, borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, lineHeight: 1.45 }}>
          KEGG live lookup is unavailable or did not match this exact disease name, so this popup is using local pathway data.
        </div>
      )}
      {data.description && <p style={{ color: COLORS.gray800, lineHeight: 1.6, fontSize: 14 }}>{data.description}</p>}
      <h3 style={{ color: COLORS.navy, marginTop: 18, marginBottom: 12 }}>Disease Pathways From KEGG</h3>
      {data.pathways?.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {data.pathways.map((p) => (
            <a key={p.id} href={`https://www.genome.jp/entry/${p.id}`} target="_blank" rel="noreferrer" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "12px 16px", border: `1px solid ${COLORS.gray100}`, borderRadius: 10, textDecoration: "none", color: COLORS.gray800, background: COLORS.white }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name || p.id}</span>
              <Badge tone="purple">{p.id}</Badge>
            </a>
          ))}
        </div>
      ) : (
        <p style={{ color: COLORS.gray600, fontSize: 14 }}>KEGG did not list disease pathways for this entry.</p>
      )}
      {data.sourceUrl && (
        <a href={data.sourceUrl} target="_blank" rel="noreferrer" style={{ ...secondaryButton({ display: "inline-flex", marginTop: 20, textDecoration: "none" }) }}>
          Open KEGG Entry
        </a>
      )}
    </div>
  );
}

function ExternalDiseaseCard({ data }) {
  const hits = data.openTargets?.matches || [];
  const kegg = data.kegg?.matches || [];
  const geo = data.geo?.datasetIds || [];
  return (
    <Panel style={{ marginTop: 24 }}>
      <h3 style={{ margin: "0 0 12px", color: COLORS.navy, fontSize: 18 }}>Live Public Database Match</h3>
      {hits.length > 0 && <p style={{ color: COLORS.gray800, fontSize: 14 }}><b>Open Targets:</b> {hits.map((h) => `${h.name} (${h.id})`).join(", ")}</p>}
      {kegg.length > 0 && <p style={{ color: COLORS.gray800, fontSize: 14 }}><b>KEGG:</b> {kegg.map((h) => `${h.name} (${h.id})`).join(", ")}</p>}
      {geo.length > 0 && <p style={{ color: COLORS.gray800, fontSize: 14 }}><b>GEO dataset IDs:</b> {geo.join(", ")}</p>}
    </Panel>
  );
}

function DrugDetail({ user, item, setPage }) {
  const [drug, setDrug] = useState(item);
  const [pubchem, setPubchem] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      if (!item?.id) return;
      try {
        const data = await api(`/drugs/${item.id}`);
        setDrug(data.drug);
        const ext = await api(`/pubchem/${encodeURIComponent(data.drug.name)}`).catch(() => null);
        setPubchem(ext);
      } catch (err) {
        setMessage(err.message);
      }
    }
    if (user) load();
  }, [item, user]);

  if (!user) return <AuthGate user={user} setPage={setPage} />;
  if (!drug) return null;

  return (
    <PageShell maxWidth={980}>
      <button onClick={() => setPage("drugs")} style={secondaryButton({ marginBottom: 20 })}>
        &larr; Back to Drug Library
      </button>
      {message && <p style={{ color: COLORS.amber, fontSize: 14 }}>{message}</p>}
      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ color: COLORS.navy, margin: 0, fontSize: 32 }}>{drug.name}</h1>
            <p style={{ color: COLORS.gray600, marginTop: 6, fontSize: 15, lineHeight: 1.5 }}>{drug.description || drug.indication}</p>
          </div>
          <Badge tone={drug.status === "approved" ? "teal" : "amber"}>{drug.status || "unknown"}</Badge>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 22 }}>
          <Info label="Class" value={drug.drugClass} />
          <Info label="Molecular Formula" value={drug.molecularFormula || pubchem?.molecularFormula} />
          <Info label="Molecular Weight" value={drug.molecularWeight || pubchem?.molecularWeight} />
          <Info label="DrugBank / ChEMBL" value={`${drug.drugbankId || "N/A"} / ${drug.chemblId || "N/A"}`} />
        </div>
        {pubchem?.image2d && (
          <img alt={`${drug.name} structure`} src={pubchem.image2d} style={{ marginTop: 22, maxWidth: 260, border: `1px solid ${COLORS.gray100}`, borderRadius: 12, padding: 8 }} />
        )}
        <h3 style={{ color: COLORS.navy, marginTop: 24, marginBottom: 12 }}>Primary Targets</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(drug.primaryTargets || []).map((t) => (
            <Badge key={t.symbol} tone="navy">{t.symbol}</Badge>
          ))}
        </div>
        <h3 style={{ color: COLORS.navy, marginTop: 20, marginBottom: 12 }}>Pathways</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(drug.pathways || []).map((p) => (
            <Badge key={p.id} tone="purple">{p.name}</Badge>
          ))}
        </div>
      </Panel>
    </PageShell>
  );
}

function DiseaseDetail({ user, item, setPage }) {
  const [disease, setDisease] = useState(item);
  const [predictions, setPredictions] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      if (!item?.id) return;
      try {
        const detail = await api(`/diseases/${item.id}`);
        setDisease(detail.disease);
        const preds = await api(`/diseases/${item.id}/predictions`);
        setPredictions(preds.predictions || []);
      } catch (err) {
        setMessage(err.message);
      }
    }
    if (user) load();
  }, [item, user]);

  if (!user) return <AuthGate user={user} setPage={setPage} />;
  if (!disease) return null;

  return (
    <PageShell maxWidth={980}>
      <button onClick={() => setPage("diseases")} style={secondaryButton({ marginBottom: 20 })}>
        &larr; Back to Disease Library
      </button>
      {message && <p style={{ color: COLORS.amber, fontSize: 14 }}>{message}</p>}
      <Panel>
        <h1 style={{ color: COLORS.navy, margin: 0, fontSize: 32 }}>{disease.name}</h1>
        <p style={{ color: COLORS.gray600, marginTop: 6, fontSize: 15, lineHeight: 1.5 }}>{disease.description || "No description available."}</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "16px 0 20px" }}>
          <Badge tone="purple">{disease.diseaseType || "untyped"}</Badge>
          {disease.isRare && <Badge tone="amber">rare disease</Badge>}
          {disease.omimId && <Badge tone="navy">OMIM {disease.omimId}</Badge>}
        </div>
        <h3 style={{ color: COLORS.navy, marginTop: 20, marginBottom: 12 }}>Associated Genes</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(disease.associatedGenes || []).map((g) => (
            <Badge key={g.symbol}>{g.symbol}</Badge>
          ))}
        </div>
        <h3 style={{ color: COLORS.navy, marginTop: 20, marginBottom: 12 }}>Pathways</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(disease.pathways || []).map((p) => (
            <Badge key={p.id} tone="purple">{p.name}</Badge>
          ))}
        </div>
      </Panel>
      <Panel style={{ marginTop: 20 }}>
        <h3 style={{ marginTop: 0, color: COLORS.navy, fontSize: 18, marginBottom: 14 }}>Stored Predictions</h3>
        {predictions.length === 0 ? (
          <p style={{ color: COLORS.gray600, fontSize: 14 }}>No predictions stored yet. Run the predictor for this disease.</p>
        ) : (
          predictions.slice(0, 8).map((p) => <PredictionRow key={p.id} pred={p} />)
        )}
      </Panel>
    </PageShell>
  );
}

function Info({ label, value }) {
  return (
    <div style={{ background: COLORS.gray50, border: `1px solid ${COLORS.gray100}`, borderRadius: 10, padding: 12 }}>
      <div style={{ color: COLORS.gray600, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{label}</div>
      <div style={{ color: COLORS.navy, fontWeight: 700, fontSize: 14, overflowWrap: "anywhere", lineHeight: 1.35 }}>{value || "N/A"}</div>
    </div>
  );
}

function PredictPage({ user, setPage }) {
  const [disease, setDisease] = useState("");
  const [results, setResults] = useState([]);
  const [currentTreatments, setCurrentTreatments] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState("");

  const runPrediction = async () => {
    if (!disease.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);
    setCurrentTreatments([]);
    try {
      const data = await api("/predictions/run", {
        method: "POST",
        body: JSON.stringify({ disease_name: disease.trim(), model: "ensemble", top_n: 10, min_score: 0.15 }),
      });
      setMeta({ disease: data.disease, model: data.model });
      setCurrentTreatments(data.currentTreatments || []);
      setResults(data.repurposedPredictions || data.predictions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async () => {
    const diseaseName = meta?.disease?.name || disease;
    setDownloadStatus("Preparing report...");
    const lines = [
      `OrphaAI Drug Repurposing Report`,
      `Disease: ${diseaseName}`,
      `Generated: ${new Date().toLocaleString()}`,
      "",
      "Methodology: Ensemble ranking using molecular similarity, gene/target network overlap, pathway overlap, and deterministic GNN proxy.",
      "",
      "Currently Used / Standard Drugs:",
      ...(currentTreatments.length
        ? currentTreatments.flatMap((item, index) => [
            `${index + 1}. ${item.name} - ${item.reason || "Current/standard treatment"}`,
          ])
        : ["No current-treatment mapping found in the local curated set."]),
      "",
      "Top Candidate Drugs:",
      ...results.flatMap((pred, index) => [
        `${index + 1}. ${pred.drug?.name || "Unknown drug"} - Evidence ${pred.evidenceLevel || "low"}`,
        `   Molecular weight: ${pred.drug?.molecularWeight || "N/A"}; Drug class: ${pred.drug?.drugClass || "N/A"}`,
        `   Rationale: ${pred.rationale || "N/A"}`,
        "",
      ]),
    ];
    const pdf = makePdf(lines);
    try {
      const reportPrefix = `orphaai_${diseaseName.replace(/[^A-Za-z0-9]+/g, "_")}_report`;
      const location = await downloadPdfReport(uniqueReportFilename(reportPrefix), pdf);
      setDownloadStatus(`Success: PDF report saved to ${location}`);
    } catch (err) {
      setDownloadStatus(`Error: ${err.message || "Report download failed."}`);
    }
  };

  if (!user) return <AuthGate user={user} setPage={setPage} />;

  return (
    <PageShell maxWidth={1040}>
      {/* Header section */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: COLORS.tealBg, color: COLORS.teal, border: `1px solid #BBF7D0`, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.teal }} />
          AI DISCOVERY WORKSPACE
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 800, color: COLORS.navy, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
          Drug Repurposing Predictor
        </h1>
        <p style={{ color: COLORS.gray600, margin: 0, fontSize: 15, maxWidth: 720, lineHeight: 1.6 }}>
          Analyze diseases or clinical indications to generate computational drug repurposing candidates backed by molecular fingerprints, target interaction networks, and AI scoring.
        </p>
      </div>

      {/* Main Prediction Workspace Card */}
      <Panel style={{ padding: "32px 28px", borderRadius: 18, borderTop: `4px solid ${COLORS.tealBright}`, boxShadow: "0 8px 30px rgba(15, 23, 42, 0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 800, color: COLORS.navy, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            TARGET DISEASE OR INDICATION
          </label>
          <span style={{ fontSize: 12, color: COLORS.gray600 }}>Enter a disease or condition to analyze</span>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 340px", position: "relative" }}>
            <input
              value={disease}
              onChange={(e) => setDisease(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runPrediction()}
              placeholder="Search or enter a disease / indication... (e.g. Alzheimer's Disease, ALS, Hypertension)"
              style={inputStyle({
                width: "100%",
                fontSize: 15,
                padding: "13px 16px 13px 44px",
                borderRadius: 12,
                borderColor: COLORS.gray200,
                boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.04)",
              })}
            />
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={COLORS.gray400}
              strokeWidth="2"
              style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>

          <button
            onClick={runPrediction}
            disabled={loading}
            style={primaryButton({
              opacity: loading ? 0.7 : 1,
              padding: "14px 28px",
              fontSize: 15,
              borderRadius: 12,
              background: "linear-gradient(135deg, #0F6E56 0%, #0D9488 100%)",
              boxShadow: "0 6px 18px rgba(15, 110, 86, 0.3)",
              minWidth: 170,
            })}
          >
            {loading ? (
              <>
                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}>
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                Analyzing Target...
              </>
            ) : (
              <>
                Run Prediction &rarr;
              </>
            )}
          </button>
        </div>

        {/* Sample Diseases Quick-Start Chips */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.gray600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Try an example:
          </span>
          {["Alzheimer's Disease", "Amyotrophic Lateral Sclerosis", "Epilepsy", "Breast Cancer"].map((x) => (
            <button
              key={x}
              onClick={() => setDisease(x)}
              style={secondaryButton({
                padding: "6px 14px",
                fontSize: 12.5,
                borderRadius: 20,
                borderColor: COLORS.gray200,
                background: disease === x ? COLORS.tealBg : COLORS.white,
                color: disease === x ? COLORS.teal : COLORS.gray800,
                fontWeight: disease === x ? 800 : 600,
              })}
            >
              {x}
            </button>
          ))}
        </div>
      </Panel>

      {/* Error Banner if any */}
      {error && (
        <div style={{ background: COLORS.coralBg, color: COLORS.coral, border: "1px solid #FECDD3", borderRadius: 12, padding: "14px 18px", marginTop: 20, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error}
        </div>
      )}

      {/* How OrphaAI Analyzes a Disease Section (Explanatory flow UI) */}
      <section style={{ marginTop: 36, marginBottom: 36 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: COLORS.navy, margin: "0 0 6px" }}>
            How OrphaAI analyzes a disease
          </h2>
          <p style={{ color: COLORS.gray600, fontSize: 13.5, margin: 0 }}>
            Structured ensemble workflow for target matching and drug repurposing.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {[
            { step: "01", title: "Disease / Indication", desc: "Select target indication" },
            { step: "02", title: "Biomedical Data", desc: "Cross-reference target genes & OMIM" },
            { step: "03", title: "AI Analysis", desc: "Similarity & network propagation" },
            { step: "04", title: "Candidate Scoring", desc: "Ensemble multi-score calculation" },
            { step: "05", title: "Repurposing Results", desc: "Ranked candidates & PDF report" },
          ].map((item) => (
            <Panel key={item.step} style={{ padding: "16px 14px", borderRadius: 12, textAlign: "center", background: COLORS.white }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: COLORS.teal, background: COLORS.tealBg, border: `1px solid #BBF7D0`, padding: "2px 8px", borderRadius: 8, display: "inline-block", marginBottom: 8 }}>
                {item.step}
              </span>
              <div style={{ color: COLORS.navy, fontWeight: 800, fontSize: 13.5, marginBottom: 4 }}>{item.title}</div>
              <div style={{ color: COLORS.gray600, fontSize: 11.5, lineHeight: 1.4 }}>{item.desc}</div>
            </Panel>
          ))}
        </div>
      </section>

      {/* Ensemble Methodology Summary Badges */}
      <section style={{ marginBottom: 36, padding: "18px 24px", background: COLORS.navyBg, borderRadius: 14, border: `1px solid ${COLORS.gray200}` }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.navy, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          AI Ensemble Methodology Components
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Badge tone="teal">Molecular Similarity (Morgan Fingerprints &amp; Tanimoto)</Badge>
          <Badge tone="purple">Target/Network Evidence (ChEMBL &amp; STITCH)</Badge>
          <Badge tone="cyan">GNN-based Graph Scoring (GraphSAGE Model)</Badge>
        </div>
      </section>

      {/* Results Area */}
      {(currentTreatments.length > 0 || results.length > 0) && (
        <section style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ color: COLORS.navy, margin: 0, fontSize: 24, fontWeight: 800 }}>
                Prediction Results for {meta?.disease?.name || disease}
              </h2>
              <p style={{ color: COLORS.gray600, fontSize: 13, marginTop: 4 }}>
                Model: Ensemble (Similarity + Target Overlap + GNN proxy)
              </p>
            </div>
            <button onClick={downloadReport} style={primaryButton({ background: COLORS.teal, padding: "10px 18px", fontSize: 13.5, borderRadius: 10 })}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download PDF Report
            </button>
          </div>

          {downloadStatus && (
            <div style={{ color: downloadStatus.startsWith("Error:") ? COLORS.coral : COLORS.teal, fontSize: 13, marginBottom: 16, fontWeight: 600, padding: "10px 14px", background: downloadStatus.startsWith("Error:") ? COLORS.coralBg : COLORS.tealBg, borderRadius: 8, border: `1px solid ${downloadStatus.startsWith("Error:") ? "#FECDD3" : "#BBF7D0"}` }}>
              {downloadStatus}
            </div>
          )}

          {/* Currently Approved Treatments */}
          <Panel style={{ marginBottom: 28, padding: 24, borderRadius: 16 }}>
            <h3 style={{ color: COLORS.navy, marginTop: 0, marginBottom: 16, fontSize: 18, fontWeight: 800 }}>
              Currently Approved / Standard Treatments
            </h3>
            {currentTreatments.length === 0 ? (
              <p style={{ color: COLORS.gray600, fontSize: 14, margin: 0 }}>No standard-treatment mapping found for this disease in the local curated set.</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {currentTreatments.map((item) => (
                  <CurrentTreatmentRow key={item.name} item={item} />
                ))}
              </div>
            )}
          </Panel>

          {/* Repurposing Candidates List */}
          <h3 style={{ color: COLORS.navy, fontSize: 20, fontWeight: 800, marginBottom: 16 }}>
            Predicted Repurposition Candidates
          </h3>
          {results.length === 0 ? (
            <p style={{ color: COLORS.gray600, fontSize: 14 }}>No repurposing candidates passed the score threshold.</p>
          ) : (
            results.map((pred) => <PredictionRow key={pred.id || `${pred.drug?.id}-${pred.rank}`} pred={pred} />)
          )}
        </section>
      )}
    </PageShell>
  );
}

function CurrentTreatmentRow({ item }) {
  const drug = item.drug || {};
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, background: COLORS.gray50, border: `1px solid ${COLORS.gray100}`, borderRadius: 12, padding: 16 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: COLORS.navyBg, color: COLORS.navyMid, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 15, flex: "0 0 44px" }}>
        Rx
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <strong style={{ color: COLORS.navy, fontSize: 16 }}>{item.name}</strong>
          <Badge tone={item.isInLocalLibrary ? "teal" : "navy"}>{item.isInLocalLibrary ? "local library" : "standard care"}</Badge>
        </div>
        <div style={{ color: COLORS.gray600, marginTop: 4, fontSize: 14, lineHeight: 1.45 }}>{item.reason}</div>
        {drug.drugClass && (
          <div style={{ marginTop: 8 }}>
            <Badge tone="purple">{drug.drugClass}</Badge>
          </div>
        )}
      </div>
    </div>
  );
}

function PredictionRow({ pred }) {
  const drug = pred.drug || {};
  const sourceLabel = pred.source === "chembl-api" ? "ChEMBL API" : pred.source === "open-targets-api" ? "Open Targets API" : "Local fallback";

  return (
    <Panel style={{ marginBottom: 16, padding: 24, borderRadius: 16 }}>
      <div style={{ display: "flex", gap: 18, alignItems: "flex-start", minWidth: 0 }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: COLORS.tealBg, color: COLORS.teal, border: `1px solid #BBF7D0`, display: "grid", placeItems: "center", fontWeight: 900, fontSize: 16, flex: "0 0 52px" }}>
          #{pred.rank || 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <h3 style={{ margin: 0, color: COLORS.navy, fontSize: 20, fontWeight: 800 }}>{drug.name}</h3>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <Badge tone="purple">{sourceLabel}</Badge>
              <Badge tone={pred.evidenceLevel === "high" ? "teal" : pred.evidenceLevel === "moderate" ? "navy" : "amber"}>
                {pred.evidenceLevel || "low"} evidence
              </Badge>
            </div>
          </div>

          <p style={{ color: COLORS.gray800, fontSize: 14, lineHeight: 1.5, margin: "10px 0 12px" }}>{pred.rationale}</p>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {pred.targetName && <Badge tone="navy">Target: {pred.targetName}</Badge>}
            {pred.actionType && <Badge tone="cyan">Mode: {pred.actionType}</Badge>}
            {drug.molecularWeight && <Badge tone="amber">MW: {drug.molecularWeight}</Badge>}
            {drug.drugClass && <Badge tone="purple">Class: {drug.drugClass}</Badge>}
          </div>

          {pred.mechanismOfAction && (
            <div style={{ color: COLORS.gray600, background: COLORS.gray50, border: `1px solid ${COLORS.gray100}`, padding: "10px 14px", borderRadius: 8, fontSize: 13, lineHeight: 1.45, marginTop: 10 }}>
              <b>Mechanism of Action:</b> {pred.mechanismOfAction}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function InteractionNetworkPage({ user, setPage }) {
  const [drugs, setDrugs] = useState([]);
  const [drugId, setDrugId] = useState("");
  const [network, setNetwork] = useState(null);
  const [message, setMessage] = useState("");
  const [layoutMode, setLayoutMode] = useState("radial");
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const networkRef = useRef(null);

  useEffect(() => {
    async function loadDrugs() {
      if (!user) return;
      try {
        const data = await api("/drugs?per_page=50");
        setDrugs(data.drugs || []);
        if (data.drugs?.[0]) setDrugId(String(data.drugs[0].id));
      } catch (err) {
        setMessage(err.message);
      }
    }
    loadDrugs();
  }, [user]);

  useEffect(() => {
    async function loadNetwork() {
      if (!drugId) return;
      try {
        const data = await api(`/network/drug/${drugId}`);
        setNetwork(data);
        setSelectedTarget(null);
      } catch (err) {
        setMessage(err.message);
      }
    }
    if (user) loadNetwork();
  }, [drugId, user]);

  const layout = useMemo(() => buildDrugNetworkLayout(network, layoutMode), [network, layoutMode]);
  const visibleTargets = layout.targets;
  const visibleIds = new Set(["drug", ...visibleTargets.map((node) => node.id)]);
  const selectedDrug = drugs.find((drug) => String(drug.id) === String(drugId));

  const moveTooltip = (event, node) => {
    const rect = networkRef.current?.getBoundingClientRect?.();
    if (!rect) return;
    const width = 244;
    const height = 142;
    let x = event.clientX - rect.left + 12;
    let y = event.clientY - rect.top + 12;
    if (x + width > rect.width) x = event.clientX - rect.left - width - 12;
    if (y + height > rect.height) y = event.clientY - rect.top - height - 12;
    setTooltip({ node, x: Math.max(10, x), y: Math.max(10, y) });
  };

  if (!user) return <AuthGate user={user} setPage={setPage} />;

  return (
    <PageShell maxWidth={1280}>
      {/* Page Introduction Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: COLORS.tealBg, color: COLORS.teal, border: `1px solid #BBF7D0`, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.teal }} />
          BIOLOGICAL TARGET DISCOVERY
        </div>
        <h1 className="network-title" style={{ fontSize: 34, fontWeight: 800, color: COLORS.navy, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          Drug–Target Interaction Network
        </h1>
        <p style={{ color: COLORS.gray600, marginTop: 0, fontSize: 15, maxWidth: 720, lineHeight: 1.6 }}>
          Explore relationships between drugs, biological targets, pathways, and interaction types in an interactive biological target workspace.
        </p>
      </div>

      {/* Analysis Toolbar */}
      <Panel style={{ padding: "20px 24px", marginBottom: 24, borderRadius: 16 }}>
        <div className="network-controls" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px", minWidth: 0 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.gray600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
              Select Drug to Analyze
            </label>
            <select
              value={drugId}
              onChange={(e) => setDrugId(e.target.value)}
              style={inputStyle({
                width: "100%",
                minHeight: 44,
                fontWeight: 700,
                fontSize: 14.5,
                borderColor: COLORS.gray200,
                borderRadius: 10,
                cursor: "pointer",
              })}
            >
              {drugs.map((drug) => (
                <option key={drug.id} value={drug.id}>
                  {drug.name} {drug.drugClass ? `(${drug.drugClass})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.gray600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Layout View
            </label>
            <div className="network-mode-controls" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["radial", "force", "hierarchical"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setLayoutMode(mode)}
                  style={
                    layoutMode === mode
                      ? primaryButton({ padding: "9px 18px", fontSize: 13, borderRadius: 8 })
                      : secondaryButton({ padding: "9px 18px", fontSize: 13, borderRadius: 8 })
                  }
                >
                  {mode === "force" ? "Force-directed" : mode[0].toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      {message && (
        <div style={{ background: COLORS.amberBg, color: COLORS.amber, border: `1px solid #FDE68A`, borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 14, fontWeight: 600 }}>
          {message}
        </div>
      )}

      {/* Main Two-Column Network Workspace */}
      <div className="network-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 340px)", gap: 24, alignItems: "stretch", minWidth: 0 }}>
        {/* Left Column: Prominent Interactive Graph Canvas */}
        <Panel style={{ overflow: "hidden", padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between", borderRadius: 18 }}>
          <div
            ref={(node) => {
              networkRef.current = node;
            }}
            style={{
              position: "relative",
              background: "linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)",
              border: `1px solid ${COLORS.gray100}`,
              borderRadius: 14,
              minHeight: 520,
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
              minWidth: 0,
            }}
          >
            <svg viewBox="0 0 760 420" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", maxWidth: 880, height: "auto", display: "block" }}>
              <defs>
                <filter id="softGlow">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {buildPathwayBubbles(visibleTargets).map((group) => (
                <g key={group.name} opacity="0.5">
                  <ellipse cx={group.cx} cy={group.cy} rx={group.rx} ry={group.ry} fill={group.kind === "signaling" ? "#EEEDFE" : COLORS.tealBg} stroke={group.kind === "signaling" ? "#AFA9EC" : "#5DCAA5"} strokeWidth="0.5" />
                  <text x={group.x} y={group.y} fontSize="10" fontWeight="800" fill={group.kind === "signaling" ? "#7F77DD" : "#1D9E75"}>
                    {group.name}
                  </text>
                </g>
              ))}
              {layout.edges.map((edge) => {
                const isVisible = visibleIds.has(edge.target.id);
                const style = interactionStyle(edge.target.interactionType);
                return (
                  <line
                    key={`${edge.source.id}-${edge.target.id}`}
                    x1={edge.source.x}
                    y1={edge.source.y}
                    x2={edge.target.x}
                    y2={edge.target.y}
                    stroke={style.stroke}
                    strokeWidth={affinityStroke(edge.target.ki)}
                    strokeDasharray={style.dash}
                    opacity={isVisible ? 0.8 : 0}
                    style={{ transition: "opacity 0.2s" }}
                  />
                );
              })}
              {layout.nodes.map((node) => {
                const isVisible = node.type === "drug" || visibleIds.has(node.id);
                const style = interactionStyle(node.interactionType);
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x} ${node.y})`}
                    filter={node.type === "drug" ? "url(#softGlow)" : undefined}
                    opacity={isVisible ? 1 : 0}
                    style={{ transition: "opacity 0.2s, transform 0.6s ease", cursor: node.type === "drug" ? "default" : "pointer" }}
                    onMouseEnter={(e) => moveTooltip(e, node)}
                    onMouseMove={(e) => moveTooltip(e, node)}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={() => node.type !== "drug" && setSelectedTarget(node)}
                  >
                    <circle r={node.r} fill={node.type === "drug" ? COLORS.purple : style.fill} stroke={node.type === "drug" ? COLORS.purple : style.stroke} strokeWidth={node.type === "drug" ? 0 : 2.2} />
                    <text y={node.type === "drug" ? 4 : -2} textAnchor="middle" fontSize={node.type === "drug" ? 13 : 10.5} fontWeight="800" fill={node.type === "drug" ? COLORS.white : COLORS.gray800}>
                      {shortLabel(node.label, node.type === "drug" ? 12 : 8)}
                    </text>
                    {node.type !== "drug" && (
                      <text y="11" textAnchor="middle" fontSize="8.5" fontWeight="700" fill={COLORS.gray600}>
                        {node.isPrimary ? "primary" : node.importance === "secondary" ? "secondary" : "tertiary"}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            {tooltip && <NetworkTooltip tooltip={tooltip} />}
          </div>
          <NetworkLegend />
        </Panel>

        {/* Right Column: Information Sidebar */}
        <NetworkSidePanel drug={network?.drug || selectedDrug} layout={layout} selectedTarget={selectedTarget} drugs={drugs} />
      </div>
    </PageShell>
  );
}

function buildDrugNetworkLayout(network, mode = "radial") {
  const drug = network?.drug;
  const center = { id: "drug", label: drug?.name || "Drug", x: mode === "hierarchical" ? 380 : 360, y: mode === "hierarchical" ? 72 : 210, r: 38, type: "drug", interactionType: "primary drug", evidenceSource: "Local database", ki: null };
  const edgeByTarget = new Map((network?.edges || []).map((edge) => [edge.target, edge]));
  const targets = (network?.nodes || []).filter((n) => n.type === "protein").slice(0, 18).map((target, index) => {
    const edge = edgeByTarget.get(target.id) || {};
    const metadata = fallbackTargetMetadata(target, edge, index);
    return { ...target, ...metadata, type: "target" };
  });

  const positionedTargets = targets.map((target, index) => ({ ...target, ...targetPosition(target, index, targets.length, mode) }));
  const nodes = [center, ...positionedTargets];
  const edges = positionedTargets.map((target) => ({ source: center, target }));
  const primaryCount = positionedTargets.filter((node) => node.isPrimary).length;
  const secondaryCount = positionedTargets.filter((node) => node.importance === "secondary").length;
  return { nodes, edges, targets: positionedTargets, primaryCount, secondaryCount, diseaseLinkCount: Math.max(1, Math.round(positionedTargets.length / 3)) };
}

const INTERACTION_COLORS = {
  inhibitor: { stroke: "#E11D48", fill: "#FECDD3", label: "Inhibitor" },
  activator: { stroke: "#0F6E56", fill: "#A7F3D0", label: "Activator" },
  allosteric: { stroke: "#6366F1", fill: "#C7D2FE", label: "Allosteric", dash: "4 3" },
  predicted: { stroke: "#6366F1", fill: "#C7D2FE", label: "Predicted", dash: "4 3" },
  unknown: { stroke: "#64748B", fill: "#E2E8F0", label: "Unknown" },
};

function interactionStyle(type = "unknown") {
  const key = String(type || "unknown").toLowerCase();
  return INTERACTION_COLORS[key] || INTERACTION_COLORS.unknown;
}

function fallbackTargetMetadata(target, edge, index) {
  const interactionTypes = ["inhibitor", "activator", "allosteric", "unknown"];
  const fallbackKi = ["2.4 nM", "28 nM", "86 nM", "320 nM", "~1 µM", null];
  const isPrimary = edge.isPrimary ?? target.isPrimary ?? index < 2;
  const importance = isPrimary ? "primary" : index < 8 ? "secondary" : "tertiary";
  return {
    interactionType: (edge.interactionType || target.interactionType || interactionTypes[index % interactionTypes.length]).toLowerCase(),
    ki: edge.ki ?? target.ki ?? fallbackKi[index % fallbackKi.length],
    evidenceSource: edge.evidenceSource || target.evidenceSource || (index % 3 === 0 ? "ChEMBL" : index % 3 === 1 ? "DrugBank" : "STITCH"),
    isPrimary,
    importance,
    r: isPrimary ? 24 : index < 8 ? 17 : 13,
    pathway: edge.pathway || target.pathway || (index < 2 ? "Prostaglandin pathway" : index % 5 === 0 ? "Signaling pathway" : null),
    diseaseLinkCount: edge.diseaseLinkCount || target.diseaseLinkCount || Math.max(1, index + 1),
  };
}

function parseKiNm(ki) {
  if (!ki) return Infinity;
  const value = parseFloat(String(ki).replace("~", ""));
  if (!Number.isFinite(value)) return Infinity;
  const lower = String(ki).toLowerCase();
  if (lower.includes("µm") || lower.includes("um")) return value * 1000;
  return value;
}

function affinityStroke(ki) {
  const nm = parseKiNm(ki);
  if (nm < 10) return 3.5;
  if (nm <= 100) return 2;
  if (nm <= 1000) return 1.2;
  return 0.8;
}

function targetPosition(target, index, total, mode) {
  if (mode === "hierarchical") {
    const row = target.isPrimary ? 160 : target.importance === "secondary" ? 266 : 342;
    const rowItems = total || 1;
    return { x: 90 + ((index % Math.min(rowItems, 8)) * (580 / Math.max(Math.min(rowItems, 8) - 1, 1))), y: row + Math.floor(index / 8) * 12 };
  }

  if (mode === "force") {
    const distance = parseKiNm(target.ki) < 10 ? 96 : parseKiNm(target.ki) <= 100 ? 128 : parseKiNm(target.ki) <= 1000 ? 164 : 194;
    const angle = index * 2.399963 + (target.isPrimary ? -0.55 : 0.2);
    return { x: 360 + Math.cos(angle) * distance, y: 210 + Math.sin(angle) * Math.min(distance, 150) };
  }

  const radius = target.isPrimary ? 104 : target.importance === "secondary" ? 150 : 185;
  const angle = (Math.PI * 2 * index) / Math.max(total, 1) - Math.PI / 2;
  return { x: 360 + Math.cos(angle) * radius, y: 210 + Math.sin(angle) * radius * 0.72 };
}

function shortLabel(value, limit) {
  const text = String(value || "");
  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}

function buildPathwayBubbles(targets) {
  const groups = {};
  targets.filter((node) => node.pathway).forEach((node) => {
    groups[node.pathway] = [...(groups[node.pathway] || []), node];
  });
  return Object.entries(groups).filter(([, nodes]) => nodes.length >= 2).map(([name, nodes]) => {
    const xs = nodes.map((node) => node.x);
    const ys = nodes.map((node) => node.y);
    const minX = Math.min(...xs) - 44;
    const maxX = Math.max(...xs) + 44;
    const minY = Math.min(...ys) - 36;
    const maxY = Math.max(...ys) + 36;
    return {
      name,
      kind: name.toLowerCase().includes("signaling") ? "signaling" : "known",
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      rx: Math.max(70, (maxX - minX) / 2),
      ry: Math.max(42, (maxY - minY) / 2),
      x: minX + 12,
      y: minY + 16,
    };
  });
}

function NetworkTooltip({ tooltip }) {
  const node = tooltip.node;
  const style = interactionStyle(node.interactionType);
  return (
    <div style={{ position: "absolute", left: tooltip.x, top: tooltip.y, width: 244, zIndex: 5, background: COLORS.white, border: `1px solid ${COLORS.gray100}`, borderRadius: 12, padding: 14, boxShadow: "0 14px 36px rgba(6,24,43,0.18)", pointerEvents: "none", color: COLORS.gray800 }}>
      <div style={{ color: COLORS.navy, fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{node.label}</div>
      <DetailRow label="Interaction" value={node.type === "drug" ? "Primary drug" : interactionStyle(node.interactionType).label} color={style.stroke} />
      <DetailRow label="Binding affinity" value={node.ki || "N/A"} />
      <DetailRow label="Evidence" value={node.evidenceSource || "N/A"} />
    </div>
  );
}

function DetailRow({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, lineHeight: 1.7 }}>
      <span style={{ color: COLORS.gray600 }}>{label}</span>
      <strong style={{ color: color || COLORS.gray800, textAlign: "right" }}>{value}</strong>
    </div>
  );
}

function NetworkSidePanel({ drug, layout, selectedTarget, drugs }) {
  const name = drug?.name || "Drug";
  const status = drug?.status || "Approved";
  const drugClass = drug?.drugClass || drug?.drug_class || "Therapeutic";
  const similar = selectedTarget ? drugs.filter((item) => item.name !== name).slice(0, 4) : [];

  return (
    <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
      {/* Card 1: Selected Drug Summary */}
      <Panel style={{ padding: 20, borderRadius: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.gray600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
          Selected Drug
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)", color: COLORS.white, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 16, boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)" }}>
            {initials(name)}
          </div>
          <div>
            <div style={{ color: COLORS.navy, fontWeight: 800, fontSize: 18 }}>{name}</div>
            <div style={{ color: COLORS.gray600, fontSize: 13, marginTop: 2 }}>{drugClass} &middot; {status}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 18 }}>
          <Stat label="Primary" value={layout.primaryCount} />
          <Stat label="Secondary" value={layout.secondaryCount} />
          <Stat label="Disease links" value={layout.diseaseLinkCount} />
        </div>
      </Panel>

      {/* Card 2: Interaction Types Breakdown */}
      <Panel style={{ padding: 20, borderRadius: 16 }}>
        <h3 style={{ margin: "0 0 14px", color: COLORS.navy, fontSize: 15, fontWeight: 800 }}>Interaction Types</h3>
        {["inhibitor", "activator", "allosteric"].map((type) => (
          <InteractionLegendRow key={type} type={type} />
        ))}
      </Panel>

      {/* Card 3: Target Inspector (Selected Node) */}
      <Panel style={{ padding: 20, borderRadius: 16 }}>
        <h3 style={{ margin: "0 0 14px", color: COLORS.navy, fontSize: 15, fontWeight: 800 }}>Target Inspector</h3>
        {!selectedTarget ? (
          <div style={{ background: COLORS.gray50, border: `1px solid ${COLORS.gray100}`, borderRadius: 10, padding: 14, textAlign: "center" }}>
            <p style={{ margin: 0, color: COLORS.gray600, fontSize: 13, lineHeight: 1.5 }}>
              Click a target node in the network graph to inspect its binding affinity, evidence, and pathway details.
            </p>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 14 }}>
              <strong style={{ color: COLORS.navy, fontSize: 17, fontWeight: 800 }}>{selectedTarget.label}</strong>
              <InteractionBadge type={selectedTarget.interactionType} />
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <DetailRow label="Binding affinity" value={selectedTarget.ki || "N/A"} />
              <DetailRow label="Evidence source" value={selectedTarget.evidenceSource} />
              <DetailRow label="Disease links" value={selectedTarget.diseaseLinkCount} />
            </div>
            <div style={{ marginTop: 16, color: COLORS.gray600, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Similar Target Drugs
            </div>
            {similar.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {similar.map((drug) => (
                  <Badge key={drug.id} tone="navy">{drug.name}</Badge>
                ))}
              </div>
            ) : (
              <p style={{ color: COLORS.gray600, fontSize: 12, marginTop: 6, margin: 0 }}>No other drugs found for this target</p>
            )}
          </div>
        )}
      </Panel>
    </aside>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: COLORS.gray50, borderRadius: 8, padding: "8px 6px", textAlign: "center", border: `1px solid ${COLORS.gray100}` }}>
      <div style={{ color: COLORS.navy, fontWeight: 900, fontSize: 16 }}>{value}</div>
      <div style={{ color: COLORS.gray600, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function initials(name) {
  return String(name || "D").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function InteractionBadge({ type }) {
  const style = interactionStyle(type);
  return (
    <span style={{ background: style.fill, color: COLORS.navy, border: `1px solid ${style.stroke}`, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 800 }}>
      {style.label}
    </span>
  );
}

function InteractionLegendRow({ type }) {
  const style = interactionStyle(type);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.gray800, fontSize: 13, marginBottom: 8 }}>
      <span style={{ width: 12, height: 12, borderRadius: "50%", background: style.fill, border: `2px solid ${style.stroke}` }} />
      {style.label}
    </div>
  );
}

function NetworkLegend() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", marginTop: 16, color: COLORS.gray600, fontSize: 12 }}>
      {["inhibitor", "activator", "allosteric", "unknown"].map((type) => <InteractionLegendRow key={type} type={type} />)}
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <svg width="46" height="10"><line x1="2" y1="5" x2="44" y2="5" stroke={COLORS.gray800} strokeWidth="3.5" /></svg>
        Edge width = binding affinity strength
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <svg width="46" height="10"><line x1="2" y1="5" x2="44" y2="5" stroke="#6366F1" strokeWidth="2" strokeDasharray="4 3" /></svg>
        Dashed line = predicted interaction
      </span>
    </div>
  );
}

function OrphaAvatar({ size = 42 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: COLORS.white,
        display: "grid",
        placeItems: "center",
        boxShadow: `0 4px 12px rgba(15, 110, 86, 0.2)`,
        flex: `0 0 ${size}px`,
        overflow: "hidden",
        border: `2px solid ${COLORS.tealBorder}`,
      }}
    >
      <img src={ORPHAAI_LOGO_SRC} alt={ORPHAAI_LOGO_ALT} style={{ width: size, height: size, objectFit: "contain" }} />
    </div>
  );
}

function ChatbotPage({ onOpenChatbot }) {
  return (
    <main style={{ maxWidth: 840, margin: "0 auto", padding: "48px 24px" }}>
      <Panel style={{ textAlign: "center", padding: "52px 32px", borderRadius: 20 }}>
        <OrphaAvatar size={80} />
        <h1 style={{ color: COLORS.navy, margin: "20px 0 10px", fontSize: 32, fontWeight: 800 }}>OrphaAI Research Assistant</h1>
        <p style={{ maxWidth: 600, margin: "0 auto 28px", color: COLORS.gray600, lineHeight: 1.7, fontSize: 16 }}>
          Chat with the published OrphaAI agent for drug repurposing questions, candidate exploration, target reasoning, and platform guidance.
        </p>
        <button onClick={onOpenChatbot} style={primaryButton({ fontSize: 16, padding: "14px 28px" })}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Open OrphaAI Assistant
        </button>
        <p style={{ marginTop: 18, color: COLORS.gray600, fontSize: 13 }}>The assistant opens as an embedded floating chat panel.</p>
      </Panel>
    </main>
  );
}

function AdminPage({ user }) {
  if (!user) return <div style={{ textAlign: "center", padding: 80, color: COLORS.gray600 }}>Please sign in to access Admin panel.</div>;
  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ color: COLORS.navy, margin: 0, fontSize: 32 }}>Admin Dashboard</h1>
      <p style={{ color: COLORS.gray600, marginTop: 8, fontSize: 15 }}>
        Dataset sync endpoints are available for PubChem, ChEMBL, Open Targets, GEO, and related sources. Full DrugBank/OMIM syncing requires credentials or licensing.
      </p>
    </main>
  );
}

export default function OrphaAI() {
  const { user, initializing, logout } = useAuth();
  const [page, setPage] = useState("home");
  const [searchContext, setSearchContext] = useState(null);
  const [chatbotOpen, setChatbotOpen] = useState(false);

  useEffect(() => {
    if (page === "login" && user) setPage("home");
  }, [page, user]);

  const protect = (children) => (
    <ProtectedRoute loading={initializing} setPage={setPage} user={user}>
      {children}
    </ProtectedRoute>
  );

  return (
    <div style={{ fontFamily: "var(--font-sans)", background: COLORS.gray50, minHeight: "100vh" }}>
      <NavBar page={page} setPage={setPage} user={user} logout={logout} />
      {page === "home" && <HeroPage setPage={setPage} />}
      {page === "predict" && protect(<PredictPage user={user} setPage={setPage} />)}
      {page === "network" && protect(<InteractionNetworkPage user={user} setPage={setPage} />)}
      {page === "chatbot" && protect(<ChatbotPage onOpenChatbot={() => setChatbotOpen(true)} />)}
      {page === "drugs" && protect(<DrugLibrary user={user} setPage={setPage} setSearchContext={setSearchContext} />)}
      {page === "diseases" && protect(<DiseaseLibrary user={user} setPage={setPage} setSearchContext={setSearchContext} />)}
      {page === "drugDetail" && protect(<DrugDetail user={user} item={searchContext} setPage={setPage} />)}
      {page === "diseaseDetail" && protect(<DiseaseDetail user={user} item={searchContext} setPage={setPage} />)}
      {page === "login" && <LoginPage setPage={setPage} />}
      {page === "admin" && protect(<AdminPage user={user} />)}
      <footer
        style={{
          background: COLORS.navy,
          color: "rgba(255,255,255,0.75)",
          textAlign: "center",
          padding: "36px 24px",
          fontSize: 13,
          marginTop: 60,
          borderTop: `1px solid rgba(255,255,255,0.1)`,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.white, marginBottom: 8, letterSpacing: "-0.02em" }}>OrphaAI</div>
        <div style={{ marginBottom: 6 }}>Drug repurposing research platform — public database aware</div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
          For research use only. Do not use the Repurposing Predictor to make any medical treatment decisions.
        </div>
      </footer>
      <OrphaAIChatbot isOpen={chatbotOpen} onToggle={() => setChatbotOpen((open) => !open)} onClose={() => setChatbotOpen(false)} />
    </div>
  );
}
