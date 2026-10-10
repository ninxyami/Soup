// @ts-nocheck
"use client";
// components/ops/PantherTab.tsx - the PANTHER tab in Live Ops' Zombita mode (2026-10-05, mod 1.7.134 ZO_Panther.lua).
// Panther (Workshop mod SOUPLootBalancer) sets the server's loot rules. Everything here goes through the game: the bot's
// /api/admin/ops/panther queues a pa_* request in Live Ops' request file, the game runs it (Panther's own code for
// profiles, ZO_Panther for area jobs) and writes the full answer, which /api/admin/ops/panther/reply/<id> returns.
// Pages: Overview, Profiles (edit / copy / delete / import / export, preview + apply live, item search), Loot zones (1.7.161,
// Panther 0.10: every saved zone on the map, filter / open / edit / draw / delete), Maze (Panther's TME event tiles on the
// map), Area tools (refill / clear / refresh / reconcile on a map pick), History (Panther's own log) and Diagnostics.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API } from "@/lib/constants";

const C = { gold: "#c8a84b", blue: "#4a8fc4", green: "#4caf7d", red: "#e05555", purple: "#9775cc", grey: "#9aa", text: "#e6e6e6", bg: "#0b0d10", panel: "#111418", line: "#2a2f37", teal: "#4ab0a8" };
const mono = { fontFamily: "var(--mono, monospace)" };
const inp = { ...mono, fontSize: 12, padding: "5px 7px", background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 3, boxSizing: "border-box" };

const PAGES = [["overview", "Overview"], ["profiles", "Profiles"], ["zones", "Loot zones"], ["maze", "Maze"], ["area", "Area tools"], ["history", "History"], ["diag", "Diagnostics"]];
const CATEGORIES = [
  ["Food", "Food"], ["CannedFood", "Canned Food"], ["Medical", "Medical"], ["Weapon", "Weapons"], ["RangedWeapon", "Ranged Weapons"], ["Ammo", "Ammo"],
  ["SurvivalGears", "Survival Gear"], ["ProtectiveGear", "Protective Gear"], ["Mechanics", "Mechanics"], ["Container", "Containers / Bags"], ["Material", "Materials"],
  ["Farming", "Farming"], ["Tool", "Tools"], ["Literature", "Literature"], ["SkillBook", "Skill Books"], ["RecipeResource", "Recipe Resources"],
  ["Clothing", "Clothing"], ["Cookware", "Cookware"], ["Media", "Media"], ["Memento", "Mementos"], ["Other", "Other"], ["Key", "Keys"],
];
const STEPS = [["DEFAULT", 1], ["75%", 0.75], ["50%", 0.5], ["25%", 0.25], ["10%", 0.1], ["5%", 0.05], ["REMOVE", 0]];
const FILTERS = ["All Items", "Vanilla", "Modded", "Removed", "Modified", "Unchanged", "Missing / Invalid", "Exact Overrides", ...CATEGORIES.map((c) => c[1])];
const ACTIONS = [
  ["refill", "Refill", "Rolls fresh loot into containers (empty ones only, or on top of what's there)."],
  ["clear", "Clear", "Deletes everything in the containers."],
  ["refresh", "Refresh", "Clears, then rolls fresh loot."],
  ["reconcile", "Reconcile", "Takes out only items the live rules REMOVE."],
];
const SCOPES = [["rect", "Rectangle (2 clicks)"], ["radius", "Radius around a spot"], ["building", "Whole building"], ["room", "One room"], ["spot", "One spot (every container on it)"]];
const ROMAN = ["I", "II", "III", "IV", "V"];

const n = (v) => Number(v) || 0;
const list = (v) => (Array.isArray(v) ? v : []);
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
function label(m) {
  if (m === null || m === undefined || m === "") return "INHERIT";
  const v = Number(m);
  if (v === 0) return "REMOVE";
  if (v === 1) return "DEFAULT";
  const pct = v * 100;
  return Math.abs(pct - Math.round(pct)) < 1e-6 ? `${Math.round(pct)}%` : `${pct.toFixed(2)}%`;
}
function when(ms) {
  const v = n(ms);
  if (!v) return "";
  const d = new Date(v > 1e12 ? v : v * 1000);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function parseRules(text) {
  const out = {};
  for (const t of String(text || "").split(/[;\r\n]+/)) {
    const m = t.trim().match(/^([\w.\-]+)\s*[=:]\s*([\d.eE+\-]+)$/);
    if (m) out[m[1].includes(".") ? m[1] : "Base." + m[1]] = Number(m[2]);
  }
  return out;
}
function parseRemoved(text) {
  return String(text || "").split(/[;\r\n]+/).map((s) => s.trim()).filter(Boolean).map((s) => (s.includes(".") ? s : "Base." + s));
}
// exact rules (ItemRules + RemovedItems) <-> one map id -> multiplier (0 = remove)
function exactOf(settings) {
  const m = parseRules(settings?.ItemRules);
  for (const id of parseRemoved(settings?.RemovedItems)) m[id] = 0;
  return m;
}
function withExact(settings, exact) {
  const ids = Object.keys(exact).sort();
  return { ...settings, ItemRules: ids.filter((i) => exact[i] !== 0).map((i) => `${i}=${+Number(exact[i]).toFixed(4)}`).join(";"),
    RemovedItems: ids.filter((i) => exact[i] === 0).join(";") };
}
const reply = (r, command) => (list(r?.replies).find((x) => x.command === command) || {}).args;

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
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><b style={{ fontSize: 13 }}>{title}</b><span style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>{right}</span></div>
      {children}
    </div>
  );
}
const Row = ({ children, style = {} }) => <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", ...style }}>{children}</div>;
const Note = ({ children, color = C.grey }) => <div style={{ ...mono, fontSize: 11, color, whiteSpace: "pre-wrap" }}>{children}</div>;
function KV({ k, v, color = C.text }) {
  return <div style={{ ...mono, fontSize: 12, display: "flex", gap: 8 }}><span style={{ color: C.grey, minWidth: 140 }}>{k}</span><span style={{ color, wordBreak: "break-word" }}>{v}</span></div>;
}
const Pre = ({ children }) => <pre style={{ ...mono, fontSize: 11, color: C.text, whiteSpace: "pre-wrap", margin: 0, maxHeight: 360, overflowY: "auto", background: C.panel, padding: 8, borderRadius: 3 }}>{children}</pre>;

// A multiplier picker: the preset steps plus a custom number (0 to 10).
function Mult({ value, onChange, inherit = false, disabled = false }) {
  const v = value === undefined || value === null ? null : Number(value);
  const preset = v === null ? "inherit" : (STEPS.find((s) => s[1] === v) ? String(v) : "custom");
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <select disabled={disabled} value={preset} style={{ ...inp, padding: "3px 4px" }}
        onChange={(e) => { const x = e.target.value; if (x === "inherit") onChange(null); else if (x !== "custom") onChange(Number(x)); else onChange(v ?? 1); }}>
        {inherit && <option value="inherit">INHERIT</option>}
        {STEPS.map(([l, m]) => <option key={l} value={String(m)}>{l}</option>)}
        <option value="custom">custom</option>
      </select>
      {preset === "custom" && <input disabled={disabled} type="number" min={0} max={10} step={0.005} value={v ?? 1} style={{ ...inp, width: 70 }}
        onChange={(e) => onChange(Math.max(0, Math.min(10, Number(e.target.value) || 0)))} />}
    </span>
  );
}

