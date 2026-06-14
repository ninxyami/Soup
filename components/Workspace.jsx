"use client";
// @ts-nocheck
// components/Workspace.jsx
//
// THE single collaborative workspace surface. One implementation, used by BOTH
// the admin panel ("Workspace" tab) and the standalone /workspace page, so the
// two can never diverge again. Previously these were two separate files (a full
// admin version + a stripped picker) which drifted: one lost the Save toolbar,
// the other lost "new document". Now there is exactly one.
//
// Props:
//   me    — { id, name, color, initials }  resolved identity (each host supplies
//           it after its own auth gate). REQUIRED for the live editors.
//   toast — optional (msg, type) => void   for success/error notifications.
//   fillViewport — when true, the surface fills 100% of its parent's height
//           (standalone page, which gives it 100vh). When false/omitted it uses
//           a self-contained 78vh box (admin panel, whose <main> scrolls).
//
// Left rail: SERVER CONFIG (live ini/sandbox co-edit) + PROJECTS → DOCUMENTS.
// Right: the live editor (TipTap+Yjs doc / sheet / board / raw-config).
// Persistence + realtime are server-side (routers/workspace.py); this component
// only does project/doc CRUD (REST) and mounts the right editor.

import { useState, useEffect, useCallback, useRef, Component } from "react";
import dynamic from "next/dynamic";

const API = "https://api.stateofundeadpurge.site:8443";

// Roster used to colour project rails / fallbacks (identity itself comes via `me`).
const ADMINS = {
  228533264174940160: { name: "Nin Nin",   color: "#c8a84b", initials: "NN" },
  698164264950693950: { name: "Nikki",     color: "#4a8fc4", initials: "NK" },
  925854911378370600: { name: "Dawnie",    color: "#9775cc", initials: "DW" },
  805074936807948298: { name: "Sheo",      color: "#4caf7d", initials: "SH" },
  1076244823121612850:{ name: "Queen Sheo",color: "#e05555", initials: "QS" },
};

// ── REST helpers (credentialed, same cookie session both hosts use) ──
const fetchApi = async (path, opts = {}) => {
  const r = await fetch(`${API}${path}`, { credentials: "include", ...opts });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const ct = r.headers.get("content-type") || "";
  return ct.includes("application/json") ? r.json() : {};
};
const postApi = (path, body) =>
  fetchApi(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });

// Editors must never SSR (Yjs touches window). Load client-only.
const loadingBox = (label) => () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
    <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", letterSpacing: 2, animation: "ap-blink 1.2s infinite" }}>
      {label}
    </span>
  </div>
);
const CollabEditor = dynamic(() => import("@/components/CollabEditor"), { ssr: false, loading: loadingBox("LOADING EDITOR…") });
const SheetEditor  = dynamic(() => import("@/components/SheetEditor"),  { ssr: false, loading: loadingBox("LOADING SPREADSHEET…") });
const BoardEditor  = dynamic(() => import("@/components/BoardEditor"),  { ssr: false, loading: loadingBox("LOADING BOARD…") });
const ConfigEditor = dynamic(() => import("@/components/ConfigEditor"), { ssr: false, loading: loadingBox("LOADING EDITOR…") });

// Whitelisted config files the editor can open (mirrors backend EDITABLE_FILES).
const CONFIG_FILES = [
  { key: "servertest.ini",              label: "servertest.ini",      icon: "⚙" },
  { key: "servertest_SandboxVars.lua",  label: "SandboxVars.lua",     icon: "🧬" },
];

const PROJECT_KINDS = [
  { id: "game",      label: "Game",      icon: "🎮" },
  { id: "donations", label: "Donations", icon: "💖" },
  { id: "event",     label: "Event",     icon: "🎯" },
  { id: "general",   label: "General",   icon: "📁" },
];

const isSheetDoc = (doc) =>
  doc?.kind === "sheet" || doc?.type === "sheet" || doc?.seed === "sheet" || doc?.icon === "▦";
const isBoardDoc = (doc) =>
  doc?.kind === "board" || doc?.type === "board" || doc?.seed === "board" || doc?.icon === "▤";

// epoch-seconds → "3m", "2h", "4d" (server stores BIGINT epoch seconds)
const relTime = (epoch) => {
  if (!epoch) return "";
  const s = Math.max(0, Math.floor(Date.now() / 1000 - Number(epoch)));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); return `${d}d ago`;
};
// age in days, for escalating badge intensity
const ageDays = (epoch) => {
  if (!epoch) return 0;
  return (Date.now() / 1000 - Number(epoch)) / 86400;
};

