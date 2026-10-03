"use client";
// @ts-nocheck
// components/SheetEditor.jsx
//
// The collaborative SPREADSHEET surface - now built on react-data-grid (MIT,
// React-19 compatible) instead of jspreadsheet-ce. The switch fixes the entire
// class of scroll bugs that plagued the jspreadsheet version: react-data-grid
// owns its own virtualized scroll viewport, so horizontal/vertical overflow can
// never escape to the page and drag the sidebar away. Keyboard nav auto-scroll,
// column resize, and large row counts are all handled natively.
//
// COLLABORATION MODEL - UNCHANGED from the jspreadsheet version (the whole point):
//   The sheet is NOT serialized whole-doc. Each cell lives as its own key in a
//   Yjs Y.Map ("cells"), keyed "r:c" -> string value. Styles + text colors live
//   in parallel maps. Yjs is the source of truth; the grid is a view.
//     - Local edit  → write just that cell key into the Y.Map → relay broadcasts.
//     - Remote edit → observe the Y.Map → rebuild affected rows in React state.
//   Two admins editing DIFFERENT cells merge cleanly (separate keys). Same cell
//   resolves last-write-wins. Persists through the SAME pycrdt relay (no backend
//   change). Structured cells mean Zombita can still read {B5: 750}, not a blob.
//
//   IMPORTANT - data preserved: the Yjs maps ("cells"/"styles"/"textColors") and
//   the room name (bare docId) are byte-for-byte the same as the jspreadsheet
//   version, so every existing sheet loads unchanged. This is a VIEW swap, not a
//   data migration. The new "colWidths" map is additive (persisted column widths).
//
// SSR: react-data-grid touches the DOM, so this loads client-only via
// next/dynamic({ ssr:false }) from Workspace - same pattern as before.

import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { DataGrid } from "react-data-grid";
import "react-data-grid/lib/styles.css";

const TEXT_COLORS = [
  { key: "default", label: "Default",  hex: "" },
  { key: "gold",    label: "Gold",     hex: "#c8a84b" },
  { key: "green",   label: "Green",    hex: "#4caf7d" },
  { key: "red",     label: "Red",      hex: "#e05555" },
  { key: "blue",    label: "Blue",     hex: "#4a8fc4" },
  { key: "purple",  label: "Purple",   hex: "#9775cc" },
  { key: "orange",  label: "Orange",   hex: "#d4873a" },
  { key: "muted",   label: "Muted",    hex: "#888ea0" },
];

const WS_BASE = "wss://api.stateofundeadpurge.site:8443/ws/workspace";

// Grid geometry. MIN_ROWS is the *minimum* a fresh sheet shows; the grid
// auto-grows beyond it (computeRowCount). This is what fixes the old
// "only keeps 30 rows" data-loss bug - we never cap reads at 30.
const MIN_ROWS = 30;
const DEFAULT_COLS = 30;
const COL_WIDTH = 130;
// Empty rows kept available below the last filled row, so there's always
// somewhere to type/paste next.
const ROW_BUFFER = 12;

const CELL_COLORS = [
  { key: "green",  label: "Added / done",  bg: "rgba(76,175,125,0.22)" },
  { key: "yellow", label: "Pending / WIP", bg: "rgba(212,178,75,0.22)" },
  { key: "red",    label: "Broken / no",   bg: "rgba(224,85,85,0.22)" },
  { key: "blue",   label: "Info",          bg: "rgba(74,143,196,0.22)" },
  { key: "purple", label: "Note",          bg: "rgba(151,117,204,0.22)" },
  { key: "orange", label: "Highlight",     bg: "rgba(212,135,58,0.22)" },
];
const colorBg = (key) => (CELL_COLORS.find((c) => c.key === key) || {}).bg || "";

// ── Wrap text: rows grow to fit their longest cell (like Sheets / Excel) ──
// The sheet font is monospace, so a cell's line count can be worked out from
// its text and the column width without measuring every cell in the DOM.
const LINE_H = 17;       // px per wrapped line
const ROW_PAD_V = 10;    // top + bottom padding inside a cell
const ROW_MIN_H = 35;    // react-data-grid's default row height
const ROW_MAX_H = 400;   // a giant paste doesn't make a screen-high row
const CELL_PAD_H = 13;   // border 1 + our padding 6+6 (the grid's own cell padding is set to 0 in SHEET_CSS)
const DD_ARROW_W = 16;   // room the dropdown arrow takes

// greedy word wrap, the same way the browser breaks pre-wrap text
function wrapLines(text, cpl) {
  if (cpl < 1) cpl = 1;
  let lines = 0;
  for (const para of String(text).split("\n")) {
    let cur = 0;
    lines++;
    for (const word of para.split(" ")) {
      let w = word.length;
      const need = cur === 0 ? w : cur + 1 + w;
      if (need <= cpl) { cur = need; continue; }
      if (cur > 0) { lines++; cur = 0; }
      while (w > cpl) { w -= cpl; lines++; }
      cur = w;
    }
  }
  return lines;
}

// ── Clipboard (tab-separated, what Excel / Google Sheets copy and paste) ──
// A cell with a tab, a line break or a leading quote is wrapped in quotes with
// inner quotes doubled, the same way Excel writes it.
const tsvField = (v) => {
  const s = String(v ?? "");
  return /[\t\n"]/.test(s) && (/[\t\n]/.test(s) || s[0] === '"') ? '"' + s.replace(/"/g, '""') + '"' : s;
};
// Reads what Excel / Sheets / this sheet put on the clipboard. A field that
// starts with a quote is only treated as quoted when the closing quote really
// ends the field; otherwise it is kept as typed (Sheets copies 'He said "hi"'
// raw), so text with quote marks in it never gets mangled.
function parseTsv(text) {
  const s = String(text).replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = [];
  let row = [];
  let i = 0;
  const plainEnd = (k) => { while (k < s.length && s[k] !== "\t" && s[k] !== "\n") k++; return k; };
  while (i <= s.length) {
    if (s[i] === '"') {
      let j = i + 1, f = "", ok = false;
      while (j < s.length) {
        if (s[j] === '"') {
          if (s[j + 1] === '"') { f += '"'; j += 2; continue; }
          ok = j + 1 === s.length || s[j + 1] === "\t" || s[j + 1] === "\n";
          break;
        }
        f += s[j]; j++;
      }
      if (ok) { row.push(f); i = j + 1; }
      else { const k = plainEnd(i); row.push(s.slice(i, k)); i = k; }
    } else {
      const k = plainEnd(i); row.push(s.slice(i, k)); i = k;
    }
    if (i >= s.length) { rows.push(row); break; }
    if (s[i] === "\t") { i++; if (i === s.length) { row.push(""); rows.push(row); break; } continue; }
    rows.push(row); row = []; i++;          // "\n"
    if (i === s.length) break;              // a final line break is not an extra empty row
  }
  return rows;
}

// ── Cell editors ──
// Text: a textarea, so long text wraps while you type. Enter saves (as before),
// Alt+Enter or Shift+Enter starts a new line inside the cell, Esc cancels.
function WrapEditor({ row, column, onRowChange, onClose }) {
  const key = column.key;
  const ref = useCallback((el) => { if (el) { el.focus(); el.select(); } }, []);
  const onKeyDown = (e) => {
    if (e.key !== "Enter") return;
    if (!(e.altKey || e.shiftKey)) { e.preventDefault(); return; } // plain Enter = save; no stray newline in the cell
    e.stopPropagation(); // keep the grid from treating it as "save"
    if (e.altKey) {      // the browser doesn't add a newline for Alt+Enter itself
      e.preventDefault();
      const t = e.currentTarget;
      const s = t.selectionStart, en = t.selectionEnd;
      onRowChange({ ...row, [key]: t.value.slice(0, s) + "\n" + t.value.slice(en) });
      requestAnimationFrame(() => { try { t.selectionStart = t.selectionEnd = s + 1; } catch {} });
    }
  };
  return (
    <textarea
      className="rdg-text-editor ss-textarea"
      ref={ref}
      value={row[key] ?? ""}
      onChange={(e) => onRowChange({ ...row, [key]: e.target.value })}
      onKeyDown={onKeyDown}
      onBlur={() => onClose(true, false)}
    />
  );
}

