// @ts-nocheck
"use client";
// components/quests/GiveLog.tsx: give one player a job of your own (Give), and what was asked of the game and what it
// answered (Log), with the specials and IOUs the bot keeps.

import { useEffect, useRef, useState } from "react";
import { C, MONO, BODY, Btn, Card, Note, Pill, Input, Select, Label, Empty, ItemsEditor, ItemIcon, money, ago, fmt, inputStyle } from "./ui";

const TWISTS = ["ambush", "road", "moved", "bandits", "bait"];
const TIER_ORDER = "DCBAS";
// Nin 2026-10-18: "random option too and also pre options for items based on difficulty. lighter is common so D so if i just put
// lighter it will auto select the difficulty". Auto tier = the hardest tier among the reward items (their shop rarity: common D,
// uncommon C, rare B, epic A, legendary S; the bot's give_tiers); an item the shop doesn't sell counts as B, no items = B. Random type = any type that has that tier.
const FALLBACK_TIER = "B";
function autoTier(items, meta) {
  let best = "";
  for (const [id] of items) {
    const t = meta[id] || FALLBACK_TIER;         // not sold in shops: counted as B
    if (!best || TIER_ORDER.indexOf(t) > TIER_ORDER.indexOf(best)) best = t;
  }
  return best || FALLBACK_TIER;
}
/** the allowed tier nearest to want (a type that has no D job: its lowest tier above, else the highest below) */
function nearestTier(want, allowed) {
  if (allowed.includes(want)) return want;
  const i = TIER_ORDER.indexOf(want);
  return allowed.find((t) => TIER_ORDER.indexOf(t) > i) || allowed[allowed.length - 1] || want;
}
const tiersOf = (t) => String(t?.tiers || "DCBAS").split("");

