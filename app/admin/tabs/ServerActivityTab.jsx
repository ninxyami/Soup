"use client";
// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { API, B, Title } from "./shared";

const WS_URL = API.replace(/^https/, "wss").replace(/^http/, "ws");
const MAX_EVENTS = 300;

// ── Event translator ──────────────────────────────────────────────────────────
// Takes a raw PZ log line, returns a simplified event object or null (silent drop)

function translateLine(raw) {
  const line = raw.toLowerCase();
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const ev = (category, icon, color, message, badge) =>
    ({ category, icon, color, message, badge: badge || null, time, raw, id: Math.random() });

  // ── PLAYERS ──────────────────────────────────────────────────────────────
  // "playerconnected: username=Nikki steamid=..."
  if (line.includes("playerconnected")) {
    const m = raw.match(/username=([^,\s]+)/i);
    const name = m ? m[1] : "A player";
    return ev("players", "🟢", "#4caf7d", `${name} joined the server`, "JOINED");
  }
  // "playerdisconnected: username=..."
  if (line.includes("playerdisconnected")) {
    const m = raw.match(/username=([^,\s]+)/i);
    const name = m ? m[1] : "A player";
    return ev("players", "🔴", "#e05555", `${name} left the server`, "LEFT");
  }
  if (line.includes("kicked")) {
    const m = raw.match(/player[:\s]+([^\s,]+)/i) || raw.match(/kicked[:\s]+([^\s,]+)/i);
    const name = m ? m[1] : "A player";
    return ev("players", "🦵", "#d4873a", `${name} was kicked`, "KICKED");
  }
  if (line.includes("banned")) {
    const m = raw.match(/player[:\s]+([^\s,]+)/i);
    const name = m ? m[1] : "A player";
    return ev("players", "🚫", "#e05555", `${name} was banned`, "BANNED");
  }

  // ── SERVER LIFECYCLE ──────────────────────────────────────────────────────
  if (line.includes("*** server started ***")) {
    return ev("server", "🖥️", "#4caf7d", "Server started successfully", "ONLINE");
  }
  if (line.includes("*** server stopped ***") || line.includes("server stopped")) {
    return ev("server", "🛑", "#e05555", "Server stopped", "OFFLINE");
  }
  if (line.includes("rcon: listening on port")) {
    const port = raw.match(/port\s+(\d+)/i);
    return ev("server", "⚡", "#4a8fc4", `RCON ready${port ? " on port " + port[1] : ""}`, "RCON");
  }
  if (line.includes("steam is enabled")) {
    return ev("server", "🔗", "#4a8fc4", "Steam connection established", "STEAM");
  }
  if (line.includes("luanet: initialization [done]")) {
    return ev("server", "📜", "#9775cc", "Lua scripting engine initialised", "LUA");
  }
  if (line.includes("initialising raknet")) {
    return ev("server", "🌐", "#4a8fc4", "Network engine starting up", "NETWORK");
  }

  // ── MODS ─────────────────────────────────────────────────────────────────
  if (line.includes("mod loaded") || line.includes("loaded mod")) {
    const m = raw.match(/(?:mod loaded|loaded mod)[:\s]+([^\n]+)/i);
    const name = m ? m[1].trim().substring(0, 60) : null;
    return ev("mods", "🧩", "#b07dff", name ? `Mod loaded: ${name}` : "A mod was loaded successfully", "MOD");
  }
  if (line.includes("mod failed") || (line.includes("mod") && line.includes("error"))) {
    const m = raw.match(/mod[:\s]+([^\s,\n]+)/i);
    const name = m ? m[1] : null;
    return ev("mods", "❌", "#e05555", name ? `Mod failed: ${name} — check PZ Console for details` : "A mod failed to load — check PZ Console for details", "MOD ERROR");
  }
  if (line.includes("items loaded") || line.includes("recipes loaded")) {
    const m = raw.match(/(\d+)\s+(?:items|recipes)/i);
    const count = m ? m[1] : null;
    const type = line.includes("recipes") ? "recipes" : "items";
    return ev("mods", "📦", "#9775cc", count ? `${count} ${type} loaded from mods` : `Mod ${type} loaded`, "CONTENT");
  }
  if (line.includes("workshop") && line.includes("steamitemid")) {
    return ev("mods", "🔄", "#9775cc", "Workshop mod files synced from Steam", "WORKSHOP");
  }

  // ── WORLD ─────────────────────────────────────────────────────────────────
  if (line.includes("saving") && (line.includes("world") || line.includes("chunk"))) {
    return ev("world", "💾", "#4caf7d", "World is saving...", "SAVING");
  }
  if (line.includes("world saved") || (line.includes("save") && line.includes("complete"))) {
    return ev("world", "💾", "#4caf7d", "World saved successfully", "SAVED");
  }
  if (line.includes("map loaded") || line.includes("world loaded")) {
    return ev("world", "🗺️", "#4a8fc4", "Map loaded", "MAP");
  }

  // ── WEATHER / EVENTS ─────────────────────────────────────────────────────
  if (line.includes("startrain") || (line.includes("rain") && line.includes("start"))) {
    return ev("world", "🌧️", "#4a8fc4", "Rain started", "WEATHER");
  }
  if (line.includes("stoprain") || (line.includes("rain") && line.includes("stop"))) {
    return ev("world", "☀️", "#c8a84b", "Rain stopped", "WEATHER");
  }
  if (line.includes("startstorm") || line.includes("storm start")) {
    return ev("world", "⛈️", "#9775cc", "Storm started", "WEATHER");
  }
  if (line.includes("stopstorm") || line.includes("storm stop")) {
    return ev("world", "🌤️", "#4caf7d", "Storm cleared", "WEATHER");
  }
  if (line.includes("chopper")) {
    return ev("world", "🚁", "#d4873a", "Helicopter event triggered", "EVENT");
  }
  if (line.includes("gunshot")) {
    return ev("world", "💥", "#d4873a", "Gunshot event triggered", "EVENT");
  }

  // ── RCON ─────────────────────────────────────────────────────────────────
  if (line.includes("rcon:") && line.includes("command")) {
    const m = raw.match(/command[:\s]+([^\n]+)/i);
    const cmd = m ? m[1].trim() : null;
    return ev("rcon", "⚡", "#4a8fc4", cmd ? `Admin command: ${cmd}` : "Admin sent an RCON command", "RCON");
  }
  if (line.includes("rcon: password doesn't match")) {
    return ev("rcon", "🔐", "#e05555", "Someone tried an RCON command with the wrong password", "AUTH FAIL");
  }

  // ── ERRORS ────────────────────────────────────────────────────────────────
  if (line.includes("exception") || line.includes("crash") || line.includes("fatal")) {
    return ev("errors", "💥", "#e05555", "A serious server error occurred — check PZ Console → Errors tab for details", "CRASH");
  }
  // Drop minor/noisy known errors silently (non-critical PZ startup noise)
  if (line.includes("s_api fail") || line.includes("animaleventpacket") || line.includes("animalpacket") || line.includes("packetsetting")) {
    return null; // known harmless startup noise — don't show to non-technical users
  }
  if (line.includes("error:")) {
    // Try to extract a short readable part
    const afterError = raw.split(/error:/i)[1]?.trim().substring(0, 100);
    return ev("errors", "🔴", "#e05555", afterError ? `Server error: ${afterError}` : "A server error occurred — check PZ Console for details", "ERROR");
  }
  if (line.includes("warn")) {
    return ev("warnings", "⚠️", "#c8a84b", "Server warning — check PZ Console → Warnings tab for details", "WARNING");
  }

  // ── NETWORK ───────────────────────────────────────────────────────────────
  if (line.includes("connected to steam") || line.includes("steam connection")) {
    return ev("network", "🔗", "#4a8fc4", "Connected to Steam servers", "STEAM");
  }
  if (line.includes("disconnect") && line.includes("steam")) {
    return ev("network", "⚠️", "#c8a84b", "Steam connection issue detected", "STEAM");
  }

  // Everything else — silently drop (non-technical users don't need it)
  return null;
}

