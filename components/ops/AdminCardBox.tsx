// @ts-nocheck
"use client";
// components/ops/AdminCardBox.tsx - Live Ops > Notoriety: an admin's own words on a real in-game card from Zombita or Queen Dusk
// (Nin 10-31). The same card as Zombita Control > WANTED. Goes through NotorietyTab's send(): POST /api/admin/notoriety
// {cmd: "card", who, target, text}, and the game's answer shows in the tab's message line. The bot and the game both check it again.
import { useState } from "react";

const MAX = 300;

export default function AdminCardBox({ send, busy, C, mono, btn }) {
  const [who, setWho] = useState("zombita");
  const [everyone, setEveryone] = useState(false);
  const [name, setName] = useState("");
  const [text, setText] = useState("");

  const field = { ...mono, fontSize: 12, background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 3, padding: "4px 6px" };
  const label = { color: C.grey, fontSize: 11 };
  const words = text.trim();
  const target = everyone ? "all" : name.trim();
  const tooLong = words.length > MAX;
  const ready = !busy && words !== "" && !tooLong && target !== "";

  function go() {
    if (!ready) return;
    if (everyone && !window.confirm("Send this card to everyone online? One a minute, and it can't be taken back.")) return;
    send({ cmd: "card", who, target, text: words }, "Sending the card");
  }

  return (
    <div style={{ ...mono, fontSize: 12, border: `1px solid ${C.line}`, borderRadius: 3, padding: 8, marginBottom: 12 }}>
      <div style={{ color: C.gold, marginBottom: 6 }}>Send a card</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", alignItems: "center", marginBottom: 6 }}>
        <label style={label}>From{" "}
          <select aria-label="From" value={who} onChange={(e) => setWho(e.target.value)} style={field}>
            <option value="zombita">Zombita</option>
            <option value="dusk">Queen Dusk</option>
          </select>
        </label>
        <label style={label}>To{" "}
          <input aria-label="To" value={name} onChange={(e) => setName(e.target.value)} disabled={everyone} maxLength={40}
                 placeholder={everyone ? "Everyone online" : "Player name"} style={{ ...field, width: 160, opacity: everyone ? 0.5 : 1 }} />
        </label>
        <label style={label}>
          <input type="checkbox" aria-label="Everyone" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} /> Everyone
        </label>
      </div>
      <textarea aria-label="Text" value={text} onChange={(e) => setText(e.target.value)} rows={3}
                style={{ ...field, width: "100%", boxSizing: "border-box", resize: "vertical" }} />
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
        <button style={btn(C.gold)} disabled={!ready} onClick={go}>Send</button>
        <span style={{ fontSize: 11, color: tooLong ? C.red : C.grey }}>{words.length} / {MAX}</span>
      </div>
      <div style={{ color: C.grey, fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>
        The card shows only these words, never who sent them. One player must be online and also gets the usual Discord DM copy.
        Everyone means all online players, one card a minute, no DMs.
      </div>
    </div>
  );
}
