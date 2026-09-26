"use client";
import Link from "next/link";

const HUNT_PHASES = [
  { phase: "Buildup", icon: "🌅", desc: "Lady Dawnie's message is posted in Discord. The tone shifts. Something is coming." },
  { phase: "Warning", icon: "⚠️", desc: "A 10-minute in-game warning goes out. Characters hear it. Players get ready." },
  { phase: "Wave 1", icon: "💀", desc: "Zombies spawn near every online player simultaneously via RCON. The horde is here." },
  { phase: "Wave 2+", icon: "🧟", desc: "Additional waves fire at the configured interval. Each wave announced in Discord with a direction." },
  { phase: "End", icon: "🌑", desc: "\"The horde withdraws. Lady Dawnie is... mildly impressed.\" The server exhales." },
];

const WAVE_DIRECTIONS = ["North", "Northeast", "East", "Southeast", "South", "Southwest", "West", "Northwest"];

export default function DawnOfTheDeadPage() {
  return (
    <main>
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-12 sm:py-16">

        {/* Header */}
        <div className="mb-12">
          <Link href="/features" className="font-mono text-[0.65rem] tracking-widest text-[#444] hover:text-[#e05555] no-underline transition-colors uppercase">
            ← Features
          </Link>
          <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#e05555] uppercase mb-3 mt-4">World Events</p>
          <h1 className="text-[1.8rem] sm:text-[2.5rem] tracking-[0.2em] mb-2">DAWN OF THE DEAD</h1>
          <p className="font-mono text-[0.7rem] tracking-[0.15em] text-[#7c4a4a] uppercase mb-6">Lady Dawnie's Horde · Recurring Server Event</p>
          <p className="text-[#666] text-[0.88rem] max-w-[560px] leading-relaxed">
            The flagship server event. A scheduled zombie horde that attacks every online player simultaneously. 
            Multiple configurable waves. Lore narration in Discord. Named after Admin Dawn — Lady Dawnie is the 
            queen of the undead, and she sends her army on a schedule.
          </p>
        </div>

        {/* Event flow */}
        <section className="mb-16">
          <div className="border border-[#1a1a1a] bg-[#0a0d10] overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #e0555566, transparent)" }} />
            <div className="p-6 sm:p-8">
              <h2 className="!mb-6 !normal-case text-[1rem] tracking-[0.12em] text-[#e05555] font-mono uppercase">Event Flow</h2>
              <div className="space-y-4">
                {HUNT_PHASES.map((p, i) => (
                  <div key={p.phase} className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 border border-[#1a1a1a] flex items-center justify-center text-sm">
                      {p.icon}
                    </div>
                    <div className="flex-1 pb-4 border-b border-[#0f0f0f] last:border-0 last:pb-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono text-[0.62rem] text-[#e05555] tracking-widest uppercase">{String(i + 1).padStart(2, "0")}</span>
                        <span className="font-mono text-[0.7rem] tracking-[0.1em] text-[#ccc] uppercase">{p.phase}</span>
                      </div>
                      <p className="text-[0.78rem] text-[#555] leading-relaxed">{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Wave mechanics + Lady Dawnie */}
        <section className="mb-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="border border-[#1a1a1a] bg-[#0a0d10] p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #e0555544, transparent)" }} />
              <h3 className="font-mono text-[0.65rem] tracking-[0.2em] text-[#e05555] uppercase mb-4">Wave Mechanics</h3>
              <div className="space-y-3">
                {[
                  { label: "Spawn method", val: "Per player — each online survivor gets their own wave" },
                  { label: "Spawn distance", val: "Configurable min/max radius from player position" },
                  { label: "Wave direction", val: "Announced per wave — 8 compass directions" },
                  { label: "Default interval", val: "Every 13 hours, configurable by admins" },
                  { label: "Default waves", val: "3 waves per event, configurable" },
                  { label: "Admin trigger", val: "/dotd trigger — fires immediately on demand" },
                ].map(r => (
                  <div key={r.label} className="text-[0.75rem]">
                    <span className="font-mono text-[#444]">{r.label}</span>
                    <p className="text-[#555] mt-0.5">{r.val}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-[#1a1a1a] bg-[#0a0d10] p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #7c4a4a44, transparent)" }} />
              <h3 className="font-mono text-[0.65rem] tracking-[0.2em] text-[#7c4a4a] uppercase mb-4">Lady Dawnie</h3>
              <p className="text-[0.78rem] text-[#555] leading-relaxed mb-4">
                Every Dawn of the Dead event is narrated through Lady Dawnie — the lore character 
                named after Admin Dawn, portrayed as the undead queen who controls the horde.
              </p>
              <p className="text-[0.78rem] text-[#555] leading-relaxed mb-4">
                She provides buildup flavour before the event, directional commentary per wave 
                ("Wave 2 from the North — Dawnie doubles down. Still alive? Interesting."), 
                and a dismissive sign-off when it ends.
              </p>
              <div className="border-t border-[#141414] pt-4">
                <p className="font-mono text-[0.6rem] text-[#333] uppercase mb-2">Wave directions</p>
                <div className="flex flex-wrap gap-1.5">
                  {WAVE_DIRECTIONS.map(d => (
                    <span key={d} className="font-mono text-[0.55rem] text-[#333] border border-[#1a1a1a] px-1.5 py-0.5 uppercase">{d}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HUD phases */}
        <section className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-px flex-1 bg-[#1a1a1a]" />
            <p className="font-mono text-[0.65rem] tracking-[0.3em] uppercase text-[#e05555]">In-Game HUD</p>
            <div className="h-px flex-1 bg-[#1a1a1a]" />
          </div>
          <p className="text-[#555] text-[0.82rem] leading-relaxed mb-6">
            A custom HUD icon appears on every player's screen throughout the event. Your character 
            reacts to each phase with spoken lines. The mod runs entirely inside the game — no external UI needed.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { phase: "Warning", icon: "🟡", char: "Something feels off today… stay alert.", desc: "Yellow icon. Pre-event 10-minute warning." },
              { phase: "Incoming", icon: "🟡", char: "They're coming… from the [Direction]", desc: "Yellow icon. Event has started, direction revealed." },
              { phase: "Active Wave", icon: "🔴", char: "Here they come! / Wave N of M!", desc: "Red icon. Zombies are spawning right now." },
              { phase: "Event Over", icon: "⬛", char: "It's over… for now.", desc: "Icon hidden after 3 seconds." },
              { phase: "Safe Mode", icon: "🚫", char: "…quiet. Too quiet.", desc: "Barred icon when admin has disabled the event." },
            ].map(h => (
              <div key={h.phase} className="border border-[#1a1a1a] bg-[#0a0d10] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{h.icon}</span>
                  <span className="font-mono text-[0.65rem] tracking-[0.1em] text-[#ccc] uppercase">{h.phase}</span>
                </div>
                <p className="font-mono text-[0.65rem] text-[#4a7c59] italic mb-1.5">"{h.char}"</p>
                <p className="text-[0.72rem] text-[#444]">{h.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="h-px bg-[#1a1a1a] mb-8" />
        <div className="text-center">
          <Link href="/features" className="font-mono text-[0.7rem] tracking-widest text-[#444] hover:text-[#e6e6e6] no-underline transition-colors uppercase">
            ← Back to All Features
          </Link>
        </div>

      </div>
    </main>
  );
}
