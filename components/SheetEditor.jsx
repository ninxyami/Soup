"use client";
// @ts-nocheck
// components/SheetEditor.jsx
//
// The collaborative SPREADSHEET surface — a real grid (jspreadsheet-ce), not a
// rich-text table. Used for "Sheet" type documents (economy, inventory, mod
// lists). Document type keeps using CollabEditor (TipTap); this is its sibling.
//
// COLLABORATION MODEL (the whole point — live, no lost work):
//   The sheet is NOT serialized whole-doc. Instead each cell lives as its own
//   key in a Yjs Y.Map ("cells"), keyed "r:c" -> { v: value, s: styleId }.
//   - Local edit  → write just that cell key into the Y.Map → relay broadcasts.
//   - Remote edit → observe the Y.Map, apply ONLY the changed cells via
//     setValueFromCoords — never setData on the whole grid, so nobody's cursor
//     or in-progress typing is yanked away.
//   Two admins editing DIFFERENT cells merge cleanly (separate keys). Same cell
//   resolves last-write-wins — the only unavoidable conflict, same as Sheets.
//   Yjs is the source of truth; the grid is a view. Persists through the SAME
//   pycrdt relay as everything else (no backend change). Structured cells also
//   mean Zombita can read {B5: 750} later, not a blob.
//
// SSR: jspreadsheet touches `document`, so this loads client-only via
// next/dynamic({ ssr:false }) — same pattern as CollabEditor.

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
// jspreadsheet + jsuites styles. This whole component is loaded via
// next/dynamic({ssr:false}) from WorkspaceTab, so these CSS imports are
// client-only and safe in the static export.
import "jspreadsheet-ce/dist/jspreadsheet.css";
import "jspreadsheet-ce/dist/jspreadsheet.themes.css";
import "jsuites/dist/jsuites.css";

const WS_BASE = "wss://api.stateofundeadpurge.site:8443/ws/workspace";

// Grid geometry for a fresh sheet.
const DEFAULT_ROWS = 30;
const DEFAULT_COLS = 12;
const COL_WIDTH = 130;

// Status colors — same palette/keys as the TipTap table cell colors so the two
// editors feel like one product. Stored as a style id per cell.
const CELL_COLORS = [
  { key: "green",  label: "Added / done",  bg: "rgba(76,175,125,0.22)" },
  { key: "yellow", label: "Pending / WIP", bg: "rgba(212,178,75,0.22)" },
  { key: "red",    label: "Broken / no",   bg: "rgba(224,85,85,0.22)" },
  { key: "blue",   label: "Info",          bg: "rgba(74,143,196,0.22)" },
  { key: "purple", label: "Note",          bg: "rgba(151,117,204,0.22)" },
  { key: "orange", label: "Highlight",     bg: "rgba(212,135,58,0.22)" },
];
const colorBg = (key) => (CELL_COLORS.find((c) => c.key === key) || {}).bg || "";

// SOUP theming over jspreadsheet's base CSS. Scoped under .ss-surface.
const SHEET_CSS = `
.ss-surface{display:flex;flex-direction:column;min-height:0;height:100%}
.ss-surface .jss_container{font-family:var(--mono);color:var(--text);background:transparent}
.ss-surface .jexcel, .ss-surface .jss{font-family:var(--mono);font-size:12.5px}
.ss-surface .jss_content{overflow:auto}
.ss-surface table.jss{background:var(--surface);border-color:var(--border)}
.ss-surface table.jss > thead > tr > td,
.ss-surface table.jss > tbody > tr > td{
  border-color:var(--border); color:var(--text); background:var(--surface);
}
/* column + row headers */
.ss-surface table.jss > thead > tr > td{
  background:rgba(0,0,0,0.3); color:var(--accent); font-family:var(--mono);
  font-size:10px; letter-spacing:1px; text-transform:uppercase; font-weight:400;
}
.ss-surface table.jss > tbody > tr > td:first-child{
  background:rgba(0,0,0,0.3); color:var(--textdim); font-size:10px;
}
/* selected cell */
.ss-surface table.jss > tbody > tr > td.highlight{
  background:rgba(200,168,75,0.14) !important;
}
.ss-surface table.jss > tbody > tr > td.highlight-selected{
  background:rgba(200,168,75,0.22) !important;
}
/* the toolbar strip */
.ss-toolbar{
  display:flex;align-items:center;gap:4px;padding:8px 16px;flex-wrap:wrap;
  border-bottom:1px solid var(--border);background:rgba(0,0,0,0.15);
}
.ss-status{
  display:flex;align-items:center;gap:16px;padding:10px 16px;flex-wrap:wrap;
  border-bottom:1px solid var(--border);background:var(--surface);
}
.ss-btn{
  min-width:30px;height:30px;padding:0 8px;background:transparent;
  border:1px solid var(--border);color:var(--textdim);font-family:var(--mono);
  font-size:12px;letter-spacing:.5px;cursor:pointer;border-radius:2px;
  transition:all .12s;line-height:1;
}
.ss-btn:hover{border-color:var(--muted);color:var(--text)}
.ss-btn.active{border-color:var(--accent);color:var(--accent);background:rgba(200,168,75,0.12)}
`;

