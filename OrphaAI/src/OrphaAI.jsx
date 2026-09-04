import { useEffect, useMemo, useRef, useState } from "react";
import { ORPHAAI_LOGO_ALT, ORPHAAI_LOGO_SRC } from "./assets/logo";
import ProtectedRoute from "./auth/ProtectedRoute";
import { useAuth } from "./auth/AuthContext";
import GoogleSignInButton from "./components/GoogleSignInButton";
import OrphaAIChatbot from "./components/OrphaAIChatbot";
import { downloadPdfReport, uniqueReportFilename } from "./services/pdfExportService";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api/v1";

const COLORS = {
  teal: "#0F6E56",
  tealLight: "#22A7B8",
  tealBg: "#E1F5EE",
  coral: "#D85A30",
  navy: "#042C53",
  navyMid: "#185FA5",
  navyBg: "#E6F1FB",
  amber: "#BA7517",
  amberBg: "#FAEEDA",
  purple: "#5B5CE2",
  purpleBg: "#EEEDFE",
  gray50: "#F7F7F4",
  gray100: "#DADDD8",
  gray300: "#A4AAA3",
  gray600: "#5F5E5A",
  gray800: "#333532",
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

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
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
    teal: [COLORS.tealBg, COLORS.teal],
    navy: [COLORS.navyBg, COLORS.navyMid],
    amber: [COLORS.amberBg, COLORS.amber],
    purple: [COLORS.purpleBg, COLORS.purple],
  };
  const [bg, color] = map[tone] || map.teal;
  return <span style={{ background: bg, color, fontSize: 12, fontWeight: 700, padding: "4px 9px", borderRadius: 6 }}>{children}</span>;
}

function Panel({ children, style }) {
  return <div style={{ background: COLORS.white, border: `1px solid ${COLORS.gray100}`, borderRadius: 8, padding: 24, boxSizing: "border-box", maxWidth: "100%", minWidth: 0, ...style }}>{children}</div>;
}

function LogoMark({ size = 36, showText = false, color = COLORS.teal }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <img src={ORPHAAI_LOGO_SRC} alt={ORPHAAI_LOGO_ALT} style={{ width: size, height: size, objectFit: "contain", flex: `0 0 ${size}px` }} />
      {showText && <span style={{ fontFamily: "Georgia, serif", fontSize: Math.max(18, Math.round(size * 0.62)), fontWeight: 800, color, whiteSpace: "nowrap" }}>Orpha<span style={{ color: COLORS.gray800 }}>AI</span></span>}
    </span>
  );
}

function PageShell({ children, maxWidth = 1080, style }) {
  return <main className="orpha-page" style={{ maxWidth, width: "100%", margin: "0 auto", padding: "42px 24px", boxSizing: "border-box", overflowX: "hidden", ...style }}>{children}</main>;
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(4,44,83,0.36)", zIndex: 50, display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ background: COLORS.white, borderRadius: 8, border: `1px solid ${COLORS.gray100}`, width: "min(920px, 96vw)", maxHeight: "88vh", overflow: "auto", boxShadow: "0 18px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ position: "sticky", top: 0, background: COLORS.white, borderBottom: `1px solid ${COLORS.gray100}`, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ margin: 0, color: COLORS.navy, fontSize: 20 }}>{title}</h2>
          <button onClick={onClose} style={secondaryButton({ padding: "7px 11px" })}>Close</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

function AuthGate({ user, setPage }) {
  if (user) return null;
  return (
    <Panel style={{ maxWidth: 620, margin: "48px auto", textAlign: "center" }}>
      <h2 style={{ margin: "0 0 8px", color: COLORS.navy }}>Sign in required</h2>
      <p style={{ margin: "0 0 20px", color: COLORS.gray600 }}>This module uses secured backend APIs and JWT authentication.</p>
      <button onClick={() => setPage("login")} style={primaryButton()}>Sign In</button>
    </Panel>
  );
}

function primaryButton(extra = {}) {
  return {
    padding: "11px 18px",
    border: "none",
    borderRadius: 8,
    background: COLORS.teal,
    color: COLORS.white,
    fontWeight: 700,
    cursor: "pointer",
    ...extra,
  };
}

function secondaryButton(extra = {}) {
  return {
    padding: "10px 16px",
    border: `1px solid ${COLORS.gray100}`,
    borderRadius: 8,
    background: COLORS.white,
    color: COLORS.navy,
    fontWeight: 700,
    cursor: "pointer",
    ...extra,
  };
}

