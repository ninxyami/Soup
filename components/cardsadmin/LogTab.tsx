// @ts-nocheck
"use client";
// components/cardsadmin/LogTab.tsx: what happened with the cards (GET /api/admin/cards/log: the game's card feed, the launch
// resets, card shop buys, paid card buys) and the requests sent from this page.

import { useMemo, useState } from "react";
import { C, MONO, BODY, Btn, Card, Note, Pill, Select, Empty, itemName, money, ago } from "../quests/ui";
import { PlayerPicker } from "../quests/GiveLog";
import { EVENT_WORDS, eventLine, cardHex, when } from "./lib";

const VIEWS = [["events", "Card events"], ["buys", "Card shop buys"], ["paid", "Cards bought"], ["mine", "Sent from here"]];

export default function LogTab({ st, log, loadLog, mine, goPlayer, apiGet }) {
  const [view, setView] = useState("events");
  const [q, setQ] = useState("");
  const [card, setCard] = useState("");
  const cards = st.cards || [];
  const cname = (id) => (id === "callmech" ? "Call a Mechanic (held)" : cards.find((c) => c.id === id)?.name || id);
  const ccol = (id) => cardHex(cards.find((c) => c.id === id)?.color);
  const match = (r) => (!q || String(r.player || r.by || "").toLowerCase().includes(q.toLowerCase())) && (!card || r.card === card);
  const events = useMemo(() => (log?.events || []).filter(match), [log, q, card]);   // eslint-disable-line
  const buys = useMemo(() => (log?.buys || []).filter(match), [log, q, card]);       // eslint-disable-line
  const paid = useMemo(() => (log?.paid || []).filter(match), [log, q, card]);       // eslint-disable-line
  const Who = ({ n }) => n ? <button type="button" onClick={() => goPlayer(n)} style={{ background: "none", border: "none", padding: 0, color: C.text, cursor: "pointer", fontFamily: BODY, fontSize: 13, fontWeight: 600 }}>{n}</button> : null;
  const Row = ({ at, children }) => (
    <div className="ca-row" style={{ display: "flex", gap: "2px 12px", alignItems: "center", padding: "7px 4px", borderBottom: `1px solid ${C.lineSoft}`, flexWrap: "wrap" }}>
      <span style={{ fontFamily: MONO, fontSize: 11, color: C.dim, width: 120 }} title={when(at)}>{when(at)}</span>
      {children}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        {VIEWS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setView(k)} style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", padding: "7px 12px",
            cursor: "pointer", background: view === k ? C.panel2 : C.panel, border: `1px solid ${view === k ? C.gold : C.line}`, color: view === k ? C.gold : C.text }}>{l}</button>
        ))}
        <span style={{ flex: 1 }} />
        <div style={{ width: 200, maxWidth: "100%" }}><PlayerPicker value={q} onChange={setQ} apiGet={apiGet} /></div>
        <Select value={card} onChange={setCard} width={140} options={[{ value: "", label: "every card" }, ...cards.map((c) => ({ value: c.id, label: c.name }))]} />
        <Btn sm c="dim" onClick={loadLog}>Refresh</Btn>
      </div>

      {view !== "mine" && !log && <Note>Reading the log...</Note>}
      {view !== "mine" && log?.missing && <Note c="orange" style={{ color: C.text }}>The log needs the bot update (Zombita_cards_admin_page.zip, not installed yet). Until then: requests sent from this page are under SENT FROM HERE, and Discord DMs still go out as before.</Note>}
      {view !== "mine" && log?.error && <Note c="red">Can't read the log ({log.error}).</Note>}
      {view !== "mine" && log && log.ok === false && <Note c="red">{log.why}</Note>}
      {view !== "mine" && (log?.errors || []).length > 0 && <Note c="red" style={{ marginBottom: 10 }}>{log.errors.join("; ")}</Note>}

      {view === "events" && log?.events && (
        <Card title={`Card events (${events.length})`} pad={10}>
          <Note style={{ marginBottom: 6 }}>From the game's card feed: the recent part only (the bot starts the file over now and then). Points resets are kept for good.</Note>
          {events.length === 0 && <Empty>Nothing yet.</Empty>}
          {events.map((e, i) => {
            const [w, col] = EVENT_WORDS[e.t] || [e.t, C.dim];
            return (
              <Row key={i} at={e.at}>
                <Pill c={col}>{w}</Pill>
                <Who n={e.player} />
                {e.card && <span style={{ fontFamily: MONO, fontSize: 12, color: ccol(e.card) }}>{e.name || cname(e.card)}</span>}
                <span style={{ fontFamily: BODY, fontSize: 12, color: C.dim, flex: "1 1 160px" }}>{eventLine(e)}</span>
              </Row>
            );
          })}
        </Card>
      )}
      {view === "buys" && log?.buys && (
        <Card title={`Card shop buys (${buys.length})`} pad={10}>
          {buys.length === 0 && <Empty>No card shop buys yet.</Empty>}
          {buys.map((b, i) => (
            <Row key={i} at={b.at}>
              <Who n={b.player} />
              <span style={{ fontFamily: MONO, fontSize: 12, color: ccol(b.card) }}>{cname(b.card)}</span>
              <span style={{ fontFamily: BODY, fontSize: 13, color: C.text, flex: "1 1 160px" }}>{b.qty} x {itemName(b.item)}</span>
              <span style={{ fontFamily: MONO, fontSize: 13, color: C.gold }}>{money(b.paid)}</span>
            </Row>
          ))}
        </Card>
      )}
      {view === "paid" && log?.paid && (
        <Card title={`Cards bought (${paid.length})`} pad={10}>
          <Note style={{ marginBottom: 6 }}>Wallet charges for cards (and Call a Mechanic money held in the treasury).</Note>
          {paid.length === 0 && <Empty>No paid cards yet.</Empty>}
          {paid.map((b, i) => (
            <Row key={i} at={b.at}>
              <Who n={b.player} />
              <span style={{ fontFamily: MONO, fontSize: 12, color: ccol(b.card), flex: "1 1 120px" }}>{cname(b.card) || "-"}</span>
              <span style={{ fontFamily: MONO, fontSize: 13, color: C.gold }}>{money(b.paid)}</span>
            </Row>
          ))}
        </Card>
      )}
      {view === "mine" && (
        <Card title={`Sent from this page (${mine.length})`} pad={10}>
          <Note style={{ marginBottom: 6 }}>Only this browser tab, since it opened.</Note>
          {mine.length === 0 && <Empty>Nothing sent yet.</Empty>}
          {[...mine].reverse().map((m) => (
            <Row key={m.id} at={m.at}>
              <Pill c={!m.done ? C.orange : m.ok ? C.green : C.red}>{!m.done ? "waiting" : m.ok ? "done" : "failed"}</Pill>
              <span style={{ fontFamily: BODY, fontSize: 13, color: C.text, flex: "1 1 200px" }}><b>{m.label}</b>{m.msg ? `: ${m.msg}` : ""}</span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{ago(m.at)}</span>
            </Row>
          ))}
        </Card>
      )}
    </div>
  );
}
