"use client";
// components/ServerGoalBar.tsx - the SERVER GOAL on the public site (2026-10-07). Every zombie anyone kills counts
// toward one server-wide goal; reaching it unlocks things for everyone who helped. Data: GET /api/goal (no login),
// read every 60 s. Shows nothing until the server has a goal (Zombita 1.7.143).
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";

interface Goal {
  id: string; name: string; target: number; reached_at: number; helpers: number; rewards: string[]; unlocks: string[];
}
interface GoalView {
  ok: boolean; total: number; done: boolean; stale?: boolean; goals: Goal[];
  current?: { id: string; name: string; target: number; from: number; helpers: number; pct: number };
}

export default function ServerGoalBar() {
  const [v, setV] = useState<GoalView | null>(null);
  useEffect(() => {
    let stop = false;
    let t: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const r = await fetch(`${API}/api/goal`);
        if (r.ok) { const d = await r.json(); if (!stop) setV(d); }
      } catch { /* keep the last numbers */ }
      if (!stop) t = setTimeout(tick, 60000);
    };
    tick();
    return () => { stop = true; if (t) clearTimeout(t); };
  }, []);

  if (!v || !v.ok) return null;
  const cur = v.current;
  const goal = cur ? v.goals.find(g => g.id === cur.id) : undefined;
  const gets = goal ? [...goal.rewards, ...goal.unlocks] : [];
  const reached = v.goals.filter(g => g.reached_at > 0);

  return (
    <div className="border border-[#1a1a1a] bg-[#0a0d10] w-full relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #c8a84b88, transparent)" }} />
      <div className="p-5 sm:p-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-[0.62rem] tracking-widest text-[#c8a84b] uppercase">Server goal</span>
          <span className="font-mono text-[0.62rem] tracking-wider text-[#5a5a5a]">every zombie anyone kills counts</span>
        </div>
        {cur ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[#e6e6e6] text-lg">{cur.name}</span>
              <span className="font-mono text-sm text-[#bfbfbf]">
                <b className="text-[#c8a84b]">{v.total.toLocaleString()}</b> / {cur.target.toLocaleString()} kills
              </span>
            </div>
            <div className="h-2.5 w-full bg-[#15181c] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={cur.pct}>
              <div className="h-full" style={{ width: `${cur.pct}%`, background: "linear-gradient(90deg, #4a7c59, #6fae7f)", transition: "width 1s ease" }} />
            </div>
            <div className="flex flex-wrap justify-between gap-2 font-mono text-[0.68rem] text-[#7a7a7a]">
              <span>{cur.pct}% there, {cur.helpers.toLocaleString()} survivors helping</span>
              {gets.length > 0 && <span>Unlocks: {gets.join(", ")}</span>}
            </div>
          </>
        ) : (
          <div className="text-[#4caf7d]">Every goal is reached: {v.total.toLocaleString()} zombies down. The next one is coming soon.</div>
        )}
        {reached.length > 0 && (
          <div className="font-mono text-[0.62rem] text-[#5a5a5a]">Reached: {reached.map(g => g.name).join(", ")}</div>
        )}
      </div>
    </div>
  );
}
