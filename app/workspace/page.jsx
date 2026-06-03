"use client";
// @ts-nocheck
// app/workspace/page.jsx — Standalone full-screen workspace.
//
// A dedicated, chrome-free route for opening a document in fullscreen and for
// sharing a direct link. Reuses the SAME editor + relay + auth as the admin
// tab; this is just a different frame around it.
//
// Usage:
//   /workspace                 → document picker (projects → docs)
//   /workspace?doc=<uuid>      → opens that document directly, fullscreen
//
// Auth: relies on the same soup_session cookie. The relay rejects non-admins
// at the WebSocket layer, and we also verify via /auth/me here so a non-admin
// sees a clean "not authorized" screen instead of a silently dead editor.

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";

const API = "https://api.stateofundeadpurge.site:8443";

const ADMINS = {
  228533264174940160: { name: "Nin Nin",   color: "#c8a84b", initials: "NN" },
  698164264950693950: { name: "Nikki",     color: "#4a8fc4", initials: "NK" },
  925854911378370600: { name: "Dawnie",    color: "#9775cc", initials: "DW" },
  805074936807948298: { name: "Sheo",      color: "#4caf7d", initials: "SH" },
  733259839429410847: { name: "Sunday",    color: "#d4873a", initials: "SN" },
  1076244823121612850:{ name: "Queen Sheo",color: "#e05555", initials: "QS" },
};

const CollabEditor = dynamic(() => import("@/components/CollabEditor"), {
  ssr: false,
  loading: () => (
    <Center><span style={blink}>LOADING EDITOR…</span></Center>
  ),
});

const ConfigEditor = dynamic(() => import("@/components/ConfigEditor"), {
  ssr: false,
  loading: () => (
    <Center><span style={blink}>LOADING EDITOR…</span></Center>
  ),
});

// Whitelisted config files (mirrors backend EDITABLE_FILES + the admin tab).
const CONFIG_FILES = [
  { key: "servertest.ini",             label: "servertest.ini",  icon: "⚙" },
  { key: "servertest_SandboxVars.lua", label: "SandboxVars.lua", icon: "🧬" },
];

const TOKENS = `
:root{--bg:#080a0c;--surface:#0f1318;--surface2:#141a21;--border:#1e2530;--accent:#c8a84b;--accent2:#7b3f3f;--red:#e05555;--green:#4caf7d;--blue:#4a8fc4;--orange:#d4873a;--purple:#9775cc;--muted:#4a5568;--text:#c8cdd6;--textdim:#6b7280;--mono:'Share Tech Mono',monospace;--display:'Bebas Neue',sans-serif;--body:'Inter',-apple-system,sans-serif}
@keyframes ap-blink{0%,100%{opacity:.3}50%{opacity:1}}
.wsx{font-family:var(--body);background:var(--bg);color:var(--text);min-height:100vh;font-size:14px}
.wsx::before{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px);pointer-events:none;z-index:1000}
`;

