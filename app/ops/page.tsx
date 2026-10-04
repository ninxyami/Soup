// @ts-nocheck
"use client";
// app/ops/page.tsx - Live Ops: the admins' live control panel (2026-10-04). The world map with everything the game
// reports (players, safehouses, zombie heat, bandits, claimed vehicles) and the tools to fix things without logging in:
// teleport, give, message, kick, ban, safehouse edit / owner / members / delete / create, faction members / leader /
// claims, chat linked with the Discord in-game chat channel, broadcast, map markers players see in game (1.7.112),
// a player's character: skills / levels, traits, heal, needs, god / invisible / noclip (1.7.114), inventory, cars,
// movement trail + "who was here", warnings, zombies, weather + events, moving shops / bus stations, admin presence (1.7.115).
// Backend: /api/admin/ops/* (routers/liveops.py); the game side is mod 1.7.111 ZO_Server.lua. Admins only.
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flyTo } from "@/components/WorldMap";
import { API } from "@/lib/constants";
import ZombitaControl from "@/components/ops/ZombitaControl";

// the mode (Live / Zombita) and Zombita's last tab survive a reload (per browser)
function remembered(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } }
function remember(key, value) { try { localStorage.setItem(key, value); } catch {} }

const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

const C = { gold: "#c8a84b", blue: "#4a8fc4", green: "#4caf7d", red: "#e05555", purple: "#9775cc", grey: "#9aa", text: "#e6e6e6", bg: "#0b0d10", panel: "#111418", line: "#2a2f37" };
const mono = { fontFamily: "var(--mono, monospace)" };
const MARK = { go: { label: "Go here", color: "#e8be4a" }, event: { label: "Event", color: "#ec8c3c" }, info: { label: "Info", color: "#60a0dc" },
  danger: { label: "Danger", color: "#e05246" } };
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
];