// ── Category filter tabs ──────────────────────────────────────────────────────
const CATEGORIES = [
  { key: "all",      label: "📋 All"      },
  { key: "players",  label: "👥 Players"  },
  { key: "server",   label: "🖥️ Server"   },
  { key: "mods",     label: "🧩 Mods"     },
  { key: "world",    label: "🌍 World"    },
  { key: "rcon",     label: "⚡ RCON"     },
  { key: "errors",   label: "🔴 Errors"   },
  { key: "warnings", label: "⚠️ Warnings" },
  { key: "network",  label: "🌐 Network"  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function ServerActivityTab() {
  const [events, setEvents]         = useState([]);
  const [status, setStatus]         = useState("disconnected");
  const [activeTab, setActiveTab]   = useState("all");
  const [autoScroll, setAutoScroll] = useState(true);

  const wsRef        = useRef(null);
  const feedRef      = useRef(null);
  const reconnectRef = useRef(null);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  }, []);

  // ── WebSocket — reuses the same pz-console endpoint ───────────────────────
  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) return;
    setStatus("connecting");
    const ws = new WebSocket(`${WS_URL}/ws/admin/pz-console`);
    wsRef.current = ws;

    ws.onopen = () => { setStatus("connected"); clearTimeout(reconnectRef.current); };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (!msg.line || msg.source === "system") return;
        const event = translateLine(msg.line);
        if (!event) return; // silently drop untranslatable lines
        setEvents(prev => {
          const next = [...prev, event];
          return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
        });
      } catch {}
    };

    ws.onerror = () => setStatus("error");
    ws.onclose = () => {
      setStatus("disconnected");
      reconnectRef.current = setTimeout(connect, 3000);
    };
  }, []);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectRef.current);
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
    setStatus("disconnected");
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectRef.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
    };
  }, [connect]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const visible = activeTab === "all" ? events : events.filter(e => e.category === activeTab);

  // ── Status ────────────────────────────────────────────────────────────────
  const statusColor = {
    connected:    "var(--green)",
    connecting:   "var(--accent)",
    disconnected: "var(--muted)",
    error:        "var(--red)",
  }[status] || "var(--muted)";

  const switchTab = (key) => {
    setActiveTab(key);
    setTimeout(() => {
      if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }, 20);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <Title t="📋 Server Activity" s="Plain English overview of everything happening on the server" />

      {/* ── Status bar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: statusColor, letterSpacing: 1 }}>
          <span style={{
            display: "inline-block", width: 7, height: 7, borderRadius: "50%",
            background: statusColor, marginRight: 5, verticalAlign: "middle",
            boxShadow: status === "connected" ? `0 0 6px ${statusColor}` : "none",
          }} />
          {status === "connected" ? "LIVE" : status === "connecting" ? "CONNECTING..." : status === "error" ? "ERROR" : "OFFLINE"}
        </span>
        {status === "connected"
          ? <B c="ghost" sm onClick={disconnect}>⏹ Stop</B>
          : <B c="gold"  sm onClick={connect}>▶ Connect</B>
        }
        <B c="ghost" sm onClick={() => setEvents([])}>🗑 Clear</B>
        <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)" }}>
          {visible.length} events
        </span>
      </div>

      {/* ── Category tabs ── */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
        {CATEGORIES.map(cat => {
          const count = cat.key === "all" ? events.length : events.filter(e => e.category === cat.key).length;
          const active = activeTab === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => switchTab(cat.key)}
              style={{
                fontFamily:    "var(--mono)",
                fontSize:      10,
                padding:       "4px 11px",
                background:    active ? "var(--accent)" : "var(--surface2)",
                border:        `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                color:         active ? "#000" : "var(--textdim)",
                cursor:        "pointer",
                letterSpacing: 0.8,
                fontWeight:    active ? 700 : 400,
                transition:    "all 0.15s",
              }}
            >
              {cat.label}
              {count > 0 && (
                <span style={{
                  marginLeft: 5, fontSize: 9,
                  background: active ? "rgba(0,0,0,0.2)" : "rgba(200,168,75,0.15)",
                  color: active ? "#000" : "var(--accent)",
                  padding: "1px 5px", borderRadius: 8,
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Event feed ── */}
      <div className="ap-fb" style={{ padding: 0, overflow: "hidden" }}>
        <div
          ref={feedRef}
          onScroll={handleScroll}
          style={{ height: 540, overflowY: "auto", padding: "8px 0" }}
        >
          {visible.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "60px 20px",
              fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)",
            }}>
              {status === "connected"
                ? "Waiting for server events... Activity will appear here as things happen."
                : "Not connected. Press Connect to start."}
            </div>
          ) : (
            visible.map((ev, i) => (
              <div
                key={ev.id}
                style={{
                  display:       "flex",
                  alignItems:    "flex-start",
                  gap:           14,
                  padding:       "11px 20px",
                  borderBottom:  "1px solid rgba(30,37,48,0.6)",
                  background:    i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)",
                  transition:    "background 0.1s",
                }}
              >
                {/* Icon */}
                <div style={{
                  fontSize: 18,
                  width: 28,
                  textAlign: "center",
                  flexShrink: 0,
                  paddingTop: 1,
                }}>
                  {ev.icon}
                </div>

                {/* Message */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize:   13,
                    color:      ev.color,
                    fontWeight: 500,
                    lineHeight: 1.4,
                  }}>
                    {ev.message}
                  </div>
                </div>

                {/* Right side: badge + time */}
                <div style={{
                  display:    "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap:        4,
                  flexShrink: 0,
                }}>
                  {ev.badge && (
                    <span style={{
                      fontFamily:    "var(--mono)",
                      fontSize:      9,
                      letterSpacing: 1.5,
                      padding:       "2px 7px",
                      borderRadius:  2,
                      background:    ev.color + "18",
                      border:        `1px solid ${ev.color}44`,
                      color:         ev.color,
                      whiteSpace:    "nowrap",
                    }}>
                      {ev.badge}
                    </span>
                  )}
                  <span style={{
                    fontFamily: "var(--mono)",
                    fontSize:   10,
                    color:      "var(--textdim)",
                  }}>
                    {ev.time}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Auto-scroll nudge */}
        {!autoScroll && (
          <div
            onClick={() => { setAutoScroll(true); feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" }); }}
            style={{
              textAlign: "center", padding: "6px", cursor: "pointer",
              background: "rgba(200,168,75,0.1)", borderTop: "1px solid var(--accent)",
              fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)", letterSpacing: 1,
            }}
          >
            ↓ NEW EVENTS — click to resume auto-scroll
          </div>
        )}
      </div>

      {/* ── Info note ── */}
      <div className="ap-note info" style={{ marginTop: 16 }}>
        💡 This view shows a simplified summary of server events in plain English. For full technical logs, raw output, and advanced filters — use the <strong>🧟 PZ Console</strong> tab.
      </div>
    </div>
  );
}
