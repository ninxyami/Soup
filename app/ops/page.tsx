// @ts-nocheck
"use client";
// app/ops/page.tsx - Live Ops: the admins' live control panel (2026-10-04). The world map with everything the game
// reports (players, safehouses, zombie heat, bandits, claimed vehicles) and the tools to fix things without logging in:
// teleport, give, message, kick, ban, safehouse edit / owner / members / delete / create, faction members / leader /
// claims, chat linked with the Discord in-game chat channel, broadcast, map markers players see in game (1.7.112),
// a player's character: skills / levels, traits, heal, needs, god / invisible / noclip (1.7.114), inventory, cars,
// movement trail + "who was here", warnings, zombies, weather + events, moving shops / bus stations, admin presence (1.7.115).
// Backend: /api/admin/ops/* (routers/liveops.py); the game side is mod 1.7.111 ZO_Server.lua. Admins only.
// 2026-10-24 (mod 1.8.54, liveops_yards_patch.py): the Job spots tab: scrapyards (where tow jobs end), cabin spots, car
// drop-offs and car spawns (where tow wrecks / fleet cars go), added on the map or by x, y, removed one by one or all.
// 2026-10-24 (mod 1.8.56, liveops_places_patch.py): the Places tab's "Admin places": Mags' garage (the Mechanic card spot),
// the community centre, the diner, Duke's car lot and Hattie's pen (squares: the pick is their centre), moved on the map
// or by x, y with place_set, the same as their in-game SET ... HERE buttons.
// 2026-10-30 (mod 1.8.77, sh_respawn_patch.py): a safehouse card shows who respawns there after death (owner + members, faction
// safehouses too) with an ON / OFF switch each: sh_respawn x y owner player on, the same setting as the in-game safehouse
// window and the faction window's RESPAWN AT OUR SAFEHOUSE switch. The game reports the list as "respawn" in its state.
// 2026-10-25 (mod 1.8.66, liveops_gifts_patch.py): the Gifts tab: items for a checklist of players, online or offline
// (components/ops/GiftsTab.tsx; the game hands them over, offline players at their next login). 2026-10-30: Announce to everyone.
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flyTo } from "@/components/WorldMap";
import { API } from "@/lib/constants";
import ZombitaControl from "@/components/ops/ZombitaControl";
import PantherTab from "@/components/ops/PantherTab";
import TigerTab from "@/components/ops/TigerTab";
import GiftsTab from "@/components/ops/GiftsTab";
import PanelGate from "@/components/PanelGate";
import ServerControls from "@/components/ops/ServerControls";
import CorpseClearBox from "@/components/ops/CorpseClearBox";
import ZedItemsBox from "@/components/ops/ZedItemsBox";

// the mode (Live / Zombita) and Zombita's last tab survive a reload (per browser)
function remembered(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } }
function remember(key, value) { try { localStorage.setItem(key, value); } catch {} }

const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

const C = { gold: "#c8a84b", blue: "#4a8fc4", green: "#4caf7d", red: "#e05555", purple: "#9775cc", grey: "#9aa", text: "#e6e6e6", bg: "#0b0d10", panel: "#111418", line: "#2a2f37" };
const mono = { fontFamily: "var(--mono, monospace)" };
const MARK = { go: { label: "Go here", color: "#e8be4a" }, event: { label: "Event", color: "#ec8c3c" }, info: { label: "Info", color: "#60a0dc" },
  danger: { label: "Danger", color: "#e05246" } };
// the Job spots tab's kinds (yards = the Mechanic card's scrapyards; the others are ZQ_Cabins' saved spots)
const SPOT_KINDS = [
  { id: "yards", label: "Scrapyards", pin: "Scrapyard", word: "scrapyard", color: "#d08a4a" },
  { id: "cabin", label: "Cabin spots", pin: "Cabin", word: "cabin spot", color: "#6fbf5a" },
  { id: "car", label: "Car drop-offs", pin: "Drop-off", word: "car drop-off", color: "#4fc3d9" },
  { id: "wreck", label: "Car spawns", pin: "Spawn", word: "car spawn", color: "#d77ad0" },
];
const MAX_YARDS = 8;
// one list per kind: { n, x, y, town, by, seed, check: "ok" | "unchecked" | "bad", why }
function spotRows(st, kind) {
  if (kind === "yards") return (st?.yards || []).map((y) => ({ n: y.i, x: y.x, y: y.y, town: y.place || "", by: y.by || "", at: y.at, check: "ok", why: "" }));
  return st?.spots?.[kind] || [];
}
// the five admin places (mod 1.8.56, liveops_places_patch.py): set here the same way their in-game SET ... HERE button does.
// mags / centre / diner are points; carlot / pen are squares and the pick is their centre (the size stays).
const PLACE_KINDS = [
  { id: "mags", label: "Mags' garage", color: "#e0a040", what: "Mags' garage (the Mechanic card spot and her kiosk)", button: "SET MECHANIC CARD SPOT HERE",
    help: "Players buy the Mechanic card here and the tow truck rolls out onto the nearest free road or lot. Mags' kiosk moves here too. Pick a spot inside the garage or auto shop." },
  { id: "centre", label: "Community centre", color: "#7ec8e3", what: "the community centre", button: "SET COMMUNITY CENTRE HERE",
    help: "Players claim their Job Rank here (when the centre is switched on in the cards settings)." },
  { id: "diner", label: "Diner", color: "#9775cc", what: "Zombita's diner", button: "SET DINER HERE",
    help: "Zombita moves here, patrols here and spawns here after restarts. The map pins follow." },
  { id: "carlot", label: "Car lot", color: "#cfd3da", what: "Duke's car lot", button: "CAR LOT HERE", rect: true, size: 15, keeper: "Duke",
    help: "Duke's sold cars are parked inside this square. You pick its centre; the size stays (Zombita Control > Lot & Pen)." },
  { id: "pen", label: "Animal pen", color: "#b5d67a", what: "Hattie's animal pen", button: "PEN HERE", rect: true, size: 10, keeper: "Hattie",
    help: "Hattie's big animals are let out inside this square. You pick its centre; the size stays (Zombita Control > Lot & Pen)." },
];
// the square a lot / pen covers with its centre on (x, y): the game's own sum (ZS_Lot_Server areaRect)
function placeSquare(cx, cy, n) { const h = Math.floor(n / 2); return { x: cx - h, y: cy - h, w: n, h: n }; }
const LAYERS = [
  { id: "town", label: "Towns", color: "#e6e6e6" },
  { id: "shop", label: "Shops", color: "#c8a84b" },
  { id: "bus", label: "Bus stations", color: "#4a8fc4" },
  { id: "diner", label: "The diner", color: "#9775cc" },
  { id: "markers", label: "Markers", color: "#e8be4a" },
  { id: "players", label: "Players", color: C.green },
  { id: "safehouses", label: "Safehouses", color: C.blue },
  { id: "zombies", label: "Zombies", color: C.red },
  { id: "bandits", label: "Bandits", color: "#e0904a" },
  { id: "vehicles", label: "Claimed cars", color: "#cfd3da" },
  ...SPOT_KINDS.map((k) => ({ id: "sp_" + k.id, label: k.label, color: k.color })),
  { id: "places", label: "Admin places", color: "#e0a040" },
];