async function api(path, body) {
  const r = await fetch(`${API}${path}`, body === undefined ? { credentials: "include" } :
    { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let d = null;
  try { d = await r.json(); } catch {}
  if (!r.ok) { const e = new Error((d && (d.detail || d.error)) || `HTTP ${r.status}`); e.status = r.status; throw e; }
  return d;
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

export default function OpsPage() {
  const [st, setSt] = useState(null);
  const [err, setErr] = useState("");
  const [layers, setLayers] = useState({ town: true, shop: true, bus: true, diner: true, markers: true, players: true, safehouses: true, zombies: true, bandits: true, vehicles: false });
  const [places, setPlaces] = useState([]);
  const [markDraft, setMarkDraft] = useState(null);     // { x, y } where a new marker goes
  const [trailPts, setTrailPts] = useState(null);       // { player, points } drawn on the map
  const [spot, setSpot] = useState(null);               // { x, y, for } a spot picked for the World tools
  const [moveK, setMoveK] = useState(null);             // { kind, id, name } a shop / station being moved
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
    const ks = st?.kiosks || [];
    if (!ks.length) return places;
    const by = {};
    for (const k of ks) by[k.kind + ":" + k.id] = k;
    return places.filter((pl) => !(by[pl.kind + ":" + pl.id]?.off)).map((pl) => {
      const k = by[pl.kind + ":" + pl.id];
      return k ? { ...pl, x: k.x, y: k.y } : pl;
    });
  }, [places, st]);
  const players = st?.players || [];
  const safehouses = st?.safehouses || [];
  const shKey = (s) => `${s.x},${s.y},${s.owner}`;
  const selected = useMemo(() => safehouses.find((s) => shKey(s) === selS) || null, [safehouses, selS]);
  const selPlayer = players.find((p) => p.name === selP) || null;

  // ── what the map draws ──
  const dots = useMemo(() => {
    const out = [];
    if (layers.players) for (const p of players) out.push({ id: "p:" + p.name, label: p.name, x: p.x, y: p.y,
      color: p.name === selP ? C.gold : p.dead ? C.red : p.in_vehicle ? C.blue : C.green, onClick: () => { setSelP(p.name); setTab("players"); } });
    if (layers.bandits) (st?.bandits || []).forEach((b, i) => out.push({ id: "b:" + i, label: "", x: b.x, y: b.y, size: 7, color: b.hostile ? "#e0904a" : "#d8c36a" }));
    if (layers.markers) (st?.markers || []).forEach((m) => out.push({ id: "m:" + m.id, label: m.title, x: m.x, y: m.y, size: 12,
      color: (MARK[m.kind] || MARK.go).color, onClick: () => setTab("markers") }));
    if (markDraft) out.push({ id: "m:draft", label: "new marker", x: markDraft.x, y: markDraft.y, size: 12, color: "#fff" });
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
    if (mode === "zombita") out.push(...zLayer.dots);
    return out;
  }, [st, layers, selP, toast, markDraft, trailPts, spot, admins, meId, mode, zLayer]);
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
    if (mode === "zombita") out.push(...zLayer.rects);
    return out;
  }, [st, layers, safehouses, selS, draft, claimDraft, facs, spot, mode, zLayer]);

  // map clicks: pick a teleport spot, or two corners of a safehouse box
  const onMapClick = useCallback((w) => {
    if (!pick) return;
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
    if (tab === "players" && selP) return `Looking at ${selP}`;
    if (tab === "safehouses" && selS) return `Safehouse ${selS.split(",").slice(2).join(",")}'s`;
    if (tab === "factions" && selF) return `Faction ${(facs.factions.find((f) => f.fid === selF) || {}).name || ""}`;
    if (moveK) return `Moving ${moveK.name}`;
    return { players: "Players", safehouses: "Safehouses", factions: "Factions", cars: "Cars", world: "World tools", places: "Shops and stations",
      markers: "Markers", chat: "Chat", log: "Log" }[tab] || "Live Ops";
  }, [tab, selP, selS, selF, facs, moveK, mode, ztab]);
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
        <span style={{ font: "400 22px 'Bebas Neue',sans-serif", letterSpacing: 2 }}>LIVE OPS</span>
        <span style={{ display: "inline-flex", border: `1px solid ${C.line}`, borderRadius: 3, overflow: "hidden" }}>
          {[["live", "Live"], ["zombita", "Zombita"]].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} style={{ ...mono, fontSize: 11, padding: "4px 10px", border: 0, cursor: "pointer", textTransform: "uppercase",
              background: mode === m ? (m === "zombita" ? "#2a1f33" : "#1a1e24") : "transparent", color: mode === m ? (m === "zombita" ? "#c9a8f0" : C.gold) : "#777" }}>{l}</button>
          ))}
        </span>
        <a href="/workspace" style={{ ...mono, fontSize: 11, color: C.grey, textDecoration: "none" }}>workspace</a>
        {LAYERS.map((l) => (
          <button key={l.id} onClick={() => setLayers((x) => ({ ...x, [l.id]: !x[l.id] }))}
            style={{ ...mono, fontSize: 11, padding: "4px 9px", borderRadius: 3, cursor: "pointer", background: layers[l.id] ? "#1a1e24" : "transparent",
              color: layers[l.id] ? C.text : "#666", border: `1px solid ${layers[l.id] ? l.color : C.line}` }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: l.color, marginRight: 6, opacity: layers[l.id] ? 1 : 0.3 }} />{l.label}
          </button>
        ))}
        <span style={{ display: "flex", gap: 4, marginLeft: "auto", alignItems: "center" }}>
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
      {pick && (
        <div style={{ ...mono, fontSize: 12, padding: "6px 14px", background: "#2a2410", color: C.gold, display: "flex", gap: 12, alignItems: "center" }}>
          {pick.mode === "z" ? pick.hint : pick.mode === "teleport" ? `Click the spot on the map to teleport ${selP} to.` : pick.mode === "claim" ? "Click where the claim's flag goes (its center)." : pick.mode === "marker" ? "Click where the marker goes." : pick.mode === "spot" ? (pick.hint || "Click the spot on the map.") : pick.mode === "move" ? `Click where ${moveK?.name || "it"} should stand now.` : pick.first ? "Now click the opposite corner." : "Click one corner of the safehouse on the map."}
          <Btn small onClick={() => { setPick(null); }}>Cancel</Btn>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", cursor: pick ? "crosshair" : "default" }}>
          {err ? <div style={{ ...mono, padding: 30, color: C.red }}>{err}</div> :
            <WorldMap places={livePlaces} hidden={hiddenKinds} dots={dots} rects={rects} onMapClick={onMapClick} />}
        </div>
        <aside style={{ width: mode === "zombita" && wide ? 640 : 400, maxWidth: mode === "zombita" && wide ? "62vw" : "48vw", minWidth: 0, overflowX: "hidden",
          borderLeft: `1px solid ${C.line}`, display: "flex", flexDirection: "column", background: C.panel }}>
          {mode === "zombita" ? <ZombitaControl act={act} setPick={setPick} st={st} players={players} setLayer={setZLayer} setWide={setWide}
            tab={ztab} setTab={setZtab} /> : <>
          <div style={{ display: "flex", flexWrap: "wrap", borderBottom: `1px solid ${C.line}` }}>
            {[["players", `Players (${players.length})`], ["safehouses", `Safehouses (${safehouses.length})`], ["factions", "Factions"], ["cars", `Cars (${(st?.vehicles || []).length})`], ["world", "World"], ["places", "Places"],
              ["markers", `Markers (${(st?.markers || []).length})`], ["chat", "Chat"], ["log", "Log"]].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={{ ...mono, flex: "1 0 22%", fontSize: 11, padding: "8px 4px", background: tab === k ? C.bg : "transparent",
                color: tab === k ? C.gold : C.grey, border: 0, borderBottom: tab === k ? `2px solid ${C.gold}` : "2px solid transparent", cursor: "pointer", textTransform: "uppercase" }}>{l}</button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            {tab === "players" && <PlayersTab players={players} selP={selP} setSelP={setSelP} selPlayer={selPlayer} act={act} setPick={setPick} safehouses={safehouses}
              cars={st?.vehicles || []} trailPts={trailPts} setTrailPts={setTrailPts} />}
            {tab === "safehouses" && <SafehousesTab safehouses={safehouses} selected={selected} setSelS={setSelS} shKey={shKey} draft={draft} setDraft={setDraft}
              setPick={setPick} act={act} players={players} />}
            {tab === "factions" && <FactionsTab facs={facs} selF={selF} setSelF={setSelF} act={act} players={players} refresh={refreshFactions}
              claimDraft={claimDraft} setClaimDraft={setClaimDraft} setPick={setPick} />}
            {tab === "cars" && <CarsTab cars={st?.vehicles || []} act={act} players={players} />}
            {tab === "world" && <WorldTab act={act} spot={spot} setSpot={setSpot} setPick={setPick} players={players} places={livePlaces}
              showTrail={(player, points) => setTrailPts({ player, points })} />}
            {tab === "places" && <PlacesTab kiosks={st?.kiosks || []} moveK={moveK} setMoveK={setMoveK} setPick={setPick} />}
            {tab === "markers" && <MarkersTab markers={st?.markers || []} draft={markDraft} setDraft={setMarkDraft} setPick={setPick} act={act} />}
            {tab === "chat" && <ChatTab chat={chat} meta={chatMeta} mine={mine} setMine={setMine} act={act} />}
            {tab === "log" && <LogTab log={log} />}
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
function PlayersTab({ players, selP, setSelP, selPlayer, act, setPick, safehouses, cars, trailPts, setTrailPts }) {
  const [q, setQ] = useState("");
  const list = players.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {selPlayer && <PlayerCard onClose={() => setSelP(null)} p={selPlayer} act={act} setPick={setPick} players={players} safehouses={safehouses} cars={cars}
        trailPts={trailPts} setTrailPts={setTrailPts} />}
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

function PlayerCard({ p, act, setPick, players, safehouses, cars, trailPts, setTrailPts, onClose }) {
  const [to, setTo] = useState("");
  const [item, setItem] = useState("");
  const [n, setN] = useState(1);
  const [res, setRes] = useState([]);
  const [msg, setMsg] = useState("");
  const [reason, setReason] = useState("");
  const tRef = useRef(null);
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
      <div style={row}><Btn small onClick={() => flyTo(p.x, p.y, 2)}>Show</Btn><Btn small onClick={() => setPick({ mode: "teleport" })}>Teleport to a spot</Btn></div>
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
  const labelOf = (id) => (sheet?.allTraits || []).find((t) => t.id === id)?.label || id;
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
        <div style={{ display: "flex", gap: 6 }}>
          <select style={inp} value={addT} onChange={(e) => setAddT(e.target.value)}>
            <option value="">Add a trait...</option>
            {(sheet.allTraits || []).filter((t) => !(sheet.traits || []).includes(t.id)).sort((a, b) => a.label.localeCompare(b.label))
              .map((t) => <option key={t.id} value={t.id}>{t.label} ({t.cost > 0 ? "+" : ""}{t.cost})</option>)}
          </select>
          <Btn small disabled={!addT} onClick={() => act("pl_trait", { player: p.name, trait: addT, on: true, notify }, () => { setAddT(""); reload(); })}>Add</Btn>
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
          <Btn small onClick={() => act("veh_repair", { vid: c.id })}>Repair</Btn>
          <Btn small onClick={() => act("veh_flip", { vid: c.id })}>Flip</Btn>
        </div>
      ))}
      <Btn small onClick={() => act("veh_flip", { player: p.name })}>Flip the car next to them</Btn>
      <div style={{ display: "flex", gap: 6 }}>
        <input style={inp} list="ops-veh" placeholder="Spawn a car next to them: Base.CarNormal" value={veh}
          onFocus={async () => { if (!scripts.length) try { setScripts((await api("/api/admin/ops/vehicle-scripts")).scripts || []); } catch {} }}
          onChange={(e) => setVeh(e.target.value)} />
        <datalist id="ops-veh">{scripts.map((v) => <option key={v} value={v} />)}</datalist>
        <Btn small disabled={!/^\w+\.[\w-]+$/.test(veh.trim())} onClick={() => { if (confirm(`Spawn ${veh.trim()} next to ${p.name}?`)) act("veh_spawn", { player: p.name, script: veh.trim() }, () => setVeh("")); }}>Spawn</Btn>
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

// ── shops and bus stations: move them on the map ───────────────────────────
function PlacesTab({ kiosks, moveK, setMoveK, setPick }) {
  const [q, setQ] = useState("");
  const list = kiosks.filter((k) => (k.name + " " + k.id).toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.kind.localeCompare(b.kind) || String(a.name).localeCompare(String(b.name)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ ...mono, fontSize: 11, color: C.grey }}>Shops and bus stations where they stand now. Moving one is the same as moving it from the in-game panel.</div>
      {moveK && <div style={{ ...mono, fontSize: 12, color: C.gold }}>Moving {moveK.name}: click its new spot on the map. <a style={{ color: C.grey, cursor: "pointer" }} onClick={() => { setMoveK(null); setPick(null); }}>cancel</a></div>}
      <input style={inp} placeholder="Find a shop or station" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 && <div style={{ ...mono, fontSize: 12, color: C.grey }}>None reported yet (needs mod 1.7.115).</div>}
      {list.map((k) => (
        <div key={k.kind + k.id} style={{ ...mono, fontSize: 12, display: "flex", gap: 6, alignItems: "center", padding: "6px 8px", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 3 }}>
          <span style={{ color: k.kind === "bus" ? C.blue : C.gold }}>{k.kind === "bus" ? "BUS" : "SHOP"}</span>
          <a style={{ flex: 1, cursor: "pointer", opacity: k.off ? 0.5 : 1 }} onClick={() => flyTo(k.x, k.y, 1)}>{k.name}{k.off ? " (destroyed)" : ""} <span style={{ color: C.grey, fontSize: 11 }}>{k.x}, {k.y}</span></a>
          <Btn small onClick={() => { setMoveK({ kind: k.kind, id: k.id, name: k.name }); setPick({ mode: "move" }); }}>Move</Btn>
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
function MarkersTab({ markers, draft, setDraft, setPick, act }) {
  const [kind, setKind] = useState("go");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [hours, setHours] = useState(0);
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
        <div style={{ ...mono, fontSize: 11, color: C.grey }}>Every player sees it on their map (M) and minimap, with the title next to it. A note pops over their head when it goes up.</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <Btn small onClick={() => setPick({ mode: "marker" })}>{draft ? "Move the spot" : "Pick the spot on the map"}</Btn>
          {draft && <span style={{ ...mono, fontSize: 12 }}>{draft.x}, {draft.y}</span>}
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
          <Btn small disabled={!draft || !title.trim()} onClick={() => act("mk_add", { x: draft.x, y: draft.y, kind, title: title.trim(), text: text.trim(), hours },
            () => { setDraft(null); setTitle(""); setText(""); })}>Place marker</Btn>
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
          <div style={{ color: C.grey, fontSize: 11 }}>{(MARK[m.kind] || MARK.go).label} · {m.x}, {m.y} · {left(m)}{m.by ? ` · by ${String(m.by).replace(" (website)", "")}` : ""}</div>
          {m.text ? <div style={{ fontSize: 11 }}>{m.text}</div> : null}
        </div>
      ))}
      {markers.length > 1 && <Btn small color={C.red} onClick={() => { if (confirm("Remove ALL markers from everyone's map?")) act("mk_clear", {}); }}>Remove all</Btn>}
    </div>
  );
}

// ── factions ────────────────────────────────────────────────────────────────
function FactionsTab({ facs, selF, setSelF, act, players, refresh, claimDraft, setClaimDraft, setPick }) {
  const [q, setQ] = useState("");
  const list = (facs.factions || []).filter((f) => (f.name + " " + f.tag + " " + f.members.join(" ")).toLowerCase().includes(q.toLowerCase()));
  const f = (facs.factions || []).find((x) => x.fid === selF) || null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {f && <FactionCard onClose={() => { setSelF(null); setClaimDraft(null); }} f={f} facs={facs} act={act} players={players} refresh={refresh} claimDraft={claimDraft} setClaimDraft={setClaimDraft} setPick={setPick} />}
      <input style={inp} placeholder="Find a faction or member" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 && <div style={{ ...mono, fontSize: 12, color: C.grey }}>No factions.</div>}
      {list.map((x) => (
        <button key={x.fid} onClick={() => { setSelF(x.fid); setClaimDraft(null); if (x.claim?.x) flyTo(x.claim.x, x.claim.y, 1); }}
          style={{ ...mono, fontSize: 12, textAlign: "left", padding: "7px 9px", background: x.fid === selF ? "#1a1424" : C.bg, color: C.text,
            border: `1px solid ${x.fid === selF ? C.purple : C.line}`, borderRadius: 3, cursor: "pointer" }}>
          <div style={{ display: "flex", gap: 8 }}><span style={{ flex: 1 }}>{x.name}{x.tag ? ` [${x.tag}]` : ""}</span><span style={{ color: C.grey }}>{x.members.length}</span></div>
          <div style={{ color: C.grey, fontSize: 11 }}>led by {x.owner || "?"}{x.claim?.x ? ` · ${facs.tiers?.[x.claim.tier] || "claim"} at ${x.claim.x}, ${x.claim.y}` : " · no claim"}</div>
        </button>
      ))}
    </div>
  );
}

