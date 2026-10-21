import { useEffect, useMemo, useRef, useState, Component } from "react";
import { createPortal } from "react-dom";
import { ORPHAAI_LOGO_ALT, ORPHAAI_LOGO_SRC } from "./assets/logo";
import ProtectedRoute from "./auth/ProtectedRoute";
import { useAuth } from "./auth/AuthContext";
import GoogleSignInButton from "./components/GoogleSignInButton";
import { downloadPdfReport, uniqueReportFilename } from "./services/pdfExportService";
import { usePredictionContext } from "./context/PredictionContext";
import EvidenceDossierModal from "./components/EvidenceDossierModal";

const API_BASE = import.meta.env.VITE_API_BASE || "https://orphaai-backend-nebu.onrender.com/api/v1";
const FALLBACK_API_BASE = "https://orphaai-backend-nebu.onrender.com/api/v1";

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
    const errorObj = new Error(payload.error || `Request failed (${response.status})`);
    errorObj.payload = payload;
    errorObj.suggestions = payload.suggestions;
    throw errorObj;
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

function Panel({ children, style, className = "" }) {
  return (
    <div
      className={className}
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
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 m-0 tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 cursor-pointer"
          >
            Close
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
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

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
      </div>
    </nav>
  );
}

function HeroPage({ setPage }) {
  const [stats, setStats] = useState({
    repurposing_records: 3897,
    unique_indications: 673,
    unique_compounds: 2232,
    cns_mpo_features: 5,
    cmap_profiles: "LINCS L1000",
  });

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await api("/meta/stats");
        if (data && data.repurposing_records) {
          setStats(data);
        }
      } catch {
        // Fallback to default stats
      }
    }
    loadStats();
  }, []);

  return (
    <div className="animate-fade-in">
      {/* Main Hero Section */}
      <section
        className="orpha-hero"
        style={{
          background: "linear-gradient(135deg, #041221 0%, #072238 45%, #0B4638 100%)",
          padding: "76px 24px 68px",
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
        <div style={{ position: "relative", zIndex: 2, maxWidth: 900, margin: "0 auto" }}>
          {/* OrphaAI Logo Emblem - Centered directly above heading */}
          <div style={{ display: "inline-block", marginBottom: 20 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 22px",
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.16)",
                borderRadius: 24,
                backdropFilter: "blur(8px)",
                boxShadow: "0 14px 36px rgba(0, 0, 0, 0.28)",
              }}
            >
              <LogoMark size={56} />
            </div>
          </div>

          {/* Main Title */}
          <h1
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: COLORS.white,
              margin: "0 0 16px",
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
              maxWidth: 740,
              margin: "0 auto 32px",
              color: "rgba(255, 255, 255, 0.88)",
              fontSize: 16.5,
              lineHeight: 1.65,
              fontWeight: 400,
            }}
          >
            Accelerating biomedical discovery across 3,800+ curated repurposing records, 670+ human indications, and 2,200+ distinct compounds with CNS MPO BBB scoring and transcriptomic profile reversal.
          </p>

          {/* Live Platform Metric Counters Grid with balanced vertical padding */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 14,
              maxWidth: 820,
              margin: "24px auto 8px",
              padding: "16px 0",
            }}
          >
            {[
              { label: "Repurposing Records", value: (stats.repurposing_records || 3897).toLocaleString(), icon: "📚", color: "#2DD4BF" },
              { label: "Disease Indications", value: (stats.unique_indications || 673).toLocaleString(), icon: "🎯", color: "#38BDF8" },
              { label: "Distinct Compounds", value: (stats.unique_compounds || 2232).toLocaleString(), icon: "💊", color: "#A7F3D0" },
              { label: "CNS MPO BBB Scoring", value: "5-Parameter", icon: "🧠", color: "#FBBF24" },
              { label: "Transcriptomic Reversal", value: "LINCS L1000", icon: "🧬", color: "#C084FC" },
            ].map((metric) => (
              <div
                key={metric.label}
                style={{
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "14px",
                  padding: "16px 12px",
                  backdropFilter: "blur(6px)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "18px", marginBottom: "4px" }}>{metric.icon}</div>
                <div style={{ fontSize: "19px", fontWeight: 800, color: metric.color }}>{metric.value}</div>
                <div style={{ fontSize: "10.5px", fontWeight: 700, color: "rgba(255, 255, 255, 0.72)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: "4px" }}>
                  {metric.label}
                </div>
              </div>
            ))}
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

        <GoogleSignInButton disabled={loading} onError={setError} onClose={() => setPage("home")} />

        <div style={{ textAlign: "center", marginTop: 18, padding: "10px", background: COLORS.gray50, borderRadius: 8, fontSize: 12, color: COLORS.gray600 }}>
          <b>Demo Account:</b> demo@orphaai.com / Demo1234
        </div>
      </Panel>
    </div>
  );
}

function LibrarySearch({ value, onChange, placeholder, onSubmit, label = "Search the Drug Library" }) {
  return (
    <Panel style={{ padding: "20px 24px", marginBottom: 28, borderRadius: 16 }}>
      <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.gray600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
        {label}
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
  const [actionFilter, setActionFilter] = useState("All");
  const [drugs, setDrugs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [external, setExternal] = useState(null);
  const [pubchemModal, setPubchemModal] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async (q = "", act = actionFilter) => {
    setLoading(true);
    setMessage("");
    setExternal(null);
    try {
      let url = `/drugs?per_page=60&q=${encodeURIComponent(q)}`;
      if (act && act !== "All") {
        url += `&action_type=${encodeURIComponent(act)}`;
      }
      const data = await api(url);
      setDrugs(data.drugs || []);
      setTotalCount(data.total || (data.drugs || []).length);
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

  const handleActionChange = (newAct) => {
    setActionFilter(newAct);
    load(query, newAct);
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

  const handleFindDiseases = (drug, e) => {
    if (e) e.stopPropagation();
    if (setSearchContext) {
      setSearchContext({ drug: drug.name });
    }
    setPage("predict");
  };

  useEffect(() => {
    if (!user) return undefined;
    const handle = setTimeout(() => { void load(query, actionFilter); }, 0);
    return () => clearTimeout(handle);
  }, [user]);

  if (!user) return <AuthGate user={user} setPage={setPage} />;

  return (
    <PageShell maxWidth={1140}>
      {/* Header section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: COLORS.tealBg, color: COLORS.teal, border: `1px solid #BBF7D0`, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.teal }} />
          PHARMACOLOGICAL REPOSITORY • 2,232+ UNIQUE COMPOUNDS
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 800, color: COLORS.navy, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          Drug Library
        </h1>
        <p style={{ color: COLORS.gray600, marginTop: 0, fontSize: 15, maxWidth: 760, lineHeight: 1.6 }}>
          Explore approved and investigational compounds indexed from the Broad Institute Repurposing Hub, annotated with directional Action Types (Inhibitors/Agonists) and Pfizer CNS MPO Blood-Brain Barrier permeability scores.
        </p>
      </div>

      <LibrarySearch
        value={query}
        onChange={setQuery}
        placeholder="Search by drug name... (e.g. Metformin, Donepezil, Citicoline, Imatinib, Idebenone)"
        onSubmit={() => load(query, actionFilter)}
      />

      {/* Action Type Filter Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: COLORS.gray600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Action Type:
        </span>
        {[
          { key: "All", label: "All Compounds" },
          { key: "Inhibitor", label: "🔴 Inhibitors / Antagonists" },
          { key: "Agonist", label: "🟢 Agonists / Activators" },
          { key: "Modulator", label: "🟣 Modulators" },
        ].map((item) => {
          const isActive = actionFilter === item.key;
          return (
            <button
              key={item.key}
              onClick={() => handleActionChange(item.key)}
              style={{
                padding: "6px 14px",
                borderRadius: "20px",
                border: `1px solid ${isActive ? COLORS.teal : COLORS.gray200}`,
                background: isActive ? COLORS.tealBg : COLORS.white,
                color: isActive ? COLORS.teal : COLORS.gray700,
                fontWeight: isActive ? 800 : 600,
                fontSize: 12.5,
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: isActive ? "0 2px 6px rgba(15, 110, 86, 0.15)" : "none",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: COLORS.navy, margin: "0 0 4px" }}>
            Explore Drugs {totalCount > 0 && <span style={{ fontSize: 15, fontWeight: 600, color: COLORS.teal }}>({totalCount.toLocaleString()} indexed)</span>}
          </h2>
          <p style={{ color: COLORS.gray600, fontSize: 14, margin: 0 }}>
            Click card to view PubChem 2D structure &amp; ADMET details, or click "Find Target Diseases" to run prediction.
          </p>
        </div>
      </div>

      {!loading && drugs.length === 0 && !external && (
        <Panel style={{ padding: 40, textAlign: "center", borderRadius: 16 }}>
          <div style={{ color: COLORS.navy, fontSize: 18, fontWeight: 800, marginBottom: 6 }}>No matching drugs found</div>
          <p style={{ color: COLORS.gray600, fontSize: 14, margin: 0 }}>Try another drug name search query or clear Action Type filters.</p>
        </Panel>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20 }}>
        {drugs.map((drug, index) => {
          const rawAreas = drug.disease_area || drug.diseaseArea || drug.therapeutic_area || drug.therapeuticArea || drug.drugClass || "";
          const areas = rawAreas
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean);

          const rawTargets = drug.primaryTargets || [];
          const targets = rawTargets
            .map((t) => (typeof t === "string" ? t : t?.symbol))
            .filter(Boolean);

          const cnsScore = drug.cns_mpo_score || drug.cnsMpoScore || drug.cnsMpo;

          return (
            <Panel
              key={drug.id || drug.name}
              style={{
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "22px 20px",
                borderRadius: 16,
                border: `1px solid ${COLORS.gray100}`,
                background: COLORS.white,
                boxShadow: "0 4px 18px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -2px rgba(15, 23, 42, 0.03)",
                transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = COLORS.gray300;
                e.currentTarget.style.boxShadow = "0 8px 24px -4px rgba(15, 23, 42, 0.08)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = COLORS.gray100;
                e.currentTarget.style.boxShadow = "0 4px 18px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -2px rgba(15, 23, 42, 0.03)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {/* Top Content Area */}
              <div onClick={() => openPubChem(drug)}>
                {/* Header Row (Left Number Badge + Title + Sub-Badges) */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: COLORS.tealBg,
                      color: COLORS.teal,
                      border: `1px solid #BBF7D0`,
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 800,
                      fontSize: 14,
                      flex: "0 0 44px",
                      flexShrink: 0,
                    }}
                    title={`Compound Index #${index + 1}`}
                  >
                    #{index + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3
                      style={{
                        margin: "0 0 6px",
                        color: COLORS.navy,
                        fontSize: 18.5,
                        fontWeight: 800,
                        lineHeight: 1.3,
                        textTransform: "capitalize",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={drug.name}
                    >
                      {drug.name}
                    </h3>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <Badge tone="purple">{drug.action_type || drug.actionType || "Modulator"}</Badge>
                      <Badge tone="teal">{drug.clinicalPhase || drug.status || "Launched"}</Badge>
                      {cnsScore && <Badge tone="amber">MPO: {cnsScore}</Badge>}
                    </div>
                  </div>
                </div>

                {/* Middle Section (Gene Targets & Indications) */}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${COLORS.gray100}` }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.gray600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                    TARGET GENES
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", minHeight: 28, alignItems: "center" }}>
                    {targets.length > 0 ? (
                      targets.slice(0, 5).map((t, idx) => (
                        <Badge key={idx} tone="teal">{t}</Badge>
                      ))
                    ) : (
                      <span style={{ fontSize: 12, color: COLORS.gray600, fontStyle: "italic" }}>No primary targets listed</span>
                    )}
                  </div>
                </div>

                {/* Indications Text */}
                <p
                  style={{
                    fontSize: 12.5,
                    color: COLORS.gray600,
                    marginTop: 12,
                    marginBottom: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={drug.indications || drug.indication || drug.description || (areas.length > 0 ? areas.join(", ") : "")}
                >
                  {drug.indications || drug.indication || drug.description || (areas.length > 0 ? areas.join(", ") : "Broad spectrum pharmacological candidate")}
                </p>

                {/* Therapeutic Areas Pills if present */}
                {areas.length > 0 && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8, maxHeight: 48, overflow: "hidden" }}>
                    {areas.slice(0, 3).map((a, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          background: COLORS.gray50,
                          color: COLORS.gray600,
                          border: `1px solid ${COLORS.gray200}`,
                          padding: "2px 8px",
                          borderRadius: 6,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {a}
                      </span>
                    ))}
                    {areas.length > 3 && (
                      <span style={{ fontSize: 11, color: COLORS.gray600, alignSelf: "center" }}>
                        +{areas.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Footer Actions (Divider + Left Link + Right Button) */}
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: `1px solid ${COLORS.gray100}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    openPubChem(drug);
                  }}
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: COLORS.teal,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  PubChem Profile &rarr;
                </span>
                <button
                  type="button"
                  onClick={(e) => handleFindDiseases(drug, e)}
                  style={{
                    background: COLORS.tealBg,
                    color: COLORS.teal,
                    border: `1px solid #BBF7D0`,
                    padding: "6px 14px",
                    borderRadius: "10px",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = COLORS.teal;
                    e.currentTarget.style.color = COLORS.white;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = COLORS.tealBg;
                    e.currentTarget.style.color = COLORS.teal;
                  }}
                >
                  Find Target Diseases &rarr;
                </button>
              </div>
            </Panel>
          );
        })}
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
  const [selectedArea, setSelectedArea] = useState("All");
  const [diseaseTypes, setDiseaseTypes] = useState(["All", "Oncology", "Neurology", "Metabolic", "Cardiovascular", "Rare / Orphan", "Immunology"]);
  const [diseases, setDiseases] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [external, setExternal] = useState(null);
  const [keggModal, setKeggModal] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async (q = "", area = selectedArea) => {
    setLoading(true);
    setMessage("");
    setExternal(null);
    try {
      let url = `/diseases?per_page=60&q=${encodeURIComponent(q)}`;
      if (area && area !== "All") {
        url += `&type=${encodeURIComponent(area)}`;
      }
      const data = await api(url);
      setDiseases(data.diseases || []);
      setTotalCount(data.total || (data.diseases || []).length);
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

  const handleAreaChange = (newArea) => {
    setSelectedArea(newArea);
    load(query, newArea);
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

  const handleScreenCandidates = (disease, e) => {
    if (e) e.stopPropagation();
    if (setSearchContext) {
      setSearchContext({ disease: disease.name });
    }
    setPage("predict");
  };

  useEffect(() => {
    async function loadTypes() {
      try {
        const data = await api("/diseases/types");
        if (data.types && data.types.length > 0) {
          setDiseaseTypes(data.types);
        }
      } catch {
        // Fallback to default types
      }
    }
    loadTypes();
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const handle = setTimeout(() => { void load(query, selectedArea); }, 0);
    return () => clearTimeout(handle);
  }, [user]);

  if (!user) return <AuthGate user={user} setPage={setPage} />;

  return (
    <PageShell maxWidth={1140}>
      {/* Header section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: COLORS.tealBg, color: COLORS.teal, border: `1px solid #BBF7D0`, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.teal }} />
          PATHOLOGICAL &amp; GENETIC REPOSITORY • 670+ HUMAN INDICATIONS
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 800, color: COLORS.navy, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          Disease Library
        </h1>
        <p style={{ color: COLORS.gray600, marginTop: 0, fontSize: 15, maxWidth: 760, lineHeight: 1.6 }}>
          Explore 670+ indexed disease indications across Oncology, Neurology, Metabolic, and Rare Diseases mapped to causal target genes, repurposing candidate counts, and OMIM pathways.
        </p>
      </div>

      <LibrarySearch
        value={query}
        onChange={setQuery}
        label="Search the Disease Library"
        placeholder="Search by disease name... (e.g. Alzheimer's, ALS, Breast Cancer, Parkinson's, Diabetes)"
        onSubmit={() => load(query, selectedArea)}
      />

      {/* Disease Area Category Chips */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: COLORS.gray600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Disease Area:
        </span>
        {diseaseTypes.map((area) => {
          const isActive = selectedArea === area;
          return (
            <button
              key={area}
              onClick={() => handleAreaChange(area)}
              style={{
                padding: "6px 14px",
                borderRadius: "20px",
                border: `1px solid ${isActive ? COLORS.teal : COLORS.gray200}`,
                background: isActive ? COLORS.tealBg : COLORS.white,
                color: isActive ? COLORS.teal : COLORS.gray700,
                fontWeight: isActive ? 800 : 600,
                fontSize: 12.5,
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: isActive ? "0 2px 6px rgba(15, 110, 86, 0.15)" : "none",
              }}
            >
              {area}
            </button>
          );
        })}
      </div>

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: COLORS.navy, margin: "0 0 4px" }}>
            Explore Diseases {totalCount > 0 && <span style={{ fontSize: 15, fontWeight: 600, color: COLORS.teal }}>({totalCount.toLocaleString()} indexed)</span>}
          </h2>
          <p style={{ color: COLORS.gray600, fontSize: 14, margin: 0 }}>
            Click card to view KEGG biological pathways, or click "Screen Candidates" to run full repurposing prediction.
          </p>
        </div>
      </div>

      {!loading && diseases.length === 0 && !external && (
        <Panel style={{ padding: 40, textAlign: "center", borderRadius: 16 }}>
          <div style={{ color: COLORS.navy, fontSize: 18, fontWeight: 800, marginBottom: 6 }}>No matching diseases found</div>
          <p style={{ color: COLORS.gray600, fontSize: 14, margin: 0 }}>Try another disease query or select "All" disease areas.</p>
        </Panel>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20 }}>
        {diseases.map((disease) => (
          <Panel
            key={disease.id || disease.name}
            style={{
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "22px 20px",
              borderRadius: 16,
              borderTop: `3px solid ${COLORS.tealBright}`,
              transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
            }}
          >
            <div onClick={() => openKegg(disease)}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: COLORS.tealBg, color: COLORS.teal, border: `1px solid #BBF7D0`, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 14, flex: "0 0 44px" }} title="Repurposing candidate count">
                  {disease.candidateCount || (disease.associatedGenes?.length || 0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: "0 0 6px", color: COLORS.navy, fontSize: 18.5, fontWeight: 800, lineHeight: 1.3 }}>{disease.name}</h3>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <Badge tone="purple">{disease.diseaseType || "General Medicine"}</Badge>
                    {disease.candidateCount > 0 && <Badge tone="teal">{disease.candidateCount} candidates</Badge>}
                    {disease.isRare && <Badge tone="amber">rare / orphan</Badge>}
                    {disease.omimId && <Badge tone="navy">OMIM {disease.omimId}</Badge>}
                  </div>
                </div>
              </div>

              {(disease.associatedGenes || []).length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.gray100}` }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.gray600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                    CAUSAL &amp; ASSOCIATED GENE TARGETS
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(disease.associatedGenes || []).slice(0, 6).map((g) => (
                      <Badge key={typeof g === "string" ? g : g.symbol}>{typeof g === "string" ? g : g.symbol}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actionable CTA Footer */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${COLORS.gray100}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                onClick={() => openKegg(disease)}
                style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.teal, cursor: "pointer" }}
              >
                KEGG Pathways &rarr;
              </span>
              <button
                onClick={(e) => handleScreenCandidates(disease, e)}
                style={{
                  background: COLORS.tealBg,
                  color: COLORS.teal,
                  border: `1px solid #BBF7D0`,
                  padding: "6px 14px",
                  borderRadius: "10px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = COLORS.teal;
                  e.currentTarget.style.color = COLORS.white;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = COLORS.tealBg;
                  e.currentTarget.style.color = COLORS.teal;
                }}
              >
                Screen Candidates →
              </button>
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

function DirectionalBadge({ actionType, direction }) {
  const at = (actionType || "").toLowerCase();
  const dir = (direction || "").toLowerCase();

  let tone = "purple";
  let icon = "🟣";
  let label = `${actionType || "Modulator"} (Modulation)`;

  if (dir.includes("inhibition") || dir.includes("downregulation") || at.includes("inhibitor") || at.includes("antagonist") || at.includes("blocker")) {
    tone = "coral";
    icon = "🔴";
    label = `${actionType || "Inhibitor"} (Downregulation)`;
  } else if (dir.includes("activation") || dir.includes("upregulation") || at.includes("agonist") || at.includes("activator")) {
    tone = "teal";
    icon = "🟢";
    label = `${actionType || "Agonist"} (Upregulation)`;
  }

  return (
    <Badge tone={tone}>
      <span>{icon}</span> {label}
    </Badge>
  );
}

function ClinicalPhaseBadge({ phase, evidenceLevel }) {
  const p = (phase || evidenceLevel || "").toLowerCase();

  let toneLabel = phase || "Investigational";
  let evidenceCategory = "Investigational";
  let bg = "#F59E0B"; // Amber badge
  let color = "#FFFFFF";
  let border = "#D97706";
  let icon = "🧪";

  if (p.includes("failed") || p.includes("negative control") || p.includes("terminated") || p.includes("withdrawn")) {
    toneLabel = phase || "Terminated / Ineffective";
    evidenceCategory = "Negative Control";
    bg = "#E11D48"; // Solid Red badge
    color = "#FFFFFF";
    border = "#991B1B";
    icon = "🚨";
  } else if (p.includes("launch") || p.includes("fda approved") || p.includes("approved") || p.includes("high")) {
    toneLabel = phase || "FDA Approved / Launched";
    evidenceCategory = "High Evidence";
    bg = "#10B981"; // Solid Green badge
    color = "#FFFFFF";
    border = "#059669";
    icon = "✓";
  } else if (p.includes("phase 2") || p.includes("phase 3") || p.includes("phase ii") || p.includes("phase iii") || p.includes("moderate")) {
    toneLabel = phase || "Phase 2 / Phase 3";
    evidenceCategory = "Moderate Evidence";
    bg = "#2563EB"; // Blue badge
    color = "#FFFFFF";
    border = "#1D4ED8";
    icon = "📊";
  } else {
    toneLabel = phase || "Preclinical / Phase 1";
    evidenceCategory = "Investigational";
    bg = "#F59E0B"; // Amber badge
    color = "#FFFFFF";
    border = "#D97706";
    icon = "🔬";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "5px 12px",
        borderRadius: "20px",
        background: bg,
        color: color,
        border: `1px solid ${border}`,
        fontSize: "12px",
        fontWeight: 700,
        letterSpacing: "0.02em",
        boxShadow: "0 2px 5px rgba(15, 23, 42, 0.08)",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: "13px" }}>{icon}</span>
      <span>{toneLabel}</span>
      <span style={{ opacity: 0.9, fontSize: "11px", fontWeight: 600 }}>• {evidenceCategory}</span>
    </span>
  );
}


function CnsMpoBadge({ pred, drug }) {
  const cns = pred?.cns_mpo || pred?.cnsMpo || pred?.bbbPermeability || drug?.cnsMpo || drug?.bbbPermeability;
  const score = cns?.cns_mpo_score || cns?.score;
  const badge = cns?.bbb_badge || cns?.badge || (score >= 4.0 ? "🟢 CNS Permeant" : (score >= 2.5 ? "🟡 Moderate BBB" : "🔴 Non-Permeant"));
  
  if (!score) return null;

  let tone = "teal";
  if (score < 2.5) {
    tone = "coral";
  } else if (score < 4.0) {
    tone = "amber";
  }

  return (
    <Badge tone={tone}>
      🧠 BBB MPO: {score} ({badge})
    </Badge>
  );
}


function TargetGeneLinks({ targetGenes, primaryTargets }) {
  let genes = [];
  if (typeof targetGenes === "string" && targetGenes.trim()) {
    genes = targetGenes.split(/[|,;\s]+/).map(g => g.trim()).filter(Boolean);
  } else if (Array.isArray(primaryTargets) && primaryTargets.length > 0) {
    genes = primaryTargets.map(t => (typeof t === "string" ? t : t?.symbol)).filter(Boolean);
  } else if (Array.isArray(targetGenes)) {
    genes = targetGenes.map(g => (typeof g === "string" ? g : g?.symbol)).filter(Boolean);
  }

  genes = Array.from(new Set(genes));

  if (genes.length === 0) {
    return <span style={{ color: COLORS.gray400, fontSize: 13, fontStyle: "italic" }}>No gene targets mapped</span>;
  }

  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
      {genes.map((gene) => (
        <a
          key={gene}
          href={`https://www.uniprot.org/uniprotkb?query=${encodeURIComponent(gene)}`}
          target="_blank"
          rel="noopener noreferrer"
          title={`View target ${gene} details on UniProt`}
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            background: "#EEF2FF",
            color: "#4F46E5",
            border: "1px solid #C7D2FE",
            padding: "4px 11px",
            borderRadius: "16px",
            fontSize: "12px",
            fontWeight: 700,
            textDecoration: "none",
            transition: "all 0.18s ease",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#4F46E5";
            e.currentTarget.style.color = "#FFFFFF";
            e.currentTarget.style.borderColor = "#4338CA";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#EEF2FF";
            e.currentTarget.style.color = "#4F46E5";
            e.currentTarget.style.borderColor = "#C7D2FE";
          }}
        >
          <span>🧬 {gene}</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      ))}
    </div>
  );
}


function DiseaseAutocomplete({ value, onChange, onSelect, onKeyDownSubmit, placeholder, disabled }) {
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const debouncedTimerRef = useRef(null);

  const [diseaseCache, setDiseaseCache] = useState([
    "Alzheimer's Disease",
    "Amyotrophic Lateral Sclerosis (ALS)",
    "Breast Cancer",
    "Diabetes Mellitus",
    "Parkinson's Disease",
    "Epilepsy",
    "Bipolar Disorder",
    "Depression",
    "Chronic Kidney Disease",
    "COVID-19",
    "Cardiovascular Disease",
    "Cystic Fibrosis",
    "Gout",
    "Acute Lymphoblastic Leukemia",
    "Multiple Sclerosis",
  ]);

  useEffect(() => {
    async function prefetch() {
      try {
        const data = await api("/diseases?per_page=100");
        if (data.diseases && data.diseases.length > 0) {
          const names = data.diseases.map(d => d.name).filter(Boolean);
          setDiseaseCache(prev => Array.from(new Set([...prev, ...names])));
        }
      } catch {
        // Fallback gracefully
      }
    }
    prefetch();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    onChange(val);

    if (debouncedTimerRef.current) {
      clearTimeout(debouncedTimerRef.current);
    }

    if (!val || val.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setHighlightedIndex(-1);
      return;
    }

    debouncedTimerRef.current = setTimeout(async () => {
      const queryLower = val.trim().toLowerCase();
      let matches = diseaseCache.filter(d => d.toLowerCase().includes(queryLower));

      try {
        setLoading(true);
        const res = await api(`/diseases/autocomplete?q=${encodeURIComponent(val.trim())}&limit=10`);
        const apiMatches = res.suggestions || res.indications || (res.diseases ? res.diseases.map(d => d.name) : []);
        if (apiMatches && apiMatches.length > 0) {
          matches = Array.from(new Set([...apiMatches, ...matches]));
        }
      } catch {
        // Use local cached matches
      } finally {
        setLoading(false);
      }

      const topMatches = matches.slice(0, 8);
      setSuggestions(topMatches);
      setIsOpen(topMatches.length > 0);
      setHighlightedIndex(-1);
    }, 200);
  };

  const handleSelect = (selectedDisease) => {
    onChange(selectedDisease);
    setIsOpen(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
    if (onSelect) onSelect(selectedDisease);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "Enter" && onKeyDownSubmit) {
        onKeyDownSubmit();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        handleSelect(suggestions[highlightedIndex]);
      } else {
        setIsOpen(false);
        if (onKeyDownSubmit) onKeyDownSubmit();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <div style={{ position: "relative" }}>
        <input
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          style={inputStyle({
            width: "100%",
            fontSize: 15,
            padding: "14px 44px 14px 44px",
            borderRadius: 12,
            borderColor: isOpen ? COLORS.teal : COLORS.gray200,
            boxShadow: isOpen ? "0 0 0 3px rgba(15, 110, 86, 0.15)" : "inset 0 1px 2px rgba(15, 23, 42, 0.04)",
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

        {loading && (
          <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }}>
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}>
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          </div>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 6,
            background: COLORS.white,
            borderRadius: 12,
            border: `1px solid ${COLORS.gray200}`,
            boxShadow: "0 12px 28px -4px rgba(15, 23, 42, 0.15)",
            zIndex: 1000,
            overflow: "hidden",
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          <div style={{ padding: "8px 12px 4px", fontSize: 11, fontWeight: 800, color: COLORS.gray400, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Matching Disease Indications ({suggestions.length})
          </div>
          {suggestions.map((item, idx) => {
            const isSelected = idx === highlightedIndex;
            return (
              <div
                key={item}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                style={{
                  padding: "10px 14px",
                  fontSize: 14,
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? COLORS.teal : COLORS.navy,
                  background: isSelected ? COLORS.tealBg : "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "background 0.1s ease",
                }}
              >
                <span>{item}</span>
                {isSelected && <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.teal }}>Select ↵</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


function EmptyStateSuggestions({ query, suggestions = [], onSelectDisease }) {
  const fallbackSuggestions = [
    "Alzheimer's Disease",
    "Amyotrophic Lateral Sclerosis (ALS)",
    "Breast Cancer",
    "Diabetes Mellitus",
    "Parkinson's Disease",
    "Epilepsy",
  ];

  const displayList = suggestions && suggestions.length > 0 ? suggestions : fallbackSuggestions;

  return (
    <Panel style={{ padding: "36px 28px", textAlign: "center", borderRadius: 16, marginTop: 24, border: `1px solid ${COLORS.gray200}` }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: COLORS.amberBg, color: COLORS.amber, display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </div>

      <h3 style={{ fontSize: 20, fontWeight: 800, color: COLORS.navy, margin: "0 0 8px" }}>
        No Repurposing Candidates Found
      </h3>

      <p style={{ color: COLORS.gray600, fontSize: 14, maxWidth: 520, margin: "0 auto 20px", lineHeight: 1.5 }}>
        No matching drug candidates were found for <strong style={{ color: COLORS.navy }}>"{query}"</strong> in our Broad Institute Drug Repurposing Hub database.
      </p>

      <div style={{ background: COLORS.navyBg, padding: "20px 24px", borderRadius: 14, border: `1px solid ${COLORS.gray100}`, maxWidth: 640, margin: "0 auto" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.teal, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
          Suggested Alternative Diseases &amp; Indications
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {displayList.map((diseaseName) => (
            <button
              key={diseaseName}
              onClick={() => onSelectDisease(diseaseName)}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: "20px",
                border: `1px solid ${COLORS.tealLight}`,
                background: COLORS.white,
                color: COLORS.teal,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(15, 23, 42, 0.05)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = COLORS.tealBg;
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = COLORS.white;
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {diseaseName} &rarr;
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}


function PredictPage({ user, setPage, searchContext, setSearchContext }) {
  const [disease, setDisease] = useState("");
  const [results, setResults] = useState([]);
  const [currentTreatments, setCurrentTreatments] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");
  const [diseaseSuggestions, setDiseaseSuggestions] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState("");
  const { updatePredictionContext } = usePredictionContext();

  useEffect(() => {
    updatePredictionContext({ screen: "/predict" });
  }, []);

  const runPrediction = async (diseaseToRun) => {
    const targetDisease = (typeof diseaseToRun === "string" ? diseaseToRun : disease).trim();
    if (!targetDisease) return;

    if (disease !== targetDisease) {
      setDisease(targetDisease);
    }

    setLoading(true);
    setError("");
    setResults([]);
    setCurrentTreatments([]);
    setDiseaseSuggestions([]);
    setHasSearched(true);

    try {
      const data = await api("/predictions/run", {
        method: "POST",
        body: JSON.stringify({ disease_name: targetDisease, model: "ensemble", top_n: 10, min_score: 0.15 }),
      });

      setMeta({ disease: data.disease || { name: targetDisease }, model: data.model });
      setCurrentTreatments(data.currentTreatments || []);
      const candidatesList = data.candidates || data.repurposedPredictions || data.predictions || [];
      setResults(candidatesList);
      updatePredictionContext({
        disease: targetDisease,
        candidates: candidatesList,
        screen: "/predict",
      });
    } catch (err) {
      setError(err.message || "No prediction candidates found.");
      if (err.suggestions && err.suggestions.length > 0) {
        setDiseaseSuggestions(err.suggestions);
      }
    } finally {
      setLoading(false);
    }
  };

  const runDrugIndications = async (drugName) => {
    const cleanDrug = (drugName || "").trim();
    if (!cleanDrug) return;
    setLoading(true);
    setError("");
    setResults([]);
    setCurrentTreatments([]);
    setDiseaseSuggestions([]);
    setHasSearched(true);

    try {
      const data = await api(`/predict/drug-indications?drug=${encodeURIComponent(cleanDrug)}`);
      setMeta({ disease: { name: `Indications for ${data.drug_name || cleanDrug}` }, model: "Broad Hub Repurposing Matrix" });
      const candidatesList = data.indications || [];
      setResults(candidatesList);
      updatePredictionContext({
        disease: `Indications for ${cleanDrug}`,
        candidates: candidatesList,
        screen: "/predict",
      });
    } catch (err) {
      setError(err.message || `No repurposing indications found for ${cleanDrug}.`);
    } finally {
      setLoading(false);
    }
  };

  // Auto-run if routed with searchContext or URL query parameters
  useEffect(() => {
    if (searchContext?.disease) {
      const dis = searchContext.disease;
      setDisease(dis);
      runPrediction(dis);
      if (setSearchContext) setSearchContext(null);
    } else if (searchContext?.drug) {
      const drg = searchContext.drug;
      runDrugIndications(drg);
      if (setSearchContext) setSearchContext(null);
    } else {
      const params = new URLSearchParams(window.location.search);
      const urlDisease = params.get("disease");
      const urlDrug = params.get("drug");
      if (urlDisease) {
        setDisease(urlDisease);
        runPrediction(urlDisease);
      } else if (urlDrug) {
        runDrugIndications(urlDrug);
      }
    }
  }, [searchContext]);

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
        `${index + 1}. ${pred.drug?.name || pred.drug_name || "Unknown drug"} - Phase: ${pred.clinicalPhase || pred.clinical_phase || "Investigational"} (${pred.evidenceLevel || pred.evidence_strength || "Low Evidence"})`,
        `   Target Genes: ${pred.targetGenes || pred.target_genes || "N/A"}; Disease Area: ${pred.diseaseArea || pred.disease_area || "N/A"}`,
        `   Rationale: ${pred.rationale || pred.mechanismOfAction || "N/A"}`,
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

  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [actionFilter, setActionFilter] = useState("All");

  const filteredResults = useMemo(() => {
    if (actionFilter === "Inhibitors") {
      return results.filter((r) => {
        const at = (r.actionType || r.action_type || "").toLowerCase();
        const dir = (r.therapeuticDirection || r.therapeutic_direction || "").toLowerCase();
        return dir.includes("inhibition") || dir.includes("downregulation") || at.includes("inhibitor") || at.includes("antagonist") || at.includes("blocker");
      });
    }
    if (actionFilter === "Agonists") {
      return results.filter((r) => {
        const at = (r.actionType || r.action_type || "").toLowerCase();
        const dir = (r.therapeuticDirection || r.therapeutic_direction || "").toLowerCase();
        return dir.includes("activation") || dir.includes("upregulation") || at.includes("agonist") || at.includes("activator");
      });
    }
    return results;
  }, [results, actionFilter]);

  const openDossier = (cand) => {
    setSelectedCandidate(cand);
    setIsDossierOpen(true);
  };

  const exportRawCsv = () => {
    if (!results || results.length === 0) return;
    const headers = ["Rank", "Drug Name", "Clinical Phase", "Evidence Tier", "Disease Area", "Target Genes", "Mechanism of Action", "Composite Score"];
    const rows = results.map((r, idx) => {
      const rank = r.rank || idx + 1;
      const name = (r.drug_name || r.drug?.name || r.name || "").replace(/"/g, '""');
      const phase = (r.clinical_phase || r.clinicalPhase || r.drug?.status || "").replace(/"/g, '""');
      const tier = (r.evidence_tier || r.evidenceLevel || "").replace(/"/g, '""');
      const area = (r.disease_area || r.diseaseArea || r.drug?.drugClass || "").replace(/"/g, '""');
      const targets = (typeof r.target_genes === "string" ? r.target_genes : (r.targetGenes || "")).replace(/"/g, '""');
      const moa = (r.mechanism_of_action || r.mechanismOfAction || r.drug?.mechanism || "").replace(/"/g, '""');
      const score = r.composite_score || (r.confidencePct ? (r.confidencePct / 100).toFixed(2) : "0.85");
      return [rank, `"${name}"`, `"${phase}"`, `"${tier}"`, `"${area}"`, `"${targets}"`, `"${moa}"`, score].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    const filename = `OrphaAI_${(meta?.disease?.name || disease || "results").replace(/[^A-Za-z0-9]+/g, "_")}_Data.csv`;
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPdfDossier = async () => {
    const diseaseName = meta?.disease?.name || disease || "Target Indication";
    setDownloadStatus("Generating PDF Research Dossier...");
    try {
      const response = await fetch(`${API_BASE}/export/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disease: diseaseName, candidates: results }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `OrphaAI_${diseaseName.replace(/[^A-Za-z0-9]+/g, "_")}_Dossier.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        setDownloadStatus("Success: PDF Research Dossier downloaded.");
      } else {
        await downloadReport();
      }
    } catch {
      await downloadReport();
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
      <Panel style={{ padding: "32px 28px", borderRadius: 18, borderTop: `4px solid ${COLORS.tealBright}`, boxShadow: "0 8px 30px rgba(15, 23, 42, 0.06)", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 800, color: COLORS.navy, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            TARGET DISEASE OR INDICATION
          </label>
          <span style={{ fontSize: 12, color: COLORS.gray600 }}>Type to view debounced autocomplete suggestions</span>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 340px" }}>
            <DiseaseAutocomplete
              value={disease}
              onChange={setDisease}
              onSelect={(selectedName) => runPrediction(selectedName)}
              onKeyDownSubmit={() => runPrediction()}
              placeholder="Search or enter a disease indication... (e.g. Parkinson's, ALS, Alzheimer's)"
              disabled={loading}
            />
          </div>

          <button
            onClick={() => runPrediction()}
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
          {["Alzheimer's Disease", "Amyotrophic Lateral Sclerosis (ALS)", "Epilepsy", "Breast Cancer", "Parkinson's Disease"].map((x) => (
            <button
              key={x}
              onClick={() => runPrediction(x)}
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
      {error && !loading && (
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

      {/* Empty State with Suggestions if 0 results returned */}
      {hasSearched && !loading && results.length === 0 && (
        <EmptyStateSuggestions
          query={disease}
          suggestions={diseaseSuggestions}
          onSelectDisease={(suggestedDisease) => runPrediction(suggestedDisease)}
        />
      )}

      {/* Results Area */}
      {(currentTreatments.length > 0 || results.length > 0) && (
        <section style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ color: COLORS.navy, margin: 0, fontSize: 24, fontWeight: 800 }}>
                Prediction Results for {meta?.disease?.name || disease}
              </h2>
              <p style={{ color: COLORS.gray600, fontSize: 13, marginTop: 4 }}>
                Local Knowledge Base: Broad Institute Drug Repurposing Hub • Ranked by Evidence Strength
              </p>
            </div>

            {/* Export Buttons Bar */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button
                onClick={downloadPdfDossier}
                style={primaryButton({ background: "linear-gradient(135deg, #0F6E56 0%, #0D9488 100%)", padding: "10px 18px", fontSize: 13.5, borderRadius: 10 })}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PDF Dossier
              </button>

              <button
                onClick={exportRawCsv}
                style={secondaryButton({ padding: "10px 18px", fontSize: 13.5, borderRadius: 10, borderColor: COLORS.gray300, background: COLORS.white, color: COLORS.navy })}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                Export Raw Data (.CSV)
              </button>
            </div>
          </div>

          {/* Computational Discovery Mode Banner */}
          {Boolean(meta?.novel_discovery_mode || meta?.is_novel_hypothesis || results.some((r) => r.is_novel_hypothesis || r.isNovelHypothesis)) && (
            <div
              style={{
                background: "linear-gradient(135deg, #06182B 0%, #0C2B4B 100%)",
                color: "#FFFFFF",
                border: "1px solid #38BDF8",
                borderRadius: "14px",
                padding: "16px 20px",
                marginBottom: "24px",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                boxShadow: "0 8px 24px rgba(6, 24, 43, 0.25)",
              }}
            >
              <div
                style={{
                  fontSize: "22px",
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: "rgba(56, 189, 248, 0.18)",
                  border: "1px solid rgba(56, 189, 248, 0.35)",
                  display: "grid",
                  placeItems: "center",
                  flex: "0 0 42px",
                }}
              >
                ⚡
              </div>
              <div>
                <div style={{ fontSize: "12px", fontWeight: 800, color: "#38BDF8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Target-to-Drug Bridge Active
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, marginTop: "2px", lineHeight: 1.4 }}>
                  {meta?.novel_banner_message || `⚡ Computational Discovery Mode: No direct clinical trials exist. Displaying ${results.length} novel candidates inferred through target convergence.`}
                </div>
              </div>
            </div>
          )}

          {downloadStatus && (
            <div style={{ color: downloadStatus.startsWith("Error:") ? COLORS.coral : COLORS.teal, fontSize: 13, marginBottom: 16, fontWeight: 600, padding: "10px 14px", background: downloadStatus.startsWith("Error:") ? COLORS.coralBg : COLORS.tealBg, borderRadius: 8, border: `1px solid ${downloadStatus.startsWith("Error:") ? "#FECDD3" : "#BBF7D0"}` }}>
              {downloadStatus}
            </div>
          )}

          {/* Currently Approved Treatments if available */}
          {currentTreatments.length > 0 && (
            <Panel style={{ marginBottom: 28, padding: 24, borderRadius: 16 }}>
              <h3 style={{ color: COLORS.navy, marginTop: 0, marginBottom: 16, fontSize: 18, fontWeight: 800 }}>
                Currently Approved / Standard Treatments
              </h3>
              <div style={{ display: "grid", gap: 12 }}>
                {currentTreatments.map((item) => (
                  <CurrentTreatmentRow key={item.name} item={item} />
                ))}
              </div>
            </Panel>
          )}

          {/* Repurposing Candidates List */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <h3 style={{ color: COLORS.navy, fontSize: 20, fontWeight: 800, margin: 0 }}>
                Predicted Candidate Drugs ({filteredResults.length})
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.gray600 }}>Show:</span>
                {["All", "Inhibitors", "Agonists"].map((opt) => {
                  const isActive = actionFilter === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setActionFilter(opt)}
                      style={{
                        padding: "4px 12px",
                        borderRadius: "16px",
                        border: `1px solid ${isActive ? COLORS.teal : COLORS.gray200}`,
                        background: isActive ? COLORS.tealBg : COLORS.white,
                        color: isActive ? COLORS.teal : COLORS.gray600,
                        fontWeight: isActive ? 800 : 600,
                        fontSize: 12,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {opt === "All" ? "All" : opt === "Inhibitors" ? "Inhibitors only 🔴" : "Agonists only 🟢"}
                    </button>
                  );
                })}
              </div>
            </div>
            <span style={{ fontSize: 12, color: COLORS.gray600 }}>Click any candidate card to inspect full Evidence Dossier</span>
          </div>

          {filteredResults.map((pred) => (
            <PredictionRow
              key={pred.id || `${pred.drug?.id || pred.drug_name}-${pred.rank}`}
              pred={pred}
              onInspect={() => openDossier(pred)}
            />
          ))}
        </section>
      )}

      {/* Candidate Inspector Dossier Modal */}
      <EvidenceDossierModal
        isOpen={isDossierOpen && Boolean(selectedCandidate)}
        onClose={() => {
          setIsDossierOpen(false);
          setSelectedCandidate(null);
        }}
        candidate={selectedCandidate}
        diseaseName={meta?.disease?.name || disease}
      />
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

function PredictionRow({ pred, onInspect }) {
  const [isCardHovered, setIsCardHovered] = useState(false);
  const [isBtnHovered, setIsBtnHovered] = useState(false);

  const drug = pred.drug || {};
  const drugName = drug.name || pred.drug_name || "Unknown Candidate";
  const clinicalPhase = pred.clinicalPhase || pred.clinical_phase || drug.status || "Investigational";
  const evidenceLevel = pred.evidenceLevel || pred.evidence_strength || "Investigational";
  const targetGenes = pred.targetGenes || pred.target_genes || drug.primaryTargets;
  const diseaseArea = pred.diseaseArea || pred.disease_area || drug.drugClass;
  const mechanism = pred.mechanismOfAction || pred.mechanism || drug.mechanism;
  const actionType = pred.actionType || pred.action_type || drug.actionType || "Unknown";
  const therapeuticDirection = pred.therapeuticDirection || pred.therapeutic_direction || drug.therapeuticDirection || "Modulation";

  const isNovel = pred.is_novel_hypothesis || pred.isNovelHypothesis || pred.prediction_type === "Novel In Silico Hypothesis";
  const originalIndication = pred.original_indication || pred.originalIndication;

  const isNegativeControl = Boolean(
    pred.is_negative_control ||
    pred.isNegativeControl ||
    (evidenceLevel && evidenceLevel.toLowerCase().includes("failed")) ||
    (clinicalPhase && (clinicalPhase.toLowerCase().includes("terminated") || clinicalPhase.toLowerCase().includes("withdrawn")))
  );
  const trialId = pred.trial_id || pred.trialId || pred.nct_id || pred.nctId || "";
  const failureReason = pred.failure_reason || pred.failureReason || "";
  const warningBanner =
    pred.warning_banner ||
    pred.warningBanner ||
    (isNegativeControl
      ? `Known Negative Control: Trial terminated (${clinicalPhase}${failureReason ? ` - ${failureReason}` : ""}).${trialId ? ` See ${trialId}.` : ""}`
      : "");

  return (
    <Panel
      style={{
        marginBottom: 16,
        padding: 24,
        borderRadius: 16,
        borderLeft: `4px solid ${isNegativeControl ? "#E11D48" : (isNovel ? "#06B6D4" : "#0D9488")}`,
        borderColor: isNegativeControl ? (isCardHovered ? "#FB7185" : "#FECDD3") : (isCardHovered ? "#5EEAD4" : COLORS.gray100),
        background: isNegativeControl ? "#FFFBFB" : COLORS.white,
        cursor: onInspect ? "pointer" : "default",
        transform: isCardHovered ? "translateY(-2px)" : "translateY(0)",
        boxShadow: isCardHovered ? "0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)" : "0 1px 3px rgba(15, 23, 42, 0.04)",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      onMouseEnter={() => setIsCardHovered(true)}
      onMouseLeave={() => setIsCardHovered(false)}
      onClick={() => {
        if (onInspect) onInspect();
      }}
    >
      {/* ⚠️ Red Warning Banner for Negative Controls */}
      {isNegativeControl && (
        <div
          style={{
            background: COLORS.coralBg,
            color: "#991B1B",
            border: `1px solid #FECDD3`,
            borderRadius: "12px",
            padding: "12px 16px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontWeight: 700,
            fontSize: "13.5px",
            lineHeight: 1.45,
            boxShadow: "0 2px 8px rgba(225, 29, 72, 0.08)",
          }}
        >
          <span style={{ fontSize: "18px", flex: "0 0 24px" }}>⚠️</span>
          <span>{warningBanner}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 18, alignItems: "flex-start", minWidth: 0 }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: isNegativeControl ? COLORS.coralBg : (isNovel ? COLORS.cyanBg : COLORS.tealBg), color: isNegativeControl ? COLORS.coral : (isNovel ? COLORS.cyan : COLORS.teal), border: `1px solid ${isNegativeControl ? "#FECDD3" : (isNovel ? "#A5F3FC" : "#BBF7D0")}`, display: "grid", placeItems: "center", fontWeight: 900, fontSize: 16, flex: "0 0 52px" }}>
          #{pred.rank || 1}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header Row: Drug Name, Badges, and Primary CTA */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ minWidth: 0, flex: "1 1 320px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                <h3 style={{ margin: 0, color: COLORS.navy, fontSize: 21, fontWeight: 800, letterSpacing: "-0.01em" }}>
                  {drugName}
                </h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {isNovel && <Badge tone="cyan">⚡ Novel Hypothesis</Badge>}
                  <DirectionalBadge actionType={actionType} direction={therapeuticDirection} />
                  <ClinicalPhaseBadge phase={clinicalPhase} evidenceLevel={evidenceLevel} />
                  <CnsMpoBadge pred={pred} drug={drug} />
                </div>
              </div>

              {isNovel && originalIndication && (
                <div style={{ color: COLORS.cyan, fontSize: 13, marginTop: 2, marginBottom: 6, fontWeight: 700 }}>
                  Originally Indicated For: <span style={{ color: COLORS.navy }}>{originalIndication}</span>
                </div>
              )}

              {diseaseArea && (
                <div style={{ color: COLORS.gray600, fontSize: 13, marginTop: 2, marginBottom: 6, fontWeight: 600 }}>
                  Therapeutic Field: <span style={{ color: COLORS.navy }}>{diseaseArea}</span>
                </div>
              )}
            </div>

            {onInspect && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onInspect) onInspect();
                }}
                onMouseEnter={() => setIsBtnHovered(true)}
                onMouseLeave={() => setIsBtnHovered(false)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 18px",
                  borderRadius: 10,
                  fontSize: "13.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: isBtnHovered ? "linear-gradient(135deg, #0F6E56 0%, #0D9488 100%)" : "#ECFDF5",
                  color: isBtnHovered ? COLORS.white : "#065F46",
                  border: `1px solid ${isBtnHovered ? "#0D9488" : "#A7F3D0"}`,
                  boxShadow: isBtnHovered ? "0 4px 14px rgba(13, 148, 136, 0.3)" : "0 1px 3px rgba(15, 23, 42, 0.05)",
                  transform: isBtnHovered ? "translateY(-1px)" : "translateY(0)",
                  transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                <span>View Evidence Dossier</span>
                <span style={{ fontSize: "15px", transition: "transform 0.18s ease", transform: isBtnHovered ? "translateX(3px)" : "none" }}>→</span>
              </button>
            )}
          </div>

          <p style={{ color: COLORS.gray800, fontSize: 14, lineHeight: 1.5, margin: "8px 0 14px" }}>
            {pred.rationale || `${drugName} identified with candidate potential based on target gene binding and clinical evidence.`}
          </p>

          {/* UniProt Clickable Gene Target Links */}
          <div style={{ marginTop: 12, marginBottom: 12, background: COLORS.gray50, border: `1px solid ${COLORS.gray100}`, padding: "12px 14px", borderRadius: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.gray600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              MOLECULAR TARGET GENES (UNIPROT LINKS)
            </div>
            <TargetGeneLinks targetGenes={targetGenes} primaryTargets={drug.primaryTargets} />
          </div>

          {mechanism && (
            <div style={{ color: COLORS.gray600, background: COLORS.tealBg, border: `1px solid #BBF7D0`, padding: "10px 14px", borderRadius: 8, fontSize: 13, lineHeight: 1.45, marginTop: 10 }}>
              <b style={{ color: COLORS.teal }}>Mechanism of Action:</b> {mechanism}
            </div>
          )}

          {/* Bottom Card Action Footer Strip */}
          <div style={{ display: "flex", alignItems: "center", marginTop: 16, paddingTop: 12, borderTop: `1px solid ${COLORS.gray100}` }}>
            <span style={{ fontSize: 12, color: COLORS.gray600, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span>🔍</span> Click card or "View Evidence Dossier" to inspect MoA, ADMET & Clinical Evidence
            </span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function StickyNetworkLegend() {
  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        zIndex: 10,
        background: "rgba(255, 255, 255, 0.92)",
        backdropFilter: "blur(6px)",
        border: `1px solid ${COLORS.gray200}`,
        borderRadius: 12,
        padding: "12px 14px",
        boxShadow: "0 6px 20px rgba(15, 23, 42, 0.1)",
        pointerEvents: "auto",
        maxWidth: 220,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.navy, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        Graph Legend
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.gray600, marginBottom: 4 }}>NODE TYPES</div>
      <div style={{ display: "grid", gap: 5, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: COLORS.purple, display: "inline-block" }} />
          <span style={{ color: COLORS.navy, fontWeight: 600 }}>Drug Candidate</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#E11D48", display: "inline-block" }} />
          <span style={{ color: COLORS.navy, fontWeight: 600 }}>Inhibitor Target</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#0F6E56", display: "inline-block" }} />
          <span style={{ color: COLORS.navy, fontWeight: 600 }}>Activator Target</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#6366F1", display: "inline-block" }} />
          <span style={{ color: COLORS.navy, fontWeight: 600 }}>Allosteric Target</span>
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.gray600, marginBottom: 4 }}>EDGE TYPES</div>
      <div style={{ display: "grid", gap: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ width: 18, height: 3, background: "#E11D48", display: "inline-block" }} />
          <span style={{ color: COLORS.navy, fontWeight: 600 }}>Inhibitor Edge</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ width: 18, height: 3, background: "#0F6E56", display: "inline-block" }} />
          <span style={{ color: COLORS.navy, fontWeight: 600 }}>Activator Edge</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ width: 18, height: 2, borderTop: "2px dashed #6366F1", display: "inline-block" }} />
          <span style={{ color: COLORS.navy, fontWeight: 600 }}>Inferred / Predicted</span>
        </div>
      </div>
    </div>
  );
}


class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <PageShell maxWidth={1140}>
          <Panel style={{ padding: 40, textAlign: "center", borderRadius: 16, margin: "40px auto" }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ color: COLORS.navy, fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>
              Something went wrong displaying this view
            </h2>
            <p style={{ color: COLORS.gray600, fontSize: 14, margin: "0 0 20px" }}>
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={primaryButton({ padding: "10px 20px", fontSize: 14 })}
            >
              Reload View
            </button>
          </Panel>
        </PageShell>
      );
    }
    return this.props.children;
  }
}

function InteractionNetworkPage({ user, setPage, setSearchContext }) {
  const [networkType, setNetworkType] = useState("disease"); // 'disease' (Tri-Partite) or 'drug'
  const [diseasesList, setDiseasesList] = useState([]);
  const [selectedDisease, setSelectedDisease] = useState("Alzheimer's Disease");
  const [drugs, setDrugs] = useState([]);
  const [drugId, setDrugId] = useState("");
  const [network, setNetwork] = useState(null);
  const [message, setMessage] = useState("");
  const [layoutMode] = useState("radial");
  const [maxTargets] = useState(25);
  const [interactionFilter, setInteractionFilter] = useState("All");
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [dossierCandidate, setDossierCandidate] = useState(null);
  const networkRef = useRef(null);

  // Load initial dropdown options
  useEffect(() => {
    async function initOptions() {
      if (!user) return;
      try {
        const disData = await api("/network/diseases");
        if (disData && disData.diseases && disData.diseases.length > 0) {
          setDiseasesList(disData.diseases);
          if (!selectedDisease) setSelectedDisease(disData.diseases[0]);
        }
        const drugData = await api("/drugs?per_page=50");
        setDrugs(drugData.drugs || []);
        if (drugData.drugs?.[0]) setDrugId(String(drugData.drugs[0].id));
      } catch (err) {
        setMessage(err.message);
      }
    }
    initOptions();
  }, [user]);

  // Load network when disease or drug selection changes
  useEffect(() => {
    async function loadActiveNetwork() {
      if (!user) return;
      setLoading(true);
      setMessage("");
      try {
        if (networkType === "disease") {
          const target = selectedDisease || "Alzheimer's Disease";
          const data = await api(`/network/disease?name=${encodeURIComponent(target)}`);
          setNetwork(data);
          // Auto-select first candidate drug or central node for immediate inspection
          const defaultDrugNode = (data.nodes || []).find((n) => n.type === "drug");
          setSelectedTarget(defaultDrugNode || (data.nodes || [])[0] || null);
        } else if (networkType === "drug") {
          const activeDrugName = drugs.find((drug) => String(drug.id) === String(drugId))?.name || drugId || "Donepezil";
          const data = await api(`/network/drug?name=${encodeURIComponent(activeDrugName)}`);
          setNetwork(data);
          const defaultDrugNode = (data.nodes || []).find((n) => n.type === "drug");
          setSelectedTarget(defaultDrugNode || (data.nodes || [])[0] || null);
        }
      } catch (err) {
        setMessage(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadActiveNetwork();
  }, [networkType, selectedDisease, drugId, user, drugs]);

  // Tri-partite or single-drug layout calculation
  const layout = useMemo(() => {
    if (!network) return { nodes: [], edges: [], targets: [], primaryCount: 0, secondaryCount: 0, diseaseLinkCount: 0 };

    if (networkType === "disease") {
      return buildTripartiteNetworkLayout(network, interactionFilter);
    }
    return buildDrugNetworkLayout(network, layoutMode, maxTargets, interactionFilter);
  }, [network, networkType, layoutMode, maxTargets, interactionFilter]);

  const selectedDrug = drugs.find((drug) => String(drug.id) === String(drugId));

  // Compute 1-Hop Neighbor Set when a target node is selected
  const neighborIds = useMemo(() => {
    if (!selectedTarget || !network?.edges) return null;
    const set = new Set([selectedTarget.id]);
    network.edges.forEach((edge) => {
      if (edge.source === selectedTarget.id || edge.source?.id === selectedTarget.id) {
        set.add(edge.target?.id || edge.target);
      }
      if (edge.target === selectedTarget.id || edge.target?.id === selectedTarget.id) {
        set.add(edge.source?.id || edge.source);
      }
    });
    return set;
  }, [selectedTarget, network]);

  const moveTooltip = (event, node) => {
    const rect = networkRef.current?.getBoundingClientRect?.();
    if (!rect) return;
    const width = 270;
    const height = 180;
    let x = event.clientX - rect.left + 14;
    let y = event.clientY - rect.top + 14;
    if (x + width > rect.width) x = event.clientX - rect.left - width - 14;
    if (y + height > rect.height) y = event.clientY - rect.top - height - 14;
    setTooltip({ node, x: Math.max(10, x), y: Math.max(10, y) });
  };

  if (!user) return <AuthGate user={user} setPage={setPage} />;

  return (
    <PageShell maxWidth={1320}>
      {/* Page Introduction Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: COLORS.tealBg, color: COLORS.teal, border: `1px solid #BBF7D0`, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.teal }} />
          TRI-PARTITE BIOLOGICAL DISCOVERY WORKSPACE
        </div>
        <h1 className="network-title" style={{ fontSize: 34, fontWeight: 800, color: COLORS.navy, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          Target Disease ↔ Gene ↔ Drug Interaction Network
        </h1>
        <p style={{ color: COLORS.gray600, marginTop: 0, fontSize: 15, maxWidth: 760, lineHeight: 1.6 }}>
          Visualize directional repurposing mechanisms bridging <strong style={{ color: COLORS.navy }}>Target Indications</strong>, <strong style={{ color: "#0EA5E9" }}>Causal Target Genes</strong>, and <strong style={{ color: COLORS.purple }}>Repurposed Drug Candidates</strong> with real-time binding affinity, BBB scores, and CMap reversal.
        </p>
      </div>

      {/* Analysis Mode Switcher & Selection Toolbar */}
      <Panel style={{ padding: "20px 24px", marginBottom: 16, borderRadius: 16, borderTop: `4px solid ${COLORS.tealBright}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          {/* Mode Switcher */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: COLORS.gray600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Network Mode
            </span>
            <div style={{ display: "flex", background: COLORS.gray50, padding: 3, borderRadius: 10, border: `1px solid ${COLORS.gray200}` }}>
              <button
                onClick={() => setNetworkType("disease")}
                style={{
                  padding: "7px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: networkType === "disease" ? COLORS.teal : "transparent",
                  color: networkType === "disease" ? COLORS.white : COLORS.gray700,
                  fontWeight: networkType === "disease" ? 800 : 600,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                🎯 Disease Tri-Partite Graph
              </button>
              <button
                onClick={() => setNetworkType("drug")}
                style={{
                  padding: "7px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: networkType === "drug" ? COLORS.teal : "transparent",
                  color: networkType === "drug" ? COLORS.white : COLORS.gray700,
                  fontWeight: networkType === "drug" ? 800 : 600,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                💊 Drug Radial Target View
              </button>
            </div>
          </div>

          {/* Selector Dropdown based on active mode */}
          <div style={{ flex: "1 1 340px", minWidth: 260 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.gray600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
              {networkType === "disease" ? "Select Target Indication to Visualize Tripartite Interactome" : "Select Drug Compound to Visualize Tripartite Interactome"}
            </label>
            {networkType === "disease" ? (
              <select
                value={selectedDisease}
                onChange={(e) => setSelectedDisease(e.target.value)}
                style={inputStyle({
                  width: "100%",
                  minHeight: 42,
                  fontWeight: 700,
                  fontSize: 14,
                  borderColor: COLORS.gray200,
                  borderRadius: 10,
                  cursor: "pointer",
                })}
              >
                {diseasesList.map((dis) => (
                  <option key={dis} value={dis}>
                    {dis}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={drugId}
                onChange={(e) => setDrugId(e.target.value)}
                style={inputStyle({
                  width: "100%",
                  minHeight: 42,
                  fontWeight: 700,
                  fontSize: 14,
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
            )}
          </div>

          {/* Action Filters */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: COLORS.gray600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Edge Direction Filter
            </span>
            <div style={{ display: "flex", background: COLORS.gray50, padding: 3, borderRadius: 10, border: `1px solid ${COLORS.gray200}` }}>
              {["All", "Inhibitors 🔴", "Activators 🟢"].map((filter) => {
                const isActive = interactionFilter === filter.split(" ")[0];
                return (
                  <button
                    key={filter}
                    onClick={() => setInteractionFilter(filter.split(" ")[0])}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: isActive ? COLORS.teal : "transparent",
                      color: isActive ? COLORS.white : COLORS.gray700,
                      fontWeight: isActive ? 800 : 600,
                      fontSize: 12,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {filter}
                  </button>
                );
              })}
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
      <div className="network-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 360px)", gap: 24, alignItems: "stretch", minWidth: 0 }}>
        {/* Left Column: Interactive Graph Canvas */}
        <Panel style={{ overflow: "hidden", padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between", borderRadius: 18, position: "relative" }}>
                {/* Zoom / Pan Controls Floating Toolbar */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 16,
                    right: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(6px)",
                    border: `1px solid ${COLORS.gray200}`,
                    borderRadius: 10,
                    padding: "4px 8px",
                    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
                    zIndex: 10,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.2).toFixed(2)))}
                    title="Zoom In"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: `1px solid ${COLORS.gray200}`,
                      background: COLORS.white,
                      color: COLORS.navy,
                      fontWeight: 800,
                      fontSize: 15,
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(2)))}
                    title="Zoom Out"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: `1px solid ${COLORS.gray200}`,
                      background: COLORS.white,
                      color: COLORS.navy,
                      fontWeight: 800,
                      fontSize: 15,
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    }}
                    title="Reset View"
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      border: `1px solid ${COLORS.gray200}`,
                      background: COLORS.white,
                      color: COLORS.gray700,
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Reset ({Math.round(zoom * 100)}%)
                  </button>
                </div>

                {/* Sticky Floating Directional Color Legend (Top-Left neutral area) */}
                <div
                  style={{
                    position: "absolute",
                    top: 16,
                    left: 16,
                    background: "rgba(255, 255, 255, 0.94)",
                    backdropFilter: "blur(6px)",
                    border: `1px solid ${COLORS.gray200}`,
                    borderRadius: 12,
                    padding: "8px 12px",
                    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
                    zIndex: 10,
                    fontSize: "11px",
                  }}
                >
                  <div style={{ fontWeight: 800, color: COLORS.navy, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                    Edge Directionality
                  </div>
                  <div style={{ display: "grid", gap: 3 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 14, height: 3, background: "#0EA5E9", borderRadius: 2 }} />
                      <span style={{ color: COLORS.gray800, fontWeight: 600 }}>🔵 Causal Gene Link</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 14, height: 3, background: "#E11D48", borderRadius: 2 }} />
                      <span style={{ color: COLORS.gray800, fontWeight: 600 }}>🔴 Inhibition / Antagonist</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 14, height: 3, background: "#10B981", borderRadius: 2 }} />
                      <span style={{ color: COLORS.gray800, fontWeight: 600 }}>🟢 Activation / Agonist</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 14, height: 3, background: "#8B5CF6", borderRadius: 2 }} />
                      <span style={{ color: COLORS.gray800, fontWeight: 600 }}>🟣 Target Convergence</span>
                    </div>
                  </div>
                </div>

                <div
                  ref={(node) => {
                    networkRef.current = node;
                  }}
                  className="w-full h-[650px] min-h-[500px] bg-slate-900/5 rounded-2xl border border-slate-200 relative overflow-hidden"
                  style={{
                    position: "relative",
                    background: "linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)",
                    border: `1px solid ${COLORS.gray100}`,
                    borderRadius: 16,
                    minHeight: 520,
                    height: 650,
                    width: "100%",
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                    minWidth: 0,
                  }}
                >
                  {loading ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, color: COLORS.teal, padding: 32, textAlign: "center" }}>
                      <svg className="animate-spin" width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}>
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                      <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.navy }}>
                        Constructing Tripartite Interactome Topology...
                      </div>
                      <div style={{ fontSize: 13, color: COLORS.gray600 }}>
                        Resolving causal targets & candidate compounds for {networkType === "disease" ? selectedDisease : (selectedDrug?.name || "selected compound")}
                      </div>
                    </div>
                  ) : layout.nodes.length === 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 36, textAlign: "center" }}>
                      <div style={{ width: 54, height: 54, borderRadius: "50%", background: COLORS.tealBg, color: COLORS.teal, display: "grid", placeItems: "center", fontSize: 24, margin: "0 auto" }}>
                        🌐
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.navy }}>
                        No Interactome Subgraph Available
                      </div>
                      <p style={{ fontSize: 13.5, color: COLORS.gray600, maxWidth: 460, margin: 0, lineHeight: 1.5 }}>
                        No target interaction data found for this selection. Choose another target indication or drug compound above to generate the interactome.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDisease("Alzheimer's Disease");
                          setNetworkType("disease");
                        }}
                        style={primaryButton({ padding: "8px 18px", fontSize: 13, marginTop: 6 })}
                      >
                        Load Alzheimer's Disease Network
                      </button>
                    </div>
                  ) : (
                    <svg
                      viewBox="0 0 1000 580"
                      preserveAspectRatio="xMidYMid meet"
                      style={{ width: "100%", height: "100%", display: "block", cursor: isDragging ? "grabbing" : "grab" }}
                      onMouseDown={(e) => {
                        if (e.button === 0) {
                          setIsDragging(true);
                          setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
                        }
                      }}
                      onMouseMove={(e) => {
                        if (isDragging) {
                          setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
                        }
                      }}
                      onMouseUp={() => setIsDragging(false)}
                      onMouseLeave={() => setIsDragging(false)}
                    >
                      <defs>
                        <filter id="softGlow">
                          <feGaussianBlur stdDeviation="6" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                        <filter id="selectedGlow">
                          <feGaussianBlur stdDeviation="5" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>

                      <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`} transformOrigin="500 290" style={{ transition: isDragging ? "none" : "transform 0.15s ease-out" }}>
                        {/* Tri-Partite Column Section Headers */}
                        <g opacity="0.65">
                          <text x="180" y="32" textAnchor="middle" fontSize="11" fontWeight="800" fill={COLORS.navy} letterSpacing="0.06em">
                            {networkType === "disease" ? "TARGET INDICATION" : "CONNECTED DISEASES"}
                          </text>
                          <text x="520" y="32" textAnchor="middle" fontSize="11" fontWeight="800" fill="#0EA5E9" letterSpacing="0.06em">
                            CAUSAL TARGET GENES
                          </text>
                          <text x="820" y="32" textAnchor="middle" fontSize="11" fontWeight="800" fill="#8B5CF6" letterSpacing="0.06em">
                            {networkType === "disease" ? "CANDIDATE DRUGS" : "ACTIVE DRUG COMPOUND"}
                          </text>
                          <line x1="350" y1="42" x2="350" y2="550" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
                          <line x1="670" y1="42" x2="670" y2="550" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
                        </g>

                        {/* Render Edges */}
                        {layout.edges.map((edge) => {
                          const strokeColor = edge.color || (edge.actionType === "Inhibitor" ? "#E11D48" : edge.actionType === "Activator" ? "#10B981" : edge.type === "causal_association" ? "#0EA5E9" : "#8B5CF6");
                          const isConnected = neighborIds ? (neighborIds.has(edge.source.id) && neighborIds.has(edge.target.id)) : true;
                          const strokeOpacity = isConnected ? 0.85 : 0.12;

                          return (
                            <line
                              key={edge.id || `${edge.source.id}-${edge.target.id}`}
                              x1={edge.source.x}
                              y1={edge.source.y}
                              x2={edge.target.x}
                              y2={edge.target.y}
                              stroke={strokeColor}
                              strokeWidth={isConnected ? (edge.weight ? Math.min(edge.weight * 2.8, 4) : 2) : 1}
                              strokeDasharray={edge.type === "inferred" ? "4 3" : undefined}
                              opacity={strokeOpacity}
                              style={{ transition: "opacity 0.25s ease, stroke-width 0.25s ease" }}
                            />
                          );
                        })}

                        {/* Render Nodes */}
                        {layout.nodes.map((node) => {
                          const isNeighbor = neighborIds ? neighborIds.has(node.id) : true;
                          const isSelected = selectedTarget && selectedTarget.id === node.id;
                          const nodeOpacity = isNeighbor ? 1 : 0.18;

                          let nodeFill = COLORS.purple;
                          let nodeStroke = COLORS.purple;
                          if (node.type === "disease") {
                            nodeFill = "#0F172A";
                            nodeStroke = "#0EA5E9";
                          } else if (node.type === "protein" || node.type === "gene") {
                            nodeFill = "#EEF2FF";
                            nodeStroke = "#4F46E5";
                          } else if (node.type === "drug") {
                            if (node.actionType === "Inhibitor") {
                              nodeFill = "#FFF1F2";
                              nodeStroke = "#E11D48";
                            } else if (node.actionType === "Activator") {
                              nodeFill = "#ECFDF5";
                              nodeStroke = "#10B981";
                            } else {
                              nodeFill = "#F5F3FF";
                              nodeStroke = "#8B5CF6";
                            }
                          }

                          return (
                            <g
                              key={node.id}
                              transform={`translate(${node.x} ${node.y})`}
                              filter={isSelected ? "url(#selectedGlow)" : undefined}
                              opacity={nodeOpacity}
                              style={{ transition: "opacity 0.25s ease, transform 0.4s ease", cursor: "pointer" }}
                              onMouseEnter={(e) => moveTooltip(e, node)}
                              onMouseMove={(e) => moveTooltip(e, node)}
                              onMouseLeave={() => setTooltip(null)}
                              onClick={() => setSelectedTarget(node)}
                            >
                              {isSelected && (
                                <circle r={node.r + 6} fill="none" stroke={COLORS.tealBright} strokeWidth="3" strokeDasharray="3 3" />
                              )}

                              <circle
                                r={node.r}
                                fill={nodeFill}
                                stroke={nodeStroke}
                                strokeWidth={node.type === "disease" ? 3 : 2}
                              />

                              {/* Inside Circle Icon/Symbol */}
                              <text
                                y="4"
                                textAnchor="middle"
                                fontSize={node.type === "disease" ? 14 : node.type === "protein" || node.type === "gene" ? 11 : 12}
                                fontWeight="800"
                                fill={node.type === "disease" ? "#38BDF8" : node.type === "protein" || node.type === "gene" ? "#4F46E5" : nodeStroke}
                              >
                                {node.type === "disease" ? "🎯" : node.type === "protein" || node.type === "gene" ? shortLabel(node.label, 6) : "💊"}
                              </text>

                              {/* Clean Exterior Label Below Circle with Halo to Prevent Clipping */}
                              <g transform={`translate(0, ${node.r + 14})`}>
                                {/* Halo background outline for crisp contrast */}
                                <text
                                  textAnchor="middle"
                                  fontSize="11"
                                  fontWeight="700"
                                  fill="none"
                                  stroke="#FFFFFF"
                                  strokeWidth="4"
                                  strokeLinejoin="round"
                                >
                                  {shortLabel(node.label, 20)}
                                </text>
                                <text
                                  textAnchor="middle"
                                  fontSize="11"
                                  fontWeight="700"
                                  fill={COLORS.navy}
                                >
                                  {shortLabel(node.label, 20)}
                                </text>

                                {/* Subtitle Badge under unclipped label */}
                                <text
                                  y="12"
                                  textAnchor="middle"
                                  fontSize="8.5"
                                  fontWeight="600"
                                  fill={node.type === "disease" ? "#0284C7" : node.type === "protein" || node.type === "gene" ? "#4F46E5" : nodeStroke}
                                >
                                  {node.type === "disease" ? "Indication" : node.type === "protein" || node.type === "gene" ? "Target Gene" : (node.actionType || "Candidate")}
                                </text>
                              </g>
                            </g>
                          );
                        })}
                      </g>
                    </svg>
                  )}

                  {tooltip && <TripartiteTooltip tooltip={tooltip} />}
                </div>

                {/* Network Bottom Legend */}
                <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", marginTop: 16, color: COLORS.gray600, fontSize: 12 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#0F172A", border: "2px solid #0EA5E9" }} />
                    Target Indication
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#EEF2FF", border: "2px solid #4F46E5" }} />
                    Causal Target Gene
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#FFF1F2", border: "2px solid #E11D48" }} />
                    Inhibitor Drug Candidate
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#ECFDF5", border: "2px solid #10B981" }} />
                    Agonist / Activator Candidate
                  </span>
                </div>
              </Panel>

              {/* Right Column: Node Inspector & Connectivity Drawer */}
              <TripartiteSidePanel
                node={selectedTarget}
                onClear={() => setSelectedTarget(null)}
                onRouteToPredict={(disName) => {
                  if (setSearchContext && disName) setSearchContext({ disease: disName });
                  if (setPage) setPage("predict");
                }}
                onOpenDossier={(cand) => {
                  setDossierCandidate(cand);
                  setIsDossierOpen(true);
                }}
              />
            </div>

            {/* Candidate Inspector Dossier Modal */}
            <EvidenceDossierModal
              isOpen={isDossierOpen && Boolean(dossierCandidate)}
              onClose={() => {
                setIsDossierOpen(false);
                setDossierCandidate(null);
              }}
              candidate={dossierCandidate}
              diseaseName={selectedDisease || "Target Indication"}
            />
          </PageShell>
        );
      }

      // Layout Engine: Builds 3 vertical bands [Disease: Left (x=180)] -> [Target Genes: Middle (x=520)] -> [Drugs: Right (x=820)]
      function buildTripartiteNetworkLayout(network, interactionFilter = "All") {
        if (!network || !network.nodes) return { nodes: [], edges: [], targets: [], primaryCount: 0, secondaryCount: 0, diseaseLinkCount: 0 };
        const nodes = [];
        const edges = [];

        const rawDiseases = network.nodes.filter((n) => n.type === "disease");
        const rawGenes = network.nodes.filter((n) => n.type === "protein" || n.type === "gene");
        const rawDrugs = network.nodes.filter((n) => n.type === "drug");

        // Position Disease(s) on Left Column (x = 180, 18% of 1000)
        if (rawDiseases.length === 1) {
          nodes.push({
            ...rawDiseases[0],
            x: 180,
            y: 290,
            r: 32,
          });
        } else if (rawDiseases.length > 1) {
          const disStep = Math.min(65, 420 / Math.max(rawDiseases.length, 1));
          const disStartY = 290 - ((rawDiseases.length - 1) * disStep) / 2;
          rawDiseases.forEach((d, idx) => {
            nodes.push({
              ...d,
              x: 180,
              y: Math.max(70, Math.min(500, disStartY + idx * disStep)),
              r: 24,
            });
          });
        } else {
          nodes.push({ id: "disease_target", label: "Target Disease", type: "disease", x: 180, y: 290, r: 32 });
        }

        // Apply Interaction Filter to Drugs
        let filteredDrugs = rawDrugs;
        if (interactionFilter === "Inhibitors") {
          filteredDrugs = rawDrugs.filter((d) => (d.actionType || d.action_type || "").toLowerCase().includes("inhibitor"));
        } else if (interactionFilter === "Activators") {
          filteredDrugs = rawDrugs.filter((d) => (d.actionType || d.action_type || "").toLowerCase().includes("activator") || (d.actionType || d.action_type || "").toLowerCase().includes("agonist"));
        }

        // Clean Edge Routing & Pruning: Filter out orphaned intermediate gene nodes that have 0 connections
        const edgeConnectedIds = new Set();
        (network.edges || []).forEach((e) => {
          edgeConnectedIds.add(e.source?.id || e.source);
          edgeConnectedIds.add(e.target?.id || e.target);
        });

        const activeGenes = rawGenes.filter((g) => edgeConnectedIds.has(g.id) || rawGenes.length <= 8);

        // Position Genes in Center Column (x = 520, 52% of 1000)
        const geneStep = Math.min(60, 440 / Math.max(activeGenes.length, 1));
        const geneStartY = 290 - ((activeGenes.length - 1) * geneStep) / 2;
        const positionedGenes = activeGenes.map((g, idx) => ({
          ...g,
          x: 520,
          y: Math.max(70, Math.min(510, geneStartY + idx * geneStep)),
          r: 22,
        }));
        nodes.push(...positionedGenes);

        // Position Drugs in Right Column (x = 820, 82% of 1000)
        if (filteredDrugs.length === 1) {
          nodes.push({
            ...filteredDrugs[0],
            x: 820,
            y: 290,
            r: 30,
          });
        } else {
          const drugStep = Math.min(48, 450 / Math.max(filteredDrugs.length, 1));
          const drugStartY = 290 - ((filteredDrugs.length - 1) * drugStep) / 2;
          const positionedDrugs = filteredDrugs.map((d, idx) => ({
            ...d,
            x: 820,
            y: Math.max(70, Math.min(510, drugStartY + idx * drugStep)),
            r: 20,
          }));
          nodes.push(...positionedDrugs);
        }

        const nodeMap = new Map(nodes.map((n) => [n.id, n]));

        // Re-link Edges with coordinate endpoints
        (network.edges || []).forEach((e) => {
          const src = nodeMap.get(e.source?.id || e.source);
          const tgt = nodeMap.get(e.target?.id || e.target);
          if (src && tgt) {
            edges.push({
              ...e,
              source: src,
              target: tgt,
            });
          }
        });

        return {
          nodes,
          edges,
          targets: positionedGenes,
          primaryCount: activeGenes.length,
          secondaryCount: filteredDrugs.length,
          diseaseLinkCount: edges.length,
        };
      }

      function buildDrugNetworkLayout(network, layoutMode, maxTargets, interactionFilter) {
        return buildTripartiteNetworkLayout(network, interactionFilter);
      }

      function shortLabel(text, max = 12) {
        if (!text) return "";
        const s = String(text);
        return s.length > max ? s.slice(0, max - 1) + "…" : s;
      }

      function DetailRow({ label, value, color }) {
        if (value === undefined || value === null) return null;
        return (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 12 }}>
            <span style={{ color: COLORS.gray600, fontWeight: 600 }}>{label}:</span>
            <span style={{ color: color || COLORS.navy, fontWeight: 700, textAlign: "right" }}>{value}</span>
          </div>
        );
      }

      function TripartiteTooltip({ tooltip }) {
        const node = tooltip.node;
        return (
          <div
            style={{
              position: "absolute",
              left: tooltip.x,
              top: tooltip.y,
              width: 260,
              zIndex: 20,
              background: COLORS.white,
              border: `1px solid ${COLORS.gray200}`,
              borderRadius: 12,
              padding: "14px 16px",
              boxShadow: "0 14px 36px rgba(6, 24, 43, 0.2)",
              pointerEvents: "none",
              color: COLORS.gray800,
            }}
          >
            <div style={{ color: COLORS.navy, fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
              {node.label}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: COLORS.teal, marginBottom: 8 }}>
              Role: {node.type === "disease" ? "Target Indication" : node.type === "protein" || node.type === "gene" ? "Causal Target Gene" : "Repurposed Candidate"}
            </div>

            {node.type === "drug" && (
              <div style={{ display: "grid", gap: 5, fontSize: 12 }}>
                <DetailRow label="Action Type" value={node.actionType || "Modulator"} color={node.actionType === "Inhibitor" ? "#E11D48" : "#10B981"} />
                <DetailRow label="Clinical Phase" value={node.clinicalPhase || "Approved"} />
                {node.cnsMpo && <DetailRow label="BBB CNS MPO" value={`${node.cnsMpo} / 6.0`} />}
                {node.cmapScore !== undefined && <DetailRow label="CMap Reversal" value={`${node.cmapScore > 0 ? "+" : ""}${node.cmapScore}`} />}
              </div>
            )}

            {(node.type === "protein" || node.type === "gene") && (
              <div style={{ display: "grid", gap: 5, fontSize: 12 }}>
                <DetailRow label="Gene Symbol" value={node.label} />
                <DetailRow label="Relevance" value="Pathogenic Driver" />
              </div>
            )}

            {node.type === "disease" && (
              <div style={{ display: "grid", gap: 5, fontSize: 12 }}>
                <DetailRow label="Disease Area" value={node.diseaseArea || "Neurology"} />
                <DetailRow label="Candidates" value={`${node.candidateCount || 10} screened`} />
              </div>
            )}
          </div>
        );
      }

      function TripartiteSidePanel({ node, onClear, onRouteToPredict, onOpenDossier }) {
        if (!node) {
          return (
            <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
              <Panel style={{ padding: 22, borderRadius: 16, textAlign: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: COLORS.tealBg, color: COLORS.teal, display: "grid", placeItems: "center", margin: "0 auto 12px", fontSize: 20 }}>
                  🔍
                </div>
                <h3 style={{ color: COLORS.navy, fontSize: 17, fontWeight: 800, margin: "0 0 6px" }}>
                  Network Inspector
                </h3>
                <p style={{ color: COLORS.gray600, fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                  Click any node in the graph (Disease, Causal Gene, or Repurposed Drug) to view full binding affinities, CNS MPO BBB scores, and UniProt details.
                </p>
              </Panel>
            </aside>
          );
        }

        const isDrug = node.type === "drug";
        const isGene = node.type === "protein" || node.type === "gene";
        const isDisease = node.type === "disease";

        const candidatePayload = isDrug
          ? {
              drug_name: node.label,
              name: node.label,
              clinical_status: node.clinicalPhase || "Launched",
              action_type: node.actionType || "Modulator",
              cns_mpo: node.cnsMpo,
              cns_mpo_score: node.cnsMpo,
              cmap_score: node.cmapScore,
              composite_score: node.weight || 0.85,
              score: node.weight || 0.85,
              target_genes: node.targetGenes || [node.targetGene || "Target"],
            }
          : null;

        return (
          <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <Panel style={{ padding: 22, borderRadius: 16, borderTop: `4px solid ${COLORS.tealBright}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: COLORS.teal, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {isDrug ? "Candidate Compound" : isGene ? "Target Gene" : "Target Indication"}
                </span>
                <button
                  onClick={onClear}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: COLORS.coral,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Clear ✕
                </button>
              </div>

              <h3 style={{ color: COLORS.navy, fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>
                {node.label}
              </h3>

              {isDrug && (
                <div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                    <DirectionalBadge actionType={node.actionType} direction={node.therapeuticDirection} />
                    <ClinicalPhaseBadge phase={node.clinicalPhase} />
                  </div>

                  <div style={{ display: "grid", gap: 8, background: COLORS.gray50, padding: 12, borderRadius: 10, border: `1px solid ${COLORS.gray100}`, marginBottom: 14 }}>
                    <DetailRow label="Clinical Phase" value={node.clinicalPhase || "Approved"} />
                    {node.cnsMpo && <DetailRow label="Pfizer CNS MPO" value={`${node.cnsMpo} / 6.0 (${node.cnsBadge || "Calculated"})`} />}
                    {node.cmapScore !== undefined && <DetailRow label="LINCS L1000 CMap" value={`${node.cmapScore > 0 ? "+" : ""}${node.cmapScore}`} />}
                    <DetailRow label="Action Type" value={node.actionType || "Modulator"} />
                  </div>

                  {onOpenDossier && candidatePayload && (
                    <button
                      onClick={() => onOpenDossier(candidatePayload)}
                      style={{
                        ...primaryButton({ width: "100%", justifyContent: "center", padding: "10px", fontSize: 13 }),
                        marginBottom: 10,
                      }}
                    >
                      Open Full Evidence Dossier →
                    </button>
                  )}

                  <a
                    href={`https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(node.label)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      width: "100%",
                      padding: "10px",
                      background: COLORS.tealBg,
                      color: COLORS.teal,
                      border: `1px solid #BBF7D0`,
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      textDecoration: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    Inspect Compound on PubChem 🔍
                  </a>
                </div>
              )}

              {isGene && (
                <div>
                  <p style={{ color: COLORS.gray600, fontSize: 13.5, lineHeight: 1.5, margin: "0 0 14px" }}>
                    Causal molecular target implicated in the genetic etiology of the target condition.
                  </p>
                  <a
                    href={`https://www.uniprot.org/uniprotkb?query=${encodeURIComponent(node.label)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      width: "100%",
                      padding: "10px",
                      background: "#EEF2FF",
                      color: "#4F46E5",
                      border: "1px solid #C7D2FE",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      textDecoration: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    <span>View {node.label} on UniProt</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                </div>
              )}

              {isDisease && (
                <div>
                  <div style={{ background: COLORS.gray50, padding: 12, borderRadius: 10, border: `1px solid ${COLORS.gray100}`, marginBottom: 14 }}>
                    <DetailRow label="Disease Area" value={node.diseaseArea || "Neurology"} />
                    <DetailRow label="Screened Candidates" value={`${node.candidateCount || 10} candidates`} />
                  </div>
                  <button
                    onClick={() => onRouteToPredict(node.label)}
                    style={primaryButton({ width: "100%", justifyContent: "center", padding: "10px", fontSize: 13 })}
                  >
                    Open in Repurposing Predictor →
                  </button>
                </div>
              )}
            </Panel>
          </aside>
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
  const { updatePredictionContext } = usePredictionContext();

  useEffect(() => {
    if (page === "login" && user) setPage("home");
    updatePredictionContext({ screen: `/${page}` });
  }, [page, user]);

  const protect = (children) => (
    <ProtectedRoute loading={initializing} setPage={setPage} user={user}>
      {children}
    </ProtectedRoute>
  );

  return (
    <div style={{ fontFamily: "var(--font-sans)", background: COLORS.gray50, minHeight: "100vh" }}>
      <NavBar page={page} setPage={setPage} user={user} logout={logout} />
      {page === "home" && <HeroPage setPage={setPage} setSearchContext={setSearchContext} />}
      {page === "predict" && protect(<PredictPage user={user} setPage={setPage} searchContext={searchContext} setSearchContext={setSearchContext} />)}
      {page === "network" && protect(
        <ErrorBoundary>
          <InteractionNetworkPage user={user} setPage={setPage} setSearchContext={setSearchContext} />
        </ErrorBoundary>
      )}
      {page === "chatbot" && protect(<ChatbotPage onOpenChatbot={() => {
        if (window.tars && typeof window.tars.show === "function") {
          window.tars.show();
        }
      }} />)}
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
    </div>
  );
}
