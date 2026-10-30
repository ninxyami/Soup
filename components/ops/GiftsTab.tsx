// @ts-nocheck
"use client";
// components/ops/GiftsTab.tsx - Live Ops > Gifts (2026-10-25, mod 1.8.66 ZGift_Server.lua, bot liveops_gifts_patch.py).
// Nin for ardenviel's event rewards: "just add a list and the item will be queued, they will get it when they login" and
// "not just paste but you can search the players and click them like a checklist".
// Tick players from every player the game knows (online ones marked; search, everyone online, who was in an area
// between two times, pasted names), type the items (Base.Axe*1 lines), a label players read and an optional note, Queue.
// The game hands it over itself: online players within seconds, offline players at their next login.
// Data: GET /api/admin/ops/gifts (the game's zombita_gifts_state.txt), GET /api/admin/ops/gifts/area (the positions table).
// Changes: gift_queue / gift_cancel through /api/admin/ops/do (act).
// 2026-10-30 (ardenviel's ask, gift_announce_patch.py): Announce to everyone, off for every new gift, the same box as the in-game
// GIFTS tab: one public line when it is queued (the game's toast, Game chat, Discord), never who gave it. The pop-up stays.
// 2026-10-30 (Nin: "when you type it automatically searches, so we don't need to search for ids"): Find an item, the same search as
// the in-game GIFTS tab. Asks the game through the Panther tab's SearchItems (POST /api/admin/ops/panther, no profile needed), one
// question at a time; a list the game sent whole answers longer searches here without asking again. Typed ids still work.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API } from "@/lib/constants";
import { ItemIcon } from "@/components/quests/ui";

const C = { gold: "#c8a84b", green: "#4caf7d", red: "#e05555", grey: "#9aa", text: "#e6e6e6", bg: "#0b0d10", line: "#2a2f37", amber: "#e0a040", blue: "#4a8fc4" };
const mono = { fontFamily: "var(--mono, monospace)" };
const inp = { ...mono, fontSize: 12, padding: "6px 8px", background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 3, width: "100%", boxSizing: "border-box" };
const h = { ...mono, fontSize: 12, color: C.gold, textTransform: "uppercase", letterSpacing: 1, margin: "4px 0" };
const box = { border: `1px solid ${C.line}`, borderRadius: 3, padding: 10, display: "flex", flexDirection: "column", gap: 8 };
const MAX_PLAYERS = 300, MAX_LINES = 20, MAX_COUNT = 100, LABEL_MAX = 60, NOTE_MAX = 200, SHOW_MAX = 400;
const FIND_MIN = 2, FIND_PAUSE_MS = 350, FIND_POLL_MS = 400, FIND_WAIT_MS = 12000, FIND_SHOW = 60, FIND_KEEP = 60;
const LINE_RE = /^([A-Za-z0-9_]+\.[A-Za-z0-9_\-]+)\s*(?:[*xX]\s*)?(\d*)$/;

async function get(path) {
  const r = await fetch(`${API}${path}`, { credentials: "include" });
  let d = null;
  try { d = await r.json(); } catch {}
  if (!r.ok) { const e = new Error((d && (d.detail || d.error)) || `HTTP ${r.status}`); e.status = r.status; throw e; }
  return d;
}

/** "Base.Axe*1\nBase.Bandage x3" -> { lines: [[id, n]], error } (the bot and the game check again; the game checks the ids). */
export function parseItems(text) {
  const lines = [];
  for (const raw of String(text || "").split(/[,;\r\n]+/)) {
    const s = raw.trim();
    if (!s) continue;
    const m = LINE_RE.exec(s);
    if (!m) return { lines, error: `Not an item line: "${s}". Write Module.Item*count, for example Base.Axe*1.` };
    const n = m[2] ? Number(m[2]) : 1;
    if (!(n >= 1 && n <= MAX_COUNT)) return { lines, error: `Each count must be 1 to ${MAX_COUNT} ("${s}").` };
    lines.push([m[1], n]);
  }
  if (!lines.length) return { lines, error: "Put at least one item in the gift." };
  if (lines.length > MAX_LINES) return { lines, error: `At most ${MAX_LINES} item lines per gift.` };
  return { lines, error: "" };
}

