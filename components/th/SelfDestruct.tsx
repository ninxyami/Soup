"use client";
// The end: the screen cracks, glitches and wipes itself, then the phone stays dead for this token.
import { useEffect, useState } from "react";
import { ART } from "@/lib/th/art";

export function SelfDestruct({ onDone }: { onDone: () => void }) {
  const [glitch, setGlitch] = useState(false);
  useEffect(() => {
    navigator.vibrate?.([60, 40, 120]);
    const a = setTimeout(() => setGlitch(true), 450);
    const b = setTimeout(onDone, 3300);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [onDone]);
  return (
    <>
      <div className="th-crack" style={{ backgroundImage: `url(${ART.crack})` }} />
      {glitch && (
        <div className="th-glitch" aria-hidden>
          {[8, 22, 37, 51, 64, 79, 90].map((top, i) => (
            <i key={top} style={{ top: `${top}%`, height: `${3 + (i % 3) * 4}%`, animationDelay: `${i * 0.04}s` }} />
          ))}
        </div>
      )}
      <div className="th-wipe" />
    </>
  );
}

export interface EndText { title?: string; text?: string; prize?: string }

// The end screen. Its words come from the API (`text.end`) and are kept on this device after the wipe.
export function DeadScreen({ end }: { end: EndText | null }) {
  return (
    <div className="th-full" style={{ background: "#000" }}>
      <div className="th-dead-crack" style={{ backgroundImage: `url(${ART.crack})` }} />
      <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#5a5a5a" strokeWidth="1.5" aria-hidden>
        <rect x="6" y="2" width="12" height="20" rx="2" /><path d="M9 7l3 4-2 2 4 4" /><path d="M10 19h4" />
      </svg>
      <h1 style={{ color: "#8a8a8a" }}>{end?.title || "Disconnected"}</h1>
      {end?.text && <p style={{ color: "#6f6f6f" }}>{end.text}</p>}
      {end?.prize && <p style={{ color: "#a99a6a" }}>{end.prize}</p>}
    </div>
  );
}
