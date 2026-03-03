"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";
import type { ShopItem } from "@/lib/types";

const TIER_COLOR: Record<string, string> = {
  common: "#6b7280", uncommon: "#4caf7d", rare: "#4a8fc4", epic: "#c47a4a", legendary: "#c8a84b",
};

export default function AdminShopPage() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);
  const [editItem, setEditItem] = useState<ShopItem | null>(null);
  const [editForm, setEditForm] = useState<Partial<ShopItem>>({});

  const showToast = (msg: string, type: "success" | "error" | "info" = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetch(`${API}/api/shop/items`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setItems(d.items || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const toggleItem = async (item: ShopItem) => {
    const res = await fetch(`${API}/api/admin/shop/item/${item.item_id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !item.enabled }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((i) => i.item_id === item.item_id ? { ...i, enabled: !i.enabled } : i));
      showToast(`${item.name} ${!item.enabled ? "enabled" : "disabled"}`, "success");
    } else showToast("Failed to update item", "error");
  };

  const saveEdit = async () => {
    if (!editItem) return;
    const res = await fetch(`${API}/api/admin/shop/item/${editItem.item_id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      setItems((prev) => prev.map((i) => i.item_id === editItem.item_id ? { ...i, ...editForm } : i));
      showToast("Item updated", "success");
      setEditItem(null);
    } else showToast("Failed to save", "error");
  };

  const restock = async (item: ShopItem) => {
    const amount = prompt(`Restock amount for ${item.name}:`);
    if (!amount || isNaN(parseInt(amount))) return;
    const res = await fetch(`${API}/api/admin/shop/restock`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: item.item_id, amount: parseInt(amount) }),
    });
    if (res.ok) {
      const newStock = item.stock === -1 ? -1 : item.stock + parseInt(amount);
      setItems((prev) => prev.map((i) => i.item_id === item.item_id ? { ...i, stock: newStock } : i));
      showToast(`Restocked ${item.name}`, "success");
    } else showToast("Restock failed", "error");
  };

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-4xl tracking-widest text-[#c8cdd6]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>SHOP MANAGEMENT</h1>
          <p className="font-mono text-sm text-dim mt-1">{items.length} items · {items.filter(i => i.enabled).length} active</p>
        </div>
      </div>

      {loading ? (
        <p className="font-mono text-dim text-sm">loading inventory...</p>
      ) : (
        <div className="border border-[#1e2530]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#1e2530]">
                <th className="admin-th">Item</th>
                <th className="admin-th">ID</th>
                <th className="admin-th">Cat</th>
                <th className="admin-th">Tier</th>
                <th className="admin-th text-right">Buy</th>
                <th className="admin-th text-right">Sell</th>
                <th className="admin-th text-right">Stock</th>
                <th className="admin-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.item_id} className={`hover:bg-[#0f1318] transition-colors ${!item.enabled ? "opacity-40" : ""}`}>
                  <td className="admin-td font-medium text-[#c8cdd6]">{item.name}</td>
                  <td className="admin-td font-mono text-[0.7rem] text-dim">{item.item_id}</td>
                  <td className="admin-td font-mono text-[0.72rem]">{item.category}</td>
                  <td className="admin-td">
                    <span className="font-mono text-[0.7rem]" style={{ color: TIER_COLOR[item.tier] }}>{item.tier}</span>
                  </td>
                  <td className="admin-td text-right font-mono text-accent">{item.buy_price ?? "—"}</td>
                  <td className="admin-td text-right font-mono">{item.sell_price ?? "—"}</td>
                  <td className="admin-td text-right font-mono">
                    <span className={item.stock === 0 ? "text-danger" : item.stock !== -1 && item.stock < 5 ? "text-accent" : "text-success"}>
                      {item.stock === -1 ? "∞" : item.stock}
                    </span>
                  </td>
                  <td className="admin-td text-right">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditItem(item); setEditForm({ buy_price: item.buy_price, sell_price: item.sell_price, stock: item.stock }); }}
                        className="font-mono text-[0.7rem] px-2 py-1 border border-[#1e2530] text-dim hover:border-info hover:text-info transition-all cursor-pointer bg-transparent">
                        edit
                      </button>
                      <button onClick={() => restock(item)}
                        className="font-mono text-[0.7rem] px-2 py-1 border border-[#1e2530] text-dim hover:border-accent hover:text-accent transition-all cursor-pointer bg-transparent">
                        restock
                      </button>
                      <button onClick={() => toggleItem(item)}
                        className={`font-mono text-[0.7rem] px-2 py-1 border transition-all cursor-pointer bg-transparent ${item.enabled ? "border-success text-success hover:bg-success hover:text-black" : "border-dim text-dim hover:border-[#c8cdd6] hover:text-[#c8cdd6]"}`}>
                        {item.enabled ? "on" : "off"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={() => setEditItem(null)}>
          <div className="bg-[#0f1318] border border-[#1e2530] p-8 w-[420px]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl tracking-widest text-[#c8cdd6] mb-6" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              EDIT: {editItem.name}
            </h2>
            {[
              { key: "buy_price", label: "Buy Price" },
              { key: "sell_price", label: "Sell Price" },
              { key: "stock", label: "Stock (-1 = unlimited)" },
            ].map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1 mb-4">
                <label className="font-mono text-[0.7rem] uppercase tracking-widest text-dim">{label}</label>
                <input
                  type="number"
                  value={(editForm as any)[key] ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value === "" ? undefined : parseInt(e.target.value) }))}
                  className="bg-[#080a0c] border border-[#1e2530] text-[#c8cdd6] px-3 py-2 font-mono text-sm outline-none focus:border-accent transition-colors"
                />
              </div>
            ))}
            <div className="flex gap-3 mt-6">
              <button onClick={saveEdit} className="px-5 py-2 border border-success text-success font-mono text-xs uppercase tracking-widest hover:bg-success hover:text-black transition-all cursor-pointer bg-transparent">
                Save
              </button>
              <button onClick={() => setEditItem(null)} className="px-5 py-2 border border-[#1e2530] text-dim font-mono text-xs uppercase tracking-widest hover:border-[#444] transition-all cursor-pointer bg-transparent">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className={`toast-slide px-5 py-3 font-mono text-xs border-l-[3px] bg-[#0f1318] ${
            toast.type === "success" ? "border-success text-success" : toast.type === "error" ? "border-danger text-danger" : "border-accent text-accent"
          }`}>{toast.msg}</div>
        </div>
      )}
    </div>
  );
}
