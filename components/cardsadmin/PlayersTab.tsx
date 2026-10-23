// @ts-nocheck
"use client";
// components/cardsadmin/PlayersTab.tsx: card points first (Nin couldn't find the old POINTS box), then everyone with points
// and one player: their card, points and rank per card, give / take back a card.

import { useEffect, useMemo, useRef, useState } from "react";
import { C, MONO, BODY, DISPLAY, Btn, Card, Note, Pill, Select, Label, Empty, fmt } from "../quests/ui";
import { PlayerPicker } from "../quests/GiveLog";
import { inputStyle } from "../quests/ui";
import { cardHex, left, rankOf } from "./lib";

function PointsForm({ st, form, setForm, send, ask, apiGet }) {
  const cards = st.cards || [];
  const n = Math.trunc(Number(form.points) || 0);
  const p = (st.players || []).find((x) => x.name.toLowerCase() === form.player.trim().toLowerCase());
  const card = cards.find((c) => c.id === form.card);
  const [life, recent] = p?.pts?.[form.card] || [0, 0];
  const after = n > 0 ? life + n : Math.max(0, life + n);
  const r0 = rankOf(life, st.ranks), r1 = rankOf(after, st.ranks);
  const ok = form.player.trim() && n !== 0 && Math.abs(n) <= 10000;
  const go = () => {
    if (!ok) return;
    const who = form.player.trim();
    ask({ title: n > 0 ? `Add ${n} ${card?.name} points` : `Take ${-n} ${card?.name} points`, danger: n < 0, yes: n > 0 ? "Add them" : "Take them",
          text: `${who}: ${card?.name} lifetime ${fmt(life)} -> ${fmt(after)}${r0.i !== r1.i ? ` (${r0.name} -> ${r1.name})` : ""}.` +
                (n > 0 ? " Recent points go up too, so it counts for the earned slot." : " Minus takes from lifetime only.") },
        () => { send("points", { player: who, card: form.card, points: n }, `${who}: ${n > 0 ? "+" : ""}${n} ${card?.name} points`); setForm((f) => ({ ...f, points: "" })); });
  };
  const quick = [10, 25, 50, 100, -10, -50];
  return (
    <Card title="Add or take card points" style={{ borderColor: C.gold }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 12, alignItems: "end" }}>
        <div><Label>Player</Label><PlayerPicker value={form.player} onChange={(v) => setForm((f) => ({ ...f, player: v }))} apiGet={apiGet} /></div>
        <div><Label>Card</Label><Select value={form.card} onChange={(v) => setForm((f) => ({ ...f, card: v }))}
          options={cards.map((c) => ({ value: c.id, label: c.name + (c.on ? "" : " (off)") }))} /></div>
        <div><Label>Points (minus to take)</Label>
          <input value={form.points} onChange={(e) => setForm((f) => ({ ...f, points: e.target.value.replace(/[^0-9-]/g, "") }))} placeholder="+50 / -20" inputMode="numeric"
            onKeyDown={(e) => e.key === "Enter" && go()}
            style={{ ...inputStyle, width: "100%" }} /></div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        {quick.map((q) => <Btn key={q} sm c={q > 0 ? "green" : "red"} onClick={() => setForm((f) => ({ ...f, points: String(q) }))}>{q > 0 ? `+${q}` : q}</Btn>)}
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
        <Btn c="solid" disabled={!ok} onClick={go} style={{ fontSize: 14, padding: "10px 20px" }}>
          {n < 0 ? `Take ${-n} points` : n > 0 ? `Add ${n} points` : "Add points"}
        </Btn>
        <div style={{ fontFamily: BODY, fontSize: 13, color: C.dim, flex: "1 1 240px" }}>
          {form.player.trim() ? (
            <>{p ? <>Now: <b style={{ color: C.text }}>{fmt(life)}</b> lifetime ({r0.name}), {fmt(recent)} recent.</> : <>No {card?.name} points yet (or not a name the game knows).</>}
              {n !== 0 && <> After: <b style={{ color: C.gold }}>{fmt(after)}</b>{r0.i !== r1.i && <> = <b style={{ color: C.gold }}>{r1.name}</b></>}.</>}</>
          ) : "Plus adds to lifetime (the rank) and recent (who is offered the earned slot). Minus takes from lifetime only."}
        </div>
      </div>
    </Card>
  );
}

