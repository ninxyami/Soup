"use client";
// Faction Wars were taken out (2026-09-20, not ready). Factions themselves live in the game now: /factions.
import Link from "next/link";

export default function RetiredPage() {
  return (
    <main>
      <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <Link href="/features" className="font-mono text-[0.65rem] tracking-widest text-[#444] hover:text-[#e6e6e6] no-underline transition-colors uppercase">
          ← Features
        </Link>
        <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#555] uppercase mb-3 mt-4">Retired</p>
        <h1 className="text-[1.6rem] sm:text-[2.2rem] tracking-[0.2em] mb-4">FACTION WARS</h1>
        <p className="text-[#666] text-[0.88rem] leading-relaxed mb-8">Faction wars have been retired for now. Factions themselves are bigger than ever: found one in game (Esc → Factions, or on your phone), give it up to 8 ranks with their own permissions, recruit, share a stash and a wallet, and unlock a private Discord channel and a faction page here.</p>
        <div className="flex gap-3 flex-wrap">
          <Link href="/factions" className="font-mono text-[0.7rem] tracking-[0.15em] border px-4 py-2 no-underline uppercase" style={{ color: "#4caf7d", borderColor: "#4caf7d55" }}>All factions →</Link>
          <Link href="/leaderboard" className="font-mono text-[0.7rem] tracking-[0.15em] border px-4 py-2 no-underline uppercase" style={{ color: "#c8a84b", borderColor: "#c8a84b55" }}>Faction leaderboards →</Link>
        </div>
      </div>
    </main>
  );
}
