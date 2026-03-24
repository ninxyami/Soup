"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { API, CURRENT_SEASON } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";

interface Post {
  id: string; display_name: string; avatar_url: string; content: string;
  image_url?: string; repost_of?: string; repost_author_name?: string;
  pinned: boolean; like_count: number; reply_count: number; created_at: number;
}

interface ServerStatus {
  online: boolean; player_count: number; max_players: number;
}

function LiveStatus() {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/api/server/status`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStatus(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="border border-[#1a1a1a] bg-[#0a0d10] p-5 w-full">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#1e1e1e] animate-pulse" />
        <span className="font-mono text-[0.62rem] tracking-widest text-[#2a2a2a] uppercase">Checking server status…</span>
      </div>
    </div>
  );

  if (!status) return null;

  const pct = status.max_players > 0 ? (status.player_count / status.max_players) * 100 : 0;
  const barColor = pct > 80 ? "#e05555" : pct > 50 ? "#c8a84b" : "#4a7c59";

  return (
    <div className="border border-[#1a1a1a] bg-[#0a0d10] w-full relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px" style={{
        background: status.online
          ? "linear-gradient(90deg, transparent, #4a7c5988, transparent)"
          : "linear-gradient(90deg, transparent, #7c4a4a55, transparent)"
      }} />

      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">

          {/* Status indicator */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${status.online ? "bg-[#4a7c59]" : "bg-[#7c4a4a]"}`}
              style={{
                boxShadow: status.online ? "0 0 10px #4a7c59, 0 0 20px #4a7c5944" : "none",
                animation: status.online ? "pulse 2s infinite" : "none"
              }}
            />
            <div>
              <p className={`font-mono text-[0.8rem] tracking-[0.2em] uppercase font-semibold ${status.online ? "text-[#4a7c59]" : "text-[#7c4a4a]"}`}>
                {status.online ? "Server Online" : "Server Offline"}
              </p>
              <p className="font-mono text-[0.58rem] tracking-widest text-[#333] uppercase">Live status</p>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-10 bg-[#1a1a1a] flex-shrink-0" />

          {status.online ? (
            <>
              {/* Player count */}
              <div className="flex-shrink-0">
                <p className="font-mono text-[0.58rem] tracking-widest text-[#333] uppercase mb-0.5">Survivors Online</p>
                <p className="font-['Bebas_Neue'] text-[1.6rem] leading-none" style={{ color: status.player_count > 0 ? "#e6e6e6" : "#444" }}>
                  {status.player_count}
                  <span className="font-mono text-[0.7rem] text-[#333] ml-1">/ {status.max_players}</span>
                </p>
              </div>

              {/* Divider */}
              <div className="hidden sm:block w-px h-10 bg-[#1a1a1a] flex-shrink-0" />

              {/* Capacity bar */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between mb-1.5">
                  <p className="font-mono text-[0.58rem] tracking-widest text-[#333] uppercase">Server Capacity</p>
                  <p className="font-mono text-[0.58rem] tracking-widest uppercase" style={{ color: barColor }}>{Math.round(pct)}%</p>
                </div>
                <div className="h-1.5 bg-[#111] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${pct}%`, background: barColor, boxShadow: `0 0 8px ${barColor}66` }}
                  />
                </div>
                <p className="font-mono text-[0.58rem] text-[#2a2a2a] mt-1.5">
                  {status.player_count === 0
                    ? "No survivors online — first one in sets the tone."
                    : status.player_count === 1
                    ? "One survivor out there. Could be you next."
                    : `${status.player_count} survivors in the field right now.`}
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1">
              <p className="text-[0.8rem] text-[#555]">The server is currently offline.</p>
              <p className="font-mono text-[0.62rem] text-[#333] mt-1">Check Discord for announcements and scheduled restarts.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function RecentPosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  useEffect(() => {
    fetch(`${API}/api/feed`, { credentials: "include" })
      .then(r => r.ok ? r.json() : { posts: [] })
      .then(d => setPosts((d.posts || []).slice(0, 3)))
      .catch(() => setPosts([]));
  }, []);
  if (posts.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {posts.map(post => (
        <Link key={post.id} href="/feed" className="no-underline block group">
          <div className="border border-[#1a1a1a] bg-[#0a0d10] p-3 hover:border-[#2a2a2a] transition-all">
            <div className="flex items-center gap-2 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.avatar_url} alt={post.display_name} width={20} height={20} className="rounded-full border border-[#222]" style={{ width: 20, height: 20 }} />
              <span className="font-mono text-[0.7rem] text-[#777] group-hover:text-[#4a7c59] transition-colors">{post.display_name}</span>
              <span className="font-mono text-[0.6rem] text-[#333] ml-auto">{timeAgo(post.created_at)}</span>
            </div>
            {post.content && <p className="text-[0.8rem] text-[#666] line-clamp-2 m-0">{post.content}</p>}
            <div className="flex gap-3 mt-1.5">
              <span className="font-mono text-[0.6rem] text-[#333]">💬 {post.reply_count}</span>
              <span className="font-mono text-[0.6rem] text-[#333]">🩸 {post.like_count}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

const FEATURES = [
  {
    icon: "🧟", title: "Zombita AI", slug: null, href: "/zombita/about",
    desc: "Custom AI with personality, 4-layer memory, passive perception, and daily reputation analysis.",
    tags: ["Custom AI", "Memory", "Personality"],
  },
  {
    icon: "💰", title: "Economy Engine", slug: "economy", href: "/features/economy",
    desc: "Full closed-loop economy — dynamic pricing, treasury, recession events, 5 NPC shops, lottery.",
    tags: ["Bronze/Silver/Gold", "Dynamic", "Marketplace"],
  },
  {
    icon: "🐺", title: "Mini-Games", slug: "games", href: "/features/games",
    desc: "Werewolf with 20+ roles, Quizarium trivia, Cards Against Humanity judged by Zombita, RPS, Connect Four.",
    tags: ["Werewolf", "Quizarium", "CAH"],
  },
  {
    icon: "💀", title: "World Events", slug: "events", href: "/features/events",
    desc: "Dawn of the Dead zombie hordes, Treasure Hunts, Faction Wars with bronze stakes.",
    tags: ["DotD", "Factions", "RCON"],
  },
  {
    icon: "📜", title: "Cradle Trials", slug: "campaign", href: "/features/campaign",
    desc: "Episodic narrative campaign with cipher puzzles, scheduled group sessions, and permanent progression.",
    tags: ["Campaign", "Act I", "Ciphers"],
  },
  {
    icon: "🌐", title: "Web Platform", slug: null, href: "/server",
    desc: "Full website — shop, marketplace, leaderboards, community feed, admin panel with live console.",
    tags: ["Shop", "Marketplace", "Leaderboards"],
  },
];

const STAT_ROWS = [
  { label: "Season", value: "1", sub: "New Dawn" },
  { label: "Currency Tiers", value: "3", sub: "Bronze · Silver · Gold" },
  { label: "NPC Shops", value: "5", sub: "Named characters" },
  { label: "Game Modes", value: "5", sub: "Werewolf to Connect Four" },
  { label: "Reputation Tiers", value: "7", sub: "Outcast → Legend" },
  { label: "Werewolf Roles", value: "20+", sub: "Cupid · Detective · Mayor" },
];

export default function HomePage() {
  return (
    <main>
      {/* ── HERO ── */}
      <header className="hero-bg relative min-h-[65vh] flex flex-col items-center justify-center text-center px-4 overflow-hidden">
        <div className="z-10 animate-fadeUp">
          <p className="font-mono text-[0.68rem] tracking-[0.3em] text-[#555] mb-4 uppercase">
            {CURRENT_SEASON}
          </p>
          <h1 className="text-[2rem] sm:text-[3.2rem] tracking-[0.22em] sm:tracking-[0.28em] mb-4 leading-none">
            STATE OF UNDEAD PURGE
          </h1>
          <p className="text-[#666] text-[0.85rem] sm:text-[0.9rem] max-w-[500px] mx-auto mb-6 leading-relaxed">
            A long-term PVE Project Zomboid community with a custom AI, full economy engine, 
            mini-games, faction wars, and a live narrative campaign.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a href="https://discord.gg/NCBPqP5Q" target="_blank" rel="noopener noreferrer"
              className="inline-block px-5 py-2.5 border border-[#5865F2] text-[#5865F2] no-underline text-[0.75rem] tracking-[0.12em] uppercase hover:bg-[#5865F2] hover:text-white transition-all">
              Join Discord
            </a>
            <Link href="/whitelist"
              className="inline-block px-5 py-2.5 border border-[#4a7c59] text-[#4a7c59] no-underline text-[0.75rem] tracking-[0.12em] uppercase hover:bg-[#4a7c59] hover:text-white transition-all">
              Apply Whitelist
            </Link>
            <Link href="/features"
              className="inline-block px-5 py-2.5 border border-[#2a2a2a] text-[#777] no-underline text-[0.75rem] tracking-[0.12em] uppercase hover:border-[#444] hover:text-[#e6e6e6] transition-all">
              Explore Features →
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-[900px] mx-auto px-4 sm:px-6">

        {/* ── LIVE SERVER STATUS ── */}
        <section className="pt-10 pb-4">
          <LiveStatus />
        </section>

        {/* ── WHAT IS THIS ── */}
        <section className="py-14 sm:py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
            <div>
              <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#4a7c59] uppercase mb-3">About the Server</p>
              <h2 className="text-[1.4rem] tracking-[0.12em] mb-4 !normal-case">Not Just a Game Server</h2>
              <p className="text-[#777] text-[0.88rem] leading-relaxed mb-3">
                SoUP is a long-term, PVE-focused private server where progress is slow by design and seasons last. 
                But the server itself is just part of the picture.
              </p>
              <p className="text-[#666] text-[0.85rem] leading-relaxed mb-3">
                Behind it runs <span className="text-[#e6e6e6]">Zombita</span> — a fully custom Discord bot with her 
                own personality, memory, and opinions. She manages a live economy, hosts games, narrates events, 
                and keeps track of every player&apos;s reputation over the entire season.
              </p>
              <p className="text-[#555] text-[0.82rem] leading-relaxed">
                This website is her front-end — shop, marketplace, leaderboards, community feed, and a full admin 
                panel with live server console.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {STAT_ROWS.map(s => (
                <div key={s.label} className="border border-[#1a1a1a] bg-[#0a0d10] p-4">
                  <div className="font-['Bebas_Neue'] text-[2rem] tracking-[0.1em] text-[#c8a84b] leading-none mb-1">{s.value}</div>
                  <div className="font-mono text-[0.6rem] tracking-widest text-[#555] uppercase mb-0.5">{s.label}</div>
                  <div className="font-mono text-[0.58rem] text-[#333]">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="h-px bg-[#1a1a1a]" />

        {/* ── FEATURES GRID ── */}
        <section className="py-14 sm:py-20">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#4a7c59] uppercase mb-2">Platform Features</p>
              <h2 className="!mb-0 !normal-case text-[1.2rem] tracking-[0.1em]">Everything That Makes SoUP Run</h2>
            </div>
            <Link href="/features" className="font-mono text-[0.65rem] tracking-widest text-[#444] hover:text-[#4a7c59] no-underline transition-colors uppercase hidden sm:block">
              All Features →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {FEATURES.map(f => (
              <Link key={f.title} href={f.href} className="no-underline group block">
                <div className="border border-[#1a1a1a] bg-[#0a0d10] p-5 h-full hover:border-[#2a2a2a] hover:bg-[#0d1117] transition-all relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c8a84b22] to-transparent group-hover:via-[#c8a84b44] transition-all" />
                  <div className="text-2xl mb-3">{f.icon}</div>
                  <h3 className="font-mono text-[0.78rem] tracking-[0.15em] text-[#e6e6e6] uppercase mb-2 group-hover:text-[#c8a84b] transition-colors">{f.title}</h3>
                  <p className="text-[0.78rem] text-[#555] leading-relaxed mb-3">{f.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {f.tags.map(t => (
                      <span key={t} className="font-mono text-[0.55rem] tracking-widest text-[#333] border border-[#222] px-1.5 py-0.5 uppercase">{t}</span>
                    ))}
                  </div>
                  <div className="mt-3 font-mono text-[0.62rem] tracking-widest text-[#333] group-hover:text-[#4a7c59] transition-colors uppercase">
                    Learn more →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <div className="h-px bg-[#1a1a1a]" />

        {/* ── ZOMBITA HIGHLIGHT ── */}
        <section className="py-14 sm:py-20">
          <div className="border border-[#1a1a1a] bg-[#0a0d10] p-6 sm:p-10 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#9775cc44] to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#9775cc22] to-transparent" />
            <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-center">
              <div className="md:col-span-3">
                <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#9775cc] uppercase mb-3">Meet Zombita</p>
                <h2 className="!mb-4 !normal-case text-[1.3rem] tracking-[0.1em]">Your Server&apos;s AI Personality</h2>
                <p className="text-[#666] text-[0.85rem] leading-relaxed mb-3">
                  Zombita is not a generic bot. She holds real conversations and passively watches 
                  every channel — chiming in without being asked, on her own terms.
                </p>
                <p className="text-[#555] text-[0.82rem] leading-relaxed mb-4">
                  She has a 4-layer memory system, tracks every player&apos;s reputation across the whole season, 
                  and writes her own announcements. She forms opinions. She remembers things. She has favourites.
                </p>
                <div className="flex flex-wrap gap-2 mb-5">
                  {["4-Layer Memory", "27 Mood States", "Daily Reputation Analysis", "Passive Perception", "Announcements"].map(t => (
                    <span key={t} className="font-mono text-[0.6rem] tracking-wider text-[#9775cc88] border border-[#9775cc22] px-2 py-1 uppercase">{t}</span>
                  ))}
                </div>
                <Link href="/zombita/about" className="inline-block font-mono text-[0.7rem] tracking-[0.15em] text-[#9775cc] border border-[#9775cc44] px-4 py-2 no-underline hover:bg-[#9775cc22] transition-all uppercase">
                  Meet Zombita →
                </Link>
              </div>
              <div className="md:col-span-2 flex justify-center">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/avatars/smile_01.webp" alt="Zombita" className="w-36 h-36 sm:w-44 sm:h-44 object-cover rounded-sm border border-[#9775cc33]" style={{ filter: "brightness(0.9) contrast(1.05)" }} />
                  <div className="absolute -bottom-3 -right-3 font-mono text-[0.55rem] tracking-widest text-[#9775cc] border border-[#9775cc33] bg-[#0a0d10] px-2 py-1 uppercase">
                    AI · Active
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-[#1a1a1a]" />

        {/* ── ECONOMY HIGHLIGHT ── */}
        <section className="py-14 sm:py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div>
              <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#c8a84b] uppercase mb-3">Economy System</p>
              <h2 className="!mb-4 !normal-case text-[1.2rem] tracking-[0.1em]">A Living Economy</h2>
              <p className="text-[#666] text-[0.85rem] leading-relaxed mb-3">
                Not a coin system — a full economic simulation. Prices shift with treasury health, 
                player wealth, and item demand. Recessions spike everything 1.4×–2.2×. 
                The whole thing runs without admin intervention.
              </p>
              <div className="space-y-2 mb-5">
                {[
                  { icon: "🟤", label: "Bronze · Silver · Gold", desc: "Three-tier currency" },
                  { icon: "🏪", label: "5 NPC Shops", desc: "Named characters, rotating stock" },
                  { icon: "📈", label: "Dynamic Pricing", desc: "Treasury × Demand × Wealth × Recession" },
                  { icon: "🏦", label: "Treasury System", desc: "5 health states, closed-loop economy" },
                  { icon: "🎰", label: "Lottery", desc: "1 Silver ticket, Katana top prize" },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3 border border-[#1a1a1a] px-3 py-2.5 bg-[#0a0d10]">
                    <span className="text-base">{item.icon}</span>
                    <div>
                      <div className="font-mono text-[0.7rem] text-[#e6e6e6] tracking-wider">{item.label}</div>
                      <div className="font-mono text-[0.6rem] text-[#444]">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/features/economy" className="inline-block font-mono text-[0.7rem] tracking-[0.15em] text-[#c8a84b] border border-[#c8a84b44] px-4 py-2 no-underline hover:bg-[#c8a84b11] transition-all uppercase">
                Full Economy Guide →
              </Link>
            </div>

            <div>
              <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#e05555] uppercase mb-3">World Events</p>
              <h2 className="!mb-4 !normal-case text-[1.2rem] tracking-[0.1em]">The World Reacts</h2>
              <p className="text-[#666] text-[0.85rem] leading-relaxed mb-3">
                Zombie hordes, treasure hunts, faction wars. Events that affect every player 
                simultaneously and create server lore — moments people talk about weeks later.
              </p>
              <div className="space-y-2 mb-5">
                {[
                  { icon: "💀", label: "Dawn of the Dead", desc: "Multi-wave zombie hordes via RCON" },
                  { icon: "🗺️", label: "Treasure Hunt", desc: "Race to claim hidden caches" },
                  { icon: "⚔️", label: "Faction Wars", desc: "Declare war, stake bronze, kill to win" },
                  { icon: "📜", label: "Cradle Trials", desc: "Episodic campaign with ciphers" },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3 border border-[#1a1a1a] px-3 py-2.5 bg-[#0a0d10]">
                    <span className="text-base">{item.icon}</span>
                    <div>
                      <div className="font-mono text-[0.7rem] text-[#e6e6e6] tracking-wider">{item.label}</div>
                      <div className="font-mono text-[0.6rem] text-[#444]">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/features/events" className="inline-block font-mono text-[0.7rem] tracking-[0.15em] text-[#e05555] border border-[#e0555544] px-4 py-2 no-underline hover:bg-[#e0555511] transition-all uppercase">
                All World Events →
              </Link>
            </div>
          </div>
        </section>

        <div className="h-px bg-[#1a1a1a]" />

        {/* ── GAMES HIGHLIGHT ── */}
        <section className="py-14 sm:py-20">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#4a8fc4] uppercase mb-2">Mini-Games</p>
              <h2 className="!mb-0 !normal-case text-[1.2rem] tracking-[0.1em]">Five Games, One Bot</h2>
            </div>
            <Link href="/features/games" className="font-mono text-[0.65rem] tracking-widest text-[#444] hover:text-[#4a8fc4] no-underline transition-colors uppercase hidden sm:block">
              All Games →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {[
              { icon: "🐺", name: "Werewolf", desc: "20+ roles, AI narrator, DM night actions", color: "#e05555" },
              { icon: "🧠", name: "Quizarium", desc: "Speed trivia, 5 categories, global leaderboard", color: "#4a8fc4" },
              { icon: "🃏", name: "Cards Against Humanity", desc: "Judged by Zombita, in character — merciless picks, brutal commentary", color: "#9775cc" },
              { icon: "✊", name: "Rock Paper Scissors", desc: "vs players or Zombita, coin bets, 5% rake", color: "#4caf7d" },
              { icon: "🔵", name: "Connect Four", desc: "6×7 board, Discord buttons, coin bets", color: "#c8a84b" },
            ].map(g => (
              <Link key={g.name} href="/features/games" className="no-underline group">
                <div className="border border-[#1a1a1a] bg-[#0a0d10] p-4 h-full hover:border-[#2a2a2a] transition-all relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${g.color}44, transparent)` }} />
                  <div className="text-xl mb-2">{g.icon}</div>
                  <div className="font-mono text-[0.7rem] tracking-wider mb-1.5" style={{ color: g.color }}>{g.name}</div>
                  <p className="text-[0.72rem] text-[#444] leading-relaxed">{g.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <div className="h-px bg-[#1a1a1a]" />

        {/* ── COMMUNITY FEED ── */}
        <section className="py-14 sm:py-20">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#4a7c59] uppercase mb-2">Community</p>
              <h2 className="!mb-0 !normal-case text-[1.2rem] tracking-[0.1em]">Recent Transmissions</h2>
            </div>
            <Link href="/feed" className="font-mono text-[0.65rem] tracking-widest text-[#444] hover:text-[#4a7c59] no-underline transition-colors uppercase">
              All Posts →
            </Link>
          </div>
          <RecentPosts />
        </section>

        <div className="h-px bg-[#1a1a1a]" />

        {/* ── CTA ── */}
        <section className="py-14 sm:py-20 text-center">
          <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#555] uppercase mb-4">Ready to Survive?</p>
          <h2 className="!mb-4 !normal-case text-[1.4rem] tracking-[0.12em]">Join the Community</h2>
          <p className="text-[#555] text-[0.85rem] max-w-[400px] mx-auto mb-8">
            Whitelist is required to access the full economy, games, and community features. 
            Start on Discord.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a href="https://discord.gg/NCBPqP5Q" target="_blank" rel="noopener noreferrer"
              className="inline-block px-6 py-3 border border-[#5865F2] text-[#5865F2] no-underline text-[0.75rem] tracking-[0.12em] uppercase hover:bg-[#5865F2] hover:text-white transition-all">
              Join Discord
            </a>
            <Link href="/whitelist"
              className="inline-block px-6 py-3 border border-[#4a7c59] text-[#4a7c59] no-underline text-[0.75rem] tracking-[0.12em] uppercase hover:bg-[#4a7c59] hover:text-white transition-all">
              Apply for Whitelist
            </Link>
          </div>
        </section>

      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </main>
  );
}
