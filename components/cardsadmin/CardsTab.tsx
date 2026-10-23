// @ts-nocheck
"use client";
// components/cardsadmin/CardsTab.tsx: one card at a time: its switch, words, perks by rank, jobs, who holds it (take back /
// give), its top players and its own settings. "All cards" = the settings every card shares.

import { useState } from "react";
import { C, MONO, BODY, DISPLAY, Btn, Card, Note, Pill, Toggle, Empty, fmt } from "../quests/ui";
import { CardArt, NameInput, cardHex, left, cardOfSetting, groupRows, WEAR_GROUP, RANK_NAMES } from "./lib";
import { cardSwitch } from "./Overview";
import Settings from "./Settings";

export function PlayerLink({ name, goPlayer }) {
  return <button type="button" onClick={() => goPlayer(name)} style={{ background: "none", border: "none", padding: 0, color: C.text, cursor: "pointer",
    fontFamily: BODY, fontSize: 13, textDecoration: "underline", textDecorationColor: C.line, textUnderlineOffset: 3 }}>{name}</button>;
}

export function Picker({ st, pick, setPick, all = true }) {
  const cards = st.cards || [];
  const item = (id, label, color, on, sub) => (
    <button key={id} type="button" onClick={() => setPick(id)}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: pick === id ? C.panel2 : C.panel, cursor: "pointer", textAlign: "left",
        border: `1px solid ${pick === id ? C.gold : C.line}`, color: C.text, minWidth: 0 }}>
      <span style={{ width: 10, height: 10, borderRadius: 5, background: on ? color : C.faint, flexShrink: 0 }} />
      <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", color: pick === id ? C.gold : on ? C.text : C.dim, flex: 1 }}>{label}</span>
      {sub && <span style={{ fontFamily: MONO, fontSize: 11, color: C.dim }}>{sub}</span>}
    </button>
  );
  return (
    <div className="ca-pick">
      {cards.map((c) => item(c.id, c.name, cardHex(c.color), c.on, c.on ? `${(c.holders || []).length} held` : "off"))}
      {all && item("_all", "All cards", C.gold, true, "shared")}
    </div>
  );
}

function Holders({ c, st, send, ask, goPlayer }) {
  const [who, setWho] = useState("");
  const names = (st.players || []).map((p) => p.name);
  const give = () => {
    const p = who.trim();
    if (!p) return;
    ask({ title: `Give ${p} the ${c.name} card`, yes: "Give it",
          text: `Free, for the usual ${st.days} days. It replaces any card ${p} holds now.` },
        () => { send("grant", { player: p, card: c.id }, `Give ${p} the ${c.name} card`); setWho(""); });
  };
  return (
    <Card title={`Who holds it (${(c.holders || []).length})`}>
      {(c.holders || []).length === 0 && <Empty>Nobody holds the {c.name} card.</Empty>}
      {(c.holders || []).map((h) => (
        <div key={h.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.lineSoft}`, flexWrap: "wrap" }}>
          <PlayerLink name={h.name} goPlayer={goPlayer} />
          <Pill c={h.how === "earned" ? C.gold : h.how === "admin" ? C.blue : C.green}>{h.how}</Pill>
          <span style={{ fontFamily: MONO, fontSize: 12, color: C.dim, flex: 1 }}>{left(h.until)} left</span>
          <Btn sm c="red" onClick={() => ask({ title: `Take ${h.name}'s ${c.name} card back`, danger: true, yes: "Take it back",
            text: `${h.name} loses the ${c.name} card now and is told so. Their points and rank stay.` },
            () => send("revoke", { player: h.name }, `Take back ${h.name}'s ${c.name} card`))}>Take back</Btn>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 180px" }}><NameInput value={who} onChange={setWho} names={names} onEnter={give} /></div>
        <Btn disabled={!who.trim()} onClick={give}>Give this card</Btn>
      </div>
    </Card>
  );
}

function Top({ title, list, field, goPlayer }) {
  return (
    <div style={{ flex: "1 1 220px", minWidth: 0 }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.2, color: C.dim, textTransform: "uppercase", marginBottom: 6 }}>{title}</div>
      {(list || []).length === 0 && <div style={{ fontFamily: BODY, fontSize: 13, color: C.faint }}>nobody yet</div>}
      {(list || []).slice(0, 10).map((t, i) => (
        <div key={t.name} style={{ display: "flex", gap: 8, alignItems: "center", padding: "3px 0" }}>
          <span style={{ fontFamily: MONO, fontSize: 12, color: C.faint, width: 18 }}>{i + 1}</span>
          <span style={{ flex: 1, minWidth: 0 }}><PlayerLink name={t.name} goPlayer={goPlayer} /></span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: C.gold }}>{fmt(t[field])}</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.dim, width: 80, textAlign: "right" }}>{t.rank}</span>
        </div>
      ))}
    </div>
  );
}