// Dropdown: a list under the cell. Click an option, or arrows + Enter. Typing a
// letter jumps to the first option starting with it. Esc closes without change.
function DropdownEditor({ row, column, onRowChange, onClose, options, portalTo, onPick }) {
  const key = column.key;
  const cur = row[key] ?? "";
  const anchorRef = useRef(null);
  const listRef = useRef(null);
  const [pos, setPos] = useState(null);
  const [hi, setHi] = useState(() => Math.max(0, options.findIndex((o) => o.v === cur)));
  const count = options.length + 1; // last entry = "Clear"

  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    el.focus();
    const r = el.getBoundingClientRect();
    const h = Math.min(320, count * 28 + 12);
    const below = window.innerHeight - r.bottom;
    setPos({
      left: Math.min(r.left, window.innerWidth - 200),
      top: below < h && r.top > h ? r.top - h - 2 : r.bottom + 2,
      minWidth: Math.max(r.width, 180),
    });
  }, [count]);

  // the list is placed once; if the sheet scrolls, close it instead of leaving it floating
  useEffect(() => {
    const onScroll = (e) => { if (listRef.current && listRef.current.contains(e.target)) return; onClose(false); };
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [onClose]);

  const choose = (i) => {
    const v = i >= options.length ? "" : options[i].v;
    if (onPick) onPick(v); // the other selected cells in this column, if several are selected
    onRowChange({ ...row, [key]: v }, true);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); setHi((h) => Math.min(count - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); choose(hi); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const ch = e.key.toLowerCase();
      const i = options.findIndex((o) => String(o.v).toLowerCase().startsWith(ch));
      if (i >= 0) setHi(i);
    }
  };

  useEffect(() => {
    const el = listRef.current && listRef.current.children[hi];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [hi, pos]);

  const list = pos && (
    <div ref={listRef} className="ss-dd-list" style={{ left: pos.left, top: pos.top, minWidth: pos.minWidth }}>
      {options.map((o, i) => (
        <div key={i} className={"ss-dd-item" + (i === hi ? " hi" : "")}
          onMouseEnter={() => setHi(i)}
          onMouseDown={(e) => { e.preventDefault(); choose(i); }}>
          <span className="ss-dd-chip" style={{ background: colorBg(o.c) || "rgba(255,255,255,0.06)" }}>{o.v}</span>
          {o.v === cur && <span style={{ marginLeft: "auto", color: "var(--accent,#c8a84b)" }}>✓</span>}
        </div>
      ))}
      <div className={"ss-dd-item clear" + (hi === options.length ? " hi" : "")}
        onMouseEnter={() => setHi(options.length)}
        onMouseDown={(e) => { e.preventDefault(); choose(options.length); }}>
        Clear
      </div>
    </div>
  );

  return (
    <div ref={anchorRef} tabIndex={0} onKeyDown={onKeyDown} className="ss-dd-anchor">
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{cur}</span>
      <span className="ss-dd-arrow">▴</span>
      {list && createPortal(list, portalTo || document.body)}
    </div>
  );
}

// column index -> "A".."Z","AA"...
const colName = (c) => {
  let s = ""; let n = c + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
};

