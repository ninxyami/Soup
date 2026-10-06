// @ts-nocheck
"use client";
// components/ops/TigerTab.tsx - the RECLAMATION tab in Live Ops (2026-10-06, mod 1.7.139 ZO_Tiger.lua).
// B42 Tiger (Workshop 3782737166, Sheo's) runs town reclamation. Everything here goes through the game: the bot's
// /api/admin/ops/tiger queues a tg_call (one of Tiger's own admin commands), the game runs it through Tiger's handler
// and writes the answer, then the overview (Tiger's admin snapshot) is read again. Pages match Tiger's in-game admin
// window: Overview, Towns, Stations, Missions, Events, HTC, Bosses, Rewards, Settings, History, Diagnostics.
// Stations and mission sites are drawn on the map; click one to open it, or place / move one with a map click.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API } from "@/lib/constants";
import { flyTo } from "@/components/WorldMap";

const C = { gold: "#c8a84b", blue: "#4a8fc4", green: "#4caf7d", red: "#e05555", purple: "#9775cc", grey: "#9aa", text: "#e6e6e6", bg: "#0b0d10",
  panel: "#111418", line: "#2a2f37", teal: "#5cc8b8", orange: "#e8a35c" };
const mono = { fontFamily: "var(--mono, monospace)" };
const inp = { ...mono, fontSize: 12, padding: "5px 7px", background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 3, boxSizing: "border-box" };

const PAGES = [["overview", "Overview"], ["towns", "Towns"], ["stations", "Stations"], ["missions", "Missions"], ["events", "Events"], ["htc", "HTC"],
  ["bosses", "Bosses"], ["rewards", "Rewards"], ["settings", "Settings"], ["history", "History"], ["diag", "Diagnostics"]];
const KIND_COLOR = { Town: C.gold, Specialized: C.teal, Objective: C.orange, Unconfigured: "#8a8f98" };
const BOSS_POOLS = ["weapons", "gear", "support", "food", "medical", "recipes", "special"];
const SETTINGS = [
  ["preparationSeconds", "Preparation time (s)", "defaults"], ["repeatableObjectiveSeconds", "Repeatable mission cooldown (s)", "defaults"],
  ["stationWorkDistance", "Station work distance (tiles)", "defaults"], ["lastContactsThreshold", "Final-contact locator (zombies)", "defaults"],
  ["spawnInnerPadding", "Spawn inner padding (tiles)", "missionArea"], ["outerPadding", "Mission area outer padding (tiles)", "missionArea"],
];