const blink = { fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", letterSpacing: 2, animation: "ap-blink 1.2s infinite" };

function Center({ children }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>{children}</div>;
}

export default function WorkspaceStandalone() {
  const [me, setMe] = useState(undefined);   // undefined=loading, null=unauthorized
  const [docId, setDocId] = useState(null);
  const [docTitle, setDocTitle] = useState("Workspace");
  const [configKey, setConfigKey] = useState(null);  // open config file by key

  // projects/docs for the picker
  const [projects, setProjects] = useState([]);
  const [docsByProject, setDocsByProject] = useState({});
  const [expanded, setExpanded] = useState({});

  // read ?doc= / ?config= from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const d = params.get("doc");
    if (d) setDocId(d);
    const c = params.get("config");
    if (c) setConfigKey(c);
  }, []);

  // auth + identity
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/auth/me`, { credentials: "include" });
        if (!r.ok) { setMe(null); return; }
        const d = await r.json();
        if (!d.is_admin) { setMe(null); return; }
        const info = ADMINS[d.discord_id] || { name: d.username || "Admin", color: "#c8a84b", initials: "AD" };
        setMe({ id: String(d.discord_id), name: info.name, color: info.color, initials: info.initials });
      } catch {
        setMe(null);
      }
    })();
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/workspace/projects`, { credentials: "include" });
      const d = await r.json();
      setProjects(d.projects || []);
    } catch {}
  }, []);

  const loadDocs = useCallback(async (pid) => {
    try {
      const r = await fetch(`${API}/api/workspace/projects/${pid}/documents`, { credentials: "include" });
      const d = await r.json();
      setDocsByProject((p) => ({ ...p, [pid]: d.documents || [] }));
    } catch {}
  }, []);

  // load picker data only when no doc is selected
  useEffect(() => { if (me && !docId) loadProjects(); }, [me, docId, loadProjects]);

  if (me === undefined) {
    return <div className="wsx"><style dangerouslySetInnerHTML={{ __html: TOKENS }} /><Center><span style={blink}>AUTHENTICATING…</span></Center></div>;
  }

  if (me === null) {
    return (
      <div className="wsx"><style dangerouslySetInnerHTML={{ __html: TOKENS }} />
        <Center>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--display)", fontSize: 40, letterSpacing: 4, color: "var(--red)" }}>ACCESS DENIED</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", marginTop: 8 }}>
              Admin login required. <a href="/admin" style={{ color: "var(--accent)" }}>Go to admin →</a>
            </div>
          </div>
        </Center>
      </div>
    );
  }

  // ── config file open: fullscreen editor ──
  if (configKey) {
    const f = CONFIG_FILES.find((x) => x.key === configKey) || { key: configKey, label: configKey };
    return (
      <div className="wsx" style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <style dangerouslySetInnerHTML={{ __html: TOKENS }} />
        <div style={{
          display: "flex", alignItems: "center", gap: 14, padding: "10px 20px",
          borderBottom: "1px solid var(--border)", background: "var(--surface)",
        }}>
          <a href="/workspace" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", textDecoration: "none" }}>← all files</a>
          <span style={{ fontFamily: "var(--display)", fontSize: 22, letterSpacing: 1.5, color: "var(--accent)" }}>{f.label}</span>
          <div style={{ flex: 1 }} />
          <a href="/admin" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", textDecoration: "none" }}>admin panel →</a>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ConfigEditor fileKey={f.key} fileLabel={f.label} me={me} />
        </div>
      </div>
    );
  }

  // ── document open: fullscreen editor ──
  if (docId) {
    return (
      <div className="wsx" style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <style dangerouslySetInnerHTML={{ __html: TOKENS }} />
        <div style={{
          display: "flex", alignItems: "center", gap: 14, padding: "10px 20px",
          borderBottom: "1px solid var(--border)", background: "var(--surface)",
        }}>
          <a href="/workspace" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", textDecoration: "none" }}>← all docs</a>
          <span style={{ fontFamily: "var(--display)", fontSize: 22, letterSpacing: 1.5, color: "var(--accent)" }}>{docTitle}</span>
          <div style={{ flex: 1 }} />
          <a href="/admin" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", textDecoration: "none" }}>admin panel →</a>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <CollabEditor docId={docId} docTitle={docTitle} me={me} />
        </div>
      </div>
    );
  }

  // ── picker: projects → docs ──
  return (
    <div className="wsx" style={{ minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: TOKENS }} />
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px 80px" }}>
        <div style={{ fontFamily: "var(--display)", fontSize: 48, letterSpacing: 5, color: "var(--accent)", textShadow: "0 0 30px rgba(200,168,75,0.25)" }}>
          WORKSPACE
        </div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", marginBottom: 36, letterSpacing: 1 }}>
          Pick a document to open fullscreen · signed in as {me.name}
        </div>

        {/* SERVER CONFIG — live co-edit of the raw ini / sandbox files */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 2, color: "var(--textdim)", textTransform: "uppercase", marginBottom: 8 }}>
            Server Config
          </div>
          <div style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
            {CONFIG_FILES.map((f, i) => (
              <a
                key={f.key}
                href={`/workspace?config=${encodeURIComponent(f.key)}`}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 18px",
                  textDecoration: "none", color: "var(--textdim)",
                  borderTop: i === 0 ? "none" : "1px solid rgba(30,37,48,0.5)",
                }}
              >
                <span style={{ fontSize: 13 }}>{f.icon}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--text)" }}>{f.label}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--green)", letterSpacing: 1 }}>LIVE</span>
              </a>
            ))}
          </div>
        </div>

        {projects.length === 0 ? (
          <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>
            No projects yet. Create one from the <a href="/admin" style={{ color: "var(--accent)" }}>admin Workspace tab</a>.
          </div>
        ) : (
          projects.map((p) => {
            const isOpen = !!expanded[p.id];
            const docs = docsByProject[p.id] || [];
            return (
              <div key={p.id} style={{ marginBottom: 8, border: "1px solid var(--border)", background: "var(--surface)" }}>
                <div
                  onClick={() => {
                    setExpanded((e) => {
                      const n = { ...e, [p.id]: !e[p.id] };
                      if (n[p.id] && !docsByProject[p.id]) loadDocs(p.id);
                      return n;
                    });
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", cursor: "pointer", borderLeft: `2px solid ${isOpen ? (p.color || "var(--accent)") : "transparent"}` }}
                >
                  <span style={{ fontSize: 11, color: "var(--muted)", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .12s" }}>▶</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--text)", flex: 1 }}>{p.name}</span>
                  <span style={{ fontSize: 10, color: "var(--muted)" }}>{docs.length || ""}</span>
                </div>
                {isOpen && (
                  <div style={{ borderTop: "1px solid var(--border)" }}>
                    {docs.length === 0 ? (
                      <div style={{ padding: "12px 18px 12px 40px", fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)" }}>No documents.</div>
                    ) : docs.map((doc) => (
                      <a
                        key={doc.id}
                        href={`/workspace?doc=${doc.id}`}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 18px 11px 40px", textDecoration: "none", color: "var(--textdim)", borderTop: "1px solid rgba(30,37,48,0.5)" }}
                      >
                        <span style={{ fontSize: 12, opacity: 0.7 }}>{doc.icon || "📄"}</span>
                        <span style={{ fontFamily: "var(--body)", fontSize: 13.5 }}>{doc.title}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
