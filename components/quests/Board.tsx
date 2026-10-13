// @ts-nocheck
"use client";
// components/quests/Board.tsx: the state of Zombita's Jobs at a glance and the things you do most: the switches, the
// tier unlocks (A at 25k kills...), what's on the board right now (win / cancel), post a job now.

import { useEffect, useState } from "react";
import { C, MONO, BODY, Btn, Card, Note, Pill, TierPill, Stat, Input, Select, Label, Toggle, Empty, Confirm, Modal, fmt, money, dur, ago } from "./ui";

const UNLOCKS = [["A", "A"], ["S", "S"], ["SS", "SS"], ["SSS", "SSS"], ["SSS+", "SSSP"]];

function TierUnlocks({ state, send }) {
  const cur = state.tierUnlocks || {};
  const def = state.tierUnlocksDefault || {};
  const open = state.tierOpen || {};
  const [vals, setVals] = useState({});
  useEffect(() => { setVals(Object.fromEntries(UNLOCKS.map(([k]) => [k, cur[k] ?? ""]))); }, [JSON.stringify(cur)]);   // eslint-disable-line
  const changed = UNLOCKS.some(([k]) => Number(vals[k]) !== Number(cur[k]));
  const save = () => {
    const args = {};
    for (const [k, key] of UNLOCKS) if (vals[k] !== "" && vals[k] != null) args[key] = Math.max(0, Math.floor(Number(vals[k]) || 0));
    send("tier_unlocks", args, "Tier unlocks saved");
  };
  return (
    <Card title="Tier unlocks" right={<span style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>Server kills: <span style={{ color: C.text }}>{fmt(state.totalKills)}</span></span>}>
      <Note style={{ marginBottom: 12 }}>D, C and B are always open. A higher tier opens by itself once the whole server has this many zombie kills.
        A closed tier is never posted. A job already on the board stays until it's done or cancelled.</Note>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {UNLOCKS.map(([k]) => {
          const at = Number(cur[k] || 0), left = Math.max(0, at - Number(state.totalKills || 0));
          return (
            <div key={k} style={{ background: C.bg, border: `1px solid ${open[k] ? C.green : C.line}`, padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <TierPill t={k} />
                <span style={{ fontFamily: MONO, fontSize: 12, color: open[k] ? C.green : C.dim }}>{open[k] ? "OPEN" : `closed, ${fmt(left)} to go`}</span>
              </div>
              <Input type="number" value={vals[k]} onChange={(v) => setVals((s) => ({ ...s, [k]: v }))} min={0} />
              <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint, marginTop: 4 }}>default {fmt(def[k])}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Btn c="solid" disabled={!changed} onClick={save}>Save unlocks</Btn>
        <Btn c="dim" onClick={() => send("tier_unlocks", { at: "default" }, "Tier unlocks back to the defaults")}>Use the defaults</Btn>
        {state.tierUnlocksCustom && <Pill c={C.orange} style={{ alignSelf: "center" }}>custom</Pill>}
      </div>
    </Card>
  );
}

function Switches({ control, send }) {
  const [ask, setAsk] = useState(null);
  const list = control?.switches || [];
  if (!list.length) return null;
  return (
    <Card title="Switches">
      {list.map((s) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
          <Toggle on={!!s.on} onChange={(v) => {
            if (s.id === "quests" && !v) {
              setAsk({ title: "Turn quests off?", word: "OFF", danger: true, yes: "Turn off",
                text: "Players lose the Jobs app and running jobs pause. This page can't turn quests back on: the game only reads the website while quests are on. To switch them on again, use Zombita Control in the game (MODS).",
                onYes: () => send("switch", { id: s.id, on: false }, "Quests switched off") });
            } else send("switch", { id: s.id, on: v }, `${s.name || s.id} switched ${v ? "on" : "off"}`);
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: BODY, fontSize: 14, color: C.text }}>{s.name || s.id}</div>
            {s.about && <div style={{ fontFamily: BODY, fontSize: 12, color: C.dim }}>{s.about}</div>}
          </div>
        </div>
      ))}
      {ask && <Confirm {...ask} onClose={() => setAsk(null)} />}
    </Card>
  );
}