// SOUP theming over react-data-grid's base CSS. Scoped under .ss-surface.
const SHEET_CSS = `
.ss-surface{display:flex;flex-direction:column;flex:1;min-height:0;min-width:0;height:100%}
.ss-surface.ss-full{position:fixed;inset:0;z-index:2147483000;background:var(--surface,#111)} /* above the site's floating widgets */
/* the grid's own scrollbars: thick enough to grab, visible on the dark theme, kept on screen in fullscreen */
.ss-surface .rdg{scrollbar-width:auto;scrollbar-color:#5a6578 rgba(0,0,0,0.35)}
.ss-surface .rdg::-webkit-scrollbar{width:14px;height:14px}
.ss-surface .rdg::-webkit-scrollbar-track{background:rgba(0,0,0,0.35)}
.ss-surface .rdg::-webkit-scrollbar-thumb{background:#5a6578;border-radius:7px;border:3px solid transparent;background-clip:padding-box}
.ss-surface .rdg::-webkit-scrollbar-thumb:hover{background:var(--accent);background-clip:padding-box}
.ss-surface .rdg::-webkit-scrollbar-corner{background:rgba(0,0,0,0.35)}
.ss-status{display:flex;align-items:center;gap:12px;padding:8px 14px;border-bottom:1px solid var(--border);flex-shrink:0}
.ss-toolbar{display:flex;align-items:center;gap:6px;padding:6px 12px;border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:wrap}
.ss-btn{min-width:30px;height:30px;padding:0 8px;background:transparent;border:1px solid var(--border);color:var(--text);font-family:var(--mono);font-size:13px;cursor:pointer;border-radius:2px;display:flex;align-items:center;justify-content:center}
.ss-btn:hover{border-color:var(--accent)}
.ss-btn.active{border-color:var(--accent);color:var(--accent);background:rgba(200,168,75,0.06)}

/* ── react-data-grid theming - the grid owns its own scroll; we just style it ── */
.ss-grid-wrap{flex:1;min-height:0;min-width:0;position:relative;display:flex}
.ss-surface .rdg{
  flex:1; min-height:0; block-size:100%;
  border:none; font-family:var(--mono); font-size:12.5px;
  --rdg-color:var(--text);
  --rdg-background-color:var(--surface);
  --rdg-header-background-color:var(--surface2,#141a21); /* solid: rows scroll UNDER the sticky header */
  --rdg-row-hover-background-color:rgba(255,255,255,0.02);
  --rdg-selection-color:var(--accent);
  --rdg-border-color:var(--border);
  --rdg-font-size:12.5px;
}
.ss-surface .rdg-header-row{
  font-family:var(--mono);font-size:10px;letter-spacing:1px;text-transform:uppercase;
  color:var(--accent);font-weight:400;
}
.ss-surface .rdg-cell{
  border-right:1px solid var(--border);border-bottom:1px solid var(--border);
  color:var(--text);padding-inline:0; /* our cell content pads itself, so colours fill the whole cell */
}
.ss-surface .rdg-header-row .rdg-cell{padding-inline:8px}
.ss-surface .rdg{user-select:none}                 /* Shift+click selects cells, not page text */
.ss-surface .rdg textarea,.ss-surface .rdg input{user-select:text}
.ss-surface .rdg-index-cell{
  background:var(--surface2,#141a21);color:var(--textdim);font-size:10px; /* solid: columns scroll UNDER the frozen numbers */
  text-align:center;justify-content:center;display:flex;align-items:center;
}
.ss-surface .rdg-cell:focus,.ss-surface .rdg-cell:focus-within{outline:1.5px solid var(--accent);outline-offset:-2px}
.ss-surface input.rdg-text-editor,
.ss-surface .rdg-text-editor{
  font-family:var(--mono);font-size:12.5px;background:var(--bg,#0b0d10);
  color:var(--text);border:1.5px solid var(--accent);padding:0 6px;box-sizing:border-box;
}
.ss-surface textarea.ss-textarea{
  inline-size:100%;block-size:100%;resize:none;padding:4px 6px;line-height:${LINE_H}px;
  white-space:pre-wrap;overflow-wrap:anywhere;outline:none;
}
.ss-dd-anchor{display:flex;align-items:center;gap:4px;width:100%;height:100%;padding:0 6px;box-sizing:border-box;
  outline:1.5px solid var(--accent,#c8a84b);outline-offset:-2px;cursor:pointer}
.ss-picked{position:absolute;inset:0;pointer-events:none;background:rgba(200,168,75,0.14);
  box-shadow:inset 0 0 0 1px rgba(200,168,75,0.7)}
.ss-dd-arrow{font-size:9px;color:var(--textdim,#6b7280);flex-shrink:0;cursor:pointer;padding:8px 6px;margin:-8px -6px -8px 0}
.ss-dd-arrow:hover{color:var(--accent,#c8a84b)}
.ss-dd-list{position:fixed;z-index:2147483600;max-height:320px;overflow-y:auto;padding:4px;
  background:var(--surface,#0f1318);border:1px solid var(--border,#1e2530);border-radius:3px;
  box-shadow:0 8px 28px rgba(0,0,0,0.6);font-family:var(--mono,monospace);font-size:12px}
.ss-dd-item{display:flex;align-items:center;gap:8px;padding:4px 6px;cursor:pointer;border-radius:2px;color:var(--text,#c8cdd6)}
.ss-dd-item.hi{background:rgba(200,168,75,0.12)}
.ss-dd-item.clear{color:var(--textdim,#6b7280);border-top:1px solid var(--border,#1e2530);margin-top:4px;padding-top:6px}
.ss-dd-chip{padding:2px 8px;border-radius:10px;white-space:nowrap}
.ss-panel{position:absolute;top:34px;z-index:40;background:var(--surface);border:1px solid var(--border);border-radius:3px;
  padding:10px;box-shadow:0 6px 24px rgba(0,0,0,0.5);font-family:var(--mono);font-size:11px;color:var(--text)}
.ss-panel input{background:var(--bg,#080a0c);color:var(--text);border:1px solid var(--border);font-family:var(--mono);
  font-size:12px;padding:3px 6px;box-sizing:border-box}
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

const pickerItem = {
  display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", background: "transparent",
  border: "1px solid transparent", cursor: "pointer", borderRadius: 2,
  fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", textAlign: "left",
};

// Dropdown setup for one column: which row it starts at, the options, and an
// optional colour per option (the cell takes that colour when it holds it,
// unless someone gave the cell its own colour with 🎨).
const COLOR_CYCLE = ["", ...CELL_COLORS.map((c) => c.key)];

function DropdownSetup({ col, startRow, existing, columnValues, onSave, onRemove, onCancel }) {
  const [from, setFrom] = useState(existing ? existing.from + 1 : startRow + 1); // 1-based for people
  const [opts, setOpts] = useState(() => existing ? existing.options.map((o) => ({ ...o })) : [{ v: "", c: "" }]);

  const setOpt = (i, patch) => setOpts((list) => list.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const cycle = (i) => setOpts((list) => list.map((o, j) => {
    if (j !== i) return o;
    const k = COLOR_CYCLE.indexOf(o.c || "");
    return { ...o, c: COLOR_CYCLE[(k + 1) % COLOR_CYCLE.length] };
  }));
  const fillFromColumn = () => {
    const have = new Set(opts.map((o) => o.v.trim()).filter(Boolean));
    const add = columnValues(from - 1).filter((v) => !have.has(v)).map((v) => ({ v, c: "" }));
    setOpts((list) => [...list.filter((o) => o.v.trim()), ...add]);
  };
  const clean = opts.map((o) => ({ v: o.v.trim(), c: o.c || "" })).filter((o) => o.v);
  const fromOk = Number.isFinite(+from) && +from >= 1;

  return (
    <div className="ss-panel" style={{ right: 0, width: 300 }} onMouseDown={(e) => e.stopPropagation()}>
      <div style={{ color: "var(--accent)", letterSpacing: 1, marginBottom: 8 }}>DROPDOWN · COLUMN {colName(col)}</div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        From row <input type="number" min={1} value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 70 }} /> down
      </label>
      <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {opts.map((o, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button className="ss-btn" title="Colour for this option (click to change)" onClick={() => cycle(i)}
              style={{ minWidth: 24, width: 24, height: 24, padding: 0 }}>
              <span style={{ width: 14, height: 14, borderRadius: 2, background: colorBg(o.c) || "transparent",
                border: o.c ? "none" : "1px dashed var(--muted)" }} />
            </button>
            <input value={o.v} placeholder="option" onChange={(e) => setOpt(i, { v: e.target.value })} style={{ flex: 1 }}
              onKeyDown={(e) => { if (e.key === "Enter") setOpts((list) => [...list, { v: "", c: "" }]); }} />
            <button className="ss-btn" title="Remove this option" onClick={() => setOpts((list) => list.filter((_, j) => j !== i))}
              style={{ minWidth: 24, width: 24, height: 24, padding: 0 }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        <button className="ss-btn" onClick={() => setOpts((list) => [...list, { v: "", c: "" }])}>+ Option</button>
        <button className="ss-btn" title="Add every value already typed in this column (from the start row down)" onClick={fillFromColumn}>
          Use values in column
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
        <button className="ss-btn active" disabled={!clean.length || !fromOk}
          style={!clean.length || !fromOk ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          onClick={() => onSave({ from: Math.max(0, Math.floor(+from) - 1), options: clean })}>Save</button>
        {existing && <button className="ss-btn" onClick={onRemove}>Remove dropdown</button>}
        <div style={{ flex: 1 }} />
        <button className="ss-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function SheetEditor({ docId, me, docTitle }) {
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const cellsRef = useRef(null);     // Y.Map "r:c" -> value
  const stylesRef = useRef(null);    // Y.Map "r:c" -> bg color key
  const textColorsRef = useRef(null);// Y.Map "r:c" -> hex
  const widthsRef = useRef(null);    // Y.Map "c" -> width px (persisted)
  const dropdownsRef = useRef(null); // Y.Map "c" -> { from: row, options: [{ v, c }] }
  const metaRef = useRef(null);      // Y.Map sheet settings ("wrap": false turns wrapping off)
  const undoRef = useRef(null);      // Y.UndoManager: Ctrl+Z / Ctrl+Y for THIS admin's own edits
  const awarenessRef = useRef(null);
  const applyingRemote = useRef(false);
  const fileInputRef = useRef(null); // hidden <input type=file> for CSV import

  const [status, setStatus] = useState("connecting");
  const [peers, setPeers] = useState([]);
  const [peerCursors, setPeerCursors] = useState([]); // [{user, cell:[r,c], typing}]
  const [colorOpen, setColorOpen] = useState(false);
  const [textColorOpen, setTextColorOpen] = useState(false);
  const [ready, setReady] = useState(false);

  const [rowCount, setRowCount] = useState(MIN_ROWS);
  const [colWidths, setColWidths] = useState({});      // c -> px
  const [dropdowns, setDropdowns] = useState({});      // c -> { from, options }
  const [wrap, setWrap] = useState(true);              // shared per sheet, on unless turned off
  const [ddOpen, setDdOpen] = useState(false);         // dropdown setup panel
  const [charW, setCharW] = useState(7.5);             // measured monospace character width
  const [multi, setMulti] = useState(() => new Set()); // Ctrl/Shift-click selection, "r:c" keys
  const multiRef = useRef(multi);
  multiRef.current = multi;
  const anchorRef = useRef(null);                      // where a Shift-click block starts
  const fillRef = useRef(null);                        // fillSelectedInColumn (defined further down)
  const surfaceRef = useRef(null);                     // the whole sheet (fullscreen target)
  const [full, setFull] = useState(false);             // fullscreen on/off
  const [dataVersion, setDataVersion] = useState(0);   // bump to re-read Yjs
  const [selected, setSelected] = useState({ rowIdx: 0, colKey: "c0" });
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // how many rows to show: max filled row + buffer, at least MIN_ROWS
  const computeRowCount = useCallback(() => {
    const yCells = cellsRef.current;
    if (!yCells) return MIN_ROWS;
    let maxRow = -1;
    yCells.forEach((_v, k) => {
      const r = parseInt(k.split(":")[0], 10);
      if (Number.isFinite(r) && r > maxRow) maxRow = r;
    });
    return Math.max(MIN_ROWS, maxRow + 1 + ROW_BUFFER);
  }, []);

  // ── Yjs + relay (collaboration core, unchanged data shapes) ──
  useEffect(() => {
    if (!docId) return;
    let destroyed = false;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    const room = docId; // bare docId - backend keys relay room + Postgres row off this
    const provider = new WebsocketProvider(WS_BASE, room, ydoc, { connect: true });
    providerRef.current = provider;

    const yCells = ydoc.getMap("cells");
    const yStyles = ydoc.getMap("styles");
    const yTextColors = ydoc.getMap("textColors");
    const yWidths = ydoc.getMap("colWidths");
    const yDropdowns = ydoc.getMap("dropdowns");  // additive, like colWidths
    const yMeta = ydoc.getMap("sheetMeta");       // additive
    dropdownsRef.current = yDropdowns;
    metaRef.current = yMeta;
    // Undo tracks only local changes (transactions with no origin); what arrives
    // from the relay / other admins carries the provider as origin and is never undone.
    const undo = new Y.UndoManager([yCells, yStyles, yTextColors], { captureTimeout: 400 });
    undoRef.current = undo;
    cellsRef.current = yCells;
    stylesRef.current = yStyles;
    textColorsRef.current = yTextColors;
    widthsRef.current = yWidths;
    awarenessRef.current = provider.awareness;

    provider.on("status", (e) => {
      if (destroyed) return;
      setStatus(e.status === "connected" ? "connected" : e.status === "connecting" ? "connecting" : "offline");
    });

    provider.awareness.setLocalStateField("user", {
      name: me.name, color: me.color, id: me.id, initials: me.initials,
    });
    const refreshPeers = () => {
      if (destroyed) return;
      const states = [...provider.awareness.getStates().entries()];
      const others = states
        .filter(([cid]) => cid !== provider.awareness.clientID)
        .map(([, s]) => s).filter((s) => s && s.user);
      const seen = new Set(); const uniq = []; const cursors = [];
      for (const s of others) {
        const u = s.user;
        const k = u.id || u.name; if (seen.has(k)) continue; seen.add(k); uniq.push(u);
        const cell = s.cursor && Array.isArray(s.cursor.cell) ? s.cursor.cell : null;
        const typing = s.cursor && s.cursor.typing != null ? s.cursor.typing : null;
        if (cell) cursors.push({ user: u, cell, typing });
      }
      setPeers(uniq);
      setPeerCursors(cursors);
    };
    provider.awareness.on("change", refreshPeers);

    const bump = () => { if (!destroyed) { setRowCount(computeRowCount()); setDataVersion((v) => v + 1); } };
    const onCells = () => { if (applyingRemote.current) return; bump(); };
    yCells.observe(onCells);
    yStyles.observe(bump);
    yTextColors.observe(bump);

    const loadWidths = () => {
      if (destroyed) return;
      const w = {};
      yWidths.forEach((px, c) => { const ci = parseInt(c, 10); if (Number.isFinite(ci)) w[ci] = px; });
      setColWidths(w);
    };
    yWidths.observe(loadWidths);

    const loadDropdowns = () => {
      if (destroyed) return;
      const d = {};
      yDropdowns.forEach((val, c) => {
        const ci = parseInt(c, 10);
        if (Number.isFinite(ci) && val && Array.isArray(val.options) && val.options.length) {
          d[ci] = { from: Number.isFinite(val.from) ? val.from : 0, options: val.options };
        }
      });
      setDropdowns(d);
    };
    yDropdowns.observe(loadDropdowns);
    const loadMeta = () => { if (!destroyed) setWrap(yMeta.get("wrap") !== false); };
    yMeta.observe(loadMeta);

    const onSync = () => {
      if (destroyed) return;
      setReady(true);
      setRowCount(computeRowCount());
      loadWidths();
      loadDropdowns();
      loadMeta();
      setDataVersion((v) => v + 1);
    };
    provider.on("sync", onSync);
    const t = setTimeout(() => {
      if (!destroyed) { setReady(true); setRowCount(computeRowCount()); loadWidths(); loadDropdowns(); loadMeta(); setDataVersion((v) => v + 1); }
    }, 400);

    return () => {
      destroyed = true;
      clearTimeout(t);
      try { yCells.unobserve(onCells); } catch {}
      try { yStyles.unobserve(bump); } catch {}
      try { yTextColors.unobserve(bump); } catch {}
      try { yWidths.unobserve(loadWidths); } catch {}
      try { undo.destroy(); } catch {}
      undoRef.current = null;
      try { yDropdowns.unobserve(loadDropdowns); } catch {}
      try { yMeta.unobserve(loadMeta); } catch {}
      try { provider.awareness.off("change", refreshPeers); } catch {}
      try { provider.disconnect(); } catch {}
      try { provider.destroy(); } catch {}
      try { ydoc.destroy(); } catch {}
    };
  }, [docId, me, computeRowCount]);

  // ── rows array react-data-grid renders, derived from Yjs ──
  // the dropdown that applies to a cell, if any
  const ddFor = useCallback((c, r) => {
    const d = dropdowns[c];
    return d && r >= d.from ? d : null;
  }, [dropdowns]);

  const rows = useMemo(() => {
    const yCells = cellsRef.current;
    const cpl = []; // characters per line, per column
    for (let c = 0; c < DEFAULT_COLS; c++) {
      cpl[c] = Math.max(1, Math.floor(((colWidths[c] ?? COL_WIDTH) - CELL_PAD_H) / charW));
    }
    const out = [];
    for (let r = 0; r < rowCount; r++) {
      const row = { _idx: r + 1, _r: r, _h: ROW_MIN_H };
      let lines = 1;
      for (let c = 0; c < DEFAULT_COLS; c++) {
        const v = yCells ? (yCells.get(`${r}:${c}`) ?? "") : "";
        row[`c${c}`] = v;
        if (wrap && v !== "") {
          const width = ddFor(c, r) ? Math.max(1, cpl[c] - Math.ceil(DD_ARROW_W / charW)) : cpl[c];
          if (v.length > width || v.indexOf("\n") >= 0) lines = Math.max(lines, wrapLines(v, width));
        }
      }
      row._h = Math.min(ROW_MAX_H, Math.max(ROW_MIN_H, lines * LINE_H + ROW_PAD_V));
      out.push(row);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowCount, dataVersion, colWidths, wrap, charW, ddFor]);

  // measure the real character width of the sheet font (letter spacing included)
  const gridWrapRef = useRef(null);
  useEffect(() => {
    let alive = true;
    const measure = () => {
      const host = gridWrapRef.current && gridWrapRef.current.querySelector(".rdg");
      if (!alive || !host) return;
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;top:0;left:0";
      probe.textContent = "M".repeat(40);
      host.appendChild(probe);
      const w = probe.getBoundingClientRect().width / 40;
      probe.remove();
      if (w > 2 && w < 30) setCharW(w);
    };
    const t = setTimeout(measure, 50);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(measure, 0));
    return () => { alive = false; clearTimeout(t); };
  }, [ready]);

  const writeCell = useCallback((r, c, value) => {
    const ydoc = ydocRef.current; const yCells = cellsRef.current;
    if (!ydoc || !yCells) return;
    ydoc.transact(() => {
      if (value === "" || value === null || value === undefined) yCells.delete(`${r}:${c}`);
      else yCells.set(`${r}:${c}`, String(value));
    });
  }, []);

  const onRowsChange = useCallback((newRows, { indexes, column }) => {
    const yCells = cellsRef.current;
    if (!yCells) return;
    applyingRemote.current = true; // our own write - don't echo a rebuild
    try {
      for (const i of indexes) {
        const row = newRows[i];
        const r = row._r;
        const c = parseInt(column.key.slice(1), 10); // "c3" -> 3
        if (Number.isFinite(c)) writeCell(r, c, row[`c${c}`]);
      }
    } finally {
      applyingRemote.current = false;
    }
    setRowCount(computeRowCount());
    setDataVersion((v) => v + 1);
  }, [writeCell, computeRowCount]);

  // ── CSV import ──────────────────────────────────────────────────────────
  // A small, correct RFC-4180-ish parser: handles quoted fields, escaped
  // quotes (""), and commas / newlines embedded inside quotes. Returns a 2D
  // array of strings (rows of cells). We avoid pulling in a CSV dependency so
  // the build stays unchanged.
  const parseCsv = useCallback((text) => {
    // Normalize newlines; strip a leading UTF-8 BOM if present.
    const s = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inQuotes) {
        if (ch === '"') {
          if (s[i + 1] === '"') { field += '"'; i++; }   // escaped quote
          else inQuotes = false;                           // end of quoted field
        } else field += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ",") { row.push(field); field = ""; }
        else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
        else field += ch;
      }
    }
    // flush trailing field/row (file may not end with newline)
    if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
    // drop a single trailing fully-empty row (common from a final newline)
    if (rows.length && rows[rows.length - 1].every((c) => c === "")) rows.pop();
    return rows;
  }, []);

  // Where to drop the data: anchor at the currently selected cell so admins can
  // place an import wherever the cursor is. Defaults to A1 (0:0).
  const importCsvText = useCallback((text) => {
    const ydoc = ydocRef.current; const yCells = cellsRef.current;
    if (!ydoc || !yCells) return;
    const grid = parseCsv(text);
    if (!grid.length) return;
    const sel = selectedRef.current || { rowIdx: 0, colKey: "c0" };
    const baseR = Number.isFinite(sel.rowIdx) ? sel.rowIdx : 0;
    const baseC = parseInt(String(sel.colKey || "c0").slice(1), 10) || 0;
    let cellCount = 0;
    applyingRemote.current = true; // our own bulk write - suppress echo rebuilds
    try {
      ydoc.transact(() => {                // one transaction = one relay broadcast
        for (let ri = 0; ri < grid.length; ri++) {
          const cols = grid[ri];
          for (let ci = 0; ci < cols.length; ci++) {
            const val = cols[ci];
            const key = `${baseR + ri}:${baseC + ci}`;
            if (val === "" || val == null) yCells.delete(key);
            else { yCells.set(key, String(val)); cellCount++; }
          }
        }
      });
    } finally {
      applyingRemote.current = false;
    }
    setRowCount(computeRowCount());
    setDataVersion((v) => v + 1);
  }, [parseCsv, computeRowCount]);

  const onCsvFile = useCallback((e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file later
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importCsvText(String(reader.result || ""));
    reader.onerror = () => {};
    reader.readAsText(file);
  }, [importCsvText]);

  // ── XLSX import (with colours) ──────────────────────────────────────────
  // CSV can only carry text. To import a STYLED .xlsx - fill colours + font
  // colours - we hand the file to the backend (routers/workspace_import.py),
  // which reads it with openpyxl and returns three already-mapped maps:
  //   { cells:{ "r:c":text }, styles:{ "r:c":paletteKey }, textColors:{ "r:c":hex } }
  // We then write all three into the SAME Yjs maps the 🎨 button uses, inside a
  // single transaction → the relay persists + broadcasts once, so the imported
  // sheet (data AND colour) appears live for every connected admin and survives
  // reload. Anchored at the selected cell, same as CSV.
  const [importing, setImporting] = useState(false);

  const importXlsxMaps = useCallback((data) => {
    const ydoc = ydocRef.current;
    const yCells = cellsRef.current;
    const yStyles = stylesRef.current;
    const yText = textColorsRef.current;
    if (!ydoc || !yCells || !yStyles || !yText) return;

    const sel = selectedRef.current || { rowIdx: 0, colKey: "c0" };
    const baseR = Number.isFinite(sel.rowIdx) ? sel.rowIdx : 0;
    const baseC = parseInt(String(sel.colKey || "c0").slice(1), 10) || 0;

    // helper: shift an "r:c" key by the anchor offset
    const shift = (k) => {
      const [r, c] = k.split(":").map((n) => parseInt(n, 10));
      return `${baseR + r}:${baseC + c}`;
    };

    // ── Batched writes ──────────────────────────────────────────────────────
    // A big sheet (e.g. Tailor: ~2,800 rows × 18 cols ≈ 54k map entries) written
    // in ONE transaction produces a single ~1.4 MB Yjs update. That lone message
    // can exceed the websocket relay's max-message size, which drops the socket
    // mid-sync and surfaces in the UI as a generic "Failed to fetch". Splitting
    // the writes into smaller transactions keeps every update message tiny, so
    // the import syncs reliably no matter how large the workbook is (and the UI
    // doesn't freeze on one huge apply).
    const BATCH = 4000; // map ops per transaction → each update stays well under 1 MB

    // Flatten all three maps into a single ordered list of write ops so we can
    // chunk them uniformly regardless of which map they target.
    const ops = [];
    for (const [k, v] of Object.entries(data.cells || {})) {
      ops.push(["cell", shift(k), v]);
    }
    for (const [k, v] of Object.entries(data.styles || {})) {
      ops.push(["style", shift(k), v]);
    }
    for (const [k, v] of Object.entries(data.textColors || {})) {
      ops.push(["text", shift(k), v]);
    }

    applyingRemote.current = true; // bulk write - suppress echo rebuilds
    try {
      for (let i = 0; i < ops.length; i += BATCH) {
        const slice = ops.slice(i, i + BATCH);
        ydoc.transact(() => {
          for (const [kind, key, v] of slice) {
            if (kind === "cell") {
              if (v === "" || v == null) yCells.delete(key);
              else yCells.set(key, String(v));
            } else if (kind === "style") {
              if (v) yStyles.set(key, v); else yStyles.delete(key);
            } else {
              if (v) yText.set(key, v); else yText.delete(key);
            }
          }
        });
      }
    } finally {
      applyingRemote.current = false;
    }
    setRowCount(computeRowCount());
    setDataVersion((v) => v + 1);
  }, [computeRowCount]);

  const onXlsxFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(
        "https://api.stateofundeadpurge.site:8443/api/workspace/import-xlsx",
        { method: "POST", credentials: "include", body: fd }
      );
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`HTTP ${r.status} ${txt.slice(0, 140)}`);
      }
      const data = await r.json();
      importXlsxMaps(data);
      if (data.truncated_cols) {
        // non-fatal: warn that columns beyond the grid width were skipped
        // eslint-disable-next-line no-alert
        alert(
          `Imported ${data.rows} rows. Note: this workbook has more than ${DEFAULT_COLS} columns, ` +
          `so columns beyond ${DEFAULT_COLS} were not imported.`
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(`XLSX import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  }, [importXlsxMaps]);

  const xlsxInputRef = useRef(null);

  // ── XLSX export (with colours) ──────────────────────────────────────────
  // Reverse of import: walk the three Yjs maps into plain JSON, POST to the
  // backend which rebuilds a styled .xlsx via openpyxl, and trigger a download.
  // Symmetrical with import (server-side styling) so colours round-trip exactly.
  const [exporting, setExporting] = useState(false);

  const onExportXlsx = useCallback(async () => {
    const yCells = cellsRef.current;
    const yStyles = stylesRef.current;
    const yText = textColorsRef.current;
    if (!yCells) return;
    setExporting(true);
    try {
      const cells = {}, styles = {}, textColors = {};
      let maxR = 0, maxC = 0;
      yCells.forEach((v, k) => {
        if (v === "" || v == null) return;
        cells[k] = String(v);
        const [r, c] = k.split(":").map(Number);
        if (r > maxR) maxR = r;
        if (c > maxC) maxC = c;
      });
      if (yStyles) yStyles.forEach((v, k) => { if (v) styles[k] = v; });
      if (yText) yText.forEach((v, k) => { if (v) textColors[k] = v; });
      // dropdown option colours show on screen, so the file gets them too
      // (only where the cell has no colour of its own, same rule as the grid)
      for (const [k, v] of Object.entries(cells)) {
        if (styles[k]) continue;
        const [r, c] = k.split(":").map(Number);
        const d = dropdowns[c];
        if (!d || r < d.from) continue;
        const opt = d.options.find((o) => o.v === v);
        if (opt && opt.c) styles[k] = opt.c;
      }

      const body = JSON.stringify({
        sheet_name: (typeof docTitle === "string" && docTitle) ? docTitle : "Sheet1",
        rows: maxR + 1,
        cols: maxC + 1,
        cells, styles, textColors,
      });

      const r = await fetch(
        "https://api.stateofundeadpurge.site:8443/api/workspace/export-xlsx",
        { method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" }, body }
      );
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`HTTP ${r.status} ${txt.slice(0, 140)}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = ((typeof docTitle === "string" && docTitle) ? docTitle : "sheet")
        .replace(/[^a-z0-9_-]+/gi, "_") + ".xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(`XLSX export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }, [docTitle, dropdowns]);

  const cellStyle = useCallback((r, c) => {
    const yStyles = stylesRef.current;
    const yText = textColorsRef.current;
    const st = {};
    const bgKey = yStyles ? yStyles.get(`${r}:${c}`) : null;
    if (bgKey) st.background = colorBg(bgKey);
    const hex = yText ? yText.get(`${r}:${c}`) : null;
    if (hex) st.color = hex;
    return st;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion]);

  const columns = useMemo(() => {
    const idxCol = {
      key: "_idx", name: "", width: 48, frozen: true, resizable: false, sortable: false,
      cellClass: "rdg-index-cell",
      renderCell: ({ row }) => row._idx,
    };
    const dataCols = Array.from({ length: DEFAULT_COLS }, (_, c) => ({
      key: `c${c}`,
      name: colName(c),
      width: colWidths[c] ?? COL_WIDTH,
      resizable: true,
      renderEditCell: (props) => {
        const dd = ddFor(c, props.row._r);
        if (dd) return <DropdownEditor {...props} options={dd.options} portalTo={full ? surfaceRef.current : null}
          onPick={(v) => fillRef.current && fillRef.current(c, v, props.row._r)} />;
        return <WrapEditor {...props} />;
      },
      renderCell: ({ row }) => {
        const style = cellStyle(row._r, c);
        const peer = peerCursors.find((pc) => pc.cell[0] === row._r && pc.cell[1] === c);
        const value = row[`c${c}`] ?? "";
        const dd = ddFor(c, row._r);
        let offList = false;
        if (dd && value !== "") {
          const opt = dd.options.find((o) => o.v === value);
          if (!opt) offList = true;                                          // typed before the list existed
          else if (opt.c && !style.background) style.background = colorBg(opt.c); // 🎨 on the cell still wins
        }
        const shown = peer && peer.typing != null && peer.typing !== "" ? peer.typing : value;
        const picked = multi.size > 0 && multi.has(`${row._r}:${c}`);
        return (
          <div style={{
            width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 4,
            padding: "0 6px", boxSizing: "border-box", position: "relative",
            ...style,
            ...(peer ? { boxShadow: `inset 0 0 0 2px ${peer.user.color || "#4a8fc4"}` } : {}),
          }}>
            <span title={offList ? "Not one of this column's dropdown options" : undefined} style={wrap ? {
              flex: 1, minWidth: 0, maxHeight: "100%", overflow: "hidden", whiteSpace: "pre-wrap",
              overflowWrap: "anywhere", lineHeight: `${LINE_H}px`,
              ...(offList ? { textDecoration: "underline dotted #e05555" } : {}),
            } : {
              flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              ...(offList ? { textDecoration: "underline dotted #e05555" } : {}),
            }}>
              {shown}
            </span>
            {dd && <span data-dd="1" className="ss-dd-arrow" title="Pick from the list">▾</span>}
            {picked && <span className="ss-picked" />}
            {peer && (
              <span style={{
                position: "absolute", top: -14, left: -1, background: peer.user.color || "#4a8fc4",
                color: "#0a0a0a", fontFamily: "var(--mono)", fontSize: 8.5, lineHeight: "13px",
                padding: "0 4px", borderRadius: 2, whiteSpace: "nowrap", fontWeight: 600, zIndex: 6,
              }}>{peer.user.name}{peer.typing != null ? " ✎" : ""}</span>
            )}
          </div>
        );
      },
    }));
    return [idxCol, ...dataCols];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colWidths, peerCursors, dataVersion, cellStyle, ddFor, wrap, full, multi]);

  // Enter on a selected cell opens the editor. The grid switches to the editor
  // while that same keypress is still being handled, so without this the
  // browser would then type the Enter INTO the new text box: a stray line break
  // that replaces the (all-selected) cell text when you click away. Stop the
  // browser's part only; the grid still opens the editor.
  const onCellKeyDown = useCallback((args, event) => {
    if (args.mode === "SELECT" && event.key === "Enter") event.preventDefault();
    if (args.mode === "SELECT" && event.key === "Escape" && multiRef.current.size) setMulti(new Set());
    // Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo (your own edits only). While a cell is
    // open for typing, the text box keeps its own undo.
    if (args.mode === "SELECT" && (event.ctrlKey || event.metaKey) && !event.altKey) {
      const k = event.key.toLowerCase();
      // Ctrl+V: the grid would open the cell editor and the whole clipboard (rows,
      // tabs and all) would land in ONE cell. Keep the cell closed so the paste
      // event reaches onPaste, which spreads it over the cells.
      if (k === "v") event.preventGridDefault();
      if (k === "z" || k === "y") {
        event.preventDefault();
        event.preventGridDefault();
        undoFnRef.current(k === "y" || (k === "z" && event.shiftKey));
      }
    }
  }, []);

  // Clicks: ▾ opens a dropdown; Ctrl/Cmd+click adds or removes a cell from the
  // selection; Shift+click selects the block from the last plain-clicked cell;
  // a plain click starts over. The grid still moves its own cursor each time.
  const onCellClick = useCallback((args, event) => {
    const t = event && event.target;
    const key = args.column && args.column.key;
    const c = key && key.startsWith("c") ? parseInt(key.slice(1), 10) : NaN;
    const r = args.row ? args.row._r : NaN;
    if (!Number.isFinite(c) || !Number.isFinite(r)) return;

    if (event.ctrlKey || event.metaKey) {
      setMulti((prev) => {
        const next = new Set(prev);
        if (next.size === 0) { // the cell you were on counts as the first one, like Sheets
          const s = selectedRef.current;
          const sc = s && s.colKey && s.colKey.startsWith("c") ? parseInt(s.colKey.slice(1), 10) : NaN;
          if (Number.isFinite(sc) && Number.isFinite(s.rowIdx)) next.add(`${s.rowIdx}:${sc}`);
        }
        const k = `${r}:${c}`;
        if (next.has(k) && next.size > 1) next.delete(k); else next.add(k);
        return next;
      });
      return;
    }
    if (event.shiftKey) {
      let a = anchorRef.current;
      if (!a) {
        const s = selectedRef.current;
        const sc = s && s.colKey && s.colKey.startsWith("c") ? parseInt(s.colKey.slice(1), 10) : 0;
        a = { r: s ? s.rowIdx || 0 : 0, c: Number.isFinite(sc) ? sc : 0 };
        anchorRef.current = a;
      }
      const next = new Set();
      for (let rr = Math.min(a.r, r); rr <= Math.max(a.r, r); rr++) {
        for (let cc = Math.min(a.c, c); cc <= Math.max(a.c, c); cc++) next.add(`${rr}:${cc}`);
      }
      setMulti(next);
      return;
    }
    const onArrow = !!(t && t.closest && t.closest("[data-dd]"));
    // ▾ on one of the selected cells keeps the selection, so the pick fills them all
    if (!(onArrow && multiRef.current.has(`${r}:${c}`))) {
      anchorRef.current = { r, c };
      if (multiRef.current.size) setMulti(new Set());
    }

    if (onArrow) {
      event.preventGridDefault(); // else the grid's own click handling switches it back to plain selection
      args.selectCell(true);
    }
  }, []);

  // picking a dropdown value while several cells are selected fills all of the
  // selected cells that use the same dropdown (same column, at/below its start row)
  const fillSelectedInColumn = useCallback((c, value, exceptRow) => {
    const ydoc = ydocRef.current; const yCells = cellsRef.current;
    const d = dropdowns[c];
    if (!ydoc || !yCells || !d || multiRef.current.size < 2) return;
    ydoc.transact(() => {
      for (const k of multiRef.current) {
        const [r, cc] = k.split(":").map(Number);
        if (cc !== c || r < d.from || r === exceptRow) continue;
        if (value === "") yCells.delete(`${r}:${c}`); else yCells.set(`${r}:${c}`, String(value));
      }
    });
  }, [dropdowns]);
  fillRef.current = fillSelectedInColumn;

  // short note in the status strip ("Copied 4 cells", "Undone", ...)
  const [flash, setFlash] = useState("");
  const flashT = useRef(null);
  const say = useCallback((msg) => {
    setFlash(msg);
    clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(""), 2200);
  }, []);
  useEffect(() => () => clearTimeout(flashT.current), []);

  // ── Copy / paste (native clipboard events, so they work like any app) ──
  // Not while a cell is open for typing: then the text box copies/pastes normally.
  const isTyping = (t) => t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT");

  const onCopy = useCallback((e) => {
    if (isTyping(e.target)) return;
    const yCells = cellsRef.current;
    if (!yCells) return;
    let keys = [...multiRef.current];
    if (!keys.length) {
      const s = selectedRef.current;
      const c = s && s.colKey && s.colKey.startsWith("c") ? parseInt(s.colKey.slice(1), 10) : NaN;
      if (!Number.isFinite(c)) return;
      keys = [`${s.rowIdx}:${c}`];
    }
    // the block that holds every selected cell; cells inside it that aren't selected stay empty
    let r0 = Infinity, r1 = -1, c0 = Infinity, c1 = -1;
    for (const k of keys) {
      const [r, c] = k.split(":").map(Number);
      r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c);
    }
    const picked = new Set(keys);
    const lines = [];
    for (let r = r0; r <= r1; r++) {
      const out = [];
      for (let c = c0; c <= c1; c++) out.push(picked.has(`${r}:${c}`) ? tsvField(yCells.get(`${r}:${c}`) ?? "") : "");
      lines.push(out.join("\t"));
    }
    e.clipboardData.setData("text/plain", lines.join("\n"));
    e.preventDefault();
    say(keys.length === 1 ? "Copied 1 cell" : `Copied ${keys.length} cells`);
  }, [say]);

  const onPaste = useCallback((e) => {
    if (isTyping(e.target)) return;
    const ydoc = ydocRef.current; const yCells = cellsRef.current;
    if (!ydoc || !yCells) return;
    const text = e.clipboardData ? e.clipboardData.getData("text/plain") : "";
    if (!text) return;
    e.preventDefault();
    const grid = parseTsv(text);
    if (!grid.length) return;
    const write = (k, v) => { if (v === "" || v == null) yCells.delete(k); else yCells.set(k, String(v)); };
    let count = 0, skipped = 0;
    if (grid.length === 1 && grid[0].length === 1 && multiRef.current.size > 1) {
      // one value onto several selected cells: fill them all (like Sheets)
      ydoc.transact(() => { for (const k of multiRef.current) { write(k, grid[0][0]); count++; } });
    } else {
      const s = selectedRef.current || { rowIdx: 0, colKey: "c0" };
      const baseR = Number.isFinite(s.rowIdx) ? s.rowIdx : 0;
      const baseC = parseInt(String(s.colKey || "c0").slice(1), 10) || 0;
      ydoc.transact(() => {
        for (let ri = 0; ri < grid.length; ri++) {
          for (let ci = 0; ci < grid[ri].length; ci++) {
            const c = baseC + ci;
            if (c >= DEFAULT_COLS) { skipped++; continue; }
            write(`${baseR + ri}:${c}`, grid[ri][ci]); count++;
          }
        }
      });
    }
    setRowCount(computeRowCount());
    setDataVersion((v) => v + 1);
    say(`Pasted ${count} cell${count === 1 ? "" : "s"}${skipped ? ` (${skipped} past column ${colName(DEFAULT_COLS - 1)} left out)` : ""} · Ctrl+Z to undo`);
  }, [computeRowCount, say]);

  // Chrome only runs Copy / Paste when there is selected text or an editable box.
  // A grid cell is neither, so Ctrl+C / Ctrl+V did nothing at all. Cancelling
  // "beforecopy" / "beforepaste" is how a page says "I handle these myself".
  // With nothing selected Chrome sends all four events to <body>, not to the
  // focused cell, so they are caught on the document. The sheet only takes them
  // when a cell of THIS grid has focus, no cell is open for typing, and no other
  // text on the page is selected (then the browser copies that, as usual).
  const copyRef = useRef(onCopy); copyRef.current = onCopy;
  const pasteRef = useRef(onPaste); pasteRef.current = onPaste;
  useEffect(() => {
    const owns = () => {
      const el = gridWrapRef.current;
      const a = document.activeElement;
      if (!el || !a || !el.contains(a) || isTyping(a)) return false;
      const s = window.getSelection && window.getSelection();
      if (s && s.type === "Range" && !el.contains(s.anchorNode)) return false;
      return true;
    };
    const claim = (e) => { if (owns()) e.preventDefault(); };
    const copy = (e) => { if (owns()) copyRef.current(e); };
    const paste = (e) => { if (owns()) pasteRef.current(e); };
    document.addEventListener("beforecopy", claim);
    document.addEventListener("beforepaste", claim);
    document.addEventListener("copy", copy);
    document.addEventListener("paste", paste);
    return () => {
      document.removeEventListener("beforecopy", claim);
      document.removeEventListener("beforepaste", claim);
      document.removeEventListener("copy", copy);
      document.removeEventListener("paste", paste);
    };
  }, []);

  const doUndo = useCallback((redo) => {
    const u = undoRef.current;
    if (!u) return;
    const can = redo ? u.redoStack.length : u.undoStack.length;
    if (!can) { say(redo ? "Nothing to redo" : "Nothing to undo"); return; }
    if (redo) u.redo(); else u.undo();
    setRowCount(computeRowCount());
    setDataVersion((v) => v + 1);
    say(redo ? "Redone" : "Undone");
  }, [computeRowCount, say]);
  const undoFnRef = useRef(doUndo);
  undoFnRef.current = doUndo;

  const onColumnResize = useCallback((column, width) => {
    const ydoc = ydocRef.current; const yWidths = widthsRef.current;
    if (!ydoc || !yWidths || !column.key.startsWith("c")) return;
    const c = parseInt(column.key.slice(1), 10);
    if (!Number.isFinite(c)) return;
    ydoc.transact(() => { yWidths.set(String(c), Math.round(width)); });
  }, []);

  const onSelectedCellChange = useCallback((args) => {
    const aw = awarenessRef.current;
    if (!args || !args.row) return;
    const r = args.row._r;
    const c = args.column && args.column.key && args.column.key.startsWith("c")
      ? parseInt(args.column.key.slice(1), 10) : null;
    setSelected({ rowIdx: r, colKey: args.column ? args.column.key : "c0" });
    if (aw && c != null && Number.isFinite(c)) {
      try { aw.setLocalStateField("cursor", { cell: [r, c] }); } catch {}
    }
  }, []);

  const applyColorToSelection = useCallback((val, isText) => {
    const ydoc = ydocRef.current;
    const map = isText ? textColorsRef.current : stylesRef.current;
    if (!ydoc || !map) return;
    let keys;
    if (multiRef.current.size) keys = [...multiRef.current];   // every Ctrl/Shift-selected cell
    else {
      const sel = selectedRef.current;
      const c = sel.colKey && sel.colKey.startsWith("c") ? parseInt(sel.colKey.slice(1), 10) : null;
      if (c == null || !Number.isFinite(c)) return;
      keys = [`${sel.rowIdx}:${c}`];
    }
    ydoc.transact(() => {
      for (const k of keys) {
        if (val) map.set(k, val);
        else map.delete(k);
      }
    });
    setDataVersion((v) => v + 1);
  }, []);

  // ── Fullscreen ──────────────────────────────────────────────────────────
  // The sheet covers the whole window (fixed overlay) and also asks the browser
  // for real fullscreen, so the site menu, the project list and the browser bars
  // all go away. If the browser refuses, the overlay alone still works. Leaving:
  // the same button, or Esc (the browser handles Esc in real fullscreen; in the
  // overlay we skip Esc while a cell is being edited, so it only cancels the edit).
  const toggleFull = useCallback(() => {
    if (full) {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
      setFull(false);
      return;
    }
    setFull(true);
    const el = surfaceRef.current;
    if (el && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }, [full]);

  useEffect(() => {
    if (!full) return;
    let native = false;
    const onFs = () => {
      if (document.fullscreenElement === surfaceRef.current) native = true;
      else if (native) setFull(false); // browser fullscreen ended (Esc / F11): leave the overlay too
    };
    const onKey = (e) => {
      if (e.key !== "Escape" || document.fullscreenElement) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (multiRef.current.size) { setMulti(new Set()); return; } // first Esc clears the selection
      setFull(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [full]);

  // switching to another doc (unmount) while fullscreen: give the screen back
  useEffect(() => () => {
    if (document.fullscreenElement && document.fullscreenElement === surfaceRef.current && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // ── Wrap + dropdown settings (shared per sheet through Yjs, like column widths) ──
  const toggleWrap = useCallback(() => {
    const ydoc = ydocRef.current; const yMeta = metaRef.current;
    if (!ydoc || !yMeta) return;
    ydoc.transact(() => { yMeta.set("wrap", !wrap); });
  }, [wrap]);

  const selCol = (() => {
    const k = selected.colKey;
    const c = k && k.startsWith("c") ? parseInt(k.slice(1), 10) : NaN;
    return Number.isFinite(c) ? c : 0;
  })();

  const columnValues = useCallback((fromRow) => {
    const yCells = cellsRef.current;
    if (!yCells) return [];
    const seen = new Set(); const out = [];
    yCells.forEach((v, k) => {
      const [r, c] = k.split(":").map(Number);
      if (c !== selCol || r < fromRow) return;
      const s = String(v).trim();
      if (s && !seen.has(s) && s.length <= 60 && s.indexOf("\n") < 0) { seen.add(s); out.push(s); }
    });
    return out;
  }, [selCol]);

  const saveDropdown = useCallback((cfg) => {
    const ydoc = ydocRef.current; const yDd = dropdownsRef.current;
    if (!ydoc || !yDd) return;
    ydoc.transact(() => { yDd.set(String(selCol), cfg); });
    setDdOpen(false);
  }, [selCol]);

  const removeDropdown = useCallback(() => {
    const ydoc = ydocRef.current; const yDd = dropdownsRef.current;
    if (!ydoc || !yDd) return;
    ydoc.transact(() => { yDd.delete(String(selCol)); });
    setDdOpen(false);
  }, [selCol]);

  const setColor = (key) => { setColorOpen(false); applyColorToSelection(key, false); };
  const setTextColor = (hex) => { setTextColorOpen(false); applyColorToSelection(hex, true); };

  const statusMeta = {
    connected:  { dot: "#4caf7d", color: "#4caf7d", label: "live" },
    connecting: { dot: "#d4b24b", color: "#d4b24b", label: "connecting" },
    offline:    { dot: "#e05555", color: "#e05555", label: "offline" },
  }[status] || { dot: "#888", color: "#888", label: status };

  return (
    <div className={"ss-surface" + (full ? " ss-full" : "")} ref={surfaceRef}>
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
        {flash && (
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "#4caf7d", marginRight: 12 }}>
            {flash}
          </span>
        )}
        {multi.size > 1 && (
          <span title="Colours and dropdown picks apply to all of them. Click a cell (or Esc) to clear."
            style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--accent)", marginRight: 12 }}>
            {multi.size} cells selected
          </span>
        )}
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--textdim)" }}>
          {ready ? "spreadsheet" : "loading…"}
        </span>
      </div>

      {/* toolbar */}
      <div className="ss-toolbar">
        <div style={{ position: "relative" }}>
          <button className={"ss-btn" + (colorOpen ? " active" : "")} title="Cell background color" onClick={() => { setTextColorOpen(false); setColorOpen((o) => !o); }}>🎨</button>
          {colorOpen && (
            <div style={{
              position: "absolute", top: 34, left: 0, zIndex: 40, background: "var(--surface)",
              border: "1px solid var(--border)", borderRadius: 3, padding: 8,
              boxShadow: "0 6px 24px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", gap: 6, minWidth: 150,
            }}>
              {CELL_COLORS.map((col) => (
                <button key={col.key} title={col.label} onClick={() => setColor(col.key)} style={pickerItem}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--textdim)"; }}>
                  <span style={{ width: 14, height: 14, borderRadius: 2, background: col.bg, flexShrink: 0 }} />
                  {col.label}
                </button>
              ))}
              <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />
              <button onClick={() => setColor(null)} style={pickerItem}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--textdim)"; }}>
                <span style={{ width: 14, height: 14, borderRadius: 2, border: "1px solid var(--muted)", flexShrink: 0 }} />
                Clear color
              </button>
            </div>
          )}
        </div>
        <div style={{ position: "relative" }}>
          <button className={"ss-btn" + (textColorOpen ? " active" : "")} title="Font color" onClick={() => { setColorOpen(false); setTextColorOpen((o) => !o); }}>
            <span style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:1 }}>
              <span style={{ fontSize:11,fontWeight:700,lineHeight:1 }}>A</span>
              <span style={{ width:14,height:3,borderRadius:1,background:"var(--accent)" }} />
            </span>
          </button>
          {textColorOpen && (
            <div style={{
              position: "absolute", top: 34, left: 0, zIndex: 40, background: "var(--surface)",
              border: "1px solid var(--border)", borderRadius: 3, padding: 8,
              boxShadow: "0 6px 24px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", gap: 6, minWidth: 140,
            }}>
              {TEXT_COLORS.filter(tc => tc.hex).map((tc) => (
                <button key={tc.key} title={tc.label} onClick={() => setTextColor(tc.hex)} style={pickerItem}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--textdim)"; }}>
                  <span style={{ width: 14, height: 14, borderRadius: 2, background: tc.hex, border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }} />
                  {tc.label}
                </button>
              ))}
              <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />
              <button onClick={() => setTextColor("")} style={pickerItem}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--textdim)"; }}>
                <span style={{ width: 14, height: 14, borderRadius: 2, border: "1px solid var(--muted)", flexShrink: 0 }} />
                Reset color
              </button>
            </div>
          )}
        </div>
        <button
          className="ss-btn"
          title="Import a CSV file - fills cells starting at the selected cell (A1 if none)"
          onClick={() => fileInputRef.current?.click()}
        >⬆ Import CSV</button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={onCsvFile}
          style={{ display: "none" }}
        />
        <button
          className="ss-btn"
          title="Import a styled .xlsx - keeps fill colours and font colours, mapped to the sheet palette. Fills from the selected cell."
          onClick={() => xlsxInputRef.current?.click()}
          disabled={importing}
          style={importing ? { opacity: 0.6, cursor: "wait" } : undefined}
        >{importing ? "importing…" : "⬆ Import XLSX"}</button>
        <input
          ref={xlsxInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={onXlsxFile}
          style={{ display: "none" }}
        />
        <button
          className="ss-btn"
          title="Download this sheet as a styled .xlsx - keeps fill colours and font colours."
          onClick={onExportXlsx}
          disabled={exporting}
          style={exporting ? { opacity: 0.6, cursor: "wait" } : undefined}
        >{exporting ? "exporting…" : "⬇ Export XLSX"}</button>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", marginLeft: 8, letterSpacing: 0.5, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          Ctrl+click / Shift+click to select several · Ctrl+C / Ctrl+V · Ctrl+Z undo · Alt+Enter new line · drag column edges to resize
        </span>
        <button
          className={"ss-btn" + (wrap ? " active" : "")}
          title={wrap ? "Wrap text is ON for this sheet: rows grow to fit long text. Click to turn off." : "Wrap text is OFF: long text is cut with … Click to turn on."}
          onClick={toggleWrap}
        >↵ Wrap</button>
        <div style={{ position: "relative" }}>
          <button
            className={"ss-btn" + (ddOpen || dropdowns[selCol] ? " active" : "")}
            title={`Dropdown list for column ${colName(selCol)} (select a cell in the column first)`}
            onClick={() => { setColorOpen(false); setTextColorOpen(false); setDdOpen((o) => !o); }}
          >▾ Dropdown {colName(selCol)}</button>
          {ddOpen && (
            <DropdownSetup
              key={selCol}
              col={selCol}
              startRow={selected.rowIdx || 0}
              existing={dropdowns[selCol] || null}
              columnValues={columnValues}
              onSave={saveDropdown}
              onRemove={removeDropdown}
              onCancel={() => setDdOpen(false)}
            />
          )}
        </div>
        <button
          className={"ss-btn" + (full ? " active" : "")}
          title={full ? "Back to the normal page (Esc)" : "Fill the whole screen with this sheet (Esc to leave)"}
          onClick={toggleFull}
        >{full ? "✕ Exit fullscreen" : "⛶ Fullscreen"}</button>
      </div>

      {/* grid - react-data-grid owns its own scroll viewport */}
      <div className="ss-grid-wrap" ref={gridWrapRef}>
        <DataGrid
          columns={columns}
          rows={rows}
          rowHeight={(row) => row._h}
          onCellClick={onCellClick}
          onCellKeyDown={onCellKeyDown}
          rowKeyGetter={(row) => row._r}
          onRowsChange={onRowsChange}
          onColumnResize={onColumnResize}
          onSelectedCellChange={onSelectedCellChange}
          className="rdg-dark"
          style={{ height: "100%" }}
          defaultColumnOptions={{ resizable: true }}
        />
      </div>
    </div>
  );
}
