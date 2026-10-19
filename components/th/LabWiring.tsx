"use client";
// Wiring: tap tiles to turn them until power runs from the start tile to the end tile. The timer running out sends
// a `fail`.
import { useEffect, useRef, useState } from "react";
import { ART } from "@/lib/th/art";
import { E, N, S, W, wireOpenings, wirePowered } from "@/lib/th/logic";
import type { GameProps, WiringP } from "@/lib/th/types";
import { fmtClock, useTimer } from "./useTimer";

const ARMS: [number, string][] = [[N, "M50 50 L50 -2"], [E, "M50 50 L102 50"], [S, "M50 50 L50 102"], [W, "M50 50 L-2 50"]];

function Pipe({ type, on }: { type: string; on: boolean }) {
  const m = wireOpenings(type, 0);
  const col = on ? "#5ff0ff" : "#8a6a44";
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
      {ARMS.filter(([b]) => m & b).map(([b, d]) => (
        <g key={b}>
          <path d={d} stroke="#0b0d0d" strokeWidth={26} strokeLinecap="butt" />
          <path d={d} stroke={col} strokeWidth={14} strokeLinecap="butt" style={{ filter: on ? "drop-shadow(0 0 4px #5ff0ff)" : "none" }} />
        </g>
      ))}
      <circle cx={50} cy={50} r={type === "E" ? 17 : 10} fill={col} stroke="#0b0d0d" strokeWidth={4} />
    </svg>
  );
}

export default function LabWiring({ puzzle, busy, serverNow, onSolve, onFail }: GameProps<WiringP>) {
  const { w, h, src, dst } = puzzle;
  const types = puzzle.tiles.map(t => t[0]);
  const [turns, setTurns] = useState<number[]>(() => puzzle.tiles.map(t => t[1]));
  const sent = useRef(false);
  const left = useTimer(puzzle.started, puzzle.time_s, serverNow);
  const rots = turns.map(r => ((r % 4) + 4) % 4);
  const powered = wirePowered(types, rots, w, h, src);
  const dstI = dst[1] * w + dst[0], srcI = src[1] * w + src[0];
  const solved = powered.has(dstI);

  useEffect(() => {
    if (sent.current) return;
    if (solved) { sent.current = true; const r = rots; setTimeout(() => onSolve({ rots: r, attempt: puzzle.attempt }), 400); return; }
    if (left <= 0) { sent.current = true; onFail?.({ attempt: puzzle.attempt }); }
  }, [solved, left]); // eslint-disable-line react-hooks/exhaustive-deps

  const out = sent.current && !solved;
  const tap = (i: number) => {
    if (busy || sent.current) return;
    setTurns(t => t.map((r, j) => (j === i ? r + 1 : r)));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} className="th-mono">
        <span style={{ fontSize: 22, color: left < 20 ? "#ff7a7a" : "#f0ead8" }}>{fmtClock(left)}</span>
        <span style={{ fontSize: 13, color: "#b9c6bd" }}>{powered.size} of {w * h} lit</span>
      </div>
      <div style={{ borderRadius: 12, padding: "18px 14px", backgroundImage: `url(${ART.panel})`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${w}, 1fr)`, gap: 3, width: "min(100%, 44vh)", margin: "0 auto", background: "#070808", padding: 3, borderRadius: 6, opacity: out ? 0.5 : 1 }}>
          {types.map((t, i) => (
            <button key={i} onClick={() => tap(i)} aria-label={`tile ${i + 1}`} data-t={t} data-r={rots[i]}
              style={{ position: "relative", aspectRatio: "1", padding: 0, border: 0, background: powered.has(i) ? "#122126" : "#151716", borderRadius: 3, cursor: "pointer", touchAction: "manipulation", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, transform: `rotate(${turns[i] * 90}deg)`, transition: "transform 0.15s" }}>
                <Pipe type={t} on={powered.has(i)} />
              </div>
              {i === srcI && <span style={{ position: "absolute", left: 2, top: 0, fontSize: 13, color: "#ffd25a" }} aria-label="power">⚡</span>}
              {i === dstI && <span style={{ position: "absolute", right: 2, bottom: 0, fontSize: 13, color: "#bff3ff" }} aria-label="end">❄</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="th-note">
        {solved ? "Connected." : out ? "Out of time. A new panel is coming."
          : "Tap a tile to turn it. Run the power from ⚡ to ❄."}
      </div>
    </div>
  );
}
