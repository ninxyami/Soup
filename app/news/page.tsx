"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface NewsPost {
  id:         string;
  content:    string;
  created_at: number;
  type?:      "restock" | "ban" | "market" | "event" | "general";
  shop_type?: string;
  npc_name?:  string;
}

const SHOP_ICONS: Record<string, string> = {
  food:     "🍽️",
  weapons:  "⚔️",
  carparts: "🔧",
  gas:      "⛽",
  all:      "🏪",
};

const TYPE_ACCENT: Record<string, string> = {
  restock: "#c8a84b",
  ban:     "#e05555",
  market:  "#4a8fc4",
  event:   "#4caf7d",
  general: "#6b7280",
};

// ─────────────────────────────────────────────────────────────────────────────
// NEWS CARD
// ─────────────────────────────────────────────────────────────────────────────

function NewsCard({ post }: { post: NewsPost }) {
  const type   = post.type || "general";
  const accent = TYPE_ACCENT[type] || TYPE_ACCENT.general;
  const icon   = type === "restock"  ? (SHOP_ICONS[post.shop_type || ""] || "🔄")
               : type === "ban"      ? "🔨"
               : type === "market"   ? "🏪"
               : type === "event"    ? "⚡"
               : "📰";

  // Strip the leading emoji if it's already in the content
  const content = post.content.replace(/^[📰🔨🏪⚡🔄]\s*/, "");

  return (
    <article className="border-b border-[#111] bg-[#0d1117] p-4 hover:bg-[#0f1318] transition-colors"
             style={{ borderLeft: `2px solid ${accent}` }}>
      <div className="flex items-start gap-3">
        {/* Zombita avatar placeholder */}
        <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center border border-[#1e2530] bg-[#0a0d10]"
             style={{ fontSize: "1.1rem" }}>
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-baseline gap-2 flex-wrap mb-1">
            <span className="font-mono text-[0.82rem] text-[#c8a84b]">Zombita</span>
            <span className="font-mono text-[0.6rem] text-[#2a2a2a]">·</span>
            <span className="font-mono text-[0.6rem] text-[#2a2a2a]">{timeAgo(post.created_at)}</span>
            {type !== "general" && (
              <span className="font-mono text-[0.55rem] px-1.5 py-0.5 ml-auto border" style={{ color: accent, borderColor: accent + "44", background: accent + "11" }}>
                {type === "restock" ? "RESTOCK" : type === "ban" ? "BAN" : type === "market" ? "MARKET" : "EVENT"}
              </span>
            )}
          </div>

          {/* Content */}
          <p className="text-[0.88rem] text-[#c8cdd6] leading-relaxed whitespace-pre-wrap break-words m-0">
            {content}
          </p>

          {/* Shop link if restock */}
          {type === "restock" && post.shop_type && (
            <a href="/shop"
               className="inline-block mt-2 font-mono text-[0.62rem] text-[#555] hover:text-accent no-underline transition-colors">
              Check current stock →
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function NewsPage() {
  const [posts,   setPosts]   = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<string>("all");

  useEffect(() => {
    const load = async () => {
      try {
        // Pull from the feed filtered to Zombita's news posts
        const r = await fetch(`${API}/api/feed/news`);
        if (r.ok) {
          const d = await r.json();
          setPosts(d.posts || []);
        } else {
          // Fallback — fetch the regular feed and filter for Zombita
          const r2 = await fetch(`${API}/api/feed`, { credentials: "include" });
          if (r2.ok) {
            const d2 = await r2.json();
            const all = (d2.posts || []) as any[];
            // Zombita's display name is "Zombita" or similar
            const filtered = all.filter((p: any) =>
              p.display_name?.toLowerCase().includes("zombita") ||
              p.content?.includes("restock") ||
              p.content?.startsWith("📰") ||
              p.content?.startsWith("🔨")
            );
            setPosts(filtered.map((p: any) => ({
              id:         p.id,
              content:    p.content,
              created_at: p.created_at,
              type:       p.content?.startsWith("🔨") ? "ban"
                        : p.content?.includes("restock") || p.content?.startsWith("📰") ? "restock"
                        : "general",
            })));
          }
        }
      } catch {}
      finally { setLoading(false); }
    };
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  const filtered = filter === "all" ? posts : posts.filter(p => (p.type || "general") === filter);

  const counts = {
    all:     posts.length,
    restock: posts.filter(p => p.type === "restock").length,
    ban:     posts.filter(p => p.type === "ban").length,
    market:  posts.filter(p => p.type === "market").length,
    event:   posts.filter(p => p.type === "event").length,
  };

  return (
    <div className="scanline min-h-screen" style={{ background: "#080a0c", color: "#c8cdd6" }}>

      {/* Header */}
      <header className="px-4 sm:px-8 py-4 border-b border-[#1e2530] bg-[#0f1318] sticky top-[49px] z-10">
        <div className="max-w-[680px] mx-auto flex items-center gap-3">
          <a href="/" className="font-mono text-[0.65rem] text-[#444] hover:text-[#c8cdd6] no-underline tracking-widest hidden sm:block">← S.O.U.P</a>
          <span className="font-display text-2xl tracking-[3px] text-[#c8a84b]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            ZOMBITA&apos;S INTEL
          </span>
          <div className="flex-1" />
          <a href="/shop" className="font-mono text-[0.65rem] px-3 py-1.5 border border-[#1e2530] text-[#555] no-underline hover:border-accent hover:text-accent transition-all">
            🏪 Shops
          </a>
          <a href="/marketplace" className="font-mono text-[0.65rem] px-3 py-1.5 border border-[#1e2530] text-[#555] no-underline hover:border-[#4a8fc4] hover:text-[#4a8fc4] transition-all">
            🛒 Market
          </a>
        </div>
      </header>

      <div className="max-w-[680px] mx-auto">

        {/* Sticky filter bar */}
        <div className="px-4 py-3 border-b border-[#111] sticky top-[97px] z-10 bg-[rgba(8,10,12,0.95)] backdrop-blur-sm flex items-center gap-2 flex-wrap">
          <h1 className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-[#555]">Shop Intel</h1>
          <span className="font-mono text-[0.6rem] text-[#2a2a2a]">·</span>
          <div className="flex gap-1 flex-wrap">
            {(["all","restock","ban","market","event"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`font-mono text-[0.6rem] uppercase tracking-widest px-2 py-1 border transition-all cursor-pointer bg-transparent ${
                  filter === f
                    ? "border-[rgba(200,168,75,0.4)] text-accent"
                    : "border-transparent text-[#333] hover:text-[#777]"
                }`}>
                {f === "all" ? `All (${counts.all})` : `${f} (${counts[f]})`}
              </button>
            ))}
          </div>
          <button onClick={() => window.location.reload()}
            className="ml-auto font-mono text-[0.62rem] text-[#333] hover:text-[#4a7c59] bg-transparent border-none cursor-pointer transition-colors">
            ↻ refresh
          </button>
        </div>

        {/* Description */}
        <div className="px-4 py-4 border-b border-[#111]">
          <div className="flex gap-3 items-start">
            <div className="w-9 h-9 flex-shrink-0 border border-[rgba(200,168,75,0.2)] bg-[rgba(200,168,75,0.05)] flex items-center justify-center text-lg">
              🧟
            </div>
            <div>
              <p className="font-mono text-[0.75rem] text-[#c8a84b] mb-0.5">Zombita</p>
              <p className="text-[0.82rem] text-[#6b7280] leading-relaxed m-0">
                intel on shop restocks, market events, and community incidents. sometimes accurate. sometimes not.{" "}
                <span className="text-[#3a3a3a]">you've been warned.</span>
              </p>
            </div>
          </div>
        </div>

        {/* Posts */}
        {loading ? (
          <div className="py-16 text-center">
            <p className="font-mono text-[0.72rem] text-[#2a2a2a] tracking-widest">tuning in...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center px-4">
            <p className="text-3xl mb-4">📡</p>
            <p className="font-mono text-[0.8rem] text-[#333] italic">no transmissions in this category yet.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map(post => (
              <NewsCard key={post.id} post={post} />
            ))}
            <p className="py-6 text-center font-mono text-[0.62rem] text-[#2a2a2a]">
              — end of transmission —
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
