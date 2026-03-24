"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";

interface SeasonData {
  name: string; short: string; subtitle: string;
  status: string; status_note: string; description: string;
  image_url: string; map: string; economy: string;
}

const FALLBACK: SeasonData = {
  name: "Season 1: New Dawn", short: "Season 1", subtitle: "New Dawn",
  status: "Active", status_note: "Ongoing",
  description: "",
  image_url: "/assets/season.png",
  map: "Muldraugh, KY", economy: "Bronze / Silver / Gold",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#4a7c59", upcoming: "#c8a84b", ended: "#555", paused: "#d4873a",
};

export default function SeasonsPage() {
  const [data, setData] = useState<SeasonData>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/content/season`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData({ ...FALLBACK, ...d }); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const statusColor = STATUS_COLORS[data.status.toLowerCase()] || "#555";

  return (
    <main className="max-w-[760px] mx-auto px-4 sm:px-6 py-10 sm:py-16">

      <section className="mb-10">
        <p className="font-mono text-[0.62rem] tracking-[0.3em] text-[#c8a84b] uppercase mb-3">Current Season</p>
        <h1 className="text-[1.8rem] tracking-[0.18em] uppercase mb-2 leading-none">
          {loading ? "—" : data.name}
        </h1>
        <div className="flex items-center gap-3">
          <span
            className="font-mono text-[0.62rem] tracking-[0.15em] uppercase px-2 py-0.5 border"
            style={{ borderColor: `${statusColor}44`, color: statusColor, background: `${statusColor}0d` }}
          >
            {data.status}
          </span>
          <span className="font-mono text-[0.62rem] text-[#444]">{data.status_note}</span>
        </div>
      </section>

      {/* Season image */}
      {!loading && data.image_url && (
        <div className="mb-8 border border-[#1a1a1a] overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c8a84b33] to-transparent z-10" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.image_url}
            alt={data.name}
            className="w-full max-h-[360px] object-cover"
            style={{ filter: "brightness(0.88) contrast(1.05)" }}
          />
        </div>
      )}

      {/* Description */}
      {!loading && data.description && (
        <div className="border border-[#1a1a1a] bg-[#0a0d10] p-5 mb-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c8a84b22] to-transparent" />
          <p className="text-[0.85rem] text-[#777] leading-relaxed">{data.description}</p>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 mb-8">
        {[
          { label: "Season",   value: data.subtitle, note: data.short },
          { label: "Status",   value: data.status,   note: data.status_note },
          { label: "Map",      value: data.map,       note: "Default spawn" },
          { label: "Economy",  value: data.economy,   note: "Powered by Zombita" },
        ].map(({ label, value, note }) => (
          <div key={label} className="border border-[#1a1a1a] bg-[#0a0d10] p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c8a84b11] to-transparent" />
            <p className="font-mono text-[0.58rem] tracking-[0.2em] uppercase text-[#444] mb-1">{label}</p>
            <p className="font-mono text-[0.82rem] text-[#c8c8c8] mb-0.5">{loading ? "—" : value}</p>
            <p className="font-mono text-[0.6rem] text-[#333]">{note}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-[#111] pt-8 text-center">
        <p className="font-mono text-[0.62rem] tracking-[0.2em] text-[#333] uppercase mb-4">Past Seasons</p>
        <a href="/archive"
          className="font-mono text-[0.7rem] tracking-[0.15em] text-[#555] border border-[#1a1a1a] px-4 py-2 no-underline hover:text-[#c8a84b] hover:border-[#c8a84b33] transition-all inline-block">
          View Archive →
        </a>
      </div>
    </main>
  );
}