export default function PantherTab({ setPick, setLayer, onWide }) {
  const [page, setPage] = useState("overview");
  const [st, setSt] = useState(null);                 // the game's overview (zombita_ops_panther.txt)
  const [prof, setProf] = useState(null);             // Panther's ProfilesState
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  useEffect(() => { onWide(page !== "area" && page !== "zones" && page !== "maze"); }, [page, onWide]);   // map pages keep the map wide
  useEffect(() => () => onWide(false), [onWide]);

  const note = (ok, text) => setMsg({ ok, text, at: Date.now() });
  // one request: queue it, then wait for the game's full answer
  const pa = useCallback(async (cmd, args = {}, quiet = false) => {
    setBusy(cmd === "pa_call" ? args.pc : cmd);
    try {
      const r = await fetch(`${API}/api/admin/ops/panther`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cmd, ...args }) });
      const q = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(q.detail || `HTTP ${r.status}`);
      for (let i = 0; i < 45; i++) {
        await sleep(i < 6 ? 500 : 1200);
        const a = await fetch(`${API}/api/admin/ops/panther/reply/${q.id}`, { credentials: "include" });
        const ans = await a.json().catch(() => ({}));
        if (!a.ok) throw new Error(ans.detail || `HTTP ${a.status}`);
        if (ans.done === false) continue;
        const ps = reply(ans, "ProfilesState");
        if (ps) setProf(ps);
        if (ans.state) setSt(ans.state);
        if (!quiet || !ans.ok) note(ans.ok, ans.msg);
        return ans;
      }
      throw new Error("No answer from the game in 45 s. Is anyone online? (The server pauses when it's empty; it runs when someone joins.)");
    } catch (e) { note(false, e.message); return null; }
    finally { setBusy(""); }
  }, []);
  const readState = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/admin/ops/panther/state`, { credentials: "include" });
      if (r.ok) { const d = await r.json(); if (d && d.ts) setSt(d); }
    } catch {}
  }, []);
  useEffect(() => { readState().then(() => { pa("pa_state", {}, true); pa("pa_call", { pc: "OpenUI" }, true); }); }, []);
  const running = !!st?.job;
  useEffect(() => {                                    // follow a running area job
    if (!running) return;
    const t = setInterval(readState, 2000);
    return () => clearInterval(t);
  }, [running, readState]);

  const snap = st?.snapshot || {};
  const ctx = { pa, st, prof, snap, busy, note, setPick, setLayer, readState };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Row>
        {PAGES.map(([k, l]) => <Btn key={k} color={page === k ? C.gold : C.grey} onClick={() => setPage(k)}>{l}</Btn>)}
        <span style={{ marginLeft: "auto" }}><Btn color={C.grey} disabled={!!busy} onClick={() => { pa("pa_state", {}, true); pa("pa_call", { pc: "OpenUI" }, true); }}>Refresh</Btn></span>
      </Row>
      {busy && <Note color={C.gold}>Asking the game: {busy}...</Note>}
      {msg && <Note color={msg.ok ? C.green : C.red}>{msg.text}</Note>}
      {st && st.installed === false && <Note color={C.red}>Panther isn't running on the server (or the mod is older than 1.7.134).</Note>}
      {!st && <Note>Waiting for the game's Panther overview (mod 1.7.134; the server answers only while someone is online).</Note>}
      {page === "overview" && <Overview {...ctx} />}
      {page === "profiles" && <Profiles {...ctx} />}
      {page === "zones" && <Zones {...ctx} />}
      {page === "maze" && <Maze {...ctx} />}
      {page === "area" && <Area {...ctx} />}
      {page === "history" && <History {...ctx} />}
      {page === "diag" && <Diag {...ctx} />}
    </div>
  );
}

// ── overview ────────────────────────────────────────────────────────────────
function Overview({ st, snap, prof }) {
  const j = st?.job;
  const live = (snap.lootPhase || "").match(/LIVE|APPLIED|FINALIZED/);
  return (<>
    <Box title="Live loot rules">
      <KV k="Active profile" v={snap.activeProfileName || prof?.active?.profileName || "?"} color={C.gold} />
      {snap.activeProfileDescription && <Note color={C.text}>{snap.activeProfileDescription}</Note>}
      <KV k="Rules" v={snap.lootPhase || "?"} color={live ? C.green : C.red} />
      <KV k="Rule revision" v={`${snap.activeRevision ?? "?"}${snap.pending ? ` (saved ${snap.revision}, not live yet)` : ""}`} />
      <KV k="Applied by" v={(snap.savedBy || prof?.active?.appliedBy) ? `${snap.savedBy || prof?.active?.appliedBy}${snap.savedAt ? " · " + when(snap.savedAt) : ""}` : "nobody yet (Panther's own default)"} />
      <KV k="Saved settings" v={snap.storageStatus || "?"} color={snap.storageError ? C.red : C.text} />
      <KV k="Panther" v={`${st?.version || "?"}${st?.ts ? ` · overview ${new Date(st.ts * 1000).toLocaleTimeString()}` : ""}`} />
      {st?.zones && <KV k="Loot zones" v={`${st.zones.count} (${st.zones.enabled} on, ${st.zones.highRisk} High Risk)`} />}
    </Box>
    <Box title="Area job">
      {j ? <>
        <KV k="Running" v={`${j.action} · ${j.label}`} color={C.gold} />
        <KV k="Progress" v={`${j.processed} / ${j.total} containers · +${j.added} / -${j.removed} items · ${j.filtered} filtered · ${j.skipped} skipped`} />
        <KV k="By" v={j.by} />
      </> : <Note>Nothing running.</Note>}
      {st?.lastResult && <Note color={C.text}>Last: {st.lastResult}</Note>}
      {st?.pantherRunning && <Note color={C.gold}>Panther's own area job is running in game (F2).</Note>}
    </Box>
    <Note>Panther multiplies the game's loot chances on top of the sandbox loot settings. 100% = DEFAULT (unchanged), REMOVE = never spawns. A profile change applies to loot rolled after it; what's already in containers stays until they're refilled.</Note>
  </>);
}

// ── profiles ────────────────────────────────────────────────────────────────
function Profiles({ pa, prof, busy, note }) {
  const rows = list(prof?.profiles);
  const [sel, setSel] = useState(null);             // ProfileDetail.profile (with settings)
  const [draft, setDraft] = useState(null);         // {name, description, settings}
  const [preview, setPreview] = useState(null);     // ProfileApplyPreview
  const [io, setIo] = useState(null);               // {mode: "export"|"import", text}
  const open = useCallback(async (id) => {
    const r = await pa("pa_call", { pc: "GetProfile", profileId: id }, true);
    const d = reply(r, "ProfileDetail");
    if (d?.profile) { setSel(d.profile); setDraft({ name: d.profile.name, description: d.profile.description, settings: { ...d.profile.settings } }); setPreview(null); }
  }, [pa]);
  useEffect(() => { if (!sel && prof?.active?.profileId) open(prof.active.profileId); }, [prof?.active?.profileId]);
  const take = (r) => { const d = reply(r, "ProfileDetail"); if (d?.profile) { setSel(d.profile); setDraft({ name: d.profile.name, description: d.profile.description, settings: { ...d.profile.settings } }); } };
  const cat = prof?.catalogRevision, ruleRev = prof?.active?.ruleRevision;
  const locked = !!sel?.builtIn;
  const dirty = sel && draft && (draft.name !== sel.name || draft.description !== sel.description || JSON.stringify(draft.settings) !== JSON.stringify(sel.settings));

  const save = async () => take(await pa("pa_call", { pc: "UpdateProfile", profileId: sel.id, profileRevision: sel.profileRevision, catalogRevision: cat,
    name: draft.name, description: draft.description, settings: draft.settings }));
  const dup = async () => {
    const name = prompt("Name for the copy:", `Copy of ${sel.name}`.slice(0, 64));
    if (name) take(await pa("pa_call", { pc: "DuplicateProfile", sourceProfileId: sel.id, catalogRevision: cat, name, description: sel.description }));
  };
  const fromLive = async () => {
    const name = prompt("Name for a new profile made from the live rules:");
    if (!name) return;
    const description = prompt("A short description:", "Saved from the live rules.") || "Saved from the live rules.";
    take(await pa("pa_call", { pc: "CreateProfile", catalogRevision: cat, ruleRevision: ruleRev, name, description }));
  };
  const del = async () => {
    if (!confirm(`Delete the profile "${sel.name}"? This can't be undone.`)) return;
    const r = await pa("pa_call", { pc: "DeleteProfile", profileId: sel.id, profileRevision: sel.profileRevision, catalogRevision: cat });
    if (r?.ok) { setSel(null); setDraft(null); }
  };
  const doPreview = async () => {
    const r = await pa("pa_call", { pc: "PreviewProfileApply", profileId: sel.id, profileRevision: sel.profileRevision, ruleRevision: ruleRev });
    const p = reply(r, "ProfileApplyPreview");
    if (p) setPreview({ ...p, at: Date.now() });
  };
  const apply = async () => {
    if (!confirm(`Apply "${preview.profile?.name}" LIVE? Every loot roll on the server uses it from now on.`)) return;
    const r = await pa("pa_call", { pc: "ConfirmProfileApply", token: preview.token });
    if (r?.ok) { setPreview(null); take(r); }
  };
  const doExport = async () => { const r = await pa("pa_export", { profileId: sel.id }); if (r?.ok) setIo({ mode: "export", text: r.text }); };
  const doImport = async () => {
    const r = await pa("pa_import", { text: io.text, catalogRevision: cat, name: io.name || "" });
    if (r?.ok) { setIo(null); take(r); }
  };

  return (<>
    <Box title={`Profiles (${rows.length})`} right={<>
      <Btn color={C.green} disabled={!!busy || ruleRev === undefined} onClick={fromLive}>New from live rules</Btn>
      <Btn color={C.blue} disabled={!!busy} onClick={() => setIo({ mode: "import", text: "", name: "" })}>Import</Btn>
    </>}>
      {rows.map((p) => (
        <div key={p.id} onClick={() => open(p.id)} style={{ ...mono, fontSize: 12, padding: "6px 8px", borderRadius: 3, cursor: "pointer",
          border: `1px solid ${sel?.id === p.id ? C.gold : C.line}`, background: sel?.id === p.id ? C.panel : "transparent" }}>
          <Row><b style={{ color: p.isActive ? C.green : C.text }}>{p.name}</b>
            {p.isActive && <span style={{ color: C.green, fontSize: 10 }}>LIVE</span>}
            {p.builtIn && <span style={{ color: C.grey, fontSize: 10 }}>BUILT-IN · LOCKED</span>}
            {p.hasUnappliedChanges && <span style={{ color: C.gold, fontSize: 10 }}>CHANGED SINCE APPLIED</span>}
            <span style={{ marginLeft: "auto", color: C.grey, fontSize: 10 }}>rev {p.profileRevision}{p.editedBy ? ` · ${p.editedBy}` : ""}</span></Row>
          <Note>{p.categoryRuleCount} categories · {p.bookRuleCount} book levels · {p.exactRuleCount} item rules · {p.removedCount} removed</Note>
        </div>
      ))}
      {!rows.length && <Note>No profiles read yet (press Refresh).</Note>}
    </Box>

    {io && <Box title={io.mode === "export" ? "Profile as text" : "Import a profile"} right={<Btn color={C.grey} onClick={() => setIo(null)}>Close</Btn>}>
      {io.mode === "export" ? <>
        <textarea readOnly value={io.text} rows={10} style={{ ...inp, width: "100%" }} />
        <Row><Btn onClick={() => { navigator.clipboard?.writeText(io.text); note(true, "Copied."); }}>Copy</Btn><Note>Paste it into Import on any Panther server.</Note></Row>
      </> : <>
        <textarea value={io.text} onChange={(e) => setIo({ ...io, text: e.target.value })} rows={10} placeholder="PANTHER_PROFILE_V1 ..." style={{ ...inp, width: "100%" }} />
        <Row><input value={io.name} onChange={(e) => setIo({ ...io, name: e.target.value })} placeholder="name (optional)" maxLength={64} style={{ ...inp, width: 220 }} />
          <Btn color={C.green} disabled={!!busy || !io.text.trim()} onClick={doImport}>Import as a draft</Btn></Row>
        <Note>Imported profiles are saved drafts: live loot only changes when you apply one.</Note>
      </>}
    </Box>}

    {sel && draft && <Box title={sel.name} right={<>
      {!locked && <Btn color={C.green} disabled={!!busy || !dirty} onClick={save}>Save</Btn>}
      {!locked && dirty && <Btn color={C.grey} onClick={() => setDraft({ name: sel.name, description: sel.description, settings: { ...sel.settings } })}>Undo edits</Btn>}
      <Btn disabled={!!busy} onClick={dup}>{locked ? "Duplicate to edit" : "Duplicate"}</Btn>
      <Btn color={C.blue} disabled={!!busy} onClick={doExport}>Export</Btn>
      {!locked && !sel.isActive && <Btn color={C.red} disabled={!!busy} onClick={del}>Delete</Btn>}
      <Btn color={C.gold} disabled={!!busy || dirty} title={dirty ? "Save first" : ""} onClick={doPreview}>Preview apply</Btn>
    </>}>
      {locked && <Note color={C.gold}>The built-in profile is read-only. Duplicate it to change anything.</Note>}
      {dirty && <Note color={C.gold}>Unsaved edits. Save, then preview and apply to make them live.</Note>}
      <Row>
        <input disabled={locked} value={draft.name} maxLength={64} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ ...inp, width: 260 }} />
      </Row>
      <textarea disabled={locked} value={draft.description} maxLength={1200} rows={2} onChange={(e) => setDraft({ ...draft, description: e.target.value })} style={{ ...inp, width: "100%" }} />
      {preview && <ApplyPreview preview={preview} busy={busy} apply={apply} close={() => setPreview(null)} />}
      <Editor draft={draft} setDraft={setDraft} locked={locked} />
      <ItemRules draft={draft} setDraft={setDraft} locked={locked} pa={pa} busy={busy} />
    </Box>}
  </>);
}

