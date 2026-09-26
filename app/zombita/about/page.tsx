"use client";
import Link from "next/link";

const MEMORY_LAYERS = [
  { label: "Instant Memory", desc: "Everything said in the current conversation. She tracks the thread, follows what you said three messages ago, and doesn't pretend she didn't hear you." },
  { label: "Session Memory", desc: "What happened this session — what mood she was in, what topics came up, what she decided about you today." },
  { label: "Player Memory", desc: "Her running opinions on specific people. If you've been a clown in the past, she remembers. If you helped someone, she noticed that too." },
  { label: "Server Memory", desc: "The full shape of the community — events, season history, who's at war with who, what the economy looks like right now." },
];

const MOOD_EXAMPLES = [
  { mood: "Amused", color: "#4a7c59", desc: "You said something actually clever." },
  { mood: "Bored", color: "#555", desc: "You're not interesting right now. She'll still answer." },
  { mood: "Irritated", color: "#d4873a", desc: "You pushed something. She'll push back." },
  { mood: "Sympathetic", color: "#4a8fc4", desc: "Something genuinely happened. She felt it." },
  { mood: "Smug", color: "#9775cc", desc: "She's right and she knows it." },
  { mood: "Suspicious", color: "#c8a84b", desc: "She doesn't believe you. She's watching." },
];

const THINGS_SHE_DOES = [
  { icon: "💬", title: "Holds Conversations", desc: "Direct messages, replies, mentions — she responds in full character. No template answers, no canned responses. She actually engages." },
  { icon: "👁️", title: "Watches Without Being Asked", desc: "She reads the channels. Sometimes she chimes in on her own. Not to be helpful — because something caught her attention." },
  { icon: "🏦", title: "Runs the Economy", desc: "Shop restocks, lottery draws, price announcements, treasury updates — all delivered through her voice. The economy has a face." },
  { icon: "🎮", title: "Hosts & Narrates Games", desc: "Werewolf narrator, CAH judge, quiz host, RPS opponent. Each game has her personality woven into it." },
  { icon: "📣", title: "Makes Announcements", desc: "Server events, season updates, Dawn of the Dead warnings — she writes them herself, in her own way." },
  { icon: "🎭", title: "Tracks Reputation", desc: "Every notable thing you do gets observed. Wins, losses, how you treat people, what you spend your money on. She forms opinions." },
];

