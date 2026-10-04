// @ts-nocheck
"use client";
// app/ops/page.tsx - Live Ops: the admins' live control panel (2026-10-04). The world map with everything the game
// reports (players, safehouses, zombie heat, bandits, claimed vehicles) and the tools to fix things without logging in:
// teleport, give, message, kick, ban, safehouse edit / owner / members / delete / create, broadcast, chat feed.
// Backend: /api/admin/ops/* (routers/liveops.py); the game side is mod 1.7.111 ZO_Server.lua. Admins only.
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flyTo } from "@/components/WorldMap";
import { API } from "@/lib/constants";

const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

const C = { gold: "#c8a84b", blue: "#4a8fc4", green: "#4caf7d", red: "#e05555", purple: "#9775cc", grey: "#9aa", text: "#e6e6e6", bg: "#0b0d10", panel: "#111418", line: "#2a2f37" };
const mono = { fontFamily: "var(--mono, monospace)" };
const LAYERS = [
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
  const [layers, setLayers] = useState({ players: true, safehouses: true, zombies: true, bandits: true, vehicles: false });
  const [tab, setTab] = useState("players");
  const [selP, setSelP] = useState(null);         // player name
  const [selS, setSelS] = useState(null);         // safehouse key "x,y,owner"
  const [draft, setDraft] = useState(null);       // { x, y, w, h } the safehouse box being edited / created
  const [pick, setPick] = useState(null);         // { mode: "teleport" | "corners", first?: {x,y} }
  const [toasts, setToasts] = useState([]);
  const [chat, setChat] = useState([]);
  const [log, setLog] = useState([]);

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
    if (tab !== "chat" && tab !== "log") return;
    let stop = false, timer = null;
    const tick = async () => {
      try {
        if (tab === "chat") setChat((await api("/api/admin/ops/chat")).lines || []);
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
    if (layers.vehicles) (st?.vehicles || []).forEach((v) => out.push({ id: "v:" + v.id, label: "", x: v.x, y: v.y, size: 8, color: "#cfd3da",
      onClick: () => toast(true, `${v.owner}'s ${String(v.model).replace(/^Base\./, "")} at ${v.x}, ${v.y}`) }));
    return out;
  }, [st, layers, selP, toast]);
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
        onClick: () => { setSelS(k); setDraft(null); setTab("safehouses"); } });
    }
    if (draft) out.push({ id: "draft", x: draft.x, y: draft.y, w: draft.w, h: draft.h, color: "#fff", dashed: true, fill: "rgba(255,255,255,.08)",
      label: `${draft.w} x ${draft.h}` });
    return out;
  }, [st, layers, safehouses, selS, draft]);

  // map clicks: pick a teleport spot, or two corners of a safehouse box
  const onMapClick = useCallback((w) => {
    if (!pick) return;
    if (pick.mode === "teleport") {
      if (selP && confirm(`Teleport ${selP} to ${w.x}, ${w.y}?`)) act("teleport", { player: selP, tx: w.x, ty: w.y, tz: 0 });
      setPick(null);
    } else if (pick.mode === "corners") {
      if (!pick.first) { setPick({ ...pick, first: w }); setDraft({ x: w.x, y: w.y, w: 1, h: 1 }); return; }
      const x = Math.min(pick.first.x, w.x), y = Math.min(pick.first.y, w.y);
      setDraft({ x, y, w: Math.abs(w.x - pick.first.x) + 1, h: Math.abs(w.y - pick.first.y) + 1 });
      setPick(null);
    }
  }, [pick, selP, act]);

  // fill the space under the site menu
  const [top, setTop] = useState(0);
  useEffect(() => {
    const m = () => { const nav = document.querySelector("body > nav, body > header, nav"); setTop(nav ? Math.round(nav.getBoundingClientRect().bottom) : 0); };
    m(); window.addEventListener("resize", m); const t = setTimeout(m, 300);
    return () => { window.removeEventListener("resize", m); clearTimeout(t); };
  }, []);

  const clock = st?.game ? `${String(st.game.hour).padStart(2, "0")}:${String(st.game.minute).padStart(2, "0")}` : "";
  return (
    <div style={{ position: "fixed", top, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", background: C.bg, color: C.text }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
        <span style={{ font: "400 22px 'Bebas Neue',sans-serif", letterSpacing: 2 }}>LIVE OPS</span>
        {LAYERS.map((l) => (
          <button key={l.id} onClick={() => setLayers((x) => ({ ...x, [l.id]: !x[l.id] }))}
            style={{ ...mono, fontSize: 11, padding: "4px 9px", borderRadius: 3, cursor: "pointer", background: layers[l.id] ? "#1a1e24" : "transparent",
              color: layers[l.id] ? C.text : "#666", border: `1px solid ${layers[l.id] ? l.color : C.line}` }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: l.color, marginRight: 6, opacity: layers[l.id] ? 1 : 0.3 }} />{l.label}
          </button>
        ))}
        <span style={{ ...mono, fontSize: 11, color: C.grey, marginLeft: "auto" }}>
          {st ? `${players.length} online${clock ? ` · in game ${clock}` : ""} · ${st.zombies?.total ?? 0} zombies loaded · ${(st.bandits || []).length} bandits` : ""}
          {st?.world_stale ? " · world data paused (nobody online or mod older than 1.7.111)" : ""}
        </span>
      </div>
      {pick && (
        <div style={{ ...mono, fontSize: 12, padding: "6px 14px", background: "#2a2410", color: C.gold, display: "flex", gap: 12, alignItems: "center" }}>
          {pick.mode === "teleport" ? `Click the spot on the map to teleport ${selP} to.` : pick.first ? "Now click the opposite corner." : "Click one corner of the safehouse on the map."}
          <Btn small onClick={() => { setPick(null); }}>Cancel</Btn>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", cursor: pick ? "crosshair" : "default" }}>
          {err ? <div style={{ ...mono, padding: 30, color: C.red }}>{err}</div> :
            <WorldMap dots={dots} rects={rects} onMapClick={onMapClick} />}
        </div>
        <aside style={{ width: 380, maxWidth: "45vw", borderLeft: `1px solid ${C.line}`, display: "flex", flexDirection: "column", background: C.panel }}>
          <div style={{ display: "flex", borderBottom: `1px solid ${C.line}` }}>
            {[["players", `Players (${players.length})`], ["safehouses", `Safehouses (${safehouses.length})`], ["chat", "Chat"], ["log", "Log"]].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={{ ...mono, flex: 1, fontSize: 11, padding: "9px 4px", background: tab === k ? C.bg : "transparent",
                color: tab === k ? C.gold : C.grey, border: 0, borderBottom: tab === k ? `2px solid ${C.gold}` : "2px solid transparent", cursor: "pointer", textTransform: "uppercase" }}>{l}</button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            {tab === "players" && <PlayersTab players={players} selP={selP} setSelP={setSelP} selPlayer={selPlayer} act={act} setPick={setPick} safehouses={safehouses} />}
            {tab === "safehouses" && <SafehousesTab safehouses={safehouses} selected={selected} setSelS={setSelS} shKey={shKey} draft={draft} setDraft={setDraft}
              setPick={setPick} act={act} players={players} />}
            {tab === "chat" && <ChatTab chat={chat} act={act} />}
            {tab === "log" && <LogTab log={log} />}
          </div>
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
function PlayersTab({ players, selP, setSelP, selPlayer, act, setPick, safehouses }) {
  const [q, setQ] = useState("");
  const list = players.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {selPlayer && <PlayerCard p={selPlayer} act={act} setPick={setPick} players={players} safehouses={safehouses} />}
      <input style={inp} placeholder="Find a player" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 && <div style={{ ...mono, fontSize: 12, color: C.grey }}>Nobody online.</div>}
      {list.map((p) => (
        <button key={p.name} onClick={() => { setSelP(p.name); flyTo(p.x, p.y, 1); }}
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

function PlayerCard({ p, act, setPick, players, safehouses }) {
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
        <input style={{ ...inp, width: 60 }} type="number" min={1} max={100} value={n} onChange={(e) => setN(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} />
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
      <div style={h}>Kick / ban</div>
      <div style={row}>
        <input style={inp} placeholder="Reason (needed for a ban)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} />
        <Btn small color={C.red} onClick={() => { if (confirm(`Kick ${p.name}?`)) act("kick", { player: p.name, reason }); }}>Kick</Btn>
        <Btn small color={C.red} disabled={!reason.trim()} onClick={() => { if (confirm(`BAN ${p.name}? Reason: ${reason}`)) act("ban", { player: p.name, reason }); }}>Ban</Btn>
      </div>
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
        onGone={() => { setSelS(null); setDraft(null); }} onMoved={(k) => setSelS(k)} />}
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

function SafehouseCard({ s, draft, setDraft, setPick, act, players, onGone, onMoved }) {
  const [who, setWho] = useState("");
  const d = draft || { x: s.x, y: s.y, w: s.w, h: s.h };
  const changed = draft && (draft.x !== s.x || draft.y !== s.y || draft.w !== s.w || draft.h !== s.h);
  const id = { x: s.x, y: s.y, owner: s.owner };
  const h = { ...mono, fontSize: 10, color: C.grey, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 };
  const row = { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" };
  return (
    <div style={{ border: `1px solid ${C.gold}`, borderRadius: 3, padding: 10, display: "flex", flexDirection: "column", gap: 8, background: "#15130c" }}>
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
function ChatTab({ chat, act }) {
  const [text, setText] = useState("");
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [chat.length]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ ...mono, fontSize: 10, color: C.grey, textTransform: "uppercase", letterSpacing: 1 }}>General chat (refreshes every 5 s)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {chat.length === 0 && <div style={{ ...mono, fontSize: 12, color: C.grey }}>Nothing said yet in this log.</div>}
        {chat.map((l, i) => (
          <div key={i} style={{ ...mono, fontSize: 12 }}><span style={{ color: "#666" }}>{String(l.at).slice(9, 14)} </span><b style={{ color: C.gold }}>{l.author}</b> {l.text}</div>
        ))}
        <div ref={end} />
      </div>
      <div style={{ ...mono, fontSize: 10, color: C.grey, textTransform: "uppercase", letterSpacing: 1, marginTop: 8 }}>Server message (everyone sees it)</div>
      <div style={{ display: "flex", gap: 6 }}>
        <input style={inp} value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Restart in 10 minutes"
          onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) act("broadcast", { text }, () => setText("")); }} />
        <Btn small disabled={!text.trim()} onClick={() => act("broadcast", { text }, () => setText(""))}>Send</Btn>
      </div>
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
