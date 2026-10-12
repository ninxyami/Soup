// @ts-nocheck
"use client";
// components/quests/GiveLog.tsx: give one player a job of your own (Give), and what was asked of the game and what it
// answered (Log), with the specials and IOUs the bot keeps.

import { useState } from "react";
import { C, MONO, BODY, Btn, Card, Note, Pill, Input, Select, Label, Empty, ItemsEditor, money, ago, fmt } from "./ui";

const TWISTS = ["ambush", "road", "moved", "bandits", "bait"];

export function Give({ state, send, apiGet }) {
  const types = (state.control?.types || []).filter((t) => t.live !== false);
  const [f, setF] = useState({ player: "", type: types[0]?.id || "horde", tier: "B", coins: "", hours: "", title: "", text: "", twist: "" });
  const [items, setItems] = useState([]);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const t = types.find((x) => x.id === f.type);
  const tiers = t ? String(t.tiers || "DCBAS").split("") : ["D", "C", "B", "A", "S"];
  const go = () => {
    const a = { player: f.player.trim(), type: f.type, tier: f.tier };
    if (f.coins !== "" && f.coins != null) a.coins = Math.max(0, Math.min(100000, Math.floor(Number(f.coins) || 0)));
    if (f.hours !== "" && f.hours != null) a.hours = Math.max(0.5, Math.min(168, Number(f.hours) || 1));
    if (f.title.trim()) a.title = f.title.trim().slice(0, 60);
    if (f.text.trim()) a.text = f.text.trim().slice(0, 200);
    if (f.twist) a.twist = f.twist;
    if (items.length) a.items = items.map(([id, n]) => ({ id, n }));
    send("give", a, `Job given to ${a.player}`);
  };
  return (
    <Card title="Give a quest">
      <Note style={{ marginBottom: 14 }}>A job for one player only, from the admins. It appears on their phone (red, an admin job) and skips the tier unlocks and the job type switches.
        Leave a field empty to use the tier's normal value.</Note>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <div><Label>Player</Label><Input value={f.player} onChange={set("player")} placeholder="In-game name" /></div>
        <div><Label>Type</Label><Select value={f.type} onChange={set("type")} options={types.length ? types.map((x) => ({ value: x.id, label: x.name })) : [f.type]} /></div>
        <div><Label>Tier</Label><Select value={f.tier} onChange={set("tier")} options={tiers} /></div>
        <div><Label>Twist</Label><Select value={f.twist} onChange={set("twist")} options={[{ value: "", label: "none" }, ...TWISTS]} /></div>
        <div><Label>Pay (bronze)</Label><Input type="number" value={f.coins} onChange={set("coins")} placeholder="tier's pot" min={0} max={100000} />
          {f.coins !== "" && <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint, marginTop: 3 }}>{money(Number(f.coins) || 0)}</div>}</div>
        <div><Label>Hours to do it</Label><Input type="number" value={f.hours} onChange={set("hours")} placeholder="tier's time" min={0.5} max={168} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 12 }}>
        <div><Label>Title (optional)</Label><Input value={f.title} onChange={set("title")} placeholder="Zombita's own words if empty" /></div>
        <div><Label>Text (optional)</Label><Input value={f.text} onChange={set("text")} /></div>
        <div><Label>Extra items for the winner (optional)</Label><ItemsEditor items={items} onChange={setItems} apiGet={apiGet} /></div>
      </div>
      <div style={{ marginTop: 16 }}><Btn c="solid" disabled={!f.player.trim()} onClick={go}>Give the job</Btn></div>
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
