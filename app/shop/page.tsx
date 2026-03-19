"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";

const SHOPS = [
  { id: "food",     label: "Maya's Kitchen",   npc: "Maya Chen",    role: "Food & Supplies",       icon: "🍽️", location: "Riverside Strip Mall",        portrait: "/shop/maya.png"   },
  { id: "weapons",  label: "Viktor's Armory",   npc: "Viktor Rask",  role: "Arms & Ammunition",     icon: "⚔️", location: "Gun Store, West Point",        portrait: "/shop/viktor.png" },
  { id: "carparts", label: "Sera's Garage",      npc: "Sera Okafor",  role: "Parts & Mechanics",     icon: "🔧", location: "Muldraugh Garage",             portrait: "/shop/sera.png"   },
  { id: "gas",      label: "Gas Stations",       npc: "Various",      role: "Road Supplies",         icon: "⛽", location: "Scattered across the map",     portrait: null               },
  { id: "all",      label: "Community Hub",      npc: "Lena Vasquez", role: "Everything + Vehicles", icon: "🏪", location: "Fallas Lake Community Centre", portrait: "/shop/lena.png"   },
];

const TIER_COLOR: Record<string,string> = {
  common:"#6b7280", uncommon:"#4caf7d", rare:"#4a8fc4", legendary:"#c8a84b",
};
const TIER_LABEL: Record<string,string> = {
  common:"Common", uncommon:"Uncommon", rare:"Rare", legendary:"Legendary",
};

interface Item {
  item_id:      string;
  name:         string;
  buy?:         number;
  base_buy?:    number;
  sell?:        number;
  tier:         string;
  price_factor?: number;
}

function timeUntil(ts:number):string {
  const diff = ts - Math.floor(Date.now()/1000);
  if (diff<=0) return "Restocking soon";
  const d=Math.floor(diff/86400), h=Math.floor((diff%86400)/3600);
  if (d>0) return `~${d}d ${h}h`;
  return `~${h}h ${Math.floor((diff%3600)/60)}m`;
}

function PriceBadge({ factor }: { factor?: number }) {
  if (!factor || Math.abs(factor - 1.0) < 0.05) return null;
  const up    = factor > 1.0;
  const pct   = Math.round(Math.abs(factor - 1.0) * 100);
  return (
    <span className="font-mono text-[0.55rem] px-1 py-0.5 ml-1"
          style={{ background: up ? "rgba(224,85,85,0.15)" : "rgba(76,175,77,0.15)",
                   color: up ? "#e05555" : "#4caf7d", border: `1px solid ${up?"#e05555":"#4caf7d"}44` }}>
      {up ? "▲" : "▼"}{pct}%
    </span>
  );
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

function ItemCard({ item }: { item: Item }) {
  const color  = TIER_COLOR[item.tier]||TIER_COLOR.common;
  const isDyn  = item.price_factor && Math.abs(item.price_factor-1.0) >= 0.05;
  const price  = item.buy ?? 0;
  return (
    <div className="bg-[#0f1318] border border-[#1e2530] p-3 relative hover:border-[rgba(200,168,75,0.2)] transition-all">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{background:color}} />
      <div className="mt-1 font-medium text-[0.88rem] text-[#c8cdd6] leading-tight mb-1">{item.name}</div>
      <div className="font-mono text-[0.58rem] text-[#2a2a2a] mb-2 truncate">{item.item_id}</div>
      <div className="flex items-end justify-between">
        <div>
          {price > 0 && (
            <div className="flex items-center gap-1">
              <span className="font-mono text-[0.72rem]" style={{color}}>{formatPrice(price)}</span>
              {isDyn && <PriceBadge factor={item.price_factor} />}
            </div>
          )}
          {item.base_buy!=null && isDyn && (
            <div className="font-mono text-[0.58rem] text-[#3a3a3a] line-through">{formatPrice(item.base_buy)}</div>
          )}
        </div>
        <span className="font-mono text-[0.55rem] px-1.5 py-0.5 border" style={{color,borderColor:color+"44",background:color+"11"}}>
          {TIER_LABEL[item.tier]||item.tier}
        </span>
      </div>
    </div>
  );
}

