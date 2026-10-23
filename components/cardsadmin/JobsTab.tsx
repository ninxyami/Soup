// @ts-nocheck
"use client";
// components/cardsadmin/JobsTab.tsx: send a card job now; the card jobs and Call a Mechanic jobs open on Zombita's Jobs
// (/api/admin/jobs); the Mechanic's scrapyards, calls and tow trucks (Zombita Control > CARDS via the Live Ops board).

import { useState } from "react";
import { C, MONO, BODY, Btn, Card, Note, Pill, TierPill, Select, Label, Empty, dur } from "../quests/ui";
import { PlayerPicker } from "../quests/GiveLog";
import { cardHex, KV } from "./lib";

const KIND_WORDS = {
  tow: "Tow a wreck to the nearest scrapyard (needs a scrapyard set).",
  fleet: "Service a fleet of 3 cars.",
  powerup: "Generator and power work.",
  roadside: "Repair a broken car where it stands.",
  salvage: "Strip a wreck for metal.",
  partsrun: "Bring car parts.",
  order: "Bring the trade's goods.",
  theme: "A themed job for the card.",
  contract: "A crafting contract (from the contract rank).",
  supply: "Bring medical supplies.",
};

export default function JobsTab({ st, zc, jobs, send, ask, apiGet }) {
  const cards = st.cards || [];
  const [f, setF] = useState({ player: "", card: "mechanic", kind: "random" });
  const card = cards.find((c) => c.id === f.card);
  const kinds = card?.kinds || [];
  const go = () => {
    const who = f.player.trim();
    if (!who) return;
    const kn = f.kind === "random" ? "any kind" : (kinds.find((k) => k.id === f.kind)?.name || f.kind);
    ask({ title: `Send ${who} a ${card?.name} job`, yes: "Send it",
          text: `A ${card?.name} card job (${kn}), now. ${who} must be online. If they don't hold the ${card?.name} card they get it first (free). Not counted in their jobs a day.` },
        () => send("job", { player: who, card: f.card, kind: f.kind }, `${card?.name} job (${kn}) for ${who}`));
  };
  const quests = jobs?.state?.quests || [];
  const cardJobs = quests.filter((q) => q.kind === "card" && q.type !== "callmech");
  const calls = quests.filter((q) => q.type === "callmech");
  const yards = zc?.yards ? String(zc.yards).split(";").map((s) => s.trim()).filter(Boolean) : [];
  const Job = ({ q }) => (
    <div className="ca-row" style={{ display: "flex", gap: "4px 10px", alignItems: "center", padding: "8px 4px", borderBottom: `1px solid ${C.lineSoft}`, flexWrap: "wrap" }}>
      <TierPill t={q.tier} />
      <span style={{ fontFamily: BODY, fontSize: 14, color: C.text, flex: "1 1 220px", minWidth: 0 }}>{q.title}</span>
      {q.onlyFor && <Pill c={C.blue}>for {q.onlyFor}</Pill>}
      {(q.racers || []).length > 0 && <Pill c={C.green}>{q.racers.map((r) => r.name).join(", ")} on it</Pill>}
      <span style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>{q.town || q.place || ""}</span>
      <span style={{ fontFamily: MONO, fontSize: 12, color: C.gold }}>{q.pay}</span>
      <span style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>{dur(q.left)} left</span>
    </div>
  );

  return (
    <div>
      <Card title="Send a card job now" style={{ borderColor: C.gold }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 12, alignItems: "end" }}>
          <div><Label>Player (online)</Label><PlayerPicker value={f.player} onChange={(v) => setF((x) => ({ ...x, player: v }))} apiGet={apiGet} /></div>
          <div><Label>Card</Label><Select value={f.card} onChange={(v) => setF({ ...f, card: v, kind: "random" })}
            options={cards.map((c) => ({ value: c.id, label: c.name + (c.on ? "" : " (off)") }))} /></div>
          <div><Label>Kind</Label><Select value={f.kind} onChange={(v) => setF({ ...f, kind: v })}
            options={[{ value: "random", label: "Any kind" }, ...kinds.map((k) => ({ value: k.id, label: k.name }))]} /></div>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
          <Btn c="solid" disabled={!f.player.trim()} onClick={go} style={{ fontSize: 14, padding: "10px 20px" }}>Send the job</Btn>
          <span style={{ fontFamily: BODY, fontSize: 13, color: C.dim, flex: "1 1 240px" }}>
            {f.kind !== "random" && KIND_WORDS[f.kind] ? KIND_WORDS[f.kind] + " " : ""}The game picks a job it can make right now; if it can't, it says why.
          </span>
        </div>
        {card && !card.on && <Note c="orange" style={{ marginTop: 10 }}>The {card.name} card is OFF: the game refuses its jobs until it's on.</Note>}
      </Card>

      <div className="ca-half">
        <Card title={`Open card jobs (${jobs?.state ? cardJobs.length : "-"})`} pad={10}>
          {!jobs && <Note>Reading Zombita's Jobs...</Note>}
          {jobs?.failed && <Note c="red">Can't read Zombita's Jobs right now.</Note>}
          {jobs?.state && cardJobs.length === 0 && <Empty>No card jobs open.</Empty>}
          {cardJobs.map((q) => <Job key={q.id} q={q} />)}
        </Card>
        <div>
          <Card title="Call a Mechanic" pad={10}>
            <KV k="Players' calls" v={zc ? (zc.calls || "none") : "unknown (Live Ops board not readable)"} />
            {calls.length > 0 && <div style={{ marginTop: 6 }}>{calls.map((q) => <Job key={q.id} q={q} />)}</div>}
            {jobs?.state && calls.length === 0 && <Note style={{ marginTop: 6 }}>No call is being repaired as a job right now. Open calls wait on the Mechanics' phones until one takes it.</Note>}
          </Card>
          <Card title={`Scrapyards (${zc ? yards.length : "?"})`} pad={10}>
            {!zc && <Note c="orange">Unknown: the Live Ops board isn't readable.</Note>}
            {zc && yards.length === 0 && <Note c="orange">None. Tow jobs need at least one.</Note>}
            {yards.map((y) => <div key={y} style={{ fontFamily: MONO, fontSize: 13, padding: "4px 0", color: C.text }}>{y}</div>)}
            <Note style={{ marginTop: 8 }}>Add or clear them in game (they need your position): Zombita Control &gt; CARDS &gt; ADD SCRAPYARD HERE / CLEAR SCRAPYARDS.</Note>
          </Card>
          <Card title="Tow trucks" pad={10}>
            <KV k="Out with holders" v={zc ? String(zc.mechTrucks ?? 0) : "?"} />
            <KV k="Waiting to go back" v={zc ? String(zc.mechRetire ?? 0) : "?"} />
            <KV k="Mechanic card spot" v={zc ? (zc.mechSpot || "not set") : "?"} c={zc?.mechSpot ? C.text : C.orange} />
          </Card>
        </div>
      </div>
      <Note>Card jobs come by themselves too: {st.offersPerDay} a day per holder, at least {Number(st.settings?.jobGapMins ?? 30)} minutes apart.
        {" "}<span style={{ color: cardHex(card?.color) }}>{card?.name}</span> jobs: {(card?.jobs || []).map((j) => (j === "order" ? "Order" : j)).join(", ") || "-"}.</Note>
    </div>
  );
}
