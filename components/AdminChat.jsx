"use client";
// @ts-nocheck
// components/AdminChat.jsx
//
// P5.4 — the multi-admin chat thread. A live, attributed back-room thread for
// the people who run the server. Client-only (Yjs cannot SSR), loaded via
// next/dynamic({ ssr:false }) from the Thinking tab.
//
// HOW IT WORKS
//   - The thread is a Y.Array of message objects in the relay room
//     "chat:admin-main". Admin-to-admin chat needs ZERO backend — the relay
//     persists the room as an opaque Yjs doc, exactly like the workspace docs.
//   - Identity is resolved upstream (WorkspaceTab-style: /auth/me -> ADMINS) and
//     passed in as `me`, so messages read "Dawnie", "Sheo" — never "Admin-487".
//   - Live presence uses the same awareness channel as the collaborative editor.
//   - Zombita is a PARTICIPANT, not an autonomous actor: she only speaks when an
//     admin taps "Ask Zombita". The frontend sends the recent thread to
//     /api/admin/zombita/chat/reply, she replies once in her real voice, and the
//     reply is appended to the SAME shared array so everyone sees it live.
//
// Design: SOUP tokens only. Persists ~indefinitely via the relay; a light client
// prune keeps the rendered thread bounded.

import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { postApi } from "@/app/admin/tabs/shared";

const WS_BASE = "wss://api.stateofundeadpurge.site:8443/ws/workspace";
const ROOM = "chat:admin-main";

const ZOMBITA = { id: "zombita", name: "Zombita", color: "#4caf7d", initials: "ZB" };

const CSS = `
.ac-wrap{display:flex;flex-direction:column;height:calc(100vh - 230px);min-height:420px;
  border:1px solid var(--border);border-radius:4px;background:var(--surface);overflow:hidden}
.ac-head{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border)}
.ac-status{font-family:var(--mono);font-size:10px;letter-spacing:1px;text-transform:uppercase}
.ac-dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:6px}
.ac-peers{display:flex;align-items:center;gap:4px;margin-left:auto}
.ac-av{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-family:var(--mono);font-size:9px;font-weight:700;color:#0e0e0e}
.ac-scroll{flex:1;overflow-y:auto;padding:16px}
.ac-scroll::-webkit-scrollbar{width:5px}.ac-scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
.ac-msg{display:flex;gap:10px;margin-bottom:14px;align-items:flex-start}
.ac-msg-av{flex-shrink:0;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;font-family:var(--mono);font-size:10px;font-weight:700;color:#0e0e0e;margin-top:2px}
.ac-msg-body{flex:1;min-width:0}
.ac-msg-top{display:flex;align-items:baseline;gap:8px;margin-bottom:2px}
.ac-msg-name{font-family:var(--mono);font-size:12px;font-weight:600}
.ac-msg-time{font-family:var(--mono);font-size:9px;color:var(--muted)}
.ac-msg-text{font-family:var(--body);font-size:14px;color:var(--text);line-height:1.55;
  white-space:pre-wrap;word-break:break-word}
.ac-msg.zombita .ac-msg-text{color:var(--textdim)}
.ac-foot{border-top:1px solid var(--border);padding:10px 12px;display:flex;gap:8px;align-items:flex-end}
.ac-input{flex:1;background:var(--bg);border:1px solid var(--border);border-radius:4px;
  color:var(--text);font-family:var(--body);font-size:14px;padding:9px 12px;resize:none;
  outline:none;max-height:120px;line-height:1.5}
.ac-input:focus{border-color:var(--accent)}
.ac-btn{background:transparent;border:1px solid var(--border);color:var(--textdim);
  font-family:var(--mono);font-size:11px;letter-spacing:1px;text-transform:uppercase;
  padding:9px 14px;border-radius:4px;cursor:pointer;transition:all .15s;white-space:nowrap}
.ac-btn:hover{color:var(--text);border-color:var(--textdim)}
.ac-btn.send{border-color:var(--accent);color:var(--accent)}
.ac-btn.send:hover{background:rgba(200,168,75,0.08)}
.ac-btn.zb{border-color:var(--green);color:var(--green)}
.ac-btn.zb:hover{background:rgba(74,124,89,0.08)}
.ac-btn:disabled{opacity:.4;cursor:default}
.ac-empty{text-align:center;color:var(--muted);font-family:var(--mono);font-size:12px;
  padding:40px 20px;line-height:1.7}
`;

