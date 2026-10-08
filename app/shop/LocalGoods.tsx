"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";

// WHOLESALE (mod 1.7.149): what players made, grew and caught, sold to Wholesale and now on every kiosk's LOCAL tab.
// Shown only while Wholesale is switched on (GET /api/wholesale).
type Good = { id: string; name: string; qty: number; price: number; by: string; kind: string };
type Data = { on: boolean; items: Good[]; merchantsFirstHours: number; dayCap: number };

function money(b: number): string {
  const g = Math.floor(b / 10000), s = Math.floor((b % 10000) / 1000), r = b % 1000;
  const parts: string[] = [];
  if (g) parts.push(`${g}g`);
  if (s) parts.push(`${s}s`);
  if (r || !parts.length) parts.push(`${r}b`);
  return parts.join(" ");
}

export default function LocalGoods() {
  const [d, setD] = useState<Data | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API}/api/wholesale`);
        if (r.ok) setD(await r.json());
      } catch {}
    };
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, []);

  if (!d || !d.on) return null;
  const s = q.trim().toLowerCase();
  const items = s ? d.items.filter((i) => i.name.toLowerCase().includes(s) || i.by.toLowerCase().includes(s)) : d.items;

  return (
    <div className="mt-8 border border-[#1e2530] bg-[#0a0d10]">
      <div className="p-4 sm:p-5 border-b border-[#1e2530]">
        <div className="font-display text-2xl tracking-[3px] text-[#6fd45a]" style={{ fontFamily: "'Bebas Neue',sans-serif" }}>
          🧺 LOCAL GOODS
        </div>
        <p className="font-mono text-[0.65rem] text-[#555] mt-1 mb-0 leading-relaxed">
          Made, grown and caught by players. Artisans, Providers and Hunters sell what they make to Wholesale; Merchants get the
          first look for {d.merchantsFirstHours} hours, then it all lands here. Buy it on the <strong className="text-[#888]">LOCAL</strong> tab
          of any kiosk.
        </p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search goods or makers..."
          className="mt-3 w-full font-mono text-[0.7rem] px-3 py-2 bg-[#0f1318] border border-[#1e2530] text-[#c8cdd6] outline-none focus:border-[#6fd45a]" />
      </div>
      {items.length === 0 ? (
        <p className="font-mono text-[0.68rem] text-[#444] p-5 m-0">{s ? "Nothing matches." : "Nothing on the shelf right now. Check back after the next harvest."}</p>
      ) : (
        <div className="divide-y divide-[#141920]">
          {items.map((i) => (
            <div key={i.id} className="flex items-center gap-3 px-4 sm:px-5 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[0.72rem] text-[#c8cdd6] truncate">{i.name}</div>
                {i.by && <div className="font-mono text-[0.58rem] text-[#5b8f52] truncate">{i.by}</div>}
              </div>
              <div className="font-mono text-[0.62rem] text-[#555] w-20 text-right">{i.qty} in stock</div>
              <div className="font-mono text-[0.72rem] text-accent w-20 text-right">{money(i.price)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
