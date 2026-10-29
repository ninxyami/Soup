// @ts-nocheck
"use client";
// components/quests/Faults.tsx: "Failed jobs" on the Board tab (mod 1.8.74, bot zip Zombita_jobs_fault.zip).
// The game lists the jobs that ended badly in the last 7 days (state.control.faults, newest first, at most 40). When it was
// our fault (a freeze, a restart, a bug) an admin presses "Our fault" for a player: give back the Job Rank points they lost,
// pay the listed reward from the treasury, and count the completion (Mechanic card points + job count). The game does it
// and answers in the Log, like every other request on this page.

import { useState } from "react";
import { C, MONO, BODY, Btn, Card, Note, Pill, TierPill, Input, Label, Empty, Modal, fmt, money, ago } from "./ui";

const WHY = { quit: "gave up", died: "died", expired: "ran out of time", lost: "lost the job" };
const STATE = { expired: "ran out of time", abandoned: "abandoned", failed: "failed", cancelled: "cancelled", open: "still open" };
const STATE_C = { expired: C.orange, abandoned: C.orange, failed: C.red, cancelled: C.faint, open: C.blue };

const whole = (v) => v !== "" && v != null && Number.isInteger(Number(v));

function FaultForm({ job, p, send, onClose }) {
  const recorded = Number(p.pts);
  const known = Number.isFinite(recorded) && recorded >= 0;
  const reward = Math.max(0, Math.floor(Number(job.reward) || 0));
  const [pts, setPts] = useState(known ? recorded : "");
  const [pay, setPay] = useState(true);
  const [coins, setCoins] = useState(reward);
  const [count, setCount] = useState(true);
  const [note, setNote] = useState("");
  const [sure, setSure] = useState(false);

  const ptsOk = whole(pts) && Number(pts) >= 0 && Number(pts) <= 1000;
  const coinsOk = !pay || (whole(coins) && Number(coins) >= 0 && Number(coins) <= 1000000);
  const ok = ptsOk && coinsOk;

  const lines = [];
  lines.push(Number(pts) > 0 ? `${p.name} gets ${fmt(pts)} Job Rank point${Number(pts) === 1 ? "" : "s"} back.` : `${p.name} gets no Job Rank points back.`);
  if (pay) lines.push(`${p.name} is paid ${money(coins)} from the treasury.`);
  else lines.push("Nothing is paid.");
  if (count) lines.push(`The job counts as finished for ${p.name}: Mechanic card points and the job count go up.`);
  else lines.push("The job is not counted as finished.");
  if (note.trim()) lines.push(`Note for the log: "${note.trim()}"`);

  const go = () => {
    const args = { job: job.id, player: p.name, pts: Number(pts), pay: pay ? "true" : "false", count: count ? "true" : "false" };
    if (pay) args.coins = Number(coins);
    if (note.trim()) args.note = note.trim().slice(0, 160);
    send("fault", args, `Our fault: ${job.id} for ${p.name}`);
    onClose();
  };

  if (sure) {
    return (
      <Modal title="Is this right?" onClose={onClose} width={480} footer={<>
        <Btn c="dim" onClick={() => setSure(false)}>Back</Btn>
        <Btn c="solid" onClick={go}>Yes, do it</Btn>
      </>}>
        <Note style={{ marginBottom: 10 }}>"{job.title}" ({job.id}), for {p.name}:</Note>
        <ul style={{ margin: 0, paddingLeft: 18, fontFamily: BODY, fontSize: 14, lineHeight: 1.6, color: C.text }}>
          {lines.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
        <Note style={{ marginTop: 12 }}>The game does it within a few seconds while someone is online. The answer shows up as a message and in the Log, and the player's row then says fixed.</Note>
      </Modal>
    );
  }

  return (
    <Modal title={`Our fault: ${p.name}`} onClose={onClose} width={500} footer={<>
      <Btn c="dim" onClick={onClose}>Cancel</Btn>
      <Btn c="solid" disabled={!ok} onClick={() => setSure(true)}>Next</Btn>
    </>}>
      <Note style={{ marginBottom: 14 }}>"{job.title}" ({job.id}) {STATE[job.state] || job.state}. {p.name} {WHY[p.why] || "lost the job"}
        {known ? `, and lost ${fmt(recorded)} Job Rank point${recorded === 1 ? "" : "s"}.` : ". The game did not record how many points were taken."}</Note>

      <Label>Job Rank points to give back</Label>
      <Input type="number" value={pts} onChange={setPts} min={0} max={1000} placeholder={known ? "" : "How many? (0-1000)"} />
      <div style={{ fontFamily: MONO, fontSize: 11, color: ptsOk || pts === "" ? C.faint : C.red, marginTop: 4, marginBottom: 14 }}>
        {pts === "" ? "not recorded, type the number (0 = none)" : !ptsOk ? "a whole number from 0 to 1000" : known ? `recorded: ${fmt(recorded)}` : "you typed this one"}
      </div>

      <label style={{ display: "flex", gap: 8, alignItems: "center", fontFamily: BODY, fontSize: 14, color: C.text, cursor: "pointer" }}>
        <input type="checkbox" checked={pay} onChange={(e) => setPay(e.target.checked)} /> Pay the listed reward from the treasury
      </label>
      {pay && (
        <div style={{ marginTop: 8, marginLeft: 24 }}>
          <Label>Amount (bronze)</Label>
          <Input type="number" value={coins} onChange={setCoins} min={0} max={1000000} width={180} />
          <div style={{ fontFamily: MONO, fontSize: 11, color: coinsOk ? C.faint : C.red, marginTop: 4 }}>
            {coinsOk ? `${money(coins)} (listed: ${money(reward)})` : "0 to 1,000,000 bronze"}
          </div>
        </div>
      )}

      <label style={{ display: "flex", gap: 8, alignItems: "center", fontFamily: BODY, fontSize: 14, color: C.text, cursor: "pointer", marginTop: 14 }}>
        <input type="checkbox" checked={count} onChange={(e) => setCount(e.target.checked)} /> Count the completion (Mechanic card points + job count)
      </label>

      <div style={{ marginTop: 14 }}>
        <Label>Note (optional, for the log)</Label>
        <Input value={note} onChange={(v) => setNote(String(v).slice(0, 160))} placeholder="e.g. the server froze during the tow" />
      </div>
    </Modal>
  );
}

export default function FailedJobs({ control, send }) {
  const [open, setOpen] = useState(null);           // { job, p }
  const list = control?.faults;
  if (!Array.isArray(list)) {
    return (
      <Card title="Failed jobs">
        <Note>The game sends this list from mod 1.8.74 on: jobs that ended badly in the last 7 days, with an "Our fault" button for each player.</Note>
      </Card>
    );
  }
  return (
    <Card title={`Failed jobs (${list.length})`} right={<span style={{ fontFamily: BODY, fontSize: 12, color: C.dim }}>last 7 days, newest first</span>}>
      <Note style={{ marginBottom: 12 }}>Jobs that ran out of time, were given up, failed or were cancelled. When it was our fault (a freeze, a restart,
        a bug), press "Our fault" for the player: points back, the reward paid, the job counted.</Note>
      {list.length === 0 ? <Empty>No failed jobs in the last 7 days.</Empty> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((j) => (
            <div key={j.id + ":" + j.at} style={{ background: C.bg, border: `1px solid ${C.line}`, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {j.tier && <TierPill t={j.tier} />}
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontFamily: BODY, fontSize: 14, color: C.text }}>{j.title || j.id}</div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>
                    {j.id} / {j.type || "?"}{j.kind ? ` / ${j.kind}` : ""} / {ago(j.at)}{Number(j.reward) > 0 ? ` / pays ${money(j.reward)}` : ""}
                  </div>
                </div>
                <Pill c={STATE_C[j.state] || C.dim}>{STATE[j.state] || j.state || "ended"}</Pill>
              </div>
              {(j.players || []).length === 0 ? (
                <div style={{ fontFamily: BODY, fontSize: 12, color: C.faint, marginTop: 8 }}>Nobody was on it.</div>
              ) : (
                <div style={{ marginTop: 8 }}>
                  {j.players.map((p) => {
                    const pts = Number(p.pts);
                    return (
                      <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "6px 0", borderTop: `1px solid ${C.lineSoft}` }}>
                        <div style={{ flex: 1, minWidth: 160, fontFamily: BODY, fontSize: 13 }}>
                          <span style={{ color: C.text }}>{p.name}</span>
                          <span style={{ color: C.dim }}> {WHY[p.why] || (p.why ? p.why : "")}</span>
                        </div>
                        <span style={{ fontFamily: MONO, fontSize: 12, color: C.dim }} title="Job Rank points taken">
                          {pts > 0 ? `-${fmt(pts)} pts` : pts === 0 ? "no points taken" : "points not recorded"}
                        </span>
                        {p.fixed && <Pill c={C.green}>fixed</Pill>}
                        {Number(p.paid) > 0 && <Pill c={C.gold}>paid {money(p.paid)}</Pill>}
                        {p.fixed && p.counted && <Pill c={C.blue}>counted</Pill>}
                        {!p.fixed && <Btn sm c="orange" onClick={() => setOpen({ job: j, p })}>Our fault</Btn>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {open && <FaultForm job={open.job} p={open.p} send={send} onClose={() => setOpen(null)} />}
    </Card>
  );
}