function WinDialog({ q, send, onClose }) {
  const names = (q.racers || []).map((r) => r.name);
  const [player, setPlayer] = useState(names[0] || "");
  return (
    <Modal title={`Give the win: ${q.title}`} onClose={onClose} width={460} footer={<>
      <Btn c="dim" onClick={onClose}>Cancel</Btn>
      <Btn c="solid" disabled={!player.trim()} onClick={() => { send("complete", { job: q.id, player: player.trim() }, `${q.id} won by ${player.trim()}`); onClose(); }}>Give the win</Btn>
    </>}>
      <Note style={{ marginBottom: 12 }}>The player gets the job's reward as if they had finished it. Use it when a job broke for someone.</Note>
      <Label>Player</Label>
      {names.length > 0 ? <Select value={player} onChange={setPlayer} options={names} /> : <Input value={player} onChange={setPlayer} placeholder="In-game name" />}
    </Modal>
  );
}

function OpenJobs({ state, send }) {
  const [ask, setAsk] = useState(null);
  const [win, setWin] = useState(null);
  const [cls, setCls] = useState("");
  const [bigS, setBigS] = useState(false);
  const quests = (state.quests || []).filter((q) => !q.trap);
  const traps = (state.quests || []).filter((q) => q.trap);
  const sClasses = state.control?.sClasses || [];
  return (
    <Card title={`On the board (${quests.length})`} right={<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <Btn sm onClick={() => setAsk({ title: "Fill the board?", yes: "Fill it",
        text: "Fill every empty slot now (3 small D/C and 2 big B/A). Closed tiers are never posted.", onYes: () => send("post_now", {}, "Board filled") })}>Fill the board</Btn>
      {sClasses.length > 0 && <Select value={cls} onChange={setCls} width={110} options={[{ value: "", label: "S class" }, ...sClasses.map((c) => (typeof c === "string" ? c : { value: c.id || c.name, label: c.name || c.id }))]} />}
      <label style={{ fontFamily: MONO, fontSize: 11, color: C.dim, display: "flex", gap: 4, alignItems: "center" }}>
        <input type="checkbox" checked={bigS} onChange={(e) => setBigS(e.target.checked)} /> big
      </label>
      <Btn sm c="dim" onClick={() => setAsk({ title: "Post an S job now?", yes: "Post S",
        text: `Put ${bigS ? "a BIG" : "an"} S tier job up now${cls ? ` (${cls})` : ""}? Everyone online hears about it. While S is still closed (tier unlocks below) the game refuses it.`,
        onYes: () => send("post_s", cls ? { big: bigS, cls } : { big: bigS }, "S job posted") })}>Post S</Btn>
    </div>}>
      {quests.length === 0 ? <Empty>The board is empty.</Empty> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: BODY, fontSize: 13 }}>
            <thead><tr>{["", "Job", "Type", "Kind", "Where", "Time left", "Pays", "Racing", ""].map((h, i) =>
              <th key={i} style={{ textAlign: "left", fontFamily: MONO, fontSize: 11, color: C.dim, fontWeight: 400, letterSpacing: 1, padding: "6px 8px", borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
            <tbody>
              {quests.map((q) => (
                <tr key={q.id} style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                  <td style={td}><TierPill t={q.tier} /></td>
                  <td style={td}><div style={{ color: C.text }}>{q.title}</div><div style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{q.id}{q.onlyFor ? ` / only for ${q.onlyFor}` : ""}</div></td>
                  <td style={td}>{q.type}</td>
                  <td style={td}>{q.kind}{q.big && q.kind !== "big" ? " / big" : ""}</td>
                  <td style={td}>{q.town || q.place || ""}</td>
                  <td style={{ ...td, fontFamily: MONO }}>{dur(q.left)}</td>
                  <td style={{ ...td, fontFamily: MONO, color: C.gold }}>{typeof q.pay === "number" ? money(q.pay) : (q.pay || "")}</td>{/* the game sends its own words ("2.5 silver"); numbers only in the demo */}
                  <td style={td}>{(q.racers || []).map((r) => r.name).join(", ") || <span style={{ color: C.faint }}>nobody</span>}</td>
                  <td style={{ ...td, whiteSpace: "nowrap", textAlign: "right" }}>
                    <Btn sm c="green" onClick={() => setWin(q)}>Win</Btn>{" "}
                    <Btn sm c="red" onClick={() => setAsk({ title: `Cancel ${q.id}?`, yes: "Cancel job", danger: true,
                      text: `Take "${q.title}" off the board? Anyone racing it loses it, with no penalty.`, onYes: () => send("cancel", { job: q.id }, `${q.id} cancelled`) })}>Cancel</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {traps.length > 0 && <Note style={{ marginTop: 10 }}>Plus {traps.length} trap{traps.length === 1 ? "" : "s"} set by players (not shown).</Note>}
      {ask && <Confirm {...ask} onClose={() => setAsk(null)} />}
      {win && <WinDialog q={win} send={send} onClose={() => setWin(null)} />}
    </Card>
  );
}
const td = { padding: "8px", verticalAlign: "top", color: C.dim };

function Derby({ derby, send }) {
  const [vals, setVals] = useState({});
  if (!derby) return null;
  const prizes = derby.prizes || [];
  return (
    <Card title="Fishing Derby" right={<Pill c={derby.on ? C.green : C.faint}>{derby.on ? "running" : "not running"}</Pill>}>
      {derby.on && <Note style={{ marginBottom: 10 }}>{fmt(derby.entries)} entries, {dur(derby.left)} left.</Note>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        {[1, 2, 3].map((place) => {
          const p = prizes[place - 1] || {};
          const v = vals[place] || { coins: p.coins ?? 0, rep: p.rep ?? 0 };
          return (
            <div key={place} style={{ background: C.bg, border: `1px solid ${C.line}`, padding: 10 }}>
              <Label>Place {place}</Label>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <Input type="number" value={v.coins} onChange={(x) => setVals((s) => ({ ...s, [place]: { ...v, coins: x } }))} placeholder="bronze" />
                <Input type="number" value={v.rep} onChange={(x) => setVals((s) => ({ ...s, [place]: { ...v, rep: x } }))} width={70} placeholder="rep" />
              </div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint, marginBottom: 6 }}>{money(v.coins)} + {v.rep || 0} rep</div>
              <Btn sm full onClick={() => send("derby_prize", { place, coins: Math.max(0, Number(v.coins) || 0), rep: Math.max(0, Math.min(10, Number(v.rep) || 0)) }, `Derby place ${place} prize saved`)}>Save</Btn>
            </div>
          );
        })}
      </div>
      {derby.on && <div style={{ marginTop: 12 }}><Btn c="red" sm onClick={() => send("derby_end", {}, "Derby ended")}>End the derby now</Btn></div>}
    </Card>
  );
}

export default function Board({ state, send }) {
  const ctl = state.control || {};
  const quests = (state.quests || []).filter((q) => !q.trap);
  const on = (ctl.switches || []).find((s) => s.id === "quests");
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 16 }}>
        <Stat label="Quests" value={on ? (on.on ? "ON" : "OFF") : state.on === false ? "OFF" : "ON"} c={(on ? on.on : state.on !== false) ? C.green : C.red} sub="for players" />
        <Stat label="Server kills" value={fmt(state.totalKills)} sub="all players together" />
        <Stat label="Jobs open at" value={fmt(state.unlockAt)} sub="kills (set in game: Zombita Control > QUESTS)" />
        <Stat label="On the board" value={quests.length} sub={`${quests.filter((q) => (q.racers || []).length).length} being raced`} />
        <Stat label="Daily limit" value={money(state.cap)} sub="pay per player a day (S included)" c={C.gold} />
      </div>
      <OpenJobs state={state} send={send} />
      <TierUnlocks state={state} send={send} />
      <Switches control={ctl} send={send} />
      <Derby derby={ctl.derby} send={send} />
      {ctl.community && (
        <Card title="Community centre">
          <Note>{ctl.community.present ? `${fmt(ctl.community.complete)} of ${fmt(ctl.community.total)} shelves complete.` : "No community centre placed yet."}</Note>
        </Card>
      )}
    </div>
  );
}