/** Put an item in the text: more of a line that has it, else a new line. Other lines stay as typed. -> { text, note } or { error } */
export function addItemLine(text, id, count) {
  const parts = String(text || "").split(/[,;\r\n]+/).map((p) => p.trim()).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const m = LINE_RE.exec(parts[i]);
    if (!m || m[1] !== id) continue;
    const sum = (m[2] ? Number(m[2]) : 1) + count, n = Math.min(MAX_COUNT, sum);
    parts[i] = `${id}*${n}`;
    return { text: parts.join("\n"), note: sum > MAX_COUNT ? `${id} stays at ${MAX_COUNT}, the most per line.` : "" };
  }
  if (parts.length >= MAX_LINES) return { error: `At most ${MAX_LINES} item lines per gift.` };
  parts.push(`${id}*${count}`);
  return { text: parts.join("\n"), note: "" };
}

/** The game's text for one item, the same words its search looks in. */
const searchText = (r) => `${r.id} ${r.name} ${r.category || ""} ${r.module || ""}`.toLowerCase();

/** An answer we already have: this search, or a shorter one the game sent whole. -> { rows, total } or null */
export function fromKnown(known, want) {
  const same = known.get(want);
  if (same) return same;
  for (const [k, v] of known) {
    if (!want.includes(k) || v.total > v.rows.length) continue;
    const rows = v.rows.filter((r) => searchText(r).includes(want));
    return { rows, total: rows.length };
  }
  return null;
}

/** Best first: the name itself, names that start with it, a word that starts with it, the rest (still by name, as the game sends them). */
export function rankItems(rows, want) {
  const score = (r) => { const n = String(r.name || "").toLowerCase(); return n === want ? 0 : n.startsWith(want) ? 1 : n.includes(` ${want}`) ? 2 : 3; };
  return rows.map((r, i) => [score(r), i, r]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]);
}

/** Ask the game: queue the search, wait for its answer. -> { rows, total } */
async function askItems(query) {
  const r = await fetch(`${API}/api/admin/ops/panther`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cmd: "pa_call", pc: "SearchItems", query, filter: "All Items", page: 1 }) });
  const q = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(q.detail || `HTTP ${r.status}`);
  for (const end = Date.now() + FIND_WAIT_MS; Date.now() < end;) {
    await new Promise((ok) => setTimeout(ok, FIND_POLL_MS));
    const ans = await get(`/api/admin/ops/panther/reply/${q.id}`);
    if (ans.done === false) continue;
    if (!ans.ok) throw new Error(ans.msg || "The game refused the search.");
    const got = (Array.isArray(ans.replies) ? ans.replies : []).find((x) => x.command === "ItemSearchResult")?.args || {};
    const rows = Array.isArray(got.items) ? got.items : [];
    return { rows, total: Number(got.total) || rows.length };
  }
  throw new Error("No answer from the game. The search needs the server awake, and it pauses when nobody is online. You can still type ids below.");
}

