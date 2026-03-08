"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { API } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";

interface Notif {
  id: number;
  actor_name: string;
  type: "like" | "reply" | "repost";
  post_id: string;
  read: boolean;
  created_at: number;
}

const ICONS: Record<string, string> = { like: "🩸", reply: "💬", repost: "🔁" };
const LABELS: Record<string, string> = {
  like:   "liked your post",
  reply:  "replied to your post",
  repost: "reposted you",
};

export default function NotificationBell({ discordId }: { discordId: number }) {
  const [notifs, setNotifs]   = useState<Notif[]>([]);
  const [unread, setUnread]   = useState(0);
  const [open, setOpen]       = useState(false);
  const ref                   = useRef<HTMLDivElement>(null);

  const fetchNotifs = async () => {
    try {
      const res = await fetch(`${API}/api/feed/notifications`, { credentials: "include" });
      if (!res.ok) return;
      const d = await res.json();
      setNotifs(d.notifications || []);
      setUnread(d.unread || 0);
    } catch {}
  };

  // Poll every 15s
  useEffect(() => {
    fetchNotifs();
    const iv = setInterval(fetchNotifs, 15000);
    return () => clearInterval(iv);
  }, [discordId]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openPanel = async () => {
    setOpen(v => !v);
    if (!open && unread > 0) {
      await fetch(`${API}/api/feed/notifications/read`, { method: "POST", credentials: "include" });
      setUnread(0);
      setNotifs(ns => ns.map(n => ({ ...n, read: true })));
    }
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={openPanel}
        className="relative flex items-center justify-center w-7 h-7 bg-transparent border-none cursor-pointer text-[#555] hover:text-[#e6e6e6] transition-colors">
        <span className="text-base">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-[#e05555] rounded-full flex items-center justify-center font-mono text-[0.55rem] text-white px-0.5 leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 w-[300px] sm:w-[340px] bg-[#0d1117] border border-[#1e2530] shadow-2xl z-50 max-h-[420px] overflow-y-auto">
          <div className="px-3 py-2 border-b border-[#111] flex items-center justify-between">
            <span className="font-mono text-[0.65rem] uppercase tracking-widest text-[#444]">Notifications</span>
            <Link href="/feed" className="font-mono text-[0.62rem] text-[#4a7c59] no-underline hover:underline" onClick={() => setOpen(false)}>
              go to feed →
            </Link>
          </div>

          {notifs.length === 0 ? (
            <div className="py-8 text-center">
              <p className="font-mono text-[0.72rem] text-[#2a2a2a] italic">no notifications yet</p>
            </div>
          ) : (
            notifs.map(n => (
              <Link key={n.id} href="/feed"
                onClick={() => setOpen(false)}
                className={`flex items-start gap-3 px-3 py-3 border-b border-[#0f0f0f] no-underline transition-colors hover:bg-[#111] ${n.read ? "" : "bg-[rgba(74,124,89,0.04)]"}`}>
                <span className="text-sm mt-0.5 flex-shrink-0">{ICONS[n.type] || "🔔"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[0.78rem] text-[#c8cdd6] leading-snug">
                    <span className="font-mono text-[#e6e6e6]">{n.actor_name}</span>
                    {" "}<span className="text-[#666]">{LABELS[n.type]}</span>
                  </p>
                  <p className="font-mono text-[0.62rem] text-[#333] mt-0.5">{timeAgo(n.created_at)}</p>
                </div>
                {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#4a7c59] flex-shrink-0 mt-1.5" />}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