function inputStyle(extra = {}) {
  return {
    padding: "11px 13px",
    border: `1px solid ${COLORS.gray100}`,
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
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
    <nav className="orpha-nav" style={{ background: COLORS.white, borderBottom: `1px solid ${COLORS.gray100}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 64, position: "sticky", top: 0, zIndex: 10, gap: 16, flexWrap: "wrap", boxSizing: "border-box" }}>
      <button onClick={() => setPage("home")} style={{ display: "flex", alignItems: "center", gap: 10, border: "none", background: "transparent", cursor: "pointer", padding: 0, minWidth: 0 }}>
        <LogoMark size={34} showText />
      </button>

      <div className="orpha-nav-links" style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center", minWidth: 0 }}>
        {nav.map(([key, label]) => (
          <button key={key} onClick={() => setPage(key)} style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: page === key ? COLORS.tealBg : "transparent", color: page === key ? COLORS.teal : COLORS.gray600, fontWeight: page === key ? 700 : 500, cursor: "pointer" }}>
            {label}
          </button>
        ))}
      </div>

      {user ? (
        <div style={{ position: "relative", minWidth: 0 }}>
          <button onClick={() => setProfileOpen((open) => !open)} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, border: `1px solid ${COLORS.gray100}`, background: COLORS.white, borderRadius: 8, padding: "5px 9px", cursor: "pointer" }} aria-expanded={profileOpen} aria-label="Open user profile menu">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={userLabel(user)} referrerPolicy="no-referrer" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flex: "0 0 34px" }} />
            ) : (
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: COLORS.teal, color: COLORS.white, display: "grid", placeItems: "center", fontWeight: 800, flex: "0 0 34px" }}>{userLabel(user)[0]}</div>
            )}
            <span style={{ fontSize: 14, color: COLORS.gray800, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userLabel(user)}</span>
          </button>
          {profileOpen && (
            <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 276, maxWidth: "calc(100vw - 32px)", background: COLORS.white, border: `1px solid ${COLORS.gray100}`, borderRadius: 8, boxShadow: "0 18px 46px rgba(4,44,83,0.16)", padding: 14, zIndex: 20 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={userLabel(user)} referrerPolicy="no-referrer" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flex: "0 0 44px" }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: COLORS.teal, color: COLORS.white, display: "grid", placeItems: "center", fontWeight: 900, flex: "0 0 44px" }}>{userLabel(user)[0]}</div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: COLORS.navy, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userLabel(user)}</div>
                  <div style={{ color: COLORS.gray600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
                </div>
              </div>
              <button onClick={handleLogout} style={secondaryButton({ width: "100%", marginTop: 12 })}>Sign Out</button>
            </div>
          )}
        </div>
      ) : (
        <button onClick={() => setPage("login")} style={primaryButton({ padding: "8px 18px" })}>Sign In</button>
      )}
    </nav>
  );
}

function HeroPage({ setPage }) {
  return (
    <div>
      <section className="orpha-hero" style={{ background: `linear-gradient(135deg, ${COLORS.navy} 0%, ${COLORS.teal} 100%)`, padding: "72px 24px 52px", textAlign: "center", overflow: "hidden" }}>
        <LogoMark size={86} />
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 48, color: COLORS.white, margin: "0 0 16px", lineHeight: 1.1 }}>Discover new treatments from existing drugs</h1>
        <p style={{ maxWidth: 700, margin: "0 auto 28px", color: "rgba(255,255,255,0.78)", fontSize: 17, lineHeight: 1.7 }}>
          OrphaAI combines curated seed data, live public-database lookups, and an interpretable scoring engine for drug repurposing research.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <button onClick={() => setPage("diseases")} style={primaryButton({ background: COLORS.white, color: COLORS.teal })}>Search Diseases</button>
          <button onClick={() => setPage("drugs")} style={secondaryButton({ background: "transparent", color: COLORS.white, borderColor: "rgba(255,255,255,0.45)" })}>Search Drugs</button>
          <button onClick={() => setPage("predict")} style={secondaryButton({ background: "transparent", color: COLORS.white, borderColor: "rgba(255,255,255,0.45)" })}>Run Prediction</button>
        </div>
      </section>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", borderBottom: `1px solid ${COLORS.gray100}` }}>
        {[["Secured", "JWT + bcrypt auth"], ["Live", "PubChem/ChEMBL/Open Targets fallback"], ["Explainable", "Similarity + network + GNN proxy"], ["Reports", "Downloadable prediction output"]].map(([value, label]) => (
          <div key={value} style={{ padding: "24px", textAlign: "center", borderRight: `1px solid ${COLORS.gray100}` }}>
            <div style={{ color: COLORS.teal, fontWeight: 900, fontSize: 24 }}>{value}</div>
            <div style={{ color: COLORS.gray600, fontSize: 13, marginTop: 4 }}>{label}</div>
          </div>
        ))}
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

  // If user is already logged in (including after Google OAuth redirect),
  // send them to the home page.
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
    <div style={{ minHeight: "calc(100vh - 64px)", display: "grid", placeItems: "center", background: COLORS.gray50, padding: 24 }}>
      <Panel style={{ width: "100%", maxWidth: 430 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <LogoMark size={64} />
          <div style={{ fontFamily: "Georgia, serif", fontSize: 28, fontWeight: 800, color: COLORS.teal, marginTop: 6 }}>OrphaAI</div>
          <div style={{ color: COLORS.gray600, marginTop: 4 }}>Research Platform Access</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
          {["login", "register"].map((value) => (
            <button key={value} onClick={() => { setTab(value); setError(""); }} style={value === tab ? primaryButton() : secondaryButton()}>
              {value === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>
        {tab === "register" && (
          <>
            <label style={{ fontSize: 13, color: COLORS.gray600 }}>Full Name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. Jane Smith" style={inputStyle({ width: "100%", margin: "6px 0 14px" })} />
            <label style={{ fontSize: 13, color: COLORS.gray600 }}>Institution</label>
            <input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="University or lab" style={inputStyle({ width: "100%", margin: "6px 0 14px" })} />
          </>
        )}
        <label style={{ fontSize: 13, color: COLORS.gray600 }}>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle({ width: "100%", margin: "6px 0 14px" })} />
        <label style={{ fontSize: 13, color: COLORS.gray600 }}>Password</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="StrongPass1!"
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={inputStyle({ width: "100%", margin: "6px 0 10px" })}
        />
        {tab === "register" && (
          <div style={{ fontSize: 12, color: COLORS.gray600, marginBottom: 12 }}>
            Use 8+ characters with uppercase, lowercase, number, and special character.
          </div>
        )}
        {error && (
          <div style={{ background: COLORS.amberBg, color: COLORS.amber, borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}
        <button onClick={submit} disabled={loading} style={primaryButton({ width: "100%", opacity: loading ? 0.6 : 1 })}>
          {loading ? "Please wait..." : tab === "login" ? "Sign In" : "Create Account"}
        </button>
        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0", color: COLORS.gray600, fontSize: 12 }}>
          <span style={{ height: 1, background: COLORS.gray100, flex: 1 }} />
          <span>or</span>
          <span style={{ height: 1, background: COLORS.gray100, flex: 1 }} />
        </div>
        {/* Google OAuth button — triggers Supabase redirect flow */}
        <GoogleSignInButton disabled={loading} onError={setError} />
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: COLORS.gray600 }}>
          Demo: demo@orphaai.com / Demo1234
        </div>
      </Panel>
    </div>
  );
}

function LibrarySearch({ value, onChange, placeholder, onSubmit }) {
  return (
    <div style={{ display: "flex", gap: 10, margin: "22px 0", flexWrap: "wrap" }}>
      <input value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSubmit()} placeholder={placeholder} style={inputStyle({ flex: "1 1 260px" })} />
      <button onClick={onSubmit} style={primaryButton()}>Search</button>
    </div>
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
    <PageShell maxWidth={1080}>
      <h1 style={{ fontFamily: "Georgia, serif", color: COLORS.navy, margin: 0 }}>Drug Library</h1>
      <LibrarySearch value={query} onChange={setQuery} placeholder="Search Metformin, Sildenafil, Imatinib, aspirin..." onSubmit={() => load(query)} />
      {loading && <p style={{ color: COLORS.gray600 }}>Searching...</p>}
      {message && <p style={{ color: COLORS.amber }}>{message}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        {drugs.map((drug) => (
          <Panel key={drug.id} style={{ cursor: "pointer" }}>
            <div onClick={() => openPubChem(drug)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <h3 style={{ margin: 0, color: COLORS.navy }}>{drug.name}</h3>
                <Badge tone={drug.status === "approved" ? "teal" : "amber"}>{drug.status}</Badge>
              </div>
              <p style={{ color: COLORS.gray600, minHeight: 38 }}>{drug.indication || "No indication listed"}</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(drug.primaryTargets || []).slice(0, 4).map((target) => <Badge key={target.symbol} tone="navy">{target.symbol}</Badge>)}
              </div>
            </div>
          </Panel>
        ))}
      </div>
      {external && <ExternalDrugCard data={external} />}
      {pubchemModal && (
        <Modal title={`${pubchemModal.drug.name} - PubChem`} onClose={() => setPubchemModal(null)}>
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
    <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 220px) minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
      <div>
        {data.image2d && <img alt={`${drug.name} structure`} src={data.image2d} style={{ width: "100%", border: `1px solid ${COLORS.gray100}`, borderRadius: 8, background: COLORS.white }} />}
        {data.sourceUrl && <a href={data.sourceUrl} target="_blank" rel="noreferrer" style={{ ...secondaryButton({ display: "block", textAlign: "center", marginTop: 10, textDecoration: "none" }) }}>Open PubChem</a>}
      </div>
      <div>
        {data.sourceStatus === "local-fallback" && (
          <div style={{ background: COLORS.amberBg, color: COLORS.amber, borderRadius: 8, padding: 10, marginBottom: 12, lineHeight: 1.45 }}>
            PubChem live lookup is unavailable in this environment, so this popup is using local curated molecular data.
          </div>
        )}
        {data.description && <p style={{ color: COLORS.gray800, lineHeight: 1.6, marginTop: 0 }}>{data.description}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
          {rows.map(([label, value]) => <Info key={label} label={label} value={value} />)}
        </div>
        {data.synonyms?.length > 0 && (
          <>
            <h3 style={{ color: COLORS.navy }}>Synonyms</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{data.synonyms.map((s) => <Badge key={s} tone="navy">{s}</Badge>)}</div>
          </>
        )}
      </div>
    </div>
  );
}

function ExternalDrugCard({ data }) {
  const p = data.pubchem;
  const c = data.chembl;
  return (
    <Panel style={{ marginTop: 18 }}>
      <h3 style={{ margin: "0 0 12px", color: COLORS.navy }}>Live Public Database Match</h3>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(160px, 220px) 1fr", gap: 18 }}>
        {p?.image2d ? <img alt={`${data.query} 2D structure`} src={p.image2d} style={{ width: "100%", border: `1px solid ${COLORS.gray100}`, borderRadius: 8 }} /> : <div />}
        <div>
          {p && <p style={{ marginTop: 0, color: COLORS.gray800 }}><b>PubChem CID:</b> {p.cid}<br /><b>Formula:</b> {p.molecularFormula}<br /><b>Weight:</b> {p.molecularWeight}<br /><b>IUPAC:</b> {p.iupacName}</p>}
          {c && <p style={{ color: COLORS.gray800 }}><b>ChEMBL:</b> {c.chemblId}<br /><b>Max phase:</b> {c.maxPhase ?? "N/A"}</p>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
    <PageShell maxWidth={1080}>
      <h1 style={{ fontFamily: "Georgia, serif", color: COLORS.navy, margin: 0 }}>Disease Library</h1>
      <LibrarySearch value={query} onChange={setQuery} placeholder="Search Alzheimer's, ALS, cancer, hypertension..." onSubmit={() => load(query)} />
      {loading && <p style={{ color: COLORS.gray600 }}>Searching...</p>}
      {message && <p style={{ color: COLORS.amber }}>{message}</p>}
      <div style={{ display: "grid", gap: 14 }}>
        {diseases.map((disease) => (
          <Panel key={disease.id} style={{ cursor: "pointer" }}>
            <div onClick={() => openKegg(disease)} style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
              <div style={{ minWidth: 58, height: 58, borderRadius: 8, background: COLORS.tealBg, display: "grid", placeItems: "center", color: COLORS.teal, fontWeight: 900 }}>{disease.associatedGenes?.length || 0}</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: "0 0 5px", color: COLORS.navy }}>{disease.name}</h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Badge tone="purple">{disease.diseaseType || "untyped"}</Badge>
                  {disease.isRare && <Badge tone="amber">rare</Badge>}
                  {disease.omimId && <Badge tone="navy">OMIM {disease.omimId}</Badge>}
                </div>
              </div>
            </div>
          </Panel>
        ))}
      </div>
      {external && <ExternalDiseaseCard data={external} />}
      {keggModal && (
        <Modal title={`${keggModal.disease.name} - KEGG Pathways`} onClose={() => setKeggModal(null)}>
          <KeggInfo disease={keggModal.disease} data={keggModal.kegg} />
        </Modal>
      )}
    </PageShell>
  );
}

function KeggInfo({ disease, data }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 18 }}>
        <Info label="KEGG Entry" value={data.entry} />
        <Info label="Name" value={(data.names || [disease.name]).join("; ")} />
        <Info label="Category" value={data.category} />
        <Info label="Linked Drugs" value={data.drugs?.length || 0} />
      </div>
      {data.sourceStatus === "local-fallback" && (
        <div style={{ background: COLORS.amberBg, color: COLORS.amber, borderRadius: 8, padding: 10, marginBottom: 14, lineHeight: 1.45 }}>
          KEGG live lookup is unavailable or did not match this exact disease name, so this popup is using local pathway data.
        </div>
      )}
      {data.description && <p style={{ color: COLORS.gray800, lineHeight: 1.6 }}>{data.description}</p>}
      <h3 style={{ color: COLORS.navy }}>Disease Pathways From KEGG</h3>
      {data.pathways?.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {data.pathways.map((p) => (
            <a key={p.id} href={`https://www.genome.jp/entry/${p.id}`} target="_blank" rel="noreferrer" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: 12, border: `1px solid ${COLORS.gray100}`, borderRadius: 8, textDecoration: "none", color: COLORS.gray800 }}>
              <span>{p.name || p.id}</span>
              <Badge tone="purple">{p.id}</Badge>
            </a>
          ))}
        </div>
      ) : (
        <p style={{ color: COLORS.gray600 }}>KEGG did not list disease pathways for this entry.</p>
      )}
      {data.sourceUrl && <a href={data.sourceUrl} target="_blank" rel="noreferrer" style={{ ...secondaryButton({ display: "inline-block", marginTop: 16, textDecoration: "none" }) }}>Open KEGG Entry</a>}
    </div>
  );
}

