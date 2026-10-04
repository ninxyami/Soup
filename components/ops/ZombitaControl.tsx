// @ts-nocheck
"use client";
// components/ops/ZombitaControl.tsx - Live Ops "Zombita" mode (2026-10-04, mod 1.7.116): the in-game Zombita Control
// panel on the website. Data: /api/admin/ops/board (the game's own panel board, every 10 s). Buttons go through the same
// /api/admin/ops/do as the rest of Live Ops: za_action (a panel action, run by the game with no player object),
// za_switch (a module switch), za_bridge (a bot-side panel command: treasury, keepers, towns, areas, files, hub, stats).
// Game actions wait while the server is paused (nobody online); bridge ones work any time.
import { useCallback, useEffect, useMemo, useState } from "react";
import { API } from "@/lib/constants";

const C = { gold: "#c8a84b", blue: "#4a8fc4", green: "#4caf7d", red: "#e05555", purple: "#9775cc", grey: "#9aa", text: "#e6e6e6", bg: "#0b0d10", panel: "#111418", line: "#2a2f37", teal: "#4ab0a8" };
const mono = { fontFamily: "var(--mono, monospace)" };
const inp = { ...mono, fontSize: 12, padding: "5px 7px", background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 3, boxSizing: "border-box" };

export const ZTABS = [
  ["overview", "Overview"], ["treasury", "Treasury"], ["shops", "Shops"], ["travel", "Travel"], ["quests", "Quests"],
  ["events", "Events"], ["areas", "Areas"], ["players", "Players"], ["games", "Games"], ["system", "System"],
];
const WIDE = { treasury: true, players: true, games: true, system: true, overview: true };   // no map work: give the panel room

const SHOP_TYPES = ["global", "weapons", "mechanic", "medical", "gardener", "melee", "tailor", "librarian", "music"];
const SWITCHES = [
  ["phone", "Zombita Phone", "Messages, contacts, calls, games."], ["vehicles", "Vehicle claims", "Claim orbs; claimed cars refuse strangers."],
  ["dotd", "Dawn of the Dead", "Zombita's horde events."], ["bus", "Zombita Bus", "Ticketed fast travel."],
  ["shop", "Zombita Shop", "Kiosks, buying / selling, the marketplace."], ["npc", "Zombita (the NPC)", "The companion at the diner and her chat."],
  ["lb", "Leaderboard", "The rankings board and its icon."], ["mags", "Magazine wear", "Magazines wearing out over reads."],
  ["factions", "Faction spaces", "The faction window, ranks, recruitment, claims."], ["hub", "Server Hub", "News, events, links, profiles, the newspaper."],
  ["map_shops", "Shops on the map", "A cart at every kiosk on players' maps."], ["map_bus", "Bus stations on the map", "A bus at every station with its SAFE / DANGER mark."],
  ["quests", "Zombita's Jobs", "Quests on the phone, traps, reward codes."], ["treasury", "Treasury, in public", "The town's balance on kiosks, the Hub and the board."],
];
const DOTD_FIELDS = [
  ["interval_hours", "Every (hours)", "interval_hours"], ["waves", "Waves", "waves"], ["zombies_per_wave", "Zombies per wave", "zombies"],
  ["wave_interval_mins", "Minutes between waves", "gap_mins"], ["min_spawn_distance", "Min spawn distance", "min_dist"], ["max_spawn_distance", "Max spawn distance", "max_dist"],
];
const TIERS = ["D", "C", "B", "A", "S"];

const yes = (v) => v === true || v === "true" || v === 1 || v === "1";
const n = (v) => Number(v) || 0;
const list = (v) => (Array.isArray(v) ? v : []);
function money(b) {
  const v = Math.round(n(b));
  const silver = Math.abs(v) >= 1000 ? ` (${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} silver)` : "";
  return `${v.toLocaleString()} b${silver}`;
}
function ago(sec) {
  const s = n(sec);
  if (!s) return "";
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 172800) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

function Btn({ children, onClick, color = C.gold, disabled = false, title = "" }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ ...mono, fontSize: 11, padding: "3px 8px", background: "transparent", color: disabled ? "#555" : color, border: `1px solid ${disabled ? "#333" : color}`,
        borderRadius: 3, cursor: disabled ? "default" : "pointer", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{children}</button>
  );
}
function Box({ title, right = null, children }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 3, padding: 10, display: "flex", flexDirection: "column", gap: 6, background: C.bg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><b style={{ fontSize: 13 }}>{title}</b><span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>{right}</span></div>
      {children}
    </div>
  );
}
const Row = ({ children }) => <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>{children}</div>;
const Note = ({ children, color = C.grey }) => <div style={{ ...mono, fontSize: 11, color }}>{children}</div>;
function KV({ k, v, color = C.text }) {
  return <div style={{ ...mono, fontSize: 12, display: "flex", gap: 8 }}><span style={{ color: C.grey, minWidth: 150 }}>{k}</span><span style={{ color }}>{v}</span></div>;
}
function Dot({ on, label }) {
  return <span style={{ ...mono, fontSize: 11, display: "inline-flex", alignItems: "center", gap: 5, marginRight: 10 }}>
    <span style={{ width: 8, height: 8, borderRadius: 4, background: on ? C.green : C.red }} />{label}</span>;
}