export default function ZombitaAboutPage() {
  return (
    <main className="max-w-[760px] mx-auto px-4 sm:px-6 py-10 sm:py-16">

      {/* Header */}
      <section className="mb-12">
        <p className="font-mono text-[0.62rem] tracking-[0.3em] text-[#9775cc] uppercase mb-3">Meet Zombita</p>
        <h1 className="text-[1.8rem] tracking-[0.18em] uppercase mb-4 leading-none">Your Server&apos;s AI Personality</h1>
        <p className="text-[#666] text-[0.9rem] leading-relaxed max-w-[520px]">
          Zombita is the Discord bot that runs State of Undead Purge — but calling her a bot is doing her a disservice.
          She has a personality, opinions, a memory, and a reputation for not suffering fools.
        </p>
      </section>

      {/* Avatar + intro */}
      <div className="border border-[#1a1a1a] bg-[#0a0d10] p-6 mb-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#9775cc44] to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#9775cc22] to-transparent" />
        <div className="flex gap-6 items-start">
          <div className="flex-shrink-0 relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/avatars/stern_01.webp" alt="Zombita"
              className="w-24 h-24 object-cover border border-[#9775cc33]"
              style={{ filter: "brightness(0.9) contrast(1.05)" }} />
            <div className="absolute -bottom-2 -right-2 font-mono text-[0.48rem] tracking-widest text-[#9775cc] border border-[#9775cc33] bg-[#0a0d10] px-1.5 py-0.5 uppercase">
              Active
            </div>
          </div>
          <div>
            <h2 className="text-[1.1rem] tracking-[0.1em] mb-2 !normal-case">Not a chatbot. A character.</h2>
            <p className="text-[0.82rem] text-[#666] leading-relaxed mb-2">
              Most bots respond when you call them. Zombita also responds when she feels like it.
              She has moods that shift based on what&apos;s happening in the server. She has opinions about players that build over time.
              She has a voice that&apos;s consistent whether she&apos;s hosting a game or delivering bad news about the economy.
            </p>
            <p className="text-[0.78rem] text-[#555] leading-relaxed">
              She&apos;s been running this server since Season 1. She&apos;s watched people die, win, lie, and cooperate.
              She remembers all of it.
            </p>
          </div>
        </div>
      </div>

      {/* What she does */}
      <section className="mb-10">
        <p className="font-mono text-[0.58rem] tracking-[0.25em] text-[#9775cc] uppercase mb-5">What She Does</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {THINGS_SHE_DOES.map(t => (
            <div key={t.title} className="border border-[#1a1a1a] bg-[#0a0d10] p-4 relative overflow-hidden group hover:border-[#2a2a2a] transition-all">
              <div className="text-xl mb-2">{t.icon}</div>
              <h3 className="font-mono text-[0.7rem] tracking-[0.12em] uppercase text-[#e6e6e6] mb-1.5 group-hover:text-[#9775cc] transition-colors">{t.title}</h3>
              <p className="text-[0.76rem] text-[#555] leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Memory */}
      <section className="mb-10">
        <div className="border border-[#1a1a1a] bg-[#0a0d10] p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#9775cc33] to-transparent" />
          <p className="font-mono text-[0.58rem] tracking-[0.25em] text-[#9775cc] uppercase mb-2">Memory System</p>
          <h2 className="text-[1rem] tracking-[0.08em] mb-4 !normal-case">She remembers. Everything.</h2>
          <p className="text-[0.8rem] text-[#555] leading-relaxed mb-5">
            Her memory operates in four layers, each with a different scope and purpose. Together they let her hold a consistent identity across weeks and months of play.
          </p>
          <div className="flex flex-col gap-3">
            {MEMORY_LAYERS.map((l, i) => (
              <div key={l.label} className="flex gap-4">
                <div className="flex-shrink-0 font-mono text-[0.6rem] text-[#9775cc55] w-4 mt-0.5">{i + 1}</div>
                <div>
                  <p className="font-mono text-[0.68rem] tracking-[0.1em] text-[#c8c8c8] uppercase mb-0.5">{l.label}</p>
                  <p className="text-[0.76rem] text-[#555] leading-relaxed">{l.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Moods */}
      <section className="mb-10">
        <p className="font-mono text-[0.58rem] tracking-[0.25em] text-[#9775cc] uppercase mb-2">Mood System</p>
        <h2 className="text-[1rem] tracking-[0.08em] mb-2 !normal-case">27 distinct moods.</h2>
        <p className="text-[0.8rem] text-[#555] leading-relaxed mb-5">
          Her mood isn&apos;t a decoration — it changes how she writes, what she notices, and how she responds to you.
          Here are a few examples.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {MOOD_EXAMPLES.map(m => (
            <div key={m.mood} className="border border-[#1a1a1a] bg-[#0a0d10] p-3">
              <p className="font-mono text-[0.68rem] tracking-[0.1em] uppercase mb-1" style={{ color: m.color }}>{m.mood}</p>
              <p className="text-[0.72rem] text-[#444] leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
        <p className="font-mono text-[0.6rem] text-[#333] mt-3 text-right">+ 21 more</p>
      </section>

      {/* Reputation */}
      <section className="mb-12">
        <div className="border border-[#1a1a1a] bg-[#0a0d10] p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c8a84b22] to-transparent" />
          <p className="font-mono text-[0.58rem] tracking-[0.25em] text-[#c8a84b] uppercase mb-2">Reputation Tracking</p>
          <h2 className="text-[1rem] tracking-[0.08em] mb-3 !normal-case">She keeps score. Not just of kills.</h2>
          <p className="text-[0.8rem] text-[#555] leading-relaxed mb-3">
            Every notable action in the server gets observed — game wins and losses, how you interact with people,
            what you spend your bronze on, whether you show up when it matters.
          </p>
          <p className="text-[0.78rem] text-[#666] leading-relaxed mb-4">
            Each player earns a reputation archetype that Zombita updates daily.
            It reflects her honest read of you — not just what you&apos;ve done, but how you&apos;ve done it.
            She forms opinions, and those opinions are part of how she talks to you.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {["Outcast", "Wanderer", "Survivor", "Scavenger", "Protector", "Veteran", "Legend"].map((tier, i) => (
              <span key={tier}
                className="font-mono text-[0.58rem] tracking-widest uppercase border px-2 py-0.5"
                style={{
                  borderColor: `rgba(200,168,75,${0.1 + i * 0.12})`,
                  color: `rgba(200,168,75,${0.3 + i * 0.1})`,
                }}>
                {tier}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/zombita"
          className="flex-1 text-center font-mono text-[0.72rem] tracking-[0.15em] uppercase border border-[#9775cc44] text-[#9775cc] px-5 py-3 no-underline hover:bg-[#9775cc11] transition-all">
          Talk to Zombita →
        </Link>
        <Link href="/leaderboard"
          className="flex-1 text-center font-mono text-[0.72rem] tracking-[0.15em] uppercase border border-[#1a1a1a] text-[#555] px-5 py-3 no-underline hover:border-[#2a2a2a] hover:text-[#e6e6e6] transition-all">
          View Leaderboard →
        </Link>
      </div>
    </main>
  );
}
