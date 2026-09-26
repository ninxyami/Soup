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
      { href: "/jobs", icon: "🎮", title: "In the Game Too", desc: "Zombita isn't only on Discord. She runs the Jobs board on your in-game phone, writes the weekly paper that lands in your bag, and leaves you notes in game.", tags: ["Jobs Board", "Weekly Paper", "In-Game Notes"] },
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
      { href: "/shop", icon: "🏪", title: "Shops & Kiosks", desc: "39 general-store kiosks in 26 towns, run by named keepers - each kiosk with its own shelf - plus 8 specialists: weapons, medical, mechanic, tailor, garden, books, melee and Scarlett's records. One price per item everywhere; nobody buys rotten food.", tags: ["47 Shops", "In-Game + Web", "One Price"] },
      { href: "/marketplace", icon: "🏷️", title: "Player Marketplace", desc: "Player-to-player listings with listing and purchase taxes flowing to the treasury. List anything. Buy anything. The economy never leaves the loop.", tags: ["P2P Trading", "Tax to Treasury"] },
      { href: "/features/economy", icon: "🎰", title: "Lottery", desc: "100 numbered scratch tickets per batch, 3 silver each. Pick your numbers on any kiosk's Lottery tab, scratch it in your bag, hand in a winner.", tags: ["100 Tickets", "Scratch Cards"] },
      { href: "/features/economy", icon: "🚗", title: "Teleport System", desc: "Fast-travel to named map locations for 5 Silver. One command, instant teleport. Seven destinations across the map.", tags: ["7 Locations", "5 Silver"] },
      { href: "/features/economy", icon: "🚌", title: "Zombita Bus", desc: "Ride between bus stations across the map. Buy a ticket in the phone's Bus app; the stations are on your map.", tags: ["Tickets", "Map Stations"] },
    ],
  },
  {
    category: "Mini-Games",
    color: "#4a8fc4",
    items: [
      { href: "/features/werewolf", icon: "🐺", title: "Werewolf", desc: "Full social deduction with over 20 roles — Cupid, Gunner, Detective, Blacksmith, Mayor, Serial Killer, and more. Night actions in DMs. Zombita narrates.", tags: ["20+ Roles", "DM Night Actions", "AI Narrated"] },
      { href: "/features/games", icon: "🧠", title: "Quizarium", desc: "Speed-scored trivia across five categories. Fastest correct answer earns the most points. Global leaderboard tracks performance across the season.", tags: ["5 Categories", "Speed Scoring", "Leaderboard"] },
      { href: "/features/games", icon: "🃏", title: "Cards Against Zombita", desc: "On Discord, Zombita judges every submission in character. On your in-game phone the players vote and she reacts. Also a public Workshop mod.", tags: ["Zombita Judges", "Phone Version", "Workshop Mod"] },
      { href: "/features/games", icon: "✊", title: "Rock Paper Scissors", desc: "Play vs another player or directly against Zombita. Optional coin bets with a 5% rake to the treasury. Full stats tracked all season.", tags: ["vs Zombita", "Coin Bets", "Stats"] },
      { href: "/features/games", icon: "🔵", title: "Connect Four", desc: "A full 6×7 Connect Four board running inside Discord. Each column is a live button. The board updates in place. 60-second turn timer. Optional bets.", tags: ["Discord Buttons", "6×7 Board", "Live Board"] },
      { href: "/leaderboard", icon: "♞", title: "Chess", desc: "Correspondence chess on every phone - no clock, take your time. Rated games, optional bets, and a leaderboard. Also a public Workshop mod.", tags: ["Rated", "On the Phone", "Workshop Mod"] },
      { href: "/leaderboard", icon: "🕹️", title: "Phone Arcade", desc: "Snake, Tetris, 2048, Puzzle, Space Impact and Paws Apart on your in-game phone. The week's best scores win 100 / 60 / 30 bronze.", tags: ["6 Games", "Weekly Prizes"] },
    ],
  },
  {
    category: "World Events",
    color: "#e05555",
    items: [
      { href: "/features/dawn-of-the-dead", icon: "💀", title: "Dawn of the Dead", desc: "The flagship server event. Lady Dawnie sends her horde - waves of zombies spawned by the game across the map, announced in Discord, with its own leaderboard.", tags: ["Multi-Wave Hordes", "Lady Dawnie Lore", "DotD Leaderboard"] },
      { href: "/features/treasure-hunt", icon: "🗺️", title: "Treasure Hunt", desc: "A hidden cache guarded by zombies. Zombita drops cryptic hints. Players race in-game — first to arrive and enter the claim code wins the loot.", tags: ["Claim Code Race", "Zombie Guards", "6 Hunt Types"] },
      { href: "/jobs", icon: "📋", title: "Zombita's Jobs", desc: "New jobs on your phone every few hours: marked hordes, bandit camps, errands, hidden codes. C to S tier, Job Rank, parties - and sometimes one of Lady Dawnie's fakes. Take them on the website too.", tags: ["Timed Batches", "C to S Tier", "Parties"] },
    ],
  },
  {
    category: "Factions",
    color: "#4caf7d",
    items: [
      { href: "/factions", icon: "🏴", title: "In-Game Factions", desc: "Found a faction in game (Esc → Factions, or the phone). Up to 8 ranks with their own permissions, recruitment and applications, a shared stash and a faction wallet.", tags: ["8 Ranks", "Recruitment", "Faction Wallet"] },
      { href: "/factions", icon: "💬", title: "Faction Spaces", desc: "Unlock a private Discord channel and a faction page on this website. Faction kills and jobs have their own leaderboards.", tags: ["Private Channel", "Faction Page", "Leaderboards"] },
    ],
  },
  {
    id: "phone",
    category: "Zombita Phone",
    color: "#4ab0c4",
    items: [
      { href: "/features#phone", icon: "💬", title: "Messages & Contacts", desc: "Text anyone on the server, group chats, a contact list and an inbox for Zombita's notes. Five phone models, from a flip phone to Zombita's own.", tags: ["Group Chats", "5 Models"] },
      { href: "/marketplace", icon: "🏷️", title: "Marketplace App", desc: "Browse every player listing from your phone; list and buy at any kiosk.", tags: ["Player Trading"] },
      { href: "/jobs", icon: "📋", title: "Jobs App", desc: "Zombita's job board: take a job, invite friends, follow the arrow, enter your reward code.", tags: ["Zombita's Jobs"] },
      { href: "/leaderboard", icon: "🎲", title: "Games", desc: "Chess, Werewolf, Cards Against Zombita, RPS, Connect Four and six arcade games - all on the phone.", tags: ["Multiplayer", "Arcade"] },
      { href: "/features#phone", icon: "🎵", title: "Music & Gallery", desc: "Mixtapes and community songs on cassette, and the community's pictures from Discord's #gallery.", tags: ["Community Songs", "Gallery"] },
      { href: "/newspaper", icon: "📰", title: "News & Guides", desc: "The weekly paper, the selling guide with every item's price, the map, the bus and more.", tags: ["Weekly Paper", "Selling Guide"] },
    ],
  },
  {
    category: "Server & Mods",
    color: "#4a7c59",
    items: [
      { href: "/server", icon: "🔄", title: "Safe Restart System", desc: "Graceful shutdown with countdown warnings. Announces in-game and in Discord. Server saves, players are warned, then it restarts cleanly.", tags: ["Scheduled Restarts", "Countdown Warnings"] },
      { href: "/server", icon: "💬", title: "Chat Bridge", desc: "Real-time relay between in-game general chat and Discord. What you say in Discord appears in-game, and vice versa. Always connected.", tags: ["Real-Time", "Bidirectional"] },
      { href: "/mods", icon: "📦", title: "Custom Mod Suite", desc: "Custom mods built for SoUP - kiosk shops, the F8 leaderboard, the Zombita Phone, Zombita's Jobs, treasure hunt spawning, magazines that wear out, and more. Some are public on the Workshop: Werewolf, Cards Against Zombita, Zombita Arcade, Zombita Chess, Zombita Raft.", tags: ["SoUP Exclusive", "In-Game Integration"] },
      { href: "/mods", icon: "🚗", title: "Zombita Vehicles", desc: "Claim a vehicle with a Zombita Vehicle Orb. Faction and safehouse members can share it; manage every claimed vehicle and who may drive it.", tags: ["Vehicle Orb", "Shared Access"] },
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
            <section key={section.category} id={(section as any).id} className="scroll-mt-20">
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
            <a href="https://discord.gg/zDwa2g37R" target="_blank" rel="noopener noreferrer"
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