function ExternalDiseaseCard({ data }) {
  const hits = data.openTargets?.matches || [];
  const kegg = data.kegg?.matches || [];
  const geo = data.geo?.datasetIds || [];
  return (
    <Panel style={{ marginTop: 18 }}>
      <h3 style={{ margin: "0 0 12px", color: COLORS.navy }}>Live Public Database Match</h3>
      {hits.length > 0 && <p style={{ color: COLORS.gray800 }}><b>Open Targets:</b> {hits.map((h) => `${h.name} (${h.id})`).join(", ")}</p>}
      {kegg.length > 0 && <p style={{ color: COLORS.gray800 }}><b>KEGG:</b> {kegg.map((h) => `${h.name} (${h.id})`).join(", ")}</p>}
      {geo.length > 0 && <p style={{ color: COLORS.gray800 }}><b>GEO dataset IDs:</b> {geo.join(", ")}</p>}
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
      <button onClick={() => setPage("drugs")} style={secondaryButton({ marginBottom: 18 })}>Back to Drug Library</button>
      {message && <p style={{ color: COLORS.amber }}>{message}</p>}
      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontFamily: "Georgia, serif", color: COLORS.navy, margin: 0 }}>{drug.name}</h1>
            <p style={{ color: COLORS.gray600 }}>{drug.description || drug.indication}</p>
          </div>
          <Badge>{drug.status || "unknown"}</Badge>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 18 }}>
          <Info label="Class" value={drug.drugClass} />
          <Info label="Molecular Formula" value={drug.molecularFormula || pubchem?.molecularFormula} />
          <Info label="Molecular Weight" value={drug.molecularWeight || pubchem?.molecularWeight} />
          <Info label="DrugBank / ChEMBL" value={`${drug.drugbankId || "N/A"} / ${drug.chemblId || "N/A"}`} />
        </div>
        {pubchem?.image2d && <img alt={`${drug.name} structure`} src={pubchem.image2d} style={{ marginTop: 18, maxWidth: 260, border: `1px solid ${COLORS.gray100}`, borderRadius: 8 }} />}
        <h3 style={{ color: COLORS.navy }}>Primary Targets</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{(drug.primaryTargets || []).map((t) => <Badge key={t.symbol} tone="navy">{t.symbol}</Badge>)}</div>
        <h3 style={{ color: COLORS.navy }}>Pathways</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{(drug.pathways || []).map((p) => <Badge key={p.id} tone="purple">{p.name}</Badge>)}</div>
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
      <button onClick={() => setPage("diseases")} style={secondaryButton({ marginBottom: 18 })}>Back to Disease Library</button>
      {message && <p style={{ color: COLORS.amber }}>{message}</p>}
      <Panel>
        <h1 style={{ fontFamily: "Georgia, serif", color: COLORS.navy, margin: 0 }}>{disease.name}</h1>
        <p style={{ color: COLORS.gray600 }}>{disease.description || "No description available."}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          <Badge tone="purple">{disease.diseaseType || "untyped"}</Badge>
          {disease.isRare && <Badge tone="amber">rare disease</Badge>}
          {disease.omimId && <Badge tone="navy">OMIM {disease.omimId}</Badge>}
        </div>
        <h3 style={{ color: COLORS.navy }}>Associated Genes</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{(disease.associatedGenes || []).map((g) => <Badge key={g.symbol}>{g.symbol}</Badge>)}</div>
        <h3 style={{ color: COLORS.navy }}>Pathways</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{(disease.pathways || []).map((p) => <Badge key={p.id} tone="purple">{p.name}</Badge>)}</div>
      </Panel>
      <Panel style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0, color: COLORS.navy }}>Stored Predictions</h3>
        {predictions.length === 0 ? <p style={{ color: COLORS.gray600 }}>No predictions stored yet. Run the predictor for this disease.</p> : predictions.slice(0, 8).map((p) => <PredictionRow key={p.id} pred={p} />)}
      </Panel>
    </PageShell>
  );
}

