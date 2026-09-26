"use client";
// @ts-nocheck
import { useState, useEffect } from "react";
import { fetchApi, fmt, Title, TW, Empty, Load } from "./shared";

export default function GamesTab({ toast }) {
  const [rpsB,  setRpsB]  = useState([]);
  const [c4B,   setC4B]   = useState([]);
  const [cahB,  setCahB]  = useState([]);
  const [cahH,  setCahH]  = useState([]);
  const [tab,   setTab]   = useState("rps");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [r, c, cah, hist] = await Promise.all([
          fetchApi("/api/stats/rps").catch(() => ({ leaderboard: [] })),
          fetchApi("/api/stats/connect4").catch(() => ({ leaderboard: [] })),
          fetchApi("/api/cah/leaderboard").catch(() => ({ leaderboard: [] })),
          fetchApi("/api/cah/history").catch(() => ({ history: [] })),
        ]);
        setRpsB(r.leaderboard   || []);
        setC4B(c.leaderboard    || []);
        setCahB(cah.leaderboard || []);
        setCahH(hist.history    || []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const board = tab === "rps" ? rpsB : tab === "c4" ? c4B : cahB;
  const medalColor = (i) => i === 0 ? "#c8a84b" : i === 1 ? "#9ca3af" : i === 2 ? "#c47a4a" : "var(--textdim)";

  function timeAgo(ts) {
    if (!ts) return "—";
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  return (<>
    <Title t="GAMES" s="rps · connect 4 · cards against humanity" />
    <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
      <button className={`ap-ft ${tab === "rps" ? "act" : ""}`} onClick={() => setTab("rps")}>🪨 Rock Paper Scissors</button>
      <button className={`ap-ft ${tab === "c4"  ? "act" : ""}`} onClick={() => setTab("c4")}>🔴 Connect 4</button>
      <button className={`ap-ft ${tab === "cah" ? "act" : ""}`} onClick={() => setTab("cah")}>🃏 Cards Against Humanity</button>
    </div>

    {loading ? <Load /> : <>

      {(tab === "rps" || tab === "c4") && (
        <TW title={tab === "rps" ? "RPS LEADERBOARD" : "CONNECT 4 LEADERBOARD"}>
          <table className="ap-t">
            <thead>
              <tr>
                <th>#</th><th>Player</th><th>Wins</th><th>Losses</th>
                <th>Draws</th><th>Win Rate</th><th>Earned</th><th>Lost</th><th>vs Zombita</th>
              </tr>
            </thead>
            <tbody>
              {board.length === 0
                ? <tr><td colSpan={9}><Empty text="no game data yet" /></td></tr>
                : board.map((p, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: "var(--display)", fontSize: 20, color: medalColor(i) }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </td>
                    <td style={{ fontWeight: 500 }}>{p.display_name || p.name}</td>
                    <td style={{ fontFamily: "var(--mono)", color: "var(--green)" }}>{p.wins}</td>
                    <td style={{ fontFamily: "var(--mono)", color: "var(--red)" }}>{p.losses}</td>
                    <td style={{ fontFamily: "var(--mono)", color: "var(--textdim)" }}>{p.draws}</td>
                    <td style={{ fontFamily: "var(--mono)", color: p.win_rate > 50 ? "var(--green)" : "var(--textdim)" }}>
                      {p.win_rate ?? Math.round((p.wins / (p.wins + p.losses + p.draws || 1)) * 100)}%
                    </td>
                    <td style={{ fontFamily: "var(--mono)", color: "var(--green)" }}>+{fmt(p.coins_won || 0)} 🟤</td>
                    <td style={{ fontFamily: "var(--mono)", color: "var(--red)" }}>-{fmt(p.coins_lost || 0)} 🟤</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>
                      {p.vs_zombita?.wins ?? 0}W / {p.vs_zombita?.losses ?? 0}L
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </TW>
      )}

      {tab === "cah" && (<>
        <TW title="CAH LEADERBOARD — JUDGED BY ZOMBITA">
          <table className="ap-t">
            <thead>
              <tr>
                <th>#</th><th>Player</th><th>Games W/P</th>
                <th>Win %</th><th>Rounds Won</th><th>Zombita Approved</th><th>Best Streak</th><th>Last Played</th>
              </tr>
            </thead>
            <tbody>
              {cahB.length === 0
                ? <tr><td colSpan={8}><Empty text="no cah games yet" /></td></tr>
                : cahB.map((p, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: "var(--display)", fontSize: 20, color: medalColor(i) }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </td>
                    <td style={{ fontWeight: 500 }}>{p.display_name}</td>
                    <td style={{ fontFamily: "var(--mono)" }}>{p.games_won}/{p.games_played}</td>
                    <td style={{ fontFamily: "var(--mono)", color: p.win_rate > 50 ? "var(--green)" : "var(--textdim)" }}>
                      {p.win_rate}%
                    </td>
                    <td style={{ fontFamily: "var(--mono)", color: "var(--green)" }}>{p.rounds_won}</td>
                    <td style={{ fontFamily: "var(--mono)", color: "#c8a84b" }}>{p.zombita_approved}</td>
                    <td style={{ fontFamily: "var(--mono)" }}>{p.best_streak} 🔥</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>{timeAgo(p.last_played)}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </TW>

        <div style={{ marginTop: 24 }}>
          <TW title="RECENT GAMES">
            <table className="ap-t">
              <thead>
                <tr>
                  <th>Winner</th><th>Score</th><th>Players</th><th>Rounds</th><th>When</th>
                </tr>
              </thead>
              <tbody>
                {cahH.length === 0
                  ? <tr><td colSpan={5}><Empty text="no game history yet" /></td></tr>
                  : cahH.map((g, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500, color: "var(--green)" }}>{g.winner_name || "—"}</td>
                      <td style={{ fontFamily: "var(--mono)" }}>{g.winner_score ?? "—"} pts</td>
                      <td style={{ fontFamily: "var(--mono)", color: "var(--textdim)" }}>{g.player_count}</td>
                      <td style={{ fontFamily: "var(--mono)", color: "var(--textdim)" }}>{g.rounds_played}</td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>{timeAgo(g.started_at)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </TW>
        </div>
      </>)}

    </>}
  </>);
}
