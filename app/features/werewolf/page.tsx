"use client";
import Link from "next/link";

const ROLES = [
  { icon: "🧑‍🌾", name: "Villager", team: "Village", desc: "No ability. Your only weapon is your vote and your wits." },
  { icon: "🐺", name: "Werewolf", team: "Wolves", desc: "Each night, choose a player to kill. Majority rules in a wolf pack." },
  { icon: "🔮", name: "Seer", team: "Village", desc: "Investigate one player per night — learn their exact role. Most powerful village role." },
  { icon: "🃏", name: "Fool", team: "Village", desc: "Thinks they're the Seer, but gets random results. A liability masquerading as an asset." },
  { icon: "💃", name: "Harlot", team: "Village", desc: "Visit someone at night. If wolves attack you while you're away, you survive. Visiting a wolf means death." },
  { icon: "👼", name: "Guardian Angel", team: "Village", desc: "Protect one player from wolf and Serial Killer attacks per night. Cannot protect the same person twice in a row." },
  { icon: "🏹", name: "Hunter", team: "Village", desc: "When killed, drag one player down with you. Self-defense chance against wolves." },
  { icon: "🕵️", name: "Detective", team: "Village", desc: "Day investigate — learn exact role. 40% chance the wolves detect you and kill you that night." },
  { icon: "🔮", name: "Oracle", team: "Village", desc: "Investigate at night — learn one role this player is NOT." },
  { icon: "🍺", name: "Drunk", team: "Village", desc: "When wolves eat you, they skip their next kill. Dead weight alive. Hero in death." },
  { icon: "🛠️", name: "Blacksmith", team: "Village", desc: "Once per game: activate silver dust at night to completely block the wolf kill." },
  { icon: "🧙", name: "Wise Elder", team: "Village", desc: "Survives the first wolf attack. The second one finishes the job." },
  { icon: "🎩", name: "Mayor", team: "Village", desc: "Double vote power when publicly revealed. Reveal is optional and permanent." },
  { icon: "🔫", name: "Gunner", team: "Village", desc: "Two bullets. Shoot any player during the day. Might hit a wolf. Might not." },
  { icon: "💘", name: "Cupid", team: "Village", desc: "On Night 1 only: link two players as Lovers. If one dies, the other dies immediately." },
  { icon: "🔪", name: "Serial Killer", team: "Neutral", desc: "Kills one player per night, independent of wolves. Win alone — last survivor." },
  { icon: "💀", name: "Tanner", team: "Neutral", desc: "Win condition: get lynched by the village. Chaos incarnate." },
  { icon: "🧒", name: "Wild Child", team: "Village", desc: "Choose a role model on Night 1. If your role model dies, you become a Werewolf." },
  { icon: "😈", name: "Cursed", team: "Village", desc: "Appears as villager. If wolves try to kill you, you convert to wolf instead of dying." },
  { icon: "🤝", name: "Traitor", team: "Village", desc: "Appears as villager. Knows who the wolves are but cannot communicate with them." },
];

const TEAM_COLOR: Record<string, string> = {
  Village: "#4a8fc4",
  Wolves: "#e05555",
  Neutral: "#9775cc",
};

