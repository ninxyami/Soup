"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Pop-up notice (2026-09-24): Discord is blocked for many players in the Philippines. Shows once a day a moment
// after the page opens; closing it (X, "Maybe later", a click outside, Esc) hides it for a day. Not on the guide
// itself. Remove it from app/layout.tsx once it's over.
const KEY = "soup_discord_popup_closed";
const HIDE_MS = 24 * 3600 * 1000;

export default function DiscordPopup() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (pathname?.startsWith("/discord-help")) return;
    let closedAt = 0;
    try { closedAt = Number(localStorage.getItem(KEY) || 0); } catch { /* private window: just show it */ }
    if (Date.now() - closedAt < HIDE_MS) return;
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70" onClick={close} role="dialog" aria-modal="true" aria-labelledby="discord-popup-title">
      <div className="relative w-full max-w-[420px] border border-[#8a3a2b] bg-[#140d0c] rounded-lg p-6 shadow-2xl text-center" onClick={e => e.stopPropagation()}>
        <button onClick={close} aria-label="Close" className="absolute top-2 right-3 text-[#aa8a80] hover:text-white text-2xl leading-none">&times;</button>
        <div className="text-4xl mb-2">📵</div>
        <p className="text-[0.7rem] tracking-[0.2em] uppercase text-[#ff9b7a] mb-1">Heads up</p>
        <h2 id="discord-popup-title" className="text-xl text-white mb-3">Can&apos;t open Discord?</h2>
        <p className="text-[0.88rem] text-[#e6c9bf] leading-relaxed mb-5">
          Discord is blocked on some internet providers in the Philippines right now. Our whitelist and logins go through
          Discord - but there&apos;s a <b className="text-white">2-minute fix</b>, and a VPN option if that doesn&apos;t work.
        </p>
        <Link href="/discord-help" onClick={close}
          className="block w-full bg-[#E5623F] hover:bg-[#F27D5C] text-white font-bold rounded py-2.5 mb-2 transition-colors">
          Show me the fix &rarr;
        </Link>
        <button onClick={close} className="w-full text-[0.8rem] text-[#aa8a80] hover:text-white py-1">Maybe later</button>
        <p className="text-[0.7rem] text-[#6f5a54] mt-3">Guide by Four Eyes [ARC] 💚</p>
      </div>
    </div>
  );
}
