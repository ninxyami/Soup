"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";
import type { User } from "@/lib/types";

type State = "loading" | "guest" | "profile";

export default function ProfilePage() {
  const [state, setState] = useState<State>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [gameStats, setGameStats] = useState<any>(null);

  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then(async (me) => {
        if (!me) { setState("guest"); return; }
        setUser(me);
        // Load extra game stats
        try {
          const sr = await fetch(`${API}/api/stats/player/${me.discord_id}`, { credentials: "include" });
          if (sr.ok) setGameStats(await sr.json());
        } catch {}
        setState("profile");
      })
      .catch(() => setState("guest"));
  }, []);

  const logout = async () => {
    await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
    window.location.href = "/";
  };

  const pct = (wins: number, total: number) => total > 0 ? Math.round((wins / total) * 100) + "%" : "—";
  const net = (won: number, lost: number) => { const n = won - lost; return (n >= 0 ? "+" : "") + n.toLocaleString() + " 🟤"; };

  return (
    <main className="max-w-[720px] mx-auto px-6 py-16">
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
          <div className="flex items-center gap-6 mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={user.avatar_url} alt={user.username} width={64} height={64} className="rounded-full opacity-90" />
            <div>
              <h1 className="text-2xl tracking-[0.1em]">{user.username}</h1>
              {user.player?.identity && (
                <p className="text-[0.85rem] italic text-[#777] mt-1">{user.player.identity}</p>
              )}
            </div>
          </div>

          <div className="divider" />

          {/* Werewolf */}
          {user.player && user.player.games_played > 0 && (
            <section>
              <h2>Werewolf — Season 1</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-6">
                <StatBlock value={user.player.games_played} label="Games" />
                <StatBlock value={user.player.games_won} label="Wins" />
                <StatBlock value={user.player.times_survived} label="Survived" />
                <StatBlock value={pct(user.player.games_won, user.player.games_played)} label="Win Rate" />
              </div>
            </section>
          )}

          {/* Quizarium */}
          {user.quiz && (
            <>
              <div className="divider" />
              <section>
                <h2>Quizarium — Season 1</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-6">
                  <StatBlock value={user.quiz.rank ? `#${user.quiz.rank}` : "—"} label="Rank" />
                  <StatBlock value={user.quiz.total_points} label="Points" />
                  <StatBlock value={user.quiz.correct_answers} label="Correct" />
                  <StatBlock value={user.quiz.games_played} label="Games" />
                </div>
              </section>
            </>
          )}

          {/* RPS */}
          {gameStats?.rps && (gameStats.rps.wins + gameStats.rps.losses + gameStats.rps.draws) > 0 && (
            <>
              <div className="divider" />
              <section>
                <h2>🪨📄✂️ Rock Paper Scissors</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-6">
                  <StatBlock value={gameStats.rps.wins} label="PvP Wins" />
                  <StatBlock value={pct(gameStats.rps.wins, gameStats.rps.wins + gameStats.rps.losses + gameStats.rps.draws)} label="Win Rate" />
                  <StatBlock value={`${gameStats.rps.vs_zombita_wins}W`} label="vs Zombita" />
                  <StatBlock value={net(gameStats.rps.coins_won, gameStats.rps.coins_lost)} label="Coins Net" />
                </div>
              </section>
            </>
          )}

          {/* Connect4 */}
          {gameStats?.connect4 && (gameStats.connect4.wins + gameStats.connect4.losses + gameStats.connect4.draws) > 0 && (
            <>
              <div className="divider" />
              <section>
                <h2>🔴🟡 Connect Four</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-6">
                  <StatBlock value={gameStats.connect4.wins} label="PvP Wins" />
                  <StatBlock value={pct(gameStats.connect4.wins, gameStats.connect4.wins + gameStats.connect4.losses + gameStats.connect4.draws)} label="Win Rate" />
                  <StatBlock value={`${gameStats.connect4.vs_zombita_wins}W`} label="vs Zombita" />
                  <StatBlock value={net(gameStats.connect4.coins_won, gameStats.connect4.coins_lost)} label="Coins Net" />
                </div>
              </section>
            </>
          )}

          <div className="divider" />

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
