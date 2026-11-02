// @ts-nocheck
"use client";
// components/perf/PerfApp.tsx - the staff health page (/performance, admins only, 2026-11-01).
// Everything comes from the bot's /api/admin/perf/* (zombita_perf.py, a cron job outside the game, plus zombita_perf_staff.py);
// the live number from /api/admin/server-health/live every 5 s. Nothing here can touch the game: the only writes are the
// prompt library, "seen" on changes, and saved reports.
// Times are UTC, the same as the game's logs. 600 ticks a minute = full speed, normal 540-590, under 500 is weak.
// One axis a chart: ticks, players and the rest are stacked charts on the same clock, never two scales on one chart.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API } from "@/lib/constants";

const C = {
  card: "#0d1117", inner: "#0a0d12", line: "#1e2530", grid: "#1a2029", text: "#c8cdd6", bright: "#e6e8ec", muted: "#8a8f98", dim: "#5d636c",
  gold: "#c8a84b", red: "#e05555", green: "#4caf7d", amber: "#d08c2c", blue: "#4a8fc4",
  dayA: "#ad8f3a", dayB: "#4a8fc4",
};
const DISPLAY = "'Bebas Neue', sans-serif";
const MONO = "'Share Tech Mono', monospace";
const BODY = "'Inter', -apple-system, sans-serif";
const LEVEL = {
  good: { color: C.green, icon: "●", word: "Healthy" }, warn: { color: C.amber, icon: "▲", word: "Struggling" },
  bad: { color: C.red, icon: "■", word: "Bad" }, empty: { color: C.muted, icon: "○", word: "Empty" }, unknown: { color: C.muted, icon: "?", word: "No data" },
};
const tpmLevel = (v) => (v == null ? "unknown" : v >= 500 ? "good" : v >= 350 ? "warn" : "bad");
const TABS = [["now", "Now"], ["days", "Days"], ["compare", "Compare"], ["issues", "Issues"], ["changes", "Changes"], ["logs", "Logs"], ["prompts", "Prompts"], ["reports", "Reports"]];
const MARK_COLOR = { restart: C.bright, stopped: C.red, version: C.gold, workshop: C.gold, settings: C.amber, raid: C.red, event: C.red };
const MARK_WORD = { restart: "Restart", stopped: "Stopped", version: "Version", workshop: "Workshop", settings: "Settings", raid: "Raid", event: "Event" };

