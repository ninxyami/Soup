"use client";
// @ts-nocheck
// components/workspace/CollabEditor.jsx
//
// The real collaborative editor surface. Client-only (Yjs cannot SSR).
// Loaded via next/dynamic({ ssr:false }) from the Workspace tab.
//
// Identity: the relay already authenticates the admin via the soup_session
// cookie and knows their discord_id. We pass the *resolved* admin identity
// (name/color/initials from the ADMINS roster) down as `me` so live cursors
// read "Dawnie", "Sheo", "Nin Nin" — never "Admin-487".
//
// Design: SOUP tokens only (var(--accent) gold, var(--mono), etc). The CSS
// here covers ONLY the ProseMirror surface + collab cursor chrome; everything
// else uses the panel's existing classes.

import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";

// P4 — cell background colors (the red/yellow/green status coding admins use
// in their Sheets). We extend the official cell/header nodes with a
// `backgroundColor` attribute that round-trips through the DOM (so it persists
// via Yjs and survives reload) and renders as a translucent tint — translucent
// so the same swatch reads correctly on BOTH dark and (future) light themes.
const cellBg = {
  backgroundColor: {
    default: null,
    parseHTML: (el) => el.getAttribute("data-bg") || null,
    renderHTML: (attrs) =>
      attrs.backgroundColor ? { "data-bg": attrs.backgroundColor } : {},
  },
};
const ColorTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellBg };
  },
});
const ColorTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellBg };
  },
});

// Status palette — tuned to how admins actually color sheets (added / pending /
// broken / info / note), plus neutrals. Values are translucent so they tint
// rather than paint, working on any theme. Keyed names map to CSS in EDITOR_CSS.
const CELL_COLORS = [
  { key: "green",  label: "Added / done",   swatch: "#4caf7d" },
  { key: "yellow", label: "Pending / WIP",  swatch: "#d4b24b" },
  { key: "red",    label: "Broken / no",    swatch: "#e05555" },
  { key: "blue",   label: "Info",           swatch: "#4a8fc4" },
  { key: "purple", label: "Note",           swatch: "#9775cc" },
  { key: "orange", label: "Highlight",      swatch: "#d4873a" },
];

const WS_BASE = "wss://api.stateofundeadpurge.site:8443/ws/workspace";

