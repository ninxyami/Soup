"use client";
// Vial sort: sort the vials so every vial holds one colour.
// Tap a vial to pick it up, tap another to pour. The timer or the move limit running out sends a `fail`.
import { useEffect, useRef, useState } from "react";
import { ART, VIAL_ASPECT, VIAL_LIQUID } from "@/lib/th/art";
import { vialAnyPour, vialCanPour, vialPour, vialSolved } from "@/lib/th/logic";
import type { GameProps, VialP } from "@/lib/th/types";
import { fmtClock, useTimer } from "./useTimer";

// colour + a shape, so the vials also work for colour-blind players
const COLOURS: Record<string, [string, string]> = {
  r: ["#d9473f", "●"], g: ["#4caf50", "▲"], b: ["#3f7fd9", "■"], y: ["#e0c340", "◆"], p: ["#9b59d0", "✚"],
  o: ["#e08a3a", "★"], c: ["#3fc6c6", "◯"], w: ["#e6e6e6", "✕"], k: ["#6b6b6b", "▼"],
};
const colour = (c: string) => COLOURS[c] ?? ["#888", c.slice(0, 1).toUpperCase()];

export default function VialSort({ puzzle, busy, serverNow, onSolve, onFail }: GameProps<VialP>) {
  const [vials, setVials] = useState(puzzle.vials);
  const [moves, setMoves] = useState<number[][]>([]);
  const [held, setHeld] = useState<number | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const sent = useRef(false);
  const left = useTimer(puzzle.started, puzzle.time_s, serverNow);
  const solved = vialSolved(vials, puzzle.cap);
  const movesLeft = puzzle.move_limit - moves.length;

  useEffect(() => {
    if (sent.current || solved) return;
    if (left <= 0 || movesLeft <= 0) {
      sent.current = true;
      onFail?.({ attempt: puzzle.attempt });
    }
  }, [left, movesLeft, solved, onFail, puzzle.attempt]);

  const out = sent.current && !solved;
  const dead = !solved && !out && !vialAnyPour(vials, puzzle.cap);

  // The same rack from its start, as a page refresh does: the clock keeps running, and the moves start over because the
  // server replays them from the start of the rack.
  const again = () => {
    if (busy) return;
    setVials(puzzle.vials);
    setMoves([]);
    setHeld(null);
  };

  const tap = (i: number) => {
    if (busy || solved || out) return;
    if (held === null) {
      if (vials[i].length) setHeld(i);
      return;
    }
    if (held === i) { setHeld(null); return; }
    if (!vialCanPour(vials, puzzle.cap, held, i)) {
      setShake(i);
      setTimeout(() => setShake(null), 350);
      if (vials[i].length) setHeld(i); else setHeld(null);
      return;
    }
    const next = vialPour(vials, puzzle.cap, held, i);
    const m = [...moves, [held, i]];
    setVials(next);
    setMoves(m);
    setHeld(null);
    if (vialSolved(next, puzzle.cap)) {
      sent.current = true;
      onSolve({ moves: m, attempt: puzzle.attempt });
    }
  };

  const urgent = left < 20;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} className="th-mono">
        <span style={{ fontSize: 22, color: urgent ? "#ff7a7a" : "#f0ead8" }}>{fmtClock(left)}</span>
        <span style={{ fontSize: 14, color: movesLeft <= 5 ? "#ff7a7a" : "#b9c6bd" }}>{movesLeft} moves left</span>
      </div>
      <div style={{ borderRadius: 12, padding: "26px 10px 16px", backgroundImage: `url(${ART.tray})`, backgroundSize: "cover", backgroundPosition: "center", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "18px 4px", opacity: out ? 0.5 : 1 }}>
        {vials.map((v, i) => (
          <button key={i} onClick={() => tap(i)} aria-label={`vial ${i + 1}`}
            style={{
              position: "relative", width: "min(12.5%, 46px)", minWidth: 28, aspectRatio: VIAL_ASPECT, padding: 0, border: 0, background: "transparent",
              transform: held === i ? "translateY(-14px)" : shake === i ? "translateX(3px)" : "none", transition: "transform 0.12s", cursor: "pointer", touchAction: "manipulation",
            }}>
            <div style={{ position: "absolute", left: `${VIAL_LIQUID.left}%`, top: `${VIAL_LIQUID.top}%`, width: `${VIAL_LIQUID.width}%`, height: `${VIAL_LIQUID.height}%`, borderRadius: "0 0 999px 999px", overflow: "hidden", display: "flex", flexDirection: "column-reverse" }}>
              {v.map((c, k) => (
                <div key={k} style={{ height: `${100 / puzzle.cap}%`, background: `linear-gradient(90deg, ${colour(c)[0]}cc, ${colour(c)[0]} 45%, ${colour(c)[0]}aa)`, borderTop: "1px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(0,0,0,0.5)", fontSize: 12, flex: "0 0 auto" }}>
                  {colour(c)[1]}
                </div>
              ))}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ART.vial} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill", pointerEvents: "none", filter: held === i ? "drop-shadow(0 0 6px #c8a84b)" : "drop-shadow(0 2px 3px rgba(0,0,0,0.5))" }} />
          </button>
        ))}
      </div>
      {dead && <button className="th-btn" style={{ width: "100%" }} disabled={busy} onClick={again}>START RACK AGAIN</button>}
      <div className="th-note">
        {solved ? "Sorted." : out ? "Out of time or moves. A new rack is coming." : dead ? "No pours left. The clock is still running."
          : held !== null ? "Now tap where to pour it." : `Tap a vial, then tap where to pour. A pour only lands on the same colour or an empty vial.`}
      </div>
    </div>
  );
}
