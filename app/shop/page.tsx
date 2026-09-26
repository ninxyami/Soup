"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";

// id MUST equal the backend shop_type string (see zombita_shop_catalog).
// NPC names / roles / locations mirror the in-game ZS_NPCData.lua keepers.
const SHOPS = [
  { id: "weapons",   label: "Viktor's Armory",   npc: "Viktor Rask",    role: "Arms & Ammunition",  icon: "⚔️", location: "Nettle Township",                portrait: "/shop/viktor.png"  },
  { id: "mechanic",  label: "Sera's Garage",     npc: "Sera Okafor",    role: "Parts & Mechanics",  icon: "🔧", location: "West Point",                     portrait: "/shop/sera.png"    },
  { id: "medical",   label: "Dr. Voss's Clinic", npc: "Dr. Emil Voss",  role: "Medical Supplies",   icon: "🏥", location: "Oakshire",                       portrait: "/shop/emil.png"    },
  { id: "gardener",  label: "Maya's Greenhouse", npc: "Maya Chen",      role: "Gardener & Produce", icon: "🌱", location: "Raccoon City",                   portrait: "/shop/maya.png"    },
  { id: "tailor",    label: "Colette's Atelier", npc: "Colette Vance",  role: "Tailor & Apparel",   icon: "🧵", location: "March Ridge",                    portrait: "/shop/colette.png" },
  { id: "librarian", label: "Miles's Library",   npc: "Miles Ashford",  role: "Books & Skills",     icon: "📚", location: "Grapeseed",                      portrait: "/shop/miles.png"   },
  { id: "melee",     label: "Bruno's Workshop",  npc: "Bruno Kessler",  role: "Melee & Tools",      icon: "🔨", location: "Constown",                       portrait: "/shop/bruno.png"   },
  { id: "music",     label: "Scarlett's Records", npc: "Scarlett Vance", role: "Community Tapes",    icon: "🎵", location: "See the map: the cassette sign", portrait: "/shop/scarlett.png" },
  { id: "global",    label: "General Stores",    npc: "Six keepers",    role: "Everyday Goods",     icon: "⛽", location: "39 stores in 26 towns",          portrait: null                },
];

// The general stores (ZS_NPCData.lua, shop_type "global"): six keepers, each running a counter in several towns.
// Each store shows its own slice of the general rotation (zombita_assortments.py); the ★ items are in all of them.
const GENERAL_KEEPERS = [
  { npc: "Lena Vasquez", towns: ["West Point", "Muldraugh", "Echo Creek", "Valley Station", "Raccoon City", "Daisy County", "Havenfall"] },
  { npc: "Dex Malone",   towns: ["West Point", "Muldraugh", "Ekron", "Grapeseed", "Raccoon City", "Daisy County", "Nettle Township"] },
  { npc: "Roxy",         towns: ["Rosewood", "Fallas Lake", "Irvington", "Grapeseed", "Oakshire", "Safeharbor Garrison", "Nettle Township"] },
  { npc: "Cal Briggs",   towns: ["Rosewood", "March Ridge", "Irvington", "Frogtown", "Oakshire", "Safeharbor Garrison"] },
  { npc: "Nadia",        towns: ["Riverside", "Bradenburg", "Dixie", "Constown", "Blackstone", "Anruisi Town"] },
  { npc: "Eli Marsh",    towns: ["Riverside", "Bradenburg", "Dixie", "Constown", "Daisy County", "Willowbrook"] },
];

// Pictures for the server's own items (the catalog has none for them): copied from the Zombita mod's textures.
const OWN_ICONS: Record<string, string> = {
  "Zombita.PhoneFlip": "/shop/items/PhoneFlip.png", "Zombita.PhoneBlackberry": "/shop/items/PhoneBlackberry.png",
  "Zombita.PhoneTouch": "/shop/items/PhoneTouch.png", "Zombita.ZombitaPhone": "/shop/items/ZombitaPhone.png",
  "Zombita.PhoneDawnie": "/shop/items/PhoneDawnie.png", "Zombita.VehicleClaimOrb": "/shop/items/VehicleClaimOrb.png",
  "ZombitaBus.BusTicket": "/shop/items/BusTicket.png", "Zombita.LotteryTicket": "/shop/items/LotteryTicket.png",
  "Zombita.ZombitaCoin": "/shop/items/ZombitaCoin.png", "Zombita.SoupCoin": "/shop/items/SoupCoin.png",
  "Zombita.DawnieCoin": "/shop/items/DawnieCoin.png", "Zombita.PinkSlip": "/shop/items/PinkSlip.png",
};

