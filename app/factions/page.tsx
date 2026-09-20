"use client";
// @ts-nocheck
// Every in-game faction Zombita knows: logo, members, kills, owner. Click one for its page.
import { useEffect, useState } from "react";
import Link from "next/link";
import { API } from "@/lib/constants";
import { FactionLogo, fmtBronze } from "@/components/FactionBits";

export default function FactionsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/factions`).then((r) => (r.ok ? r.json() : null)).then((d) => setData(d)).catch(() => {}).finally(() => setLoading(false));
  }, []);
  const whenT = (ts: number) => (ts ? new Date(ts * 1000).toLocaleString("en-GB", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

  const factions = data?.factions || [];
  const gone = data?.disbanded || [];
  const board = factions.filter((f: any) => f.recruiting && f.unlocked);
  const since = (ts: number) => (ts ? new Date(ts * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");

  return (
    <main className="max-w-[960px] mx-auto px-4 py-8">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-6">
        <h1 className="font-mono text-[0.75rem] tracking-[0.25em] uppercase text-[#c8a84b] m-0">Factions</h1>
        <span className="font-mono text-[0.65rem] text-[#555]">
          Founded in game. Unlocking one ({fmtBronze(data?.settings?.unlock_fee || 1000)}) gets a Discord channel, this page and a wallet.
        </span>
      </div>

      {loading && <div className="font-mono text-[0.7rem] text-[#555]">LOADING...</div>}
      {!loading && !factions.length && (
        <div className="font-mono text-[0.75rem] text-[#777] border border-[#222] p-6 text-center">No factions yet. Found one in game (Esc → Factions).</div>
      )}

      {board.length > 0 && (
        <div className="mb-8">
          <h2 className="font-mono text-[0.65rem] tracking-[0.25em] uppercase text-[#4a7c59] mb-2">Recruiting</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {board.map((f: any) => (
              <Link key={f.fid} href={`/faction?id=${f.fid}`} className="no-underline border border-[#2a3a2e] hover:border-[#4a7c59] p-3 flex gap-3 bg-[#0f120f]">
                <FactionLogo faction={f} size={40} />
                <div className="min-w-0">
                  <div className="text-[#e6e6e6]">{f.name}{f.tag ? <span className="font-mono text-[0.65rem] text-[#c8a84b] ml-2">[{f.tag}]</span> : null} <span className="font-mono text-[0.6rem] text-[#777]">· {f.memberCount} members</span></div>
                  <div className="text-[0.8rem] text-[#9a9a9a]">{f.blurb || f.motto || "Looking for members."}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {factions.map((f: any) => (
          <Link key={f.fid} href={`/faction?id=${f.fid}`} className="no-underline group border border-[#222] hover:border-[#c8a84b] transition-colors p-4 flex gap-4 bg-[#0f0f0f]">
            <FactionLogo faction={f} size={56} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[#e6e6e6] font-semibold group-hover:text-[#c8a84b] transition-colors">{f.name}</span>
                {f.tag && <span className="font-mono text-[0.65rem] text-[#c8a84b]">[{f.tag}]</span>}
                {!f.unlocked && <span className="font-mono text-[0.6rem] text-[#777] border border-[#333] px-1">LOCKED</span>}
                {f.recruiting && f.unlocked && <span className="font-mono text-[0.6rem] text-[#4a7c59] border border-[#2a3a2e] px-1">RECRUITING</span>}
              </div>
              {f.motto && <div className="text-[0.8rem] text-[#9a9a9a] italic truncate">“{f.motto}”</div>}
              <div className="font-mono text-[0.65rem] text-[#777] mt-1 flex gap-3 flex-wrap">
                <span>👑 {f.owner || "?"}</span>
                <span>{f.memberCount} member{f.memberCount === 1 ? "" : "s"}</span>
                <span className="text-[#4a7c59]">{(f.kills || 0).toLocaleString()} kills</span>
                {f.since ? <span>since {since(f.since)}</span> : null}
              </div>
            </div>
          </Link>
        ))}
      </div>


      {gone.length > 0 && (
        <div className="mt-10">
          <h2 className="font-mono text-[0.65rem] tracking-[0.25em] uppercase text-[#555] mb-2">Disbanded</h2>
          <div className="font-mono text-[0.7rem] text-[#666] flex flex-wrap gap-x-4 gap-y-1">
            {gone.map((f: any) => (
              <Link key={f.fid} href={`/faction?id=${f.fid}`} className="hover:text-[#c8a84b]">{f.name}{f.tag ? ` [${f.tag}]` : ""} · {since(f.since)} – {since(f.disbandedAt)}</Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
