// @ts-nocheck
"use client";
// components/ops/GoalTab.tsx - Live Ops > Zombita > GOAL (2026-10-07, mod 1.7.143 ZGoal_Server.lua, bot zombita_goal.py).
// The SERVER GOAL ladder: every zombie anyone kills counts; reaching a goal runs its unlocks and gives every helper its
// rewards (coins from the treasury, capped; items in game). Here admins edit the whole ladder (names, targets, rewards,
// unlocks, the treasury cap) and Save sends it to the game as one piece (refused whole if anything is wrong).
// Data: GET /api/admin/goal (the game's state + the ladder text). Changes: POST /api/admin/goal, answer at
// /api/admin/goal/reply/{id}. The ladder text format is ZGoal_Shared.lua's: parse/serialize below mirror it.
import { useCallback, useEffect, useRef, useState } from "react";
import { API } from "@/lib/constants";

const C = { gold: "#c8a84b", green: "#4caf7d", red: "#e05555", grey: "#9aa", text: "#e6e6e6", bg: "#0b0d10", line: "#2a2f37", teal: "#4ab0a8" };
const mono = { fontFamily: "var(--mono, monospace)" };
const inp = { ...mono, fontSize: 12, padding: "5px 7px", background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 3, boxSizing: "border-box" };
const MODULES = [
  ["phone", "Zombita Phone"], ["vehicles", "Vehicle claims"], ["dotd", "Dawn of the Dead"], ["bus", "Zombita Bus"], ["shop", "Zombita Shop"],
  ["npc", "Zombita (the NPC)"], ["lb", "Leaderboard"], ["mags", "Magazine wear"], ["factions", "Faction spaces"], ["hub", "Server Hub"],
  ["map_shops", "Shops on the map"], ["map_bus", "Bus stations on the map"], ["quests", "Zombita's Jobs"], ["treasury", "Treasury, in public"],
];
const n = (v) => Number(v) || 0;
const clean = (s, max = 60) => String(s || "").replace(/[|\r\n]/g, " ").trim().slice(0, max);
function money(b) {
  const v = Math.round(n(b));
  const g = Math.floor(v / 10000), s = Math.floor((v % 10000) / 1000), r = v % 1000;
  const parts = [];
  if (g) parts.push(`${g}g`);
  if (s) parts.push(`${s}s`);
  if (r || !parts.length) parts.push(`${r}b`);
  return parts.join(" ");
}

// ── the ladder text <-> objects (same rules as ZGoal_Shared.lua) ─────────────────────────────────────────────
export function parseLadder(text) {
  const L = { cap: 15, goals: [] };
  const byId = {};
  for (const raw of String(text || "").split("\n")) {
    const line = raw.replace(/\r/g, "").trim();
    if (!line || line.startsWith("#")) continue;
    const f = line.split("|");
    if (f[0] === "setting" && f[1] === "cap_pct") L.cap = Math.max(0, Math.min(100, Math.floor(n(f[2]))));
    else if (f[0] === "goal" && /^[A-Za-z0-9_]+$/.test(f[1] || "") && n(f[2]) >= 1 && !byId[f[1]]) {
      const g = { id: f[1], target: Math.floor(n(f[2])), name: f[3] || "", coins: 0, items: [], say: "", dotd: false, switches: [], actions: [] };
      byId[g.id] = g; L.goals.push(g);
    } else if ((f[0] === "reward" || f[0] === "unlock") && byId[f[1]]) {
      const g = byId[f[1]];
      if (f[0] === "reward" && f[2] === "coins") g.coins += Math.floor(n(f[3]));
      else if (f[0] === "reward" && f[2] === "item") g.items.push({ item: f[3] || "", count: Math.max(1, Math.floor(n(f[4]) || 1)) });
      else if (f[2] === "say") g.say = f.slice(3).join(" ");
      else if (f[2] === "dotd") g.dotd = true;
      else if (f[2] === "switch" && f[3]) g.switches.push(f[3]);
      else if (f[2] === "action") g.actions.push({ mod: f[3] || "", action: f[4] || "", args: f[5] || "" });
    }
  }
  L.goals.sort((a, b) => a.target - b.target);
  return L;
}

