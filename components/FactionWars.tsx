"use client";
// @ts-nocheck
// The Wars section of a faction page: the record, open wars (accept / decline / withdraw with the
// five-fighter roster), the challenge form (leaders with the WAR permission), past wars.
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";
import { fmtBronze } from "@/components/FactionBits";

const when = (ts: number) => (ts ? new Date(ts * 1000).toLocaleString("en-GB", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const STATE_COL: any = { proposed: "#c8a84b", accepted: "#4a7c59", live: "#e55", finished: "#9a9a9a", declined: "#777", withdrawn: "#777", expired: "#777", void: "#777" };

async function post(path: string, body?: any) {
  const r = await fetch(`${API}${path}`, { method: "POST", credentials: "include", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || r.statusText);
  return d;
}
const Btn = ({ children, gold, ...p }: any) => (
  <button {...p} className={`font-mono text-[0.65rem] tracking-wider uppercase px-3 py-1.5 border transition-colors disabled:opacity-40 ${gold ? "border-[#c8a84b] text-[#c8a84b] hover:bg-[rgba(200,168,75,0.12)]" : "border-[#333] text-[#9a9a9a] hover:border-[#666] hover:text-[#e6e6e6]"}`}>{children}</button>
);

function Roster({ members, picked, setPicked, max }: any) {
  return (
    <div className="flex flex-wrap gap-2">
      {members.map((m: string) => {
        const on = picked.includes(m);
        return <button key={m} type="button" onClick={() => setPicked(on ? picked.filter((x: string) => x !== m) : picked.length < max ? [...picked, m] : picked)}
          className={`font-mono text-[0.65rem] px-2 py-1 border ${on ? "border-[#c8a84b] text-[#c8a84b]" : "border-[#333] text-[#777]"}`}>{on ? "✓ " : ""}{m}</button>;
      })}
      <span className="font-mono text-[0.6rem] text-[#555] self-center">{picked.length}/{max} fighters</span>
    </div>
  );
}

export default function FactionWars({ fid, factionName, onChange }: { fid: string; factionName: string; onChange?: () => void }) {
  const [d, setD] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>({ defender: "", mode: "last_standing", arena_id: "", wager: "", when: "", roster: [] });
  const [acceptRoster, setAcceptRoster] = useState<any>({});

  const load = async () => {
    try {
      const r = await fetch(`${API}/api/factions/${fid}/wars`, { credentials: "include" });
      if (r.ok) setD(await r.json());
    } catch {}
  };
  useEffect(() => { load(); }, [fid]);

  const act = async (fn: () => Promise<any>) => {
    setBusy(true); setMsg("");
    try { const r = await fn(); setMsg(r?.message || "Done."); await load(); onChange && onChange(); }
    catch (e: any) { setMsg("❌ " + e.message); }
    setBusy(false);
  };

  if (!d) return <div className="font-mono text-[0.7rem] text-[#555]">Loading wars...</div>;
  const rules = d.rules || {};
  const rec = d.record || {};
  const open = (d.wars || []).filter((w: any) => ["proposed", "accepted", "live"].includes(w.state));
  const past = (d.wars || []).filter((w: any) => !["proposed", "accepted", "live"].includes(w.state));
  const minWhen = new Date(Date.now() + (rules.minLead || 3600) * 1000).toISOString().slice(0, 16);

  return (
    <div>
      <div className="font-mono text-[0.7rem] text-[#9a9a9a] mb-3 flex gap-4 flex-wrap">
        <span><b className="text-[#4a7c59]">{rec.wins || 0}</b> won</span>
        <span><b className="text-[#a55]">{rec.losses || 0}</b> lost</span>
        <span><b className="text-[#9a9a9a]">{rec.draws || 0}</b> drawn</span>
        <span>won <b className="text-[#c8a84b]">{fmtBronze(rec.won || 0)}</b></span>
        <span className="text-[#555]">rules: {rules.rosterSize} fighters a side · min wager {fmtBronze(rules.minWager || 0)} · Zombita's tax {rules.taxPct}% of the pot · {Math.round((rules.length || 7200) / 3600)} h · at the bell, be at the war desk (the diner) and right-click it: you're teleported to your side's start · {Math.round((rules.grace || 900) / 60)} min to do that (or to come back online) · one fighter leaves the arena = the faction loses</span>
      </div>
      {msg && <div className="font-mono text-[0.7rem] text-[#c8a84b] mb-2">{msg}</div>}

      {open.map((w: any) => {
        const mine = w.challenger === fid;
        const other = mine ? w.defenderName : w.challengerName;
        const pot = 2 * w.wager, fee = Math.floor(pot * w.tax_pct / 100);
        return (
          <div key={w.id} className="border border-[#222] p-3 mb-2">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-mono text-[0.6rem] uppercase px-1 border" style={{ color: STATE_COL[w.state], borderColor: STATE_COL[w.state] }}>{w.state}</span>
              <span className="text-[#e6e6e6]">War #{w.id} — {mine ? "you" : other} vs {mine ? other : "you"}</span>
              <span className="font-mono text-[0.65rem] text-[#777]">{w.modeText} · {w.arenaName} · {when(w.scheduled_at)} · wager {fmtBronze(w.wager)} each → winner takes {fmtBronze(pot - fee)}</span>
            </div>
            {w.rosters?.[fid] && <div className="font-mono text-[0.65rem] text-[#9a9a9a] mt-1">Your fighters: {w.rosters[fid].join(", ")}</div>}
            {w.incoming && d.viewer?.canDeclare && (
              <div className="mt-2 border-t border-[#1a1a1a] pt-2">
                <div className="font-mono text-[0.65rem] text-[#9a9a9a] mb-1">Pick your {rules.rosterSize} fighters to accept:</div>
                <Roster members={d.members || []} picked={acceptRoster[w.id] || []} setPicked={(p: any) => setAcceptRoster({ ...acceptRoster, [w.id]: p })} max={rules.rosterSize} />
                <div className="flex gap-2 mt-2">
                  <Btn gold disabled={busy || (acceptRoster[w.id] || []).length !== rules.rosterSize} onClick={() => { if (confirm(`Accept war #${w.id}? ${fmtBronze(w.wager)} leaves your faction wallet into escrow.`)) act(() => post(`/api/wars/${w.id}/accept`, { roster: acceptRoster[w.id] })); }}>Accept — {fmtBronze(w.wager)}</Btn>
                  <Btn disabled={busy} onClick={() => act(() => post(`/api/wars/${w.id}/decline`))}>Decline</Btn>
                </div>
              </div>
            )}
            {w.outgoing && d.viewer?.canDeclare && <div className="mt-2"><Btn disabled={busy} onClick={() => act(() => post(`/api/wars/${w.id}/withdraw`))}>Withdraw (wager back)</Btn></div>}
          </div>
        );
      })}
      {!open.length && <div className="font-mono text-[0.7rem] text-[#555] mb-2">No open wars.</div>}

      {d.viewer?.canDeclare && (
        <div className="border border-[#222] p-3 mt-3">
          <div className="font-mono text-[0.65rem] text-[#c8a84b] mb-2">DECLARE A WAR</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select value={form.defender} onChange={(e: any) => setForm({ ...form, defender: e.target.value })} className="bg-[#0b0b0b] border border-[#333] text-[#e6e6e6] font-mono text-[0.75rem] px-2 py-1">
              <option value="">opponent…</option>
              {(d.opponents || []).map((o: any) => <option key={o.fid} value={o.fid}>{o.name}{o.tag ? ` [${o.tag}]` : ""}</option>)}
            </select>
            <select value={form.mode} onChange={(e: any) => setForm({ ...form, mode: e.target.value })} className="bg-[#0b0b0b] border border-[#333] text-[#e6e6e6] font-mono text-[0.75rem] px-2 py-1">
              <option value="last_standing">Last standing — all five of one side dead, or one leaves the arena</option>
              <option value="ctf">Capture the flags — three flags hidden in the arena, hold all three</option>
              <option value="battle_royale">Battle royale — last standing while the zone shrinks; toxic fog outside it</option>
            </select>
            <select value={form.arena_id} onChange={(e: any) => setForm({ ...form, arena_id: e.target.value })} className="bg-[#0b0b0b] border border-[#333] text-[#e6e6e6] font-mono text-[0.75rem] px-2 py-1">
              <option value="">arena…</option>
              {(d.arenas || []).map((a: any) => <option key={a.id} value={a.id}>{a.name}{a.kind === "town" ? " (the whole town)" : ""}</option>)}
            </select>
            <input type="number" min={rules.minWager} step={100} value={form.wager} onChange={(e: any) => setForm({ ...form, wager: e.target.value })} placeholder={`wager in bronze (min ${rules.minWager})`} className="bg-[#0b0b0b] border border-[#333] text-[#e6e6e6] font-mono text-[0.75rem] px-2 py-1" />
            <input type="datetime-local" min={minWhen} value={form.when} onChange={(e: any) => setForm({ ...form, when: e.target.value })} className="bg-[#0b0b0b] border border-[#333] text-[#e6e6e6] font-mono text-[0.75rem] px-2 py-1" />
          </div>
          <div className="mt-2"><Roster members={d.members || []} picked={form.roster} setPicked={(p: any) => setForm({ ...form, roster: p })} max={rules.rosterSize} /></div>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <Btn gold disabled={busy || !form.defender || !form.arena_id || !Number(form.wager) || !form.when || form.roster.length !== rules.rosterSize}
              onClick={() => { const at = Math.floor(new Date(form.when).getTime() / 1000); if (confirm(`Declare war for ${fmtBronze(Number(form.wager))}? It leaves your faction wallet into escrow now.`)) act(() => post("/api/wars/challenge", { challenger: fid, defender: form.defender, mode: form.mode, arena_id: Number(form.arena_id), wager: Number(form.wager), scheduled_at: at, roster: form.roster }).then((r) => { setForm({ ...form, roster: [], wager: "", when: "" }); return r; })); }}>
              Declare war
            </Btn>
            <span className="font-mono text-[0.6rem] text-[#555]">Both sides put up the same wager. They have until 15 minutes before the time to accept; the fee only comes out of the pot.{rules.restarts && rules.restarts !== "none known" ? <> Server restarts at <b>{rules.restarts}</b> (server time) — a war can&rsquo;t be set within 30 min before or 15 min after one; any other restart just pauses it.</> : null}</span>
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div className="mt-3">
          <div className="font-mono text-[0.6rem] tracking-[0.2em] uppercase text-[#555] mb-1">Past wars</div>
          <table className="lb-table min-w-full">
            <thead><tr><th>#</th><th>Against</th><th className="hidden sm:table-cell">Mode · arena</th><th>When</th><th>Result</th></tr></thead>
            <tbody>{past.map((w: any) => {
              const mine = w.challenger === fid, other = mine ? w.defenderName : w.challengerName;
              const res = w.state !== "finished" ? w.state : w.result === "draw" ? "draw" : w.winner === fid ? `won ${fmtBronze(w.pot - w.fee)}` : "lost";
              return <tr key={w.id} className="lb-row text-[#bbb]"><td className="font-mono text-[#555]">{w.id}</td><td>{other}</td><td className="font-mono text-[0.65rem] text-[#777] hidden sm:table-cell">{w.modeText} · {w.arenaName}</td><td className="font-mono text-[0.65rem] text-[#777]">{when(w.scheduled_at)}</td><td className={`font-mono text-[0.7rem] ${res.startsWith("won") ? "text-[#4a7c59]" : res === "lost" ? "text-[#a55]" : "text-[#777]"}`}>{res}{w.reason ? <span className="text-[#555]"> — {w.reason}</span> : null}</td></tr>;
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
