"use client";
import Link from "next/link";
import { CURRENT_SEASON } from "@/lib/constants";

const FEATURE_SECTIONS = [
  {
    category: "AI & Personality",
    color: "#9775cc",
    items: [
      { href: "/zombita", icon: "🧟", title: "Zombita AI", desc: "Dual-model AI with GPT-4o-mini for direct conversation and Qwen3 8B locally for passive channel awareness. She chimes in without being asked.", tags: ["GPT-4o-mini", "Qwen3 8B", "Ollama"] },
      { href: "/zombita", icon: "🧠", title: "4-Layer Memory", desc: "Channel buffers, user buffers, conversation history, and persistent PostgreSQL storage. She remembers what happened weeks ago.", tags: ["Memory", "PostgreSQL"] },
      { href: "/zombita", icon: "⭐", title: "Reputation System", desc: "Daily GPT analysis of each player's behaviour. 7 reputation tiers from Outcast to Legend. She forms opinions.", tags: ["GPT Analysis", "Daily", "Season-long"] },
      { href: "/zombita", icon: "👁️", title: "Passive Perception", desc: "4-tier scoring engine that decides when Zombita should chime in on a conversation without being @mentioned. Cooldowns, late-night mode, per-channel caps.", tags: ["Perception", "Scoring"] },
    ],
  },
  {
    category: "Economy",
    color: "#c8a84b",
    items: [
      { href: "/features/economy", icon: "💰", title: "Three-Tier Currency", desc: "Bronze, Silver, and Gold. All internal storage in bronze. Display always shows the highest applicable denomination.", tags: ["🟤 Bronze", "⚪ Silver", "🟡 Gold"] },
      { href: "/features/economy", icon: "🏦", title: "Treasury System", desc: "Server-wide fund with 5 health states. Source of all rewards, destination of all taxes. The economy's regulator.", tags: ["Closed Loop", "Dynamic Taxes"] },
      { href: "/features/economy", icon: "📈", title: "Dynamic Pricing", desc: "Price = Base × Treasury Factor × Demand Factor × Wealth Factor × Recession Factor. Clamped 50%–300% of base.", tags: ["4 Factors", "Real-Time"] },
      { href: "/features/economy", icon: "📉", title: "Recession System", desc: "Treasury-triggered or chaos event (0.3% random chance). Spikes all prices 1.4×–2.2× for 12–48 hours. Zombita announces it in character.", tags: ["1.4× – 2.2×", "12–48h"] },
      { href: "/features/economy", icon: "🏪", title: "5 NPC Shops", desc: "Named characters — food, weapons, car parts, gas stations, community hub. Each with rotating stock and dynamic prices.", tags: ["Named NPCs", "Rotating Stock"] },
      { href: "/features/economy", icon: "🏷️", title: "Player Marketplace", desc: "Player-to-player listings with listing tax and purchase tax flowing to treasury. List anything, buy anything.", tags: ["P2P", "Tax to Treasury"] },
      { href: "/features/economy", icon: "🎰", title: "Lottery", desc: "1 Silver ticket. Tiered prizes from Bandages to Assault Rifles and Katanas. Weekly draw.", tags: ["1 Silver", "Katana Top Prize"] },
      { href: "/features/economy", icon: "🚗", title: "Teleport System", desc: "Fast-travel to 7 named map locations for 5 Silver via RCON teleport. One command, instant travel.", tags: ["7 Locations", "5 Silver", "RCON"] },
    ],
  },
  {
    category: "Mini-Games",
    color: "#4a8fc4",
    items: [
      { href: "/features/games", icon: "🐺", title: "Werewolf", desc: "Full social deduction with 20+ roles including Cupid, Gunner, Detective, Blacksmith, Mayor. DM-based night actions, AI narrator.", tags: ["20+ Roles", "AI Narrated", "DM Night Actions"] },
      { href: "/features/games", icon: "🧠", title: "Quizarium", desc: "Speed-scored trivia with 5 categories and a global leaderboard. Fastest correct answer wins the most points.", tags: ["5 Categories", "Speed Scoring", "Leaderboard"] },
      { href: "/features/games", icon: "🃏", title: "Cards Against Humanity", desc: "Fully custom implementation judged by Zombita via GPT in character. She votes with full personality. Rewards for cah_win and cah_zombita_approved.", tags: ["AI Judged", "GPT in Character"] },
      { href: "/features/games", icon: "✊", title: "Rock Paper Scissors", desc: "Player vs player or vs Zombita. Optional coin bets with 5% rake going to treasury. Stats tracked across all modes.", tags: ["Coin Bets", "vs Zombita", "Stats"] },
      { href: "/features/games", icon: "🔵", title: "Connect Four", desc: "Full 6×7 board using Discord button UI. Live board updates each turn. 60-second turn timer. Optional coin bets.", tags: ["Discord Buttons", "6×7 Board", "60s Timer"] },
    ],
  },
  {
    category: "World Events",
    color: "#e05555",
    items: [
      { href: "/features/events", icon: "💀", title: "Dawn of the Dead", desc: "Scheduled zombie horde events via RCON. Multiple configurable waves. Lady Dawnie lore narration. Every 13 hours by default.", tags: ["RCON Waves", "Lady Dawnie", "Every 13h"] },
      { href: "/features/events", icon: "🗺️", title: "Treasure Hunt", desc: "Hidden cache with zombie guards. Zombita announces hints. First player to arrive and enter the claim code wins. 30-minute window.", tags: ["Claim Code", "30min Window", "Race"] },
      { href: "/features/events", icon: "⚔️", title: "Faction Wars", desc: "Declare war with a bronze stake and a duration. Kill tracking in-game. Winning faction takes combined stakes.", tags: ["Bronze Stakes", "Kill Tracking", "Factions"] },
    ],
  },
  {
    category: "Factions",
    color: "#4caf7d",
    items: [
      { href: "/features/events", icon: "🏴", title: "Create & Manage Factions", desc: "Any player can create a faction. Invite members, promote officers, transfer leadership. Each faction gets a private Discord channel automatically.", tags: ["Private Channel", "Leadership", "Persistent"] },
      { href: "/features/events", icon: "🗡️", title: "Faction Wars", desc: "Leaders stake bronze, declare war for a set duration. In-game kill counts settle the outcome. Loser forfeits stake.", tags: ["Staked Bronze", "Kill Count", "Duration"] },
    ],
  },
  {
    category: "Campaign",
    color: "#c47a4a",
    items: [
      { href: "/features/campaign", icon: "📜", title: "The Cradle Trials", desc: "Episodic narrative campaign for groups of 1–4. Each act has multiple quests with in-game teleports, cipher puzzles, zombie hordes, and item rewards.", tags: ["Episodic", "Group Play", "Permanent Progress"] },
      { href: "/features/campaign", icon: "🔐", title: "Cipher Puzzles", desc: "Act I Quest 1 uses Caesar ROT+3 cipher. Clue delivered as in-game item. Players decode and submit answers via Discord.", tags: ["Ciphers", "In-Game Items", "/answer"] },
      { href: "/features/campaign", icon: "🗓️", title: "Scheduled Sessions", desc: "Admin schedules the group's in-game session. Bot sends quests at session time to the group's private Discord channel.", tags: ["Scheduling", "Private Channel"] },
    ],
  },
  {
    category: "Server Management",
    color: "#4a7c59",
    items: [
      { href: "/server", icon: "🔄", title: "Safe Restart System", desc: "11-step graceful shutdown: announce → save → kick → stop → start. Admins can schedule with countdown warnings at 5m, 2m, 1m.", tags: ["11 Steps", "Scheduled", "Countdown"] },
      { href: "/server", icon: "💬", title: "Chat Bridge", desc: "Real-time relay between in-game general chat and Discord. Watches PZ log files. URL filtering, 5-second cooldown, @ stripping.", tags: ["Real-Time", "Bidirectional", "Log Watching"] },
      { href: "/server", icon: "🔧", title: "Mod Management", desc: "Atomic reads and writes to servertest.ini. Backup system keeps last 10 timestamped copies. Discord commands for everything.", tags: ["Atomic Write", "10 Backups", "Discord Commands"] },
      { href: "/server", icon: "🔒", title: "Whitelist Enforcement", desc: "RCON polling every 2 minutes. 24-hour grace period. Countdown warnings. Auto-kick. Fail-open on DB outage.", tags: ["2min Poll", "24h Grace", "Fail-Open"] },
    ],
  },
  {
    category: "Web Platform",
    color: "#4a8fc4",
    items: [
      { href: "/shop", icon: "🛒", title: "Web Shop", desc: "Full shop browsing and purchasing through the website. Real-time stock and prices from the API.", tags: ["Live Prices", "Real-Time Stock"] },
      { href: "/marketplace", icon: "🏪", title: "Marketplace", desc: "Player-to-player marketplace. Browse listings, buy items, post your own listings.", tags: ["P2P", "Browser-Based"] },
      { href: "/leaderboard", icon: "🏆", title: "Leaderboards", desc: "Six categories — coins, Quizarium, Werewolf, RPS, CAH, Connect Four. Live from the database.", tags: ["6 Categories", "Live Data"] },
      { href: "/feed", icon: "📡", title: "Community Feed", desc: "Twitter-style posts with replies, blood drop likes, reposts, image attachments, and pinned posts.", tags: ["🩸 Blood Drops", "Images", "Replies"] },
      { href: "/admin", icon: "⚙️", title: "Admin Panel", desc: "Full web admin panel with live WebSocket console, RCON terminal, economy controls, mod manager, and more.", tags: ["WebSocket", "RCON", "Live Console"] },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <main>
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-12 sm:py-16">

        {/* Header */}
        <div className="mb-12">
          <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#4a7c59] uppercase mb-3">{CURRENT_SEASON}</p>
          <h1 className="text-[1.8rem] sm:text-[2.5rem] tracking-[0.2em] sm:tracking-[0.25em] mb-4">FEATURES</h1>
          <p className="text-[#666] text-[0.88rem] max-w-[560px] leading-relaxed">
            SoUP is more than a game server. Everything below is custom-built, running live. 
            Technical admins can read the source — it&apos;s all one codebase.
          </p>
        </div>

        <div className="h-px bg-[#1a1a1a] mb-12" />

        {/* Feature Sections */}
        <div className="space-y-16">
          {FEATURE_SECTIONS.map(section => (
            <section key={section.category}>
              <div className="flex items-center gap-4 mb-6">
                <div className="h-px flex-1 bg-[#1a1a1a]" />
                <p className="font-mono text-[0.65rem] tracking-[0.3em] uppercase" style={{ color: section.color }}>
                  {section.category}
                </p>
                <div className="h-px flex-1 bg-[#1a1a1a]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {section.items.map(item => (
                  <Link key={item.title} href={item.href} className="no-underline group block">
                    <div className="border border-[#1a1a1a] bg-[#0a0d10] p-4 sm:p-5 h-full hover:border-[#252525] hover:bg-[#0d1117] transition-all relative overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `linear-gradient(90deg, transparent, ${section.color}44, transparent)` }} />
                      <div className="flex items-start gap-3">
                        <span className="text-xl flex-shrink-0 mt-0.5">{item.icon}</span>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-mono text-[0.75rem] tracking-[0.12em] text-[#e6e6e6] uppercase mb-1.5 group-hover:transition-colors" style={{ transitionProperty: "color", transitionDuration: "0.15s" }}
                            onMouseEnter={e => (e.currentTarget.style.color = section.color)}
                            onMouseLeave={e => (e.currentTarget.style.color = "#e6e6e6")}
                          >{item.title}</h3>
                          <p className="text-[0.78rem] text-[#555] leading-relaxed mb-2.5">{item.desc}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {item.tags.map(t => (
                              <span key={t} className="font-mono text-[0.55rem] tracking-widest text-[#333] border border-[#1e1e1e] px-1.5 py-0.5 uppercase">{t}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="h-px bg-[#1a1a1a] my-16" />

        <section className="text-center">
          <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#555] uppercase mb-4">Get Started</p>
          <h2 className="!normal-case text-[1.2rem] tracking-[0.1em] mb-4">Ready to Experience It?</h2>
          <p className="text-[#555] text-[0.85rem] mb-8">Join Discord and complete the whitelist to unlock everything above.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a href="https://discord.gg/NCBPqP5Q" target="_blank" rel="noopener noreferrer"
              className="inline-block px-5 py-2.5 border border-[#5865F2] text-[#5865F2] no-underline text-[0.75rem] tracking-[0.12em] uppercase hover:bg-[#5865F2] hover:text-white transition-all">
              Join Discord
            </a>
            <Link href="/whitelist"
              className="inline-block px-5 py-2.5 border border-[#4a7c59] text-[#4a7c59] no-underline text-[0.75rem] tracking-[0.12em] uppercase hover:bg-[#4a7c59] hover:text-white transition-all">
              Apply Whitelist
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}
