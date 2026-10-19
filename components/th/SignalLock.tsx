"use client";
// Signal lock: tune the dial to the signal. The static fades as you get close; hold it 2 s. The line that fades in
// near the signal (`flavor`) comes from the API.
import { useEffect, useRef, useState } from "react";
import { ART } from "@/lib/th/art";
import type { GameProps, SignalP } from "@/lib/th/types";

const HOLD_MS = 2000, BAND = 0.3, PER_TURN = 2.0;

export default function SignalLock({ puzzle, busy, onSolve, error, flavor }: GameProps<SignalP> & { flavor?: string }) {
  const { min, max, target } = puzzle;
  // start the dial far from the signal (never inside it, or it would lock by itself)
  const [freq, setFreq] = useState(() => {
    const lo = min + (max - min) * 0.15, hi = max - (max - min) * 0.15;
    return Math.round((Math.abs(target - lo) >= Math.abs(target - hi) ? lo : hi) * 10) / 10;
  });
  const [held, setHeld] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ a: number } | null>(null);
  const holdStart = useRef(0);
  const sent = useRef(false);
  const freqRef = useRef(freq);
  freqRef.current = freq;

  const dist = Math.abs(Math.round(freq * 10) / 10 - target);
  const clarity = Math.max(0, Math.min(1, 1 - dist / 3));
  const inBand = dist <= BAND + 1e-9;

  useEffect(() => { if (error) { sent.current = false; holdStart.current = 0; setHeld(0); } }, [error]);

  // static noise, drawn small and scaled up (cheap on old phones)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(c.width, c.height);
    let raf = 0, last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 60) return;
      last = t;
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // hold timer: 2 s inside the band without leaving it
  useEffect(() => {
    if (!inBand || busy) { if (!sent.current) { holdStart.current = 0; setHeld(0); } return; }
    if (!holdStart.current) holdStart.current = performance.now();
    const id = setInterval(() => {
      const h = performance.now() - holdStart.current;
      setHeld(h);
      if (h >= HOLD_MS && !sent.current) {
        sent.current = true;
        clearInterval(id);
        onSolve({ freq: Math.round(freqRef.current * 10) / 10, held_ms: Math.round(h) });
      }
    }, 50);
    return () => clearInterval(id);
  }, [inBand, busy, onSolve]);

  const nudge = (d: number) => setFreq(f => Math.round(Math.min(max, Math.max(min, f + d)) * 10) / 10);

  const angleOf = (e: React.PointerEvent) => {
    const r = knobRef.current!.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };
  const down = (e: React.PointerEvent) => {
    if (busy) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not an active pointer */ }
    drag.current = { a: angleOf(e) };
  };
  const move = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const a = angleOf(e);
    let d = a - drag.current.a;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    drag.current.a = a;
    setFreq(f => Math.min(max, Math.max(min, f + (d / 360) * PER_TURN)));
  };
  const up = () => {
    drag.current = null;
    setFreq(f => Math.round(f * 10) / 10);
  };

  const rot = ((freq - min) / PER_TURN) * 360;
  const strength = Math.round(clarity * 5);
  const pct = Math.min(1, held / HOLD_MS);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "stretch" }}>
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid #2b2620", backgroundImage: `url(${ART.tuner})`, backgroundSize: "cover", backgroundPosition: "center top", padding: "14px 12px 16px" }}>
        <div style={{ position: "relative", height: 96, borderRadius: 8, overflow: "hidden", background: "#1d1408", border: "2px solid #0c0904" }}>
          <canvas ref={canvasRef} width={72} height={30} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", imageRendering: "pixelated", opacity: 0.9 - clarity * 0.88, transition: "opacity 0.2s" }} />
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(16,10,3,0.82)", borderRadius: 6, padding: "4px 14px 2px" }}>
            <div style={{ fontFamily: "'DSEG7 Classic', monospace", fontSize: 34, color: inBand ? "#9ff0b8" : "#ffbf5a", textShadow: "0 0 10px rgba(255,170,60,0.6)" }}>
              {freq.toFixed(1)}
            </div>
            <div className="th-mono" style={{ fontSize: 11, letterSpacing: "0.2em", color: "#d9b779" }}>MHz</div>
          </div>
        </div>
        <div style={{ textAlign: "center", fontStyle: "italic", color: "#e8dcc0", fontSize: 14, minHeight: 22, marginTop: 8, opacity: clarity > 0.55 ? (clarity - 0.55) / 0.45 : 0, transition: "opacity 0.25s" }}>
          {flavor ? <>&ldquo;{flavor}&rdquo;</> : null}
        </div>
        <div ref={knobRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          role="slider" aria-label="Tuning dial" aria-valuemin={min} aria-valuemax={max} aria-valuenow={Math.round(freq * 10) / 10} tabIndex={0}
          onKeyDown={e => { if (e.key === "ArrowRight" || e.key === "ArrowUp") nudge(0.1); if (e.key === "ArrowLeft" || e.key === "ArrowDown") nudge(-0.1); }}
          style={{ width: "min(62vw, 210px)", aspectRatio: "1", margin: "8px auto 0", touchAction: "none", cursor: "grab", position: "relative" }}>
          <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: -8, width: "calc(100% + 16px)", height: "calc(100% + 16px)" }}>
            <circle cx="50" cy="50" r="48" fill="none" stroke="#2a2a2a" strokeWidth="2.5" />
            <circle cx="50" cy="50" r="48" fill="none" stroke={inBand ? "#4caf7d" : "transparent"} strokeWidth="2.5"
              strokeDasharray={`${pct * 301.6} 301.6`} transform="rotate(-90 50 50)" strokeLinecap="round" />
          </svg>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ART.knob} alt="" draggable={false} style={{ width: "100%", height: "100%", transform: `rotate(${rot}deg)`, pointerEvents: "none" }} />
        </div>
      </div>
      <div className="th-row">
        <button className="th-btn ghost" disabled={busy} onClick={() => nudge(-1)}>-1.0</button>
        <button className="th-btn ghost" disabled={busy} onClick={() => nudge(-0.1)}>-0.1</button>
        <button className="th-btn ghost" disabled={busy} onClick={() => nudge(0.1)}>+0.1</button>
        <button className="th-btn ghost" disabled={busy} onClick={() => nudge(1)}>+1.0</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
        <span className="th-mono" style={{ fontSize: 12, color: "#9aa59d", letterSpacing: "0.15em" }}>SIGNAL</span>
        <span style={{ display: "inline-flex", gap: 3, alignItems: "flex-end" }}>
          {[0, 1, 2, 3, 4].map(i => <i key={i} style={{ display: "block", width: 7, height: 6 + i * 4, background: i < strength ? (inBand ? "#4caf7d" : "#c8a84b") : "#333" }} />)}
        </span>
        <span className="th-mono" style={{ fontSize: 12, color: inBand ? "#9fd3b0" : "#777", minWidth: 110 }}>
          {sent.current ? "LOCKED" : inBand ? (pct >= 1 ? "LOCKED" : `HOLD ${((HOLD_MS - held) / 1000).toFixed(1)} s`) : "searching"}
        </span>
      </div>
    </div>
  );
}