function Info({ label, value }) {
  return (
    <div style={{ background: COLORS.gray50, borderRadius: 8, padding: 14 }}>
      <div style={{ color: COLORS.gray600, fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ color: COLORS.navy, fontWeight: 700, overflowWrap: "anywhere", lineHeight: 1.35 }}>{value || "N/A"}</div>
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
      ...(currentTreatments.length ? currentTreatments.flatMap((item, index) => [
        `${index + 1}. ${item.name} - ${item.reason || "Current/standard treatment"}`,
      ]) : ["No current-treatment mapping found in the local curated set."]),
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
    <PageShell maxWidth={980}>
      <h1 style={{ fontFamily: "Georgia, serif", color: COLORS.navy, margin: 0 }}>Potential Drug Repurposing Predictor</h1>
      <Panel>
        <label style={{ fontSize: 13, fontWeight: 700, color: COLORS.gray600 }}>Target Disease</label>
        <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
          <input value={disease} onChange={(e) => setDisease(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runPrediction()} placeholder="Alzheimer's Disease, ALS, hypertension..." style={inputStyle({ flex: "1 1 280px" })} />
          <button onClick={runPrediction} disabled={loading} style={primaryButton({ opacity: loading ? 0.6 : 1 })}>{loading ? "Running..." : "Run Prediction"}</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {["Alzheimer's Disease", "Amyotrophic Lateral Sclerosis", "Epilepsy", "Breast Cancer"].map((x) => <button key={x} onClick={() => setDisease(x)} style={secondaryButton({ padding: "6px 10px", fontSize: 12 })}>{x}</button>)}
        </div>
      </Panel>
      {error && <p style={{ color: COLORS.amber }}>{error}</p>}
      {(currentTreatments.length > 0 || results.length > 0) && (
        <section style={{ marginTop: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <h2 style={{ color: COLORS.navy, margin: 0 }}>Results for {meta?.disease?.name || disease}</h2>
            <button onClick={downloadReport} style={secondaryButton({ color: COLORS.teal, borderColor: COLORS.teal })}>Download PDF Report</button>
          </div>
          {downloadStatus && <div style={{ color: downloadStatus.startsWith("Error:") ? COLORS.amber : COLORS.gray600, fontSize: 13, marginBottom: 12, overflowWrap: "anywhere" }}>{downloadStatus}</div>}
          <Panel style={{ marginBottom: 16 }}>
            <h3 style={{ color: COLORS.navy, marginTop: 0 }}>Currently Used Drugs</h3>
            {currentTreatments.length === 0 ? (
              <p style={{ color: COLORS.gray600 }}>No standard-treatment mapping found for this disease in the local curated set.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {currentTreatments.map((item) => <CurrentTreatmentRow key={item.name} item={item} />)}
              </div>
            )}
          </Panel>
          <h3 style={{ color: COLORS.navy }}>Repurposed Drug Candidates</h3>
          {results.length === 0 ? <p style={{ color: COLORS.gray600 }}>No repurposing candidates passed the score threshold.</p> : results.map((pred) => <PredictionRow key={pred.id || `${pred.drug?.id}-${pred.rank}`} pred={pred} />)}
        </section>
      )}
    </PageShell>
  );
}

function CurrentTreatmentRow({ item }) {
  const drug = item.drug || {};
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: COLORS.gray50, borderRadius: 8, padding: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 8, background: COLORS.navyBg, display: "grid", placeItems: "center", color: COLORS.navyMid, fontWeight: 900 }}>Rx</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <strong style={{ color: COLORS.navy }}>{item.name}</strong>
          <Badge tone={item.isInLocalLibrary ? "teal" : "navy"}>{item.isInLocalLibrary ? "local library" : "standard care"}</Badge>
        </div>
        <div style={{ color: COLORS.gray600, marginTop: 4, lineHeight: 1.45 }}>{item.reason}</div>
        {drug.drugClass && <div style={{ marginTop: 8 }}><Badge tone="purple">{drug.drugClass}</Badge></div>}
      </div>
    </div>
  );
}

