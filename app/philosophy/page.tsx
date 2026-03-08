export default function PhilosophyPage() {
  return (
    <main className="max-w-[720px] mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <section>
        <h1 className="text-2xl tracking-[0.15em] uppercase mb-2">Philosophy</h1>
        <p className="text-[#777] text-[0.85rem]">What this server actually stands for.</p>
      </section>

      <div className="divider" />

      <section>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/philosophy.png" alt="Philosophy" className="max-w-full h-auto rounded opacity-90" />
      </section>

      <div className="divider" />

      <section>
        <h2>Survival Means Something Here</h2>
        <p>
          This is not a server where death is a minor inconvenience. Losing a character means something.
          Progress matters because it can be lost.
        </p>
        <p>
          That tension is the point.
        </p>
      </section>

      <div className="divider" />

      <section>
        <h2>Community Over Competition</h2>
        <p>
          Players are expected to help each other, share resources, and treat the server as a shared world — not a leaderboard to dominate.
        </p>
        <p>
          PVP exists in the game. It does not exist in our values.
        </p>
      </section>

      <div className="divider" />

      <section>
        <h2>Slow Is the Point</h2>
        <p>
          You will not progress quickly here. That is by design.
          The server rewards patience, preparation, and caution over rushing and grinding.
        </p>
      </section>
    </main>
  );
}