const utcHM = (ts) => (ts ? new Date(ts * 1000).toISOString().slice(11, 16) : "?");
const utcDayHM = (ts) => (ts ? new Date(ts * 1000).toISOString().slice(5, 16).replace("T", " ") : "?");
const today = () => new Date().toISOString().slice(10 - 10, 10);
const dayBefore = (d) => new Date(Date.parse(d + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
const gb = (mb) => (mb == null ? "?" : `${(mb / 1024).toFixed(1)} GB`);
const num = (v) => (v == null ? "?" : v);
function ago(ts, now) {
  if (!ts) return "never";
  const s = Math.max(0, Math.round(now - ts));
  if (s < 90) return `${s} s ago`;
  const m = Math.round(s / 60);
  return m < 90 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`;
}
const size = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`);

async function get(path) {
  const r = await fetch(`${API}${path}`, { credentials: "include", cache: "no-store" });
  if (!r.ok) { const e = new Error("http " + r.status); e.status = r.status; throw e; }
  return r.json();
}
async function post(path, body = {}) {
  const r = await fetch(`${API}${path}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) { const e = new Error("http " + r.status); e.status = r.status; throw e; }
  return r.json();
}
function useLoad(fn, deps, everyMs = 0) {
  const [state, set] = useState({ data: null, err: null, loading: true });
  const reload = useCallback(() => fn().then((data) => set({ data, err: null, loading: false })).catch((err) => set((s) => ({ ...s, err, loading: false }))), deps);
  useEffect(() => {
    set((s) => ({ ...s, loading: true }));
    reload();
    if (!everyMs) return undefined;
    const t = setInterval(reload, everyMs);
    return () => clearInterval(t);
  }, [reload, everyMs]);
  return { ...state, reload };
}
function copyText(text) { try { navigator.clipboard.writeText(text); } catch {} }

// ── small pieces ─────────────────────────────────────────────────────────────

function Card({ title, right = null, children }) {
  return (
    <section style={{ background: C.card, border: `1px solid ${C.line}`, padding: "14px 16px", minWidth: 0 }}>
      {(title || right) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <h2 style={{ fontFamily: DISPLAY, fontSize: 20, letterSpacing: 2, color: C.gold, margin: 0 }}>{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}
function Stat({ label, value, sub = null, color = C.bright, big = false }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: C.muted }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: big ? 44 : 22, color, lineHeight: 1.15 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted }}>{sub}</div>}
    </div>
  );
}
function Pill({ level, text }) {
  const L = LEVEL[level] || LEVEL.unknown;
  return <span style={{ fontFamily: MONO, fontSize: 12, color: L.color, border: `1px solid ${L.color}55`, padding: "1px 7px", whiteSpace: "nowrap" }}>{L.icon} {text}</span>;
}
function Btn({ children, onClick, primary = false, disabled = false, danger = false }) {
  const col = danger ? C.red : primary ? C.gold : C.muted;
  return (
    <button onClick={onClick} disabled={disabled} style={{ fontFamily: MONO, fontSize: 12, padding: "5px 11px", background: primary ? "rgba(200,168,75,0.1)" : "transparent", border: `1px solid ${col}`, color: col, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}>{children}</button>
  );
}
const SIDE = { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" };
const SIDE_L = { flex: "1 1 280px", minWidth: 0, maxWidth: "100%" };
const SIDE_R = { flex: "3 1 460px", minWidth: 0, maxWidth: "100%" };
const inputStyle = { background: C.inner, border: `1px solid ${C.line}`, color: C.text, padding: "5px 8px", fontFamily: MONO, fontSize: 12, maxWidth: "100%", boxSizing: "border-box" };
function DayPick({ value, onChange, days, label = null }) {
  return (
    <label style={{ fontFamily: MONO, fontSize: 12, color: C.muted, display: "inline-flex", gap: 6, alignItems: "center" }}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
        {!days.includes(value) && <option value={value}>{value}</option>}
        {days.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
    </label>
  );
}
function Table({ head, rows, align = [] }) {
  const cell = (i) => ({ padding: "4px 8px", textAlign: align[i] || (i ? "right" : "left"), borderBottom: `1px solid ${C.grid}`, whiteSpace: "nowrap" });
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontFamily: MONO, fontSize: 12, color: C.text }}>
        <thead><tr>{head.map((h, i) => <th key={i} style={{ ...cell(i), color: C.muted, fontWeight: 400 }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, j) => <tr key={j} onClick={r.onClick} style={{ cursor: r.onClick ? "pointer" : "default", background: r.active ? "rgba(200,168,75,0.07)" : "none" }}>{(r.cells || r).map((c, i) => <td key={i} style={cell(i)}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
function Note({ children, color = C.muted }) { return <div style={{ fontSize: 13, color, lineHeight: 1.5 }}>{children}</div>; }
function Failed({ err, what }) {
  if (!err) return null;
  if (err.status === 401 || err.status === 403) return <Note color={C.red}>Log in with an admin account to see {what}.</Note>;
  return <Note color={C.red}>Can't load {what} right now. The bot's Performance install may not be in yet.</Note>;
}

// ── charts ───────────────────────────────────────────────────────────────────

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(800);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === "undefined") return undefined;
    const o = new ResizeObserver((e) => setW(Math.max(280, e[0].contentRect.width)));
    o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  return [ref, w];
}

// series: [{ name, color, points: [[x, value], ...] }]. One y scale. A hole longer than 5 minutes breaks the line.
function LineChart({ series, x0, x1, height = 170, yMin = 0, yMax = null, lines = [], marks = [], unit = "", fmtX = utcHM, title = "" }) {
  const [ref, W] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { l: 40, r: 10, t: 8, b: 20 };
  const H = height;
  const all = series.flatMap((s) => s.points.map((p) => p[1])).filter((v) => v != null);
  const top = yMax ?? Math.max(1, ...(all.length ? all : [1])) * 1.1;
  const X = (x) => pad.l + ((x - x0) / Math.max(1, x1 - x0)) * (W - pad.l - pad.r);
  const Y = (v) => pad.t + (1 - (v - yMin) / Math.max(1e-9, top - yMin)) * (H - pad.t - pad.b);
  const path = (pts) => {
    let d = "", prev = null;
    for (const [x, v] of pts) {
      if (v == null) continue;
      d += `${prev == null || x - prev > 300 ? "M" : "L"}${X(x).toFixed(1)},${Y(v).toFixed(1)}`;
      prev = x;
    }
    return d;
  };
  const ticks = [0, 1, 2, 3, 4].map((i) => yMin + ((top - yMin) * i) / 4);
  const xCount = W < 500 ? 4 : 7;
  const xTicks = Array.from({ length: xCount }, (_, i) => x0 + ((x1 - x0) * i) / (xCount - 1));
  const onMove = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = x0 + ((e.clientX - box.left - pad.l) / (W - pad.l - pad.r)) * (x1 - x0);
    const rows = series.map((s) => {
      let best = null;
      for (const p of s.points) if (p[1] != null && (!best || Math.abs(p[0] - x) < Math.abs(best[0] - x))) best = p;
      return { name: s.name, color: s.color, p: best && Math.abs(best[0] - x) < 600 ? best : null };
    });
    const at = rows.find((r) => r.p)?.p?.[0];
    setHover(at == null ? null : { x: at, rows, mark: marks.find((m) => Math.abs(m.at - x) < (x1 - x0) / 120) });
  };
  return (
    <div ref={ref} style={{ position: "relative", width: "100%", minWidth: 0, overflow: "hidden" }}>
      {title && <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, marginBottom: 2 }}>{title}</div>}
      <svg width={W} height={H} style={{ display: "block", touchAction: "pan-y" }} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={title}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(t)} y2={Y(t)} stroke={C.grid} />
            <text x={pad.l - 6} y={Y(t) + 4} textAnchor="end" fontSize="10" fill={C.dim} fontFamily={MONO}>{Math.round(t)}</text>
          </g>
        ))}
        {xTicks.map((t, i) => <text key={i} x={X(t)} y={H - 6} textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"} fontSize="10" fill={C.dim} fontFamily={MONO}>{fmtX(t)}</text>)}
        {lines.map((l, i) => <line key={i} x1={pad.l} x2={W - pad.r} y1={Y(l.v)} y2={Y(l.v)} stroke={l.color} strokeDasharray="4 4" strokeOpacity="0.6" />)}
        {marks.filter((m) => m.at >= x0 && m.at <= x1).map((m, i) => <line key={i} x1={X(m.at)} x2={X(m.at)} y1={pad.t} y2={H - pad.b} stroke={MARK_COLOR[m.k] || C.muted} strokeOpacity="0.55" strokeDasharray="2 3" />)}
        {series.map((s, i) => <path key={i} d={path(s.points)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />)}
        {hover && <line x1={X(hover.x)} x2={X(hover.x)} y1={pad.t} y2={H - pad.b} stroke={C.muted} />}
        {hover && hover.rows.map((r, i) => r.p && <circle key={i} cx={X(r.p[0])} cy={Y(r.p[1])} r="4" fill={r.color} stroke={C.card} strokeWidth="2" />)}
      </svg>
      {hover && (
        <div style={{ position: "absolute", top: 12, left: X(hover.x) > W / 2 ? X(hover.x) - 196 : X(hover.x) + 12, width: 184, background: "#11161d", border: `1px solid ${C.line}`, padding: "6px 8px", fontFamily: MONO, fontSize: 12, pointerEvents: "none", zIndex: 5 }}>
          <div style={{ color: C.muted, fontSize: 11 }}>{fmtX(hover.x)} UTC</div>
          {hover.rows.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ width: 10, height: 2, background: r.color, display: "inline-block" }} />
              <b style={{ color: C.bright, fontWeight: 400 }}>{r.p ? r.p[1] : "?"}{unit}</b>
              <span style={{ color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
            </div>
          ))}
          {hover.mark && <div style={{ color: C.text, fontSize: 11, marginTop: 3, whiteSpace: "normal" }}>{hover.mark.text}</div>}
        </div>
      )}
    </div>
  );
}
function Legend({ items }) {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontFamily: MONO, fontSize: 12, color: C.text, marginBottom: 4 }}>
      {items.map((s, i) => <span key={i}><span style={{ display: "inline-block", width: 14, height: 2, background: s.color, verticalAlign: "middle", marginRight: 5 }} />{s.name}</span>)}
    </div>
  );
}
function cols(view) {
  const out = {};
  (view?.cols || []).forEach((c, i) => { out[c] = i; });
  return out;
}
const pick = (view, name) => { const k = cols(view)[name]; return (view?.rows || []).map((r) => [r[0], r[k] ?? null]); };

// the same clock for every chart on a tab
function ChartStack({ view, x0, x1, marks }) {
  const [table, setTable] = useState(false);
  const loaded = pick(view, "z").some((p) => p[1] != null);
  const box = pick(view, "load").some((p) => p[1] != null);
  const common = { x0, x1, marks };
  if (!view?.rows?.length) return <Note>No minutes here yet.</Note>;
  if (table) {
    const c = cols(view);
    const rows = view.rows.slice(-300).reverse().map((r) => [utcDayHM(r[0]), num(r[c.tpm]), num(r[c.pl]), num(r[c.lua]), num(r[c.z]), num(r[c.busy]), num(r[c.drop]), num(r[c.load]), num(r[c.gcpu]), num(r[c.main])]);
    return <><Btn onClick={() => setTable(false)}>Show graphs</Btn><div style={{ marginTop: 8, maxHeight: 420, overflow: "auto" }}><Table head={["UTC", "Ticks", "Players", "Lua ms", "Zombies", "Busy", "Dropped", "Load", "Game CPU %", "Main %"]} rows={rows} /></div></>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 10 }}>
      <LineChart {...common} title="Ticks a minute. Dashed line = 500, under it is weak" series={[{ name: "Ticks", color: C.dayA, points: pick(view, "tpm") }]} yMax={640} lines={[{ v: 500, color: C.amber }]} />
      <LineChart {...common} title="Players online" height={90} series={[{ name: "Players", color: C.blue, points: pick(view, "pl") }]} />
      {loaded && <LineChart {...common} title="Zombies loaded" height={90} series={[{ name: "Zombies", color: C.dayA, points: pick(view, "z") }]} />}
      {box && <LineChart {...common} title="Box load" height={80} series={[{ name: "Load", color: C.blue, points: pick(view, "load") }]} />}
      <div><Btn onClick={() => setTable(true)}>Show as a table</Btn></div>
    </div>
  );
}
function MarkList({ marks }) {
  if (!marks?.length) return <Note>Nothing marked.</Note>;
  return (
    <div style={{ fontSize: 13, display: "grid", gap: 3 }}>
      {marks.map((m, i) => (
        <div key={i}><span style={{ fontFamily: MONO, color: C.muted }}>{utcDayHM(m.at)}</span> <span style={{ fontFamily: MONO, color: MARK_COLOR[m.k] || C.muted }}>{MARK_WORD[m.k] || m.k}</span> {m.text}</div>
      ))}
    </div>
  );
}
function Handlers({ row }) {
  if (!row?.top?.length) return <Note>No measured minute yet. Handlers are timed 1 minute in 5.</Note>;
  return (
    <>
      <Note>Measured at {utcDayHM(row.at)} UTC: {num(row.lua)} ms in Lua that minute, {num(row.tpm)} ticks, {num(row.pl)} players.</Note>
      <div style={{ marginTop: 6 }}><Table head={["Handler", "ms", "Calls"]} align={["left"]} rows={row.top.map((e) => [`${e.ev}  ${e.where}`, e.ms, e.n])} /></div>
    </>
  );
}

// ── Now ──────────────────────────────────────────────────────────────────────

function NowTab({ perf }) {
  const live = useLoad(() => get("/api/admin/server-health/live?minutes=10"), [], 5000);
  const health = useLoad(() => get("/api/admin/server-health?hours=1"), [], 60000);
  const d = perf.data;
  const r = d?.latest;
  const L = live.data?.live;
  const v = live.data?.verdict;
  const clock = Date.now() / 1000;
  const tpm = L?.state === "live" ? L.tpm60 : r?.tpm;
  const h = health.data;
  const x1 = d?.at || clock;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 12 }}>
      <Card>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Stat big label="Ticks a minute" value={num(tpm)} color={LEVEL[tpmLevel(tpm)].color} sub={L?.state === "live" ? `live, last 60 s, ${L.age} s ago` : r ? `minute at ${utcHM(r.at)} UTC` : null} />
          <Stat big label="Players" value={num(L?.players ?? r?.pl)} />
          <div style={{ flex: "1 1 220px" }}>
            {v && <Pill level={v.level} text={v.text} />}
            <Note>{v?.why}</Note>
          </div>
        </div>
      </Card>
      <Card title="LOADED ON THE SERVER" right={<span style={{ fontFamily: MONO, fontSize: 11, color: C.dim }}>{r ? `${utcHM(r.at)} UTC` : ""}</span>}>
        {d?.loaded_line ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 12 }}>
            <Stat label="Zombies" value={num(r?.z)} /><Stat label="Cars" value={num(r?.v)} /><Stat label="Animals" value={num(r?.a)} />
            <Stat label="Zombies within 30" value={num(r?.n30)} /><Stat label="Within 60" value={num(r?.n60)} />
          </div>
        ) : <Note>These come with mod 1.8.88. Until that's running this stays empty.</Note>}
      </Card>
      <Card title="THE BOX">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12 }}>
          <Stat label="Load" value={num(r?.load)} sub={d?.cpus ? `${d.cpus} CPU threads` : null} />
          <Stat label="RAM used" value={gb(r?.mem)} sub={r?.mem_total ? `of ${gb(r.mem_total)}` : null} />
          <Stat label="Game CPU" value={r?.gcpu != null ? `${(r.gcpu / 100).toFixed(1)} cores` : "?"} />
          <Stat label="Main thread" value={r?.main != null ? `${r.main}%` : "?"} />
          <Stat label="Game memory" value={gb(r?.grss)} />
          <Stat label="CPU heat" value={r?.temp != null ? `${r.temp} C` : "?"} color={(r?.temp || 0) >= 90 ? C.red : C.bright} />
        </div>
      </Card>
      <Card title="LAST 2 HOURS">
        <Failed err={perf.err} what="the numbers" />
        <ChartStack view={d} x0={x1 - 7200} x1={x1} marks={d?.markers || []} />
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 12 }}>
        <Card title="TOP LUA HANDLERS"><Handlers row={d?.latest_timed} /></Card>
        <Card title="MARKERS"><MarkList marks={(d?.markers || []).slice(-10).reverse()} /></Card>
        <Card title="FREEZES AND JOBS">
          <Note>Too busy, last hour: {h ? h.busy.last60.bursts : "?"} times, {h ? h.busy.last60.dropped : "?"} packets dropped.</Note>
          <Note>Freeze watchdog: {h?.freeze?.installed ? (h.freeze.mode || "no word yet") : "not found"}.{h?.freeze?.stalls?.length ? ` Last stall ${utcDayHM(h.freeze.stalls[0].at)} UTC.` : ""}</Note>
          <Note>Horde Night: {h?.dotd?.phase || "not running"}.</Note>
          <Note>3D map job: {h?.map3d?.mode || "no word yet"}.</Note>
          <Note>Running {d?.version || "?"}{d?.version_disk && d.version_disk !== d.version ? `, ${d.version_disk} waits on the disk for a restart` : ""}. Up since {d?.game_since ? `${utcDayHM(d.game_since)} UTC` : "?"}.</Note>
        </Card>
      </div>
    </div>
  );
}

// ── Days ─────────────────────────────────────────────────────────────────────

function byPlayers(summaries, version) {
  const b = {};
  for (const s of summaries) {
    for (const [ver, by] of Object.entries(s.by_pl || {})) {
      if (version !== "all" && ver !== version) continue;
      for (const [pl, [sum, n]] of Object.entries(by)) {
        const k = Math.floor(Number(pl) / 5) * 5;
        b[k] = b[k] || [0, 0];
        b[k][0] += sum;
        b[k][1] += n;
      }
    }
  }
  return Object.keys(b).map(Number).sort((x, y) => x - y).map((k) => ({ from: k, avg: Math.round(b[k][0] / b[k][1]), n: b[k][1] }));
}
function ByPlayers({ days }) {
  const [range, setRange] = useState(30);
  const [version, setVersion] = useState("all");
  const versions = useMemo(() => Array.from(new Set(days.flatMap((s) => Object.keys(s.by_pl || {})))).sort(), [days]);
  const rows = byPlayers(days.slice(0, range), version);
  return (
    <Card title="AVERAGE TICKS BY PLAYER COUNT" right={
      <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <select value={range} onChange={(e) => setRange(Number(e.target.value))} style={inputStyle}>{[3, 7, 14, 30, 45].map((n) => <option key={n} value={n}>Last {n} days</option>)}</select>
        <select value={version} onChange={(e) => setVersion(e.target.value)} style={inputStyle}><option value="all">All versions</option>{versions.map((v) => <option key={v} value={v}>{v === "?" ? "Before this page" : v}</option>)}</select>
      </span>}>
      {rows.length ? (
        <div style={{ display: "grid", gap: 3, fontFamily: MONO, fontSize: 12 }}>
          {rows.map((r) => (
            <div key={r.from} style={{ display: "grid", gridTemplateColumns: "76px 1fr 44px 84px", gap: 8, alignItems: "center" }} title={`${r.from} to ${r.from + 4} players: ${r.avg} ticks over ${r.n} minutes`}>
              <span style={{ color: C.muted }}>{r.from}-{r.from + 4}</span>
              <span style={{ background: C.grid, height: 12 }}><span style={{ display: "block", height: 12, width: `${Math.min(100, (r.avg / 600) * 100)}%`, background: LEVEL[tpmLevel(r.avg)].color, borderRadius: "0 3px 3px 0" }} /></span>
              <span style={{ color: C.bright, textAlign: "right" }}>{r.avg}</span>
              <span style={{ color: C.dim }}>{r.n} min</span>
            </div>
          ))}
        </div>
      ) : <Note>No minutes with players in this range.</Note>}
    </Card>
  );
}
function DaysTab({ days, onIssues }) {
  const list = days.data?.days || [];
  const [day, setDay] = useState(null);
  const pickDay = day || list[0]?.day || today();
  const view = useLoad(() => get(`/api/admin/perf/day?date=${pickDay}`), [pickDay]);
  const v = view.data;
  const s0 = Date.parse(pickDay + "T00:00:00Z") / 1000;
  const rows = list.map((s) => ({
    active: s.day === pickDay, onClick: () => setDay(s.day),
    cells: [s.day, num(s.avg), num(s.low), num(s.under500), num(s.peak_pl), num(s.busy), num(s.drop), num(s.z), (s.versions || []).join(", ") || "?"],
  }));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 12 }}>
      <Card title="DAY BY DAY" right={<span style={{ fontFamily: MONO, fontSize: 11, color: C.dim }}>UTC days, kept 45 days</span>}>
        <Failed err={days.err} what="the days" />
        <Table head={["Day", "Avg ticks", "Worst 5%", "Min under 500", "Most players", "Too busy", "Dropped", "Most zombies", "Versions"]} rows={rows} />
      </Card>
      <Card title={pickDay} right={<Btn onClick={() => onIssues(pickDay)}>Issues this day</Btn>}>
        <Failed err={view.err} what="that day" />
        <ChartStack view={v} x0={s0} x1={s0 + 86400} marks={v?.markers || []} />
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 12 }}>
        <ByPlayers days={list} />
        <Card title="SLOWEST MEASURED MINUTES">
          {v?.slowest?.length ? v.slowest.slice(0, 3).map((r, i) => <div key={i} style={{ marginBottom: 10 }}><Handlers row={r} /></div>) : <Note>None measured.</Note>}
        </Card>
      </div>
      <Card title="MARKERS"><MarkList marks={v?.markers} /></Card>
    </div>
  );
}

// ── Compare ──────────────────────────────────────────────────────────────────

function CompareTab({ days }) {
  const list = (days.data?.days || []).map((s) => s.day);
  const [a, setA] = useState(null);
  const [b, setB] = useState(null);
  const A = a || list[0] || today();
  const B = b || list[1] || dayBefore(A);
  const c = useLoad(() => get(`/api/admin/perf/compare?a=${A}&b=${B}`), [A, B]);
  const d = c.data;
  const clock = (rows, day) => {
    const s0 = Date.parse(day + "T00:00:00Z") / 1000;
    const k = (d?.cols || []).indexOf("tpm");
    return (rows || []).map((r) => [r[0] - s0, r[k] ?? null]);
  };
  const series = d ? [{ name: A, color: C.dayA, points: clock(d.series.a, A) }, { name: B, color: C.dayB, points: clock(d.series.b, B) }] : [];
  const players = d ? [
    { name: A, color: C.dayA, points: clock(d.series.a, A).map((p, i) => [p[0], d.series.a[i][d.cols.indexOf("pl")] ?? null]) },
    { name: B, color: C.dayB, points: clock(d.series.b, B).map((p, i) => [p[0], d.series.b[i][d.cols.indexOf("pl")] ?? null]) },
  ] : [];
  const fmtClock = (t) => new Date(t * 1000).toISOString().slice(11, 16);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 12 }}>
      <Card title="COMPARE TWO DAYS" right={<span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><DayPick value={A} onChange={setA} days={list} /><DayPick value={B} onChange={setB} days={list} label="with" /></span>}>
        <Failed err={c.err} what="the comparison" />
        {d && (
          <>
            <Legend items={series} />
            <LineChart series={series} x0={0} x1={86400} fmtX={fmtClock} yMax={640} title="Ticks a minute through the day, UTC" lines={[{ v: 500, color: C.amber }]} />
            <LineChart series={players} x0={0} x1={86400} fmtX={fmtClock} height={100} title="Players through the day, UTC" />
          </>
        )}
      </Card>
      {d && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 12 }}>
          <Card title="THE NUMBERS"><Table head={["", A, B]} rows={d.metrics.map((m) => [m.label, num(m.a), num(m.b)])} /></Card>
          <Card title="TICKS BY PLAYER COUNT">
            <Table head={["Players", A, B]} rows={d.players.map((p) => [`${p.from}-${p.to}`, p.a == null ? "?" : `${p.a} (${p.an} min)`, p.b == null ? "?" : `${p.b} (${p.bn} min)`])} />
          </Card>
          <Card title="LUA HANDLERS, MS A MEASURED MINUTE">
            <Table head={["Handler", A, B]} align={["left"]} rows={d.handlers.map((h) => [`${h.ev}  ${h.where}`, num(h.a), num(h.b)])} />
          </Card>
          <Card title="WHAT CHANGED BETWEEN THEM">
            <MarkList marks={d.markers} />
            {d.changes.length > 0 && <div style={{ marginTop: 8 }}><ChangeList rows={d.changes} /></div>}
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Issues ───────────────────────────────────────────────────────────────────

function IssuesTab({ days, day, setDay, onPrompt }) {
  const list = (days.data?.days || []).map((s) => s.day);
  const D = day || list[0] || today();
  const iss = useLoad(() => get(`/api/admin/perf/issues?date=${D}`), [D]);
  const rows = iss.data?.issues || [];
  return (
    <Card title="ISSUES" right={<span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><DayPick value={D} onChange={setDay} days={list} />{onPrompt && <Btn onClick={() => onPrompt("why_stretch", D)}>Make a prompt for this</Btn>}</span>}>
      <Note>A cause is listed only when a measured number stands out. Otherwise it says unknown.</Note>
      <Failed err={iss.err} what="the issues" />
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        {!iss.loading && !rows.length && !iss.err && <Note>Nothing found for this day.</Note>}
        {rows.map((i, n) => (
          <div key={n} style={{ background: C.inner, border: `1px solid ${C.line}`, padding: "10px 12px" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
              <Pill level={i.level} text={i.level === "bad" ? "Bad" : "Weak"} />
              <span style={{ fontFamily: MONO, fontSize: 12, color: C.muted }}>{utcHM(i.at)}{i.end !== i.at ? ` to ${utcHM(i.end)}` : ""} UTC</span>
              <span style={{ color: C.bright, fontSize: 14 }}>{i.title}</span>
            </div>
            {i.players != null && <Note>About {i.players} players. Too busy {i.busy || 0} time{i.busy === 1 ? "" : "s"}, {i.drop || 0} packets dropped.</Note>}
            {(i.causes || []).map((c, j) => <div key={j} style={{ fontSize: 13, marginTop: 4, color: C.text }}><b style={{ fontWeight: 600 }}>Likely: {c.why}.</b> <span style={{ color: C.muted }}>{c.evidence}</span></div>)}
            {i.cause === "unknown" && <div style={{ fontSize: 13, marginTop: 4, color: C.muted }}><b style={{ fontWeight: 600, color: C.text }}>Likely cause: unknown.</b> {i.note}</div>}
            {i.cause !== "unknown" && i.note && <Note>{i.note}</Note>}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Changes ──────────────────────────────────────────────────────────────────

function ChangeList({ rows }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((c, i) => (
        <div key={i} style={{ background: C.inner, border: `1px solid ${C.line}`, padding: "10px 12px", minWidth: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 12, color: C.muted }}>{utcDayHM(c.at)} UTC</div>
          <div style={{ color: C.bright, fontSize: 14 }}>{c.title}</div>
          {Object.entries(c.lists || {}).map(([k, d]) => (
            <div key={k} style={{ fontFamily: MONO, fontSize: 12, marginTop: 4 }}>
              {d.added.map((x) => <div key={"a" + x} style={{ color: C.green }}>+ {x}</div>)}
              {d.removed.map((x) => <div key={"r" + x} style={{ color: C.red }}>- {x}</div>)}
              {d.moved.map((x) => <div key={"m" + x} style={{ color: C.amber }}>moved {x}</div>)}
            </div>
          ))}
          {(c.lines || []).filter((l) => !(c.lists || {})[l.key]).map((l, j) => (
            <div key={j} style={{ fontFamily: MONO, fontSize: 12, marginTop: 4, overflowWrap: "anywhere" }}>
              <div style={{ color: C.muted }}>{l.key}</div>
              <div style={{ color: C.red }}>before: {l.before ?? "(not there)"}</div>
              <div style={{ color: C.green }}>after: {l.after ?? "(gone)"}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
function ChangesTab({ onSeen, onPrompt }) {
  const ch = useLoad(() => get("/api/admin/perf/changes"), []);
  const d = ch.data;
  return (
    <Card title="MOD LIST AND SETTINGS CHANGES" right={<span style={{ display: "flex", gap: 8 }}>{onPrompt && <Btn onClick={() => onPrompt("change_check", null)}>Make a prompt</Btn>}<Btn primary disabled={!d?.unread} onClick={() => post("/api/admin/perf/changes/ack").then(() => { ch.reload(); onSeen(); })}>Mark as seen</Btn></span>}>
      <Note>servertest.ini, SandboxVars and spawn regions are compared once a minute. Passwords and keys show as [hidden].</Note>
      <Failed err={ch.err} what="the changes" />
      <div style={{ marginTop: 10 }}>{d?.changes?.length ? <ChangeList rows={d.changes} /> : !ch.err && <Note>No changes seen yet.</Note>}</div>
    </Card>
  );
}

// ── Logs ─────────────────────────────────────────────────────────────────────

function LogsTab() {
  const cat = useLoad(() => get("/api/admin/perf/logs"), []);
  const [folder, setFolder] = useState("");
  const arch = useLoad(() => (folder ? get(`/api/admin/perf/logs?folder=${encodeURIComponent(folder)}`) : Promise.resolve(null)), [folder]);
  const [file, setFile] = useState(null);
  const [page, setPage] = useState(null);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("recent");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const open = (id, offset = null) => {
    setFile(id);
    setErr("");
    get(`/api/admin/perf/logs/read?file=${encodeURIComponent(id)}${offset == null ? "" : `&offset=${offset}`}`).then(setPage).catch(() => setErr("Can't open that log."));
  };
  const search = (resume = null) => {
    if (q.trim().length < 2) return;
    setBusy(true);
    get(`/api/admin/perf/logs/search?q=${encodeURIComponent(q.trim())}&scope=${encodeURIComponent(scope)}${resume ? `&resume=${resume}` : ""}`)
      .then((d) => setRes(resume && res ? { ...d, hits: [...res.hits, ...(d.hits || [])] } : d))
      .catch(() => setErr("That search failed."))
      .finally(() => setBusy(false));
  };
  const groups = cat.data?.groups || [];
  const FileRow = ({ f }) => (
    <button onClick={() => open(f.id)} style={{ display: "block", width: "100%", textAlign: "left", background: file === f.id ? "rgba(200,168,75,0.08)" : "none", border: "none", color: C.text, fontFamily: MONO, fontSize: 12, padding: "3px 4px", cursor: "pointer", overflowWrap: "anywhere" }}>
      {f.name} <span style={{ color: C.dim }}>{size(f.size)}</span>
    </button>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 12 }}>
      <Card title="SEARCH THE LOGS">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="A name, an error, any text" style={{ ...inputStyle, flex: "1 1 220px" }} />
          <select value={scope} onChange={(e) => setScope(e.target.value)} style={inputStyle}>
            <option value="recent">Last 7 days</option><option value="all">Everything kept</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            {file && <option value={file}>This log only</option>}
          </select>
          <Btn primary disabled={busy} onClick={() => search()}>{busy ? "Searching" : "Search"}</Btn>
        </div>
        {res?.error && <Note color={C.red}>{res.error}</Note>}
        {res?.hits && (
          <div style={{ marginTop: 8 }}>
            <Note>{res.hits.length} lines in {res.files} logs. {res.more ? "Stopped early." : "Search finished."}</Note>
            <div style={{ maxHeight: 340, overflow: "auto", marginTop: 6 }}>
              {res.hits.map((h, i) => (
                <button key={i} onClick={() => open(h.file, h.offset)} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: `1px solid ${C.grid}`, color: C.text, fontFamily: MONO, fontSize: 12, padding: "3px 0", cursor: "pointer", overflowWrap: "anywhere" }}>
                  <span style={{ color: C.dim }}>{h.file}</span><br />{h.line}
                </button>
              ))}
            </div>
            {res.more && <div style={{ marginTop: 6 }}><Btn disabled={busy} onClick={() => search(res.more)}>Keep going</Btn></div>}
          </div>
        )}
      </Card>
      <div style={SIDE}>
        <div style={SIDE_L}><Card title="ALL LOGS">
          <Failed err={cat.err} what="the logs" />
          <div style={{ maxHeight: 560, overflow: "auto" }}>
            {groups.map((g) => (
              <div key={g.id} style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>{g.label}</div>
                {g.files.map((f) => <FileRow key={f.id} f={f} />)}
                {!g.files.length && <Note>None.</Note>}
              </div>
            ))}
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>Older game runs</div>
            <select value={folder} onChange={(e) => setFolder(e.target.value)} style={{ ...inputStyle, width: "100%", margin: "4px 0" }}>
              <option value="">Pick a run</option>
              {(cat.data?.archives || []).map((a) => <option key={a.folder} value={a.folder}>{a.folder}</option>)}
            </select>
            {(arch.data?.files || []).map((f) => <FileRow key={f.id} f={f} />)}
          </div>
        </Card></div>
        <div style={SIDE_R}>
          <Card title={page ? page.file : "PICK A LOG"} right={page && (
            <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: C.dim }}>{size(page.offset)} to {size(page.end)} of {size(page.size)}</span>
              <Btn disabled={page.prev == null} onClick={() => open(page.file, page.prev)}>Earlier</Btn>
              <Btn disabled={page.next == null} onClick={() => open(page.file, page.next)}>Later</Btn>
              <Btn onClick={() => open(page.file)}>Newest</Btn>
            </span>)}>
            {err && <Note color={C.red}>{err}</Note>}
            {page ? <pre style={{ margin: 0, maxHeight: 560, overflow: "auto", fontFamily: MONO, fontSize: 12, color: C.text, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{page.text}</pre> : <Note>Steam IDs and names show here. IPs, tokens, keys and passwords are taken out.</Note>}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Prompts ──────────────────────────────────────────────────────────────────

const FIELDS = "{{now}} {{day}} {{other_day}} {{day_summary}} {{issues}} {{compare}} {{changes}} {{note}}";
function PromptsTab({ days, want }) {
  const lib = useLoad(() => get("/api/admin/perf/prompts"), []);
  const list = (days.data?.days || []).map((s) => s.day);
  const [id, setId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [day, setDay] = useState(null);
  const [other, setOther] = useState(null);
  const [note, setNote] = useState("");
  const [steam, setSteam] = useState(false);
  const [out, setOut] = useState(null);
  const [msg, setMsg] = useState("");
  const rows = lib.data?.templates || [];
  const D = day || list[0] || today();
  const O = other || list[1] || dayBefore(D);
  useEffect(() => {
    if (want?.id && rows.length) {
      const t = rows.find((r) => r.id === want.id) || rows.find((r) => r.id === "any_ai");
      if (t) { setId(t.id); setDraft({ ...t }); }
      if (want.day) setDay(want.day);
    } else if (!draft && rows.length) { setId(rows[0].id); setDraft({ ...rows[0] }); }
  }, [want, rows.length]);
  const choose = (t) => { setId(t.id); setDraft({ ...t }); setOut(null); setMsg(""); };
  const after = (d) => { if (d.error) { setMsg(d.error); return; } lib.reload(); setMsg("Saved."); };
  return (
    <div style={SIDE}>
      <div style={SIDE_L}><Card title="TEMPLATES" right={<Btn onClick={() => choose({ id: "", title: "New template", target: "any AI", body: "" })}>New</Btn>}>
        <Failed err={lib.err} what="the library" />
        {rows.map((t) => (
          <button key={t.id} onClick={() => choose(t)} style={{ display: "block", width: "100%", textAlign: "left", background: id === t.id ? "rgba(200,168,75,0.08)" : "none", border: "none", borderBottom: `1px solid ${C.grid}`, color: C.text, padding: "6px 4px", cursor: "pointer", fontSize: 13 }}>
            {t.title}<br /><span style={{ fontFamily: MONO, fontSize: 11, color: C.dim }}>for {t.target}</span>
          </button>
        ))}
        <div style={{ marginTop: 8 }}><Btn onClick={() => { if (confirm("Put the library back to the starting templates? Your edits go.")) post("/api/admin/perf/prompts/reset").then(() => { lib.reload(); setDraft(null); }); }}>Back to the starting templates</Btn></div>
      </Card></div>
      <div style={{ ...SIDE_R, display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 12 }}>
        {draft && (
          <Card title="EDIT">
            <div style={{ display: "grid", gap: 6 }}>
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={{ ...inputStyle, width: "100%" }} aria-label="Title" />
              <input value={draft.target || ""} onChange={(e) => setDraft({ ...draft, target: e.target.value })} style={{ ...inputStyle, width: "100%" }} aria-label="Who it's for" />
              <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={9} style={{ ...inputStyle, width: "100%", fontFamily: MONO, resize: "vertical" }} aria-label="Template text" />
              <Note>Fills in: {FIELDS}</Note>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Btn primary onClick={() => post("/api/admin/perf/prompts/save", draft).then((d) => { after(d); if (d.id) setId(d.id), setDraft((x) => ({ ...x, id: d.id })); })}>Save</Btn>
                {draft.id && <Btn danger onClick={() => { if (confirm(`Delete "${draft.title}"?`)) post("/api/admin/perf/prompts/delete", { id: draft.id }).then(() => { lib.reload(); setDraft(null); setId(null); }); }}>Delete</Btn>}
                {msg && <span style={{ fontSize: 13, color: C.muted }}>{msg}</span>}
              </div>
            </div>
          </Card>
        )}
        <Card title="MAKE THE PROMPT">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            <DayPick value={D} onChange={setDay} days={list} label="Day" />
            <DayPick value={O} onChange={setOther} days={list} label="Other day" />
            <label style={{ fontFamily: MONO, fontSize: 12, color: C.muted }}><input type="checkbox" checked={steam} onChange={(e) => setSteam(e.target.checked)} /> Include Steam IDs</label>
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Anything to add" style={{ ...inputStyle, width: "100%", resize: "vertical", fontFamily: BODY, fontSize: 13 }} aria-label="Anything to add" />
          <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
            <Btn primary disabled={!draft} onClick={() => post("/api/admin/perf/prompts/render", { body: draft.body, day: D, other: O, note, steam }).then(setOut).catch(() => setMsg("Can't make it right now."))}>Make it</Btn>
            {out && <Btn onClick={() => copyText(out.text)}>Copy</Btn>}
          </div>
          {out?.missing?.length > 0 && <Note color={C.amber}>Not filled in: {out.missing.join(", ")}. Check the spelling in the template.</Note>}
          {out && <textarea readOnly value={out.text} rows={14} style={{ ...inputStyle, width: "100%", fontFamily: MONO, resize: "vertical" }} aria-label="The finished prompt" />}
          <Note>Player names stay. Steam IDs go unless ticked. IPs, tokens, keys and passwords always go.</Note>
        </Card>
      </div>
    </div>
  );
}

// ── Reports ──────────────────────────────────────────────────────────────────

function ReportsTab({ days }) {
  const list = (days.data?.days || []).map((s) => s.day);
  const reports = useLoad(() => get("/api/admin/perf/reports"), []);
  const [day, setDay] = useState(null);
  const [other, setOther] = useState(null);
  const [steam, setSteam] = useState(false);
  const [shown, setShown] = useState(null);
  const [busy, setBusy] = useState(false);
  const D = day || list[0] || today();
  const O = other || list[1] || dayBefore(D);
  const make = (kind) => {
    setBusy(true);
    post("/api/admin/perf/reports/make", { kind, day: D, other: O, steam }).then((r) => { setShown(r); reports.reload(); }).catch(() => setShown({ name: "", text: "Can't make the report right now." })).finally(() => setBusy(false));
  };
  return (
    <div style={SIDE}>
      <div style={SIDE_L}><Card title="ONE CLICK">
        <div style={{ display: "grid", gap: 8 }}>
          <DayPick value={D} onChange={setDay} days={list} label="Day" />
          <DayPick value={O} onChange={setOther} days={list} label="Other day" />
          <label style={{ fontFamily: MONO, fontSize: 12, color: C.muted }}><input type="checkbox" checked={steam} onChange={(e) => setSteam(e.target.checked)} /> Include Steam IDs</label>
          <Btn primary disabled={busy} onClick={() => make("day")}>Day report</Btn>
          <Btn primary disabled={busy} onClick={() => make("compare")}>Compare report</Btn>
          <Btn primary disabled={busy} onClick={() => make("changes")}>Changes report</Btn>
          
        </div>
        <div style={{ marginTop: 12 }}>
          <Failed err={reports.err} what="the reports" />
          {(reports.data?.reports || []).map((r) => (
            <button key={r.name} onClick={() => get(`/api/admin/perf/reports/read?name=${encodeURIComponent(r.name)}`).then(setShown)} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: C.text, fontFamily: MONO, fontSize: 12, padding: "3px 0", cursor: "pointer", overflowWrap: "anywhere" }}>{r.name}</button>
          ))}
        </div>
      </Card></div>
      <div style={SIDE_R}>
        <Card title={shown?.name || "PICK A REPORT"} right={shown?.text && <Btn onClick={() => copyText(shown.text)}>Copy</Btn>}>
          
          {shown ? <pre style={{ margin: 0, maxHeight: 620, overflow: "auto", fontFamily: MONO, fontSize: 12, color: C.text, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{shown.text}</pre> : <Note>Pick a report, or make a new one.</Note>}
        </Card>
      </div>
    </div>
  );
}

// ── the page ─────────────────────────────────────────────────────────────────

export default function PerfApp() {
  const [tab, setTab] = useState("now");
  const [issueDay, setIssueDay] = useState(null);
  const [want, setWant] = useState(null);
  const perf = useLoad(() => get("/api/admin/perf/now"), [], 30000);
  const days = useLoad(() => get("/api/admin/perf/days"), [], 300000);
  const d = perf.data;
  const owner = d?.owner === true;                     // the Prompts tab is the owner's alone; the bot refuses everyone else too
  useEffect(() => {
    try { const t = sessionStorage.getItem("soup:perf.tab"); if (t) setTab(t); } catch {}
  }, []);
  const go = (t) => { setTab(t); try { sessionStorage.setItem("soup:perf.tab", t); } catch {} };
  const toPrompt = (id, day) => { setWant({ id, day }); go("prompts"); };
  const denied = perf.err && (perf.err.status === 401 || perf.err.status === 403);
  return (
    <main style={{ background: "#0e0e0e", minHeight: "100vh", color: C.text, fontFamily: BODY, padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <h1 style={{ fontFamily: DISPLAY, fontSize: 34, letterSpacing: 3, color: C.gold, margin: 0 }}>PERFORMANCE</h1>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.dim }}>All times UTC. Read from files outside the game.</span>
        </div>
        <nav style={{ display: "flex", gap: 4, flexWrap: "wrap", borderBottom: `1px solid ${C.line}` }} aria-label="Performance sections">
          {TABS.filter(([k]) => owner || k !== "prompts").map(([k, label]) => (
            <button key={k} onClick={() => go(k)} style={{ fontFamily: MONO, fontSize: 13, padding: "7px 12px", background: "none", border: "none", borderBottom: `2px solid ${tab === k ? C.gold : "transparent"}`, color: tab === k ? C.gold : C.muted, cursor: "pointer" }}>
              {label}{k === "changes" && d?.unread > 0 ? ` (${d.unread})` : ""}
            </button>
          ))}
        </nav>
        {d?.unread > 0 && tab !== "changes" && (
          <button onClick={() => go("changes")} style={{ textAlign: "left", background: "rgba(224,85,85,0.1)", border: `1px solid ${C.red}`, color: C.bright, padding: "8px 12px", fontSize: 14, cursor: "pointer" }}>
            ■ The mod list or server settings changed ({d.unread} not seen yet). Open Changes for before and after lines.
          </button>
        )}
        {d && d.at && !d.ok && <Note color={C.red}>■ The collector hasn't written for {ago(d.at, Date.now() / 1000)}. The numbers below are old.</Note>}
        {d && !d.at && <Note color={C.amber}>▲ No minutes yet. The cron job writes the first one within two minutes of being installed.</Note>}
        {denied ? <Failed err={perf.err} what="this page" /> : (
          <>
            {tab === "now" && <NowTab perf={perf} />}
            {tab === "days" && <DaysTab days={days} onIssues={(x) => { setIssueDay(x); go("issues"); }} />}
            {tab === "compare" && <CompareTab days={days} />}
            {tab === "issues" && <IssuesTab days={days} day={issueDay} setDay={setIssueDay} onPrompt={owner ? toPrompt : null} />}
            {tab === "changes" && <ChangesTab onSeen={perf.reload} onPrompt={owner ? toPrompt : null} />}
            {tab === "logs" && <LogsTab />}
            {tab === "prompts" && owner && <PromptsTab days={days} want={want} />}
            {tab === "reports" && <ReportsTab days={days} />}
          </>
        )}
      </div>
    </main>
  );
}
