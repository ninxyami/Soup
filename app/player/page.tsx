"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API } from "@/lib/constants";
import { repTier, timeAgo, formatDuration } from "@/lib/utils";

interface PlayerStats {
  discord_id: number;
  display_name: string;
  username?: string;
  ingame_name?: string;
  bio?: string;
  first_seen: number;
  last_seen: number;
  message_count: number;
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
  reputation?: {
    rep_points: number;
    archetype: string;
    zombita_opinion: string;
  };
}

const NOT_FOUND_LINES = [
  "never showed up. classic.",
  "either dead or too scared to make an account.",
  "doesn't exist. or maybe they do and they're hiding. wouldn't surprise me.",
  "no record. either very new or very gone.",
  "i looked. nothing. move on.",
  "the apocalypse took them before the whitelist did.",
  "ghost. and not the useful kind.",
  "checked twice. still nobody.",
];

export default function PlayerPage() {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerName, setPlayerName] = useState("");
  const [notFoundLine] = useState(
    () => NOT_FOUND_LINES[Math.floor(Math.random() * NOT_FOUND_LINES.length)]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) { setLoading(false); return; }
    setPlayerName(id);

    const isNumeric = /^\d+$/.test(id);

    const fetchStats = async (discordId: string) => {
      const res = await fetch(`${API}/api/stats/player/${discordId}`, { credentials: "include" });
      if (!res.ok) throw new Error("not found");
      const data = await res.json();
      if (data.ingame_name) {
        try {
          const rr = await fetch(`${API}/api/rankings`);
          if (rr.ok) {
            const rankings = await rr.json();
            const ig = (rankings.players || []).find((p: any) => p.name?.toLowerCase() === data.ingame_name?.toLowerCase());
            if (ig) data.ingame = { kills: ig.kills||0, deaths: ig.deaths||0, longestLife: ig.longestLife||0, currentLife: ig.currentLife||0, overallKills: ig.overallKills||0, faction: ig.faction||null };
          }
        } catch {}
      }
      return data;
    };

    if (isNumeric) {
      fetchStats(id).then(setStats).catch(() => {}).finally(() => setLoading(false));
    } else {
      fetch(`${API}/api/player/by-name/${encodeURIComponent(id)}`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => fetchStats(String(d.discord_id)))
        .then(setStats)
        .catch(() => {})
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

  if (!stats) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="text-6xl">🍲</div>
        <div>
          <p className="font-mono text-[0.7rem] text-[#555] tracking-widest uppercase mb-3">
            Zombita on {playerName || "this survivor"}
          </p>
          <p className="font-mono text-lg text-[#9a9a9a] italic max-w-[420px]">
            &ldquo;{notFoundLine}&rdquo;
          </p>
        </div>
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
    <div className="max-w-[860px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <Link href="/players" className="font-mono text-[0.72rem] text-[#555] no-underline hover:text-[#e6e6e6] tracking-widest transition-colors">
        ← SURVIVORS
      </Link>

      {/* Header */}
      <div className="mt-6 mb-8 flex items-start gap-4">
        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-xl sm:text-2xl flex-shrink-0">
          🧟
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl tracking-[0.15em] uppercase truncate">{stats.display_name}</h1>
          {stats.username && (
            <p className="font-mono text-[0.72rem] text-[#444] mt-0.5">@{stats.username}</p>
          )}
          {(stats.reputation?.archetype && stats.reputation.archetype !== "unknown"
            ? stats.reputation.archetype.replace(/_/g, " ")
            : stats.identity) && (
            <p className="font-mono text-[0.75rem] text-[#4a7c59] mt-1 tracking-wide italic">
              &ldquo;{stats.reputation?.archetype && stats.reputation.archetype !== "unknown"
                ? stats.reputation.archetype.replace(/_/g, " ")
                : stats.identity}&rdquo;
            </p>
          )}
          {stats.bio && (
            <p className="text-[0.88rem] text-[#9a9a9a] mt-2">{stats.bio}</p>
          )}
          <div className="flex gap-3 mt-3 flex-wrap">
            {stats.ingame?.faction && (
              <span className="font-mono text-[0.7rem] text-[#c8a84b] border border-[rgba(200,168,75,0.3)] px-2 py-0.5">
                [{stats.ingame.faction}]
              </span>
            )}
            {stats.ingame_name && (
              <span className="font-mono text-[0.7rem] text-[#555]">In-game: {stats.ingame_name}</span>
            )}
            <span className="font-mono text-[0.7rem] text-[#555]">Joined {joinDate}</span>
            <span className="font-mono text-[0.7rem] text-[#555]">Seen {timeAgo(stats.last_seen)}</span>
          </div>
        </div>
      </div>

      <div className="h-px bg-[#1a1a1a] mb-6" />

      {/* In-Game */}
      {stats.ingame && (
        <section className="mb-6 sm:mb-8">
          <h2 className="font-mono text-[0.72rem] uppercase tracking-[0.15em] text-[#555] mb-3">In-Game</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {[
              { label: "KILLS (LIFE)", value: stats.ingame.kills?.toLocaleString() ?? "0" },
              { label: "ALL-TIME", value: stats.ingame.overallKills?.toLocaleString() ?? "0" },
              { label: "DEATHS", value: stats.ingame.deaths?.toLocaleString() ?? "0" },
              { label: "BEST LIFE", value: formatDuration(stats.ingame.longestLife) },
            ].map((s) => (
              <div key={s.label} className="bg-[#0f1318] border border-[#1e2530] p-3 sm:p-4">
                <div className="text-[1.2rem] sm:text-[1.4rem] font-semibold text-[#e6e6e6]">{s.value}</div>
                <div className="font-mono text-[0.6rem] sm:text-[0.65rem] text-[#555] tracking-widest mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Werewolf */}
      {stats.werewolf && stats.werewolf.games_played > 0 && (
        <section className="mb-6 sm:mb-8">
          <h2 className="font-mono text-[0.72rem] uppercase tracking-[0.15em] text-[#555] mb-3">🐺 Werewolf</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {[
              { label: "GAMES", value: stats.werewolf.games_played },
              { label: "WINS", value: stats.werewolf.games_won },
              { label: "WIN RATE", value: `${stats.werewolf.win_rate}%` },
              { label: "SURVIVED", value: stats.werewolf.times_survived },
              { label: "TIMES WOLF", value: stats.werewolf.times_wolf },
              { label: "LYNCHED", value: stats.werewolf.times_lynched },
              { label: "STREAK", value: stats.werewolf.streak },
            ].map((s) => (
              <div key={s.label} className="bg-[#0f1318] border border-[#1e2530] p-3 sm:p-4">
                <div className="text-[1.2rem] sm:text-[1.4rem] font-semibold text-[#e6e6e6]">{s.value}</div>
                <div className="font-mono text-[0.6rem] sm:text-[0.65rem] text-[#555] tracking-widest mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* RPS */}
      {stats.rps && (stats.rps.wins + stats.rps.losses + stats.rps.draws) > 0 && (
        <section className="mb-6 sm:mb-8">
          <h2 className="font-mono text-[0.72rem] uppercase tracking-[0.15em] text-[#555] mb-3">✊ Rock Paper Scissors</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {[
              { label: "WINS", value: stats.rps.wins },
              { label: "LOSSES", value: stats.rps.losses },
              { label: "WIN RATE", value: `${stats.rps.win_rate}%` },
              { label: "COINS WON", value: `${stats.rps.coins_won} 🟤` },
            ].map((s) => (
              <div key={s.label} className="bg-[#0f1318] border border-[#1e2530] p-3 sm:p-4">
                <div className="text-[1.2rem] sm:text-[1.4rem] font-semibold text-[#e6e6e6]">{s.value}</div>
                <div className="font-mono text-[0.6rem] sm:text-[0.65rem] text-[#555] tracking-widest mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Connect4 */}
      {stats.connect4 && (stats.connect4.wins + stats.connect4.losses + stats.connect4.draws) > 0 && (
        <section className="mb-6 sm:mb-8">
          <h2 className="font-mono text-[0.72rem] uppercase tracking-[0.15em] text-[#555] mb-3">🔴 Connect 4</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {[
              { label: "WINS", value: stats.connect4.wins },
              { label: "LOSSES", value: stats.connect4.losses },
              { label: "WIN RATE", value: `${stats.connect4.win_rate}%` },
              { label: "COINS WON", value: `${stats.connect4.coins_won} 🟤` },
            ].map((s) => (
              <div key={s.label} className="bg-[#0f1318] border border-[#1e2530] p-3 sm:p-4">
                <div className="text-[1.2rem] sm:text-[1.4rem] font-semibold text-[#e6e6e6]">{s.value}</div>
                <div className="font-mono text-[0.6rem] sm:text-[0.65rem] text-[#555] tracking-widest mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Zombita's Take */}
      {stats.reputation && (stats.reputation.rep_points > 0 || stats.reputation.zombita_opinion) && (
        <section className="mb-6 sm:mb-8">
          <h2 className="font-mono text-[0.72rem] uppercase tracking-[0.15em] text-[#555] mb-3">📋 Zombita&apos;s Take</h2>
          <div className="bg-[#0f1318] border border-[#1e2530] p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex items-center gap-4 flex-wrap">
              {(() => {
                const tier = repTier(stats.reputation!.rep_points);
                return (
                  <>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-[0.65rem] text-[#444] uppercase tracking-widest">Reputation</span>
                      <span className="font-mono text-[1.1rem] font-semibold text-[#e6e6e6]">{stats.reputation!.rep_points.toLocaleString()} pts</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-[0.65rem] text-[#444] uppercase tracking-widest">Standing</span>
                      <span className="font-mono text-[0.85rem]" style={{ color: tier.color }}>{tier.label}</span>
                    </div>
                    {stats.reputation!.archetype && stats.reputation!.archetype !== "unknown" && (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-[0.65rem] text-[#444] uppercase tracking-widest">Archetype</span>
                        <span className="font-mono text-[0.85rem] text-[#888] italic">{stats.reputation!.archetype.replace(/_/g, " ")}</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            {stats.reputation.zombita_opinion && (
              <div className="border-t border-[#1a1a1a] pt-3">
                <p className="font-mono text-[0.65rem] text-[#444] uppercase tracking-widest mb-1">Opinion</p>
                <p className="font-mono text-[0.8rem] text-[#777] italic leading-relaxed">
                  &ldquo;{stats.reputation.zombita_opinion}&rdquo;
                </p>
              </div>
            )}
            {!stats.reputation.zombita_opinion && (
              <p className="font-mono text-[0.72rem] text-[#333] italic">
                Zombita hasn&apos;t formed a full opinion yet.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Activity */}
      <section>
        <h2 className="font-mono text-[0.72rem] uppercase tracking-[0.15em] text-[#555] mb-3">Activity</h2>
        <div className="bg-[#0f1318] border border-[#1e2530] p-4 font-mono text-sm text-[#9a9a9a]">
          {stats.message_count.toLocaleString()} messages sent in Discord
        </div>
      </section>
    </div>
  );
}
