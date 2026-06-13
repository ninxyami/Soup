"use client";
// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { fetchApi, ADMINS, fmtFull, relTime, Title, Empty, Load } from "./shared";

// ──────────────────────────────────────────────────────────────────────────
// P7.3 — Admin-channel live mirror (READ-ONLY broadcast)
//
// A web view of the "Zombita Thinking" admin channel: every message from any
// admin (and from Zombita herself) appears here, styled as a chat rather than
// a console. You cannot send from here — it purely mirrors Discord.
//
//   • opens on the newest 100 messages
//   • scroll to the top → loads the previous 100 ("load older")
//   • polls every ~2.5s for new messages and appends them live
//   • images posted in the channel render inline (durably archived server-side,
//     so the history survives Discord's URL expiry)
//
// Reads GET /api/admin/zombita/channel (?before_id / ?after_id). Cheap indexed
// paging; the poll only ever asks for messages newer than the last one it has.
// ──────────────────────────────────────────────────────────────────────────

const POLL_MS = 2500;

// Zombita's own identity in the stream (she has no discord_id row here).
const ZOMBITA = { name: "Zombita", color: "#5fbf8f", initials: "ZB" };

const whoFor = (m) => {
  if (m.is_zombita) return ZOMBITA;
  // match by display name against the known admins (rows store display_name, not id)
  const hit = Object.values(ADMINS).find(
    (a) => a.name.toLowerCase() === (m.name || "").toLowerCase()
  );
  if (hit) return hit;
  // unknown author → derive a stable-ish color from the name so it's still distinct
  const name = m.name || "—";
  const initials = name.slice(0, 2).toUpperCase();
  return { name, color: "#8a8f98", initials };
};

