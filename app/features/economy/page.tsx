"use client";
import Link from "next/link";

const TREASURY_STATES = [
  { state: "BOOMING", range: "> 80,000", color: "#4caf7d", effect: "Lowest prices, lowest taxes, full rewards" },
  { state: "HEALTHY", range: "40,000 – 80,000", color: "#4a8fc4", effect: "Normal prices and taxes" },
  { state: "TIGHT", range: "15,000 – 40,000", color: "#c8a84b", effect: "Slightly elevated prices" },
  { state: "LOW", range: "5,000 – 15,000", color: "#c47a4a", effect: "Higher prices and taxes" },
  { state: "CRITICAL", range: "< 5,000", color: "#e05555", effect: "Max prices, max taxes, auto-recession, rewards paused" },
];

const SHOPS = [
  { name: "Cal's Food Corner", icon: "🍖", desc: "Food, drinks, farming supplies. Staple items for early survival." },
  { name: "Dex's Armory", icon: "🔫", desc: "Weapons, ammo, tactical gear. High demand keeps prices volatile." },
  { name: "Lena's Auto Parts", icon: "🔧", desc: "Car parts, repair tools, fuel. Essential for late-game mobility." },
  { name: "Viktor's Gas Station", icon: "⛽", desc: "Fuel and quick supplies. Located near main travel routes." },
  { name: "Nadia's Hub", icon: "🏘️", desc: "Community goods, miscellaneous items, social economy items." },
];

