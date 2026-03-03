"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";

type BoardType = "kills" | "survival" | "deaths" | "balance";

interface Entry {
  rank: number;
  name: string;
  faction?: string;
  value: number | string;
}

const BOARDS: { id: BoardType; label: string }[] = [
  { id: "kills", label: "Kills" },
  { id: "survival", label: "Survival" },
  { id: "deaths", label: "Deaths" },
  { id: "balance", label: "Balance" },
];

const MEDALS = ["🥇", "🥈", "🥉"];
const ROW_CLASS = ["lb-first", "lb-second", "lb-third"];

export default function LeaderboardPage() {
  const [board, setBoard] = useState<BoardType>("kills");
  const [data, setData] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/leaderboard/${board}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setData(d.entries || []);
        if (d.updated_at) setUpdated(new Date(d.updated_at).toLocaleString());
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [board]);

  const colLabel = board === "kills" ? "Kills" : board === "survival" ? "Days Survived" : board === "deaths" ? "Deaths" : "Balance";

  return (
    <main className="max-w-[720px] mx-auto px-6 py-16">
      <section>
        <h1 className="text-2xl tracking-[0.15em] uppercase mb-2">Leaderboard</h1>
        <p className="text-[#777] text-[0.85rem]">Season 1 — New Dawn</p>
      </section>

      <div className="divider" />

      {/* Board switcher */}
      <div className="flex gap-2 mb-10 flex-wrap">
        {BOARDS.map((b) => (
          <button
            key={b.id}
            onClick={() => setBoard(b.id)}
            className={`px-4 py-[0.45rem] text-[0.72rem] tracking-[0.1em] uppercase border font-[inherit] cursor-pointer transition-all ${
              board === b.id
                ? "border-[#4a7c59] text-[#4a7c59]"
                : "border-[#222] text-[#555] hover:border-[#444] hover:text-[#e6e6e6]"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {updated && (
        <p className="text-[0.72rem] text-[#444] tracking-[0.06em] mb-4">Updated {updated}</p>
      )}

      {loading ? (
        <p className="font-mono text-[#555] text-sm">loading...</p>
      ) : data.length === 0 ? (
        <p className="font-mono text-[#555] text-sm">no data yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="lb-table">
            <thead>
              <tr>
                <th className="w-[2.5rem]" />
                <th>Player</th>
                <th className="text-right">{colLabel}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry, i) => (
                <tr key={entry.name} className={`lb-row${i < 3 ? ` ${ROW_CLASS[i]}` : ""}`}>
                  <td className="text-center text-[0.85rem] text-[#555]">
                    {i < 3 ? MEDALS[i] : entry.rank}
                  </td>
                  <td>
                    <span className="font-medium">{entry.name}</span>
                    {entry.faction && (
                      <span className="text-[0.68rem] text-[#4a7c59] tracking-[0.06em] ml-2">{entry.faction}</span>
                    )}
                  </td>
                  <td className="text-right font-mono text-[0.9rem]">{entry.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