// ── the whole mode ──────────────────────────────────────────────────────────
export default function ZombitaControl({ act, setPick, st, players, setLayer, setWide, tab, setTab }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/admin/ops/board`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json()); setErr("");
    } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => {
    let stop = false, t = null;
    const tick = async () => { await load(); if (!stop) t = setTimeout(tick, 5000); };
    tick();
    return () => { stop = true; clearTimeout(t); };
  }, [load]);
  useEffect(() => { setWide(!!WIDE[tab]); }, [tab, setWide]);
  useEffect(() => () => { setLayer({ dots: [], rects: [] }); setWide(false); }, [setLayer, setWide]);

  // every button: run it, then read the board again so the panel shows the result
  const run = useCallback(async (cmd, args) => { await act(cmd, args); setTimeout(load, 1500); }, [act, load]);
  const za = useCallback((mod, action, args = {}) => run("za_action", { mod, action, args }), [run]);
  const bridge = useCallback((bcmd, params = {}) => run("za_bridge", { bcmd, params }), [run]);
  const sw = useCallback((id, on) => run("za_switch", { id, on }), [run]);
  // a map click for a tool: the page's pick mode "z" calls back with the world square
  const pickOnMap = useCallback((hint, cb) => setPick({ mode: "z", hint, cb }), [setPick]);

  const b = data?.board || {};
  const mods = b.mods || {};
  const ctx = { b, mods, data, za, bridge, sw, pickOnMap, players, st, setLayer };
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <div style={{ display: "flex", flexWrap: "wrap", borderBottom: `1px solid ${C.line}` }}>
        {ZTABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ ...mono, flex: "1 0 19%", fontSize: 11, padding: "8px 4px", background: tab === k ? C.bg : "transparent",
            color: tab === k ? C.gold : C.grey, border: 0, borderBottom: tab === k ? `2px solid ${C.gold}` : "2px solid transparent", cursor: "pointer", textTransform: "uppercase" }}>{l}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {err && <Note color={C.red}>Can't read Zombita Control: {err}</Note>}
        {data && data.stale && <Note color={C.gold}>
          {data.ts ? `The game's panel data is ${ago(data.age)} old: the server pauses when nobody is online (or the mod is older than 1.7.116).` : "No panel data from the game yet (mod 1.7.116 needed)."}
          {" "}Game buttons wait until someone joins. Bridge buttons (treasury, keepers, towns, areas, files, hub, stats) work any time.</Note>}
        {tab === "overview" && <Overview {...ctx} />}
        {tab === "treasury" && <Treasury {...ctx} />}
        {tab === "shops" && <Shops {...ctx} />}
        {tab === "travel" && <Travel {...ctx} />}
        {tab === "quests" && <Quests {...ctx} />}
        {tab === "events" && <Events {...ctx} />}
        {tab === "areas" && <Areas {...ctx} />}
        {tab === "players" && <PlayersZ {...ctx} />}
        {tab === "games" && <Games {...ctx} />}
        {tab === "system" && <System {...ctx} />}
      </div>
    </div>
  );
}

// ── overview ────────────────────────────────────────────────────────────────
function Overview({ b, mods, data }) {
  const hb = b.hb || {}, t = b.treasury || {}, mood = b.mood || {};
  const alerts = list(b.alerts).slice().reverse();
  return (<>
    <Box title="Health">
      <div><Dot on={!data?.stale} label="Game" /><Dot on={yes(b.bridgeOnline)} label="Bridge" /><Dot on={yes(hb.bot)} label="Discord bot" />
        <Dot on={yes(hb.api_http)} label="Website API" /><Dot on={yes(hb.api_db)} label="Database" /><Dot on={yes(hb.shopw)} label="Shop watcher" /></div>
      <KV k="Players online" v={n(b.players)} />
      <KV k="Mod version" v={b.version || "?"} />
      {hb.restart_state && <KV k="Restart" v={`${hb.restart_state}${hb.restart_source ? ` (${hb.restart_source})` : ""}`} />}
    </Box>
    <Box title="Town at a glance">
      <KV k="Treasury" v={money(t.balance)} color={yes(t.healthy) ? C.green : C.gold} />
      <KV k="Health" v={`${n(t.health_pct)}%  ${t.state || ""}`} />
      {yes(t.recession) && <KV k="Recession" v={t.recession_reason || "yes"} color={C.red} />}
      <KV k="Zombita's mood" v={`${mood.mood || "?"}${mood.reason ? `: ${mood.reason}` : ""}`} />
      <KV k="Dawn of the Dead" v={mods.dotd ? (yes(mods.dotd.running) ? `running, wave ${n(mods.dotd.wave)}/${n(mods.dotd.total)}` : "quiet") : "not loaded"} />
      <KV k="Open quests" v={list(mods.quests?.active).length} />
    </Box>
    <Box title={`Alerts (${alerts.length})`}>
      {alerts.length === 0 && <Note>Nothing yet.</Note>}
      {alerts.map((a, i) => <div key={i} style={{ ...mono, fontSize: 11, color: a.level === "bad" ? "#f3b0b0" : a.level === "good" ? "#a9e0bf" : C.text }}>
        <span style={{ color: C.grey }}>{a.kind ? `[${a.kind}] ` : ""}</span>{a.text}</div>)}
    </Box>
  </>);
}

