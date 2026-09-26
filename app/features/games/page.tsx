"use client";
import Link from "next/link";

const GAMES = [
  {
    icon: "🐺",
    name: "Werewolf",
    color: "#e05555",
    tagline: "Social deduction. 20+ roles. Zombita narrated.",
    desc: "The flagship mini-game. A full-featured social deduction game where players are secretly assigned roles and must survive the night — or eliminate the village by day.",
    mechanics: [
      "20+ roles including Cupid, Gunner, Detective, Blacksmith, Mayor, Serial Killer",
      "Night actions handled via Discord DMs — no public reveals until morning",
      "Zombita narrates key events in her dry, observational voice — deaths, votes, dramatic turns",
      "Role reveal embeds, voting embeds, and live game state tracking",
      "Werewolf win earns 300 bronze from treasury + reputation events",
    ],
    rewards: "300 bronze (win) · Reputation: werewolf_win, werewolf_survived, werewolf_clutch",
    command: "/werewolf",
    detailHref: "/features/werewolf",
  },
  {
    icon: "🧠",
    name: "Quizarium",
    color: "#4a8fc4",
    tagline: "Speed trivia. 5 categories. Global leaderboard.",
    desc: "A fast-paced trivia game where speed matters as much as accuracy. Questions come from 5 categories — correct answers score points based on how quickly you answered.",
    mechanics: [
      "5 question categories covering a range of topics",
      "Speed-scored — faster answers earn more points",
      "Global leaderboard tracking wins, correct answers, and games played",
      "Perfect game achievements tracked separately",
      "Weekly winner earns 300 bronze from treasury",
    ],
    rewards: "300 bronze (weekly win) · Reputation: quizarium_win, quizarium_perfect, quizarium_dominant",
    command: "/quiz",
  },
  {
    icon: "🃏",
    name: "Cards Against Humanity",
    color: "#9775cc",
    tagline: "Zombita judges. In character. No mercy.",
    desc: "The classic game, fully implemented with Zombita as the judge. She reads every submission and picks her favourite — in character, with full personality. It's genuinely funny.",
    mechanics: [
      "Full CAH deck with black and white cards",
      "Zombita judges every round in her own voice — she votes with her actual personality",
      "cah_zombita_approved reputation event for when she personally approves your card",
      "All games logged to cah_game_log and cah_stats tables",
      "CAH win earns 200 bronze from treasury",
    ],
    rewards: "200 bronze (win) · Reputation: cah_win, cah_played, cah_zombita_approved",
    command: "/cah",
  },
  {
    icon: "✊",
    name: "Rock Paper Scissors",
    color: "#4caf7d",
    tagline: "Simple. Bettable. Zombita plays too.",
    desc: "Player vs player or player vs Zombita. Optional coin bets with a 5% rake flowing to the treasury. Full stats tracked — including separate vs-Zombita breakdowns.",
    mechanics: [
      "Challenge any player or Zombita with /rps",
      "Optional coin bet — both players wager the same amount",
      "5% rake on bets goes to treasury",
      "Separate stats tracked for vs-players and vs-Zombita",
      "Total coins won/lost tracked over the season",
    ],
    rewards: "Coin bets (variable) · Stats: wins, losses, draws, coins won/lost",
    command: "/rps",
  },
  {
    icon: "🔵",
    name: "Connect Four",
    color: "#c8a84b",
    tagline: "6×7 board. Discord buttons. Live updates.",
    desc: "A full Connect Four implementation using Discord's button UI. The board lives inside a Discord message and updates in place as players take turns clicking column buttons.",
    mechanics: [
      "6 rows × 7 columns, full win detection (horizontal, vertical, diagonal)",
      "Each column is a Discord button — tap to drop your piece",
      "Board updates live in the same message each turn",
      "60-second turn timer — too slow and you forfeit",
      "60-second challenge timer — opponent must accept before it expires",
      "5% rake on coin bets goes to treasury",
    ],
    rewards: "Coin bets (variable) · Stats: wins, losses, draws tracked in c4_stats",
    command: "/connect4",
  },
];