function ApplyPreview({ preview, busy, apply, close }) {
  const [left, setLeft] = useState(60);
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, Math.round((n(preview.expiresAt) - Date.now()) / 1000)) || Math.max(0, 60 - Math.round((Date.now() - preview.at) / 1000))), 1000);
    return () => clearInterval(t);
  }, [preview]);
  const d = preview.diff || {};
  const [allWarn, setAllWarn] = useState(false);
  const warns = list(preview.warnings);
  return (
    <div style={{ border: `1px solid ${C.gold}`, borderRadius: 3, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
      <Row><b style={{ fontSize: 12, color: C.gold }}>Apply "{preview.profile?.name}" live?</b><span style={{ marginLeft: "auto" }}><Btn color={C.grey} onClick={close}>Close</Btn></span></Row>
      <Note color={C.text}>Live now: {preview.active?.profileName} (rule revision {preview.active?.ruleRevision})</Note>
      <Pre>{d.text || d.summary || "No differences."}</Pre>
      {(allWarn ? warns : warns.slice(0, 4)).map((w, i) => <Note key={i} color={C.gold}>! {w}</Note>)}
      {warns.length > 4 && <span><Btn color={C.grey} onClick={() => setAllWarn(!allWarn)}>{allWarn ? "Fewer warnings" : `All ${warns.length} warnings`}</Btn></span>}
      <Row>
        <Btn color={C.red} disabled={!!busy || !preview.canApply || !preview.token || left <= 0} onClick={apply}>Apply live</Btn>
        <Note>{left > 0 ? `This preview is good for ${left} s.` : "Expired: preview again."}</Note>
      </Row>
    </div>
  );
}

function Editor({ draft, setDraft, locked }) {
  const s = draft.settings || {};
  const set = (k, v) => setDraft({ ...draft, settings: { ...s, [k]: v } });
  return (<>
    <b style={{ fontSize: 12, marginTop: 4 }}>Categories</b>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 4 }}>
      {CATEGORIES.map(([k, l]) => (
        <Row key={k} style={{ justifyContent: "space-between", border: `1px solid ${C.line}`, borderRadius: 3, padding: "3px 6px" }}>
          <span style={{ ...mono, fontSize: 12, color: n(s["Cat" + k]) === 1 ? C.grey : C.text }}>{l}</span>
          <Mult disabled={locked} value={s["Cat" + k] ?? 1} onChange={(v) => set("Cat" + k, v ?? 1)} />
        </Row>
      ))}
    </div>
    <b style={{ fontSize: 12, marginTop: 4 }}>Skill books by volume</b>
    <Row>
      {[1, 2, 3, 4, 5].map((i) => (
        <Row key={i} style={{ border: `1px solid ${C.line}`, borderRadius: 3, padding: "3px 6px" }}>
          <span style={{ ...mono, fontSize: 12 }}>Vol. {ROMAN[i - 1]}</span>
          <Mult disabled={locked} value={s["Book" + i] ?? 1} onChange={(v) => set("Book" + i, v ?? 1)} />
        </Row>
      ))}
    </Row>
    <Row>
      <label style={{ ...mono, fontSize: 12 }}><input type="checkbox" disabled={locked} checked={s.IncludeDirect !== false} onChange={(e) => set("IncludeDirect", e.target.checked)} /> Also zombie / direct loot lists</label>
      <label style={{ ...mono, fontSize: 12 }}><input type="checkbox" disabled={locked} checked={s.IncludeVehicles !== false} onChange={(e) => set("IncludeVehicles", e.target.checked)} /> Also vehicle loot</label>
    </Row>
  </>);
}

