"use client";
// @ts-nocheck
// app/admin/tabs/WorkspaceTab.jsx
//
// The collaborative planning workspace, living natively inside the admin panel.
// Left rail: PROJECTS (Zomboid S2, future games, donations…) → DOCUMENTS.
// Right: the live TipTap+Yjs editor (loaded client-only via next/dynamic).
//
// Identity: we resolve the current admin from /auth/me → ADMINS roster, so
// the editor's live cursor reads the real name (Dawnie, Sheo, Nin Nin…).
//
// Persistence + realtime are handled server-side by routers/workspace.py.
// This tab only manages project/doc CRUD (REST) and mounts the editor.

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { API, fetchApi, postApi, ADMINS, Title, B, Load } from "./shared";

// Editor must never SSR (Yjs touches window). Load client-only.
const CollabEditor = dynamic(() => import("@/components/CollabEditor"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", letterSpacing: 2, animation: "ap-blink 1.2s infinite" }}>
        LOADING EDITOR…
      </span>
    </div>
  ),
});

// Spreadsheet editor (jspreadsheet-ce + Yjs). Client-only, same reason.
const SheetEditor = dynamic(() => import("@/components/SheetEditor"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", letterSpacing: 2, animation: "ap-blink 1.2s infinite" }}>
        LOADING SPREADSHEET…
      </span>
    </div>
  ),
});

// Collaborative raw-config editor (servertest.ini / SandboxVars.lua). Client-only.
const ConfigEditor = dynamic(() => import("@/components/ConfigEditor"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", letterSpacing: 2, animation: "ap-blink 1.2s infinite" }}>
        LOADING EDITOR…
      </span>
    </div>
  ),
});

// Whitelisted config files the workspace editor can open (mirrors backend EDITABLE_FILES).
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

const fmtWhen = (ts) => {
  if (!ts) return "";
  const s = Math.floor(Date.now() / 1000 - (ts > 1e12 ? ts / 1000 : ts));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// Detect a Sheet-type document. Routes on any reliable signal: explicit
// kind/type from the backend, the local seed at creation, or the sheet icon
// (▦) the create call stored — works whether or not the backend persists a
// dedicated type column.
const isSheetDoc = (doc) =>
  doc?.kind === "sheet" || doc?.type === "sheet" || doc?.seed === "sheet" || doc?.icon === "▦";

export default function WorkspaceTab({ toast }) {
  const [me, setMe] = useState(null);
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
  const [newDocType, setNewDocType] = useState("doc");    // "doc" | "sheet"

  // ── resolve current admin identity ──
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/auth/me`, { credentials: "include" });
        const d = await r.json();
        const info = ADMINS[d.discord_id] || { name: d.username || "Admin", color: "#c8a84b", initials: "AD" };
        setMe({ id: String(d.discord_id), name: info.name, color: info.color, initials: info.initials });
      } catch {
        setMe({ id: "unknown", name: "Admin", color: "#c8a84b", initials: "AD" });
      }
    })();
  }, []);

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

  // ── create document ──
  const createDoc = async () => {
    if (!newDocTitle.trim() || !newDocFor) return;
    try {
      // `kind` is sent for forward-compat; the editor also seeds a starter
      // table locally when type === "sheet" (so it works with no backend change).
      const d = await postApi(`/api/workspace/projects/${newDocFor}/documents`, {
        title: newDocTitle.trim(),
        kind: newDocType,
        icon: newDocType === "sheet" ? "▦" : "📄",
      });
      toast?.("Document created", "success");
      const pid = newDocFor;
      const seed = newDocType;
      setNewDocFor(null);
      setNewDocTitle("");
      setNewDocType("doc");
      await loadDocs(pid);
      // `seed` tells the freshly-opened editor to drop in a starter table if
      // the synced doc is still empty (new sheet). Doc type → no seed.
      setActiveDoc({ id: d.id, title: newDocTitle.trim(), project_id: pid, seed });
    } catch (e) {
      toast?.(`Create failed: ${e.message}`, "error");
    }
  };

  const kindMeta = (k) => PROJECT_KINDS.find((x) => x.id === k) || PROJECT_KINDS[3];

  return (
    <div>
      <Title t="WORKSPACE" s="Live collaborative planning — projects, documents, real-time" />

      <div style={{
        display: "grid", gridTemplateColumns: "260px 1fr", gap: 0,
        border: "1px solid var(--border)", background: "var(--surface)",
        minHeight: "72vh", overflow: "hidden",
      }}>
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
              <Load />
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
                      <span style={{ fontSize: 9, color: "var(--muted)" }}>{docs.length || ""}</span>
                    </div>

                    {isOpen && (
                      <div style={{ paddingBottom: 4 }}>
                        {docs.map((doc) => {
                          const active = activeDoc?.id === doc.id;
                          return (
                            <div
                              key={doc.id}
                              onClick={() => { setActiveDoc({ id: doc.id, title: doc.title, project_id: p.id, kind: doc.kind, type: doc.type, icon: doc.icon }); setActiveConfig(null); }}
                              style={{
                                display: "flex", alignItems: "center", gap: 8, padding: "6px 14px 6px 34px",
                                cursor: "pointer", fontFamily: "var(--body)", fontSize: 12.5,
                                color: active ? "var(--accent)" : "var(--textdim)",
                                background: active ? "rgba(200,168,75,0.06)" : "transparent",
                                borderLeft: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                              }}
                            >
                              <span style={{ fontSize: 11, opacity: 0.7 }}>{doc.icon || "📄"}</span>
                              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</span>
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

        {/* ── EDITOR PANE ── */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          {activeConfig && me ? (
            <ConfigEditor fileKey={activeConfig.key} fileLabel={activeConfig.label} me={me} />
          ) : activeDoc && me ? (
            <>
              <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "var(--display)", fontSize: 22, letterSpacing: 1.5, color: "var(--text)" }}>
                  {activeDoc.title}
                </span>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                {isSheetDoc(activeDoc) ? (
                  <SheetEditor docId={activeDoc.id} me={me} />
                ) : (
                  <CollabEditor docId={activeDoc.id} docTitle={activeDoc.title} me={me} seed={activeDoc.seed} />
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

      {/* ── NEW PROJECT MODAL ── */}
      {newProjOpen && (
        <Modal title="New Project" onClose={() => setNewProjOpen(false)}>
          <Field label="Name">
            <input
              className="ap-inp" autoFocus value={newProj.name}
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
                  className="ap-ft"
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
            <B c="gold" onClick={createProject}>Create</B>
            <B c="ghost" onClick={() => setNewProjOpen(false)}>Cancel</B>
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
              className="ap-inp" autoFocus value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createDoc()}
              placeholder={newDocType === "sheet" ? "e.g. S2 Mod List" : "e.g. Season 2 Master Plan"}
            />
          </Field>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <B c="gold" onClick={createDoc}>Create</B>
            <B c="ghost" onClick={() => setNewDocFor(null)}>Cancel</B>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="ap-fg">
      <label className="ap-fl">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="ap-mbd" onClick={onClose}>
      <div className="ap-mod" onClick={(e) => e.stopPropagation()}>
        <button className="ap-mod-x" onClick={onClose}>×</button>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}