// ── treasury ────────────────────────────────────────────────────────────────
function Treasury({ b, bridge }) {
  const t = b.treasury || {}, r = b.trule || {}, mood = b.mood || {};
  const [amt, setAmt] = useState(""), [why, setWhy] = useState("");
  const adjust = (sign) => {
    const v = Math.abs(Math.round(Number(amt)));
    if (!v) return alert("How many bronze?");
    if (!why.trim()) return alert("Give a reason (it goes in the treasury log).");
    if (!confirm(sign > 0 ? `Add ${v.toLocaleString()} NEW bronze to the treasury?` : `Remove ${v.toLocaleString()} bronze from the treasury? Those coins are destroyed.`)) return;
    bridge("treasury_adjust", { amount: sign * v, reason: why.trim() });
  };
  return (<>
    <Box title="Treasury">
      <KV k="Balance" v={money(t.balance)} color={C.gold} />
      <KV k="Cap" v={money(t.cap)} />
      <KV k="Health" v={`${n(t.health_pct)}%  (${t.state || "?"})`} />
      <KV k="Coins in players' hands" v={`${n(t.supply_pct)}% of the total`} />
      <KV k="Last 24 h" v={`paid ${money(t.paid_24h)} · burned ${money(t.burned_24h)} · recycled ${money(t.recycled_24h)}`} />
      <KV k="Purchase tax" v={t.purchase_tax ?? "?"} />
      {yes(t.recession) && <KV k="Recession" v={`${t.recession_reason || ""} (x${t.recession_factor || "?"})`} color={C.red} />}
      <Row>
        <input style={{ ...inp, width: 110 }} placeholder="bronze" value={amt} onChange={(e) => setAmt(e.target.value)} />
        <input style={{ ...inp, flex: 1, minWidth: 140 }} placeholder="reason (logged)" value={why} onChange={(e) => setWhy(e.target.value)} />
        <Btn color={C.green} onClick={() => adjust(1)}>Add coins</Btn>
        <Btn color={C.red} onClick={() => adjust(-1)}>Remove coins</Btn>
      </Row>
      <Row>
        <Btn disabled={!yes(t.recession)} onClick={() => confirm("End the recession now?") && bridge("end_recession")}>End recession</Btn>
        <Btn onClick={() => confirm("Re-price every shop item now?") && bridge("pricing_pass")}>Run pricing pass</Btn>
      </Row>
    </Box>
    <Box title="Zombita's mood">
      <KV k="Mood" v={`${mood.mood || "?"} (${mood.intensity ?? "?"})`} />
      {mood.reason && <Note>{mood.reason}</Note>}
    </Box>
    {r && Object.keys(r).length > 0 && <Box title="Treasury rules">
      {Object.entries(r).map(([k, v]) => <KV key={k} k={k} v={String(v)} />)}
    </Box>}
    <Box title="Money flows (recent)">
      {list(b.tflow).map((f, i) => <KV key={i} k={f.src} v={`${f.dir === "out" ? "-" : "+"}${money(f.amount)}`} color={f.dir === "out" ? "#f3b0b0" : "#a9e0bf"} />)}
      {list(b.tflow).length === 0 && <Note>No flows recorded yet.</Note>}
    </Box>
    <Box title="Treasury log">
      {list(b.tlog).map((l, i) => <Note key={i} color={C.text}>{Object.values(l).join(" · ")}</Note>)}
    </Box>
    <Box title="Recent transactions">
      {list(b.txn).map((l, i) => <Note key={i} color={C.text}>{Object.values(l).join(" · ")}</Note>)}
    </Box>
  </>);
}

// ── shops: rotation, low stock, keepers, kiosks on the map ──────────────────
function Shops({ b, mods, za, bridge, pickOnMap, st, setLayer }) {
  const rot = list(b.rot), keepers = list(b.keepers), ks = (st?.kiosks || []).filter((k) => k.kind === "shop");
  const [src, setSrc] = useState("treasury");
  const [sel, setSel] = useState(null);
  useEffect(() => {
    setLayer({ dots: ks.map((k) => ({ id: "zk:" + k.id, label: k.name, x: k.x, y: k.y, size: 10, color: k.id === sel ? "#fff" : k.off ? "#666" : C.gold,
      onClick: () => setSel(k.id) })), rects: [] });
  }, [st, sel]);
  const k = ks.find((x) => x.id === sel);
  const till = (kp) => {
    const v = Math.round(Number(prompt(`Coins for ${kp.name}'s till (it has ${n(kp.bal).toLocaleString()}). A minus takes coins out.`) || 0));
    if (!v) return;
    const reason = prompt("Reason (logged):") || "";
    if (!reason.trim()) return;
    const text = v > 0 ? (src === "treasury" ? `Move ${v} bronze from the treasury into ${kp.name}'s till?` : `Create ${v} new bronze in ${kp.name}'s till?`)
      : (src === "treasury" ? `Take ${-v} bronze out of ${kp.name}'s till back into the treasury?` : `Take ${-v} bronze out of ${kp.name}'s till and destroy it?`);
    if (confirm(text)) bridge("keeper_adjust", { persona: kp.persona, amount: v, source: src, reason: reason.trim() });
  };
  return (<>
    <Box title="Kiosks on the map" right={<Note>{ks.length} kiosks · click one</Note>}>
      {!k && <Note>Click a shop on the map (gold dots) to move, reset or close it.</Note>}
      {k && <>
        <KV k={k.name} v={`${k.x}, ${k.y}${k.off ? " · CLOSED" : ""}`} color={C.gold} />
        <Row>
          <Btn onClick={() => pickOnMap(`Click where ${k.name} should stand now.`, (w) => confirm(`Move ${k.name} to ${w.x}, ${w.y}?`) && za("shop", "setKiosk", { id: k.id, x: w.x, y: w.y, z: 0 }))}>Move on the map</Btn>
          <Btn color={C.grey} onClick={() => confirm(`Put ${k.name} back where the mod placed it?`) && za("shop", "resetKiosk", { id: k.id })}>Reset spot</Btn>
          {k.off ? <Btn color={C.green} onClick={() => za("shop", "restoreKiosk", { id: k.id })}>Reopen</Btn>
            : <Btn color={C.red} onClick={() => confirm(`Close ${k.name}? The kiosk stops trading until reopened.`) && za("shop", "destroyKiosk", { id: k.id })}>Close</Btn>}
          <Btn color={C.grey} onClick={() => setSel(null)}>Done</Btn>
        </Row>
      </>}
    </Box>
    <Box title="Rotations">
      {SHOP_TYPES.map((s) => {
        const r = rot.find((x) => x.shop === s) || {};
        return <Row key={s}><span style={{ ...mono, fontSize: 12, width: 90 }}>{s}</span>
          <Note>{r.items ?? "?"} items · {r.out ?? 0} out · {r.low ?? 0} low{r.next_in ? ` · next ${r.next_in}` : ""}</Note>
          <span style={{ marginLeft: "auto" }}><Btn onClick={() => confirm(`Roll a new rotation for the ${s} shops now? The current shelf is replaced.`) && bridge("shop_rotate", { shop: s })}>Roll</Btn></span></Row>;
      })}
    </Box>
    <Box title={`Running low (${list(b.low).length})`}>
      {list(b.low).map((l, i) => <Note key={i} color={C.text}>{Object.values(l).join(" · ")}</Note>)}
    </Box>
    <Box title="Shopkeepers" right={<select style={{ ...inp, width: 150 }} value={src} onChange={(e) => setSrc(e.target.value)}>
      <option value="treasury">coins from / to the treasury</option><option value="new">new coins / destroy</option></select>}>
      {keepers.map((kp) => <Row key={kp.persona}>
        <span style={{ ...mono, fontSize: 12, width: 120 }}>{kp.name}</span>
        <Note>{kp.shop} · till {n(kp.bal).toLocaleString()} / {n(kp.target).toLocaleString()} · {n(kp.sales)} sales · {n(kp.refusals)} refusals</Note>
        <span style={{ marginLeft: "auto" }}><Btn onClick={() => till(kp)}>Coins</Btn></span></Row>)}
      {keepers.length === 0 && <Note>No keeper data (the bridge sends it).</Note>}
    </Box>
  </>);
}