const ALL = "__all__";

const TIER_COLOR: Record<string,string> = {
  common:"#6b7280", uncommon:"#4caf7d", rare:"#4a8fc4", epic:"#a06cd5",
  legendary:"#c8a84b", special:"#e0574e", transit:"#3fa9a0",
};
const TIER_LABEL: Record<string,string> = {
  common:"Common", uncommon:"Uncommon", rare:"Rare", epic:"Epic",
  legendary:"Legendary", special:"Special", transit:"Transit",
};
// tier priority for surfacing anchors on top (higher = shown first)
const TIER_RANK: Record<string,number> = {
  special:6, legendary:5, epic:4, rare:3, uncommon:2, common:1, transit:0,
};

const SHOP_TYPES = SHOPS.map(s => s.id);
const SHOP_BY_ID: Record<string, typeof SHOPS[number]> =
  Object.fromEntries(SHOPS.map(s => [s.id, s]));
const PAGE_SIZE = 24;

interface Item {
  item_id:       string;
  name:          string;
  buy?:          number;
  base_buy?:     number;
  tier:          string;
  price_factor?: number;
  stock?:        number;
  max_stock?:    number;
  permanent?:    boolean;
  icon_url?:     string | null;
  shop_type?:    string;   // attached client-side for the all-shops view
}

interface Treasury {
  balance: number; cap: number; health_pct: number; depleted?: boolean;
  health?: string;          // BOOMING / HEALTHY / TIGHT / LOW / CRITICAL, from /api/economy/live when it answers
}

// Permanent anchors first, then rarity, then price — so the always-available
// goods and the rare finds are what you see before any scrolling.
function sortItems(a: Item, b: Item): number {
  return (Number(b.permanent||false) - Number(a.permanent||false))
      || ((TIER_RANK[b.tier]||0) - (TIER_RANK[a.tier]||0))
      || ((b.buy||0) - (a.buy||0));
}

function timeUntil(ts:number):string {
  const diff = ts - Math.floor(Date.now()/1000);
  if (diff<=0) return "Restocking soon";
  const d=Math.floor(diff/86400), h=Math.floor((diff%86400)/3600);
  if (d>0) return `~${d}d ${h}h`;
  return `~${h}h ${Math.floor((diff%3600)/60)}m`;
}

function formatPrice(bronze: number): string {
  if (bronze <= 0) return "0 🟤";
  const gold   = Math.floor(bronze / 10000);
  const rem    = bronze % 10000;
  const silver = Math.floor(rem / 1000);
  const coins  = rem % 1000;
  const parts: string[] = [];
  if (gold)   parts.push(`${gold} 🟡`);
  if (silver) parts.push(`${silver} ⚪`);
  if (coins)  parts.push(`${coins} 🟤`);
  return parts.join(" ") || "0 🟤";
}

function PriceBadge({ factor }: { factor?: number }) {
  if (!factor || Math.abs(factor - 1.0) < 0.05) return null;
  const up  = factor > 1.0;
  const pct = Math.round(Math.abs(factor - 1.0) * 100);
  return (
    <span className="font-mono text-[0.55rem] px-1 py-0.5 ml-1"
          style={{ background: up ? "rgba(224,85,85,0.15)" : "rgba(76,175,77,0.15)",
                   color: up ? "#e05555" : "#4caf7d", border: `1px solid ${up?"#e05555":"#4caf7d"}44` }}>
      {up ? "▲" : "▼"}{pct}%
    </span>
  );
}

