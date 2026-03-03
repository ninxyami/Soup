"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";
import { bronzeToDisplay } from "@/lib/api";

interface Player {
  discord_id: string;
  discord_username: string;
  ingame_name: string;
  balance: number;
  kills: number;
  deaths: number;
  days_survived: number;
  whitelisted: boolean;
  is_admin: boolean;
  joined_at: string;
}

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetch(`${API}/api/admin/players`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setPlayers(d.players || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const removeWhitelist = async (p: Player) => {
    if (!confirm(`Remove ${p.ingame_name} from whitelist?`)) return;
    const res = await fetch(`${API}/api/admin/whitelist/remove`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discord_id: p.discord_id }),
    });
    if (res.ok) {
      setPlayers((prev) => prev.map((pl) => pl.discord_id === p.discord_id ? { ...pl, whitelisted: false } : pl));
      showToast(`Removed ${p.ingame_name} from whitelist`);
    } else showToast("Failed", "error");
  };

  const filtered = players.filter((p) => {
    const q = search.toLowerCase();
    return !q || p.ingame_name.toLowerCase().includes(q) || p.discord_username.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl tracking-widest text-[#c8cdd6]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>PLAYERS</h1>
          <p className="font-mono text-sm text-dim mt-1">{players.length} registered · {players.filter(p => p.whitelisted).length} whitelisted</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search player..."
          className="bg-[#0f1318] border border-[#1e2530] text-[#c8cdd6] px-4 py-2 font-mono text-sm outline-none focus:border-accent transition-colors w-64"
        />
      </div>

      {loading ? (
        <p className="font-mono text-dim text-sm">loading players...</p>
      ) : (
        <div className="border border-[#1e2530]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#1e2530]">
                <th className="admin-th">Discord</th>
                <th className="admin-th">In-Game</th>
                <th className="admin-th text-right">Balance</th>
                <th className="admin-th text-right">Kills</th>
                <th className="admin-th text-right">Deaths</th>
                <th className="admin-th text-right">Days</th>
                <th className="admin-th">Status</th>
                <th className="admin-th">Joined</th>
                <th className="admin-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.discord_id} className="hover:bg-[#0f1318] transition-colors">
                  <td className="admin-td text-[#c8cdd6]">{p.discord_username}</td>
                  <td className="admin-td font-mono text-[0.85rem]">{p.ingame_name}</td>
                  <td className="admin-td text-right font-mono text-accent text-[0.8rem]">{bronzeToDisplay(p.balance)}</td>
                  <td className="admin-td text-right font-mono">{p.kills}</td>
                  <td className="admin-td text-right font-mono">{p.deaths}</td>
                  <td className="admin-td text-right font-mono">{p.days_survived}</td>
                  <td className="admin-td">
                    <div className="flex gap-1">
                      {p.whitelisted && <span className="font-mono text-[0.65rem] px-2 py-[2px] border border-success text-success">wl</span>}
                      {p.is_admin && <span className="font-mono text-[0.65rem] px-2 py-[2px] border border-accent text-accent">admin</span>}
                    </div>
                  </td>
                  <td className="admin-td font-mono text-[0.7rem] text-dim">{new Date(p.joined_at).toLocaleDateString()}</td>
                  <td className="admin-td text-right">
                    {p.whitelisted && (
                      <button onClick={() => removeWhitelist(p)}
                        className="font-mono text-[0.7rem] px-2 py-1 border border-[#1e2530] text-dim hover:border-danger hover:text-danger transition-all cursor-pointer bg-transparent">
                        remove wl
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className={`toast-slide px-5 py-3 font-mono text-xs border-l-[3px] bg-[#0f1318] ${toast.type === "success" ? "border-success text-success" : "border-danger text-danger"}`}>
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
