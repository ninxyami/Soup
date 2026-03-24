"use client";
import Link from "next/link";

export default function FactionWarsPage() {
  return (
    <main>
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-12 sm:py-16">

        {/* Header */}
        <div className="mb-12">
          <Link href="/features" className="font-mono text-[0.65rem] tracking-widest text-[#444] hover:text-[#4caf7d] no-underline transition-colors uppercase">
            ← Features
          </Link>
          <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#4caf7d] uppercase mb-3 mt-4">Factions & Wars</p>
          <h1 className="text-[1.8rem] sm:text-[2.5rem] tracking-[0.2em] mb-2">FACTIONS & WARS</h1>
          <p className="font-mono text-[0.7rem] tracking-[0.15em] text-[#2a5a3a] uppercase mb-6">Persistent Groups · Private Channels · Bronze on the Line</p>
          <p className="text-[#666] text-[0.88rem] max-w-[560px] leading-relaxed">
            Factions persist across sessions and across the season. Full leadership structure, private Discord 
            channels, kill tracking. And when diplomacy fails — you declare war, stake real bronze, and let 
            in-game kill counts decide who walks away richer.
          </p>
        </div>

        {/* Factions */}
        <section className="mb-16">
          <div className="border border-[#1a1a1a] bg-[#0a0d10] overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #4caf7d66, transparent)" }} />
            <div className="p-6 sm:p-8">
              <div className="flex items-start gap-4 mb-6">
                <span className="text-3xl">🏴</span>
                <div>
                  <h2 className="!mb-1 !normal-case text-[1.1rem] tracking-[0.1em] text-[#4caf7d]">Factions</h2>
                  <p className="font-mono text-[0.65rem] tracking-[0.15em] text-[#555] uppercase">Persistent groups · Automatic private channels · Full leadership</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                  <p className="font-mono text-[0.6rem] tracking-widest text-[#444] uppercase mb-3">Creating & Managing</p>
                  <ul className="space-y-2">
                    {[
                      "Any player can create a faction with /faction create — you become leader",
                      "Invite players, kick members, promote to officer, demote officers",
                      "Transfer leadership entirely to another member",
                      "Each faction automatically gets a private Discord channel under FACTIONS",
                      "Channel is visible only to current faction members",
                      "Disbanding removes all members and deletes the channel",
                    ].map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-[0.75rem] text-[#555]" style={{ paddingLeft: 0 }}>
                        <span className="w-1 h-1 rounded-full bg-[#4caf7d] flex-shrink-0" style={{ marginTop: 7 }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-mono text-[0.6rem] tracking-widest text-[#444] uppercase mb-3">Leadership Hierarchy</p>
                  <div className="space-y-2 mb-6">
                    {[
                      { rank: "Leader", desc: "Full control — declare war, disband, promote, transfer" },
                      { rank: "Officer", desc: "Can invite, kick members, and declare war" },
                      { rank: "Member", desc: "Participates in faction activities and kill tracking" },
                    ].map(r => (
                      <div key={r.rank} className="border border-[#1a1a1a] p-2.5 bg-[#070a0d]">
                        <div className="font-mono text-[0.65rem] text-[#4caf7d] mb-0.5">{r.rank}</div>
                        <p className="text-[0.7rem] text-[#444]">{r.desc}</p>
                      </div>
                    ))}
                  </div>
                  <p className="font-mono text-[0.6rem] tracking-widest text-[#444] uppercase mb-2">Persistence</p>
                  <p className="text-[0.75rem] text-[#555]">Factions survive server restarts, player absences, and carry through the full season. Kill counts accumulate.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Faction Wars */}
        <section className="mb-16">
          <div className="border border-[#1a1a1a] bg-[#0a0d10] overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #e0555566, transparent)" }} />
            <div className="p-6 sm:p-8">
              <div className="flex items-start gap-4 mb-6">
                <span className="text-3xl">⚔️</span>
                <div>
                  <h2 className="!mb-1 !normal-case text-[1.1rem] tracking-[0.1em] text-[#e05555]">Faction Wars</h2>
                  <p className="font-mono text-[0.65rem] tracking-[0.15em] text-[#555] uppercase">Bronze stakes · In-game kill tracking · Winner takes all</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                  <p className="font-mono text-[0.6rem] tracking-widest text-[#444] uppercase mb-3">War Flow</p>
                  <ol className="space-y-2">
                    {[
                      "Leader or officer declares war with /war declare <faction> <stake> [duration]",
                      "Defending faction leader receives a notification — accept or decline",
                      "On acceptance: war begins, both factions' stakes are locked in",
                      "Kill tracking activates — every in-game kill during the war is counted",
                      "At war end: winning faction's members split the combined stakes",
                      "Losing faction forfeits their stake entirely",
                      "Surrender available at any time — forfeits your stake immediately",
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[0.75rem] text-[#555]" style={{ paddingLeft: 0 }}>
                        <span className="font-mono text-[0.6rem] text-[#e05555] flex-shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <p className="font-mono text-[0.6rem] tracking-widest text-[#444] uppercase mb-3">War Rules</p>
                  <div className="space-y-3 mb-6">
                    {[
                      { k: "Stake", v: "Bronze — both factions must have enough to cover their declared stake" },
                      { k: "Duration", v: "Set at declaration — war ends automatically when time runs out" },
                      { k: "Kill count", v: "Kills tracked in-game during the active war period only" },
                      { k: "Winner", v: "Faction with higher kill count at end of duration" },
                      { k: "Payout", v: "Combined stakes split between winning faction members" },
                      { k: "Surrender", v: "Forfeits your stake immediately — no refund" },
                    ].map(r => (
                      <div key={r.k} className="text-[0.72rem] border-b border-[#0f0f0f] pb-2 last:border-0 last:pb-0">
                        <span className="font-mono text-[#444]">{r.k}  </span>
                        <span className="text-[#555]">{r.v}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border border-[#1a1a1a] bg-[#070a0d] p-3">
                    <p className="font-mono text-[0.6rem] tracking-widest text-[#444] uppercase mb-2">On the leaderboard</p>
                    <p className="text-[0.72rem] text-[#555]">Faction kill totals, war history, and war win counts are all tracked and visible on the leaderboard.</p>
                    <Link href="/leaderboard" className="font-mono text-[0.6rem] text-[#4caf7d] no-underline hover:text-[#6fcf97] transition-colors mt-2 inline-block">
                      View Leaderboard →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Commands reference */}
        <section className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-px flex-1 bg-[#1a1a1a]" />
            <p className="font-mono text-[0.65rem] tracking-[0.3em] uppercase text-[#4caf7d]">Commands</p>
            <div className="h-px flex-1 bg-[#1a1a1a]" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="font-mono text-[0.6rem] tracking-widest text-[#333] uppercase mb-3">Faction Commands</p>
              <div className="space-y-1.5">
                {[
                  ["/faction create <name>", "Create a faction"],
                  ["/faction invite @user", "Invite a player"],
                  ["/faction kick @user", "Remove a member"],
                  ["/faction leave", "Leave your faction"],
                  ["/faction disband", "Disband (leader only)"],
                  ["/faction promote @user", "Promote to officer"],
                  ["/faction info [name]", "View faction details"],
                  ["/faction list", "All active factions"],
                ].map(([cmd, desc]) => (
                  <div key={cmd as string} className="flex gap-3 text-[0.7rem]">
                    <code className="font-mono text-[#4caf7d] flex-shrink-0">{cmd}</code>
                    <span className="text-[#444]">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="font-mono text-[0.6rem] tracking-widest text-[#333] uppercase mb-3">War Commands</p>
              <div className="space-y-1.5">
                {[
                  ["/war declare <f> <stake>", "Declare war with a stake"],
                  ["/war accept", "Accept a war declaration"],
                  ["/war decline", "Decline"],
                  ["/war status", "Current war state"],
                  ["/war surrender", "Forfeit your stake"],
                  ["/war history [faction]", "Past wars and outcomes"],
                  ["/war leaderboard", "Top factions by war wins"],
                ].map(([cmd, desc]) => (
                  <div key={cmd as string} className="flex gap-3 text-[0.7rem]">
                    <code className="font-mono text-[#e05555] flex-shrink-0">{cmd}</code>
                    <span className="text-[#444]">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-[#1a1a1a] mb-8" />
        <div className="text-center">
          <Link href="/leaderboard" className="font-mono text-[0.7rem] tracking-widest text-[#444] hover:text-[#4caf7d] no-underline transition-colors uppercase mr-8">
            View Faction Leaderboard →
          </Link>
          <Link href="/features" className="font-mono text-[0.7rem] tracking-widest text-[#444] hover:text-[#e6e6e6] no-underline transition-colors uppercase">
            ← Back to All Features
          </Link>
        </div>

      </div>
    </main>
  );
}