// Zombita's treasury is the engine behind every price on this page, so it is
// shown rather than hidden: a starving treasury is why things got expensive.
function TreasuryBar({ t }: { t: Treasury | null }) {
  if (!t) return null;
  const pct = Math.max(0, Math.min(100, t.health_pct ?? 0));
  // the same bands as the economy page and the keepers' sell tax (95 / 60 / 35 / 15 % of the cap)
  const COLORS: Record<string,string> = { BOOMING:"#4caf7d", HEALTHY:"#4a8fc4", TIGHT:"#c8a84b", LOW:"#e0954e", CRITICAL:"#e05555" };
  const label = (t.health && COLORS[t.health]) ? t.health :
    pct >= 95 ? "BOOMING" : pct >= 60 ? "HEALTHY" : pct >= 35 ? "TIGHT" : pct >= 15 ? "LOW" : "CRITICAL";
  const state = { label, color: COLORS[label] };
  return (
    <div className="border border-[#1e2530] bg-[#0c0f13] p-4 mb-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
        <span className="font-mono text-[0.58rem] uppercase tracking-widest text-[#555]">
          Zombita&apos;s Treasury
        </span>
        <span className="font-mono text-[0.72rem] px-1.5 py-0.5 border"
              style={{color:state.color, borderColor:state.color+"44", background:state.color+"11"}}>
          {state.label}
        </span>
        <div className="flex-1" />
        <span className="font-mono text-[0.62rem] text-[#555]">
          {formatPrice(t.balance)} <span className="text-[#333]">of {formatPrice(t.cap)}</span>
        </span>
      </div>
      <div className="h-[6px] bg-[#0a0d10] border border-[#1a1f28] overflow-hidden">
        <div className="h-full transition-all" style={{width:`${pct}%`, background:state.color}} />
      </div>
      <p className="font-mono text-[0.6rem] text-[#3a3a3a] mt-2 m-0">
        {pct.toFixed(1)}% full. Every purchase feeds it, every price reacts to it.{" "}
        {t.depleted ? "It is running dry — expect her to tighten." : "Buy, sell and survive to keep it moving."}{" "}
        <a href="/features/economy" className="text-[#4a8fc4] no-underline hover:underline">How the economy works →</a>
      </p>
    </div>
  );
}

function ItemCard({ item, showShop }: { item: Item; showShop?: boolean }) {
  const color      = TIER_COLOR[item.tier]||TIER_COLOR.common;
  const isDyn      = item.price_factor && Math.abs(item.price_factor-1.0) >= 0.05;
  const price      = item.buy ?? 0;
  const stock      = item.stock ?? -1;
  const outOfStock = stock === 0;
  const home       = item.shop_type ? SHOP_BY_ID[item.shop_type] : undefined;
  const icon       = item.icon_url || OWN_ICONS[item.item_id] || null;
  return (
    <div className={`bg-[#0f1318] border p-3 relative transition-all ${outOfStock ? "border-[#1a1a1a] opacity-50" : "border-[#1e2530] hover:border-[rgba(200,168,75,0.2)]"}`}>
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{background: outOfStock ? "#333" : color}} />

      {item.permanent && (
        <div className="font-mono text-[0.5rem] tracking-widest mb-1 text-accent">★ ALWAYS STOCKED</div>
      )}

      <div className="flex items-start gap-2">
        {icon && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} alt="" aria-hidden="true"
               className="w-7 h-7 object-contain flex-shrink-0 mt-0.5"
               style={{imageRendering:"pixelated"}} />
        )}
        <div className="min-w-0 flex-1">
          <div className="mt-0.5 font-medium text-[0.88rem] text-[#c8cdd6] leading-tight mb-1">{item.name}</div>
          <div className="font-mono text-[0.58rem] text-[#2a2a2a] truncate">{item.item_id}</div>
        </div>
      </div>

      {showShop && home && (
        <div className="font-mono text-[0.55rem] text-[#4a8fc4] mt-1.5">
          {home.icon} {home.npc}
        </div>
      )}

      <div className="flex items-end justify-between mt-2">
        <div>
          {outOfStock ? (
            <div className="font-mono text-[0.65rem] text-[#444]">OUT OF STOCK</div>
          ) : price > 0 ? (
            <div className="flex items-center gap-1">
              <span className="font-mono text-[0.72rem]" style={{color}}>{formatPrice(price)}</span>
              {isDyn && <PriceBadge factor={item.price_factor} />}
            </div>
          ) : null}
          {item.base_buy!=null && isDyn && !outOfStock && (
            <div className="font-mono text-[0.58rem] text-[#3a3a3a] line-through">{formatPrice(item.base_buy)}</div>
          )}
          {stock >= 0 && !outOfStock && (
            <div className="font-mono text-[0.55rem] mt-1" style={{color: stock <= 2 ? "#e05555" : "#444"}}>
              {stock <= 2 ? `⚠️ ${stock} left` : `${stock} in stock`}
            </div>
          )}
        </div>
        <span className="font-mono text-[0.55rem] px-1.5 py-0.5 border"
              style={{color: outOfStock ? "#333" : color, borderColor:(outOfStock?"#333":color)+"44", background:(outOfStock?"#333":color)+"11"}}>
          {TIER_LABEL[item.tier]||item.tier}
        </span>
      </div>
    </div>
  );
}