async function api(path, body) {
  const r = await fetch(`${API}${path}`, body === undefined ? { credentials: "include" } :
    { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let d = null;
  try { d = await r.json(); } catch {}
  if (!r.ok) { const e = new Error((d && (d.detail || d.error)) || `HTTP ${r.status}`); e.status = r.status; throw e; }
  return d;
}

// A car spawned where a player was JUST teleported can fall out of step with the server: the game lost Dawn's truck,
// the server kept pulling her back to its own copy, and she couldn't forage after (2026-10-04, truck spawned 2 min
// after a teleport into the wilds). So the spawn button asks first when the player moved far in the last 2 minutes.
// Far moves come from two places: the page itself (any teleport, also in-game or a bus ticket, while /ops is open)
// and the website's action log (teleports sent from this site by any admin, even before this page was opened).
const FRESH_MS = 120000;
const farMoves = new Map();          // lower-case name -> ms of their last far move seen by this page
async function secondsSinceTeleport(name) {
  const lc = String(name).toLowerCase();
  let at = farMoves.get(lc) || 0;
  try {
    for (const r of (await api("/api/admin/ops/log")).log || []) {
      if ((r.cmd === "teleport" || r.cmd === "teleport_to") && r.ok !== false && String(r.args?.player || "").toLowerCase() === lc)
        at = Math.max(at, (Number(r.at) || 0) * 1000);
    }
  } catch { /* the log is a bonus; the page's own record still counts */ }
  const ago = Math.round((Date.now() - at) / 1000);
  return at && ago >= 0 && ago * 1000 < FRESH_MS ? ago : null;
}
async function confirmSpawn(name, script) {
  const ago = await secondsSinceTeleport(name);
  if (ago === null) return confirm(`Spawn ${script} next to ${name}?`);
  const wait = Math.max(10, Math.round(FRESH_MS / 1000 - ago));
  return confirm(`${name} was teleported ${ago} s ago and the area around them may still be loading. A car spawned now can get out of `
    + `step with the server: it snaps back and forth and the player has to rejoin (Dawn's truck, Oct 4).\n\n`
    + `Better to wait about ${wait} s more. Spawn ${script} anyway?`);
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

const inp = { ...mono, fontSize: 12, padding: "6px 8px", background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 3, width: "100%", boxSizing: "border-box" };

// the admin panel password first (components/PanelGate.tsx), then Live Ops
export default function OpsPage() {
  return <PanelGate title="LIVE OPS"><OpsInner /></PanelGate>;
}

function OpsInner() {
  const [st, setSt] = useState(null);
  const [err, setErr] = useState("");
  const [layers, setLayers] = useState({ town: true, shop: true, bus: true, diner: true, markers: true, players: true, safehouses: true, zombies: true, bandits: true, vehicles: false,
    sp_yards: true, sp_cabin: false, sp_car: false, sp_wreck: false, places: true });
  const [places, setPlaces] = useState([]);
  const [markDraft, setMarkDraft] = useState(null);     // { x, y } where a new marker goes
  const [markFor, setMarkFor] = useState("");          // a private marker: only this player sees it ("" = everyone)
  const [spotKind, setSpotKind] = useState("yards");    // the Job spots tab's kind
  const [spotDraft, setSpotDraft] = useState(null);     // { x, y } where a new job spot goes
  const [placeSel, setPlaceSel] = useState(null);       // the admin place being moved (PLACE_KINDS id)
  const [placeDraft, setPlaceDraft] = useState(null);   // { x, y } its new spot (a lot / pen: its new centre)
  const [trailPts, setTrailPts] = useState(null);       // { player, points } drawn on the map
  const [spot, setSpot] = useState(null);               // { x, y, for } a spot picked for the World tools
  const [moveK, setMoveK] = useState(null);             // { kind, id, name } a shop / station being moved
  const [carT, setCarT] = useState(null);               // the car being inspected: { player | vid | sid, label } (mod 1.7.133)
  useEffect(() => {
    const on = (e) => { setCarT(e.detail); setMode("live"); };
    window.addEventListener("ops-inspect-car", on);
    return () => window.removeEventListener("ops-inspect-car", on);
  }, []);
  const [admins, setAdmins] = useState([]);             // other admins on /ops right now
  const [meId, setMeId] = useState("");
  // places on/off per kind, like /map (the map hides them with CSS; one object per switch so it doesn't redraw)
  const hiddenKinds = useMemo(() => ({ town: !layers.town, shop: !layers.shop, bus: !layers.bus, diner: !layers.diner }),
    [layers.town, layers.shop, layers.bus, layers.diner]);
  useEffect(() => { fetch("/map/places.json").then((r) => r.json()).then((d) => setPlaces(d.places || [])).catch(() => {}); }, []);
  const [tab, setTab] = useState("players");
  const [selP, setSelP] = useState(null);         // player name
  const [selS, setSelS] = useState(null);         // safehouse key "x,y,owner"
  const [draft, setDraft] = useState(null);       // { x, y, w, h } the safehouse box being edited / created
  const [pick, setPick] = useState(null);         // { mode: "teleport" | "corners", first?: {x,y} }
  const [toasts, setToasts] = useState([]);
  const [chat, setChat] = useState([]);
  const [chatMeta, setChatMeta] = useState({ me: "", source: "" });
  const [mine, setMine] = useState([]);          // what I sent, shown at once until the feed has it
  const [facs, setFacs] = useState({ factions: [], radii: { 1: 10, 2: 20, 3: 30 }, tiers: {} });
  const [selF, setSelF] = useState(null);        // faction fid
  const [claimDraft, setClaimDraft] = useState(null);   // { cx, cy, tier }
  const [log, setLog] = useState([]);
  // Zombita mode: the in-game Zombita Control panel (components/ops/ZombitaControl.tsx)
  const [mode, setModeState] = useState("live");
  const [ztab, setZtabState] = useState("overview");
  const [zLayer, setZLayer] = useState({ dots: [], rects: [] });
  const [zPicked, setZPicked] = useState(null);      // a shop / station pin clicked on the map while in Zombita mode
  // where shops and stations stand now (the public kiosk route; the admin state route doesn't carry them)
  const [kiosks, setKiosks] = useState([]);
  useEffect(() => {
    let stop = false, t = null;
    const tick = async () => { try { setKiosks((await api("/api/map/kiosks")).kiosks || []); } catch {} if (!stop) t = setTimeout(tick, 15000); };
    tick();
    return () => { stop = true; clearTimeout(t); };
  }, []);
  const [wide, setWide] = useState(false);
  useEffect(() => { setModeState(remembered("soup-ops-mode", "live")); setZtabState(remembered("soup-ops-ztab", "overview")); }, []);
  const setMode = useCallback((m) => { setModeState(m); remember("soup-ops-mode", m); setPick(null); }, []);
  const setZtab = useCallback((t) => { setZtabState(t); remember("soup-ops-ztab", t); setPick(null); }, []);

  const toast = useCallback((ok, msg) => {
    const id = Math.random();
    setToasts((t) => [...t, { id, ok, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ok ? 6000 : 12000);
  }, []);

  // poll the world every 5 s
  useEffect(() => {
    let stop = false, timer = null;
    const tick = async () => {
      try { setSt(await api("/api/admin/ops/state")); setErr(""); }
      catch (e) {
        setErr(e.status === 401 ? "Log in with Discord (top right) to use Live Ops." : e.status === 403 ? "Live Ops is for admins only." : `Can't reach the server: ${e.message}`);
        if (e.status === 401 || e.status === 403) return;
      }
      if (!stop) timer = setTimeout(tick, 5000);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, []);

  // Watch every poll for players who moved impossibly far (a 5 s gap allows ~250 squares even in a fast car):
  // on foot that's a teleport (remembered for the spawn check above); in a car both before and after, it's the game
  // snapping the car back (Dawn's truck jumped 373 / 489 / 807 squares). A snap raises a banner that stays until
  // dismissed, with what to tell the player.
  const lastPos = useRef(new Map());
  const [snaps, setSnaps] = useState([]);
  useEffect(() => {
    if (!st?.players) return;
    const now = Date.now(), prev = lastPos.current, next = new Map(), found = [];
    for (const p of st.players) {
      const o = prev.get(p.name);
      if (o && (o.x !== p.x || o.y !== p.y)) {
        const d = Math.round(Math.hypot(p.x - o.x, p.y - o.y)), secs = Math.max(1, (now - o.t) / 1000);
        if (d > 250 && d / secs > 50) {
          if (o.car && p.in_vehicle) found.push({ name: p.name, d, x: p.x, y: p.y, at: now });
          else farMoves.set(String(p.name).toLowerCase(), now);
        }
      }
      // keep the time of the last CHANGE, so a poll that repeats old positions doesn't shrink the gap
      next.set(p.name, o && o.x === p.x && o.y === p.y ? o : { x: p.x, y: p.y, car: !!p.in_vehicle, t: now });
    }
    lastPos.current = next;
    if (!found.length) return;
    setSnaps((cur) => {
      let out = [...cur];
      for (const f of found) {
        const i = out.findIndex((s) => s.name === f.name && f.at - s.last < 5 * 60000);
        if (i >= 0) out[i] = { ...out[i], n: out[i].n + 1, last: f.at, d: Math.max(out[i].d, f.d), x: f.x, y: f.y };
        else out = [...out, { id: f.name + ":" + f.at, name: f.name, n: 1, first: f.at, last: f.at, d: f.d, x: f.x, y: f.y }];
      }
      return out;
    });
    for (const f of found) toast(false, `${f.name}'s car jumped ${f.d} squares. See the banner at the top.`);
  }, [st, toast]);
  useEffect(() => {
    if (tab !== "chat" && tab !== "log" && tab !== "factions") return;
    let stop = false, timer = null;
    const tick = async () => {
      try {
        if (tab === "chat") { const d = await api("/api/admin/ops/chat"); setChat(d.lines || []); setChatMeta({ me: d.me || "", source: d.source || "" }); }
        else if (tab === "factions") setFacs(await api("/api/admin/ops/factions"));
        else setLog((await api("/api/admin/ops/log")).log || []);
      } catch {}
      if (!stop) timer = setTimeout(tick, 5000);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [tab]);

  // one action: RCON ones answer at once; game ones are queued and answered within a few seconds
  const act = useCallback(async (cmd, args, done) => {
    try {
      const r = await api("/api/admin/ops/do", { cmd, ...args });
      if (!r.queued) { toast(r.ok, r.msg || (r.ok ? "Done." : "Failed.")); if (r.ok && done) done(); return; }
      toast(true, "Sent to the game...");
      for (let i = 0; i < 20; i++) {
        await new Promise((ok) => setTimeout(ok, 1500));
        const a = await api(`/api/admin/ops/result/${r.id}`);
        if (a.done) { toast(a.ok, a.msg); if (a.ok && done) done(); return; }
      }
      toast(false, "No answer from the game in 30 s. Is anyone online? (The server pauses when it's empty.) It will run when the server wakes.");
    } catch (e) { toast(false, e.message); }
  }, [toast]);

  const refreshFactions = useCallback(async () => { try { setFacs(await api("/api/admin/ops/factions")); } catch {} }, []);
  useEffect(() => { refreshFactions(); }, [refreshFactions]);   // so a faction claim's box on the map opens its faction
  // shops and stations where they are NOW (admins move them; places.json is the build-time list)
  const livePlaces = useMemo(() => {
    const ks = kiosks;
    if (!ks.length) return places;
    const by = {};
    for (const k of ks) by[k.kind + ":" + k.id] = k;
    return places.filter((pl) => !(by[pl.kind + ":" + pl.id]?.off)).map((pl) => {
      const k = by[pl.kind + ":" + pl.id];
      return k ? { ...pl, x: k.x, y: k.y, name: pl.kind === "bus" && k.name ? k.name : pl.name } : pl;   // mod 1.7.160: a moved station takes its town's name
    });
  }, [places, kiosks]);
  const players = st?.players || [];
  const zSt = useMemo(() => ({ ...(st || {}), kiosks }), [st, kiosks]);   // Zombita mode's view (stable between polls)
  const safehouses = st?.safehouses || [];
  const shKey = (s) => `${s.x},${s.y},${s.owner}`;
  const selected = useMemo(() => safehouses.find((s) => shKey(s) === selS) || null, [safehouses, selS]);
  const selPlayer = players.find((p) => p.name === selP) || null;

  // ── what the map draws ──
  const dots = useMemo(() => {
    const out = [];
    if (layers.players) for (const p of players) out.push({ id: "p:" + p.name, label: p.name, x: p.x, y: p.y, z: p.z, look: p.look, face: p.face, inCar: !!p.in_vehicle, dead: !!p.dead, car: p.car, carAngle: p.car_angle,
      color: p.name === selP ? C.gold : p.dead ? C.red : p.in_vehicle ? C.blue : C.green, onClick: () => { setSelP(p.name); setTab("players"); } });
    if (layers.bandits) (st?.bandits || []).forEach((b, i) => out.push({ id: "b:" + i, label: "", x: b.x, y: b.y, size: 7, color: b.hostile ? "#e0904a" : "#d8c36a" }));
    if (layers.markers) (st?.markers || []).forEach((m) => out.push({ id: "m:" + m.id, label: m.title, x: m.x, y: m.y, size: 12,
      color: (MARK[m.kind] || MARK.go).color, onClick: () => setTab("markers") }));
    if (markDraft) out.push({ id: "m:draft", label: "new marker", x: markDraft.x, y: markDraft.y, size: 12, color: "#fff" });
    for (const k of SPOT_KINDS) {                  // job spots: their layer on, or the Job spots tab open on that kind
      if (!layers["sp_" + k.id] && !(mode === "live" && tab === "spots" && spotKind === k.id)) continue;
      for (const r of spotRows(st, k.id)) out.push({ id: `sp:${k.id}:${r.x},${r.y}`, label: `${k.pin} ${r.n}${r.check === "bad" ? " (bad)" : r.check === "unchecked" ? " (unchecked)" : ""}`,
        x: r.x, y: r.y, size: 10, color: r.check === "bad" ? C.red : k.color, onClick: () => { setSpotKind(k.id); setTab("spots"); } });
    }
    if (spotDraft) out.push({ id: "sp:draft", label: `new ${(SPOT_KINDS.find((k) => k.id === spotKind) || SPOT_KINDS[0]).word}`, x: spotDraft.x, y: spotDraft.y, size: 12, color: "#fff" });
    if (layers.places || (mode === "live" && tab === "places")) for (const P of PLACE_KINDS) {   // the admin places (the diner has its own layer)
      const p = st?.places?.[P.id];
      if (!p || P.id === "diner" || P.rect) continue;         // the lot and the pen are drawn as their squares (rects below)
      out.push({ id: "pl:" + P.id, label: P.label, x: p.x, y: p.y, size: 11, color: P.color,
        onClick: () => { setTab("places"); if (placeSel !== P.id) { setPlaceSel(P.id); setPlaceDraft(null); } } });
    }
    if (placeSel && placeDraft && !PLACE_KINDS.find((k) => k.id === placeSel)?.rect) out.push({ id: "pl:draft", label: `${(PLACE_KINDS.find((k) => k.id === placeSel) || PLACE_KINDS[0]).label} (new)`,
      x: placeDraft.x, y: placeDraft.y, size: 12, color: "#fff" });
    if (trailPts?.points?.length) {
      const pts = trailPts.points, step = Math.max(1, Math.ceil(pts.length / 300));
      for (let i = 0; i < pts.length; i += step) {
        const t = i / Math.max(1, pts.length - 1);
        out.push({ id: "t:" + i, label: "", x: pts[i].x, y: pts[i].y, size: 6, color: `rgba(${Math.round(120 + 135 * t)},${Math.round(80 + 100 * t)},255,${(0.35 + 0.65 * t).toFixed(2)})` });
      }
      const a0 = pts[0], a1 = pts[pts.length - 1];
      out.push({ id: "t:start", label: `${trailPts.player} ${new Date(a0.ts * 1000).toTimeString().slice(0, 5)}`, x: a0.x, y: a0.y, size: 9, color: "#7a5cff" });
      out.push({ id: "t:end", label: `${trailPts.player} ${new Date(a1.ts * 1000).toTimeString().slice(0, 5)}`, x: a1.x, y: a1.y, size: 11, color: "#c9b8ff" });
    }
    if (spot && spot.x) out.push({ id: "spot", label: spot.label || "here", x: spot.x, y: spot.y, size: 12, color: "#ff5ab4" });
    for (const a of admins) if (a.id !== meId && a.x && a.y) out.push({ id: "adm:" + a.id, label: `${a.name} is looking here`, x: a.x, y: a.y, size: 9, color: "#00d2ff" });
    if (layers.vehicles) (st?.vehicles || []).forEach((v) => out.push({ id: "v:" + v.id, label: "", x: v.x, y: v.y, size: 8, color: "#cfd3da",
      onClick: () => toast(true, `${v.owner}'s ${String(v.model).replace(/^Base\./, "")} at ${v.x}, ${v.y}`) }));
    if (mode === "zombita" || mode === "panther" || mode === "tiger") out.push(...zLayer.dots);
    return out;
  }, [st, layers, selP, toast, markDraft, trailPts, spot, admins, meId, mode, zLayer, tab, spotKind, spotDraft, placeSel, placeDraft]);
  const rects = useMemo(() => {
    const out = [];
    if (layers.zombies && st?.zombies) {
      const b = st.zombies.bin || 25;
      for (const [cx, cy, n] of st.zombies.cells || []) out.push({ id: `z:${cx},${cy}`, x: cx * b, y: cy * b, w: b, h: b,
        fill: `rgba(224,85,85,${Math.min(0.65, 0.12 + n / 30).toFixed(2)})`, label: n >= 15 ? String(n) : "" });
    }
    if (layers.safehouses) for (const s of safehouses) {
      const k = shKey(s), on = k === selS;
      out.push({ id: "s:" + k, x: s.x, y: s.y, w: s.w, h: s.h, color: on ? C.gold : s.faction ? C.purple : C.blue,
        fill: on ? "rgba(200,168,75,.12)" : "rgba(74,143,196,.08)", label: on || s.faction ? (s.faction ? s.title : s.owner) : s.owner,
        onClick: () => {
          if (s.faction) {
            const f = facs.factions.find((x) => "Faction: " + x.name === s.title);
            if (f) { setSelF(f.fid); setTab("factions"); return; }
          }
          setSelS(k); setDraft(null); setTab("safehouses");
        } });
    }
    if (draft) out.push({ id: "draft", x: draft.x, y: draft.y, w: draft.w, h: draft.h, color: "#fff", dashed: true, fill: "rgba(255,255,255,.08)",
      label: `${draft.w} x ${draft.h}` });
    if (spot && spot.r && spot.x) out.push({ id: "spotr", x: spot.x - spot.r, y: spot.y - spot.r, w: spot.r * 2 + 1, h: spot.r * 2 + 1, color: "#ff5ab4",
      dashed: true, fill: "rgba(255,90,180,.08)", label: `${spot.r * 2 + 1} x ${spot.r * 2 + 1}` });
    if (claimDraft) {
      const r = facs.radii?.[claimDraft.tier] ?? 10;
      out.push({ id: "claimdraft", x: claimDraft.cx - r, y: claimDraft.cy - r, w: 2 * r + 1, h: 2 * r + 1, color: C.purple, dashed: true,
        fill: "rgba(151,117,204,.12)", label: `new claim ${2 * r + 1} x ${2 * r + 1}` });
    }
    if (layers.places || (mode === "live" && tab === "places")) for (const P of PLACE_KINDS) {   // the car lot and the pen: their squares
      const p = st?.places?.[P.id];
      if (!P.rect || !p || !p.w) continue;
      out.push({ id: "plr:" + P.id, x: p.x1, y: p.y1, w: p.w, h: p.h, color: P.color, fill: "rgba(207,211,218,.08)", label: `${P.label}${p.set ? "" : ` (beside ${P.keeper})`} ${p.w} x ${p.h}`,
        onClick: () => { setTab("places"); if (placeSel !== P.id) { setPlaceSel(P.id); setPlaceDraft(null); } } });
    }
    const PD = placeSel && placeDraft ? PLACE_KINDS.find((k) => k.id === placeSel) : null;
    if (PD?.rect) {                                       // the square the lot / pen would cover (same size, new centre)
      const n = st?.places?.[PD.id]?.w || PD.size, sq = placeSquare(placeDraft.x, placeDraft.y, n);
      out.push({ id: "plr:draft", ...sq, color: "#fff", dashed: true, fill: "rgba(255,255,255,.08)", label: `${PD.label} (new) ${n} x ${n}` });
    }
    if (mode === "zombita" || mode === "panther" || mode === "tiger") out.push(...zLayer.rects);
    return out;
  }, [st, layers, safehouses, selS, draft, claimDraft, facs, spot, mode, zLayer, tab, placeSel, placeDraft]);

  // map clicks: pick a teleport spot, or two corners of a safehouse box
  const onMapClick = useCallback((w) => {
    if (!pick) {
      if (w.car) setCarT({ sid: w.car.id, label: `${String(w.car.owner || "").trim() ? w.car.owner + "'s car" : "Car"} at ${w.car.x}, ${w.car.y}` });
      return;
    }
    if (pick.mode === "z") {                 // a Zombita mode tool asked for a spot (it may ask for the next one)
      const cb = pick.cb;
      setPick(null);
      cb(w);
      return;
    }
    if (pick.mode === "teleport") {
      if (selP && confirm(`Teleport ${selP} to ${w.x}, ${w.y}?`)) act("teleport", { player: selP, tx: w.x, ty: w.y, tz: 0 });
      setPick(null);
    } else if (pick.mode === "spot") {
      setSpot((sp) => ({ ...(sp || {}), x: w.x, y: w.y, for: pick.for, r: pick.r ?? sp?.r, label: pick.label }));
      setPick(null);
    } else if (pick.mode === "move") {
      if (moveK && confirm(`Move ${moveK.name} to ${w.x}, ${w.y}?`))
        act(moveK.kind === "bus" ? "move_bus" : "move_shop", { kid: moveK.id, x: w.x, y: w.y }, () => setMoveK(null));
      setPick(null);
    } else if (pick.mode === "marker") {
      setMarkDraft({ x: w.x, y: w.y });
      setPick(null);
    } else if (pick.mode === "jobspot") {
      setSpotDraft({ x: w.x, y: w.y });
      setPick(null);
    } else if (pick.mode === "place") {
      setPlaceDraft({ x: w.x, y: w.y });
      setPick(null);
    } else if (pick.mode === "claim") {
      setClaimDraft((d) => ({ tier: d?.tier || 1, cx: w.x, cy: w.y }));
      setPick(null);
    } else if (pick.mode === "corners") {
      if (!pick.first) { setPick({ ...pick, first: w }); setDraft({ x: w.x, y: w.y, w: 1, h: 1 }); return; }
      const x = Math.min(pick.first.x, w.x), y = Math.min(pick.first.y, w.y);
      setDraft({ x, y, w: Math.abs(w.x - pick.first.x) + 1, h: Math.abs(w.y - pick.first.y) + 1 });
      setPick(null);
    }
  }, [pick, selP, act, moveK]);

  // presence (Nin: "see which admin is here and doing what"): a beat every 5 s with what this admin is looking at
  const doing = useMemo(() => {
    if (mode === "zombita") return `Zombita Control: ${ztab}`;
    if (mode === "panther") return "Panther (loot rules)";
    if (mode === "tiger") return "Reclamation (Tiger)";
    if (tab === "players" && selP) return `Looking at ${selP}`;
    if (tab === "safehouses" && selS) return `Safehouse ${selS.split(",").slice(2).join(",")}'s`;
    if (tab === "factions" && selF) return `Faction ${(facs.factions.find((f) => f.fid === selF) || {}).name || ""}`;
    if (moveK) return `Moving ${moveK.name}`;
    if (placeSel && tab === "places") return `Moving: ${(PLACE_KINDS.find((k) => k.id === placeSel) || PLACE_KINDS[0]).label}`;
    return { players: "Players", safehouses: "Safehouses", factions: "Factions", cars: "Cars", world: "World tools", places: "Places",
      markers: "Markers", spots: "Job spots", gifts: "Gifts", chat: "Chat", log: "Log" }[tab] || "Live Ops";
  }, [tab, selP, selS, selF, facs, moveK, mode, ztab, placeSel]);
  const doingRef = useRef(doing);
  doingRef.current = doing;
  useEffect(() => {
    let stop = false, timer = null;
    const beat = async () => {
      const q = new URLSearchParams(window.location.search);
      try {
        const d = await api("/api/admin/ops/presence", { doing: doingRef.current, x: Number(q.get("x")) || null, y: Number(q.get("y")) || null });
        setAdmins(d.admins || []); setMeId(d.me || "");
      } catch {}
      fetch(`${API}/api/admin/presence/heartbeat`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab: "liveops" }) }).catch(() => {});
      if (!stop) timer = setTimeout(beat, 5000);
    };
    beat();
    return () => { stop = true; clearTimeout(timer); };
  }, []);

  // fill the space under the site menu
  const [top, setTop] = useState(0);
  useEffect(() => {
    const m = () => {
      const nav = document.querySelector("body > nav, body > header, nav");
      const floating = nav && getComputedStyle(nav).position === "fixed";     // the menu called up over the page
      setTop(document.fullscreenElement || !nav || floating ? 0 : Math.round(nav.getBoundingClientRect().bottom));
    };
    m(); window.addEventListener("resize", m); document.addEventListener("fullscreenchange", m); const t = setTimeout(m, 300);
    return () => { window.removeEventListener("resize", m); clearTimeout(t); };
  }, []);

  const clock = st?.game ? `${String(st.game.hour).padStart(2, "0")}:${String(st.game.minute).padStart(2, "0")}` : "";
  return (
    <div data-fs-root style={{ position: "fixed", top, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", background: C.bg, color: C.text }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 14px 8px", borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
        <a href="/" title="Back to the website" style={{ ...mono, fontSize: 11, color: C.grey, textDecoration: "none" }}>← site</a>
        <a href="/admin?tab=overview" title="Back to the admin panel" style={{ ...mono, fontSize: 11, color: C.gold, textDecoration: "none", border: `1px solid ${C.line}`, borderRadius: 3, padding: "3px 8px" }}>← admin panel</a>
        <span style={{ font: "400 22px 'Bebas Neue',sans-serif", letterSpacing: 2 }}>LIVE OPS</span>
        <a href="/workspace" style={{ ...mono, fontSize: 11, color: C.grey, textDecoration: "none" }}>workspace</a>
        {LAYERS.map((l) => (
          <button key={l.id} onClick={() => setLayers((x) => ({ ...x, [l.id]: !x[l.id] }))}
            style={{ ...mono, fontSize: 11, padding: "4px 9px", borderRadius: 3, cursor: "pointer", background: layers[l.id] ? "#1a1e24" : "transparent",
              color: layers[l.id] ? C.text : "#666", border: `1px solid ${layers[l.id] ? l.color : C.line}` }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: l.color, marginRight: 6, opacity: layers[l.id] ? 1 : 0.3 }} />{l.label}
          </button>
        ))}
        <span style={{ display: "flex", gap: 8, marginLeft: "auto", alignItems: "center" }}>
          <ServerControls />
          {admins.map((a) => (
            <span key={a.id} title={`${a.name}${a.id === meId ? " (you)" : ""}: ${a.doing}`} style={{ position: "relative", width: 24, height: 24 }}>
              <img src={a.avatar} alt="" width={24} height={24} style={{ borderRadius: 12, border: `2px solid ${a.id === meId ? C.gold : "#00d2ff"}` }} />
            </span>
          ))}
          {admins.length > 1 && <span style={{ ...mono, fontSize: 10, color: "#00d2ff" }}>
            {admins.filter((a) => a.id !== meId).map((a) => `${a.name}: ${a.doing}`).join(" · ")}</span>}
        </span>
        <span style={{ ...mono, fontSize: 11, color: C.grey }}>
          {st ? `${players.length} online${clock ? ` · in game ${clock}` : ""} · ${st.zombies?.total ?? 0} zombies loaded · ${(st.bandits || []).length} bandits` : ""}
          {st?.world_stale ? " · world data paused (nobody online or mod older than 1.7.111)" : ""}
        </span>
      </div>
      {snaps.map((s) => (
        <div key={s.id} style={{ ...mono, fontSize: 12, padding: "6px 14px", background: "#2a1414", color: "#f3b0b0", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", borderBottom: `1px solid ${C.line}` }}>
          <span style={{ flex: 1, minWidth: 240 }}>
            <b style={{ color: C.red }}>{s.name}'s car is snapping around</b> ({s.n === 1 ? "1 jump" : `${s.n} jumps`}, up to {s.d} squares, last at {new Date(s.last).toTimeString().slice(0, 5)}).
            {" "}The game lost track of the car and the server keeps pulling it back. Tell them: get out of the car, exit to the main menu and join again.
          </span>
          <Btn small onClick={() => flyTo(s.x, s.y, 1)}>Show</Btn>
          <Btn small color={C.grey} onClick={() => setSnaps((cur) => cur.filter((x) => x.id !== s.id))}>Dismiss</Btn>
        </div>
      ))}
      {pick && (
        <div style={{ ...mono, fontSize: 12, padding: "6px 14px", background: "#2a2410", color: C.gold, display: "flex", gap: 12, alignItems: "center" }}>
          {pick.mode === "z" ? pick.hint : pick.mode === "teleport" ? `Click the spot on the map to teleport ${selP} to.` : pick.mode === "claim" ? "Click where the claim's flag goes (its center)." : pick.mode === "marker" ? "Click where the marker goes." : pick.mode === "jobspot" ? `Click where the new ${(SPOT_KINDS.find((k) => k.id === spotKind) || SPOT_KINDS[0]).word} goes.` : pick.mode === "place" ? (PLACE_KINDS.find((k) => k.id === placeSel)?.rect ? `${(PLACE_KINDS.find((k) => k.id === placeSel) || PLACE_KINDS[0]).label}: click its new centre on the map (the square keeps its size).` : `${(PLACE_KINDS.find((k) => k.id === placeSel) || PLACE_KINDS[0]).label}: click its new spot on the map.`) : pick.mode === "spot" ? (pick.hint || "Click the spot on the map.") : pick.mode === "move" ? `Click where ${moveK?.name || "it"} should stand now.` : pick.first ? "Now click the opposite corner." : "Click one corner of the safehouse on the map."}
          <Btn small onClick={() => { setPick(null); }}>Cancel</Btn>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", cursor: pick ? "crosshair" : "default" }}>
          {err ? <div style={{ ...mono, padding: 30, color: C.red }}>{err}</div> :
            <WorldMap places={livePlaces} hidden={hiddenKinds} dots={dots} rects={rects} onMapClick={onMapClick}
              onPlaceClick={(p) => {
                if (mode !== "zombita" || (p.kind !== "shop" && p.kind !== "bus")) return;
                setZPicked({ kind: p.kind, id: p.id, name: p.name, x: p.x, y: p.y, t: Date.now() });
                setZtab(p.kind === "bus" ? "travel" : "shops");
              }} />}
        </div>
        <aside style={{ width: mode !== "live" && wide ? 640 : 400, maxWidth: mode !== "live" && wide ? "62vw" : "48vw", minWidth: 0, overflowX: "hidden",
          borderLeft: `1px solid ${C.line}`, display: "flex", flexDirection: "column", background: C.panel }}>
          {/* the mode switch sits on top of the panel it changes (Nin: people don't look at the top left) */}
          <div style={{ display: "flex", borderBottom: `1px solid ${C.line}` }}>
            {[["live", "Live", C.gold, "#1a1e24"], ["zombita", "Zombita Control", "#c9a8f0", "#2a1f33"], ["panther", "Panther", "#e8a35c", "#2e2316"], ["tiger", "Reclamation", "#5cc8b8", "#132a28"]].map(([m, l, fg, bg]) => (
              <button key={m} onClick={() => setMode(m)} style={{ ...mono, flex: 1, fontSize: 12, fontWeight: 700, padding: "10px 6px", border: 0, cursor: "pointer",
                textTransform: "uppercase", letterSpacing: 1, background: mode === m ? bg : "transparent", color: mode === m ? fg : "#777",
                borderBottom: mode === m ? `2px solid ${fg}` : "2px solid transparent" }}>{l}</button>
            ))}
          </div>
          {mode === "tiger" ? <div style={{ flex: 1, overflowY: "auto", padding: 12, minHeight: 0 }}>
            <TigerTab setPick={setPick} setLayer={setZLayer} onWide={setWide} players={players} /></div>
          : mode === "panther" ? <div style={{ flex: 1, overflowY: "auto", padding: 12, minHeight: 0 }}>
            <PantherTab setPick={setPick} setLayer={setZLayer} onWide={setWide} /></div>
          : mode === "zombita" ? <ZombitaControl act={act} setPick={setPick} st={zSt} players={players} setLayer={setZLayer} setWide={setWide}
            tab={ztab} setTab={setZtab} picked={zPicked} /> : <>
          <div style={{ display: "flex", flexWrap: "wrap", borderBottom: `1px solid ${C.line}` }}>
            {[["players", `Players (${players.length})`], ["safehouses", `Safehouses (${safehouses.length})`], ["factions", "Factions"], ["cars", `Cars (${(st?.vehicles || []).length})`], ["world", "World"], ["places", "Places"],
              ["markers", `Markers (${(st?.markers || []).length})`], ["spots", "Job spots"], ["gifts", "Gifts"], ["chat", "Chat"], ["log", "Log"], ["rcon", "RCON"]].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={{ ...mono, flex: "1 0 22%", fontSize: 11, padding: "8px 4px", background: tab === k ? C.bg : "transparent",
                color: tab === k ? C.gold : C.grey, border: 0, borderBottom: tab === k ? `2px solid ${C.gold}` : "2px solid transparent", cursor: "pointer", textTransform: "uppercase" }}>{l}</button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            {carT && <CarInspect key={JSON.stringify(carT)} t={carT} act={act} players={players} onClose={() => setCarT(null)} />}
            {tab === "players" && <PlayersTab players={players} selP={selP} setSelP={setSelP} selPlayer={selPlayer} act={act} setPick={setPick} safehouses={safehouses}
              cars={st?.vehicles || []} trailPts={trailPts} setTrailPts={setTrailPts}
              markFor={(name) => { setMarkFor(name); setTab("markers"); setPick({ mode: "marker" }); }} />}
            {tab === "safehouses" && <SafehousesTab safehouses={safehouses} selected={selected} setSelS={setSelS} shKey={shKey} draft={draft} setDraft={setDraft}
              setPick={setPick} act={act} players={players} />}
            {tab === "factions" && <FactionsTab facs={facs} selF={selF} setSelF={setSelF} act={act} players={players} refresh={refreshFactions}
              claimDraft={claimDraft} setClaimDraft={setClaimDraft} setPick={setPick} safehouses={safehouses} />}
            {tab === "cars" && <CarsTab cars={st?.vehicles || []} act={act} players={players} />}
            {tab === "world" && <WorldTab act={act} spot={spot} setSpot={setSpot} setPick={setPick} players={players} places={livePlaces}
              showTrail={(player, points) => setTrailPts({ player, points })} />}
            {tab === "places" && <PlacesTab kiosks={kiosks} moveK={moveK} setMoveK={setMoveK} setPick={setPick} st={st} act={act}
              placeSel={placeSel} setPlaceSel={(id) => { setPlaceSel(id); setPlaceDraft(null); }} placeDraft={placeDraft} setPlaceDraft={setPlaceDraft} />}
            {tab === "markers" && <MarkersTab markers={st?.markers || []} draft={markDraft} setDraft={setMarkDraft} setPick={setPick} act={act}
              players={players} forWho={markFor} setForWho={setMarkFor} />}
            {tab === "spots" && <JobSpotsTab st={st} kind={spotKind} setKind={(k) => { setSpotKind(k); setSpotDraft(null); }} draft={spotDraft} setDraft={setSpotDraft}
              setPick={setPick} act={act} />}
            {tab === "gifts" && <GiftsTab act={act} players={players} setPick={setPick} />}
            {tab === "chat" && <ChatTab chat={chat} meta={chatMeta} mine={mine} setMine={setMine} act={act} />}
            {tab === "log" && <LogTab log={log} />}
            {tab === "rcon" && <RconTab />}
          </div>
          </>}
        </aside>
      </div>
      <div style={{ position: "fixed", left: 16, bottom: 16, display: "flex", flexDirection: "column", gap: 6, zIndex: 50, maxWidth: 460 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ ...mono, fontSize: 12, padding: "8px 12px", background: "#0e1114", border: `1px solid ${t.ok ? C.green : C.red}`, color: t.ok ? C.text : "#f3b0b0", borderRadius: 3 }}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}

// ── players ──────────────────────────────────────────────────────────────────
function PlayersTab({ players, selP, setSelP, selPlayer, act, setPick, safehouses, cars, trailPts, setTrailPts, markFor }) {
  const [q, setQ] = useState("");
  const list = players.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {selPlayer && <PlayerCard onClose={() => setSelP(null)} p={selPlayer} act={act} setPick={setPick} players={players} safehouses={safehouses} cars={cars}
        trailPts={trailPts} setTrailPts={setTrailPts} markFor={markFor} />}
      <input style={inp} placeholder="Find a player" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 && <div style={{ ...mono, fontSize: 12, color: C.grey }}>Nobody online.</div>}
      {list.map((p) => (
        <button key={p.name} onClick={() => { if (p.name === selP) { setSelP(null); return; } setSelP(p.name); flyTo(p.x, p.y, 1); }}
          style={{ ...mono, fontSize: 12, textAlign: "left", padding: "7px 9px", background: p.name === selP ? "#1d1a10" : C.bg, color: C.text,
            border: `1px solid ${p.name === selP ? C.gold : C.line}`, borderRadius: 3, cursor: "pointer", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ width: 9, height: 9, borderRadius: 5, background: p.dead ? C.red : p.in_vehicle ? C.blue : C.green }} />
          <span style={{ flex: 1 }}>{p.name}</span>
          <span style={{ color: p.health < 40 ? C.red : C.grey }}>{p.health >= 0 ? `${p.health}%` : ""}</span>
        </button>
      ))}
    </div>
  );
}

function PlayerCard({ p, act, setPick, players, safehouses, cars, trailPts, setTrailPts, onClose, markFor }) {
  const [to, setTo] = useState("");
  const [item, setItem] = useState("");
  const [n, setN] = useState(1);
  const [res, setRes] = useState([]);
  const [msg, setMsg] = useState("");
  const [reason, setReason] = useState("");
  const [xyz, setXyz] = useState("");                 // teleport to typed coordinates: "12010, 2142" or "12010,2142,0"
  const tRef = useRef(null);
  const coords = (() => {
    const m = xyz.trim().match(/^(-?\d+)\s*[, ]\s*(-?\d+)(?:\s*[, ]\s*(-?\d+))?$/);
    return m ? { x: Number(m[1]), y: Number(m[2]), z: m[3] ? Number(m[3]) : 0 } : null;
  })();
  useEffect(() => {
    clearTimeout(tRef.current);
    if (item.trim().length < 2 || /^\w+\.\w/.test(item.trim())) { setRes([]); return; }
    tRef.current = setTimeout(async () => {
      try { setRes((await api(`/api/admin/jobs/items?q=${encodeURIComponent(item.trim())}`)).matches || []); } catch { setRes([]); }
    }, 300);
  }, [item]);
  const homes = safehouses.filter((s) => s.owner.toLowerCase() === p.name.toLowerCase() || (s.members || []).some((m) => m.toLowerCase() === p.name.toLowerCase()));
  const row = { display: "flex", gap: 6, alignItems: "center" };
  const h = { ...mono, fontSize: 10, color: C.grey, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 };
  return (
    <div style={{ border: `1px solid ${C.gold}`, borderRadius: 3, padding: 10, display: "flex", flexDirection: "column", gap: 8, background: "#15130c" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <b style={{ fontSize: 16 }}>{p.name}</b>
        <span style={{ ...mono, fontSize: 11, color: C.grey }}>{p.x}, {p.y}{p.z ? `, floor ${p.z}` : ""} · {p.health}% · {p.dead ? "dead" : p.in_vehicle ? "driving" : "on foot"}</span>
        <button onClick={onClose} title="Close" style={{ marginLeft: "auto", background: "transparent", border: `1px solid ${C.red}`, color: C.red, borderRadius: 3, cursor: "pointer", fontSize: 12, padding: "1px 8px", fontFamily: "var(--mono, monospace)" }}>× Close</button>
      </div>
      {homes.length > 0 && <div style={{ ...mono, fontSize: 11, color: C.grey }}>Safehouse: {homes.map((s) => `${s.owner === p.name ? "owns" : "member of"} ${s.owner}'s at ${s.x},${s.y}`).join("; ")}</div>}
      <div style={row}><Btn small onClick={() => flyTo(p.x, p.y, 2)}>Show</Btn><Btn small onClick={() => setPick({ mode: "teleport" })}>Teleport to a spot</Btn>{markFor && <Btn small onClick={() => markFor(p.name)}>Mark a spot for them</Btn>}</div>
      <div style={h}>Teleport to coordinates</div>
      <div style={row}>
        <input style={inp} placeholder="x, y  or  x, y, floor  (12010, 2142)" value={xyz} onChange={(e) => setXyz(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && coords && confirm(`Teleport ${p.name} to ${coords.x}, ${coords.y}, floor ${coords.z}?`)) act("teleport", { player: p.name, tx: coords.x, ty: coords.y, tz: coords.z }); }} />
        <Btn small disabled={!coords} onClick={() => { if (coords && confirm(`Teleport ${p.name} to ${coords.x}, ${coords.y}, floor ${coords.z}?`)) act("teleport", { player: p.name, tx: coords.x, ty: coords.y, tz: coords.z }); }}>Go</Btn>
      </div>
      <div style={h}>Teleport to a player</div>
      <div style={row}>
        <select style={inp} value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Pick a player...</option>
          {players.filter((o) => o.name !== p.name).map((o) => <option key={o.name} value={o.name}>{o.name}</option>)}
        </select>
        <Btn small disabled={!to} onClick={() => act("teleport_to", { player: p.name, to })}>Go</Btn>
      </div>
      <div style={h}>Give an item</div>
      <div style={row}>
        <input style={inp} placeholder="Search, or Base.Bandage" value={item} onChange={(e) => setItem(e.target.value)} />
        <input style={{ ...inp, width: 70 }} type="number" min={1} max={1000} value={n} onChange={(e) => setN(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))} />
        <Btn small disabled={!/^\w+\.[\w-]+$/.test(item.trim())} onClick={() => { if (confirm(`Give ${n} x ${item.trim()} to ${p.name}?`)) act("give", { player: p.name, item: item.trim(), n }); }}>Give</Btn>
      </div>
      {res.length > 0 && (
        <div style={{ maxHeight: 160, overflowY: "auto", border: `1px solid ${C.line}` }}>
          {res.map((it) => (
            <button key={it.id} onClick={() => { setItem(it.id); setRes([]); }} style={{ ...mono, fontSize: 11, display: "block", width: "100%", textAlign: "left", padding: "5px 8px", background: C.bg, color: C.text, border: 0, borderBottom: `1px solid ${C.line}`, cursor: "pointer" }}>
              {it.name} <span style={{ color: C.grey }}>{it.id}</span>
            </button>
          ))}
        </div>
      )}
      <div style={h}>Message (a Zombita pop-up only they see)</div>
      <div style={row}>
        <input style={inp} placeholder="Your car is at Valley Station" value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={300} />
        <Btn small disabled={!msg.trim()} onClick={() => act("tell", { player: p.name, text: msg }, () => setMsg(""))}>Send</Btn>
      </div>
      <CharacterPanel p={p} act={act} />
      <InventoryPanel p={p} act={act} />
      <PlayerExtras p={p} act={act} cars={cars} trailPts={trailPts} setTrailPts={setTrailPts} />
      <div style={h}>Kick / ban</div>
      <div style={row}>
        <input style={inp} placeholder="Reason (needed for a ban)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} />
        <Btn small color={C.red} onClick={() => { if (confirm(`Kick ${p.name}?`)) act("kick", { player: p.name, reason }); }}>Kick</Btn>
        <Btn small color={C.red} disabled={!reason.trim()} onClick={() => { if (confirm(`BAN ${p.name}? Reason: ${reason}`)) act("ban", { player: p.name, reason }); }}>Ban</Btn>
      </div>
    </div>
  );
}

// ── a player's character (1.7.114): the game writes a sheet on request; skills over the game's own /addxp ──────
function CharacterPanel({ p, act }) {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notify, setNotify] = useState(true);
  const [q, setQ] = useState("");
  const [addT, setAddT] = useState("");
  const [tq, setTq] = useState("");
  const [xpPerk, setXpPerk] = useState("");
  const [xpAmt, setXpAmt] = useState(100);
  const h = { ...mono, fontSize: 10, color: C.grey, textTransform: "uppercase", letterSpacing: 1, marginTop: 6 };
  const load = useCallback(async () => {
    setBusy(true);
    try {
      await act("pl_sheet", { player: p.name }, async () => {
        try { setSheet(await api(`/api/admin/ops/sheet/${encodeURIComponent(p.name)}`)); } catch {}
      });
    } finally { setBusy(false); }
  }, [act, p.name]);
  useEffect(() => { setSheet(null); setOpen(false); }, [p.name]);
  const reload = () => setTimeout(load, 1500);
  const groups = useMemo(() => {
    const g = {};
    for (const pk of sheet?.perks || []) {
      if (q && !(pk.name + " " + pk.group).toLowerCase().includes(q.toLowerCase())) continue;
      (g[pk.group || "Other"] = g[pk.group || "Other"] || []).push(pk);
    }
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [sheet, q]);
  if (!open) return <div><div style={h}>Character</div><Btn small onClick={() => { setOpen(true); load(); }}>Open character sheet</Btn></div>;
  // mod traits come as "UI_trait_SuperImmune" when the game has no text for them: show "Super Immune"
  const nice = (s) => String(s || "").replace(/^UI_trait_/i, "").replace(/^[a-z0-9]+:/i, "").replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
  const labelOf = (id) => {
    const l = (sheet?.allTraits || []).find((t) => t.id === id)?.label || id;
    return /^UI_trait_/i.test(l) ? nice(l) : l;
  };
  const st = sheet?.stats || {};
  const bar = (k, label, good = "low") => {
    const v = Math.max(0, Math.min(1, Number(st[k] || 0)));
    const bad = good === "low" ? v : 1 - v;
    return (
      <div key={k} style={{ display: "flex", gap: 6, alignItems: "center", ...mono, fontSize: 11 }}>
        <span style={{ width: 90, color: C.grey }}>{label}</span>
        <span style={{ flex: 1, height: 6, background: "#222", borderRadius: 3 }}>
          <span style={{ display: "block", height: 6, width: `${Math.round(v * 100)}%`, borderRadius: 3, background: bad > 0.6 ? C.red : bad > 0.3 ? C.gold : C.green }} />
        </span>
        <span style={{ width: 34, textAlign: "right" }}>{Math.round(v * 100)}%</span>
      </div>
    );
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ ...h, marginTop: 0, flex: "1 1 120px" }}>Character {sheet ? `(${sheet.age ?? 0}s old)` : ""}</div>
        <label style={{ ...mono, fontSize: 11, color: C.grey, display: "flex", gap: 4, alignItems: "center" }}>
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> tell the player
        </label>
        <Btn small disabled={busy} onClick={load}>{busy ? "..." : "Refresh"}</Btn>
        <Btn small color={C.red} onClick={() => setOpen(false)}>× Close</Btn>
      </div>
      {!sheet ? <div style={{ ...mono, fontSize: 12, color: C.grey }}>{busy ? "Asking the game..." : "No sheet (is the player online?)"}</div> : (<>
        <div style={{ ...mono, fontSize: 12 }}>
          {sheet.profession ? `${sheet.profession} · ` : ""}health {Math.round(sheet.health)}%
          {sheet.infected ? <span style={{ color: C.red }}> · INFECTED</span> : null}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Btn small color={C.green} onClick={() => act("pl_heal", { player: p.name, notify }, reload)}>Heal fully</Btn>
          <Btn small color={C.green} onClick={() => act("pl_needs", { player: p.name, notify }, reload)}>Reset needs</Btn>
          {[["god", "God mode"], ["invisible", "Invisible"], ["noclip", "Noclip"]].map(([k, l]) => (
            <Btn key={k} small color={sheet[k] ? C.gold : C.grey} onClick={() => act(k, { player: p.name, on: !sheet[k] }, reload)}>
              {l}: {sheet[k] ? "on" : "off"}</Btn>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {bar("hunger", "Hunger")}{bar("thirst", "Thirst")}{bar("fatigue", "Tiredness")}{bar("stress", "Stress")}
          {bar("panic", "Panic")}{bar("boredom", "Boredom")}{bar("unhappiness", "Unhappy")}{bar("endurance", "Endurance", "high")}
        </div>
        <div style={h}>Traits</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {(sheet.traits || []).length === 0 && <span style={{ ...mono, fontSize: 12, color: C.grey }}>none</span>}
          {(sheet.traits || []).map((t) => (
            <span key={t} style={{ ...mono, fontSize: 11, border: `1px solid ${C.line}`, padding: "2px 6px", borderRadius: 3 }}>
              {labelOf(t)} <a style={{ color: C.red, cursor: "pointer" }} title="Remove"
                onClick={() => { if (confirm(`Remove ${labelOf(t)} from ${p.name}?`)) act("pl_trait", { player: p.name, trait: t, on: false, notify }, reload); }}>x</a>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <input style={{ ...inp, flex: "1 1 140px" }} placeholder="Search traits" value={tq}
            onChange={(e) => { setTq(e.target.value); setAddT(""); }} />
          <select style={{ ...inp, flex: "2 1 200px" }} value={addT} onChange={(e) => setAddT(e.target.value)}>
            <option value="">{tq ? "Pick a match..." : "Add a trait..."}</option>
            {/* every trait (the card's own list can be wrong before mod 1.8.10); a mark shows the ones listed above */}
            {(sheet.allTraits || [])
              .map((t) => ({ ...t, shown: labelOf(t.id) }))
              .filter((t) => !tq || (t.shown + " " + t.id).toLowerCase().includes(tq.trim().toLowerCase()))
              .sort((a, b) => a.shown.localeCompare(b.shown))
              .map((t) => <option key={t.id} value={t.id}>{t.shown} ({t.cost > 0 ? "+" : ""}{t.cost}){(sheet.traits || []).includes(t.id) ? " [listed]" : ""}</option>)}
          </select>
          <Btn small disabled={!addT} onClick={() => act("pl_trait", { player: p.name, trait: addT, on: true, notify }, () => { setAddT(""); setTq(""); reload(); })}>Add</Btn>
        </div>
        <div style={h}>Skills</div>
        <input style={inp} placeholder="Find a skill" value={q} onChange={(e) => setQ(e.target.value)} />
        <div style={{ maxHeight: 320, overflowY: "auto", border: `1px solid ${C.line}` }}>
          {groups.map(([g, list]) => (
            <div key={g}>
              <div style={{ ...mono, fontSize: 10, color: C.gold, padding: "4px 6px", background: "#0e0f12" }}>{g}</div>
              {list.map((pk) => (
                <div key={pk.id} style={{ ...mono, fontSize: 12, display: "flex", gap: 6, alignItems: "center", padding: "3px 6px", borderBottom: `1px solid #16191e` }}>
                  <span style={{ flex: 1 }}>{pk.name}</span>
                  <button style={{ ...inp, width: 24, padding: 0, cursor: "pointer" }} disabled={pk.level <= 0}
                    onClick={() => act("set_level", { player: p.name, perk: pk.id, level: pk.level - 1, notify }, reload)}>-</button>
                  <select style={{ ...inp, width: 52, padding: "2px 4px" }} value={pk.level}
                    onChange={(e) => act("set_level", { player: p.name, perk: pk.id, level: Number(e.target.value), notify }, reload)}>
                    {Array.from({ length: 11 }, (_, i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                  <button style={{ ...inp, width: 24, padding: 0, cursor: "pointer" }} disabled={pk.level >= 10}
                    onClick={() => act("set_level", { player: p.name, perk: pk.id, level: pk.level + 1, notify }, reload)}>+</button>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <select style={inp} value={xpPerk} onChange={(e) => setXpPerk(e.target.value)}>
            <option value="">Add XP to a skill...</option>
            {(sheet.perks || []).slice().sort((a, b) => a.name.localeCompare(b.name)).map((pk) => <option key={pk.id} value={pk.id}>{pk.name}</option>)}
          </select>
          <input style={{ ...inp, width: 80 }} type="number" value={xpAmt} onChange={(e) => setXpAmt(Number(e.target.value) || 0)} />
          <Btn small disabled={!xpPerk || !xpAmt} onClick={() => act("addxp", { player: p.name, perk: xpPerk, amount: xpAmt, notify }, reload)}>Add XP</Btn>
        </div>
      </>)}
      <Btn small color={C.red} onClick={() => setOpen(false)}>× Close character sheet</Btn>
    </div>
  );
}

// ── 1.7.115: inventory, the player's cars / trail / warnings / events ──────────────────────────────────────────
function InventoryPanel({ p, act }) {
  const [open, setOpen] = useState(false);
  const [inv, setInv] = useState(null);
  const [q, setQ] = useState("");
  const h = { ...mono, fontSize: 10, color: C.grey, textTransform: "uppercase", letterSpacing: 1, marginTop: 6 };
  const load = useCallback(() => act("pl_inv", { player: p.name }, async () => {
    try { setInv(await api(`/api/admin/ops/inv/${encodeURIComponent(p.name)}`)); } catch {}
  }), [act, p.name]);
  useEffect(() => { setInv(null); setOpen(false); }, [p.name]);
  if (!open) return <div><div style={h}>Inventory</div><Btn small onClick={() => { setOpen(true); load(); }}>Open inventory</Btn></div>;
  const items = (inv?.items || []).filter((it) => !q || (it.name + " " + it.type).toLowerCase().includes(q.toLowerCase()));
  const groups = {};
  for (const it of items) (groups[it.where] = groups[it.where] || []).push(it);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ ...h, marginTop: 0, flex: "1 1 120px" }}>Inventory {inv ? `(${inv.items.length} kinds, ${inv.age ?? 0}s old)` : ""}</div>
        <Btn small onClick={load}>Refresh</Btn><Btn small color={C.red} onClick={() => setOpen(false)}>× Close</Btn>
      </div>
      {!inv ? <div style={{ ...mono, fontSize: 12, color: C.grey }}>Asking the game...</div> : (<>
        <input style={inp} placeholder="Find an item" value={q} onChange={(e) => setQ(e.target.value)} />
        <div style={{ maxHeight: 300, overflowY: "auto", border: `1px solid ${C.line}` }}>
          {Object.entries(groups).map(([where, list]) => (
            <div key={where}>
              <div style={{ ...mono, fontSize: 10, color: C.gold, padding: "4px 6px", background: "#0e0f12" }}>{where === "main" ? "Carried" : where}</div>
              {list.map((it) => (
                <div key={where + it.type} style={{ ...mono, fontSize: 12, display: "flex", gap: 6, alignItems: "center", padding: "3px 6px", borderBottom: "1px solid #16191e" }}>
                  <span style={{ flex: 1 }}>{it.name} <span style={{ color: C.grey, fontSize: 10 }}>{it.type}</span></span>
                  <span>x{it.count}</span>
                  <a style={{ color: C.red, cursor: "pointer", fontSize: 11 }} onClick={() => {
                    const n = Number(prompt(`Take how many ${it.name} from ${p.name}? (they have ${it.count})`, String(it.count)));
                    if (n > 0) act("inv_remove", { player: p.name, type: it.type, count: Math.min(n, 1000) }, () => setTimeout(load, 800));
                  }}>take</a>
                </div>
              ))}
            </div>
          ))}
        </div>
      </>)}
    </div>
  );
}

function PlayerExtras({ p, act, cars, trailPts, setTrailPts }) {
  const [hours, setHours] = useState(3);
  const [warns, setWarns] = useState([]);
  const [reason, setReason] = useState("");
  const [scripts, setScripts] = useState([]);
  const [veh, setVeh] = useState("");
  const h = { ...mono, fontSize: 10, color: C.grey, textTransform: "uppercase", letterSpacing: 1, marginTop: 6 };
  const loadWarns = useCallback(async () => { try { setWarns((await api(`/api/admin/ops/warnings?player=${encodeURIComponent(p.name)}`)).warnings || []); } catch {} }, [p.name]);
  useEffect(() => { loadWarns(); }, [loadWarns]);
  const mine = cars.filter((c) => String(c.owner).toLowerCase() === p.name.toLowerCase());
  const showTrail = async () => {
    try { const d = await api(`/api/admin/ops/trail/${encodeURIComponent(p.name)}?hours=${hours}`);
      setTrailPts({ player: p.name, points: d.points || [] });
      if ((d.points || []).length) { const last = d.points[d.points.length - 1]; flyTo(last.x, last.y, 0.5); }
    } catch (e) { alert(e.message); }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
      <div style={h}>Where they've been</div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <select style={{ ...inp, width: 110 }} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
          {[1, 3, 6, 12, 24, 48, 72, 168].map((hh) => <option key={hh} value={hh}>last {hh < 24 ? `${hh} h` : `${hh / 24} d`}</option>)}
        </select>
        <Btn small onClick={showTrail}>Show trail</Btn>
        {trailPts && <Btn small color={C.grey} onClick={() => setTrailPts(null)}>Hide</Btn>}
        {trailPts?.player === p.name && <span style={{ ...mono, fontSize: 11, color: C.grey }}>{trailPts.points.length} points</span>}
      </div>
      <div style={h}>Their cars ({mine.length})</div>
      {mine.map((c) => (
        <div key={c.id} style={{ ...mono, fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
          <a style={{ flex: 1, cursor: "pointer" }} onClick={() => flyTo(c.x, c.y, 1)}>{String(c.model).replace(/^Base\./, "")} <span style={{ color: C.grey }}>{c.x}, {c.y}</span></a>
          <Btn small onClick={() => act("teleport", { player: p.name, tx: c.x, ty: c.y, tz: 0 })}>Go to it</Btn>
          <Btn small onClick={() => inspectCar({ vid: c.id, label: `${p.name}'s ${String(c.model).replace(/^Base\./, "")}` })}>Inspect</Btn>
          <Btn small onClick={() => act("veh_repair", { vid: c.id })}>Repair</Btn>
          <Btn small onClick={() => act("veh_flip", { vid: c.id })}>Flip</Btn>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Btn small onClick={() => inspectCar({ player: p.name, label: `The car next to ${p.name}` })}>Inspect the car next to them</Btn>
        <Btn small onClick={() => act("veh_flip", { player: p.name })}>Flip the car next to them</Btn>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input style={inp} list="ops-veh" placeholder="Spawn a car next to them: Base.CarNormal" value={veh}
          onFocus={async () => { if (!scripts.length) try { setScripts((await api("/api/admin/ops/vehicle-scripts")).scripts || []); } catch {} }}
          onChange={(e) => setVeh(e.target.value)} />
        <datalist id="ops-veh">{scripts.map((v) => <option key={v} value={v} />)}</datalist>
        <Btn small disabled={!/^\w+\.[\w-]+$/.test(veh.trim())} onClick={async () => { const s = veh.trim(); if (await confirmSpawn(p.name, s)) act("veh_spawn", { player: p.name, script: s }, () => setVeh("")); }}>Spawn</Btn>
      </div>
      <div style={h}>Warnings ({warns.length})</div>
      {warns.slice(-5).map((w, i) => (
        <div key={i} style={{ ...mono, fontSize: 11, color: C.grey }}>{new Date(w.at * 1000).toLocaleDateString()} · {w.reason} <span style={{ color: "#666" }}>({String(w.by).replace(" (website)", "")})</span></div>
      ))}
      <div style={{ display: "flex", gap: 6 }}>
        <input style={inp} placeholder="Reason (they get a pop-up)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
        <Btn small color={C.red} disabled={!reason.trim()} onClick={() => act("warn", { player: p.name, reason }, () => { setReason(""); loadWarns(); })}>Warn</Btn>
      </div>
      <div style={h}>Events on them</div>
      <div style={{ display: "flex", gap: 6 }}>
        <Btn small onClick={() => act("thunder", { player: p.name })}>Thunder</Btn>
        <Btn small onClick={() => act("lightning", { player: p.name })}>Lightning</Btn>
      </div>
      <ZedItemsBox key={p.name} p={p} act={act} Btn={Btn} />
    </div>
  );
}

// ── inspect a car (mod 1.7.133 ZO_Cars + the bot's GET /api/admin/ops/car) ─────────────────────────────
// Kybo, 2026-10-05: "why i cant use the vehicle eventho i already hotwire". The game reads the car (it has to be loaded:
// someone near it), says why it won't go, and every fix rewrites the report, so this card re-reads it after each one.
function inspectCar(t) { window.dispatchEvent(new CustomEvent("ops-inspect-car", { detail: t })); }

function carQuery(t) {
  if (t.player) return `player=${encodeURIComponent(t.player)}`;
  if (t.vid != null) return `vid=${encodeURIComponent(t.vid)}`;
  return `sid=${encodeURIComponent(t.sid)}`;
}

function CarInspect({ t, act, players, onClose }) {
  const [rep, setRep] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [keyTo, setKeyTo] = useState(t.player || "");
  const [bringTo, setBringTo] = useState("");
  const target = useMemo(() => (t.player ? { player: t.player } : t.vid != null ? { vid: t.vid } : { sid: t.sid }), [t]);
  const read = useCallback(async () => {
    try { setRep(await api(`/api/admin/ops/car?${carQuery(t)}`)); setNote(""); }
    catch (e) { setNote(e.status === 404 ? "No report yet." : e.message); }
  }, [t]);
  const inspect = useCallback(async () => {
    setBusy(true);
    try { await act("car_inspect", target, read); } finally { setBusy(false); }
  }, [act, target, read]);
  useEffect(() => { inspect(); }, [inspect]);
  const fix = (cmd, extra = {}, ask = "") => { if (ask && !confirm(ask)) return; act(cmd, { ...target, ...extra }, read); };
  // mod 1.8.20 BRING CAR: the car the player DRIVES goes beside another player, or to x, y (floor). Their game does the
  // move, so the report is read again a few seconds after the game says it asked.
  const bring = () => {
    const v = bringTo.trim();
    const m = v.match(/^(\d+)\s*[, ]\s*(\d+)(?:\s*[, ]\s*(\d+))?$/);
    const dest = m ? { x: Number(m[1]), y: Number(m[2]), ...(m[3] != null ? { z: Number(m[3]) } : {}) } : { to: v };
    const where = m ? `${m[1]}, ${m[2]}${m[3] != null ? ` (floor ${m[3]})` : ""}` : `beside ${v} (3 tiles east of them)`;
    if (!confirm(`Bring ${t.player}'s car to ${where}?\n\n${t.player} has to sit in the DRIVER's seat of this car, and the spot has to be within 60 tiles of where the car is now. Their game moves it, so it takes a few seconds.`)) return;
    act("car_bring", { player: t.player, ...dest }, () => { setTimeout(read, 6000); });
  };
  const h = { ...mono, fontSize: 10, color: C.grey, textTransform: "uppercase", letterSpacing: 1, marginTop: 6 };
  const bar = (label, v, right = null) => {
    const n = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center", ...mono, fontSize: 11 }}>
        <span style={{ width: 92, color: C.grey }}>{label}</span>
        <span style={{ flex: 1, height: 6, background: "#222", borderRadius: 3 }}>
          <span style={{ display: "block", height: 6, width: `${n}%`, borderRadius: 3, background: n < 25 ? C.red : n < 60 ? C.gold : C.green }} />
        </span>
        <span style={{ width: 34, textAlign: "right" }}>{n}%</span>
        {right}
      </div>
    );
  };
  const r = rep;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "9px 10px", marginBottom: 12, background: C.bg, border: `1px solid ${C.blue}`, borderRadius: 3 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <div style={{ ...mono, fontSize: 12, color: C.blue, flex: 1 }}>INSPECT · {t.label || "car"}</div>
        <Btn small disabled={busy} onClick={inspect}>{busy ? "..." : "Refresh"}</Btn>
        <Btn small color={C.red} onClick={onClose}>× Close</Btn>
      </div>
      {!r ? <div style={{ ...mono, fontSize: 12, color: C.grey }}>{busy ? "Asking the game..." : note || "No report."} The car has to be loaded (someone near it).</div> : (<>
        <div style={{ ...mono, fontSize: 12 }}>
          <a style={{ cursor: "pointer" }} onClick={() => flyTo(r.x, r.y, 1)}>{String(r.script || "").replace(/^Base\./, "")}</a>
          <span style={{ color: C.grey }}> · {r.x}, {r.y}{r.owner ? ` · claimed by ${r.owner}` : " · not claimed"}{r.driver ? ` · ${r.driver} driving` : ""}{r.age != null ? ` · ${r.age}s old` : ""}</span>
        </div>
        {(r.problems || []).length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ ...h, color: C.red, marginTop: 0 }}>Why it won't go</div>
            {r.problems.map((x, i) => <div key={i} style={{ ...mono, fontSize: 12, color: "#f3b0b0" }}>• {x}</div>)}
          </div>
        ) : <div style={{ ...mono, fontSize: 12, color: C.green }}>Nothing wrong found: it should start and drive.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {bar("Engine", r.engine?.cond)}
          {bar("Fuel", r.fuel?.pct, <><Btn small onClick={() => fix("car_fuel", { pct: 50 })}>50%</Btn><Btn small onClick={() => fix("car_fuel", { pct: 100 })}>Fill</Btn></>)}
          {r.battery?.present ? bar("Battery", r.battery.pct, <Btn small onClick={() => fix("car_battery", { pct: 100 })}>Charge</Btn>)
            : <div style={{ ...mono, fontSize: 11, color: C.red }}>No battery <Btn small onClick={() => fix("car_install", { part: "Battery" })}>Install one</Btn></div>}
        </div>
        <div style={{ ...mono, fontSize: 11, color: C.grey }}>
          engine quality {r.engine?.quality ?? "?"} · power {r.engine?.power ?? "?"} · {r.engine?.running ? "running" : "off"} ·
          {r.keyIn ? " key in the ignition" : r.hotwired ? " hotwired" : " no key, not hotwired"}{r.hotwireBroken ? " (hotwire broken)" : ""} ·
          {r.locked ? ` ${r.locked} locked door(s)` : " no locked doors"}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Btn small color={C.green} onClick={() => fix("car_repair", {}, "Repair everything on this car (all parts to new)?")}>Repair all</Btn>
          <Btn small onClick={() => fix("car_hotwire")}>Hotwire</Btn>
          <Btn small disabled={!r.locked} onClick={() => fix("car_unlock")}>Unlock doors</Btn>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input style={inp} list="ops-car-key" placeholder="Give a key to (online player)" value={keyTo} onChange={(e) => setKeyTo(e.target.value)} />
          <datalist id="ops-car-key">{players.map((pp) => <option key={pp.name} value={pp.name} />)}</datalist>
          <Btn small disabled={!keyTo.trim()} onClick={() => fix("car_key", { to: keyTo.trim() })}>Give key</Btn>
        </div>
        {t.player ? (
          <div style={{ display: "flex", gap: 6 }}>
            <input style={inp} list="ops-car-key" placeholder="Bring car to (online player, or x, y)" value={bringTo} onChange={(e) => setBringTo(e.target.value)} />
            <Btn small disabled={!bringTo.trim()} onClick={bring}>Bring car</Btn>
          </div>
        ) : null}
        <div style={h}>Parts ({(r.parts || []).length})</div>
        {(r.parts || []).slice().sort((a, b) => (b.missing - a.missing) || (a.cond - b.cond)).map((pt) => (
          <div key={pt.id} style={{ display: "flex", gap: 6, alignItems: "center", ...mono, fontSize: 11 }}>
            <span style={{ width: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: pt.missing ? C.red : C.text }} title={pt.id}>
              {pt.name}{pt.locked ? " 🔒" : ""}</span>
            {pt.missing ? <>
              <span style={{ flex: 1, color: C.red }}>missing</span>
              <Btn small onClick={() => fix("car_install", { part: pt.id })}>Install</Btn>
            </> : <>
              <span style={{ flex: 1, height: 6, background: "#222", borderRadius: 3 }}>
                <span style={{ display: "block", height: 6, width: `${Math.max(0, Math.min(100, pt.cond))}%`, borderRadius: 3, background: pt.cond < 25 ? C.red : pt.cond < 60 ? C.gold : C.green }} />
              </span>
              <span style={{ width: 34, textAlign: "right" }}>{pt.cond}%</span>
              <Btn small disabled={pt.cond >= 100} onClick={() => fix("car_part", { part: pt.id, cond: 100 })}>Fix</Btn>
            </>}
          </div>
        ))}
      </>)}
    </div>
  );
}

// ── cars: every claimed car ─────────────────────────────────────────────────
function CarsTab({ cars, act, players }) {
  const [q, setQ] = useState("");
  const [to, setTo] = useState({});
  const list = cars.filter((c) => (c.owner + " " + c.model).toLowerCase().includes(q.toLowerCase())).sort((a, b) => String(a.owner).localeCompare(String(b.owner)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ ...mono, fontSize: 11, color: C.grey }}>Every claimed car (Zombita Vehicles) at its last known spot. Repair and flip need someone near the car.</div>
      <input style={inp} placeholder="Find by owner or model" value={q} onChange={(e) => setQ(e.target.value)} />
      <datalist id="ops-online-car">{players.map((pp) => <option key={pp.name} value={pp.name} />)}</datalist>
      {list.length === 0 && <div style={{ ...mono, fontSize: 12, color: C.grey }}>No claimed cars.</div>}
      {list.map((c) => (
        <div key={c.id} style={{ ...mono, fontSize: 12, padding: "7px 9px", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 3, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <a style={{ flex: 1, cursor: "pointer" }} onClick={() => flyTo(c.x, c.y, 1)}>{String(c.model).replace(/^Base\./, "")}</a>
            <span style={{ color: C.grey }}>{c.owner}</span>
          </div>
          <div style={{ color: C.grey, fontSize: 11 }}>{c.x}, {c.y}{c.at ? ` · seen ${new Date(c.at * 1000).toLocaleString()}` : ""}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Btn small onClick={() => inspectCar({ vid: c.id, label: `${c.owner}'s ${String(c.model).replace(/^Base\./, "")}` })}>Inspect</Btn>
            <Btn small onClick={() => act("veh_repair", { vid: c.id })}>Repair</Btn>
            <Btn small onClick={() => act("veh_flip", { vid: c.id })}>Flip</Btn>
            <Btn small color={C.red} onClick={() => { if (confirm(`Unclaim ${c.owner}'s ${c.model}?`)) act("veh_unclaim", { vid: c.id }); }}>Unclaim</Btn>
            <input style={{ ...inp, width: 110 }} list="ops-online-car" placeholder="new owner" value={to[c.id] || ""} onChange={(e) => setTo({ ...to, [c.id]: e.target.value })} />
            <Btn small disabled={!(to[c.id] || "").trim()} onClick={() => { if (confirm(`Give ${c.owner}'s ${c.model} to ${to[c.id]}?`)) act("veh_transfer", { vid: c.id, player: to[c.id].trim() }); }}>Give</Btn>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── world: zombies, weather, events, who was here ──────────────────────────
function WorldTab({ act, spot, setSpot, setPick, players, showTrail, places = [] }) {
  const [r, setR] = useState(30);
  const [count, setCount] = useState(20);
  const [stormH, setStormH] = useState(2);
  const [nearR, setNearR] = useState(40);
  const [nearH, setNearH] = useState(24);
  const [who, setWho] = useState(null);
  const h = { ...mono, fontSize: 10, color: C.grey, textTransform: "uppercase", letterSpacing: 1, marginTop: 8 };
  const box = { border: `1px solid ${C.line}`, borderRadius: 3, padding: 10, display: "flex", flexDirection: "column", gap: 6, background: C.bg };
  const row = { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" };
  const num = (v, set, min, max, w = 70) => <input style={{ ...inp, width: w }} type="number" min={min} max={max} value={v} onChange={(e) => set(Math.max(min, Math.min(max, Number(e.target.value) || min)))} />;
  // a new pick starts empty: keeping the last x/y let one tool fire at another tool's spot (Tim's bag went to the horde's start)
  const pickSpot = (forWhat, radius, hint) => { setSpot({ for: forWhat, r: radius }); setPick({ mode: "spot", for: forWhat, r: radius, hint, label: forWhat }); };
  const picked = (forWhat) => spot?.for === forWhat && spot.x != null;
  const findWho = async () => {
    try { setWho((await api(`/api/admin/ops/near?x=${spot.x}&y=${spot.y}&radius=${nearR}&hours=${nearH}`)).players || []); } catch (e) { alert(e.message); }
  };
  const t = (ts) => new Date(ts * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={box}>
        <b>Zombies</b>
        <div style={{ ...mono, fontSize: 11, color: C.grey }}>Only works where a player is nearby (the game only has zombies loaded there).</div>
        <div style={row}>
          <Btn small onClick={() => pickSpot("zombies", r, "Click the middle of the area.")}>{picked("zombies") ? `Spot: ${spot.x}, ${spot.y}` : "Pick the spot"}</Btn>
          <span style={{ ...mono, fontSize: 11 }}>radius</span>{num(r, (v) => { setR(v); setSpot((s) => s ? { ...s, r: v } : s); }, 1, 200)}
        </div>
        <div style={row}>
          <Btn small color={C.green} disabled={!picked("zombies")}onClick={() => { if (confirm(`Remove every zombie within ${r} squares of ${spot.x}, ${spot.y}?`)) act("zombies_clear", { x: spot.x, y: spot.y, radius: r }); }}>Clear zombies here</Btn>
          {num(count, setCount, 1, 500, 64)}
          <Btn small color={C.red} disabled={!picked("zombies")}onClick={() => { if (confirm(`Spawn ${count} zombies around ${spot.x}, ${spot.y}?`)) act("horde", { x: spot.x, y: spot.y, radius: Math.min(r, 50), count }); }}>Spawn horde</Btn>
        </div>
      </div>
      <EventsBox act={act} spot={spot} pickSpot={pickSpot} players={players} places={places} box={box} row={row} num={num} />
      <CorpseClearBox spot={spot} pickSpot={pickSpot} players={players} box={box} row={row} Btn={Btn} />
      <div style={box}>
        <b>Weather and events</b>
        <div style={row}>
          <Btn small onClick={() => act("rain_start", {})}>Start rain</Btn>
          <Btn small onClick={() => act("rain_stop", {})}>Stop rain</Btn>
          <Btn small onClick={() => act("weather_stop", {})}>Clear weather</Btn>
        </div>
        <div style={row}>
          <Btn small onClick={() => act("storm_start", { hours: stormH })}>Thunderstorm</Btn>{num(stormH, setStormH, 1, 48, 56)}<span style={{ ...mono, fontSize: 11 }}>hours</span>
        </div>
        <div style={row}>
          <Btn small onClick={() => { if (confirm("Send the helicopter? It draws zombies to whoever it follows.")) act("chopper", {}); }}>Helicopter</Btn>
          <Btn small onClick={() => act("gunshot", {})}>Distant gunshot</Btn>
        </div>
        <div style={{ ...mono, fontSize: 11, color: C.grey }}>Thunder or lightning on one player: their card in Players.</div>
      </div>
      <div style={box}>
        <b>Who was here?</b>
        <div style={{ ...mono, fontSize: 11, color: C.grey }}>Everyone who stood near a spot (positions are kept 14 days, one a minute).</div>
        <div style={row}>
          <Btn small onClick={() => pickSpot("near", nearR, "Click the spot (a base, a car...).")}>{picked("near") ? `Spot: ${spot.x}, ${spot.y}` : "Pick the spot"}</Btn>
          <span style={{ ...mono, fontSize: 11 }}>radius</span>{num(nearR, (v) => { setNearR(v); setSpot((s) => s ? { ...s, r: v } : s); }, 1, 500, 64)}
          <select style={{ ...inp, width: 100 }} value={nearH} onChange={(e) => setNearH(Number(e.target.value))}>
            {[1, 6, 12, 24, 48, 72, 168, 336].map((hh) => <option key={hh} value={hh}>last {hh < 24 ? `${hh} h` : `${hh / 24} d`}</option>)}
          </select>
          <Btn small disabled={!picked("near")} onClick={findWho}>Search</Btn>
        </div>
        {who && (who.length === 0 ? <div style={{ ...mono, fontSize: 12, color: C.grey }}>Nobody.</div> : who.map((w) => (
          <div key={w.player} style={{ ...mono, fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ flex: 1 }}><b>{w.player}</b> <span style={{ color: C.grey, fontSize: 11 }}>{t(w.first)} to {t(w.last)} · {w.minutes} min</span></span>
            <a style={{ color: C.gold, cursor: "pointer", fontSize: 11 }} onClick={async () => {
              try { const d = await api(`/api/admin/ops/trail/${encodeURIComponent(w.player)}?hours=${nearH}`); showTrail(w.player, d.points || []); } catch {}
            }}>trail</a>
          </div>
        )))}
      </div>
      {spot && <Btn small color={C.grey} onClick={() => setSpot(null)}>Clear the picked spot</Btn>}
    </div>
  );
}

// ── events: a horde sent at someone, a loot bag on the floor ──────────────
// Zombita's word when admins send bandits: worried for the players, never the one behind it ({where} = nearest town)
const BANDIT_WARNINGS = [
  "Bandits were seen near {where}. Please stay together and watch each other's backs.",
  "I don't like this... armed people are moving near {where}. Be careful out there, okay?",
  "Someone spotted a group of bandits around {where}. Stay safe, all of you.",
  "Please be careful near {where}. There are bandits about, and they aren't friendly.",
];

function nearestPlayer(players, p) {
  let best = null;
  for (const pp of players || []) {
    if (pp.x == null || pp.y == null) continue;
    const d = Math.round(Math.hypot(pp.x - p.x, pp.y - p.y));
    if (!best || d < best.d) best = { name: pp.name, d };
  }
  return best;
}

function EventsBox({ act, spot, pickSpot, players, places = [], box, row, num }) {
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [bagAt, setBagAt] = useState(null);
  const [target, setTarget] = useState("");
  const [count, setCount] = useState(40);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [n, setN] = useState(1);
  const [name, setName] = useState("Supply drop");
  const [mark, setMark] = useState(true);
  // bandit events (1.7.116): a group from one of the Bandits mod's clans, at a spot or near a player
  const [clans, setClans] = useState([]);
  const [bandit, setBandit] = useState({ cid: "", size: 6, program: "Bandit", player: "", at: null, mark: true });
  // Zombita warns everyone (she's on the players' side, never behind it); the text can be edited before it goes out
  const [warn, setWarn] = useState({ on: true, text: "", v: Math.floor(Math.random() * BANDIT_WARNINGS.length) });
  const banditWhere = useMemo(() => {
    const p = bandit.player ? players.find((pp) => pp.name === bandit.player) : bandit.at;
    if (!p) return "";
    let best = null;
    for (const pl of places) if (pl.kind === "town") {
      const d = Math.hypot(pl.x - p.x, pl.y - p.y);
      if (!best || d < best.d) best = { name: pl.name, d };
    }
    return best && best.d < 1500 ? best.name : "the wilds";
  }, [bandit.player, bandit.at, players, places]);
  const warnText = warn.text || (banditWhere ? `Zombita: ${BANDIT_WARNINGS[warn.v].replace("{where}", banditWhere)}` : "");
  useEffect(() => { api("/api/admin/ops/board").then((d) => setClans(d.clans || [])).catch(() => {}); }, []);
  const tRef = useRef(null);
  useEffect(() => {
    if (!spot?.x) return;
    if (spot.for === "hordefrom") setFrom({ x: spot.x, y: spot.y });
    if (spot.for === "hordeto") setTo({ x: spot.x, y: spot.y });
    if (spot.for === "bag") setBagAt({ x: spot.x, y: spot.y });
    if (spot.for === "bandits") setBandit((b) => ({ ...b, at: { x: spot.x, y: spot.y }, player: "" }));
  }, [spot]);
  useEffect(() => {
    clearTimeout(tRef.current);
    if (q.trim().length < 2) { setRes([]); return; }
    tRef.current = setTimeout(async () => {
      try { setRes((await api(`/api/admin/jobs/items?q=${encodeURIComponent(q.trim())}`)).matches || []); } catch { setRes([]); }
    }, 300);
  }, [q]);
  const at = (p) => p ? `${p.x}, ${p.y}` : "pick on map";
  const goal = target === "__spot" ? (to ? `the spot ${to.x}, ${to.y}` : "") : target;
  return (
    <div style={box}>
      <b>Events</b>
      <div style={{ ...mono, fontSize: 11, color: C.grey }}>A horde that walks from a spot to a player (or a spot), the way Dawn of the Dead sends its waves.</div>
      <div style={row}>
        <Btn small onClick={() => pickSpot("hordefrom", 0, "Click where the horde starts (out of sight is best).")}>From: {at(from)}</Btn>
        <select style={{ ...inp, width: 140 }} value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">To who?</option>
          {players.map((pp) => <option key={pp.name} value={pp.name}>{pp.name}</option>)}
          <option value="__spot">a spot on the map</option>
        </select>
        {target === "__spot" && <Btn small onClick={() => pickSpot("hordeto", 0, "Click where the horde should go.")}>To: {at(to)}</Btn>}
      </div>
      <div style={row}>
        {num(count, setCount, 1, 300, 64)}<span style={{ ...mono, fontSize: 11 }}>zombies</span>
        <Btn small color={C.red} disabled={!from || !goal} onClick={() => {
          if (!confirm(`Send ${count} zombies from ${from.x}, ${from.y} to ${goal}?`)) return;
          act("ev_horde", target === "__spot" ? { fx: from.x, fy: from.y, tx: to.x, ty: to.y, count } : { fx: from.x, fy: from.y, player: target, count });
        }}>Send the horde</Btn>
      </div>
      <div style={{ ...mono, fontSize: 11, color: C.grey, marginTop: 6 }}>A loot bag on the floor (the spot must be near a player: the game only has loaded ground there).</div>
      <div style={row}>
        <Btn small onClick={() => pickSpot("bag", 0, "Click where the bag goes.")}>Bag at: {at(bagAt)}</Btn>
        <select style={{ ...inp, width: 120 }} value="" onChange={(e) => { const pp = players.find((x) => x.name === e.target.value); if (pp) setBagAt({ x: Math.round(pp.x), y: Math.round(pp.y) }); }}>
          <option value="">or at a player</option>
          {players.map((pp) => <option key={pp.name} value={pp.name}>{pp.name}</option>)}
        </select>
        <input style={{ ...inp, width: 140 }} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Bag name" />
      </div>
      <div style={row}>
        <input style={{ ...inp, flex: 1, width: "auto" }} placeholder="Add an item: bandage, katana..." value={q} onChange={(e) => setQ(e.target.value)} />
        {num(n, setN, 1, 100, 56)}
      </div>
      {res.length > 0 && (
        <div style={{ maxHeight: 140, overflowY: "auto", border: `1px solid ${C.line}` }}>
          {res.map((it) => (
            <button key={it.id} onClick={() => { setItems((l) => [...l.filter((x) => x.id !== it.id), { id: it.id, name: it.name, n }]); setQ(""); setRes([]); }}
              style={{ ...mono, fontSize: 11, display: "block", width: "100%", textAlign: "left", padding: "5px 8px", background: C.bg, color: C.text, border: 0, borderBottom: `1px solid ${C.line}`, cursor: "pointer" }}>
              {it.name} <span style={{ color: C.grey }}>{it.id}</span> <span style={{ color: C.gold }}>+ {n}</span>
            </button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {items.length === 0 && <span style={{ ...mono, fontSize: 11, color: C.grey }}>Empty bag.</span>}
        {items.map((it) => (
          <span key={it.id} style={{ ...mono, fontSize: 11, border: `1px solid ${C.line}`, padding: "2px 6px", borderRadius: 3 }}>
            {it.name} x{it.n} <a style={{ color: C.red, cursor: "pointer" }} onClick={() => setItems((l) => l.filter((x) => x.id !== it.id))}>x</a>
          </span>
        ))}
      </div>
      <div style={row}>
        <label style={{ ...mono, fontSize: 11, color: C.grey, display: "flex", gap: 4, alignItems: "center" }}>
          <input type="checkbox" checked={mark} onChange={(e) => setMark(e.target.checked)} /> mark it on everyone's map (2 h)
        </label>
        <Btn small disabled={!bagAt || items.length === 0} onClick={() => {
          const near = nearestPlayer(players, bagAt);
          if (!confirm(`Drop the bag at ${bagAt.x}, ${bagAt.y}?\n${near ? `Nearest player: ${near.name}, ${near.d} squares away.` : "Nobody is online."}`)) return;
          act("ev_bag", { x: bagAt.x, y: bagAt.y, items: items.map((it) => ({ id: it.id, n: it.n })), name, mark }, () => setItems([]));
        }}>Drop the bag</Btn>
      </div>
      <div style={{ ...mono, fontSize: 11, color: C.grey, marginTop: 6 }}>Bandits from one of the Bandits mod's clans (the spot must be near a player).</div>
      {clans.length === 0 ? <div style={{ ...mono, fontSize: 11, color: "#777" }}>No clans from the game yet (needs mod 1.7.116, the Bandits mod and someone online).</div> : <>
        <div style={row}>
          <select style={{ ...inp, width: 150 }} value={bandit.cid} onChange={(e) => setBandit({ ...bandit, cid: e.target.value })}>
            <option value="">Clan...</option>{clans.map((c) => <option key={c.cid} value={c.cid}>{c.name} ({c.members})</option>)}</select>
          {num(bandit.size, (v) => setBandit({ ...bandit, size: v }), 1, 20, 56)}
          <select style={{ ...inp, width: 110 }} value={bandit.program} onChange={(e) => setBandit({ ...bandit, program: e.target.value })}>
            {[["Bandit", "hunt players"], ["Defend", "hold the spot"], ["Looter", "loot"], ["Thief", "steal"], ["Camper", "camp"], ["Roadblock", "roadblock"]].map(([v, l]) =>
              <option key={v} value={v}>{l}</option>)}</select>
        </div>
        <div style={row}>
          <Btn small onClick={() => pickSpot("bandits", 0, "Click where the bandits appear.")}>At: {bandit.at && !bandit.player ? `${bandit.at.x}, ${bandit.at.y}` : "pick on map"}</Btn>
          <select style={{ ...inp, width: 130 }} value={bandit.player} onChange={(e) => setBandit({ ...bandit, player: e.target.value })}>
            <option value="">or near a player</option>{players.map((pp) => <option key={pp.name} value={pp.name}>{pp.name}</option>)}</select>
          <label style={{ ...mono, fontSize: 11, color: C.grey, display: "flex", gap: 4, alignItems: "center" }}>
            <input type="checkbox" checked={bandit.mark} onChange={(e) => setBandit({ ...bandit, mark: e.target.checked })} /> danger marker (2 h)</label>
        </div>
        <div style={row}>
          <Btn small color={C.red} disabled={!bandit.cid || (!bandit.player && !bandit.at)} onClick={() => {
            const clan = clans.find((c) => c.cid === bandit.cid)?.name || bandit.cid;
            const where = bandit.player ? `near ${bandit.player}` : `at ${bandit.at.x}, ${bandit.at.y}`;
            const near = !bandit.player ? nearestPlayer(players, bandit.at) : null;
            if (!confirm(`Send ${bandit.size} ${clan} (${bandit.program}) ${where}?${near ? `\nNearest player: ${near.name}, ${near.d} squares away.` : ""}`)) return;
            const args = { cid: bandit.cid, size: bandit.size, program: bandit.program };
            if (bandit.player) args.player = bandit.player; else { args.x = bandit.at.x; args.y = bandit.at.y; }
            act("ev_bandits", args);
            if (bandit.mark && !bandit.player) act("mk_add", { x: bandit.at.x, y: bandit.at.y, kind: "danger", title: "Bandits", text: `${clan} seen here`, hours: 2 });
            if (warn.on && warnText.trim()) act("broadcast", { text: warnText.trim() });
            setWarn({ on: warn.on, text: "", v: Math.floor(Math.random() * BANDIT_WARNINGS.length) });
          }}>Send the bandits</Btn>
        </div>
        <label style={{ ...mono, fontSize: 11, color: C.grey, display: "flex", gap: 4, alignItems: "center" }}>
          <input type="checkbox" checked={warn.on} onChange={(e) => setWarn({ ...warn, on: e.target.checked })} /> Zombita warns everyone (in game + Discord)</label>
        {warn.on && <textarea style={{ ...inp, minHeight: 44, resize: "vertical" }} value={warnText} placeholder="Pick a spot or a player first"
          onChange={(e) => setWarn({ ...warn, text: e.target.value })} />}
      </>}
    </div>
  );
}

// ── the five admin places (mod 1.8.56): Mags' garage, community centre, diner, car lot, animal pen ──────────────────────
function placeWhere(P, p) {
  const by = p?.by ? ` · by ${String(p.by).replace(" (website)", "")}` : "";
  if (P.id === "mags") return p ? `${p.x}, ${p.y}${p.place ? `, ${p.place}` : ""}${p.on ? "" : " · the Mechanic card is off (Mags stays closed)"}${by}`
    : "Not set. The Mechanic card can't be bought until it is.";
  if (P.id === "centre") return p ? `${p.x}, ${p.y}${p.place ? `, ${p.place}` : ""}${p.on ? "" : " · switched off in the cards settings"}${by}`
    : "Not set. Job Ranks work without the centre until it is.";
  if (P.id === "diner") return p ? `${p.x}, ${p.y}${p.z ? `, floor ${p.z}` : ""}${p.default ? " · the first spot" : ""}` : "Not reported yet.";
  return p ? `${p.set ? "Centre" : `Beside ${P.keeper} (not set), centre`} ${p.x}, ${p.y} · ${p.w} x ${p.h} tiles`
    : `Not set, and ${P.keeper} isn't out, so there is no square yet.`;
}

function AdminPlaces({ st, act, setPick, sel, setSel, draft, setDraft }) {
  const [typed, setTyped] = useState("");             // the spot typed instead of clicked: "12010, 2142"
  const typedXY = (() => {
    const m = typed.trim().match(/^(\d+)\s*[, ]\s*(\d+)$/);
    return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
  })();
  const places = st?.places;
  const h = { ...mono, fontSize: 10, color: C.grey, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 };
  const move = (P) => {
    if (!draft) return;
    const p = places?.[P.id];
    const from = p ? (P.rect && !p.set ? `beside ${P.keeper} (${p.x}, ${p.y})` : `${p.x}, ${p.y}`) : "nowhere (not set yet)";
    let more = "";
    if (P.id === "mags") more = "Mags' kiosk moves there too. Players buy the Mechanic card there from now on.";
    else if (P.id === "centre") more = "Players claim their Job Rank there from now on.";
    else if (P.id === "diner") more = "Zombita leaves the old diner and stands at the new one (once someone is near).";
    else {
      const n = p?.w || P.size, sq = placeSquare(draft.x, draft.y, n);
      more = `The ${n} x ${n} square goes around it (${sq.x}, ${sq.y} to ${sq.x + n - 1}, ${sq.y + n - 1}).`;
    }
    if (!confirm(`Move ${P.what} from ${from} to ${draft.x}, ${draft.y}?\n\n${more}`)) return;
    act("place_set", { what: P.id, x: draft.x, y: draft.y }, () => { setDraft(null); setTyped(""); setSel(null); });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={h}>Admin places</div>
      <div style={{ ...mono, fontSize: 11, color: C.grey }}>Moving one here is the same as standing on the spot in game and pressing its
        SET ... HERE button in Zombita Control.</div>
      {st && !places && <div style={{ ...mono, fontSize: 11, color: C.gold }}>The server doesn't send these yet (the bot needs liveops_places_patch.py).</div>}
      {places && !places.diner && <div style={{ ...mono, fontSize: 11, color: C.gold }}>The game doesn't send these yet: they come with the Zombita 1.8.56 build.</div>}
      {PLACE_KINDS.map((P) => {
        const p = places?.[P.id], open = sel === P.id;
        return (
          <div key={P.id} id={"place-" + P.id} style={{ ...mono, fontSize: 12, padding: "7px 9px", background: C.bg, border: `1px solid ${open ? P.color : C.line}`,
            borderLeft: `3px solid ${P.color}`, borderRadius: 3, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <a style={{ flex: 1, cursor: p ? "pointer" : "default", color: C.text }} title={p ? "Show it on the map" : ""}
                onClick={() => { if (p) flyTo(p.x, p.y, 1); }}>{P.label}</a>
              <Btn small color={open ? C.grey : P.color} onClick={() => { setSel(open ? null : P.id); setTyped(""); if (open) setPick(null); }}>{open ? "Close" : "Move"}</Btn>
            </div>
            <div style={{ color: p ? C.grey : C.gold, fontSize: 11 }}>{placeWhere(P, p)}</div>
            {open && <>
              <div style={{ color: C.grey, fontSize: 11 }}>{P.help}</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <Btn small onClick={() => setPick({ mode: "place" })}>{draft ? "Pick again" : P.rect ? "Pick the centre on the map" : "Pick on the map"}</Btn>
                {draft && <span>New: {draft.x}, {draft.y}</span>}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input style={inp} placeholder="or type it: x, y  (12010, 2142)" value={typed} onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && typedXY) { setDraft(typedXY); flyTo(typedXY.x, typedXY.y, 1); } }} />
                <Btn small disabled={!typedXY} onClick={() => { if (typedXY) { setDraft(typedXY); flyTo(typedXY.x, typedXY.y, 1); } }}>Use</Btn>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Btn small color={P.color} disabled={!draft} onClick={() => move(P)}>Move here</Btn>
                {draft && <Btn small color={C.grey} onClick={() => setDraft(null)}>Clear</Btn>}
              </div>
            </>}
          </div>
        );
      })}
    </div>
  );
}

// ── shops and bus stations: move them on the map ───────────────────────────
function PlacesTab({ kiosks, moveK, setMoveK, setPick, st, act, placeSel, setPlaceSel, placeDraft, setPlaceDraft }) {
  const [q, setQ] = useState("");
  const list = kiosks.filter((k) => (k.name + " " + k.id).toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.kind.localeCompare(b.kind) || String(a.name).localeCompare(String(b.name)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <AdminPlaces st={st} act={act} setPick={setPick} sel={placeSel} setSel={setPlaceSel} draft={placeDraft} setDraft={setPlaceDraft} />
      <div style={{ ...mono, fontSize: 10, color: C.grey, textTransform: "uppercase", letterSpacing: 1, marginTop: 8 }}>Shops and bus stations</div>
      <div style={{ ...mono, fontSize: 11, color: C.grey }}>Shops, bus stations and the diner where they stand now. Moving one is the same as moving it from the in-game panel.</div>
      {moveK && <div style={{ ...mono, fontSize: 12, color: C.gold }}>Moving {moveK.name}: click its new spot on the map. <a style={{ color: C.grey, cursor: "pointer" }} onClick={() => { setMoveK(null); setPick(null); }}>cancel</a></div>}
      <input style={inp} placeholder="Find a shop or station" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 && <div style={{ ...mono, fontSize: 12, color: C.grey }}>None reported yet (needs mod 1.7.115).</div>}
      {list.map((k) => (
        <div key={k.kind + k.id} style={{ ...mono, fontSize: 12, display: "flex", gap: 6, alignItems: "center", padding: "6px 8px", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 3 }}>
          <span style={{ color: k.kind === "bus" ? C.blue : k.kind === "diner" ? C.purple : C.gold }}>{k.kind === "bus" ? "BUS" : k.kind === "diner" ? "DINER" : "SHOP"}</span>
          <a style={{ flex: 1, cursor: "pointer", opacity: k.off ? 0.5 : 1 }} onClick={() => flyTo(k.x, k.y, 1)}>{k.name}{k.off ? " (destroyed)" : ""} <span style={{ color: C.grey, fontSize: 11 }}>{k.x}, {k.y}</span></a>
          {k.kind === "diner"
            ? <Btn small title="Admin places above: Diner" onClick={() => {
                setPlaceSel("diner");
                setTimeout(() => document.getElementById("place-diner")?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 50);
              }}>Move</Btn>
            : <Btn small onClick={() => { setMoveK({ kind: k.kind, id: k.id, name: k.name }); setPick({ mode: "move" }); }}>Move</Btn>}
        </div>
      ))}
    </div>
  );
}

// ── safehouses ───────────────────────────────────────────────────────────────
function SafehousesTab({ safehouses, selected, setSelS, shKey, draft, setDraft, setPick, act, players }) {
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const list = safehouses.filter((s) => (s.owner + " " + s.title + " " + (s.members || []).join(" ")).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.owner.localeCompare(b.owner));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {selected && !creating && <SafehouseCard s={selected} draft={draft} setDraft={setDraft} setPick={setPick} act={act} players={players}
        onGone={() => { setSelS(null); setDraft(null); }} onMoved={(k) => setSelS(k)} onClose={() => { setSelS(null); setDraft(null); }} />}
      {creating ? <CreateCard draft={draft} setDraft={setDraft} setPick={setPick} act={act} players={players} onDone={() => { setCreating(false); setDraft(null); }} />
        : <Btn onClick={() => { setCreating(true); setSelS(null); setDraft(null); setPick({ mode: "corners" }); }}>New safehouse</Btn>}
      <input style={inp} placeholder="Find by owner, member or name" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 && <div style={{ ...mono, fontSize: 12, color: C.grey }}>No safehouses.</div>}
      {list.map((s) => {
        const k = shKey(s), on = selected && shKey(selected) === k;
        return (
          <button key={k} onClick={() => { setCreating(false); setSelS(k); setDraft(null); flyTo(s.x + s.w / 2, s.y + s.h / 2, 1); }}
            style={{ ...mono, fontSize: 12, textAlign: "left", padding: "7px 9px", background: on ? "#1d1a10" : C.bg, color: C.text,
              border: `1px solid ${on ? C.gold : C.line}`, borderRadius: 3, cursor: "pointer" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ flex: 1 }}>{s.faction ? s.title : s.owner}</span>
              <span style={{ color: C.grey }}>{s.w} x {s.h}</span>
            </div>
            <div style={{ color: C.grey, fontSize: 11 }}>{s.x}, {s.y}{(s.members || []).length ? ` · ${(s.members || []).length} member${s.members.length > 1 ? "s" : ""}` : ""}{s.faction ? " · faction claim" : ""}</div>
          </button>
        );
      })}
    </div>
  );
}

function BoxInputs({ d, setDraft }) {
  const f = (k, v) => setDraft({ ...d, [k]: Math.max(k === "w" || k === "h" ? 1 : 0, Math.floor(Number(v) || 0)) });
  const nudge = (k, by) => f(k, d[k] + by);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
      {[["x", "Left x"], ["y", "Top y"], ["w", "Width"], ["h", "Height"]].map(([k, l]) => (
        <label key={k} style={{ ...mono, fontSize: 10, color: C.grey, display: "flex", flexDirection: "column", gap: 3 }}>{l}
          <div style={{ display: "flex", gap: 3 }}>
            <button onClick={() => nudge(k, -1)} style={{ ...inp, width: 26, padding: 0, cursor: "pointer" }}>-</button>
            <input style={inp} type="number" value={d[k]} onChange={(e) => f(k, e.target.value)} />
            <button onClick={() => nudge(k, 1)} style={{ ...inp, width: 26, padding: 0, cursor: "pointer" }}>+</button>
          </div>
        </label>
      ))}
    </div>
  );
}

// mod 1.8.77: who respawns at this safehouse after death (the owner and the members can; faction safehouses too)
function RespawnBlock({ s, act, h, row }) {
  const id = { x: s.x, y: s.y, owner: s.owner };
  const known = Array.isArray(s.respawn);
  const rs = s.respawn || [];
  const people = [s.owner, ...(s.members || [])].filter((p, i, all) => p && all.indexOf(p) === i);
  return (<>
    <div style={h}>Respawn here after death</div>
    {!known ? <div style={{ ...mono, fontSize: 12, color: C.grey }}>The game reports this from mod 1.8.77 on.</div> : (
      <div style={row}>
        {people.map((p) => {
          const on = rs.includes(p);
          return (
            <span key={p} style={{ ...mono, fontSize: 12, border: `1px solid ${on ? C.green : C.line}`, padding: "2px 6px", borderRadius: 3, display: "inline-flex", gap: 6, alignItems: "center" }}>
              {p}{p === s.owner ? " (owner)" : ""}
              <Btn small color={on ? C.green : C.grey} title={on ? "Respawns here. Click to turn it off." : "Doesn't respawn here. Click to turn it on."}
                onClick={() => act("sh_respawn", { ...id, player: p, on: !on })}>{on ? "On" : "Off"}</Btn>
            </span>
          );
        })}
      </div>
    )}
  </>);
}

function SafehouseCard({ s, draft, setDraft, setPick, act, players, onGone, onMoved, onClose }) {
  const [who, setWho] = useState("");
  const d = draft || { x: s.x, y: s.y, w: s.w, h: s.h };
  const changed = draft && (draft.x !== s.x || draft.y !== s.y || draft.w !== s.w || draft.h !== s.h);
  const id = { x: s.x, y: s.y, owner: s.owner };
  const h = { ...mono, fontSize: 10, color: C.grey, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 };
  const row = { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" };
  return (
    <div style={{ border: `1px solid ${C.gold}`, borderRadius: 3, padding: 10, display: "flex", flexDirection: "column", gap: 8, background: "#15130c" }}>
      <div style={{ display: "flex" }}><button onClick={onClose} title="Close" style={{ marginLeft: "auto", background: "transparent", border: `1px solid ${C.red}`, color: C.red, borderRadius: 3, cursor: "pointer", fontSize: 12, padding: "1px 8px", fontFamily: "var(--mono, monospace)" }}>× Close</button></div>
      <div><b style={{ fontSize: 15 }}>{s.faction ? s.title : `${s.owner}'s safehouse`}</b>
        <div style={{ ...mono, fontSize: 11, color: C.grey }}>{s.x}, {s.y} to {s.x + s.w - 1}, {s.y + s.h - 1} · {s.w} x {s.h}</div></div>
      <RespawnBlock s={s} act={act} h={h} row={row} />
      {s.faction ? (
        <div style={{ ...mono, fontSize: 12, color: C.purple }}>This is a faction claim. The game re-makes it from the claim every 30 seconds, so change it as a claim (faction window in game, or the Factions admin tab).</div>
      ) : (<>
        <div style={h}>Owner</div>
        <div style={{ ...mono, fontSize: 12 }}>{s.owner}</div>
        <div style={h}>Members</div>
        <div style={row}>
          {(s.members || []).length === 0 && <span style={{ ...mono, fontSize: 12, color: C.grey }}>none</span>}
          {(s.members || []).map((m) => (
            <span key={m} style={{ ...mono, fontSize: 12, border: `1px solid ${C.line}`, padding: "2px 6px", borderRadius: 3 }}>
              {m} <a style={{ color: C.red, cursor: "pointer", marginLeft: 4 }} title="Remove" onClick={() => { if (confirm(`Remove ${m} from ${s.owner}'s safehouse?`)) act("sh_kick", { ...id, player: m }); }}>x</a>
            </span>
          ))}
        </div>
        <div style={row}>
          <input style={{ ...inp, flex: 1, width: "auto" }} list="ops-online" placeholder="Player name" value={who} onChange={(e) => setWho(e.target.value)} />
          <datalist id="ops-online">{players.map((p) => <option key={p.name} value={p.name} />)}</datalist>
          <Btn small disabled={!who.trim()} onClick={() => act("sh_add", { ...id, player: who.trim() }, () => setWho(""))}>Add member</Btn>
          <Btn small disabled={!who.trim()} onClick={() => { if (confirm(`Give ${s.owner}'s safehouse to ${who.trim()}? ${s.owner} stays a member.`)) act("sh_owner", { ...id, player: who.trim() }, () => { onMoved(`${s.x},${s.y},${who.trim()}`); setWho(""); }); }}>Make owner</Btn>
        </div>
        <div style={h}>Size and place {changed ? "(dashed box = new)" : ""}</div>
        <BoxInputs d={d} setDraft={setDraft} />
        <div style={row}>
          <Btn small onClick={() => { setDraft(null); setPick({ mode: "corners" }); }}>Draw on map</Btn>
          <Btn small disabled={!changed} onClick={() => act("sh_edit", { ...id, nx: d.x, ny: d.y, nw: d.w, nh: d.h }, () => { onMoved(`${d.x},${d.y},${s.owner}`); setDraft(null); })}>Save size</Btn>
          {changed && <Btn small color={C.grey} onClick={() => setDraft(null)}>Undo</Btn>}
          <span style={{ flex: 1 }} />
          <Btn small color={C.red} onClick={() => { if (confirm(`DELETE ${s.owner}'s safehouse at ${s.x},${s.y}? Members lose access. This can't be undone from here.`)) act("sh_delete", id, onGone); }}>Delete</Btn>
        </div>
      </>)}
    </div>
  );
}

function CreateCard({ draft, setDraft, setPick, act, players, onDone }) {
  const [owner, setOwner] = useState("");
  const [title, setTitle] = useState("");
  return (
    <div style={{ border: `1px solid ${C.gold}`, borderRadius: 3, padding: 10, display: "flex", flexDirection: "column", gap: 8, background: "#15130c" }}>
      <b>New safehouse</b>
      {!draft ? <div style={{ ...mono, fontSize: 12, color: C.grey }}>Click two corners on the map.</div> : <BoxInputs d={draft} setDraft={setDraft} />}
      <input style={inp} list="ops-online-new" placeholder="Owner (player name)" value={owner} onChange={(e) => setOwner(e.target.value)} />
      <datalist id="ops-online-new">{players.map((p) => <option key={p.name} value={p.name} />)}</datalist>
      <input style={inp} placeholder="Name (optional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} />
      <div style={{ display: "flex", gap: 6 }}>
        <Btn small onClick={() => { setDraft(null); setPick({ mode: "corners" }); }}>Draw again</Btn>
        <Btn small disabled={!draft || !owner.trim()} onClick={() => act("sh_create", { nx: draft.x, ny: draft.y, nw: draft.w, nh: draft.h, player: owner.trim(), title }, onDone)}>Create</Btn>
        <Btn small color={C.grey} onClick={() => { setPick(null); onDone(); }}>Cancel</Btn>
      </div>
    </div>
  );
}

// ── chat + log ───────────────────────────────────────────────────────────────
const SRC = { game: { label: "game", color: C.green }, discord: { label: "discord", color: "#7289da" }, web: { label: "web", color: C.gold } };

function ChatTab({ chat, meta, mine, setMine, act }) {
  const [text, setText] = useState("");
  const [bc, setBc] = useState("");
  const end = useRef(null);
  // my messages show at once; dropped once the feed has them (or after 2 minutes)
  const shown = useMemo(() => {
    const now = Date.now();
    const pending = mine.filter((m) => now - m.t < 120000 && !chat.some((c) => c.source === "web" && c.text === m.text));
    return [...chat, ...pending.map((m) => ({ at: "", author: m.author, text: m.text, source: "web", sending: m.state }))];
  }, [chat, mine]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [shown.length]);
  const say = () => {
    const t = text.trim(); if (!t) return;
    const id = Math.random();
    setMine((m) => [...m, { id, t: Date.now(), author: meta.me || "you", text: t, state: "sending..." }]);
    setText("");
    act("say", { text: t }, () => setMine((m) => m.map((x) => x.id === id ? { ...x, state: "" } : x)));
  };
  const time = (at) => { if (!at) return ""; if (/^\d{2}-/.test(at)) return String(at).slice(9, 14); const d = new Date(at); return isNaN(d) ? "" : d.toTimeString().slice(0, 5); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ ...mono, fontSize: 10, color: C.grey, textTransform: "uppercase", letterSpacing: 1 }}>
        In-game chat {meta.source === "discord" ? "(linked with the Discord in-game chat channel)" : meta.source === "log" ? "(from the game log; Discord unreachable)" : ""}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {shown.length === 0 && <div style={{ ...mono, fontSize: 12, color: C.grey }}>Nothing said yet.</div>}
        {shown.map((l, i) => (
          <div key={i} style={{ ...mono, fontSize: 12, opacity: l.sending ? 0.6 : 1 }}>
            <span style={{ color: "#666" }}>{time(l.at)} </span>
            <span style={{ fontSize: 9, color: (SRC[l.source] || SRC.game).color, border: `1px solid ${(SRC[l.source] || SRC.game).color}`, padding: "0 3px", borderRadius: 2, marginRight: 4 }}>{(SRC[l.source] || SRC.game).label}</span>
            <b style={{ color: C.gold }}>{l.author}</b> {l.text}{l.sending ? <span style={{ color: C.grey }}> ({l.sending})</span> : null}
          </div>
        ))}
        <div ref={end} />
      </div>
      <div style={{ ...mono, fontSize: 10, color: C.grey, textTransform: "uppercase", letterSpacing: 1, marginTop: 8 }}>
        Say in chat as {meta.me || "you"} (the game and the Discord channel see it)
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input style={inp} value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Anyone near Valley Station?"
          onKeyDown={(e) => { if (e.key === "Enter") say(); }} />
        <Btn small disabled={!text.trim()} onClick={say}>Say</Btn>
      </div>
      <div style={{ ...mono, fontSize: 10, color: C.grey, textTransform: "uppercase", letterSpacing: 1, marginTop: 8 }}>Server announcement (a pop-up for everyone)</div>
      <div style={{ display: "flex", gap: 6 }}>
        <input style={inp} value={bc} onChange={(e) => setBc(e.target.value)} maxLength={300} placeholder="Restart in 10 minutes"
          onKeyDown={(e) => { if (e.key === "Enter" && bc.trim()) act("broadcast", { text: bc }, () => setBc("")); }} />
        <Btn small disabled={!bc.trim()} onClick={() => act("broadcast", { text: bc }, () => setBc(""))}>Send</Btn>
      </div>
    </div>
  );
}

// ── map markers (players see them on their map + minimap in game) ─────────────
// ── job spots (mod 1.8.54): scrapyards, cabin spots, car drop-offs, car spawns ───────────────────────────────────────
const SPOT_HELP = {
  yards: `Tow jobs end here: the wreck has to be unhooked within 15 tiles of any scrapyard. Up to ${MAX_YARDS}. No scrapyard = no tow jobs.`,
  cabin: "A cabin job builds its bandit hideout on a free cabin spot near the job: in the woods, with no building close by.",
  car: "Car collection and Bring it home jobs park the car on a free drop-off near the job: a road or a parking lot with room for a car.",
  wreck: "Tow wrecks and fleet service cars go on the nearest free car spawn near the job (up to 250 tiles away): a road or a parking lot with room for a car. None near: they go near the town spot like before.",
};
const SPOT_CLEAR = {
  yards: "Remove ALL scrapyards? No tow jobs until one is set again.",
  cabin: "Remove ALL cabin spots? Cabin jobs go back to searching the woods on their own.",
  car: "Remove ALL car drop-offs? Car jobs go back to parking near their town spot.",
  wreck: "Remove ALL car spawns? Tow and fleet cars go near the town spot again.",
};

function JobSpotsTab({ st, kind, setKind, draft, setDraft, setPick, act }) {
  const [typed, setTyped] = useState("");             // the spot typed instead of clicked: "12010, 2142"
  const typedXY = (() => {
    const m = typed.trim().match(/^(\d+)\s*[, ]\s*(\d+)$/);
    return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
  })();
  const K = SPOT_KINDS.find((k) => k.id === kind) || SPOT_KINDS[0];
  const rows = spotRows(st, kind);
  const yards = kind === "yards";
  const full = yards && rows.length >= MAX_YARDS;
  const spots = st?.spots || {};
  const gameOld = !!st && !("cabinOn" in spots);     // a game before 1.8.54 (or an older bot) sends no spot lists
  const h = { ...mono, fontSize: 10, color: C.grey, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 };
  const add = () => {
    if (!draft) return;
    act(yards ? "yard_add" : "sp_add", yards ? { x: draft.x, y: draft.y } : { kind, x: draft.x, y: draft.y }, () => { setDraft(null); setTyped(""); });
  };
  const remove = (r) => {
    if (!confirm(`Remove ${K.word} ${r.n} at ${r.x}, ${r.y}${r.town ? ` (${r.town})` : ""}?`)) return;
    act(yards ? "yard_remove" : "sp_remove", yards ? { x: r.x, y: r.y } : { kind, x: r.x, y: r.y });
  };
  const status = (r) => r.check === "bad" ? <b style={{ color: C.red }}> · bad: {r.why || "failed its check"}</b>
    : r.check === "unchecked" ? <span style={{ color: C.gold }}> · unchecked (checked when a job first uses it)</span> : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {SPOT_KINDS.map((k) => (
          <button key={k.id} onClick={() => setKind(k.id)} style={{ ...mono, fontSize: 11, padding: "4px 8px", borderRadius: 3, cursor: "pointer",
            background: kind === k.id ? "#1a1e24" : "transparent", color: kind === k.id ? k.color : C.grey, border: `1px solid ${kind === k.id ? k.color : C.line}` }}>
            {k.label} ({spotRows(st, k.id).length})</button>
        ))}
      </div>
      <div style={{ ...mono, fontSize: 11, color: C.grey }}>{SPOT_HELP[kind]}</div>
      {kind === "cabin" && <div style={{ ...mono, fontSize: 12, color: spots.cabinOn ? C.green : C.gold }}>
        {rows.length} saved, aim for 20 to 30. {spots.cabinOn ? "Cabin jobs are ON." : "Cabin jobs are OFF until there are enough spots."}</div>}
      {!yards && <div style={{ ...mono, fontSize: 11, color: C.grey }}>Added from here with nobody near, a spot is saved unchecked and checked the
        first time a job uses it. If it fails then, it is marked bad and never used (remove it and pick another).</div>}
      {gameOld && <div style={{ ...mono, fontSize: 11, color: C.gold }}>The server doesn't send these lists yet: they come with the Zombita 1.8.54 build.</div>}
      <div style={{ border: `1px solid ${K.color}`, borderRadius: 3, padding: 10, display: "flex", flexDirection: "column", gap: 8, background: "#14161a" }}>
        <b>New {K.word}</b>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <Btn small onClick={() => setPick({ mode: "jobspot" })}>{draft ? "Move the spot" : "Pick the spot on the map"}</Btn>
          {draft && <span style={{ ...mono, fontSize: 12 }}>{draft.x}, {draft.y}</span>}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input style={inp} placeholder="or type the spot: x, y  (12010, 2142)" value={typed} onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && typedXY) { setDraft(typedXY); flyTo(typedXY.x, typedXY.y, 1); } }} />
          <Btn small disabled={!typedXY} onClick={() => { if (typedXY) { setDraft(typedXY); flyTo(typedXY.x, typedXY.y, 1); } }}>Use</Btn>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn small color={K.color} disabled={!draft || full} title={full ? `There are ${MAX_YARDS} already. Remove one first.` : ""} onClick={add}>Add {K.word}</Btn>
          {draft && <Btn small color={C.grey} onClick={() => setDraft(null)}>Cancel</Btn>}
        </div>
        {full && <div style={{ ...mono, fontSize: 11, color: C.gold }}>There are {MAX_YARDS} scrapyards already. Remove one first.</div>}
      </div>
      <div style={h}>{K.label} now</div>
      {rows.length === 0 && <div style={{ ...mono, fontSize: 12, color: C.grey }}>{yards ? "None set. No tow jobs until one is." : `No ${K.label.toLowerCase()} saved.`}</div>}
      {rows.map((r) => (
        <div key={`${r.x},${r.y}`} style={{ ...mono, fontSize: 12, padding: "7px 9px", background: C.bg, border: `1px solid ${C.line}`,
          borderLeft: `3px solid ${r.check === "bad" ? C.red : K.color}`, borderRadius: 3 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <a style={{ flex: 1, cursor: "pointer", color: C.text }} title="Show it on the map" onClick={() => flyTo(r.x, r.y, 1)}>
              {K.pin} {r.n}{r.town ? `, ${r.town}` : ""}</a>
            <Btn small color={C.red} onClick={() => remove(r)}>Remove</Btn>
          </div>
          <div style={{ color: C.grey, fontSize: 11 }}>{r.x}, {r.y}{r.seed ? " · built in" : ""}{r.by ? ` · by ${String(r.by).replace(" (website)", "")}` : ""}{status(r)}</div>
        </div>
      ))}
      {rows.length > 0 && <Btn small color={C.red} onClick={() => { if (confirm(SPOT_CLEAR[kind])) act(yards ? "yard_clear" : "sp_clear", yards ? {} : { kind }); }}>
        Remove all {K.label.toLowerCase()}</Btn>}
    </div>
  );
}

function MarkersTab({ markers, draft, setDraft, setPick, act, players = [], forWho = "", setForWho = (_v) => {} }) {
  const [kind, setKind] = useState("go");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [hours, setHours] = useState(0);
  const [typed, setTyped] = useState("");             // the spot typed instead of clicked: "12010, 2142"
  const typedXY = (() => {
    const m = typed.trim().match(/^(\d+)\s*[, ]\s*(\d+)$/);
    return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
  })();
  const h = { ...mono, fontSize: 10, color: C.grey, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 };
  const left = (m) => {
    if (!m.expires) return "until removed";
    const s = m.expires - Date.now() / 1000;
    return s <= 0 ? "ending" : s > 3600 ? `${Math.round(s / 360) / 10} h left` : `${Math.max(1, Math.round(s / 60))} min left`;
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ border: `1px solid ${C.gold}`, borderRadius: 3, padding: 10, display: "flex", flexDirection: "column", gap: 8, background: "#15130c" }}>
        <b>New marker</b>
        <div style={{ ...mono, fontSize: 11, color: C.grey }}>{forWho
          ? `Only ${forWho} sees it on their map (M) and minimap, with the title next to it. A note pops over their head when it goes up. Nobody else sees it.`
          : "Every player sees it on their map (M) and minimap, with the title next to it. A note pops over their head when it goes up."}</div>
        <label style={{ ...mono, fontSize: 11, color: C.grey, display: "flex", gap: 6, alignItems: "center" }}>Who sees it
          <select style={inp} value={forWho} onChange={(e) => setForWho(e.target.value)}>
            <option value="">Everyone</option>
            {forWho && !players.some((o) => o.name === forWho) && <option value={forWho}>Only {forWho}</option>}
            {players.map((o) => <option key={o.name} value={o.name}>Only {o.name}</option>)}
          </select>
        </label>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <Btn small onClick={() => setPick({ mode: "marker" })}>{draft ? "Move the spot" : "Pick the spot on the map"}</Btn>
          {draft && <span style={{ ...mono, fontSize: 12 }}>{draft.x}, {draft.y}</span>}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input style={inp} placeholder="or type the spot: x, y  (12010, 2142)" value={typed} onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && typedXY) { setDraft(typedXY); flyTo(typedXY.x, typedXY.y, 1); } }} />
          <Btn small disabled={!typedXY} onClick={() => { if (typedXY) { setDraft(typedXY); flyTo(typedXY.x, typedXY.y, 1); } }}>Use</Btn>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {Object.entries(MARK).map(([k, v]) => (
            <button key={k} onClick={() => setKind(k)} style={{ ...mono, fontSize: 11, padding: "4px 8px", borderRadius: 3, cursor: "pointer",
              background: kind === k ? "#1a1e24" : "transparent", color: kind === k ? v.color : C.grey, border: `1px solid ${kind === k ? v.color : C.line}` }}>{v.label}</button>
          ))}
        </div>
        <input style={inp} placeholder="Title (shown on the map), e.g. Horde fight here" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} />
        <input style={inp} placeholder="A line under it (optional), e.g. Bring guns, 8 pm" value={text} onChange={(e) => setText(e.target.value)} maxLength={120} />
        <label style={{ ...mono, fontSize: 11, color: C.grey, display: "flex", gap: 6, alignItems: "center" }}>Hours
          <input style={{ ...inp, width: 80 }} type="number" min={0} max={720} value={hours} onChange={(e) => setHours(Math.max(0, Math.min(720, Number(e.target.value) || 0)))} />
          <span>{hours ? "" : "0 = until removed"}</span>
        </label>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn small disabled={!draft || !title.trim()} onClick={() => act("mk_add", { x: draft.x, y: draft.y, kind, title: title.trim(), text: text.trim(), hours,
            ...(forWho ? { player: forWho } : {}) },
            () => { setDraft(null); setTitle(""); setText(""); setTyped(""); setForWho(""); })}>{forWho ? `Place it for ${forWho}` : "Place marker"}</Btn>
          {draft && <Btn small color={C.grey} onClick={() => setDraft(null)}>Cancel</Btn>}
        </div>
      </div>
      <div style={h}>On the map now</div>
      {markers.length === 0 && <div style={{ ...mono, fontSize: 12, color: C.grey }}>No markers.</div>}
      {markers.map((m) => (
        <div key={m.id} style={{ ...mono, fontSize: 12, padding: "7px 9px", background: C.bg, border: `1px solid ${C.line}`, borderLeft: `3px solid ${(MARK[m.kind] || MARK.go).color}`, borderRadius: 3 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <a style={{ flex: 1, cursor: "pointer", color: C.text }} onClick={() => flyTo(m.x, m.y, 1)}>{m.title}</a>
            <Btn small color={C.red} onClick={() => { if (confirm(`Remove the marker "${m.title}"?`)) act("mk_remove", { mid: m.id }); }}>Remove</Btn>
          </div>
          <div style={{ color: C.grey, fontSize: 11 }}>{(MARK[m.kind] || MARK.go).label} · {m.x}, {m.y} · {left(m)}{m.by ? ` · by ${String(m.by).replace(" (website)", "")}` : ""}
            {m.owner ? <b style={{ color: C.gold }}> · only {m.owner}</b> : null}</div>
          {m.text ? <div style={{ fontSize: 11 }}>{m.text}</div> : null}
        </div>
      ))}
      {markers.length > 1 && <Btn small color={C.red} onClick={() => { if (confirm("Remove ALL markers from everyone's map?")) act("mk_clear", {}); }}>Remove all</Btn>}
    </div>
  );
}

// ── factions ────────────────────────────────────────────────────────────────
function FactionsTab({ facs, selF, setSelF, act, players, refresh, claimDraft, setClaimDraft, setPick, safehouses = [] }) {
  const [q, setQ] = useState("");
  const list = (facs.factions || []).filter((f) => (f.name + " " + f.tag + " " + f.members.join(" ")).toLowerCase().includes(q.toLowerCase()));
  const f = (facs.factions || []).find((x) => x.fid === selF) || null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {f && <FactionCard onClose={() => { setSelF(null); setClaimDraft(null); }} f={f} facs={facs} act={act} players={players} refresh={refresh} claimDraft={claimDraft} setClaimDraft={setClaimDraft} setPick={setPick} safehouses={safehouses} />}
      <input style={inp} placeholder="Find a faction or member" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 && <div style={{ ...mono, fontSize: 12, color: C.grey }}>No factions.</div>}
      {list.map((x) => (
        <button key={x.fid} onClick={() => { setSelF(x.fid); setClaimDraft(null); if (x.claim?.x) flyTo(x.claim.x, x.claim.y, 1); }}
          style={{ ...mono, fontSize: 12, textAlign: "left", padding: "7px 9px", background: x.fid === selF ? "#1a1424" : C.bg, color: C.text,
            border: `1px solid ${x.fid === selF ? C.purple : C.line}`, borderRadius: 3, cursor: "pointer" }}>
          <div style={{ display: "flex", gap: 8 }}><span style={{ flex: 1 }}>{x.name}{x.tag ? ` [${x.tag}]` : ""}</span><span style={{ color: C.grey }}>{x.members.length}</span></div>
          <div style={{ color: C.grey, fontSize: 11 }}>led by {x.owner || "?"}{x.claim?.rect?.w ? ` · faction safehouse ${x.claim.rect.w} x ${x.claim.rect.h} at ${x.claim.rect.x}, ${x.claim.rect.y}` : x.claim?.x ? ` · ${facs.tiers?.[x.claim.tier] || "claim"} at ${x.claim.x}, ${x.claim.y}` : " · no claim"}</div>
        </button>
      ))}
    </div>
  );
}

function FactionCard({ f, facs, act, players, refresh, claimDraft, setClaimDraft, setPick, onClose, safehouses = [] }) {
  const [who, setWho] = useState("");
  const done = () => setTimeout(refresh, 1500);
  const h = { ...mono, fontSize: 10, color: C.grey, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 };
  const row = { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" };
  const c = f.claim || {};
  const d = claimDraft || (c.x ? { cx: c.x, cy: c.y, tier: c.tier || 1 } : null);
  const changed = claimDraft && (!c.x || claimDraft.cx !== c.x || claimDraft.cy !== c.y || claimDraft.tier !== (c.tier || 1));
  return (
    <div style={{ border: `1px solid ${C.purple}`, borderRadius: 3, padding: 10, display: "flex", flexDirection: "column", gap: 8, background: "#14101c" }}>
      <div style={{ display: "flex" }}><button onClick={onClose} title="Close" style={{ marginLeft: "auto", background: "transparent", border: `1px solid ${C.red}`, color: C.red, borderRadius: 3, cursor: "pointer", fontSize: 12, padding: "1px 8px", fontFamily: "var(--mono, monospace)" }}>× Close</button></div>
      <div><b style={{ fontSize: 15 }}>{f.name}</b>{f.tag ? <span style={{ ...mono, color: C.grey }}> [{f.tag}]</span> : null}
        <div style={{ ...mono, fontSize: 11, color: C.grey }}>Wallet {f.wallet.toLocaleString()} bronze</div></div>
      <div style={h}>Members</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {f.members.map((m) => (
          <div key={m} style={{ ...mono, fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ flex: 1 }}>{m}{m === f.owner ? <span style={{ color: C.purple }}> (leader)</span> : null}</span>
            {m !== f.owner && <Btn small color={C.purple} onClick={() => { if (confirm(`Make ${m} the leader of ${f.name}? ${f.owner} stays a member.`)) act("fa_owner", { faction: f.name, player: m }, done); }}>Leader</Btn>}
            {m !== f.owner && <Btn small color={C.red} onClick={() => { if (confirm(`Kick ${m} from ${f.name}?`)) act("fa_kick", { faction: f.name, player: m }, done); }}>Kick</Btn>}
          </div>
        ))}
      </div>
      <div style={row}>
        <input style={{ ...inp, flex: 1, width: "auto" }} list="ops-online-fa" placeholder="Player name" value={who} onChange={(e) => setWho(e.target.value)} />
        <datalist id="ops-online-fa">{players.map((p) => <option key={p.name} value={p.name} />)}</datalist>
        <Btn small disabled={!who.trim()} onClick={() => act("fa_add", { faction: f.name, player: who.trim() }, () => { setWho(""); done(); })}>Add</Btn>
      </div>
      <div style={h}>Claim {changed ? "(dashed purple box = new)" : ""}</div>
      {!d ? <div style={{ ...mono, fontSize: 12, color: C.grey }}>No claim.</div> : c.rect?.w && !changed ? (
        <div style={{ ...mono, fontSize: 12 }}>Faction safehouse {c.rect.w} x {c.rect.h} at {c.rect.x}, {c.rect.y}
          <div style={{ fontSize: 11, color: C.grey }}>Was {c.converted_from?.owner || "a player"}&apos;s safehouse (converted {c.converted_from?.by ? "by " + c.converted_from.by : ""}). One way: it can&apos;t be turned back. Tier for rewards: {facs.tiers?.[c.tier] || c.tier}.</div></div>
      ) : (
        <div style={{ ...mono, fontSize: 12 }}>{facs.tiers?.[d.tier] || "Tier " + d.tier} at {d.cx}, {d.cy} ({2 * (facs.radii?.[d.tier] ?? 10) + 1} x {2 * (facs.radii?.[d.tier] ?? 10) + 1})</div>
      )}
      <div style={row}>
        {[1, 2, 3].map((t) => (
          <Btn key={t} small color={d?.tier === t ? C.gold : C.grey} disabled={!d} onClick={() => setClaimDraft({ ...(d || {}), tier: t })}>{facs.tiers?.[t] || "Tier " + t}</Btn>
        ))}
      </div>
      <div style={row}>
        <Btn small onClick={() => setPick({ mode: "claim" })}>{c.x ? "Move on map" : "Place on map"}</Btn>
        <Btn small disabled={!changed} onClick={() => { if (c.rect?.w && !confirm(`${f.name}'s claim is a converted safehouse (${c.rect.w} x ${c.rect.h}). Saving makes it a normal square claim: the game rebuilds the safehouse as the square. Go on?`)) return; act("fa_claim_set", { fid: f.fid, cx: d.cx, cy: d.cy, tier: d.tier }, () => { setClaimDraft(null); done(); }); }}>Save claim</Btn>
        {changed && <Btn small color={C.grey} onClick={() => setClaimDraft(null)}>Undo</Btn>}
        <span style={{ flex: 1 }} />
        {c.x ? <Btn small color={C.red} onClick={() => { if (confirm(`Remove ${f.name}'s claim? Its safehouse goes within a minute.`)) act("fa_claim_remove", { fid: f.fid }, done); }}>Remove</Btn> : null}
      </div>
      <div style={{ ...mono, fontSize: 11, color: C.grey }}>Admin claims are free. The game makes the safehouse within a minute and refuses one that overlaps another safehouse.</div>
      {!c.x && <ConvertBox f={f} act={act} done={done} safehouses={safehouses} />}
    </div>
  );
}

// 2026-10-25 (mod 1.8.67, Nin: Timbrr's group): make a player's safehouse this faction's safehouse, in place. ONE WAY. Players do it with
// an Admin Ticket (the other side confirms, an admin approves on /safehouse); here the admins can do it directly: no ticket, no
// confirmations, and the owner may be outside the faction (then they lose access too).
function convertLosers(sh, members, leader) {
  const inF = new Set([...(members || []), leader || ""].map((m) => String(m).toLowerCase()));
  const lose = (sh.members || []).filter((m) => !inF.has(String(m).toLowerCase()));
  if (!inF.has(String(sh.owner || "").toLowerCase())) lose.unshift(sh.owner);
  return lose;
}

function ConvertBox({ f, act, done, safehouses }) {
  const [pick, setPick] = useState("");
  const h = { ...mono, fontSize: 10, color: C.grey, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 };
  const key = (s) => `${s.x},${s.y},${s.w},${s.h},${s.owner}`;
  const list = (safehouses || []).filter((s) => !s.faction && !String(s.title || "").startsWith("Faction: "));
  const inF = new Set([...(f.members || []), f.owner || ""].map((m) => String(m).toLowerCase()));
  list.sort((a, b) => Number(inF.has(String(b.owner).toLowerCase())) - Number(inF.has(String(a.owner).toLowerCase())) || String(a.owner).localeCompare(String(b.owner)));
  const sh = list.find((s) => key(s) === pick) || null;
  const lose = sh ? convertLosers(sh, f.members, f.owner) : [];
  const go = () => {
    if (!sh) return;
    const text = `Make ${sh.owner}'s safehouse (${sh.w} x ${sh.h} at ${sh.x}, ${sh.y}) the faction safehouse of ${f.name}?\n\n`
      + `The exact rectangle is kept, nothing moves, and it's free. ${f.owner || "The leader"} becomes its owner.\n`
      + `ONE WAY: it can't be turned back into a normal safehouse.\n\n`
      + (lose.length ? `These players are NOT in ${f.name} and lose access: ${lose.join(", ")}.` : "Nobody loses access.");
    if (!confirm(text)) return;
    act("fa_convert_sh", { fid: f.fid, x: sh.x, y: sh.y, w: sh.w, h: sh.h, owner: sh.owner }, () => { setPick(""); done(); });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>
      <div style={h}>Make a safehouse the faction safehouse (one way)</div>
      <select style={inp} value={pick} onChange={(e) => setPick(e.target.value)}>
        <option value="">Pick a player safehouse</option>
        {list.map((s) => <option key={key(s)} value={key(s)}>{s.owner}{inF.has(String(s.owner).toLowerCase()) ? " (in the faction)" : ""}: {s.w} x {s.h} at {s.x}, {s.y}{s.title ? ` "${s.title}"` : ""}</option>)}
      </select>
      {sh && (
        <div style={{ ...mono, fontSize: 11, color: C.text, lineHeight: 1.5 }}>
          Kept exactly: {sh.w} x {sh.h} at {sh.x}, {sh.y} ({(sh.w * sh.h).toLocaleString()} tiles). {f.owner || "The leader"} becomes the owner; every member is on it.
          {!inF.has(String(sh.owner).toLowerCase()) && <div style={{ color: C.gold }}>{sh.owner} is not in {f.name}. Players can only do this for a member&apos;s safehouse; as an admin you can, and {sh.owner} loses access.</div>}
          <div style={{ color: lose.length ? C.red : C.grey }}>{lose.length ? `Lose access (not in ${f.name}): ${lose.join(", ")}` : "Nobody loses access."}</div>
          <div style={{ color: C.red }}>One way: it can&apos;t be turned back into a normal safehouse.</div>
        </div>)}
      <Btn small color={C.purple} disabled={!sh} onClick={go}>Convert it</Btn>
      <div style={{ ...mono, fontSize: 11, color: C.grey }}>The game checks it again (same owner and size, no overlap, the leader owns no other safehouse) and changes the safehouse in place: no gap, nothing moves. Players see the new owner after a relog.</div>
    </div>
  );
}

// RCON (Nin 2026-10-14: "add rcon option at live ops ... so i dont need to manually find at map"): any server command,
// straight to the game's RCON (the admin console's /api/admin/console/rcon). Up / down arrows walk the history; commands
// that stop the server or remove someone ask first.
const RCON_ASK = /^(quit|stopserver|ban|banid|banuser|kick|kickuser|removeuserfromwhitelist|resetid|reloadoptions|changeoption)\b/i;
function RconTab() {
  const [cmd, setCmd] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState([]);
  const [hist, setHist] = useState([]);
  const [hi, setHi] = useState(-1);
  const send = async () => {
    const c = cmd.trim();
    if (!c || busy) return;
    if (RCON_ASK.test(c) && !confirm(`Send "${c}" to the server?`)) return;
    setBusy(true);
    setHist((h) => [c, ...h.filter((x) => x !== c)].slice(0, 50));
    setHi(-1);
    try {
      const d = await api("/api/admin/console/rcon", { command: c });
      setOut((o) => [{ c, ok: d.ok !== false, text: (d.response || d.error || "(no reply)").trim(), at: Date.now() }, ...o].slice(0, 100));
      setCmd("");
    } catch (e) {
      setOut((o) => [{ c, ok: false, text: String(e.message || e), at: Date.now() }, ...o].slice(0, 100));
    }
    setBusy(false);
  };
  const key = (e) => {
    if (e.key === "Enter") { e.preventDefault(); send(); }
    else if (e.key === "ArrowUp" && hist.length) { e.preventDefault(); const i = Math.min(hi + 1, hist.length - 1); setHi(i); setCmd(hist[i]); }
    else if (e.key === "ArrowDown") { e.preventDefault(); const i = hi - 1; setHi(i); setCmd(i >= 0 ? hist[i] : ""); }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ ...mono, fontSize: 11, color: C.grey }}>
        Any server command, as in the game's admin console (without the slash). Examples: <b style={{ color: C.text }}>teleportto "Kise" 12010,2142,0</b> ·
        {" "}<b style={{ color: C.text }}>players</b> · <b style={{ color: C.text }}>servermsg "Restart in 5 minutes"</b> · <b style={{ color: C.text }}>help</b>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input style={inp} autoFocus placeholder='teleportto "Name" x,y,z' value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={key} disabled={busy} />
        <Btn small disabled={busy || !cmd.trim()} onClick={send}>{busy ? "..." : "Send"}</Btn>
      </div>
      {out.length === 0 && <div style={{ ...mono, fontSize: 12, color: C.grey }}>Nothing sent yet.</div>}
      {out.map((r, i) => (
        <div key={r.at + "-" + i} style={{ ...mono, fontSize: 11, borderLeft: `3px solid ${r.ok ? C.green : C.red}`, padding: "4px 8px", background: C.bg }}>
          <div><b style={{ cursor: "pointer" }} title="Use again" onClick={() => setCmd(r.c)}>&gt; {r.c}</b> <span style={{ color: C.grey }}>{new Date(r.at).toLocaleTimeString()}</span></div>
          <pre style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word", color: r.ok ? C.text : C.red, fontFamily: "inherit" }}>{r.text}</pre>
        </div>
      ))}
    </div>
  );
}

function LogTab({ log }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {log.length === 0 && <div style={{ ...mono, fontSize: 12, color: C.grey }}>No actions yet.</div>}
      {log.map((r, i) => (
        <div key={i} style={{ ...mono, fontSize: 11, borderLeft: `3px solid ${r.queued ? C.gold : r.ok ? C.green : C.red}`, padding: "4px 8px", background: C.bg }}>
          <div><b>{r.cmd}</b> {r.args?.player || r.args?.owner || ""} <span style={{ color: C.grey }}>by {r.by} · {new Date(r.at * 1000).toLocaleString()}</span></div>
          <div style={{ color: C.grey }}>{r.queued ? "waiting for the game..." : r.msg}</div>
        </div>
      ))}
    </div>
  );
}
