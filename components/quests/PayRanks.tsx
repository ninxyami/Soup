// @ts-nocheck
"use client";
// components/quests/PayRanks.tsx: what each tier pays (pot), how long a winner rests (cooldown), the daily limit,
// and the Job Rank ladder (which tiers each rank may take).

import { useEffect, useState } from "react";
import { C, MONO, BODY, Btn, Card, Note, TierPill, Input, Select, Confirm, money, dur, fmt } from "./ui";

function TierRow({ t, send }) {
  const [pot, setPot] = useState(t.pot);
  const [rest, setRest] = useState(Math.round((t.cool || 0) / 60));
  useEffect(() => { setPot(t.pot); setRest(Math.round((t.cool || 0) / 60)); }, [t.pot, t.cool]);
  const potDirty = Number(pot) !== Number(t.pot), restDirty = Number(rest) * 60 !== Number(t.cool);
  return (
    <tr style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
      <td style={td}><TierPill t={t.id} /></td>
      <td style={td}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Input type="number" value={pot} onChange={setPot} width={110} min={0} max={1000000} />
          {potDirty && <Btn sm c="solid" onClick={() => send("pot", { tier: t.id, coins: Math.max(0, Math.floor(Number(pot) || 0)) }, `${t.id} pot saved`)}>Save</Btn>}
        </div>
        <div style={sub}>{money(Number(pot) || 0)}{Number(t.pot) !== Number(t.potDefault) ? ` (default ${money(t.potDefault)})` : ""}</div>
      </td>
      <td style={td}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Input type="number" value={rest} onChange={setRest} width={80} min={0} max={1440} /><span style={sub}>min</span>
          {restDirty && <Btn sm c="solid" onClick={() => send("cool", { tier: t.id, minutes: Math.max(0, Math.min(1440, Math.floor(Number(rest) || 0))) }, `${t.id} rest saved`)}>Save</Btn>}
        </div>
        {Number(t.cool) !== Number(t.coolDefault) && <div style={sub}>default {Math.round((t.coolDefault || 0) / 60)} min</div>}
      </td>
      <td style={{ ...td, fontFamily: MONO }}>{dur(t.life)}</td>
      <td style={{ ...td, fontFamily: MONO }}>{t.horde}</td>
      <td style={{ ...td, fontFamily: MONO }}>{t.pts}</td>
      <td style={{ ...td, fontFamily: MONO }}>{t.quit}</td>
    </tr>
  );
}

