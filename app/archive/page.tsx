export default function ArchivePage() {
  const seasons = [
    {
      name: "Dawnpocalypse",
      subtitle: "The Pre-Season",
      dates: "Early 2025",
      description: "The chaotic pre-test run that started it all. No rules, no economy, just survival. Named to tease Dawnie — a tradition that stuck.",
      image: "/assets/dawnpocalypse.png",
      standouts: [
        { label: "Most Deaths", value: "Dawn (34)" },
        { label: "First Lottery Win", value: "Tortellini" },
        { label: "Longest Survival", value: "Psycho (3mo 14d)" },
      ],
    },
  ];

  return (
    <main className="max-w-[720px] mx-auto px-6 py-16">
      <section>
        <h1 className="text-2xl tracking-[0.15em] uppercase mb-2">Archive</h1>
        <p className="text-[#777] text-[0.85rem]">Every season, preserved.</p>
      </section>

      <div className="divider" />

      {seasons.map((s) => (
        <div key={s.name} className="border border-[#1f1f1f] p-8 mb-8">
          <div className="flex items-baseline gap-6 mb-2 flex-wrap">
            <span className="text-[1.1rem] text-[#e6e6e6] tracking-[0.06em]">{s.name}</span>
            <span className="text-[0.78rem] text-[#555] tracking-[0.08em]">{s.subtitle}</span>
            <span className="text-[0.78rem] text-[#444]">{s.dates}</span>
          </div>

          <p className="text-[#777] text-[0.9rem] mt-3 mb-4">{s.description}</p>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.image} alt={s.name} className="w-full max-h-[280px] object-cover my-5 brightness-[0.85]" />

          <div className="flex gap-8 flex-wrap mt-5">
            {s.standouts.map((st) => (
              <div key={st.label} className="flex flex-col gap-1">
                <span className="text-[0.68rem] tracking-[0.1em] uppercase text-[#444]">{st.label}</span>
                <span className="text-[0.9rem] text-[#b0b0b0]">{st.value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <section className="text-center">
        <p className="text-[#555] text-[0.85rem] font-mono italic">more seasons will be archived here as they end.</p>
      </section>
    </main>
  );
}
