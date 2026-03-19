"use client";
// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { fetchApi, postApi, fmt, relTime, fmtDate, Title, SC, TW, B, Inp, FB, Empty, Load } from "./shared";

const SHOPS = {
  food:     { label: "🍽️ Maya's Kitchen",   npc: "Maya Chen"    },
  weapons:  { label: "⚔️ Viktor's Armory",   npc: "Viktor Rask"  },
  carparts: { label: "🔧 Sera's Garage",      npc: "Sera Okafor"  },
  gas:      { label: "⛽ Gas Stations",       npc: "Various"      },
  all:      { label: "🏪 Community Hub",      npc: "Lena Vasquez" },
};

const TIER_COLOR = {
  common: "#6b7280", uncommon: "#4caf7d", rare: "#4a8fc4", legendary: "#c8a84b",
};

function timeUntil(ts) {
  const diff = ts - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "Restocking soon";
  const d = Math.floor(diff / 86400), h = Math.floor((diff % 86400) / 3600);
  return d > 0 ? `~${d}d ${h}h` : `~${h}h ${Math.floor((diff % 3600) / 60)}m`;
}

// ── ROTATION PANEL ────────────────────────────────────────────────────────────
function RotationPanel({ toast }) {
  const [rotations,  setRotations]  = useState({});
  const [nextTimes,  setNextTimes]  = useState({});
  const [loading,    setLoading]    = useState(true);
  const [forcing,    setForcing]    = useState(null);
  const [activeShop, setActiveShop] = useState("food");

  const load = useCallback(async () => {
    try {
      const d = await fetchApi("/api/marketplace/all-rotations");
      setRotations(d.rotations || {});
      setNextTimes(d.next_times || {});
    } catch (e) { toast(e.message, "error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const forceRotate = async (shopType) => {
    if (!confirm(`Force rotate ${SHOPS[shopType]?.npc}'s shop? This will pick a new random selection immediately.`)) return;
    setForcing(shopType);
    try {
      const d = await postApi("/api/admin/marketplace/force-rotate", { shop_type: shopType });
      toast(`✅ ${SHOPS[shopType]?.npc}'s shop rotated — ${d.items?.length || 0} items`, "success");
      load();
    } catch (e) { toast(e.message, "error"); }
    finally { setForcing(null); }
  };

  if (loading) return <Load />;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {Object.entries(SHOPS).map(([k, v]) => (
          <button key={k} onClick={() => setActiveShop(k)}
            className={`ap-b ap-b-sm ${activeShop === k ? "ap-b-gold" : "ap-b-grey"}`}>
            {v.label}
          </button>
        ))}
      </div>

      {Object.entries(SHOPS).filter(([k]) => k === activeShop).map(([shopType, shopInfo]) => {
        const items   = rotations[shopType] || [];
        const nextRot = nextTimes[shopType];
        return (
          <div key={shopType}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div>
                <div className="ap-title" style={{ fontSize: 14, marginBottom: 2 }}>{shopInfo.npc}</div>
                <div className="ap-sub">{items.length} items · Next restock: {nextRot ? timeUntil(nextRot) : "—"}</div>
              </div>
              <div style={{ flex: 1 }} />
              <B c="orange" sm onClick={() => forceRotate(shopType)} disabled={forcing === shopType}>
                {forcing === shopType ? "Rotating..." : "🔄 Force Rotate"}
              </B>
            </div>

            {items.length === 0 ? (
              <Empty text="No items in rotation" />
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["Item", "ID", "Buy Price", "Sell Price", "Tier"].map(h => (
                      <th key={h} className="admin-th">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.item_id}>
                      <td className="admin-td" style={{ color: TIER_COLOR[item.tier] || "#9ca3af", fontWeight: 500 }}>{item.name}</td>
                      <td className="admin-td"><code style={{ fontSize: 11, color: "#555" }}>{item.item_id}</code></td>
                      <td className="admin-td">{item.buy != null ? `${item.buy.toLocaleString()} 🟤` : "—"}</td>
                      <td className="admin-td">{item.sell != null ? `${item.sell.toLocaleString()} 🟤` : "—"}</td>
                      <td className="admin-td">
                        <span style={{ color: TIER_COLOR[item.tier], fontSize: 11, textTransform: "capitalize" }}>
                          {item.tier}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── LISTINGS PANEL ────────────────────────────────────────────────────────────
function ListingsPanel({ toast }) {
  const [listings, setListings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");

  const load = useCallback(async () => {
    try {
      const d = await fetchApi("/api/admin/marketplace/listings");
      setListings(d.listings || []);
    } catch (e) { toast(e.message, "error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cancelListing = async (listing_id) => {
    if (!confirm(`Cancel listing ${listing_id}?`)) return;
    try {
      await postApi("/api/admin/marketplace/cancel", { listing_id });
      toast("Listing cancelled", "success");
      load();
    } catch (e) { toast(e.message, "error"); }
  };

  const filtered = listings.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.item_name?.toLowerCase().includes(q) || l.seller_name?.toLowerCase().includes(q) || l.listing_id?.toLowerCase().includes(q);
  });

  if (loading) return <Load />;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
        <input className="ap-inp" placeholder="Search item or seller..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ maxWidth: 260 }} />
        <span className="ap-sub">{filtered.length} of {listings.length} listings</span>
        <div style={{ flex: 1 }} />
        <B c="grey" sm onClick={load}>↻ Refresh</B>
      </div>

      {filtered.length === 0 ? (
        <Empty text="No active listings" />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {["ID", "Item", "Seller", "Qty", "Price", "Total", "Listed", "Expires", ""].map(h => (
                <th key={h} className="admin-th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => {
              const total    = l.price_per_unit * l.quantity;
              const expiring = l.expires_at - Math.floor(Date.now() / 1000) < 86400;
              return (
                <tr key={l.listing_id}>
                  <td className="admin-td"><code style={{ fontSize: 10, color: "#555" }}>{l.listing_id}</code></td>
                  <td className="admin-td" style={{ color: TIER_COLOR[l.tier] || "#9ca3af" }}>{l.item_name}</td>
                  <td className="admin-td" style={{ color: "#c8cdd6" }}>{l.seller_name}</td>
                  <td className="admin-td">×{l.quantity}</td>
                  <td className="admin-td">{l.price_per_unit?.toLocaleString()} 🟤</td>
                  <td className="admin-td" style={{ color: "#c8a84b" }}>{total?.toLocaleString()} 🟤</td>
                  <td className="admin-td">{relTime(l.created_at)}</td>
                  <td className="admin-td" style={{ color: expiring ? "#e05555" : "#6b7280" }}>
                    {expiring ? "⚠️ " : ""}{timeUntil(l.expires_at)}
                  </td>
                  <td className="admin-td">
                    <B c="red" sm onClick={() => cancelListing(l.listing_id)}>Cancel</B>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── BANS PANEL ────────────────────────────────────────────────────────────────
function BansPanel({ toast }) {
  const [bans,    setBans]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [lifting, setLifting] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await fetchApi("/api/admin/marketplace/bans");
      setBans(d.bans || []);
    } catch (e) { toast(e.message, "error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const liftBan = async (ingame_name) => {
    if (!confirm(`Lift ban for ${ingame_name}?`)) return;
    setLifting(ingame_name);
    try {
      await postApi("/api/admin/marketplace/lift-ban", { ingame_name });
      toast(`Ban lifted for ${ingame_name}`, "success");
      load();
    } catch (e) { toast(e.message, "error"); }
    finally { setLifting(null); }
  };

  if (loading) return <Load />;

  const active  = bans.filter(b => !b.lifted && b.banned_until > Math.floor(Date.now() / 1000));
  const history = bans.filter(b => b.lifted || b.banned_until <= Math.floor(Date.now() / 1000));

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
          <span style={{ color: "#c8a84b", fontFamily: "monospace", fontSize: 12 }}>
            {active.length} active ban{active.length !== 1 ? "s" : ""}
          </span>
          <div style={{ flex: 1 }} />
          <B c="grey" sm onClick={load}>↻ Refresh</B>
        </div>

        {active.length === 0 ? (
          <Empty text="No active bans" />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 16 }}>
            <thead>
              <tr>
                {["Player", "NPC Attacked", "Reason", "Banned", "Expires", ""].map(h => (
                  <th key={h} className="admin-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active.map(b => (
                <tr key={b.id}>
                  <td className="admin-td" style={{ color: "#e05555", fontWeight: 500 }}>{b.ingame_name}</td>
                  <td className="admin-td">{b.npc_name}</td>
                  <td className="admin-td" style={{ color: "#6b7280" }}>{b.reason}</td>
                  <td className="admin-td">{relTime(b.banned_at)}</td>
                  <td className="admin-td" style={{ color: "#c8a84b" }}>{timeUntil(b.banned_until)}</td>
                  <td className="admin-td">
                    <B c="green" sm onClick={() => liftBan(b.ingame_name)} disabled={lifting === b.ingame_name}>
                      {lifting === b.ingame_name ? "..." : "Lift Ban"}
                    </B>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {history.length > 0 && (
          <>
            <div className="ap-sub" style={{ marginBottom: 8, marginTop: 16 }}>Ban History ({history.length})</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  {["Player", "NPC", "Banned", "Lifted/Expired", "Status"].map(h => (
                    <th key={h} className="admin-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 20).map(b => (
                  <tr key={b.id}>
                    <td className="admin-td" style={{ color: "#888" }}>{b.ingame_name}</td>
                    <td className="admin-td" style={{ color: "#666" }}>{b.npc_name}</td>
                    <td className="admin-td">{fmtDate(b.banned_at)}</td>
                    <td className="admin-td">{b.lifted_at ? fmtDate(b.lifted_at) : fmtDate(b.banned_until)}</td>
                    <td className="admin-td">
                      <span style={{ fontSize: 10, color: b.lifted ? "#4caf7d" : "#6b7280" }}>
                        {b.lifted ? "lifted" : "expired"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

// ── PRICING PANEL ─────────────────────────────────────────────────────────────
function PricingPanel({ toast }) {
  const [overrides,  setOverrides]  = useState({});
  const [history,    setHistory]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [running,    setRunning]    = useState(false);
  const [selItem,    setSelItem]    = useState("");

  const load = useCallback(async () => {
    try {
      const d = await fetchApi("/api/marketplace/prices");
      setOverrides(d.overrides || {});
    } catch (e) { toast(e.message, "error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runPricing = async () => {
    setRunning(true);
    try {
      const d = await postApi("/api/admin/marketplace/run-pricing", {});
      toast(`✅ Pricing pass complete — ${d.repriced} items repriced`, "success");
      load();
    } catch (e) { toast(e.message, "error"); }
    finally { setRunning(false); }
  };

  const loadHistory = async (item_id) => {
    setSelItem(item_id);
    try {
      const d = await fetchApi(`/api/admin/marketplace/price-history?item_id=${encodeURIComponent(item_id)}&limit=10`);
      setHistory(d.history || []);
    } catch (e) { toast(e.message, "error"); }
  };

  if (loading) return <Load />;

  const entries = Object.entries(overrides);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div className="ap-sub">{entries.length} items with dynamic prices</div>
        <div style={{ flex: 1 }} />
        <B c="grey" sm onClick={load}>↻ Refresh</B>
        <B c="orange" sm onClick={runPricing} disabled={running}>
          {running ? "Running..." : "📈 Run Pricing Pass Now"}
        </B>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div className="ap-sub" style={{ marginBottom: 8 }}>Current Overrides</div>
          {entries.length === 0 ? (
            <Empty text="No price overrides yet. Run a pricing pass." />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  {["Item ID", "Buy Price", "Factor", "Updated", ""].map(h => (
                    <th key={h} className="admin-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map(([item_id, ov]) => {
                  const f = ov.factor || 1.0;
                  const up = f > 1.05;
                  const dn = f < 0.95;
                  return (
                    <tr key={item_id}>
                      <td className="admin-td"><code style={{ fontSize: 10 }}>{item_id}</code></td>
                      <td className="admin-td">{ov.buy_price?.toLocaleString()} 🟤</td>
                      <td className="admin-td" style={{ color: up ? "#e05555" : dn ? "#4caf7d" : "#6b7280" }}>
                        {up ? "▲" : dn ? "▼" : "—"} {f.toFixed(2)}×
                      </td>
                      <td className="admin-td">{relTime(ov.computed_at)}</td>
                      <td className="admin-td">
                        <button onClick={() => loadHistory(item_id)}
                          style={{ background: "transparent", border: "none", color: "#4a8fc4", cursor: "pointer", fontSize: 11 }}>
                          history
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <div className="ap-sub" style={{ marginBottom: 8 }}>
            Price History {selItem && <span style={{ color: "#c8a84b" }}>· {selItem}</span>}
          </div>
          {!selItem ? (
            <Empty text="Click 'history' on an item to view its price changes" />
          ) : history.length === 0 ? (
            <Empty text="No history for this item yet" />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  {["Price", "Factor", "Supply", "Demand", "Treasury", "When"].map(h => (
                    <th key={h} className="admin-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td className="admin-td">{h.final_price?.toLocaleString()} 🟤</td>
                    <td className="admin-td" style={{ color: h.final_factor > 1.05 ? "#e05555" : h.final_factor < 0.95 ? "#4caf7d" : "#6b7280" }}>
                      {h.final_factor?.toFixed(2)}×
                    </td>
                    <td className="admin-td">{h.supply_factor?.toFixed(2)}</td>
                    <td className="admin-td">{h.demand_factor?.toFixed(2)}</td>
                    <td className="admin-td">{h.treasury_factor?.toFixed(2)}</td>
                    <td className="admin-td">{relTime(h.computed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MAIN TAB ──────────────────────────────────────────────────────────────────
export default function MarketplaceTab({ toast }) {
  const [sub, setSub] = useState("rotation");

  const SUBS = [
    { key: "rotation", label: "🔄 Rotations"  },
    { key: "listings", label: "📋 Listings"   },
    { key: "bans",     label: "🔨 Bans"       },
    { key: "pricing",  label: "📈 Pricing"    },
  ];

  return (
    <div>
      <Title t="Marketplace & Shop Management" s="Manage rotating stock, player listings, and shop bans" />

      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #1e2530", paddingBottom: 0 }}>
        {SUBS.map(s => (
          <button key={s.key} onClick={() => setSub(s.key)}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: sub === s.key ? "2px solid #c8a84b" : "2px solid transparent",
              color: sub === s.key ? "#c8a84b" : "#555",
              padding: "8px 14px",
              fontFamily: "monospace",
              fontSize: 12,
              cursor: "pointer",
              marginBottom: -1,
              transition: "all 0.15s",
            }}>
            {s.label}
          </button>
        ))}
      </div>

      {sub === "rotation" && <RotationPanel toast={toast} />}
      {sub === "listings" && <ListingsPanel toast={toast} />}
      {sub === "bans"     && <BansPanel     toast={toast} />}
      {sub === "pricing"  && <PricingPanel  toast={toast} />}
    </div>
  );
}
