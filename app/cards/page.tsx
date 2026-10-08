// @ts-nocheck
"use client";
// Zombita's Cards (mod 1.7.146): the eight role cards, who holds them, who works hardest at each lately, what each rank
// gives, and (logged in) your own card and points. The game writes it all (/api/cards); refreshes every 30 s.
// Buying a card happens in game, in the Cards app on the phone.
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";

const JOB_WORD = { order: "Orders", Scout: "Scouting", Delivery: "Deliveries", Treasure: "Treasure", "Fetch the bag": "Fetch the bag",
  "Horde hunt": "Hordes", "Smith it": "Smithing", Glassblowing: "Glassblowing", "Cook it": "Cooking", "Bring me": "Bring me",
  supply: "Outbreak supplies", Contract: "Contracts (from Expert)", "Roadside repair": "Roadside repairs" };

function money(b) {
  b = Math.floor(b || 0);
  if (b >= 10000 && b % 10000 === 0) return `${b / 10000} gold`;
  if (b >= 1000) return `${String(+(b / 1000).toFixed(2))} silver`;
  return `${b} bronze`;
}

function left(until) {
  const s = Math.max(0, Math.floor(until - Date.now() / 1000));
  if (s >= 86400) { const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600); return `${d} day${d === 1 ? "" : "s"}${h ? ` ${h}h` : ""}`; }
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.max(1, Math.floor(s / 60))}m`;
}

function hex(c) {
  if (!Array.isArray(c)) return "#c8a84b";
  return "#" + c.slice(0, 3).map((v) => Math.round(Math.max(0, Math.min(1, +v)) * 255).toString(16).padStart(2, "0")).join("");
}

function rankOf(ranks, pts) {
  let r = ranks[0], next = null;
  for (let i = 0; i < ranks.length; i++) {
    if (pts >= ranks[i].min) { r = ranks[i]; next = ranks[i + 1] || null; }
  }
  return { rank: r, next };
}

function CardFace({ card, size = "w-[120px]" }) {
  const [broken, setBroken] = useState(false);
  const col = hex(card.color);
  if (broken) {
    return (
      <div className={`${size} aspect-[2/3] flex items-center justify-center font-mono text-[0.7rem] uppercase tracking-widest`}
           style={{ background: col + "22", border: `2px solid ${col}`, color: col, borderRadius: 8 }}>{card.name}</div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/cards/${card.id}.png`} alt={card.name} className={`${size} aspect-[2/3] object-cover`} style={{ borderRadius: 8, opacity: card.on ? 1 : 0.55 }}
              onError={() => setBroken(true)} />;
}

function Bar({ pct, col }) {
  return (
    <div className="h-[5px] bg-[#1a1f27] w-full">
      <div className="h-full" style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: col }} />
    </div>
  );
}