function OneCard({ c, st, send, ask, goPlayer, setTab }) {
  const color = cardHex(c.color);
  const byRank = RANK_NAMES.map((r) => [r, (c.perks || []).filter((p) => p.rank === r)]).filter(([, l]) => l.length);
  const groups = groupRows(st.settingRows, (r) => r.group !== WEAR_GROUP && cardOfSetting(r) === c.id);
  return (
    <div>
      <Card>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <CardArt card={c} size={110} on={c.on} />
          <div style={{ flex: "1 1 260px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontFamily: DISPLAY, fontSize: 36, letterSpacing: 2, color: c.on ? color : C.dim, lineHeight: 1 }}>{c.name}</div>
              <Toggle on={!!c.on} onChange={() => cardSwitch(c, send, ask)} />
              <Pill c={c.on ? C.green : C.faint}>{c.on ? "ON" : "OFF: players see Coming soon"}</Pill>
            </div>
            <div style={{ fontFamily: BODY, fontSize: 14, color: C.text }}>{c.blurb}</div>
            <div style={{ fontFamily: BODY, fontSize: 13, color: C.dim }}><b style={{ color: C.text }}>Points from:</b> {c.from || "-"}</div>
            {c.needs && <div style={{ fontFamily: BODY, fontSize: 13, color: C.dim }}><b style={{ color: C.text }}>Needs:</b> {c.needs}</div>}
            <div style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>
              bought <b style={{ color: C.text }}>{c.bought}/{st.boughtSlots}</b> · earned <b style={{ color: C.text }}>{c.earned}/{st.earnedSlots}</b> ·
              ranks {(st.ranks || []).map((r) => `${r.name} ${fmt(r.min)}`).join(", ")}
            </div>
          </div>
        </div>
      </Card>

      <div className="ca-half">
        <Card title="Perks by rank">
          {byRank.length === 0 && <Empty>No perks listed.</Empty>}
          {byRank.map(([r, list]) => (
            <div key={r} style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 1.2, color: color, textTransform: "uppercase", marginBottom: 4 }}>{r}</div>
              {list.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "3px 0" }}>
                  <span style={{ color: p.live ? C.green : C.faint, fontFamily: MONO }}>{p.live ? "●" : "○"}</span>
                  <span style={{ fontFamily: BODY, fontSize: 13, color: p.live ? C.text : C.dim, flex: 1 }}>{p.text}{!p.live && <span style={{ color: C.orange }}> (not live yet)</span>}</span>
                </div>
              ))}
            </div>
          ))}
        </Card>
        <div>
          <Holders c={c} st={st} send={send} ask={ask} goPlayer={goPlayer} />
          <Card title="Card jobs" right={<Btn sm onClick={() => setTab("jobs")}>Send one</Btn>}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(c.jobs || []).map((j, i) => <Pill key={i} c={C.blue}>{j === "order" ? "Order" : j}</Pill>)}
              {(c.jobs || []).length === 0 && <Empty>No card jobs.</Empty>}
            </div>
          </Card>
        </div>
      </div>

      <Card title="Top players">
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <Top title={`Lately (last ${st.recentDays || 5} days)`} list={(c.top || []).filter((t) => t.recent > 0)} field="recent" goPlayer={goPlayer} />
          <Top title="Lifetime" list={c.lifeTop || []} field="life" goPlayer={goPlayer} />
        </div>
      </Card>

      {c.id === "mechanic" && <Note c="gold" style={{ marginBottom: 12 }}>The tool wear numbers (twMask, twTank...) are in the TOOL WEAR tab; the card shop's in SHOP.</Note>}
      <Settings groups={groups} send={send} ask={ask} empty={`The ${c.name} card has no settings of its own; the shared ones are under All cards.`} />
    </div>
  );
}

export default function CardsTab(x) {
  const { st, pickCard, selectCard } = x;
  const c = (st.cards || []).find((k) => k.id === pickCard);
  const shared = groupRows(st.settingRows, (r) => r.group !== WEAR_GROUP && !cardOfSetting(r));
  return (
    <div className="ca-two">
      <Picker st={st} pick={c ? pickCard : "_all"} setPick={selectCard} />
      <div style={{ minWidth: 0 }}>
        {c ? <OneCard c={c} {...x} /> : (
          <>
            <Note style={{ marginBottom: 12 }}>Settings every card shares: price, days, slots, how points come, ranks, card jobs, the card shop.
              Each card's own numbers are on its page; tool wear has its own tab.</Note>
            <Settings groups={shared} send={x.send} ask={x.ask} empty="The game hasn't sent its settings list yet." />
          </>
        )}
      </div>
    </div>
  );
}
