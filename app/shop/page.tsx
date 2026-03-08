"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";
import { bronzeToDisplay } from "@/lib/api";
import type { ShopItem } from "@/lib/types";

const CATEGORIES = [
  { id: "all",     icon: "🏪", label: "All"     },
  { id: "medical", icon: "💊", label: "Medical"  },
  { id: "food",    icon: "🥫", label: "Food"     },
  { id: "tools",   icon: "🔧", label: "Tools"    },
  { id: "weapons", icon: "⚔️", label: "Weapons"  },
  { id: "misc",    icon: "📦", label: "Misc"     },
];

const TIER_COLOR: Record<string, string> = {
  common:    "#6b7280",
  uncommon:  "#4caf7d",
  rare:      "#4a8fc4",
  epic:      "#c47a4a",
  legendary: "#c8a84b",
};

const WEB_TAX_RATE = 0.40;

function calcTax(basePrice: number): { tax: number; total: number } {
  const tax   = Math.ceil(basePrice * WEB_TAX_RATE);
  const total = basePrice + tax;
  return { tax, total };
}

export default function ShopPage() {
  const [user,         setUser]         = useState<any>(null);
  const [balance,      setBalance]      = useState(0);
  const [items,        setItems]        = useState<ShopItem[]>([]);
  const [cat,          setCat]          = useState("all");
  const [toast,        setToast]        = useState<{ msg: string; type: string } | null>(null);
  const [transferTo,   setTransferTo]   = useState("");
  const [transferAmt,  setTransferAmt]  = useState("");
  const [transferNote, setTransferNote] = useState("");

  const showToast = (msg: string, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then(async (me) => {
        if (me) {
          setUser(me);
          const br = await fetch(`${API}/api/shop/my-balance`, { credentials: "include" });
          if (br.ok) { const bd = await br.json(); setBalance(bd.bronze); }
        }
      }).catch(() => {});

    fetch(`${API}/api/shop/items?shop_type=global`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(() => {});
  }, []);

  const displayed = items.filter((i) => i.enabled).filter((i) => cat === "all" || i.category === cat);

  const buyItem = async (item: ShopItem) => {
    if (!user) { window.location.href = `${API}/auth/discord/login?redirect=shop`; return; }
    const { tax, total } = calcTax(item.buy_price ?? 0);
    if (!confirm(`Buy ${item.name}?\n\nBase: ${item.buy_price} 🟤\nTax (40%): ${tax} 🟤\nTotal: ${total} 🟤`)) return;
    const res = await fetch(`${API}/api/shop/web-buy`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: item.item_id, quantity: 1, source: "web" }),
    });
    const data = await res.json();
    if (res.ok) { setBalance(data.new_balance); showToast(data.message || `Bought ${item.name}!`, "success"); }
    else { showToast(data.detail || "Purchase failed", "error"); }
  };

  const doTransfer = async () => {
    if (!transferTo || !transferAmt) { showToast("Fill in recipient and amount", "error"); return; }
    if (!confirm(`Send ${transferAmt} 🟤 to ${transferTo}?`)) return;
    const res = await fetch(`${API}/api/economy/transfer`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_ingame_name: transferTo, amount: parseInt(transferAmt), note: transferNote }),
    });
    const data = await res.json();
    if (res.ok) {
      setBalance(data.new_balance);
      showToast(`Sent ${transferAmt} 🟤 to ${data.sent_to}!`, "success");
      setTransferTo(""); setTransferAmt(""); setTransferNote("");
    } else {
      showToast(data.detail || "Transfer failed", "error");
    }
  };

  return (
    <div className="scanline min-h-screen" style={{ background: "#080a0c", color: "#c8cdd6", fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header className="flex items-center gap-2 sm:gap-4 px-4 sm:px-8 py-3 sm:py-4 border-b border-[#1e2530] bg-[#0f1318] sticky top-[49px] z-10">
        <a href="/" className="font-mono text-[0.68rem] sm:text-[0.72rem] text-dim hover:text-[#c8cdd6] no-underline tracking-widest hidden sm:block">← S.O.U.P</a>
        <span className="font-display text-xl sm:text-2xl tracking-[2px] sm:tracking-[3px] text-accent" style={{ fontFamily: "'Bebas Neue', sans-serif", textShadow: "0 0 20px rgba(200,168,75,0.3)" }}>
          ZOMBITA&apos;S SHOP
        </span>
        <div className="flex-1" />
        {user ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="font-mono text-[0.68rem] sm:text-[0.72rem] text-dim hidden sm:block">{user.global_name || user.username}</span>
            <span className="font-mono text-[0.75rem] sm:text-[0.83rem] text-accent px-2 sm:px-3 py-1 border border-[rgba(200,168,75,0.3)] bg-[rgba(200,168,75,0.05)]">
              💰 {bronzeToDisplay(balance)}
            </span>
            <button
              onClick={async () => { await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" }); window.location.reload(); }}
              className="font-mono text-[0.68rem] text-dim bg-transparent border border-[#1e2530] px-2 py-1 cursor-pointer hover:text-[#c8cdd6] hidden sm:block">
              logout
            </button>
          </div>
        ) : (
          <a href={`${API}/auth/discord/login?redirect=shop`}
            className="font-mono text-xs px-3 sm:px-4 py-1.5 sm:py-2 border border-accent text-accent no-underline hover:bg-accent hover:text-black transition-all">
            🔑 Login
          </a>
        )}
      </header>

      {/* Tax notice */}
      <div className="px-4 sm:px-8 py-2 sm:py-3 border-b border-[#1e2530]" style={{ background: "rgba(200,168,75,0.06)" }}>
        <p className="font-mono text-[0.65rem] sm:text-[0.72rem] text-center" style={{ color: "#c8a84b" }}>
          ⚠️ <strong>40% delivery surcharge</strong> on web purchases · In-game shops: <strong>10% tax</strong>
        </p>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Mobile: horizontal category scroll */}
        <div className="sm:hidden overflow-x-auto -mx-4 px-4 mb-5 pb-1">
          <div className="flex gap-2 min-w-max">
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 border text-[0.68rem] font-mono uppercase tracking-widest whitespace-nowrap cursor-pointer transition-all bg-transparent ${
                  cat === c.id ? "border-[rgba(200,168,75,0.4)] text-accent bg-[rgba(200,168,75,0.05)]" : "border-[#1e2530] text-dim hover:text-[#c8cdd6]"
                }`}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop: sidebar + items side by side */}
        <div className="hidden sm:flex gap-8 items-start">
          {/* Sidebar */}
          <aside className="w-[160px] flex-shrink-0">
            <div className="font-display text-sm tracking-[3px] text-dim mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>CATEGORIES</div>
            <div className="flex flex-col gap-1">
              {CATEGORIES.map((c) => (
                <button key={c.id} onClick={() => setCat(c.id)}
                  className={`flex items-center gap-2 px-3 py-2 border text-[0.72rem] font-mono uppercase tracking-widest text-left cursor-pointer transition-all bg-transparent ${
                    cat === c.id ? "border-[rgba(200,168,75,0.4)] text-accent bg-[rgba(200,168,75,0.05)]" : "border-transparent text-dim hover:text-[#c8cdd6] hover:border-[#1e2530]"
                  }`}>
                  <span>{c.icon}</span> {c.label}
                </button>
              ))}
            </div>
            <div className="mt-6 p-3 border border-[#1e2530]" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="font-mono text-[0.65rem] text-dim uppercase tracking-widest mb-2">In-game only</div>
              <div className="font-mono text-[0.68rem]" style={{ color: "#6b7280", lineHeight: "1.6" }}>
                🍕 Food Shop<br />🔫 Ammo Shop<br />🔧 Car Parts<br />🚗 Car Dealer
              </div>
            </div>
          </aside>

          {/* Items — takes remaining width */}
          <div className="flex-1 min-w-0">
            <ShopItems displayed={displayed} user={user} buyItem={buyItem} />
          </div>
        </div>

        {/* Mobile: full width items */}
        <div className="sm:hidden">
          <ShopItems displayed={displayed} user={user} buyItem={buyItem} />
        </div>

        {/* Transfer section */}
        {user && (
          <div className="border border-[#1e2530] bg-[#0f1318] p-4 sm:p-6 mt-6 sm:mt-8">
            <h3 className="font-display text-lg sm:text-xl tracking-[3px] text-[#c8cdd6] mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>TRANSFER COINS</h3>
            <p className="font-mono text-xs text-dim mb-4">Send bronze to another player by their in-game name.</p>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end flex-wrap">
              <div className="flex flex-col gap-1 flex-1">
                <label className="font-mono text-[0.65rem] uppercase tracking-widest text-dim">Recipient</label>
                <input value={transferTo} onChange={(e) => setTransferTo(e.target.value)} placeholder="PlayerName"
                  className="bg-[#080a0c] border border-[#1e2530] text-[#c8cdd6] px-3 py-2 font-mono text-sm outline-none focus:border-accent" />
              </div>
              <div className="flex flex-col gap-1 sm:min-w-[120px]">
                <label className="font-mono text-[0.65rem] uppercase tracking-widest text-dim">Amount</label>
                <input type="number" value={transferAmt} onChange={(e) => setTransferAmt(e.target.value)} placeholder="100"
                  className="bg-[#080a0c] border border-[#1e2530] text-[#c8cdd6] px-3 py-2 font-mono text-sm outline-none focus:border-accent" />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="font-mono text-[0.65rem] uppercase tracking-widest text-dim">Note (optional)</label>
                <input value={transferNote} onChange={(e) => setTransferNote(e.target.value)} placeholder="thanks for the save!"
                  className="bg-[#080a0c] border border-[#1e2530] text-[#c8cdd6] px-3 py-2 font-mono text-sm outline-none focus:border-accent" />
              </div>
              <button onClick={doTransfer}
                className="px-5 py-2 border border-info text-info font-mono text-xs uppercase tracking-widest hover:bg-info hover:text-white transition-all whitespace-nowrap cursor-pointer bg-transparent">
                Send →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-4 sm:right-6 z-50 max-w-[calc(100vw-2rem)]">
          <div className={`toast-slide px-4 py-3 font-mono text-xs border-l-[3px] bg-[#0f1318] ${
            toast.type === "success" ? "border-success text-success"
            : toast.type === "error" ? "border-danger text-danger"
            : "border-accent text-accent"
          }`}>{toast.msg}</div>
        </div>
      )}
    </div>
  );
}

function ShopItems({ displayed, user, buyItem }: { displayed: ShopItem[], user: any, buyItem: (item: ShopItem) => void }) {
  return (
    <>
      <div className="flex items-center gap-3 border-b border-[#1e2530] mb-4 sm:mb-6 pb-3">
        <span className="px-4 sm:px-6 py-2 font-mono text-xs tracking-[2px] uppercase border-b-2 border-accent text-accent -mb-[13px]">🛒 Buy</span>
        <span className="font-mono text-[0.65rem] text-dim ml-2 sm:ml-4">{displayed.length} item{displayed.length !== 1 ? "s" : ""}</span>
      </div>

      {displayed.length === 0 ? (
        <div className="font-mono text-sm text-dim py-8 sm:py-12 text-center">No items in this category right now.</div>
      ) : (
        <div className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
          {displayed.map((item) => {
            const outOfStock = item.stock === 0;
            const { tax, total } = calcTax(item.buy_price ?? 0);
            const stockText = item.stock === -1 ? "In Stock" : item.stock === 0 ? "Out of Stock" : item.stock < 5 ? `⚠ ${item.stock} left` : `${item.stock} in stock`;
            const stockColor = item.stock === -1 ? "#6b7280" : item.stock === 0 ? "#e05555" : item.stock < 5 ? "#c8a84b" : "#4caf7d";
            return (
              <div key={item.item_id} className={`bg-[#0f1318] border border-[#1e2530] p-3 sm:p-4 relative transition-all hover:border-[rgba(200,168,75,0.3)] hover:-translate-y-[2px] ${outOfStock ? "opacity-50" : ""}`}>
                <div className="tier-stripe" style={{ background: TIER_COLOR[item.tier] }} />
                <div className="font-medium text-sm mt-2 mb-1 text-[#c8cdd6] leading-tight">{item.name}</div>
                <div className="font-mono text-[0.65rem] text-dim mb-2">{item.item_id}</div>
                <div className="mb-0.5"><span className="font-mono text-[0.65rem] text-dim">Base: </span><span className="font-mono text-[0.65rem]" style={{ color: "#9ca3af" }}>{item.buy_price} 🟤</span></div>
                <div className="mb-1"><span className="font-mono text-[0.65rem] text-dim">Tax: </span><span className="font-mono text-[0.65rem]" style={{ color: "#c8a84b" }}>+{tax} 🟤</span></div>
                <div className="font-mono text-base sm:text-lg text-accent mb-1">{total} 🟤</div>
                <div className="font-mono text-xs mb-3" style={{ color: stockColor }}>{stockText}</div>
                <button onClick={() => buyItem(item)} disabled={outOfStock}
                  className="w-full py-1.5 sm:py-2 font-mono text-xs uppercase tracking-widest border border-success text-success cursor-pointer transition-all hover:bg-success hover:text-black disabled:opacity-40 disabled:cursor-not-allowed bg-transparent">
                  {outOfStock ? "Out of Stock" : user ? "Buy" : "🔑 Login"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
