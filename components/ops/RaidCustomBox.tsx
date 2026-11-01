// @ts-nocheck
"use client";
// components/ops/RaidCustomBox.tsx - Live Ops > Notoriety: an admin's own raid (Nin 11-01). The same thing as Zombita Control > WANTED > A CUSTOM RAID.
// Goes through NotorietyTab's send(): POST /api/admin/notoriety {cmd: "raid_custom", name, zombies, waves, gap (seconds), sprint, pack, bandits, bandit_waves,
// brides, maids, who, quiet, pace, friends, hold}, and the game's answer shows in the tab's message line. Stop is {cmd: "raid_stop", name, all?}. The bot and the
// game both check it again.
import { useState } from "react";

const MAX = 100000;
const wholeIn = (v, lo, hi) => {
  const n = Number(v);
  return v !== "" && Number.isInteger(n) && n >= lo && n <= hi;
};

/** The plan in plain words, for the confirm box. */
export function raidWords({ zombies, waves, gapMin, sprint, pack, bandits, brides, maids }) {
  const parts = [];
  if (zombies > 0) parts.push(`${zombies} zombies in ${waves} ${waves === 1 ? "wave" : "waves"} (${Math.floor(zombies / waves)} each), ${gapMin} min apart, ${sprint}% sprinters`);
  if (pack > 0) parts.push(`${pack} sprinters from one spot each wave`);
  if (bandits > 0) parts.push(`${bandits} of Crowe's men after them`);
  if (brides > 0) parts.push(brides === 1 ? "the Bride" : "2 Brides");
  if (maids > 0) parts.push(`${maids} bridesmaids`);
  return parts.join(", ");
}

export default function RaidCustomBox({ send, busy, C, mono, btn }) {
  const [name, setName] = useState("");
  const [zombies, setZombies] = useState("1000");
  const [waves, setWaves] = useState("4");
  const [gapMin, setGapMin] = useState("5");
  const [sprint, setSprint] = useState("0");
  const [pack, setPack] = useState("0");
  const [bandits, setBandits] = useState("0");
  const [groups, setGroups] = useState("1");
  const [brides, setBrides] = useState("0");
  const [maids, setMaids] = useState("0");
  const [who, setWho] = useState("dusk");
  const [quiet, setQuiet] = useState(true);
  const [pace, setPace] = useState(true);
  const [friends, setFriends] = useState(false);
  const [hold, setHold] = useState(true);

  const field = { ...mono, fontSize: 12, background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 3, padding: "4px 6px" };
  const label = { color: C.grey, fontSize: 11 };
  const player = name.trim();
  const gapOk = gapMin.trim() !== "" && Number(gapMin) >= 0 && Number(gapMin) <= 1440;
  const oks = {
    zombies: wholeIn(zombies.trim(), 0, MAX), waves: wholeIn(waves.trim(), 1, 1000), sprint: wholeIn(sprint.trim(), 0, 100), pack: wholeIn(pack.trim(), 0, MAX),
    bandits: wholeIn(bandits.trim(), 0, MAX), groups: wholeIn(groups.trim(), 1, 1000), maids: wholeIn(maids.trim(), 0, MAX),
  };
  const numbersOk = gapOk && Object.values(oks).every(Boolean);
  const words = numbersOk ? raidWords({ zombies: Number(zombies), waves: Number(waves), gapMin: Number(gapMin), sprint: Number(sprint), pack: Number(pack),
    bandits: Number(bandits), brides: Number(brides), maids: Number(maids) }) : "";
  const ready = !busy && player !== "" && words !== "";

  function go() {
    if (!ready) return;
    const how = quiet ? "Quiet: nothing is said to anyone." : `Announced, from ${who === "crowe" ? "Silas Crowe" : "Queen Dusk"}.`;
    if (!window.confirm(`Send this raid on ${player}? ${words}. ${how} It moves no heat, Mark or stage.`)) return;
    send({ cmd: "raid_custom", name: player, zombies: Number(zombies), waves: Number(waves), gap: Math.round(Number(gapMin) * 60), sprint: Number(sprint), pack: Number(pack),
      bandits: Number(bandits), bandit_waves: Number(groups), brides: Number(brides), maids: Number(maids), who, quiet, pace, friends, hold }, "Sending the raid");
  }

  function stop(all) {
    if (busy || player === "") return;
    const what = all ? `Stop the raid on ${player} and take away its zombies and the Bride it brought? Crowe's men already up stay.`
      : `Stop the raid on ${player}? Every wave still to come goes, any raid's. What is up already stays.`;
    if (!window.confirm(what)) return;
    send({ cmd: "raid_stop", name: player, all }, "Stopping the raid");
  }

  const num = (text, value, set, ok, width = 62) => (
    <label style={label}>{text}{" "}
      <input aria-label={text} inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} style={{ ...field, width, borderColor: ok ? C.line : C.red }} />
    </label>
  );
  const tick = (text, value, set) => (
    <label style={label}><input type="checkbox" aria-label={text} checked={value} onChange={(e) => set(e.target.checked)} /> {text}</label>
  );

  return (
    <div style={{ ...mono, fontSize: 12, border: `1px solid ${C.line}`, borderRadius: 3, padding: 8, marginBottom: 12 }}>
      <div style={{ color: C.gold, marginBottom: 6 }}>Custom raid</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", alignItems: "center", marginBottom: 6 }}>
        <label style={label}>Player{" "}
          <input aria-label="Player" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Player name" style={{ ...field, width: 160 }} />
        </label>
        {num("Zombies in all", zombies, setZombies, oks.zombies, 70)}
        {num("Waves", waves, setWaves, oks.waves, 48)}
        {num("Minutes apart", gapMin, setGapMin, gapOk, 48)}
        {num("Sprinters %", sprint, setSprint, oks.sprint, 48)}
        {num("Pack each wave", pack, setPack, oks.pack, 54)}
        {num("Bandits", bandits, setBandits, oks.bandits, 54)}
        {num("Bandit groups", groups, setGroups, oks.groups, 48)}
        <label style={label}>Brides{" "}
          <select aria-label="Brides" value={brides} onChange={(e) => setBrides(e.target.value)} style={field}>
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </label>
        {num("Bridesmaids", maids, setMaids, oks.maids, 54)}
        <label style={label}>From{" "}
          <select aria-label="From" value={who} onChange={(e) => setWho(e.target.value)} style={field}>
            <option value="dusk">Queen Dusk</option>
            <option value="crowe">Silas Crowe</option>
          </select>
        </label>
        {tick("Quiet", quiet, setQuiet)}
        {tick("Pacing", pace, setPace)}
        {tick("Friends' share", friends, setFriends)}
        {tick("Waits for Horde Night", hold, setHold)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <button style={btn(C.red)} disabled={!ready} onClick={go}>Send the raid</button>
        <button style={btn()} disabled={busy || player === ""} onClick={() => stop(false)}>Stop waves</button>
        <button style={btn(C.red)} disabled={busy || player === ""} onClick={() => stop(true)}>Stop and take it all away</button>
      </div>
      <div style={{ color: C.grey, fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>
        {words ? `${words}. ` : ""}The real raid system on anyone online, Marked or not: tagged, hunted, paced, cleaned up, with the loot bags. Zombies in all is the total, split over the
        waves. Pacing on: the next wave waits while the alive cap is reached. Off: it comes at its gap. A wave rises in one server tick, so a huge one is a hitch for everybody. Without
        Friends&apos; share the total is exact. Waits for Horde Night also waits for a raid close by. It moves no heat, tab, Mark or stage, and players never see who sent it.
      </div>
    </div>
  );
}
