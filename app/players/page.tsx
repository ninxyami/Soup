"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";

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

function timeAgo(ts: number) {
  if (!ts) return "never";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
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
    <main className="max-w-[900px] mx-auto px-6 py-16">
      <section>
        <h1 className="text-2xl tracking-[0.15em] uppercase mb-2">Survivors</h1>
        <p className="text-[#777] text-[0.85rem]">Everyone Zombita has laid eyes on. {players.length} known survivors.</p>
      </section>

      <div className="divider" />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="search by name, identity, or bio..."
          className="flex-1 bg-[#0a0a0a] border border-[#1a1a1a] text-[#e6e6e6] text-[0.83rem] px-3 py-2 font-mono placeholder:text-[#333] outline-none focus:border-[#4a7c59] transition-colors"
        />
        <div className="flex gap-2">
          {(["all", "active", "veterans"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 text-[0.7rem] tracking-[0.1em] uppercase border font-[inherit] cursor-pointer transition-all ${filter === f ? "border-[#4a7c59] text-[#4a7c59]" : "border-[#1a1a1a] text-[#555] hover:border-[#333] hover:text-[#e6e6e6]"}`}>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(p => (
            <a key={p.discord_id} href={`/player?id=${encodeURIComponent(p.display_name)}`}
              className="block bg-[#0a0a0a] border border-[#1a1a1a] p-4 hover:border-[#4a7c59] transition-all no-underline group">

              <div className="flex items-start gap-3">
                {/* Avatar placeholder */}
                <div className="w-10 h-10 rounded-full bg-[#111] border border-[#222] flex items-center justify-center text-sm font-bold text-[#4a7c59] flex-shrink-0 group-hover:border-[#4a7c59] transition-colors">
                  {p.display_name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[#e6e6e6] text-[0.9rem] tracking-wide">{p.display_name}</span>
                    {p.games_played >= 3 && (
                      <span className="text-[0.6rem] text-[#4a7c59] border border-[#4a7c59] px-1 tracking-widest uppercase">veteran</span>
                    )}
                  </div>
                  {p.username && (
                    <p className="font-mono text-[0.65rem] text-[#444] mt-0.5">@{p.username}</p>
                  )}
                  {/* Rep + archetype */}
                  {(p.rep_points || 0) > 0 && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[0.62rem] text-[#555]">{p.rep_points} rep</span>
                      {p.archetype && p.archetype !== "unknown" && (
                        <span className="font-mono text-[0.62rem] text-[#444] italic">{p.archetype.replace(/_/g, " ")}</span>
                      )}
                    </div>
                  )}
                  {/* Zombita's judgment */}
                  <p className="text-[0.72rem] text-[#4a7c59] font-mono italic mt-0.5">
                    "{p.identity}"
                  </p>
                  {/* Player bio */}
                  {p.bio && (
                    <p className="text-[0.78rem] text-[#777] mt-1 leading-relaxed line-clamp-2">{p.bio}</p>
                  )}
                  {/* Stats row */}
                  <div className="flex gap-4 mt-2">
                    {p.games_played > 0 && (
                      <span className="text-[0.65rem] text-[#444] font-mono">{p.games_played} games · {p.games_won}W</span>
                    )}
                    <span className="text-[0.65rem] text-[#333] font-mono">seen {timeAgo(p.last_seen)}</span>
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