// ── travel: bus stations, towns ─────────────────────────────────────────────
function Travel({ b, mods, za, bridge, pickOnMap, st, setLayer }) {
  const bus = mods.bus || {}, stations = (st?.kiosks || []).filter((k) => k.kind === "bus");
  const status = bus.overrides || {};
  const [sel, setSel] = useState(null);
  useEffect(() => {
    setLayer({ dots: stations.map((k) => ({ id: "zb:" + k.id, label: k.name, x: k.x, y: k.y, size: 10,
      color: k.id === sel ? "#fff" : k.off ? "#666" : (status[k.id] === "danger" ? C.red : C.blue), onClick: () => setSel(k.id) })), rects: [] });
  }, [st, sel, b]);
  const k = stations.find((x) => x.id === sel);
  const towns = list(b.town);
  return (<>
    <Box title="Bus stations" right={<Note>{stations.length} · {n(bus.tripCount)} trips · {n(bus.ticketsSpent)} tickets</Note>}>
      {!k && <Note>Click a station on the map (blue dots; red = marked DANGER).</Note>}
      {k && <>
        <KV k={k.name} v={`${k.x}, ${k.y}${k.off ? " · CLOSED" : ""} · ${status[k.id] || "status unknown"}`} color={C.blue} />
        <Row>
          <Btn color={C.green} onClick={() => za("bus", "setStatus", { id: k.id, status: "safe" })}>Safe</Btn>
          <Btn color={C.red} onClick={() => za("bus", "setStatus", { id: k.id, status: "danger" })}>Danger</Btn>
          <Btn color={C.grey} onClick={() => za("bus", "setStatus", { id: k.id, status: "unknown" })}>?</Btn>
        </Row>
        <Row>
          <Btn onClick={() => pickOnMap(`Click where ${k.name} should stand now.`, (w) => confirm(`Move ${k.name} to ${w.x}, ${w.y}?`) && za("bus", "setStation", { id: k.id, x: w.x, y: w.y, z: 0 }))}>Move on the map</Btn>
          <Btn color={C.grey} onClick={() => za("bus", "resetStation", { id: k.id })}>Reset spot</Btn>
          {k.off ? <Btn color={C.green} onClick={() => za("bus", "restoreStation", { id: k.id })}>Reopen</Btn>
            : <Btn color={C.red} onClick={() => confirm(`Close ${k.name}?`) && za("bus", "destroyStation", { id: k.id })}>Close</Btn>}
          <Btn color={C.grey} onClick={() => setSel(null)}>Done</Btn>
        </Row>
      </>}
      {list(bus.trips).slice(0, 8).map((t, i) => <Note key={i}>{Object.values(t).join(" · ")}</Note>)}
    </Box>
    <Box title={`Towns (${towns.length})`} right={<>
      <Btn color={C.grey} onClick={() => confirm("Turn towns on/off to match the server's map list?") && bridge("towns_match", {})}>Follow map list</Btn>
      <Btn color={C.grey} onClick={() => confirm("Re-read the map files and rebuild the town areas?") && bridge("towns_rebuild", {})}>Re-read maps</Btn></>}>
      {towns.map((t) => <Row key={t.name}>
        <span style={{ ...mono, fontSize: 12, width: 160, color: yes(t.on) ? C.text : "#666" }}>{t.name}</span>
        <Note>{t.src}{n(t.hours) ? ` · ${n(t.hours)} h played` : ""}</Note>
        <span style={{ marginLeft: "auto" }}><Btn color={yes(t.on) ? C.red : C.green} onClick={() => bridge("town_set", { town: t.name, on: !yes(t.on) })}>{yes(t.on) ? "Turn off" : "Turn on"}</Btn></span></Row>)}
    </Box>
    <Box title="Who's in which town">
      {list(b.twho).map((w, i) => <Note key={i} color={C.text}>{w.name}: {w.town} {w.ago ? `(${w.ago})` : ""}</Note>)}
    </Box>
  </>);
}