const dayKey = (ts) => {
  const d = new Date(ts > 1e12 ? ts : ts * 1000);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

// One message row — avatar chip + author + time + bubble (+ images).
const Msg = ({ m, prevSame }) => {
  const who = whoFor(m);
  return (
    <div style={{ display: "flex", gap: 10, padding: prevSame ? "1px 0 1px 0" : "10px 0 1px 0" }}>
      <div style={{ width: 34, flexShrink: 0 }}>
        {!prevSame && (
          <div
            title={who.name}
            style={{
              width: 34, height: 34, borderRadius: 7,
              background: `${who.color}22`, border: `1.5px solid ${who.color}66`,
              color: who.color, fontFamily: "var(--mono)", fontSize: 11, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center",
              letterSpacing: 0.5,
            }}>
            {who.initials}
          </div>
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        {!prevSame && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
            <span style={{ color: who.color, fontWeight: 700, fontSize: 13.5 }}>
              {who.name}
            </span>
            {m.is_zombita && (
              <span style={{
                fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: 1,
                textTransform: "uppercase", color: ZOMBITA.color,
                border: `1px solid ${ZOMBITA.color}55`, borderRadius: 3,
                padding: "1px 5px", fontWeight: 700,
              }}>AI</span>
            )}
            <span title={fmtFull(m.ts)} style={{ color: "var(--muted)", fontSize: 11 }}>
              {relTime(m.ts)}
            </span>
          </div>
        )}
        {m.content && (
          <div style={{
            color: "var(--text)", fontSize: 14, lineHeight: 1.5,
            whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>
            {m.content}
          </div>
        )}
        {Array.isArray(m.images) && m.images.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {m.images.map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noreferrer"
                 style={{ display: "block", lineHeight: 0 }}>
                <img
                  src={src} alt=""
                  style={{
                    maxWidth: 260, maxHeight: 220, borderRadius: 8,
                    border: "1px solid var(--border)", objectFit: "cover",
                  }}
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              </a>
            ))}
          </div>
        )}
        {Array.isArray(m.videos) && m.videos.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {m.videos.map((src, i) => (
              <video
                key={i} src={src} controls preload="metadata"
                style={{
                  maxWidth: 320, maxHeight: 240, borderRadius: 8,
                  border: "1px solid var(--border)", background: "#000",
                }}
                onError={(e) => {
                  // a video URL can expire (Discord ~24h) — fall back to a link
                  const a = document.createElement("a");
                  a.href = src; a.target = "_blank"; a.rel = "noreferrer";
                  a.textContent = "▶ video (open in Discord)";
                  a.style.cssText = "color:var(--gold,#c8a84b);font-size:13px;text-decoration:underline";
                  e.currentTarget.replaceWith(a);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default function ZombitaChannelTab() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [err, setErr] = useState(null);
  const [live, setLive] = useState(true);

  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const lastIdRef = useRef(0);          // newest id we have (for the poll)
  const firstIdRef = useRef(0);         // oldest id we have (for load-older)
  const atBottomRef = useRef(true);     // is the view pinned to the bottom?

  // initial load — newest page
  const loadInitial = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetchApi("/api/admin/zombita/channel?limit=100");
      const msgs = r.messages || [];
      setMessages(msgs);
      setHasMore(!!r.has_more);
      if (msgs.length) {
        firstIdRef.current = msgs[0].id;
        lastIdRef.current = msgs[msgs.length - 1].id;
      }
      // jump to bottom after paint
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
        atBottomRef.current = true;
      });
    } catch (e) {
      setErr(e.message || "Could not load the channel");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  // live poll — only asks for messages newer than the last one we hold
  useEffect(() => {
    if (!live) return;
    let alive = true;
    const tick = async () => {
      if (!alive || lastIdRef.current == null) return;
      try {
        const r = await fetchApi(`/api/admin/zombita/channel?after_id=${lastIdRef.current}`);
        const fresh = r.messages || [];
        if (fresh.length && alive) {
          setMessages((prev) => {
            // de-dupe defensively
            const seen = new Set(prev.map((m) => m.id));
            const add = fresh.filter((m) => !seen.has(m.id));
            return add.length ? [...prev, ...add] : prev;
          });
          lastIdRef.current = fresh[fresh.length - 1].id;
          if (atBottomRef.current) {
            requestAnimationFrame(() =>
              bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
          }
        }
      } catch { /* a dropped poll is harmless; the next one resumes */ }
    };
    const id = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [live]);

  // load older when scrolled to the top
  const onScroll = useCallback(async () => {
    const el = scrollRef.current;
    if (!el) return;
    // track whether we're pinned to the bottom (within 60px) so live append knows
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;

    if (el.scrollTop < 40 && hasMore && !loadingOlder) {
      setLoadingOlder(true);
      const keepHeight = el.scrollHeight;
      try {
        const r = await fetchApi(
          `/api/admin/zombita/channel?before_id=${firstIdRef.current}&limit=100`);
        const older = r.messages || [];
        if (older.length) {
          setMessages((prev) => [...older, ...prev]);
          firstIdRef.current = older[0].id;
          setHasMore(!!r.has_more);
          // preserve scroll position so the view doesn't jump
          requestAnimationFrame(() => {
            const added = el.scrollHeight - keepHeight;
            el.scrollTop = el.scrollTop + added;
          });
        } else {
          setHasMore(false);
        }
      } catch { /* ignore; user can scroll again to retry */ }
      finally { setLoadingOlder(false); }
    }
  }, [hasMore, loadingOlder]);

  if (loading) return <Load />;

  return (
    <div>
      <Title t="Admin Channel" s="Live mirror of the Zombita Thinking channel — read-only" />

      <div style={{
        display: "flex", alignItems: "center", gap: 12, margin: "4px 0 10px",
        fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)",
      }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: live ? "#5fbf8f" : "var(--muted)",
            boxShadow: live ? "0 0 7px #5fbf8f" : "none",
          }} />
          {live ? "LIVE" : "PAUSED"}
        </span>
        <button
          onClick={() => setLive((v) => !v)}
          style={{
            fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 0.8,
            textTransform: "uppercase", padding: "3px 9px", borderRadius: 3,
            border: "1px solid var(--border)", background: "transparent",
            color: "var(--textdim)", cursor: "pointer",
          }}>
          {live ? "Pause" : "Resume"}
        </button>
        <span style={{ flex: 1 }} />
        <span>{messages.length} shown</span>
      </div>

      {err && (
        <div style={{
          color: "#e0857d", fontSize: 13, padding: "8px 10px", marginBottom: 8,
          border: "1px solid #e0857d44", borderRadius: 6, background: "#e0857d11",
        }}>
          {err} — <button onClick={loadInitial}
            style={{ color: "#e0857d", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>
            retry
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{
          height: "calc(100vh - 230px)", minHeight: 360, overflowY: "auto",
          border: "1px solid var(--border)", borderRadius: 10,
          padding: "8px 14px", background: "var(--panel, rgba(255,255,255,0.015))",
        }}>
        {loadingOlder && (
          <div style={{ textAlign: "center", padding: 8, color: "var(--muted)", fontSize: 11, fontFamily: "var(--mono)" }}>
            loading older…
          </div>
        )}
        {!hasMore && messages.length > 0 && (
          <div style={{ textAlign: "center", padding: "6px 0 10px", color: "var(--muted)", fontSize: 10.5, fontFamily: "var(--mono)", letterSpacing: 0.5 }}>
            — start of channel —
          </div>
        )}

        {messages.length === 0 ? (
          <Empty text="No messages in the admin channel yet." />
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const sameDay = prev && dayKey(prev.ts) === dayKey(m.ts);
            const prevSame =
              prev && !prev._divider &&
              ((prev.is_zombita && m.is_zombita) ||
                (!prev.is_zombita && !m.is_zombita &&
                  (prev.name || "").toLowerCase() === (m.name || "").toLowerCase())) &&
              (m.ts - prev.ts < 300);   // group runs from the same author within 5 min
            return (
              <div key={m.id}>
                {(!prev || !sameDay) && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10, margin: "14px 0 6px",
                  }}>
                    <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                    <span style={{
                      fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 1,
                      color: "var(--muted)", textTransform: "uppercase",
                    }}>{dayKey(m.ts)}</span>
                    <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                  </div>
                )}
                <Msg m={m} prevSame={prevSame && sameDay} />
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
