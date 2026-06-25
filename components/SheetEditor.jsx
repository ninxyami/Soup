"use client";
// @ts-nocheck
// components/SheetEditor.jsx
//
// The collaborative SPREADSHEET surface — now built on react-data-grid (MIT,
// React-19 compatible) instead of jspreadsheet-ce. The switch fixes the entire
// class of scroll bugs that plagued the jspreadsheet version: react-data-grid
// owns its own virtualized scroll viewport, so horizontal/vertical overflow can
// never escape to the page and drag the sidebar away. Keyboard nav auto-scroll,
// column resize, and large row counts are all handled natively.
//
// COLLABORATION MODEL — UNCHANGED from the jspreadsheet version (the whole point):
//   The sheet is NOT serialized whole-doc. Each cell lives as its own key in a
//   Yjs Y.Map ("cells"), keyed "r:c" -> string value. Styles + text colors live
//   in parallel maps. Yjs is the source of truth; the grid is a view.
//     - Local edit  → write just that cell key into the Y.Map → relay broadcasts.
//     - Remote edit → observe the Y.Map → rebuild affected rows in React state.
//   Two admins editing DIFFERENT cells merge cleanly (separate keys). Same cell
//   resolves last-write-wins. Persists through the SAME pycrdt relay (no backend
//   change). Structured cells mean Zombita can still read {B5: 750}, not a blob.
//
//   IMPORTANT — data preserved: the Yjs maps ("cells"/"styles"/"textColors") and
//   the room name (bare docId) are byte-for-byte the same as the jspreadsheet
//   version, so every existing sheet loads unchanged. This is a VIEW swap, not a
//   data migration. The new "colWidths" map is additive (persisted column widths).
//
// SSR: react-data-grid touches the DOM, so this loads client-only via
// next/dynamic({ ssr:false }) from Workspace — same pattern as before.

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { DataGrid, textEditor } from "react-data-grid";
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
// "only keeps 30 rows" data-loss bug — we never cap reads at 30.
const MIN_ROWS = 30;
const DEFAULT_COLS = 16;
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

// column index -> "A".."Z","AA"...
const colName = (c) => {
  let s = ""; let n = c + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
};