// Editor-surface + cursor styling. Scoped under .ws-surface so it never
// bleeds into the rest of the panel.
const EDITOR_CSS = `
.ws-surface .ProseMirror{
  outline:none; min-height:520px; font-family:var(--body);
  font-size:15.5px; line-height:1.75; color:var(--text);
  padding:8px 2px 120px; caret-color:var(--accent);
}
.ws-surface .ProseMirror:focus{outline:none}
.ws-surface .ProseMirror > * + *{margin-top:0.85em}
.ws-surface .ProseMirror h1{font-family:var(--display);font-size:34px;letter-spacing:2px;color:var(--accent);line-height:1.15;margin-top:1.2em}
.ws-surface .ProseMirror h2{font-family:var(--display);font-size:25px;letter-spacing:1.5px;color:var(--text);line-height:1.2;margin-top:1.1em}
.ws-surface .ProseMirror h3{font-family:var(--mono);font-size:14px;letter-spacing:2px;text-transform:uppercase;color:var(--textdim);margin-top:1em}
.ws-surface .ProseMirror p{margin:0}
.ws-surface .ProseMirror ul,.ws-surface .ProseMirror ol{padding-left:1.6em}
.ws-surface .ProseMirror li{padding-left:0.2em;margin-bottom:0.25em}
/* bullet list — custom dash marker */
.ws-surface .ProseMirror ul li{list-style:none;position:relative}
.ws-surface .ProseMirror ul li::marker{content:none}
.ws-surface .ProseMirror ul li::before{content:"—";position:absolute;left:-1.3em;color:var(--muted)}
/* ordered list — native counter, styled to match the theme */
.ws-surface .ProseMirror ol{list-style:none;counter-reset:ol-counter}
.ws-surface .ProseMirror ol li{counter-increment:ol-counter;position:relative}
.ws-surface .ProseMirror ol li::before{content:counter(ol-counter)".";position:absolute;left:-1.6em;color:var(--textdim);font-family:var(--mono);font-size:0.85em;font-weight:600;min-width:1.4em;text-align:right}
.ws-surface .ProseMirror blockquote{border-left:2px solid var(--accent);padding-left:16px;color:var(--textdim);font-style:italic;margin-left:0}
.ws-surface .ProseMirror code{font-family:var(--mono);font-size:0.9em;background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.15);padding:1px 5px;border-radius:2px;color:var(--accent)}
.ws-surface .ProseMirror pre{font-family:var(--mono);font-size:13px;background:var(--bg);border:1px solid var(--border);padding:14px 16px;border-radius:3px;overflow-x:auto}
.ws-surface .ProseMirror pre code{background:none;border:none;padding:0;color:var(--text)}
.ws-surface .ProseMirror hr{border:none;border-top:1px solid var(--border);margin:1.6em 0}
.ws-surface .ProseMirror strong{color:#e3e7ee}
/* P4.1 collaborative tables — SOUP tokens */
.ws-surface .ProseMirror .tableWrapper{overflow-x:auto;margin:1.1em 0;padding:2px}
.ws-surface .ProseMirror table.ws-table{
  border-collapse:collapse; table-layout:fixed; width:100%;
  font-family:var(--body); font-size:14px; margin:0;
  border:1px solid var(--border); background:var(--surface);
}
.ws-surface .ProseMirror table.ws-table td,
.ws-surface .ProseMirror table.ws-table th{
  border:1px solid var(--border); padding:7px 10px; vertical-align:top;
  position:relative; min-width:60px; box-sizing:border-box; color:var(--text);
}
.ws-surface .ProseMirror table.ws-table th{
  background:rgba(0,0,0,0.28); font-family:var(--mono); font-weight:400;
  font-size:11px; letter-spacing:1.5px; text-transform:uppercase;
  color:var(--accent); text-align:left;
}
.ws-surface .ProseMirror table.ws-table td > *,
.ws-surface .ProseMirror table.ws-table th > *{margin:0}
.ws-surface .ProseMirror table.ws-table p{line-height:1.5}
/* row striping for readability */
.ws-surface .ProseMirror table.ws-table tr:nth-child(even) td{background:rgba(255,255,255,0.015)}
/* selected cell(s) — the gold selection overlay */
.ws-surface .ProseMirror table.ws-table .selectedCell:after{
  content:""; position:absolute; inset:0; pointer-events:none; z-index:2;
  background:rgba(200,168,75,0.16);
}
.ws-surface .ProseMirror table.ws-table .selectedCell{border-color:var(--accent)}
/* P4 — status cell colors (translucent tints; theme-safe). The data-bg
   attribute is set by the color picker and persists through Yjs. */
.ws-surface .ProseMirror table.ws-table td[data-bg="green"],
.ws-surface .ProseMirror table.ws-table th[data-bg="green"]{background:rgba(76,175,125,0.22)}
.ws-surface .ProseMirror table.ws-table td[data-bg="yellow"],
.ws-surface .ProseMirror table.ws-table th[data-bg="yellow"]{background:rgba(212,178,75,0.22)}
.ws-surface .ProseMirror table.ws-table td[data-bg="red"],
.ws-surface .ProseMirror table.ws-table th[data-bg="red"]{background:rgba(224,85,85,0.22)}
.ws-surface .ProseMirror table.ws-table td[data-bg="blue"],
.ws-surface .ProseMirror table.ws-table th[data-bg="blue"]{background:rgba(74,143,196,0.22)}
.ws-surface .ProseMirror table.ws-table td[data-bg="purple"],
.ws-surface .ProseMirror table.ws-table th[data-bg="purple"]{background:rgba(151,117,204,0.22)}
.ws-surface .ProseMirror table.ws-table td[data-bg="orange"],
.ws-surface .ProseMirror table.ws-table th[data-bg="orange"]{background:rgba(212,135,58,0.22)}
/* keep the striping from doubling up on colored cells */
.ws-surface .ProseMirror table.ws-table tr:nth-child(even) td[data-bg]{background-blend-mode:normal}
/* column resize handle */
.ws-surface .ProseMirror table.ws-table .column-resize-handle{
  position:absolute; right:-2px; top:0; bottom:-1px; width:4px; z-index:20;
  background:var(--accent); pointer-events:none;
}
.ws-surface .ProseMirror.resize-cursor{cursor:col-resize}
.ws-surface .ProseMirror table.ws-table .grip-column,
.ws-surface .ProseMirror table.ws-table .grip-row{background:transparent}
/* placeholder */
.ws-surface .ProseMirror p.is-editor-empty:first-child::before{
  content:attr(data-placeholder); color:var(--muted); font-family:var(--mono);
  font-size:14px; letter-spacing:0.5px; float:left; height:0; pointer-events:none;
}
/* remote collaboration cursors */
.ws-surface .collaboration-cursor__caret{
  border-left:1.5px solid; border-right:1.5px solid; margin-left:-1px; margin-right:-1px;
  pointer-events:none; position:relative; word-break:normal;
}
.ws-surface .collaboration-cursor__label{
  position:absolute; top:-1.5em; left:-1.5px; font-family:var(--mono); font-size:10px;
  font-weight:600; letter-spacing:0.5px; line-height:1; padding:2px 6px; border-radius:3px 3px 3px 0;
  color:#0b0d10; white-space:nowrap; user-select:none;
}
`;