export default function GamesPage() {
  return (
    <main>
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-12 sm:py-16">

        <div className="mb-12">
          <Link href="/features" className="font-mono text-[0.65rem] tracking-widest text-[#444] hover:text-[#4a8fc4] no-underline transition-colors uppercase">
            ← Features
          </Link>
          <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#4a8fc4] uppercase mb-3 mt-4">Mini-Games</p>
          <h1 className="text-[1.8rem] sm:text-[2.5rem] tracking-[0.2em] mb-4">GAMES</h1>
          <p className="text-[#666] text-[0.88rem] max-w-[560px] leading-relaxed">
            Five fully custom games built into Zombita. Stats are tracked across the season, 
            winners earn treasury bronze, and reputation events fire on notable achievements.
          </p>
        </div>

        {/* Quick navigation */}
        <div className="flex flex-wrap gap-2 mb-12">
          {GAMES.map(g => (
            <a key={g.name} href={`#${g.name.toLowerCase().replace(/\s+/g, "-")}`}
              className="no-underline font-mono text-[0.65rem] tracking-widest uppercase px-3 py-1.5 border border-[#1a1a1a] text-[#555] hover:text-[#e6e6e6] hover:border-[#333] transition-all"
              style={{ "--hover-color": g.color } as React.CSSProperties}>
              {g.icon} {g.name}
            </a>
          ))}
        </div>

        <div className="space-y-12">
          {GAMES.map((game, i) => (
            <section key={game.name} id={game.name.toLowerCase().replace(/\s+/g, "-")}>
              <div className="border border-[#1a1a1a] bg-[#0a0d10] overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${game.color}66, transparent)` }} />
                <div className="p-6 sm:p-8">
                  <div className="flex items-start gap-4 mb-4">
                    <span className="text-3xl">{game.icon}</span>
                    <div>
                      <h2 className="!mb-1 !normal-case text-[1.1rem] tracking-[0.1em]" style={{ color: game.color }}>{game.name}</h2>
                      <p className="font-mono text-[0.65rem] tracking-[0.15em] text-[#555] uppercase">{game.tagline}</p>
                    </div>
                    <div className="ml-auto hidden sm:block">
                      <span className="font-mono text-[0.6rem] tracking-widest text-[#333] border border-[#1e1e1e] px-2 py-1">{game.command}</span>
                    </div>
                  </div>

                  <p className="text-[#666] text-[0.85rem] leading-relaxed mb-5">{game.desc}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <p className="font-mono text-[0.6rem] tracking-widest text-[#444] uppercase mb-3">How It Works</p>
                      <ul className="space-y-2">
                        {game.mechanics.map((m, j) => (
                          <li key={j} className="flex items-start gap-2 text-[0.78rem] text-[#555] leading-relaxed" style={{ paddingLeft: 0 }}>
                            <span className="flex-shrink-0 mt-1 w-1 h-1 rounded-full" style={{ background: game.color, minWidth: 4, minHeight: 4, marginTop: 6 }} />
                            <span>{m}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-mono text-[0.6rem] tracking-widest text-[#444] uppercase mb-3">Rewards & Stats</p>
                      <div className="border border-[#1a1a1a] p-3 bg-[#070a0d]">
                        <p className="text-[0.75rem] text-[#555] leading-relaxed font-mono">{game.rewards}</p>
                      </div>
                      <div className="mt-3 font-mono text-[0.6rem] tracking-widest text-[#333] uppercase">
                        Command: <span style={{ color: game.color }}>{game.command}</span>
                      </div>
                      {"detailHref" in game && (game as typeof game & { detailHref?: string }).detailHref && (
                        <div className="mt-3">
                          <Link href={(game as typeof game & { detailHref?: string }).detailHref!} className="font-mono text-[0.6rem] tracking-widest no-underline transition-colors uppercase" style={{ color: game.color }}>
                            Full Details & Role List →
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {i < GAMES.length - 1 && <div className="h-px bg-[#111] mt-12" />}
            </section>
          ))}
        </div>

        <div className="h-px bg-[#1a1a1a] mt-16 mb-8" />
        <div className="text-center">
          <Link href="/features" className="font-mono text-[0.7rem] tracking-widest text-[#444] hover:text-[#e6e6e6] no-underline transition-colors uppercase">
            ← Back to All Features
          </Link>
        </div>
      </div>
    </main>
  );
}
