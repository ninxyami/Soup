"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";

interface Player {
  discord_id: string;
  display_name: string;
  username: string;
  bio: string;
  identity: string;
  rep_points?: number;
  archetype?: string;
  first_seen: number;
  last_seen: number;
  games_played: number;
  games_won: number;
  message_count: number;
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [filtered, setFiltered] = useState<Player[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "veterans">("all");

  useEffect(() => {
    fetch(`${API}/api/players`)
      .then(r => r.ok ? r.json() : { players: [] })
      .then(d => {
        const real = (d.players || []).filter((p: Player) => p.discord_id !== "0");
        setPlayers(real);
        setFiltered(real);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    let list = [...players];
    if (filter === "active") list = list.filter(p => p.games_played > 0);
    if (filter === "veterans") list = list.filter(p => p.games_played >= 3);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.display_name.toLowerCase().includes(q) ||
        p.username.toLowerCase().includes(q) ||
        p.identity.toLowerCase().includes(q) ||
        p.bio.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [search, filter, players]);

  return (
    <main className="max-w-[900px] mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <section>
        <h1 className="text-xl sm:text-2xl tracking-[0.15em] uppercase mb-2">Survivors</h1>
        <p className="text-[#777] text-[0.85rem]">Everyone Zombita has laid eyes on. {players.length} known.</p>
      </section>

      <div className="divider" />

      {/* Controls */}
      <div className="flex flex-col gap-3 mb-6 sm:mb-8">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="search by name, identity, or bio..."
          className="w-full bg-[#0a0a0a] border border-[#1a1a1a] text-[#e6e6e6] text-[0.83rem] px-3 py-2.5 font-mono placeholder:text-[#333] outline-none focus:border-[#4a7c59] transition-colors"
        />
        <div className="flex gap-2">
          {(["all", "active", "veterans"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-1 sm:flex-none px-3 py-2 text-[0.68rem] tracking-[0.08em] uppercase border font-[inherit] cursor-pointer transition-all ${filter === f ? "border-[#4a7c59] text-[#4a7c59]" : "border-[#1a1a1a] text-[#555] hover:border-[#333] hover:text-[#e6e6e6]"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-[#555] font-mono text-sm">loading survivors...</p>
      ) : filtered.length === 0 ? (
        <p className="text-[#555] font-mono text-sm italic">no survivors found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          {filtered.map(p => (
            <a key={p.discord_id} href={`/player?id=${encodeURIComponent(p.display_name)}`}
              className="block bg-[#0a0a0a] border border-[#1a1a1a] p-3 sm:p-4 hover:border-[#4a7c59] transition-all no-underline group">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#111] border border-[#222] flex items-center justify-center text-sm font-bold text-[#4a7c59] flex-shrink-0 group-hover:border-[#4a7c59] transition-colors">
                  {p.display_name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[#e6e6e6] text-[0.88rem] tracking-wide truncate max-w-[160px]">{p.display_name}</span>
                    {p.games_played >= 3 && (
                      <span className="text-[0.58rem] text-[#4a7c59] border border-[#4a7c59] px-1 tracking-widest uppercase flex-shrink-0">veteran</span>
                    )}
                  </div>
                  {p.username && (
                    <p className="font-mono text-[0.65rem] text-[#444] mt-0.5">@{p.username}</p>
                  )}
                  {(p.rep_points || 0) > 0 && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[0.62rem] text-[#555]">{p.rep_points} rep</span>
                      {p.archetype && p.archetype !== "unknown" && (
                        <span className="font-mono text-[0.62rem] text-[#444] italic hidden sm:inline">{p.archetype.replace(/_/g, " ")}</span>
                      )}
                    </div>
                  )}
                  <p className="text-[0.72rem] text-[#4a7c59] font-mono italic mt-0.5 truncate">
                    &ldquo;{p.identity}&rdquo;
                  </p>
                  {p.bio && (
                    <p className="text-[0.75rem] text-[#777] mt-1 leading-snug line-clamp-2">{p.bio}</p>
                  )}
                  <div className="flex gap-3 mt-1.5">
                    {p.games_played > 0 && (
                      <span className="text-[0.62rem] text-[#444] font-mono">{p.games_played}g · {p.games_won}W</span>
                    )}
                    <span className="text-[0.62rem] text-[#333] font-mono">seen {timeAgo(p.last_seen)}</span>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
