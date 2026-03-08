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

  return (
    <nav className="sticky top-0 z-10 bg-[rgba(14,14,14,0.85)] backdrop-blur-[6px] border-b border-[#1f1f1f]">
      <div className="max-w-[900px] mx-auto px-6 py-3 flex items-center gap-6">
        {/* Desktop links */}
        <div className="hidden md:flex gap-6 items-center">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={`nav-link${pathname === l.href ? " active" : ""}`}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Auth */}
        <div>
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

        {/* Hamburger — mobile only */}
        <button
          className="flex md:hidden flex-col gap-[5px] cursor-pointer p-1 bg-transparent border-none"
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
        <div className="md:hidden border-t border-[#1a1a1a] px-6 py-2 flex flex-col">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`nav-link py-3 border-b border-[#1a1a1a] text-[0.85rem]${pathname === l.href ? " active" : ""}`}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          {user?.is_admin && (
            <Link href="/admin/shop" className="nav-link py-3 text-[0.85rem] text-accent" onClick={() => setOpen(false)}>
              Admin
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
