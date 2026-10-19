"use client";
// Steps where the work happens in game: an icon, or a location picture from the API (big, tap to enlarge), and
// an optional quote above it (`text.quote`, from the API).
import { PolaroidPhoto } from "./Lightbox";

const ICONS: Record<string, string> = {
  linking: "M7 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm10 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 2.5-5 5-5s5 2 5 5M12 20c0-3 2.5-5 5-5s5 2 5 5",
  call: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  lastcall: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  code_horde: "M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6zM9 12l2 2 4-4",
  go_final: "M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13zm0-10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  finale: "M2 19c3-2 6-2 9 0s6 2 9 0M5 15c2-4 12-4 14 0zM12 12V5l4 2-4 2",
};

export default function WaitView({ step, img, ringing, quote }: { step: string; img?: string; ringing?: boolean; quote?: { text: string; by?: string } }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "8px 0" }}>
      {quote && (
        <figure style={{ margin: 0, maxWidth: 290, textAlign: "center" }}>
          <blockquote style={{ margin: 0, fontStyle: "italic", fontSize: 16, color: "#efe4c6", lineHeight: 1.4 }}>&ldquo;{quote.text}&rdquo;</blockquote>
          {quote.by && <figcaption className="th-note" style={{ marginTop: 4 }}>{quote.by}</figcaption>}
        </figure>
      )}
      {img ? (
        <PolaroidPhoto img={img} alt="Picture" tilt={1.2} />
      ) : (
        <svg width="92" height="92" viewBox="0 0 24 24" fill="none" stroke="#9fd3b0" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
          style={{ opacity: 0.85, animation: ringing ? "th-shake 0.5s linear infinite" : undefined }} aria-hidden>
          <path d={ICONS[step] ?? ICONS.code_horde} />
        </svg>
      )}
      <div className="th-note" style={{ maxWidth: 280 }}>This page updates by itself when the game moves on. Keep it open.</div>
    </div>
  );
}
