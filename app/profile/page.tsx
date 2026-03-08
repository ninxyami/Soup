"use client";
import { useEffect, useState } from "react";
import { API, SEASON_SHORT } from "@/lib/constants";
import type { User } from "@/lib/types";
import { repTier } from "@/lib/utils";

type State = "loading" | "guest" | "profile";

export default function ProfilePage() {
  const [state, setState] = useState<State>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [gameStats, setGameStats] = useState<any>(null);
  const [ingameStats, setIngameStats] = useState<any>(null);
  const [bio, setBio] = useState("");
  const [rep, setRep] = useState<{rep_points:number,archetype:string,zombita_opinion:string}|null>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState("");
  const [bioSaving, setBioSaving] = useState(false);
  const [bioFeedback, setBioFeedback] = useState("");

  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then(async (me) => {
        if (!me) { setState("guest"); return; }
        setUser(me);
        try {
          const [sr, ir, pr] = await Promise.all([
            fetch(`${API}/api/stats/player/${me.discord_id}`, { credentials: "include" }),
            fetch(`${API}/api/rankings`),
            fetch(`${API}/api/players`),
          ]);
          if (sr.ok) {
            const sd = await sr.json();
            setGameStats(sd);
            if (sd.reputation) setRep(sd.reputation);
          }
          if (ir.ok) {
            const rankings = await ir.json();
            // FIX: Match strictly by discord_id only to avoid false username matches
            const p = (rankings.players || []).find((p: any) =>
              String(p.discord_id) === String(me.discord_id)
            );
            if (p) setIngameStats(p);
          }
          if (pr.ok) {
            const pd = await pr.json();
            const me2 = (pd.players || []).find((p: any) => p.discord_id === String(me.discord_id));
            if (me2) { setBio(me2.bio || ""); setBioInput(me2.bio || ""); }
          }
        } catch {}
        setState("profile");
      })
      .catch(() => setState("guest"));
  }, []);

  const logout = async () => {
    await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
    window.location.href = "/";
  };

  const saveBio = async () => {
    setBioSaving(true);
    try {
      const r = await fetch(`${API}/api/player/bio`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: bioInput }),
      });
      if (r.ok) { setBio(bioInput); setEditingBio(false); setBioFeedback("saved."); setTimeout(() => setBioFeedback(""), 2000); }
      else setBioFeedback("failed to save.");
    } catch { setBioFeedback("connection error."); }
    finally { setBioSaving(false); }
  };

  const pct = (wins: number, total: number) => total > 0 ? Math.round((wins / total) * 100) + "%" : "—";
  const net = (won: number, lost: number) => { const n = won - lost; return (n >= 0 ? "+" : "") + n.toLocaleString() + " 🟤"; };
  const fmtTime = (s: number) => {
    if (!s || s <= 0) return "—";
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`; if (h > 0) return `${h}h ${m}m`; return `${m}m`;
  };

  return (
    <main className="max-w-[720px] mx-auto px-4 sm:px-6 py-10 sm:py-16">
      {state === "loading" && <p className="text-[#777] text-[0.85rem]">Checking identity...</p>}

      {state === "guest" && (
        <>
          <h1 className="text-2xl tracking-[0.15em] uppercase mb-2">Who are you?</h1>
          <p className="text-[#777] text-[0.85rem]">Zombita doesn&apos;t know you yet.</p>
          <div className="divider" />
          <a href={`${API}/auth/discord/login`} className="btn-login">Login with Discord</a>
        </>
      )}

      {state === "profile" && user && (
        <>
          <div className="flex items-center gap-4 sm:gap-6 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={user.avatar_url} alt={user.username} width={56} height={56} className="rounded-full opacity-90 flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16" />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl tracking-[0.1em] truncate">{gameStats?.display_name || user.username}</h1>
              <p className="font-mono text-[0.7rem] text-[#444] mt-0.5">@{user.username}</p>
              {rep?.archetype && rep.archetype !== "unknown"
                ? <p className="text-[0.85rem] italic text-[#4a7c59] mt-1 font-mono">&ldquo;{rep.archetype.replace(/_/g, " ")}&rdquo;</p>
                : user.player?.identity && <p className="text-[0.85rem] italic text-[#4a7c59] mt-1 font-mono">&ldquo;{user.player.identity}&rdquo;</p>
              }
              {gameStats?.balance !== undefined && (
                <p className="text-[0.85rem] text-[#555] mt-1 font-mono">{gameStats.balance.toLocaleString()} 🟤</p>
              )}
            </div>
          </div>

          {/* Bio */}
          <div className="mt-3 sm:mt-4">
            {!editingBio ? (
              <div className="flex items-start gap-3">
                <p className="text-[0.83rem] text-[#777] leading-relaxed flex-1 italic">
                  {bio || "no bio yet. tell the survivors who you are."}
                </p>
                <button onClick={() => setEditingBio(true)}
                  className="text-[0.65rem] text-[#444] hover:text-[#4a7c59] font-mono uppercase tracking-wider transition-colors cursor-pointer bg-transparent border-none flex-shrink-0">
                  {bio ? "edit" : "+ add bio"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <textarea value={bioInput} onChange={e => setBioInput(e.target.value.slice(0, 280))}
                  placeholder="tell the survivors who you are... (280 chars)"
                  rows={3}
                  className="bg-[#0a0a0a] border border-[#222] text-[#e6e6e6] text-[0.83rem] px-3 py-2 font-mono placeholder:text-[#333] outline-none focus:border-[#4a7c59] transition-colors resize-none w-full"
                  style={{ fontFamily: "inherit" }}
                />
                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={saveBio} disabled={bioSaving}
                    className="text-[0.7rem] px-3 py-1.5 border border-[#4a7c59] text-[#4a7c59] font-mono uppercase tracking-wider hover:bg-[#4a7c59] hover:text-black disabled:opacity-40 transition-all cursor-pointer bg-transparent">
                    {bioSaving ? "saving..." : "save"}
                  </button>
                  <button onClick={() => { setEditingBio(false); setBioInput(bio); }}
                    className="text-[0.7rem] text-[#444] hover:text-[#e6e6e6] font-mono uppercase tracking-wider transition-colors cursor-pointer bg-transparent border-none">
                    cancel
                  </button>
                  <span className="text-[0.65rem] text-[#333] font-mono ml-auto">{bioInput.length}/280</span>
                  {bioFeedback && <span className="text-[0.65rem] text-[#4a7c59] font-mono">{bioFeedback}</span>}
                </div>
              </div>
            )}
          </div>

          <div className="divider" />

          {/* Zombita's Take */}
          {rep && (rep.rep_points > 0 || rep.zombita_opinion) && (() => {
            const tier = repTier(rep.rep_points);
            return (
              <div className="mb-6">
                <p className="text-[0.65rem] font-mono uppercase tracking-widest text-[#444] mb-3">📋 Zombita&apos;s Take</p>
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-4 sm:gap-5 flex-wrap">
                    <div>
                      <p className="font-mono text-[0.6rem] text-[#444] uppercase tracking-widest">Reputation</p>
                      <p className="font-mono text-[1rem] font-semibold text-[#e6e6e6]">{rep.rep_points.toLocaleString()} pts</p>
                    </div>
                    <div>
                      <p className="font-mono text-[0.6rem] text-[#444] uppercase tracking-widest">Standing</p>
                      <p className="font-mono text-[0.8rem]" style={{ color: tier.color }}>{tier.label}</p>
                    </div>
                    {rep.archetype && rep.archetype !== "unknown" && (
                      <div>
                        <p className="font-mono text-[0.6rem] text-[#444] uppercase tracking-widest">Archetype</p>
                        <p className="font-mono text-[0.8rem] text-[#777] italic">{rep.archetype.replace(/_/g, " ")}</p>
                      </div>
                    )}
                  </div>
                  {rep.zombita_opinion
                    ? <p className="font-mono text-[0.75rem] text-[#666] italic border-t border-[#1a1a1a] pt-3 leading-relaxed">&ldquo;{rep.zombita_opinion}&rdquo;</p>
                    : <p className="font-mono text-[0.72rem] text-[#333] italic">Zombita hasn&apos;t formed a full opinion yet.</p>
                  }
                </div>
              </div>
            );
          })()}

          <div className="divider" />

          {/* In-Game */}
          {ingameStats && <>
            <section>
              <h2>⚔️ In-Game — {SEASON_SHORT}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 mt-4 sm:mt-6">
                <StatBlock value={(ingameStats.kills||0).toLocaleString()} label="Kills (this life)" />
                <StatBlock value={(ingameStats.overallKills||0).toLocaleString()} label="All-Time Kills" />
                <StatBlock value={ingameStats.deaths||0} label="Deaths" />
                <StatBlock value={fmtTime(ingameStats.currentLife)} label="Current Life" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 mt-3 sm:mt-6">
                <StatBlock value={fmtTime(ingameStats.longestLife)} label="Best Life" />
                {ingameStats.faction && <StatBlock value={ingameStats.faction} label="Faction" />}
              </div>
            </section>
            <div className="divider" />
          </>}

          {/* Werewolf */}
          {user.player && user.player.games_played > 0 && <>
            <section>
              <h2>🐺 Werewolf — {SEASON_SHORT}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 mt-4 sm:mt-6">
                <StatBlock value={user.player.games_played} label="Games" />
                <StatBlock value={user.player.games_won} label="Wins" />
                <StatBlock value={user.player.times_survived} label="Survived" />
                <StatBlock value={pct(user.player.games_won, user.player.games_played)} label="Win Rate" />
              </div>
            </section>
            <div className="divider" />
          </>}

          {/* Quizarium */}
          {user.quiz && <>
            <section>
              <h2>🧠 Quizarium — {SEASON_SHORT}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 mt-4 sm:mt-6">
                <StatBlock value={user.quiz.rank ? `#${user.quiz.rank}` : "—"} label="Rank" />
                <StatBlock value={user.quiz.total_points} label="Points" />
                <StatBlock value={user.quiz.correct_answers} label="Correct" />
                <StatBlock value={user.quiz.games_played} label="Games" />
              </div>
            </section>
            <div className="divider" />
          </>}

          {/* RPS */}
          {gameStats?.rps && (gameStats.rps.wins + gameStats.rps.losses + gameStats.rps.draws) > 0 && <>
            <section>
              <h2>🪨📄✂️ Rock Paper Scissors</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 mt-4 sm:mt-6">
                <StatBlock value={gameStats.rps.wins} label="PvP Wins" />
                <StatBlock value={pct(gameStats.rps.wins, gameStats.rps.wins+gameStats.rps.losses+gameStats.rps.draws)} label="Win Rate" />
                <StatBlock value={`${gameStats.rps.vs_zombita_wins}W`} label="vs Zombita" />
                <StatBlock value={net(gameStats.rps.coins_won, gameStats.rps.coins_lost)} label="Coins Net" />
              </div>
            </section>
            <div className="divider" />
          </>}

          {/* Connect4 */}
          {gameStats?.connect4 && (gameStats.connect4.wins + gameStats.connect4.losses + gameStats.connect4.draws) > 0 && <>
            <section>
              <h2>🔴🟡 Connect Four</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 mt-4 sm:mt-6">
                <StatBlock value={gameStats.connect4.wins} label="PvP Wins" />
                <StatBlock value={pct(gameStats.connect4.wins, gameStats.connect4.wins+gameStats.connect4.losses+gameStats.connect4.draws)} label="Win Rate" />
                <StatBlock value={`${gameStats.connect4.vs_zombita_wins}W`} label="vs Zombita" />
                <StatBlock value={net(gameStats.connect4.coins_won, gameStats.connect4.coins_lost)} label="Coins Net" />
              </div>
            </section>
            <div className="divider" />
          </>}

          <section className="flex items-center gap-4 flex-wrap">
            <a href="/whitelist" className="btn-submit no-underline" style={{ display: "inline-block" }}>Whitelist</a>
            <button onClick={logout} className="btn-logout">Logout</button>
          </section>
        </>
      )}
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
