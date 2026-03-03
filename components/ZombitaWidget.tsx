"use client";
import { useState, useEffect, useRef } from "react";
import { API, AVATAR_BASE, GUEST_LIMIT } from "@/lib/constants";

interface Msg { role: "user" | "zombita"; text: string; }

export default function ZombitaWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [avatar, setAvatar] = useState(`${AVATAR_BASE}/smile_01.webp`);
  const [mood, setMood] = useState("smirk");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("zw_history");
      if (saved) setMsgs(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading || locked) return;
    setInput("");
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
        sessionStorage.setItem("zw_history", JSON.stringify(updated));
        setLocked(true);
        return;
      }

      const data = await res.json();
      if (data.mood) setMood(data.mood);
      if (data.image) setAvatar(`${AVATAR_BASE}/${data.image}`);
      const updated = [...next, { role: "zombita" as const, text: data.text || "..." }];
      setMsgs(updated);
      sessionStorage.setItem("zw_history", JSON.stringify(updated.slice(-40)));
      if (typeof data.remaining === "number") setRemaining(data.remaining);
    } catch {
      setMsgs([...next, { role: "zombita", text: "lost connection." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Notification dot */}
      {!open && msgs.length > 0 && (
        <div className="fixed bottom-[3.2rem] right-[1.4rem] w-[14px] h-[14px] rounded-full bg-[#4a7c59] z-[9999] flex items-center justify-center text-[0.55rem] text-white pointer-events-none">
          ●
        </div>
      )}

      {/* Bubble button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 w-[52px] h-[52px] rounded-full bg-[#111] border border-[#2a2a2a] z-[9998] flex items-center justify-center overflow-hidden hover:border-[#4a7c59] hover:scale-105 transition-all cursor-pointer p-0"
        aria-label="Chat with Zombita"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatar} alt="Zombita" className="w-full h-full object-cover" />
      </button>

      {/* Panel */}
      <div className={`fixed bottom-20 right-6 w-[340px] max-h-[520px] bg-[#0e0e0e] border border-[#222] rounded z-[9997] flex flex-col transition-all duration-200 origin-bottom-right ${open ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-[0.97] translate-y-3 pointer-events-none"}`}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1a1a1a] flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatar} alt="Zombita" className="w-8 h-8 rounded-full object-cover flex-shrink-0 animate-breathe" />
          <div className="flex-1">
            <div className="text-[0.82rem] text-[#e6e6e6] tracking-[0.06em]">ZOMBITA</div>
            <div className="text-[0.68rem] text-[#555] font-mono tracking-[0.04em]">{mood}</div>
          </div>
          <button onClick={() => setOpen(false)} className="text-[#555] hover:text-[#e6e6e6] text-xl leading-none bg-transparent border-none cursor-pointer px-1">×</button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0" style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}>
          {msgs.length === 0 && (
            <p className="text-center text-[#555] text-[0.78rem] font-mono italic mt-6">say something.</p>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`flex flex-col max-w-[88%] ${m.role === "user" ? "self-end" : "self-start"}`}>
              <div className={`px-3 py-2 text-[0.83rem] leading-relaxed ${m.role === "user" ? "bg-[#1a1a1a] text-[#e6e6e6] border border-[#2a2a2a]" : "bg-[#111] text-[#c8cdd6] border border-[#1a1a1a]"}`}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="self-start px-3 py-2 bg-[#111] border border-[#1a1a1a] flex gap-1 items-center">
              <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-[#555]" />
              <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-[#555]" />
              <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-[#555]" />
            </div>
          )}
        </div>

        {/* Guest bar */}
        {remaining !== null && remaining < GUEST_LIMIT && (
          <div className="px-3 py-2 border-t border-[#1a1a1a] flex-shrink-0">
            <div className="h-px bg-[#1a1a1a] w-full mb-1 relative">
              <div className="h-full bg-[#4a7c59] absolute top-0 left-0 transition-all" style={{ width: `${(remaining / GUEST_LIMIT) * 100}%` }} />
            </div>
            <span className="text-[0.65rem] text-[#555] font-mono">{remaining} message{remaining !== 1 ? "s" : ""} remaining</span>
          </div>
        )}

        {/* Input */}
        {!locked ? (
          <div className="flex gap-2 px-3 py-3 border-t border-[#1a1a1a] flex-shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="say something..."
              className="flex-1 bg-[#111] border border-[#222] text-[#e6e6e6] text-[0.83rem] px-3 py-2 outline-none focus:border-[#4a7c59] font-mono placeholder:text-[#444] transition-colors"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="px-3 py-2 bg-transparent border border-[#4a7c59] text-[#4a7c59] text-[0.75rem] font-mono uppercase hover:bg-[#4a7c59] hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              →
            </button>
          </div>
        ) : (
          <div className="px-3 py-3 border-t border-[#1a1a1a] text-center text-[0.75rem] text-[#555] font-mono italic flex-shrink-0">
            come back later.
          </div>
        )}
      </div>
    </>
  );
}
