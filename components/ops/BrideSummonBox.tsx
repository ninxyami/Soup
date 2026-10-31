// @ts-nocheck
"use client";
// components/ops/BrideSummonBox.tsx - Live Ops > Notoriety: bring a real Bride to one player (Nin 10-31). The same thing as Zombita Control
// > WANTED. Goes through NotorietyTab's send(): POST /api/admin/notoriety {cmd: "bride_summon", name, maids?, brides, sprinters, quiet}, and
// the game's answer shows in the tab's message line. Take her away is {cmd: "bride_remove", name}. The bot and the game both check it again.
import { useState } from "react";

const wholeIn = (v, lo, hi) => {
  const n = Number(v);
  return v !== "" && Number.isInteger(n) && n >= lo && n <= hi;
};

export default function BrideSummonBox({ send, busy, C, mono, btn }) {
  const [name, setName] = useState("");
  const [maids, setMaids] = useState("");
  const [brides, setBrides] = useState("1");
  const [sprinters, setSprinters] = useState("0");
  const [quiet, setQuiet] = useState(true);

  const field = { ...mono, fontSize: 12, background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 3, padding: "4px 6px" };
  const label = { color: C.grey, fontSize: 11 };
  const player = name.trim();
  const maidsOk = maids.trim() === "" || wholeIn(maids.trim(), 0, 20);
  const sprintersOk = wholeIn(sprinters.trim(), 0, 20);
  const ready = !busy && player !== "" && maidsOk && sprintersOk;

  function bring() {
    if (!ready) return;
    const party = `${brides === "2" ? "2 Brides" : "1 Bride"}, ${maids.trim() === "" ? "the usual bridesmaids" : `${maids.trim()} bridesmaids`}, ${sprinters.trim()} sprinters`;
    const how = quiet ? "She rises at once, 20 to 30 tiles from them, and nothing is said to anyone." : "Her normal countdown first, with the public warnings.";
    if (!window.confirm(`Bring her to ${player}? ${party}. ${how}`)) return;
    const body = { cmd: "bride_summon", name: player, brides: Number(brides), sprinters: Number(sprinters.trim()), quiet };
    if (maids.trim() !== "") body.maids = Number(maids.trim());
    send(body, "Bringing her");
  }

  function takeAway() {
    if (busy || player === "") return;
    if (!window.confirm(`Take the Bride away from ${player}? Her bridesmaids and sprinters go too, quietly, and she doesn't come back.`)) return;
    send({ cmd: "bride_remove", name: player }, "Taking her away");
  }

  return (
    <div style={{ ...mono, fontSize: 12, border: `1px solid ${C.line}`, borderRadius: 3, padding: 8, marginBottom: 12 }}>
      <div style={{ color: C.gold, marginBottom: 6 }}>Bring the Bride</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", alignItems: "center", marginBottom: 6 }}>
        <label style={label}>Player{" "}
          <input aria-label="Player" value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
                 placeholder="Player name" style={{ ...field, width: 160 }} />
        </label>
        <label style={label}>Bridesmaids{" "}
          <input aria-label="Bridesmaids" inputMode="numeric" value={maids} onChange={(e) => setMaids(e.target.value)} placeholder="usual"
                 style={{ ...field, width: 54, borderColor: maidsOk ? C.line : C.red }} />
        </label>
        <label style={label}>Brides{" "}
          <select aria-label="Brides" value={brides} onChange={(e) => setBrides(e.target.value)} style={field}>
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </label>
        <label style={label}>Sprinters{" "}
          <input aria-label="Sprinters" inputMode="numeric" value={sprinters} onChange={(e) => setSprinters(e.target.value)}
                 style={{ ...field, width: 54, borderColor: sprintersOk ? C.line : C.red }} />
        </label>
        <label style={label}>
          <input type="checkbox" aria-label="Quiet" checked={quiet} onChange={(e) => setQuiet(e.target.checked)} /> Quiet
        </label>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <button style={btn(C.red)} disabled={!ready} onClick={bring}>Bring her</button>
        <button style={btn()} disabled={busy || player === ""} onClick={takeAway}>Take her away</button>
      </div>
      <div style={{ color: C.grey, fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>
        A real Bride on one player online, no Mark or score needed. Quiet: she rises at once, 20 to 30 tiles off, with no countdown, cards or public
        lines. Not quiet: her normal countdown and warnings. Bridesmaids and sprinters are totals, 0 to 20; empty bridesmaids means the usual number.
        It moves no heat, tab, Mark or stage, and players never see who sent her.
      </div>
    </div>
  );
}