// A few shop items of one tier's rarity, one click each (GET /api/admin/jobs/items/ideas, the bot's give_tiers).
function ItemIdeas({ apiGet, tier, onAdd }) {
  const [t, setT] = useState(tier);
  const [ideas, setIdeas] = useState(null);
  const [err, setErr] = useState("");
  const load = (x) => {
    setT(x); setIdeas(null); setErr("");
    apiGet(`/api/admin/jobs/items/ideas?tier=${x}`)
      .then((d) => { setIdeas(d?.ideas || []); if (d?.error) setErr(d.error); })
      .catch(() => { setIdeas([]); setErr("Item ideas need the bot's give_tiers update."); });
  };
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint, letterSpacing: 1 }}>ITEM IDEAS</span>
        {TIER_ORDER.split("").map((x) => <Btn key={x} sm c={ideas && t === x ? "solid" : "dim"} onClick={() => load(x)}>{x}</Btn>)}
        {ideas && <Btn sm c="dim" onClick={() => load(t)}>Shuffle</Btn>}
      </div>
      {ideas && ideas.length === 0 && <Note style={{ marginTop: 6 }}>{err || "No shop items of that rarity."}</Note>}
      {ideas && ideas.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {ideas.map((it) => (
            <button key={it.id} type="button" title={`${it.id} (${it.rarity})`} onClick={() => onAdd(it)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: C.bg, border: `1px solid ${C.line}`, color: C.text, cursor: "pointer", fontFamily: BODY, fontSize: 13 }}>
              <ItemIcon id={it.id} size={20} />{it.name}<span style={{ color: C.gold, fontFamily: MONO }}>+</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Player box with a list (Nin 2026-10-17: no typing names). Empty box = who's online now (Live Ops state); typing
// searches every in-game name the rankings know (all characters ever seen), online ones first. Free typing still works.
function PlayerPicker({ value, onChange, apiGet }) {
  const [online, setOnline] = useState([]);
  const [all, setAll] = useState([]);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    let stop = false;
    const loadOnline = () => apiGet("/api/admin/ops/state").then((s) => !stop && setOnline((s?.players || []).map((p) => p.name).filter(Boolean))).catch(() => {});
    loadOnline();
    apiGet("/api/rankings").then((d) => !stop && setAll([...new Set((d?.players || []).map((p) => p.name).filter(Boolean))])).catch(() => {});
    const t = setInterval(loadOnline, 30000);
    return () => { stop = true; clearInterval(t); };
  }, [apiGet]);
  useEffect(() => {
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);
  const q = (value || "").trim().toLowerCase();
  const on = new Set(online.map((n) => n.toLowerCase()));
  const byName = (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" });
  const rows = q
    ? [...new Set([...online, ...all])].filter((n) => n.toLowerCase().includes(q))
        .sort((a, b) => (on.has(b.toLowerCase()) - on.has(a.toLowerCase())) || byName(a, b)).slice(0, 40)
    : [...online].sort(byName);
  const pick = (n) => { onChange(n); setOpen(false); };
  return (
    <div ref={box} style={{ position: "relative" }}>
      <input value={value ?? ""} placeholder={`Pick or search (${online.length} online)`} onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); if (e.key === "Enter" && rows[0]) pick(rows[0]); }}
        style={{ ...inputStyle, width: "100%" }} />
      {open && (
        <div style={{ position: "absolute", zIndex: 30, top: "100%", left: 0, right: 0, maxHeight: 280, overflowY: "auto",
          background: C.panel2, border: `1px solid ${C.line}`, fontFamily: MONO, fontSize: 13 }}>
          <div style={{ padding: "6px 10px", fontSize: 11, color: C.faint, letterSpacing: 1 }}>
            {q ? `${rows.length >= 40 ? "First 40" : rows.length} match${rows.length === 1 ? "" : "es"} (all players)` : "ONLINE NOW · type to search everyone"}
          </div>
          {rows.length === 0 && <div style={{ padding: "6px 10px", color: C.dim }}>{q ? "No player by that name." : "Nobody online."}</div>}
          {rows.map((n) => (
            <div key={n} onMouseDown={(e) => { e.preventDefault(); pick(n); }}
              style={{ padding: "6px 10px", cursor: "pointer", color: C.text, display: "flex", alignItems: "center", gap: 8 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.line)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: on.has(n.toLowerCase()) ? C.green : C.faint, flex: "none" }} />
              {n}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Give({ state, send, apiGet }) {
  const types = (state.control?.types || []).filter((t) => t.live !== false);
  const [f, setF] = useState({ player: "", type: "random", tier: "auto", coins: "", hours: "", title: "", text: "", twist: "", test: false });
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({});        // item id -> its rarity tier ("" = the shop doesn't sell it)
  const noteItem = (it) => setMeta((m) => ({ ...m, [it.id]: it.tier || "" }));
  const addIdea = (it) => {
    noteItem(it);
    setItems((cur) => (cur.some((x) => x[0] === it.id) || cur.length >= 20 ? cur : [...cur, [it.id, 1]]));
  };
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  // a test job only when the game (mod 1.8.12: testJobs) AND the bot (jobs_test_give: testGive) both handle it, else it'd be real
  const canTest = state?.testJobs === true && state?.testGive === true;
  const t = types.find((x) => x.id === f.type);
  const tiers = t ? tiersOf(t) : ["D", "C", "B", "A", "S"];
  const auto = autoTier(items, meta);
  const tier = f.tier === "auto" ? nearestTier(auto, tiers) : f.tier;
  const unknown = items.filter(([id]) => !meta[id]).map(([id]) => id);
  const go = () => {
    let type = f.type;
    if (type === "random") {
      const fit = types.filter((x) => tiersOf(x).includes(tier));
      type = (fit.length ? fit : types)[Math.floor(Math.random() * (fit.length || types.length))]?.id || "horde";
    }
    const a = { player: f.player.trim(), type, tier };
    if (f.coins !== "" && f.coins != null) a.coins = Math.max(0, Math.min(100000, Math.floor(Number(f.coins) || 0)));
    if (f.hours !== "" && f.hours != null) a.hours = Math.max(0.5, Math.min(168, Number(f.hours) || 1));
    if (f.title.trim()) a.title = f.title.trim().slice(0, 60);
    if (f.text.trim()) a.text = f.text.trim().slice(0, 200);
    if (f.twist) a.twist = f.twist;
    if (items.length) a.items = items.map(([id, n]) => ({ id, n }));
    if (f.test && canTest) a.test = true;           // mod 1.8.12: plays normally, pays and records nothing
    send("give", a, `${f.test ? "Test job" : "Job"} (${type}, ${tier}) given to ${a.player}`);
  };
  return (
    <Card title="Give a quest">
      <Note style={{ marginBottom: 14 }}>A job for one player only, from the admins. It appears on their phone (red, an admin job) and skips the tier unlocks and the job type switches.
        Leave a field empty to use the tier's normal value.</Note>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <div><Label>Player</Label><PlayerPicker value={f.player} onChange={set("player")} apiGet={apiGet} /></div>
        <div><Label>Type</Label><Select value={f.type} onChange={set("type")}
          options={[{ value: "random", label: "Random (any type)" }, ...types.map((x) => ({ value: x.id, label: x.name }))]} />
          {f.type === "random" && <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint, marginTop: 3 }}>picked when you press Give, from the types that have tier {tier}</div>}</div>
        <div><Label>Tier</Label><Select value={f.tier} onChange={set("tier")}
          options={[{ value: "auto", label: `Auto (${tier})` }, ...tiers.map((x) => ({ value: x, label: x }))]} />
          {f.tier === "auto" && <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint, marginTop: 3 }}>
            {items.length ? `from the reward's rarity${unknown.length ? `; not sold in shops: ${unknown.length} (counted as ${FALLBACK_TIER})` : ""}` : `add an item, or ${FALLBACK_TIER}`}</div>}</div>
        <div><Label>Twist</Label><Select value={f.twist} onChange={set("twist")} options={[{ value: "", label: "none" }, ...TWISTS]} /></div>
        <div><Label>Pay (bronze)</Label><Input type="number" value={f.coins} onChange={set("coins")} placeholder="tier's pot" min={0} max={100000} />
          {f.coins !== "" && <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint, marginTop: 3 }}>{money(Number(f.coins) || 0)}</div>}</div>
        <div><Label>Hours to do it</Label><Input type="number" value={f.hours} onChange={set("hours")} placeholder="tier's time" min={0.5} max={168} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 12 }}>
        <div><Label>Title (optional)</Label><Input value={f.title} onChange={set("title")} placeholder="Zombita's own words if empty" /></div>
        <div><Label>Text (optional)</Label><Input value={f.text} onChange={set("text")} /></div>
        <div><Label>Extra items for the winner (optional)</Label><ItemsEditor items={items} onChange={setItems} apiGet={apiGet} onMeta={noteItem} />
          <ItemIdeas apiGet={apiGet} tier={tier} onAdd={addIdea} /></div>
      </div>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 16, cursor: canTest ? "pointer" : "not-allowed", padding: "10px 12px",
        opacity: canTest ? 1 : 0.55, border: `1px solid ${f.test ? C.orange : C.line}`, background: f.test ? "rgba(212,135,58,0.08)" : "transparent" }}>
        <input type="checkbox" checked={f.test} disabled={!canTest} onChange={(e) => set("test")(e.target.checked)} style={{ marginTop: 3, accentColor: C.orange }} />
        <span>
          <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 1, color: f.test ? C.orange : C.text }}>TEST JOB (FOR ADMINS)</span>
          <span style={{ display: "block", fontFamily: BODY, fontSize: 12, color: C.dim, marginTop: 3, lineHeight: 1.5 }}>
            Plays like a real job (waves, bag, twist, timer) with "[TEST]" in its title. When it ends nothing is paid and nothing is
            recorded: no coins, items or reputation, no Job Rank, leaderboards, notoriety, cards, Discord or newspaper, and no rest.
            {!canTest && <span style={{ color: C.orange }}> Not ready yet: needs mod 1.8.12 live and the bot's jobs_test_give patch (until then a
              "test" would be a real job, so the box stays off).</span>}
          </span>
        </span>
      </label>
      <div style={{ marginTop: 12 }}><Btn c="solid" disabled={!f.player.trim()} onClick={go}>{f.test ? "Give the test job" : "Give the job"}</Btn></div>
    </Card>
  );
}

