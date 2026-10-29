// @ts-nocheck
"use client";
// components/cardsadmin/CallsCard.tsx: the players' Call a Mechanic requests (mod 1.8.77, the cards state's "calls") with a
// CLOSE for each live one. Same as Zombita Control > CARDS > MECHANIC CALLS > CLOSE: the game closes the call, nobody is paid
// and no refund code is made (for a call already settled by hand, a treasury refund say). A taken call's job is called off;
// the Mechanic loses nothing. Sends call_close {reqId, note} through /api/admin/cards/cmd (bot zip Zombita_call_close.zip).

import { useState } from "react";
import { C, MONO, BODY, Btn, Card, Note, Pill, Empty, Modal, Input, Label, ago } from "../quests/ui";

const STATE = {
  paying: ["asking the bank", C.orange],
  open: ["open", C.blue],
  taken: ["being fixed", C.gold],
  done: ["done, paid", C.green],
  refunded: ["refunded", C.dim],
  failed: ["bank said no", C.dim],
  closed: ["closed by hand", C.purple],
};

export default function CallsCard({ st, send, busy }) {
  const [closing, setClosing] = useState(null);
  const [note, setNote] = useState("");
  const calls = Array.isArray(st.calls) ? st.calls : null;
  const live = (calls || []).filter((c) => c.live);
  const ended = (calls || []).filter((c) => !c.live);

  const Row = ({ c }) => {
    const [word, col] = STATE[c.state] || [c.state, C.dim];
    return (
      <div className="ca-row" style={{ display: "flex", gap: "4px 10px", alignItems: "center", padding: "8px 4px", borderBottom: `1px solid ${C.lineSoft}`, flexWrap: "wrap" }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>{c.id}</span>
        <span style={{ fontFamily: BODY, fontSize: 14, color: C.text, flex: "1 1 160px", minWidth: 0 }}>
          {c.owner}'s car{c.place ? ` near ${c.place}` : ""}{c.mech ? `, Mechanic ${c.mech}` : ""}
        </span>
        <Pill c={col}>{word}</Pill>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.gold }}>{c.money}</span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>{c.live ? `called ${ago(c.at)}` : `ended ${ago(c.ended)}`}</span>
        {c.live && <Btn c="red" sm disabled={busy} onClick={() => { setNote(""); setClosing(c); }} title="Close it without paying anyone">Close</Btn>}
        {!c.live && c.why && <span style={{ fontFamily: BODY, fontSize: 12, color: C.dim, flexBasis: "100%" }}>{c.why}</span>}
      </div>
    );
  };

  return (
    <Card title={`Mechanic calls (${calls ? live.length + " live" : "?"})`} pad={10}>
      {!calls && <Note c="orange">The game doesn't list the calls yet: that comes with Zombita 1.8.77.</Note>}
      {calls && live.length === 0 && <Empty>No call is open or being fixed.</Empty>}
      {live.map((c) => <Row key={c.id} c={c} />)}
      {ended.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontFamily: MONO, fontSize: 12, color: C.dim, cursor: "pointer" }}>Ended in the last day ({ended.length})</summary>
          {ended.map((c) => <Row key={c.id} c={c} />)}
        </details>
      )}
      {calls && <Note style={{ marginTop: 8 }}>Close a call only when it was already settled by hand (a refund from the treasury, say). Nobody is paid and no refund code is made, so it can never pay out twice.</Note>}
      {closing && (
        <Modal title="Close this call" width={500} onClose={() => setClosing(null)} footer={<>
          <Btn c="dim" onClick={() => setClosing(null)}>Cancel</Btn>
          <Btn c="red" onClick={() => {
            const c = closing;
            send("call_close", { reqId: c.id, note: note.trim() }, `Close call ${c.id} (${c.owner}, ${c.money})`);
            setClosing(null);
          }}>Close it, pay nobody</Btn>
        </>}>
          <Note>
            {closing.owner}'s call for {closing.money} ({(STATE[closing.state] || [closing.state])[0]}{closing.mech ? `, Mechanic ${closing.mech}` : ""}).
            {" "}The game closes it: nobody is paid and no refund code is made.
            {closing.state === "taken" ? ` ${closing.mech}'s job is called off; they lose nothing.` : ""}
            {closing.state === "paying" ? " The bank was still asked to hold the money: if it answers after this, the game ignores it, so check that hold by hand." : ""}
            {" "}{closing.owner} gets a short note from Zombita. Your name stays in the server log only.
          </Note>
          <div style={{ marginTop: 14 }}>
            <Label>Note (optional, kept with the call)</Label>
            <Input value={note} onChange={setNote} placeholder="Closed by Zombita (already settled)" autoFocus />
          </div>
        </Modal>
      )}
    </Card>
  );
}
