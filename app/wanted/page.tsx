"use client";
// WANTED (2026-10-14, mod 1.7.196 Notoriety + bounties): Silas Crowe's board. Everyone Zombita has warned in public
// (Warned) or Queen Dusk has marked (Marked), with their poster and price. Noticed players are never shown here.
// Logged in: your own notoriety card. Data: GET /api/notoriety, /api/notoriety/me, posters /api/notoriety/poster/{name}.
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";

interface Wanted { name: string; stage: string; marked: boolean; lastWarning: boolean; tab: number; rate: number; raids: number; remark: string }
interface Me { on: boolean; linked: boolean; name?: string; me?: any; lines?: Record<string, number> }

function money(b: number) {
  const v = Math.max(0, Math.round(Number(b) || 0));
  const s = Math.floor(v / 1000), r = v % 1000;
  const parts: string[] = [];
  if (s) parts.push(`${s.toLocaleString("en-US")} silver`);
  if (r || !parts.length) parts.push(`${r} bronze`);
  return parts.join(" ");
}

function Poster({ w }: { w: Wanted }) {
  return (
    <div className="bg-[#0d1117] border border-[#1e2530] p-3 flex flex-col" style={{ borderTop: `3px solid ${w.marked ? "#9e2a2b" : "#d08c2c"}` }}>
      {w.marked ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`${API}/api/notoriety/poster/${encodeURIComponent(w.name)}`} alt={`Wanted: ${w.name}`}
             className="w-full border border-[#2a2f37]" loading="lazy" />
      ) : (
        <div className="w-full aspect-[600/860] flex flex-col items-center justify-center border border-[#2a2f37] bg-[#15120d] text-center p-4">
          <div className="font-mono text-[0.7rem] uppercase tracking-widest text-[#d08c2c] mb-2">{w.lastWarning ? "Last warning" : "Warned"}</div>
          <div className="text-[1.3rem] text-[#e6e8ec] font-semibold">{w.name}</div>
          <div className="text-[0.82rem] text-[#8a8f98] mt-3 leading-relaxed">
            Zombita is worried. Queen Dusk keeps saying this name. No price yet.
          </div>
        </div>
      )}
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="text-[#e6e8ec] font-semibold">{w.name}</span>
        <span className="font-mono text-[0.62rem] uppercase tracking-widest" style={{ color: w.marked ? "#e05555" : "#d08c2c" }}>
          {w.marked ? "Marked" : w.lastWarning ? "Last warning" : "Warned"}
        </span>
      </div>
      {w.tab > 0 && (
        <div className="font-mono text-[0.78rem] text-[#c8a84b] mt-1">
          {money(w.tab)}{w.rate > 0 ? `, rising ${money(w.rate)} an hour` : ""}
        </div>
      )}
      {w.marked && <div className="text-[0.8rem] text-[#8a8f98] italic mt-1">&quot;{w.remark}&quot; (S. Crowe)</div>}
    </div>
  );
}

function MyCard({ me }: { me: Me }) {
  if (!me.on) return null;
  if (!me.linked) return null;
  const p = me.me;
  const lines = me.lines || {};
  if (!p) {
    return (
      <div className="bg-[#0d1117] border border-[#1e2530] p-4 mb-6 text-[0.88rem] text-[#aab1bc]">
        <b className="text-[#e6e8ec]">{me.name}</b>: Queen Dusk hasn&apos;t noticed you. Keep it that way.
      </div>
    );
  }
  const why: any[] = Array.isArray(p.why) ? p.why : [];
  const state = p.marked ? "MARKED" : p.lastWarning ? "LAST WARNING" : p.stageName;
  return (
    <div className="bg-[#0d1117] border border-[#1e2530] p-4 mb-6">
      <div className="flex items-baseline gap-3 flex-wrap">
        <b className="text-[#e6e8ec] text-[1.05rem]">You ({me.name})</b>
        <span className="font-mono text-[0.7rem] uppercase tracking-widest" style={{ color: p.marked ? "#e05555" : "#c8a84b" }}>{state}</span>
        <span className="font-mono text-[0.72rem] text-[#8a8f98]">
          score {p.score} (deeds {p.heat}, stats {p.standing}) · lines {lines.noticed ?? 10} / {lines.warned ?? 25} / {lines.marked ?? 40}
        </span>
      </div>
      <div className="text-[0.85rem] text-[#aab1bc] mt-2">
        {p.calm ? "You're calm, so it's fading." : "You're still busy, so nothing fades yet."}
        {Number(p.tab) > 0 && <> Your tab: <b className="text-[#c8a84b]">{money(p.tab)}</b>.</>}
        {p.marked && <> While you&apos;re marked you can&apos;t send or withdraw money.</>}
      </div>
      {why.length > 0 && (
        <ul className="mt-2 text-[0.8rem] text-[#8a8f98] list-none p-0 m-0">
          {why.slice(0, 5).map((w, i) => <li key={i}>{Number(w.pts) > 0 ? `+${w.pts} ` : ""}{w.why}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function WantedPage() {
  const [board, setBoard] = useState<{ on: boolean; players: Wanted[] } | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`${API}/api/notoriety`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setBoard)
      .catch((e) => setErr(String(e.message || e)));
    fetch(`${API}/api/notoriety/me`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMe(d))
      .catch(() => {});
  }, []);

  const players = board?.players || [];
  const marked = players.filter((p) => p.marked);
  const warned = players.filter((p) => !p.marked);

  return (
    <main className="max-w-[1100px] mx-auto px-4 py-8">
      <h1 className="text-[1.6rem] text-[#e6e8ec] font-semibold m-0">Wanted</h1>
      <p className="text-[0.9rem] text-[#8a8f98] mt-2 mb-6 leading-relaxed max-w-[760px]">
        Silas Crowe&apos;s board. Notoriety is how much Queen Dusk has noticed you: winning job after job, pushing the shops,
        anything that drains the treasury, and a strong character all count. Zombita warns you first, out loud and often.
        Keep going and Dusk marks you: her hordes and Crowe&apos;s bandits come at any time, posters go up, and a price grows on
        your head every hour you play. Calm down and it fades. Die while marked and the price goes to the treasury.
      </p>
      {me && <MyCard me={me} />}
      {err && <p className="text-[#e05555] font-mono text-[0.8rem]">The board isn&apos;t reachable right now ({err}).</p>}
      {board && !board.on && <p className="text-[#8a8f98]">Notoriety isn&apos;t switched on yet.</p>}
      {board && board.on && players.length === 0 && (
        <p className="text-[#8a8f98]">Nobody is wanted right now. Queen Dusk is bored. Let&apos;s keep her that way.</p>
      )}
      {marked.length > 0 && (
        <>
          <h2 className="font-mono text-[0.75rem] uppercase tracking-widest text-[#e05555] mb-3">Marked</h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            {marked.map((w) => <Poster key={w.name} w={w} />)}
          </div>
        </>
      )}
      {warned.length > 0 && (
        <>
          <h2 className="font-mono text-[0.75rem] uppercase tracking-widest text-[#d08c2c] mb-3">Warned</h2>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {warned.map((w) => <Poster key={w.name} w={w} />)}
          </div>
        </>
      )}
    </main>
  );
}