const fmtTime = (ts) => {
  if (!ts) return "";
  try { return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
};

export default function AdminChat({ me, toast }) {
  const holderRef = useRef(null);
  const ydocRef = useRef(null);
  const arrRef = useRef(null);
  const providerRef = useRef(null);
  const scrollRef = useRef(null);

  const [status, setStatus] = useState("connecting");
  const [peers, setPeers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState(false);

  // ── mount the relay-backed shared thread ──
  useEffect(() => {
    if (!me) return;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    const yarr = ydoc.getArray("messages");
    arrRef.current = yarr;

    const provider = new WebsocketProvider(WS_BASE, ROOM, ydoc, { connect: true });
    providerRef.current = provider;

    provider.on("status", (e) => {
      setStatus(e.status === "connected" ? "connected" : e.status === "connecting" ? "connecting" : "offline");
    });

    provider.awareness.setLocalStateField("user", {
      name: me.name, color: me.color, id: me.id, initials: me.initials,
    });

    const refreshPeers = () => {
      const states = [...provider.awareness.getStates().entries()];
      const others = states
        .filter(([clientId]) => clientId !== provider.awareness.clientID)
        .map(([, s]) => s.user).filter(Boolean);
      const seen = new Set();
      const uniq = [];
      for (const u of others) {
        const key = u.id || u.name;
        if (seen.has(key)) continue;
        seen.add(key); uniq.push(u);
      }
      setPeers(uniq);
    };
    provider.awareness.on("change", refreshPeers);
    refreshPeers();

    const syncMessages = () => setMessages(yarr.toArray());
    yarr.observe(syncMessages);
    syncMessages();

    return () => {
      try { yarr.unobserve(syncMessages); } catch {}
      try { provider.awareness.off("change", refreshPeers); } catch {}
      try { provider.destroy(); } catch {}
      try { ydoc.destroy(); } catch {}
      arrRef.current = null;
      providerRef.current = null;
      ydocRef.current = null;
    };
  }, [me]);

  // ── autoscroll on new messages ──
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const pushMessage = useCallback((msg) => {
    const arr = arrRef.current;
    if (!arr) return;
    arr.push([msg]);
  }, []);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text || !me) return;
    pushMessage({
      id: `${me.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      author_id: me.id,
      author_name: me.name,
      author_color: me.color,
      author_initials: me.initials,
      text,
      ts: Date.now(),
    });
    setDraft("");
  }, [draft, me, pushMessage]);

  const askZombita = useCallback(async () => {
    const arr = arrRef.current;
    if (!arr || asking) return;
    const thread = arr.toArray();
    if (thread.length === 0) {
      toast?.("Nothing for Zombita to read yet", "info");
      return;
    }
    setAsking(true);
    try {
      const res = await postApi("/api/admin/zombita/chat/reply", { messages: thread });
      const reply = (res.reply || "").trim();
      if (reply) {
        pushMessage({
          id: `zombita-${Date.now()}`,
          author_id: ZOMBITA.id,
          author_name: ZOMBITA.name,
          author_color: ZOMBITA.color,
          author_initials: ZOMBITA.initials,
          text: reply,
          ts: Date.now(),
          is_zombita: true,
        });
      }
    } catch (e) {
      toast?.(e.message || "Zombita couldn't reply", "error");
    }
    setAsking(false);
  }, [asking, pushMessage, toast]);

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const dotColor = status === "connected" ? "var(--green)" : status === "connecting" ? "var(--orange)" : "var(--red)";

  return (
    <div className="ac-wrap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="ac-head">
        <span className="ac-status" style={{ color: dotColor }}>
          <span className="ac-dot" style={{ background: dotColor }} />
          {status}
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", letterSpacing: 1 }}>
          admin back-room · persists
        </span>
        <div className="ac-peers">
          {peers.map((p) => (
            <span key={p.id || p.name} className="ac-av" title={p.name}
                  style={{ background: p.color || "var(--accent)" }}>
              {p.initials || (p.name || "?").slice(0, 2).toUpperCase()}
            </span>
          ))}
        </div>
      </div>

      <div className="ac-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="ac-empty">
            no messages yet — this is the admins' private thread.{"\n"}
            chat here, then tap "Ask Zombita" to bring her in.
          </div>
        ) : messages.map((m) => (
          <div key={m.id} className={`ac-msg${m.is_zombita ? " zombita" : ""}`}>
            <span className="ac-msg-av" style={{ background: m.author_color || "var(--accent)" }}>
              {m.author_initials || (m.author_name || "?").slice(0, 2).toUpperCase()}
            </span>
            <div className="ac-msg-body">
              <div className="ac-msg-top">
                <span className="ac-msg-name" style={{ color: m.author_color || "var(--text)" }}>
                  {m.author_name}{m.is_zombita ? " 🧟" : ""}
                </span>
                <span className="ac-msg-time">{fmtTime(m.ts)}</span>
              </div>
              <div className="ac-msg-text">{m.text}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="ac-foot">
        <textarea
          className="ac-input"
          rows={1}
          placeholder="Message the team…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button className="ac-btn zb" onClick={askZombita} disabled={asking}>
          {asking ? "⏳ thinking" : "🧟 Ask Zombita"}
        </button>
        <button className="ac-btn send" onClick={send} disabled={!draft.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
