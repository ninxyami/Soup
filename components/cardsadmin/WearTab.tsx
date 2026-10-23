// @ts-nocheck
"use client";
// components/cardsadmin/WearTab.tsx: tool wear (mod ZW_Wear): the MODS switch "toolwear" (flipped through Live Ops' za_switch),
// what wears now (an action wears while tool wear is on AND one of its cards is on), and the numbers (cards settings tw*).

import { C, MONO, BODY, DISPLAY, Card, Note, Pill, Toggle } from "../quests/ui";
import { WEAR_ACTIONS, FUTURE_CARDS, WEAR_GROUP, groupRows, cardHex } from "./lib";
import Settings from "./Settings";

export default function WearTab({ st, zc, switches, send, sendSwitch, ask }) {
  const cards = st.cards || [];
  const on = switches ? switches.toolwear === true : null;
  const cardOn = (id) => !!st.on && !!cards.find((c) => c.id === id)?.on;
  const flip = () => {
    const to = !on;
    ask({ title: to ? "Turn tool wear ON" : "Turn tool wear OFF", danger: !to, yes: to ? "Turn it on" : "Turn it off",
          text: (to ? "Tools start counting uses for the actions below whose card is on. Tools already in the world start full."
                    : "Nothing wears; the counts made so far are kept for when it's back on.") +
                (on === null ? " (The page can't read the switch right now: this sends it anyway.)" : "") },
        () => sendSwitch("toolwear", to, `Tool wear ${to ? "ON" : "OFF"}`));
  };
  const groups = groupRows(st.settingRows, (r) => r.group === WEAR_GROUP);
  return (
    <div>
      <div className="ca-half">
        <Card title="Tool wear">
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <Toggle on={on === true} onChange={flip} />
            <div style={{ fontFamily: DISPLAY, fontSize: 32, letterSpacing: 2, color: on ? C.green : on === false ? C.red : C.dim, lineHeight: 1 }}>{on === null ? "?" : on ? "ON" : "OFF"}</div>
            <div style={{ fontFamily: BODY, fontSize: 13, color: C.dim, flex: "1 1 200px" }}>The MODS switch "Tool wear" (Zombita Control &gt; MODS in game).</div>
          </div>
          {on === null && <Note c="orange" style={{ marginTop: 12 }}>Live Ops can't read the switches right now (server down or the board is old).</Note>}
          {zc?.wearLine && <Note c="gold" style={{ marginTop: 12, color: C.text }}>The game says: {zc.wearLine}</Note>}
        </Card>
        <Card title="What wears, with which card" pad={10}>
          {WEAR_ACTIONS.map(([id, label, cs]) => {
            const live = on === true && cs.some(cardOn);
            return (
              <div key={id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 2px", borderBottom: `1px solid ${C.lineSoft}`, flexWrap: "wrap" }}>
                <span style={{ width: 10, height: 10, borderRadius: 5, background: live ? C.green : C.faint, flexShrink: 0 }} title={live ? "wears now" : "not now"} />
                <span style={{ fontFamily: BODY, fontSize: 13, color: live ? C.text : C.dim, flex: "1 1 200px" }}>{label}</span>
                <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {cs.map((c) => {
                    const card = cards.find((k) => k.id === c);
                    return <Pill key={c} c={card && cardOn(c) ? cardHex(card.color) : C.faint}>{card?.name || FUTURE_CARDS[c] || c}{card ? "" : " (to come)"}</Pill>;
                  })}
                </span>
              </div>
            );
          })}
          <Note style={{ marginTop: 8 }}>Green = wears now: tool wear on and one of its cards on. The Mechanic card alone = car work and torch refills only.</Note>
        </Card>
      </div>
      <Settings groups={groups} send={send} ask={ask}
        empty="The game hasn't sent the tool wear numbers (they come with the tool wear code in the mod)." />
    </div>
  );
}