function MyCards({ me, st }) {
  if (!me?.logged) {
    return (
      <div className="border border-[#1e2530] bg-[#0d1117] p-4 font-mono text-[0.75rem] text-[#888]">
        <a href={`${API}/auth/discord/login`} className="text-[#c8a84b]">Log in with Discord</a> to see your own card, your points and your rank on each card.
      </div>
    );
  }
  if (!me.linked) {
    return <div className="border border-[#1e2530] bg-[#0d1117] p-4 font-mono text-[0.75rem] text-[#888]">Your Discord isn't linked to a game name yet. Get whitelisted first.</div>;
  }
  const mine = me.me || { pts: {} };
  const held = mine.card ? st.cards.find((c) => c.id === mine.card) : null;
  return (
    <div className="border border-[#1e2530] bg-[#0d1117] p-4">
      <div className="font-mono text-[0.62rem] uppercase tracking-widest text-[#555] mb-3">You, {me.name}</div>
      {held ? (
        <div className="flex gap-4 items-center mb-4">
          <CardFace card={held} size="w-[70px]" />
          <div>
            <div className="text-[1.05rem] font-semibold" style={{ color: hex(held.color) }}>The {held.name} card is yours</div>
            <div className="font-mono text-[0.72rem] text-[#888]">
              {mine.how === "earned" ? "Earned" : mine.how === "admin" ? "Given by an admin" : "Bought"} · {left(mine.until)} left
            </div>
            <div className="font-mono text-[0.68rem] text-[#666] mt-1">Card jobs come to the Jobs app on your phone.</div>
          </div>
        </div>
      ) : (
        <div className="font-mono text-[0.75rem] text-[#888] mb-4">You don't hold a card right now. Buy one in the Cards app on your phone, or keep working and Zombita may offer you one.</div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {st.cards.map((c) => {
          const p = mine.pts?.[c.id] || [0, 0];
          const { rank, next } = rankOf(st.ranks, p[0]);
          const pct = next ? ((p[0] - rank.min) / (next.min - rank.min)) * 100 : 100;
          return (
            <div key={c.id} className="border border-[#161b22] p-2">
              <div className="flex justify-between font-mono text-[0.68rem]">
                <span style={{ color: hex(c.color) }}>{c.name}</span>
                <span className="text-[#888]">{rank.name}</span>
              </div>
              <Bar pct={pct} col={hex(c.color)} />
              <div className="font-mono text-[0.6rem] text-[#555] mt-1">
                {p[0]} pts{next ? ` · ${next.name} at ${next.min}` : " · top rank"} · lately {p[1]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CardBlock({ c, st }) {
  const col = hex(c.color);
  const ranks = st.ranks.map((r) => r.name);
  const perks = [...(c.perks || [])].sort((a, b) => ranks.indexOf(a.rank) - ranks.indexOf(b.rank));
  return (
    <article className="border border-[#1e2530] bg-[#0d1117] p-4 flex gap-4" style={{ borderLeft: `3px solid ${col}` }}>
      <div className="shrink-0 hidden sm:block"><CardFace card={c} /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-[1.15rem] font-semibold m-0" style={{ color: col }}>{c.name}</h2>
          {!c.on && <span className="font-mono text-[0.58rem] uppercase tracking-widest px-1.5 py-0.5 border border-[#444] text-[#777]">not out yet</span>}
          <span className="font-mono text-[0.62rem] text-[#666] ml-auto">
            bought {c.bought}/{st.boughtSlots} · earned {c.earned}/{st.earnedSlots}
          </span>
        </div>
        <p className="text-[0.85rem] text-[#aab1bc] m-0 mt-1">{c.blurb}</p>
        {c.needs && (
          <div className="font-mono text-[0.66rem] text-[#c8a84b] mt-2"><span className="text-[#555]">NEEDS </span>{c.needs}</div>
        )}
        <div className="font-mono text-[0.66rem] text-[#777] mt-2"><span className="text-[#555]">POINTS FROM </span>{c.from}</div>
        {(c.jobs || []).length > 0 && (
          <div className="font-mono text-[0.66rem] text-[#777] mt-1"><span className="text-[#555]">CARD JOBS </span>{c.jobs.map((j) => JOB_WORD[j] || j).join(", ")}</div>
        )}
        <div className="mt-3 flex flex-col gap-y-1">
          {perks.map((p, i) => (
            <div key={i} className="font-mono text-[0.68rem] flex gap-2">
              <span className="text-[#555] w-[78px] shrink-0">{p.rank}</span>
              <span className={p.live ? "text-[#c8cdd6]" : "text-[#555]"}>{p.text}{p.live ? "" : " (coming)"}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-6 flex-wrap font-mono text-[0.66rem]">
          <div>
            <div className="text-[#555] uppercase tracking-widest text-[0.58rem] mb-1">Held by</div>
            {(c.holders || []).length === 0 ? <div className="text-[#444]">nobody yet</div> :
              c.holders.map((h) => (
                <div key={h.name} className="text-[#c8cdd6]">{h.name} <span className="text-[#555]">{h.how === "earned" ? "earned" : h.how === "admin" ? "given" : "bought"} · {left(h.until)} left</span></div>
              ))}
          </div>
          <div>
            <div className="text-[#555] uppercase tracking-widest text-[0.58rem] mb-1">Working hardest lately</div>
            {(c.top || []).filter((t) => t.recent > 0).length === 0 ? <div className="text-[#444]">nobody yet</div> :
              c.top.filter((t) => t.recent > 0).slice(0, 5).map((t, i) => (
                <div key={t.name} className="text-[#c8cdd6]">{i + 1}. {t.name} <span className="text-[#555]">{t.recent} pts · {t.rank}</span></div>
              ))}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function CardsPage() {
  const [st, setSt] = useState(null);
  const [me, setMe] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API}/api/cards`);
        if (!r.ok) throw new Error(String(r.status));
        setSt(await r.json());
        setFailed(false);
      } catch {
        setFailed(true);
      }
    };
    const loadMe = async () => {
      try {
        const r = await fetch(`${API}/api/cards/me`, { credentials: "include" });
        setMe(r.ok ? await r.json() : { logged: false });
      } catch {
        setMe({ logged: false });
      }
    };
    load(); loadMe();
    const iv = setInterval(() => { load(); loadMe(); }, 30000);
    return () => clearInterval(iv);
  }, []);

  const ready = st && st.ready && Array.isArray(st.cards);
  return (
    <main className="max-w-[1100px] mx-auto px-4 py-8">
      <div className="font-mono text-[0.62rem] uppercase tracking-[0.25em] text-[#555]">Roles on the server</div>
      <h1 className="text-[2rem] font-semibold text-[#e6e8ec] m-0 mt-1">Zombita's Cards</h1>
      <p className="text-[0.92rem] text-[#aab1bc] max-w-[760px] mt-2">
        Zombita notices what you do. A card is a role on the server: the Medic, the Mechanic everyone goes to, the Guardian who
        holds the line. Holding one brings card jobs (better pay, in their own slot next to your normal job) and perks that grow
        with your rank.
      </p>

      {!st && !failed && <div className="font-mono text-[0.75rem] text-[#666] mt-6">Asking Zombita...</div>}
      {failed && <div className="font-mono text-[0.75rem] text-[#a55] mt-6">Couldn't reach the server. Try again in a minute.</div>}
      {st && !ready && <div className="font-mono text-[0.75rem] text-[#888] mt-6">Zombita's Cards aren't out yet. Check back soon.</div>}

      {ready && (
        <>
          {!st.on && (
            <div className="border border-[#3a3320] bg-[#15130d] p-3 mt-5 font-mono text-[0.72rem] text-[#c8a84b]">
              Zombita's Cards open soon. Your card points already count.
            </div>
          )}
          {st.stale && <div className="font-mono text-[0.68rem] text-[#a55] mt-3">The game last reported {timeAgo(st.at)}. The server may be restarting.</div>}

          <section className="mt-6 grid md:grid-cols-3 gap-3 font-mono text-[0.72rem]">
            <div className="border border-[#1e2530] bg-[#0d1117] p-3">
              <div className="text-[#555] uppercase tracking-widest text-[0.58rem] mb-1">Buy one</div>
              <div className="text-[#c8cdd6]">{money(st.price)} for {st.days} days, in the Cards app on your phone. {st.boughtSlots} of each card can be bought at a time.
                You can't buy the same card two rounds in a row.</div>
            </div>
            <div className="border border-[#1e2530] bg-[#0d1117] p-3">
              <div className="text-[#555] uppercase tracking-widest text-[0.58rem] mb-1">Or earn it</div>
              <div className="text-[#c8cdd6]">{st.earnedSlots} of each card goes to whoever did the most of that work in the last {st.recentDays || 5} days
                ({st.earnMin}+ points). Free, and it renews while you keep at it.</div>
            </div>
            <div className="border border-[#1e2530] bg-[#0d1117] p-3">
              <div className="text-[#555] uppercase tracking-widest text-[0.58rem] mb-1">One at a time</div>
              <div className="text-[#c8cdd6]">Taking another card drops yours. Card jobs pay {Math.round((st.payMult - 1) * 100)}% more, {st.offersPerDay} a day.
                Ranks: {st.ranks.map((r) => `${r.name} ${r.min}`).join(", ")} points. Your rank stays when a card ends.</div>
            </div>
          </section>

          <section className="mt-6"><MyCards me={me} st={st} /></section>

          <section className="mt-6 flex flex-col gap-3">
            {st.cards.map((c) => <CardBlock key={c.id} c={c} st={st} />)}
          </section>
          <div className="font-mono text-[0.6rem] text-[#444] mt-4">Updated {timeAgo(st.at)} from the game.</div>
        </>
      )}
    </main>
  );
}
