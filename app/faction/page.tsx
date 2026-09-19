"use client";
// @ts-nocheck
// One faction's page (/faction?id=<fid>): banner, logo, members with their numbers, former members,
// history, the faction wallet. The founder unlocks it here (1 silver); owner and co-leaders set the
// pictures and motto; the owner names co-leaders; members pay into the wallet. Everything that moves
// money is a button the person presses — nothing is charged on its own.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { API } from "@/lib/constants";
import { FactionLogo, FactionBanner, fmtBronze } from "@/components/FactionBits";

function fmtGameTime(hours: number) {
  if (!hours || hours <= 0) return "—";
  const days = hours / 24, years = Math.floor(days / 360), rem = days - years * 360, months = Math.floor(rem / 30), d = Math.floor(rem - months * 30), h = Math.floor(hours % 24);
  if (years > 0) return `${years}y ${months}mo`;
  if (months > 0) return `${months}mo ${d}d`;
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h`;
}
const day = (ts: number) => (ts ? new Date(ts * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const when = (ts: number) => (ts ? new Date(ts * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

async function post(path: string, body?: any) {
  const r = await fetch(`${API}${path}`, { method: "POST", credentials: "include", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || r.statusText);
  return d;
}
async function upload(path: string, file: File) {
  const fd = new FormData(); fd.append("file", file);
  const r = await fetch(`${API}${path}`, { method: "POST", credentials: "include", body: fd });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || r.statusText);
  return d;
}

const Sec = ({ title, right, children }: any) => (
  <section className="mt-8">
    <div className="flex items-baseline justify-between gap-2 mb-2">
      <h2 className="font-mono text-[0.65rem] tracking-[0.25em] uppercase text-[#c8a84b] m-0">{title}</h2>
      {right}
    </div>
    {children}
  </section>
);
const Btn = ({ children, gold, ...p }: any) => (
  <button {...p} className={`font-mono text-[0.65rem] tracking-wider uppercase px-3 py-1.5 border transition-colors disabled:opacity-40 ${gold ? "border-[#c8a84b] text-[#c8a84b] hover:bg-[rgba(200,168,75,0.12)]" : "border-[#333] text-[#9a9a9a] hover:border-[#666] hover:text-[#e6e6e6]"}`}>{children}</button>
);
const Num = (p: any) => <input type="number" min={1} {...p} className="bg-[#0b0b0b] border border-[#333] text-[#e6e6e6] font-mono text-[0.75rem] px-2 py-1 w-32 focus:border-[#c8a84b] outline-none" />;

export default function FactionPage() {
  const [fid, setFid] = useState("");
  const [f, setF] = useState<any>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [motto, setMotto] = useState("");
  const [amount, setAmount] = useState("");
  const [payTo, setPayTo] = useState("");
  const [payAmt, setPayAmt] = useState("");
  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const load = async (id: string) => {
    try {
      const r = await fetch(`${API}/api/factions/${encodeURIComponent(id)}`, { credentials: "include" });
      if (!r.ok) throw new Error(r.status === 404 ? "No such faction." : r.statusText);
      const d = await r.json();
      setF(d); setMotto(d.motto || ""); setError("");
    } catch (e: any) { setError(e.message); }
  };
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id") || "";
    setFid(id);
    if (id) load(id); else setError("No faction given.");
  }, []);

  const act = async (fn: () => Promise<any>) => {
    setBusy(true); setMsg("");
    try { const d = await fn(); setMsg(d?.message || "Done."); await load(fid); }
    catch (e: any) { setMsg("❌ " + e.message); }
    setBusy(false);
  };

  if (error) return <main className="max-w-[960px] mx-auto px-4 py-8 font-mono text-[0.75rem] text-[#a55]">{error} <Link href="/factions" className="text-[#c8a84b] ml-2">All factions →</Link></main>;
  if (!f) return <main className="max-w-[960px] mx-auto px-4 py-8 font-mono text-[0.7rem] text-[#555]">LOADING...</main>;

  const v = f.viewer || {};
  const members = f.memberStats || [];
  const isMember = v.role && v.role !== "none";
  const gone = !!f.disbandedAt;

  return (
    <main className="max-w-[960px] mx-auto px-4 py-8">
      <div className="font-mono text-[0.65rem] text-[#555] mb-3"><Link href="/factions" className="hover:text-[#c8a84b]">Factions</Link> / {f.name}</div>

      <FactionBanner faction={f}>
        <div className="flex items-end gap-4">
          <FactionLogo faction={f} size={84} className="shadow-lg" />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h1 className="text-[1.6rem] text-[#e6e6e6] m-0 leading-none">{f.name}</h1>
              {f.tag && <span className="font-mono text-[0.8rem] text-[#c8a84b]">[{f.tag}]</span>}
              {!f.unlocked && !gone && <span className="font-mono text-[0.6rem] text-[#999] border border-[#444] px-1.5 py-0.5">LOCKED</span>}
              {gone && <span className="font-mono text-[0.6rem] text-[#a55] border border-[#533] px-1.5 py-0.5">DISBANDED {day(f.disbandedAt)}</span>}
            </div>
            {f.motto && <div className="text-[0.9rem] text-[#bbb] italic mt-1">“{f.motto}”</div>}
            <div className="font-mono text-[0.65rem] text-[#9a9a9a] mt-2 flex gap-3 flex-wrap">
              <span>👑 {f.owner || "?"}</span>
              <span>{f.memberCount} member{f.memberCount === 1 ? "" : "s"}</span>
              <span className="text-[#4a7c59]">{(f.kills || 0).toLocaleString()} kills</span>
              <span>founded {day(f.since)}</span>
              {f.renamedFrom && <span>formerly {f.renamedFrom}</span>}
            </div>
          </div>
        </div>
      </FactionBanner>

      {msg && <div className="font-mono text-[0.7rem] mt-3 text-[#c8a84b]">{msg}</div>}

      {/* unlock */}
      {v.canUnlock && (
        <div className="mt-4 border border-[#c8a84b] bg-[rgba(200,168,75,0.06)] p-4">
          <div className="text-[#e6e6e6] text-[0.9rem]">Unlock {f.name}&rsquo;s space</div>
          <div className="text-[0.8rem] text-[#9a9a9a] mt-1">A private Discord channel for your members, this page with your own logo and banner, a faction wallet, and faction wars. One payment of <b className="text-[#c8a84b]">{fmtBronze(f.unlockFee)}</b> from your wallet{f.viewerBalance != null ? <> (you have {fmtBronze(f.viewerBalance)})</> : null}. Nothing is charged until you press the button.</div>
          <div className="mt-3">
            <Btn gold disabled={busy || (f.viewerBalance != null && f.viewerBalance < f.unlockFee)} onClick={() => { if (confirm(`Pay ${fmtBronze(f.unlockFee)} to unlock ${f.name}?`)) act(() => post(`/api/factions/${fid}/unlock`)); }}>
              {f.viewerBalance != null && f.viewerBalance < f.unlockFee ? `You need ${fmtBronze(f.unlockFee)}` : `Unlock — ${fmtBronze(f.unlockFee)}`}
            </Btn>
          </div>
        </div>
      )}
      {!f.unlocked && !gone && !v.canUnlock && (
        <div className="mt-4 font-mono text-[0.7rem] text-[#777] border border-[#222] p-3">This faction is locked: its founder ({f.owner}) hasn&rsquo;t unlocked its space yet ({fmtBronze(f.unlockFee)}). It still counts on the leaderboard.</div>
      )}

      {/* owner / co-leader controls */}
      {v.canEdit && !gone && (
        <Sec title="Your faction" right={<span className="font-mono text-[0.6rem] text-[#555]">{v.role === "owner" ? "you are the owner" : "you are a co-leader"}</span>}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border border-[#222] p-3">
              <div className="font-mono text-[0.65rem] text-[#9a9a9a] mb-2">Logo (square, shows on the F8 board) &middot; Banner (wide)</div>
              <div className="flex gap-2 flex-wrap items-center">
                <input type="file" accept="image/png,image/jpeg,image/webp" ref={logoRef} className="hidden" onChange={() => { const x = logoRef.current?.files?.[0]; if (x) act(() => upload(`/api/factions/${fid}/picture/logo`, x)); if (logoRef.current) logoRef.current.value = ""; }} />
                <input type="file" accept="image/png,image/jpeg,image/webp" ref={bannerRef} className="hidden" onChange={() => { const x = bannerRef.current?.files?.[0]; if (x) act(() => upload(`/api/factions/${fid}/picture/banner`, x)); if (bannerRef.current) bannerRef.current.value = ""; }} />
                <Btn disabled={busy} onClick={() => logoRef.current?.click()}>Upload logo</Btn>
                <Btn disabled={busy} onClick={() => bannerRef.current?.click()}>Upload banner</Btn>
                <span className="font-mono text-[0.6rem] text-[#555]">PNG / JPEG / WEBP, up to 2 MB</span>
              </div>
            </div>
            <div className="border border-[#222] p-3">
              <div className="font-mono text-[0.65rem] text-[#9a9a9a] mb-2">Motto</div>
              <div className="flex gap-2">
                <input value={motto} maxLength={140} onChange={(e: any) => setMotto(e.target.value)} placeholder="A line under your name" className="flex-1 bg-[#0b0b0b] border border-[#333] text-[#e6e6e6] text-[0.8rem] px-2 py-1 focus:border-[#c8a84b] outline-none" />
                <Btn disabled={busy || motto === (f.motto || "")} onClick={() => act(() => post(`/api/factions/${fid}/motto`, { motto }))}>Save</Btn>
              </div>
            </div>
          </div>
          {v.role === "owner" && (
            <div className="border border-[#222] p-3 mt-3">
              <div className="font-mono text-[0.65rem] text-[#9a9a9a] mb-2">Co-leaders can change the pictures and motto and pay out of the wallet. Only you can name them.</div>
              <div className="flex gap-2 flex-wrap">
                {members.filter((m: any) => m.name !== f.owner).map((m: any) => {
                  const co = (f.coleaders || []).includes(m.name);
                  return <Btn key={m.name} disabled={busy} gold={co} onClick={() => act(() => post(`/api/factions/${fid}/coleaders`, { name: m.name, add: !co }))}>{co ? "★ " : ""}{m.name}{co ? " — demote" : " — make co-leader"}</Btn>;
                })}
                {members.length <= 1 && <span className="font-mono text-[0.65rem] text-[#555]">Nobody else in the faction yet.</span>}
              </div>
            </div>
          )}
        </Sec>
      )}

      {/* members */}
      <Sec title="Members">
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="lb-table min-w-full">
            <thead><tr><th>Member</th><th className="text-right">Kills</th><th className="text-right hidden sm:table-cell">All time</th><th className="text-right">Deaths</th><th className="text-right">This life</th><th className="text-right hidden sm:table-cell">Best life</th><th className="hidden md:table-cell">Joined</th></tr></thead>
            <tbody>
              {members.map((m: any) => {
                const role = m.name === f.owner ? "owner" : (f.coleaders || []).includes(m.name) ? "co-leader" : "";
                const by = f.recruitedBy?.[m.name];
                return (
                  <tr key={m.name} className="lb-row text-[#ccc]">
                    <td>
                      <Link href={`/player?id=${encodeURIComponent(m.name)}`} className="text-[#e6e6e6] hover:text-[#c8a84b]">{m.name}</Link>
                      {role && <span className="font-mono text-[0.6rem] text-[#c8a84b] ml-2">{role === "owner" ? "👑 owner" : "★ co-leader"}</span>}
                      {!m.onBoard && <span className="font-mono text-[0.6rem] text-[#555] ml-2">no stats yet</span>}
                    </td>
                    <td className="text-right font-mono text-[#4a7c59]">{(m.overallKills || 0).toLocaleString()}</td>
                    <td className="text-right font-mono text-[#777] hidden sm:table-cell">{(m.alltime?.kills || 0).toLocaleString()}</td>
                    <td className="text-right font-mono text-[#a55]">{m.deaths || 0}</td>
                    <td className="text-right font-mono text-[#6ab]">{fmtGameTime(m.survival)}</td>
                    <td className="text-right font-mono text-[#c8a84b] hidden sm:table-cell">{fmtGameTime(m.bestLife)}</td>
                    <td className="font-mono text-[0.65rem] text-[#777] hidden md:table-cell">{day(f.joinedAt?.[m.name])}{by && by !== m.name ? ` · by ${by}` : ""}</td>
                  </tr>
                );
              })}
              {!members.length && <tr><td colSpan={7} className="text-[#555] font-mono text-sm italic">Nobody.</td></tr>}
            </tbody>
          </table>
        </div>
        {f.former?.length > 0 && (
          <div className="font-mono text-[0.65rem] text-[#666] mt-3">
            <span className="text-[#555]">Former members: </span>
            {f.former.map((m: any, i: number) => <span key={i}>{i ? ", " : ""}<Link href={`/player?id=${encodeURIComponent(m.name)}`} className="hover:text-[#c8a84b]">{m.name}</Link> ({day(m.joined)} – {day(m.left)})</span>)}
          </div>
        )}
      </Sec>

      {/* wallet */}
      {(isMember || v.isAdmin) && f.unlocked && (
        <Sec title="Faction wallet" right={<span className="font-mono text-[0.75rem] text-[#c8a84b]">{fmtBronze(f.wallet || 0)}</span>}>
          <div className="grid gap-3 sm:grid-cols-2">
            {isMember && !gone && (
              <div className="border border-[#222] p-3">
                <div className="font-mono text-[0.65rem] text-[#9a9a9a] mb-2">Pay in from your own wallet (bronze)</div>
                <div className="flex gap-2 items-center">
                  <Num value={amount} onChange={(e: any) => setAmount(e.target.value)} placeholder="500" />
                  <Btn gold disabled={busy || !Number(amount)} onClick={() => { if (confirm(`Put ${fmtBronze(Number(amount))} into the ${f.name} wallet?`)) act(() => post(`/api/factions/${fid}/deposit`, { amount: Number(amount) }).then((d) => { setAmount(""); return d; })); }}>Deposit</Btn>
                </div>
              </div>
            )}
            {v.canEdit && !gone && (
              <div className="border border-[#222] p-3">
                <div className="font-mono text-[0.65rem] text-[#9a9a9a] mb-2">Pay a member out of the wallet</div>
                <div className="flex gap-2 items-center flex-wrap">
                  <select value={payTo} onChange={(e: any) => setPayTo(e.target.value)} className="bg-[#0b0b0b] border border-[#333] text-[#e6e6e6] font-mono text-[0.75rem] px-2 py-1">
                    <option value="">member…</option>
                    {members.map((m: any) => <option key={m.name} value={m.name}>{m.name}</option>)}
                  </select>
                  <Num value={payAmt} onChange={(e: any) => setPayAmt(e.target.value)} placeholder="500" />
                  <Btn disabled={busy || !payTo || !Number(payAmt)} onClick={() => { if (confirm(`Pay ${fmtBronze(Number(payAmt))} to ${payTo}?`)) act(() => post(`/api/factions/${fid}/payout`, { name: payTo, amount: Number(payAmt) }).then((d) => { setPayAmt(""); return d; })); }}>Pay</Btn>
                </div>
              </div>
            )}
          </div>
          {f.ledger?.length > 0 && (
            <table className="lb-table min-w-full mt-3">
              <thead><tr><th>When</th><th>What</th><th>Who</th><th className="text-right">Amount</th><th className="text-right hidden sm:table-cell">Wallet after</th></tr></thead>
              <tbody>{f.ledger.map((l: any) => (
                <tr key={l.id} className="lb-row text-[#bbb]"><td className="font-mono text-[0.65rem] text-[#777]">{when(l.at)}</td><td className="font-mono text-[0.7rem]">{l.kind}{l.note ? ` · ${l.note}` : ""}</td><td>{l.player}</td><td className={`text-right font-mono ${l.amount < 0 ? "text-[#a55]" : "text-[#4a7c59]"}`}>{l.amount > 0 ? "+" : ""}{l.amount.toLocaleString()}</td><td className="text-right font-mono text-[#777] hidden sm:table-cell">{(l.wallet_after || 0).toLocaleString()}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Sec>
      )}

      {/* wars: phase 2 */}
      <Sec title="Wars">
        <div className="font-mono text-[0.7rem] text-[#555] border border-[#222] p-3">No wars yet. Faction wars — 5 fighters a side, a wager, a zone — are coming.</div>
      </Sec>

      {/* history */}
      <Sec title="History">
        {f.history?.length ? (
          <ul className="list-none m-0 p-0 font-mono text-[0.7rem]">
            {f.history.map((e: any, i: number) => <li key={i} className="py-1 border-b border-[#1a1a1a] text-[#9a9a9a]"><span className="text-[#555] mr-3">{when(e.at)}</span>{e.text}</li>)}
          </ul>
        ) : <div className="font-mono text-[0.7rem] text-[#555]">Nothing recorded yet.</div>}
      </Sec>
    </main>
  );
}
