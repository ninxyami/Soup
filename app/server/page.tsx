"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";

interface ServerContent {
  ip: string; port: string; password: string;
  max_players: string; ram: string; region: string;
  game_version: string; version_note: string;
  discord_url: string; steam_collection_url: string; spreadsheet_url: string;
  announcement: string;
}

const FALLBACK: ServerContent = {
  ip: "15.235.166.58", port: "9000", password: "newdawn",
  max_players: "32", ram: "40 GB", region: "Singapore",
  game_version: "B42.13.1",
  version_note: "Steam → Project Zomboid → Properties → Betas → select the version above",
  discord_url: "https://discord.gg/NCBPqP5Q",
  steam_collection_url: "https://steamcommunity.com/sharedfiles/filedetails/?id=3653988013",
  spreadsheet_url: "https://docs.google.com/spreadsheets/d/1kSo22-q_So3mZJ5hjYIH2oqQyOF-sIOacoV28HlQgFc/edit",
  announcement: "",
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      className="font-mono text-[0.58rem] tracking-widest uppercase border px-2 py-0.5 transition-all cursor-pointer bg-transparent"
      style={{ borderColor: copied ? "#4a7c59" : "#1e1e1e", color: copied ? "#4a7c59" : "#333" }}
    >
      {copied ? "✓ copied" : "copy"}
    </button>
  );
}

function InfoRow({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[#111] last:border-0">
      <span className="font-mono text-[0.62rem] tracking-[0.15em] uppercase text-[#444] w-28 flex-shrink-0">{label}</span>
      <span className="font-mono text-[0.88rem] text-[#c8c8c8] flex-1">{value}</span>
      {copyable && <CopyButton value={value} />}
    </div>
  );
}

export default function ServerPage() {
  const [data, setData] = useState<ServerContent>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/content/server`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData({ ...FALLBACK, ...d }); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <main className="max-w-[760px] mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <section className="mb-10">
        <p className="font-mono text-[0.62rem] tracking-[0.3em] text-[#4a7c59] uppercase mb-3">How to Connect</p>
        <h1 className="text-[1.8rem] tracking-[0.18em] uppercase mb-3 leading-none">Server Information</h1>
        <p className="text-[#555] text-[0.85rem]">Everything you need to get in-game.</p>
      </section>

      {!loading && data.announcement && (
        <div className="mb-8 border border-[#c8a84b33] bg-[#c8a84b08] p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c8a84b66] to-transparent" />
          <p className="font-mono text-[0.65rem] tracking-[0.2em] text-[#c8a84b] uppercase mb-1">Notice</p>
          <p className="text-[0.85rem] text-[#999]">{data.announcement}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="border border-[#1a1a1a] bg-[#0a0d10] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#4a7c5944] to-transparent" />
          <div className="px-5 pt-5 pb-2">
            <p className="font-mono text-[0.58rem] tracking-[0.25em] text-[#4a7c59] uppercase mb-4">Connection</p>
            <InfoRow label="IP Address" value={loading ? "—" : data.ip} copyable />
            <InfoRow label="Port" value={loading ? "—" : data.port} copyable />
            <InfoRow label="Password" value={loading ? "—" : data.password} copyable />
          </div>
        </div>
        <div className="border border-[#1a1a1a] bg-[#0a0d10] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c8a84b33] to-transparent" />
          <div className="px-5 pt-5 pb-2">
            <p className="font-mono text-[0.58rem] tracking-[0.25em] text-[#c8a84b] uppercase mb-4">Server Specs</p>
            <InfoRow label="Max Players" value={loading ? "—" : `${data.max_players} slots`} />
            <InfoRow label="RAM" value={loading ? "—" : data.ram} />
            <InfoRow label="Region" value={loading ? "—" : data.region} />
          </div>
        </div>
      </div>

      <div className="border border-[#1a1a1a] bg-[#0a0d10] p-5 mb-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#4a8fc433] to-transparent" />
        <p className="font-mono text-[0.58rem] tracking-[0.25em] text-[#4a8fc4] uppercase mb-3">Game Version</p>
        <div className="flex items-center gap-4 mb-3">
          <span className="font-mono text-[0.62rem] tracking-[0.15em] uppercase text-[#444] w-28 flex-shrink-0">Build</span>
          <span className="font-mono text-[0.88rem] text-[#c8c8c8]">{loading ? "—" : data.game_version}</span>
        </div>
        <p className="text-[0.78rem] text-[#555] leading-relaxed pl-32">{loading ? "" : data.version_note}</p>
      </div>

      <div className="border border-[#1a1a1a] bg-[#0a0d10] p-5 mb-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#9775cc33] to-transparent" />
        <p className="font-mono text-[0.58rem] tracking-[0.25em] text-[#9775cc] uppercase mb-4">External Links</p>
        <div className="flex flex-col gap-2">
          {[
            { label: "Discord Server", url: data.discord_url, color: "#5865F2" },
            { label: "Steam Workshop Collection", url: data.steam_collection_url, color: "#4a8fc4" },
            { label: "Mods & Server Settings Spreadsheet", url: data.spreadsheet_url, color: "#4a7c59" },
          ].map(({ label, url, color }) => (
            <a key={label} href={url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 border border-[#111] p-3 no-underline group hover:border-[#1e1e1e] transition-all">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="font-mono text-[0.72rem] tracking-wider text-[#666] group-hover:text-[#e6e6e6] transition-colors">{label}</span>
              <span className="ml-auto font-mono text-[0.6rem] text-[#333] group-hover:text-[#555] transition-colors">↗</span>
            </a>
          ))}
        </div>
      </div>

      <div className="border-t border-[#111] pt-8">
        <p className="font-mono text-[0.58rem] tracking-[0.25em] text-[#333] uppercase mb-4">Quick Links</p>
        <div className="flex flex-wrap gap-2">
          {[
            { href: "/whitelist", label: "Apply for Whitelist" },
            { href: "/mods", label: "Browse Mods" },
            { href: "/features", label: "Explore Features" },
            { href: "/zombita", label: "Talk to Zombita" },
            { href: "/philosophy", label: "Server Philosophy" },
          ].map(({ href, label }) => (
            <Link key={href} href={href}
              className="font-mono text-[0.68rem] tracking-[0.1em] text-[#555] border border-[#1a1a1a] px-3 py-1.5 no-underline hover:text-[#4a7c59] hover:border-[#4a7c5944] transition-all">
              {label} →
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
