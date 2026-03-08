"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS, API } from "@/lib/constants";

interface Me {
  username: string;
  avatar_url: string;
  is_admin?: boolean;
}

export default function Nav() {
  const pathname = usePathname();
  const [user, setUser] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => me && setUser(me))
      .catch(() => {});
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <nav className="sticky top-0 z-10 bg-[rgba(14,14,14,0.92)] backdrop-blur-[6px] border-b border-[#1f1f1f]">
      <div className="max-w-[900px] mx-auto px-4 py-3 flex items-center gap-4">
        {/* Site name — mobile only */}
        <Link href="/" className="md:hidden font-mono text-[0.7rem] tracking-[0.2em] uppercase text-[#555] no-underline hover:text-[#e6e6e6] transition-colors mr-auto">
          S.O.U.P
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex gap-5 items-center flex-wrap">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={`nav-link${pathname === l.href ? " active" : ""}`}>
              {l.label}
            </Link>
          ))}
          {/* FIX: Admin link shown on desktop for admin users */}
          {user?.is_admin && (
            <Link href="/admin" className={`nav-link text-[#c8a84b] hover:text-[#e6c86a]${pathname?.startsWith("/admin") ? " active" : ""}`}>
              Admin
            </Link>
          )}
        </div>

        <div className="hidden md:block flex-1" />

        {/* Auth — desktop */}
        <div className="hidden md:block">
          {user ? (
            <Link href="/profile" className="nav-link no-underline flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={user.avatar_url} alt={user.username} width={22} height={22} className="rounded-full opacity-90" />
              <span className="max-w-[100px] truncate">{user.username}</span>
            </Link>
          ) : (
            <a href={`${API}/auth/discord/login`} className="nav-link no-underline">Login</a>
          )}
        </div>

        {/* Hamburger — mobile */}
        <button
          className="flex md:hidden flex-col gap-[5px] cursor-pointer p-2 bg-transparent border-none ml-2"
          aria-label="Menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`block w-[22px] h-px bg-[#9a9a9a] transition-all duration-200 ${open ? "translate-y-[6px] rotate-45" : ""}`} />
          <span className={`block w-[22px] h-px bg-[#9a9a9a] transition-all duration-200 ${open ? "opacity-0" : ""}`} />
          <span className={`block w-[22px] h-px bg-[#9a9a9a] transition-all duration-200 ${open ? "-translate-y-[6px] -rotate-45" : ""}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-[#1a1a1a] bg-[rgba(14,14,14,0.98)]">
          <div className="px-4 py-3 border-b border-[#1a1a1a]">
            {user ? (
              <Link href="/profile" className="flex items-center gap-3 no-underline" onClick={() => setOpen(false)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={user.avatar_url} alt={user.username} width={28} height={28} className="rounded-full opacity-90" />
                <span className="text-[0.85rem] text-[#e6e6e6]">{user.username}</span>
                <span className="ml-auto text-[0.7rem] text-[#555] font-mono">Profile →</span>
              </Link>
            ) : (
              <a href={`${API}/auth/discord/login`} className="text-[0.85rem] text-[#5865F2] no-underline">
                Login with Discord →
              </a>
            )}
          </div>
          <div className="px-4 py-2 grid grid-cols-2">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`nav-link py-3 pr-4 border-b border-[#1a1a1a] text-[0.82rem]${pathname === l.href ? " active" : ""}`}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
          </div>
          {user?.is_admin && (
            <div className="px-4 py-2 border-t border-[#1a1a1a]">
              <Link href="/admin" className="nav-link py-2 text-[0.82rem] text-[#c8a84b]" onClick={() => setOpen(false)}>
                ⚙ Admin Panel
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