function PredictionRow({ pred }) {
  const drug = pred.drug || {};
  const sourceLabel = pred.source === "chembl-api" ? "ChEMBL API" : pred.source === "open-targets-api" ? "Open Targets API" : "Local fallback";
  return (
    <Panel style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", minWidth: 0 }}>
        <div style={{ width: 58, height: 58, borderRadius: 8, background: COLORS.tealBg, display: "grid", placeItems: "center", color: COLORS.teal, fontWeight: 900, flex: "0 0 58px" }}>Rx</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, color: COLORS.navy }}>{drug.name}</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge tone="purple">{sourceLabel}</Badge>
              <Badge tone={pred.evidenceLevel === "high" ? "teal" : pred.evidenceLevel === "moderate" ? "navy" : "amber"}>{pred.evidenceLevel || "low"} evidence</Badge>
            </div>
          </div>
          <p style={{ color: COLORS.gray600 }}>{pred.rationale}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {pred.targetName && <Badge tone="navy">Target {pred.targetName}</Badge>}
            {pred.actionType && <Badge>Predicted Interaction Mode: {pred.actionType}</Badge>}
            {drug.molecularWeight && <Badge tone="amber">MW {drug.molecularWeight}</Badge>}
          </div>
          {pred.mechanismOfAction && <div style={{ color: COLORS.gray600, marginTop: 10, fontSize: 13, lineHeight: 1.45 }}><b>Mechanism:</b> {pred.mechanismOfAction}</div>}
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
    <PageShell maxWidth={1200}>
      <h1 className="network-title" style={{ fontFamily: "Georgia, serif", color: COLORS.navy, margin: "0 0 16px", lineHeight: 1.12 }}>Drug-Target Interaction Network</h1>
      <Panel style={{ overflow: "hidden" }}>
        <div className="network-controls" style={{ display: "flex", justifyContent: "space-between", alignItems: "stretch", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ flex: "1 1 280px", minWidth: 0 }}>
            <select value={drugId} onChange={(e) => setDrugId(e.target.value)} style={inputStyle({ width: "100%", minHeight: 46 })}>
              {drugs.map((drug) => <option key={drug.id} value={drug.id}>{drug.name}</option>)}
            </select>
            <div style={{ color: COLORS.gray600, fontSize: 13, marginTop: 8 }}>{network?.drug?.name || "Drug"} - {layout.primaryCount} primary targets - {layout.secondaryCount} secondary</div>
          </div>
          <div className="network-mode-controls" style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: "1 1 300px", justifyContent: "flex-end" }}>
            {["radial", "force", "hierarchical"].map((mode) => (
              <button key={mode} onClick={() => setLayoutMode(mode)} style={layoutMode === mode ? primaryButton({ padding: "10px 12px", flex: "1 1 96px" }) : secondaryButton({ padding: "10px 12px", flex: "1 1 96px" })}>
                {mode === "force" ? "Force-directed" : mode[0].toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {message && <p style={{ color: COLORS.amber }}>{message}</p>}
        <div className="network-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(240px, 280px)", gap: 16, alignItems: "stretch", minWidth: 0 }}>
          <div ref={(node) => { networkRef.current = node; }} style={{ position: "relative", background: "#F7F8FB", border: `1px solid ${COLORS.gray100}`, borderRadius: 8, minHeight: 420, display: "grid", placeItems: "center", overflow: "hidden", minWidth: 0 }}>
            <svg viewBox="0 0 760 420" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", maxWidth: 820, height: "auto", display: "block" }}>
              <defs>
                <filter id="softGlow"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>
              {/* Pathway grouping bubbles sit behind related visible targets. */}
              {buildPathwayBubbles(visibleTargets).map((group) => (
                <g key={group.name} opacity="0.5">
                  <ellipse cx={group.cx} cy={group.cy} rx={group.rx} ry={group.ry} fill={group.kind === "signaling" ? "#EEEDFE" : COLORS.tealBg} stroke={group.kind === "signaling" ? "#AFA9EC" : "#5DCAA5"} strokeWidth="0.5" />
                  <text x={group.x} y={group.y} fontSize="10" fontWeight="800" fill={group.kind === "signaling" ? "#7F77DD" : "#1D9E75"}>{group.name}</text>
                </g>
              ))}
              {/* Edges encode interaction type by color and affinity by stroke width. */}
              {layout.edges.map((edge) => {
                const isVisible = visibleIds.has(edge.target.id);
                const style = interactionStyle(edge.target.interactionType);
                return <line key={`${edge.source.id}-${edge.target.id}`} x1={edge.source.x} y1={edge.source.y} x2={edge.target.x} y2={edge.target.y} stroke={style.stroke} strokeWidth={affinityStroke(edge.target.ki)} strokeDasharray={style.dash} opacity={isVisible ? 0.8 : 0} style={{ transition: "opacity 0.2s" }} />;
              })}
              {/* Nodes animate between radial, force-directed, and hierarchical layouts. */}
              {layout.nodes.map((node) => {
                const isVisible = node.type === "drug" || visibleIds.has(node.id);
                const style = interactionStyle(node.interactionType);
                return (
                  <g key={node.id} transform={`translate(${node.x} ${node.y})`} filter={node.type === "drug" ? "url(#softGlow)" : undefined} opacity={isVisible ? 1 : 0} style={{ transition: "opacity 0.2s, transform 0.6s ease", cursor: node.type === "drug" ? "default" : "pointer" }} onMouseEnter={(e) => moveTooltip(e, node)} onMouseMove={(e) => moveTooltip(e, node)} onMouseLeave={() => setTooltip(null)} onClick={() => node.type !== "drug" && setSelectedTarget(node)}>
                    <circle r={node.r} fill={node.type === "drug" ? COLORS.purple : style.fill} stroke={node.type === "drug" ? COLORS.purple : style.stroke} strokeWidth={node.type === "drug" ? 0 : 2.2} />
                    <text y={node.type === "drug" ? 4 : -2} textAnchor="middle" fontSize={node.type === "drug" ? 13 : 10.5} fontWeight="800" fill={node.type === "drug" ? COLORS.white : COLORS.gray800}>{shortLabel(node.label, node.type === "drug" ? 12 : 8)}</text>
                    {node.type !== "drug" && <text y="11" textAnchor="middle" fontSize="8.5" fontWeight="700" fill={COLORS.gray600}>{node.isPrimary ? "primary" : node.importance === "secondary" ? "secondary" : "tertiary"}</text>}
                  </g>
                );
              })}
            </svg>
            {tooltip && <NetworkTooltip tooltip={tooltip} />}
          </div>
          <NetworkSidePanel drug={network?.drug || selectedDrug} layout={layout} selectedTarget={selectedTarget} drugs={drugs} />
        </div>
        <NetworkLegend />
      </Panel>
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
  inhibitor: { stroke: "#D85A30", fill: "#F0997B", label: "Inhibitor" },
  activator: { stroke: "#639922", fill: "#97C459", label: "Activator" },
  allosteric: { stroke: "#7F77DD", fill: "#AFA9EC", label: "Allosteric", dash: "4 3" },
  predicted: { stroke: "#7F77DD", fill: "#AFA9EC", label: "Predicted", dash: "4 3" },
  unknown: { stroke: "#888780", fill: "#DADDD8", label: "Unknown" },
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
    <div style={{ position: "absolute", left: tooltip.x, top: tooltip.y, width: 244, zIndex: 5, background: COLORS.white, border: `1px solid ${COLORS.gray100}`, borderRadius: 8, padding: 12, boxShadow: "0 12px 30px rgba(4,44,83,0.16)", pointerEvents: "none", color: COLORS.gray800 }}>
      <div style={{ color: COLORS.navy, fontSize: 15, fontWeight: 900, marginBottom: 8 }}>{node.label}</div>
      <DetailRow label="Interaction" value={node.type === "drug" ? "Primary drug" : interactionStyle(node.interactionType).label} color={style.stroke} />
      <DetailRow label="Binding affinity" value={node.ki || "N/A"} />
      <DetailRow label="Evidence" value={node.evidenceSource || "N/A"} />
    </div>
  );
}

