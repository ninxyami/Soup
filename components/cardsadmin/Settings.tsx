// @ts-nocheck
"use client";
// components/cardsadmin/Settings.tsx: the game's card settings (ZCards_Server S.SETTING_ROWS, sent in the state file) as an
// editable list. The game range-checks every number; this only asks first and sends "setting {key, value}".

import { useState } from "react";
import { C, MONO, BODY, Btn, Card, Input, Empty, money } from "../quests/ui";
import { isMoney, showValue } from "./lib";

function Row({ row, send, ask, busy }) {
  const [v, setV] = useState("");
  const money_ = isMoney(row);
  const num = v === "" ? null : Number(v);
  const bad = num === null || Number.isNaN(num) || num < Number(row.min) || num > Number(row.max);
  const go = () => {
    if (bad) return;
    ask({ title: "Change a setting", yes: "Yes, change it",
          text: `${row.label}: ${showValue(row)} -> ${showValue(row, num)}. The game applies it within seconds, for everyone.` },
        () => { send("setting", { key: row.key, value: num }, `${row.label} -> ${showValue(row, num)}`); setV(""); });
  };
  return (
    <div className="ca-row" style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", alignItems: "center", padding: "10px 4px", borderBottom: `1px solid ${C.lineSoft}` }}>
      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
        <div style={{ fontFamily: BODY, fontSize: 14, color: C.text }}>{row.label}</div>
        {row.help && <div style={{ fontFamily: BODY, fontSize: 12, color: C.dim, marginTop: 2 }}>{row.help}</div>}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 15, color: C.gold, minWidth: 90, textAlign: "right" }} title={row.key}>{showValue(row)}</div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <Input value={v} onChange={setV} placeholder={`${row.min} - ${row.max}`} width={110} onEnter={go} />
        <Btn sm disabled={busy || bad} onClick={go} title={money_ ? "In bronze (1000 = 1 silver)" : ""}>Set</Btn>
      </div>
      {money_ && v !== "" && !bad && <div style={{ flexBasis: "100%", textAlign: "right", fontFamily: MONO, fontSize: 11, color: C.dim }}>= {money(num)}</div>}
    </div>
  );
}

export default function Settings({ groups, send, ask, busy, empty = "No settings here.", note = null }) {
  if (!groups.length) return <Card title="Settings"><Empty>{empty}</Empty></Card>;
  return (
    <>
      {groups.map(([g, rows]) => (
        <Card key={g} title={g} pad={12}>
          {note}
          {rows.map((r) => <Row key={r.key} row={r} send={send} ask={ask} busy={busy} />)}
        </Card>
      ))}
    </>
  );
}
