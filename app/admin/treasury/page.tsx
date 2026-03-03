"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";
import { bronzeToDisplay } from "@/lib/api";
import type { Transaction } from "@/lib/types";

export default function AdminTreasuryPage() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [givePlayer, setGivePlayer] = useState("");
  const [giveAmount, setGiveAmount] = useState("");
  const [takePlayer, setTakePlayer] = useState("");
  const [takeAmount, setTakeAmount] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetch(`${API}/api/admin/economy/transactions`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setTxns(d.transactions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const give = async () => {
    if (!givePlayer || !giveAmount) return;
    const res = await fetch(`${API}/api/admin/economy/give`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingame_name: givePlayer, amount: parseInt(giveAmount) }),
    });
    if (res.ok) { showToast(`Gave ${giveAmount} 🟤 to ${givePlayer}`); setGivePlayer(""); setGiveAmount(""); }
    else showToast("Failed", "error");
  };

  const take = async () => {
    if (!takePlayer || !takeAmount) return;
    const res = await fetch(`${API}/api/admin/economy/take`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingame_name: takePlayer, amount: parseInt(takeAmount) }),
    });
    if (res.ok) { showToast(`Took ${takeAmount} 🟤 from ${takePlayer}`); setTakePlayer(""); setTakeAmount(""); }
    else showToast("Failed", "error");
  };

  const TYPE_COLOR: Record<string, string> = {
    buy: "#4caf7d", sell: "#c8a84b", transfer: "#4a8fc4",
    admin_give: "#e05555", admin_take: "#c47a4a", lottery: "#c8a84b",
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl tracking-widest text-[#c8cdd6]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>TREASURY</h1>
        <p className="font-mono text-sm text-dim mt-1">Economy management &amp; transaction log</p>
      </div>

      <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* Give */}
        <div className="border border-[#1e2530] bg-[#0f1318] p-6">
          <h2 className="text-xl tracking-widest text-success mb-4" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>GIVE COINS</h2>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[0.7rem] uppercase tracking-widest text-dim">Player (in-game name)</label>
              <input value={givePlayer} onChange={(e) => setGivePlayer(e.target.value)} placeholder="PlayerName"
                className="bg-bg border border-[#1e2530] text-[#c8cdd6] px-3 py-2 font-mono text-sm outline-none focus:border-success transition-colors" />
            </div>
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className="font-mono text-[0.7rem] uppercase tracking-widest text-dim">Amount (bronze)</label>
                <input type="number" value={giveAmount} onChange={(e) => setGiveAmount(e.target.value)} placeholder="100"
                  className="bg-bg border border-[#1e2530] text-[#c8cdd6] px-3 py-2 font-mono text-sm outline-none focus:border-success transition-colors" />
              </div>
              <button onClick={give} className="px-5 self-end py-2 border border-success text-success font-mono text-xs uppercase tracking-widest hover:bg-success hover:text-black transition-all cursor-pointer bg-transparent whitespace-nowrap">
                Give →
              </button>
            </div>
          </div>
        </div>

        {/* Take */}
        <div className="border border-[#1e2530] bg-[#0f1318] p-6">
          <h2 className="text-xl tracking-widest text-danger mb-4" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>TAKE COINS</h2>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[0.7rem] uppercase tracking-widest text-dim">Player (in-game name)</label>
              <input value={takePlayer} onChange={(e) => setTakePlayer(e.target.value)} placeholder="PlayerName"
                className="bg-bg border border-[#1e2530] text-[#c8cdd6] px-3 py-2 font-mono text-sm outline-none focus:border-danger transition-colors" />
            </div>
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className="font-mono text-[0.7rem] uppercase tracking-widest text-dim">Amount (bronze)</label>
                <input type="number" value={takeAmount} onChange={(e) => setTakeAmount(e.target.value)} placeholder="100"
                  className="bg-bg border border-[#1e2530] text-[#c8cdd6] px-3 py-2 font-mono text-sm outline-none focus:border-danger transition-colors" />
              </div>
              <button onClick={take} className="px-5 self-end py-2 border border-danger text-danger font-mono text-xs uppercase tracking-widest hover:bg-danger hover:text-white transition-all cursor-pointer bg-transparent whitespace-nowrap">
                Take →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction log */}
      <div className="font-mono text-sm text-dim mb-3">Transaction Log (last 50)</div>
      {loading ? (
        <p className="font-mono text-dim text-sm">loading...</p>
      ) : (
        <div className="border border-[#1e2530]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#1e2530]">
                <th className="admin-th">From</th>
                <th className="admin-th">To</th>
                <th className="admin-th">Type</th>
                <th className="admin-th text-right">Amount</th>
                <th className="admin-th">Note</th>
                <th className="admin-th">When</th>
              </tr>
            </thead>
            <tbody>
              {txns.slice(0, 50).map((t) => (
                <tr key={t.id} className="hover:bg-[#0f1318] transition-colors">
                  <td className="admin-td font-mono text-[0.8rem]">{t.from_name}</td>
                  <td className="admin-td font-mono text-[0.8rem]">{t.to_name}</td>
                  <td className="admin-td">
                    <span className="font-mono text-[0.7rem] uppercase" style={{ color: TYPE_COLOR[t.type] || "#6b7280" }}>{t.type}</span>
                  </td>
                  <td className="admin-td text-right font-mono text-accent">{bronzeToDisplay(t.amount)}</td>
                  <td className="admin-td text-dim text-[0.8rem]">{t.note || "—"}</td>
                  <td className="admin-td font-mono text-[0.7rem] text-dim">{new Date(t.created_at).toLocaleString()}</td>
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
