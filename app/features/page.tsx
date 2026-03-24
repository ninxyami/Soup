"use client";
import Link from "next/link";
import { CURRENT_SEASON } from "@/lib/constants";

const FEATURE_SECTIONS = [
  {
    category: "AI & Personality",
    color: "#9775cc",
    items: [
      { href: "/zombita", icon: "🧟", title: "Zombita AI", desc: "A fully custom AI character who lives in your Discord. She holds conversations, chimes in passively without being asked, and remembers what happened weeks ago.", tags: ["Persistent Character", "Passive Listening", "Memory"] },
      { href: "/zombita", icon: "🧠", title: "4-Layer Memory", desc: "Channel history, per-user context, conversation tracking, and long-term persistent storage. She knows who you are, what you said, and what you've done.", tags: ["Long-Term Memory", "Per-User Context"] },
      { href: "/zombita", icon: "⭐", title: "Reputation System", desc: "Daily automated analysis of each player's behaviour across the entire server. Seven reputation tiers from Outcast to Legend. She forms real opinions — and they change.", tags: ["Daily Analysis", "7 Tiers", "Season-Long"] },
      { href: "/zombita", icon: "👁️", title: "Passive Perception", desc: "A scoring engine that decides when Zombita should speak without being @mentioned. Cooldowns, late-night mode, and per-channel caps keep her presence deliberate.", tags: ["Perception Engine", "Cooldowns", "Context-Aware"] },
    ],
  },
  {
    category: "Economy",
    color: "#c8a84b",
    items: [
      { href: "/features/economy", icon: "💰", title: "Three-Tier Currency", desc: "Bronze, Silver, and Gold. All internal storage runs in bronze. Display always shows the highest applicable denomination — clean, readable, and lore-consistent.", tags: ["🟤 Bronze", "⚪ Silver", "🟡 Gold"] },
      { href: "/features/economy", icon: "🏦", title: "Treasury System", desc: "Server-wide fund with five health states. Every reward draws from it. Every tax feeds it. The economy's regulator — and the trigger for recessions.", tags: ["Closed Loop", "5 Health States"] },
      { href: "/features/economy", icon: "📈", title: "Dynamic Pricing", desc: "Prices respond in real-time to treasury health, demand, wealth distribution, and economic events. Nothing is fixed. The market breathes.", tags: ["4 Price Factors", "Real-Time"] },
      { href: "/features/economy", icon: "📉", title: "Recession Events", desc: "Treasury-triggered or random chaos. Prices spike across the board for hours. Zombita announces it in character — and the server feels it.", tags: ["Price Spike", "12–48 Hours"] },
      { href: "/shop", icon: "🏪", title: "NPC Shopkeepers", desc: "Named characters with personalities, rotating stock, and dynamic prices. Shop through Discord or walk up to them in-game. Same economy, two interfaces.", tags: ["Named Characters", "In-Game + Web"] },
      { href: "/marketplace", icon: "🏷️", title: "Player Marketplace", desc: "Player-to-player listings with listing and purchase taxes flowing to the treasury. List anything. Buy anything. The economy never leaves the loop.", tags: ["P2P Trading", "Tax to Treasury"] },
      { href: "/features/economy", icon: "🎰", title: "Lottery", desc: "One Silver per ticket. Weekly draw with tiered prizes — from basic supplies all the way up to rare and legendary weapons.", tags: ["Weekly Draw", "Tiered Prizes"] },
      { href: "/features/economy", icon: "🚗", title: "Teleport System", desc: "Fast-travel to named map locations for 5 Silver. One command, instant teleport. Seven destinations across the map.", tags: ["7 Locations", "5 Silver"] },
    ],
  },
  {
    category: "Mini-Games",
    color: "#4a8fc4",
    items: [
      { href: "/features/werewolf", icon: "🐺", title: "Werewolf", desc: "Full social deduction with over 20 roles — Cupid, Gunner, Detective, Blacksmith, Mayor, Serial Killer, and more. Night actions in DMs. Zombita narrates.", tags: ["20+ Roles", "DM Night Actions", "AI Narrated"] },
      { href: "/features/games", icon: "🧠", title: "Quizarium", desc: "Speed-scored trivia across five categories. Fastest correct answer earns the most points. Global leaderboard tracks performance across the season.", tags: ["5 Categories", "Speed Scoring", "Leaderboard"] },
      { href: "/features/games", icon: "🃏", title: "Cards Against Humanity", desc: "Zombita is the judge. She reads every submission and picks her favourite — in character, with full personality. No two rounds feel the same.", tags: ["Zombita Judges", "In Character", "Community Favourite"] },
      { href: "/features/games", icon: "✊", title: "Rock Paper Scissors", desc: "Play vs another player or directly against Zombita. Optional coin bets with a 5% rake to the treasury. Full stats tracked all season.", tags: ["vs Zombita", "Coin Bets", "Stats"] },
      { href: "/features/games", icon: "🔵", title: "Connect Four", desc: "A full 6×7 Connect Four board running inside Discord. Each column is a live button. The board updates in place. 60-second turn timer. Optional bets.", tags: ["Discord Buttons", "6×7 Board", "Live Board"] },
    ],
  },
  {
    category: "World Events",
    color: "#e05555",
    items: [
      { href: "/features/dawn-of-the-dead", icon: "💀", title: "Dawn of the Dead", desc: "The flagship server event. Lady Dawnie sends her horde — multiple configurable waves of zombies spawned across the map, announced in Discord with lore narration.", tags: ["Multi-Wave Hordes", "Lady Dawnie Lore", "Configurable"] },
      { href: "/features/treasure-hunt", icon: "🗺️", title: "Treasure Hunt", desc: "A hidden cache guarded by zombies. Zombita drops cryptic hints. Players race in-game — first to arrive and enter the claim code wins the loot.", tags: ["Claim Code Race", "Zombie Guards", "6 Hunt Types"] },
      { href: "/features/faction-wars", icon: "⚔️", title: "Faction Wars", desc: "Factions declare war with real bronze on the line. Kill counts settle the outcome. Winning faction takes both stakes. Surrender forfeits immediately.", tags: ["Bronze Stakes", "Kill Tracking", "Faction vs Faction"] },
    ],
  },
  {
    category: "Factions",
    color: "#4caf7d",
    items: [
      { href: "/features/faction-wars", icon: "🏴", title: "Create & Manage Factions", desc: "Any player can create a faction. Invite members, promote officers, transfer leadership. Each faction gets its own private Discord channel — automatically.", tags: ["Private Channel", "Full Leadership", "Persistent"] },
      { href: "/features/faction-wars", icon: "🗡️", title: "Faction Wars", desc: "Stake bronze, set a duration, declare war. In-game kill counts determine the winner at the end. Loser forfeits their stake.", tags: ["Staked Bronze", "Duration Wars", "Kill Count"] },
    ],
  },
  {
    category: "Campaign",
    color: "#c47a4a",
    items: [
      { href: "/features/campaign", icon: "📜", title: "The Cradle Trials", desc: "An episodic narrative campaign for groups. Each act has quests, in-game NPC encounters, cipher puzzles, zombie hordes, and choices with permanent consequences.", tags: ["Episodic", "Group Play", "Permanent Choices"] },
      { href: "/features/campaign", icon: "🔐", title: "Cipher Puzzles", desc: "Clues delivered as physical in-game items. Players decode and submit answers through Discord. The puzzles are real — and the stakes are narrative.", tags: ["In-Game Items", "Real Puzzles"] },
      { href: "/features/campaign", icon: "🧍", title: "Named NPC Characters", desc: "Campaign NPCs appear in-game at real map locations with custom outfits, full dialogue scripts, and choice buttons. Some live. Some don't — your call.", tags: ["In-Game NPCs", "Choice System", "Elias"] },
    ],
  },
  {
    category: "Server & Mods",
    color: "#4a7c59",
    items: [
      { href: "/server", icon: "🔄", title: "Safe Restart System", desc: "Graceful shutdown with countdown warnings. Announces in-game and in Discord. Server saves, players are warned, then it restarts cleanly.", tags: ["Scheduled Restarts", "Countdown Warnings"] },
      { href: "/server", icon: "💬", title: "Chat Bridge", desc: "Real-time relay between in-game general chat and Discord. What you say in Discord appears in-game, and vice versa. Always connected.", tags: ["Real-Time", "Bidirectional"] },
      { href: "/mods", icon: "📦", title: "Custom Mod Suite", desc: "Custom mods built exclusively for SoUP — in-game NPC shops, live leaderboard panel (F8), treasure hunt spawning, campaign NPCs, single-use magazines, and more.", tags: ["SoUP Exclusive", "In-Game Integration"] },
      { href: "/server", icon: "🔒", title: "Whitelist Enforcement", desc: "Automatic whitelist checks every few minutes. Grace period for new players. Countdown warnings before auto-kick. The whitelist is the economy gateway.", tags: ["Auto-Enforced", "Grace Period"] },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <main>
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-12 sm:py-16">

        <div className="mb-12">
          <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#4a7c59] uppercase mb-3">{CURRENT_SEASON}</p>
          <h1 className="text-[1.8rem] sm:text-[2.5rem] tracking-[0.2em] sm:tracking-[0.25em] mb-4">FEATURES</h1>
          <p className="text-[#666] text-[0.88rem] max-w-[560px] leading-relaxed">
            SoUP is built from scratch. Every feature below is custom — running live, built for this community, 
            and not available anywhere else. Explore what makes this server different.
          </p>
        </div>

        <div className="h-px bg-[#1a1a1a] mb-12" />

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
                          <h3 className="font-mono text-[0.75rem] tracking-[0.12em] text-[#e6e6e6] uppercase mb-1.5 transition-colors duration-150 group-hover:text-inherit"
                            style={{ color: "#e6e6e6" }}
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