// exact item rules: the list, plus a search over every item the server knows
function ItemRules({ draft, setDraft, locked, pa, busy }) {
  const exact = useMemo(() => exactOf(draft.settings), [draft.settings]);
  const ids = Object.keys(exact).sort();
  const [q, setQ] = useState(""), [filter, setFilter] = useState("All Items"), [page, setPage] = useState(1);
  const [res, setRes] = useState(null);
  const [show, setShow] = useState(false);
  const setRule = (id, v) => {
    const m = { ...exact };
    if (v === null || v === undefined) delete m[id]; else m[id] = v;
    setDraft({ ...draft, settings: withExact(draft.settings, m) });
  };
  const search = async (p = 1) => {
    const r = await pa("pa_call", { pc: "SearchItems", query: q, filter, page: p, settings: draft.settings }, true);
    const s = reply(r, "ItemSearchResult");
    if (s) { setRes(s); setPage(n(s.page) || p); }
  };
  const pages = res ? Math.max(1, Math.ceil(n(res.total) / 60)) : 1;
  return (<>
    <Row style={{ marginTop: 4 }}><b style={{ fontSize: 12 }}>Item rules ({ids.length})</b>
      <span style={{ marginLeft: "auto" }}><Btn color={C.grey} onClick={() => setShow(!show)}>{show ? "Hide list" : "Show list"}</Btn></span></Row>
    <Note>An item rule beats its category and book level. INHERIT takes the rule away.</Note>
    {show && <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
      {ids.map((id) => <Row key={id}><span style={{ ...mono, fontSize: 12, minWidth: 260 }}>{id}</span>
        <Mult disabled={locked} inherit value={exact[id]} onChange={(v) => setRule(id, v)} /></Row>)}
      {!ids.length && <Note>None.</Note>}
    </div>}
    <b style={{ fontSize: 12, marginTop: 4 }}>Find items</b>
    <Row>
      <input value={q} maxLength={80} placeholder="name, id or mod" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search(1)} style={{ ...inp, width: 220 }} />
      <select value={filter} onChange={(e) => setFilter(e.target.value)} style={inp}>{FILTERS.map((f) => <option key={f}>{f}</option>)}</select>
      <Btn disabled={!!busy} onClick={() => search(1)}>Search</Btn>
      {res && <Note>{res.total} found · page {page}/{pages}</Note>}
      {res && page > 1 && <Btn color={C.grey} onClick={() => search(page - 1)}>Prev</Btn>}
      {res && page < pages && <Btn color={C.grey} onClick={() => search(page + 1)}>Next</Btn>}
    </Row>
    {res && <div style={{ maxHeight: 340, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
      {list(res.items).map((it) => (
        <Row key={it.id} style={{ borderBottom: `1px solid ${C.line}`, padding: "2px 0" }}>
          <span style={{ ...mono, fontSize: 12, minWidth: 200, color: C.text }}>{it.name}</span>
          <span style={{ ...mono, fontSize: 10, color: C.grey, minWidth: 170 }}>{it.id}</span>
          <span style={{ ...mono, fontSize: 10, color: C.grey, minWidth: 90 }}>{it.category || "no category"}</span>
          <span style={{ ...mono, fontSize: 11, color: it.effectiveRule === "DEFAULT" ? C.grey : it.effectiveRule === "REMOVE" ? C.red : C.gold, minWidth: 70 }}>{it.effectiveRule}</span>
          <span style={{ ...mono, fontSize: 10, color: C.grey, minWidth: 80 }}>{it.source}</span>
          <span style={{ marginLeft: "auto" }}><Mult disabled={locked} inherit value={exact[it.id]} onChange={(v) => setRule(it.id, v)} /></span>
        </Row>
      ))}
    </div>}
    {res && !locked && <Note>Changes here go into the draft: Save to keep them.</Note>}
  </>);
}

// ── area tools ──────────────────────────────────────────────────────────────
function Area({ pa, st, busy, setPick, setLayer, readState }) {
  const [action, setAction] = useState("refill"), [scope, setScope] = useState("rect"), [strategy, setStrategy] = useState("empty");
  const [z, setZ] = useState(0), [r, setR] = useState(10);
  const [box, setBox] = useState(null), [pt, setPt] = useState(null);
  const [pv, setPv] = useState(null), [guard, setGuard] = useState("");
  const j = st?.job;
  useEffect(() => {
    const rects = [];
    if (scope === "rect" && box) rects.push({ id: "pa:box", x: box.x1, y: box.y1, w: box.x2 - box.x1 + 1, h: box.y2 - box.y1 + 1, color: C.purple, dashed: true, fill: "rgba(151,117,204,.12)", label: `${box.x2 - box.x1 + 1} x ${box.y2 - box.y1 + 1}` });
    if (scope !== "rect" && pt) {
      const rr = scope === "radius" ? r : 1;
      rects.push({ id: "pa:pt", x: pt.x - rr, y: pt.y - rr, w: 2 * rr + 1, h: 2 * rr + 1, color: C.purple, dashed: true, fill: "rgba(151,117,204,.12)", label: scope });
    }
    setLayer({ dots: [], rects });
  }, [box, pt, scope, r]);
  useEffect(() => () => setLayer({ dots: [], rects: [] }), []);
  useEffect(() => { setPv(null); setGuard(""); }, [action, scope, strategy, z, r, box, pt]);
  const pick = () => {
    if (scope === "rect") setPick({ mode: "z", hint: "Click one corner of the area.", cb: (a) => setPick({ mode: "z", hint: "Now click the opposite corner.",
      cb: (c) => setBox({ x1: Math.min(a.x, c.x), y1: Math.min(a.y, c.y), x2: Math.max(a.x, c.x), y2: Math.max(a.y, c.y) }) }) });
    else setPick({ mode: "z", hint: scope === "radius" ? "Click the center." : "Click a spot inside it.", cb: (w) => setPt({ x: w.x, y: w.y }) });
  };
  const target = scope === "rect" ? (box ? { ...box } : null) : (pt ? { x: pt.x, y: pt.y, ...(scope === "radius" ? { r } : {}) } : null);
  const tooBig = scope === "rect" && box && (box.x2 - box.x1 + 1) * (box.y2 - box.y1 + 1) > n(st?.limits?.maxTiles || 10000);
  const preview = async () => {
    const res = await pa("pa_area_preview", { action, scope, z, ...(action === "refill" ? { strategy } : {}), ...target });
    if (res?.ok) setPv(res); else setPv(null);
  };
  const runIt = async () => {
    if (action === "clear" && !confirm(`Delete everything in ${pv.preview?.total} containers? This can't be undone.`)) return;
    const res = await pa("pa_area_run", { token: pv.token });
    if (res?.ok) { setPv(null); readState(); }
  };
  const p = pv?.preview;
  const okToRun = pv?.token && (action !== "refresh" || guard.trim().toUpperCase() === "REFRESH");
  return (<>
    <Box title="Area job">
      <Row>{ACTIONS.map(([k, l]) => <Btn key={k} color={action === k ? (k === "clear" || k === "refresh" ? C.red : C.gold) : C.grey} onClick={() => setAction(k)}>{l}</Btn>)}</Row>
      <Note color={C.text}>{ACTIONS.find((a) => a[0] === action)[2]}</Note>
      {action === "refill" && <Row>
        <label style={{ ...mono, fontSize: 12 }}><input type="radio" checked={strategy === "empty"} onChange={() => setStrategy("empty")} /> empty containers only</label>
        <label style={{ ...mono, fontSize: 12 }}><input type="radio" checked={strategy === "all"} onChange={() => setStrategy("all")} /> every container (adds on top)</label>
      </Row>}
      <Row>
        <select value={scope} onChange={(e) => { setScope(e.target.value); }} style={inp}>{SCOPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <Btn onClick={pick}>{(scope === "rect" ? box : pt) ? "Pick again" : "Pick on the map"}</Btn>
        <span style={{ ...mono, fontSize: 12 }}>floor</span><input type="number" value={z} min={-8} max={8} onChange={(e) => setZ(Math.round(n(e.target.value)))} style={{ ...inp, width: 55 }} />
        {scope === "radius" && <><span style={{ ...mono, fontSize: 12 }}>radius</span>
          <input type="number" value={r} min={1} max={50} onChange={(e) => setR(Math.max(1, Math.min(50, Math.round(n(e.target.value)))))} style={{ ...inp, width: 60 }} /></>}
      </Row>
      {target && <Note color={C.text}>{scope === "rect" ? `${box.x1},${box.y1} to ${box.x2},${box.y2} (${box.x2 - box.x1 + 1} x ${box.y2 - box.y1 + 1})` : `${pt.x},${pt.y}${scope === "radius" ? ` radius ${r}` : ""}`} · floor {z}{scope === "building" ? " (the building's every floor)" : ""}</Note>}
      {tooBig && <Note color={C.red}>Too big: 100 x 100 squares at most.</Note>}
      <Row><Btn disabled={!!busy || !target || tooBig || !!j} onClick={preview}>Count first</Btn></Row>
      {p && <div style={{ border: `1px solid ${action === "clear" || action === "refresh" ? C.red : C.gold}`, borderRadius: 3, padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
        <KV k="Containers" v={`${p.total} (${p.empty} empty, ${p.items} items in them now)`} />
        <KV k="Left alone" v={`${p.protected} player-built / protected · ${p.safehouse} in safehouses · ${p.unloaded} squares not loaded`} />
        {action === "refresh" && <Row><span style={{ ...mono, fontSize: 12, color: C.red }}>Type REFRESH to confirm:</span>
          <input value={guard} onChange={(e) => setGuard(e.target.value)} style={{ ...inp, width: 110 }} /></Row>}
        <Row><Btn color={action === "clear" || action === "refresh" ? C.red : C.green} disabled={!!busy || !okToRun} onClick={runIt}>{`Run ${action} on ${p.total}`}</Btn>
          <Note>Good for 60 s.</Note></Row>
      </div>}
      <Note>Only loaded ground works (someone near it). Safehouses and player-built containers are never touched. Jobs go into Panther's history.</Note>
    </Box>
    {j && <Box title="Running" right={<Btn color={C.red} disabled={!!busy} onClick={() => pa("pa_area_cancel")}>Cancel</Btn>}>
      <KV k={j.action} v={j.label} color={C.gold} />
      <div style={{ height: 6, background: C.panel, borderRadius: 3 }}><div style={{ height: 6, width: `${Math.round((100 * n(j.processed + j.skipped)) / Math.max(1, n(j.total)))}%`, background: C.gold, borderRadius: 3 }} /></div>
      <Note color={C.text}>{j.processed} / {j.total} containers · +{j.added} / -{j.removed} items · {j.filtered} filtered</Note>
    </Box>}
    {st?.lastResult && !j && <Note color={C.text}>Last job: {st.lastResult}</Note>}
  </>);
}

// ── loot zones (Panther 0.10, mod 1.7.161) ────────────────────────────────────
// Panther's saved loot zones: rectangles (one floor each) where its loot rules get extra multipliers per category. Normal /
// Balance / High Risk, a priority (the highest wins where zones overlap), on / off. 4,583 come built in (every store, garage,
// arms room... on the server's maps). Shown on the map with the filters below (at most ZONE_DRAW at once).
const ZONE_DRAW = 1200;
const ZCOL = { Normal: C.blue, Balance: C.gold, "High Risk": C.red };
const zoneOf = (z) => ({ id: z.id, name: z.n, type: z.t, on: z.on !== false, priority: n(z.p), revision: n(z.r) || 1,
  x1: n(z.a?.[0]), y1: n(z.a?.[1]), x2: n(z.a?.[2]), y2: n(z.a?.[3]), z: n(z.a?.[4]), tags: list(z.g), mods: z.m || {}, exact: n(z.x) });

function Zones({ pa, busy, note, setPick, setLayer, st }) {
  const [rev, setRev] = useState(null), [zones, setZones] = useState(null);
  const [q, setQ] = useState(""), [type, setType] = useState(""), [onOff, setOnOff] = useState(""), [floor, setFloor] = useState("0"), [show, setShow] = useState(true);
  const [sel, setSel] = useState(null), [draft, setDraft] = useState(null);
  const take = (r) => {
    const s = list(r?.replies).find((x) => x.command === "LootZonesState")?.args;
    if (s) { setRev(n(s.catalogRevision)); setZones(list(s.zones).map(zoneOf)); }
    return s;
  };
  const load = async () => take(await pa("pa_call", { pc: "GetLootZones" }, true));
  useEffect(() => { load(); }, []);
  useEffect(() => () => setLayer({ dots: [], rects: [] }), []);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return list(zones).filter((z) => (!type || z.type === type) && (!onOff || (onOff === "on") === z.on) && (floor === "" || z.z === Number(floor))
      && (!s || z.name.toLowerCase().includes(s) || z.tags.some((t) => t.toLowerCase().includes(s))));
  }, [zones, q, type, onOff, floor]);
  const open = (z) => { setSel(z); setDraft({ ...z, mods: { ...z.mods }, tagText: z.tags.join(", ") }); };
  useEffect(() => {
    const rects = [];
    if (show) for (const z of shown.slice(0, ZONE_DRAW)) {
      const mine = sel && z.id === sel.id;
      rects.push({ id: "pz:" + z.id, x: z.x1, y: z.y1, w: z.x2 - z.x1 + 1, h: z.y2 - z.y1 + 1, color: mine ? "#fff" : ZCOL[z.type] || C.blue, dashed: !z.on,
        fill: mine ? "rgba(255,255,255,.18)" : z.type === "High Risk" ? "rgba(224,85,85,.10)" : "rgba(74,143,196,.07)", label: mine ? z.name : "", onClick: () => open(z) });
    }
    if (draft && !draft.id && draft.x1 != null) rects.push({ id: "pz:new", x: draft.x1, y: draft.y1, w: draft.x2 - draft.x1 + 1, h: draft.y2 - draft.y1 + 1, color: "#fff", dashed: true,
      fill: "rgba(255,255,255,.12)", label: draft.name || "new zone" });
    if (draft && draft.id && (draft.x1 !== sel?.x1 || draft.y1 !== sel?.y1 || draft.x2 !== sel?.x2 || draft.y2 !== sel?.y2))
      rects.push({ id: "pz:moved", x: draft.x1, y: draft.y1, w: draft.x2 - draft.x1 + 1, h: draft.y2 - draft.y1 + 1, color: "#fff", dashed: true, fill: "rgba(255,255,255,.12)", label: "new rectangle" });
    setLayer({ dots: [], rects });
  }, [shown, show, sel, draft]);
  const pickRect = (then) => setPick({ mode: "z", hint: "Click one corner of the zone.", cb: (a) => setPick({ mode: "z", hint: "Now click the opposite corner.",
    cb: (b) => then({ x1: Math.min(a.x, b.x), y1: Math.min(a.y, b.y), x2: Math.max(a.x, b.x), y2: Math.max(a.y, b.y) }) }) });
  const findAt = () => setPick({ mode: "z", hint: "Click a spot: the zones over it open.", cb: (w) => {
    const hits = list(zones).filter((z) => w.x >= z.x1 && w.x <= z.x2 && w.y >= z.y1 && w.y <= z.y2 && (floor === "" || z.z === Number(floor)))
      .sort((a, b) => b.priority - a.priority || (a.x2 - a.x1) * (a.y2 - a.y1) - (b.x2 - b.x1) * (b.y2 - b.y1));
    if (hits.length) open(hits[0]); else note(false, `No zone at ${w.x}, ${w.y}${floor === "" ? "" : ` on floor ${floor}`}.`);
  } });
  const startNew = () => pickRect((r) => { setSel(null); setDraft({ name: "", type: "Normal", priority: 10, on: true, z: Number(floor || 0), mods: {}, tagText: "", ...r }); });
  const args = (d) => ({ name: d.name.trim(), zoneType: d.type, priority: Math.round(n(d.priority)), enabled: !!d.on, x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2, z1: Math.round(n(d.z)),
    tags: String(d.tagText || "").replace(/[^A-Za-z0-9 ,_\-&/]/g, ""), modifiers: Object.fromEntries(CATEGORIES.map(([k]) => [k, d.mods[k] ?? 1])) });
  const save = async () => {
    if (!draft.name.trim()) return note(false, "A zone needs a name.");
    const r = draft.id
      ? await pa("pa_call", { pc: "UpdateLootZone", catalogRevision: rev, zoneId: draft.id, zoneRevision: draft.revision, ...args(draft) })
      : await pa("pa_call", { pc: "CreateLootZone", catalogRevision: rev, ...args(draft) });
    const s = take(r);
    if (r?.ok && s) {
      const id = s.selectedZoneId || draft.id;
      const z = list(s.zones).map(zoneOf).find((x) => x.id === id);
      if (z) open(z); else { setSel(null); setDraft(null); }
    }
  };
  const del = async () => {
    if (!confirm(`Delete the loot zone "${sel.name}"? Panther stops using it straight away.`)) return;
    const r = await pa("pa_call", { pc: "DeleteLootZone", catalogRevision: rev, zoneId: sel.id, zoneRevision: sel.revision });
    if (take(r) && r?.ok) { setSel(null); setDraft(null); }
  };
  const counts = useMemo(() => { const c = { all: list(zones).length, on: 0, high: 0 }; for (const z of list(zones)) { if (z.on) c.on++; if (z.type === "High Risk") c.high++; } return c; }, [zones]);
  const d = draft;
  return (<>
    <Box title={`Loot zones${zones ? ` (${counts.all})` : ""}`} right={<>
      <Btn color={C.grey} disabled={!!busy} onClick={load}>Reload</Btn>
      <Btn disabled={!!busy || !zones} onClick={findAt}>Find at a spot</Btn>
      <Btn color={C.green} disabled={!!busy || !zones} onClick={startNew}>Draw a new zone</Btn></>}>
      {!zones && <Note>{busy ? "Loading Panther's zones..." : "No zones yet. Panther 0.10 or newer is needed (it brings 4,583 built in); the server answers while someone is online."}</Note>}
      {zones && <>
        <Note color={C.text}>{counts.on} switched on · {counts.high} High Risk · list revision {rev}. Colours: <span style={{ color: C.blue }}>Normal</span>, <span style={{ color: C.gold }}>Balance</span>, <span style={{ color: C.red }}>High Risk</span>; dashed = off. Click a zone on the map to open it.</Note>
        <Row>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search a name or a tag (WestPoint, Ammo...)" style={{ ...inp, flex: 1, minWidth: 180 }} />
          <select value={type} onChange={(e) => setType(e.target.value)} style={inp}><option value="">every type</option>{["Normal", "Balance", "High Risk"].map((t) => <option key={t}>{t}</option>)}</select>
          <select value={onOff} onChange={(e) => setOnOff(e.target.value)} style={inp}><option value="">on + off</option><option value="on">on</option><option value="off">off</option></select>
          <span style={{ ...mono, fontSize: 12 }}>floor</span>
          <select value={floor} onChange={(e) => setFloor(e.target.value)} style={inp}><option value="">all</option>{[-3, -2, -1, 0, 1, 2, 3, 4].map((f) => <option key={f} value={String(f)}>{f}</option>)}</select>
          <label style={{ ...mono, fontSize: 12 }}><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> on the map</label>
        </Row>
        <Note>{shown.length} match{shown.length > ZONE_DRAW && show ? ` (the map draws the first ${ZONE_DRAW}: narrow the search)` : ""}.</Note>
        <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {shown.slice(0, 200).map((z) => (
            <a key={z.id} onClick={() => open(z)} style={{ ...mono, fontSize: 12, cursor: "pointer", padding: "3px 6px", borderRadius: 3, color: z.on ? C.text : C.grey,
              background: sel?.id === z.id ? C.panel : "transparent", borderLeft: `3px solid ${ZCOL[z.type] || C.blue}` }}>
              {z.name} <span style={{ color: C.grey }}>· p{z.priority} · {z.x2 - z.x1 + 1}x{z.y2 - z.y1 + 1} · z{z.z}{Object.keys(z.mods).length ? ` · ${Object.keys(z.mods).length} multiplier(s)` : ""}</span></a>))}
          {shown.length > 200 && <Note>... and {shown.length - 200} more (search to narrow).</Note>}
        </div>
      </>}
    </Box>
    {d && <Box title={d.id ? `Zone: ${sel?.name}` : "New loot zone"} right={<>
      {d.id && <Btn color={C.red} disabled={!!busy} onClick={del}>Delete</Btn>}
      <Btn color={C.grey} onClick={() => { setSel(null); setDraft(null); }}>Close</Btn>
      <Btn color={C.green} disabled={!!busy} onClick={save}>{d.id ? "Save" : "Create"}</Btn></>}>
      <Row><span style={{ ...mono, fontSize: 12, minWidth: 70 }}>name</span><input value={d.name} maxLength={64} onChange={(e) => setDraft({ ...d, name: e.target.value })} style={{ ...inp, flex: 1 }} /></Row>
      <Row>
        <select value={d.type} onChange={(e) => setDraft({ ...d, type: e.target.value })} style={inp}>{["Normal", "Balance", "High Risk"].map((t) => <option key={t}>{t}</option>)}</select>
        <span style={{ ...mono, fontSize: 12 }}>priority</span><input type="number" min={0} max={1000} value={d.priority} onChange={(e) => setDraft({ ...d, priority: e.target.value })} style={{ ...inp, width: 70 }} />
        <label style={{ ...mono, fontSize: 12 }}><input type="checkbox" checked={!!d.on} onChange={(e) => setDraft({ ...d, on: e.target.checked })} /> switched on</label>
      </Row>
      <Row>
        <span style={{ ...mono, fontSize: 12 }}>{d.x1},{d.y1} to {d.x2},{d.y2} ({d.x2 - d.x1 + 1} x {d.y2 - d.y1 + 1}) floor</span>
        <input type="number" min={-32} max={32} value={d.z} onChange={(e) => setDraft({ ...d, z: Math.round(n(e.target.value)) })} style={{ ...inp, width: 55 }} />
        <Btn onClick={() => pickRect((r) => setDraft((x) => ({ ...x, ...r })))}>Redraw on the map</Btn>
      </Row>
      <Row><span style={{ ...mono, fontSize: 12, minWidth: 70 }}>tags</span><input value={d.tagText} onChange={(e) => setDraft({ ...d, tagText: e.target.value })} placeholder="up to 8, separated by commas" style={{ ...inp, flex: 1 }} /></Row>
      <Note color={C.text}>Multipliers in this zone (100% = the profile's own rule, 0% = nothing of it spawns here, up to 500%):</Note>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 4 }}>
        {CATEGORIES.map(([k, l]) => {
          const v = d.mods[k] ?? 1;
          return <label key={k} style={{ ...mono, fontSize: 12, display: "flex", gap: 6, alignItems: "center", color: v === 1 ? C.grey : C.gold }}>
            <input type="number" min={0} max={500} step={5} value={Math.round(v * 100)} style={{ ...inp, width: 66 }}
              onChange={(e) => setDraft({ ...d, mods: { ...d.mods, [k]: Math.max(0, Math.min(5, n(e.target.value) / 100)) } })} />% {l}</label>;
        })}
      </div>
      {d.id && d.exact > 0 && <Note>{d.exact} exact-item rule(s) in this zone are kept as they are (edit those in game with F2).</Note>}
      {d.id && <Note>Saving needs the list to be current: if someone changed zones meanwhile, Panther says so; press Reload and try again.</Note>}
    </Box>}
  </>);
}

// ── the maze (Panther's TME event) ───────────────────────────────────────────
const MAZE_COL = { START: "#1a40ff", RESET: "#ff7300", CHECKPOINT: "#00e5ff", HEALTH_DRAIN: "#ff2020", HEALTH_RESTORE: "#00f033", FINISH: "#a60dff" };
const MAZE_WORD = { START: "Start", RESET: "Reset", CHECKPOINT: "Checkpoint", HEALTH_DRAIN: "Health drain", HEALTH_RESTORE: "Health restore", FINISH: "Finish" };
function Maze({ st, setLayer }) {
  const m = st?.maze;
  const tiles = list(m?.tiles);
  const [show, setShow] = useState(true);
  useEffect(() => {
    setLayer({ dots: [], rects: show ? tiles.slice(0, 3000).map((t, i) => ({ id: `mz:${t.x},${t.y},${t.z}:${i}`, x: n(t.x), y: n(t.y), w: 1, h: 1, color: MAZE_COL[t.t] || C.grey,
      fill: (MAZE_COL[t.t] || "#999999") + "99", label: t.t === "START" || t.t === "FINISH" ? MAZE_WORD[t.t] : "" })) : [] });
  }, [m, show]);
  useEffect(() => () => setLayer({ dots: [], rects: [] }), []);
  const byType = {};
  for (const t of tiles) byType[t.t] = (byType[t.t] || 0) + 1;
  const ms = (v) => { const s = Math.floor(n(v) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  return (
    <Box title={`Maze${m?.title ? `: ${m.title}` : ""}`} right={<label style={{ ...mono, fontSize: 12 }}><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> on the map</label>}>
      {!m && <Note>No maze on the server (Panther 0.10 brings it; the overview updates while someone is online).</Note>}
      {m && <>
        <KV k="State" v={m.enabled === false ? "switched off" : "on"} color={m.enabled === false ? C.red : C.green} />
        <KV k="Tiles" v={tiles.length ? Object.entries(byType).map(([k, v]) => `${MAZE_WORD[k] || k} ${v}`).join(" · ") : "none placed yet"} />
        {m.start && <KV k="Start" v={`${m.start.x}, ${m.start.y}, floor ${m.start.z}`} />}
        {m.finish && <KV k="Finish" v={`${m.finish.x}, ${m.finish.y}, floor ${m.finish.z}`} />}
        <KV k="Players who ran it" v={String(n(m.players))} />
        <KV k="Best times" v={list(m.top).length ? list(m.top).map((e, i) => `${i + 1}. ${e.name} ${ms(e.ms)}`).join(" · ") : "nobody has finished yet"} color={C.gold} />
        <Row>{Object.keys(MAZE_COL).map((k) => <span key={k} style={{ ...mono, fontSize: 11, color: MAZE_COL[k] }}>■ {MAZE_WORD[k]}</span>)}</Row>
        <Note>The maze is built and run in game (its own admin panel). Here you see where its tiles are; tiles show at street zoom.</Note>
      </>}
    </Box>
  );
}

// ── history ─────────────────────────────────────────────────────────────────
function History({ pa, busy }) {
  const [rows, setRows] = useState(null), [det, setDet] = useState(null);
  const load = useCallback(async () => { const r = await pa("pa_call", { pc: "GetHistory" }, true); const h = reply(r, "HistoryState"); if (h) setRows(list(h.entries)); }, [pa]);
  useEffect(() => { load(); }, [load]);
  const open = async (id) => { const r = await pa("pa_call", { pc: "GetHistoryDetail", hid: id }, true); const d = reply(r, "HistoryDetail"); if (d?.entry) setDet(d.entry); };
  const color = (res) => (res === "SUCCESS" ? C.green : res === "CANCELLED" ? C.gold : C.red);
  return (<>
    <Box title={`History${rows ? ` (${rows.length})` : ""}`} right={<Btn color={C.grey} disabled={!!busy} onClick={load}>Reload</Btn>}>
      {(rows || []).map((h) => (
        <div key={h.id} onClick={() => open(h.id)} style={{ ...mono, fontSize: 12, padding: "4px 6px", cursor: "pointer", borderBottom: `1px solid ${C.line}`, background: det?.id === h.id ? C.panel : "transparent" }}>
          <Row><b style={{ color: C.text }}>{h.event}</b><span style={{ color: color(h.result), fontSize: 10 }}>{h.result}</span>
            <span style={{ marginLeft: "auto", color: C.grey, fontSize: 10 }}>{when(h.time)} · {h.actor}</span></Row>
          <Note>{h.summary}</Note>
        </div>
      ))}
      {rows && !rows.length && <Note>Nothing yet.</Note>}
    </Box>
    {det && <Box title={`#${det.id} ${det.event}`} right={<Btn color={C.grey} onClick={() => setDet(null)}>Close</Btn>}>
      <KV k="When" v={when(det.time)} /><KV k="By" v={det.actor} /><KV k="Result" v={det.result} color={color(det.result)} />
      {det.profileName && <KV k="Profile" v={`${det.profileName} (rev ${det.profileRevision})`} />}
      <KV k="Rule revision" v={`${det.oldRevision} -> ${det.newRevision}`} />
      {det.target && <KV k="Target" v={det.target} />}
      {det.action && <KV k="Containers" v={`${det.processed}/${det.eligible} · +${det.added} / -${det.removed} · ${det.filtered} filtered · ${det.skipped} skipped · ${det.protected} protected`} />}
      {det.reason && <KV k="Reason" v={det.reason} />}
      <Note color={C.text}>{det.summary}</Note>
      {det.details && <Pre>{det.details}</Pre>}
    </Box>}
  </>);
}

// ── diagnostics ─────────────────────────────────────────────────────────────
function Diag({ pa, busy }) {
  const [out, setOut] = useState(""), [item, setItem] = useState("");
  const ask = async (pc, args = {}) => { const r = await pa("pa_call", { pc, ...args }, true); const a = reply(r, "AuditResult"); if (a) setOut(a.message || ""); };
  return (<>
    <Box title="Diagnostics" right={<>
      <Btn disabled={!!busy} onClick={() => ask("AuditLoot")}>Loot audit</Btn>
      <Btn disabled={!!busy} onClick={() => ask("ProbeEngine")}>Engine check</Btn>
    </>}>
      <Row><input value={item} placeholder="Base.Axe" onChange={(e) => setItem(e.target.value.trim())} onKeyDown={(e) => e.key === "Enter" && item && ask("TraceItem", { item })} style={{ ...inp, width: 220 }} />
        <Btn disabled={!!busy || !item} onClick={() => ask("TraceItem", { item })}>Why did this spawn?</Btn></Row>
      {out ? <Pre>{out}</Pre> : <Note>The audit lists what the live rules changed; "why did this spawn" explains one item's rule.</Note>}
    </Box>
  </>);
}