export default function ShopPage() {
  const [rotations,   setRotations]   = useState<Record<string,Item[]>>({});
  const [nextTimes,   setNextTimes]   = useState<Record<string,number>>({});
  const [active,      setActive]      = useState("food");
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      try {
        // Load all rotations with dynamic prices
        const types = ["food","weapons","carparts","gas","all"];
        const results: Record<string,Item[]> = {};
        const times:   Record<string,number> = {};

        await Promise.all(types.map(async (t) => {
          try {
            const r = await fetch(`${API}/api/marketplace/rotation-with-prices?shop_type=${t}`);
            if (r.ok) {
              const d = await r.json();
              results[t] = d.items || [];
            }
          } catch {}
        }));

        // Get next times separately
        try {
          const r = await fetch(`${API}/api/marketplace/all-rotations`);
          if (r.ok) {
            const d = await r.json();
            Object.assign(times, d.next_times || {});
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

  const shop  = SHOPS.find(s=>s.id===active)!;
  const items = rotations[active]||[];

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
            ⚠️ <strong>All transactions are in-game only.</strong> Right-click any shopkeeper NPC to buy or sell. Prices adjust dynamically with supply and demand.
          </p>
        </div>
      </div>

      <div className="max-w-[1000px] mx-auto px-4 sm:px-8 py-6 sm:py-8">

        <div className="mb-6">
          <h1 className="font-display text-3xl sm:text-4xl tracking-[4px] text-[#c8cdd6] mb-1" style={{fontFamily:"'Bebas Neue',sans-serif"}}>
            SHOP NETWORK
          </h1>
          <p className="font-mono text-[0.72rem] text-[#555]">
            Five shops. Eight characters. Stock rotates every 2–5 days.{" "}
            <a href="/news" className="text-accent no-underline hover:underline">Zombita drops hints</a> before it happens.
            Marketplace via <kbd className="font-mono text-[0.62rem] bg-[#1a1a1a] border border-[#333] px-1 py-0.5">F7</kbd> anywhere in-game.
          </p>
        </div>

        {/* Shop selector */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
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
        </div>

        {/* Active shop */}
        <div className="border border-[#1e2530] bg-[#0a0d10]">

          {/* Shop header with portrait */}
          <div className="p-4 sm:p-5 border-b border-[#1e2530] flex items-start gap-4">
            {shop.portrait && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.portrait} alt={shop.npc}
                className="w-16 h-20 object-cover border border-[#1e2530] flex-shrink-0 hidden sm:block"
                style={{imageRendering:"auto"}} />
            )}
            <div className="flex-1">
              <div className="font-display text-xl sm:text-2xl tracking-[2px] text-[#c8cdd6]" style={{fontFamily:"'Bebas Neue',sans-serif"}}>
                {shop.label.toUpperCase()}
              </div>
              <div className="font-mono text-[0.68rem] text-[#555]">{shop.npc} · {shop.role}</div>
              <div className="font-mono text-[0.6rem] text-[#3a3a3a]">📍 {shop.location}</div>
            </div>
            <div className="text-right hidden sm:block flex-shrink-0">
              <div className="font-mono text-[0.58rem] text-[#3a3a3a] uppercase tracking-widest mb-0.5">Next restock</div>
              <div className="font-mono text-[0.72rem] text-accent">
                {nextTimes[active] ? timeUntil(nextTimes[active]) : "—"}
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="p-4 sm:p-5">
            {loading ? (
              <p className="font-mono text-[0.72rem] text-[#2a2a2a] py-8 text-center tracking-widest">loading stock...</p>
            ) : items.length===0 ? (
              <div className="py-8 text-center">
                <p className="font-mono text-[0.75rem] text-[#333]">No stock data available.</p>
                <p className="font-mono text-[0.65rem] text-[#2a2a2a] mt-1">Check the <a href="/news" className="text-accent no-underline hover:underline">intel channel</a> for hints.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-mono text-[0.62rem] uppercase tracking-widest text-[#555]">
                    {items.length} item{items.length!==1?"s":""} in rotation
                  </span>
                  <span className="font-mono text-[0.58rem] text-[#2a2a2a]">· ▲▼ = dynamic price vs base</span>
                </div>
                <div className="grid gap-2 sm:gap-3" style={{gridTemplateColumns:"repeat(auto-fill,minmax(165px,1fr))"}}>
                  {items.map(item => <ItemCard key={item.item_id} item={item} />)}
                </div>
              </>
            )}
          </div>

          <div className="px-4 sm:px-5 py-2.5 border-t border-[#1e2530]" style={{background:"rgba(255,255,255,0.01)"}}>
            <p className="font-mono text-[0.6rem] text-[#333]">
              💡 Right-click <strong style={{color:"#555"}}>{shop.npc}</strong> in-game → open shop. Prices shown include dynamic adjustments.
            </p>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-8 grid sm:grid-cols-3 gap-3">
          {[
            {icon:"🔄",title:"Rotating Stock",    body:"Each shop rotates every 2–5 days. Zombita hints at what's coming before it happens."},
            {icon:"📈",title:"Dynamic Prices",    body:"Prices shift based on how much is being bought, sold, and traded. High demand → prices rise. Scarcity → prices rise."},
            {icon:"🏪",title:"Player Marketplace",body:"Players list items for each other. Browse any shop's Marketplace tab in-game, or view all listings online."},
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