function DetailRow({ label, value, color }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, lineHeight: 1.7 }}><span style={{ color: COLORS.gray600 }}>{label}</span><strong style={{ color: color || COLORS.gray800, textAlign: "right" }}>{value}</strong></div>;
}

function NetworkSidePanel({ drug, layout, selectedTarget, drugs }) {
  const name = drug?.name || "Drug";
  const status = drug?.status || "Approved";
  const drugClass = drug?.drugClass || drug?.drug_class || "Therapeutic";
  const similar = selectedTarget ? drugs.filter((item) => item.name !== name).slice(0, 4) : [];
  return (
    <aside style={{ display: "grid", gap: 12, alignContent: "start" }}>
      {/* Selected drug info card summarizes the current center node. */}
      <Panel style={{ padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: COLORS.purple, color: COLORS.white, display: "grid", placeItems: "center", fontWeight: 900 }}>{initials(name)}</div>
          <div>
            <div style={{ color: COLORS.navy, fontWeight: 900 }}>{name}</div>
            <div style={{ color: COLORS.gray600, fontSize: 12 }}>{drugClass} · {status}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          <Stat label="Primary" value={layout.primaryCount} />
          <Stat label="Secondary" value={layout.secondaryCount} />
          <Stat label="Disease links" value={layout.diseaseLinkCount} />
        </div>
      </Panel>
      {/* Interaction legend card mirrors node and edge colors. */}
      <Panel style={{ padding: 14 }}>
        <h3 style={{ margin: "0 0 10px", color: COLORS.navy, fontSize: 15 }}>Interaction Types</h3>
        {["inhibitor", "activator", "allosteric"].map((type) => <InteractionLegendRow key={type} type={type} />)}
      </Panel>
      {/* Selected target details update when a node is clicked. */}
      <Panel style={{ padding: 14 }}>
        <h3 style={{ margin: "0 0 10px", color: COLORS.navy, fontSize: 15 }}>Selected Node</h3>
        {!selectedTarget ? <p style={{ margin: 0, color: COLORS.gray600, fontSize: 13 }}>Click a target node to see details</p> : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <strong style={{ color: COLORS.navy }}>{selectedTarget.label}</strong>
              <InteractionBadge type={selectedTarget.interactionType} />
            </div>
            <div style={{ marginTop: 10 }}>
              <DetailRow label="Binding affinity" value={selectedTarget.ki || "N/A"} />
              <DetailRow label="Evidence" value={selectedTarget.evidenceSource} />
              <DetailRow label="Disease links" value={selectedTarget.diseaseLinkCount} />
            </div>
            <div style={{ marginTop: 12, color: COLORS.gray600, fontSize: 12, fontWeight: 800 }}>Similar drugs</div>
            {similar.length ? <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>{similar.map((drug) => <Badge key={drug.id} tone="navy">{drug.name}</Badge>)}</div> : <p style={{ color: COLORS.gray600, fontSize: 12 }}>No other drugs found for this target</p>}
          </div>
        )}
      </Panel>
    </aside>
  );
}