// Small toolbar button
function TBtn({ active, disabled, title, onClick, children }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 30, height: 30, padding: "0 8px",
        background: active ? "rgba(200,168,75,0.12)" : "transparent",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        color: active ? "var(--accent)" : "var(--textdim)",
        fontFamily: "var(--mono)", fontSize: 12, letterSpacing: 0.5,
        cursor: disabled ? "not-allowed" : "pointer", borderRadius: 2,
        opacity: disabled ? 0.4 : 1, transition: "all .12s", lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}

export default function CollabEditor({ docId, docTitle, me, seed }) {
  const holderRef = useRef(null);
  const editorRef = useRef(null);
  const providerRef = useRef(null);
  const ydocRef = useRef(null);

  const [status, setStatus] = useState("connecting"); // connecting | connected | offline
  const [peers, setPeers] = useState([]);             // [{name,color,initials,id}]
  const [, forceTick] = useState(0);                  // re-render toolbar active states
  const [saved, setSaved] = useState(true);           // crude dirty indicator
  const [colorOpen, setColorOpen] = useState(false);  // cell-color popover

  // Re-mount the whole editor whenever the document changes.
  useEffect(() => {
    if (!docId || !holderRef.current) return;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const provider = new WebsocketProvider(WS_BASE, docId, ydoc, { connect: true });
    providerRef.current = provider;

    provider.on("status", (e) => {
      setStatus(e.status === "connected" ? "connected" : e.status === "connecting" ? "connecting" : "offline");
    });

    // our own identity for the cursor label
    provider.awareness.setLocalStateField("user", {
      name: me.name, color: me.color, id: me.id, initials: me.initials,
    });

    const refreshPeers = () => {
      const states = [...provider.awareness.getStates().entries()];
      const others = states
        .filter(([clientId]) => clientId !== provider.awareness.clientID)
        .map(([, s]) => s.user)
        .filter(Boolean);
      // de-dupe by id (same admin in two tabs shows once)
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
        StarterKit.configure({ history: false }), // Yjs owns history
        Placeholder.configure({
          placeholder: "Start writing the plan… headings, lists, notes — it all syncs live.",
        }),
        Collaboration.configure({ document: ydoc }),
        CollaborationCursor.configure({
          provider,
          user: { name: me.name, color: me.color },
        }),
        // P4.1 — collaborative tables. These are plain ProseMirror nodes, so
        // Yjs merges them through the SAME relay with no backend change. A
        // table is just doc content the relay already persists.
        Table.configure({
          resizable: true,
          lastColumnResizable: true,
          allowTableNodeSelection: true,
          HTMLAttributes: { class: "ws-table" },
        }),
        TableRow,
        ColorTableHeader,
        ColorTableCell,
      ],
      onTransaction: () => forceTick((n) => n + 1),
      onUpdate: () => { setSaved(false); scheduleSavedFlag(); },
    });
    editorRef.current = editor;

    // P4 — sheet seeding. When a doc was created as a "sheet", drop in a
    // starter table — but ONLY after we've synced with the relay AND only if
    // the doc is still empty. This makes "new sheet" work with zero backend
    // change, while never double-seeding when two admins open at once (the
    // first to sync seeds; the rest see it already there).
    const maybeSeedSheet = () => {
      if (seed !== "sheet" || !editorRef.current) return;
      const ed = editorRef.current;
      const isEmpty = ed.state.doc.childCount <= 1 && ed.state.doc.textContent.trim() === "";
      if (!isEmpty) return;
      ed.chain().focus()
        .insertTable({ rows: 4, cols: 4, withHeaderRow: true })
        .run();
    };
    provider.once("synced", maybeSeedSheet);
    // Fallback: if already synced (cached), seed shortly after mount.
    const seedTimer = setTimeout(() => { if (provider.synced) maybeSeedSheet(); }, 600);

    // The relay persists server-side (debounced). This flag is purely a
    // local "your edits reached the socket" reassurance — flips back to
    // saved shortly after you stop typing.
    let savedTimer = null;
    function scheduleSavedFlag() {
      clearTimeout(savedTimer);
      savedTimer = setTimeout(() => setSaved(true), 1200);
    }

    return () => {
      clearTimeout(savedTimer);
      clearTimeout(seedTimer);
      try { editor.destroy(); } catch {}
      try { provider.awareness.off("change", refreshPeers); } catch {}
      try { provider.destroy(); } catch {}
      try { ydoc.destroy(); } catch {}
      editorRef.current = null;
      providerRef.current = null;
      ydocRef.current = null;
    };
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  const ed = editorRef.current;
  const can = (fn) => !!ed && fn();
  const run = useCallback((fn) => { if (ed) fn(ed.chain().focus()); }, [ed]);
  const inTable = !!ed && ed.isActive("table");

  const statusMeta = {
    connecting: { label: "Connecting", color: "var(--orange)", dot: "var(--orange)" },
    connected:  { label: "Live",       color: "var(--green)",  dot: "var(--green)"  },
    offline:    { label: "Offline",    color: "var(--red)",    dot: "var(--red)"    },
  }[status];

  return (
    <div className="ws-surface" style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <style dangerouslySetInnerHTML={{ __html: EDITOR_CSS }} />

      {/* status / presence strip */}
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

        {/* presence avatars */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", marginRight: 4 }}>
            {/* always show me first */}
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

        <span style={{
          fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 1, textTransform: "uppercase",
          color: saved ? "var(--textdim)" : "var(--accent)",
        }}>
          {saved ? "saved" : "syncing…"}
        </span>
      </div>

      {/* formatting toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 4, padding: "8px 16px",
        borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.15)",
        flexWrap: "wrap", position: "sticky", top: 41, zIndex: 19,
      }}>
        <TBtn title="Bold"   active={can(() => ed.isActive("bold"))}   onClick={() => run((c) => c.toggleBold().run())}>B</TBtn>
        <TBtn title="Italic" active={can(() => ed.isActive("italic"))} onClick={() => run((c) => c.toggleItalic().run())}><span style={{ fontStyle: "italic" }}>I</span></TBtn>
        <TBtn title="Strike" active={can(() => ed.isActive("strike"))} onClick={() => run((c) => c.toggleStrike().run())}><span style={{ textDecoration: "line-through" }}>S</span></TBtn>
        <TBtn title="Code"   active={can(() => ed.isActive("code"))}   onClick={() => run((c) => c.toggleCode().run())}>{"</>"}</TBtn>
        <Div />
        <TBtn title="Heading 1" active={can(() => ed.isActive("heading", { level: 1 }))} onClick={() => run((c) => c.toggleHeading({ level: 1 }).run())}>H1</TBtn>
        <TBtn title="Heading 2" active={can(() => ed.isActive("heading", { level: 2 }))} onClick={() => run((c) => c.toggleHeading({ level: 2 }).run())}>H2</TBtn>
        <TBtn title="Heading 3" active={can(() => ed.isActive("heading", { level: 3 }))} onClick={() => run((c) => c.toggleHeading({ level: 3 }).run())}>H3</TBtn>
        <Div />
        <TBtn title="Bullet list"  active={can(() => ed.isActive("bulletList"))}  onClick={() => run((c) => c.toggleBulletList().run())}>•</TBtn>
        <TBtn title="Ordered list" active={can(() => ed.isActive("orderedList"))} onClick={() => run((c) => c.toggleOrderedList().run())}>1.</TBtn>
        <TBtn title="Quote"        active={can(() => ed.isActive("blockquote"))}  onClick={() => run((c) => c.toggleBlockquote().run())}>"</TBtn>
        <TBtn title="Code block"   active={can(() => ed.isActive("codeBlock"))}   onClick={() => run((c) => c.toggleCodeBlock().run())}>{ }</TBtn>
        <TBtn title="Divider"      onClick={() => run((c) => c.setHorizontalRule().run())}>—</TBtn>
        <Div />
        {/* P4.1 — table operations. Insert is always available; the rest only
            light up when the cursor is inside a table. */}
        <TBtn
          title="Insert table"
          onClick={() => run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
        >▦</TBtn>
        {inTable && (
          <>
            <TBtn title="Add column"      onClick={() => run((c) => c.addColumnAfter().run())}>+col</TBtn>
            <TBtn title="Delete column"   onClick={() => run((c) => c.deleteColumn().run())}>−col</TBtn>
            <TBtn title="Add row"         onClick={() => run((c) => c.addRowAfter().run())}>+row</TBtn>
            <TBtn title="Delete row"      onClick={() => run((c) => c.deleteRow().run())}>−row</TBtn>
            <TBtn title="Toggle header row" onClick={() => run((c) => c.toggleHeaderRow().run())}>H↔</TBtn>
            <TBtn title="Merge / split cells" onClick={() => run((c) => c.mergeOrSplit().run())}>⊟</TBtn>
            {/* P4 — cell color picker (status coding). Colors the selected cell(s). */}
            <div style={{ position: "relative" }}>
              <TBtn title="Cell color" active={colorOpen} onClick={() => setColorOpen((o) => !o)}>🎨</TBtn>
              {colorOpen && (
                <div
                  style={{
                    position: "absolute", top: 34, left: 0, zIndex: 40,
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 3, padding: 8, boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
                    display: "flex", flexDirection: "column", gap: 6, minWidth: 150,
                  }}
                >
                  {CELL_COLORS.map((col) => (
                    <button
                      key={col.key}
                      title={col.label}
                      onClick={() => { run((c) => c.setCellAttribute("backgroundColor", col.key).run()); setColorOpen(false); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "4px 6px",
                        background: "transparent", border: "1px solid transparent",
                        cursor: "pointer", borderRadius: 2, fontFamily: "var(--mono)",
                        fontSize: 11, color: "var(--textdim)", textAlign: "left",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--textdim)"; }}
                    >
                      <span style={{ width: 14, height: 14, borderRadius: 2, background: col.swatch, flexShrink: 0, opacity: 0.85 }} />
                      {col.label}
                    </button>
                  ))}
                  <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />
                  <button
                    onClick={() => { run((c) => c.setCellAttribute("backgroundColor", null).run()); setColorOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "4px 6px",
                      background: "transparent", border: "1px solid transparent",
                      cursor: "pointer", borderRadius: 2, fontFamily: "var(--mono)",
                      fontSize: 11, color: "var(--textdim)", textAlign: "left",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--textdim)"; }}
                  >
                    <span style={{ width: 14, height: 14, borderRadius: 2, border: "1px solid var(--muted)", flexShrink: 0 }} />
                    Clear color
                  </button>
                </div>
              )}
            </div>
            <TBtn title="Delete table"    onClick={() => run((c) => c.deleteTable().run())}>✕▦</TBtn>
          </>
        )}
      </div>

      {/* the editor surface */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 40px 0" }}>
        <div ref={holderRef} />
      </div>
    </div>
  );
}

function Div() {
  return <div style={{ width: 1, height: 18, background: "var(--border)", margin: "0 4px" }} />;
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
