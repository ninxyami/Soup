"use client";
// @ts-nocheck
// components/BoardEditor.jsx
//
// The collaborative BOARD surface — a kanban (columns + draggable cards), live
// through the relay. "Board" is the third document type alongside Document
// (TipTap) and Sheet (jspreadsheet).
//
// SHARED DATA MODEL (the important design choice):
//   Cards and (future) gantt bars are the SAME underlying items. We store:
//     yCards : Y.Map  cardId -> { id, title, desc, status, assignee, label,
//                                 start, end, order }
//     yCols  : Y.Array of { id, title }
//   The kanban view groups cards by `status` (= column id) and orders by
//   `order`. The gantt view (next round) reads the SAME yCards, using
//   `start`/`end`. So the two views are interconnected for free — move a card
//   here, it moves on the gantt; set dates on the gantt, this card knows them.
//
//   Per-card Yjs keys mean two admins moving DIFFERENT cards never collide;
//   same card = last-write-wins. No backend change (rides the same relay).

import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

const WS_BASE = "wss://api.stateofundeadpurge.site:8443/ws/workspace";

// Card label colors — same palette/keys as the sheet + table cell colors.
const LABELS = [
  { key: "",       label: "None",      color: "transparent" },
  { key: "green",  label: "Done",      color: "#4caf7d" },
  { key: "yellow", label: "WIP",       color: "#d4b24b" },
  { key: "red",    label: "Blocked",   color: "#e05555" },
  { key: "blue",   label: "Info",      color: "#4a8fc4" },
  { key: "purple", label: "Idea",      color: "#9775cc" },
  { key: "orange", label: "Priority",  color: "#d4873a" },
];
const labelColor = (k) => (LABELS.find((l) => l.key === k) || {}).color || "transparent";

const DEFAULT_COLUMNS = [
  { id: "todo",  title: "To Do" },
  { id: "doing", title: "In Progress" },
  { id: "done",  title: "Done" },
];

const uid = () => "c_" + Math.random().toString(36).slice(2, 10);

