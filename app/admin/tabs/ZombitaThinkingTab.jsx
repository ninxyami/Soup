"use client";
// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { fetchApi, postApi, relTime, fmtDate, fmtFull, Title, SC, TW, B, Empty, Load } from "./shared";

// ──────────────────────────────────────────────────────────────────────────
// P5.3 — "Zombita's Thinking" surface (READ-ONLY)
//
// Renders the nightly thinking entries Sonnet writes (zombita_thinking, via
// GET /api/admin/zombita/thinking). Calm "no change needed" nights are shown
// quietly; nights where she flagged something stand out. Admins can ACKNOWLEDGE
// an entry they've read — that's the only write, and it touches nothing on the
// server. Also shows her current living memory doc + version history (read-only).
//
// NOTE: built before launch — until the pipeline is switched on and a few real
// summaries accumulate, this will correctly show "no thinking entries yet".
// ──────────────────────────────────────────────────────────────────────────

const parseStructured = (s) => {
  if (!s) return {};
  if (typeof s === "object") return s;
  try { return JSON.parse(s); } catch { return {}; }
};

// ── A single thinking entry card ──────────────────────────────────────────
const ThinkingCard = ({ entry, onAck, busy }) => {
  const st = parseStructured(entry.structured);
  const calm = !!entry.no_change;
  // Per-admin acknowledgment: "have *I* seen this", not the old global flag.
  const acked = entry.acked_by_me != null ? !!entry.acked_by_me : !!entry.acknowledged;

  const headline = (st.headline || "").trim();
  const take = (st.take || "").trim();
  const suggestions = (st.suggestions || "").trim();
  // Prefer the structured observations. Only fall back to the rendered text body
  // when observations is missing — and strip the "My take:"/"Suggestions:" tails
  // from that fallback so they don't duplicate the dedicated sections below.
  let body = (st.observations || "").trim();
  if (!body) {
    body = (entry.thinking_text || "")
      .split(/\n\nMy take:|\n\nSuggestions:/)[0]
      .trim();
  }

  const accentColor = calm ? "var(--green)" : "var(--accent)";

  return (
    <div style={{
      background: calm ? "rgba(74,124,89,0.04)" : "rgba(200,168,75,0.05)",
      border: `1px solid ${calm ? "rgba(74,124,89,0.15)" : "rgba(200,168,75,0.16)"}`,
      borderLeft: `3px solid ${accentColor}`,
      borderRadius: 3,
      padding: "16px 20px",
      marginBottom: 14,
      opacity: acked ? 0.55 : 1,
      transition: "opacity .2s",
    }}>
      {/* Header row: date + status chip + ack */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--display)", fontSize: 20, letterSpacing: 2, color: "var(--text)" }}>
          {fmtDate(entry.thinking_date)}
        </span>
        <span style={{
          fontFamily: "var(--mono)", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase",
          padding: "2px 8px", borderRadius: 2,
          border: `1px solid ${accentColor}33`, background: `${accentColor}11`, color: accentColor,
        }}>
          {calm ? "all quiet" : "flagged"}
        </span>
        {acked && (
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: 1, color: "var(--muted)", textTransform: "uppercase" }}>
            ✓ acknowledged
          </span>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>
          {entry.created_at ? relTime(entry.created_at) : ""}
        </span>
      </div>

      {/* Headline */}
      {headline && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--text)", marginBottom: 8, fontWeight: 500 }}>
          {headline}
        </div>
      )}

      {/* Observations / body */}
      {body && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
          {body}
        </div>
      )}

      {/* Her Take — her own opinion, set apart from the neutral observations.
          Only renders when she actually formed one (conditional in the prompt). */}
      {take && (
        <div style={{
          marginTop: 14, padding: "12px 16px",
          background: "rgba(200,168,75,0.07)", borderRadius: 3,
          borderLeft: "3px solid var(--accent)",
        }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: 2, color: "var(--accent)", textTransform: "uppercase", marginBottom: 6 }}>
            ✦ Her Take
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--text)", lineHeight: 1.8, whiteSpace: "pre-wrap", fontStyle: "italic" }}>
            {take}
          </div>
        </div>
      )}

      {/* Suggestions (only when she flagged something) */}
      {suggestions && (
        <div style={{
          marginTop: 12, padding: "10px 14px",
          background: "rgba(200,168,75,0.06)", borderRadius: 2,
          borderLeft: "2px solid var(--accent)",
        }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: 2, color: "var(--accent)", textTransform: "uppercase", marginBottom: 5 }}>
            Suggestions
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {suggestions}
          </div>
        </div>
      )}

      {/* Footer: window read + ack toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--muted)" }}>
          {entry.summaries_read != null ? `${entry.summaries_read} summaries` : ""}
          {entry.window_start && entry.window_end
            ? ` · ${fmtDate(entry.window_start)} → ${fmtDate(entry.window_end)}`
            : ""}
          {entry.model ? ` · ${entry.model}` : ""}
        </span>
        <div style={{ flex: 1 }} />
        <B c={acked ? "ghost" : "blue"} sm disabled={busy}
           onClick={() => onAck(entry.thinking_date, !acked)}>
          {acked ? "Un-acknowledge" : "✓ Acknowledge"}
        </B>
      </div>
    </div>
  );
};

// ── Living memory doc panel (read-only, collapsible) ──────────────────────
const MemoryPanel = ({ toast }) => {
  const [doc, setDoc]         = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewVer, setViewVer] = useState(null); // version object being viewed, or null = current

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [d, v] = await Promise.all([
          fetchApi("/api/admin/zombita/memory"),
          fetchApi("/api/admin/zombita/memory/versions?limit=20"),
        ]);
        setDoc(d.memory || null);
        setVersions(v.versions || []);
      } catch (e) {
        toast(e.message, "error");
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Load />;
  if (!doc) return <Empty text="no memory document yet — builds after launch" />;

  const shown = viewVer || doc;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>
          Version {shown.version} · {shown.source || "consolidate"} ·{" "}
          {shown.created_at ? fmtFull(shown.created_at) : ""}
          {shown.notes_folded != null ? ` · ${shown.notes_folded} notes folded` : ""}
        </span>
        <div style={{ flex: 1 }} />
        {viewVer && (
          <B c="ghost" sm onClick={() => setViewVer(null)}>← Back to current</B>
        )}
      </div>

      <div style={{
        background: "rgba(151,117,204,0.04)", border: "1px solid rgba(151,117,204,0.14)",
        borderLeft: "3px solid var(--purple)", borderRadius: 3, padding: "16px 20px",
        fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", lineHeight: 1.85,
        whiteSpace: "pre-wrap", marginBottom: 18,
      }}>
        {shown.doc_text}
      </div>

      {versions.length > 1 && (
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: 2, color: "var(--muted)", textTransform: "uppercase", marginBottom: 8 }}>
            Version history
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {versions.map(v => (
              <button key={v.version} className="ap-pre"
                onClick={() => setViewVer(v.version === doc.version ? null : v)}
                style={{
                  borderColor: (viewVer ? viewVer.version : doc.version) === v.version ? "var(--purple)" : undefined,
                  color: (viewVer ? viewVer.version : doc.version) === v.version ? "var(--purple)" : undefined,
                }}>
                v{v.version} · {fmtDate(v.created_at)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main tab ──────────────────────────────────────────────────────────────
export default function ZombitaThinkingTab({ toast }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ackBusy, setAckBusy] = useState(false);
  const [unacked, setUnacked] = useState(0);
  // sub-view of the thinking section: "nightly" (un-acked by me) | "acked" (my archive)
  const [thinkView, setThinkView] = useState("nightly");
  const [view, setView]       = useState("thinking"); // "thinking" | "memory"

  const isAcked = (e) => (e.acked_by_me != null ? !!e.acked_by_me : !!e.acknowledged);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchApi("/api/admin/zombita/thinking?limit=30");
      setEntries(data.thinking || []);
      if (typeof data.unacked_count === "number") setUnacked(data.unacked_count);
    } catch (e) {
      toast(e.message, "error");
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const ack = async (thinking_date, acknowledged) => {
    setAckBusy(true);
    try {
      const res = await postApi("/api/admin/zombita/thinking/ack", { thinking_date, acknowledged });
      // per-admin: update acked_by_me for ME only (others unaffected server-side)
      setEntries(prev => prev.map(e =>
        e.thinking_date === thinking_date ? { ...e, acked_by_me: acknowledged } : e));
      if (res && typeof res.unacked_count === "number") setUnacked(res.unacked_count);
      else setUnacked(u => Math.max(0, u + (acknowledged ? -1 : 1)));
    } catch (e) { toast(e.message, "error"); }
    setAckBusy(false);
  };

  // oldest un-acked entry age (days) → escalates the badge: older = louder
  const oldestUnackedDays = (() => {
    const un = entries.filter(e => !isAcked(e));
    if (un.length === 0) return 0;
    const now = Date.now() / 1000;
    let oldest = 0;
    for (const e of un) {
      const ts = Number(e.created_at) || 0;
      if (ts) { const d = (now - ts) / 86400; if (d > oldest) oldest = d; }
    }
    return oldest;
  })();
  const badgeHot = oldestUnackedDays >= 2;

  const visible = thinkView === "acked"
    ? entries.filter(e => isAcked(e))
    : entries.filter(e => !isAcked(e));
  const flaggedOpen = entries.filter(e => !e.no_change && !isAcked(e)).length;
  const calmCount   = entries.filter(e => e.no_change).length;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes zm-badgepulse { 0%,100% { opacity: 1 } 50% { opacity: .5 } }
      ` }} />
      <Title t="ZOMBITA'S THINKING" s="her nightly read on the community · read-only · season 1: new dawn" />

      <div className="ap-sr">
        <SC label="Entries" value={entries.length} />
        <SC label="Open Flags" value={flaggedOpen} color={flaggedOpen > 0 ? "orange" : ""} />
        <SC label="Quiet Nights" value={calmCount} color="green" />
      </div>

      {/* View toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <B c={view === "thinking" ? "gold" : "ghost"} sm onClick={() => setView("thinking")}>
          🧠 Nightly Thinking
          {unacked > 0 && (
            <span style={{
              marginLeft: 7, minWidth: 17, height: 17, padding: "0 5px", borderRadius: 9,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--mono)", fontSize: 10, fontWeight: 800, lineHeight: 1,
              color: "#0b0d10",
              background: badgeHot ? "var(--red, #e05555)" : "var(--accent)",
              boxShadow: badgeHot ? "0 0 9px rgba(224,85,85,0.6)" : "0 0 7px rgba(200,168,75,0.4)",
              animation: badgeHot ? "zm-badgepulse 1.5s ease-in-out infinite" : "none",
            }}>{unacked}</span>
          )}
        </B>
        <B c={view === "memory" ? "gold" : "ghost"} sm onClick={() => setView("memory")}>
          📖 Living Memory
        </B>
      </div>

      {view === "memory" ? (
        <TW title="WHAT ZOMBITA KNOWS" right={
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)" }}>read-only · versioned</span>
        }>
          <MemoryPanel toast={toast} />
        </TW>
      ) : (
        <TW
          title={thinkView === "acked" ? "ACKNOWLEDGED BY YOU" : "NIGHTLY ENTRIES"}
          right={
            <div style={{ display: "flex", gap: 6 }}>
              <B c={thinkView === "nightly" ? "gold" : "ghost"} sm onClick={() => setThinkView("nightly")}>
                Unread{unacked > 0 ? ` (${unacked})` : ""}
              </B>
              <B c={thinkView === "acked" ? "gold" : "ghost"} sm onClick={() => setThinkView("acked")}>
                Acknowledged
              </B>
            </div>
          }
        >
          {loading ? <Load /> : (
            visible.length === 0
              ? <Empty text={
                  thinkView === "acked"
                    ? "nothing acknowledged yet — entries you acknowledge move here"
                    : (entries.length === 0
                      ? "no thinking entries yet — she starts once the pipeline is live and summaries accumulate"
                      : "all caught up — you've acknowledged everything")} />
              : <div>{visible.map(e => (
                  <ThinkingCard key={e.thinking_date} entry={e} onAck={ack} busy={ackBusy} />
                ))}</div>
          )}
        </TW>
      )}
    </>
  );
}
