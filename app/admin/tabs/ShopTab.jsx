"use client";
// @ts-nocheck
import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchApi, postApi, fmt, fmtDate, Title, SC, TW, B, Inp, Sel, FB, Empty, Load } from "./shared";

const SingleRestock = ({ items, toast, onDone }) => {
  const [itemId, setItemId] = useState(""); const [mode, setMode] = useState("set"); const [amount, setAmount] = useState("10");
  const enabled = items.filter(i => i.enabled);
  useEffect(() => { if (enabled.length && !itemId) setItemId(enabled[0]?.item_id || ""); }, [enabled.length]);
  const apply = async () => {
    if (!itemId || isNaN(parseInt(amount))) { toast("Fill fields", "error"); return; }
    try { const d = await postApi("/api/admin/shop/stock", { item_id: itemId, mode, amount: parseInt(amount), note: "Admin restock" }); toast(`Stock → ${d.new_stock}`, "success"); onDone(); }
    catch { toast("Failed", "error"); }
  };
  return (<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 100px", gap: 16, alignItems: "end" }}>
    <Sel label="Item" value={itemId} onChange={e => setItemId(e.target.value)}>{enabled.map(i => <option key={i.item_id} value={i.item_id}>{i.name} ({i.stock === -1 ? "∞" : i.stock})</option>)}</Sel>
    <Sel label="Mode" value={mode} onChange={e => setMode(e.target.value)}><option value="set">Set exact</option><option value="add">Add to current</option></Sel>
    <Inp label="Amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
    <B c="green" onClick={apply}>Apply</B>
  </div>);
};

