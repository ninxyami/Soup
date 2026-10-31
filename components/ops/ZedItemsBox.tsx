// @ts-nocheck
"use client";
// components/ops/ZedItemsBox.tsx - Live Ops > a player's card: "Zombies with items" (2026-10-30, Nin: "plant items inside zombies
// which we can spawn next to players", e.g. meg has no phone, so a zombie near them carries one).
// The game request is ev_zed (zed_group_patch.py on the bot, O.eventZed in the mod): 1-10 zombies 12-25 squares behind the player,
// out of their view, never closer than 8; the items are on the first one's body, or on each one's. The game refuses an id it
// doesn't have. Players never see who sent them; the admin's name and note are in the logs only.
// Find an item is the Gifts tab's search (it asks the game through the Panther tab's SearchItems). Zombita Control > GIFTS in game
// has the same tool. Its own file so the /ops page only gets two lines (other branches edit that page too).
import { useCallback, useEffect, useRef, useState } from "react";
import { API } from "@/lib/constants";
import { ItemIcon } from "@/components/quests/ui";

const C = { gold: "#c8a84b", green: "#4caf7d", red: "#e05555", amber: "#e0a040", grey: "#9aa", text: "#e6e6e6", bg: "#0b0d10", line: "#2a2f37" };
const mono = { fontFamily: "var(--mono, monospace)" };
const inp = { ...mono, fontSize: 12, padding: "6px 8px", background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 3, width: "100%", boxSizing: "border-box" };
const small = { ...mono, fontSize: 11, color: C.grey };
const heading = { ...mono, fontSize: 10, color: C.grey, textTransform: "uppercase", letterSpacing: 1, marginTop: 6 };
const MAX_ZEDS = 10, DIST_MIN = 8, DIST_MAX = 40, DEF_DIST = [12, 25], MAX_ITEMS = 50, MAX_LINES = 20, NOTE_MAX = 200;
const FIND_MIN = 2, FIND_PAUSE_MS = 350, FIND_POLL_MS = 400, FIND_WAIT_MS = 12000, FIND_SHOW = 40, FIND_KEEP = 60;
const LINE_RE = /^([A-Za-z0-9_]+\.[A-Za-z0-9_\-]+)\s*(?:[*xX]\s*)?(\d*)$/;
const OUTFIT_RE = /^[A-Za-z0-9_]{1,60}$/;
const OUTFITS = ["Tourist", "Police", "Doctor", "Nurse", "Fireman", "Farmer", "Hunter", "Survivalist", "Mechanic", "Chef", "Biker", "Student", "Teacher", "Postal", "ArmyCamoGreen"];

/** The items text -> { lines: [[id, n], ...], total, error } (the same lines as the Gifts tab). */
export function parseItems(text) {
  const lines = [];
  let total = 0;
  for (const raw of String(text || "").split(/[,;\r\n]+/)) {
    const part = raw.trim();
    if (!part) continue;
    const m = LINE_RE.exec(part);
    const n = m ? (m[2] ? Number(m[2]) : 1) : 0;
    if (!m || n < 1) return { lines: [], total: 0, error: `Not an item line (Module.Item*count): ${part}` };
    lines.push([m[1], n]);
    total += n;
  }
  if (lines.length > MAX_LINES) return { lines, total, error: `At most ${MAX_LINES} different items.` };
  if (total > MAX_ITEMS) return { lines, total, error: `At most ${MAX_ITEMS} items on one zombie (${total} now).` };
  return { lines, total, error: "" };
}

/** Put an item in the text: more of a line that has it, else a new line. */
export function addItemLine(text, id, count) {
  const parts = String(text || "").split(/[,;\r\n]+/).map((p) => p.trim()).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const m = LINE_RE.exec(parts[i]);
    if (!m || m[1] !== id) continue;
    parts[i] = `${id}*${(m[2] ? Number(m[2]) : 1) + count}`;
    return parts.join("\n");
  }
  parts.push(`${id}*${count}`);
  return parts.join("\n");
}

/** What's in the way of sending, or "". */
export function blocker({ parsed, count, outfit, dmin, dmax }) {
  if (!parsed.lines.length) return "Give them something to carry.";
  if (parsed.error) return parsed.error;
  if (!(count >= 1 && count <= MAX_ZEDS)) return `Zombies: 1 to ${MAX_ZEDS}.`;
  if (outfit && !OUTFIT_RE.test(outfit)) return "An outfit name is letters, digits and _ only, e.g. Tourist.";
  if (!(dmin >= DIST_MIN && dmax <= DIST_MAX)) return `Distance: ${DIST_MIN} to ${DIST_MAX} squares.`;
  if (dmax < dmin) return "The farthest can't be under the nearest.";
  return "";
}

/** The confirm box, in plain words. */
export function confirmText(name, { parsed, count, who, outfit, dmin, dmax }) {
  const what = parsed.lines.map(([id, n]) => `${n}x ${id.split(".").pop()}`).join(", ");
  const carry = count === 1 ? "It carries" : who === "all" ? "Each one carries" : "One of them carries";
  return `Send ${count} zombie${count === 1 ? "" : "s"} to ${name}?\n\n${carry}: ${what}\nOutfit: ${outfit || "normal"}. ${dmin}-${dmax} squares away, behind them.\n\n`
    + "Not killed: an ordinary zombie, and the items are gone at the next restart.";
}

