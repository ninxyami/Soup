"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";
import { bronzeToDisplay } from "@/lib/api";
import { timeAgo } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Listing {
  listing_id:    string;
  seller_name:   string;
  item_id:       string;
  item_name:     string;
  quantity:      number;
  price_per_unit: number;
  tier:          string;
  status:        string;
  created_at:    number;
  expires_at:    number;
}

const TIER_COLOR: Record<string, string> = {
  common:    "#6b7280",
  uncommon:  "#4caf7d",
  rare:      "#4a8fc4",
  legendary: "#c8a84b",
};

const TIER_LABEL: Record<string, string> = {
  common: "Common", uncommon: "Uncommon", rare: "Rare", legendary: "Legendary",
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function timeUntilExpiry(ts: number): string {
  const diff = ts - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "Expired";
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h left`;
  return `${h}h ${Math.floor((diff % 3600) / 60)}m left`;
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTING CARD
// ─────────────────────────────────────────────────────────────────────────────

function ListingCard({ listing }: { listing: Listing }) {
  const color = TIER_COLOR[listing.tier] || TIER_COLOR.common;
  const total = listing.price_per_unit * listing.quantity;
  const expiring = listing.expires_at - Math.floor(Date.now() / 1000) < 86400;

  return (
    <div className="bg-[#0f1318] border border-[#1e2530] p-4 relative hover:border-[rgba(200,168,75,0.2)] transition-all flex flex-col gap-2">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: color }} />

      {/* Item name + tier */}
      <div className="flex items-start justify-between gap-2 mt-1">
        <div className="font-medium text-[0.9rem] text-[#c8cdd6] leading-tight">{listing.item_name}</div>
        <span className="font-mono text-[0.55rem] px-1.5 py-0.5 border flex-shrink-0" style={{ color, borderColor: color + "44", background: color + "11" }}>
          {TIER_LABEL[listing.tier] || listing.tier}
        </span>
      </div>

      <div className="font-mono text-[0.58rem] text-[#2a2a2a] -mt-1 truncate">{listing.item_id}</div>

      {/* Quantity + price */}
      <div className="flex items-end justify-between">
        <div>
          <div className="font-mono text-[0.65rem] text-[#555]">×{listing.quantity} available</div>
          <div className="font-mono text-[0.7rem] text-[#c8cdd6] mt-0.5">{listing.price_per_unit.toLocaleString()} 🟤 each</div>
          {listing.quantity > 1 && (
            <div className="font-mono text-[0.6rem] text-accent">{total.toLocaleString()} 🟤 total</div>
          )}
        </div>
      </div>

      {/* Seller + expiry */}
      <div className="flex items-center justify-between pt-2 border-t border-[#1a1a1a] mt-auto">
        <span className="font-mono text-[0.62rem] text-[#555]">by {listing.seller_name}</span>
        <span className={`font-mono text-[0.58rem] ${expiring ? "text-[#e05555]" : "text-[#333]"}`}>
          {timeUntilExpiry(listing.expires_at)}
        </span>
      </div>

      {/* In-game only note */}
      <div className="font-mono text-[0.58rem] text-[#2a2a2a] text-center pt-1 border-t border-[#111]">
        Buy in-game at any shopkeeper · Marketplace tab
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [listings,    setListings]    = useState<Listing[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [sortBy,      setSortBy]      = useState<"price_asc" | "price_desc" | "newest" | "expiring">("newest");
  const [myListings,  setMyListings]  = useState<Listing[]>([]);
  const [user,        setUser]        = useState<any>(null);
  const [tab,         setTab]         = useState<"all" | "mine">("all");

  const load = async () => {
    try {
      const r = await fetch(`${API}/api/marketplace/listings`);
      if (!r.ok) return;
      const d = await r.json();
      setListings(d.listings || []);
    } catch {}
    finally { setLoading(false); }
  };

  const loadMine = async () => {
    try {
      const r = await fetch(`${API}/api/marketplace/my-listings`, { credentials: "include" });
      if (!r.ok) return;
      const d = await r.json();
      setMyListings(d.listings || []);
    } catch {}
  };

  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(me => { if (me) { setUser(me); loadMine(); } })
      .catch(() => {});
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  // Filter + sort
  const filtered = listings
    .filter(l => {
      if (!search) return true;
      const q = search.toLowerCase();
      return l.item_name.toLowerCase().includes(q) || l.seller_name.toLowerCase().includes(q) || l.item_id.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === "price_asc")  return a.price_per_unit - b.price_per_unit;
      if (sortBy === "price_desc") return b.price_per_unit - a.price_per_unit;
      if (sortBy === "expiring")   return a.expires_at - b.expires_at;
      return b.created_at - a.created_at; // newest
    });

  const displayed = tab === "mine" ? myListings : filtered;

  return (
    <div className="scanline min-h-screen" style={{ background: "#080a0c", color: "#c8cdd6" }}>

      {/* Header */}
      <header className="px-4 sm:px-8 py-4 border-b border-[#1e2530] bg-[#0f1318] sticky top-[49px] z-10">
        <div className="max-w-[1000px] mx-auto flex items-center gap-3">
          <a href="/" className="font-mono text-[0.65rem] text-[#444] hover:text-[#c8cdd6] no-underline tracking-widest hidden sm:block">← S.O.U.P</a>
          <span className="font-display text-2xl tracking-[3px] text-[#4a8fc4]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            MARKETPLACE
          </span>
          <div className="flex-1" />
          <a href="/shop" className="font-mono text-[0.65rem] px-3 py-1.5 border border-[#1e2530] text-[#555] no-underline hover:border-accent hover:text-accent transition-all">
            🏪 Shops
          </a>
          <a href="/news" className="font-mono text-[0.65rem] px-3 py-1.5 border border-[#1e2530] text-[#555] no-underline hover:border-accent hover:text-accent transition-all">
            📰 News
          </a>
        </div>
      </header>

      {/* How to use banner */}
      <div className="border-b border-[#1e2530]" style={{ background: "rgba(74,143,196,0.05)" }}>
        <div className="max-w-[1000px] mx-auto px-4 sm:px-8 py-2">
          <p className="font-mono text-[0.63rem] text-center" style={{ color: "#4a8fc4" }}>
            Press <kbd className="font-mono text-[0.6rem] bg-[#1a1a1a] border border-[#333] px-1 py-0.5">F7</kbd> anywhere in-game to list items · Visit any shopkeeper to buy · 3% listing tax · Listings expire after 7 days
          </p>
        </div>
      </div>

      <div className="max-w-[1000px] mx-auto px-4 sm:px-8 py-6 sm:py-8">

        {/* Title + stats */}
        <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl tracking-[4px] text-[#c8cdd6] mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              PLAYER MARKETPLACE
            </h1>
            <p className="font-mono text-[0.72rem] text-[#555]">
              {listings.length} active listing{listings.length !== 1 ? "s" : ""} from the community · Browse here, buy in-game
            </p>
          </div>
          {user && (
            <div className="flex items-center gap-2 text-right">
              <div className="border border-[#1e2530] bg-[#0c0f13] px-3 py-2">
                <div className="font-mono text-[0.58rem] text-[#3a3a3a] uppercase tracking-widest">Your listings</div>
                <div className="font-mono text-[0.88rem] text-[#c8cdd6]">{myListings.filter(l=>l.status==="active").length}</div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs (all / mine) */}
        {user && (
          <div className="flex gap-0 border-b border-[#1e2530] mb-5">
            {(["all","mine"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`font-mono text-[0.7rem] uppercase tracking-widest px-4 py-2 border-b-2 -mb-px bg-transparent cursor-pointer transition-all ${
                  tab === t ? "border-[#4a8fc4] text-[#4a8fc4]" : "border-transparent text-[#444] hover:text-[#c8cdd6]"
                }`}>
                {t === "all" ? `All Listings (${listings.length})` : `My Listings (${myListings.length})`}
              </button>
            ))}
          </div>
        )}

        {/* Search + sort (all tab only) */}
        {tab === "all" && (
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search items or sellers..."
              className="flex-1 bg-[#0c0f13] border border-[#1e2530] text-[#c8cdd6] px-3 py-2 font-mono text-[0.78rem] outline-none focus:border-[#4a8fc4] placeholder:text-[#2a2a2a]"
            />
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
              className="bg-[#0c0f13] border border-[#1e2530] text-[#555] px-3 py-2 font-mono text-[0.72rem] outline-none focus:border-[#4a8fc4] cursor-pointer">
              <option value="newest">Newest first</option>
              <option value="price_asc">Price: Low → High</option>
              <option value="price_desc">Price: High → Low</option>
              <option value="expiring">Expiring soon</option>
            </select>
          </div>
        )}

        {/* Listings */}
        {loading ? (
          <div className="py-16 text-center">
            <p className="font-mono text-[0.72rem] text-[#2a2a2a] tracking-widest">loading the market...</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center border border-[#1e2530] bg-[#0c0f13]">
            <p className="text-3xl mb-3">📭</p>
            <p className="font-mono text-[0.78rem] text-[#333]">
              {tab === "mine" ? "You have no active listings." : search ? "No listings match your search." : "No active listings right now."}
            </p>
            {tab === "all" && !search && (
              <p className="font-mono text-[0.65rem] text-[#2a2a2a] mt-2">
                Press <kbd className="font-mono text-[0.6rem] bg-[#1a1a1a] border border-[#333] px-1 py-0.5">F7</kbd> in-game to be the first to list something.
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {displayed.map(l => <ListingCard key={l.listing_id} listing={l} />)}
          </div>
        )}

        {/* How marketplace works */}
        <div className="mt-10 border border-[#1e2530] bg-[#0c0f13] p-5 sm:p-6">
          <div className="font-display text-xl tracking-[3px] text-[#c8cdd6] mb-4" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            HOW THE MARKETPLACE WORKS
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { step: "01", title: "List anywhere",      body: "Press F7 anywhere in-game to open the marketplace. Set your price, select quantity, list it. 3% listing tax is charged upfront." },
              { step: "02", title: "Players browse",     body: "Anyone can check listings here on the website, or open the Marketplace tab at any shopkeeper NPC in-game." },
              { step: "03", title: "Buy at a shopkeeper", body: "To buy a listing, visit any shopkeeper in-game and open their Marketplace tab. The item is handed to you on the spot." },
              { step: "04", title: "Seller gets paid",   body: "Coins go to the seller automatically when someone buys. Listing expires after 7 days if unsold — item returned to seller." },
            ].map(s => (
              <div key={s.step} className="flex gap-3">
                <span className="font-display text-2xl text-[#1e2530] flex-shrink-0" style={{ fontFamily: "'Bebas Neue', sans-serif", lineHeight: 1 }}>{s.step}</span>
                <div>
                  <div className="font-mono text-[0.72rem] text-[#c8cdd6] mb-0.5">{s.title}</div>
                  <p className="font-mono text-[0.65rem] text-[#555] leading-relaxed m-0">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