// ── quests ──────────────────────────────────────────────────────────────────
function Quests({ mods, za, pickOnMap, players }) {
  const q = mods.quests || {};
  const active = list(q.active), rows = list(q.rows);
  const [g, setG] = useState({ player: "", type: "", tier: "C", coins: "", x: null, y: null });
  const types = useMemo(() => Array.from(new Set([...active.map((a) => a.type), ...rows.map((r) => r.type)].filter(Boolean))), [q]);
  const give = () => {
    if (!g.player || !g.type) return alert("Pick a player and a quest type.");
    const args = { player: g.player, type: g.type, tier: g.tier };
    if (g.coins) args.coins = Math.round(Number(g.coins));
    if (g.x) { args.x = g.x; args.y = g.y; }
    if (confirm(`Give ${g.player} a ${g.tier} ${g.type} quest${g.x ? ` at ${g.x}, ${g.y}` : ""}?`)) za("quests", "give", args);
  };
  return (<>
    <Box title={`Open quests (${active.length})`} right={<>
      <Btn onClick={() => za("quests", "post_now")}>Post now</Btn><Btn color={C.purple} onClick={() => confirm("Post an S quest now?") && za("quests", "post_s", { big: true })}>Post S</Btn></>}>
      {active.map((a) => <Row key={a.id}>
        <span style={{ ...mono, fontSize: 12 }}>[{a.tier}] {a.title}</span>
        <Note>{a.type}{a.onlyFor ? ` · for ${a.onlyFor}` : ""}{a.who ? ` · ${a.who}` : n(a.racers) ? ` · ${n(a.racers)} racing` : " · nobody yet"}</Note>
        <span style={{ marginLeft: "auto" }}><Btn color={C.red} onClick={() => confirm(`Cancel "${a.title}"?`) && za("quests", "cancel", { id: a.id })}>Cancel</Btn></span></Row>)}
      {active.length === 0 && <Note>None open.</Note>}
    </Box>
    <Box title="Give a quest">
      <Row>
        <select style={{ ...inp, width: 140 }} value={g.player} onChange={(e) => setG({ ...g, player: e.target.value })}>
          <option value="">player...</option>{players.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}</select>
        <input style={{ ...inp, width: 110 }} list="zq-types" placeholder="type" value={g.type} onChange={(e) => setG({ ...g, type: e.target.value })} />
        <datalist id="zq-types">{types.map((t) => <option key={t} value={t} />)}</datalist>
        <select style={{ ...inp, width: 60 }} value={g.tier} onChange={(e) => setG({ ...g, tier: e.target.value })}>{TIERS.map((t) => <option key={t}>{t}</option>)}</select>
        <input style={{ ...inp, width: 90 }} placeholder="coins (opt.)" value={g.coins} onChange={(e) => setG({ ...g, coins: e.target.value })} />
      </Row>
      <Row>
        <Btn color={C.grey} onClick={() => pickOnMap("Click where the quest happens.", (w) => setG((x) => ({ ...x, x: w.x, y: w.y })))}>{g.x ? `At ${g.x}, ${g.y}` : "Spot on the map (optional)"}</Btn>
        {g.x && <Btn color={C.grey} onClick={() => setG({ ...g, x: null, y: null })}>No spot</Btn>}
        <span style={{ marginLeft: "auto" }}><Btn color={C.green} onClick={give}>Give</Btn></span>
      </Row>
    </Box>
    <Box title="Pay and rest per tier" right={<Btn color={C.grey} onClick={() => { const v = prompt("Daily limit for quest pay (bronze):", q.cap ?? ""); if (v) za("quests", "cap", { coins: Math.round(Number(v)) }); }}>Daily limit {q.cap ? `(${n(q.cap).toLocaleString()})` : ""}</Btn>}>
      {TIERS.map((t) => <Row key={t}>
        <span style={{ ...mono, fontSize: 12, width: 30 }}>{t}</span>
        <Note>pay {money(q["pot" + t])} · rest {n(q["cool" + t])} min</Note>
        <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <Btn color={C.grey} onClick={() => { const v = prompt(`Pay for tier ${t} (bronze):`, q["pot" + t] ?? ""); if (v) za("quests", "pot", { tier: t, coins: Math.round(Number(v)) }); }}>Pay</Btn>
          <Btn color={C.grey} onClick={() => { const v = prompt(`Rest after a tier ${t} quest (minutes):`, q["cool" + t] ?? ""); if (v) za("quests", "cool", { tier: t, minutes: Math.round(Number(v)) }); }}>Rest</Btn>
        </span></Row>)}
      <Note>Minted this week: {money(q.mintSpent)} of {money(q.mintCap)}</Note>
    </Box>
    <Box title={`Reward rows (${rows.length})`}>
      {rows.map((r) => <div key={r.id} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 5 }}>
        <Row><span style={{ ...mono, fontSize: 12 }}>{r.name || r.id}</span><Note>+{n(r.rep)} rep{yes(r.custom) ? " · custom" : ""}</Note>
          <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <Btn color={C.grey} onClick={() => { const v = prompt("Reputation for this reward (0-10):", r.rep ?? 0); if (v !== null) za("quests", "rep", { row: r.id, rep: Math.round(Number(v)) }); }}>Rep</Btn>
            <Btn color={C.grey} onClick={() => { const id = prompt("Add an item (Module.Item, e.g. Base.Axe):"); if (!id) return; const c = Math.round(Number(prompt("How many?", "1") || 1)); za("quests", "add_typed", { row: r.id, item: id.trim(), n: c }); }}>+ Item</Btn>
            <Btn color={C.grey} onClick={() => confirm("Empty this reward's duffel?") && za("quests", "clear_items", { row: r.id })}>Empty</Btn>
            <Btn color={C.grey} onClick={() => confirm("Back to the default reward?") && za("quests", "default", { row: r.id })}>Default</Btn>
          </span></Row>
        {list(r.items).length > 0 && <Note>{list(r.items).map((it) => Array.isArray(it) ? `${it[0]} x${it[1]}` : String(it)).join(", ")}</Note>}
      </div>)}
    </Box>
  </>);
}

// ── events: Dawn of the Dead ────────────────────────────────────────────────
function Events({ b, mods, za, bridge }) {
  const d = mods.dotd || {}, cfg = b.dotdCfg || {};
  const on = yes(cfg.enabled);
  return (<>
    <Box title="Dawn of the Dead" right={<Note>{d.running ? `RUNNING · wave ${n(d.wave)}/${n(d.total)}` : "quiet"}</Note>}>
      <Row>
        <Btn color={C.green} onClick={() => confirm("Start Dawn of the Dead now? Every online player gets a horde.") && za("dotd", "start")}>Start now</Btn>
        <Btn onClick={() => za("dotd", "warning")}>Send warning</Btn>
        <Btn color={C.red} onClick={() => confirm("Cancel Dawn of the Dead? Waves stop right away.") && za("dotd", "cancel")}>Cancel</Btn>
        <Btn color={C.grey} onClick={() => za("dotd", "clear")}>Clear HUD</Btn>
      </Row>
      {d.running && <Note>{n(d.count)} per wave · {n(d.spawned)} spawned · next wave in {n(d.nextWaveIn)}s</Note>}
    </Box>
    <Box title="Zombita's schedule" right={<Btn color={on ? C.red : C.green} onClick={() => {
      if (on) { if (confirm("Turn off Zombita's Dawn of the Dead schedule? Players see it as disabled.")) { bridge("dotd_disable"); za("dotd", "disable"); } }
      else { bridge("dotd_enable"); za("dotd", "clear"); }
    }}>{on ? "Turn off" : "Turn on"}</Btn>}>
      <KV k="Scheduler" v={on ? "ON" : "OFF"} color={on ? C.green : C.red} />
      {cfg.next_in != null && <KV k="Next event" v={`in ${Math.round(n(cfg.next_in) / 60)} min`} />}
      {DOTD_FIELDS.map(([field, label, key]) => <Row key={field}>
        <span style={{ ...mono, fontSize: 12, width: 190, color: C.grey }}>{label}</span><span style={{ ...mono, fontSize: 12 }}>{cfg[key] ?? "?"}</span>
        <span style={{ marginLeft: "auto" }}><Btn color={C.grey} onClick={() => { const v = prompt(`${label}:`, cfg[key] ?? ""); if (v) bridge("dotd_set", { field, value: String(v) }); }}>Set</Btn></span></Row>)}
    </Box>
    <Note>Hordes, loot bags and bandit events at a spot are in Live mode, World tab.</Note>
  </>);
}

