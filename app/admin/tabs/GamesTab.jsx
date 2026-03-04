"use client";
// @ts-nocheck
import { useState, useEffect } from "react";
import { fetchApi, fmt, Title, TW, Empty, Load } from "./shared";

export default function GamesTab({ toast }) {
  const [rpsB, setRpsB] = useState([]); const [c4B, setC4B] = useState([]); const [tab, setTab] = useState("rps"); const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [r, c] = await Promise.all([
          fetchApi("/api/stats/rps").catch(() => ({ leaderboard: [] })),
          fetchApi("/api/stats/connect4").catch(() => ({ leaderboard: [] })),
        ]);
        setRpsB(r.leaderboard || []); setC4B(c.leaderboard || []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const board = tab === "rps" ? rpsB : c4B;
  const medalColor = (i) => i === 0 ? "#c8a84b" : i === 1 ? "#9ca3af" : i === 2 ? "#c47a4a" : "var(--textdim)";

  return (<>
    <Title t="GAMES" s="rps · connect 4 · leaderboards" />
    <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
      <button className={`ap-ft ${tab === "rps" ? "act" : ""}`} onClick={() => setTab("rps")}>🪨 Rock Paper Scissors</button>
      <button className={`ap-ft ${tab === "c4" ? "act" : ""}`} onClick={() => setTab("c4")}>🔴 Connect 4</button>
    </div>
    {loading ? <Load /> : <TW title={tab === "rps" ? "RPS LEADERBOARD" : "CONNECT 4 LEADERBOARD"}>
      <table className="ap-t"><thead><tr><th>#</th><th>Player</th><th>Wins</th><th>Losses</th><th>Draws</th><th>Win Rate</th><th>Earned</th><th>Lost</th><th>vs Zombita</th></tr></thead>
        <tbody>{board.length === 0 ? <tr><td colSpan={9}><Empty text="no game data yet" /></td></tr> : board.map((p, i) => <tr key={i}>
          <td style={{ fontFamily: "var(--display)", fontSize: 20, color: medalColor(i) }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
          <td style={{ fontWeight: 500 }}>{p.display_name || p.name}</td>
          <td style={{ fontFamily: "var(--mono)", color: "var(--green)" }}>{p.wins}</td>
          <td style={{ fontFamily: "var(--mono)", color: "var(--red)" }}>{p.losses}</td>
          <td style={{ fontFamily: "var(--mono)", color: "var(--textdim)" }}>{p.draws}</td>
          <td style={{ fontFamily: "var(--mono)", color: p.win_rate > 50 ? "var(--green)" : "var(--textdim)" }}>{p.win_rate ?? Math.round((p.wins / (p.wins + p.losses + p.draws || 1)) * 100)}%</td>
          <td style={{ fontFamily: "var(--mono)", color: "var(--green)" }}>+{fmt(p.coins_won || 0)} 🟤</td>
          <td style={{ fontFamily: "var(--mono)", color: "var(--red)" }}>−{fmt(p.coins_lost || 0)} 🟤</td>
          <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>{p.vs_zombita_wins ?? 0}W / {p.vs_zombita_losses ?? 0}L</td>
        </tr>)}</tbody></table>
    </TW>}
  </>);
}
