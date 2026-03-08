"use client";
import { useState, useEffect, useRef } from "react";
import { API, AVATAR_BASE, GUEST_LIMIT } from "@/lib/constants";

interface Msg { role: "user" | "zombita"; text: string; }
interface SessionMsg { role: "user" | "admin"; sender_name: string; message: string; }

export default function ZombitaWidget() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "contact">("chat");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [avatar, setAvatar] = useState(`${AVATAR_BASE}/smile_01.webp`);
  const [mood, setMood] = useState("smirk");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [hasNew, setHasNew] = useState(false);

  // Contact/session state
  const [contactMsg, setContactMsg] = useState("");
  const [contactFb, setContactFb] = useState("");
  const [contactFbColor, setContactFbColor] = useState("#4a7c59");
  const [contactSending, setContactSending] = useState(false);
  const [session, setSession] = useState<{ contact_id: string; last_msg_ts: number } | null>(null);
  const [sessionMsgs, setSessionMsgs] = useState<SessionMsg[]>([]);
  const [sessionStatus, setSessionStatus] = useState("waiting for admin reply...");
  const [sessionClosed, setSessionClosed] = useState(false);
  const [sessionInput, setSessionInput] = useState("");
  const [sessionSending, setSessionSending] = useState(false);
  const sessionPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const sessionScrollRef = useRef<HTMLDivElement>(null);

  // Load history + init auth
  useEffect(() => {
    try { const s = sessionStorage.getItem("zw_history"); if (s) setMsgs(JSON.parse(s)); } catch {}

    fetch(`${API}/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(async me => {
        if (!me) {
          setLocked(true);
          return;
        }
        setUser(me);
        // Check whitelist / guest usage
        try {
          const ws = await fetch(`${API}/whitelist/status`, { credentials: "include" });
          if (ws.ok) {
            const wd = await ws.json();
            if (!wd.whitelisted) {
              const gr = await fetch(`${API}/api/guest-usage`, { credentials: "include" });
              if (gr.ok) { const gd = await gr.json(); if (gd.remaining <= 0) setLocked(true); else setRemaining(gd.remaining); }
            }
          }
        } catch {}

        // Check for existing contact session
        try {
          const sr = await fetch(`${API}/api/contact/session/status`, { credentials: "include" });
          if (sr.ok) {
            const sd = await sr.json();
            if (sd.has_session) {
              const sess = { contact_id: sd.contact_id, last_msg_ts: 0 };
              setSession(sess);
              setSessionStatus(sd.status === "open" ? "session active" : "session closed");
              if (sd.status === "closed") setSessionClosed(true);

              const mr = await fetch(`${API}/api/contact/${sd.contact_id}/messages?since=0`, { credentials: "include" });
              if (mr.ok) {
                const md = await mr.json();
                setSessionMsgs(md.messages || []);
                const maxTs = Math.max(0, ...(md.messages || []).map((m: any) => m.sent_at || 0));
                sess.last_msg_ts = maxTs;
                setSession({ ...sess });
              }

              if (sd.status === "open") startPoll(sess);
            }
          }
        } catch {}
      }).catch(() => setLocked(true));

    setTimeout(() => setHasNew(true), 2000);
  }, []);

  useEffect(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; }, [msgs, open]);
  useEffect(() => { if (sessionScrollRef.current) sessionScrollRef.current.scrollTop = sessionScrollRef.current.scrollHeight; }, [sessionMsgs, open, tab]);

  function startPoll(sess: { contact_id: string; last_msg_ts: number }) {
    if (sessionPollRef.current) clearInterval(sessionPollRef.current);
    sessionPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/contact/${sess.contact_id}/messages?since=${sess.last_msg_ts}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "closed") {
          clearInterval(sessionPollRef.current!); sessionPollRef.current = null;
          setSessionClosed(true); setSessionStatus("session closed");
          return;
        }
        const newMsgs = (data.messages || []).filter((m: any) => m.role === "admin" && m.sent_at > sess.last_msg_ts);
        if (newMsgs.length) {
          setSessionMsgs(prev => [...prev, ...newMsgs]);
          const maxTs = Math.max(sess.last_msg_ts, ...newMsgs.map((m: any) => m.sent_at));
          sess.last_msg_ts = maxTs;
          setSession({ ...sess });
          setSessionStatus("admin replied");
          if (!open) setHasNew(true);
        }
      } catch {}
    }, 5000);
  }

  const sendChat = async () => {
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
        const d = await res.json().catch(()=>({}));
        const updated = [...next, { role: "zombita" as const, text: d.message || "come back later." }];
        setMsgs(updated); sessionStorage.setItem("zw_history", JSON.stringify(updated)); setLocked(true); return;
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
    } finally { setLoading(false); }
  };

  const sendContact = async () => {
    if (!user) { setContactFbColor("#c0392b"); setContactFb("you need to log in to contact admins."); return; }
    if (!contactMsg.trim()) return;
    setContactSending(true); setContactFbColor("#4a7c59"); setContactFb("sending...");
    try {
      const res = await fetch(`${API}/api/contact`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: user.username, message: contactMsg.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setContactMsg("");
        const sess = { contact_id: data.contact_id, last_msg_ts: 0 };
        setSession(sess);
        setSessionMsgs([{ role: "user", sender_name: user.username, message: contactMsg.trim() }]);
        setSessionStatus("waiting for admin reply...");
        setContactFb("");
        startPoll(sess);
      } else { setContactFbColor("#c0392b"); setContactFb("failed to send. try again."); }
    } catch { setContactFbColor("#c0392b"); setContactFb("connection error."); }
    finally { setContactSending(false); }
  };

  const sendSessionMsg = async () => {
    const text = sessionInput.trim();
    if (!text || !session || sessionClosed) return;
    setSessionSending(true); setSessionInput("");
    setSessionMsgs(prev => [...prev, { role: "user", sender_name: user?.username || "you", message: text }]);
    try {
      await fetch(`${API}/api/contact/${session.contact_id}/message`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: user?.username || "Survivor", message: text }),
      });
    } catch {}
    finally { setSessionSending(false); }
  };

  return (
    <>
      {!open && hasNew && (
        <div className="fixed bottom-[3.2rem] right-[1.4rem] w-[14px] h-[14px] rounded-full bg-[#4a7c59] z-[9999] flex items-center justify-center text-[0.55rem] text-white pointer-events-none">●</div>
      )}

      <button onClick={() => { setOpen(v=>!v); setHasNew(false); }}
        className="fixed bottom-6 right-6 w-[52px] h-[52px] rounded-full bg-[#111] border border-[#2a2a2a] z-[9998] flex items-center justify-center overflow-hidden hover:border-[#4a7c59] hover:scale-105 transition-all cursor-pointer p-0"
        aria-label="Chat with Zombita">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatar} alt="Zombita" className="w-full h-full object-cover" />
      </button>

      <div className={`fixed bottom-20 right-6 w-[340px] max-h-[520px] bg-[#0e0e0e] border border-[#222] rounded z-[9997] flex flex-col transition-all duration-200 origin-bottom-right ${open?"opacity-100 scale-100 pointer-events-auto":"opacity-0 scale-[0.97] translate-y-3 pointer-events-none"}`}>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1a1a1a] flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatar} alt="Zombita" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          <div className="flex-1">
            <div className="text-[0.82rem] text-[#e6e6e6] tracking-[0.06em]">ZOMBITA</div>
            <div className="text-[0.68rem] text-[#555] font-mono">{user ? `logged in as ${user.username}` : "not logged in"} · {mood}</div>
          </div>
          <button onClick={() => setOpen(false)} className="text-[#555] hover:text-[#e6e6e6] text-xl leading-none bg-transparent border-none cursor-pointer px-1">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1a1a1a] flex-shrink-0">
          {(["chat","contact"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 bg-transparent border-none text-[0.72rem] tracking-[0.1em] uppercase py-2 cursor-pointer font-[inherit] border-b-2 transition-all ${tab===t?"text-[#e6e6e6] border-[#4a7c59]":"text-[#555] border-transparent hover:text-[#e6e6e6]"}`}>
              {t === "chat" ? "Chat" : "Contact Admins"}
            </button>
          ))}
        </div>

        {/* Chat tab */}
        {tab === "chat" && <>
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0" style={{scrollbarWidth:"thin",scrollbarColor:"#2a2a2a transparent"}}>
            {msgs.length === 0 && <p className="text-center text-[#555] text-[0.78rem] font-mono italic mt-6">say something.</p>}
            {msgs.map((m,i) => (
              <div key={i} className={`flex flex-col max-w-[88%] ${m.role==="user"?"self-end":"self-start"}`}>
                {m.role==="zombita" && <span className="font-mono text-[0.62rem] text-[#4a7c59] tracking-[0.1em] uppercase mb-1 ml-1">ZOMBITA</span>}
                <div className={`px-3 py-2 text-[0.83rem] leading-relaxed ${m.role==="user"?"bg-[#1a1a1a] border border-[#2a2a2a] text-[#c8c8c8]":"bg-[#111] border border-[#222] border-l-2 border-l-[#4a7c59] text-[#e0e0e0]"}`}>{m.text}</div>
              </div>
            ))}
            {loading && <div className="self-start px-3 py-2 bg-[#111] border border-[#222] border-l-2 border-l-[#4a7c59] flex gap-1 items-center">
              <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-[#555]"/>
              <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-[#555]"/>
              <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-[#555]"/>
            </div>}
          </div>

          {remaining !== null && remaining < GUEST_LIMIT && (
            <div className="px-3 py-2 border-t border-[#1a1a1a] flex-shrink-0">
              <div className="h-px bg-[#1a1a1a] w-full mb-1 relative">
                <div className="h-full bg-[#4a7c59] absolute top-0 left-0" style={{width:`${(remaining/GUEST_LIMIT)*100}%`}}/>
              </div>
              <span className="text-[0.65rem] text-[#555] font-mono">{remaining} message{remaining!==1?"s":""} remaining</span>
            </div>
          )}

          {!locked ? (
            <div className="flex gap-2 px-3 py-3 border-t border-[#1a1a1a] flex-shrink-0">
              <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat();}}}
                placeholder="say something..." className="flex-1 bg-[#111] border border-[#222] text-[#e6e6e6] text-[0.83rem] px-3 py-2 outline-none focus:border-[#4a7c59] font-mono placeholder:text-[#444] transition-colors"/>
              <button onClick={sendChat} disabled={loading||!input.trim()}
                className="px-3 py-2 bg-transparent border border-[#4a7c59] text-[#4a7c59] text-[0.75rem] font-mono uppercase hover:bg-[#4a7c59] hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer">→</button>
            </div>
          ) : (
            <div className="px-3 py-3 border-t border-[#1a1a1a] text-center flex-shrink-0">
              {!user ? (
                <a href={`${API}/auth/discord/login`} className="font-mono text-[0.75rem] text-[#4a7c59] no-underline hover:underline">login to chat with Zombita →</a>
              ) : (
                <p className="text-[#555] font-mono text-[0.72rem] italic">come back later.</p>
              )}
            </div>
          )}
        </>}

        {/* Contact tab */}
        {tab === "contact" && <div className="flex flex-col flex-1 min-h-0">
          {!session ? (
            /* Contact form */
            <div className="flex flex-col gap-3 p-3 flex-1">
              <p className="text-[0.78rem] text-[#666] m-0 leading-relaxed">send a message directly to the admins. zombita will deliver it.</p>
              {!user && <p className="text-[0.72rem] text-[#c0392b]">you must be logged in. <a href={`${API}/auth/discord/login`} className="text-[#4a7c59] no-underline hover:underline">login with discord →</a></p>}
              {user && <p className="text-[0.75rem] text-[#4a7c59] m-0">sending as {user.username}</p>}
              <textarea value={contactMsg} onChange={e=>setContactMsg(e.target.value)} placeholder="your message..." maxLength={1000} rows={4}
                className="bg-[#111] border border-[#1a1a1a] text-[#e6e6e6] text-[0.82rem] px-3 py-2 font-mono placeholder:text-[#444] outline-none focus:border-[#333] resize-none transition-colors"
                style={{fontFamily:"inherit"}}/>
              <button onClick={sendContact} disabled={contactSending||!user||!contactMsg.trim()}
                className="self-start px-4 py-2 bg-transparent border border-[#333] text-[#9a9a9a] font-mono text-[0.72rem] uppercase tracking-widest hover:border-[#4a7c59] hover:text-[#4a7c59] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer">
                Send to Admins
              </button>
              {contactFb && <span className="text-[0.72rem]" style={{color:contactFbColor}}>{contactFb}</span>}
            </div>
          ) : (
            /* Session view */
            <>
              <div className="px-3 py-2 border-b border-[#1a1a1a] flex items-center justify-between flex-shrink-0">
                <span className="font-mono text-[0.65rem] text-[#444]">session {session.contact_id}</span>
                <span className="font-mono text-[0.65rem] text-[#4a7c59]">{sessionStatus}</span>
              </div>
              <div ref={sessionScrollRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0" style={{scrollbarWidth:"thin",scrollbarColor:"#2a2a2a transparent"}}>
                {sessionMsgs.map((m,i) => (
                  <div key={i} className={`flex flex-col max-w-[88%] ${m.role==="user"?"self-end":"self-start"}`}>
                    <span className={`font-mono text-[0.62rem] tracking-[0.1em] uppercase mb-1 ${m.role==="admin"?"text-[#5865F2] ml-1":"text-[#444]"}`}>{m.sender_name}</span>
                    <div className={`px-3 py-2 text-[0.83rem] leading-relaxed ${m.role==="user"?"bg-[#1a1a1a] border border-[#2a2a2a] text-[#c8c8c8]":"bg-[#111] border border-[#222] border-l-2 border-l-[#5865F2] text-[#e0e0e0]"}`}>{m.message}</div>
                  </div>
                ))}
                {sessionClosed && <p className="text-center text-[#555] text-[0.72rem] italic font-mono">session closed by admin.</p>}
              </div>
              {!sessionClosed && (
                <div className="flex gap-2 px-3 py-3 border-t border-[#1a1a1a] flex-shrink-0">
                  <input value={sessionInput} onChange={e=>setSessionInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendSessionMsg();}}}
                    placeholder="reply to admin..." maxLength={1000}
                    className="flex-1 bg-[#111] border border-[#222] text-[#e6e6e6] text-[0.83rem] px-3 py-2 outline-none focus:border-[#5865F2] font-mono placeholder:text-[#444] transition-colors"/>
                  <button onClick={sendSessionMsg} disabled={sessionSending||!sessionInput.trim()}
                    className="px-3 py-2 bg-transparent border border-[#5865F2] text-[#5865F2] text-[0.75rem] font-mono uppercase hover:bg-[#5865F2] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer">→</button>
                </div>
              )}
            </>
          )}
        </div>}
      </div>
    </>
  );
}
