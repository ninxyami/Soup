"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";

interface Standout { label: string; value: string; }
interface Season {
  season_name: string; subtitle: string; dates: string;
  description: string; image_url: string; story: string;
  standouts: Standout[];
}

const STATIC_FALLBACK: Season[] = [
  {
    season_name: "Dawnpocalypse",
    subtitle: "The Pre-Season",
    dates: "Early 2025",
    description: "The chaotic pre-test run that started it all. No rules, no economy, just survival. Named to tease Dawnie — a tradition that stuck.",
    image_url: "/assets/dawnpocalypse.png",
    story: "",
    standouts: [
      { label: "Most Deaths", value: "Dawn (34)" },
      { label: "First Lottery Win", value: "Tortellini" },
      { label: "Longest Survival", value: "Psycho (3mo 14d)" },
    ],
  },
];

export default function ArchivePage() {
  const [seasons, setSeasons] = useState<Season[]>(STATIC_FALLBACK);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/content/archive`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.seasons && d.seasons.length > 0) setSeasons(d.seasons);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  return (
    <main className="max-w-[760px] mx-auto px-4 sm:px-6 py-10 sm:py-16">

      <section className="mb-10">
        <p className="font-mono text-[0.62rem] tracking-[0.3em] text-[#c8a84b] uppercase mb-3">History</p>
        <h1 className="text-[1.8rem] tracking-[0.18em] uppercase mb-3 leading-none">Archive</h1>
        <p className="text-[#555] text-[0.85rem]">Every season, preserved.</p>
      </section>

      <div className="flex flex-col gap-6">
        {seasons.map((s) => (
          <div key={s.season_name} className="border border-[#1a1a1a] bg-[#0a0d10] relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c8a84b33] to-transparent" />

            {s.image_url && (
              <div className="relative overflow-hidden" style={{ maxHeight: 240 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.image_url} alt={s.season_name}
                  className="w-full object-cover"
                  style={{ filter: "brightness(0.7) contrast(1.05)", maxHeight: 240 }} />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d10] via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 p-5">
                  <h2 className="text-[1.2rem] tracking-[0.1em] text-[#e6e6e6] mb-0.5">{s.season_name}</h2>
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[0.68rem] text-[#c8a84b] tracking-wider">{s.subtitle}</span>
                    {s.dates && <span className="font-mono text-[0.62rem] text-[#555]">{s.dates}</span>}
                  </div>
                </div>
              </div>
            )}

            {!s.image_url && (
              <div className="px-6 pt-6">
                <h2 className="text-[1.1rem] tracking-[0.1em] text-[#e6e6e6] mb-0.5">{s.season_name}</h2>
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="font-mono text-[0.68rem] text-[#c8a84b] tracking-wider">{s.subtitle}</span>
                  {s.dates && <span className="font-mono text-[0.62rem] text-[#555]">{s.dates}</span>}
                </div>
              </div>
            )}

            <div className="px-6 py-5">
              {s.description && (
                <p className="text-[#777] text-[0.82rem] leading-relaxed mb-4">{s.description}</p>
              )}

              {s.standouts && s.standouts.length > 0 && (
                <div className="flex gap-6 flex-wrap mb-4">
                  {s.standouts.map((st) => (
                    <div key={st.label} className="flex flex-col gap-0.5">
                      <span className="font-mono text-[0.58rem] tracking-[0.15em] uppercase text-[#444]">{st.label}</span>
                      <span className="font-mono text-[0.82rem] text-[#b0b0b0]">{st.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {s.story && (
                <div className="border-t border-[#111] mt-4 pt-4">
                  <p className="font-mono text-[0.58rem] tracking-[0.2em] uppercase text-[#c8a84b] mb-3">Season Chronicle</p>
                  <p className="text-[0.8rem] text-[#666] leading-relaxed whitespace-pre-line">{s.story}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <section className="text-center mt-10">
        <p className="font-mono text-[0.62rem] text-[#333] italic">more seasons will be archived here as they end.</p>
      </section>
    </main>
  );
}