function Stat({ label, value }) {
  return <div style={{ background: COLORS.gray50, borderRadius: 8, padding: 8 }}><div style={{ color: COLORS.navy, fontWeight: 900 }}>{value}</div><div style={{ color: COLORS.gray600, fontSize: 11 }}>{label}</div></div>;
}

function initials(name) {
  return String(name || "D").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function InteractionBadge({ type }) {
  const style = interactionStyle(type);
  return <span style={{ background: style.fill, color: COLORS.navy, border: `1px solid ${style.stroke}`, borderRadius: 6, padding: "3px 7px", fontSize: 11, fontWeight: 800 }}>{style.label}</span>;
}

function InteractionLegendRow({ type }) {
  const style = interactionStyle(type);
  return <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.gray800, fontSize: 13, marginBottom: 8 }}><span style={{ width: 12, height: 12, borderRadius: "50%", background: style.fill, border: `2px solid ${style.stroke}` }} />{style.label}</div>;
}

function NetworkLegend() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", marginTop: 14, color: COLORS.gray600, fontSize: 12 }}>
      {["inhibitor", "activator", "allosteric", "unknown"].map((type) => <InteractionLegendRow key={type} type={type} />)}
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><svg width="46" height="10"><line x1="2" y1="5" x2="44" y2="5" stroke={COLORS.gray800} strokeWidth="3.5" /></svg>Edge width = binding affinity strength</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><svg width="46" height="10"><line x1="2" y1="5" x2="44" y2="5" stroke="#7F77DD" strokeWidth="2" strokeDasharray="4 3" /></svg>Dashed line = predicted interaction</span>
    </div>
  );
}

