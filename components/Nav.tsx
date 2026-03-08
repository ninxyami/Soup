"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS, API } from "@/lib/constants";
import NotificationBell from "./NotificationBell";

interface Me {
  discord_id: number;
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
      .then(r => r.ok ? r.json() : null)
      .then(me => me && setUser(me))
      .catch(() => {});
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  const allLinks = [
    ...NAV_LINKS,
    { href: "/feed", label: "Feed" },
  ];

  return (
    <nav className="sticky top-0 z-10 bg-[rgba(14,14,14,0.92)] backdrop-blur-[6px] border-b border-[#1f1f1f]">
      <div className="max-w-[960px] mx-auto px-6 py-3 flex items-center">

        {/* Desktop: nav links left */}
        <div className="hidden md:flex items-center gap-6 flex-1 flex-wrap">
          {allLinks.map(l => (
            <Link key={l.href} href={l.href} className={`nav-link${pathname === l.href ? " active" : ""}${l.href === "/feed" ? " text-[#4a7c59]" : ""}`}>
              {l.label}
            </Link>
          ))}
          {user?.is_admin && (
            <Link href="/admin" className={`nav-link${pathname?.startsWith("/admin") ? " active" : ""}`} style={{ color: "#c8a84b" }}>
              Admin
            </Link>
          )}
        </div>

        {/* Desktop: right side — bell + auth */}
        <div className="hidden md:flex items-center gap-3">
          {user && <NotificationBell discordId={user.discord_id} />}
          {user ? (
            <Link href="/profile" className="nav-link no-underline flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={user.avatar_url} alt={user.username} width={22} height={22} className="rounded-full opacity-90" />
              <span>{user.username}</span>
            </Link>
          ) : (
            <a href={`${API}/auth/discord/login`} className="nav-link no-underline">Login</a>
          )}
        </div>

        {/* Mobile: logo */}
        <Link href="/" className="md:hidden font-mono text-[0.72rem] tracking-[0.2em] uppercase text-[#555] no-underline hover:text-[#e6e6e6] transition-colors">
          S.O.U.P
        </Link>
        <div className="flex-1 md:hidden" />

        {/* Mobile: bell + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          {user && <NotificationBell discordId={user.discord_id} />}
          <button
            className="flex flex-col gap-[5px] cursor-pointer p-1 bg-transparent border-none"
            aria-label="Menu"
            onClick={() => setOpen(v => !v)}
          >
            <span className={`block w-[22px] h-px bg-[#9a9a9a] transition-all duration-200 ${open ? "translate-y-[6px] rotate-45" : ""}`} />
            <span className={`block w-[22px] h-px bg-[#9a9a9a] transition-all duration-200 ${open ? "opacity-0" : ""}`} />
            <span className={`block w-[22px] h-px bg-[#9a9a9a] transition-all duration-200 ${open ? "-translate-y-[6px] -rotate-45" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden border-t border-[#1a1a1a] bg-[rgba(10,10,10,0.98)]">
          <div className="px-5 py-3 border-b border-[#1a1a1a]">
            {user ? (
              <Link href="/profile" className="flex items-center gap-3 no-underline" onClick={() => setOpen(false)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={user.avatar_url} alt={user.username} width={26} height={26} className="rounded-full opacity-90" />
                <span className="text-[0.83rem] text-[#e6e6e6]">{user.username}</span>
                <span className="ml-auto text-[0.68rem] text-[#444] font-mono">Profile →</span>
              </Link>
            ) : (
              <a href={`${API}/auth/discord/login`} className="text-[0.83rem] text-[#5865F2] no-underline">Login with Discord →</a>
            )}
          </div>
          <div className="px-5 py-1 grid grid-cols-2">
            {allLinks.map(l => (
              <Link key={l.href} href={l.href}
                className={`nav-link py-3 pr-3 border-b border-[#181818] text-[0.8rem]${pathname === l.href ? " active" : ""}${l.href === "/feed" ? " text-[#4a7c59]" : ""}`}
                onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
          </div>
          {user?.is_admin && (
            <div className="px-5 py-3 border-t border-[#1a1a1a]">
              <Link href="/admin" className="nav-link text-[0.8rem]" style={{ color: "#c8a84b" }} onClick={() => setOpen(false)}>
                ⚙ Admin Panel
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
