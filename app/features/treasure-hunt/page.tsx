"use client";
import Link from "next/link";

const HUNT_TYPES = [
  { emoji: "🥫", name: "Food Supply", guards: 20, zone: "Farm", risk: "Low", desc: "Food and provisions loot pool. Easier to reach, lighter zombie presence." },
  { emoji: "🩺", name: "Medical Supply", guards: 20, zone: "Town", risk: "Low", desc: "Medical supplies. Critical finds for anyone running low on bandages and meds." },
  { emoji: "🔫", name: "Ammo Cache", guards: 30, zone: "Town", risk: "Medium", desc: "Ammunition loot pool. More guards, better payoff. Know your way around a gun store." },
  { emoji: "⚙️", name: "Tool Cache", guards: 25, zone: "Industrial", risk: "Medium", desc: "Tools and equipment. Industrial zone — harder to navigate, worth the detour." },
  { emoji: "🚗", name: "Vehicle Parts", guards: 25, zone: "Road", risk: "Medium", desc: "Car parts loot pool. Perfect for survivors who need to keep their ride running." },
  { emoji: "💎", name: "Rare Find", guards: 40, zone: "Random", risk: "HIGH", desc: "Rare and legendary loot pool. Most guards, best reward. The real race." },
];

const RISK_COLOR: Record<string, string> = { "Low": "#4caf7d", "Medium": "#c8a84b", "HIGH": "#e05555" };

export default function TreasureHuntPage() {
  return (
    <main>
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-12 sm:py-16">

        {/* Header */}
        <div className="mb-12">
          <Link href="/features" className="font-mono text-[0.65rem] tracking-widest text-[#444] hover:text-[#c8a84b] no-underline transition-colors uppercase">
            ← Features
          </Link>
          <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#c8a84b] uppercase mb-3 mt-4">World Events</p>
          <h1 className="text-[1.8rem] sm:text-[2.5rem] tracking-[0.2em] mb-2">TREASURE HUNT</h1>
          <p className="font-mono text-[0.7rem] tracking-[0.15em] text-[#7a6a2a] uppercase mb-6">Hidden Cache · Zombie Guards · Claim Code Race</p>
          <p className="text-[#666] text-[0.88rem] max-w-[560px] leading-relaxed">
            A hidden cache of supplies somewhere on the map. Zombie guards surround it. 
            Zombita drops cryptic hints in Discord. Players race in-game — the first to 
            arrive and enter the claim code wins everything. Thirty minutes before it expires.
          </p>
        </div>

        {/* Hunt flow */}
        <section className="mb-16">
          <div className="border border-[#1a1a1a] bg-[#0a0d10] overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #c8a84b66, transparent)" }} />
            <div className="p-6 sm:p-8">
              <h2 className="!mb-6 !normal-case text-[1rem] tracking-[0.12em] text-[#c8a84b] font-mono uppercase">How a Hunt Works</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <ol className="space-y-3">
                  {[
                    "Auto-scheduler fires or admin triggers a hunt manually",
                    "Hunt type and map region selected — coordinates pinpointed",
                    "Discord announcement posted with type, risk level, and Zombita's flavour hint",
                    "Players start moving toward the area in-game",
                    "The loot bag and zombie guards only appear once a player gets close — lazy spawn",
                    "A map marker and HUD icon activate immediately for all players",
                    "First player to reach the bag finds a Note inside with the claim code",
                    "Enter the code in Discord — reward delivered via RCON instantly",
                    "Hunt result logged with winner, location, and timestamps",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[0.75rem] text-[#555]" style={{ paddingLeft: 0 }}>
                      <span className="font-mono text-[0.6rem] text-[#c8a84b] flex-shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                      {step}
                    </li>
                  ))}
                </ol>
                <div className="space-y-4">
                  <div>
                    <p className="font-mono text-[0.6rem] tracking-widest text-[#444] uppercase mb-3">Key Rules</p>
                    <div className="space-y-2">
                      {[
                        { k: "Window", v: "30 minutes — then the cache expires and is removed" },
                        { k: "Winner", v: "First to enter the correct claim code in Discord" },
                        { k: "Claim code", v: "Found inside a Note item in the loot bag" },
                        { k: "Spawn timing", v: "Bag and guards appear when a player gets close — not before" },
                        { k: "Map marker", v: "Active for all players from the moment the hunt starts" },
                        { k: "HUD icon", v: "Changes when you're within 75 tiles of the real location" },
                      ].map(r => (
                        <div key={r.k} className="flex gap-3 text-[0.72rem]">
                          <span className="font-mono text-[#444] min-w-[100px] flex-shrink-0">{r.k}</span>
                          <span className="text-[#555]">{r.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-[#141414] pt-4">
                    <p className="font-mono text-[0.6rem] tracking-widest text-[#333] uppercase mb-2">Character says when close</p>
                    <p className="font-mono text-[0.65rem] text-[#4a7c59] italic">"You feel it. The treasure is very close."</p>
                  </div>
                  <div className="border-t border-[#141414] pt-4">
                    <p className="font-mono text-[0.6rem] tracking-widest text-[#333] uppercase mb-2">On claim / cancel / expiry</p>
                    <div className="space-y-1">
                      <p className="font-mono text-[0.62rem] text-[#555] italic">"Someone found the treasure. It's gone."</p>
                      <p className="font-mono text-[0.62rem] text-[#555] italic">"The signal went dark."</p>
                      <p className="font-mono text-[0.62rem] text-[#555] italic">"Time's up. The treasure is lost."</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Hunt types */}
        <section className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-px flex-1 bg-[#1a1a1a]" />
            <p className="font-mono text-[0.65rem] tracking-[0.3em] uppercase text-[#c8a84b]">Hunt Types</p>
            <div className="h-px flex-1 bg-[#1a1a1a]" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {HUNT_TYPES.map(h => (
              <div key={h.name} className="border border-[#1a1a1a] bg-[#0a0d10] p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${RISK_COLOR[h.risk]}33, transparent)` }} />
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{h.emoji}</span>
                    <span className="font-mono text-[0.7rem] tracking-[0.1em] text-[#ccc] uppercase">{h.name}</span>
                  </div>
                  <span className="font-mono text-[0.55rem] border px-1.5 py-0.5 uppercase flex-shrink-0" style={{ color: RISK_COLOR[h.risk], borderColor: RISK_COLOR[h.risk] + "44" }}>{h.risk}</span>
                </div>
                <p className="text-[0.75rem] text-[#555] leading-relaxed mb-3">{h.desc}</p>
                <div className="flex gap-4 text-[0.65rem]">
                  <span className="font-mono text-[#333]">Zone: <span className="text-[#444]">{h.zone}</span></span>
                  <span className="font-mono text-[#333]">Guards: <span className="text-[#e05555]">{h.guards}</span></span>
                </div>
              </div>
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