const n = (v) => Number(v) || 0;
const list = (v) => (Array.isArray(v) ? v : []);
const vals = (o) => (o && typeof o === "object" ? Object.values(o) : []);
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
function when(sec) {
  const v = n(sec);
  if (!v) return "";
  return new Date(v * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function left(until, now) {
  const s = n(until) - n(now);
  if (!n(until)) return "";
  if (s <= 0) return "now";
  return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}
const lines = (text) => String(text || "").split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);

function Btn({ children, onClick, color = C.gold, disabled = false, title = "" }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ ...mono, fontSize: 11, padding: "3px 8px", background: "transparent", color: disabled ? "#555" : color, border: `1px solid ${disabled ? "#333" : color}`,
        borderRadius: 3, cursor: disabled ? "default" : "pointer", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{children}</button>
  );
}
// a button that needs a second click within 4 s (Tiger's own window does the same for resets and deletes)
function Sure({ children, onClick, color = C.red, disabled = false, title = "" }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  return <Btn color={color} disabled={disabled} title={title} onClick={() => { if (armed) { setArmed(false); onClick(); } else setArmed(true); }}>{armed ? "Sure? click again" : children}</Btn>;
}
function Box({ title, right = null, children }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 3, padding: 10, display: "flex", flexDirection: "column", gap: 6, background: C.bg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><b style={{ fontSize: 13 }}>{title}</b><span style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>{right}</span></div>
      {children}
    </div>
  );
}
const Row = ({ children, style = {} }) => <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", ...style }}>{children}</div>;
const Note = ({ children, color = C.grey }) => <div style={{ ...mono, fontSize: 11, color, whiteSpace: "pre-wrap" }}>{children}</div>;
function KV({ k, v, color = C.text }) {
  return <div style={{ ...mono, fontSize: 12, display: "flex", gap: 8 }}><span style={{ color: C.grey, minWidth: 150 }}>{k}</span><span style={{ color, wordBreak: "break-word" }}>{v}</span></div>;
}
const Pre = ({ children }) => <pre style={{ ...mono, fontSize: 11, color: C.text, whiteSpace: "pre-wrap", margin: 0, maxHeight: 360, overflowY: "auto", background: C.panel, padding: 8, borderRadius: 3 }}>{children}</pre>;
function Field({ label, children }) {
  return <label style={{ ...mono, fontSize: 11, color: C.grey, display: "flex", flexDirection: "column", gap: 2 }}>{label}{children}</label>;
}
function Num({ value, onChange, min = 0, max = 100000, width = 80 }) {
  return <input type="number" min={min} max={max} value={value ?? ""} style={{ ...inp, width }} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />;
}
function Check({ value, onChange, label }) {
  return <label style={{ ...mono, fontSize: 12, display: "inline-flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
    <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />{label}</label>;
}
function Sel({ value, onChange, options, width }) {
  return <select value={value ?? ""} style={{ ...inp, width }} onChange={(e) => onChange(e.target.value)}>
    {options.map((o) => Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>)}</select>;
}

export default function TigerTab({ setPick, setLayer, onWide, players = [] }) {
  const [page, setPage] = useState("overview");
  const [st, setSt] = useState(null);                 // the game's overview (zombita_ops_tiger.txt)
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const [townId, setTownId] = useState("");           // the header Town picker, like Tiger's own window
  const [selId, setSelId] = useState("");             // the station / mission site open in the editor
  const [floor, setFloor] = useState(0);
  useEffect(() => { onWide(page !== "overview"); }, [page, onWide]);
  useEffect(() => () => onWide(false), [onWide]);

  const note = (ok, text) => setMsg({ ok, text, at: Date.now() });
  const readState = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/admin/ops/tiger/state`, { credentials: "include" });
      if (r.ok) { const d = await r.json(); if (d && d.ts) setSt(d); }
    } catch {}
  }, []);
  // one request: queue it, wait for the game's answer, then read the overview it rewrote
  const tg = useCallback(async (tk, args = {}, extra = {}, quiet = false) => {
    setBusy(tk || "overview");
    try {
      const body = tk ? { cmd: "tg_call", tk, args, ...extra } : { cmd: "tg_state" };
      const r = await fetch(`${API}/api/admin/ops/tiger`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const q = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(q.detail || `HTTP ${r.status}`);
      for (let i = 0; i < 45; i++) {
        await sleep(i < 6 ? 500 : 1200);
        const a = await fetch(`${API}/api/admin/ops/tiger/reply/${q.id}`, { credentials: "include" });
        const ans = await a.json().catch(() => ({}));
        if (!a.ok) throw new Error(ans.detail || `HTTP ${a.status}`);
        if (ans.done === false) continue;
        await readState();
        if (!quiet || !ans.ok) note(ans.ok, ans.msg);
        return ans;
      }
      throw new Error("No answer from the game in 45 s. Is anyone online? (The server pauses when it's empty; it runs when someone joins.)");
    } catch (e) { note(false, e.message); return null; }
    finally { setBusy(""); }
  }, [readState]);
  useEffect(() => { readState().then(() => tg(null, {}, {}, true)); }, []);

  const snap = st?.snapshot || {};
  const ref = st?.ref || {};
  const towns = useMemo(() => vals(snap.towns).sort((a, b) => String(a.name).localeCompare(String(b.name))), [snap.towns]);
  const sites = useMemo(() => [...vals(snap.stations).map((s) => ({ ...s, kind: s.kind || "Unconfigured" })),
    ...vals(snap.objectives).map((o) => ({ ...o, kind: "Objective" }))], [snap.stations, snap.objectives]);
  const town = (snap.towns || {})[townId] || null;
  const sel = sites.find((s) => s.id === selId) || null;
  useEffect(() => { if (!townId && towns.length) setTownId(towns[0].id); }, [towns, townId]);

  // the map: every station / mission site (click to open), active bosses
  useEffect(() => {
    const dots = sites.map((s) => ({ id: "tg:" + s.id, label: s.id === selId ? s.name : "", x: s.x, y: s.y, z: s.z,
      size: s.id === selId ? 14 : 9, color: s.id === selId ? "#fff" : KIND_COLOR[s.kind] || C.grey,
      onClick: () => { setSelId(s.id); setPage(s.kind === "Objective" ? "missions" : "stations"); if (s.townId) setTownId(s.townId); } }));
    for (const b of list(snap.bossAdmin?.active)) if (b.x) dots.push({ id: "tgb:" + b.id, label: `${b.name || b.kind} ${b.currentHP ?? ""}/${b.maxHP ?? ""}`, x: b.x, y: b.y, size: 12, color: C.red,
      onClick: () => setPage("bosses") });
    setLayer({ dots, rects: [] });
  }, [sites, selId, snap.bossAdmin, setLayer]);
  useEffect(() => () => setLayer({ dots: [], rects: [] }), []);

  const pickSpot = (hint, cb) => setPick({ mode: "z", hint, cb });
  const ctx = { tg, st, snap, ref, towns, town, townId, setTownId, sites, sel, selId, setSelId, setPage, busy, note, pickSpot, floor, setFloor, players, readState };
  const recovery = (r) => (ref.recovery || {})[String(r)] || {};
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Row>
        {PAGES.map(([k, l]) => <Btn key={k} color={page === k ? C.teal : C.grey} onClick={() => setPage(k)}>{l}</Btn>)}
        <span style={{ marginLeft: "auto" }}><Btn color={C.grey} disabled={!!busy} onClick={() => tg(null, {}, {}, true)}>Refresh</Btn></span>
      </Row>
      <Row>
        <Note>Town</Note>
        <Sel value={townId} onChange={setTownId} options={towns.length ? towns.map((t) => [t.id, `${t.name} · D${t.difficulty} · ${recovery(t.recovery).code || "R" + t.recovery}`]) : [["", "(no towns yet)"]]} />
        <Note>Floor for map clicks</Note><Num value={floor} min={-8} max={8} width={56} onChange={(v) => setFloor(Math.max(-8, Math.min(8, n(v))))} />
      </Row>
      {busy && <Note color={C.gold}>Asking the game: {busy}...</Note>}
      {msg && <Note color={msg.ok ? C.green : C.red}>{msg.text}</Note>}
      {st && st.installed === false && <Note color={C.red}>Tiger (B42 reclamation) isn't running on the server, or the Zombita mod is older than 1.7.139.</Note>}
      {st && st.installed && st.ready === false && <Note color={C.red}>Tiger's saved data didn't load this boot (its persistence failed). Nothing can change until it does.</Note>}
      {!st && <Note>Waiting for the game's Reclamation overview (mod 1.7.139; the server answers only while someone is online).</Note>}
      {st?.error && <Note color={C.red}>Overview error: {st.error}</Note>}
      {page === "overview" && <Overview {...ctx} />}
      {page === "towns" && <Towns {...ctx} />}
      {page === "stations" && <Stations {...ctx} />}
      {page === "missions" && <Missions {...ctx} />}
      {page === "events" && <Events {...ctx} />}
      {page === "htc" && <Htc {...ctx} />}
      {page === "bosses" && <Bosses {...ctx} />}
      {page === "rewards" && <Rewards {...ctx} />}
      {page === "settings" && <Settings {...ctx} />}
      {page === "history" && <History {...ctx} />}
      {page === "diag" && <Diag {...ctx} />}
    </div>
  );
}

// ─── Overview ──────────────────────────────────────────────────────────────────────────────────────────────────────
function Overview({ st, snap, ref, towns, town, sites, tg, busy, pickSpot, floor, setSelId, setPage }) {
  const ops = vals(snap.operations);
  const rec = (r) => (ref.recovery || {})[String(r)] || {};
  const place = () => pickSpot("Click where the new station goes.", (w) => tg("PLACE_STATION", { x: w.x, y: w.y, z: floor }).then((a) => {
    if (a?.ok) { setPage("stations"); }
  }));
  return <>
    <Box title="Reclamation" right={<Btn color={C.teal} disabled={!!busy} onClick={place}>Place station on map</Btn>}>
      <KV k="Tiger version" v={`${st?.version || "?"} (data rev ${st?.dataRevision ?? "?"})`} />
      <KV k="Towns" v={towns.length} />
      <KV k="Stations / sites" v={`${vals(snap.stations).length} stations, ${vals(snap.objectives).length} mission sites, ${sites.filter((s) => s.kind === "Unconfigured").length} unconfigured`} />
      <KV k="Active operations" v={ops.length} color={ops.length ? C.gold : C.text} />
      <KV k="Active bosses" v={list(snap.bossAdmin?.active).length} />
      <Note>Placing works anywhere: Tiger only keeps a record, and players' games draw the terminal when they come near. A new station is unconfigured until you give it a role (Stations page).</Note>
    </Box>
    {town && <Box title={`${town.name} · D${town.difficulty} · ${rec(town.recovery).code || ""} ${rec(town.recovery).name || ""}`}
      right={<><Btn disabled={!!busy} onClick={() => tg("ADMIN_VALIDATE_TOWN", { townId: town.id })}>Validate</Btn>
        <Btn disabled={!!busy} onClick={() => tg("ADMIN_RECONCILE_TOWN", { townId: town.id })}>Reconcile</Btn></>}>
      <KV k="Town station" v={town.townStationId ? ((snap.stations || {})[town.townStationId]?.name || town.townStationId) : "none yet"} color={town.townStationId ? C.text : C.red} />
      <KV k="Specialized" v={list(town.specialized).length} />
      <KV k="Mission sites" v={list(town.objectives).length} />
      <KV k="Can advance" v={town.canAdvance ? "yes" : (town.blockReason || "no")} color={town.canAdvance ? C.green : C.grey} />
      {town.stageProgress && <Pre>{JSON.stringify(town.stageProgress, null, 1)}</Pre>}
    </Box>}
    <Box title="All stations and sites">
      {sites.length === 0 && <Note>None yet. Place one on the map.</Note>}
      {sites.map((s) => <SiteRow key={s.id} s={s} snap={snap} onClick={() => { setSelId(s.id); setPage(s.kind === "Objective" ? "missions" : "stations"); flyTo(s.x, s.y, 1.4); }} />)}
    </Box>
  </>;
}

function SiteRow({ s, snap, onClick, active = false }) {
  const t = (snap.towns || {})[s.townId];
  return <div onClick={onClick} style={{ ...mono, fontSize: 12, padding: "4px 6px", cursor: "pointer", borderRadius: 3, background: active ? "#1b2328" : "transparent", display: "flex", gap: 8, alignItems: "center" }}>
    <span style={{ width: 9, height: 9, borderRadius: 5, background: KIND_COLOR[s.kind] || C.grey, flex: "0 0 auto" }} />
    <span style={{ flex: 1 }}>{s.name}{s.kind === "Specialized" && s.specialization ? ` (${s.specialization})` : ""}{s.kind === "Objective" && s.missionType ? ` (${s.missionType})` : ""}</span>
    <span style={{ color: C.grey }}>{s.kind}{t ? ` · ${t.name}` : ""} · {s.x},{s.y}{s.z ? `,${s.z}` : ""}</span>
  </div>;
}

// ─── Towns ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function Towns({ tg, snap, ref, towns, town, setTownId, busy }) {
  const [preset, setPreset] = useState("");
  const [name, setName] = useState("");
  const [diff, setDiff] = useState(2);
  const [edit, setEdit] = useState(null);
  useEffect(() => { setEdit(town ? { name: town.name, difficulty: town.difficulty, dailyEnabled: town.config?.dailyEnabled !== false, repeatablesEnabled: town.config?.repeatablesEnabled !== false } : null); }, [town?.id, town?.name, town?.difficulty, town?.config?.dailyEnabled, town?.config?.repeatablesEnabled]);
  const used = new Set(towns.map((t) => t.vanillaPresetId).filter(Boolean));
  const presets = list(ref.vanillaTowns).filter((p) => !used.has(p.id));
  const rec = (r) => (ref.recovery || {})[String(r)] || {};
  return <>
    <Box title="Add a town">
      <Row><Sel value={preset} onChange={setPreset} options={[["", "Vanilla town..."], ...presets.map((p) => [p.id, `${p.name} (D${p.difficulty})`])]} />
        <Btn disabled={!preset || !!busy} onClick={() => tg("CREATE_TOWN", { presetId: preset }).then((a) => { if (a?.ok) { setTownId("VANILLA_" + preset.toUpperCase()); setPreset(""); } })}>Add vanilla town</Btn></Row>
      <Row><input placeholder="Custom town name" value={name} maxLength={48} onChange={(e) => setName(e.target.value)} style={{ ...inp, width: 200 }} />
        <Note>Difficulty</Note><Sel value={diff} onChange={(v) => setDiff(Number(v))} options={[1, 2, 3, 4, 5, 6].map((d) => [d, `D${d}`])} />
        <Btn disabled={!name.trim() || !!busy} onClick={() => tg("CREATE_TOWN", { name: name.trim(), difficulty: diff }).then((a) => { if (a?.ok) setName(""); })}>Add custom town</Btn></Row>
    </Box>
    {town && edit && <Box title={`${town.name}${town.vanillaPresetId ? " (vanilla)" : " (custom)"}`}
      right={<Btn disabled={!!busy} onClick={() => tg("UPDATE_TOWN", { townId: town.id, ...(town.vanillaPresetId ? {} : { name: edit.name, difficulty: edit.difficulty }), dailyEnabled: edit.dailyEnabled, repeatablesEnabled: edit.repeatablesEnabled })}>Save</Btn>}>
      {!town.vanillaPresetId ? <Row>
        <Field label="Name"><input value={edit.name} maxLength={48} onChange={(e) => setEdit({ ...edit, name: e.target.value })} style={{ ...inp, width: 200 }} /></Field>
        <Field label="Difficulty"><Sel value={edit.difficulty} onChange={(v) => setEdit({ ...edit, difficulty: Number(v) })} options={[1, 2, 3, 4, 5, 6].map((d) => [d, `D${d}`])} /></Field>
      </Row> : <Note>A vanilla town keeps its name and difficulty.</Note>}
      <Row><Check value={edit.dailyEnabled} onChange={(v) => setEdit({ ...edit, dailyEnabled: v })} label="Daily rewards" />
        <Check value={edit.repeatablesEnabled} onChange={(v) => setEdit({ ...edit, repeatablesEnabled: v })} label="Repeatable missions" /></Row>
      <KV k="Recovery" v={`${rec(town.recovery).code || "R" + town.recovery} ${rec(town.recovery).name || ""}`} />
      <KV k="Can advance" v={town.canAdvance ? "yes" : (town.blockReason || "no")} color={town.canAdvance ? C.green : C.grey} />
      <Row>
        <Btn disabled={!!busy} onClick={() => tg("ADMIN_TOWN_BYPASS", { townId: town.id, action: "FILL_CURRENT" })} title="Fills what the current recovery stage needs">Fill stage requirements</Btn>
        <Btn disabled={!!busy} onClick={() => tg("ADMIN_TOWN_BYPASS", { townId: town.id, action: "ADVANCE" })} title="Moves the town to the next recovery stage, skipping its checks">Advance recovery</Btn>
        <Btn disabled={!!busy} onClick={() => tg("ADMIN_VALIDATE_TOWN", { townId: town.id })}>Validate</Btn>
        <Btn disabled={!!busy} onClick={() => tg("ADMIN_RECONCILE_TOWN", { townId: town.id })}>Reconcile</Btn>
      </Row>
      <Row>
        <Sure disabled={!!busy} onClick={() => tg("ADMIN_RESET_TOWN", { townId: town.id })} title="Fails active operations and puts the town back to R0">Reset town</Sure>
        <Sure disabled={!!busy} onClick={() => tg("ADMIN_DELETE_TOWN", { townId: town.id })} title="Its stations and sites become unconfigured stations">Delete town</Sure>
      </Row>
    </Box>}
    {town && <Box title="Town history">
      {list(town.history).slice().reverse().slice(0, 40).map((h, i) => <Note key={i} color={C.text}>{when(h.at)} · {h.kind} · {h.text}</Note>)}
      {!list(town.history).length && <Note>Nothing yet.</Note>}
    </Box>}
  </>;
}

// ─── Stations (and the site editor Missions uses too) ───────────────────────────────────────────────────────────────
function Stations(p) {
  const { sites, sel, selId, setSelId, snap, townId, tg, busy, pickSpot, floor } = p;
  const [filter, setFilter] = useState("town");
  const shown = sites.filter((s) => s.kind !== "Objective" && (filter === "all" || (filter === "unconf" ? s.kind === "Unconfigured" : s.townId === townId || s.kind === "Unconfigured")));
  const place = () => pickSpot("Click where the new station goes.", (w) => tg("PLACE_STATION", { x: w.x, y: w.y, z: floor }));
  return <>
    <Box title="Stations" right={<><Sel value={filter} onChange={setFilter} options={[["town", "This town + unconfigured"], ["unconf", "Unconfigured only"], ["all", "Every town"]]} />
      <Btn color={C.teal} disabled={!!busy} onClick={place}>Place on map</Btn></>}>
      {shown.length === 0 && <Note>No stations here. Place one on the map, then give it a role below.</Note>}
      {shown.map((s) => <SiteRow key={s.id} s={s} snap={snap} active={s.id === selId} onClick={() => { setSelId(s.id); flyTo(s.x, s.y, 1.4); }} />)}
    </Box>
    {sel && sel.kind !== "Objective" && <SiteEditor {...p} />}
    {sel && sel.kind === "Objective" && <Note>That's a mission site: open it on the Missions page.</Note>}
  </>;
}

function SiteEditor({ sel, snap, ref, towns, townId, tg, busy, pickSpot, floor, players, setSelId }) {
  const [f, setF] = useState(null);
  const [townMode, setTownMode] = useState("existing");
  useEffect(() => {
    if (!sel) return;
    setF({ kind: sel.kind === "Unconfigured" ? "Specialized" : sel.kind, townId: sel.townId || townId, townPresetId: "", newTownName: "", newTownDifficulty: 2,
      specialization: sel.specialization || (ref.specializations || [])[0] || "Library", missionType: sel.missionType || (ref.objectiveTypes || [])[0] || "Repair",
      name: sel.kind === "Unconfigured" || /^Unconfigured /.test(sel.name || "") ? "" : sel.name,
      description: sel.kind === "Unconfigured" || /awaiting configuration/.test(sel.description || "") ? "" : (sel.description || ""), sprite: sel.sprite || ref.defaultSprite || "",
      required: sel.required !== false, enabled: sel.enabled !== false, difficultyOverride: sel.difficultyOverride || "" });
    setTownMode(sel.townId || townId ? "existing" : "vanilla");
  }, [sel?.id, sel?.kind, sel?.townId, sel?.name, sel?.sprite]);
  if (!sel || !f) return null;
  const save = () => {
    // Tiger keeps the old name when the field is blank, so a new station would stay "Unconfigured Reclamation Station":
    // name it after its town and role instead (the same pattern Tiger uses for Town Stations)
    let name = f.name.trim();
    if (!name && (sel.kind === "Unconfigured" || /^Unconfigured /.test(sel.name || ""))) {
      const tn = townMode === "existing" ? (towns.find((x) => x.id === f.townId) || {}).name
        : townMode === "vanilla" ? (list(ref.vanillaTowns).find((x) => x.id === f.townPresetId) || {}).name : f.newTownName.trim();
      name = f.kind === "Town" ? `${tn || "Town"} Recovery Terminal` : f.kind === "Specialized" ? `${tn || ""} ${f.specialization} Station`.trim()
        : `${tn || ""} ${f.missionType} Site`.trim();
    }
    // same for the description: Tiger's own text for the role (State.configureStation) when it's left blank
    const description = f.description.trim() || { Town: "Town Recovery network terminal.", Specialized: "Specialized recovery infrastructure terminal.",
      Objective: "Regional field terminal awaiting network activation." }[f.kind] || "";
    const a = { id: sel.id, kind: f.kind, name, description, sprite: f.sprite, required: f.required, enabled: f.enabled };
    if (townMode === "existing") a.townId = f.townId;
    else if (townMode === "vanilla") a.townPresetId = f.townPresetId;
    else { a.newTownName = f.newTownName.trim(); a.newTownDifficulty = f.newTownDifficulty; }
    if (f.kind === "Specialized") a.specialization = f.specialization;
    if (f.kind === "Objective") { a.missionType = f.missionType; if (f.difficultyOverride) a.difficultyOverride = Number(f.difficultyOverride); }
    tg("CONFIGURE_STATION", a);
  };
  const move = () => pickSpot(`Click where ${sel.name} should stand now.`, (w) => tg("RELOCATE_STATION", { id: sel.id, x: w.x, y: w.y, z: floor }));
  const kinds = [["Town", "Town Station (the town's main terminal)"], ["Specialized", "Specialized Station"], ["Objective", "Mission site (Objective)"]];
  const t = (snap.towns || {})[sel.townId];
  return <>
    <Box title={`${sel.name} · ${sel.kind}${t ? " · " + t.name : ""}`} right={<><Btn color={C.grey} onClick={() => flyTo(sel.x, sel.y, 1.6)}>Show</Btn><Btn color={C.grey} onClick={() => setSelId("")}>Close</Btn></>}>
      <KV k="Where" v={`${sel.x}, ${sel.y}, floor ${sel.z || 0}`} />
      <KV k="Id" v={sel.id} />
      {sel.kind === "Specialized" && <KV k="State" v={`${sel.restored ? "restored" : "not restored"} · ${sel.online ? "online" : "offline"} · startup ${sel.startup?.committed ?? 0}/3${sel.startup?.completed ? " done" : ""}`} />}
      <Row><Field label="Role"><Sel value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={kinds} /></Field>
        {f.kind === "Specialized" && <Field label="Specialization"><Sel value={f.specialization} onChange={(v) => setF({ ...f, specialization: v })} options={list(ref.specializations)} /></Field>}
        {f.kind === "Objective" && <><Field label="Mission"><Sel value={f.missionType} onChange={(v) => setF({ ...f, missionType: v })} options={list(ref.objectiveTypes)} /></Field>
          <Field label="Difficulty"><Sel value={f.difficultyOverride} onChange={(v) => setF({ ...f, difficultyOverride: v })} options={[["", "Town's"], 1, 2, 3, 4, 5, 6].map((d) => (Array.isArray(d) ? d : [d, `D${d}`]))} /></Field></>}
      </Row>
      <Row><Field label="Town">
        <Sel value={townMode} onChange={setTownMode} options={[["existing", "Existing town"], ["vanilla", "Vanilla town (adds it)"], ["new", "New custom town"]]} /></Field>
        {townMode === "existing" && <Field label=" "><Sel value={f.townId} onChange={(v) => setF({ ...f, townId: v })} options={towns.length ? towns.map((x) => [x.id, x.name]) : [["", "(no towns)"]]} /></Field>}
        {townMode === "vanilla" && <Field label=" "><Sel value={f.townPresetId} onChange={(v) => setF({ ...f, townPresetId: v })} options={[["", "Pick..."], ...list(ref.vanillaTowns).map((x) => [x.id, x.name])]} /></Field>}
        {townMode === "new" && <><Field label="Name"><input value={f.newTownName} maxLength={48} onChange={(e) => setF({ ...f, newTownName: e.target.value })} style={{ ...inp, width: 160 }} /></Field>
          <Field label="Difficulty"><Sel value={f.newTownDifficulty} onChange={(v) => setF({ ...f, newTownDifficulty: Number(v) })} options={[1, 2, 3, 4, 5, 6].map((d) => [d, `D${d}`])} /></Field></>}
      </Row>
      <Row><Field label="Name (blank = Tiger names it)"><input value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} style={{ ...inp, width: 240 }} /></Field>
        <Field label="Looks like"><Sel value={f.sprite} onChange={(v) => setF({ ...f, sprite: v })} options={list(ref.appearances).map((a) => [a.sprite, a.label])} /></Field></Row>
      <Field label="Description"><textarea value={f.description} maxLength={600} rows={2} onChange={(e) => setF({ ...f, description: e.target.value })} style={{ ...inp, width: "100%" }} /></Field>
      <Row><Check value={f.required} onChange={(v) => setF({ ...f, required: v })} label="Required for recovery" /><Check value={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label="Enabled" /></Row>
      <Row>
        <Btn color={C.teal} disabled={!!busy} onClick={save}>Save role</Btn>
        <Btn disabled={!!busy} onClick={move}>Move (map click)</Btn>
        {sel.kind === "Specialized" && <><Btn disabled={!!busy} onClick={() => tg("ADMIN_STATION_BYPASS", { id: sel.id, action: "FORCE_RESTORED" })}>Force restored</Btn>
          <Btn disabled={!!busy} onClick={() => tg("ADMIN_STATION_BYPASS", { id: sel.id, action: "FORCE_STARTUP_COMPLETE" })}>Complete startup</Btn></>}
        <Sure disabled={!!busy} onClick={() => tg("ADMIN_RESET_STATION", { id: sel.id })} title="Fails its active operation and clears its progress">Reset progress</Sure>
        <Sure disabled={!!busy} onClick={() => tg("REMOVE_STATION", { id: sel.id }).then((a) => { if (a?.ok) setSelId(""); })}>Remove</Sure>
      </Row>
      {(sel.kind === "Town" || sel.kind === "Specialized") && <TestEvent tg={tg} busy={busy} players={players} targetType={sel.kind === "Town" ? "town" : "station"} id={sel.kind === "Town" ? sel.townId : sel.id}
        label={sel.kind === "Town" ? "Start the town's recovery operation" : "Start this station's startup operation"} />}
    </Box>
    {sel.kind === "Specialized" && <Manifest sel={sel} tg={tg} busy={busy} />}
    <Box title="Station history">{list(sel.history).slice().reverse().slice(0, 30).map((h, i) => <Note key={i} color={C.text}>{when(h.at)} · {h.kind} · {h.text}</Note>)}</Box>
  </>;
}

// an operation needs a real Mission Team online, so it runs as an online player (Tiger fails it after 60 s otherwise)
function TestEvent({ tg, busy, players, targetType, id, label }) {
  const [as, setAs] = useState("");
  const names = players.map((x) => x.name).filter(Boolean).sort();
  return <Row>
    <Note>{label} as</Note>
    <Sel value={as} onChange={setAs} options={[["", names.length ? "pick an online player" : "nobody online"], ...names]} />
    <Btn disabled={!as || !id || !!busy} onClick={() => tg("ADMIN_START_OPERATION", { targetType, id }, { as })}
      title="Their name becomes the Mission Team; waves spawn at the site, so they should be there">Start test</Btn>
  </Row>;
}

function Manifest({ sel, tg, busy }) {
  const [rows, setRows] = useState([]);
  useEffect(() => { setRows(list(sel.requirements).map((r) => ({ item: r.item, qty: r.qty, cp: r.cp, accepted: r.accepted || 0 }))); }, [sel.id, JSON.stringify(sel.requirements)]);
  const set = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const locked = sel.restored || sel.online;
  return <Box title="Manifest (what players donate)" right={<>
    <Btn disabled={!!busy || locked} onClick={() => tg("UPDATE_REQUIREMENTS", { stationId: sel.id, requirements: rows.map((r) => ({ item: r.item.trim(), qty: n(r.qty), cp: n(r.cp) })) })}>Save manifest</Btn>
    <Btn color={C.grey} disabled={!!busy || locked} onClick={() => tg("UPDATE_REQUIREMENTS", { stationId: sel.id, restoreDefaults: true })}>Restore defaults</Btn>
    <Btn color={C.orange} disabled={!!busy || locked} onClick={() => tg("ADMIN_FILL_REQUIREMENTS", { stationId: sel.id })}>Fill all</Btn></>}>
    {locked && <Note>Restored / online: the manifest is locked (reset the station's progress to change it).</Note>}
    <Note>Item: a full id like Base.Plank, or a category like cat:Literature. CP = points each one gives.</Note>
    {rows.map((r, i) => <Row key={i}>
      <input value={r.item} onChange={(e) => set(i, "item", e.target.value)} style={{ ...inp, width: 190 }} />
      <Note>qty</Note><Num value={r.qty} min={1} onChange={(v) => set(i, "qty", v)} width={70} />
      <Note>cp</Note><Num value={r.cp} min={1} onChange={(v) => set(i, "cp", v)} width={60} />
      <Note>given {r.accepted}</Note>
      <Btn color={C.red} onClick={() => setRows(rows.filter((_, j) => j !== i))}>x</Btn>
    </Row>)}
    <Row><Btn color={C.grey} onClick={() => setRows([...rows, { item: "Base.", qty: 1, cp: 1, accepted: 0 }])}>Add row</Btn></Row>
  </Box>;
}

// ─── Missions ──────────────────────────────────────────────────────────────────────────────────────────────────────
function Missions(p) {
  const { sites, sel, selId, setSelId, snap, town, townId, tg, busy, pickSpot, floor, players } = p;
  const mine = sites.filter((s) => s.kind === "Objective" && (!townId || s.townId === townId));
  const place = () => pickSpot("Click where the mission site goes.", async (w) => {
    const a = await tg("PLACE_STATION", { x: w.x, y: w.y, z: floor });
    if (a?.ok) p.note(true, "Placed. Pick it on the Stations page (Unconfigured) and set Role = Mission site.");
  });
  const o = sel && sel.kind === "Objective" ? sel : null;
  return <>
    <Box title={`Mission sites${town ? " in " + town.name : ""}`} right={<Btn color={C.teal} disabled={!!busy} onClick={place}>Place on map</Btn>}>
      {mine.length === 0 && <Note>No mission sites. Place a station and give it the role "Mission site".</Note>}
      {mine.map((s) => <SiteRow key={s.id} s={s} snap={snap} active={s.id === selId} onClick={() => { setSelId(s.id); flyTo(s.x, s.y, 1.4); }} />)}
    </Box>
    {o && <>
      <Box title={`${o.name} · ${o.missionType || ""}`}>
        <KV k="State" v={`${o.activationState || "OFFLINE"}${o.discovered ? " · discovered" : ""}${o.oneTimeComplete ? " · one-time done" : ""}`} />
        <KV k="Repeats" v={`${o.repeatableCount || 0}${o.repeatableReadyAt ? " · ready " + when(o.repeatableReadyAt) : ""}`} />
        {o.activeMissionId && <KV k="Running" v={o.activeMissionId} color={C.gold} />}
        <Row>
          <Btn disabled={!!busy} onClick={() => tg("ADMIN_STATION_BYPASS", { id: o.id, action: "FORCE_DISCOVER" })}>Force discover</Btn>
          <Btn disabled={!!busy} onClick={() => tg("ADMIN_STATION_BYPASS", { id: o.id, action: "FORCE_ACTIVATE" })}>Force activate</Btn>
          <Btn disabled={!!busy} onClick={() => tg("ADMIN_STATION_BYPASS", { id: o.id, action: "FORCE_LINK" })}>Force link</Btn>
        </Row>
        <Row>
          <Btn disabled={!!busy || !!o.activeMissionId} onClick={() => tg("ADMIN_MISSION_ACTION", { objectiveId: o.id, action: "FORCE_READY" })}>Force ready</Btn>
          <Btn disabled={!!busy || !!o.activeMissionId} onClick={() => tg("ADMIN_MISSION_ACTION", { objectiveId: o.id, action: "RESET_COOLDOWN" })}>Reset cooldown</Btn>
          <Btn disabled={!!busy || !!o.activeMissionId} onClick={() => tg("ADMIN_MISSION_ACTION", { objectiveId: o.id, action: "COMPLETE_ONE_TIME" })}>Complete one-time</Btn>
          <Btn disabled={!!busy || !!o.activeMissionId} onClick={() => tg("ADMIN_MISSION_ACTION", { objectiveId: o.id, action: "RESET_ONE_TIME" })}>Reset one-time</Btn>
        </Row>
        <TestEvent tg={tg} busy={busy} players={players} targetType="objective" id={o.id} label="Start a test event" />
      </Box>
      <SiteEditor {...p} />
    </>}
  </>;
}

// ─── Events (active operations) ────────────────────────────────────────────────────────────────────────────────────
function Events({ snap, tg, busy, towns }) {
  const ops = vals(snap.operations).sort((a, b) => n(b.createdAt) - n(a.createdAt));
  const now = snap.serverNow;
  const [cp, setCp] = useState({ townId: "", stationId: "", playerKey: "", delta: 10 });
  const specialized = vals(snap.stations).filter((s) => s.kind === "Specialized" && (!cp.townId || s.townId === cp.townId));
  const op = (tk, o) => tg(tk, { operationId: o.id });
  return <>
    {ops.length === 0 && <Note>No operation is running.</Note>}
    {ops.map((o) => <Box key={o.id} title={`${o.kind} · ${o.phase}${o.terminal ? " · ended" : ""}`}
      right={o.anchorId && <Btn color={C.grey} onClick={() => { const s = (snap.stations || {})[o.anchorId] || (snap.objectives || {})[o.anchorId]; if (s) flyTo(s.x, s.y, 1.4); }}>Show</Btn>}>
      <KV k="Town" v={(snap.towns || {})[o.townId]?.name || o.townId || "?"} />
      <KV k="Team" v={[o.owner, ...list(o.missionTeam?.members).filter((m) => m !== o.owner)].filter(Boolean).join(", ") || "?"} />
      <KV k="Step" v={`${o.step ?? "?"} / ${o.stepsTotal ?? "?"}${o.operator ? " · operator " + o.operator : ""}`} />
      {[["prepareUntil", "Preparing until"], ["workDeadline", "Work deadline"], ["cooldownUntil", "Cooldown until"], ["containmentUntil", "Containment until"], ["finalizeAt", "Finalizing at"]]
        .filter(([k]) => o[k]).map(([k, l]) => <KV key={k} k={l} v={`${when(o[k])} (${left(o[k], now)})`} />)}
      {o.htc && <KV k="HTC" v={`alive ${o.htc.alive ?? "?"} · spawned ${o.htc.spawned ?? "?"} · killed ${o.htc.killed ?? "?"}`} />}
      {o.failureReason && <KV k="Failure" v={o.failureReason} color={C.red} />}
      <Row>
        <Btn disabled={!!busy} onClick={() => op("ADMIN_BYPASS_STEP", o)}>Bypass step</Btn>
        <Btn disabled={!!busy} onClick={() => op("ADMIN_CLEAR_WAIT", o)}>Clear wait</Btn>
        <Btn disabled={!!busy} onClick={() => op("ADMIN_FORCE_FINAL_RESPONSE", o)}>Final response</Btn>
        <Btn disabled={!!busy} onClick={() => op("ADMIN_CLEAR_HTC", o)}>Force complete HTC</Btn>
      </Row>
      {o.phase === "MINIGAME" && <Row>
        <Note>Minigame</Note>
        <Btn disabled={!!busy} onClick={() => op("ADMIN_MINIGAME_RESTART", o)}>Restart</Btn>
        <Btn disabled={!!busy} onClick={() => op("ADMIN_MINIGAME_CANCEL", o)}>Cancel attempt</Btn>
        <Btn color={C.green} disabled={!!busy} onClick={() => op("ADMIN_MINIGAME_FORCE_SUCCESS", o)}>Force success</Btn>
        <Btn color={C.red} disabled={!!busy} onClick={() => op("ADMIN_MINIGAME_FORCE_FAILURE", o)}>Force failure</Btn>
        <Btn disabled={!!busy} onClick={() => op("ADMIN_MINIGAME_SKIP", o)}>Skip</Btn>
      </Row>}
      <Row>
        <Sure color={C.orange} disabled={!!busy} onClick={() => op("ADMIN_COMPLETE_OPERATION", o)} title="Completes it with no rewards (admin bypass)">Complete (no rewards)</Sure>
        <Sure disabled={!!busy} onClick={() => op("ADMIN_RESET_OPERATION", o)} title="Fails it and clears retry locks">Reset operation</Sure>
      </Row>
    </Box>)}
    <Box title="Contribution points correction">
      <Note>Adds or takes away a player's contribution points at one Specialized station.</Note>
      <Row>
        <Sel value={cp.townId} onChange={(v) => setCp({ ...cp, townId: v, stationId: "" })} options={[["", "Town..."], ...towns.map((t) => [t.id, t.name])]} />
        <Sel value={cp.stationId} onChange={(v) => setCp({ ...cp, stationId: v })} options={[["", "Station..."], ...specialized.map((s) => [s.id, `${s.name} (${s.specialization})`])]} />
        <input placeholder="player name" value={cp.playerKey} onChange={(e) => setCp({ ...cp, playerKey: e.target.value })} style={{ ...inp, width: 130 }} />
        <Num value={cp.delta} min={-100000} max={100000} onChange={(v) => setCp({ ...cp, delta: v })} />
        <Btn disabled={!!busy || !cp.townId || !cp.stationId || !cp.playerKey.trim() || !n(cp.delta)}
          onClick={() => tg("ADMIN_ADJUST_CP", { townId: cp.townId, stationId: cp.stationId, playerKey: cp.playerKey.trim(), delta: n(cp.delta) })}>Apply</Btn>
      </Row>
    </Box>
  </>;
}

// ─── HTC (the zombie response to work at a site) ───────────────────────────────────────────────────────────────────
function Htc({ snap, ref, town, tg, busy }) {
  const [scope, setScope] = useState("GLOBAL");
  const fields = list(ref.htcFields);
  const overrides = scope === "TOWN" ? (snap.adminConfig?.towns?.[town?.id]?.htc || {}) : (snap.adminConfig?.global?.htc || {});
  const effective = (town && snap.effectiveHTC?.[town.id]) || {};
  const [draft, setDraft] = useState({});
  useEffect(() => { setDraft({ ...overrides }); }, [scope, town?.id, JSON.stringify(overrides)]);
  const groups = [...new Set(fields.map((f) => f.group))];
  const save = () => {
    const values = {}, remove = [];
    for (const f of fields) {
      const d = draft[f.key], o = overrides[f.key];
      if ((d === "" || d === undefined) && o !== undefined) remove.push(f.key);
      else if (d !== "" && d !== undefined && Number(d) !== Number(o)) values[f.key] = Math.round(Number(d));
    }
    if (remove.length) values.__remove = remove;
    tg("ADMIN_UPDATE_CONFIG", { section: "HTC", scope, ...(scope === "TOWN" ? { townId: town?.id } : {}), values });
  };
  return <Box title="HTC (zombie response)" right={<>
    <Sel value={scope} onChange={setScope} options={[["GLOBAL", "Every town"], ["TOWN", `Only ${town?.name || "this town"}`]]} />
    <Btn disabled={!!busy || (scope === "TOWN" && !town)} onClick={save}>Save changes</Btn>
    <Sure color={C.orange} disabled={!!busy || (scope === "TOWN" && !town)} onClick={() => tg("ADMIN_UPDATE_CONFIG", { section: "HTC", scope, ...(scope === "TOWN" ? { townId: town?.id } : {}), values: { __clear: true } })}>Clear overrides</Sure></>}>
    <Note>Blank = not overridden here (inherits). "Now" = what {town?.name || "the picked town"} actually uses.</Note>
    {groups.map((g) => <div key={g}>
      <div style={{ ...mono, fontSize: 11, color: C.teal, margin: "6px 0 2px" }}>{g}</div>
      {fields.filter((f) => f.group === g).map((f) => <Row key={f.key}>
        <span style={{ ...mono, fontSize: 12, minWidth: 200 }}>{f.label}</span>
        <Num value={draft[f.key] ?? ""} min={f.min} max={f.max} onChange={(v) => setDraft({ ...draft, [f.key]: v === "" ? "" : Math.max(f.min, Math.min(f.max, v)) })} />
        <Note>{f.unit} · {f.min}-{f.max} · now {effective[f.key] ?? "?"}</Note>
      </Row>)}
    </div>)}
  </Box>;
}

// ─── Bosses ────────────────────────────────────────────────────────────────────────────────────────────────────────
function Bosses({ snap, ref, towns, town, tg, busy, pickSpot, floor }) {
  const ba = snap.bossAdmin || {};
  const [sp, setSp] = useState({ kind: "deer", difficulty: 3, hp: "", townId: "", rewards: true });
  const [hp, setHp] = useState({});
  const spawn = () => pickSpot("Click near an online player (the boss spawns 4-12 tiles from there, on loaded ground).", (w) =>
    tg("ADMIN_BOSS_SPAWN", { kind: sp.kind, difficulty: sp.difficulty, ...(sp.hp ? { hp: n(sp.hp) } : {}), ...(sp.townId ? { townId: sp.townId } : {}), rewards: sp.rewards },
      { sx: w.x, sy: w.y, sz: floor }));
  const act = (b, action, extra = {}) => tg("ADMIN_BOSS_ACTION", { id: b.id, action, ...extra });
  const here = (b) => pickSpot(`Click where ${b.name || b.kind} should go (loaded ground near a player).`, (w) => tg("ADMIN_BOSS_ACTION", { id: b.id, action: "TELEPORT_HERE" }, { sx: w.x, sy: w.y, sz: floor }));
  return <>
    <Box title="Spawn a boss" right={<Btn color={C.red} disabled={!!busy || (sp.rewards && !sp.townId)} onClick={spawn}>Spawn (map click)</Btn>}>
      <Row>
        <Field label="Animal"><Sel value={sp.kind} onChange={(v) => setSp({ ...sp, kind: v })} options={list(ref.bossKinds).length ? list(ref.bossKinds) : ["deer"]} /></Field>
        <Field label="Difficulty"><Sel value={sp.difficulty} onChange={(v) => setSp({ ...sp, difficulty: Number(v) })} options={[1, 2, 3, 4, 5, 6].map((d) => [d, `D${d}`])} /></Field>
        <Field label={`HP (blank = auto, ${ref.bossHP?.min ?? 50}-${ref.bossHP?.max ?? 500})`}><Num value={sp.hp} min={50} max={500} onChange={(v) => setSp({ ...sp, hp: v })} /></Field>
        <Field label="Rewards for town"><Sel value={sp.townId} onChange={(v) => setSp({ ...sp, townId: v })} options={[["", "none"], ...towns.map((t) => [t.id, t.name])]} /></Field>
        <Check value={sp.rewards} onChange={(v) => setSp({ ...sp, rewards: v })} label="Rewards" />
      </Row>
      {sp.rewards && !sp.townId && <Note color={C.gold}>With rewards on, pick the town they count for.</Note>}
      <Note>The map click has to be near someone online: the server only has ground loaded around players.</Note>
    </Box>
    <Box title={`Active bosses (${list(ba.active).length})`}>
      {list(ba.active).length === 0 && <Note>None.</Note>}
      {list(ba.active).map((b) => <div key={b.id} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
        <KV k={b.name || b.kind} v={`HP ${b.currentHP ?? b.health ?? "?"}/${b.maxHP ?? b.maxHealth ?? "?"} · D${b.difficulty} · ${b.status || ""} · ${b.source || ""}${b.x ? ` · ${Math.round(b.x)},${Math.round(b.y)}` : ""}`} />
        <Row>
          {b.x && <Btn color={C.grey} onClick={() => flyTo(b.x, b.y, 1.4)}>Show</Btn>}
          <Btn disabled={!!busy} onClick={() => act(b, "HEAL")}>Heal full</Btn>
          <Btn disabled={!!busy} onClick={() => act(b, "DAMAGE_25")}>Damage 25%</Btn>
          <Num value={hp[b.id] ?? ""} min={1} max={500} width={64} onChange={(v) => setHp({ ...hp, [b.id]: v })} />
          <Btn disabled={!!busy || !n(hp[b.id])} onClick={() => act(b, "SET_HP", { hp: n(hp[b.id]) })}>Set HP</Btn>
          <Btn disabled={!!busy} onClick={() => here(b)}>Boss here (map)</Btn>
          <Sure disabled={!!busy} onClick={() => act(b, "KILL")}>Kill</Sure>
          <Sure color={C.orange} disabled={!!busy} onClick={() => act(b, "DESPAWN")}>Despawn</Sure>
        </Row>
      </div>)}
    </Box>
    <BossRewards ba={ba} tg={tg} busy={busy} />
    <Box title="Boss history">
      {list(ba.history).slice(0, 40).map((h, i) => <Note key={i} color={C.text}>{when(h.at)} · {h.name || h.kind} D{h.difficulty} · {h.result}{h.killer ? " by " + h.killer : ""}</Note>)}
      {!list(ba.history).length && <Note>Nothing yet.</Note>}
    </Box>
  </>;
}

function BossRewards({ ba, tg, busy }) {
  const cfg = ba.rewardConfig || {};
  const [pool, setPool] = useState("weapons");
  const [pools, setPools] = useState({});
  const [chance, setChance] = useState({});
  const [prev, setPrev] = useState(3);
  useEffect(() => {
    const src = cfg.pools || cfg;
    const p = {};
    for (const k of BOSS_POOLS) p[k] = list(src?.[k]).map((r) => ({ item: r.item || r.fullType || "", minDifficulty: r.minDifficulty ?? 1, qtyMin: r.qtyMin ?? 1, qtyMax: r.qtyMax ?? 1, weight: r.weight ?? 10, specialOnly: !!r.specialOnly }));
    setPools(p);
    const sc = ba.specialChance || {};
    const c = {};
    for (let d = 1; d <= 6; d++) c[d] = sc[d] ?? sc[String(d)] ?? [10, 15, 25, 40, 60, 80][d - 1];
    setChance(c);
  }, [JSON.stringify(cfg), JSON.stringify(ba.specialChance)]);
  const rows = pools[pool] || [];
  const set = (i, k, v) => setPools({ ...pools, [pool]: rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)) });
  const save = () => tg("ADMIN_BOSS_REWARD_SAVE", { pools: Object.fromEntries(BOSS_POOLS.map((k) => [k, (pools[k] || []).filter((r) => r.item.trim()).map((r) => ({ ...r, item: r.item.trim(),
    minDifficulty: n(r.minDifficulty) || 1, qtyMin: n(r.qtyMin) || 1, qtyMax: Math.max(n(r.qtyMin) || 1, n(r.qtyMax) || 1), weight: n(r.weight) || 10 }))])),
    specialChance: Object.fromEntries(Object.entries(chance).map(([d, v]) => [String(d), n(v)])) });
  return <Box title="Boss reward pools" right={<>
    <Btn disabled={!!busy} onClick={save}>Save pools</Btn>
    <Sure color={C.orange} disabled={!!busy} onClick={() => tg("ADMIN_BOSS_REWARD_RESET", {})}>Restore auto defaults</Sure>
    <Sel value={prev} onChange={(v) => setPrev(Number(v))} options={[1, 2, 3, 4, 5, 6].map((d) => [d, `D${d}`])} />
    <Btn color={C.grey} disabled={!!busy} onClick={() => tg("ADMIN_BOSS_REWARD_PREVIEW", { difficulty: prev })}>Preview</Btn></>}>
    <Row>{BOSS_POOLS.map((k) => <Btn key={k} color={pool === k ? C.teal : C.grey} onClick={() => setPool(k)}>{k} ({(pools[k] || []).length})</Btn>)}</Row>
    {rows.map((r, i) => <Row key={i}>
      <input value={r.item} onChange={(e) => set(i, "item", e.target.value)} style={{ ...inp, width: 180 }} />
      <Note>from D</Note><Num value={r.minDifficulty} min={1} max={6} width={46} onChange={(v) => set(i, "minDifficulty", v)} />
      <Note>qty</Note><Num value={r.qtyMin} min={1} max={50} width={50} onChange={(v) => set(i, "qtyMin", v)} />
      <Note>-</Note><Num value={r.qtyMax} min={1} max={50} width={50} onChange={(v) => set(i, "qtyMax", v)} />
      <Note>weight</Note><Num value={r.weight} min={1} max={1000} width={60} onChange={(v) => set(i, "weight", v)} />
      <Check value={r.specialOnly} onChange={(v) => set(i, "specialOnly", v)} label="special" />
      <Btn color={C.red} onClick={() => setPools({ ...pools, [pool]: rows.filter((_, j) => j !== i) })}>x</Btn>
    </Row>)}
    <Row><Btn color={C.grey} onClick={() => setPools({ ...pools, [pool]: [...rows, { item: "Base.", minDifficulty: 1, qtyMin: 1, qtyMax: 1, weight: 10, specialOnly: pool === "special" }] })}>Add row</Btn></Row>
    <Row><Note>Special loot chance %</Note>{[1, 2, 3, 4, 5, 6].map((d) => <span key={d} style={{ display: "inline-flex", gap: 3, alignItems: "center" }}><Note>D{d}</Note>
      <Num value={chance[d]} min={0} max={100} width={50} onChange={(v) => setChance({ ...chance, [d]: Math.max(0, Math.min(100, n(v))) })} /></span>)}</Row>
  </Box>;
}

// ─── Rewards ───────────────────────────────────────────────────────────────────────────────────────────────────────
function Rewards({ st, snap, town, tg, busy }) {
  const ents = list(st?.entitlementsRaw?.[town?.id]).sort((a, b) => n(b.createdAt) - n(a.createdAt));
  const [onlyBad, setOnlyBad] = useState(false);
  const shown = ents.filter((e) => !onlyBad || e.status === "FAILED" || e.status === "DELIVERY_PENDING");
  const cfg = town?.config || {};
  const [d, setD] = useState(null);
  useEffect(() => {
    if (!town) return;
    const pools = cfg.rewardPools || {}, cp = cfg.contributionPools || {}, rolls = cfg.dailyRolls || {};
    setD({ dailyEnabled: cfg.dailyEnabled !== false, every: cfg.contributionRewardEveryCP ?? 20, milestones: list(cfg.contributionMilestones).join(", "),
      rolls: Object.fromEntries([0, 1, 2, 3, 4].map((k) => [k, rolls[k] ?? rolls[String(k)] ?? 1])),
      pools: Object.fromEntries(["r0", "r1", "r2", "r3", "r4"].map((k) => [k, list(pools[k]).join("\n")])), small: list(cp.small).join("\n"), milestone: list(cp.milestone).join("\n") });
  }, [town?.id, JSON.stringify(cfg)]);
  if (!town) return <Note>Pick a town at the top.</Note>;
  const apply = () => tg("UPDATE_REWARD_CONFIG", { townId: town.id, expectedRevision: cfg.rewardConfigRevision, dailyEnabled: d.dailyEnabled,
    contributionRewardEveryCP: n(d.every), contributionMilestones: lines(d.milestones).map(Number).filter((x) => x > 0).sort((a, b) => a - b),
    dailyRolls: Object.fromEntries(Object.entries(d.rolls).map(([k, v]) => [String(k), Math.max(1, Math.min(10, n(v)))])),
    rewardPools: Object.fromEntries(Object.entries(d.pools).map(([k, v]) => [k, lines(v)])), contributionPools: { small: lines(d.small), milestone: lines(d.milestone) } });
  return <>
    <Box title={`Reward deliveries in ${town.name} (${ents.length})`} right={<Check value={onlyBad} onChange={setOnlyBad} label="Failed / pending only" />}>
      {shown.length === 0 && <Note>None.</Note>}
      {shown.slice(0, 80).map((e) => <Row key={e.id + e.playerKey}>
        <span style={{ ...mono, fontSize: 12, flex: 1 }}>{when(e.createdAt)} · {e.name} · {e.source} · {list(e.items).map((i) => `${i.item}${i.qty > 1 ? " x" + i.qty : ""}`).join(", ")}</span>
        <span style={{ ...mono, fontSize: 11, color: e.status === "FAILED" ? C.red : e.status === "CLAIMED" ? C.green : C.gold }}>{e.status}</span>
        {(e.status === "FAILED" || e.status === "DELIVERY_PENDING") && <Btn disabled={!!busy} title="The player must be online"
          onClick={() => tg("ADMIN_REWARD_RETRY", { townId: town.id, playerKey: e.playerKey, entitlementId: e.id })}>Retry</Btn>}
      </Row>)}
    </Box>
    {d && <Box title={`Reward tables (revision ${cfg.rewardConfigRevision ?? "?"})`} right={<>
      <Btn disabled={!!busy} onClick={apply}>Apply</Btn>
      <Sure color={C.orange} disabled={!!busy} onClick={() => tg("UPDATE_REWARD_CONFIG", { townId: town.id, restoreDefaults: true })}>Restore defaults</Sure>
      <Btn color={C.grey} disabled={!!busy} onClick={() => tg("ADMIN_REWARD_PREVIEW", { townId: town.id })}>Preview a reward</Btn></>}>
      <Row><Check value={d.dailyEnabled} onChange={(v) => setD({ ...d, dailyEnabled: v })} label="Daily rewards" />
        <Note>Small reward every</Note><Num value={d.every} min={1} onChange={(v) => setD({ ...d, every: v })} /><Note>CP</Note></Row>
      <Field label="Milestones (CP, comma separated)"><input value={d.milestones} onChange={(e) => setD({ ...d, milestones: e.target.value })} style={{ ...inp, width: 260 }} /></Field>
      <Row><Note>Daily rolls per stage</Note>{[0, 1, 2, 3, 4].map((k) => <span key={k} style={{ display: "inline-flex", gap: 3, alignItems: "center" }}><Note>R{k}</Note>
        <Num value={d.rolls[k]} min={1} max={10} width={46} onChange={(v) => setD({ ...d, rolls: { ...d.rolls, [k]: v } })} /></span>)}</Row>
      <Note>One item id per line (Base.Axe). Every list needs at least one item.</Note>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 6 }}>
        {["r0", "r1", "r2", "r3", "r4"].map((k) => <Field key={k} label={`Daily pool ${k.toUpperCase()}`}>
          <textarea rows={6} value={d.pools[k]} onChange={(e) => setD({ ...d, pools: { ...d.pools, [k]: e.target.value } })} style={{ ...inp, width: "100%" }} /></Field>)}
        <Field label="Contribution: small"><textarea rows={6} value={d.small} onChange={(e) => setD({ ...d, small: e.target.value })} style={{ ...inp, width: "100%" }} /></Field>
        <Field label="Contribution: milestone"><textarea rows={6} value={d.milestone} onChange={(e) => setD({ ...d, milestone: e.target.value })} style={{ ...inp, width: "100%" }} /></Field>
      </div>
    </Box>}
  </>;
}

// ─── Settings ──────────────────────────────────────────────────────────────────────────────────────────────────────
function Settings({ snap, ref, tg, busy }) {
  const rc = snap.runtimeConfig || {};
  const current = (k, where) => (where === "missionArea" ? rc.missionArea?.[k] ?? ref.missionArea?.[k] : rc.defaults?.[k] ?? ref.defaults?.[k]);
  const [d, setD] = useState({});
  useEffect(() => { setD(Object.fromEntries(SETTINGS.map(([k, , w]) => [k, current(k, w) ?? ""]))); }, [JSON.stringify(rc), JSON.stringify(ref.defaults)]);
  const save = () => {
    const values = {};
    for (const [k, , w] of SETTINGS) if (d[k] !== "" && Number(d[k]) !== Number(current(k, w))) values[k] = Math.max(0, Math.floor(n(d[k])));
    if (!Object.keys(values).length) return;
    tg("ADMIN_UPDATE_CONFIG", { section: "SETTINGS", scope: "GLOBAL", values });
  };
  return <Box title="Settings (every town, applied live)" right={<Btn disabled={!!busy} onClick={save}>Save</Btn>}>
    {SETTINGS.map(([k, l, w]) => <Row key={k}><span style={{ ...mono, fontSize: 12, minWidth: 250 }}>{l}</span>
      <Num value={d[k]} min={0} onChange={(v) => setD({ ...d, [k]: v })} /><Note>now {current(k, w) ?? "?"}</Note></Row>)}
  </Box>;
}

// ─── History (Tiger's audit log) ───────────────────────────────────────────────────────────────────────────────────
function History({ snap }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState("");
  const all = list(snap.audit).slice().reverse();
  const s = q.trim().toLowerCase();
  const shown = all.filter((a) => !s || `${a.actor} ${a.action} ${a.target} ${a.details}`.toLowerCase().includes(s));
  return <Box title={`Tiger's audit log (${all.length})`} right={<input placeholder="filter: actor, action, text" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...inp, width: 200 }} />}>
    {shown.slice(0, 200).map((a) => <div key={a.id}>
      <div onClick={() => setOpen(open === a.id ? "" : a.id)} style={{ ...mono, fontSize: 12, cursor: "pointer" }}>
        <span style={{ color: C.grey }}>{when(a.at)}</span> · <span style={{ color: String(a.actor).startsWith("web:") ? C.teal : C.text }}>{a.actor}</span> · {a.action} · {a.target} {a.details ? "· " + a.details : ""}
      </div>
      {open === a.id && <Pre>{JSON.stringify({ before: a.before, after: a.after }, null, 1)}</Pre>}
    </div>)}
    {!shown.length && <Note>Nothing matches.</Note>}
  </Box>;
}

// ─── Diagnostics ───────────────────────────────────────────────────────────────────────────────────────────────────
function Diag({ st, snap, sel, town }) {
  return <>
    <Box title="Diagnostics">
      <KV k="Tiger installed" v={String(st?.installed)} />
      <KV k="Persistence ready" v={String(st?.ready)} color={st?.ready ? C.green : C.red} />
      <KV k="Version" v={st?.version || "?"} />
      <KV k="Build" v={st?.build || "?"} />
      <KV k="Data revision" v={String(st?.dataRevision ?? "?")} />
      <KV k="Overview age" v={st?.age != null ? `${st.age} s` : "?"} />
      <KV k="Network epoch / seq" v={`${snap.netEpoch ?? "?"} / ${snap.netSequence ?? "?"}`} />
      {st?.failure && <Pre>{JSON.stringify(st.failure, null, 1)}</Pre>}
    </Box>
    {town && <Box title={`Raw town: ${town.name}`}><Pre>{JSON.stringify(town, null, 1)}</Pre></Box>}
    {sel && <Box title={`Raw site: ${sel.name}`}><Pre>{JSON.stringify(sel, null, 1)}</Pre></Box>}
  </>;
}