function OnePlayer({ p, st, send, ask, setForm, formRef }) {
  const cards = st.cards || [];
  const [give, setGive] = useState("mechanic");
  const held = p.card && Number(p.until) > Date.now() / 1000 ? cards.find((c) => c.id === p.card) : null;
  const fill = (card, n) => { setForm({ player: p.name, card, points: String(n) }); formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  return (
    <Card title={p.name} right={held ? <Pill c={cardHex(held.color)}>{held.name}</Pill> : <Pill c={C.faint}>no card</Pill>}>
      {held ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <span style={{ fontFamily: BODY, fontSize: 14 }}>Holds the <b style={{ color: cardHex(held.color) }}>{held.name}</b> card ({p.how}), {left(p.until)} left.
            {p.kit && " Took the Mechanic Kit."}</span>
          <Btn sm c="red" onClick={() => ask({ title: `Take ${p.name}'s ${held.name} card back`, danger: true, yes: "Take it back",
            text: `${p.name} loses the ${held.name} card now and is told so. Points and rank stay.` },
            () => send("revoke", { player: p.name }, `Take back ${p.name}'s ${held.name} card`))}>Take back</Btn>
        </div>
      ) : <Note style={{ marginBottom: 14 }}>Holds no card right now.</Note>}

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>Give a card:</span>
        <Select value={give} onChange={setGive} width={170} options={cards.map((c) => ({ value: c.id, label: c.name + (c.on ? "" : " (off)") }))} />
        <Btn sm onClick={() => {
          const c = cards.find((k) => k.id === give);
          ask({ title: `Give ${p.name} the ${c?.name} card`, yes: "Give it",
                text: `Free, for the usual ${st.days} days.${held ? ` It replaces their ${held.name} card.` : ""}${c && !c.on ? " That card is OFF: they hold it but can't use it until it's on." : ""}` },
              () => send("grant", { player: p.name, card: give }, `Give ${p.name} the ${c?.name} card`));
        }}>Give</Btn>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {cards.map((c) => {
          const [life, recent] = p.pts?.[c.id] || [0, 0];
          const r = rankOf(life, st.ranks);
          return (
            <div key={c.id} className="ca-row" style={{ display: "flex", alignItems: "center", gap: "4px 12px", padding: "8px 4px", borderBottom: `1px solid ${C.lineSoft}`, flexWrap: "wrap", opacity: life || recent ? 1 : 0.55 }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: cardHex(c.color), flexShrink: 0 }} />
              <span style={{ fontFamily: MONO, fontSize: 13, width: 100, color: C.text }}>{c.name}</span>
              <span style={{ fontFamily: MONO, fontSize: 13, color: C.gold, width: 70 }} title="lifetime">{fmt(life)}</span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: C.dim, width: 80 }} title={`last ${st.recentDays || 5} days`}>{fmt(recent)} recent</span>
              <span style={{ fontFamily: BODY, fontSize: 12, color: C.text, flex: "1 1 120px" }}>{r.name}{r.next && <span style={{ color: C.faint }}> ({fmt(r.nextAt - life)} to {r.next})</span>}</span>
              <span style={{ display: "flex", gap: 4 }}>
                <Btn sm c="green" onClick={() => fill(c.id, 10)}>+</Btn>
                <Btn sm c="red" onClick={() => fill(c.id, -10)}>-</Btn>
              </span>
            </div>
          );
        })}
      </div>
      <Note style={{ marginTop: 10 }}>+ / - fill the points box at the top with this card; change the number there and press the button.</Note>
    </Card>
  );
}

