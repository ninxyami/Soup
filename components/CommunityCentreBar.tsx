"use client";
// components/CommunityCentreBar.tsx - the COMMUNITY CENTRE meter (2026-10-09, mod 1.7.158). How many lines of Zombita's sheet
// (skill books, recipe magazines, VHS tapes, tools) are on the centre's shelves right now. Data: GET /api/community-centre
// (no login), read every 60 s. Shows nothing until the game has written the sheet (an admin marks the first shelf).
import { useEffect, useState } from "react";
import Link from "next/link";
import { API } from "@/lib/constants";

export function useCommunityCentre(every = 60000) {
  const [v, setV] = useState<any>(null);
  useEffect(() => {
    let stop = false;
    let t: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const r = await fetch(`${API}/api/community-centre`);
        if (r.ok) { const d = await r.json(); if (!stop) setV(d); }
      } catch { /* keep the last numbers */ }
      if (!stop) t = setTimeout(tick, every);
    };
    tick();
    return () => { stop = true; if (t) clearTimeout(t); };
  }, [every]);
  return v;
}

export function CentreMeter({ v, link }: { v: any; link?: boolean }) {
  if (!v || !v.ready) return null;
  const pct = v.total > 0 ? Math.round((100 * v.present) / v.total) : 0;
  return (
    <div className="border border-[#1a1a1a] bg-[#0a0d10] w-full relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #e8913a88, transparent)" }} />
      <div className="p-5 sm:p-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-[0.62rem] tracking-widest text-[#e8913a] uppercase">Community centre</span>
          <span className="font-mono text-[0.62rem] tracking-wider text-[#5a5a5a]">built by everyone, for everyone</span>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[#e6e6e6] text-lg">{v.complete ? "Complete!" : "Filling the shelves"}</span>
          <span className="font-mono text-sm text-[#bfbfbf]"><b className="text-[#e8913a]">{v.present}</b> / {v.total} there</span>
        </div>
        <div className="h-2.5 w-full bg-[#15181c] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="h-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #b8642a, #e8913a)", transition: "width 1s ease" }} />
        </div>
        <div className="flex flex-wrap justify-between gap-2 font-mono text-[0.68rem] text-[#7a7a7a]">
          <span>{(v.cats || []).map((c: any) => `${c.name} ${c.present}/${c.total}`).join(" · ")}</span>
          {link && <Link href="/community" className="text-[#e8913a] no-underline">See what&apos;s missing →</Link>}
        </div>
      </div>
    </div>
  );
}

export default function CommunityCentreBar() {
  const v = useCommunityCentre();
  return <CentreMeter v={v} link />;
}
