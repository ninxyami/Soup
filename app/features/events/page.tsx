"use client";
import Link from "next/link";

export default function EventsPage() {
  return (
    <main>
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-12 sm:py-16">

        <div className="mb-12">
          <Link href="/features" className="font-mono text-[0.65rem] tracking-widest text-[#444] hover:text-[#e05555] no-underline transition-colors uppercase">
            ← Features
          </Link>
          <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#e05555] uppercase mb-3 mt-4">World Events</p>
          <h1 className="text-[1.8rem] sm:text-[2.5rem] tracking-[0.2em] mb-4">THE WORLD</h1>
          <p className="text-[#666] text-[0.88rem] max-w-[560px] leading-relaxed">
            Events that affect every player simultaneously. Zombie hordes, treasure races, and a job board run
            by Zombita herself — these are the moments that create server lore and community memory.
          </p>
        </div>

        {/* Dawn of the Dead */}
        <section className="mb-16">
          <div className="border border-[#1a1a1a] bg-[#0a0d10] overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #e0555566, transparent)" }} />
            <div className="p-6 sm:p-8">
              <div className="flex items-start gap-4 mb-4">
                <span className="text-3xl">💀</span>
                <div>
                  <h2 className="!mb-1 !normal-case text-[1.1rem] tracking-[0.1em] text-[#e05555]">Dawn of the Dead</h2>
                  <p className="font-mono text-[0.65rem] tracking-[0.15em] text-[#555] uppercase">Scheduled zombie horde · spawned by the game · Lady Dawnie lore</p>
                </div>
              </div>
              <p className="text-[#666] text-[0.85rem] leading-relaxed mb-6">
                The flagship world event. A scheduled zombie horde that attacks the entire server on a
                configurable interval. Built around Lady Dawnie — the lore character named after Admin Dawn,
                portrayed as the queen of the undead.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="font-mono text-[0.6rem] tracking-widest text-[#444] uppercase mb-3">Event Flow</p>
                  <ol className="space-y-2">
                    {[
                      "Automatic scheduler fires (default: every 13 hours)",
                      "Lady Dawnie buildup message posted in Discord",
                      "10-minute warning sent to all players in-game",
                      "Event begins: the game sends hordes at every player from one direction",
                      "Each wave fires at the configured gap (default: 10 min); the last wave gets its own time",
                      "Every wave is announced in Discord with directional flavour text",
                      "Kills during the event count on the DotD leaderboard; players who log in mid-event see what's happening",
                      "End: \"The horde withdraws. Lady Dawnie is... mildly impressed.\"",
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[0.75rem] text-[#555]" style={{ paddingLeft: 0 }}>
                        <span className="font-mono text-[0.6rem] text-[#e05555] flex-shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <p className="font-mono text-[0.6rem] tracking-widest text-[#444] uppercase mb-3">Configuration</p>
                  <div className="space-y-2">
                    {[
                      { key: "Interval", val: "Configurable (default 13 hours)" },
                      { key: "Wave count", val: "Configurable per event" },
                      { key: "Wave interval", val: "Configurable (default 10 min)" },
                      { key: "Zombie spawn", val: "Configurable count and radius" },
                      { key: "Narration", val: "Lady Dawnie flavour texts with Zombita voice" },
                      { key: "Admin trigger", val: "/dotd trigger — fires immediately" },
                    ].map(c => (
                      <div key={c.key} className="flex gap-3 text-[0.72rem]">
                        <span className="font-mono text-[#444] min-w-[90px]">{c.key}</span>
                        <span className="text-[#555]">{c.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Treasure Hunt */}
        <section className="mb-16">
          <div className="border border-[#1a1a1a] bg-[#0a0d10] overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #c8a84b66, transparent)" }} />
            <div className="p-6 sm:p-8">
              <div className="flex items-start gap-4 mb-4">
                <span className="text-3xl">🗺️</span>
                <div>
                  <h2 className="!mb-1 !normal-case text-[1.1rem] tracking-[0.1em] text-[#c8a84b]">Treasure Hunt</h2>
                  <p className="font-mono text-[0.65rem] tracking-[0.15em] text-[#555] uppercase">Hidden cache · Zombie guards · Claim code race</p>
                </div>
              </div>
              <p className="text-[#666] text-[0.85rem] leading-relaxed mb-6">
                A world event where Zombita announces a hidden cache of supplies guarded by zombies.
                Players race to the location in-game — the first to arrive claims the reward using a generated claim code.
                30-minute window before the hunt expires.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="font-mono text-[0.6rem] tracking-widest text-[#444] uppercase mb-3">Hunt Flow</p>
                  <ol className="space-y-2">
                    {[
                      "Scheduler fires or admin uses /treasurehunt trigger",
                      "Region and exact coordinates selected",
                      "Discord announcement: hunt type, risk, Zombita's hint",
                      "Claim code generated and embedded in server Lua file",
                      "Players race to the location in-game",
                      "First arrival enters claim code → reward delivered via RCON",
                      "Result logged with winner, coordinates, timestamps",
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[0.75rem] text-[#555]" style={{ paddingLeft: 0 }}>
                        <span className="font-mono text-[0.6rem] text-[#c8a84b] flex-shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <p className="font-mono text-[0.6rem] tracking-widest text-[#444] uppercase mb-3">Hunt Types</p>
                  <div className="space-y-2">
                    {[
                      { type: "Supply Cache", risk: "Low", desc: "Basic supplies, easier location" },
                      { type: "Weapon Cache", risk: "Medium", desc: "Weapons and ammo, guarded" },
                      { type: "Rare Cache", risk: "High", desc: "Rare items, heavily guarded" },
                    ].map(t => (
                      <div key={t.type} className="border border-[#1a1a1a] p-2.5 bg-[#070a0d]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[0.65rem] text-[#c8a84b]">{t.type}</span>
                          <span className="font-mono text-[0.55rem] text-[#444] border border-[#222] px-1">{t.risk}</span>
                        </div>
                        <p className="text-[0.7rem] text-[#444]">{t.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Zombita's Jobs */}
        <section className="mb-16">
          <div className="border border-[#1a1a1a] bg-[#0a0d10] overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #4caf7d66, transparent)" }} />
            <div className="p-6 sm:p-8">
              <div className="flex items-start gap-4 mb-4">
                <span className="text-3xl">📋</span>
                <div>
                  <h2 className="!mb-1 !normal-case text-[1.1rem] tracking-[0.1em] text-[#4caf7d]">Zombita&apos;s Jobs</h2>
                  <p className="font-mono text-[0.65rem] tracking-[0.15em] text-[#555] uppercase">Timed batches · C to S tier · first come, first served</p>
                </div>
              </div>
              <p className="text-[#666] text-[0.85rem] leading-relaxed mb-6">
                Every few hours Zombita posts a batch of jobs on everyone&apos;s phone and in Discord. Each job has a few spots:
                the first taker owns it, the next ones join as a party and everyone gets the full reward.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                  <p className="font-mono text-[0.6rem] tracking-widest text-[#444] uppercase mb-3">The Jobs</p>
                  <ul className="space-y-2">
                    {[
                      "Go there - take a look at a place for her",
                      "Bring me - hand in supplies at any kiosk",
                      "Find the code - a bag with a note, read her the code",
                      "Fetch the bag - bring back what she left",
                      "Marked horde - 10 to 100 zombies in hazard suits",
                      "Bandit camp - a crew of bandits to wipe out",
                    ].map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-[0.75rem] text-[#555]" style={{ paddingLeft: 0 }}>
                        <span className="w-1 h-1 rounded-full bg-[#4caf7d] flex-shrink-0" style={{ marginTop: 6 }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-mono text-[0.6rem] tracking-widest text-[#444] uppercase mb-3">How It Pays</p>
                  <ol className="space-y-2">
                    {[
                      "A finished job gives each of you a reward code",
                      "Enter it on the phone: items arrive in a duffel, coins go to your wallet",
                      "C, B, A and S tiers pay more and count more toward your Job Rank",
                      "Sometimes a job was faked by Lady Dawnie - fight or run, you still get paid",
                      "Get on Zombita's good side and she may send a special just for you",
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[0.75rem] text-[#555]" style={{ paddingLeft: 0 }}>
                        <span className="font-mono text-[0.6rem] text-[#4caf7d] flex-shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
              <div className="flex gap-4 flex-wrap mt-6">
                <Link href="/jobs" className="font-mono text-[0.7rem] tracking-[0.15em] text-[#4caf7d] border border-[#4caf7d44] px-4 py-2 no-underline hover:bg-[#4caf7d11] uppercase">The job board →</Link>
                <Link href="/factions" className="font-mono text-[0.7rem] tracking-[0.15em] text-[#888] border border-[#333] px-4 py-2 no-underline hover:bg-[#ffffff08] uppercase">Factions →</Link>
              </div>
            </div>
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