function SimpleTable({ rows, cols }) {
  if (!rows.length) return <Empty>Nothing here.</Empty>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: BODY, fontSize: 13 }}>
        <thead><tr>{cols.map(([h]) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} style={{ borderBottom: `1px solid ${C.lineSoft}` }}>{cols.map(([h, f]) => <td key={h} style={td}>{f(r)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

const show = (v) => (v == null || v === "" ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

export function Log({ data, mine }) {
  const waiting = data?.waiting || [];
  const log = data?.log || [];
  const specials = data?.specials || [];
  const ious = data?.ious || [];
  const keysOf = (list) => (list[0] ? Object.keys(list[0]).slice(0, 7) : []);
  return (
    <div>
      <Card title={`Sent from this page (${mine.length})`}>
        <SimpleTable rows={mine.slice().reverse()} cols={[
          ["When", (r) => <span style={{ fontFamily: MONO }}>{ago(r.at)}</span>],
          ["What", (r) => <span style={{ color: C.text }}>{r.label}</span>],
          ["Answer", (r) => r.done ? <span style={{ color: r.ok ? C.green : C.red }}>{r.msg || (r.ok ? "Done" : "Failed")}</span> : <Pill c={C.orange}>waiting</Pill>],
        ]} />
      </Card>
      <Card title={`Waiting for the game (${fmt(waiting.length)})`}>
        <Note style={{ marginBottom: 10 }}>The game runs these within a few seconds, but only while someone is online.</Note>
        <SimpleTable rows={waiting.slice(0, 60)} cols={[
          ["When", (r) => <span style={{ fontFamily: MONO }}>{ago(r.at)}</span>],
          ["Request", (r) => <span style={{ fontFamily: MONO, color: C.text }}>{r.cmd}</span>],
          ["Row / job", (r) => r.row || r.job || r.type || ""],
          ["By", (r) => r.by || ""],
        ]} />
        {waiting.length > 60 && <Note style={{ marginTop: 8 }}>And {fmt(waiting.length - 60)} more.</Note>}
      </Card>
      <Card title="The game's last answers">
        <SimpleTable rows={log} cols={[
          ["When", (r) => <span style={{ fontFamily: MONO }}>{ago(r.at)}</span>],
          ["Request", (r) => <span style={{ fontFamily: MONO, color: C.text }}>{r.cmd}</span>],
          ["By", (r) => r.by || ""],
          ["Answer", (r) => <span style={{ color: r.ok ? C.green : C.red }}>{r.msg}</span>],
        ]} />
      </Card>
      <Card title={`Specials (${specials.length})`}><SimpleTable rows={specials} cols={keysOf(specials).map((k) => [k, (r) => show(r[k])])} /></Card>
      <Card title={`IOUs (${ious.length})`}><SimpleTable rows={ious} cols={keysOf(ious).map((k) => [k, (r) => show(r[k])])} /></Card>
    </div>
  );
}

const th = { textAlign: "left", fontFamily: MONO, fontSize: 11, color: C.dim, fontWeight: 400, letterSpacing: 1, padding: "6px 8px", borderBottom: `1px solid ${C.line}` };
const td = { padding: "8px", verticalAlign: "top", color: C.dim };
