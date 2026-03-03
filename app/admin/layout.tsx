"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { API, ADMIN_NAV_LINKS } from "@/lib/constants";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<"loading" | "ok" | "denied">("loading");

  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => setStatus(me?.is_admin ? "ok" : "denied"))
      .catch(() => setStatus("denied"));
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#555] font-mono text-sm tracking-widest">VERIFYING IDENTITY...</p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6">
        <div className="text-6xl">💀</div>
        <h1 className="text-5xl tracking-widest text-accent" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>ACCESS DENIED</h1>
        <p className="text-[#555] font-mono text-sm">you are not an admin.</p>
        <Link href="/" className="font-mono text-xs no-underline border border-[#2a2a2a] px-4 py-2 text-[#777] hover:text-[#e6e6e6] hover:border-[#444] transition-colors">
          ← go back
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen scanline" style={{ background: "#080a0c" }}>
      {/* Admin top bar */}
      <header className="flex items-center gap-4 px-8 py-4 border-b border-[#1e2530] bg-[#0f1318] sticky top-[49px] z-10">
        <span className="text-2xl tracking-widest text-accent" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          ZOMBITA&apos;S DEN
        </span>
        <div className="flex gap-1 ml-6">
          {ADMIN_NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href}
              className={`px-4 py-2 font-mono text-[0.72rem] tracking-[0.1em] uppercase border transition-colors no-underline ${
                pathname === l.href
                  ? "border-accent text-accent bg-[rgba(200,168,75,0.05)]"
                  : "border-transparent text-dim hover:border-[#1e2530] hover:text-[#c8cdd6]"
              }`}>
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex-1" />
        <Link href="/" className="font-mono text-[0.72rem] text-dim hover:text-[#c8cdd6] no-underline tracking-widest transition-colors">
          ← SITE
        </Link>
      </header>

      <div className="max-w-[1400px] mx-auto px-8 py-8">
        {children}
      </div>
    </div>
  );
}