export default function ShopPage() {
  const [rotations, setRotations] = useState<Record<string,Item[]>>({});
  const [nextTimes, setNextTimes] = useState<Record<string,number>>({});
  const [treasury,  setTreasury]  = useState<Treasury|null>(null);
  const [active,    setActive]    = useState<string>("weapons");
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [page,      setPage]      = useState(1);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const results: Record<string,Item[]> = {};
        const times:   Record<string,number> = {};

        await Promise.all(SHOP_TYPES.map(async (t) => {
          try {
            const r = await fetch(`${API}/api/marketplace/rotation-with-prices?shop_type=${t}`);
            if (r.ok) {
              const d = await r.json();
              // Tag each item with its home shop so the all-shops view can say
              // WHERE to go — the same routing the in-game search tab does.
              const list: Item[] = (d.items || []).map((i: Item) => ({ ...i, shop_type: t }));
              results[t] = list.sort(sortItems);
            }
          } catch {}
        }));

        try {
          const r = await fetch(`${API}/api/marketplace/all-rotations`);
          if (r.ok) Object.assign(times, (await r.json()).next_times || {});
        } catch {}

        try {
          const r = await fetch(`${API}/api/treasury/status`);
          if (r.ok) {
            const t: Treasury = await r.json();
            // the named state the keepers actually use (the economy page's source)
            try {
              const l = await fetch(`${API}/api/economy/live`);
              if (l.ok) { const live = await l.json(); if (live?.health) t.health = String(live.health); }
            } catch {}
            setTreasury(t);
          }
        } catch {}

        setRotations(results);
        setNextTimes(times);
      } catch {}
      finally { setLoading(false); }
    };
    loadAll();
    const iv = setInterval(loadAll, 60000);
    return () => clearInterval(iv);
  }, []);

  // reset to page 1 whenever the shop or the search term changes
  useEffect(() => { setPage(1); }, [active, search]);

  const isAll   = active === ALL;
  const shop    = isAll ? null : SHOP_BY_ID[active];
  const allItems: Item[] = isAll
    ? SHOP_TYPES.flatMap(t => rotations[t] || []).sort(sortItems)
    : (rotations[active] || []);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? allItems.filter(i => i.name.toLowerCase().includes(q) || i.item_id.toLowerCase().includes(q))
    : allItems;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage  = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage-1)*PAGE_SIZE, safePage*PAGE_SIZE);
  const totalAll  = SHOP_TYPES.reduce((n,t) => n + (rotations[t]?.length || 0), 0);

  return (
    <div className="scanline min-h-screen" style={{background:"#080a0c",color:"#c8cdd6"}}>

      {/* Header */}
      <header className="px-4 sm:px-8 py-4 border-b border-[#1e2530] bg-[#0f1318] sticky top-[49px] z-10">
        <div className="max-w-[1000px] mx-auto flex items-center gap-3">
          <a href="/" className="font-mono text-[0.65rem] text-[#444] hover:text-[#c8cdd6] no-underline tracking-widest hidden sm:block">← S.O.U.P</a>
          <span className="font-display text-2xl tracking-[3px] text-accent" style={{fontFamily:"'Bebas Neue',sans-serif",textShadow:"0 0 20px rgba(200,168,75,0.25)"}}>
            THE ECONOMY
          </span>
          <div className="flex-1" />
          <a href="/marketplace" className="font-mono text-[0.65rem] px-3 py-1.5 border border-[#4a8fc4] text-[#4a8fc4] no-underline hover:bg-[#4a8fc4] hover:text-black transition-all">
            🏪 Marketplace
          </a>
          <a href="/news" className="font-mono text-[0.65rem] px-3 py-1.5 border border-[#1e2530] text-[#555] no-underline hover:border-accent hover:text-accent transition-all">
            📰 Intel
          </a>
        </div>
      </header>

      {/* Notice */}
      <div className="border-b border-[#1e2530]" style={{background:"rgba(200,168,75,0.04)"}}>
        <div className="max-w-[1000px] mx-auto px-4 sm:px-8 py-2">
          <p className="font-mono text-[0.63rem] text-center text-accent">
            ⚠️ <strong>All buying and selling happens in game.</strong> Walk up to a shop&apos;s kiosk and right-click it - you have to stay at the counter while you trade. Prices move with the treasury and with demand.
          </p>
        </div>
      </div>

      <div className="max-w-[1000px] mx-auto px-4 sm:px-8 py-6 sm:py-8">

        <div className="mb-6">
          <h1 className="font-display text-3xl sm:text-4xl tracking-[4px] text-[#c8cdd6] mb-1" style={{fontFamily:"'Bebas Neue',sans-serif"}}>
            SHOP NETWORK
          </h1>
          <p className="font-mono text-[0.72rem] text-[#555]">
            Eight specialist keepers plus 39 general stores across Kentucky. Scarlett sells only the songs players share in #song-submissions. Stock rotates every three days;{" "}
            <a href="/news" className="text-accent no-underline hover:underline">Zombita drops hints</a> before it happens.
            Player listings live in the phone&apos;s <strong className="text-[#888]">Marketplace</strong> app and on every kiosk&apos;s Marketplace tab.
          </p>
        </div>

        <TreasuryBar t={treasury} />

        {/* Shop selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
          {SHOPS.map(s => (
            <button key={s.id} onClick={()=>setActive(s.id)}
              className={`p-3 border text-left transition-all cursor-pointer bg-transparent ${
                active===s.id ? "border-[rgba(200,168,75,0.4)] bg-[rgba(200,168,75,0.04)]" : "border-[#1e2530] bg-[#0c0f13] hover:border-[#2a2f3a]"
              }`}>
              <div className="text-lg mb-1">{s.icon}</div>
              <div className="font-mono text-[0.65rem] text-[#c8cdd6] leading-tight">{s.npc}</div>
              <div className="font-mono text-[0.55rem] text-[#444] mt-0.5">{s.role}</div>
              {nextTimes[s.id] && (
                <div className="font-mono text-[0.55rem] mt-1.5" style={{color:active===s.id?"#c8a84b":"#333"}}>
                  ⏱ {timeUntil(nextTimes[s.id])}
                </div>
              )}
            </button>
          ))}

          {/* Search every shop at once — mirrors the in-game SEARCH tab, which
              routes any item to its own keeper no matter where you found it. */}
          <button onClick={()=>setActive(ALL)}
            className={`p-3 border text-left transition-all cursor-pointer bg-transparent ${
              isAll ? "border-[rgba(74,143,196,0.5)] bg-[rgba(74,143,196,0.06)]" : "border-[#1e2530] bg-[#0c0f13] hover:border-[#2a2f3a]"
            }`}>
            <div className="text-lg mb-1">🔍</div>
            <div className="font-mono text-[0.65rem] text-[#4a8fc4] leading-tight">Search all shops</div>
            <div className="font-mono text-[0.55rem] text-[#444] mt-0.5">Every item in rotation</div>
            <div className="font-mono text-[0.55rem] mt-1.5" style={{color:isAll?"#4a8fc4":"#333"}}>
              {totalAll || "—"} items
            </div>
          </button>
        </div>

        {/* Active shop */}
        <div className="border border-[#1e2530] bg-[#0a0d10]">

          {/* Shop header */}
          <div className="p-4 sm:p-5 border-b border-[#1e2530] flex items-start gap-4">
            {isAll ? (
              <div className="w-16 h-20 border border-[#1e2530] flex-shrink-0 hidden sm:flex items-center justify-center text-3xl bg-[#0f1318]">🔍</div>
            ) : shop!.portrait ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop!.portrait} alt={shop!.npc}
                className="w-16 h-20 object-cover border border-[#1e2530] flex-shrink-0 hidden sm:block" />
            ) : (
              <div className="w-16 h-20 border border-[#1e2530] flex-shrink-0 hidden sm:flex items-center justify-center text-3xl bg-[#0f1318]">
                {shop!.icon}
              </div>
            )}
            <div className="flex-1">
              <div className="font-display text-xl sm:text-2xl tracking-[2px] text-[#c8cdd6]" style={{fontFamily:"'Bebas Neue',sans-serif"}}>
                {isAll ? "EVERY SHOP" : shop!.label.toUpperCase()}
              </div>
              <div className="font-mono text-[0.68rem] text-[#555]">
                {isAll ? "Search the whole network — each result shows its keeper" : `${shop!.npc} · ${shop!.role}`}
              </div>
              <div className="font-mono text-[0.6rem] text-[#3a3a3a]">
                {isAll ? "🗺️ Items are only sold by their own keeper" : `📍 ${shop!.location}`}
              </div>
            </div>
            {!isAll && (
              <div className="text-right hidden sm:block flex-shrink-0">
                <div className="font-mono text-[0.58rem] text-[#3a3a3a] uppercase tracking-widest mb-0.5">Next restock</div>
                <div className="font-mono text-[0.72rem] text-accent">
                  {nextTimes[active] ? timeUntil(nextTimes[active]) : "—"}
                </div>
              </div>
            )}
          </div>

          {/* General stores: who runs them and where */}
          {active === "global" && (
            <div className="px-4 sm:px-5 py-3 border-b border-[#1e2530] bg-[#0c0f13]">
              <div className="font-mono text-[0.58rem] uppercase tracking-widest text-[#555] mb-2">Where to find them</div>
              <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                {GENERAL_KEEPERS.map(k => (
                  <div key={k.npc} className="font-mono text-[0.62rem] leading-relaxed">
                    <span className="text-[#c8cdd6]">{k.npc}</span>
                    <span className="text-[#444]"> · {k.towns.join(", ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Items */}
          <div className="p-4 sm:p-5">
            {loading ? (
              <p className="font-mono text-[0.72rem] text-[#2a2a2a] py-8 text-center tracking-widest">loading stock...</p>
            ) : allItems.length===0 ? (
              <div className="py-8 text-center">
                <p className="font-mono text-[0.75rem] text-[#333]">No stock data available.</p>
                <p className="font-mono text-[0.65rem] text-[#2a2a2a] mt-1">Check the <a href="/news" className="text-accent no-underline hover:underline">intel channel</a> for hints.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="font-mono text-[0.62rem] uppercase tracking-widest text-[#555]">
                    {filtered.length} item{filtered.length!==1?"s":""}{q ? " matched" : " in rotation"}
                  </span>
                  <span className="font-mono text-[0.58rem] text-[#2a2a2a] hidden sm:inline">· ▲▼ = dynamic price vs base</span>
                  <div className="flex-1" />
                  <input
                    value={search}
                    onChange={e=>setSearch(e.target.value)}
                    placeholder={isAll ? "search every shop…" : "search items…"}
                    className="font-mono text-[0.65rem] bg-[#0c0f13] border border-[#1e2530] px-2 py-1 text-[#c8cdd6] outline-none focus:border-[rgba(200,168,75,0.4)] w-full sm:w-48"
                  />
                </div>

                {filtered.length===0 ? (
                  <div className="py-8 text-center">
                    <p className="font-mono text-[0.7rem] text-[#333] m-0">No items match “{search}”.</p>
                    {!isAll && (
                      <button onClick={()=>setActive(ALL)}
                        className="font-mono text-[0.65rem] mt-3 px-3 py-1.5 border border-[#4a8fc4] text-[#4a8fc4] bg-transparent cursor-pointer hover:bg-[#4a8fc4] hover:text-black transition-all">
                        🔍 Search every shop instead
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid gap-2 sm:gap-3" style={{gridTemplateColumns:"repeat(auto-fill,minmax(165px,1fr))"}}>
                      {pageItems.map(item => (
                        <ItemCard key={`${item.shop_type}:${item.item_id}`} item={item} showShop={isAll} />
                      ))}
                    </div>

                    {/* Pagination */}
                    {pageCount > 1 && (
                      <div className="flex items-center justify-center gap-3 mt-5">
                        <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={safePage<=1}
                          className={`font-mono text-[0.65rem] px-3 py-1.5 border transition-all ${safePage<=1 ? "border-[#1a1a1a] text-[#2a2a2a] cursor-not-allowed" : "border-[#1e2530] text-[#888] hover:border-accent hover:text-accent cursor-pointer"}`}>
                          ‹ Prev
                        </button>
                        <span className="font-mono text-[0.62rem] text-[#555] tracking-widest">
                          Page {safePage} / {pageCount}
                        </span>
                        <button onClick={()=>setPage(p=>Math.min(pageCount,p+1))} disabled={safePage>=pageCount}
                          className={`font-mono text-[0.65rem] px-3 py-1.5 border transition-all ${safePage>=pageCount ? "border-[#1a1a1a] text-[#2a2a2a] cursor-not-allowed" : "border-[#1e2530] text-[#888] hover:border-accent hover:text-accent cursor-pointer"}`}>
                          Next ›
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          <div className="px-4 sm:px-5 py-2.5 border-t border-[#1e2530]" style={{background:"rgba(255,255,255,0.01)"}}>
            <p className="font-mono text-[0.6rem] text-[#333]">
              {isAll
                ? "💡 Every item is sold by its own keeper — the card tells you whose shop to visit."
                : active === "global"
                  ? <>💡 Every general store shows its <strong style={{color:"#555"}}>own part</strong> of this list (it changes with each rotation) - the ★ items are in all of them. Stand at the kiosk and right-click it.</>
                  : <>💡 Go to <strong style={{color:"#555"}}>{shop!.npc}</strong>&apos;s kiosk in {shop!.location} and right-click it. Prices shown include dynamic adjustments.</>}
            </p>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {icon:"🔄",title:"Rotating Stock",    body:"Every shop re-rolls its shelf every three days. Items marked ★ never rotate out - phones, bus tickets, the vehicle orb, the M9 and its ammo. Stock is finite and restocks on a timer."},
            {icon:"📈",title:"Dynamic Prices",    body:"Prices shift with Zombita's treasury and with what's being bought and sold. High demand or scarcity → prices rise; a flush treasury → cheaper."},
            {icon:"💰",title:"Selling",           body:"Keepers buy from you out of their own till - no till, no sale - minus a sell tax that follows the treasury. Sell Crops / Jewelry / All in one click. Coins from zombies sell at face value."},
            {icon:"🎟️",title:"Lottery",           body:"Every kiosk has a Lottery tab: 100 numbered tickets a batch - pick your numbers, scratch them in your bag, hand winners in at any kiosk."},
            {icon:"🏦",title:"Bank",              body:"Deposit the cash you carry or withdraw it again at any kiosk. Your wallet is shared with Discord and the website."},
            {icon:"🏪",title:"Player Marketplace",body:"List items for other players from any kiosk; browse from your phone's Marketplace app or online. A small listing fee while it waits; buyers pay a small tax and a delivery fee."},
          ].map(c => (
            <div key={c.title} className="border border-[#1e2530] bg-[#0c0f13] p-4">
              <div className="text-2xl mb-2">{c.icon}</div>
              <div className="font-display text-sm tracking-[2px] text-[#c8cdd6] mb-1" style={{fontFamily:"'Bebas Neue',sans-serif"}}>{c.title}</div>
              <p className="font-mono text-[0.65rem] text-[#555] leading-relaxed m-0">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
