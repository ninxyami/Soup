"use client";
// Mini-game 1b: the torn photo. Slide the pieces back together; the whole photo is where to go next.
// The photo is only on the real phone, so it is big, and "Enlarge" opens the board full screen (still playable).
// Easier (Nin 10-23: "no one will guess this right"): most pieces are plain grass, so each piece carries its number
// (1 to 8, read left to right, top to bottom, the gap ends bottom right) and gets a gold edge once it sits in its place.
import { useEffect, useState } from "react";
import { ART, POLAROID_ASPECT, POLAROID_BACK, POLAROID_HOLE } from "@/lib/th/art";
import { apiUrl } from "@/lib/th/client";
import { photoCanSlide, photoSlide, photoSolved } from "@/lib/th/logic";
import type { GameProps, PhotoP } from "@/lib/th/types";
import { EnlargeHint, Lightbox } from "./Lightbox";

export default function TornPhoto({ puzzle, busy, onSolve, error }: GameProps<PhotoP>) {
  const n = puzzle.size || 3;
  const [tiles, setTiles] = useState(puzzle.tiles);
  const [moves, setMoves] = useState<number[]>([]);
  const [big, setBig] = useState(false);
  const solved = photoSolved(tiles);
  const img = apiUrl(puzzle.img);
  const placed = tiles.filter((piece, pos) => piece === pos && piece !== n * n - 1).length;

  useEffect(() => { setTiles(puzzle.tiles); setMoves([]); }, [puzzle.tiles.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (error) { setTiles(puzzle.tiles); setMoves([]); } }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = (pos: number) => {
    if (busy || solved || !photoCanSlide(tiles, n, pos)) return;
    const next = photoSlide(tiles, pos);
    const m = [...moves, pos];
    setTiles(next);
    setMoves(m);
    if (photoSolved(next)) setTimeout(() => onSolve({ moves: m }), 450);
  };

  const cell = 100 / n;
  const pieces = (label: string) => tiles.map((piece, pos) => {
    if (piece === n * n - 1 && !solved) return null;
    const r = Math.floor(pos / n), c = pos % n, pr = Math.floor(piece / n), pc = piece % n;
    const movable = !solved && photoCanSlide(tiles, n, pos);
    const home = piece === pos;
    return (
      <button key={piece} onClick={() => tap(pos)} aria-label={`${label}photo piece ${piece + 1}`}
        style={{
          position: "absolute", left: 0, top: 0, width: `${cell}%`, height: `${cell}%`, padding: 0, border: 0,
          transform: `translate(${c * 100}%, ${r * 100}%)`, transition: "transform 0.16s ease-out",
          backgroundImage: `url("${img}")`, backgroundSize: `${n * 100}% ${n * 100}%`,
          backgroundPosition: `${(pc / (n - 1)) * 100}% ${(pr / (n - 1)) * 100}%`,
          boxShadow: solved ? "none" : home ? "inset 0 0 0 3px rgba(226,183,76,0.95), inset 0 0 8px rgba(0,0,0,0.5)"
            : "inset 0 0 0 1px rgba(255,250,235,0.55), inset 0 0 6px rgba(0,0,0,0.6)",
          cursor: movable ? "pointer" : "default", touchAction: "manipulation",
          filter: solved ? "none" : "sepia(0.25)",
        }}>
        {!solved && (
          <span style={{
            position: "absolute", left: 6, top: 5, minWidth: 22, padding: "1px 6px", borderRadius: 6,
            background: home ? "rgba(226,183,76,0.92)" : "rgba(20,16,10,0.78)", color: home ? "#1a140b" : "#efe6cf",
            font: "700 15px/20px ui-monospace, monospace", textAlign: "center", pointerEvents: "none",
          }}>{piece + 1}</span>
        )}
      </button>
    );
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
      <div style={{ position: "relative", width: "min(100%, 420px)", aspectRatio: POLAROID_ASPECT }}>
        <div style={{ position: "absolute", left: `${POLAROID_BACK.left}%`, top: `${POLAROID_BACK.top}%`, width: `${POLAROID_BACK.width}%`, height: `${POLAROID_BACK.height}%`, background: "#17130e" }} />
        <div style={{ position: "absolute", left: `${POLAROID_HOLE.left}%`, top: `${POLAROID_HOLE.top}%`, width: `${POLAROID_HOLE.width}%`, height: `${POLAROID_HOLE.height}%`, background: "#151515" }}>
          {pieces("")}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ART.polaroid} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
        <span style={{ position: "absolute", left: 0, right: 0, top: `${POLAROID_HOLE.top + POLAROID_HOLE.height + 3}%`, textAlign: "center" }}>
          <button onClick={() => setBig(true)} style={{ background: "rgba(20,16,10,0.85)", border: 0, borderRadius: 999, padding: "8px 14px", cursor: "zoom-in" }}>
            <EnlargeHint text="Enlarge" />
          </button>
        </span>
      </div>
      <div className="th-row" style={{ width: "100%" }}>
        <div className="th-note" style={{ alignSelf: "center" }}>{solved ? "The photo is whole." : `Slide the pieces into order, 1 to ${n * n - 1}, gap at the bottom right. Gold = in place: ${placed} of ${n * n - 1}. Moves: ${moves.length}`}</div>
        <button className="th-btn ghost" style={{ flex: "0 0 auto" }} disabled={busy || !moves.length} onClick={() => { setTiles(puzzle.tiles); setMoves([]); }}>Start over</button>
      </div>
      <Lightbox open={big} onClose={() => setBig(false)}>
        <div style={{ width: "min(100%, 560px)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ position: "relative", width: "100%", aspectRatio: "1", background: "#151515", border: "6px solid #e9e2cf" }}>{pieces("big ")}</div>
          <div className="th-note">{solved ? "The photo is whole." : `Slide the pieces into order, 1 to ${n * n - 1}, gap at the bottom right. Gold = in place: ${placed} of ${n * n - 1}. Moves: ${moves.length}`}</div>
        </div>
      </Lightbox>
    </div>
  );
}
