"use client";
// A hint card under the next step: the words and an optional picture both come from the API (`text.hint`).
// The picture opens full screen on a tap, like every location picture.
import { useState } from "react";
import { Lightbox, ZoomImage } from "./Lightbox";

export default function HintCard({ text, img }: { text: string; img?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", border: "1px solid #2c4434", background: "rgba(10,18,14,0.85)", borderRadius: 10, padding: 10 }}>
      {img && (
        <button onClick={() => setOpen(true)} aria-label="Hint picture. Tap to enlarge"
          style={{ flex: "0 0 42%", aspectRatio: "16 / 9", borderRadius: 6, overflow: "hidden", border: "1px solid #24302a", padding: 0, background: "#0b0d0c", cursor: "zoom-in" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </button>
      )}
      <div>
        <div className="th-mono" style={{ fontSize: 10, letterSpacing: "0.2em", color: "#9fd3b0", marginBottom: 4 }}>HINT</div>
        <div style={{ fontSize: 14.5, color: "#e8efe9", lineHeight: 1.4 }}>{text}</div>
      </div>
      {img && <Lightbox open={open} onClose={() => setOpen(false)}><ZoomImage src={img} alt="Hint picture" /></Lightbox>}
    </div>
  );
}