const MONEY_FLOWS = [
  { dir: "IN", items: ["60% of NPC shop purchases recycled", "100% marketplace listing taxes", "100% marketplace purchase taxes", "100% PvP death taxes", "Weekly 30,000 bronze injection", "5% rake from RPS and Connect Four bets", "Manual admin adjustments"] },
  { dir: "OUT", items: ["Weekly leaderboard rewards: 1st (500), 2nd (250), 3rd (100)", "Weekly game rewards: Werewolf/Quizarium (300), CAH (200)", "Reputation gift items delivered via RCON", "Player crop and jewelry sell-backs", "Admin manual payouts"] },
];

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
          <p className="text-[#666] text-[0.88rem] max-w-[580px] leading-relaxed">
            Not a coin system — a full economic simulation with dynamic pricing, a server-wide 
            treasury, market cycles, recession events, player debt, taxes, and multiple money 
            flows all running in real time without admin intervention.
          </p>
        </div>

        {/* Currency */}
        <section className="mb-16">
          <h2 className="!normal-case text-[0.9rem] tracking-[0.2em] text-[#c8a84b] mb-6">Currency</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { icon: "🟤", name: "Bronze", value: "1", note: "Base unit, all storage" },
              { icon: "⚪", name: "Silver", value: "1,000", note: "Mid-tier, common transactions" },
              { icon: "🟡", name: "Gold", value: "10,000", note: "High-value items and bets" },
            ].map(c => (
              <div key={c.name} className="border border-[#1a1a1a] bg-[#0a0d10] p-4 text-center">
                <div className="text-2xl mb-2">{c.icon}</div>
                <div className="font-mono text-[0.7rem] tracking-wider text-[#e6e6e6] mb-1">{c.name}</div>
                <div className="font-mono text-[0.58rem] text-[#c8a84b] mb-1">= {c.value} bronze</div>
                <div className="font-mono text-[0.55rem] text-[#444]">{c.note}</div>
              </div>
            ))}
          </div>
          <p className="text-[0.78rem] text-[#555] font-mono">Display always shows the highest applicable denominations. Example: 12,500 bronze displays as &quot;1 🟡 2 ⚪ 500 🟤&quot;</p>
        </section>

        <div className="h-px bg-[#1a1a1a] mb-16" />

        {/* Treasury */}
        <section className="mb-16">
          <h2 className="!normal-case text-[0.9rem] tracking-[0.2em] text-[#c8a84b] mb-2">The Treasury</h2>
          <p className="text-[#666] text-[0.85rem] leading-relaxed mb-6">
            The treasury is the single most important economic concept. It is the server-wide shared fund 
            that acts as the source of all outgoing rewards and the destination of all incoming taxes. 
            It is what makes the economy a closed loop rather than infinite money printing.
          </p>
          <div className="space-y-2 mb-6">
            {TREASURY_STATES.map(ts => (
              <div key={ts.state} className="border border-[#1a1a1a] bg-[#0a0d10] p-3 flex items-center gap-4">
                <span className="font-mono text-[0.65rem] tracking-widest uppercase min-w-[80px]" style={{ color: ts.color }}>{ts.state}</span>
                <span className="font-mono text-[0.62rem] text-[#444] min-w-[120px]">{ts.range} bronze</span>
                <span className="text-[0.75rem] text-[#555] flex-1">{ts.effect}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {MONEY_FLOWS.map(flow => (
              <div key={flow.dir} className="border border-[#1a1a1a] bg-[#0a0d10] p-4">
                <p className={`font-mono text-[0.65rem] tracking-widest uppercase mb-3 ${flow.dir === "IN" ? "text-[#4caf7d]" : "text-[#e05555]"}`}>
                  Money {flow.dir === "IN" ? "→ Treasury" : "← Treasury"}
                </p>
                <ul className="space-y-1.5">
                  {flow.items.map(item => (
                    <li key={item} className="text-[0.75rem] text-[#555] flex items-start gap-2" style={{ paddingLeft: 0 }}>
                      <span className={`text-[0.6rem] flex-shrink-0 mt-1 ${flow.dir === "IN" ? "text-[#4caf7d]" : "text-[#e05555]"}`}>
                        {flow.dir === "IN" ? "+" : "−"}
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <div className="h-px bg-[#1a1a1a] mb-16" />

        {/* Dynamic Pricing */}
        <section className="mb-16">
          <h2 className="!normal-case text-[0.9rem] tracking-[0.2em] text-[#c8a84b] mb-2">Dynamic Pricing</h2>
          <p className="text-[#666] text-[0.85rem] leading-relaxed mb-6">
            Every item in every NPC shop has a dynamic price calculated in real time. 
            Base prices are fixed, but the final price is the result of multiplying four factors together.
          </p>
          <div className="border border-[#1a1a1a] bg-[#070a0d] p-4 mb-6 font-mono text-[0.78rem] text-center">
            <span className="text-[#e6e6e6]">Final Price</span>
            <span className="text-[#444]"> = </span>
            <span className="text-[#c8a84b]">Base Price</span>
            <span className="text-[#444]"> × </span>
            <span className="text-[#4a8fc4]">Treasury Factor</span>
            <span className="text-[#444]"> × </span>
            <span className="text-[#9775cc]">Demand Factor</span>
            <span className="text-[#444]"> × </span>
            <span className="text-[#4caf7d]">Wealth Factor</span>
            <span className="text-[#444]"> × </span>
            <span className="text-[#e05555]">Recession Factor</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {[
              { name: "Treasury Factor", color: "#4a8fc4", desc: "Derived from treasury state. Full treasury = easier prices. Empty treasury = spikes." },
              { name: "Demand Factor", color: "#9775cc", desc: "Based on units of this specific item purchased in the last 48 hours across all players." },
              { name: "Wealth Factor", color: "#4caf7d", desc: "Based on average bronze balance across all player wallets. Richer server = higher prices." },
              { name: "Recession Factor", color: "#e05555", desc: "Applied only during recessions. Multiplies combined price by 1.40× to 2.20×. Normally 1.00×." },
            ].map(f => (
              <div key={f.name} className="border border-[#1a1a1a] bg-[#0a0d10] p-3">
                <p className="font-mono text-[0.65rem] tracking-wider uppercase mb-1.5" style={{ color: f.color }}>{f.name}</p>
                <p className="text-[0.75rem] text-[#555]">{f.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-[0.75rem] text-[#444] font-mono">Price clamping: final price is always between 50% and 300% of base price. Pricing pass runs every 48–72 hours.</p>
        </section>

        <div className="h-px bg-[#1a1a1a] mb-16" />

        {/* Recession */}
        <section className="mb-16">
          <h2 className="!normal-case text-[0.9rem] tracking-[0.2em] text-[#e05555] mb-2">Recession System</h2>
          <p className="text-[#666] text-[0.85rem] leading-relaxed mb-4">
            A recession spikes all prices by 1.40×–2.20× for 12–48 hours. Two triggers:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="border border-[#e0555522] bg-[#0a0d10] p-4">
              <p className="font-mono text-[0.65rem] tracking-widest text-[#e05555] uppercase mb-2">Treasury Triggered</p>
              <p className="text-[0.78rem] text-[#555] leading-relaxed">
                Automatically fires when treasury falls below 5,000 bronze (CRITICAL state). 
                Fixed 1.60× multiplier for 24 hours. The economy&apos;s immune response.
              </p>
            </div>
            <div className="border border-[#c8a84b22] bg-[#0a0d10] p-4">
              <p className="font-mono text-[0.65rem] tracking-widest text-[#c8a84b] uppercase mb-2">Zombita Chaos Event</p>
              <p className="text-[0.78rem] text-[#555] leading-relaxed">
                0.3% chance per pricing pass (~once every 2–3 months). Random multiplier 
                and duration. Zombita posts a cryptic announcement. No explanation given.
              </p>
            </div>
          </div>
        </section>

        <div className="h-px bg-[#1a1a1a] mb-16" />

        {/* NPC Shops */}
        <section className="mb-16">
          <h2 className="!normal-case text-[0.9rem] tracking-[0.2em] text-[#c8a84b] mb-6">The Five NPC Shops</h2>
          <div className="space-y-2">
            {SHOPS.map(shop => (
              <Link key={shop.name} href="/shop" className="no-underline block group">
                <div className="border border-[#1a1a1a] bg-[#0a0d10] p-4 hover:border-[#252525] transition-all flex items-center gap-4">
                  <span className="text-xl">{shop.icon}</span>
                  <div>
                    <p className="font-mono text-[0.72rem] tracking-wider text-[#e6e6e6] mb-0.5 group-hover:text-[#c8a84b] transition-colors">{shop.name}</p>
                    <p className="text-[0.75rem] text-[#555]">{shop.desc}</p>
                  </div>
                  <span className="ml-auto font-mono text-[0.6rem] text-[#333] group-hover:text-[#c8a84b] transition-colors">View Shop →</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <div className="h-px bg-[#1a1a1a] mb-16" />

        {/* Other features */}
        <section className="mb-16">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: "🏷️", name: "Marketplace", color: "#4a8fc4", desc: "Player-to-player listings. Listing tax + purchase tax scale with treasury state (3%/4% when BOOMING → 12%/15% when CRITICAL).", href: "/marketplace" },
              { icon: "🎰", name: "Lottery", color: "#9775cc", desc: "1 Silver ticket. Tiered prizes: Bandages at the low end, Assault Rifle and Katana at the top. Weekly draw.", href: "/shop" },
              { icon: "🚗", name: "Teleport", color: "#4caf7d", desc: "Fast-travel to 7 named map locations for 5 Silver. Bot fires RCON teleport command for instant in-game travel.", href: "/shop" },
            ].map(f => (
              <Link key={f.name} href={f.href} className="no-underline group">
                <div className="border border-[#1a1a1a] bg-[#0a0d10] p-5 h-full hover:border-[#252525] transition-all">
                  <div className="text-xl mb-3">{f.icon}</div>
                  <p className="font-mono text-[0.7rem] tracking-wider uppercase mb-2 group-hover:transition-colors" style={{ color: f.color }}>{f.name}</p>
                  <p className="text-[0.75rem] text-[#555] leading-relaxed">{f.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

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
