"use client";
// @ts-nocheck
// Small shared pieces for the faction pages: the logo (uploaded picture or a drawn default), the
// banner (same idea), and money in words.
import { API } from "@/lib/constants";

const HUES = [28, 140, 200, 275, 350, 45];
function hue(name: string) {
  let s = 0;
  for (const ch of name || "") s += ch.charCodeAt(0);
  return HUES[s % HUES.length];
}

export function fmtBronze(b: number) {
  b = Math.max(0, Math.floor(b || 0));
  const gold = Math.floor(b / 10000), silver = Math.floor((b % 10000) / 1000), bronze = b % 1000;
  const parts = [];
  if (gold) parts.push(`${gold} gold`);
  if (silver) parts.push(`${silver} silver`);
  if (bronze || !parts.length) parts.push(`${bronze} bronze`);
  return parts.join(" ");
}

/** The faction's logo: the uploaded one, else a default drawn from its name (tag or initials). */
export function FactionLogo({ faction, size = 48, className = "" }: { faction: any; size?: number; className?: string }) {
  const url = faction?.pictures?.logo;
  const h = hue(faction?.name || "");
  const text = (faction?.tag || (faction?.name || "?").slice(0, 2)).toUpperCase().slice(0, 3);
  const style = { width: size, height: size, flex: "none" };
  if (url) return <img src={`${API}${url}`} alt={faction.name} style={{ ...style, objectFit: "cover" }} className={`border border-[#333] ${className}`} />;
  return (
    <div style={{ ...style, background: `linear-gradient(135deg, hsl(${h} 35% 22%), hsl(${h} 45% 10%))`, fontSize: Math.max(10, size * 0.3) }}
         className={`border border-[#333] flex items-center justify-center font-mono text-[#e6e6e6] tracking-wider ${className}`}>
      {text}
    </div>
  );
}

/** The banner strip at the top of a faction page: uploaded 1600x400, else a drawn default. */
export function FactionBanner({ faction, children }: { faction: any; children?: any }) {
  const url = faction?.pictures?.banner;
  const h = hue(faction?.name || "");
  const bg = url
    ? { backgroundImage: `url(${API}${url})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: `linear-gradient(100deg, hsl(${h} 30% 14%) 0%, hsl(${(h + 40) % 360} 25% 8%) 60%, #0b0b0b 100%)` };
  return (
    <div style={{ ...bg, aspectRatio: "4 / 1", minHeight: 120 }} className="relative border border-[#222] overflow-hidden">
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(10,10,10,0.85) 100%)" }} />
      <div className="absolute left-0 right-0 bottom-0 p-4">{children}</div>
    </div>
  );
}
