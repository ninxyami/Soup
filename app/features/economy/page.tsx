"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";

// The economy page (rewritten 2026-09-23 to match the bot's rules after the treasury work):
// how money works on S.O.U.P, and the live numbers from GET /api/economy/live (totals only - never a
// player's wallet or a name). Every rule below is the one the bot runs today.

type Live = {
  season: string;
  money: { treasury: number; keepers: number; wallets: number; cash: number; total: number; limit: number; cap: number };
  health: string;
  health_pct: number;
  supply_pct: number;
  burn_mode: boolean;
  players: number;
  seed: { min: number; neutral: number; max: number };
  bands: Record<string, number>;
  rules: { lean_months: number; rich_months: number; patience: number; mood: string; reward_budget: number; enabled: boolean };
  flow: { days: number; in: [string, number][]; out: [string, number][]; in_total: number; out_total: number; net: number };
  updated_at: number;
};

const HEALTH_COLOR: Record<string, string> = {
  BOOMING: "#4caf7d", HEALTHY: "#4a8fc4", TIGHT: "#c8a84b", LOW: "#c47a4a", CRITICAL: "#e05555",
};

// The sell tax a keeper keeps, by treasury health (zombita_shop_watcher SELL_TAX_BY_STATE).
const HEALTH_ROWS = [
  { state: "BOOMING", at: "95%+ of the cap", tax: "10%", note: "Keepers flush, rewards paid in full" },
  { state: "HEALTHY", at: "60% - 95%", tax: "15%", note: "Normal days" },
  { state: "TIGHT", at: "35% - 60%", tax: "25%", note: "Keepers start counting coins" },
  { state: "LOW", at: "15% - 35%", tax: "40%", note: "Tills run short, rewards shrink" },
  { state: "CRITICAL", at: "under 15%", tax: "50%", note: "Rewards paused; a lean month is being noted" },
];

const COINS = [
  { name: "SOUP Coin", value: "1 silver", where: "About 1 zombie in 100. New players get extra luck in their first two hours.", color: "#9ec27a" },
  { name: "Zombita Coin", value: "1 gold", where: "About 1 zombie in 1,000 - as rare as her own phone.", color: "#7ec04a" },
  { name: "Dawnie's Coin", value: "10 gold", where: "1 zombie in 10,000. A keeper buys it - or the treasury, when the till is short. Dawnie says don't sell.", color: "#e0a090" },
];

const GENERAL = ["Cal", "Dex", "Eli", "Lena", "Nadia", "Roxy"];
const SPECIALISTS = [
  { name: "Maya", what: "gardener - seeds, farming, food" },
  { name: "Viktor", what: "weapons - guns, magazines, ammo" },
  { name: "Sera", what: "mechanic - car parts, tools, fuel" },
  { name: "Dr. Voss", what: "medical - first aid, pills, the vaccine" },
  { name: "Bruno", what: "melee and tools" },
  { name: "Colette", what: "tailor - clothes and bags" },
  { name: "Miles", what: "librarian - skill books and magazines" },
  { name: "Scarlett", what: "music - only the community tapes players share in #song-submissions" },
];

/** 288900 -> "28.9 gold"; 4500 -> "4.5 silver"; 250 -> "250 bronze". */
function money(b: number): string {
  if (b >= 10000) return `${(b / 10000).toFixed(b >= 100000 ? 0 : 1)} gold`;
  if (b >= 1000) return `${(b / 1000).toFixed(1)} silver`;
  return `${b} bronze`;
}