const BOARD_CSS = `
.bd-surface{display:flex;flex-direction:column;min-height:0;height:100%}
.bd-status{display:flex;align-items:center;gap:16px;padding:10px 16px;flex-wrap:wrap;
  border-bottom:1px solid var(--border);background:var(--surface)}
.bd-board{flex:1;overflow-x:auto;overflow-y:hidden;display:flex;gap:14px;padding:16px;align-items:flex-start}
.bd-col{flex:0 0 280px;background:rgba(0,0,0,0.18);border:1px solid var(--border);border-radius:4px;
  display:flex;flex-direction:column;max-height:100%}
.bd-col-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border)}
.bd-col-title{font-family:var(--mono);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;
  color:var(--accent);background:transparent;border:none;outline:none;flex:1;min-width:0}
.bd-col-count{font-family:var(--mono);font-size:10px;color:var(--muted)}
.bd-cards{flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:8px;min-height:40px}
.bd-card{background:var(--surface);border:1px solid var(--border);border-radius:3px;padding:9px 10px;
  cursor:grab;position:relative}
.bd-card:hover{border-color:var(--muted)}
.bd-card.dragging{opacity:0.4}
.bd-card-label{position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:3px 0 0 3px}
.bd-card-title{font-family:var(--body);font-size:13px;color:var(--text);word-break:break-word;line-height:1.35}
.bd-card-meta{display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap}
.bd-chip{font-family:var(--mono);font-size:9px;letter-spacing:.5px;color:var(--textdim);
  border:1px solid var(--border);border-radius:2px;padding:1px 5px}
.bd-add{font-family:var(--mono);font-size:11px;color:var(--muted);cursor:pointer;padding:8px 10px;
  text-align:left;background:transparent;border:none;border-top:1px solid rgba(30,37,48,0.4)}
.bd-add:hover{color:var(--text)}
.bd-col-drop{outline:2px dashed var(--accent);outline-offset:-4px}
.bd-iconbtn{background:transparent;border:none;color:var(--muted);cursor:pointer;font-size:12px;padding:2px 4px;border-radius:2px}
.bd-iconbtn:hover{color:var(--red)}
.bd-newcol{flex:0 0 200px;align-self:flex-start}
.bd-newcol button{width:100%;font-family:var(--mono);font-size:11px;letter-spacing:1px;color:var(--muted);
  background:rgba(0,0,0,0.1);border:1px dashed var(--border);border-radius:4px;padding:12px;cursor:pointer}
.bd-newcol button:hover{color:var(--accent);border-color:var(--accent)}
.bd-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:200;display:flex;align-items:center;justify-content:center}
.bd-modal{background:var(--surface);border:1px solid var(--border);border-radius:5px;width:440px;max-width:92vw;padding:20px}
.bd-field{margin-bottom:14px}
.bd-flabel{font-family:var(--mono);font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--textdim);margin-bottom:5px;display:block}
.bd-inp,.bd-ta{width:100%;background:rgba(0,0,0,0.2);border:1px solid var(--border);color:var(--text);
  font-family:var(--body);font-size:13px;padding:7px 9px;border-radius:3px;box-sizing:border-box}
.bd-ta{resize:vertical;min-height:60px}
.bd-row{display:flex;gap:10px}
.bd-swatches{display:flex;gap:5px;flex-wrap:wrap}
.bd-sw{width:22px;height:22px;border-radius:3px;cursor:pointer;border:2px solid transparent}
.bd-sw.on{border-color:var(--text)}
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

export default function BoardEditor({ docId, me, admins = [] }) {
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const yCardsRef = useRef(null);
  const yColsRef = useRef(null);

  const [status, setStatus] = useState("connecting");
  const [peers, setPeers] = useState([]);
  const [cards, setCards] = useState({});     // id -> card
  const [columns, setColumns] = useState([]); // [{id,title}]
  const [editing, setEditing] = useState(null); // card being edited (or null)
  const dragId = useRef(null);
  const [dropCol, setDropCol] = useState(null);

  useEffect(() => {
    if (!docId) return;
    let destroyed = false;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    const provider = new WebsocketProvider(WS_BASE, `board:${docId}`, ydoc, { connect: true });
    providerRef.current = provider;

    const yCards = ydoc.getMap("cards");
    const yCols = ydoc.getArray("columns");
    yCardsRef.current = yCards;
    yColsRef.current = yCols;

    provider.on("status", (e) => {
      if (destroyed) return;
      setStatus(e.status === "connected" ? "connected" : e.status === "connecting" ? "connecting" : "offline");
    });

    provider.awareness.setLocalStateField("user", { name: me.name, color: me.color, id: me.id, initials: me.initials });
    const refreshPeers = () => {
      if (destroyed) return;
      const states = [...provider.awareness.getStates().entries()];
      const others = states.filter(([cid]) => cid !== provider.awareness.clientID).map(([, s]) => s.user).filter(Boolean);
      const seen = new Set(); const uniq = [];
      for (const u of others) { const k = u.id || u.name; if (seen.has(k)) continue; seen.add(k); uniq.push(u); }
      setPeers(uniq);
    };
    provider.awareness.on("change", refreshPeers);

    const syncCards = () => { if (!destroyed) setCards(Object.fromEntries(yCards.entries())); };
    const syncCols = () => { if (!destroyed) setColumns(yCols.toArray()); };
    yCards.observe(syncCards);
    yCols.observe(syncCols);

    const seedIfEmpty = () => {
      if (destroyed) return;
      if (yCols.length === 0) {
        ydoc.transact(() => { DEFAULT_COLUMNS.forEach((c) => yCols.push([c])); });
      }
      syncCards(); syncCols();
    };
    if (provider.synced) seedIfEmpty();
    else provider.once("synced", seedIfEmpty);
    const t = setTimeout(() => {
      if (destroyed) return;
      if (provider.synced && yColsRef.current && yColsRef.current.length === 0) seedIfEmpty();
      else { syncCards(); syncCols(); }
    }, 1200);

    return () => {
      destroyed = true;
      clearTimeout(t);
      try { yCards.unobserve(syncCards); } catch {}
      try { yCols.unobserve(syncCols); } catch {}
      try { provider.awareness.off("change", refreshPeers); } catch {}
      try { provider.destroy(); } catch {}
      try { ydoc.destroy(); } catch {}
      ydocRef.current = null; providerRef.current = null; yCardsRef.current = null; yColsRef.current = null;
    };
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── card ops (write to Yjs → observe re-renders) ──
  const putCard = useCallback((card) => {
    const y = yCardsRef.current; if (!y) return;
    ydocRef.current.transact(() => y.set(card.id, card));
  }, []);
  const removeCard = useCallback((id) => {
    const y = yCardsRef.current; if (!y) return;
    ydocRef.current.transact(() => y.delete(id));
  }, []);

  const addCard = (statusId) => {
    const colCards = Object.values(cards).filter((c) => c.status === statusId);
    const order = colCards.length ? Math.max(...colCards.map((c) => c.order ?? 0)) + 1 : 0;
    const card = { id: uid(), title: "New card", desc: "", status: statusId, assignee: "", label: "", start: "", end: "", order };
    putCard(card);
    setEditing(card);
  };

  const moveCard = (id, toStatus) => {
    const c = cards[id]; if (!c) return;
    const colCards = Object.values(cards).filter((x) => x.status === toStatus);
    const order = colCards.length ? Math.max(...colCards.map((x) => x.order ?? 0)) + 1 : 0;
    putCard({ ...c, status: toStatus, order });
  };

  // ── column ops ──
  const addColumn = () => {
    const y = yColsRef.current; if (!y) return;
    ydocRef.current.transact(() => y.push([{ id: "col_" + uid(), title: "New Column" }]));
  };
  const renameColumn = (idx, title) => {
    const y = yColsRef.current; if (!y) return;
    const cur = y.get(idx); if (!cur) return;
    ydocRef.current.transact(() => { y.delete(idx, 1); y.insert(idx, [{ ...cur, title }]); });
  };
  const deleteColumn = (col, idx) => {
    const has = Object.values(cards).some((c) => c.status === col.id);
    if (has && !window.confirm(`Delete column "${col.title}" and its cards?`)) return;
    const y = yColsRef.current; if (!y) return;
    ydocRef.current.transact(() => {
      Object.values(cards).filter((c) => c.status === col.id).forEach((c) => yCardsRef.current.delete(c.id));
      y.delete(idx, 1);
    });
  };

  const statusMeta = {
    connecting: { label: "Connecting", color: "var(--orange)", dot: "var(--orange)" },
    connected:  { label: "Live",       color: "var(--green)",  dot: "var(--green)"  },
    offline:    { label: "Offline",    color: "var(--red)",    dot: "var(--red)"    },
  }[status];

  const adminName = (id) => (admins.find((a) => String(a.id) === String(id)) || {}).name || "";

  return (
    <div className="bd-surface">
      <style dangerouslySetInnerHTML={{ __html: BOARD_CSS }} />

      {/* status / presence */}
      <div className="bd-status">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: statusMeta.dot,
            boxShadow: status === "connected" ? `0 0 6px ${statusMeta.dot}` : "none",
            animation: status === "connecting" ? "ap-blink 1.2s infinite" : "none" }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 1.5, color: statusMeta.color, textTransform: "uppercase" }}>{statusMeta.label}</span>
        </div>
        <div style={{ width: 1, height: 18, background: "var(--border)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex" }}>
            <Avatar u={me} ring />
            {peers.map((u, i) => <div key={(u.id || u.name) + i} style={{ marginLeft: -6 }}><Avatar u={u} /></div>)}
          </div>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>
            {peers.length === 0 ? "only you" : `${peers.length} other${peers.length > 1 ? "s" : ""}`}
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--textdim)" }}>kanban</span>
      </div>

      {/* board */}
      <div className="bd-board">
        {columns.map((col, idx) => {
          const colCards = Object.values(cards)
            .filter((c) => c.status === col.id)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          return (
            <div
              key={col.id}
              className={"bd-col" + (dropCol === col.id ? " bd-col-drop" : "")}
              onDragOver={(e) => { e.preventDefault(); if (dropCol !== col.id) setDropCol(col.id); }}
              onDragLeave={() => setDropCol((d) => (d === col.id ? null : d))}
              onDrop={(e) => { e.preventDefault(); setDropCol(null); if (dragId.current) moveCard(dragId.current, col.id); dragId.current = null; }}
            >
              <div className="bd-col-head">
                <input className="bd-col-title" value={col.title}
                  onChange={(e) => renameColumn(idx, e.target.value)} />
                <span className="bd-col-count">{colCards.length}</span>
                <button className="bd-iconbtn" title="Delete column" onClick={() => deleteColumn(col, idx)}>✕</button>
              </div>
              <div className="bd-cards">
                {colCards.map((c) => (
                  <div
                    key={c.id}
                    className={"bd-card" + (dragId.current === c.id ? " dragging" : "")}
                    draggable
                    onDragStart={() => { dragId.current = c.id; }}
                    onDragEnd={() => { dragId.current = null; setDropCol(null); }}
                    onClick={() => setEditing(c)}
                  >
                    {c.label ? <span className="bd-card-label" style={{ background: labelColor(c.label) }} /> : null}
                    <div className="bd-card-title">{c.title || "Untitled"}</div>
                    {(c.assignee || c.start || c.end) && (
                      <div className="bd-card-meta">
                        {c.assignee && <span className="bd-chip">{adminName(c.assignee) || c.assignee}</span>}
                        {(c.start || c.end) && <span className="bd-chip">{c.start || "…"}{c.end ? `→${c.end}` : ""}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button className="bd-add" onClick={() => addCard(col.id)}>+ add card</button>
            </div>
          );
        })}
        <div className="bd-newcol">
          <button onClick={addColumn}>+ ADD COLUMN</button>
        </div>
      </div>

      {/* card editor modal */}
      {editing && (
        <div className="bd-modal-bg" onClick={() => setEditing(null)}>
          <div className="bd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bd-field">
              <label className="bd-flabel">Title</label>
              <input className="bd-inp" autoFocus value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div className="bd-field">
              <label className="bd-flabel">Description</label>
              <textarea className="bd-ta" value={editing.desc}
                onChange={(e) => setEditing({ ...editing, desc: e.target.value })} />
            </div>
            <div className="bd-row">
              <div className="bd-field" style={{ flex: 1 }}>
                <label className="bd-flabel">Assignee</label>
                <select className="bd-inp" value={editing.assignee}
                  onChange={(e) => setEditing({ ...editing, assignee: e.target.value })}>
                  <option value="">—</option>
                  {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="bd-field" style={{ flex: 1 }}>
                <label className="bd-flabel">Label</label>
                <div className="bd-swatches">
                  {LABELS.map((l) => (
                    <div key={l.key} className={"bd-sw" + (editing.label === l.key ? " on" : "")}
                      title={l.label}
                      style={{ background: l.key ? l.color : "transparent", border: l.key ? undefined : "1px dashed var(--muted)" }}
                      onClick={() => setEditing({ ...editing, label: l.key })} />
                  ))}
                </div>
              </div>
            </div>
            {/* date fields — unused by kanban view, but feed the gantt later */}
            <div className="bd-row">
              <div className="bd-field" style={{ flex: 1 }}>
                <label className="bd-flabel">Start date</label>
                <input className="bd-inp" type="date" value={editing.start || ""}
                  onChange={(e) => setEditing({ ...editing, start: e.target.value })} />
              </div>
              <div className="bd-field" style={{ flex: 1 }}>
                <label className="bd-flabel">End date</label>
                <input className="bd-inp" type="date" value={editing.end || ""}
                  onChange={(e) => setEditing({ ...editing, end: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button style={{ flex: 1, background: "var(--accent)", color: "#0a0a0a", border: "none", borderRadius: 3, padding: "9px", fontFamily: "var(--mono)", fontSize: 12, letterSpacing: 1, cursor: "pointer" }}
                onClick={() => { putCard(editing); setEditing(null); }}>SAVE</button>
              <button style={{ background: "transparent", color: "var(--red)", border: "1px solid var(--border)", borderRadius: 3, padding: "9px 14px", fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer" }}
                onClick={() => { removeCard(editing.id); setEditing(null); }}>DELETE</button>
              <button style={{ background: "transparent", color: "var(--textdim)", border: "1px solid var(--border)", borderRadius: 3, padding: "9px 14px", fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer" }}
                onClick={() => setEditing(null)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
