// @ts-nocheck
"use client";
// Zombita's Jobs: what's on the phone's job board right now (the game writes it; /api/jobs), the week's finished
// jobs, the top workers, and how it all works. Refreshes itself every 30 seconds.
import { useEffect, useState } from "react";
import Link from "next/link";
import { API } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";

// the game's tier colours (ZQ_Shared.lua Q.TIERS)
const TIER: Record<string, { color: string; label: string }> = {
  S: { color: "#f25a47", label: "S" },
  A: { color: "#599ef2", label: "A" },
  B: { color: "#9ea39a", label: "B" },
  C: { color: "#73b873", label: "C" },
};
const TYPE: Record<string, { icon: string; word: string }> = {
  visit: { icon: "🧭", word: "Go there" },
  bring: { icon: "🎒", word: "Bring me" },
  code: { icon: "🔑", word: "Find the code" },
  bag: { icon: "💰", word: "Fetch a bag" },
  horde: { icon: "🧟", word: "Marked horde" },
  camp: { icon: "🔫", word: "Bandit camp" },
};
const MOOD: Record<string, string> = { warm: "warm 🙂", amused: "amused 😏", smug: "smug 😌", tired: "tired 😴", irritated: "irritated 😤", restless: "restless 🌀", neutral: "calm" };

function dur(s: number) {
  s = Math.max(0, Math.floor(s || 0));
  if (s >= 2 * 86400) return `${Math.floor(s / 86400)} days`;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return "under a minute";
}

function TierChip({ t, big }: { t: string; big?: boolean }) {
  const c = (TIER[t] || TIER.B).color;
  return (
    <span className={`inline-flex items-center justify-center font-mono font-bold ${big ? "w-8 h-8 text-sm" : "w-5 h-5 text-[0.65rem]"}`}
      style={{ color: "#0e0e0e", background: c, borderRadius: 3 }}>{t}</span>
  );
}

function Spots({ spots, taken, color }: { spots: number; taken: number; color: string }) {
  return (
    <span className="inline-flex gap-1 align-middle" title={`${taken} of ${spots} spots taken`}>
      {Array.from({ length: Math.max(1, spots) }).map((_, i) => (
        <span key={i} className="inline-block w-2.5 h-2.5" style={{ border: `1px solid ${color}`, background: i < taken ? color : "transparent", borderRadius: 2 }} />
      ))}
    </span>
  );
}