export function serializeLadder(L) {
  const out = ["# Zombita SERVER GOAL ladder (edited on the website). Targets are total kills.", `setting|cap_pct|${Math.floor(n(L.cap))}`];
  for (const g of L.goals) {
    out.push(`goal|${g.id}|${Math.floor(n(g.target))}|${clean(g.name)}`);
    if (n(g.coins) > 0) out.push(`reward|${g.id}|coins|${Math.floor(n(g.coins))}`);
    for (const it of g.items) if (/^[\w]+\.[\w-]+$/.test(it.item.trim())) out.push(`reward|${g.id}|item|${it.item.trim()}|${Math.max(1, Math.min(100, Math.floor(n(it.count) || 1)))}`);
    if (clean(g.say, 300)) out.push(`unlock|${g.id}|say|${clean(g.say, 300)}`);
    if (g.dotd) out.push(`unlock|${g.id}|dotd`);
    for (const m of g.switches) out.push(`unlock|${g.id}|switch|${m}`);
    for (const a of g.actions) if (/^\w+$/.test(a.mod) && /^\w+$/.test(a.action)) out.push(`unlock|${g.id}|action|${a.mod}|${a.action}|${clean(a.args, 200)}`);
  }
  return out.join("\n") + "\n";
}

function problems(L) {
  const out = [];
  if (!L.goals.length) out.push("The ladder needs at least one goal.");
  const ids = new Set();
  for (const g of L.goals) {
    if (ids.has(g.id)) out.push(`Two goals share the id ${g.id}.`);
    ids.add(g.id);
    if (n(g.target) < 1) out.push(`${g.name || g.id}: the target must be 1 or more.`);
    if (!clean(g.name)) out.push(`${g.id}: give it a name.`);
    for (const it of g.items) if (!/^[\w]+\.[\w-]+$/.test(it.item.trim())) out.push(`${g.name || g.id}: "${it.item}" isn't an item id (like Base.Bandage).`);
    for (const a of g.actions) if (!/^\w+$/.test(a.mod) || !/^\w+$/.test(a.action)) out.push(`${g.name || g.id}: an action needs a module and an action name.`);
  }
  if (n(L.cap) < 0 || n(L.cap) > 100) out.push("The treasury cap is a percent, 0 to 100.");
  return out;
}

function Btn({ children, onClick, color = C.gold, disabled = false, title = "" }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ ...mono, fontSize: 11, padding: "3px 8px", background: "transparent", color: disabled ? "#555" : color, border: `1px solid ${disabled ? "#333" : color}`,
        borderRadius: 3, cursor: disabled ? "default" : "pointer", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{children}</button>
  );
}
const Note = ({ children, color = C.grey }) => <div style={{ ...mono, fontSize: 11, color }}>{children}</div>;
const Row = ({ children }) => <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>{children}</div>;
const Label = ({ children }) => <span style={{ ...mono, fontSize: 11, color: C.grey, minWidth: 92 }}>{children}</span>;

