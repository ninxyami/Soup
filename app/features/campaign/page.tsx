"use client";
import Link from "next/link";

const QUESTS = [
  {
    num: "01",
    name: "The Bookstore",
    location: "Old bookstore, south side of Muldraugh",
    coords: "10936, 8120",
    cipher: "Caesar ROT+3 — ILUH VWDWLRQ → FIRE STATION",
    waves: "3 waves × 25 zombies, 10 min gaps, 80–150 tile spawn radius",
    rewards: "4× Bandage, 2× Painkillers, 150 bronze, lore note: 'Phase Two assets relocated. WAREHOUSE.'",
  },
];

export default function CampaignPage() {
  return (
    <main>
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-12 sm:py-16">

        <div className="mb-12">
          <Link href="/features" className="font-mono text-[0.65rem] tracking-widest text-[#444] hover:text-[#c47a4a] no-underline transition-colors uppercase">
            ← Features
          </Link>
          <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#c47a4a] uppercase mb-3 mt-4">Campaign</p>
          <h1 className="text-[1.8rem] sm:text-[2.5rem] tracking-[0.2em] mb-4">THE CRADLE TRIALS</h1>
          <p className="text-[#666] text-[0.88rem] max-w-[560px] leading-relaxed">
            An episodic narrative campaign for groups of 1–4 players. Cipher puzzles, scheduled 
            in-game sessions, zombie encounters, and permanent progression flags. Once you complete 
            an act, you cannot redo it — this happened.
          </p>
        </div>

        {/* Overview */}
        <section className="mb-16">
          <div className="border border-[#1a1a1a] bg-[#0a0d10] overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #c47a4a66, transparent)" }} />
            <div className="p-6 sm:p-8">
              <h2 className="!mb-4 !normal-case text-[1rem] tracking-[0.15em] text-[#c47a4a]">How It Works</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <div>
                  <p className="font-mono text-[0.6rem] tracking-widest text-[#444] uppercase mb-3">Setup</p>
                  <ol className="space-y-2">
                    {[
                      "/participate — create a group (you become leader) or join with a code",
                      "Group codes are random 4-word identifiers (e.g. WOLF-7342)",
                      "Leader invites up to 3 whitelisted players with /invite",
                      "Admin schedules the group's in-game session with /campaign schedule",
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[0.75rem] text-[#555]" style={{ paddingLeft: 0 }}>
                        <span className="font-mono text-[0.6rem] text-[#c47a4a] flex-shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <p className="font-mono text-[0.6rem] tracking-widest text-[#444] uppercase mb-3">Session Flow</p>
                  <ol className="space-y-2">
                    {[
                      "At session time, bot sends first cipher to group's private Discord channel",
                      "Players decode cipher and submit answers with /answer <decoded text>",
                      "Correct answer advances narrative — next clue revealed",
                      "All quests involve: teleport → cipher → optional NPC → DotD waves → rewards",
                      "Completing Act I marks the player permanently — one-time experience",
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[0.75rem] text-[#555]" style={{ paddingLeft: 0 }}>
                        <span className="font-mono text-[0.6rem] text-[#c47a4a] flex-shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
              <div className="border border-[#c47a4a22] bg-[#070a0d] p-4">
                <p className="font-mono text-[0.6rem] tracking-widest text-[#c47a4a] uppercase mb-2">⚠ Permanent Progression</p>
                <p className="text-[0.75rem] text-[#555]">
                  Completing an act marks the player permanently in the database. There is no redo. 
                  This is intentional — the Cradle Trials is a one-time story experience, not a replayable dungeon.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Act I */}
        <section className="mb-16">
          <div className="mb-6">
            <p className="font-mono text-[0.65rem] tracking-[0.2em] text-[#c47a4a] uppercase mb-1">Act I</p>
            <h2 className="!mb-2 !normal-case text-[1.1rem] tracking-[0.1em]">Embers of Muldraugh</h2>
            <p className="text-[#555] text-[0.82rem]">4 quests, each designed for a separate in-game session. Each follows the pattern: teleport → cipher → DotD wave → rewards.</p>
          </div>

          {/* Quest 1 detail */}
          <div className="border border-[#1a1a1a] bg-[#0a0d10] p-5 sm:p-6 mb-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 bottom-0 w-px bg-[#c47a4a33]" />
            <div className="flex items-center gap-3 mb-4 pl-3">
              <span className="font-['Bebas_Neue'] text-[1.8rem] text-[#c47a4a33] leading-none">01</span>
              <div>
                <h3 className="font-mono text-[0.75rem] tracking-[0.15em] text-[#e6e6e6] uppercase mb-0.5">The Bookstore</h3>
                <p className="font-mono text-[0.6rem] text-[#444]">Muldraugh · 10936, 8120</p>
              </div>
            </div>
            <div className="pl-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <p className="font-mono text-[0.58rem] tracking-widest text-[#444] uppercase mb-1">Cipher</p>
                  <div className="border border-[#1a1a1a] bg-[#070a0d] p-2 font-mono text-[0.7rem]">
                    <span className="text-[#555]">Caesar ROT+3 </span>
                    <span className="text-[#333]">— </span>
                    <span className="text-[#c8a84b]">ILUH VWDWLRQ</span>
                    <span className="text-[#333]"> → </span>
                    <span className="text-[#4caf7d]">FIRE STATION</span>
                  </div>
                  <p className="text-[0.65rem] text-[#333] mt-1 font-mono">Clue delivered as Base.Paper in player inventory</p>
                </div>
                <div>
                  <p className="font-mono text-[0.58rem] tracking-widest text-[#444] uppercase mb-1">DotD Event</p>
                  <p className="text-[0.72rem] text-[#555]">3 waves × 25 zombies · 10 min wave gaps · 80–150 tile spawn radius</p>
                </div>
              </div>
              <div>
                <p className="font-mono text-[0.58rem] tracking-widest text-[#444] uppercase mb-1">Rewards</p>
                <div className="space-y-1">
                  {["4× Bandage", "2× Painkillers", "150 bronze coins", "Lore note: 'Phase Two assets relocated. WAREHOUSE.'"].map(r => (
                    <div key={r} className="flex items-center gap-2 text-[0.72rem] text-[#555]">
                      <span className="text-[#c47a4a] text-[0.6rem]">+</span>
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quests 2-4 placeholder */}
          {[2, 3, 4].map(n => (
            <div key={n} className="border border-[#111] bg-[#080b0e] p-4 mb-2 relative overflow-hidden opacity-50">
              <div className="absolute top-0 left-0 bottom-0 w-px bg-[#1a1a1a]" />
              <div className="pl-3 flex items-center gap-3">
                <span className="font-['Bebas_Neue'] text-[1.8rem] text-[#1a1a1a] leading-none">{String(n).padStart(2, "0")}</span>
                <div>
                  <p className="font-mono text-[0.7rem] tracking-wider text-[#333] uppercase">Quest {n}</p>
                  <p className="font-mono text-[0.58rem] text-[#222]">Details revealed in-game during Act I</p>
                </div>
                <span className="ml-auto font-mono text-[0.55rem] text-[#222] border border-[#1a1a1a] px-2 py-1">CLASSIFIED</span>
              </div>
            </div>
          ))}
        </section>

        {/* Commands */}
        <section className="mb-16">
          <h2 className="!normal-case text-[0.9rem] tracking-[0.2em] text-[#c47a4a] mb-4">Campaign Commands</h2>
          <div className="space-y-2">
            {[
              { cmd: "/participate", desc: "Create or join a campaign group" },
              { cmd: "/invite @player", desc: "Invite a whitelisted player to your group (leader only)" },
              { cmd: "/answer <text>", desc: "Submit a decoded cipher answer during an active quest" },
              { cmd: "/campaign status", desc: "Check your group's current campaign progress" },
              { cmd: "/campaign schedule", desc: "Admin: schedule a group's in-game session time" },
            ].map(c => (
              <div key={c.cmd} className="border border-[#1a1a1a] bg-[#0a0d10] px-4 py-3 flex items-center gap-4">
                <span className="font-mono text-[0.68rem] text-[#c47a4a] min-w-[160px]">{c.cmd}</span>
                <span className="text-[0.75rem] text-[#555]">{c.desc}</span>
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
