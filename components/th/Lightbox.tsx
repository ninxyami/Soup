"use client";
// Location pictures live only on the real phone (Nin 10-19: the in-game phone shows none), so every picture is big
// and can be opened full screen. The overlay is drawn inside the phone screen (also in the desktop frame).
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ART, POLAROID_ASPECT, POLAROID_BACK, POLAROID_HOLE } from "@/lib/th/art";

export function Lightbox({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => { setHost(document.querySelector(".th-screen")); }, []);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, onClose]);
  if (!open || !host) return null;
  return createPortal(
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "calc(8px + env(safe-area-inset-top)) 10px 8px" }}>
        <button className="th-btn ghost" style={{ minHeight: 44 }} onClick={onClose}>Close</button>
      </div>
      <div onClick={e => e.stopPropagation()} style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 8px 16px" }}>
        {children}
      </div>
    </div>,
    host,
  );
}

// A picture inside the lightbox: tap it to zoom in twice as big (then drag/scroll around), tap again to fit
export function ZoomImage({ src, alt }: { src: string; alt: string }) {
  const [zoom, setZoom] = useState(false);
  return (
    <div style={{ width: "100%", height: "100%", overflow: "auto", display: "flex", alignItems: zoom ? "flex-start" : "center", justifyContent: zoom ? "flex-start" : "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} onClick={() => setZoom(z => !z)}
        style={zoom ? { width: "200%", maxWidth: "none", flexShrink: 0, cursor: "zoom-out" } : { maxWidth: "100%", maxHeight: "100%", objectFit: "contain", cursor: "zoom-in" }} />
    </div>
  );
}

export function EnlargeHint({ text = "Tap to enlarge" }: { text?: string }) {
  return (
    <span className="th-mono" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#d9cfa8", letterSpacing: "0.08em" }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M21 21l-5-5M11 8v6M8 11h6" /></svg>
      {text}
    </span>
  );
}

// A location picture in the polaroid frame, as big as the screen allows; a tap opens it full screen
export function PolaroidPhoto({ img, alt, tilt = 0 }: { img: string; alt: string; tilt?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={`${alt}. Tap to enlarge`}
        style={{ position: "relative", width: "min(100%, 420px)", aspectRatio: POLAROID_ASPECT, padding: 0, border: 0, background: "transparent", cursor: "zoom-in", transform: tilt ? `rotate(${tilt}deg)` : undefined }}>
        <div style={{ position: "absolute", left: `${POLAROID_BACK.left}%`, top: `${POLAROID_BACK.top}%`, width: `${POLAROID_BACK.width}%`, height: `${POLAROID_BACK.height}%`, background: "#17130e" }} />
        <div style={{ position: "absolute", left: `${POLAROID_HOLE.left}%`, top: `${POLAROID_HOLE.top}%`, width: `${POLAROID_HOLE.width}%`, height: `${POLAROID_HOLE.height}%`, backgroundImage: `url("${img}")`, backgroundSize: "cover", backgroundColor: "#151515" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ART.polaroid} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
        <span style={{ position: "absolute", left: 0, right: 0, top: `${POLAROID_HOLE.top + POLAROID_HOLE.height + 3}%`, textAlign: "center" }}>
          <span style={{ background: "rgba(20,16,10,0.85)", borderRadius: 999, padding: "5px 12px" }}><EnlargeHint /></span>
        </span>
      </button>
      <Lightbox open={open} onClose={() => setOpen(false)}><ZoomImage src={img} alt={alt} /></Lightbox>
    </>
  );
}
