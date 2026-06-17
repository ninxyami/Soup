"use client";
// @ts-nocheck
// components/ConfigEditor.jsx
//
// Collaborative RAW CONFIG editor (P2.2). Client-only (Yjs cannot SSR).
// Same proven stack as CollabEditor: TipTap v2 + Yjs + y-websocket, on the
// SAME relay. Differences for config files:
//   • The surface is a single monospace CODE document — no rich formatting.
//     A .ini / .lua is plain text; rich text would corrupt it.
//   • The live doc is a DRAFT. The real file on disk is untouched until an
//     admin hits Save → backend validates syntax → writes. A broken merge
//     can never reach the running server.
//   • Live cursors show who is editing where (free, via awareness).
//   • A new config room is SEEDED once with the file's current on-disk text.
//
// Save flow: validate (backend) → write (backend) → "restart to apply".
// Applying to the live server is the admin's normal restart — NOT here.

import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { Editor, Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import CodeBlock from "@tiptap/extension-code-block";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";

const WS_BASE = "wss://api.stateofundeadpurge.site:8443/ws/workspace";
const API = "https://api.stateofundeadpurge.site:8443";

// ── INI / Lua syntax highlight via ProseMirror decorations ──────────────────
const INI_HIGHLIGHT_KEY = new PluginKey("iniHighlight");

function buildDecorations(doc) {
  const decos = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "codeBlock") return;
    const text = node.textContent;
    let offset = pos + 1;
    const lines = text.split("\n");
    let cursor = 0;
    for (const line of lines) {
      const lineStart = offset + cursor;
      const trimmed = line.trimStart();
      const indent = line.length - trimmed.length;

      if (trimmed.startsWith("#") || trimmed.startsWith(";") || trimmed.startsWith("--")) {
        decos.push(Decoration.inline(lineStart, lineStart + line.length, { class: "hl-comment" }));
      } else {
        const eqIdx = line.indexOf("=");
        if (eqIdx > 0) {
          const keyStart = lineStart;
          const keyEnd = lineStart + eqIdx;
          const valStart = lineStart + eqIdx + 1;
          const valEnd = lineStart + line.length;
          decos.push(Decoration.inline(keyStart + indent, keyEnd, { class: "hl-key" }));
          decos.push(Decoration.inline(keyEnd, keyEnd + 1, { class: "hl-eq" }));
          const val = line.slice(eqIdx + 1);
          if (val.includes(";") || val.includes(",")) {
            // Wrap each semicolon-separated segment individually so the browser
            // can only break BETWEEN segments (after the ;), never inside them.
            const sep = val.includes(";") ? ";" : ",";
            let segCursor = valStart;
            const segments = val.split(sep);
            for (let i = 0; i < segments.length; i++) {
              const seg = segments[i];
              const segEnd = segCursor + seg.length;
              decos.push(Decoration.inline(segCursor, segEnd, { class: "hl-list-seg" }));
              if (i < segments.length - 1) {
                // the separator character itself
                decos.push(Decoration.inline(segEnd, segEnd + 1, { class: "hl-list-sep" }));
              }
              segCursor = segEnd + 1; // +1 for the separator
            }
          } else if (val === "true" || val === "false") {
            decos.push(Decoration.inline(valStart, valEnd, { class: "hl-bool" }));
          } else if (!isNaN(Number(val)) && val.trim() !== "") {
            decos.push(Decoration.inline(valStart, valEnd, { class: "hl-num" }));
          } else {
            decos.push(Decoration.inline(valStart, valEnd, { class: "hl-val" }));
          }
        }
      }
      cursor += line.length + 1;
    }
  });
  return DecorationSet.create(doc, decos);
}

const IniHighlight = Extension.create({
  name: "iniHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: INI_HIGHLIGHT_KEY,
        state: {
          init(_, { doc }) { return buildDecorations(doc); },
          apply(tr, old) { return tr.docChanged ? buildDecorations(tr.doc) : old; },
        },
        props: {
          decorations(state) { return this.getState(state); },
        },
      }),
    ];
  },
});

// A document that is exactly ONE code block, holding the whole file.
// This keeps the Yjs doc plain-text and impossible to format into garbage.
const OnlyCodeDoc = Document.extend({ content: "codeBlock" });

