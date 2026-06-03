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
import { Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import CodeBlock from "@tiptap/extension-code-block";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";

const WS_BASE = "wss://api.stateofundeadpurge.site:8443/ws/workspace";
const API = "https://api.stateofundeadpurge.site:8443";

// A document that is exactly ONE code block, holding the whole file.
// This keeps the Yjs doc plain-text and impossible to format into garbage.
const OnlyCodeDoc = Document.extend({ content: "codeBlock" });

const EDITOR_CSS = `
.cfg-surface .ProseMirror{
  outline:none; min-height:60vh; font-family:var(--mono);
  font-size:13px; line-height:1.65; color:var(--text);
  padding:0; caret-color:var(--accent); white-space:pre; tab-size:2;
}
.cfg-surface .ProseMirror:focus{outline:none}
.cfg-surface .ProseMirror pre{
  font-family:var(--mono); font-size:13px; background:transparent;
  border:none; padding:18px 20px 140px; margin:0; overflow-x:auto;
  white-space:pre; min-height:60vh;
}
.cfg-surface .ProseMirror pre code{background:none;border:none;padding:0;color:var(--text);font-family:var(--mono)}
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
/* line numbers gutter via CSS counter is unreliable with pre; skip for now */
`;

export default function ConfigEditor({ fileKey, fileLabel, me }) {
  const holderRef = useRef(null);
  const editorRef = useRef(null);
  const providerRef = useRef(null);
  const ydocRef = useRef(null);
  const seededRef = useRef(false);

  const [status, setStatus] = useState("connecting"); // connecting | connected | offline
  const [peers, setPeers] = useState([]);
  const [loadingFile, setLoadingFile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validateMsg, setValidateMsg] = useState(null); // {ok, text}
  const [diskInfo, setDiskInfo] = useState(null);        // {synced, last_panel_write}

  // ── mount the collaborative editor + seed from disk ──
  useEffect(() => {
    if (!fileKey || !holderRef.current || !me) return;
    seededRef.current = false;
    setLoadingFile(true);
    setValidateMsg(null);

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

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
      extensions: [
        OnlyCodeDoc,
        Text,
        CodeBlock,
        Collaboration.configure({ document: ydoc }),
        CollaborationCursor.configure({ provider, user: { name: me.name, color: me.color } }),
      ],
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

    return () => {
      clearTimeout(seedFallback);
      try { provider.off("sync", onSynced); } catch {}
      try { editor.destroy(); } catch {}
      try { provider.awareness.off("change", refreshPeers); } catch {}
      try { provider.destroy(); } catch {}
      try { ydoc.destroy(); } catch {}
      editorRef.current = null;
      providerRef.current = null;
      ydocRef.current = null;
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
        display: "flex", alignItems: "center", gap: 16, padding: "10px 16px",
        borderBottom: "1px solid var(--border)", background: "var(--surface)",
        position: "sticky", top: 0, zIndex: 20, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: 4, background: statusMeta.dot,
            boxShadow: status === "connected" ? `0 0 6px ${statusMeta.dot}` : "none",
            animation: status === "connecting" ? "ap-blink 1.2s infinite" : "none",
          }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 1.5, color: statusMeta.color, textTransform: "uppercase" }}>
            {statusMeta.label}
          </span>
        </div>

        <div style={{ width: 1, height: 18, background: "var(--border)" }} />

        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)", letterSpacing: 0.5 }}>
          {fileLabel || fileKey}
        </span>

        <div style={{ width: 1, height: 18, background: "var(--border)" }} />

        {/* presence */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

        <div style={{ flex: 1 }} />

        {/* external-edit warning */}
        {diskInfo && diskInfo.synced === false && (
          <span title="The file on disk changed outside this editor (e.g. FileBrowser). Your draft may be based on an older version."
            style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--orange)", letterSpacing: 0.5 }}>
            ⚠ disk changed externally
          </span>
        )}

        <button onClick={doValidate} disabled={loadingFile}
          style={btnStyle("ghost", loadingFile)}>Check syntax</button>
        <button onClick={doSave} disabled={saving || loadingFile}
          style={btnStyle("green", saving || loadingFile)}>
          {saving ? "Saving…" : "💾 Save to server"}
        </button>
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

      {/* editor surface */}
      <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
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
        <div ref={holderRef} />
      </div>

      {/* footer hint */}
      <div style={{
        padding: "8px 16px", borderTop: "1px solid var(--border)", background: "rgba(0,0,0,0.15)",
        fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", letterSpacing: 0.5,
      }}>
        Edits are a shared live draft — nobody's changes get overwritten. The real file is written only on Save (after a syntax check). Restart the server to apply.
      </div>
    </div>
  );
}

function btnStyle(color, disabled) {
  const colors = {
    green: { border: "var(--green)", text: "var(--green)", bg: "rgba(76,175,125,0.08)" },
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