export default function GoalTab() {
  const [st, setSt] = useState(null);
  const [err, setErr] = useState("");
  const [L, setL] = useState(null);          // the ladder being edited
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const lRef = useRef(null);                // the ladder in the editor, for the refresh loop (no stale closure)

  const load = useCallback(async (resetEdits = false) => {
    try {
      const r = await fetch(`${API}/api/admin/goal`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setSt(d); setErr("");
      if (d.ok && (resetEdits || !lRef.current)) { const p = parseLadder(d.ladder); lRef.current = p; setL(p); setDirty(false); }
    } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => {
    let stop = false, t = null;
    const tick = async () => { await load(); if (!stop) t = setTimeout(tick, 10000); };
    tick();
    return () => { stop = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(async (body, okText) => {
    setBusy(true); setMsg("Sent, waiting for the game...");
    try {
      const r = await fetch(`${API}/api/admin/goal`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.detail || `HTTP ${r.status}`); setBusy(false); return false; }
      for (let i = 0; i < 40; i++) {
        await new Promise((res) => setTimeout(res, 1500));
        const q = await (await fetch(`${API}/api/admin/goal/reply/${d.id}`, { credentials: "include" })).json().catch(() => ({}));
        if (q.done) { setMsg(q.msg || okText); setBusy(false); await load(q.ok); return q.ok; }
      }
      setMsg("The game hasn't answered yet: it only runs requests while the server is up (it pauses when nobody is online).");
    } catch (e) { setMsg(e.message); }
    setBusy(false);
    return false;
  }, [load]);

  const edit = (fn) => { setL((old) => { const c = JSON.parse(JSON.stringify(old)); fn(c); lRef.current = c; return c; }); setDirty(true); };
  const setG = (i, k, v) => edit((c) => { c.goals[i][k] = v; });

  if (err) return <Note color={C.red}>Can't read the server goal: {err}</Note>;
  if (!st) return <Note>Loading...</Note>;
  if (!st.ok) return <Note color={C.gold}>{st.why || "No server goal yet."} (Zombita 1.7.143 on the server is needed.)</Note>;
  const pub = st.public || {};
  const cur = pub.current;
  const reached = Object.fromEntries((st.goals || []).map((g) => [g.id, g]));
  const errs = L ? problems(L) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ border: `1px solid ${C.line}`, borderRadius: 3, padding: 10, background: C.bg }}>
        <b style={{ fontSize: 13 }}>Server goal</b>
        {cur ? (
          <>
            <div style={{ ...mono, fontSize: 12, marginTop: 6 }}>{cur.name}: <b style={{ color: C.gold }}>{n(pub.total).toLocaleString()}</b> / {n(cur.target).toLocaleString()} kills ({cur.pct}%), {cur.helpers} helpers so far</div>
            <div style={{ height: 8, background: "#1c2026", borderRadius: 4, marginTop: 6, overflow: "hidden" }}>
              <div style={{ width: `${cur.pct}%`, height: "100%", background: C.green }} /></div>
          </>
        ) : <Note color={C.green}>Every goal is reached ({n(pub.total).toLocaleString()} kills). Add the next one below.</Note>}
        {st.stale && <Note color={C.gold}>The game hasn't written this for a while (the server pauses when nobody is online). Changes wait until it's back.</Note>}
        <Row>
          <Btn disabled={busy} onClick={() => { const v = prompt("Set the server's kill count to (goals it passes are reached at once):", String(pub.total || 0)); if (v !== null) send({ cmd: "set_total", total: Math.floor(n(v)) }, "Count set."); }}>Set count</Btn>
          <Btn disabled={busy} color={C.red} onClick={() => { if (confirm("Start the server goal over from 0? The count, what was reached and who helped are cleared. The ladder stays.")) send({ cmd: "reset" }, "Started over."); }}>Start over</Btn>
        </Row>
      </div>

      {L && (
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 3, padding: 10, background: C.bg, display: "flex", flexDirection: "column", gap: 10 }}>
          <Row>
            <b style={{ fontSize: 13 }}>The ladder</b>
            <span style={{ marginLeft: "auto" }} />
            <Label>Treasury cap %</Label>
            <input style={{ ...inp, width: 60 }} type="number" min={0} max={100} value={L.cap} onChange={(e) => edit((c) => { c.cap = e.target.value; })}
              title="The most one goal's coin rewards may take from the treasury, in percent." />
          </Row>
          <Note>Targets are TOTAL kills since the ladder began (50,000, then e.g. 150,000). A helper is anyone who killed at least one zombie while that goal was the current one. Coins are paid from the treasury, at most the cap's share of it per goal (less when the treasury is low). Items arrive in the helper's inventory, now or the next time they log in.</Note>
          {L.goals.map((g, i) => {
            const done = reached[g.id] && n(reached[g.id].reached_at) > 0;
            return (
              <div key={g.id} style={{ border: `1px solid ${done ? "#2f5a3f" : C.line}`, borderRadius: 3, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                <Row>
                  <span style={{ ...mono, fontSize: 11, color: C.grey }}>{g.id}</span>
                  <input style={{ ...inp, width: 220 }} value={g.name} onChange={(e) => setG(i, "name", e.target.value)} placeholder="Name" />
                  <Label>Total kills</Label>
                  <input style={{ ...inp, width: 110 }} type="number" min={1} value={g.target} onChange={(e) => setG(i, "target", e.target.value)} />
                  {done && <span style={{ ...mono, fontSize: 11, color: C.green }}>REACHED ({reached[g.id].helpers} helpers)</span>}
                  <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    {!done && <Btn disabled={busy || dirty} color={C.red} title={dirty ? "Save first" : "Reach it now: unlocks run, helpers so far get the rewards"}
                      onClick={() => { if (confirm(`Reach "${g.name}" now, by hand? Its unlocks run and every helper so far gets its rewards.`)) send({ cmd: "reach", gid: g.id }, "Reached."); }}>Reach now</Btn>}
                    <Btn color={C.red} disabled={L.goals.length <= 1} onClick={() => edit((c) => { c.goals.splice(i, 1); })}>Remove</Btn>
                  </span>
                </Row>
                <Row>
                  <Label>Coins each</Label>
                  <input style={{ ...inp, width: 100 }} type="number" min={0} value={g.coins} onChange={(e) => setG(i, "coins", e.target.value)} />
                  <Note>bronze ({money(g.coins)}), from the treasury</Note>
                </Row>
                <Row>
                  <Label>Items each</Label>
                  {g.items.map((it, j) => (
                    <span key={j} style={{ display: "inline-flex", gap: 4 }}>
                      <input style={{ ...inp, width: 170 }} value={it.item} placeholder="Base.Bandage" onChange={(e) => edit((c) => { c.goals[i].items[j].item = e.target.value; })} />
                      <input style={{ ...inp, width: 52 }} type="number" min={1} max={100} value={it.count} onChange={(e) => edit((c) => { c.goals[i].items[j].count = e.target.value; })} />
                      <Btn color={C.red} onClick={() => edit((c) => { c.goals[i].items.splice(j, 1); })}>x</Btn>
                    </span>
                  ))}
                  <Btn onClick={() => edit((c) => { c.goals[i].items.push({ item: "", count: 1 }); })}>+ item</Btn>
                </Row>
                <Row>
                  <Label>Zombita says</Label>
                  <input style={{ ...inp, flex: 1, minWidth: 260 }} value={g.say} maxLength={300} placeholder="Her line when it's reached (game + Discord)" onChange={(e) => setG(i, "say", e.target.value)} />
                </Row>
                <Row>
                  <Label>Unlocks</Label>
                  <label style={{ ...mono, fontSize: 12 }}><input type="checkbox" checked={!!g.dotd} onChange={(e) => setG(i, "dotd", e.target.checked)} /> Dawn of the Dead starts</label>
                  <select style={{ ...inp }} value="" onChange={(e) => { const v = e.target.value; if (v) edit((c) => { if (!c.goals[i].switches.includes(v)) c.goals[i].switches.push(v); }); }}>
                    <option value="">+ switch a module ON...</option>
                    {MODULES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  {g.switches.map((m) => (
                    <span key={m} style={{ ...mono, fontSize: 11, color: C.teal }}>{(MODULES.find(([k]) => k === m) || [m, m])[1]} ON <Btn color={C.red} onClick={() => edit((c) => { c.goals[i].switches = c.goals[i].switches.filter((x) => x !== m); })}>x</Btn></span>
                  ))}
                  <Btn onClick={() => edit((c) => { c.goals[i].actions.push({ mod: "", action: "", args: "" }); })} title="Any Zombita Control action (advanced)">+ panel action</Btn>
                </Row>
                {g.actions.map((a, j) => (
                  <Row key={j}>
                    <Label>Panel action</Label>
                    <input style={{ ...inp, width: 110 }} value={a.mod} placeholder="module (quests)" onChange={(e) => edit((c) => { c.goals[i].actions[j].mod = e.target.value; })} />
                    <input style={{ ...inp, width: 110 }} value={a.action} placeholder="action (post_now)" onChange={(e) => edit((c) => { c.goals[i].actions[j].action = e.target.value; })} />
                    <input style={{ ...inp, flex: 1, minWidth: 160 }} value={a.args} placeholder="args: key=value;key=value" onChange={(e) => edit((c) => { c.goals[i].actions[j].args = e.target.value; })} />
                    <Btn color={C.red} onClick={() => edit((c) => { c.goals[i].actions.splice(j, 1); })}>x</Btn>
                  </Row>
                ))}
              </div>
            );
          })}
          <Row>
            <Btn onClick={() => edit((c) => {
              let k = 1; while (c.goals.some((g) => g.id === `g${k}`)) k++;
              const top = c.goals.reduce((m, g) => Math.max(m, n(g.target)), 0);
              c.goals.push({ id: `g${k}`, target: top ? top * 2 : 50000, name: `Goal ${k}`, coins: 0, items: [], say: "", dotd: false, switches: [], actions: [] });
            })}>+ Add goal</Btn>
            <span style={{ marginLeft: "auto" }} />
            {dirty && <Btn color={C.grey} onClick={() => load(true)}>Undo changes</Btn>}
            <Btn disabled={busy || !dirty || errs.length > 0} color={C.green}
              onClick={() => { const text = serializeLadder({ ...L, goals: [...L.goals].sort((a, b) => n(a.target) - n(b.target)) }); send({ cmd: "set_ladder", ladder: text }, "Saved."); }}>Save ladder</Btn>
          </Row>
          {errs.map((e) => <Note key={e} color={C.red}>{e}</Note>)}
        </div>
      )}
      {msg && <Note color={C.gold}>{msg}</Note>}
    </div>
  );
}
