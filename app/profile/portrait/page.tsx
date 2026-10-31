"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API } from "@/lib/constants";
import type { User } from "@/lib/types";
import PortraitPicker from "@/components/portraits/PortraitPicker";

export default function PortraitPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  return (
    <main className="max-w-[1120px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <Link href="/profile" className="font-mono text-[0.72rem] text-[#6b7280] no-underline hover:text-[#e6e6e6]">&lt; Profile</Link>
      <h1 className="text-2xl tracking-[0.15em] uppercase mt-3 mb-1">Your portrait</h1>
      <p className="text-[#8a8f98] text-[0.88rem] mb-6">Pick the face people see over your head. You can change it here or in the Portrait app on your phone.</p>
      {user === undefined && <p className="text-[#777] text-[0.85rem]">Checking identity...</p>}
      {user === null && <a href={`${API}/auth/discord/login`} className="btn-login">Login with Discord</a>}
      {user && <PortraitPicker discordUrl={user.avatar_url} />}
    </main>
  );
}