function ago(ts: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} h ago`;
}

function Section({ title, color = "#c8a84b", children }: { title: string; color?: string; children: React.ReactNode }) {
  return (
    <section className="mb-16">
      <h2 className="!normal-case text-[0.9rem] tracking-[0.2em] mb-4" style={{ color }}>{title}</h2>
      {children}
    </section>
  );
}

function Card({ title, color = "#e6e6e6", children }: { title: string; color?: string; children: React.ReactNode }) {
  return (
    <div className="border border-[#1a1a1a] bg-[#0a0d10] p-4">
      <p className="font-mono text-[0.65rem] tracking-widest uppercase mb-2" style={{ color }}>{title}</p>
      <div className="text-[0.78rem] text-[#777] leading-relaxed">{children}</div>
    </div>
  );
}

function LiveEconomy() {
  const [live, setLive] = useState<Live | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`${API}/api/economy/live`, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (alive) { setLive(j); setFailed(false); }
      } catch {
        if (alive) setFailed(true);
      }
    };
    load();
    const iv = setInterval(load, 60000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  if (!live) {
    return (
      <div className="border border-[#1a1a1a] bg-[#0a0d10] p-5 font-mono text-[0.7rem] text-[#555]">
        {failed ? "The live numbers can't be reached right now - the rules below still hold." : "Counting the town's money..."}
      </div>
    );
  }

  const m = live.money;
  const parts = [
    { name: "Treasury", value: m.treasury, color: "#c8a84b", note: "the town's fund" },
    { name: "Keeper tills", value: m.keepers, color: "#4a8fc4", note: "what shops can pay you" },
    { name: "Players' wallets", value: m.wallets, color: "#4caf7d", note: `${live.players} active players` },
  ];
  const total = Math.max(1, m.total);
  const hc = HEALTH_COLOR[live.health] || "#888";
  const flowMax = Math.max(1, ...live.flow.in.map(x => x[1]), ...live.flow.out.map(x => x[1]));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {parts.map(p => (
          <div key={p.name} className="border border-[#1a1a1a] bg-[#0a0d10] p-3">
            <p className="font-mono text-[0.58rem] tracking-widest uppercase mb-1" style={{ color: p.color }}>{p.name}</p>
            <p className="font-mono text-[1rem] text-[#e6e6e6]">{money(p.value)}</p>
            <p className="font-mono text-[0.55rem] text-[#444]">{p.note}</p>
          </div>
        ))}
        <div className="border border-[#1a1a1a] bg-[#0a0d10] p-3">
          <p className="font-mono text-[0.58rem] tracking-widest uppercase mb-1 text-[#e6e6e6]">All money</p>
          <p className="font-mono text-[1rem] text-[#e6e6e6]">{money(m.total)}</p>
          <p className="font-mono text-[0.55rem] text-[#444]">limit {money(m.limit)}</p>
        </div>
      </div>

      {/* where the money sits */}
      <div className="border border-[#1a1a1a] bg-[#0a0d10] p-4">
        <div className="flex h-3 w-full overflow-hidden bg-[#111]">
          {parts.map(p => (
            <div key={p.name} style={{ width: `${(100 * p.value) / total}%`, background: p.color }} title={`${p.name}: ${money(p.value)}`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 font-mono text-[0.6rem] text-[#666]">
          <span>Treasury health: <span style={{ color: hc }}>{live.health}</span> ({live.health_pct}% of its cap)</span>
          <span>Money supply: {live.supply_pct}% of the limit</span>
          <span>Zombita&apos;s mood: <span className="text-[#c8a84b]">{live.rules.mood}</span></span>
        </div>
        {live.burn_mode && (
          <p className="mt-2 text-[0.72rem] text-[#c47a4a]">
            There&apos;s more money around than the town can hold right now, so Zombita&apos;s cut of every sale is
            being destroyed instead of saved - until the supply drops back under the limit.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="border border-[#1a1a1a] bg-[#0a0d10] p-4">
          <p className="font-mono text-[0.62rem] tracking-widest uppercase mb-3 text-[#4caf7d]">Into the treasury - last {live.flow.days} days</p>
          {live.flow.in.length === 0 && <p className="text-[0.72rem] text-[#444]">Nothing this week.</p>}
          {live.flow.in.map(([src, n]) => (
            <div key={src} className="mb-1.5">
              <div className="flex justify-between font-mono text-[0.62rem] text-[#777]"><span>{src}</span><span>{money(n)}</span></div>
              <div className="h-1 bg-[#111]"><div className="h-1 bg-[#4caf7d]" style={{ width: `${(100 * n) / flowMax}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="border border-[#1a1a1a] bg-[#0a0d10] p-4">
          <p className="font-mono text-[0.62rem] tracking-widest uppercase mb-3 text-[#e05555]">Out of the treasury - last {live.flow.days} days</p>
          {live.flow.out.length === 0 && <p className="text-[0.72rem] text-[#444]">Nothing this week.</p>}
          {live.flow.out.map(([src, n]) => (
            <div key={src} className="mb-1.5">
              <div className="flex justify-between font-mono text-[0.62rem] text-[#777]"><span>{src}</span><span>{money(n)}</span></div>
              <div className="h-1 bg-[#111]"><div className="h-1 bg-[#e05555]" style={{ width: `${(100 * n) / flowMax}%` }} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card title="Lean months" color="#c47a4a">
          <span className="font-mono text-[#e6e6e6]">{live.rules.lean_months} of {live.rules.patience}</span> in a row. At {live.rules.patience},
          Zombita tops the treasury up.
        </Card>
        <Card title="Reward budget" color="#9775cc">
          <span className="font-mono text-[#e6e6e6]">{money(live.rules.reward_budget)}</span> the treasury can spend on prizes after the
          keepers&apos; next restock.
        </Card>
        <Card title="This season's seed" color="#4a8fc4">
          Each player who joins adds <span className="font-mono text-[#e6e6e6]">{money(live.seed.min)} - {money(live.seed.max)}</span> to the town,
          depending on how Zombita feels about them.
        </Card>
      </div>
      <p className="font-mono text-[0.55rem] text-[#333]">{live.season} - updated {ago(live.updated_at)} - totals only, never anyone&apos;s wallet</p>
    </div>
  );
}

export default function EconomyPage() {
  return (
    <main>
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-12 sm:py-16">

        <div className="mb-12">
          <Link href="/features" className="font-mono text-[0.65rem] tracking-widest text-[#444] hover:text-[#c8a84b] no-underline transition-colors uppercase">
            ← Features
          </Link>
          <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#c8a84b] uppercase mb-3 mt-4">Economy System</p>
          <h1 className="text-[1.8rem] sm:text-[2.5rem] tracking-[0.2em] mb-4">THE ECONOMY</h1>
          <p className="text-[#666] text-[0.88rem] max-w-[620px] leading-relaxed">
            Money on S.O.U.P is limited. It isn&apos;t printed when you sell a carrot - it moves between the
            treasury, the shopkeepers&apos; tills and your wallet, and Zombita keeps the books. That&apos;s why a
            gold is worth a gold here, all season long.
          </p>
        </div>

        <Section title="Right now">
          <LiveEconomy />
        </Section>

        <div className="h-px bg-[#1a1a1a] mb-16" />

        <Section title="Currency">
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { name: "Bronze", value: "1", note: "the base unit" },
              { name: "Silver", value: "1,000", note: "everyday prices" },
              { name: "Gold", value: "10,000", note: "big buys, big bets" },
            ].map(c => (
              <div key={c.name} className="border border-[#1a1a1a] bg-[#0a0d10] p-4 text-center">
                <div className="font-mono text-[0.72rem] tracking-wider text-[#e6e6e6] mb-1">{c.name}</div>
                <div className="font-mono text-[0.6rem] text-[#c8a84b] mb-1">= {c.value} bronze</div>
                <div className="font-mono text-[0.55rem] text-[#444]">{c.note}</div>
              </div>
            ))}
          </div>
          <p className="text-[0.78rem] text-[#555] mb-3">Coins turn up on zombies and in tills and lockers - never in a shop. Any keeper buys them at face value, if the till can cover it.</p>
          <div className="space-y-2">
            {COINS.map(c => (
              <div key={c.name} className="border border-[#1a1a1a] bg-[#0a0d10] p-3 flex items-center gap-4">
                <span className="font-mono text-[0.68rem] tracking-wider min-w-[120px]" style={{ color: c.color }}>{c.name}</span>
                <span className="font-mono text-[0.62rem] text-[#e6e6e6] min-w-[70px]">{c.value}</span>
                <span className="text-[0.74rem] text-[#555] flex-1">{c.where}</span>
              </div>
            ))}
          </div>
        </Section>

        <div className="h-px bg-[#1a1a1a] mb-16" />

        <Section title="Where money comes from, and where it goes">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card title="New money - only two ways" color="#4caf7d">
              <p className="mb-2">1. <b className="text-[#aaa]">The season seed.</b> Every player who joins a season adds their seed to the town
                (5 silver to 4 gold, depending on how Zombita feels about them). That sets how much money the whole town can hold.</p>
              <p>2. <b className="text-[#aaa]">A lean-month injection.</b> If the treasury can&apos;t pay what it owes for three in-game months in a row,
                Zombita tops it up - how much depends on her mood. One good month resets the count.</p>
            </Card>
            <Card title="Money that leaves for good" color="#e05555">
              <p className="mb-2">When the treasury sits above its cap for three month-ends in a row, Zombita burns part of the excess.</p>
              <p>While there&apos;s more money around than the town can hold, her cut of every sale is destroyed instead of saved.</p>
            </Card>
            <Card title="Shopkeepers" color="#4a8fc4">
              Every keeper has a till. When you sell, the keeper pays you out of it - no till, no sale. Tills are refilled from the
              treasury every three days and anything above a keeper&apos;s float is swept back. When the treasury is short, every keeper
              is short by the same share.
            </Card>
            <Card title="Buying" color="#c8a84b">
              Every item has one price, the same in every shop that sells it. When you buy, the keeper keeps most of it and
              Zombita&apos;s cut goes to the treasury.
            </Card>
            <Card title="Selling" color="#c8a84b">
              The keeper keeps a sell tax that follows the treasury&apos;s health - 10% when the town is booming, up to 50% when it&apos;s critical.
            </Card>
            <Card title="Dying costs something" color="#c47a4a">
              The funeral fee: 5% of what you earned in the last 7 days plus 1% of what you hold (10 bronze to 1 silver), to the treasury.
              New players pay 10 bronze for their first three days, and a second death within the hour is free. What you can&apos;t pay
              becomes a tab your next income clears.
            </Card>
            <Card title="Rewards" color="#9775cc">
              Weekly leaderboard prizes and game wins (Werewolf, Quizarium...) are paid from the treasury, but only from what it holds
              after the keepers&apos; next restock. When it&apos;s short, everyone gets the same share - and Zombita says why.
            </Card>
            <Card title="Games" color="#9775cc">
              Rock Paper Scissors and Connect 4 bets: the winner takes the pot, the house keeps 5% for the treasury. Nothing is made out of thin air.
            </Card>
          </div>
        </Section>

        <div className="h-px bg-[#1a1a1a] mb-16" />

        <Section title="Treasury health">
          <p className="text-[#666] text-[0.82rem] leading-relaxed mb-4">
            The treasury&apos;s health is how full it is against its cap - and the cap grows with the number of players.
          </p>
          <div className="space-y-2">
            {HEALTH_ROWS.map(h => (
              <div key={h.state} className="border border-[#1a1a1a] bg-[#0a0d10] p-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-mono text-[0.65rem] tracking-widest uppercase min-w-[80px]" style={{ color: HEALTH_COLOR[h.state] }}>{h.state}</span>
                <span className="font-mono text-[0.6rem] text-[#444] min-w-[120px]">{h.at}</span>
                <span className="font-mono text-[0.6rem] text-[#c8a84b] min-w-[80px]">sell tax {h.tax}</span>
                <span className="text-[0.74rem] text-[#555] flex-1">{h.note}</span>
              </div>
            ))}
          </div>
        </Section>

        <div className="h-px bg-[#1a1a1a] mb-16" />

        <Section title="The shops">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card title="General stores" color="#c8a84b">
              {GENERAL.join(", ")} - six general stores, each showing a different slice of the rotating stock, so it pays to walk
              to the next one. Bus tickets, phones and a few staples are always on the shelf.
            </Card>
            <Card title="Specialists" color="#4a8fc4">
              <ul className="space-y-0.5">
                {SPECIALISTS.map(s => <li key={s.name}><span className="text-[#aaa]">{s.name}</span> - {s.what}</li>)}
              </ul>
            </Card>
          </div>
          <div className="flex gap-4 mt-4 font-mono text-[0.62rem]">
            <Link href="/shop" className="text-[#c8a84b] no-underline hover:text-[#e6e6e6]">What&apos;s on the shelves →</Link>
            <Link href="/marketplace" className="text-[#c8a84b] no-underline hover:text-[#e6e6e6]">Player marketplace →</Link>
          </div>
        </Section>

        <div className="h-px bg-[#1a1a1a] mb-16" />

        <Section title="Also">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card title="Lottery" color="#9775cc">
              100 numbered tickets a batch, 3 silver each - pick your number on the Lottery tab at any shop. 15 of them win:
              gold, a pink slip, a vaccine, a pistol kit, ammo, a vehicle orb or pocket money. Cash prizes come out of the treasury.
            </Card>
            <Card title="Marketplace" color="#4a8fc4">
              Sell to other players from any kiosk. A small listing fee and a daily fee while unsold; buyers pay a tax and a delivery
              fee by distance.
            </Card>
            <Card title="Zombita Bus" color="#4caf7d">
              Bus tickets from the general stores (and the odd zombie). Longer rides cost more tickets.
            </Card>
          </div>
        </Section>

        <div className="h-px bg-[#1a1a1a] mb-8" />
        <div className="text-center">
          <Link href="/features" className="font-mono text-[0.7rem] tracking-widest text-[#444] hover:text-[#e6e6e6] no-underline transition-colors uppercase">
            ← Back to All Features
          </Link>
        </div>
      </div>
    </main>
  );
}