function Ranks({ state, send }) {
  const base = (state.ranks || []).map((r) => ({ name: r.name, min: r.min, maxTier: r.maxTier, quit: r.quit, tax: r.tax }));
  const [rows, setRows] = useState(base);
  const [ask, setAsk] = useState(null);
  useEffect(() => { setRows(base); }, [JSON.stringify(base)]);                                    // eslint-disable-line
  const set = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const dirty = JSON.stringify(rows.map(({ tax, ...r }) => r)) !== JSON.stringify(base.map(({ tax, ...r }) => r));
  const text = rows.map((r) => `${String(r.name).trim()}:${Math.floor(Number(r.min) || 0)}:${r.maxTier}:${Number(r.quit) || 0}`).join(",");
  const bad = rows.length < 1 || rows.length > 8 || !rows.some((r) => Number(r.min) === 0) || rows.some((r) => !/^[A-Za-z0-9 '\-]{1,20}$/.test(String(r.name).trim()));
  return (
    <Card title="Job Rank" right={state.ranksCustom ? <span style={{ fontFamily: MONO, fontSize: 12, color: C.orange }}>custom</span> : null}>
      <Note style={{ marginBottom: 12 }}>A player's rank decides the highest tier they may take. Tier unlocks (on the Board) still keep A and S closed for everyone until the server reaches them.</Note>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: BODY, fontSize: 13 }}>
          <thead><tr>{["Name", "From score", "Highest tier", "Give-up share", "Tax", ""].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
              <td style={td}><Input value={r.name} onChange={(v) => set(i, "name", v.slice(0, 20))} width={150} /></td>
              <td style={td}><Input type="number" value={r.min} onChange={(v) => set(i, "min", v)} width={90} /></td>
              <td style={td}><Select value={r.maxTier} onChange={(v) => set(i, "maxTier", v)} width={80} options={["D", "C", "B", "A", "S"]} /></td>
              <td style={td}><Input type="number" value={r.quit} onChange={(v) => set(i, "quit", v)} width={80} />
                <div style={sub}>{Number(r.quit) === 0 ? "gives up for free" : `x${r.quit} of the tier's cost`}</div></td>
              <td style={{ ...td, fontFamily: MONO }}>{r.tax != null ? `${r.tax}%` : ""}</td>
              <td style={td}>{rows.length > 1 && <Btn sm c="red" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</Btn>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
        {rows.length < 8 && <Btn sm c="dim" onClick={() => setRows([...rows, { name: "New rank", min: 300, maxTier: "S", quit: 1 }])}>+ Rank</Btn>}
        <Btn c="solid" disabled={!dirty || bad} onClick={() => send("ranks", { ranks: text }, "Ranks saved")}>Save ranks</Btn>
        {state.ranksCustom && <Btn c="dim" onClick={() => setAsk({ title: "Back to the default ranks?", yes: "Use defaults", text: "Rookie, Runner, Merc and Legend with their normal numbers.", onYes: () => send("ranks_default", {}, "Ranks back to the defaults") })}>Defaults</Btn>}
        {bad && <span style={{ fontFamily: BODY, fontSize: 12, color: C.red }}>1 to 8 ranks, one starting at 0, names of letters, digits and spaces.</span>}
      </div>
      <Note style={{ marginTop: 12 }}>Score = kills / 25 + best life (days) x 2 + DotD nights survived x 5 + quest points x 2 - deaths. Below 0 quest points a player
        is Disgraced (D and C only, half the give-up cost) whatever their score. The tax is set by rank position in the game.</Note>
      {ask && <Confirm {...ask} onClose={() => setAsk(null)} />}
    </Card>
  );
}

export default function PayRanks({ state, send }) {
  const [cap, setCap] = useState(state.cap);
  useEffect(() => { setCap(state.cap); }, [state.cap]);
  const [clear, setClear] = useState(state.shClear);
  useEffect(() => { setClear(state.shClear); }, [state.shClear]);
  return (
    <div>
      <Card title="Daily limit">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Input type="number" value={cap} onChange={setCap} width={140} min={0} max={1000000} />
          <span style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>{money(Number(cap) || 0)} per player a day</span>
          <Btn c="solid" disabled={Number(cap) === Number(state.cap)} onClick={() => send("cap", { coins: Math.max(0, Math.floor(Number(cap) || 0)) }, "Daily limit saved")}>Save</Btn>
        </div>
        <Note style={{ marginTop: 10 }}>The most one player can earn from jobs in a day. S jobs don't count.</Note>
      </Card>
      {state.shClear !== undefined && <Card title="Distance from bases">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Input type="number" value={clear} onChange={setClear} width={140} min={0} max={300} />
          <span style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>{Number(clear) > 0 ? `tiles from every safehouse (default ${state.shClearDefault})` : "off: jobs can land next to bases"}</span>
          <Btn c="solid" disabled={Number(clear) === Number(state.shClear)} onClick={() => send("sh_clear", { tiles: Math.max(0, Math.min(300, Math.floor(Number(clear) || 0))) }, "Distance from bases saved")}>Save</Btn>
        </div>
        <Note style={{ marginTop: 10 }}>New jobs that bring zombies are placed at least this far from every safehouse's edge, so hordes don't land behind bases. Jobs already posted stay. 0 = off.</Note>
      </Card>}
      <Card title="Tiers" right={<span style={{ fontFamily: MONO, fontSize: 11, color: C.dim }}>pot = a solo win, split evenly by a crew</span>}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: BODY, fontSize: 13 }}>
            <thead><tr>{["Tier", "Pot (bronze)", "Rest after a win", "On the board", "Horde", "Rank points", "Give-up cost"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{(state.tiers || []).slice().reverse().map((t) => <TierRow key={t.id} t={t} send={send} />)}</tbody>
          </table>
        </div>
      </Card>
      <Ranks state={state} send={send} />
    </div>
  );
}

const th = { textAlign: "left", fontFamily: MONO, fontSize: 11, color: C.dim, fontWeight: 400, letterSpacing: 1, padding: "6px 8px", borderBottom: `1px solid ${C.line}` };
const td = { padding: "8px", verticalAlign: "top", color: C.dim };
const sub = { fontFamily: MONO, fontSize: 11, color: C.faint, marginTop: 3 };
