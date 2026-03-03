"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API } from "@/lib/constants";

interface PlayerStats {
  discord_id: number;
  display_name: string;
  bio?: string;
  first_seen: number;
  last_seen: number;
  message_count: number;
  balance: number;
  werewolf?: {
    games_played: number;
    games_won: number;
    win_rate: number;
    times_survived: number;
    times_lynched: number;
    times_wolf: number;
    streak: number;
  };
  rps?: {
    wins: number;
    losses: number;
    draws: number;
    win_rate: number;
    coins_won: number;
    coins_lost: number;
  };
  connect4?: {
    wins: number;
    losses: number;
    draws: number;
    win_rate: number;
    coins_won: number;
    coins_lost: number;
  };
  ingame?: {
    kills: number;
    deaths: number;
    longestLife: number;
    overallKills: number;
    faction?: string;
  };
  identity?: string;
  updatedAt?: number;
}

function formatDuration(secs: number): string {
  if (!secs) return "—";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function PlayerPage() {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) {
      setError("No player specified.");
      setLoading(false);
      return;
    }
    setPlayerId(id);

    // If id is numeric, fetch by discord_id directly
    // Otherwise fetch by name lookup first
    const isNumeric = /^\d+$/.test(id);

    const fetchStats = async (discordId: string) => {
      const res = await fetch(`${API}/api/stats/player/${discordId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Player not found");
      return res.json();
    };

    if (isNumeric) {
      fetchStats(id)
        .then(setStats)
        .catch(() => setError("Player not found."))
        .finally(() => setLoading(false));
    } else {
      // Name-based lookup
      fetch(`${API}/api/player/by-name/${encodeURIComponent(id)}`, {
        credentials: "include",
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => fetchStats(String(d.discord_id)))
        .then(setStats)
        .catch(() => setError("Player not found."))
        .finally(() => setLoading(false));
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-[#555] text-sm tracking-widest">LOADING SURVIVOR DATA...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6">
        <div className="text-6xl">💀</div>
        <h1 className="font-mono text-2xl tracking-widest text-[#e05555]">SURVIVOR NOT FOUND</h1>
        <p className="font-mono text-sm text-[#555]">{error || "This player doesn't exist."}</p>
        <Link href="/players" className="font-mono text-xs text-[#9a9a9a] border border-[#2a2a2a] px-4 py-2 no-underline hover:border-[#4a7c59] hover:text-[#4a7c59] transition-all">
          ← All Survivors
        </Link>
      </div>
    );
  }

  const joinDate = new Date(stats.first_seen * 1000).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="max-w-[860px] mx-auto px-6 py-12">
      {/* Back */}
      <Link href="/players" className="font-mono text-[0.72rem] text-[#555] no-underline hover:text-[#e6e6e6] tracking-widest transition-colors">
        ← SURVIVORS
      </Link>

      {/* Header */}
      <div className="mt-6 mb-10 flex items-start gap-6">
        <div className="w-16 h-16 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-2xl flex-shrink-0">
          🧟
        </div>
        <div className="flex-1">
          <h1 className="text-2xl tracking-[0.15em] uppercase">{stats.display_name}</h1>
          {stats.identity && (
            <p className="font-mono text-[0.75rem] text-[#4a7c59] mt-1 tracking-wide italic">
              "{stats.identity}"
            </p>
          )}
          {stats.bio && (
            <p className="text-[0.88rem] text-[#9a9a9a] mt-2 max-w-[500px]">{stats.bio}</p>
          )}
          <div className="flex gap-4 mt-3 flex-wrap">
            {stats.ingame?.faction && (
              <span className="font-mono text-[0.7rem] text-[#c8a84b] border border-[rgba(200,168,75,0.3)] px-2 py-0.5">
                [{stats.ingame.faction}]
              </span>
            )}
            <span className="font-mono text-[0.7rem] text-[#555]">Joined {joinDate}</span>
            <span className="font-mono text-[0.7rem] text-[#555]">Last seen {timeAgo(stats.last_seen)}</span>
          </div>
        </div>
        <div className="font-mono text-right">
          <div className="text-[1.4rem] text-[#c8a84b]">{stats.balance} 🟤</div>
          <div className="text-[0.65rem] text-[#555] tracking-widest mt-0.5">WALLET</div>
        </div>
      </div>

      <div className="h-px bg-[#1a1a1a] mb-8" />

      {/* In-Game Stats */}
      {stats.ingame && (
        <section className="mb-8">
          <h2 className="font-mono text-[0.72rem] uppercase tracking-[0.15em] text-[#555] mb-4">In-Game</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "KILLS (LIFE)", value: stats.ingame.kills?.toLocaleString() ?? "0" },
              { label: "ALL-TIME KILLS", value: stats.ingame.overallKills?.toLocaleString() ?? "0" },
              { label: "DEATHS", value: stats.ingame.deaths?.toLocaleString() ?? "0" },
              { label: "BEST LIFE", value: formatDuration(stats.ingame.longestLife) },
            ].map((s) => (
              <div key={s.label} className="bg-[#0f1318] border border-[#1e2530] p-4">
                <div className="text-[1.4rem] font-semibold text-[#e6e6e6]">{s.value}</div>
                <div className="font-mono text-[0.65rem] text-[#555] tracking-widest mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Werewolf */}
      {stats.werewolf && stats.werewolf.games_played > 0 && (
        <section className="mb-8">
          <h2 className="font-mono text-[0.72rem] uppercase tracking-[0.15em] text-[#555] mb-4">🐺 Werewolf</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "GAMES", value: stats.werewolf.games_played },
              { label: "WINS", value: stats.werewolf.games_won },
              { label: "WIN RATE", value: `${stats.werewolf.win_rate}%` },
              { label: "SURVIVED", value: stats.werewolf.times_survived },
            ].map((s) => (
              <div key={s.label} className="bg-[#0f1318] border border-[#1e2530] p-4">
                <div className="text-[1.4rem] font-semibold text-[#e6e6e6]">{s.value}</div>
                <div className="font-mono text-[0.65rem] text-[#555] tracking-widest mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* RPS */}
      {stats.rps && (stats.rps.wins + stats.rps.losses + stats.rps.draws) > 0 && (
        <section className="mb-8">
          <h2 className="font-mono text-[0.72rem] uppercase tracking-[0.15em] text-[#555] mb-4">✊ Rock Paper Scissors</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "WINS", value: stats.rps.wins },
              { label: "LOSSES", value: stats.rps.losses },
              { label: "WIN RATE", value: `${stats.rps.win_rate}%` },
              { label: "COINS WON", value: `${stats.rps.coins_won} 🟤` },
            ].map((s) => (
              <div key={s.label} className="bg-[#0f1318] border border-[#1e2530] p-4">
                <div className="text-[1.4rem] font-semibold text-[#e6e6e6]">{s.value}</div>
                <div className="font-mono text-[0.65rem] text-[#555] tracking-widest mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Connect4 */}
      {stats.connect4 && (stats.connect4.wins + stats.connect4.losses + stats.connect4.draws) > 0 && (
        <section className="mb-8">
          <h2 className="font-mono text-[0.72rem] uppercase tracking-[0.15em] text-[#555] mb-4">🔴 Connect 4</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "WINS", value: stats.connect4.wins },
              { label: "LOSSES", value: stats.connect4.losses },
              { label: "WIN RATE", value: `${stats.connect4.win_rate}%` },
              { label: "COINS WON", value: `${stats.connect4.coins_won} 🟤` },
            ].map((s) => (
              <div key={s.label} className="bg-[#0f1318] border border-[#1e2530] p-4">
                <div className="text-[1.4rem] font-semibold text-[#e6e6e6]">{s.value}</div>
                <div className="font-mono text-[0.65rem] text-[#555] tracking-widest mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Activity */}
      <section>
        <h2 className="font-mono text-[0.72rem] uppercase tracking-[0.15em] text-[#555] mb-4">Activity</h2>
        <div className="bg-[#0f1318] border border-[#1e2530] p-4 font-mono text-sm text-[#9a9a9a]">
          {stats.message_count.toLocaleString()} messages sent in Discord
        </div>
      </section>
    </div>
  );
}
