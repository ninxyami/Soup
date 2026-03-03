"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { API } from "@/lib/constants";

export default function PlayerPage() {
  const { discord_id } = useParams();
  const [stats, setStats] = useState<any>(null);
  const [ingame, setIngame] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const pct = (w: number, total: number) => total > 0 ? Math.round((w / total) * 100) + "%" : "—";
  const net = (won: number, lost: number) => { const n = won - lost; return (n >= 0 ? "+" : "") + n.toLocaleString() + " 🟤"; };
  const fmtTime = (s: number) => {
    if (!s || s <= 0) return "—";
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`; if (h > 0) return `${h}h ${m}m`; return `${m}m`;
  };

  useEffect(() => {
    if (!discord_id) return;
    const id = String(discord_id);

    async function load() {
      // If it looks like a name (not all digits), resolve to discord_id first
      let resolvedId = id;
      if (!/^\d+$/.test(id)) {
        try {
          const r = await fetch(`${API}/api/player/by-name/${encodeURIComponent(id)}`);
          if (r.status === 404) { setNotFound(true); setLoading(false); return; }
          if (r.ok) { const d = await r.json(); resolvedId = String(d.discord_id); }
        } catch { setNotFound(true); setLoading(false); return; }
      }

      const [sr, ir] = await Promise.all([
        fetch(`${API}/api/stats/player/${resolvedId}`),
        fetch(`${API}/api/rankings`),
      ]);

      if (sr.status === 404) { setNotFound(true); setLoading(false); return; }
      if (sr.ok) setStats(await sr.json());
      if (ir.ok) {
        const rankings = await ir.json();
        const p = (rankings.players || []).find((p: any) => String(p.discord_id) === resolvedId);
        if (p) setIngame(p);
      }
      setLoading(false);
    }

    load().catch(() => setLoading(false));
  }, [discord_id]);

  if (loading) return <main className="max-w-[720px] mx-auto px-6 py-16"><p className="text-[#777] font-mono text-sm">loading...</p></main>;
  if (notFound || !stats) return (
    <main className="max-w-[720px] mx-auto px-6 py-16">
      <h1 className="text-2xl tracking-[0.15em] uppercase mb-2">Unknown Survivor</h1>
      <p className="text-[#777] text-[0.85rem]">Zombita has no record of this person.</p>
      <div className="divider" />
      <a href="/leaderboard" className="text-[#4a7c59] font-mono text-sm hover:underline">← back to leaderboard</a>
    </main>
  );

  const rps = stats.rps || {}; const c4 = stats.connect4 || {}; const ww = stats.werewolf || {};
  const hasRps = (rps.wins + rps.losses + rps.draws) > 0;
  const hasC4 = (c4.wins + c4.losses + c4.draws) > 0;
  const hasWw = ww.games_played > 0;

  return (
    <main className="max-w-[720px] mx-auto px-6 py-16">
      <div className="flex items-center gap-6 mb-2">
        <div className="w-16 h-16 rounded-full bg-[#1a1a1a] border border-[#222] flex items-center justify-center text-2xl font-bold text-[#4a7c59]">
          {stats.display_name?.[0]?.toUpperCase() || "?"}
        </div>
        <div>
          <h1 className="text-2xl tracking-[0.1em]">{stats.display_name}</h1>
          {stats.balance !== undefined && (
            <p className="text-[0.85rem] text-[#4a7c59] mt-1 font-mono">{stats.balance.toLocaleString()} 🟤 coins</p>
          )}
        </div>
      </div>

      <div className="divider" />

      {ingame && <>
        <section>
          <h2>⚔️ In-Game — Season 1</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-6">
            <StatBlock value={(ingame.kills||0).toLocaleString()} label="Kills (this life)" />
            <StatBlock value={(ingame.overallKills||0).toLocaleString()} label="All-Time Kills" />
            <StatBlock value={ingame.deaths||0} label="Deaths" />
            <StatBlock value={fmtTime(ingame.currentLife)} label="Current Life" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-6">
            <StatBlock value={fmtTime(ingame.longestLife)} label="Best Life" />
            {ingame.faction && <StatBlock value={ingame.faction} label="Faction" />}
          </div>
        </section>
        <div className="divider" />
      </>}

      {hasWw && <>
        <section>
          <h2>🐺 Werewolf — Season 1</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-6">
            <StatBlock value={ww.games_played} label="Games" />
            <StatBlock value={ww.games_won} label="Wins" />
            <StatBlock value={ww.times_survived} label="Survived" />
            <StatBlock value={pct(ww.games_won, ww.games_played)} label="Win Rate" />
          </div>
        </section>
        <div className="divider" />
      </>}

      {hasRps && <>
        <section>
          <h2>🪨📄✂️ Rock Paper Scissors</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-6">
            <StatBlock value={rps.wins} label="PvP Wins" />
            <StatBlock value={pct(rps.wins, rps.wins+rps.losses+rps.draws)} label="Win Rate" />
            <StatBlock value={`${rps.vs_zombita_wins}W`} label="vs Zombita" />
            <StatBlock value={net(rps.coins_won, rps.coins_lost)} label="Coins Net" />
          </div>
        </section>
        <div className="divider" />
      </>}

      {hasC4 && <>
        <section>
          <h2>🔴🟡 Connect Four</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-6">
            <StatBlock value={c4.wins} label="PvP Wins" />
            <StatBlock value={pct(c4.wins, c4.wins+c4.losses+c4.draws)} label="Win Rate" />
            <StatBlock value={`${c4.vs_zombita_wins}W`} label="vs Zombita" />
            <StatBlock value={net(c4.coins_won, c4.coins_lost)} label="Coins Net" />
          </div>
        </section>
        <div className="divider" />
      </>}

      {!ingame && !hasWw && !hasRps && !hasC4 && <>
        <p className="text-[#777] font-mono text-sm italic">Zombita has no game records for this survivor yet.</p>
        <div className="divider" />
      </>}

      <a href="/leaderboard" className="text-[#4a7c59] font-mono text-sm hover:underline">← back to leaderboard</a>
    </main>
  );
}

function StatBlock({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
