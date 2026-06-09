"use client";
// @ts-nocheck
// app/workspace/page.jsx — Standalone full-screen workspace.
//
// Chrome-free route around the ONE shared <Workspace/> component
// (components/Workspace.jsx) — identical to the admin panel's Workspace tab.
//
// Usage:
//   /workspace                 → full workspace (projects, docs, config, create)
//   /workspace?doc=<uuid>      → opens that document directly, fullscreen (share link)
//   /workspace?config=<key>    → opens that config file directly, fullscreen
//
// Auth: same soup_session cookie. The relay rejects non-admins at the WS layer;
// we also verify via /auth/me so a non-admin sees a clean "not authorized" screen.

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Workspace from "@/components/Workspace";

const API = "https://api.stateofundeadpurge.site:8443";

const ADMINS = {
  228533264174940160: { name: "Nin Nin",   color: "#c8a84b", initials: "NN" },
  698164264950693950: { name: "Nikki",     color: "#4a8fc4", initials: "NK" },
  925854911378370600: { name: "Dawnie",    color: "#9775cc", initials: "DW" },
  805074936807948298: { name: "Sheo",      color: "#4caf7d", initials: "SH" },
  1076244823121612850:{ name: "Queen Sheo",color: "#e05555", initials: "QS" },
};

const blink = { fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", letterSpacing: 2, animation: "ap-blink 1.2s infinite" };

const TOKENS = `
:root{--bg:#080a0c;--surface:#0f1318;--surface2:#141a21;--border:#1e2530;--accent:#c8a84b;--accent2:#7b3f3f;--red:#e05555;--green:#4caf7d;--blue:#4a8fc4;--orange:#d4873a;--purple:#9775cc;--muted:#4a5568;--text:#c8cdd6;--textdim:#6b7280;--mono:'Share Tech Mono',monospace;--display:'Bebas Neue',sans-serif;--body:'Inter',-apple-system,sans-serif}
@keyframes ap-blink{0%,100%{opacity:.3}50%{opacity:1}}
.wsx{font-family:var(--body);background:var(--bg);color:var(--text);min-height:100vh;font-size:14px;overflow-x:hidden}
.wsx::before{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px);pointer-events:none;z-index:1000}
`;

// Direct-open editors (fullscreen / shareable links). Client-only (Yjs).
const Center = ({ children }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>{children}</div>
);
const CollabEditor = dynamic(() => import("@/components/CollabEditor"), { ssr: false, loading: () => <Center><span style={blink}>LOADING EDITOR…</span></Center> });
const ConfigEditor = dynamic(() => import("@/components/ConfigEditor"), { ssr: false, loading: () => <Center><span style={blink}>LOADING EDITOR…</span></Center> });
const SheetEditor  = dynamic(() => import("@/components/SheetEditor"),  { ssr: false, loading: () => <Center><span style={blink}>LOADING SPREADSHEET…</span></Center> });
const BoardEditor  = dynamic(() => import("@/components/BoardEditor"),  { ssr: false, loading: () => <Center><span style={blink}>LOADING BOARD…</span></Center> });

const CONFIG_FILES = [
  { key: "servertest.ini",             label: "servertest.ini",  icon: "⚙" },
  { key: "servertest_SandboxVars.lua", label: "SandboxVars.lua", icon: "🧬" },
];

export default function WorkspaceStandalone() {
  const [me, setMe] = useState(undefined);   // undefined=loading, null=unauthorized
  const [docId, setDocId] = useState(null);
  const [docIsSheet, setDocIsSheet] = useState(false);
  const [docIsBoard, setDocIsBoard] = useState(false);
  const [configKey, setConfigKey] = useState(null);

  // read ?doc= / ?config= / ?sheet= / ?board= from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const d = params.get("doc");
    if (d) setDocId(d);
    if (params.get("sheet") === "1") setDocIsSheet(true);
    if (params.get("board") === "1") setDocIsBoard(true);
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

  // ── config file open: fullscreen editor (shareable ?config= link) ──
  if (configKey) {
    const f = CONFIG_FILES.find((x) => x.key === configKey) || { key: configKey, label: configKey };
    return (
      <div className="wsx" style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <style dangerouslySetInnerHTML={{ __html: TOKENS }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 20px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
          <a href="/workspace" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", textDecoration: "none" }}>← workspace</a>
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

  // ── document open: fullscreen editor (shareable ?doc= link) ──
  if (docId) {
    return (
      <div className="wsx" style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <style dangerouslySetInnerHTML={{ __html: TOKENS }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 20px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
          <a href="/workspace" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", textDecoration: "none" }}>← workspace</a>
          <div style={{ flex: 1 }} />
          <a href="/admin" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", textDecoration: "none" }}>admin panel →</a>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          {docIsBoard ? (
            <BoardEditor docId={docId} me={me} admins={Object.entries(ADMINS).map(([id, a]) => ({ id, ...a }))} />
          ) : docIsSheet ? (
            <SheetEditor docId={docId} me={me} />
          ) : (
            <CollabEditor docId={docId} docTitle="Workspace" me={me} />
          )}
        </div>
      </div>
    );
  }

  // ── default: the full shared workspace (projects, docs, config, create) ──
  return (
    <div className="wsx" style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <style dangerouslySetInnerHTML={{ __html: TOKENS }} />
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 20px", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0 }}>
        <span style={{ fontFamily: "var(--display)", fontSize: 26, letterSpacing: 3, color: "var(--accent)" }}>WORKSPACE</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>signed in as {me.name}</span>
        <div style={{ flex: 1 }} />
        <a href="/admin" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", textDecoration: "none" }}>admin panel →</a>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Workspace me={me} fillViewport />
      </div>
    </div>
  );
}