function JobCard({ j, now, me, busy, note, onTake, onLeave }: any) {
  const t = TIER[j.tier] || TIER.B;
  const ty = TYPE[j.type] || { icon: "📋", word: "Job" };
  const left = Math.max(0, (j.spots || 1) - (j.taken || 0));
  let status: any;
  if (j.state === "open") status = <span className="text-[#4a7c59]">Open · {j.spots === 1 ? "1 spot" : `${j.spots} spots`}</span>;
  else if (j.state === "running") status = <span className="text-[#c8a84b]">{left} of {j.spots} spots left · with {j.who.join(", ")}</span>;
  else if (j.state === "full") status = <span className="text-[#888]">Taken · {j.who.join(", ")}</span>;
  else if (j.state === "done") status = <span className="text-[#888]">Done by {j.who.join(", ")} ✓</span>;
  const faded = j.state === "full" || j.state === "done";
  const mine = me?.name && (j.who || []).some((w) => w.toLowerCase() === me.name.toLowerCase());
  const canTake = !mine && (j.state === "open" || j.state === "running");
  const canLeave = mine && j.state !== "done";
  return (
    <div className={`border bg-[#0f1318] p-4 flex flex-col gap-2 ${faded ? "opacity-60" : ""}`} style={{ borderColor: faded ? "#1e2530" : t.color + "66", borderLeft: `3px solid ${t.color}` }}>
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">{ty.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <TierChip t={j.tier} />
            <span className="text-[#e6e6e6] font-semibold">{j.title}</span>
          </div>
          <div className="text-[0.72rem] text-[#666] font-mono mt-1">{ty.word}{j.place ? ` · ${j.place}` : ""}</div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap text-[0.78rem] font-mono">
        <span className="flex items-center gap-2"><Spots spots={j.spots || 1} taken={j.taken || 0} color={t.color} /> {status}</span>
        <span className="text-[#c8a84b]">{j.reward}</span>
      </div>
      {(canTake || canLeave || note) && (
        <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-[#1a1f26]">
          <span className={`text-[0.72rem] font-mono ${note?.ok === false ? "text-[#e05555]" : note?.ok ? "text-[#4a7c59]" : "text-[#666]"}`}>
            {busy ? "Asking the game..." : note?.msg || (mine ? "You're on this job." : "")}
          </span>
          {me?.logged === false && canTake && (
            <a href={`${API}/auth/discord/login`} className="text-[0.72rem] font-mono text-[#5865F2] no-underline">Log in to take it →</a>
          )}
          {me?.linked && canTake && (
            <button disabled={busy} onClick={() => onTake(j)}
              className="px-3 py-1 text-[0.7rem] tracking-[0.08em] uppercase font-mono cursor-pointer disabled:opacity-50"
              style={{ background: t.color, color: "#0e0e0e", border: "none" }}>
              {j.state === "running" ? `Join ${j.who[0] || ""}` : "Take job"}
            </button>
          )}
          {me?.linked && canLeave && (
            <button disabled={busy} onClick={() => onLeave(j)}
              className="px-3 py-1 text-[0.7rem] tracking-[0.08em] uppercase font-mono cursor-pointer bg-transparent text-[#888] border border-[#333] disabled:opacity-50">
              Give up
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function JobsPage() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [me, setMe] = useState<any>(null);
  const [busy, setBusy] = useState<any>({});      // job id -> true while the game answers
  const [notes, setNotes] = useState<any>({});    // job id -> {ok, msg}

  const loadMe = () => fetch(`${API}/api/jobs/me`, { credentials: "include" }).then((r) => r.json()).then(setMe).catch(() => setMe({ logged: false }));

  // take / leave: the website asks, the game decides within a few seconds
  const ask = async (j: any, what: "take" | "leave") => {
    setBusy((b) => ({ ...b, [j.id]: true }));
    setNotes((n) => ({ ...n, [j.id]: null }));
    try {
      const r = await fetch(`${API}/api/jobs/${what}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job: j.id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Couldn't ask the game.");
      let answer = null;
      for (let i = 0; i < 20 && !answer; i++) {
        await new Promise((ok) => setTimeout(ok, 1500));
        const q = await fetch(`${API}/api/jobs/requests/${d.id}`).then((x) => x.json()).catch(() => ({}));
        if (q.done) answer = q;
      }
      setNotes((n) => ({ ...n, [j.id]: answer || { ok: null, msg: "The game hasn't answered yet - it may be restarting. Check your phone later." } }));
      load();
      loadMe();
    } catch (e: any) {
      setNotes((n) => ({ ...n, [j.id]: { ok: false, msg: e.message } }));
    }
    setBusy((b) => ({ ...b, [j.id]: false }));
  };

  const load = () => fetch(`${API}/api/jobs`).then((r) => r.json()).then((d) => { setData(d); setErr(d.error || ""); }).catch((e) => setErr(String(e)));
  useEffect(() => {
    load();
    loadMe();
    const a = setInterval(load, 30000);
    const b = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);

  const board = data?.board;
  const jobs = board?.jobs || [];
  const open = jobs.filter((j) => j.state === "open" || j.state === "running");
  const gone = jobs.filter((j) => j.state === "full" || j.state === "done");
  const order: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 };
  open.sort((a, b) => (order[a.tier] - order[b.tier]) || a.title.localeCompare(b.title));
  const nextIn = board ? board.next - now : 0;

  return (
    <main className="max-w-[860px] mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <section>
        <h1 className="text-xl sm:text-2xl tracking-[0.15em] uppercase mb-2">Zombita&apos;s Jobs</h1>
        <p className="text-[#777] text-[0.85rem] max-w-[620px]">
          Zombita hands out work through the <span className="text-[#e6e6e6]">Jobs</span> app on your in-game phone.
          A fresh batch every few hours, a few spots per job, first come, first served.
        </p>
      </section>

      {/* status */}
      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[0.75rem] text-[#666]">
        {!data && !err && <span>loading...</span>}
        {err && !board && <span className="text-[#e05555]">The job board isn&apos;t reachable right now.</span>}
        {board && (board.stale
          ? <span className="text-[#c8a84b]">Board last updated {timeAgo(board.at)} - the server may be restarting.</span>
          : <span><span className="text-[#4a7c59]">●</span> Live · updated {timeAgo(board.at)}</span>)}
        {board && board.market && board.on && <span>Batch #{board.batch} · next batch {nextIn > 60 ? `in ${dur(nextIn)}` : "any minute"}</span>}
        {board && board.mood && <span>Her mood: <span className="text-[#aaa]">{MOOD[board.mood] || board.mood}</span></span>}
        {board && !board.on && <span className="text-[#c8a84b]">Jobs are switched off right now.</span>}
      </div>

      <div className="divider" />

      {/* the board */}
      <section>
        <h2 className="text-[0.8rem] tracking-[0.15em] uppercase text-[#aaa] mb-4">On the board now</h2>
        {board && open.length === 0 && (
          <p className="text-[#555] font-mono text-sm italic">
            No open jobs right now{board.market && board.on ? ` - next batch ${nextIn > 60 ? `in ${dur(nextIn)}` : "any minute"}` : ""}.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {open.map((j) => <JobCard key={j.id} j={j} now={now} me={me} busy={busy[j.id]} note={notes[j.id]} onTake={(x) => ask(x, "take")} onLeave={(x) => ask(x, "leave")} />)}
        </div>
        {gone.length > 0 && <>
          <h3 className="text-[0.7rem] tracking-[0.12em] uppercase text-[#555] mt-6 mb-3">Already taken this batch</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {gone.map((j) => <JobCard key={j.id} j={j} now={now} me={me} busy={busy[j.id]} note={notes[j.id]} onTake={(x) => ask(x, "take")} onLeave={(x) => ask(x, "leave")} />)}
          </div>
        </>}
        <p className="text-[0.72rem] text-[#555] font-mono mt-4">
          Take a job here or on your phone (Jobs app). Online or not, it&apos;s in your Jobs app straight away, and nothing spawns until you get there.
          The game checks your Job Rank: a job above it is refused, but a friend can still invite you along.
        </p>
        {me?.logged && !me?.linked && (
          <p className="text-[0.72rem] text-[#c8a84b] font-mono mt-2">Your Discord isn&apos;t linked to a game name yet - get whitelisted to take jobs here.</p>
        )}
        {me?.linked && <p className="text-[0.72rem] text-[#666] font-mono mt-2">Taking jobs as <span className="text-[#aaa]">{me.name}</span>.</p>}
      </section>

      <div className="divider" />

      <div className="grid gap-10 md:grid-cols-[1fr_280px]">
        {/* recently done */}
        <section>
          <h2 className="text-[0.8rem] tracking-[0.15em] uppercase text-[#aaa] mb-4">Done this week</h2>
          {(data?.recent || []).length === 0
            ? <p className="text-[#555] font-mono text-sm italic">Nothing finished yet this week.</p>
            : <div className="flex flex-col">
                {data.recent.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-[#1a1a1a] text-[0.85rem]">
                    <TierChip t={r.tier} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[#ccc] truncate">{r.title}</div>
                      <div className="text-[0.7rem] text-[#666] font-mono truncate">
                        {r.who.join(" & ")}{r.dawnie ? " · one of Lady Dawnie's fakes - survived!" : ""}
                      </div>
                    </div>
                    <span className="text-[0.68rem] text-[#444] font-mono whitespace-nowrap">{timeAgo(r.at)}</span>
                  </div>
                ))}
              </div>}
        </section>

        {/* top workers */}
        <section>
          <h2 className="text-[0.8rem] tracking-[0.15em] uppercase text-[#aaa] mb-4">Hardest workers</h2>
          {(data?.top || []).length === 0
            ? <p className="text-[#555] font-mono text-sm italic">No one yet. Be the first.</p>
            : <div className="flex flex-col gap-2">
                {data.top.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-[0.85rem]">
                    <span className="truncate">
                      <span className="text-[#555] font-mono mr-2">{i + 1}.</span>
                      <a href={`/player?id=${encodeURIComponent(p.name)}`} className="hover:text-[#4a7c59]">{p.name}</a>
                      {p.rank && <span className="text-[0.62rem] text-[#c8a84b] ml-2 font-mono">{p.rank}</span>}
                    </span>
                    <span className="font-mono text-[0.75rem] text-[#aaa] whitespace-nowrap">{p.pts} pts</span>
                  </div>
                ))}
                <Link href="/leaderboard" className="text-[0.72rem] text-[#4a7c59] font-mono mt-2">Full Jobs leaderboard →</Link>
              </div>}
        </section>
      </div>

      <div className="divider" />

      {/* how it works */}
      <section className="flex flex-col gap-8">
        <h2 className="text-[0.8rem] tracking-[0.15em] uppercase text-[#aaa]">How it works</h2>

        <div className="grid gap-3 sm:grid-cols-2 text-[0.85rem] text-[#aaa]">
          {[
            ["1. Take a job", "Open Jobs on your phone and accept one. Each job has a few spots - the first taker owns it, the next ones join as a party."],
            ["2. Do it", "Go somewhere, bring her supplies, find a bag with a code, fetch a bag, clear a marked horde, or wipe out a bandit camp."],
            ["3. Get your code", "A finished job gives each of you a reward code (ZJ-XXXXX). Enter it on the phone: items arrive in a duffel, coins go to your wallet."],
            ["4. Rank up", "Every job earns points toward your Job Rank, and a higher rank unlocks bigger jobs."],
          ].map(([h, b]) => (
            <div key={h} className="border border-[#1e2530] bg-[#0f1318] p-4">
              <div className="text-[#e6e6e6] mb-1">{h}</div>
              <div className="text-[0.8rem] leading-relaxed">{b}</div>
            </div>
          ))}
        </div>

        <div>
          <h3 className="text-[0.7rem] tracking-[0.12em] uppercase text-[#555] mb-3">Tiers</h3>
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="lb-table min-w-full">
              <thead><tr><th>Tier</th><th className="text-right">Pay</th><th className="text-right">Horde size</th><th className="text-right">Rank points</th><th className="text-right hidden sm:table-cell">Extra rep</th></tr></thead>
              <tbody>
                {(data?.tiers || []).slice().reverse().map((t) => (
                  <tr key={t.id} className="lb-row">
                    <td><TierChip t={t.id} /></td>
                    <td className="text-right font-mono">x{t.mult}</td>
                    <td className="text-right font-mono">{t.horde}</td>
                    <td className="text-right font-mono">{t.points}</td>
                    <td className="text-right font-mono hidden sm:table-cell">{t.rep ? `+${t.rep}` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[0.72rem] text-[#555] font-mono mt-2">Hordes grow by a quarter for every extra party member. Everyone in the party gets the full reward.</p>
        </div>

        <div>
          <h3 className="text-[0.7rem] tracking-[0.12em] uppercase text-[#555] mb-3">Job Rank</h3>
          <div className="grid gap-2 sm:grid-cols-4">
            {(data?.ranks || []).map((r) => (
              <div key={r.name} className="border border-[#1e2530] p-3 text-center">
                <div className="text-[#c8a84b]">{r.name}</div>
                <div className="text-[0.7rem] text-[#666] font-mono">{r.min}+ score</div>
                <div className="text-[0.7rem] text-[#888] font-mono mt-1">tiers: {r.tiers}</div>
              </div>
            ))}
          </div>
          <p className="text-[0.72rem] text-[#555] font-mono mt-2">Your score comes from your kills, your longest life, Dawn of the Dead nights survived and jobs done, minus deaths.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 text-[0.8rem] text-[#aaa]">
          <div className="border border-[#1e2530] p-4">
            <div className="text-[#e6e6e6] mb-1">🤝 Parties</div>
            Invite phone friends or faction mates to your job (up to 4). An invite skips the rank check - bring a Rookie along to an S job.
          </div>
          <div className="border border-[#1e2530] p-4" style={{ borderColor: "#c8a84b55" }}>
            <div className="text-[#c8a84b] mb-1">★ Specials</div>
            Get on Zombita&apos;s good side and she may send you a job just for you, in her own words - with a little extra rep.
          </div>
          <div className="border border-[#1e2530] p-4" style={{ borderColor: "#e0555555" }}>
            <div className="text-[#e05555] mb-1">🎭 Lady Dawnie</div>
            Sometimes a &quot;go there&quot; job was faked by Lady Dawnie. Zombita is worried sick - fight your way out or run, and you still get paid.
          </div>
        </div>
      </section>
    </main>
  );
}