// Stable hash of a line's text → key for per-line authorship. Content-based
// (not line-number) so attribution follows the text when lines move. Blank
// lines hash to "" and are never attributed.
const lineHash = (s) => {
  const t = (s || "").trim();
  if (!t) return "";
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
  return "L" + (h >>> 0).toString(36);
};
const fmtAgo = (ts) => {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const EDITOR_CSS = `
.cfg-surface .ProseMirror{
  outline:none; min-height:60vh; font-family:var(--mono);
  font-size:13.5px; line-height:23px; color:var(--text);
  padding:0; caret-color:var(--accent); white-space:pre-wrap; overflow-wrap:break-word; word-break:normal; tab-size:4;
}
.cfg-surface .ProseMirror:focus{outline:none}
.cfg-surface .ProseMirror pre{
  font-family:var(--mono); font-size:13.5px; line-height:23px; background:transparent;
  border:none; padding:16px 20px 140px; margin:0; overflow:visible;
  white-space:pre-wrap; overflow-wrap:break-word; word-break:normal; min-height:60vh;
}
.cfg-surface .ProseMirror pre code{
  background:none; border:none; padding:0; color:var(--text); font-family:var(--mono);
  line-height:23px; white-space:pre-wrap; overflow-wrap:break-word; word-break:normal;
}
/* ini/lua syntax highlighting */
.cfg-surface .hl-comment  { color: #5a6478; font-style: italic; }
.cfg-surface .hl-key      { color: #7eb8d4; }
.cfg-surface .hl-eq       { color: #4a5568; }
.cfg-surface .hl-list-seg { color: #c8a84b; white-space: nowrap; }
.cfg-surface .hl-list-sep { color: #c8a84b; white-space: normal; overflow-wrap: normal; }
.cfg-surface .hl-val      { color: #b8c9a3; }
.cfg-surface .hl-bool     { color: #e07b6b; }
.cfg-surface .hl-num      { color: #9b8fd4; }
/* remote collaboration cursors */
.cfg-surface .collaboration-cursor__caret{
  border-left:1.5px solid; border-right:1.5px solid; margin-left:-1px; margin-right:-1px;
  pointer-events:none; position:relative; word-break:normal;
}
.cfg-surface .collaboration-cursor__label{
  position:absolute; top:-1.5em; left:-1.5px; font-family:var(--mono); font-size:10px;
  font-weight:600; letter-spacing:0.5px; line-height:1; padding:2px 6px; border-radius:3px 3px 3px 0;
  color:#0b0d10; white-space:nowrap; user-select:none;
}
`;

export default function ConfigEditor({ fileKey, fileLabel, me }) {
  const holderRef = useRef(null);
  const editorRef = useRef(null);
  const providerRef = useRef(null);
  const ydocRef = useRef(null);
  const seededRef = useRef(false);

  const [status, setStatus] = useState("connecting"); // connecting | connected | offline
  const [peers, setPeers] = useState([]);
  const [lineCount, setLineCount] = useState(1);
  const [lineAuthors, setLineAuthors] = useState([]); // per visible line: {name,color,ts}|null
  const yAuthorsRef = useRef(null);   // Y.Map: lineHash -> {name,color,ts}
  const [blameOn, setBlameOn] = useState(true); // toggle the blame gutter
  const [loadingFile, setLoadingFile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validateMsg, setValidateMsg] = useState(null); // {ok, text}
  const [diskInfo, setDiskInfo] = useState(null);        // {synced, last_panel_write}

  // history panel
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewing, setViewing] = useState(null);          // {filename, text, created_at} | null

  // Map each visible line → its author (from the shared authorship map).
  const recomputeBlame = useCallback((lines, yAuthors) => {
    if (!yAuthors) { setLineAuthors([]); return; }
    setLineAuthors(lines.map((ln) => {
      const h = lineHash(ln);
      if (!h) return null;
      return yAuthors.get(h) || null;
    }));
  }, []);

  // ── mount the collaborative editor + seed from disk ──
  useEffect(() => {
    if (!fileKey || !holderRef.current || !me) return;
    seededRef.current = false;
    setLoadingFile(true);
    setValidateMsg(null);

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    // Per-line authorship lives in its OWN map inside the SAME Yjs doc, so the
    // relay persists it for free — no backend change. lineHash(text) -> {name,color,ts}
    const yAuthors = ydoc.getMap("lineAuthors");
    yAuthorsRef.current = yAuthors;

    // Distinct relay room per config file so they don't collide with docs.
    const roomId = `config:${fileKey}`;
    const provider = new WebsocketProvider(WS_BASE, roomId, ydoc, { connect: true });
    providerRef.current = provider;

    provider.on("status", (e) => {
      setStatus(e.status === "connected" ? "connected" : e.status === "connecting" ? "connecting" : "offline");
    });

    provider.awareness.setLocalStateField("user", {
      name: me.name, color: me.color, id: me.id, initials: me.initials,
    });

    const refreshPeers = () => {
      const states = [...provider.awareness.getStates().entries()];
      const others = states
        .filter(([clientId]) => clientId !== provider.awareness.clientID)
        .map(([, s]) => s.user)
        .filter(Boolean);
      const seen = new Set();
      const uniq = [];
      for (const u of others) {
        const key = u.id || u.name;
        if (seen.has(key)) continue;
        seen.add(key); uniq.push(u);
      }
      setPeers(uniq);
    };
    provider.awareness.on("change", refreshPeers);
    refreshPeers();

    const editor = new Editor({
      element: holderRef.current,
      editorProps: {
        attributes: {
          spellcheck: "false",
          autocorrect: "off",
          autocapitalize: "off",
          "data-gramm": "false",
        },
      },
      extensions: [
        OnlyCodeDoc,
        Text,
        CodeBlock,
        Collaboration.configure({ document: ydoc }),
        CollaborationCursor.configure({ provider, user: { name: me.name, color: me.color } }),
        IniHighlight,
      ],
      onUpdate: ({ editor, transaction }) => {
        const t = editor.getText({ blockSeparator: "\n" });
        const lines = t.split("\n");
        setLineCount(Math.max(1, lines.length));
        const yAuthors = yAuthorsRef.current;
        if (yAuthors) {
          // For a LOCAL edit, claim authorship of any line whose content has no
          // recorded author yet (new or just-changed line). We only write on
          // local transactions so remote edits don't reattribute to us.
          const isLocal = transaction ? !transaction.origin || transaction.origin !== "remote" : true;
          if (isLocal) {
            const now = Date.now();
            ydocRef.current.transact(() => {
              for (const ln of lines) {
                const h = lineHash(ln);
                if (!h) continue;
                if (!yAuthors.get(h)) {
                  yAuthors.set(h, { name: me.name, color: me.color, ts: now });
                }
              }
            });
          }
          recomputeBlame(lines, yAuthors);
        }
      },
    });
    editorRef.current = editor;

    // Seed the room with the file's on-disk text — but only ONCE, and only
    // if the synced Yjs doc is still empty (so the 2nd person to open it does
    // NOT re-insert and duplicate). We wait for the provider to sync first.
    const seedIfEmpty = async () => {
      if (seededRef.current) return;
      try {
        const r = await fetch(`${API}/api/admin/config/rawfile?file=${encodeURIComponent(fileKey)}`, { credentials: "include" });
        const d = await r.json();
        setDiskInfo({ synced: d.synced, last_panel_write: d.last_panel_write });
        // Only seed if the shared doc is genuinely empty after sync.
        const current = editor.getText();
        if (!current || current.trim().length === 0) {
          editor.commands.setContent({
            type: "doc",
            content: [{ type: "codeBlock", content: d.text ? [{ type: "text", text: d.text }] : [] }],
          });
        }
        setLineCount(Math.max(1, (editor.getText({ blockSeparator: "\n" }) || "").split("\n").length));
        recomputeBlame((editor.getText({ blockSeparator: "\n" }) || "").split("\n"), yAuthors);
        seededRef.current = true;
      } catch (e) {
        setValidateMsg({ ok: false, text: `Failed to load file: ${e.message}` });
      } finally {
        setLoadingFile(false);
      }
    };

    const onSynced = (isSynced) => { if (isSynced) seedIfEmpty(); };
    provider.on("sync", onSynced);
    // Fallback: if 'sync' doesn't fire promptly, seed after a short delay.
    const seedFallback = setTimeout(() => seedIfEmpty(), 1500);

    // When authorship changes arrive from others, refresh the blame gutter.
    const onAuthorsChange = () => {
      const ed = editorRef.current;
      if (!ed) return;
      recomputeBlame((ed.getText({ blockSeparator: "\n" }) || "").split("\n"), yAuthors);
    };
    yAuthors.observe(onAuthorsChange);

    return () => {
      clearTimeout(seedFallback);
      try { provider.off("sync", onSynced); } catch {}
      try { yAuthors.unobserve(onAuthorsChange); } catch {}
      try { editor.destroy(); } catch {}
      try { provider.awareness.off("change", refreshPeers); } catch {}
      try { provider.destroy(); } catch {}
      try { ydoc.destroy(); } catch {}
      editorRef.current = null;
      providerRef.current = null;
      ydocRef.current = null;
      yAuthorsRef.current = null;
    };
  }, [fileKey, me]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentText = () => {
    const ed = editorRef.current;
    if (!ed) return "";
    // getText with a newline block separator preserves the code content.
    return ed.getText({ blockSeparator: "\n" });
  };

  // ── validate without saving (also the Zombita cross-check hook later) ──
  const doValidate = useCallback(async () => {
    setValidateMsg(null);
    try {
      const r = await fetch(`${API}/api/admin/config/validate`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: fileKey, text: currentText() }),
      });
      const d = await r.json();
      setValidateMsg(d.ok ? { ok: true, text: "Syntax looks valid." } : { ok: false, text: d.error || "Invalid." });
      return d.ok;
    } catch (e) {
      setValidateMsg({ ok: false, text: `Validation failed: ${e.message}` });
      return false;
    }
  }, [fileKey]);

  // ── save: validate-then-write on the backend ──
  const doSave = useCallback(async () => {
    setSaving(true);
    setValidateMsg(null);
    try {
      const r = await fetch(`${API}/api/admin/config/rawfile`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: fileKey, text: currentText() }),
      });
      const d = await r.json();
      if (d.ok) {
        setValidateMsg({ ok: true, text: d.message || "Saved." });
        setDiskInfo({ synced: true, last_panel_write: new Date().toISOString() });
      } else {
        setValidateMsg({ ok: false, text: d.error || d.message || "Save failed." });
      }
    } catch (e) {
      setValidateMsg({ ok: false, text: `Save failed: ${e.message}` });
    } finally {
      setSaving(false);
    }
  }, [fileKey]);

  // ── history: who changed what, when ──
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/config/history?file=${encodeURIComponent(fileKey)}&limit=80`, { credentials: "include" });
      const d = await r.json();
      setHistory(d.history || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [fileKey]);

  const openHistory = useCallback(() => {
    setHistoryOpen(true);
    setViewing(null);
    loadHistory();
  }, [loadHistory]);

  const viewBackup = useCallback(async (filename) => {
    if (!filename) return;
    setViewing({ filename, text: "Loading…", created_at: null });
    try {
      const r = await fetch(`${API}/api/admin/config/backup-content?filename=${encodeURIComponent(filename)}`, { credentials: "include" });
      const d = await r.json();
      setViewing({ filename, text: d.text || "", created_at: d.created_at });
    } catch (e) {
      setViewing({ filename, text: `Could not load backup: ${e.message}`, created_at: null });
    }
  }, []);

  const statusMeta = {
    connecting: { label: "Connecting", color: "var(--orange)", dot: "var(--orange)" },
    connected:  { label: "Live",       color: "var(--green)",  dot: "var(--green)"  },
    offline:    { label: "Offline",    color: "var(--red)",    dot: "var(--red)"    },
  }[status];

  return (
    <div className="cfg-surface" style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <style dangerouslySetInnerHTML={{ __html: EDITOR_CSS }} />

      {/* status / presence / save strip */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
        borderBottom: "1px solid var(--border)", background: "var(--surface)",
        position: "sticky", top: 0, zIndex: 20,
      }}>
        {/* info group — allowed to shrink/overflow, never pushes buttons away */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{
              width: 8, height: 8, borderRadius: 4, background: statusMeta.dot,
              boxShadow: status === "connected" ? `0 0 6px ${statusMeta.dot}` : "none",
              animation: status === "connecting" ? "ap-blink 1.2s infinite" : "none",
            }} />
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 1.5, color: statusMeta.color, textTransform: "uppercase" }}>
              {statusMeta.label}
            </span>
          </div>

          <div style={{ width: 1, height: 18, background: "var(--border)", flexShrink: 0 }} />

          <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)", letterSpacing: 0.5, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {fileLabel || fileKey}
          </span>

          <div style={{ width: 1, height: 18, background: "var(--border)", flexShrink: 0 }} />

          {/* presence */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div style={{ display: "flex", marginRight: 4 }}>
              <Avatar u={me} ring />
              {peers.map((u, i) => (
                <div key={(u.id || u.name) + i} style={{ marginLeft: -6 }}><Avatar u={u} /></div>
              ))}
            </div>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>
              {peers.length === 0 ? "only you" : `${peers.length} other${peers.length > 1 ? "s" : ""} editing`}
            </span>
          </div>

          {/* external-edit warning */}
          {diskInfo && diskInfo.synced === false && (
            <span title="The file on disk changed outside this editor (e.g. FileBrowser). Your draft may be based on an older version."
              style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--orange)", letterSpacing: 0.5, flexShrink: 0 }}>
              ⚠ disk changed externally
            </span>
          )}
        </div>

        {/* action group — fixed, always visible, never wraps off-screen */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button onClick={() => setBlameOn((b) => !b)} disabled={loadingFile}
            style={btnStyle(blameOn ? "gold" : "ghost", loadingFile)}
            title="Show who last changed each line">Blame</button>
          <button onClick={openHistory} disabled={loadingFile}
            style={btnStyle("ghost", loadingFile)}>History</button>
          <button onClick={doValidate} disabled={loadingFile}
            style={btnStyle("ghost", loadingFile)}>Check syntax</button>
          <button onClick={doSave} disabled={saving || loadingFile}
            style={btnStyle("green", saving || loadingFile)}>
            {saving ? "Saving…" : "💾 Save"}
          </button>
        </div>
      </div>

      {/* validation / save feedback */}
      {validateMsg && (
        <div style={{
          padding: "8px 16px", fontFamily: "var(--mono)", fontSize: 11.5, letterSpacing: 0.3,
          borderBottom: "1px solid var(--border)",
          background: validateMsg.ok ? "rgba(76,175,125,0.08)" : "rgba(224,85,85,0.08)",
          color: validateMsg.ok ? "var(--green)" : "var(--red)",
        }}>
          {validateMsg.ok ? "✓ " : "✕ "}{validateMsg.text}
        </div>
      )}

      {/* editor surface with line-number gutter */}
      <div style={{ flex: 1, overflow: "auto", position: "relative", display: "flex", background: "var(--bg)" }}>
        {loadingFile && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 5, pointerEvents: "none",
          }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", letterSpacing: 2, animation: "ap-blink 1.2s infinite" }}>
              LOADING FILE…
            </span>
          </div>
        )}
        {/* gutter: line numbers + per-line author blame */}
        <div aria-hidden="true" style={{
          flexShrink: 0, userSelect: "none",
          padding: "16px 0 140px", borderRight: "1px solid var(--border)",
          fontFamily: "var(--mono)", fontSize: 13.5, lineHeight: "23px",
          color: "var(--muted)", background: "rgba(0,0,0,0.18)",
          minWidth: blameOn ? 150 : 44,
        }}>
          {Array.from({ length: lineCount }, (_, i) => {
            const a = lineAuthors[i];
            return (
              <div key={i} style={{ height: 23, display: "flex", alignItems: "center", gap: 6, padding: "0 10px" }}>
                {blameOn && (
                  <span
                    title={a ? `${a.name} · ${fmtAgo(a.ts)}` : ""}
                    style={{
                      flex: "0 0 78px", display: "flex", alignItems: "center", gap: 4,
                      overflow: "hidden", whiteSpace: "nowrap",
                    }}
                  >
                    {a && (
                      <>
                        <span style={{ width: 6, height: 6, borderRadius: 3, background: a.color || "var(--muted)", flexShrink: 0 }} />
                        <span style={{ fontSize: 9.5, color: "var(--textdim)", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
                      </>
                    )}
                  </span>
                )}
                <span style={{ flex: 1, textAlign: "right", minWidth: 20 }}>{i + 1}</span>
              </div>
            );
          })}
        </div>
        {/* editor */}
        <div ref={holderRef} style={{ flex: 1, minWidth: 0 }} />
      </div>

      {/* footer hint */}
      <div style={{
        padding: "8px 16px", borderTop: "1px solid var(--border)", background: "rgba(0,0,0,0.15)",
        fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", letterSpacing: 0.5,
      }}>
        Edits are a shared live draft — nobody's changes get overwritten. The real file is written only on Save (after a syntax check). Restart the server to apply.
      </div>

      {/* HISTORY OVERLAY */}
      {historyOpen && (
        <div
          onClick={() => setHistoryOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: viewing ? "min(900px, 90vw)" : "min(440px, 90vw)", height: "100%",
              background: "var(--surface)", borderLeft: "1px solid var(--border)",
              display: "flex", flexDirection: "column", transition: "width .15s",
            }}
          >
            {/* header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontFamily: "var(--display)", fontSize: 20, letterSpacing: 1.5, color: "var(--accent)" }}>HISTORY</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>{fileLabel || fileKey}</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => setHistoryOpen(false)} style={btnStyle("ghost", false)}>Close</button>
            </div>

            <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
              {/* timeline list */}
              <div style={{ width: viewing ? 360 : "100%", flexShrink: 0, overflowY: "auto", borderRight: viewing ? "1px solid var(--border)" : "none" }}>
                {historyLoading ? (
                  <div style={{ padding: 20, fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", animation: "ap-blink 1.2s infinite" }}>LOADING HISTORY…</div>
                ) : history.length === 0 ? (
                  <div style={{ padding: 20, fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>No saved changes recorded yet for this file.</div>
                ) : history.map((h) => (
                  <div key={h.id} style={{ padding: "12px 16px", borderBottom: "1px solid rgba(30,37,48,0.6)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)" }}>{h.admin_name}</span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>{fmtTime(h.created_at)}</span>
                    </div>
                    <div style={{ fontFamily: "var(--body)", fontSize: 12.5, color: "var(--textdim)", marginTop: 4, lineHeight: 1.5 }}>
                      {h.description || h.action}
                    </div>
                    {h.backup_file && (
                      <button onClick={() => viewBackup(h.backup_file)} style={{ ...btnStyle("ghost", false), marginTop: 8, padding: "4px 10px", fontSize: 9.5 }}>
                        View this version
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* version viewer */}
              {viewing && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)" }}>{viewing.filename}</span>
                    {viewing.created_at && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>{fmtTime(viewing.created_at)}</span>}
                    <div style={{ flex: 1 }} />
                    <button onClick={() => setViewing(null)} style={btnStyle("ghost", false)}>✕</button>
                  </div>
                  <pre style={{
                    flex: 1, overflow: "auto", margin: 0, padding: "14px 18px",
                    fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: "20px",
                    color: "var(--text)", background: "var(--bg)", whiteSpace: "pre",
                  }}>{viewing.text}</pre>
                  <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border)", fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>
                    Read-only view of a past version. To roll back, use Restore in the Server Config tab.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = Math.floor((now - d.getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function btnStyle(color, disabled) {
  const colors = {
    green: { border: "var(--green)", text: "var(--green)", bg: "rgba(76,175,125,0.08)" },
    gold:  { border: "var(--accent)", text: "var(--accent)", bg: "rgba(200,168,75,0.12)" },
    ghost: { border: "var(--border)", text: "var(--textdim)", bg: "transparent" },
  };
  const c = colors[color] || colors.ghost;
  return {
    padding: "6px 14px", fontSize: 10.5, fontFamily: "var(--mono)", letterSpacing: 1,
    textTransform: "uppercase",
    border: `1px solid ${disabled ? "var(--border)" : c.border}`,
    color: disabled ? "var(--textdim)" : c.text,
    background: disabled ? "transparent" : c.bg,
    cursor: disabled ? "not-allowed" : "pointer", transition: "all .15s",
  };
}

function Avatar({ u, ring }) {
  const color = u.color || "#4a5568";
  const initials = u.initials || (u.name ? u.name.slice(0, 2).toUpperCase() : "??");
  return (
    <div title={u.name} style={{
      width: 24, height: 24, borderRadius: 12,
      background: color + "33", border: `2px solid ${color}`,
      boxShadow: ring ? `0 0 0 2px var(--surface)` : "none",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--mono)", fontSize: 9, color, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}