// SOUP theming over react-data-grid's base CSS. Scoped under .ss-surface.
const SHEET_CSS = `
.ss-surface{display:flex;flex-direction:column;flex:1;min-height:0;min-width:0;height:100%}
.ss-status{display:flex;align-items:center;gap:12px;padding:8px 14px;border-bottom:1px solid var(--border);flex-shrink:0}
.ss-toolbar{display:flex;align-items:center;gap:6px;padding:6px 12px;border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:wrap}
.ss-btn{min-width:30px;height:30px;padding:0 8px;background:transparent;border:1px solid var(--border);color:var(--text);font-family:var(--mono);font-size:13px;cursor:pointer;border-radius:2px;display:flex;align-items:center;justify-content:center}
.ss-btn:hover{border-color:var(--accent)}
.ss-btn.active{border-color:var(--accent);color:var(--accent);background:rgba(200,168,75,0.06)}

/* ── react-data-grid theming — the grid owns its own scroll; we just style it ── */
.ss-grid-wrap{flex:1;min-height:0;min-width:0;position:relative;display:flex}
.ss-surface .rdg{
  flex:1; min-height:0; block-size:100%;
  border:none; font-family:var(--mono); font-size:12.5px;
  --rdg-color:var(--text);
  --rdg-background-color:var(--surface);
  --rdg-header-background-color:rgba(0,0,0,0.3);
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
  color:var(--text);
}
.ss-surface .rdg-index-cell{
  background:rgba(0,0,0,0.3);color:var(--textdim);font-size:10px;
  text-align:center;justify-content:center;display:flex;align-items:center;
}
.ss-surface .rdg-cell:focus,.ss-surface .rdg-cell:focus-within{outline:1.5px solid var(--accent);outline-offset:-2px}
.ss-surface input.rdg-text-editor,
.ss-surface .rdg-text-editor{
  font-family:var(--mono);font-size:12.5px;background:var(--bg,#0b0d10);
  color:var(--text);border:1.5px solid var(--accent);padding:0 6px;box-sizing:border-box;
}
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

export default function SheetEditor({ docId, me }) {
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const cellsRef = useRef(null);     // Y.Map "r:c" -> value
  const stylesRef = useRef(null);    // Y.Map "r:c" -> bg color key
  const textColorsRef = useRef(null);// Y.Map "r:c" -> hex
  const widthsRef = useRef(null);    // Y.Map "c" -> width px (persisted)
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
    const room = docId; // bare docId — backend keys relay room + Postgres row off this
    const provider = new WebsocketProvider(WS_BASE, room, ydoc, { connect: true });
    providerRef.current = provider;

    const yCells = ydoc.getMap("cells");
    const yStyles = ydoc.getMap("styles");
    const yTextColors = ydoc.getMap("textColors");
    const yWidths = ydoc.getMap("colWidths");
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

    const onSync = () => {
      if (destroyed) return;
      setReady(true);
      setRowCount(computeRowCount());
      loadWidths();
      setDataVersion((v) => v + 1);
    };
    provider.on("sync", onSync);
    const t = setTimeout(() => {
      if (!destroyed) { setReady(true); setRowCount(computeRowCount()); loadWidths(); setDataVersion((v) => v + 1); }
    }, 400);

    return () => {
      destroyed = true;
      clearTimeout(t);
      try { yCells.unobserve(onCells); } catch {}
      try { yStyles.unobserve(bump); } catch {}
      try { yTextColors.unobserve(bump); } catch {}
      try { yWidths.unobserve(loadWidths); } catch {}
      try { provider.awareness.off("change", refreshPeers); } catch {}
      try { provider.disconnect(); } catch {}
      try { provider.destroy(); } catch {}
      try { ydoc.destroy(); } catch {}
    };
  }, [docId, me, computeRowCount]);

  // ── rows array react-data-grid renders, derived from Yjs ──
  const rows = useMemo(() => {
    const yCells = cellsRef.current;
    const out = [];
    for (let r = 0; r < rowCount; r++) {
      const row = { _idx: r + 1, _r: r };
      for (let c = 0; c < DEFAULT_COLS; c++) {
        row[`c${c}`] = yCells ? (yCells.get(`${r}:${c}`) ?? "") : "";
      }
      out.push(row);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowCount, dataVersion]);

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
    applyingRemote.current = true; // our own write — don't echo a rebuild
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
    applyingRemote.current = true; // our own bulk write — suppress echo rebuilds
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
  // CSV can only carry text. To import a STYLED .xlsx — fill colours + font
  // colours — we hand the file to the backend (routers/workspace_import.py),
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

    applyingRemote.current = true; // bulk write — suppress echo rebuilds
    try {
      ydoc.transact(() => {
        for (const [k, v] of Object.entries(data.cells || {})) {
          const key = shift(k);
          if (v === "" || v == null) yCells.delete(key);
          else yCells.set(key, String(v));
        }
        for (const [k, v] of Object.entries(data.styles || {})) {
          if (v) yStyles.set(shift(k), v); else yStyles.delete(shift(k));
        }
        for (const [k, v] of Object.entries(data.textColors || {})) {
          if (v) yText.set(shift(k), v); else yText.delete(shift(k));
        }
      });
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
      renderEditCell: textEditor,
      renderCell: ({ row }) => {
        const style = cellStyle(row._r, c);
        const peer = peerCursors.find((pc) => pc.cell[0] === row._r && pc.cell[1] === c);
        return (
          <div style={{
            width: "100%", height: "100%", display: "flex", alignItems: "center",
            padding: "0 6px", boxSizing: "border-box", position: "relative",
            ...style,
            ...(peer ? { boxShadow: `inset 0 0 0 2px ${peer.user.color || "#4a8fc4"}` } : {}),
          }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {peer && peer.typing != null && peer.typing !== "" ? peer.typing : (row[`c${c}`] ?? "")}
            </span>
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
  }, [colWidths, peerCursors, dataVersion, cellStyle]);

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
    const sel = selectedRef.current;
    const c = sel.colKey && sel.colKey.startsWith("c") ? parseInt(sel.colKey.slice(1), 10) : null;
    const r = sel.rowIdx;
    if (c == null || !Number.isFinite(c)) return;
    ydoc.transact(() => {
      if (val) map.set(`${r}:${c}`, val);
      else map.delete(`${r}:${c}`);
    });
    setDataVersion((v) => v + 1);
  }, []);

  const setColor = (key) => { setColorOpen(false); applyColorToSelection(key, false); };
  const setTextColor = (hex) => { setTextColorOpen(false); applyColorToSelection(hex, true); };

  const statusMeta = {
    connected:  { dot: "#4caf7d", color: "#4caf7d", label: "live" },
    connecting: { dot: "#d4b24b", color: "#d4b24b", label: "connecting" },
    offline:    { dot: "#e05555", color: "#e05555", label: "offline" },
  }[status] || { dot: "#888", color: "#888", label: status };

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
          title="Import a CSV file — fills cells starting at the selected cell (A1 if none)"
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
          title="Import a styled .xlsx — keeps fill colours and font colours, mapped to the sheet palette. Fills from the selected cell."
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
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", marginLeft: 8, letterSpacing: 0.5 }}>
          Select a cell, then pick a color · type to edit · drag column edges to resize
        </span>
      </div>

      {/* grid — react-data-grid owns its own scroll viewport */}
      <div className="ss-grid-wrap">
        <DataGrid
          columns={columns}
          rows={rows}
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