function FactionCard({ f, facs, act, players, refresh, claimDraft, setClaimDraft, setPick, onClose }) {
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
      {!d ? <div style={{ ...mono, fontSize: 12, color: C.grey }}>No claim.</div> : (
        <div style={{ ...mono, fontSize: 12 }}>{facs.tiers?.[d.tier] || "Tier " + d.tier} at {d.cx}, {d.cy} ({2 * (facs.radii?.[d.tier] ?? 10) + 1} x {2 * (facs.radii?.[d.tier] ?? 10) + 1})</div>
      )}
      <div style={row}>
        {[1, 2, 3].map((t) => (
          <Btn key={t} small color={d?.tier === t ? C.gold : C.grey} disabled={!d} onClick={() => setClaimDraft({ ...(d || {}), tier: t })}>{facs.tiers?.[t] || "Tier " + t}</Btn>
        ))}
      </div>
      <div style={row}>
        <Btn small onClick={() => setPick({ mode: "claim" })}>{c.x ? "Move on map" : "Place on map"}</Btn>
        <Btn small disabled={!changed} onClick={() => act("fa_claim_set", { fid: f.fid, cx: d.cx, cy: d.cy, tier: d.tier }, () => { setClaimDraft(null); done(); })}>Save claim</Btn>
        {changed && <Btn small color={C.grey} onClick={() => setClaimDraft(null)}>Undo</Btn>}
        <span style={{ flex: 1 }} />
        {c.x ? <Btn small color={C.red} onClick={() => { if (confirm(`Remove ${f.name}'s claim? Its safehouse goes within a minute.`)) act("fa_claim_remove", { fid: f.fid }, done); }}>Remove</Btn> : null}
      </div>
      <div style={{ ...mono, fontSize: 11, color: C.grey }}>Admin claims are free. The game makes the safehouse within a minute and refuses one that overlaps another safehouse.</div>
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
