"use client";
// The Cradle Trials campaign was retired (bot cogs.campaign removed 2026-07-04).
import Link from "next/link";

export default function RetiredPage() {
  return (
    <main>
      <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <Link href="/features" className="font-mono text-[0.65rem] tracking-widest text-[#444] hover:text-[#e6e6e6] no-underline transition-colors uppercase">
          ← Features
        </Link>
        <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#555] uppercase mb-3 mt-4">Retired</p>
        <h1 className="text-[1.6rem] sm:text-[2.2rem] tracking-[0.2em] mb-4">THE CRADLE TRIALS</h1>
        <p className="text-[#666] text-[0.88rem] leading-relaxed mb-8">The Cradle Trials campaign has ended. These days the stories come from Zombita herself: jobs on your phone every few hours, Lady Dawnie's hordes and fakes, treasure hunts, and the weekly newspaper.</p>
        <div className="flex gap-3 flex-wrap">
          <Link href="/jobs" className="font-mono text-[0.7rem] tracking-[0.15em] border px-4 py-2 no-underline uppercase" style={{ color: "#4caf7d", borderColor: "#4caf7d55" }}>Zombita's Jobs →</Link>
          <Link href="/features/events" className="font-mono text-[0.7rem] tracking-[0.15em] border px-4 py-2 no-underline uppercase" style={{ color: "#e05555", borderColor: "#e0555555" }}>World events →</Link>
          <Link href="/newspaper" className="font-mono text-[0.7rem] tracking-[0.15em] border px-4 py-2 no-underline uppercase" style={{ color: "#c8a84b", borderColor: "#c8a84b55" }}>The newspaper →</Link>
        </div>
      </div>
    </main>
  );
}
