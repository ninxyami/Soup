"use client";
// Cipher wheel: turn each wheel to a letter of the code the game showed, then open.
import { useEffect, useRef, useState } from "react";
import { ART } from "@/lib/th/art";
import type { CipherP, GameProps } from "@/lib/th/types";
import { fmtClock } from "./useTimer";

const AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function Wheel({ letters, idx, setIdx, disabled }: { letters: string; idx: number; setIdx: (i: number) => void; disabled: boolean }) {
  const drag = useRef<{ y: number; moved: boolean; start: number } | null>(null);
  const L = letters.length;
  const at = (k: number) => letters[((idx + k) % L + L) % L];
  const down = (e: React.PointerEvent) => {
    if (disabled) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not an active pointer */ }
    drag.current = { y: e.clientY, moved: false, start: idx };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const steps = Math.round((d.y - e.clientY) / 34);
    if (steps) d.moved = true;
    setIdx(((d.start + steps) % L + L) % L);
  };
  const up = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    const r = e.currentTarget.getBoundingClientRect();
    setIdx((((idx + (e.clientY < r.top + r.height / 2 ? -1 : 1)) % L) + L) % L);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
      <button className="th-btn ghost" style={{ minHeight: 40, width: "100%", padding: 0 }} disabled={disabled} onClick={() => setIdx((idx - 1 + L) % L)} aria-label="previous letter">▲</button>
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; }}
        style={{
          width: "100%", height: 132, borderRadius: 10, touchAction: "none", userSelect: "none", cursor: "ns-resize",
          background: "linear-gradient(180deg,#2a2218 0%,#d9cfb4 30%,#f1ead6 50%,#d9cfb4 70%,#2a2218 100%)",
          border: "2px solid #1a140c", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          boxShadow: "inset 0 0 12px rgba(0,0,0,0.6)", color: "#1c1813", fontFamily: "'Bebas Neue', Impact, sans-serif",
        }}>
        <span style={{ fontSize: 22, opacity: 0.35, lineHeight: 1 }}>{at(-1)}</span>
        <span style={{ fontSize: 46, lineHeight: 1.05 }}>{at(0)}</span>
        <span style={{ fontSize: 22, opacity: 0.35, lineHeight: 1 }}>{at(1)}</span>
      </div>
      <button className="th-btn ghost" style={{ minHeight: 40, width: "100%", padding: 0 }} disabled={disabled} onClick={() => setIdx((idx + 1) % L)} aria-label="next letter">▼</button>
    </div>
  );
}

export default function CipherWheel({ puzzle, busy, serverNow, onSolve }: GameProps<CipherP>) {
  const letters = puzzle.letters && puzzle.letters.length > 1 ? puzzle.letters.toUpperCase() : AZ;
  const len = puzzle.len || 5;
  const [idx, setIdx] = useState<number[]>(() => Array(len).fill(0));
  const [, force] = useState(0);
  const waitLeft = Math.max(0, Math.ceil((puzzle.wait_until || 0) - serverNow()));
  const codeLeft = Math.max(0, Math.ceil((puzzle.code_until || 0) - serverNow()));

  useEffect(() => {
    if (!waitLeft && !codeLeft) return;
    const id = setInterval(() => force(x => x + 1), 500);
    return () => clearInterval(id);
  }, [waitLeft > 0, codeLeft > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const code = idx.map(i => letters[i]).join("");
  const locked = busy || waitLeft > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, borderRadius: 12, padding: "16px 12px", backgroundImage: `url(${ART.paper})`, backgroundSize: "cover" }}>
      {codeLeft > 0 && (
        <div className="th-mono" role="timer" style={{ textAlign: "center", fontSize: 20, color: "#ff8a7a", background: "rgba(20,16,10,0.9)", borderRadius: 8, padding: "6px 8px" }}>
          The code changes in {fmtClock(codeLeft)}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, background: "rgba(20,16,10,0.88)", borderRadius: 12, padding: "10px 8px", border: "2px solid #3b2f1c" }}>
        {idx.map((v, k) => <Wheel key={k} letters={letters} idx={v} disabled={locked} setIdx={i => setIdx(a => a.map((x, j) => (j === k ? i : x)))} />)}
      </div>
      <button className="th-btn big" disabled={locked} onClick={() => onSolve({ code })}
        style={{ background: "rgba(20,16,10,0.9)" }}>
        {waitLeft > 0 ? `The wheel is jammed. ${waitLeft} s` : `Open with ${code}`}
      </button>
      <div className="th-note" style={{ color: "#3d372c" }}>Swipe a wheel up or down, or tap its arrows.</div>
    </div>
  );
}
