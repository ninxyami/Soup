"use client";
import { useEffect, useRef, useState } from "react";
import { API, AVATAR_BASE, GUEST_LIMIT } from "@/lib/constants";

interface Msg { role: "user" | "zombita"; text: string; }

export default function ZombitaPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [avatar, setAvatar] = useState(`${AVATAR_BASE}/smile_01.webp`);
  const [mood, setMood] = useState("smirk");
  const [subtitle, setSubtitle] = useState("survivor");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Load history
    try {
      const saved = sessionStorage.getItem("zw_page_history");
      if (saved) setMsgs(JSON.parse(saved));
    } catch {}

    // Check auth
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then(async (me) => {
        if (me) {
          setIsAuthed(true);
          setSubtitle(`logged in as ${me.username}`);
          // Check whitelist for usage limit
          try {
            const ws = await fetch(`${API}/whitelist/status`, { credentials: "include" });
            if (ws.ok) {
              const wd = await ws.json();
              if (!wd.whitelisted) {
                const gr = await fetch(`${API}/api/guest-usage`, { credentials: "include" });
                if (gr.ok) {
                  const gd = await gr.json();
                  if (gd.remaining <= 0) { setLocked(true); }
                  else setRemaining(gd.remaining);
                }
              }
            }
          } catch {}
        } else {
          setLocked(true);
          setSubtitle("login required");
        }
      })
      .catch(() => { setLocked(true); });
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading || locked) return;
    setInput("");
    if (inputRef.current) { inputRef.current.style.height = "auto"; }
    setLoading(true);
    const next: Msg[] = [...msgs, { role: "user", text }];
    setMsgs(next);

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (res.status === 429) {
        const d = await res.json().catch(() => ({}));
        const updated = [...next, { role: "zombita" as const, text: d.message || "come back later." }];
        setMsgs(updated);
        sessionStorage.setItem("zw_page_history", JSON.stringify(updated));
        setLocked(true);
        return;
      }

      const data = await res.json();
      if (data.mood) setMood(data.mood);
      if (data.image) setAvatar(`${AVATAR_BASE}/${data.image}`);
      const updated = [...next, { role: "zombita" as const, text: data.text || "..." }];
      setMsgs(updated);
      sessionStorage.setItem("zw_page_history", JSON.stringify(updated.slice(-40)));
      if (!isAuthed && typeof data.remaining === "number") setRemaining(data.remaining);
    } catch {
      setMsgs([...next, { role: "zombita", text: "lost connection. try again." }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="flex-1 grid max-w-[1100px] mx-auto w-full px-6 py-12 gap-0 items-start" style={{ gridTemplateColumns: "420px 1fr" }}>

        {/* Avatar panel */}
        <div className="sticky top-20 flex flex-col items-center gap-0 select-none">
          <div className="relative w-[360px] h-[360px]">
            <div className="absolute inset-0 flex items-center justify-center animate-breathe">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatar}
                alt="Zombita"
                className="w-full h-full object-contain transition-all duration-500"
                style={{ filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.6))" }}
              />
            </div>
          </div>

          {/* Name tag */}
          <div className="text-center mt-2">
            <div className="font-display text-5xl tracking-[0.15em] text-[#e6e6e6]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              ZOMBITA
            </div>
            <div className="font-mono text-[0.78rem] text-[#555] tracking-[0.1em] mt-1">{subtitle}</div>
            <div className="font-mono text-[0.72rem] text-[#3a3a3a] tracking-[0.06em] mt-1 italic">{mood}</div>
          </div>
        </div>

        {/* Chat panel */}
        <div className="flex flex-col" style={{ height: "calc(100vh - 160px)", minHeight: 500 }}>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto flex flex-col gap-4 pr-2 pb-4" style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}>
            {msgs.length === 0 && !locked && (
              <div className="text-center py-16">
                <p className="text-[#3a3a3a] font-mono text-[0.85rem] italic">she&apos;s listening.</p>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} className={`flex flex-col max-w-[80%] ${m.role === "user" ? "self-end" : "self-start"}`}>
                {m.role === "zombita" && (
                  <span className="font-mono text-[0.65rem] text-[#444] tracking-[0.08em] mb-1 ml-1">ZOMBITA</span>
                )}
                <div className={`px-4 py-3 text-[0.9rem] leading-relaxed ${
                  m.role === "user"
                    ? "bg-[#141414] border border-[#2a2a2a] text-[#e6e6e6]"
                    : "bg-transparent border border-[#1a1a1a] text-[#c8cdd6]"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="self-start px-4 py-3 border border-[#1a1a1a] flex gap-2 items-center">
                <span className="thinking-dot w-2 h-2 rounded-full bg-[#444]" />
                <span className="thinking-dot w-2 h-2 rounded-full bg-[#444]" />
                <span className="thinking-dot w-2 h-2 rounded-full bg-[#444]" />
              </div>
            )}
          </div>

          {/* Guest limit bar */}
          {remaining !== null && remaining < GUEST_LIMIT && (
            <div className="py-2 mb-2">
              <div className="h-px bg-[#1a1a1a] w-full relative mb-1">
                <div className="h-full bg-[#4a7c59] absolute top-0 left-0 transition-all" style={{ width: `${(remaining / GUEST_LIMIT) * 100}%` }} />
              </div>
              <span className="text-[0.7rem] text-[#555] font-mono">{remaining} message{remaining !== 1 ? "s" : ""} remaining — <a href={`${API}/auth/discord/login`} className="text-[#4a7c59] no-underline hover:underline">login</a> for full access</span>
            </div>
          )}

          {/* Locked overlay */}
          {locked && (
            <div className="py-8 text-center border border-[#1a1a1a] mb-2">
              <p className="text-[#555] font-mono text-[0.85rem] mb-4">
                {isAuthed ? "you've used your free messages." : "you need to log in to talk to Zombita."}
              </p>
              {!isAuthed && (
                <a href={`${API}/auth/discord/login`} className="font-mono text-[0.78rem] px-5 py-2 border border-[#4a7c59] text-[#4a7c59] no-underline hover:bg-[#4a7c59] hover:text-black transition-all">
                  Login with Discord
                </a>
              )}
              {isAuthed && (
                <a href="/whitelist" className="font-mono text-[0.78rem] px-5 py-2 border border-[#4a7c59] text-[#4a7c59] no-underline hover:bg-[#4a7c59] hover:text-black transition-all">
                  apply to whitelist →
                </a>
              )}
            </div>
          )}

          {/* Input */}
          {!locked && (
            <div className="flex gap-3 items-end border-t border-[#1a1a1a] pt-4">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={1}
                placeholder="say something..."
                className="flex-1 bg-transparent border border-[#1a1a1a] text-[#e6e6e6] text-[0.9rem] px-4 py-3 outline-none focus:border-[#4a7c59] font-mono placeholder:text-[#333] transition-colors resize-none overflow-hidden"
                style={{ fontFamily: "inherit" }}
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="px-5 py-3 border border-[#4a7c59] text-[#4a7c59] font-mono text-[0.8rem] uppercase tracking-widest hover:bg-[#4a7c59] hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer bg-transparent flex-shrink-0"
              >
                →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
