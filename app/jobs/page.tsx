// @ts-nocheck
"use client";
// Zombita's Jobs v2: the phone's quest board right now (the game writes it; /api/jobs) - the S quest, the big and the
// small slots, who's racing whom - the week's wins, the top workers, and how it all works. Refreshes every 30 s.
import { useEffect, useState } from "react";
import Link from "next/link";
import { API } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";

// the game's colours (ZQ_Shared.lua Q.COLORS): D / C yellow, B / A blue, S gold, personal red, exclusive violet, yours green
const COLOR = { small: "#edc740", big: "#599ef2", S: "#ffcc2e", personal: "#e64d4d", exclusive: "#ad73f5", active: "#4dd173" };
const tierColor = (t: string) => (t === "S" ? COLOR.S : t === "A" || t === "B" ? COLOR.big : COLOR.small);
const TYPE: Record<string, { icon: string; word: string }> = {
  visit: { icon: "🧭", word: "Scout" },
  bring: { icon: "🎒", word: "Bring me" },
  deliver: { icon: "📦", word: "Delivery" },
  code: { icon: "🔑", word: "Treasure" },
  bag: { icon: "💰", word: "Fetch the bag" },
  horde: { icon: "🧟", word: "Horde hunt" },
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

// 1 gold = 10 silver = 10,000 bronze (as the game says it)
function money(b: number) {
  b = Math.floor(b || 0);
  if (b >= 10000 && b % 10000 === 0) return `${b / 10000} gold`;
  if (b >= 1000) return `${String(+(b / 1000).toFixed(2))} silver`;
  return `${b} bronze`;
}

function TierChip({ t, big }: { t: string; big?: boolean }) {
  return (
    <span className={`inline-flex items-center justify-center font-mono font-bold ${big ? "w-8 h-8 text-sm" : "w-5 h-5 text-[0.65rem]"}`}
      style={{ color: "#0e0e0e", background: tierColor(t), borderRadius: 3 }}>{t}</span>
  );
}

function isMine(q: any, me: any) {
  const n = (me?.name || "").toLowerCase();
  if (!n) return false;
  return (q.racers || []).some((r) => r.name.toLowerCase() === n || (r.crew || []).some((c) => c.toLowerCase() === n));
}

function QuestCard({ q, me, busy, note, onTake, onLeave, confirm, setConfirm }: any) {
  const ty = TYPE[q.type] || { icon: "📋", word: "Quest" };
  const mine = isMine(q, me);
  const col = mine ? COLOR.active : tierColor(q.tier);
  const racers = q.racers || [];
  const closing = q.left < 15 * 60;
  const canTake = !mine && !closing;
  return (
    <div className={`border bg-[#0f1318] p-4 flex flex-col gap-2 ${q.kind === "S" ? "shadow-[0_0_24px_#ffcc2e22]" : ""}`}
      style={{ borderColor: col + "66", borderLeft: `3px solid ${col}` }}>
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">{ty.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <TierChip t={q.tier} />
            <span className="font-semibold" style={{ color: q.kind === "S" ? COLOR.S : "#e6e6e6" }}>{q.title}</span>
            {q.big && <span className="text-[0.62rem] font-mono px-1.5 py-0.5" style={{ color: COLOR.S, border: `1px solid ${COLOR.S}66` }}>2 HORDES</span>}
          </div>
          <div className="text-[0.72rem] text-[#666] font-mono mt-1">{ty.word}{q.place ? ` · ${q.place}` : ""} · {closing ? <span className="text-[#c8a84b]">closing</span> : `${dur(q.left)} left`}</div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap text-[0.78rem] font-mono">
        <span className={racers.length ? "text-[#c8a84b]" : "text-[#4a7c59]"}>
          {racers.length === 0 ? "Nobody on it yet" : "Racing: " + racers.map((r) => r.name + (r.crew?.length ? ` + ${r.crew.join(", ")}` : "")).join(" vs ")}
        </span>
        <span style={{ color: COLOR.S }} title={q.pay2 && q.pay2 !== q.pay ? `${q.pay2} each for a crew of 2` : ""}>{q.pay}{q.pay2 && q.pay2 !== q.pay ? <span className="text-[#777]"> solo</span> : ""}</span>
      </div>
      {q.type === "horde" && q.total > 1 && q.progress > 0 && (
        <div className="h-1.5 bg-[#1a1f26]"><div className="h-full" style={{ width: `${Math.min(100, (100 * q.progress) / q.total)}%`, background: col }} /></div>
      )}
      {(canTake || mine || note) && (
        <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-[#1a1f26]">
          <span className={`text-[0.72rem] font-mono ${note?.ok === false ? "text-[#e05555]" : note?.ok ? "text-[#4a7c59]" : "text-[#666]"}`}>
            {busy ? "Asking the game..." : note?.msg || (mine ? "You're on this one." : "")}
          </span>
          {me?.logged === false && canTake && (
            <a href={`${API}/auth/discord/login`} className="text-[0.72rem] font-mono text-[#5865F2] no-underline">Log in to take it →</a>
          )}
          {me?.linked && canTake && (
            <button disabled={busy} onClick={() => onTake(q)}
              className="px-3 py-1 text-[0.7rem] tracking-[0.08em] uppercase font-mono cursor-pointer disabled:opacity-50"
              style={{ background: col, color: "#0e0e0e", border: "none" }}>
              {racers.length ? "Race them" : "Take it"}
            </button>
          )}
          {me?.linked && mine && (confirm === q.id
            ? <span className="flex gap-2">
                <button disabled={busy} onClick={() => { setConfirm(null); onLeave(q); }}
                  className="px-3 py-1 text-[0.7rem] tracking-[0.08em] uppercase font-mono cursor-pointer bg-[#e05555] text-[#0e0e0e] border-none disabled:opacity-50">
                  Yes, give up
                </button>
                <button onClick={() => setConfirm(null)} className="px-3 py-1 text-[0.7rem] uppercase font-mono cursor-pointer bg-transparent text-[#888] border border-[#333]">No</button>
              </span>
            : <button disabled={busy} onClick={() => setConfirm(q.id)}
                className="px-3 py-1 text-[0.7rem] tracking-[0.08em] uppercase font-mono cursor-pointer bg-transparent text-[#888] border border-[#333] disabled:opacity-50">
                Give up
              </button>)}
        </div>
      )}
      {confirm === q.id && (
        <p className="text-[0.7rem] font-mono text-[#e05555]">Giving up costs veterans Job Rank (and Zombita&apos;s trust), and you rest longer before the next one. Rookies lose nothing.</p>
      )}
    </div>
  );
}

function Section({ title, color, children, note }: any) {
  return (
    <div className="mb-8">
      <h3 className="text-[0.72rem] tracking-[0.14em] uppercase mb-3 flex items-center gap-2" style={{ color }}>
        <span className="inline-block w-2 h-2" style={{ background: color }} />{title}
      </h3>
      {children}
      {note && <p className="text-[0.7rem] text-[#555] font-mono mt-2">{note}</p>}
    </div>
  );
}

export default function JobsPage() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [me, setMe] = useState<any>(null);
  const [busy, setBusy] = useState<any>({});      // quest id -> true while the game answers
  const [notes, setNotes] = useState<any>({});    // quest id -> {ok, msg}
  const [confirm, setConfirm] = useState<any>(null);

  const loadMe = () => fetch(`${API}/api/jobs/me`, { credentials: "include" }).then((r) => r.json()).then(setMe).catch(() => setMe({ logged: false }));
  const load = () => fetch(`${API}/api/jobs`).then((r) => r.json()).then((d) => { setData(d); setErr(d.error || ""); }).catch((e) => setErr(String(e)));

  // take / leave: the website asks, the game decides within a few seconds
  const ask = async (q: any, what: "take" | "leave") => {
    setBusy((b) => ({ ...b, [q.id]: true }));
    setNotes((n) => ({ ...n, [q.id]: null }));
    try {
      const r = await fetch(`${API}/api/jobs/${what}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job: q.id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Couldn't ask the game.");
      let answer = null;
      for (let i = 0; i < 20 && !answer; i++) {
        await new Promise((ok) => setTimeout(ok, 1500));
        const a = await fetch(`${API}/api/jobs/requests/${d.id}`).then((x) => x.json()).catch(() => ({}));
        if (a.done) answer = a;
      }
      setNotes((n) => ({ ...n, [q.id]: answer || { ok: null, msg: "The game hasn't answered yet - it may be restarting. Check your phone later." } }));
      load();
      loadMe();
    } catch (e: any) {
      setNotes((n) => ({ ...n, [q.id]: { ok: false, msg: e.message } }));
    }
    setBusy((b) => ({ ...b, [q.id]: false }));
  };

  useEffect(() => {
    load();
    loadMe();
    const a = setInterval(load, 30000);
    const b = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);

  const board = data?.board;
  const quests = (board?.quests || []).map((q) => ({ ...q, left: Math.max(0, (q.left || 0) - (now - (board?.at || now))) }));
  const sq = quests.filter((q) => q.kind === "S");
  const big = quests.filter((q) => q.kind === "big");
  const small = quests.filter((q) => q.kind === "small");
  const refillIn = board?.refillAt ? board.refillAt - now : 0;
  const card = (q) => <QuestCard key={q.id} q={q} me={me} busy={busy[q.id]} note={notes[q.id]} confirm={confirm} setConfirm={setConfirm}
                                 onTake={(x) => ask(x, "take")} onLeave={(x) => ask(x, "leave")} />;

  return (
    <main className="max-w-[860px] mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <section>
        <h1 className="text-xl sm:text-2xl tracking-[0.15em] uppercase mb-2">Zombita&apos;s Jobs</h1>
        <p className="text-[#777] text-[0.85rem] max-w-[640px]">
          Quests on the <span className="text-[#e6e6e6]">Jobs</span> app of your in-game phone. Anyone can take any quest -
          it&apos;s a race: <span className="text-[#e6e6e6]">whoever brings Zombita the code first wins</span>. Bring a crew and split the pay.
        </p>
      </section>

      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[0.75rem] text-[#666]">
        {!data && !err && <span>loading...</span>}
        {err && !board && <span className="text-[#e05555]">The quest board isn&apos;t reachable right now.</span>}
        {board && (board.stale
          ? <span className="text-[#c8a84b]">Board last updated {timeAgo(board.at)} - the server may be restarting.</span>
          : <span><span className="text-[#4a7c59]">●</span> Live · updated {timeAgo(board.at)}</span>)}
        {board && board.on && refillIn > 0 && <span>A new quest {refillIn > 60 ? `in ${dur(refillIn)}` : "any minute"}</span>}
        {board && board.mood && <span>Her mood: <span className="text-[#aaa]">{MOOD[board.mood] || board.mood}</span></span>}
        {board && !board.on && <span className="text-[#c8a84b]">Jobs are switched off right now.</span>}
      </div>

      <div className="divider" />

      <section>
        {sq.length > 0 && <Section title="S tier - pinned" color={COLOR.S} note="Rare. Paid in fresh gold, not from the treasury. Don't go alone.">
          <div className="grid gap-3">{sq.map(card)}</div>
        </Section>}
        <Section title="Big jobs (B / A)" color={COLOR.big} note="Two slots, each a B or an A by chance. A tier is nasty - bring friends.">
          {big.length === 0 ? <p className="text-[#555] font-mono text-sm italic">Refilling - a new one any minute.</p>
            : <div className="grid gap-3 sm:grid-cols-2">{big.map(card)}</div>}
        </Section>
        <Section title="Jobs (D / C)" color={COLOR.small} note="Three slots, always full: when one is won or runs out, a new one comes up a few minutes later.">
          {small.length === 0 ? <p className="text-[#555] font-mono text-sm italic">Refilling - a new one any minute.</p>
            : <div className="grid gap-3 sm:grid-cols-3">{small.map(card)}</div>}
        </Section>
        <p className="text-[0.72rem] text-[#555] font-mono">
          Take a quest here or on your phone - online or not, it&apos;s in your Jobs app straight away. One quest at a time, then a short rest.
          Personal and exclusive quests are private: only on your phone.
        </p>
        {me?.logged && !me?.linked && (
          <p className="text-[0.72rem] text-[#c8a84b] font-mono mt-2">Your Discord isn&apos;t linked to a game name yet - get whitelisted to take quests here.</p>
        )}
        {me?.linked && <p className="text-[0.72rem] text-[#666] font-mono mt-2">Taking quests as <span className="text-[#aaa]">{me.name}</span>.</p>}
      </section>

      <div className="divider" />

      <div className="grid gap-10 md:grid-cols-[1fr_280px]">
        <section>
          <h2 className="text-[0.8rem] tracking-[0.15em] uppercase text-[#aaa] mb-4">Won this week</h2>
          {(data?.recent || []).length === 0
            ? <p className="text-[#555] font-mono text-sm italic">Nothing won yet this week.</p>
            : <div className="flex flex-col">
                {data.recent.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-[#1a1a1a] text-[0.85rem]">
                    <TierChip t={r.tier} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[#ccc] truncate">{r.title}</div>
                      <div className="text-[0.7rem] text-[#666] font-mono truncate">
                        {r.who.join(" & ")}
                        {r.dawnie ? " · one of Lady Dawnie's fakes - survived!" : ""}
                        {r.stolen && r.from ? ` · swiped it while ${r.from} did the killing 👀` : ""}
                      </div>
                    </div>
                    <span className="text-[0.68rem] text-[#444] font-mono whitespace-nowrap">{timeAgo(r.at)}</span>
                  </div>
                ))}
              </div>}
        </section>

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
                      {p.rank && <span className={`text-[0.62rem] ml-2 font-mono ${p.rank === "Disgraced" ? "text-[#e05555]" : "text-[#c8a84b]"}`}>{p.rank}</span>}
                    </span>
                    <span className="font-mono text-[0.75rem] text-[#aaa] whitespace-nowrap">{p.pts} pts</span>
                  </div>
                ))}
                <Link href="/leaderboard" className="text-[0.72rem] text-[#4a7c59] font-mono mt-2">Full Jobs leaderboard →</Link>
              </div>}
        </section>
      </div>

      <div className="divider" />

      <section className="flex flex-col gap-8">
        <h2 className="text-[0.8rem] tracking-[0.15em] uppercase text-[#aaa]">How it works</h2>

        <div className="grid gap-3 sm:grid-cols-2 text-[0.85rem] text-[#aaa]">
          {[
            ["1. Take a quest", "Open Jobs on your phone (or take it here). Anyone else can take the same quest - you're racing them, and both of you get a \"hurry up\" when it happens."],
            ["2. Get the code", "It's in a bag: in the middle of a horde, dropped when a marked horde is mostly down, carried by a bandit crew. Or bring / deliver what she asks for."],
            ["3. First one wins", "Type the note's code into Jobs (or hand in first). The winner's side splits the pay evenly; everyone else racing it gets nothing and loses a little rank."],
            ["4. Rest", "One quest at a time, and a rest after each one (longer for bigger tiers, longer still if you gave up or died)."],
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
              <thead><tr><th>Tier</th><th className="text-right">Solo pay</th><th className="text-right">Horde</th><th className="text-right hidden sm:table-cell">On the board</th><th className="text-right hidden sm:table-cell">Rest after</th><th className="text-right">Rank pts</th></tr></thead>
              <tbody>
                {(data?.tiers || []).map((t) => (
                  <tr key={t.id} className="lb-row">
                    <td><TierChip t={t.id} /></td>
                    <td className="text-right font-mono">{money(t.pot)}</td>
                    <td className="text-right font-mono">{t.horde}{t.id === "S" ? "+" : ""}</td>
                    <td className="text-right font-mono hidden sm:table-cell">{t.life}h</td>
                    <td className="text-right font-mono hidden sm:table-cell">{t.rest}m</td>
                    <td className="text-right font-mono">{t.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[0.72rem] text-[#555] font-mono mt-2">
            A crew splits the pot evenly. S pays {(data?.sSplit || [10000, 5000, 3000, 2500]).map((b, i) => `${money(b)} each for ${i + 1}`).join(", ")} -
            and a rare big S (two hordes of 200) pays 2-3 gold. Only crew who stayed close and fought get a share.
          </p>
        </div>

        <div>
          <h3 className="text-[0.7rem] tracking-[0.12em] uppercase text-[#555] mb-3">Job Rank</h3>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-5">
            {(data?.ranks || []).map((r) => (
              <div key={r.name} className="border p-3 text-center" style={{ borderColor: r.name === "Disgraced" ? "#e0555555" : "#1e2530" }}>
                <div className={r.name === "Disgraced" ? "text-[#e05555]" : "text-[#c8a84b]"}>{r.name}</div>
                <div className="text-[0.7rem] text-[#666] font-mono">{r.min < 0 ? "below 0 job pts" : `${r.min}+ score`}</div>
                <div className="text-[0.7rem] text-[#888] font-mono mt-1">tiers: {r.tiers}</div>
                <div className="text-[0.66rem] text-[#666] font-mono">give up: {r.quit}</div>
              </div>
            ))}
          </div>
          <p className="text-[0.72rem] text-[#555] font-mono mt-2">
            Hard to earn, easy to lose. Your score comes from kills, your longest life, Dawn of the Dead nights survived and quest points, minus deaths.
            Giving up (or dying) costs veterans rank and a little of Zombita&apos;s trust - Rookies lose nothing. Below zero you&apos;re Disgraced: D and C only.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 text-[0.8rem] text-[#aaa]">
          <div className="border p-4" style={{ borderColor: COLOR.personal + "55" }}>
            <div className="mb-1" style={{ color: COLOR.personal }}>♥ Personal quests</div>
            Get on Zombita&apos;s good side and she sends you a quest just for you - she&apos;ll DM you on Discord. Nobody can race you for it, and it pays more.
          </div>
          <div className="border p-4" style={{ borderColor: COLOR.exclusive + "55" }}>
            <div className="mb-1" style={{ color: COLOR.exclusive }}>◆ Exclusive quests</div>
            Walk into a town and she might have something there, for you (one per group, one per town). Turn it down or play it and it&apos;s a day before the next.
          </div>
          <div className="border p-4" style={{ borderColor: COLOR.small + "44" }}>
            <div className="mb-1" style={{ color: COLOR.small }}>🤝 Crews</div>
            Invite phone friends or faction mates (up to 4 on a side) - an invite skips the rank check. The pot is split evenly between the ones who were there.
          </div>
          <div className="border p-4" style={{ borderColor: "#e0555555" }}>
            <div className="text-[#e05555] mb-1">🎭 Lady Dawnie</div>
            Sometimes a scout quest was faked by Lady Dawnie. Zombita is worried sick - fight your way out or run, and you still get paid. Dying in one costs nothing.
          </div>
        </div>
        <p className="text-[0.72rem] text-[#555] font-mono">
          Zombita keeps score: the newspaper&apos;s Quitters&apos; Corner remembers who bailed, and who swiped a quest from the ones doing the killing.
        </p>
      </section>
    </main>
  );
}