export default function Workspace({ me, toast, fillViewport = false }) {
  const [projects, setProjects] = useState([]);
  const [docsByProject, setDocsByProject] = useState({}); // pid -> [docs]
  const [expanded, setExpanded] = useState({});           // pid -> bool
  const [activeDoc, setActiveDoc] = useState(null);       // {id, title, project_id}
  const [activeConfig, setActiveConfig] = useState(null); // {key,label} or null
  const [loading, setLoading] = useState(true);

  // modals
  const [newProjOpen, setNewProjOpen] = useState(false);
  const [newProj, setNewProj] = useState({ name: "", kind: "game" });
  const [newDocFor, setNewDocFor] = useState(null);       // pid or null
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocType, setNewDocType] = useState("doc");    // "doc" | "sheet" | "board"

  // drag-to-reorder
  const dragDoc = useRef(null);   // { pid, index }
  const [dragOver, setDragOver] = useState(null); // { pid, index } drop target

  // ── unread notifications (Feature 1) ──
  // unread.docs: per-doc { document_id, unread, last_editor_name, current_version, updated_at }
  const [unread, setUnread] = useState({ docs: [], unread_count: 0, per_project: {} });
  const unreadByDoc = {};
  (unread.docs || []).forEach((d) => { unreadByDoc[d.document_id] = d; });

  const loadUnread = useCallback(async () => {
    try {
      const d = await fetchApi(`/api/workspace/unread`);
      setUnread(d || { docs: [], unread_count: 0, per_project: {} });
    } catch (e) { /* non-fatal: badges just won't show */ }
  }, []);

  // ── changes/history panel (Feature 2) ──
  const [changesOpen, setChangesOpen] = useState(false);
  const [changes, setChanges] = useState([]);
  const [changesLoading, setChangesLoading] = useState(false);

  const loadChanges = useCallback(async (docId) => {
    if (!docId) return;
    setChangesLoading(true);
    try {
      const d = await fetchApi(`/api/workspace/documents/${docId}/changes?limit=100`);
      setChanges(d.changes || []);
    } catch (e) {
      setChanges([]);
    } finally {
      setChangesLoading(false);
    }
  }, []);

  // ── versions / rollback panel ──
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState(null);

  const loadVersions = useCallback(async (docId) => {
    if (!docId) return;
    setVersionsLoading(true);
    try {
      const d = await fetchApi(`/api/workspace/documents/${docId}/versions`);
      setVersions(d.versions || []);
    } catch (e) {
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  const restoreVersion = useCallback(async (docId, versionId) => {
    if (!docId || !versionId) return;
    setRestoringId(versionId);
    try {
      const d = await postApi(`/api/workspace/documents/${docId}/versions/${versionId}/restore`, {});
      toast?.(
        d.live_push
          ? "Restored — open editors updated live."
          : "Restored. Reopen the document to see it.",
        "success"
      );
      // refresh the version list (a pre_restore snapshot was just added)
      loadVersions(docId);
    } catch (e) {
      toast?.(`Restore failed: ${e.message}`, "error");
    } finally {
      setRestoringId(null);
    }
  }, [toast, loadVersions]);

  // mark a doc seen (auto, on open) + refresh unread badges
  const markSeen = useCallback(async (docId) => {
    if (!docId) return;
    try { await postApi(`/api/workspace/documents/${docId}/seen`, {}); } catch (e) {}
    loadUnread();
  }, [loadUnread]);

  // ── load projects ──
  const loadProjects = useCallback(async () => {
    try {
      const d = await fetchApi(`/api/workspace/projects`);
      setProjects(d.projects || []);
    } catch (e) {
      toast?.(`Failed to load projects: ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Load unread state on mount and refresh every 45s so badges stay current
  // as other admins edit. Lightweight (one indexed query).
  useEffect(() => {
    loadUnread();
    const t = setInterval(loadUnread, 45000);
    return () => clearInterval(t);
  }, [loadUnread]);

  const loadDocs = useCallback(async (pid) => {
    try {
      const d = await fetchApi(`/api/workspace/projects/${pid}/documents`);
      setDocsByProject((prev) => ({ ...prev, [pid]: d.documents || [] }));
    } catch (e) {
      toast?.(`Failed to load documents: ${e.message}`, "error");
    }
  }, [toast]);

  const toggleProject = (pid) => {
    setExpanded((prev) => {
      const next = { ...prev, [pid]: !prev[pid] };
      if (next[pid] && !docsByProject[pid]) loadDocs(pid);
      return next;
    });
  };

  // ── drag-to-reorder handlers ──
  const onDragStart = (pid, index) => {
    dragDoc.current = { pid, index };
  };
  const onDragEnter = (pid, index) => {
    if (!dragDoc.current || dragDoc.current.pid !== pid) return;
    if (dragDoc.current.index === index) { setDragOver(null); return; }
    setDragOver({ pid, index });
  };
  const onDrop = (pid) => {
    if (!dragDoc.current || dragDoc.current.pid !== pid) return;
    const { index: from } = dragDoc.current;
    const to = dragOver?.index;
    if (to == null || from === to) { dragDoc.current = null; setDragOver(null); return; }
    setDocsByProject((prev) => {
      const docs = [...(prev[pid] || [])];
      const [moved] = docs.splice(from, 1);
      docs.splice(to, 0, moved);
      return { ...prev, [pid]: docs };
    });
    dragDoc.current = null;
    setDragOver(null);
  };
  const onDragEnd = () => { dragDoc.current = null; setDragOver(null); };

  // ── create project ──
  const createProject = async () => {
    if (!newProj.name.trim()) return;
    try {
      const d = await postApi(`/api/workspace/projects`, { name: newProj.name.trim(), kind: newProj.kind });
      toast?.("Project created", "success");
      setNewProjOpen(false);
      setNewProj({ name: "", kind: "game" });
      await loadProjects();
      setExpanded((p) => ({ ...p, [d.id]: true }));
      loadDocs(d.id);
    } catch (e) {
      toast?.(`Create failed: ${e.message}`, "error");
    }
  };

  // ── delete document (with confirm) ──
  const deleteDoc = async (doc, pid) => {
    if (!doc?.id) return;
    if (!window.confirm(`Delete "${doc.title}"? This can't be undone.`)) return;
    const routes = [
      `/api/workspace/documents/${doc.id}`,
      `/api/workspace/projects/${pid}/documents/${doc.id}`,
    ];
    let ok = false, lastErr = null;
    for (const r of routes) {
      try { await fetchApi(r, { method: "DELETE" }); ok = true; break; }
      catch (e) { lastErr = e; }
    }
    if (ok) {
      toast?.("Document deleted", "success");
      if (activeDoc?.id === doc.id) setActiveDoc(null);
      await loadDocs(pid);
    } else {
      toast?.(`Delete failed: ${lastErr?.message || "unknown"}`, "error");
    }
  };

  // ── create document ──
  const createDoc = async () => {
    if (!newDocTitle.trim() || !newDocFor) return;
    try {
      const d = await postApi(`/api/workspace/projects/${newDocFor}/documents`, {
        title: newDocTitle.trim(),
        kind: newDocType,
        icon: newDocType === "sheet" ? "▦" : newDocType === "board" ? "▤" : "📄",
      });
      toast?.("Document created", "success");
      const pid = newDocFor;
      const seed = newDocType;
      setNewDocFor(null);
      setNewDocTitle("");
      setNewDocType("doc");
      await loadDocs(pid);
      setActiveDoc({ id: d.id, title: newDocTitle.trim(), project_id: pid, seed });
    } catch (e) {
      toast?.(`Create failed: ${e.message}`, "error");
    }
  };

  // When a document becomes active: mark it seen (clears its NEW badge for me)
  // and load its change history. Opening the doc IS the acknowledgment — no button.
  useEffect(() => {
    if (activeDoc?.id) {
      markSeen(activeDoc.id);
      if (changesOpen) loadChanges(activeDoc.id);
      if (versionsOpen) loadVersions(activeDoc.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDoc?.id]);

  // If the user opens the changes panel while a doc is active, load on demand.
  useEffect(() => {
    if (changesOpen && activeDoc?.id) loadChanges(activeDoc.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changesOpen]);

  // Same for the versions panel.
  useEffect(() => {
    if (versionsOpen && activeDoc?.id) loadVersions(activeDoc.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionsOpen]);

  const kindMeta = (k) => PROJECT_KINDS.find((x) => x.id === k) || PROJECT_KINDS[3];

  // Outer height: standalone page gives a 100vh parent → fill it; admin <main>
  // scrolls, so use a self-contained tall box. Either way the grid below gets a
  // DEFINITE height so the editor's sticky Save toolbar can anchor (this was the
  // bug — an unsized parent collapsed the toolbar off-screen).
  const outerStyle = fillViewport
    ? { height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }
    : {};
  const gridStyle = fillViewport
    ? {
        display: "grid", gridTemplateColumns: "260px minmax(0, 1fr)", gap: 0,
        border: "1px solid var(--border)", background: "var(--surface)",
        height: "100%", minHeight: 0, overflow: "hidden",
      }
    : {
        display: "grid", gridTemplateColumns: "260px minmax(0, 1fr)", gap: 0,
        border: "1px solid var(--border)", background: "var(--surface)",
        height: "78vh", minHeight: "72vh", overflow: "hidden",
      };

  return (
    <div style={outerStyle}>
      <style dangerouslySetInnerHTML={{ __html: `
        .ws-doc-row:hover .ws-doc-del { opacity: 1 !important; }
        .ws-doc-row:hover .ws-drag-handle { opacity: 1 !important; }
        .ws-doc-row:hover { background: rgba(255,255,255,0.02); }
        @keyframes ap-blink { 0%,100% { opacity: .3 } 50% { opacity: 1 } }
        @keyframes ws-newpulse { 0%,100% { opacity: 1 } 50% { opacity: .55 } }
        .wsx-inp {
          width: 100%; box-sizing: border-box; padding: 9px 12px;
          background: var(--bg, #080a0c); border: 1px solid var(--border, #1e2530);
          color: var(--text, #c8cdd6); font-family: var(--mono, monospace); font-size: 13px;
          outline: none; border-radius: 2px;
        }
        .wsx-inp:focus { border-color: var(--accent, #c8a84b); }
        .wsx-ft {
          border: 1px solid var(--border, #1e2530); background: transparent;
          color: var(--textdim, #6b7280); font-family: var(--mono, monospace);
          font-size: 12px; cursor: pointer; border-radius: 2px;
        }
      ` }} />

      {activeConfig && me ? (
        // Config files open as a full-pane takeover — the SAME dedicated
        // full-height layout the original /workspace used (where the Save
        // toolbar always worked). Not crammed into the grid cell beside the
        // sidebar, which is the layout that never showed the toolbar.
        <div style={{ height: "100%", minHeight: fillViewport ? 0 : "72vh", display: "flex", flexDirection: "column", border: "1px solid var(--border)", background: "var(--surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0 }}>
            <button
              onClick={() => setActiveConfig(null)}
              style={{ background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}
            >← projects</button>
            <span style={{ fontFamily: "var(--display)", fontSize: 20, letterSpacing: 1.5, color: "var(--accent)" }}>{activeConfig.label}</span>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <EditorBoundary key={`cfg:${activeConfig.key}`}>
              <ConfigEditor fileKey={activeConfig.key} fileLabel={activeConfig.label} me={me} />
            </EditorBoundary>
          </div>
        </div>
      ) : (
      <div style={gridStyle}>
        {/* ── LEFT RAIL ── */}
        <div style={{ borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* SERVER CONFIG — live co-edit of the raw ini / sandbox files */}
          <div style={{ borderBottom: "1px solid var(--border)" }}>
            <div style={{ padding: "12px 14px 8px" }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 2, color: "var(--textdim)", textTransform: "uppercase" }}>
                Server Config
              </span>
            </div>
            <div style={{ paddingBottom: 6 }}>
              {CONFIG_FILES.map((f) => {
                const active = activeConfig?.key === f.key;
                return (
                  <div
                    key={f.key}
                    onClick={() => { setActiveConfig(f); setActiveDoc(null); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "7px 14px",
                      cursor: "pointer", fontFamily: "var(--mono)", fontSize: 12,
                      color: active ? "var(--accent)" : "var(--textdim)",
                      background: active ? "rgba(200,168,75,0.06)" : "transparent",
                      borderLeft: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                    }}
                  >
                    <span style={{ fontSize: 12 }}>{f.icon}</span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{
            padding: "12px 14px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 2, color: "var(--textdim)", textTransform: "uppercase", flex: 1 }}>
              Projects
            </span>
            <button
              onClick={() => setNewProjOpen(true)}
              title="New project"
              style={{
                width: 24, height: 24, border: "1px solid var(--border)", background: "transparent",
                color: "var(--accent)", cursor: "pointer", borderRadius: 2, fontSize: 16, lineHeight: 1,
              }}
            >+</button>
          </div>

          <div style={{ overflowY: "auto", flex: 1, padding: "6px 0" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", letterSpacing: 2, animation: "ap-blink 1.2s infinite" }}>LOADING…</span>
              </div>
            ) : projects.length === 0 ? (
              <div style={{ padding: "20px 16px", fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", lineHeight: 1.7 }}>
                No projects yet.<br />Create one to start planning.
              </div>
            ) : (
              projects.map((p) => {
                const km = kindMeta(p.kind);
                const isOpen = !!expanded[p.id];
                const docs = docsByProject[p.id] || [];
                return (
                  <div key={p.id}>
                    <div
                      onClick={() => toggleProject(p.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                        cursor: "pointer", fontFamily: "var(--mono)", fontSize: 12, color: "var(--text)",
                        borderLeft: `2px solid ${isOpen ? (p.color || "var(--accent)") : "transparent"}`,
                        background: isOpen ? "rgba(255,255,255,0.02)" : "transparent",
                      }}
                    >
                      <span style={{ fontSize: 10, color: "var(--muted)", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .12s" }}>▶</span>
                      <span style={{ fontSize: 13 }}>{km.icon}</span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                      {(unread.per_project?.[p.id] > 0) && (
                        <span title={`${unread.per_project[p.id]} unread`} style={{
                          minWidth: 16, height: 16, padding: "0 5px", borderRadius: 8,
                          background: "var(--accent)", color: "#0b0d10", fontFamily: "var(--mono)",
                          fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center",
                          justifyContent: "center", lineHeight: 1, flexShrink: 0,
                        }}>{unread.per_project[p.id]}</span>
                      )}
                      <span style={{ fontSize: 9, color: "var(--muted)" }}>{docs.length || ""}</span>
                    </div>

                    {isOpen && (
                      <div style={{ paddingBottom: 4 }}>
                        {docs.map((doc, docIdx) => {
                          const active = activeDoc?.id === doc.id;
                          const isDragTarget = dragOver?.pid === p.id && dragOver?.index === docIdx;
                          return (
                            <div
                              key={doc.id}
                              className="ws-doc-row"
                              draggable
                              onDragStart={() => onDragStart(p.id, docIdx)}
                              onDragEnter={() => onDragEnter(p.id, docIdx)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => onDrop(p.id)}
                              onDragEnd={onDragEnd}
                              onClick={() => { setActiveDoc({ id: doc.id, title: doc.title, project_id: p.id, kind: doc.kind, type: doc.type, icon: doc.icon }); setActiveConfig(null); }}
                              style={{
                                display: "flex", alignItems: "center", gap: 8, padding: "6px 14px 6px 28px",
                                cursor: "pointer", fontFamily: "var(--body)", fontSize: 12.5,
                                color: active ? "var(--accent)" : "var(--textdim)",
                                background: isDragTarget ? "rgba(200,168,75,0.08)" : active ? "rgba(200,168,75,0.06)" : "transparent",
                                borderLeft: `2px solid ${isDragTarget ? "var(--accent)" : active ? "var(--accent)" : "transparent"}`,
                                borderTop: isDragTarget ? "1px solid rgba(200,168,75,0.4)" : "1px solid transparent",
                                transition: "border-color .1s, background .1s",
                              }}
                            >
                              <span
                                className="ws-drag-handle"
                                onMouseDown={(e) => e.stopPropagation()}
                                style={{ fontSize: 9, color: "var(--muted)", opacity: 0, cursor: "grab", flexShrink: 0, lineHeight: 1, userSelect: "none" }}
                              >⠿</span>
                              <span style={{ fontSize: 11, opacity: 0.7, flexShrink: 0 }}>{doc.icon || "📄"}</span>
                              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                                <span style={{
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                  fontWeight: unreadByDoc[doc.id]?.unread ? 700 : 400,
                                  color: unreadByDoc[doc.id]?.unread && !active ? "var(--text)" : "inherit",
                                }}>{doc.title}</span>
                                {unreadByDoc[doc.id]?.unread && (
                                  <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {unreadByDoc[doc.id]?.last_editor_name || "someone"} · {relTime(unreadByDoc[doc.id]?.updated_at)}
                                  </span>
                                )}
                              </span>
                              {unreadByDoc[doc.id]?.unread && (() => {
                                const d = ageDays(unreadByDoc[doc.id]?.updated_at);
                                // escalate: fresh = soft accent; older = hotter + pulse
                                const hot = d >= 2;
                                return (
                                  <span title={`NEW — edited by ${unreadByDoc[doc.id]?.last_editor_name || "someone"} ${relTime(unreadByDoc[doc.id]?.updated_at)}`} style={{
                                    flexShrink: 0, fontFamily: "var(--mono)", fontSize: 8.5, fontWeight: 800,
                                    letterSpacing: 0.5, padding: "1px 5px", borderRadius: 3,
                                    color: "#0b0d10",
                                    background: hot ? "var(--red, #e05555)" : "var(--accent)",
                                    boxShadow: hot ? "0 0 8px rgba(224,85,85,0.5)" : "0 0 6px rgba(200,168,75,0.35)",
                                    animation: hot ? "ws-newpulse 1.6s ease-in-out infinite" : "none",
                                  }}>NEW</span>
                                );
                              })()}
                              <button
                                className="ws-doc-del"
                                title="Delete document"
                                onClick={(e) => { e.stopPropagation(); deleteDoc(doc, p.id); }}
                                style={{
                                  background: "transparent", border: "none", cursor: "pointer",
                                  color: "var(--muted)", fontSize: 13, lineHeight: 1, padding: "2px 4px",
                                  borderRadius: 2, opacity: 0, transition: "opacity .12s, color .12s",
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--red)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; }}
                              >✕</button>
                            </div>
                          );
                        })}
                        <div
                          onClick={() => { setNewDocFor(p.id); setNewDocTitle(""); }}
                          style={{
                            padding: "6px 14px 6px 34px", cursor: "pointer", fontFamily: "var(--mono)",
                            fontSize: 11, color: "var(--muted)", letterSpacing: 0.5,
                          }}
                        >+ new document</div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── EDITOR PANE (documents/sheets/boards; config handled above) ── */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
          {activeDoc && me ? (
            <>
              <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "var(--display)", fontSize: 22, letterSpacing: 1.5, color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {activeDoc.title}
                </span>
                <button
                  onClick={() => { setChangesOpen((v) => !v); setVersionsOpen(false); }}
                  title="See who changed what"
                  className="wsx-ft"
                  style={{
                    padding: "5px 10px", fontFamily: "var(--mono)", fontSize: 11,
                    color: changesOpen ? "var(--accent)" : "var(--textdim)",
                    borderColor: changesOpen ? "var(--accent)" : "var(--border)",
                    display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                  }}
                >🕓 Changes</button>
                <button
                  onClick={() => { setVersionsOpen((v) => !v); setChangesOpen(false); }}
                  title="Browse & restore previous versions"
                  className="wsx-ft"
                  style={{
                    padding: "5px 10px", fontFamily: "var(--mono)", fontSize: 11,
                    color: versionsOpen ? "var(--accent)" : "var(--textdim)",
                    borderColor: versionsOpen ? "var(--accent)" : "var(--border)",
                    display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                  }}
                >🗂 Versions</button>
              </div>
              <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <EditorBoundary key={`doc:${activeDoc.id}`}>
                    {isBoardDoc(activeDoc) ? (
                      <BoardEditor docId={activeDoc.id} me={me} admins={Object.entries(ADMINS).map(([id, a]) => ({ id, ...a }))} />
                    ) : isSheetDoc(activeDoc) ? (
                      <SheetEditor docId={activeDoc.id} me={me} />
                    ) : (
                      <CollabEditor docId={activeDoc.id} docTitle={activeDoc.title} me={me} seed={activeDoc.seed} />
                    )}
                  </EditorBoundary>
                </div>
                {changesOpen && (
                  <ChangesPanel
                    changes={changes}
                    loading={changesLoading}
                    onRefresh={() => loadChanges(activeDoc.id)}
                    onClose={() => setChangesOpen(false)}
                  />
                )}
                {versionsOpen && (
                  <VersionsPanel
                    versions={versions}
                    loading={versionsLoading}
                    restoringId={restoringId}
                    onRestore={(vid) => restoreVersion(activeDoc.id, vid)}
                    onRefresh={() => loadVersions(activeDoc.id)}
                    onClose={() => setVersionsOpen(false)}
                  />
                )}
              </div>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 14, padding: 40, textAlign: "center" }}>
              <div style={{ fontFamily: "var(--display)", fontSize: 40, letterSpacing: 4, color: "var(--accent)", textShadow: "0 0 30px rgba(200,168,75,0.25)" }}>
                ⌬
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", letterSpacing: 1, lineHeight: 1.8, maxWidth: 360 }}>
                {projects.length === 0
                  ? "Open a config file or create a project on the left, add a document, and start planning together — live."
                  : "Pick a document or a config file from the left to open it."}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ── NEW PROJECT MODAL ── */}
      {newProjOpen && (
        <Modal title="New Project" onClose={() => setNewProjOpen(false)}>
          <Field label="Name">
            <input
              className="wsx-inp" autoFocus value={newProj.name}
              onChange={(e) => setNewProj((p) => ({ ...p, name: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && createProject()}
              placeholder="e.g. Zomboid — Season 2"
            />
          </Field>
          <Field label="Kind">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PROJECT_KINDS.map((k) => (
                <button
                  key={k.id}
                  onClick={() => setNewProj((p) => ({ ...p, kind: k.id }))}
                  className="wsx-ft"
                  style={{
                    borderColor: newProj.kind === k.id ? "var(--accent)" : "var(--border)",
                    color: newProj.kind === k.id ? "var(--accent)" : "var(--textdim)",
                    background: newProj.kind === k.id ? "rgba(200,168,75,0.05)" : "transparent",
                    padding: "6px 12px",
                  }}
                >{k.icon} {k.label}</button>
              ))}
            </div>
          </Field>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <ModalBtn c="gold" onClick={createProject}>Create</ModalBtn>
            <ModalBtn c="ghost" onClick={() => setNewProjOpen(false)}>Cancel</ModalBtn>
          </div>
        </Modal>
      )}

      {/* ── NEW DOCUMENT MODAL ── */}
      {newDocFor && (
        <Modal title="New Document" onClose={() => setNewDocFor(null)}>
          <Field label="Type">
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { id: "doc",   icon: "📄", label: "Document", sub: "Prose, headings, notes" },
                { id: "sheet", icon: "▦",  label: "Sheet",    sub: "Table / status grid" },
                { id: "board", icon: "▤",  label: "Board",    sub: "Kanban · planner" },
              ].map((t) => {
                const on = newDocType === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setNewDocType(t.id)}
                    style={{
                      flex: 1, textAlign: "left", padding: "10px 12px", cursor: "pointer",
                      borderRadius: 3, background: on ? "rgba(200,168,75,0.06)" : "transparent",
                      border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                    }}
                  >
                    <div style={{ fontSize: 16, marginBottom: 3 }}>{t.icon}</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: on ? "var(--accent)" : "var(--text)", letterSpacing: 0.5 }}>{t.label}</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--muted)", marginTop: 2 }}>{t.sub}</div>
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Title">
            <input
              className="wsx-inp" autoFocus value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createDoc()}
              placeholder={newDocType === "sheet" ? "e.g. S2 Mod List" : "e.g. Season 2 Master Plan"}
            />
          </Field>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <ModalBtn c="gold" onClick={createDoc}>Create</ModalBtn>
            <ModalBtn c="ghost" onClick={() => setNewDocFor(null)}>Cancel</ModalBtn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Catches runtime throws from the live editors so a single editor failure shows
// a readable message instead of blanking the entire workspace (and surfaces the
// actual error text for diagnosis). Keyed by file/doc so switching resets it.
class EditorBoundary extends Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error("[Workspace] editor crashed:", err, info); }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 24, fontFamily: "var(--mono)", fontSize: 12, color: "var(--red)", lineHeight: 1.7 }}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>⚠ Editor failed to load</div>
          <div style={{ color: "var(--textdim)", whiteSpace: "pre-wrap" }}>
            {String(this.state.err?.message || this.state.err)}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 1.5, color: "var(--textdim)", textTransform: "uppercase", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

// Self-contained button so the shared component has no dependency on either
// host's local <B>. Mirrors the panel's gold/ghost styles.
function ModalBtn({ c = "gold", onClick, children }) {
  const styles = c === "ghost"
    ? { background: "transparent", border: "1px solid var(--border)", color: "var(--textdim)" }
    : { background: "rgba(200,168,75,0.1)", border: "1px solid var(--accent)", color: "var(--accent)" };
  return (
    <button onClick={onClick} style={{
      ...styles, padding: "8px 18px", cursor: "pointer", fontFamily: "var(--mono)",
      fontSize: 12, letterSpacing: 1, textTransform: "uppercase",
    }}>{children}</button>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        position: "relative", background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 6, padding: "28px 26px 24px", width: "min(460px, 100%)", maxHeight: "85vh", overflowY: "auto",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 12, right: 14, background: "transparent", border: "none",
          color: "var(--textdim)", fontSize: 22, lineHeight: 1, cursor: "pointer",
        }}>×</button>
        <h3 style={{ fontFamily: "var(--display)", fontSize: 20, letterSpacing: 1.5, color: "var(--text)", margin: "0 0 20px" }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

// ── CHANGES PANEL ── the "who changed what" timeline (Feature 2).
// Reads /api/workspace/documents/{id}/changes — attributed block/cell edits.
function VersionsPanel({ versions, loading, restoringId, onRestore, onRefresh, onClose }) {
  const [confirmId, setConfirmId] = useState(null);

  const reasonMeta = (r) =>
    r === "session_end" ? { label: "session end", c: "var(--textdim)" }
    : r === "pre_restore" ? { label: "before restore", c: "#c89a6b" }
    : r === "manual" ? { label: "manual", c: "var(--accent)" }
    : { label: "auto", c: "var(--textdim)" };

  const prettySize = (n) => {
    if (!n && n !== 0) return "";
    if (n < 1024) return `${n} B`;
    return `${(n / 1024).toFixed(1)} KB`;
  };

  return (
    <div style={{
      width: 320, flexShrink: 0, borderLeft: "1px solid var(--border)",
      background: "var(--bg, #0b0d10)", display: "flex", flexDirection: "column", minHeight: 0,
    }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 2, color: "var(--textdim)", textTransform: "uppercase", flex: 1 }}>
          Version History
        </span>
        <button onClick={onRefresh} title="Refresh" className="wsx-ft" style={{ padding: "3px 8px", fontSize: 11, color: "var(--textdim)" }}>↻</button>
        <button onClick={onClose} title="Close" style={{ background: "transparent", border: "none", color: "var(--textdim)", fontSize: 18, lineHeight: 1, cursor: "pointer" }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 30 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", letterSpacing: 2, animation: "ap-blink 1.2s infinite" }}>LOADING…</span>
          </div>
        ) : (versions || []).length === 0 ? (
          <div style={{ padding: "20px 18px", fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", lineHeight: 1.7 }}>
            No snapshots yet.<br />Versions are captured automatically as the document is edited, and when an editing session ends.
          </div>
        ) : (
          (versions || []).map((v, i) => {
            const rm = reasonMeta(v.reason);
            const isLatest = i === 0;
            const busy = restoringId === v.id;
            return (
              <div key={v.id} style={{ padding: "9px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--text)", fontWeight: 600 }}>
                    {relTime(v.created_at)}
                  </span>
                  {isLatest && (
                    <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "#4caf7d", border: "1px solid #2e5b44", borderRadius: 3, padding: "0 4px", letterSpacing: 0.5 }}>NEWEST</span>
                  )}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: rm.c, textTransform: "uppercase", letterSpacing: 0.5 }}>{rm.label}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--muted)" }}>
                  <span>{v.actor_name || v.actor_id || "unknown"}</span>
                  <span>·</span>
                  <span>{prettySize(v.byte_len)}</span>
                  {v.ydoc_version != null && (<><span>·</span><span>v{v.ydoc_version}</span></>)}
                  <span style={{ flex: 1 }} />
                  {confirmId === v.id ? (
                    <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      <button
                        onClick={() => { onRestore(v.id); setConfirmId(null); }}
                        disabled={busy}
                        className="wsx-ft"
                        style={{ padding: "2px 8px", fontSize: 10, color: "#e0a55a", borderColor: "#7a5a2a" }}
                      >{busy ? "…" : "Confirm"}</button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="wsx-ft"
                        style={{ padding: "2px 6px", fontSize: 10, color: "var(--textdim)" }}
                      >Cancel</button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmId(v.id)}
                      disabled={busy || isLatest}
                      title={isLatest ? "This is already the current state" : "Roll the document back to this snapshot"}
                      className="wsx-ft"
                      style={{
                        padding: "2px 8px", fontSize: 10,
                        color: isLatest ? "var(--muted)" : "var(--textdim)",
                        opacity: isLatest ? 0.5 : 1,
                        cursor: isLatest ? "default" : "pointer",
                      }}
                    >Restore</button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border)", fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--muted)", lineHeight: 1.6 }}>
        Restoring snapshots the current state first, so a rollback can be undone.
      </div>
    </div>
  );
}


function ChangesPanel({ changes, loading, onRefresh, onClose }) {
  const kindMeta = (k) =>
    k === "add" ? { c: "#4caf7d", label: "added" }
    : k === "delete" ? { c: "#e05555", label: "removed" }
    : { c: "var(--accent)", label: "edited" };

  // pretty block ref: "para[3]" → "¶ 4", "sheet:B1" → "cell B1"
  const prettyRef = (ref) => {
    if (!ref) return "";
    let m = ref.match(/para\[(\d+)\]/);
    if (m) return `¶ ${Number(m[1]) + 1}`;
    m = ref.match(/^([a-z]+):(.+)$/i);
    if (m) return `${m[1]} ${m[2]}`;
    return ref;
  };

  return (
    <div style={{
      width: 320, flexShrink: 0, borderLeft: "1px solid var(--border)",
      background: "var(--bg, #0b0d10)", display: "flex", flexDirection: "column", minHeight: 0,
    }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 2, color: "var(--textdim)", textTransform: "uppercase", flex: 1 }}>
          Recent Changes
        </span>
        <button onClick={onRefresh} title="Refresh" className="wsx-ft" style={{ padding: "3px 8px", fontSize: 11, color: "var(--textdim)" }}>↻</button>
        <button onClick={onClose} title="Close" style={{ background: "transparent", border: "none", color: "var(--textdim)", fontSize: 18, lineHeight: 1, cursor: "pointer" }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 30 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", letterSpacing: 2, animation: "ap-blink 1.2s infinite" }}>LOADING…</span>
          </div>
        ) : (changes || []).length === 0 ? (
          <div style={{ padding: "20px 18px", fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", lineHeight: 1.7 }}>
            No tracked edits yet.<br />Changes appear here as admins edit, with who changed what.
          </div>
        ) : (
          (changes || []).map((c) => {
            const km = kindMeta(c.change_kind);
            return (
              <div key={c.id} style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--text)", fontWeight: 600 }}>
                    {c.actor_name || c.actor_id}
                  </span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: km.c, textTransform: "uppercase", letterSpacing: 0.5 }}>{km.label}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--muted)" }}>{prettyRef(c.block_ref)}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--muted)" }}>{relTime(c.timestamp)}</span>
                </div>
                {(c.before_excerpt || c.after_excerpt) && (
                  <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, lineHeight: 1.5, paddingLeft: 2 }}>
                    {c.before_excerpt && (
                      <div style={{ color: "#b06b6b", textDecoration: c.change_kind === "delete" ? "line-through" : "none" }}>
                        − {c.before_excerpt}
                      </div>
                    )}
                    {c.after_excerpt && (
                      <div style={{ color: "#7db48a" }}>+ {c.after_excerpt}</div>
                    )}
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
