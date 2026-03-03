"use client";
import { useState, useEffect, useCallback, useRef } from "react";

// ─── CONFIG ───
const API = "https://api.stateofundeadpurge.site";

// ─── HELPERS ───
const fmt = (n) => (n != null ? Number(n).toLocaleString() : "—");
const relTime = (ts) => {
  if (!ts) return "—";
  const d = new Date(typeof ts === "number" ? ts * 1000 : ts);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const fetchApi = async (path, opts = {}) => {
  const r = await fetch(`${API}${path}`, { credentials: "include", ...opts });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(err.detail || r.statusText);
  }
  return r.json();
};

const postApi = async (path, body) =>
  fetchApi(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

// ─── TOAST SYSTEM ───
const ToastContainer = ({ toasts }) => (
  <div style={{ position: "fixed", bottom: 24, right: 24, display: "flex", flexDirection: "column", gap: 8, zIndex: 999 }}>
    {toasts.map((t) => (
      <div
        key={t.id}
        style={{
          padding: "12px 20px",
          fontFamily: "var(--f-mono)",
          fontSize: 12,
          letterSpacing: 1,
          borderLeft: `3px solid ${t.type === "success" ? "#4caf7d" : t.type === "error" ? "#e05555" : "#c8a84b"}`,
          background: "#0f1318",
          color: t.type === "success" ? "#4caf7d" : t.type === "error" ? "#e05555" : "#c8a84b",
          animation: "slideIn 0.2s ease",
          maxWidth: 340,
        }}
      >
        {t.msg}
      </div>
    ))}
  </div>
);

// ─── SHARED UI COMPONENTS ───
const StatCard = ({ label, value, color = "#c8a84b", sub }) => (
  <div
    style={{
      background: "#0f1318",
      border: "1px solid #1e2530",
      padding: 20,
      position: "relative",
      overflow: "hidden",
    }}
  >
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color }} />
    <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#6b7280", fontFamily: "var(--f-mono)", marginBottom: 8 }}>{label}</div>
    <div style={{ fontFamily: "var(--f-display)", fontSize: 32, color, letterSpacing: 2 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{sub}</div>}
  </div>
);

const PageTitle = ({ title, sub }) => (
  <>
    <div style={{ fontFamily: "var(--f-display)", fontSize: 36, letterSpacing: 4, color: "#c8a84b", marginBottom: 4 }}>{title}</div>
    {sub && <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 32, fontFamily: "var(--f-mono)" }}>{sub}</div>}
  </>
);

const TableWrap = ({ title, headerRight, children }) => (
  <div style={{ background: "#0f1318", border: "1px solid #1e2530", overflow: "hidden" }}>
    {title && (
      <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #1e2530", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ fontFamily: "var(--f-display)", fontSize: 18, letterSpacing: 2, color: "#c8cdd6", flex: 1 }}>{title}</h3>
        {headerRight}
      </div>
    )}
    {children}
  </div>
);

const Btn = ({ color = "gold", sm, children, ...props }) => {
  const colors = {
    gold: { border: "#c8a84b", text: "#c8a84b", hoverBg: "#c8a84b", hoverText: "#000" },
    red: { border: "#e05555", text: "#e05555", hoverBg: "#e05555", hoverText: "#fff" },
    green: { border: "#4caf7d", text: "#4caf7d", hoverBg: "#4caf7d", hoverText: "#000" },
    blue: { border: "#4a8fc4", text: "#4a8fc4", hoverBg: "#4a8fc4", hoverText: "#fff" },
    ghost: { border: "#1e2530", text: "#6b7280", hoverBg: "transparent", hoverText: "#c8cdd6" },
  };
  const c = colors[color] || colors.gold;
  const [hov, setHov] = useState(false);
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: sm ? "4px 10px" : "8px 16px",
        fontSize: sm ? 10 : 11,
        fontFamily: "var(--f-mono)",
        letterSpacing: 1,
        textTransform: "uppercase",
        border: `1px solid ${c.border}`,
        cursor: "pointer",
        background: hov ? c.hoverBg : "transparent",
        color: hov ? c.hoverText : c.text,
        borderRadius: 2,
        transition: "all 0.15s",
      }}
      {...props}
    >
      {children}
    </button>
  );
};

const Input = ({ label, ...props }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {label && <label style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "#6b7280", fontFamily: "var(--f-mono)" }}>{label}</label>}
    <input
      style={{
        background: "#080a0c",
        border: "1px solid #1e2530",
        color: "#c8cdd6",
        padding: "8px 12px",
        fontFamily: "var(--f-mono)",
        fontSize: 13,
        outline: "none",
        borderRadius: 2,
        width: "100%",
      }}
      {...props}
    />
  </div>
);

const Select = ({ label, children, ...props }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {label && <label style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "#6b7280", fontFamily: "var(--f-mono)" }}>{label}</label>}
    <select
      style={{
        background: "#080a0c",
        border: "1px solid #1e2530",
        color: "#c8cdd6",
        padding: "8px 12px",
        fontFamily: "var(--f-mono)",
        fontSize: 13,
        outline: "none",
        borderRadius: 2,
      }}
      {...props}
    >
      {children}
    </select>
  </div>
);

const FormBox = ({ title, children }) => (
  <div style={{ background: "#0f1318", border: "1px solid #1e2530", padding: 24, marginBottom: 24 }}>
    {title && <h4 style={{ fontFamily: "var(--f-display)", fontSize: 18, letterSpacing: 2, color: "#c8cdd6", marginBottom: 20 }}>{title}</h4>}
    {children}
  </div>
);

const EmptyState = ({ text = "No data found" }) => (
  <div style={{ textAlign: "center", color: "#6b7280", padding: 40, fontFamily: "var(--f-mono)", fontSize: 12 }}>{text}</div>
);

const Badge = ({ text, bg, color }) => (
  <span style={{ display: "inline-block", padding: "2px 8px", fontSize: 10, fontFamily: "var(--f-mono)", letterSpacing: 1, borderRadius: 2, background: bg, color }}>{text}</span>
);

const tierColors = {
  common: { bg: "rgba(107,114,128,0.2)", text: "#9ca3af" },
  uncommon: { bg: "rgba(76,143,125,0.2)", text: "#4caf7d" },
  rare: { bg: "rgba(74,143,196,0.2)", text: "#4a8fc4" },
  epic: { bg: "rgba(123,63,63,0.2)", text: "#c47a4a" },
  legendary: { bg: "rgba(200,168,75,0.2)", text: "#c8a84b" },
};

