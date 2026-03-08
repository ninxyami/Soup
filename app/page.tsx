import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <header className="hero-bg min-h-[70vh] flex items-center justify-center text-center relative">
        <div className="animate-fadeUp z-10">
          <h1 className="text-[2.5rem] tracking-[0.25em]">STATE OF UNDEAD PURGE</h1>
          <p className="mt-2 text-[#cfcfcf] text-[0.9rem]">Season 1 — New Dawn</p>
        </div>
      </header>

      <div className="max-w-[720px] mx-auto px-6 py-16">
        <section className="animate-fadeUp">
          <p>
            State of Undead Purge is a long-term, PVE-focused Project Zomboid server
            built for players who value survival, cooperation, and persistence.
          </p>
          <p>This is not a fast-wipe server. Progress is slow by design. Seasons last.</p>
        </section>

        <div className="divider" />

        <section className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/dawn.png" alt="State of Undead Purge — New Dawn" className="max-w-full h-auto rounded opacity-95 mx-auto" />
        </section>

        <div className="divider" />

        <section>
          <h2>What This Server Is</h2>
          <ul>
            <li>Player vs Environment focused</li>
            <li>Friendly, cooperative community</li>
            <li>Long-term progression</li>
            <li>Designed for both casual and dedicated survivors</li>
          </ul>
        </section>

        <div className="divider" />

        <section>
          <h2>What This Server Is Not</h2>
          <ul>
            <li>No rush-focused gameplay</li>
            <li>No griefing or toxicity</li>
            <li>No instant gratification systems</li>
            <li>No pressure to min-max</li>
          </ul>
        </section>

        <div className="divider" />

        <section className="text-center">
          <div className="flex gap-4 flex-wrap justify-center mt-6">
            <a href="https://discord.gg/NCBPqP5Q" target="_blank" rel="noopener noreferrer"
              className="inline-block px-[1.4rem] py-[0.6rem] border border-[#2a2a2a] text-[#9a9a9a] no-underline text-[0.8rem] tracking-[0.12em] uppercase hover:border-[#5865F2] hover:text-[#5865F2] transition-all">
              Join Discord
            </a>
            <Link href="/whitelist"
              className="inline-block px-[1.4rem] py-[0.6rem] border border-[#2a2a2a] text-[#9a9a9a] no-underline text-[0.8rem] tracking-[0.12em] uppercase hover:border-[#4a7c59] hover:text-[#4a7c59] transition-all">
              Apply Whitelist
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