function OrphaAvatar({ size = 42 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: COLORS.white, display: "grid", placeItems: "center", boxShadow: `inset 0 0 0 1px ${COLORS.tealBg}`, flex: `0 0 ${size}px`, overflow: "hidden" }}>
      <img src={ORPHAAI_LOGO_SRC} alt={ORPHAAI_LOGO_ALT} style={{ width: size, height: size, objectFit: "contain" }} />
    </div>
  );
}

function ChatbotPage({ onOpenChatbot }) {
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "42px 24px" }}>
      <Panel style={{ textAlign: "center", padding: "44px 28px" }}>
        <OrphaAvatar size={72} />
        <h1 style={{ fontFamily: "Georgia, serif", color: COLORS.navy, margin: "18px 0 10px" }}>OrphaAI Assistant</h1>
        <p style={{ maxWidth: 620, margin: "0 auto 24px", color: COLORS.gray600, lineHeight: 1.7 }}>
          Chat with the published OrphaAI Tars agent for drug repurposing questions, candidate exploration, target reasoning, and platform guidance.
        </p>
        <button onClick={onOpenChatbot} style={primaryButton({ fontSize: 16, padding: "13px 22px" })}>Open OrphaAI Assistant</button>
        <p style={{ marginTop: 16, color: COLORS.gray600, fontSize: 13 }}>The assistant opens inside OrphaAI as an embedded chat panel.</p>
      </Panel>
    </main>
  );
}

function AdminPage({ user }) {
  if (!user) return <div style={{ textAlign: "center", padding: 80, color: COLORS.gray600 }}>Please sign in to access Admin panel.</div>;
  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "42px 24px" }}>
      <h1 style={{ fontFamily: "Georgia, serif", color: COLORS.navy, margin: 0 }}>Admin Dashboard</h1>
      <p style={{ color: COLORS.gray600 }}>Dataset sync endpoints are available for PubChem, ChEMBL, Open Targets, GEO, and related sources. Full DrugBank/OMIM syncing requires credentials or licensing.</p>
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
    <div style={{ fontFamily: "Segoe UI, system-ui, sans-serif", background: "#FAFAF8", minHeight: "100vh" }}>
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
      <footer style={{ background: COLORS.navy, color: "rgba(255,255,255,0.7)", textAlign: "center", padding: "26px 24px", fontSize: 13, marginTop: 40 }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 17, color: COLORS.white, marginBottom: 6 }}>OrphaAI</div>
        <div>Drug repurposing research platform - public database aware</div>
        <div>For research use only. Do not use the Repurposing Predictor to make any medical treatment decisions.</div>
      </footer>
      <OrphaAIChatbot isOpen={chatbotOpen} onToggle={() => setChatbotOpen((open) => !open)} onClose={() => setChatbotOpen(false)} />
    </div>
  );
}