export default function WerewolfPage() {
  return (
    <main>
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-12 sm:py-16">

        {/* Header */}
        <div className="mb-12">
          <Link href="/features" className="font-mono text-[0.65rem] tracking-widest text-[#444] hover:text-[#e05555] no-underline transition-colors uppercase">
            ← Features
          </Link>
          <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#e05555] uppercase mb-3 mt-4">Mini-Games</p>
          <h1 className="text-[1.8rem] sm:text-[2.5rem] tracking-[0.2em] mb-4">WEREWOLF</h1>
          <p className="text-[#666] text-[0.88rem] max-w-[560px] leading-relaxed">
            Full social deduction. Over 20 roles. Night actions handled in DMs. Zombita narrates every death, 
            every vote, every mistake — in her dry, observational voice.
          </p>
        </div>

        {/* How it works */}
        <section className="mb-16">
          <div className="border border-[#1a1a1a] bg-[#0a0d10] overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #e0555566, transparent)" }} />
            <div className="p-6 sm:p-8">
              <div className="flex items-start gap-4 mb-6">
                <span className="text-3xl">🐺</span>
                <div>
                  <h2 className="!mb-1 !normal-case text-[1.1rem] tracking-[0.1em] text-[#e05555]">How It Works</h2>
                  <p className="font-mono text-[0.65rem] tracking-[0.15em] text-[#555] uppercase">Discord-native · DM night actions · Zombita narrated</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                  <p className="font-mono text-[0.6rem] tracking-widest text-[#444] uppercase mb-3">Game Flow</p>
                  <ol className="space-y-2">
                    {[
                      "Lobby opens with !ww create — players join with !ww join",
                      "Host starts the game (minimum 4 players)",
                      "Roles secretly assigned and sent to each player via DM",
                      "Day phase: open discussion, 5-minute button vote to lynch",
                      "Night phase: wolves choose a kill target via DM; special roles act",
                      "Night resolution: actions processed, deaths revealed at dawn",
                      "Cycles repeat until wolves win or the village eliminates all wolves",
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[0.75rem] text-[#555]" style={{ paddingLeft: 0 }}>
                        <span className="font-mono text-[0.6rem] text-[#e05555] flex-shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <p className="font-mono text-[0.6rem] tracking-widest text-[#444] uppercase mb-3">Zombita's Narration</p>
                  <p className="text-[0.78rem] text-[#555] leading-relaxed mb-4">
                    She narrates phase transitions, lynch outcomes, and night results. She doesn't comment on everything — 
                    silence is part of her character. She fires more when things get dramatic.
                  </p>
                  <div className="space-y-2">
                    {[
                      { event: "Vote change", chance: "40%" },
                      { event: "Bandwagon forming", chance: "35%" },
                      { event: "Tie vote", chance: "70% — it's dramatic" },
                      { event: "Confident mistake", chance: "55%" },
                      { event: "Silent player", chance: "30%" },
                    ].map(n => (
                      <div key={n.event} className="flex gap-3 text-[0.72rem]">
                        <span className="font-mono text-[#444] min-w-[140px]">{n.event}</span>
                        <span className="text-[#555]">{n.chance}</span>
                      </div>
                    ))}
                  </div>
                  <p className="font-mono text-[0.6rem] text-[#333] mt-3">Minimum 25 seconds between narrator comments</p>
                </div>
              </div>

              <div className="mt-8 border-t border-[#141414] pt-6">
                <p className="font-mono text-[0.6rem] tracking-widest text-[#444] uppercase mb-3">Rewards</p>
                <div className="flex flex-wrap gap-4">
                  {[
                    { label: "Werewolf win", val: "300 bronze from treasury" },
                    { label: "Wolf win", val: "Reputation: werewolf_wolf_win" },
                    { label: "Survival", val: "Reputation: werewolf_survived" },
                    { label: "Clutch play", val: "Reputation: werewolf_clutch" },
                  ].map(r => (
                    <div key={r.label} className="border border-[#1a1a1a] p-2.5 bg-[#070a0d]">
                      <div className="font-mono text-[0.6rem] text-[#e05555] mb-0.5">{r.label}</div>
                      <div className="text-[0.72rem] text-[#555]">{r.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Role List */}
        <section className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-px flex-1 bg-[#1a1a1a]" />
            <p className="font-mono text-[0.65rem] tracking-[0.3em] uppercase text-[#e05555]">Complete Role List</p>
            <div className="h-px flex-1 bg-[#1a1a1a]" />
          </div>

          {/* Team legend */}
          <div className="flex gap-4 mb-6">
            {Object.entries(TEAM_COLOR).map(([team, color]) => (
              <div key={team} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="font-mono text-[0.6rem] text-[#444] uppercase">{team}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ROLES.map(role => (
              <div key={role.name} className="border border-[#1a1a1a] bg-[#0a0d10] p-3 flex items-start gap-3 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: TEAM_COLOR[role.team] }} />
                <span className="text-lg flex-shrink-0">{role.icon}</span>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[0.68rem] tracking-[0.08em] text-[#e6e6e6] uppercase">{role.name}</span>
                    <span className="font-mono text-[0.5rem] tracking-widest border px-1 py-0.5 uppercase" style={{ color: TEAM_COLOR[role.team], borderColor: TEAM_COLOR[role.team] + "44" }}>{role.team}</span>
                  </div>
                  <p className="text-[0.72rem] text-[#555] leading-relaxed">{role.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="h-px bg-[#1a1a1a] mb-8" />
        <div className="text-center">
          <Link href="/features/games" className="font-mono text-[0.7rem] tracking-widest text-[#444] hover:text-[#e6e6e6] no-underline transition-colors uppercase mr-8">
            ← All Games
          </Link>
          <Link href="/features" className="font-mono text-[0.7rem] tracking-widest text-[#444] hover:text-[#e6e6e6] no-underline transition-colors uppercase">
            ← All Features
          </Link>
        </div>

      </div>
    </main>
  );
}
