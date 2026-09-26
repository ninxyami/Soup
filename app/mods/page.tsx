"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";

interface Mod { id: number; name: string; workshop_id: string; category: string; description: string; notes: string; }
interface ModsData {
  links: { steam_collection_url: string; spreadsheet_url: string; philosophy: string; };
  mods: Mod[];
}

const CATEGORIES: Record<string, { label: string; color: string }> = {
  gameplay:    { label: "Gameplay",    color: "#4a7c59" },
  qol:         { label: "QoL",         color: "#4a8fc4" },
  visual:      { label: "Visual",      color: "#9775cc" },
  audio:       { label: "Audio",       color: "#c8a84b" },
  map:         { label: "Map",         color: "#d4873a" },
  performance: { label: "Performance", color: "#e05555" },
  other:       { label: "Other",       color: "#555" },
};

export default function ModsPage() {
  const [data, setData] = useState<ModsData | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch(`${API}/api/content/mods`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setData(d))
      .catch(() => {});
  }, []);

  const mods = data?.mods || [];
  const filtered = filter === "all" ? mods : mods.filter(m => m.category === filter);
  const usedCats = [...new Set(mods.map(m => m.category))];

  return (
    <main className="max-w-[760px] mx-auto px-4 sm:px-6 py-10 sm:py-16">

      <section className="mb-10">
        <p className="font-mono text-[0.62rem] tracking-[0.3em] text-[#4a7c59] uppercase mb-3">Mod List</p>
        <h1 className="text-[1.8rem] tracking-[0.18em] uppercase mb-3 leading-none">Mods</h1>
        <p className="text-[#555] text-[0.85rem]">Carefully selected. Purpose-driven. Stability first.</p>
      </section>

      {/* Philosophy */}
      <div className="border border-[#1a1a1a] bg-[#0a0d10] p-5 mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#4a7c5933] to-transparent" />
        <p className="font-mono text-[0.58rem] tracking-[0.25em] text-[#4a7c59] uppercase mb-3">Our Philosophy</p>
        <p className="text-[0.82rem] text-[#666] leading-relaxed">
          {data?.links.philosophy || "Mods on State of Undead Purge are not used to bypass survival or accelerate progression. They exist to deepen systems, expand long-term gameplay, and support quality-of-life without trivializing the experience."}
        </p>
        <p className="text-[0.78rem] text-[#444] mt-2 leading-relaxed">
          All mods are tested before being added to the live server. Performance, compatibility, and balance are considered first. Experimental or unstable mods are avoided.
        </p>
      </div>

      {/* Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
        {[
          { label: "Steam Workshop Collection", url: data?.links.steam_collection_url, desc: "Subscribe to all mods at once", color: "#4a8fc4", icon: "🔧" },
          { label: "Mods & Server Settings", url: data?.links.spreadsheet_url, desc: "Full list with settings & details", color: "#4a7c59", icon: "📋" },
        ].map(({ label, url, desc, color, icon }) => (
          <a key={label} href={url || "#"} target="_blank" rel="noopener noreferrer"
            className="border border-[#1a1a1a] bg-[#0a0d10] p-4 no-underline group hover:border-[#2a2a2a] transition-all relative overflow-hidden block">
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}33, transparent)` }} />
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{icon}</span>
              <span className="font-mono text-[0.7rem] tracking-wider group-hover:text-[#e6e6e6] transition-colors" style={{ color }}>{label}</span>
            </div>
            <p className="text-[0.72rem] text-[#444] ml-6">{desc}</p>
            <p className="font-mono text-[0.6rem] text-[#333] mt-2 ml-6 group-hover:text-[#555] transition-colors">Open ↗</p>
          </a>
        ))}
      </div>

      {/* Mod List */}
      {mods.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-5">
            <p className="font-mono text-[0.58rem] tracking-[0.25em] text-[#333] uppercase">
              {filtered.length} mod{filtered.length !== 1 ? "s" : ""}{filter !== "all" ? ` · ${filter}` : ""}
            </p>
            {usedCats.length > 1 && (
              <div className="flex gap-1.5 flex-wrap justify-end">
                <button
                  onClick={() => setFilter("all")}
                  className="font-mono text-[0.58rem] tracking-widest uppercase border px-2 py-1 transition-all cursor-pointer bg-transparent"
                  style={{ borderColor: filter === "all" ? "#4a7c59" : "#1e1e1e", color: filter === "all" ? "#4a7c59" : "#333" }}
                >
                  All
                </button>
                {usedCats.map(cat => {
                  const info = CATEGORIES[cat] || CATEGORIES.other;
                  return (
                    <button
                      key={cat}
                      onClick={() => setFilter(cat)}
                      className="font-mono text-[0.58rem] tracking-widest uppercase border px-2 py-1 transition-all cursor-pointer bg-transparent"
                      style={{
                        borderColor: filter === cat ? info.color : "#1e1e1e",
                        color: filter === cat ? info.color : "#333",
                      }}
                    >
                      {info.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            {filtered.map(mod => {
              const catInfo = CATEGORIES[mod.category] || CATEGORIES.other;
              return (
                <div key={mod.id}
                  className="flex items-start gap-3 border border-[#111] bg-[#0a0d10] px-4 py-3 group hover:border-[#1a1a1a] transition-all">
                  <span className="w-1 h-1 rounded-full flex-shrink-0 mt-2" style={{ background: catInfo.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-mono text-[0.78rem] text-[#c8c8c8]">{mod.name}</span>
                      {mod.workshop_id && (
                        <a
                          href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.workshop_id}`}
                          target="_blank" rel="noopener noreferrer"
                          className="font-mono text-[0.55rem] tracking-widest text-[#333] hover:text-[#4a8fc4] no-underline transition-colors uppercase"
                          onClick={e => e.stopPropagation()}
                        >
                          steam ↗
                        </a>
                      )}
                    </div>
                    {mod.description || mod.notes ? (
                      <p className="text-[0.72rem] text-[#444] mt-0.5 leading-relaxed">{mod.description || mod.notes}</p>
                    ) : null}
                  </div>
                  <span className="font-mono text-[0.55rem] tracking-widest uppercase flex-shrink-0 mt-0.5" style={{ color: catInfo.color }}>
                    {catInfo.label}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {mods.length === 0 && data && (
        <div className="border border-[#1a1a1a] p-8 text-center">
          <p className="font-mono text-[0.72rem] text-[#444]">
            No mods listed yet — check the{" "}
            <a href={data.links.spreadsheet_url} target="_blank" rel="noopener noreferrer" className="text-[#4a7c59] no-underline hover:underline">
              spreadsheet
            </a>{" "}
            for the full list.
          </p>
        </div>
      )}
    </main>
  );
}