// ═══════════════════════════════════════════════════════════════════════
// OVERVIEW PANEL
// ═══════════════════════════════════════════════════════════════════════
const OverviewPanel = ({ toast }) => {
  const [stats, setStats] = useState(null);
  const [treasury, setTreasury] = useState(null);
  const [recentTx, setRecentTx] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, plRes, txRes] = await Promise.allSettled([
        fetchApi("/api/treasury/admin/overview"),
        fetchApi("/api/players"),
        fetchApi("/api/admin/economy/transactions"),
      ]);
      if (tRes.status === "fulfilled") setTreasury(tRes.value);
      if (plRes.status === "fulfilled") setStats((s) => ({ ...s, players: plRes.value }));
      if (txRes.status === "fulfilled") setRecentTx(txRes.value.transactions?.slice(0, 10) || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const t = treasury?.treasury;
  const playerCount = stats?.players?.length || 0;

  return (
    <div>
      <PageTitle title="COMMAND CENTER" sub="overview of all systems" />
      {loading ? (
        <EmptyState text="Loading..." />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
            <StatCard label="Treasury Balance" value={t ? `${fmt(t.balance)} 🟤` : "—"} color="#c8a84b" sub={t ? `${t.health_pct}% health` : ""} />
            <StatCard label="Total Players" value={fmt(playerCount)} color="#4a8fc4" />
            <StatCard label="Economy Model" value={t?.model === "B" ? "CIRCULATING" : t?.model === "A" ? "HARD CAP" : "—"} color={t?.model === "B" ? "#4caf7d" : "#e05555"} />
            <StatCard label="Cycle" value={t ? `${t.cycle_days_remaining}d left` : "—"} color="#c8a84b" sub={t ? `${t.cycle_pct}% through` : ""} />
          </div>

          {/* Treasury Health Bar */}
          {t && (
            <div style={{ background: "#0f1318", border: "1px solid #1e2530", padding: "20px 24px", marginBottom: 24, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #c8a84b, transparent)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontFamily: "var(--f-mono)", fontSize: 10, letterSpacing: 2, color: "#6b7280", textTransform: "uppercase" }}>Treasury Health</span>
                <span style={{ fontFamily: "var(--f-mono)", fontSize: 10, color: "#6b7280" }}>{t.health_pct}% of {fmt(t.cap)} cap</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.05)", border: "1px solid #1e2530", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${t.health_pct}%`,
                    background: t.health_pct > 25 ? "#4caf7d" : t.health_pct > 10 ? "#d4873a" : "#e05555",
                    boxShadow: `0 0 8px ${t.health_pct > 25 ? "rgba(76,175,125,0.4)" : t.health_pct > 10 ? "rgba(212,135,58,0.4)" : "rgba(224,85,85,0.5)"}`,
                    transition: "width 0.7s ease",
                  }}
                />
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <TableWrap title="RECENT TRANSACTIONS" headerRight={<Btn sm color="ghost" onClick={load}>↻ Refresh</Btn>}>
            {recentTx.length === 0 ? (
              <EmptyState text="No recent transactions" />
            ) : (
              <div style={{ padding: "4px 0" }}>
                {recentTx.map((tx, i) => (
                  <div key={i} style={{ display: "flex", gap: 16, alignItems: "center", padding: "8px 16px", borderBottom: "1px solid rgba(30,37,48,0.5)", fontFamily: "var(--f-mono)", fontSize: 11 }}>
                    <span style={{ color: "#6b7280", minWidth: 100 }}>{relTime(tx.timestamp || tx.created_at)}</span>
                    <span style={{ flex: 1, color: "#c8cdd6" }}>{tx.description || tx.type || "—"}</span>
                    <span style={{ color: tx.amount > 0 ? "#4caf7d" : "#e05555", minWidth: 80, textAlign: "right" }}>
                      {tx.amount > 0 ? "+" : ""}{fmt(tx.amount)} 🟤
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TableWrap>
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// SHOP PANEL
// ═══════════════════════════════════════════════════════════════════════
const ShopPanel = ({ toast }) => {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [sub, setSub] = useState("inventory");
  const [editItem, setEditItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [log, setLog] = useState([]);

  // Add item form state
  const [newItem, setNewItem] = useState({ item_id: "", name: "", buy_price: "", sell_price: "", category: "weapons", tier: "common", stock: 5, base_stock: 5, restock_interval_days: 30, variance: 0.3 });

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchApi("/api/admin/shop/items");
      setItems(data.items || []);
    } catch (e) {
      toast("Failed to load items: " + e.message, "error");
    }
    setLoading(false);
  }, [toast]);

  const loadLog = useCallback(async () => {
    try {
      const data = await fetchApi("/api/admin/shop/restock-log");
      setLog(data.log || []);
    } catch (e) {
      toast("Failed to load log", "error");
    }
  }, [toast]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filtered = items.filter((i) => !search || i.name?.toLowerCase().includes(search.toLowerCase()) || i.item_id?.toLowerCase().includes(search.toLowerCase()));
  const totalItems = items.length;
  const outOfStock = items.filter((i) => i.stock === 0).length;
  const lowStock = items.filter((i) => i.stock > 0 && i.stock < 5).length;
  const enabled = items.filter((i) => i.enabled).length;

  const toggleItem = async (item_id, en) => {
    try {
      await postApi("/api/admin/shop/toggle", { item_id, enabled: en });
      toast(en ? "Item enabled" : "Item disabled", "success");
      loadItems();
    } catch (e) { toast("Failed", "error"); }
  };

  const quickSetStock = async (item_id, val) => {
    const amount = parseInt(val);
    if (isNaN(amount) || amount < 0) return;
    try {
      await postApi("/api/admin/shop/stock", { item_id, mode: "set", amount, note: "Quick edit" });
      toast("Stock updated", "success");
      loadItems();
    } catch (e) { toast("Failed", "error"); }
  };

  const saveEdit = async () => {
    if (!editItem) return;
    try {
      await postApi("/api/admin/shop/item", editItem);
      toast("Item updated", "success");
      setEditItem(null);
      loadItems();
    } catch (e) { toast("Failed to save", "error"); }
  };

  const addItem = async () => {
    if (!newItem.item_id || !newItem.name) { toast("Item ID and name required", "error"); return; }
    try {
      await postApi("/api/admin/shop/item", { ...newItem, buy_price: parseInt(newItem.buy_price) || null, sell_price: parseInt(newItem.sell_price) || null, enabled: 1 });
      toast(`${newItem.name} added to shop!`, "success");
      setNewItem({ item_id: "", name: "", buy_price: "", sell_price: "", category: "weapons", tier: "common", stock: 5, base_stock: 5, restock_interval_days: 30, variance: 0.3 });
      loadItems();
    } catch (e) { toast(e.message || "Error", "error"); }
  };

  const triggerFullRestock = async (note) => {
    try {
      const data = await postApi("/api/admin/shop/restock-all", { note: note || "Admin restock" });
      toast(`Restocked ${data.restocked?.length || 0} items!`, "success");
      loadItems();
    } catch (e) { toast("Restock failed", "error"); }
  };

  const navItems = [
    { id: "inventory", icon: "📦", label: "Inventory" },
    { id: "restock", icon: "🔄", label: "Restock" },
    { id: "add-item", icon: "➕", label: "Add Item" },
    { id: "stock-log", icon: "📋", label: "Stock Log", onShow: loadLog },
  ];

  return (
    <div>
      {/* Sub nav */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
        {navItems.map((n) => (
          <button
            key={n.id}
            onClick={() => { setSub(n.id); n.onShow?.(); }}
            style={{
              padding: "8px 16px",
              background: sub === n.id ? "rgba(200,168,75,0.08)" : "transparent",
              border: `1px solid ${sub === n.id ? "#c8a84b" : "#1e2530"}`,
              color: sub === n.id ? "#c8a84b" : "#6b7280",
              fontFamily: "var(--f-mono)",
              fontSize: 11,
              letterSpacing: 1,
              textTransform: "uppercase",
              cursor: "pointer",
              borderRadius: 2,
            }}
          >
            {n.icon} {n.label}
          </button>
        ))}
      </div>

      {/* INVENTORY */}
      {sub === "inventory" && (
        <>
          <PageTitle title="INVENTORY" sub="manage stock levels and item availability" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
            <StatCard label="Total Items" value={totalItems} />
            <StatCard label="Out of Stock" value={outOfStock} color="#e05555" />
            <StatCard label="Low Stock (<5)" value={lowStock} color="#c8a84b" />
            <StatCard label="Enabled" value={enabled} color="#4caf7d" />
          </div>
          <TableWrap
            title="ITEMS"
            headerRight={
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder="search items..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ background: "#080a0c", border: "1px solid #1e2530", color: "#c8cdd6", padding: "8px 14px", fontFamily: "var(--f-mono)", fontSize: 12, outline: "none", borderRadius: 2, width: 200 }}
                />
                <Btn sm onClick={loadItems}>↻ Refresh</Btn>
              </div>
            }
          >
            {loading ? (
              <EmptyState text="Loading..." />
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["", "Item", "Category", "Tier", "Buy", "Sell", "Stock", "Base", "Actions"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#6b7280", fontFamily: "var(--f-mono)", fontWeight: 400, borderBottom: "1px solid #1e2530", background: "rgba(0,0,0,0.2)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.item_id} style={{ borderBottom: "1px solid rgba(30,37,48,0.5)" }}>
                      <td style={{ padding: "10px 16px" }}>
                        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: item.enabled ? "#4caf7d" : "#4a5568", boxShadow: item.enabled ? "0 0 6px #4caf7d" : "none" }} />
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ fontWeight: 500 }}>{item.name}</div>
                        <div style={{ fontFamily: "var(--f-mono)", fontSize: 10, color: "#6b7280" }}>{item.item_id}</div>
                      </td>
                      <td style={{ padding: "10px 16px" }}><Badge text={item.category} bg="rgba(255,255,255,0.05)" color="#6b7280" /></td>
                      <td style={{ padding: "10px 16px" }}>
                        {(() => { const tc = tierColors[item.tier] || tierColors.common; return <Badge text={item.tier || "common"} bg={tc.bg} color={tc.text} />; })()}
                      </td>
                      <td style={{ padding: "10px 16px", fontFamily: "var(--f-mono)" }}>{item.buy_price != null ? `${item.buy_price} 🟤` : "—"}</td>
                      <td style={{ padding: "10px 16px", fontFamily: "var(--f-mono)" }}>{item.sell_price != null ? `${item.sell_price} 🟤` : "—"}</td>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontFamily: "var(--f-mono)", fontSize: 13, color: item.stock === -1 ? "#6b7280" : item.stock === 0 ? "#e05555" : item.stock < 5 ? "#c8a84b" : "#4caf7d" }}>
                            {item.stock === -1 ? "∞" : item.stock}
                          </span>
                          <input
                            type="number"
                            defaultValue={item.stock === -1 ? "" : item.stock}
                            min="0"
                            placeholder="—"
                            onChange={(e) => e.target.value && quickSetStock(item.item_id, e.target.value)}
                            style={{ width: 60, background: "#080a0c", border: "1px solid #1e2530", color: "#c8cdd6", padding: "4px 8px", fontFamily: "var(--f-mono)", fontSize: 12, textAlign: "center", borderRadius: 2 }}
                          />
                        </div>
                      </td>
                      <td style={{ padding: "10px 16px", fontFamily: "var(--f-mono)", color: "#6b7280" }}>{item.base_stock === -1 ? "∞" : item.base_stock}</td>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <Btn sm color="blue" onClick={() => setEditItem({ ...item })}>Edit</Btn>
                          <Btn sm color={item.enabled ? "red" : "green"} onClick={() => toggleItem(item.item_id, item.enabled ? 0 : 1)}>{item.enabled ? "Disable" : "Enable"}</Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TableWrap>

          {/* Edit Modal */}
          {editItem && (
            <div onClick={(e) => e.target === e.currentTarget && setEditItem(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: "#0f1318", border: "1px solid #c8a84b", padding: 32, width: 560, maxWidth: "90vw", position: "relative" }}>
                <button onClick={() => setEditItem(null)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "#6b7280", fontSize: 20, cursor: "pointer" }}>✕</button>
                <h3 style={{ fontFamily: "var(--f-display)", fontSize: 24, letterSpacing: 3, color: "#c8a84b", marginBottom: 24 }}>EDIT ITEM</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <Input label="Buy Price" type="number" value={editItem.buy_price || ""} onChange={(e) => setEditItem({ ...editItem, buy_price: parseInt(e.target.value) || null })} />
                  <Input label="Sell Price" type="number" value={editItem.sell_price || ""} onChange={(e) => setEditItem({ ...editItem, sell_price: parseInt(e.target.value) || null })} />
                  <Select label="Tier" value={editItem.tier || "common"} onChange={(e) => setEditItem({ ...editItem, tier: e.target.value })}>
                    {["common", "uncommon", "rare", "epic", "legendary"].map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                  <Input label="Base Stock" type="number" value={editItem.base_stock ?? 10} onChange={(e) => setEditItem({ ...editItem, base_stock: parseInt(e.target.value) })} />
                  <Input label="Restock Days" type="number" value={editItem.restock_interval_days ?? 30} onChange={(e) => setEditItem({ ...editItem, restock_interval_days: parseInt(e.target.value) })} />
                  <Input label="Variance" type="number" step="0.05" value={editItem.variance ?? 0.3} onChange={(e) => setEditItem({ ...editItem, variance: parseFloat(e.target.value) })} />
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <Btn color="gold" onClick={saveEdit}>Save Changes</Btn>
                  <Btn color="ghost" onClick={() => setEditItem(null)}>Cancel</Btn>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* RESTOCK */}
      {sub === "restock" && (
        <>
          <PageTitle title="RESTOCK" sub="control zombita's supply schedule" />
          <FormBox title="FULL RESTOCK">
            <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 16 }}>
              Triggers a Zombita restock on all enabled items. Each item gets a random amount within its variance range.
            </p>
            <div style={{ fontFamily: "var(--f-mono)", fontSize: 11, color: "#6b7280", padding: "8px 12px", background: "rgba(200,168,75,0.05)", border: "1px solid rgba(200,168,75,0.15)", borderRadius: 2, marginBottom: 16 }}>
              ⚡ Example: base_stock=20, variance=0.3 → Zombita stocks between 14 and 26 units randomly.
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <input id="restock-note" type="text" placeholder="restock note (optional)" style={{ background: "#080a0c", border: "1px solid #1e2530", color: "#c8cdd6", padding: "8px 14px", fontFamily: "var(--f-mono)", fontSize: 12, outline: "none", borderRadius: 2, width: 300 }} />
              <Btn onClick={() => triggerFullRestock(document.getElementById("restock-note")?.value)}>⚡ TRIGGER ZOMBITA RESTOCK</Btn>
            </div>
          </FormBox>
          <FormBox title="SINGLE ITEM RESTOCK">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 120px", gap: 16 }}>
              <Select label="Item" id="single-restock-item">
                {items.filter((i) => i.enabled).map((i) => <option key={i.item_id} value={i.item_id}>{i.name} ({i.stock === -1 ? "∞" : i.stock})</option>)}
              </Select>
              <Select label="Mode" id="single-restock-mode">
                <option value="set">Set to exact</option>
                <option value="add">Add to current</option>
              </Select>
              <Input label="Amount" type="number" id="single-restock-amt" defaultValue="10" min="0" />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 10, color: "transparent" }}>.</label>
                <Btn
                  color="green"
                  onClick={async () => {
                    const item_id = document.getElementById("single-restock-item")?.value;
                    const mode = document.getElementById("single-restock-mode")?.value;
                    const amount = parseInt(document.getElementById("single-restock-amt")?.value);
                    if (!item_id || isNaN(amount)) { toast("Fill in all fields", "error"); return; }
                    try {
                      const data = await postApi("/api/admin/shop/stock", { item_id, mode, amount, note: "Admin single restock" });
                      toast(`Stock updated → ${data.new_stock}`, "success");
                      loadItems();
                    } catch (e) { toast("Failed", "error"); }
                  }}
                >
                  Apply
                </Btn>
              </div>
            </div>
          </FormBox>
        </>
      )}

      {/* ADD ITEM */}
      {sub === "add-item" && (
        <>
          <PageTitle title="ADD ITEM" sub="add a new item to zombita's shop" />
          <FormBox title="ITEM DETAILS">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={{ gridColumn: "1/3" }}><Input label="Item ID (PZ internal ID)" placeholder="Base.Katana" value={newItem.item_id} onChange={(e) => setNewItem({ ...newItem, item_id: e.target.value })} /></div>
              <Input label="Display Name" placeholder="Katana" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
              <Select label="Category" value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}>
                {["food", "medical", "tools", "weapons", "misc"].map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Select label="Tier" value={newItem.tier} onChange={(e) => setNewItem({ ...newItem, tier: e.target.value })}>
                {["common", "uncommon", "rare", "epic", "legendary"].map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
              <Input label="Buy Price (bronze)" type="number" placeholder="5000" value={newItem.buy_price} onChange={(e) => setNewItem({ ...newItem, buy_price: e.target.value })} />
              <Input label="Sell Price" type="number" placeholder="0" value={newItem.sell_price} onChange={(e) => setNewItem({ ...newItem, sell_price: e.target.value })} />
              <Input label="Starting Stock" type="number" value={newItem.stock} onChange={(e) => setNewItem({ ...newItem, stock: parseInt(e.target.value) || 0 })} />
              <Input label="Base Stock" type="number" value={newItem.base_stock} onChange={(e) => setNewItem({ ...newItem, base_stock: parseInt(e.target.value) || 0 })} />
              <Input label="Restock Interval (days)" type="number" value={newItem.restock_interval_days} onChange={(e) => setNewItem({ ...newItem, restock_interval_days: parseInt(e.target.value) || 30 })} />
              <Input label="Variance (0.3 = ±30%)" type="number" step="0.05" value={newItem.variance} onChange={(e) => setNewItem({ ...newItem, variance: parseFloat(e.target.value) || 0.3 })} />
            </div>
            <Btn onClick={addItem}>➕ ADD TO SHOP</Btn>
          </FormBox>
        </>
      )}

      {/* STOCK LOG */}
      {sub === "stock-log" && (
        <>
          <PageTitle title="STOCK LOG" sub="full history of restock events" />
          <TableWrap title="EVENTS" headerRight={<Btn sm color="ghost" onClick={loadLog}>↻ Refresh</Btn>}>
            {log.length === 0 ? (
              <EmptyState text="No log entries" />
            ) : (
              <div style={{ padding: "4px 0" }}>
                {log.map((entry, i) => {
                  const delta = entry.new_stock - entry.old_stock;
                  return (
                    <div key={i} style={{ display: "flex", gap: 16, alignItems: "center", padding: "8px 16px", borderBottom: "1px solid rgba(30,37,48,0.5)", fontFamily: "var(--f-mono)", fontSize: 11 }}>
                      <span style={{ color: "#6b7280", minWidth: 140 }}>{new Date(entry.timestamp * 1000).toLocaleString()}</span>
                      <span style={{ color: "#c8cdd6", flex: 1 }}>{entry.name || entry.item_id}</span>
                      <Badge text={entry.restock_type} bg={entry.restock_type === "auto" ? "rgba(74,143,196,0.2)" : "rgba(200,168,75,0.2)"} color={entry.restock_type === "auto" ? "#4a8fc4" : "#c8a84b"} />
                      <span style={{ color: "#6b7280", fontSize: 11, flex: 1 }}>{entry.note || ""}</span>
                      <span style={{ color: delta < 0 ? "#e05555" : "#4caf7d", minWidth: 80, textAlign: "right" }}>{delta >= 0 ? "+" : ""}{delta} → {entry.new_stock}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </TableWrap>
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// TREASURY PANEL
// ═══════════════════════════════════════════════════════════════════════
const TreasuryPanel = ({ toast }) => {
  const [sub, setSub] = useState("overview");
  const [treasury, setTreasury] = useState(null);
  const [stats24, setStats24] = useState(null);
  const [log, setLog] = useState([]);
  const [logFilter, setLogFilter] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      const data = await fetchApi("/api/treasury/admin/overview");
      setTreasury(data.treasury);
      setStats24(data.stats_24h);
    } catch (e) { toast("Failed to load treasury", "error"); }
  }, [toast]);

  const loadLog = useCallback(async (filter) => {
    try {
      const qs = filter ? `&event_type=${filter}` : "";
      const data = await fetchApi(`/api/treasury/admin/log?limit=200${qs}`);
      setLog(data.log || []);
    } catch (e) { toast("Failed to load log", "error"); }
  }, [toast]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const t = treasury;
  const s = stats24;

  const doAdjust = async () => {
    const amount = parseInt(document.getElementById("adj-amt")?.value);
    const reason = document.getElementById("adj-reason")?.value || (amount > 0 ? "Admin top-up" : "Admin drain");
    if (!amount) { toast("Enter a non-zero amount", "error"); return; }
    try {
      await postApi("/api/treasury/admin/adjust", { amount, reason });
      toast(`Adjusted ${amount > 0 ? "+" : ""}${fmt(amount)} 🟤`, "success");
      loadOverview();
    } catch (e) { toast("Failed: " + e.message, "error"); }
  };

  const doPayout = async () => {
    const discord_id = parseInt(document.getElementById("pay-id")?.value);
    const amount = parseInt(document.getElementById("pay-amt")?.value);
    const reason = document.getElementById("pay-reason")?.value || "Admin payout";
    if (!discord_id) { toast("Enter a Discord ID", "error"); return; }
    if (!amount || amount <= 0) { toast("Enter a valid amount", "error"); return; }
    try {
      const res = await postApi("/api/treasury/admin/payout", { discord_id, amount, reason });
      toast(`Sent ${fmt(amount)} 🟤. Player balance: ${fmt(res.player_balance)} 🟤`, "success");
      loadOverview();
    } catch (e) { toast("Payout failed: " + e.message, "error"); }
  };

  const navItems = [
    { id: "overview", icon: "🏦", label: "Overview" },
    { id: "controls", icon: "⚙️", label: "Controls" },
    { id: "payout", icon: "💰", label: "Payout" },
    { id: "log", icon: "📋", label: "Event Log", onShow: () => loadLog(logFilter) },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
        {navItems.map((n) => (
          <button
            key={n.id}
            onClick={() => { setSub(n.id); n.onShow?.(); }}
            style={{
              padding: "8px 16px",
              background: sub === n.id ? "rgba(200,168,75,0.08)" : "transparent",
              border: `1px solid ${sub === n.id ? "#c8a84b" : "#1e2530"}`,
              color: sub === n.id ? "#c8a84b" : "#6b7280",
              fontFamily: "var(--f-mono)",
              fontSize: 11,
              letterSpacing: 1,
              textTransform: "uppercase",
              cursor: "pointer",
              borderRadius: 2,
            }}
          >
            {n.icon} {n.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {sub === "overview" && t && (
        <>
          <PageTitle title="TREASURY" sub="economy health and balance overview" />
          {/* Hero */}
          <div style={{ background: "#0f1318", border: "1px solid #1e2530", padding: "28px 32px", marginBottom: 28, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #c8a84b, transparent)" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 40, alignItems: "start" }}>
              <div>
                <div style={{ fontFamily: "var(--f-mono)", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#6b7280", marginBottom: 10 }}>CURRENT BALANCE</div>
                <div style={{ fontFamily: "var(--f-display)", fontSize: 60, letterSpacing: 4, color: t.health_pct < 10 ? "#e05555" : t.health_pct < 25 ? "#d4873a" : "#c8a84b", textShadow: `0 0 30px rgba(200,168,75,0.3)`, lineHeight: 1 }}>
                  {fmt(t.balance)} 🟤
                </div>
                <div style={{ marginTop: 20 }}>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.05)", border: "1px solid #1e2530", overflow: "hidden", marginBottom: 6 }}>
                    <div style={{ height: "100%", width: `${t.health_pct}%`, background: t.health_pct > 25 ? "#4caf7d" : t.health_pct > 10 ? "#d4873a" : "#e05555", transition: "width 0.7s" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--f-mono)", fontSize: 10, color: "#6b7280" }}>
                    <span>{t.health_pct}% of cap</span>
                    <span>{fmt(t.cap)}</span>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right", minWidth: 180 }}>
                <div style={{ display: "inline-block", fontFamily: "var(--f-mono)", fontSize: 10, letterSpacing: 2, padding: "4px 12px", borderRadius: 2, marginBottom: 20, background: t.model === "B" ? "rgba(76,175,125,0.1)" : "rgba(224,85,85,0.1)", border: `1px solid ${t.model === "B" ? "rgba(76,175,125,0.3)" : "rgba(224,85,85,0.3)"}`, color: t.model === "B" ? "#4caf7d" : "#e05555" }}>
                  {t.model === "B" ? "♻ MODEL B — CIRCULATING" : "🔥 MODEL A — HARD CAP"}
                </div>
                <div style={{ fontFamily: "var(--f-mono)", fontSize: 10, letterSpacing: 2, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>CYCLE REMAINING</div>
                <div style={{ fontFamily: "var(--f-display)", fontSize: 24, letterSpacing: 2, color: "#c8cdd6" }}>
                  {t.cycle_days_remaining > 0 ? `${t.cycle_days_remaining}d left` : "OVERDUE"}
                </div>
              </div>
            </div>
          </div>

          {/* 24h Stats */}
          {s && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
              <StatCard label="Paid Out (24h)" value={`${fmt(s.paid_out)} 🟤`} color="#4caf7d" sub={`${s.payout_count} payouts`} />
              <StatCard label="Burned (24h)" value={`${fmt(s.burned)} 🟤`} color="#e05555" sub={`${s.burn_count} burns`} />
              <StatCard label="Recycled (24h)" value={`${fmt(s.recycled)} 🟤`} color="#d4873a" />
              <StatCard label="Total Paid (Cycle)" value={`${fmt(t.total_paid_out)} 🟤`} color="#4a8fc4" />
            </div>
          )}
        </>
      )}

      {/* CONTROLS */}
      {sub === "controls" && (
        <>
          <PageTitle title="CONTROLS" sub="adjust treasury configuration" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <FormBox title="ADJUST BALANCE">
              <Input label="Amount (+/-)" type="number" id="adj-amt" placeholder="e.g. 10000 or -5000" />
              <div style={{ marginTop: 12 }}><Input label="Reason" id="adj-reason" placeholder="Admin top-up" /></div>
              <div style={{ marginTop: 16 }}><Btn onClick={doAdjust}>Apply Adjustment</Btn></div>
            </FormBox>
            <FormBox title="SET CAP">
              <Input label="New Cap" type="number" id="cap-val" placeholder="e.g. 500000" />
              <div style={{ marginTop: 16 }}>
                <Btn onClick={async () => {
                  const cap = parseInt(document.getElementById("cap-val")?.value);
                  if (!cap || cap < 1000) { toast("Min cap is 1,000", "error"); return; }
                  try { await postApi("/api/treasury/admin/config", { cap }); toast(`Cap → ${fmt(cap)}`, "success"); loadOverview(); } catch (e) { toast(e.message, "error"); }
                }}>Set Cap</Btn>
              </div>
            </FormBox>
            <FormBox title="ECONOMY MODEL">
              <Select label="Model" id="model-select" defaultValue={t?.model || "B"}>
                <option value="A">Model A — Hard Cap</option>
                <option value="B">Model B — Circulating</option>
              </Select>
              <div style={{ marginTop: 16 }}>
                <Btn onClick={async () => {
                  const model = document.getElementById("model-select")?.value;
                  try { await postApi("/api/treasury/admin/config", { model }); toast(`Model → ${model === "B" ? "Circulating" : "Hard Cap"}`, "success"); loadOverview(); } catch (e) { toast(e.message, "error"); }
                }}>Set Model</Btn>
              </div>
            </FormBox>
            <FormBox title="CYCLE RESET">
              <div style={{ fontFamily: "var(--f-mono)", fontSize: 11, color: "#e05555", padding: "10px 14px", background: "rgba(224,85,85,0.05)", border: "1px solid rgba(224,85,85,0.2)", borderRadius: 2, marginBottom: 16, lineHeight: 1.7 }}>
                ⚠ This resets the treasury cycle. Balance resets to cap. All cycle stats clear.
              </div>
              <Input label="New Balance (optional, defaults to cap)" type="number" id="reset-bal" placeholder="leave empty for cap" />
              <div style={{ marginTop: 16 }}>
                <Btn color="red" onClick={() => setShowResetModal(true)}>🔄 Reset Cycle</Btn>
              </div>
            </FormBox>
          </div>

          {showResetModal && (
            <div onClick={(e) => e.target === e.currentTarget && setShowResetModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: "#0f1318", border: "1px solid #c8a84b", padding: 32, width: 480, maxWidth: "90vw" }}>
                <h3 style={{ fontFamily: "var(--f-display)", fontSize: 24, letterSpacing: 3, color: "#c8a84b", marginBottom: 16 }}>CONFIRM CYCLE RESET</h3>
                <p style={{ fontFamily: "var(--f-mono)", fontSize: 12, color: "#6b7280", lineHeight: 1.7, marginBottom: 24 }}>
                  This will reset the cycle and restore the balance. Are you sure?
                </p>
                <div style={{ display: "flex", gap: 12 }}>
                  <Btn color="red" onClick={async () => {
                    const bal = document.getElementById("reset-bal")?.value;
                    try {
                      await postApi("/api/treasury/admin/reset-cycle", bal ? { new_balance: parseInt(bal) } : {});
                      toast("Cycle reset!", "success");
                      setShowResetModal(false);
                      loadOverview();
                    } catch (e) { toast(e.message, "error"); setShowResetModal(false); }
                  }}>Confirm Reset</Btn>
                  <Btn color="ghost" onClick={() => setShowResetModal(false)}>Cancel</Btn>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* PAYOUT */}
      {sub === "payout" && (
        <>
          <PageTitle title="PAYOUT" sub="send coins from treasury to a player" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <FormBox title="SEND COINS">
              <Input label="Discord ID" type="number" id="pay-id" placeholder="e.g. 228533264174940160" />
              <div style={{ marginTop: 12 }}><Input label="Amount" type="number" id="pay-amt" placeholder="e.g. 500" /></div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {[100, 250, 500, 1000, 2500, 5000].map((n) => (
                  <button key={n} onClick={() => { const el = document.getElementById("pay-amt"); if (el) el.value = n; }} style={{ padding: "3px 10px", borderRadius: 2, border: "1px solid #1e2530", background: "transparent", color: "#6b7280", fontFamily: "var(--f-mono)", fontSize: 10, letterSpacing: 1, cursor: "pointer" }}>{fmt(n)}</button>
                ))}
              </div>
              <div style={{ marginTop: 12 }}><Input label="Reason" id="pay-reason" placeholder="Admin payout" /></div>
              <div style={{ marginTop: 16 }}><Btn color="green" onClick={doPayout}>💰 Send Payout</Btn></div>
            </FormBox>
            {t && (
              <FormBox title="TREASURY SNAPSHOT">
                <div style={{ fontFamily: "var(--f-mono)", fontSize: 12, lineHeight: 2.2, color: "#6b7280" }}>
                  Balance: <span style={{ color: "#c8a84b" }}>{fmt(t.balance)} 🟤</span><br />
                  Health: <span style={{ color: t.health_pct > 25 ? "#4caf7d" : t.health_pct > 10 ? "#d4873a" : "#e05555" }}>{t.health_pct}%</span><br />
                  Model: <span style={{ color: "#c8cdd6" }}>{t.model === "B" ? "Circulating" : "Hard Cap"}</span><br />
                  Cycle: <span style={{ color: "#c8cdd6" }}>{t.cycle_days_remaining}d remaining</span>
                </div>
              </FormBox>
            )}
          </div>
        </>
      )}

      {/* EVENT LOG */}
      {sub === "log" && (
        <>
          <PageTitle title="EVENT LOG" sub="full treasury activity history" />
          <TableWrap
            title="EVENTS"
            headerRight={
              <div style={{ display: "flex", gap: 6 }}>
                {["", "payout", "burn", "recycle", "reset", "adjust"].map((f) => (
                  <button
                    key={f}
                    onClick={() => { setLogFilter(f); loadLog(f); }}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 2,
                      border: `1px solid ${logFilter === f ? "#c8a84b" : "#1e2530"}`,
                      background: logFilter === f ? "rgba(200,168,75,0.05)" : "transparent",
                      color: logFilter === f ? "#c8a84b" : "#6b7280",
                      fontFamily: "var(--f-mono)",
                      fontSize: 10,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    {f || "All"}
                  </button>
                ))}
              </div>
            }
          >
            {log.length === 0 ? (
              <EmptyState text="No events found" />
            ) : (
              <div style={{ padding: "4px 0" }}>
                {log.map((e, i) => {
                  const evColors = { payout: "#4caf7d", burn: "#e05555", recycle: "#d4873a", reset: "#c8a84b", adjust: "#4a8fc4" };
                  const c = evColors[e.event_type] || "#6b7280";
                  const isNeg = e.event_type === "payout" || e.event_type === "burn" || (e.event_type === "adjust" && e.amount <= 0);
                  return (
                    <div key={i} style={{ display: "flex", gap: 16, alignItems: "center", padding: "8px 16px", borderBottom: "1px solid rgba(30,37,48,0.5)", fontFamily: "var(--f-mono)", fontSize: 11 }}>
                      <span style={{ color: "#6b7280", minWidth: 100 }}>{relTime(e.timestamp)}</span>
                      <Badge text={e.event_type} bg={`${c}22`} color={c} />
                      <span style={{ color: "#c8cdd6", flex: 1 }}>{e.reason || "—"}</span>
                      <span style={{ color: "#6b7280", minWidth: 100 }}>{e.player || (e.discord_id ? `#${e.discord_id}` : "—")}</span>
                      <span style={{ color: isNeg ? "#e05555" : "#4caf7d", minWidth: 90, textAlign: "right" }}>{isNeg ? "−" : "+"}{fmt(Math.abs(e.amount))} 🟤</span>
                      <span style={{ color: "#6b7280", minWidth: 80, textAlign: "right" }}>→ {fmt(e.balance_after)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </TableWrap>
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// ECONOMY PANEL
// ═══════════════════════════════════════════════════════════════════════
const EconomyPanel = ({ toast }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchApi("/api/admin/economy/transactions");
      setTransactions(data.transactions || []);
    } catch (e) { toast("Failed to load transactions", "error"); }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const giveCoins = async () => {
    const name = document.getElementById("eco-give-name")?.value;
    const amount = parseInt(document.getElementById("eco-give-amt")?.value);
    if (!name || !amount) { toast("Name and amount required", "error"); return; }
    try {
      await postApi("/api/admin/economy/give", { ingame_name: name, amount });
      toast(`Gave ${fmt(amount)} coins to ${name}`, "success");
      load();
    } catch (e) { toast(e.message, "error"); }
  };

  const takeCoins = async () => {
    const name = document.getElementById("eco-take-name")?.value;
    const amount = parseInt(document.getElementById("eco-take-amt")?.value);
    if (!name || !amount) { toast("Name and amount required", "error"); return; }
    try {
      await postApi("/api/admin/economy/take", { ingame_name: name, amount });
      toast(`Took ${fmt(amount)} coins from ${name}`, "success");
      load();
    } catch (e) { toast(e.message, "error"); }
  };

  return (
    <div>
      <PageTitle title="ECONOMY" sub="player transaction log and coin management" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        <FormBox title="GIVE COINS">
          <Input label="In-Game Name" id="eco-give-name" placeholder="PlayerName" />
          <div style={{ marginTop: 12 }}><Input label="Amount" type="number" id="eco-give-amt" placeholder="500" /></div>
          <div style={{ marginTop: 16 }}><Btn color="green" onClick={giveCoins}>💰 Give Coins</Btn></div>
        </FormBox>
        <FormBox title="TAKE COINS">
          <Input label="In-Game Name" id="eco-take-name" placeholder="PlayerName" />
          <div style={{ marginTop: 12 }}><Input label="Amount" type="number" id="eco-take-amt" placeholder="500" /></div>
          <div style={{ marginTop: 16 }}><Btn color="red" onClick={takeCoins}>🔥 Take Coins</Btn></div>
        </FormBox>
      </div>

      <TableWrap title="TRANSACTION LOG" headerRight={<Btn sm color="ghost" onClick={load}>↻ Refresh</Btn>}>
        {loading ? <EmptyState text="Loading..." /> : transactions.length === 0 ? <EmptyState text="No transactions found" /> : (
          <div style={{ padding: "4px 0", maxHeight: 500, overflowY: "auto" }}>
            {transactions.map((tx, i) => (
              <div key={i} style={{ display: "flex", gap: 16, alignItems: "center", padding: "8px 16px", borderBottom: "1px solid rgba(30,37,48,0.5)", fontFamily: "var(--f-mono)", fontSize: 11 }}>
                <span style={{ color: "#6b7280", minWidth: 100 }}>{relTime(tx.timestamp || tx.created_at)}</span>
                <Badge text={tx.type || "tx"} bg="rgba(200,168,75,0.12)" color="#c8a84b" />
                <span style={{ color: "#c8cdd6", flex: 1 }}>{tx.description || "—"}</span>
                <span style={{ color: tx.amount > 0 ? "#4caf7d" : "#e05555", minWidth: 80, textAlign: "right" }}>
                  {tx.amount > 0 ? "+" : ""}{fmt(tx.amount)} 🟤
                </span>
              </div>
            ))}
          </div>
        )}
      </TableWrap>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// PLAYERS PANEL
// ═══════════════════════════════════════════════════════════════════════
const PlayersPanel = ({ toast }) => {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [playerStats, setPlayerStats] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchApi("/api/players");
      setPlayers(data || []);
    } catch (e) { toast("Failed to load players", "error"); }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const loadPlayer = async (p) => {
    setSelected(p);
    try {
      const data = await fetchApi(`/api/stats/player/${p.discord_id}`);
      setPlayerStats(data);
    } catch (e) { setPlayerStats(null); }
  };

  const filtered = players.filter((p) => {
    const s = search.toLowerCase();
    return !s || p.display_name?.toLowerCase().includes(s) || p.username?.toLowerCase().includes(s) || p.ingame_name?.toLowerCase().includes(s) || String(p.discord_id).includes(s);
  });

  return (
    <div>
      <PageTitle title="PLAYERS" sub="all registered players and their stats" />

      {selected ? (
        <>
          <Btn color="ghost" onClick={() => { setSelected(null); setPlayerStats(null); }}>← Back to list</Btn>
          <div style={{ marginTop: 24 }}>
            <div style={{ fontFamily: "var(--f-display)", fontSize: 36, letterSpacing: 3, color: "#c8a84b" }}>{selected.display_name || "Unknown"}</div>
            {selected.username && <div style={{ fontFamily: "var(--f-mono)", fontSize: 13, color: "#6b7280", marginTop: 4 }}>@{selected.username}</div>}
            <div style={{ fontFamily: "var(--f-mono)", fontSize: 11, color: "#4a5568", marginTop: 4 }}>Discord ID: {selected.discord_id}</div>
            {selected.ingame_name && <div style={{ fontFamily: "var(--f-mono)", fontSize: 11, color: "#4a5568" }}>In-game: {selected.ingame_name}</div>}

            {playerStats && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 24 }}>
                <StatCard label="Balance" value={`${fmt(playerStats.balance)} 🟤`} color="#c8a84b" />
                <StatCard label="Messages" value={fmt(playerStats.messages)} color="#4a8fc4" />
                <StatCard label="Werewolf Wins" value={fmt(playerStats.werewolf_wins)} color="#4caf7d" />
                <StatCard label="RPS Wins" value={fmt(playerStats.rps_wins)} color="#e05555" />
                <StatCard label="Quiz Correct" value={fmt(playerStats.quiz_correct)} color="#4a8fc4" />
                <StatCard label="Werewolf Games" value={fmt(playerStats.werewolf_games)} color="#c8a84b" />
                <StatCard label="RPS Games" value={fmt(playerStats.rps_played)} color="#d4873a" />
                <StatCard label="Coins Earned" value={fmt(playerStats.total_earned)} color="#4caf7d" />
              </div>
            )}
          </div>
        </>
      ) : (
        <TableWrap
          title={`PLAYERS (${filtered.length})`}
          headerRight={
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="search by name, username, id..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ background: "#080a0c", border: "1px solid #1e2530", color: "#c8cdd6", padding: "8px 14px", fontFamily: "var(--f-mono)", fontSize: 12, outline: "none", borderRadius: 2, width: 260 }}
              />
              <Btn sm onClick={load}>↻</Btn>
            </div>
          }
        >
          {loading ? <EmptyState text="Loading..." /> : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Display Name", "Username", "In-Game", "Discord ID", "Balance", "Messages", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#6b7280", fontFamily: "var(--f-mono)", fontWeight: 400, borderBottom: "1px solid #1e2530", background: "rgba(0,0,0,0.2)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((p) => (
                  <tr key={p.discord_id} style={{ cursor: "pointer" }} onClick={() => loadPlayer(p)}>
                    <td style={{ padding: "10px 16px", fontWeight: 500 }}>{p.display_name || "—"}</td>
                    <td style={{ padding: "10px 16px", fontFamily: "var(--f-mono)", fontSize: 12, color: "#6b7280" }}>@{p.username || "—"}</td>
                    <td style={{ padding: "10px 16px", fontFamily: "var(--f-mono)", fontSize: 12 }}>{p.ingame_name || "—"}</td>
                    <td style={{ padding: "10px 16px", fontFamily: "var(--f-mono)", fontSize: 11, color: "#4a5568" }}>{p.discord_id}</td>
                    <td style={{ padding: "10px 16px", fontFamily: "var(--f-mono)" }}>{fmt(p.balance)} 🟤</td>
                    <td style={{ padding: "10px 16px", fontFamily: "var(--f-mono)", color: "#6b7280" }}>{fmt(p.messages)}</td>
                    <td style={{ padding: "10px 16px" }}><Btn sm color="blue">View</Btn></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableWrap>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// GAMES PANEL
// ═══════════════════════════════════════════════════════════════════════
const GamesPanel = ({ toast }) => {
  const [sub, setSub] = useState("werewolf");
  const [werewolfGames, setWerewolfGames] = useState([]);
  const [rpsGames, setRpsGames] = useState([]);
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadWerewolf = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchApi("/api/admin/games/werewolf");
      setWerewolfGames(data.games || []);
    } catch (e) {
      // Endpoint might not exist yet
      console.warn("Werewolf games endpoint not available");
    }
    setLoading(false);
  }, []);

  const loadRankings = useCallback(async () => {
    try {
      const data = await fetchApi("/api/rankings");
      setRankings(data || []);
    } catch (e) { console.warn("Rankings not available"); }
  }, []);

  useEffect(() => { loadWerewolf(); loadRankings(); }, [loadWerewolf, loadRankings]);

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
        {[
          { id: "werewolf", icon: "🐺", label: "Werewolf" },
          { id: "rps", icon: "✊", label: "Rock Paper Scissors" },
          { id: "rankings", icon: "🏆", label: "In-Game Rankings" },
        ].map((n) => (
          <button
            key={n.id}
            onClick={() => setSub(n.id)}
            style={{
              padding: "8px 16px",
              background: sub === n.id ? "rgba(200,168,75,0.08)" : "transparent",
              border: `1px solid ${sub === n.id ? "#c8a84b" : "#1e2530"}`,
              color: sub === n.id ? "#c8a84b" : "#6b7280",
              fontFamily: "var(--f-mono)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer", borderRadius: 2,
            }}
          >
            {n.icon} {n.label}
          </button>
        ))}
      </div>

      {sub === "werewolf" && (
        <>
          <PageTitle title="WEREWOLF" sub="game history and player performance" />
          {loading ? <EmptyState text="Loading..." /> : werewolfGames.length === 0 ? (
            <EmptyState text="No werewolf games found (endpoint may not be available yet — add /api/admin/games/werewolf to api.py)" />
          ) : (
            <TableWrap title={`GAMES (${werewolfGames.length})`}>
              <div style={{ padding: "4px 0" }}>
                {werewolfGames.map((g, i) => (
                  <div key={i} style={{ display: "flex", gap: 16, alignItems: "center", padding: "10px 16px", borderBottom: "1px solid rgba(30,37,48,0.5)", fontFamily: "var(--f-mono)", fontSize: 11 }}>
                    <span style={{ color: "#6b7280", minWidth: 100 }}>{relTime(g.started_at || g.timestamp)}</span>
                    <Badge text={g.winner || "—"} bg="rgba(76,175,125,0.15)" color="#4caf7d" />
                    <span style={{ color: "#c8cdd6", flex: 1 }}>{g.players_count || g.participants?.length || "?"} players</span>
                    <span style={{ color: "#6b7280" }}>{g.duration || "—"}</span>
                  </div>
                ))}
              </div>
            </TableWrap>
          )}
        </>
      )}

      {sub === "rps" && (
        <>
          <PageTitle title="ROCK PAPER SCISSORS" sub="match history" />
          <EmptyState text="RPS game history endpoint needed — add /api/admin/games/rps to api.py to enable this panel" />
        </>
      )}

      {sub === "rankings" && (
        <>
          <PageTitle title="IN-GAME RANKINGS" sub="live server rankings from Project Zomboid" />
          {rankings.length === 0 ? <EmptyState text="No rankings data available" /> : (
            <TableWrap title={`PLAYERS (${rankings.length})`} headerRight={<Btn sm color="ghost" onClick={loadRankings}>↻</Btn>}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["#", "Name", "Kills", "Deaths", "Hours", "K/D"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#6b7280", fontFamily: "var(--f-mono)", fontWeight: 400, borderBottom: "1px solid #1e2530", background: "rgba(0,0,0,0.2)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rankings.sort((a, b) => (b.kills || 0) - (a.kills || 0)).map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: "10px 16px", fontFamily: "var(--f-mono)", color: i < 3 ? "#c8a84b" : "#6b7280" }}>{i + 1}</td>
                      <td style={{ padding: "10px 16px", fontWeight: 500 }}>{r.name}</td>
                      <td style={{ padding: "10px 16px", fontFamily: "var(--f-mono)", color: "#4caf7d" }}>{fmt(r.kills)}</td>
                      <td style={{ padding: "10px 16px", fontFamily: "var(--f-mono)", color: "#e05555" }}>{fmt(r.deaths)}</td>
                      <td style={{ padding: "10px 16px", fontFamily: "var(--f-mono)", color: "#6b7280" }}>{r.hours ? `${r.hours}h` : "—"}</td>
                      <td style={{ padding: "10px 16px", fontFamily: "var(--f-mono)" }}>{r.deaths ? (r.kills / r.deaths).toFixed(2) : r.kills || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// DOTD PANEL (Dawn of the Dead)
// ═══════════════════════════════════════════════════════════════════════
const DotdPanel = ({ toast }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchApi("/api/admin/dotd/config");
      setConfig(data);
    } catch (e) {
      console.warn("DotD config endpoint not available yet");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageTitle title="DAWN OF THE DEAD" sub="zombie horde event configuration" />

      {loading ? <EmptyState text="Loading..." /> : !config ? (
        <FormBox title="ENDPOINT NOT AVAILABLE">
          <p style={{ color: "#6b7280", fontFamily: "var(--f-mono)", fontSize: 12, lineHeight: 1.8 }}>
            The /api/admin/dotd/config endpoint needs to be added to api.py.
            This panel will control: enable/disable, wave count, zombie count, spawn distances, intervals, and trigger/cancel commands.
          </p>
          <div style={{ marginTop: 16 }}>
            <Btn color="gold" onClick={() => toast("Add the DotD admin endpoints to api.py first", "info")}>⚡ Trigger Event (unavailable)</Btn>
          </div>
        </FormBox>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
            <StatCard label="Status" value={config.enabled ? "ACTIVE" : "DISABLED"} color={config.enabled ? "#4caf7d" : "#e05555"} />
            <StatCard label="Last Run" value={config.last_run ? relTime(config.last_run) : "Never"} color="#4a8fc4" />
            <StatCard label="Next Run" value={config.next_run ? relTime(config.next_run) : "—"} color="#c8a84b" />
            <StatCard label="Waves" value={config.waves || "—"} color="#d4873a" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <FormBox title="CONFIGURATION">
              <Input label="Waves per Event" type="number" defaultValue={config.waves || 3} id="dotd-waves" />
              <div style={{ marginTop: 12 }}><Input label="Zombies per Wave" type="number" defaultValue={config.zombies_per_wave || 20} id="dotd-zombies" /></div>
              <div style={{ marginTop: 12 }}><Input label="Wave Interval (seconds)" type="number" defaultValue={config.wave_interval || 60} id="dotd-interval" /></div>
              <div style={{ marginTop: 12 }}><Input label="Min Spawn Distance" type="number" defaultValue={config.min_distance || 50} id="dotd-min-dist" /></div>
              <div style={{ marginTop: 12 }}><Input label="Max Spawn Distance" type="number" defaultValue={config.max_distance || 150} id="dotd-max-dist" /></div>
              <div style={{ marginTop: 16 }}>
                <Btn onClick={async () => {
                  try {
                    await postApi("/api/admin/dotd/update", {
                      waves: parseInt(document.getElementById("dotd-waves")?.value),
                      zombies_per_wave: parseInt(document.getElementById("dotd-zombies")?.value),
                      wave_interval: parseInt(document.getElementById("dotd-interval")?.value),
                      min_distance: parseInt(document.getElementById("dotd-min-dist")?.value),
                      max_distance: parseInt(document.getElementById("dotd-max-dist")?.value),
                    });
                    toast("DotD config updated", "success");
                    load();
                  } catch (e) { toast(e.message, "error"); }
                }}>Save Config</Btn>
              </div>
            </FormBox>
            <FormBox title="CONTROLS">
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Btn color={config.enabled ? "red" : "green"} onClick={async () => {
                  try {
                    await postApi("/api/admin/dotd/update", { enabled: !config.enabled });
                    toast(config.enabled ? "DotD disabled" : "DotD enabled", "success");
                    load();
                  } catch (e) { toast(e.message, "error"); }
                }}>
                  {config.enabled ? "🔴 Disable DotD" : "🟢 Enable DotD"}
                </Btn>
                <Btn color="gold" onClick={async () => {
                  try { await postApi("/api/admin/dotd/trigger", {}); toast("DotD event triggered!", "success"); } catch (e) { toast(e.message, "error"); }
                }}>⚡ Trigger Event Now</Btn>
                <Btn color="red" onClick={async () => {
                  try { await postApi("/api/admin/dotd/cancel", {}); toast("DotD event cancelled", "success"); } catch (e) { toast(e.message, "error"); }
                }}>✕ Cancel Current Event</Btn>
              </div>
            </FormBox>
          </div>
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// TREASURE HUNT PANEL
// ═══════════════════════════════════════════════════════════════════════
const HuntPanel = ({ toast }) => {
  const [config, setConfig] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, histRes] = await Promise.allSettled([
        fetchApi("/api/admin/hunt/config"),
        fetchApi("/api/admin/hunt/history"),
      ]);
      if (cfgRes.status === "fulfilled") setConfig(cfgRes.value);
      if (histRes.status === "fulfilled") setHistory(histRes.value.hunts || []);
    } catch (e) { console.warn(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageTitle title="TREASURE HUNT" sub="loot event management and history" />

      {loading ? <EmptyState text="Loading..." /> : !config ? (
        <FormBox title="ENDPOINT NOT AVAILABLE">
          <p style={{ color: "#6b7280", fontFamily: "var(--f-mono)", fontSize: 12, lineHeight: 1.8 }}>
            The /api/admin/hunt/* endpoints need to be added to api.py.
            This panel will control: enable/disable, trigger hunts with type and region, view full history with winners.
          </p>
        </FormBox>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
            <StatCard label="Status" value={config.enabled ? "ACTIVE" : "DISABLED"} color={config.enabled ? "#4caf7d" : "#e05555"} />
            <StatCard label="Total Hunts" value={fmt(history.length)} color="#4a8fc4" />
            <StatCard label="Next Hunt" value={config.next_hunt ? relTime(config.next_hunt) : "—"} color="#c8a84b" />
            <StatCard label="Last Winner" value={history[0]?.winner || "—"} color="#4caf7d" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
            <FormBox title="TRIGGER HUNT">
              <Select label="Hunt Type" id="hunt-type">
                <option value="standard">Standard</option>
                <option value="rare">Rare</option>
                <option value="legendary">Legendary</option>
              </Select>
              <div style={{ marginTop: 12 }}><Input label="Region (optional)" id="hunt-region" placeholder="e.g. Muldraugh" /></div>
              <div style={{ marginTop: 12 }}><Input label="Duration (minutes)" type="number" id="hunt-duration" defaultValue="10" /></div>
              <div style={{ marginTop: 16 }}>
                <Btn color="gold" onClick={async () => {
                  try {
                    await postApi("/api/admin/hunt/trigger", {
                      type: document.getElementById("hunt-type")?.value,
                      region: document.getElementById("hunt-region")?.value,
                      duration: parseInt(document.getElementById("hunt-duration")?.value),
                    });
                    toast("Treasure hunt triggered!", "success");
                    load();
                  } catch (e) { toast(e.message, "error"); }
                }}>🗺️ Start Hunt</Btn>
              </div>
            </FormBox>
            <FormBox title="CONTROLS">
              <Btn color={config.enabled ? "red" : "green"} onClick={async () => {
                try {
                  await postApi("/api/admin/hunt/update", { enabled: !config.enabled });
                  toast(config.enabled ? "Hunts disabled" : "Hunts enabled", "success");
                  load();
                } catch (e) { toast(e.message, "error"); }
              }}>
                {config.enabled ? "🔴 Disable Hunts" : "🟢 Enable Hunts"}
              </Btn>
              <div style={{ marginTop: 12 }}>
                <Btn color="red" onClick={async () => {
                  try { await postApi("/api/admin/hunt/cancel", {}); toast("Hunt cancelled", "success"); } catch (e) { toast(e.message, "error"); }
                }}>✕ Cancel Active Hunt</Btn>
              </div>
            </FormBox>
          </div>

          <TableWrap title="HUNT HISTORY" headerRight={<Btn sm color="ghost" onClick={load}>↻</Btn>}>
            {history.length === 0 ? <EmptyState text="No hunts recorded" /> : (
              <div style={{ padding: "4px 0" }}>
                {history.map((h, i) => (
                  <div key={i} style={{ display: "flex", gap: 16, alignItems: "center", padding: "10px 16px", borderBottom: "1px solid rgba(30,37,48,0.5)", fontFamily: "var(--f-mono)", fontSize: 11 }}>
                    <span style={{ color: "#6b7280", minWidth: 100 }}>{relTime(h.timestamp || h.started_at)}</span>
                    <Badge text={h.type || "standard"} bg={h.type === "legendary" ? "rgba(200,168,75,0.2)" : h.type === "rare" ? "rgba(74,143,196,0.2)" : "rgba(107,114,128,0.2)"} color={h.type === "legendary" ? "#c8a84b" : h.type === "rare" ? "#4a8fc4" : "#9ca3af"} />
                    <span style={{ color: "#c8cdd6", flex: 1 }}>{h.region || "Global"}</span>
                    <span style={{ color: h.winner ? "#4caf7d" : "#6b7280" }}>🏆 {h.winner || "No winner"}</span>
                    <span style={{ color: "#c8a84b" }}>{h.reward ? `${fmt(h.reward)} 🟤` : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </TableWrap>
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// MODS & BROADCAST PANEL
// ═══════════════════════════════════════════════════════════════════════
const ModsPanel = ({ toast }) => {
  const [mods, setMods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [announce, setAnnounce] = useState("");
  const [announceType, setAnnounceType] = useState("info");

  const loadMods = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchApi("/api/admin/mods");
      setMods(data.mods || []);
    } catch (e) { console.warn("Mods endpoint not available"); }
    setLoading(false);
  }, []);

  useEffect(() => { loadMods(); }, [loadMods]);

  const toggleMod = async (mod) => {
    try {
      await fetchApi(`/api/admin/mods/${mod.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !mod.enabled }),
      });
      setMods((prev) => prev.map((m) => m.id === mod.id ? { ...m, enabled: !m.enabled } : m));
      toast(`${mod.name} ${!mod.enabled ? "enabled" : "disabled"}`, "success");
    } catch (e) { toast("Failed to toggle mod", "error"); }
  };

  const sendAnnounce = async () => {
    if (!announce.trim()) return;
    try {
      await postApi("/api/admin/announce", { message: announce, type: announceType });
      toast("Announcement sent!", "success");
      setAnnounce("");
    } catch (e) { toast("Failed to send", "error"); }
  };

  const announceTypes = [
    { id: "info", label: "Info", color: "#4a8fc4" },
    { id: "warning", label: "Warning", color: "#c8a84b" },
    { id: "alert", label: "Alert", color: "#e05555" },
    { id: "event", label: "Event", color: "#6a5acd" },
  ];

  const activeMods = mods.filter((m) => m.enabled).length;

  return (
    <div>
      <PageTitle title="MODS & BROADCAST" sub="manage server mods and send announcements" />
      <FormBox title="BROADCAST ANNOUNCEMENT">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {announceTypes.map((t) => (
            <button key={t.id} onClick={() => setAnnounceType(t.id)} style={{ padding: "4px 16px", fontFamily: "var(--f-mono)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", border: `1px solid ${announceType === t.id ? t.color : "#1e2530"}`, color: announceType === t.id ? t.color : "#6b7280", background: announceType === t.id ? `${t.color}11` : "transparent", cursor: "pointer", borderRadius: 2, transition: "all 0.15s" }}>{t.label}</button>
          ))}
        </div>
        <textarea value={announce} onChange={(e) => setAnnounce(e.target.value)} rows={3} placeholder="Announcement text..." style={{ width: "100%", background: "#080a0c", border: "1px solid #1e2530", color: "#c8cdd6", padding: "12px 16px", fontFamily: "var(--f-mono)", fontSize: 13, outline: "none", borderRadius: 2, resize: "vertical", marginBottom: 16 }} />
        <Btn onClick={sendAnnounce}>📢 Broadcast</Btn>
      </FormBox>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
        <StatCard label="Total Mods" value={mods.length} color="#4a8fc4" />
        <StatCard label="Active" value={activeMods} color="#4caf7d" />
        <StatCard label="Disabled" value={mods.length - activeMods} color="#e05555" />
      </div>
      <TableWrap title={`INSTALLED MODS (${mods.length})`} headerRight={<Btn sm color="ghost" onClick={loadMods}>↻ Refresh</Btn>}>
        {loading ? <EmptyState text="Loading..." /> : mods.length === 0 ? <EmptyState text="No mods found" /> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["", "Mod Name", "Workshop ID", "Description", "Actions"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#6b7280", fontFamily: "var(--f-mono)", fontWeight: 400, borderBottom: "1px solid #1e2530", background: "rgba(0,0,0,0.2)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mods.map((mod) => (
                <tr key={mod.id} style={{ opacity: mod.enabled ? 1 : 0.5, borderBottom: "1px solid rgba(30,37,48,0.5)" }}>
                  <td style={{ padding: "10px 16px" }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: mod.enabled ? "#4caf7d" : "#4a5568", boxShadow: mod.enabled ? "0 0 6px #4caf7d" : "none" }} /></td>
                  <td style={{ padding: "10px 16px", fontWeight: 500 }}>{mod.name}</td>
                  <td style={{ padding: "10px 16px" }}><a href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.workshop_id}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--f-mono)", fontSize: 11, color: "#4a8fc4", textDecoration: "none" }}>{mod.workshop_id}</a></td>
                  <td style={{ padding: "10px 16px", color: "#6b7280", fontSize: 12 }}>{mod.description || "—"}</td>
                  <td style={{ padding: "10px 16px" }}><Btn sm color={mod.enabled ? "red" : "green"} onClick={() => toggleMod(mod)}>{mod.enabled ? "Disable" : "Enable"}</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableWrap>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════
const NAV_ITEMS = [
  { section: "Command" },
  { id: "overview", icon: "📊", label: "Overview" },
  { section: "Economy" },
  { id: "shop", icon: "🛒", label: "Shop" },
  { id: "treasury", icon: "🏦", label: "Treasury" },
  { id: "economy", icon: "💰", label: "Transactions" },
  { section: "Events" },
  { id: "dotd", icon: "💀", label: "Dawn of Dead" },
  { id: "hunt", icon: "🗺️", label: "Treasure Hunt" },
  { section: "Data" },
  { id: "players", icon: "👥", label: "Players" },
  { id: "games", icon: "🎮", label: "Games" },
  { section: "Server" },
  { id: "mods", icon: "🧩", label: "Mods & Broadcast" },
];

export default function AdminPanel() {
  const [page, setPage] = useState("overview");
  const [authed, setAuthed] = useState(null);
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const toast = useCallback((msg, type = "info") => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchApi("/auth/me");
        if (data.is_admin) setAuthed(data);
        else setAuthed(false);
      } catch {
        setAuthed(false);
      }
    })();
  }, []);

  if (authed === null) {
    return (
      <div style={{ fontFamily: "'Inter', sans-serif", background: "#080a0c", color: "#c8cdd6", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 14, color: "#6b7280", letterSpacing: 2 }}>AUTHENTICATING...</div>
      </div>
    );
  }

  if (authed === false) {
    return (
      <div style={{ fontFamily: "'Inter', sans-serif", background: "#080a0c", color: "#c8cdd6", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ fontSize: 64 }}>💀</div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 4, color: "#e05555" }}>ACCESS DENIED</div>
        <div style={{ color: "#6b7280", fontFamily: "'Share Tech Mono', monospace", fontSize: 12 }}>you are not supposed to be here.</div>
        <a href="/" style={{ marginTop: 16, padding: "8px 16px", border: "1px solid #1e2530", color: "#6b7280", fontFamily: "'Share Tech Mono', monospace", fontSize: 11, letterSpacing: 1, textDecoration: "none", borderRadius: 2 }}>← back to safety</a>
      </div>
    );
  }

  const panels = {
    overview: OverviewPanel,
    shop: ShopPanel,
    treasury: TreasuryPanel,
    economy: EconomyPanel,
    players: PlayersPanel,
    games: GamesPanel,
    dotd: DotdPanel,
    hunt: HuntPanel,
    mods: ModsPanel,
  };

  const ActivePanel = panels[page] || OverviewPanel;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Bebas+Neue&family=Inter:wght@300;400;500&display=swap');
        :root {
          --f-mono: 'Share Tech Mono', monospace;
          --f-display: 'Bebas Neue', sans-serif;
          --f-body: 'Inter', sans-serif;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; }
        @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #080a0c; }
        ::-webkit-scrollbar-thumb { background: #1e2530; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #2a3442; }
      `}</style>

      <div style={{ fontFamily: "var(--f-body)", background: "#080a0c", color: "#c8cdd6", minHeight: "100vh", fontSize: 14, position: "relative" }}>
        {/* Scanline overlay */}
        <div style={{ position: "fixed", inset: 0, background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)", pointerEvents: "none", zIndex: 1000 }} />

        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 32px", borderBottom: "1px solid #1e2530", background: "#0f1318", position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ fontFamily: "var(--f-display)", fontSize: 28, letterSpacing: 3, color: "#c8a84b", textShadow: "0 0 20px rgba(200,168,75,0.4)" }}>ZOMBITA'S DEN</div>
          <div style={{ fontFamily: "var(--f-mono)", fontSize: 10, padding: "3px 8px", background: "#7b3f3f", color: "#fff", letterSpacing: 2, borderRadius: 2 }}>ADMIN</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: "var(--f-mono)", fontSize: 11, color: "#6b7280" }}>
            logged in as <span style={{ color: "#4caf7d" }}>{authed.username}</span>
          </div>
        </header>

        {/* Shell */}
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: "calc(100vh - 57px)" }}>
          {/* Nav */}
          <nav style={{ background: "#0f1318", borderRight: "1px solid #1e2530", padding: "24px 0", overflowY: "auto", height: "calc(100vh - 57px)" }}>
            {NAV_ITEMS.map((item, i) =>
              item.section ? (
                <div key={i}>
                  {i > 0 && <div style={{ height: 1, background: "#1e2530", margin: "16px 20px" }} />}
                  <div style={{ padding: "8px 20px 4px", fontSize: 9, letterSpacing: 2, color: "#4a5568", textTransform: "uppercase" }}>{item.section}</div>
                </div>
              ) : (
                <a
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 20px",
                    color: page === item.id ? "#c8a84b" : "#6b7280",
                    textDecoration: "none",
                    fontSize: 12,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    borderLeft: `2px solid ${page === item.id ? "#c8a84b" : "transparent"}`,
                    background: page === item.id ? "rgba(200,168,75,0.05)" : "transparent",
                  }}
                >
                  <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{item.icon}</span>
                  {item.label}
                </a>
              )
            )}

            <div style={{ height: 1, background: "#1e2530", margin: "16px 20px" }} />
            <div style={{ padding: "8px 20px 4px", fontSize: 9, letterSpacing: 2, color: "#4a5568", textTransform: "uppercase" }}>Links</div>
            <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", color: "#6b7280", textDecoration: "none", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", fontWeight: 500 }}>
              <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>🏠</span> Home
            </a>
          </nav>

          {/* Main */}
          <main style={{ padding: 32, overflowY: "auto", height: "calc(100vh - 57px)" }}>
            <ActivePanel toast={toast} />
          </main>
        </div>

        <ToastContainer toasts={toasts} />
      </div>
    </>
  );
}