function ItemSearch({ inGift, onAdd }) {
  const [q, setQ] = useState("");
  const [count, setCount] = useState("1");
  const [found, setFound] = useState(null);           // { rows, total } for the box's text
  const [asking, setAsking] = useState(false);
  const [err, setErr] = useState("");
  const s = useRef({ want: "", busy: false, live: true, known: new Map() }).current;
  useEffect(() => { s.live = true; return () => { s.live = false; }; }, [s]);

  // one question at a time: when it comes back, the box may already say something else
  const ask = useCallback(async () => {
    const want = s.want;
    if (s.busy || !s.live || want.length < FIND_MIN) return;
    s.busy = true;
    setAsking(true);
    try {
      const res = await askItems(want);
      if (s.known.size >= FIND_KEEP) s.known.clear();
      s.known.set(want, res);
    } catch (e) { if (s.want === want) { setErr(e.message); setFound(null); } }
    s.busy = false;
    if (!s.live) return;
    const had = s.want.length >= FIND_MIN ? fromKnown(s.known, s.want) : null;
    if (had) setFound(had);
    if (!had && s.want !== want && s.want.length >= FIND_MIN) ask();
    else setAsking(false);
  }, [s]);

  useEffect(() => {
    s.want = q.trim().toLowerCase();
    setErr("");
    if (s.want.length < FIND_MIN) { setFound(null); return; }
    const had = fromKnown(s.known, s.want);
    if (had) { setFound(had); return; }
    const t = setTimeout(ask, FIND_PAUSE_MS);
    return () => clearTimeout(t);
  }, [q, s, ask]);

  const want = q.trim().toLowerCase();
  const n = Math.min(MAX_COUNT, Math.max(1, parseInt(count, 10) || 1));
  const usable = found ? found.rows.filter((r) => LINE_RE.test(r.id)) : [];      // the gift only takes Module.Item ids
  const total = found ? found.total - (found.rows.length - usable.length) : 0;
  const rows = rankItems(usable, want).slice(0, FIND_SHOW);
  const status = err ? "" : asking ? "Asking the game..." : want.length === 1 ? `Type at least ${FIND_MIN} letters.` : !found ? ""
    : !total ? "No item by that name." : total > rows.length ? `Showing ${rows.length} of ${total}: type more to narrow it down.`
    : `${total} found. Click one to add it.`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input style={{ ...inp, flex: "1 1 200px", width: "auto" }} maxLength={80} placeholder="Find an item: type its name or id" value={q} onChange={(e) => setQ(e.target.value)} />
        <label style={{ ...mono, fontSize: 11, color: C.grey, display: "flex", alignItems: "center", gap: 4 }}>Count
          <input type="number" min={1} max={MAX_COUNT} style={{ ...inp, width: 64 }} value={count} onChange={(e) => setCount(e.target.value)} /></label>
      </div>
      {err && <div style={{ ...mono, fontSize: 11, color: C.amber }}>{err}</div>}
      {status && <div style={{ ...mono, fontSize: 11, color: C.grey }}>{status}</div>}
      {rows.length > 0 && (
        <div style={{ maxHeight: 260, overflowY: "auto", border: `1px solid ${C.line}`, borderRadius: 3 }}>
          {rows.map((r) => (
            <button key={r.id} onClick={() => onAdd(r.id, n)} title={`Add ${n} to the gift`}
              style={{ ...mono, fontSize: 12, display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "3px 8px", background: inGift[r.id] ? "#1d1a10" : "transparent",
                color: C.text, border: 0, borderBottom: `1px solid ${C.bg}`, cursor: "pointer", textAlign: "left" }}>
              <ItemIcon id={r.id} size={20} />
              <span style={{ flex: 1 }}>{r.name}</span>
              <span style={{ fontSize: 10, color: C.grey }}>{r.id}</span>
              <span style={{ fontSize: 11, color: C.gold, minWidth: 64, textAlign: "right" }}>{inGift[r.id] ? `${inGift[r.id]} in gift` : `+${n}`}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Btn({ children, onClick, color = C.gold, disabled = false, small = false, title = "" }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ ...mono, fontSize: small ? 11 : 12, padding: small ? "3px 8px" : "6px 10px", background: "transparent", color: disabled ? "#555" : color,
        border: `1px solid ${disabled ? "#333" : color}`, borderRadius: 3, cursor: disabled ? "default" : "pointer", textTransform: "uppercase", letterSpacing: 0.5 }}>
      {children}
    </button>
  );
}

function ago(at) {
  const s = Math.max(0, Math.round(Date.now() / 1000 - Number(at || 0)));
  if (!at) return "?";
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 172800) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} days ago`;
}
const localInput = (ms) => { const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };

export default function GiftsTab({ act, players = [], setPick }) {
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [rank, setRank] = useState([]);               // fallback names (rankings) while the game has no gift file yet
  const [ticked, setTicked] = useState({});           // lower name -> name
  const [q, setQ] = useState("");
  const [show, setShow] = useState("all");            // all | online | ticked
  const [paste, setPaste] = useState("");
  const [items, setItems] = useState("");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [announce, setAnnounce] = useState(false);    // back off once a gift goes through
  const [area, setArea] = useState(() => ({ x1: "", y1: "", x2: "", y2: "", from: localInput(Date.now() - 24 * 3600000), to: localInput(Date.now()) }));
  const [areaOut, setAreaOut] = useState(null);       // { players: [...] } | { error }
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState({});               // batch id -> details open

  const load = useCallback(async () => {
    try { setData(await get("/api/admin/ops/gifts")); setLoadErr(""); }
    catch (e) { setLoadErr(e.status === 404 ? "The server doesn't have the gift queue yet (the bot needs liveops_gifts_patch.py)." : `Can't load the gifts: ${e.message}`); }
  }, []);
  useEffect(() => {
    let stop = false, t = null;
    const tick = async () => { await load(); if (!stop) t = setTimeout(tick, 10000); };
    tick();
    return () => { stop = true; clearTimeout(t); };
  }, [load]);
  useEffect(() => { get("/api/rankings").then((d) => setRank([...new Set((d?.players || []).map((p) => p.name).filter(Boolean))])).catch(() => {}); }, []);

  const online = useMemo(() => {
    const s = new Set((players || []).map((p) => String(p.name || "").toLowerCase()).filter(Boolean));
    for (const n of data?.online || []) s.add(String(n).toLowerCase());
    return s;
  }, [players, data]);
  // every known player: the game's list (the leaderboard's record of everyone who played), else the rankings, + who is online
  const known = useMemo(() => {
    const m = new Map();
    for (const n of (data?.players?.length ? data.players : rank)) if (n) m.set(String(n).toLowerCase(), String(n));
    for (const p of players || []) if (p.name && !m.has(p.name.toLowerCase())) m.set(p.name.toLowerCase(), p.name);
    return m;
  }, [data, rank, players]);
  const tickedList = useMemo(() => Object.values(ticked).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })), [ticked]);
  const nOnline = tickedList.filter((n) => online.has(n.toLowerCase())).length;
  const shown = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const src = show === "ticked" ? tickedList : [...known.values()];
    return src.filter((n) => (!qq || n.toLowerCase().includes(qq)) && (show !== "online" || online.has(n.toLowerCase())))
      .sort((a, b) => (online.has(b.toLowerCase()) - online.has(a.toLowerCase())) || a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [known, q, show, online, tickedList]);

  const tick = (names) => setTicked((t) => { const o = { ...t }; for (const n of names) o[n.toLowerCase()] = known.get(n.toLowerCase()) || n; return o; });
  const toggle = (n) => setTicked((t) => { const o = { ...t }; const k = n.toLowerCase(); if (o[k]) delete o[k]; else o[k] = n; return o; });

  const doPaste = () => {
    const got = [], unknown = [];
    for (const raw of paste.split(/[,;|\r\n]+/)) {
      const s = raw.trim();
      if (!s) continue;
      if (known.has(s.toLowerCase())) got.push(known.get(s.toLowerCase())); else unknown.push(s);
    }
    tick(got);
    setMsg(`Ticked ${got.length} player${got.length === 1 ? "" : "s"}.${unknown.length ? ` Not known players (left out): ${unknown.join(", ")}` : ""}`);
    if (!unknown.length) setPaste("");
  };

  const pickArea = () => setPick({ mode: "z", hint: "Gifts: click one corner of the area on the map.", cb: (w1) => {
    setArea((a) => ({ ...a, x1: w1.x, y1: w1.y }));
    setPick({ mode: "z", hint: "Gifts: now click the opposite corner.", cb: (w2) => setArea((a) => ({ ...a, x2: w2.x, y2: w2.y })) });
  } });
  const areaOk = ["x1", "y1", "x2", "y2"].every((k) => String(area[k]).trim() !== "" && !isNaN(Number(area[k]))) && area.from && area.to;
  const findArea = async () => {
    const since = Math.floor(new Date(area.from).getTime() / 1000), until = Math.floor(new Date(area.to).getTime() / 1000);
    const qs = new URLSearchParams({ x1: String(Math.round(area.x1)), y1: String(Math.round(area.y1)), x2: String(Math.round(area.x2)),
      y2: String(Math.round(area.y2)), since: String(since), until: String(until) });
    try {
      const d = await get(`/api/admin/ops/gifts/area?${qs}`);
      setAreaOut(d);
      tick((d.players || []).map((r) => r.player));
      setMsg(`Ticked ${(d.players || []).length} player${(d.players || []).length === 1 ? "" : "s"} who were in that area.`);
    } catch (e) { setAreaOut({ error: e.status === 404 ? "The server can't look this up yet (the bot needs liveops_gifts_patch.py)." : e.message }); }
  };

  const parsed = parseItems(items);
  const inGift = Object.fromEntries(parsed.lines);
  const addItem = (id, n) => {
    const r = addItemLine(items, id, n);
    if (r.error) { setMsg(r.error); return; }
    setItems(r.text);
    setMsg(r.note);
  };
  // the game says each item's own name ("1x Axe"); here the id without its module comes close
  const itemWords = parsed.lines.map(([id, n]) => `${n}x ${id.split(".").pop()}`).join(", ");
  const blocker = !tickedList.length ? "Tick at least one player." : tickedList.length > MAX_PLAYERS ? `At most ${MAX_PLAYERS} players per gift (${tickedList.length} ticked).`
    : parsed.error ? parsed.error : !label.trim() ? "Give the gift a label players read (for example Maze event reward)." : "";
  const queue = () => {
    if (blocker) { setMsg(blocker); return; }
    const off = tickedList.length - nOnline;
    if (!confirm(`Give "${label.trim()}" (${parsed.lines.map(([id, n]) => `${id}*${n}`).join(", ")}) to ${tickedList.length} player${tickedList.length === 1 ? "" : "s"}?\n\n`
      + `${nOnline} online get it within seconds, ${off} offline get it at their next login.\n`
      + `Players read: Zombita left you a gift: ${label.trim()} (${itemWords}).`
      + (announce ? "\nAlso announced to everyone online and on Discord." : ""))) return;
    act("gift_queue", { players: tickedList, items: parsed.lines.map(([id, n]) => `${id}*${n}`).join("\n"), label: label.trim(), note: note.trim(), ...(announce ? { announce: true } : {}) },
      () => { setTicked({}); setMsg(""); setAnnounce(false); load(); });
  };
  const cancel = (b, player) => {
    const text = player ? `Cancel "${b.label}" for ${player}?` : `Cancel "${b.label}" for the ${(b.pending || []).length} player${(b.pending || []).length === 1 ? "" : "s"} still waiting?\nGifts already handed over stay.`;
    if (!confirm(text)) return;
    act("gift_cancel", player ? { bid: b.id, player } : { bid: b.id }, () => load());
  };

  const batches = data?.batches || [];
  const waiting = batches.reduce((s, b) => s + (b.pending || []).length, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...mono, fontSize: 11, color: C.grey, lineHeight: 1.5 }}>
        Give items to a list of players, online or offline. The game hands them over itself: online players within seconds, offline players
        the next time they log in. Players see a Zombita pop-up with the label, never who gave it.
      </div>
      {loadErr && <div style={{ ...mono, fontSize: 11, color: C.amber }}>{loadErr}</div>}
      {data && !data.loaded && <div style={{ ...mono, fontSize: 11, color: C.amber }}>The game hasn't sent its gift list yet: it comes with the Zombita 1.8.66 build. Until then the player list is the rankings.</div>}

      <div style={box}>
        <div style={h}>1. Players ({tickedList.length} ticked, {nOnline} online)</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <input style={{ ...inp, flex: "1 1 160px", width: "auto" }} placeholder={`Search ${known.size} players`} value={q} onChange={(e) => setQ(e.target.value)} />
          {[["all", "All"], ["online", "Online"], ["ticked", "Ticked"]].map(([k, l]) => (
            <Btn key={k} small color={show === k ? C.gold : C.grey} onClick={() => setShow(k)}>{l}</Btn>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Btn small onClick={() => tick(shown)} disabled={!shown.length} title="Tick every name the list shows now">Select shown ({shown.length})</Btn>
          <Btn small onClick={() => tick([...known.values()].filter((n) => online.has(n.toLowerCase())))} disabled={!online.size}>Everyone online ({online.size})</Btn>
          <Btn small color={C.grey} onClick={() => setTicked({})} disabled={!tickedList.length}>Clear</Btn>
        </div>
        <div style={{ maxHeight: 300, overflowY: "auto", border: `1px solid ${C.line}`, borderRadius: 3 }}>
          {!shown.length && <div style={{ ...mono, fontSize: 12, color: C.grey, padding: 8 }}>{known.size ? "No player by that name." : "Loading the player list..."}</div>}
          {shown.slice(0, SHOW_MAX).map((n) => {
            const on = online.has(n.toLowerCase()), t = !!ticked[n.toLowerCase()];
            return (
              <label key={n} style={{ ...mono, fontSize: 12, display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", cursor: "pointer",
                background: t ? "#1d1a10" : "transparent", borderBottom: `1px solid ${C.bg}` }}>
                <input type="checkbox" checked={t} onChange={() => toggle(n)} />
                <span style={{ width: 8, height: 8, borderRadius: 4, background: on ? C.green : "#444", flex: "none" }} title={on ? "online now" : "offline"} />
                <span style={{ flex: 1, color: C.text }}>{n}</span>
                {on && <span style={{ color: C.green, fontSize: 10 }}>online</span>}
              </label>
            );
          })}
          {shown.length > SHOW_MAX && <div style={{ ...mono, fontSize: 11, color: C.grey, padding: 8 }}>First {SHOW_MAX} of {shown.length}: search to narrow it down (Select shown still ticks all {shown.length}).</div>}
        </div>
        <details>
          <summary style={{ ...mono, fontSize: 11, color: C.grey, cursor: "pointer" }}>Paste names</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            <textarea style={{ ...inp, minHeight: 60 }} placeholder="One name per line, or commas" value={paste} onChange={(e) => setPaste(e.target.value)} />
            <div><Btn small onClick={doPaste} disabled={!paste.trim()}>Tick these</Btn></div>
          </div>
        </details>
        <details>
          <summary style={{ ...mono, fontSize: 11, color: C.grey, cursor: "pointer" }}>Who was in an area (positions of the last 14 days)</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
              {["x1", "y1", "x2", "y2"].map((k) => (
                <input key={k} style={inp} placeholder={k} value={area[k]} onChange={(e) => setArea((a) => ({ ...a, [k]: e.target.value.replace(/[^0-9]/g, "") }))} />
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              <label style={{ ...mono, fontSize: 10, color: C.grey }}>From<input type="datetime-local" style={inp} value={area.from} onChange={(e) => setArea((a) => ({ ...a, from: e.target.value }))} /></label>
              <label style={{ ...mono, fontSize: 10, color: C.grey }}>To<input type="datetime-local" style={inp} value={area.to} onChange={(e) => setArea((a) => ({ ...a, to: e.target.value }))} /></label>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Btn small color={C.blue} onClick={pickArea}>Pick on the map</Btn>
              <Btn small onClick={findArea} disabled={!areaOk}>Tick who was there</Btn>
            </div>
            {areaOut?.error && <div style={{ ...mono, fontSize: 11, color: C.red }}>{areaOut.error}</div>}
            {areaOut?.players && <div style={{ ...mono, fontSize: 11, color: C.grey }}>
              {areaOut.players.length ? areaOut.players.map((r) => `${r.player} (${r.minutes} min)`).join(", ") : "Nobody was there then."}</div>}
          </div>
        </details>
      </div>

      <div style={box}>
        <div style={h}>2. The gift</div>
        <ItemSearch inGift={inGift} onAdd={addItem} />
        <label style={{ ...mono, fontSize: 11, color: C.grey }}>Items: one per line, Module.Item*count (1 to {MAX_COUNT}, at most {MAX_LINES} lines)
          <textarea style={{ ...inp, minHeight: 70, marginTop: 4 }} placeholder={"Base.Axe*1\nBase.Bandage*3"} value={items} onChange={(e) => setItems(e.target.value)} /></label>
        {items.trim() && <div style={{ ...mono, fontSize: 11, color: parsed.error ? C.red : C.green }}>{parsed.error || itemWords}</div>}
        <label style={{ ...mono, fontSize: 11, color: C.grey }}>Label players read
          <input style={{ ...inp, marginTop: 4 }} maxLength={LABEL_MAX} placeholder="Maze event reward" value={label} onChange={(e) => setLabel(e.target.value)} /></label>
        <label style={{ ...mono, fontSize: 11, color: C.grey }}>Note for the admins (players never see it, optional)
          <input style={{ ...inp, marginTop: 4 }} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        {label.trim() && <div style={{ ...mono, fontSize: 11, color: C.grey }}>Players read: <span style={{ color: C.gold }}>Zombita left you a gift: {label.trim()}{itemWords ? ` (${itemWords})` : ""}.</span></div>}
        <label style={{ ...mono, fontSize: 11, color: announce ? C.gold : C.grey, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} />
          Announce to everyone (one public line when it is queued: the game's toast, Game chat and Discord; never who gave it)
        </label>
        {announce && label.trim() && <div style={{ ...mono, fontSize: 11, color: C.grey }}>Everyone reads: <span style={{ color: C.gold }}>Zombita handed out a gift to {tickedList.length} survivor{tickedList.length === 1 ? "" : "s"}: {label.trim()}{itemWords ? ` (${itemWords})` : ""}</span></div>}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Btn onClick={queue} disabled={!!blocker}>Queue for {tickedList.length} player{tickedList.length === 1 ? "" : "s"}</Btn>
          {blocker && <span style={{ ...mono, fontSize: 11, color: C.grey }}>{blocker}</span>}
        </div>
        {msg && <div style={{ ...mono, fontSize: 11, color: C.amber }}>{msg}</div>}
      </div>

      <div style={box}>
        <div style={h}>3. Gifts ({batches.length} kept, {waiting} waiting)</div>
        {!batches.length && <div style={{ ...mono, fontSize: 12, color: C.grey }}>No gifts queued yet.</div>}
        {batches.map((b) => {
          const pend = b.pending || [], del = b.delivered || [], cx = b.cancelled || [];
          return (
            <div key={b.id} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                <span style={{ ...mono, fontSize: 12, color: C.text, fontWeight: 700 }}>{b.label}</span>
                <span style={{ ...mono, fontSize: 11, color: C.grey, flex: 1 }}>{b.words || b.items}</span>
              </div>
              <div style={{ ...mono, fontSize: 11, color: C.grey }}>
                {ago(b.at)} by {b.by}{b.note ? ` · ${b.note}` : ""} · delivered {b.nd} of {b.np}, <span style={{ color: pend.length ? C.amber : C.grey }}>waiting {pend.length}</span>, cancelled {b.nc}{b.announced ? ", announced" : ""}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Btn small color={C.grey} onClick={() => setOpen((o) => ({ ...o, [b.id]: !o[b.id] }))}>{open[b.id] ? "Hide names" : "Names"}</Btn>
                {pend.length > 0 && <Btn small color={C.red} onClick={() => cancel(b)}>Cancel all waiting</Btn>}
              </div>
              {open[b.id] && (
                <div style={{ ...mono, fontSize: 11, display: "flex", flexDirection: "column", gap: 4 }}>
                  {pend.length > 0 && <div style={{ color: C.amber }}>Waiting: {pend.map((n) => (
                    <span key={n} style={{ marginRight: 8, whiteSpace: "nowrap" }}>{n}{online.has(n.toLowerCase()) ? " (online)" : ""}
                      <button onClick={() => cancel(b, n)} title={`Cancel for ${n}`} style={{ ...mono, marginLeft: 3, fontSize: 10, background: "transparent", color: C.red, border: 0, cursor: "pointer" }}>x</button></span>))}</div>}
                  {del.length > 0 && <div style={{ color: C.green }}>Delivered: {del.map(([n, at]) => `${n} (${ago(at)})`).join(", ")}</div>}
                  {cx.length > 0 && <div style={{ color: C.grey }}>Cancelled: {cx.map(([n]) => n).join(", ")}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
