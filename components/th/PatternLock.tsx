"use client";
// Pattern lock: draw the pattern the game shows. Dots 1-9, row by row.
import { useEffect, useRef, useState } from "react";
import { patternValid } from "@/lib/th/logic";
import type { GameProps, PatternP } from "@/lib/th/types";

const SIZE = 300, PAD = 50, STEP = (SIZE - PAD * 2) / 2, HIT = 38;

function dotXY(n: number) {
  const i = n - 1;
  return [PAD + (i % 3) * STEP, PAD + Math.floor(i / 3) * STEP];
}

// The Android rule: going straight from one dot to another over an unused dot in between picks that dot up too
// (1-3 picks up 2, 1-9 picks up 5, ...). The game never makes a pattern that jumps over an unused dot.
function between(a: number, b: number) {
  const [ax, ay] = [(a - 1) % 3, Math.floor((a - 1) / 3)], [bx, by] = [(b - 1) % 3, Math.floor((b - 1) / 3)];
  if ((ax + bx) % 2 || (ay + by) % 2) return 0;
  return ((ay + by) / 2) * 3 + (ax + bx) / 2 + 1;
}

export default function PatternLock({ puzzle, busy, serverNow, onSolve, error }: GameProps<PatternP>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [path, setPath] = useState<number[]>([]);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [bad, setBad] = useState(false);
  const [, force] = useState(0);
  const waitLeft = Math.max(0, Math.ceil(puzzle.wait_until - serverNow()));

  useEffect(() => {
    if (!waitLeft) return;
    const id = setInterval(() => force(x => x + 1), 500);
    return () => clearInterval(id);
  }, [waitLeft]);

  useEffect(() => { if (error) { setBad(true); const id = setTimeout(() => { setBad(false); setPath([]); }, 900); return () => clearTimeout(id); } }, [error]);

  const locked = busy || waitLeft > 0;

  const toLocal = (e: React.PointerEvent): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * SIZE, ((e.clientY - r.top) / r.height) * SIZE];
  };
  const hitDot = (x: number, y: number) => {
    for (let n = 1; n <= 9; n++) {
      const [dx, dy] = dotXY(n);
      if (Math.hypot(dx - x, dy - y) < HIT) return n;
    }
    return 0;
  };

  const down = (e: React.PointerEvent) => {
    if (locked) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not an active pointer */ }
    const [x, y] = toLocal(e);
    const n = hitDot(x, y);
    setBad(false);
    setDrawing(true);
    setPath(n ? [n] : []);
    setCursor([x, y]);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing) return;
    const [x, y] = toLocal(e);
    setCursor([x, y]);
    const n = hitDot(x, y);
    if (!n || path.includes(n) || path.length >= 6) return;
    const last = path[path.length - 1];
    const mid = last ? between(last, n) : 0;
    const next = mid && !path.includes(mid) ? [...path, mid, n] : [...path, n];
    setPath(next.slice(0, 6));
  };
  const up = () => {
    if (!drawing) return;
    setDrawing(false);
    setCursor(null);
    const p = path.join("");
    if (patternValid(p)) onSolve({ pattern: p });
    else if (path.length) { setBad(true); setTimeout(() => { setBad(false); setPath([]); }, 700); }
  };

  const col = bad ? "#e05555" : "#9fd3b0";
  const pts = path.map(dotXY);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flex: 1, justifyContent: "center" }}>
      <svg ref={svgRef} viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" style={{ maxWidth: 330, touchAction: "none", userSelect: "none", opacity: locked ? 0.45 : 1 }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {pts.length > 0 && (
          <polyline points={[...pts, ...(cursor ? [cursor] : [])].map(p => p.join(",")).join(" ")}
            fill="none" stroke={col} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
        )}
        {Array.from({ length: 9 }, (_, i) => {
          const [x, y] = dotXY(i + 1);
          const on = path.includes(i + 1);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={30} fill="rgba(255,255,255,0.03)" stroke={on ? col : "rgba(255,255,255,0.15)"} strokeWidth={2} />
              <circle cx={x} cy={y} r={on ? 11 : 8} fill={on ? col : "#d8d4c8"} />
            </g>
          );
        })}
      </svg>
      <div className="th-note">
        {waitLeft > 0 ? `Too many wrong tries. The phone unlocks again in ${waitLeft} s.`
          : `Draw at least 4 dots in one stroke. ${puzzle.tries_left} ${puzzle.tries_left === 1 ? "try" : "tries"} left before it locks for 30 s.`}
      </div>
    </div>
  );
}