async function get(path) {
  const r = await fetch(`${API}${path}`, { credentials: "include" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`);
  return d;
}

/** The game's text for one item, the same words its search looks in. */
const searchText = (r) => `${r.id} ${r.name} ${r.category || ""} ${r.module || ""}`.toLowerCase();

/** An answer we already have: this search, or a shorter one the game sent whole. -> { rows, total } or null */
function fromKnown(known, want) {
  const same = known.get(want);
  if (same) return same;
  for (const [k, v] of known) {
    if (!want.includes(k) || v.total > v.rows.length) continue;
    const rows = v.rows.filter((r) => searchText(r).includes(want));
    return { rows, total: rows.length };
  }
  return null;
}

/** Best first: the name itself, names that start with it, a word that starts with it, the rest. */
function rankItems(rows, want) {
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
  throw new Error("No answer from the game. You can still type ids below.");
}

function ItemSearch({ have, onAdd }) {
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
  const n = Math.min(MAX_ITEMS, Math.max(1, parseInt(count, 10) || 1));
  const usable = found ? found.rows.filter((r) => LINE_RE.test(r.id)) : [];
  const total = found ? found.total - (found.rows.length - usable.length) : 0;
  const rows = rankItems(usable, want).slice(0, FIND_SHOW);
  const status = err ? "" : asking ? "Asking the game..." : want.length === 1 ? `Type at least ${FIND_MIN} letters.` : !found ? ""
    : !total ? "No item by that name." : total > rows.length ? `Showing ${rows.length} of ${total}: type more to narrow it down.`
    : `${total} found. Click one to add it.`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input style={{ ...inp, flex: "1 1 160px", width: "auto" }} maxLength={80} placeholder="Find an item: type its name or id" value={q} onChange={(e) => setQ(e.target.value)} />
        <label style={{ ...small, display: "flex", alignItems: "center", gap: 4 }}>Count
          <input type="number" min={1} max={MAX_ITEMS} style={{ ...inp, width: 56 }} value={count} onChange={(e) => setCount(e.target.value)} /></label>
      </div>
      {err && <div style={{ ...small, color: C.amber }}>{err}</div>}
      {status && <div style={small}>{status}</div>}
      {rows.length > 0 && (
        <div style={{ maxHeight: 200, overflowY: "auto", border: `1px solid ${C.line}`, borderRadius: 3 }}>
          {rows.map((r) => (
            <button key={r.id} onClick={() => onAdd(r.id, n)} title={`Add ${n}`}
              style={{ ...mono, fontSize: 12, display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "3px 8px", background: have[r.id] ? "#1d1a10" : "transparent",
                color: C.text, border: 0, borderBottom: `1px solid ${C.bg}`, cursor: "pointer", textAlign: "left" }}>
              <ItemIcon id={r.id} size={20} />
              <span style={{ flex: 1 }}>{r.name}</span>
              <span style={{ fontSize: 10, color: C.grey }}>{r.id}</span>
              <span style={{ fontSize: 11, color: C.gold, minWidth: 48, textAlign: "right" }}>{have[r.id] ? `${have[r.id]} on it` : `+${n}`}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ZedItemsBox({ p, act, Btn }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState("");
  const [count, setCount] = useState(1);
  const [who, setWho] = useState("first");
  const [outfit, setOutfit] = useState("");
  const [dmin, setDmin] = useState(DEF_DIST[0]);
  const [dmax, setDmax] = useState(DEF_DIST[1]);
  const [note, setNote] = useState("");

  if (!open) return <div><div style={heading}>Zombies with items</div><Btn small onClick={() => setOpen(true)}>Plant items in zombies</Btn></div>;

  const parsed = parseItems(items);
  const form = { parsed, count, who: count > 1 ? who : "first", outfit: outfit.trim(), dmin, dmax };
  const why = blocker(form);
  const send = () => {
    if (!confirm(confirmText(p.name, form))) return;
    act("ev_zed", { player: p.name, items: parsed.lines.map(([id, n]) => ({ id, n })), count, who: form.who, outfit: form.outfit, dmin, dmax, note: note.trim() }, () => { setItems(""); setNote(""); });
  };
  const num = (v, set) => <input type="number" style={{ ...inp, width: 56 }} value={v} onChange={(e) => set(parseInt(e.target.value, 10) || 0)} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={heading}>Zombies with items</div>
      <div style={small}>They come up behind {p.name}, out of their view, and walk to them. The items are on the body when it dies. Players never see who sent them.</div>
      <ItemSearch have={Object.fromEntries(parsed.lines)} onAdd={(id, n) => setItems((t) => addItemLine(t, id, n))} />
      <textarea style={{ ...inp, minHeight: 54 }} placeholder={"Zombita.PhoneFlip*1\nBase.Bandage*3"} value={items} onChange={(e) => setItems(e.target.value)} />
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={small}>Zombies</span>{num(count, setCount)}
        <select style={{ ...inp, width: 190 }} value={form.who} disabled={count <= 1} onChange={(e) => setWho(e.target.value)}>
          <option value="first">Only one carries it</option>
          <option value="all">Each one carries it</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={small}>Outfit</span>
        <input style={{ ...inp, width: 130 }} list="zed-outfits" maxLength={60} placeholder="Normal" value={outfit} onChange={(e) => setOutfit(e.target.value)} />
        <datalist id="zed-outfits">{OUTFITS.map((o) => <option key={o} value={o} />)}</datalist>
        <span style={small}>From</span>{num(dmin, setDmin)}<span style={small}>to</span>{num(dmax, setDmax)}<span style={small}>squares</span>
      </div>
      <input style={inp} maxLength={NOTE_MAX} placeholder="Note for the log (optional, admins only)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <Btn small disabled={!!why} title={why} onClick={send}>Send the zombies</Btn>
        <Btn small color={C.grey} onClick={() => setOpen(false)}>Close</Btn>
      </div>
      {items.trim() && why && <div style={{ ...small, color: C.red }}>{why}</div>}
    </div>
  );
}