// ── areas: save / restore / copy / paste / clear, picked on the map ─────────
function Areas({ b, mods, za, bridge, pickOnMap, setLayer }) {
  const st = b.areast || {}, areas = list(b.area), jobs = list(b.areajob), bks = list(b.areabk), tiles = mods.tiles || {};
  const [box, setBox] = useState(null);
  useEffect(() => {
    const rects = areas.filter((a) => n(a.x2)).map((a) => ({ id: "za:" + a.id, x: n(a.x1), y: n(a.y1), w: n(a.x2) - n(a.x1) + 1, h: n(a.y2) - n(a.y1) + 1,
      color: C.teal, fill: "rgba(74,176,168,.08)", label: a.name }));
    if (box) rects.push({ id: "za:box", x: box.x1, y: box.y1, w: box.x2 - box.x1 + 1, h: box.y2 - box.y1 + 1, color: "#fff", dashed: true, fill: "rgba(255,255,255,.08)",
      label: `${box.x2 - box.x1 + 1} x ${box.y2 - box.y1 + 1}` });
    setLayer({ dots: [], rects });
  }, [b, box]);
  const pickBox = () => pickOnMap("Click one corner of the area.", (a) => pickOnMap("Now click the opposite corner.", (c) =>
    setBox({ x1: Math.min(a.x, c.x), y1: Math.min(a.y, c.y), x2: Math.max(a.x, c.x), y2: Math.max(a.y, c.y) })));
  return (<>
    <Box title="Pick an area" right={<Btn onClick={pickBox}>{box ? "Pick again" : "Pick on the map"}</Btn>}>
      {box ? <Note color={C.text}>{box.x1},{box.y1} to {box.x2},{box.y2} ({box.x2 - box.x1 + 1} x {box.y2 - box.y1 + 1})</Note> : <Note>Two clicks: opposite corners.</Note>}
      <Row>
        <Btn disabled={!box} color={C.green} onClick={() => { const name = prompt("Name for this snapshot:"); if (name) bridge("area_save", { name, ...box }); }}>Save area now</Btn>
        <Btn disabled={!box} onClick={() => { const name = prompt("Name for the copied tiles:"); if (name) za("tiles", "copy", { ...box, name }); }}>Copy tiles</Btn>
        <Btn disabled={!box} color={C.red} onClick={() => {
          if (!confirm("Clear every tile in this area? A snapshot is saved first.")) return;
          bridge("area_save", { name: "before clear", ...box }); za("tiles", "clear", { ...box, delay: 0 });
        }}>Clear tiles</Btn>
      </Row>
      <Note>Copy / paste / clear need someone near the area (the server only has loaded ground there).</Note>
    </Box>
    <Box title="Copied tiles" right={tiles.has ? <Btn color={C.grey} onClick={() => za("tiles", "forget")}>Forget</Btn> : null}>
      {yes(tiles.has) ? <>
        <Note color={C.text}>{tiles.name}: {n(tiles.w)} x {n(tiles.h)} · {n(tiles.count)} tiles{tiles.by ? ` · by ${tiles.by}` : ""}</Note>
        <Btn onClick={() => pickOnMap("Click the top-left corner where the tiles go.", (w) => {
          if (!confirm(`Paste ${tiles.name} with its top-left at ${w.x}, ${w.y}? A snapshot of that spot is saved first.`)) return;
          bridge("area_save", { name: "before paste " + tiles.name, x1: w.x, y1: w.y, x2: w.x + n(tiles.w) - 1, y2: w.y + n(tiles.h) - 1 });
          za("tiles", "paste", { x: w.x, y: w.y, delay: 0 });
        })}>Paste on the map</Btn></> : <Note>Nothing copied.</Note>}
      {tiles.lastText && <Note>{tiles.lastText}</Note>}
    </Box>
    <Box title={`Snapshots (${areas.length})`} right={<Btn color={C.red} onClick={() => confirm("Restart the server now to apply queued restores?") && bridge("area_restart", {})}>Restart now</Btn>}>
      <Note>{st.snaps ?? areas.length} saved · {st.last_msg || ""}</Note>
      {areas.map((a) => <Row key={a.id}>
        <span style={{ ...mono, fontSize: 12 }}>{a.name}</span><Note>{a.when} · {a.by} · {a.mb ?? a.kb} {a.mb ? "MB" : "KB"}{yes(a.queued) ? " · QUEUED" : ""}{yes(a.other_world) ? " · older world" : ""}</Note>
        <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <Btn onClick={() => confirm(`Restore "${a.name}"? It takes effect at the next restart.`) && bridge("area_restore", { id: String(a.id), force: yes(a.other_world) })}>Restore</Btn>
          <Btn color={C.red} onClick={() => confirm(`Delete snapshot "${a.name}"?`) && bridge("area_delete", { id: String(a.id) })}>Delete</Btn>
        </span></Row>)}
    </Box>
    {jobs.length > 0 && <Box title="Queued jobs">
      {jobs.map((j) => <Row key={j.id}><Note color={C.text}>{j.name} · {j.status} {j.result || ""}</Note>
        <span style={{ marginLeft: "auto" }}><Btn color={C.grey} onClick={() => bridge("area_cancel", { id: String(j.id) })}>Cancel</Btn></span></Row>)}
    </Box>}
    {bks.length > 0 && <Box title="Nightly world backups">
      {bks.map((k) => <Row key={k.file}><Note color={C.text}>{k.file} · {k.when}</Note>
        <span style={{ marginLeft: "auto" }}><Btn disabled={!box} onClick={() => { const name = prompt("Name for the imported area:"); if (name) bridge("area_import", { backup: k.file, name, ...box, force: yes(k.old_world) }); }}>Import picked area</Btn></span></Row>)}
      <Note>Pick an area first, then import that area from a backup.</Note>
    </Box>}
  </>);
}

