"use client";
// @ts-nocheck
// Admin SHOP - the live shop network: 8 keepers, the authored catalog, what is on
// each shelf right now, stock, and Zombita's restock decisions.
// Backend: routers/admin_shop_live.py (/api/admin/shop/live/*).
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchApi, postApi, fmt, fmtFull, relTime, bronzeToCoins, Title, SC, TW, B, Inp, Sel, Empty, Load, useStickyState } from "./shared";
import { useLiveRefresh } from "../realtime";

// id MUST equal the backend shop_type. Names mirror ZS_NPCData.lua.
const SHOPS = {
  weapons:   { icon: "⚔️", npc: "Viktor Rask",    label: "Viktor's Armory" },
  mechanic:  { icon: "🔧", npc: "Sera Okafor",    label: "Sera's Garage" },
  medical:   { icon: "🏥", npc: "Dr. Emil Voss",  label: "Dr. Voss's Clinic" },
  gardener:  { icon: "🌱", npc: "Maya Chen",      label: "Maya's Greenhouse" },
  tailor:    { icon: "🧵", npc: "Colette Vance",  label: "Colette's Atelier" },
  librarian: { icon: "📚", npc: "Miles Ashford",  label: "Miles's Library" },
  music:     { icon: "🎵", npc: "Scarlett Vance", label: "Scarlett's Records" },
  melee:     { icon: "🔨", npc: "Bruno Kessler",  label: "Bruno's Workshop" },
  global:    { icon: "⛽", npc: "General stores", label: "General Stores" },
};
const SHOP_ORDER = Object.keys(SHOPS);
const ADD_SHOP_NAMES = { animals: "Hattie's Livestock & Pets" };   // a shop the keeper tables don't list
const shopName = (st) => SHOPS[st] ? `${SHOPS[st].icon} ${SHOPS[st].npc}` : st;

const TIERS = ["common", "uncommon", "rare", "epic", "legendary", "special", "transit"];
const TIER_COLOR = {
  common: "#9ca3af", uncommon: "#4caf7d", rare: "#4a8fc4", epic: "#a06cd5",
  legendary: "#c8a84b", special: "#e0574e", transit: "#3fa9a0",
};
const Tier = ({ t }) => {
  const c = TIER_COLOR[t] || TIER_COLOR.common;
  return <span className="ap-pill" style={{ background: c + "22", color: c }}>{t || "common"}</span>;
};
const Perm = () => <span className="ap-pill" style={{ background: "rgba(200,168,75,0.15)", color: "var(--accent)" }}>★ permanent</span>;

const mono = { fontFamily: "var(--mono)" };
const dim  = { fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)" };

function untilText(ts) {
  if (!ts) return "-";
  const diff = ts - Math.floor(Date.now() / 1000);
  const abs = Math.abs(diff), d = Math.floor(abs / 86400), h = Math.floor((abs % 86400) / 3600), m = Math.floor((abs % 3600) / 60);
  const span = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  return diff >= 0 ? `in ${span}` : `${span} overdue`;
}

const stockColor = (s, max) =>
  s < 0 ? "var(--textdim)" : s === 0 ? "var(--red)" : (max > 0 && s * 3 <= max) ? "var(--accent)" : "var(--green)";

