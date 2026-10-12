// @ts-nocheck
"use client";
// components/quests/Types.tsx: which job types players get, which are tested, the twists, and test quests.
// "types_off" always sends the WHOLE off list (the game sets exactly that), built from what the page shows.

import { useEffect, useState } from "react";
import { C, MONO, BODY, Btn, Card, Note, Pill, TierPill, Input, Select, Label, Toggle, Empty, Confirm, Modal, ago } from "./ui";

const TWISTS = ["ambush", "road", "moved", "bandits", "bait"];

export default function Types({ state, send }) {
  const c = state.control || {};
  const types = c.types || [];
  const tw = c.twists || {};
  const [filter, setFilter] = useState("all");
  const [ask, setAsk] = useState(null);
  const [tested, setTested] = useState(null);        // the "mark tested" dialog
  const [tester, setTester] = useState("");
  const [twist, setTwist] = useState("");
  const [chance, setChance] = useState(null);
  useEffect(() => { if (tw.chance) setChance({ ...tw.chance }); }, [JSON.stringify(tw.chance)]);   // eslint-disable-line

  /** the OFF list, with one type (or "twists") flipped */
  const offList = (flipId) => {
    const off = types.filter((t) => (t.id === flipId ? t.on : !t.on)).map((t) => t.id);
    const twistsOn = flipId === "twists" ? !tw.on : !!tw.on;
    if (!twistsOn) off.push("twists");
    return off.join(",");
  };
  const flip = (t) => setAsk({ title: `${t.on ? "Switch off" : "Switch on"} ${t.name}?`, yes: t.on ? "Switch off" : "Switch on", danger: t.on,
    text: t.on ? `Players stop getting ${t.name} jobs. One already on the board stays until it's done.` :
      `Players start getting ${t.name} jobs.${t.tested ? "" : " It isn't marked tested yet."}`,
    onYes: () => send("types_off", { off: offList(t.id) }, `${t.name} switched ${t.on ? "off" : "on"}`) });
  const bulk = (keep, what) => {
    const off = types.filter((t) => !keep(t)).map((t) => t.id);
    if (!tw.on) off.push("twists");
    setAsk({ title: "Change several types?", yes: "Do it", text: what, onYes: () => send("types_off", { off: off.join(",") }, "Job types changed") });
  };
  const give = (t, tier) => {
    const args = { player: tester.trim(), type: t.id, tier };
    if (twist) args.twist = twist;
    send("give", args, `Test ${tier} ${t.name} for ${tester.trim()}`);
  };

  const shown = types.filter((t) => filter === "all" || (filter === "on" && t.on) || (filter === "off" && !t.on) || (filter === "new" && t.new)
    || (filter === "untested" && !t.tested) || (filter === "ready" && t.tested && !t.on));
  const onCount = types.filter((t) => t.on).length;

  return (
    <div>
      <Card title={`Job types (${onCount} of ${types.length} on)`} right={<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[["all", "All"], ["on", "On"], ["off", "Off"], ["new", "New"], ["untested", "Not tested"], ["ready", "Tested but off"]].map(([k, l]) =>
          <Btn key={k} sm c={filter === k ? "gold" : "dim"} onClick={() => setFilter(k)}>{l}</Btn>)}
      </div>}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Btn sm c="green" onClick={() => bulk((t) => t.on || t.tested, "Switch on every type that's marked tested. The rest stay as they are.")}>Tested ones on</Btn>
          <Btn sm c="red" onClick={() => bulk((t) => (t.new && !t.tested ? false : t.on), "Switch off every new type that isn't tested. The rest stay as they are.")}>Untested new ones off</Btn>
        </div>
        {shown.length === 0 ? <Empty>Nothing in this list.</Empty> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: BODY, fontSize: 13 }}>
              <thead><tr>{["Players get it", "Type", "Tiers", "Tested", "Twists it can get"].map((h) =>
                <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>{shown.map((t) => (
                <tr key={t.id} style={{ borderBottom: `1px solid ${C.lineSoft}`, opacity: t.live === false ? 0.55 : 1 }}>
                  <td style={td}><Toggle on={!!t.on} onChange={() => flip(t)} /></td>
                  <td style={td}>
                    <div style={{ color: C.text }}>{t.name} {t.new && <Pill c={C.orange}>new</Pill>} {t.board === false && <Pill c={C.faint} title="Never on the board itself">not on board</Pill>}</div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{t.id}{t.live === false ? " / not running (its mod is off or missing)" : ""}</div>
                  </td>
                  <td style={td}>{String(t.tiers || "").split("").map((x) => <TierPill key={x} t={x} style={{ marginRight: 3 }} />)}</td>
                  <td style={td}>
                    <Btn sm c={t.tested ? "green" : "dim"} onClick={() => t.tested
                      ? setAsk({ title: `Mark ${t.name} as not tested?`, yes: "Not tested", text: "It stays on or off as it is.", onYes: () => send("tested", { type: t.id, on: false }, `${t.name}: not tested`) })
                      : setTested(t)}>{t.tested ? "Tested" : "Not yet"}</Btn>
                    {t.tested && <div style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>{t.testedBy}{t.testedAt ? `, ${ago(t.testedAt)}` : ""}{t.note ? `: ${t.note}` : ""}</div>}
                  </td>
                  <td style={td}>{t.twists ? String(t.twists).split(",").join(", ") : "none"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Twists">
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
          <Toggle on={!!tw.on} onChange={() => setAsk({ title: `Turn twists ${tw.on ? "off" : "on"}?`, yes: tw.on ? "Turn off" : "Turn on",
            text: "A twist is something going wrong on the way (an ambush, a moved drop...). Pay doesn't change.", onYes: () => send("types_off", { off: offList("twists") }, `Twists ${tw.on ? "off" : "on"}`) })} />
          <span style={{ fontFamily: BODY, fontSize: 14, color: C.text }}>Twists {tw.on ? "on" : "off"} for players</span>
          <Btn sm c={tw.tested ? "green" : "dim"} onClick={() => tw.tested
            ? send("tested", { type: "twists", on: false }, "Twists: not tested")
            : setTested({ id: "twists", name: "Twists" })}>{tw.tested ? "Tested" : "Not tested yet"}</Btn>
        </div>
        {chance && (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            {["D", "C", "B", "A"].map((k) => (
              <div key={k} style={{ width: 90 }}>
                <Label><TierPill t={k} /> chance %</Label>
                <Input type="number" value={chance[k]} onChange={(v) => setChance({ ...chance, [k]: v })} min={0} max={100} />
              </div>
            ))}
            <Btn c="solid" onClick={() => send("twist_chance", Object.fromEntries(["D", "C", "B", "A"].map((k) => [k, Math.max(0, Math.min(100, Number(chance[k]) || 0))])), "Twist chances saved")}>Save chances</Btn>
          </div>
        )}
        <Note style={{ marginTop: 10 }}>How often a plain job gets a twist, by tier{tw.custom ? " (your numbers)" : " (the defaults)"}. Never on S, escorts, fights, traps, community or rescue jobs.</Note>
      </Card>

      <Card title="Test a job type">
        <Note style={{ marginBottom: 12 }}>Give one player a job of any type and tier, even a type that's off for players. It comes as an admin job (red on the phone, near them).</Note>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 12 }}>
          <div><Label>Player</Label><Input value={tester} onChange={setTester} placeholder="In-game name" /></div>
          <div><Label>Twist</Label><Select value={twist} onChange={setTwist} options={[{ value: "", label: "none" }, ...TWISTS]} /></div>
        </div>
        {!tester.trim() ? <Note>Type a player name to see the buttons.</Note> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {types.filter((t) => t.live !== false).map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: BODY, fontSize: 13, color: C.text, width: 200 }}>{t.name}</span>
                {String(t.tiers || "").split("").map((x) => <Btn key={x} sm c="dim" onClick={() => give(t, x)} title={`Give ${tester} a ${x} ${t.name}`}>{x}</Btn>)}
              </div>
            ))}
          </div>
        )}
      </Card>

      {ask && <Confirm {...ask} onClose={() => setAsk(null)} />}
      {tested && <TestedDialog t={tested} send={send} onClose={() => setTested(null)} />}
    </div>
  );
}

function TestedDialog({ t, send, onClose }) {
  const [note, setNote] = useState("");
  return (
    <Modal title={`Mark ${t.name} as tested`} onClose={onClose} width={480} footer={<>
      <Btn c="dim" onClick={onClose}>Cancel</Btn>
      <Btn c="solid" onClick={() => { send("tested", { type: t.id, on: true, note: note.slice(0, 160) }, `${t.name}: tested`); onClose(); }}>Mark tested</Btn>
    </>}>
      <Label>A note: what you tried, what worked (optional)</Label>
      <Input value={note} onChange={setNote} autoFocus />
    </Modal>
  );
}

const th = { textAlign: "left", fontFamily: MONO, fontSize: 11, color: C.dim, fontWeight: 400, letterSpacing: 1, padding: "6px 8px", borderBottom: `1px solid ${C.line}` };
const td = { padding: "8px", verticalAlign: "top", color: C.dim };