// ── players: Player Hub, phone settings, leaderboard and stats ──────────────
function PlayersZ({ b, mods, za, bridge }) {
  const qs = list(b.phq), lbs = b.lbs || {}, sts = b.sts || {};
  return (<>
    <Box title="Player Hub questions" right={<Btn color={C.green} onClick={() => { const t = prompt("New question:"); if (t) bridge("hub_q_add", { text: t }); }}>Add</Btn>}>
      {qs.map((q) => <Row key={q.id}>
        <span style={{ ...mono, fontSize: 12, color: yes(q.on) ? C.text : "#666", flex: 1 }}>{q.text}</span>
        <Btn color={C.grey} onClick={() => bridge("hub_q_move", { id: n(q.id), dir: "up" })}>▲</Btn>
        <Btn color={C.grey} onClick={() => bridge("hub_q_move", { id: n(q.id), dir: "down" })}>▼</Btn>
        <Btn color={C.grey} onClick={() => { const t = prompt("Edit the question:", q.text); if (t) bridge("hub_q_edit", { id: n(q.id), text: t }); }}>Edit</Btn>
        <Btn color={yes(q.on) ? C.grey : C.green} onClick={() => bridge("hub_q_toggle", { id: n(q.id) })}>{yes(q.on) ? "Hide" : "Show"}</Btn>
        <Btn color={C.red} onClick={() => confirm("Remove this question?") && bridge("hub_q_remove", { id: n(q.id) })}>×</Btn></Row>)}
    </Box>
    <Box title="Latest answers">
      {list(b.pha).map((a, i) => <Note key={i} color={C.text}><b>{a.player}</b>: {a.answer} <span style={{ color: C.grey }}>({a.question})</span></Note>)}
    </Box>
    <Box title="Leaderboard session">
      <KV k="Season" v={lbs.season ?? "?"} /><KV k="Started" v={lbs.started_text || "?"} /><KV k="Days" v={lbs.days ?? "?"} />
      <Row>
        <Btn onClick={() => { const t = prompt("Title for the session that ends now:"); if (t !== null) za("lb", "endSession", { title: t }); }}>End session</Btn>
        <Btn color={C.red} onClick={() => confirm("Reset the leaderboard? Everyone starts from zero.") && za("lb", "resetBoard")}>Reset board</Btn>
      </Row>
    </Box>
    <Box title="Stats season">
      <KV k="Season" v={sts.season ?? "?"} /><KV k="Started" v={sts.started_text || "?"} /><KV k="Players" v={sts.players ?? "?"} />
      <Row>
        <Btn onClick={() => { const t = prompt("Title for the season that ends now:"); if (t !== null) bridge("stats_end", { title: t }); }}>End season</Btn>
        <Btn color={C.red} onClick={() => confirm("Reset the stats? This can't be undone.") && bridge("stats_reset", {})}>Reset stats</Btn>
      </Row>
    </Box>
    <Settings title="Phone settings" mod="phone" state={mods.phone} za={za} />
  </>);
}

// ── a module's s_<key> settings, editable (phone, games, vehicles, factions) ─
function Settings({ title, mod, state, za, filter = null, textKeys = false }) {
  const s = state || {};
  const keys = Object.keys(s).filter((k) => k.startsWith("s_") && (!filter || filter(k.slice(2)))).sort();
  const texts = textKeys ? Object.keys(s).filter((k) => k.startsWith("t_")).sort() : [];
  const action = mod === "factions" ? "settings" : "setting";
  if (!state) return <Box title={title}><Note>Not loaded on the server.</Note></Box>;
  return (
    <Box title={title}>
      {keys.map((k) => {
        const key = k.slice(2), v = s[k];
        const isBool = typeof v === "boolean" || v === "true" || v === "false";
        return <Row key={k}>
          <span style={{ ...mono, fontSize: 12, flex: 1, color: C.grey }}>{key}</span>
          {isBool ? <Btn color={yes(v) ? C.green : C.grey} onClick={() => za(mod, action, { key, value: !yes(v) })}>{yes(v) ? "On" : "Off"}</Btn>
            : <><span style={{ ...mono, fontSize: 12 }}>{String(v)}</span>
              <Btn color={C.grey} onClick={() => { const nv = prompt(`${key}:`, String(v)); if (nv === null || nv === "") return;
                const num = Number(nv); za(mod, action, { key, value: isNaN(num) ? nv : num }); }}>Set</Btn></>}
        </Row>;
      })}
      {texts.map((k) => <Row key={k}><span style={{ ...mono, fontSize: 12, flex: 1, color: C.grey }}>{k.slice(2)}</span>
        <Btn color={C.grey} onClick={() => { const nv = prompt(`${k.slice(2)}:`, String(s[k] || "")); if (nv !== null) za(mod, action, { key: k.slice(2), text: nv }); }}>Edit text</Btn></Row>)}
      {keys.length === 0 && texts.length === 0 && <Note>No settings reported.</Note>}
    </Box>
  );
}

// ── games ───────────────────────────────────────────────────────────────────
function Games({ mods, za }) {
  return (<>
    <Settings title="Coin games" mod="games" state={mods.games} za={za} filter={(k) => !k.startsWith("ww_") && !k.startsWith("cah_")} />
    <Settings title="Party games (Werewolf, Cards Against Zombies)" mod="games" state={mods.games} za={za} filter={(k) => k.startsWith("ww_") || k.startsWith("cah_")} />
  </>);
}

