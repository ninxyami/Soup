"use client";
// components/DerbyBoard.tsx - THE FISHING DERBY (2026-10-09, mod 1.7.158). This week's heaviest fish, time left, last week's
// winners. Data: GET /api/derby (no login), read every 60 s. Shows nothing until the game has written it (the derby switch).
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";

function left(s: number) {
  s = Math.max(0, Math.floor(s || 0));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return m > 0 ? `${m}m` : "under a minute";
}

export default function DerbyBoard() {
  const [v, setV] = useState<any>(null);
  useEffect(() => {
    let stop = false;
    let t: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const r = await fetch(`${API}/api/derby`);
        if (r.ok) { const d = await r.json(); if (!stop) setV(d); }
      } catch { /* keep the last numbers */ }
      if (!stop) t = setTimeout(tick, 60000);
    };
    tick();
    return () => { stop = true; if (t) clearTimeout(t); };
  }, []);

  if (!v || !v.ready || (!v.on && (v.top || []).length === 0 && (v.last || []).length === 0)) return null;
  const medal = ["🥇", "🥈", "🥉"];
  return (
    <section>
      <h2 className="text-[0.8rem] tracking-[0.15em] uppercase text-[#aaa] mb-1">🎣 Fishing Derby</h2>
      <p className="text-[0.72rem] text-[#666] font-mono mb-4">
        The heaviest fish caught this week wins. Only fish you catch yourself count. {v.on ? `Ends in ${left(v.left)}.` : "Paused right now."}
      </p>
      {(v.top || []).length === 0
        ? <p className="text-[#555] font-mono text-sm italic">No fish yet this week.</p>
        : <div className="flex flex-col">
            {v.top.map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-[#1a1a1a] text-[0.85rem]">
                <span className="w-6 text-center font-mono text-[#555]">{medal[i] || `${i + 1}.`}</span>
                <span className="min-w-0 flex-1 truncate">
                  <a href={`/player?id=${encodeURIComponent(r.name)}`} className="hover:text-[#4a7c59]">{r.name}</a>
                  <span className="text-[0.7rem] text-[#666] font-mono ml-2">{r.fish}</span>
                </span>
                <span className="font-mono text-[0.8rem] text-[#599ef2] whitespace-nowrap">{r.kg.toFixed(2)} kg</span>
              </div>
            ))}
          </div>}
      {(v.last || []).length > 0 && (
        <p className="text-[0.7rem] text-[#666] font-mono mt-3">
          Last week: {v.last.map((r: any, i: number) => `${medal[i] || ""} ${r.name} ${r.kg.toFixed(2)} kg`).join(", ")}
        </p>
      )}
      <p className="text-[0.7rem] text-[#555] font-mono mt-2">The top 3 get a trophy from Zombita, as a code in the Jobs app.</p>
    </section>
  );
}