function Avatar({ u, ring }) {
  const color = u.color || "#4a5568";
  const initials = u.initials || (u.name ? u.name.slice(0, 2).toUpperCase() : "??");
  return (
    <div title={u.name} style={{
      width: 24, height: 24, borderRadius: 12, background: color + "33",
      border: `2px solid ${color}`, boxShadow: ring ? "0 0 0 2px var(--surface)" : "none",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--mono)", fontSize: 9, color, flexShrink: 0,
    }}>{initials}</div>
  );
}

export default function SheetEditor({ docId, me }) {
  const holderRef = useRef(null);
  const jssRef = useRef(null);       // jspreadsheet instance
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const cellsRef = useRef(null);     // Y.Map of cells
  const stylesRef = useRef(null);    // Y.Map of cell -> color key
  const applyingRemote = useRef(false); // guard: don't echo remote edits back
  const jspreadsheetModRef = useRef(null); // the imported module (for destroy)
  const holderEl = useRef(null);     // captured holder element for teardown

  const [status, setStatus] = useState("connecting");
  const [peers, setPeers] = useState([]);
  const [colorOpen, setColorOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!docId || !holderRef.current) return;
    let destroyed = false;
    let jss = null;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    // Sheet rooms get a distinct prefix so they never collide with doc rooms.
    const room = `sheet:${docId}`;
    const provider = new WebsocketProvider(WS_BASE, room, ydoc, { connect: true });
    providerRef.current = provider;

    const yCells = ydoc.getMap("cells");   // "r:c" -> string value
    const yStyles = ydoc.getMap("styles"); // "r:c" -> color key
    cellsRef.current = yCells;
    stylesRef.current = yStyles;

    provider.on("status", (e) => {
      if (destroyed) return;
      setStatus(e.status === "connected" ? "connected" : e.status === "connecting" ? "connecting" : "offline");
    });

    // presence
    provider.awareness.setLocalStateField("user", {
      name: me.name, color: me.color, id: me.id, initials: me.initials,
    });
    const refreshPeers = () => {
      if (destroyed) return;
      const states = [...provider.awareness.getStates().entries()];
      const others = states
        .filter(([cid]) => cid !== provider.awareness.clientID)
        .map(([, s]) => s.user).filter(Boolean);
      const seen = new Set(); const uniq = [];
      for (const u of others) { const k = u.id || u.name; if (seen.has(k)) continue; seen.add(k); uniq.push(u); }
      setPeers(uniq);
    };
    provider.awareness.on("change", refreshPeers);

    // Build the initial grid data array from the Yjs maps (after sync).
    const buildDataFromY = () => {
      const data = [];
      for (let r = 0; r < DEFAULT_ROWS; r++) {
        const row = [];
        for (let c = 0; c < DEFAULT_COLS; c++) row.push(yCells.get(`${r}:${c}`) ?? "");
        data.push(row);
      }
      return data;
    };

    const applyStylesFromY = () => {
      if (!jss) return;
      yStyles.forEach((key, coord) => {
        const [r, c] = coord.split(":").map(Number);
        const bg = colorBg(key);
        if (bg) {
          try { jss.setStyle(cellName(c, r), "background-color", bg); } catch {}
        }
      });
    };

    // r,c -> "B5" style cell name
    const cellName = (c, r) => {
      let s = ""; let n = c + 1;
      while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
      return s + (r + 1);
    };

    const initGrid = async () => {
      if (destroyed) return;
      const jspreadsheetMod = await import("jspreadsheet-ce");
      const jspreadsheet = jspreadsheetMod.default || jspreadsheetMod;
      jspreadsheetModRef.current = jspreadsheet;
      holderEl.current = holderRef.current;
      if (destroyed || !holderRef.current) return;

      const data = buildDataFromY();

      // jspreadsheet v5 takes a `worksheets` array and returns an array of
      // worksheet instances. All per-cell methods live on worksheet[0].
      const instances = jspreadsheet(holderRef.current, {
        worksheets: [{
          data,
          columns: Array.from({ length: DEFAULT_COLS }, () => ({ width: COL_WIDTH })),
          minDimensions: [DEFAULT_COLS, DEFAULT_ROWS],
          worksheetName: "Sheet",
        }],
        allowExport: false,
        about: false,
        // ── local edit → push just that cell into Yjs ──
        onchange: (worksheet, cell, x, y, value) => {
          if (applyingRemote.current) return;
          const r = parseInt(y, 10), c = parseInt(x, 10);
          ydoc.transact(() => {
            if (value === "" || value === null || value === undefined) yCells.delete(`${r}:${c}`);
            else yCells.set(`${r}:${c}`, String(value));
          });
        },
      });
      // Grab the single worksheet instance for all surgical cell ops.
      jss = Array.isArray(instances) ? instances[0] : instances;
      jssRef.current = jss;
      applyStylesFromY();
      setReady(true);
    };

    // ── remote cell changes → apply surgically ──
    const onCellsChange = (event, txn) => {
      if (txn.local || !jssRef.current) return; // ignore our own writes
      applyingRemote.current = true;
      try {
        event.keysChanged.forEach((coord) => {
          const [r, c] = coord.split(":").map(Number);
          const val = yCells.get(coord) ?? "";
          try { jssRef.current.setValueFromCoords(c, r, val, true); } catch {}
        });
      } finally {
        applyingRemote.current = false;
      }
    };
    const onStylesChange = (event, txn) => {
      if (txn.local || !jssRef.current) return;
      event.keysChanged.forEach((coord) => {
        const [r, c] = coord.split(":").map(Number);
        const key = yStyles.get(coord);
        const bg = key ? colorBg(key) : "";
        try { jssRef.current.setStyle(cellName(c, r), "background-color", bg || ""); } catch {}
      });
    };
    yCells.observe(onCellsChange);
    yStyles.observe(onStylesChange);

    // Wait for first sync so we don't seed an empty grid over existing data.
    const start = () => { if (!destroyed) initGrid(); };
    if (provider.synced) start();
    else provider.once("synced", start);
    // safety fallback
    const t = setTimeout(() => { if (!jssRef.current) start(); }, 1500);

    // expose color setter to the toolbar via ref-bound closure
    holderRef.current.__applyColor = (key) => {
      const inst = jssRef.current;
      if (!inst) return;
      let coords = [];
      // v5: getSelected() returns an array of selected cell coords. We also
      // support the selectedCell rectangle [x1,y1,x2,y2] as a fallback.
      try {
        if (typeof inst.getSelected === "function") {
          const sel = inst.getSelected(); // array of {x,y} or [x,y]
          if (Array.isArray(sel)) {
            for (const cellSel of sel) {
              const c = cellSel.x ?? cellSel[0];
              const r = cellSel.y ?? cellSel[1];
              if (c != null && r != null) coords.push([Number(r), Number(c)]);
            }
          }
        }
      } catch {}
      if (coords.length === 0) {
        try {
          const s = inst.selectedCell; // [x1,y1,x2,y2]
          if (s && s.length === 4) {
            for (let c = Math.min(s[0], s[2]); c <= Math.max(s[0], s[2]); c++)
              for (let r = Math.min(s[1], s[3]); r <= Math.max(s[1], s[3]); r++)
                coords.push([r, c]);
          }
        } catch {}
      }
      if (coords.length === 0) return;
      ydoc.transact(() => {
        coords.forEach(([r, c]) => {
          if (key) yStyles.set(`${r}:${c}`, key);
          else yStyles.delete(`${r}:${c}`);
        });
      });
      // apply locally too (observe only fires for remote txns)
      coords.forEach(([r, c]) => {
        try { inst.setStyle(cellName(c, r), "background-color", key ? colorBg(key) : ""); } catch {}
      });
    };

    return () => {
      destroyed = true;
      clearTimeout(t);
      try { yCells.unobserve(onCellsChange); } catch {}
      try { yStyles.unobserve(onStylesChange); } catch {}
      try { provider.awareness.off("change", refreshPeers); } catch {}
      // v5 teardown: prefer module-level destroy on the holder element.
      try {
        if (jspreadsheetModRef.current) {
          const j = jspreadsheetModRef.current;
          if (typeof j.destroy === "function" && holderEl.current) j.destroy(holderEl.current, true);
        }
      } catch {}
      try { if (jssRef.current && typeof jssRef.current.destroy === "function") jssRef.current.destroy(); } catch {}
      try { provider.destroy(); } catch {}
      try { ydoc.destroy(); } catch {}
      jssRef.current = null; providerRef.current = null;
      ydocRef.current = null; cellsRef.current = null; stylesRef.current = null;
    };
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusMeta = {
    connecting: { label: "Connecting", color: "var(--orange)", dot: "var(--orange)" },
    connected:  { label: "Live",       color: "var(--green)",  dot: "var(--green)"  },
    offline:    { label: "Offline",    color: "var(--red)",    dot: "var(--red)"    },
  }[status];

  const setColor = (key) => {
    setColorOpen(false);
    if (holderRef.current && holderRef.current.__applyColor) holderRef.current.__applyColor(key);
  };

  return (
    <div className="ss-surface">
      <style dangerouslySetInnerHTML={{ __html: SHEET_CSS }} />

      {/* status / presence strip */}
      <div className="ss-status">
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
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--textdim)" }}>
          {ready ? "spreadsheet" : "loading…"}
        </span>
      </div>

      {/* toolbar */}
      <div className="ss-toolbar">
        <div style={{ position: "relative" }}>
          <button className={"ss-btn" + (colorOpen ? " active" : "")} title="Cell color" onClick={() => setColorOpen((o) => !o)}>🎨</button>
          {colorOpen && (
            <div style={{
              position: "absolute", top: 34, left: 0, zIndex: 40, background: "var(--surface)",
              border: "1px solid var(--border)", borderRadius: 3, padding: 8,
              boxShadow: "0 6px 24px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", gap: 6, minWidth: 150,
            }}>
              {CELL_COLORS.map((col) => (
                <button key={col.key} title={col.label} onClick={() => setColor(col.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", background: "transparent",
                    border: "1px solid transparent", cursor: "pointer", borderRadius: 2,
                    fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", textAlign: "left",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--textdim)"; }}>
                  <span style={{ width: 14, height: 14, borderRadius: 2, background: col.bg, flexShrink: 0 }} />
                  {col.label}
                </button>
              ))}
              <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />
              <button onClick={() => setColor(null)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", background: "transparent",
                  border: "1px solid transparent", cursor: "pointer", borderRadius: 2,
                  fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", textAlign: "left",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--textdim)"; }}>
                <span style={{ width: 14, height: 14, borderRadius: 2, border: "1px solid var(--muted)", flexShrink: 0 }} />
                Clear color
              </button>
            </div>
          )}
        </div>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", marginLeft: 8, letterSpacing: 0.5 }}>
          Formulas: =B2*C2, =SUM(B2:B10) — type into a cell
        </span>
      </div>

      {/* the grid */}
      <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
        <div ref={holderRef} />
      </div>
    </div>
  );
}