export default function PlayersTab({ st, send, ask, pickPlayer, setPickPlayer, apiGet }) {
  const players = st.players || [];
  const [q, setQ] = useState("");
  const [onlyHolders, setOnlyHolders] = useState(false);
  const [form, setForm] = useState({ player: "", card: "mechanic", points: "" });
  const formRef = useRef(null);
  const panelRef = useRef(null);
  useEffect(() => { if (pickPlayer) setForm((f) => ({ ...f, player: pickPlayer })); }, [pickPlayer]);
  const total = (p) => Object.values(p.pts || {}).reduce((a, v) => a + (v?.[0] || 0), 0);
  const list = useMemo(() => players
    .filter((p) => (!q || p.name.toLowerCase().includes(q.toLowerCase())) && (!onlyHolders || (p.card && Number(p.until) > Date.now() / 1000)))
    .sort((a, b) => total(b) - total(a)), [players, q, onlyHolders]);
  const cards = st.cards || [];
  // someone with no card points yet still opens (an empty record): give them a card or points from there
  const sel = players.find((p) => p.name === pickPlayer) || (pickPlayer ? { name: pickPlayer, card: "", how: "", until: 0, pts: {} } : null);
  const pick = (name) => { setPickPlayer(name); setTimeout(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); };
  // the picker's box both filters the list and, on a whole name (picked from its list), opens that player
  const findPlayer = (v) => {
    setQ(v);
    const hit = players.find((p) => p.name.toLowerCase() === v.trim().toLowerCase());
    if (hit && hit.name !== pickPlayer) pick(hit.name);
  };

  return (
    <div>
      <div ref={formRef} style={{ scrollMarginTop: 120 }}><PointsForm st={st} form={form} setForm={setForm} send={send} ask={ask} apiGet={apiGet} /></div>
      <div className="ca-two" style={{ gridTemplateColumns: undefined }}>
        <Card title={`Players with points (${players.length})`} pad={10}>
          <Label>Find a player (online first)</Label>
          <PlayerPicker value={q} onChange={findPlayer} apiGet={apiGet} />
          {q.trim() && !players.some((p) => p.name.toLowerCase() === q.trim().toLowerCase()) && (
            <Btn sm style={{ marginTop: 6 }} onClick={() => pick(q.trim())}>Open {q.trim()} (no card points yet)</Btn>
          )}
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontFamily: BODY, fontSize: 12, color: C.dim, margin: "8px 0" }}>
            <input type="checkbox" checked={onlyHolders} onChange={(e) => setOnlyHolders(e.target.checked)} /> only card holders
          </label>
          {list.length === 0 && <Empty>Nobody{q ? " with card points by that name" : ""}.</Empty>}
          <div style={{ maxHeight: 560, overflowY: "auto" }}>
            {list.slice(0, 300).map((p) => {
              const held = p.card && Number(p.until) > Date.now() / 1000 ? cards.find((c) => c.id === p.card) : null;
              return (
                <button key={p.name} type="button" onClick={() => pick(p.name)}
                  style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "7px 6px", background: p.name === pickPlayer ? C.panel2 : "transparent",
                    border: "none", borderBottom: `1px solid ${C.lineSoft}`, color: C.text, cursor: "pointer", textAlign: "left" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: held ? cardHex(held.color) : "transparent", border: held ? "none" : `1px solid ${C.faint}`, flexShrink: 0 }} />
                  <span style={{ fontFamily: BODY, fontSize: 13, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: p.name === pickPlayer ? C.gold : C.text }}>{p.name}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: C.dim }}>{fmt(total(p))}</span>
                </button>
              );
            })}
          </div>
          {list.length > 300 && <Note style={{ marginTop: 6 }}>First 300 shown. Search to find the rest.</Note>}
        </Card>
        <div ref={panelRef} style={{ minWidth: 0, scrollMarginTop: 120 }}>
          {sel ? <OnePlayer p={sel} st={st} send={send} ask={ask} setForm={setForm} formRef={formRef} />
            : <Card title="A player"><Empty>Find a player with the box, or click one in the list, to see their cards, points and ranks.</Empty></Card>}
        </div>
      </div>
      <Note>Points: lifetime sets the rank ({(st.ranks || []).map((r) => `${r.name} ${fmt(r.min)}`).join(", ")}); recent (last {st.recentDays || 5} days) decides who Zombita offers the earned slot.</Note>
    </div>
  );
}