// ── SHOPS: the network at a glance ──────────────────────────────────────────
function ShopsView({ data, toast, onOpenShelf, reload }) {
  const [rolling, setRolling] = useState(null);
  const roll = async (st) => {
    if (!confirm(`Put a new rotation on ${SHOPS[st]?.npc}'s shelf?\n\nEverything except permanents is replaced and stock is refilled. Players see it immediately.`)) return;
    setRolling(st);
    try {
      const d = await postApi("/api/admin/shop/live/roll", { shop_type: st });
      toast(`${SHOPS[st]?.npc}: ${d.items} items on the shelf, ${d.repriced} prices refreshed`, "success");
      reload();
    } catch (e) { toast(`Roll failed: ${e.message}`, "error"); }
    setRolling(null);
  };

  const t = data.totals;
  const byShop = Object.fromEntries(data.shops.map(s => [s.shop_type, s]));
  return (<>
    <div className="ap-sr">
      <SC label="Catalog"       value={fmt(t.catalog_total)} sub={`${fmt(t.catalog_total - t.catalog_active)} hidden`} />
      <SC label="On Shelves"    value={fmt(t.on_shelf)}      color="blue"   sub={`${t.permanent} permanent`} />
      <SC label="Out of Stock"  value={t.out_of_stock}       color="red" />
      <SC label="Low Stock"     value={t.low_stock}          color="orange" sub="≤ ⅓ of full rack" />
      <SC label="Overdue Shops" value={t.overdue_shops}      color={t.overdue_shops ? "red" : "green"} sub="past next rotation" />
      <SC label="Restock Asks"  value={t.requests_7d}        sub={`last 7d · ${t.pending_restocks} queued`} />
    </div>

    {t.overdue_shops > 0 && (
      <div className="ap-note" style={{ marginBottom: 16 }}>
        ⚠️ {t.overdue_shops} shop{t.overdue_shops > 1 ? "s are" : " is"} past the scheduled rotation. Shops only rotate when
        someone rolls them (here or from the in-game Zombita Control panel) - nothing rotates them on a timer yet.
      </div>
    )}

    <TW title="KEEPERS">
      <table className="ap-t">
        <thead><tr>
          <th>Shop</th><th>Catalog</th><th>On shelf</th><th>Out</th><th>Low</th><th>Queued</th>
          <th>Rotated</th><th>Next rotation</th><th>Actions</th>
        </tr></thead>
        <tbody>
          {SHOP_ORDER.filter(st => byShop[st]).map(st => {
            const s = byShop[st];
            return (
              <tr key={st}>
                <td>
                  <div style={{ fontWeight: 500 }}>{SHOPS[st].icon} {SHOPS[st].label}</div>
                  <div style={dim}>{SHOPS[st].npc} · {st}</div>
                </td>
                <td style={mono}>
                  {fmt(s.catalog_active)}
                  {s.catalog_active < s.catalog_total && <span style={{ color: "var(--textdim)" }}> / {fmt(s.catalog_total)}</span>}
                  {s.permanent > 0 && <div style={dim}>★ {s.permanent} permanent</div>}
                </td>
                <td style={mono}>{s.on_shelf}</td>
                <td style={{ ...mono, color: s.out_of_stock ? "var(--red)" : "var(--textdim)" }}>{s.out_of_stock}</td>
                <td style={{ ...mono, color: s.low_stock ? "var(--accent)" : "var(--textdim)" }}>{s.low_stock}</td>
                <td style={mono}>{s.pending_restocks || "-"}</td>
                <td style={dim}>{s.rotated_at ? relTime(s.rotated_at) : "never"}</td>
                <td style={{ ...mono, fontSize: 12, color: s.overdue ? "var(--red)" : "var(--text)" }}>{untilText(s.next_rotation)}</td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <B c="blue" sm onClick={() => onOpenShelf(st)}>Shelf</B>
                    <B c="orange" sm onClick={() => roll(st)} disabled={rolling === st}>
                      {rolling === st ? "Rolling…" : "🔄 Roll"}
                    </B>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TW>
  </>);
}

// ── SHELF: what one keeper is selling right now ─────────────────────────────
function ShelfView({ shop, setShop, toast }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");

  const load = useCallback(async () => {
    try { setData(await fetchApi(`/api/admin/shop/live/shelf?shop_type=${shop}`)); }
    catch (e) { toast(`Failed to load shelf: ${e.message}`, "error"); }
    setLoading(false);
  }, [shop, toast]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useLiveRefresh("shop", load);

  const setStock = async (item, mode, raw) => {
    const amount = parseInt(raw);
    if (isNaN(amount) || (mode === "set" && amount < 0)) return;
    if (mode === "set" && amount === item.stock) return;
    try {
      const d = await postApi("/api/admin/shop/live/stock", { item_id: item.item_id, shop_type: shop, mode, amount });
      toast(`${item.name}: ${d.old_stock} → ${d.new_stock}`, "success");
      load();
    } catch (e) { toast(`Stock update failed: ${e.message}`, "error"); }
  };

  const items = (data?.items || []).filter(i => {
    const q = search.trim().toLowerCase();
    return !q || i.name.toLowerCase().includes(q) || i.item_id.toLowerCase().includes(q);
  });

  return (
    <TW title={`SHELF - ${SHOPS[shop]?.label?.toUpperCase() || shop}`} right={<>
      <select className="ap-search" style={{ padding: "4px 8px" }} value={shop} onChange={e => setShop(e.target.value)}>
        {SHOP_ORDER.map(st => <option key={st} value={st}>{shopName(st)}</option>)}
      </select>
      <input className="ap-search" placeholder="search shelf…" value={search} onChange={e => setSearch(e.target.value)} />
      <B c="gold" sm onClick={load}>↻</B>
    </>}>
      {loading ? <Load /> : !data?.items?.length ? <Empty text="Nothing on this shelf - roll the shop from the Shops view." /> : (<>
        <div style={{ ...dim, marginBottom: 10 }}>
          {data.items.length} on the shelf · rotated {data.rotated_at ? relTime(data.rotated_at) : "-"} · next rotation {untilText(data.next_rotation)}
          {" · "}prices come from the pricing pass (treasury, demand, Zombita's brain)
        </div>
        <table className="ap-t">
          <thead><tr>
            <th>Item</th><th>Tier</th><th>Base</th><th>Live price</th><th>Stock</th><th>Set stock</th><th>Quick</th>
          </tr></thead>
          <tbody>
            {items.length === 0 ? <tr><td colSpan={7}><Empty text="no match" /></td></tr> : items.map(item => {
              const pct = item.factor != null ? Math.round((item.factor - 1) * 100) : null;
              return (
                <tr key={item.item_id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {item.icon_url && <img src={item.icon_url} alt="" style={{ width: 22, height: 22, objectFit: "contain", imageRendering: "pixelated" }} />}
                      <div>
                        <div style={{ fontWeight: 500 }}>{item.name} {item.permanent && <Perm />}</div>
                        <div style={dim}>{item.item_id}{!item.active && " · hidden in catalog (leaves at next roll)"}</div>
                      </div>
                    </div>
                  </td>
                  <td><Tier t={item.tier} /></td>
                  <td style={{ ...mono, color: "var(--textdim)" }}>{fmt(item.base_price)}</td>
                  <td style={mono} title={item.price_reason || ""}>
                    {fmt(item.price)} 🟤
                    {pct != null && Math.abs(pct) >= 1 && (
                      <span style={{ fontSize: 10, marginLeft: 6, color: pct > 0 ? "var(--red)" : "var(--green)" }}>
                        {pct > 0 ? "▲" : "▼"}{Math.abs(pct)}%
                      </span>
                    )}
                  </td>
                  <td style={{ ...mono, fontSize: 13, color: stockColor(item.stock, item.max_stock) }}>
                    {item.stock < 0 ? "-" : item.stock}
                    {item.max_stock > 0 && <span style={{ color: "var(--textdim)", fontSize: 10 }}> / {item.max_stock}</span>}
                  </td>
                  <td>
                    <div className="ap-se">
                      <input type="number" min="0" key={`${item.item_id}:${item.stock}`} defaultValue={item.stock < 0 ? "" : item.stock}
                        onBlur={e => { if (e.target.value !== "") setStock(item, "set", e.target.value); }}
                        onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} />
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <B c="ghost" sm onClick={() => setStock(item, "add", -1)} disabled={item.stock <= 0}>−1</B>
                      <B c="ghost" sm onClick={() => setStock(item, "add", 1)}>+1</B>
                      <B c="green" sm onClick={() => setStock(item, "set", item.max_stock > 0 ? item.max_stock : item.stock)} disabled={item.max_stock <= 0 || item.stock >= item.max_stock}>Fill</B>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </>)}
    </TW>
  );
}

// ── CATALOG: all authored items, searchable, active/permanent toggles ───────
const PAGE_SIZE = 50;
function CatalogView({ toast }) {
  const [q, setQ]           = useState("");
  const [query, setQuery]   = useState("");
  const [shop, setShop]     = useState("");
  const [tier, setTier]     = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage]     = useState(1);
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  // debounce the search box so typing doesn't fire a query per keystroke
  useEffect(() => { const h = setTimeout(() => setQuery(q), 300); return () => clearTimeout(h); }, [q]);
  useEffect(() => { setPage(1); }, [query, shop, tier, status]);

  const load = useCallback(async () => {
    const p = new URLSearchParams({ q: query, shop_type: shop, tier, status, page: String(page), page_size: String(PAGE_SIZE) });
    try { setData(await fetchApi(`/api/admin/shop/live/catalog?${p}`)); }
    catch (e) { toast(`Catalog failed: ${e.message}`, "error"); }
    setLoading(false);
  }, [query, shop, tier, status, page, toast]);

  useEffect(() => { load(); }, [load]);
  useLiveRefresh("shop", load);

  const update = async (item, patch, msg) => {
    try {
      await postApi("/api/admin/shop/live/catalog", { item_id: item.item_id, shop_type: item.shop_type, ...patch });
      toast(`${item.name}: ${msg} - applies on the next roll of ${SHOPS[item.shop_type]?.npc || item.shop_type}`, "success");
      load();
    } catch (e) { toast(`Update failed: ${e.message}`, "error"); }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  return (<>
    <div className="ap-note" style={{ marginBottom: 16 }}>
      Names, tiers and price bands come from the economy sheets - a catalog reload rewrites them and
      re-enables hidden items. Here you can <b>hide</b> an item from future rotations or mark it
      <b> permanent</b> (always on the shelf). Both take effect the next time that shop is rolled.
    </div>
    <TW title={`CATALOG${data ? ` - ${fmt(data.total)} items` : ""}`} right={<>
      <select className="ap-search" style={{ padding: "4px 8px" }} value={shop} onChange={e => setShop(e.target.value)}>
        <option value="">All shops</option>
        {SHOP_ORDER.map(st => <option key={st} value={st}>{shopName(st)}</option>)}
      </select>
      <select className="ap-search" style={{ padding: "4px 8px" }} value={tier} onChange={e => setTier(e.target.value)}>
        <option value="">All tiers</option>
        {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <select className="ap-search" style={{ padding: "4px 8px" }} value={status} onChange={e => setStatus(e.target.value)}>
        <option value="all">Any status</option>
        <option value="on_shelf">On a shelf now</option>
        <option value="permanent">Permanent</option>
        <option value="active">Active</option>
        <option value="hidden">Hidden</option>
      </select>
      <input className="ap-search" placeholder="name or item id…" value={q} onChange={e => setQ(e.target.value)} />
    </>}>
      {loading && !data ? <Load /> : (<>
        <table className="ap-t">
          <thead><tr>
            <th style={{ width: 36 }}>⚡</th><th>Item</th><th>Shop</th><th>Tier</th>
            <th>Base</th><th title="Prices rise as the treasury drains">Booming → Critical</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {!data?.items?.length ? <tr><td colSpan={7}><Empty text="no catalog items match" /></td></tr> : data.items.map(item => (
              <tr key={`${item.shop_type}:${item.item_id}`} style={{ opacity: item.active ? 1 : 0.5 }}>
                <td><span className={`ap-dot ${item.active ? "on" : "off"}`} /></td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {item.icon_url && <img src={item.icon_url} alt="" style={{ width: 22, height: 22, objectFit: "contain", imageRendering: "pixelated" }} />}
                    <div>
                      <div style={{ fontWeight: 500 }}>
                        {item.name} {item.permanent && <Perm />}
                        {item.on_shelf && <span className="ap-pill" style={{ background: "rgba(74,143,196,0.15)", color: "#4a8fc4", marginLeft: 4 }}>on shelf</span>}
                        {item.needs_review && <span className="ap-pill" style={{ background: "rgba(224,149,78,0.15)", color: "#e0954e", marginLeft: 4 }}>needs review</span>}
                      </div>
                      <div style={dim}>{item.item_id}</div>
                    </div>
                  </div>
                </td>
                <td style={{ fontSize: 12 }}>{shopName(item.shop_type)}</td>
                <td><Tier t={item.tier} /></td>
                <td style={mono}>{fmt(item.base_buy)}</td>
                <td style={{ ...mono, fontSize: 12, color: "var(--textdim)" }}>{fmt(item.band_booming)} → {fmt(item.band_critical)}</td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <B c={item.active ? "red" : "green"} sm
                       onClick={() => update(item, { active: !item.active }, item.active ? "hidden" : "re-enabled")}>
                      {item.active ? "Hide" : "Show"}
                    </B>
                    <B c={item.permanent ? "ghost" : "gold"} sm disabled={!item.active}
                       onClick={() => update(item, { permanent: !item.permanent }, item.permanent ? "no longer permanent" : "now permanent")}>
                      {item.permanent ? "Unpin" : "★ Pin"}
                    </B>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 14 }}>
            <B c="ghost" sm onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>‹ Prev</B>
            <span style={dim}>Page {page} / {pages}</span>
            <B c="ghost" sm onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}>Next ›</B>
          </div>
        )}
      </>)}
    </TW>
  </>);
}

// ── ADD ITEM: put a new item in a shop (2026-10-30, Nin: "add through website") ─────────────
// Backend: zombita_shop_add.py through /api/admin/shop/live/item/*. The bot checks the id against what the server loads and
// keeps the one-price rule: an item another shop sells takes its price or gets its own, it never moves theirs.
const ADD_TIERS = TIERS.filter(t => t !== "transit");
const ADD_EMPTY = { id: "", name: "", price: "", stock: "5", days: "3", tier: "common", permanent: true, ends: "", kind: "economy" };
const ADD_NOT_HERE = ["mags"];                                     // her shelf comes from the cards settings
const KIND_TEXT = {
  economy: "Normal price, moves with the economy", fixed: "Fixed, players pay exactly this", own: "Own normal price here, moves with the economy", shared: "Same price as the other shop",
};
const addShopLabel = (st) => SHOPS[st]?.label || ADD_SHOP_NAMES[st] || st;
const toLocalInput = (ts) => {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function AddItemView({ overview, toast }) {
  const shops = (overview?.shops?.map(s => s.shop_type) || SHOP_ORDER).filter(st => !ADD_NOT_HERE.includes(st));
  const [shop, setShop]     = useStickyState("global", "shop.add.shop");
  const [q, setQ]           = useState("");
  const [hits, setHits]     = useState(null);
  const [form, setForm]     = useState(ADD_EMPTY);
  const [seen, setSeen]     = useState(null);
  const [added, setAdded]   = useState(null);
  const [saving, setSaving] = useState(false);
  const fromRow = useRef(false);                                   // the fields hold a saved row, not what was typed
  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  const loadAdded = useCallback(async () => {
    try { setAdded((await fetchApi("/api/admin/shop/live/item/added")).items); }
    catch (e) { toast(`Failed to load added items: ${e.message}`, "error"); }
  }, [toast]);
  useEffect(() => { loadAdded(); }, [loadAdded]);
  useLiveRefresh("shop", loadAdded);

  useEffect(() => {                                                // type a name: the items the server really has
    const want = q.trim();
    if (want.length < 2) { setHits(null); return; }
    const h = setTimeout(async () => {
      try { setHits((await fetchApi(`/api/admin/shop/live/item/find?q=${encodeURIComponent(want)}`)).items); }
      catch (e) { toast(`Search failed: ${e.message}`, "error"); }
    }, 300);
    return () => clearTimeout(h);
  }, [q, toast]);

  useEffect(() => {                                                // what the bot knows about this id in this shop
    const id = form.id.trim();
    setSeen(null);
    if (!id) return;
    const h = setTimeout(async () => {
      try {
        const d = await fetchApi(`/api/admin/shop/live/item/look?${new URLSearchParams({ item_id: id, shop_type: shop })}`);
        setSeen(d);
        const wasRow = fromRow.current;
        fromRow.current = !!d.row;
        if (d.row) set({ name: d.row.name, price: String(d.row.set_price), stock: String(d.row.stock), days: String(d.row.restock_days),
                         tier: ADD_TIERS.includes(d.row.tier) ? d.row.tier : "common", permanent: d.row.permanent,
                         ends: toLocalInput(d.row.ends_at), kind: d.shared && d.row.price_kind === "economy" ? "shared" : d.row.price_kind });
        else if (d.known) set({ ...(wasRow ? { ...ADD_EMPTY, id } : {}), name: d.name, kind: d.shared ? "shared" : "economy" });
      } catch (e) { toast(`Look up failed: ${e.message}`, "error"); }
    }, 300);
    return () => clearTimeout(h);
  }, [form.id, shop, toast]);

  const pick = (it) => { setHits(null); setQ(""); set({ ...ADD_EMPTY, id: it.item_id }); };
  const edit = (it) => { setShop(it.shop_type); pick(it); };
  const save = async () => {
    setSaving(true);
    try {
      const d = await postApi("/api/admin/shop/live/item/add", {
        item_id: form.id.trim(), shop_type: shop, price: form.kind === "shared" ? null : Number(form.price),
        stock: Number(form.stock), restock_days: Number(form.days), tier: form.tier, permanent: form.permanent, price_kind: form.kind,
        name: form.name, ends_at: form.ends ? Math.floor(new Date(form.ends).getTime() / 1000) : null, edit: !!seen?.row,
      });
      toast(`${d.name}: ${d.changed ? "saved" : "added"}, ${bronzeToCoins(d.price)} now. ${d.on_shelf ? "On the shelf." : "Joins the pool, a roll picks it."}`, "success");
      setForm(ADD_EMPTY); setSeen(null); loadAdded();
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };
  const remove = async (it) => {
    if (!confirm(`Take ${it.name} off sale at ${addShopLabel(it.shop_type)} now?\n\nIt leaves the shelf at once. Players keep what they bought.`)) return;
    try {
      await postApi("/api/admin/shop/live/item/remove", { item_id: it.item_id, shop_type: it.shop_type });
      toast(`${it.name}: off sale`, "success");
      loadAdded();
    } catch (e) { toast(`Remove failed: ${e.message}`, "error"); }
  };

  const shared = seen?.shared;
  const kinds = !shared ? ["economy", "fixed"] : shared.shop_type === shop ? ["shared"] : ["shared", "own", "fixed"];
  const row = seen?.row;
  const needPrice = form.kind !== "shared";
  const ready = seen?.known && (!needPrice || Number(form.price) > 0) && Number(form.stock) > 0 && Number(form.days) > 0;
  const radio = { display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", marginBottom: 4 };
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 };

  return (<>
    <div className="ap-note" style={{ marginBottom: 16 }}>
      Add an item to a keeper's shop. <b>Permanent</b> items go on the shelf right away and stay there. <b>Rotating</b> items join the
      pool and show up when a roll picks them. Stock refills every restock period, not at every roll. With an end date the item
      leaves the shelf by itself.
    </div>

    <TW title="ADD AN ITEM">
      <div style={grid}>
        <Inp label="Find an item" placeholder="Type a name, like pumpkin" value={q} onChange={e => setQ(e.target.value)} />
        <Inp label="Or type the item id" placeholder="Base.Axe" value={form.id} onChange={e => set({ id: e.target.value })} />
        <Sel label="Shop" value={shop} onChange={e => setShop(e.target.value)}>
          {shops.map(st => <option key={st} value={st}>{addShopLabel(st)}</option>)}
        </Sel>
      </div>

      {hits && (
        <div style={{ marginBottom: 14, maxHeight: 220, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6 }}>
          {hits.length === 0 ? <Empty text="The game has no item by that name" /> : hits.map(it => (
            <button key={it.item_id} onClick={() => pick(it)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 10px", background: "none", border: "none", borderBottom: "1px solid var(--border)", color: "var(--text)", textAlign: "left", cursor: "pointer" }}>
              {it.icon_url && <img src={it.icon_url} alt="" style={{ width: 20, height: 20, objectFit: "contain", imageRendering: "pixelated" }} />}
              <span style={{ fontWeight: 500 }}>{it.name}</span>
              <span style={dim}>{it.item_id}</span>
            </button>
          ))}
        </div>
      )}

      {seen && (
        <div className="ap-note" style={{ marginBottom: 14 }}>
          {seen.known
            ? <span style={{ color: "var(--green)" }}>In the game: <b>{seen.name}</b></span>
            : <span style={{ color: "var(--red)" }}>{seen.why}</span>}
          {row && <div style={{ marginTop: 4 }}>Already in this shop{row.active ? "" : " (hidden)"} at {bronzeToCoins(row.price)}. Saving changes that row, it won't add a second one.</div>}
          {seen.others.length > 0 && <div style={{ marginTop: 4 }}>Also sold at {seen.others.map(o => `${addShopLabel(o.shop_type)} (${bronzeToCoins(o.price)})`).join(", ")}.</div>}
        </div>
      )}

      {seen?.known && (<>
        <div style={grid}>
          <Inp label="Name in the shop" maxLength={60} value={form.name} onChange={e => set({ name: e.target.value })} />
          {needPrice && <div><Inp label="Price in bronze" type="number" min="1" value={form.price} onChange={e => set({ price: e.target.value })} />{form.price > 0 && <div style={{ ...dim, marginTop: -8, marginBottom: 8 }}>{bronzeToCoins(Number(form.price))}</div>}</div>}
          <Inp label="Stock each restock" type="number" min="1" max="999" value={form.stock} onChange={e => set({ stock: e.target.value })} />
          <Inp label="Restock every (days)" type="number" min="1" max="90" value={form.days} onChange={e => set({ days: e.target.value })} />
          <Sel label="Rarity" value={form.tier} onChange={e => set({ tier: e.target.value })}>
            {ADD_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
          </Sel>
          <Inp label="Sale ends (optional)" type="datetime-local" value={form.ends} onChange={e => set({ ends: e.target.value })} />
        </div>

        <div style={{ ...grid, marginTop: 4, marginBottom: 14 }}>
          <div>
            <div className="ap-fl">On the shelf</div>
            <label style={radio}><input type="radio" checked={form.permanent} onChange={() => set({ permanent: true })} /> Permanent, always listed</label>
            <label style={radio}><input type="radio" checked={!form.permanent} onChange={() => set({ permanent: false })} /> Rotating, a roll may pick it</label>
          </div>
          <div>
            <div className="ap-fl">Price</div>
            {kinds.map(k => (
              <label key={k} style={radio}>
                <input type="radio" checked={form.kind === k} onChange={() => set({ kind: k })} />
                {k !== "shared" ? KIND_TEXT[k] : shared.shop_type === shop ? `Keep it, this shop sets the shared price (${bronzeToCoins(shared.price)} now)` : `Same price as ${addShopLabel(shared.shop_type)} (${bronzeToCoins(shared.price)} now)`}
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <B c="gold" onClick={save} disabled={!ready || saving}>{saving ? "Saving…" : row ? "Save changes" : "Add to shop"}</B>
          <B c="ghost" onClick={() => { setForm(ADD_EMPTY); setSeen(null); }}>Clear</B>
        </div>
      </>)}
    </TW>

    <TW title={`ADDED ON THE WEBSITE${added ? ` - ${added.length}` : ""}`} right={<B c="ghost" sm onClick={loadAdded}>↻</B>}>
      {added == null ? <Load /> : added.length === 0 ? <Empty text="Nothing added here yet." /> : (
        <table className="ap-t">
          <thead><tr><th>Item</th><th>Shop</th><th>Tier</th><th>Price now</th><th>Stock</th><th>Restock</th><th>Ends</th><th>Actions</th></tr></thead>
          <tbody>{added.map(it => (
            <tr key={`${it.shop_type}:${it.item_id}`} style={{ opacity: it.active ? 1 : 0.5 }}>
              <td>
                <div style={{ fontWeight: 500 }}>{it.name} {it.permanent && <Perm />}</div>
                <div style={dim}>{it.item_id}{!it.active && " · hidden in catalog"}{it.active && !it.on_shelf && " · waiting for a roll"}</div>
              </td>
              <td style={{ fontSize: 12 }}>{addShopLabel(it.shop_type)}</td>
              <td><Tier t={it.tier} /></td>
              <td style={mono}>{bronzeToCoins(it.price)}<div style={dim}>{KIND_TEXT[it.price_kind] || it.price_kind}</div></td>
              <td style={{ ...mono, color: stockColor(it.stock_now ?? -1, it.stock_max ?? 0) }}>{it.stock_now ?? "-"} / {it.stock}</td>
              <td style={mono}>{it.restock_days}d</td>
              <td style={{ ...mono, fontSize: 12 }}>{it.ends_at ? untilText(it.ends_at) : "-"}</td>
              <td>
                <div style={{ display: "flex", gap: 6 }}>
                  <B c="ghost" sm onClick={() => edit(it)}>Edit</B>
                  <B c="red" sm onClick={() => remove(it)}>Remove</B>
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </TW>
  </>);
}

// ── RESTOCKS: player requests and Zombita's verdicts ────────────────────────
function RestocksView({ toast }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setData(await fetchApi("/api/admin/shop/live/restocks")); }
    catch (e) { toast(`Failed to load restocks: ${e.message}`, "error"); }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useLiveRefresh("shop", load);

  if (loading) return <Load />;
  const reqs = data?.requests || [], queue = data?.queue || [];
  const granted = reqs.filter(r => r.verdict === "granted").length;
  const waiting = queue.filter(x => !x.delivered).length;

  return (<>
    <div className="ap-note" style={{ marginBottom: 16 }}>
      Players ask for an out-of-stock item (in a shop or the SEARCH tab). Zombita decides from their hidden respect,
      trust, the item's rarity and her mood. A grant costs full reputation and the item arrives at that shop's next
      restock; a refusal keeps half the cost as a fee. Either way she posts the verdict in the shop-news channel.
    </div>
    <div className="ap-sr">
      <SC label="Requests"         value={reqs.length} sub="most recent 100" />
      <SC label="Granted"          value={granted} color="green" />
      <SC label="Refused"          value={reqs.length - granted} color="red" />
      <SC label="Awaiting Delivery" value={waiting} color="orange" />
    </div>

    <TW title="DELIVERY QUEUE" right={<B c="ghost" sm onClick={load}>↻</B>}>
      {queue.length === 0 ? <Empty text="No granted restocks queued." /> : (
        <table className="ap-t">
          <thead><tr><th>Item</th><th>Shop</th><th>For</th><th>Price</th><th>Stock</th><th>Delivery</th></tr></thead>
          <tbody>{queue.map(x => (
            <tr key={x.id}>
              <td><div style={{ fontWeight: 500 }}>{x.name} <Tier t={x.tier} /></div><div style={dim}>{x.item_id}</div></td>
              <td style={{ fontSize: 12 }}>{shopName(x.shop_type)}</td>
              <td style={mono}>{x.username}</td>
              <td style={mono}>{fmt(x.price)} 🟤</td>
              <td style={mono}>{x.stock}</td>
              <td style={{ ...mono, fontSize: 12, color: x.delivered ? "var(--green)" : "var(--accent)" }}>
                {x.delivered ? `delivered ${relTime(x.delivered_at)}` : `due ${untilText(x.deliver_after)}`}
              </td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </TW>

    <TW title="REQUEST HISTORY">
      {reqs.length === 0 ? <Empty text="No restock requests yet." /> : (
        <table className="ap-t">
          <thead><tr><th>When</th><th>Player</th><th>Item</th><th>Shop</th><th>Verdict</th><th>Rep spent</th><th>Price set</th></tr></thead>
          <tbody>{reqs.map(r => (
            <tr key={r.id}>
              <td style={dim} title={fmtFull(r.created_at)}>{relTime(r.created_at)}</td>
              <td style={mono}>{r.username}</td>
              <td><div style={{ fontWeight: 500 }}>{r.name} {r.tier && <Tier t={r.tier} />}</div><div style={dim}>{r.item_id}</div></td>
              <td style={{ fontSize: 12 }}>{shopName(r.shop_type)}</td>
              <td>
                <span className="ap-pill" style={r.verdict === "granted"
                  ? { background: "rgba(76,175,125,0.15)", color: "var(--green)" }
                  : { background: "rgba(224,85,85,0.15)", color: "var(--red)" }}>
                  {r.verdict === "granted" ? "✓ granted" : "✗ refused"}
                </span>
              </td>
              <td style={mono}>{fmt(r.rep_spent)}{r.verdict === "refused" && <span style={dim}> fee</span>}</td>
              <td style={mono}>{r.price_set ? `${fmt(r.price_set)} 🟤` : "-"}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </TW>
  </>);
}

export default function ShopTab({ toast }) {
  const [sub, setSub]     = useStickyState("shops", "shop.live.sub");
  const [shelf, setShelf] = useStickyState("weapons", "shop.live.shelf");
  const [overview, setOverview] = useState(null);
  const [loading, setLoading]   = useState(true);

  const loadOverview = useCallback(async () => {
    try { setOverview(await fetchApi("/api/admin/shop/live/overview")); }
    catch (e) { toast(`Failed to load shop network: ${e.message}`, "error"); }
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useLiveRefresh("shop", loadOverview);

  const tabs = [
    { key: "shops",    icon: "🏪", label: "Shops" },
    { key: "shelf",    icon: "📦", label: "Shelf & Stock" },
    { key: "catalog",  icon: "📚", label: "Catalog" },
    { key: "add",      icon: "➕", label: "Add Item" },
    { key: "restocks", icon: "🧟", label: "Zombita's Restocks" },
  ];

  return (<>
    <Title t="SHOP" s="8 keepers · catalog · shelves & stock · Zombita's restock decisions" />
    <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
      {tabs.map(t => (
        <button key={t.key} className={`ap-ft ${sub === t.key ? "act" : ""}`} onClick={() => setSub(t.key)}>
          {t.icon} {t.label}
        </button>
      ))}
    </div>

    {sub === "shops" && (loading ? <Load /> : overview
      ? <ShopsView data={overview} toast={toast} reload={loadOverview} onOpenShelf={(st) => { setShelf(st); setSub("shelf"); }} />
      : <Empty text="Shop network unavailable" />)}
    {sub === "shelf"    && <ShelfView shop={shelf} setShop={setShelf} toast={toast} />}
    {sub === "catalog"  && <CatalogView toast={toast} />}
    {sub === "add"      && <AddItemView overview={overview} toast={toast} />}
    {sub === "restocks" && <RestocksView toast={toast} />}
  </>);
}
