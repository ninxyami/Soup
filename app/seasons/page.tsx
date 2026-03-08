export default function SeasonsPage() {
  return (
    <main className="max-w-[720px] mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <section>
        <h1 className="text-2xl tracking-[0.15em] uppercase mb-2">Season 1 — New Dawn</h1>
        <p className="text-[#777] text-[0.85rem]">The current season.</p>
      </section>

      <div className="divider" />

      <section className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/season.png" alt="New Dawn" className="max-w-full h-auto object-contain mx-auto" />
      </section>

      <div className="divider" />

      <section>
        <div className="flex flex-col gap-6 mt-2">
          {[
            { label: "Season", value: "New Dawn", note: "Season 1" },
            { label: "Status", value: "Active", note: "Ongoing" },
            { label: "Map", value: "Muldraugh, KY", note: "Default spawn" },
            { label: "Economy", value: "Bronze / Silver / Gold", note: "Powered by Zombita" },
          ].map(({ label, value, note }) => (
            <div key={label} className="flex flex-col gap-1 pb-6 border-b border-[#1a1a1a] last:border-0">
              <span className="text-[0.68rem] tracking-[0.12em] uppercase text-[#444]">{label}</span>
              <span className="text-[1rem] text-[#e6e6e6] mt-[0.15rem]">{value}</span>
              <span className="text-[0.82rem] text-[#666] mt-[0.1rem]">{note}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
