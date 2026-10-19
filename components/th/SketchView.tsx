"use client";
// After the torn photo: the whole photo and the pencil sketch of which item goes on which marked floor tile (item
// names from the API). Nothing to send: the game checks the tiles itself. Both are big and open full screen.
import { useState } from "react";
import { ART } from "@/lib/th/art";
import { apiUrl } from "@/lib/th/client";
import type { SketchP } from "@/lib/th/types";
import { EnlargeHint, Lightbox, PolaroidPhoto } from "./Lightbox";

const PENCIL = "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive";

function Sketch({ puzzle, big }: { puzzle: SketchP; big?: boolean }) {
  const keys = Object.keys(puzzle.tiles).sort();
  return (
    <div style={{ width: "100%", maxWidth: big ? 560 : undefined, borderRadius: 8, overflow: "hidden", backgroundImage: `linear-gradient(rgba(240,234,216,0.68), rgba(240,234,216,0.68)), url(${ART.paper})`, backgroundSize: "cover", padding: big ? "22px 16px 16px" : "14px 10px 10px", color: "#2b2b2b", transform: "rotate(0.6deg)" }}>
      <div style={{ fontFamily: PENCIL, fontSize: big ? 20 : 15, textAlign: "center", marginBottom: 6 }}>put them like this</div>
      <svg viewBox="0 0 300 130" width="100%" aria-hidden>
        <g fill="none" stroke="#3a3a3a" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="7 2 3 2">
          <path d="M8 104 L292 100" />
          {keys.map((k, i) => {
            const x = 18 + i * 96;
            return (
              <g key={k}>
                <path d={`M${x} 40 L${x + 76} 38 L${x + 80} 102 L${x - 2} 104 Z`} />
                <path d={`M${x + 6} 46 L${x + 70} 44`} opacity="0.4" />
              </g>
            );
          })}
        </g>
        {keys.map((k, i) => (
          <text key={k} x={56 + i * 96} y={30} textAnchor="middle" fontFamily={PENCIL} fontSize="22" fill="#2b2b2b">{k}</text>
        ))}
        {keys.map((k, i) => (
          <text key={k + "n"} x={56 + i * 96} y={78} textAnchor="middle" fontFamily={PENCIL} fontSize={puzzle.tiles[k].name.length > 10 ? 11 : 14} fill="#1f1f1f">
            {puzzle.tiles[k].name}
          </text>
        ))}
      </svg>
      <div style={{ fontFamily: PENCIL, fontSize: big ? 18 : 15, display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 10px", padding: "4px 10px" }}>
        {keys.map(k => (
          <span key={k} style={{ display: "contents" }}>
            <b>{k}</b><span>{puzzle.tiles[k].name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SketchView({ puzzle, arranging }: { puzzle: SketchP; arranging: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
      {!arranging && <PolaroidPhoto img={apiUrl(puzzle.img)} alt="The whole photo" tilt={-1.5} />}
      <button onClick={() => setOpen(true)} aria-label="The sketch. Tap to enlarge"
        style={{ width: "100%", padding: 0, border: 0, background: "transparent", cursor: "zoom-in", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <Sketch puzzle={puzzle} />
        <EnlargeHint />
      </button>
      <Lightbox open={open} onClose={() => setOpen(false)}><Sketch puzzle={puzzle} big /></Lightbox>
    </div>
  );
}
