"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";

// HATTIE'S ANIMALS (mod 1.8.21, lot_shelf_patch.py): what Hattie has in her pens this half-day, the price and how many are left.
// Her shelf rolls every 12 hours with limited stock. Public data only (GET /api/lot/hattie): no admin details.
type Animal = { id: string; name: string; group: string; price: number; left: number; max: number };
type Data = { ok: boolean; open?: boolean; stale?: boolean; next_in?: number; at?: number; animals?: Animal[] };

const GROUP_ICON: Record<string, string> = { poultry: "🐔", rabbits: "🐇", pigs: "🐖", sheep: "🐑", cows: "🐄", dogs: "🐕", cats: "🐈" };

function money(b: number): string {
  const s = Math.floor(b / 1000), r = b % 1000;                    // silver and bronze only (Nin 2026-10-13)
  const parts: string[] = [];
  if (s) parts.push(`${s.toLocaleString("en-US")}s`);
  if (r || !parts.length) parts.push(`${r}b`);
  return parts.join(" ");
}

function until(sec: number): string {
  const v = Math.max(0, Math.floor(sec));
  if (v < 60) return "any moment now";
  const h = Math.floor(v / 3600), m = Math.floor((v % 3600) / 60);
  return h ? `in ${h} h ${m} min` : `in ${m} min`;
}

export default function HattieAnimals() {
  const [d, setD] = useState<Data | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API}/api/lot/hattie`);
        if (r.ok) setD(await r.json());
      } catch {}
    };
    load();
    const iv = setInterval(load, 60000);
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => { clearInterval(iv); clearInterval(tick); };
  }, []);

  if (!d || !d.ok || d.open === false) return null;
  const animals = d.animals || [];
  const left = (d.next_in || 0) - Math.floor(now / 1000 - (d.at || 0));

  return (
    <div className="mt-8 border border-[#1e2530] bg-[#0a0d10]">
      <div className="p-4 sm:p-5 border-b border-[#1e2530]">
        <div className="font-display text-2xl tracking-[3px] text-[#d9a441]" style={{ fontFamily: "'Bebas Neue',sans-serif" }}>
          🐄 HATTIE&apos;S ANIMALS
        </div>
        <p className="font-mono text-[0.65rem] text-[#555] mt-1 mb-0 leading-relaxed">
          Hattie Brennan sells livestock and pets at Zombita&apos;s Diner. Her pens change every 12 hours and each animal is limited:
          once it&apos;s gone, it&apos;s gone until the next batch. Small animals go into your arms; big ones wait in the pen beside
          her, so bring a rope. New animals {until(left)}.
        </p>
      </div>
      {animals.length === 0 ? (
        <p className="font-mono text-[0.68rem] text-[#444] p-5 m-0">Her pens are empty right now. Check back after the next batch.</p>
      ) : (
        <div className="grid gap-2 sm:gap-3 p-4 sm:p-5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(165px,1fr))" }}>
          {animals.map((a) => (
            <div key={a.id} className="border border-[#1e2530] bg-[#0c0f13] p-3 flex flex-col gap-1" style={{ opacity: a.left > 0 ? 1 : 0.55 }}>
              <div className="text-2xl">{GROUP_ICON[a.group] || "🐾"}</div>
              <div className="font-mono text-[0.7rem] text-[#c8cdd6] leading-tight">{a.name}</div>
              <div className="font-mono text-[0.72rem] text-accent">{money(a.price)}</div>
              <div className="font-mono text-[0.6rem]" style={{ color: a.left > 0 ? "#4caf7d" : "#e05555" }}>
                {a.left > 0 ? `${a.left} left` : "Sold out"}
              </div>
            </div>
          ))}
        </div>
      )}
      {d.stale && (
        <p className="font-mono text-[0.58rem] text-[#444] px-4 sm:px-5 pb-3 m-0">The server is resting, so this may be a little behind.</p>
      )}
    </div>
  );
}
