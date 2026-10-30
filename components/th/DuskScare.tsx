"use client";
// Queen Dusk looks in: about a second of her face with a shriek, then her line, then the game exactly as it was.
// The game decides when, once a hunt (`scare_at` from the API), and every page of the team that's open shows it.
// This is a layer over the page: it never touches a puzzle, a timer or a step under it. To change the picture or the
// sound, replace the two files named in ART (lib/th/art.ts).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ART } from "@/lib/th/art";
import type { Me } from "@/lib/th/types";

const FACE_MS = 1100, LINE_MS = 1500;
const LATE_S = 20; // a page opened later than this after it happened doesn't play it
const LINE = "I see you.";

function seen(key: string, value?: string) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch { /* private mode: the check below still stops a repeat on this page */ }
  return null;
}

// Browsers only give sound after a tap, so the first tap anywhere gets it ready. No tap yet: no sound, the rest still runs.
function useShriek() {
  const ctx = useRef<AudioContext | null>(null);
  const buffer = useRef<AudioBuffer | null>(null);
  useEffect(() => {
    const ready = () => {
      if (ctx.current) { ctx.current.resume().catch(() => {}); return; }
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const c = new AC();
      ctx.current = c;
      c.resume().catch(() => {});
      fetch(ART.duskSound).then(r => r.arrayBuffer()).then(a => c.decodeAudioData(a)).then(b => { buffer.current = b; }).catch(() => {});
    };
    window.addEventListener("pointerdown", ready, true);
    window.addEventListener("keydown", ready, true);
    return () => {
      window.removeEventListener("pointerdown", ready, true);
      window.removeEventListener("keydown", ready, true);
    };
  }, []);
  return () => {
    const c = ctx.current, b = buffer.current;
    if (!c || !b) return;
    try {
      c.resume().catch(() => {});
      const s = c.createBufferSource();
      s.buffer = b;
      s.connect(c.destination);
      s.start();
    } catch { /* the picture still shows */ }
  };
}

export function useDuskScare(me: Me | null, tok: string | null, ready: boolean): ReactNode {
  const [phase, setPhase] = useState<"" | "face" | "line">("");
  const played = useRef(0);
  const shriek = useShriek();
  const at = me?.scare_at ?? 0;

  useEffect(() => { new Image().src = ART.dusk; }, []);

  useEffect(() => {
    if (!at || !tok || !ready || played.current === at) return;
    played.current = at;
    const key = `th_scare_${tok}`;
    if (seen(key) === String(at)) return;
    seen(key, String(at));
    if ((me?.now ?? Date.now() / 1000) - at > LATE_S) return;
    setPhase("face");
    shriek();
    try { navigator.vibrate?.([220, 60, 320]); } catch { /* not on this phone */ }
    const a = setTimeout(() => setPhase("line"), FACE_MS);
    const b = setTimeout(() => setPhase(""), FACE_MS + LINE_MS);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [at, tok, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!phase) return null;
  return createPortal(
    <div className="th-dusk" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ART.dusk} alt="" draggable={false} />
      {phase === "line" && <div className="th-dusk-line">{LINE}</div>}
    </div>,
    document.body,
  );
}