// ── system: switches, server files, world, Zombita herself, vehicles, factions ─
function System({ b, mods, za, bridge, sw }) {
  const switches = b.switches || {};
  const files = list(b.cfgf), backups = list(b.cfgb);
  const npc = mods.npc || {}, mags = mods.mags || {}, world = mods.world || {}, rv = mods.rv || {};
  const [say, setSay] = useState("");
  return (<>
    <Box title="Zombita modules">
      {SWITCHES.map(([id, label, what]) => {
        const on = switches[id] !== false;
        return <Row key={id}>
          <span style={{ ...mono, fontSize: 12, width: 180, color: on ? C.text : "#777" }}>{label}</span><Note>{what}</Note>
          <span style={{ marginLeft: "auto" }}><Btn color={on ? C.red : C.green} onClick={() => confirm(`${on ? "Turn OFF" : "Turn ON"} ${label} for everyone?`) && sw(id, !on)}>{on ? "Turn off" : "Turn on"}</Btn></span></Row>;
      })}
    </Box>
    <Box title="Server files" right={<>
      <Btn onClick={() => { const l = prompt("Label for this servertest.ini backup (optional):", ""); if (l !== null) bridge("config_backup", { kind: "ini", label: l }); }}>Back up ini</Btn>
      <Btn onClick={() => { const l = prompt("Label for this SandboxVars.lua backup (optional):", ""); if (l !== null) bridge("config_backup", { kind: "sandbox", label: l }); }}>Back up sandbox</Btn></>}>
      {files.map((f) => <Note key={f.kind} color={C.text}>{f.kind === "ini" ? "servertest.ini" : "SandboxVars.lua"} · changed {f.ago || "?"}{f.mods ? ` · ${f.mods} mods` : ""}</Note>)}
      {backups.slice(0, 15).map((e, i) => <Row key={i}>
        <Note color={C.text}>{e.kind} · {e.when} · {e.src}{e.label ? ` "${e.label}"` : ""}{e.by ? ` by ${e.by}` : ""}</Note>
        <span style={{ marginLeft: "auto" }}><Btn color={C.grey} onClick={() => confirm(`Restore ${e.kind === "ini" ? "servertest.ini" : "SandboxVars.lua"} from ${e.when}? The current file is backed up first; it takes effect at the next restart.`)
          && bridge("config_restore", { kind: e.kind, src: e.src, file: e.file })}>Restore</Btn></span></Row>)}
    </Box>
    <Box title="Zombita (the NPC)">
      <KV k="In the world" v={yes(npc.inWorld) ? `yes, at ${n(npc.x)}, ${n(npc.y)}` : "no"} />
      <KV k="Chats" v={`${n(npc.chats)} (last by ${npc.lastChatBy || "nobody"})`} />
      <Row>
        <input style={{ ...inp, flex: 1 }} placeholder="Make her say something..." value={say} onChange={(e) => setSay(e.target.value)} />
        {["SAY", "SHOUT", "BUBBLE"].map((ch) => <Btn key={ch} disabled={!say.trim()} onClick={() => { za("npc", "say", { channel: ch, message: say.trim() }); setSay(""); }}>{ch}</Btn>)}
      </Row>
      <Row><Btn color={C.grey} onClick={() => za("npc", "resync")}>Resend her look</Btn>
        <Btn color={C.grey} onClick={() => confirm("Respawn Zombita at the diner? Someone must be near the diner.") && za("npc", "respawn")}>Respawn</Btn></Row>
    </Box>
    <Box title="Time and world">
      <Row><Btn color={C.grey} onClick={() => za("time", "writeNow")}>Write game time now</Btn><Btn color={C.grey} onClick={() => za("lb", "writeNow")}>Write rankings now</Btn>
        <Btn color={C.grey} onClick={() => za("lb", "reload")}>Reload whitelist</Btn><Btn color={C.grey} onClick={() => confirm("Update the media (radio / TV) now? It restarts the server.") && bridge("media_update", {})}>Update media</Btn></Row>
      <Row><span style={{ ...mono, fontSize: 12, width: 190, color: C.grey }}>Magazine wear</span>
        <Btn color={yes(mags.enabled) ? C.green : C.grey} onClick={() => za("mags", "setEnabled", { on: !yes(mags.enabled) })}>{yes(mags.enabled) ? "On" : "Off"}</Btn>
        <Note>{n(mags.maxReads)} reads</Note><Btn color={C.grey} onClick={() => { const v = prompt("Reads before a magazine wears out (1-20):", mags.maxReads ?? 5); if (v) za("mags", "setMaxReads", { value: Math.round(Number(v)) }); }}>Set</Btn></Row>
      <Row><span style={{ ...mono, fontSize: 12, width: 190, color: C.grey }}>Keep world settings after a wipe</span>
        <Btn color={yes(world.keep) ? C.green : C.grey} onClick={() => za("world", "setKeep", { on: !yes(world.keep) })}>{yes(world.keep) ? "On" : "Off"}</Btn>
        <Btn color={C.grey} onClick={() => za("world", "saveNow")}>Save now</Btn></Row>
      {rv.present && <Row><span style={{ ...mono, fontSize: 12, width: 190, color: C.grey }}>RV spawns</span><Note>big {rv.big ?? "?"} · small {rv.small ?? "?"}</Note>
        <Btn color={C.grey} onClick={() => { const v = prompt("Big RV rate (0-10):", rv.big ?? ""); if (v) za("rv", "setRate", { which: "big", value: Number(v) }); }}>Big</Btn>
        <Btn color={C.grey} onClick={() => { const v = prompt("Small RV rate (0-10):", rv.small ?? ""); if (v) za("rv", "setRate", { which: "small", value: Number(v) }); }}>Small</Btn></Row>}
    </Box>
    <Settings title="Vehicle claims" mod="vehicles" state={mods.vehicles} za={za} />
    <Row><Btn color={C.grey} onClick={() => za("vehicles", "rebuild")}>Rebuild claim database</Btn><Btn color={C.grey} onClick={() => confirm("Expire old claims now?") && za("vehicles", "expire")}>Expire claims now</Btn></Row>
    <Settings title="Faction spaces" mod="factions" state={mods.factions} za={za} textKeys />
    <Row><Btn color={C.grey} onClick={() => za("factions", "syncClaims")}>Check claims</Btn></Row>
  </>);
}