export default function ShopTab({ toast }) {
  const [sub, setSub] = useState("inventory");
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState(null);
  const [restockLog, setRestockLog] = useState([]);
  const [newItem, setNewItem] = useState({ item_id: "", name: "", buy_price: "", sell_price: "", category: "weapons", tier: "common", stock: "5", base_stock: "5", restock_interval_days: "30", variance: "0.3" });

  const loadItems = useCallback(async () => {
    setLoading(true);
    try { setItems((await fetchApi("/api/admin/shop/items")).items || []); }
    catch (e) { toast("Failed to load", "error"); }
    setLoading(false);
  }, [toast]);
  useEffect(() => { loadItems(); }, [loadItems]);

  const loadLog = useCallback(async () => {
    try { setRestockLog((await fetchApi("/api/admin/shop/restock-log")).log || []); } catch {}
  }, []);

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(q) || i.item_id.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q));
  }, [items, search]);

  const stats = useMemo(() => ({ total: items.length, empty: items.filter(i => i.stock === 0).length, low: items.filter(i => i.stock > 0 && i.stock < 5).length, enabled: items.filter(i => i.enabled).length }), [items]);

  const toggleItem = async (id, en) => { try { await postApi("/api/admin/shop/toggle", { item_id: id, enabled: en }); toast(en ? "Enabled" : "Disabled", "success"); loadItems(); } catch { toast("Failed", "error"); } };
  const quickStock = async (id, val) => { const n = parseInt(val); if (isNaN(n) || n < 0) return; try { await postApi("/api/admin/shop/stock", { item_id: id, mode: "set", amount: n, note: "Quick edit" }); toast("Stock updated", "success"); loadItems(); } catch { toast("Failed", "error"); } };
  const triggerRestock = async () => { if (!confirm("Trigger full Zombita restock?")) return; try { const d = await postApi("/api/admin/shop/restock-all", { note: "Admin triggered" }); toast(`Restocked ${d.restocked?.length || 0} items!`, "success"); loadItems(); } catch { toast("Restock failed", "error"); } };
  const saveEdit = async () => {
    if (!editItem) return;
    try {
      await postApi("/api/admin/shop/item", { item_id: editItem.item_id, name: editItem.name, buy_price: parseInt(editItem.buy_price) || null, sell_price: parseInt(editItem.sell_price) || null, category: editItem.category, tier: editItem.tier, stock: editItem.stock, base_stock: parseInt(editItem.base_stock) ?? 10, restock_interval_days: parseInt(editItem.restock_interval_days) ?? 30, variance: parseFloat(editItem.variance) ?? 0.3, enabled: editItem.enabled });
      toast("Item saved", "success"); setEditItem(null); loadItems();
    } catch (e) { toast("Failed: " + e.message, "error"); }
  };
  const ni = newItem, sni = (k, v) => setNewItem({ ...ni, [k]: v });
  const addItem = async () => {
    if (!ni.item_id || !ni.name) { toast("ID and name required", "error"); return; }
    try {
      await postApi("/api/admin/shop/item", { ...ni, buy_price: parseInt(ni.buy_price) || null, sell_price: parseInt(ni.sell_price) || null, stock: parseInt(ni.stock) || 0, base_stock: parseInt(ni.base_stock) || 0, restock_interval_days: parseInt(ni.restock_interval_days) || 30, variance: parseFloat(ni.variance) || 0.3, enabled: 1 });
      toast(`${ni.name} added!`, "success");
      setNewItem({ item_id: "", name: "", buy_price: "", sell_price: "", category: "weapons", tier: "common", stock: "5", base_stock: "5", restock_interval_days: "30", variance: "0.3" });
      loadItems();
    } catch (e) { toast(e.message, "error"); }
  };
  const stColor = (s) => s === -1 ? "var(--textdim)" : s === 0 ? "var(--red)" : s < 5 ? "var(--accent)" : "var(--green)";
  const tabs = [{ key: "inventory", icon: "📦", label: "Inventory" }, { key: "add", icon: "➕", label: "Add Item" }, { key: "restock", icon: "🔄", label: "Restock" }, { key: "log", icon: "📋", label: "Stock Log" }];

  return (<>
    <Title t="SHOP" s="manage inventory · stock levels · pricing" />
    <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>{tabs.map(t => <button key={t.key} className={`ap-ft ${sub === t.key ? "act" : ""}`} onClick={() => { setSub(t.key); if (t.key === "log") loadLog(); }}>{t.icon} {t.label}</button>)}</div>

    {sub === "inventory" && <>
      <div className="ap-sr"><SC label="Total Items" value={stats.total} /><SC label="Out of Stock" value={stats.empty} color="red" /><SC label="Low Stock" value={stats.low} color="orange" /><SC label="Enabled" value={stats.enabled} color="green" /></div>
      <TW title="ITEMS" right={<><input className="ap-search" placeholder="search items..." value={search} onChange={e => setSearch(e.target.value)} /><B c="gold" sm onClick={loadItems}>↻</B></>}>
        {loading ? <Load /> : <table className="ap-t"><thead><tr><th style={{ width: 40 }}>⚡</th><th>Item</th><th>Category</th><th>Tier</th><th>Buy</th><th>Sell</th><th>Stock</th><th>Base</th><th>Actions</th></tr></thead>
          <tbody>{filtered.length === 0 ? <tr><td colSpan={9}><Empty text="no items found" /></td></tr> : filtered.map(item =>
            <tr key={item.item_id}>
              <td><span className={`ap-dot ${item.enabled ? "on" : "off"}`} /></td>
              <td><div style={{ fontWeight: 500 }}>{item.name}</div><div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)" }}>{item.item_id}</div></td>
              <td><span className="ap-cat">{item.category}</span></td>
              <td><span className={`ap-pill ap-tier-${item.tier || "common"}`}>{item.tier || "common"}</span></td>
              <td style={{ fontFamily: "var(--mono)" }}>{item.buy_price != null ? `${fmt(item.buy_price)} 🟤` : "—"}</td>
              <td style={{ fontFamily: "var(--mono)" }}>{item.sell_price != null ? `${fmt(item.sell_price)} 🟤` : "—"}</td>
              <td><div className="ap-se"><span style={{ fontFamily: "var(--mono)", fontSize: 13, color: stColor(item.stock) }}>{item.stock === -1 ? "∞" : item.stock}</span><input type="number" defaultValue={item.stock === -1 ? "" : item.stock} min="0" placeholder="—" onBlur={e => { if (e.target.value !== "" && parseInt(e.target.value) !== item.stock) quickStock(item.item_id, e.target.value); }} /></div></td>
              <td style={{ fontFamily: "var(--mono)", color: "var(--textdim)" }}>{item.base_stock === -1 ? "∞" : item.base_stock}</td>
              <td><div style={{ display: "flex", gap: 6 }}><B c="blue" sm onClick={() => setEditItem({ ...item })}>Edit</B><B c={item.enabled ? "red" : "green"} sm onClick={() => toggleItem(item.item_id, item.enabled ? 0 : 1)}>{item.enabled ? "Off" : "On"}</B></div></td>
            </tr>
          )}</tbody></table>}
      </TW>
    </>}

    {sub === "add" && <FB title="ADD ITEM">
      <div className="ap-fgrid">
        <div style={{ gridColumn: "1/3" }}><Inp label="Item ID" placeholder="Base.Katana" value={ni.item_id} onChange={e => sni("item_id", e.target.value)} /></div>
        <Inp label="Display Name" placeholder="Katana" value={ni.name} onChange={e => sni("name", e.target.value)} />
        <Sel label="Category" value={ni.category} onChange={e => sni("category", e.target.value)}><option value="food">Food</option><option value="medical">Medical</option><option value="tools">Tools</option><option value="weapons">Weapons</option><option value="misc">Misc</option></Sel>
        <Sel label="Tier" value={ni.tier} onChange={e => sni("tier", e.target.value)}><option value="common">Common</option><option value="uncommon">Uncommon</option><option value="rare">Rare</option><option value="epic">Epic</option><option value="legendary">Legendary</option></Sel>
        <Inp label="Buy Price" type="number" placeholder="5000" value={ni.buy_price} onChange={e => sni("buy_price", e.target.value)} />
        <Inp label="Sell Price" type="number" placeholder="0" value={ni.sell_price} onChange={e => sni("sell_price", e.target.value)} />
        <Inp label="Stock" type="number" value={ni.stock} onChange={e => sni("stock", e.target.value)} />
        <Inp label="Base Stock" type="number" value={ni.base_stock} onChange={e => sni("base_stock", e.target.value)} />
        <Inp label="Restock Days" type="number" value={ni.restock_interval_days} onChange={e => sni("restock_interval_days", e.target.value)} />
        <Inp label="Variance (±%)" type="number" step="0.05" value={ni.variance} onChange={e => sni("variance", e.target.value)} />
      </div>
      <B c="gold" onClick={addItem}>➕ ADD TO SHOP</B>
    </FB>}

    {sub === "restock" && <>
      <FB title="FULL RESTOCK"><div className="ap-note">⚡ Triggers Zombita restock on all enabled items. Random amounts within variance.</div><B c="gold" onClick={triggerRestock}>⚡ TRIGGER ZOMBITA RESTOCK</B></FB>
      <FB title="SINGLE ITEM"><SingleRestock items={items} toast={toast} onDone={loadItems} /></FB>
    </>}

    {sub === "log" && <TW title="STOCK LOG" right={<B c="ghost" sm onClick={loadLog}>↻</B>}>
      {restockLog.length ? <div>{restockLog.map((e, i) => { const d = (e.new_stock || 0) - (e.old_stock || 0); return <div key={i} className="ap-lr"><span className="ap-lr-t">{fmtDate(e.timestamp)}</span><span style={{ color: "var(--text)", flex: 1 }}>{e.name || e.item_id}</span><span className={`ap-pill ${e.restock_type === "auto" ? "ap-tier-rare" : "ap-tier-legendary"}`}>{e.restock_type}</span><span style={{ color: "var(--textdim)", fontSize: 11, flex: 1, fontFamily: "var(--mono)" }}>{e.note || ""}</span><span className={`ap-lr-v ${d < 0 ? "neg" : "pos"}`}>{d >= 0 ? "+" : ""}{d} → {e.new_stock}</span></div>; })}</div> : <Empty text="no log entries" />}
    </TW>}

    {editItem && <div className="ap-mbd" onClick={e => { if (e.target === e.currentTarget) setEditItem(null); }}>
      <div className="ap-mod"><button className="ap-mod-x" onClick={() => setEditItem(null)}>✕</button><h3>EDIT ITEM</h3>
        <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", marginBottom: 20 }}>{editItem.name} — {editItem.item_id}</div>
        <div className="ap-fgrid">
          <Inp label="Buy Price" type="number" value={editItem.buy_price || ""} onChange={e => setEditItem({ ...editItem, buy_price: e.target.value })} />
          <Inp label="Sell Price" type="number" value={editItem.sell_price || ""} onChange={e => setEditItem({ ...editItem, sell_price: e.target.value })} />
          <Sel label="Tier" value={editItem.tier || "common"} onChange={e => setEditItem({ ...editItem, tier: e.target.value })}><option value="common">Common</option><option value="uncommon">Uncommon</option><option value="rare">Rare</option><option value="epic">Epic</option><option value="legendary">Legendary</option></Sel>
          <Inp label="Base Stock" type="number" value={editItem.base_stock ?? ""} onChange={e => setEditItem({ ...editItem, base_stock: e.target.value })} />
          <Inp label="Restock Days" type="number" value={editItem.restock_interval_days ?? ""} onChange={e => setEditItem({ ...editItem, restock_interval_days: e.target.value })} />
          <Inp label="Variance" type="number" step="0.05" value={editItem.variance ?? ""} onChange={e => setEditItem({ ...editItem, variance: e.target.value })} />
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}><B c="gold" onClick={saveEdit}>Save</B><B c="ghost" onClick={() => setEditItem(null)}>Cancel</B></div>
      </div></div>}
  </>);
}
