"use client";
// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { API, B, Title } from "./shared";

const WS_URL = API.replace(/^https/, "wss").replace(/^http/, "ws");
const MAX_EVENTS = 10000;

// ── Event translator ──────────────────────────────────────────────────────────
// Takes a raw PZ log line (already stripped of journalctl prefix by backend)
// and returns a simplified event object, or null if it's noise to ignore.
function translateLine(raw) {
  if (!raw || !raw.trim()) return null;
  const line = raw.toLowerCase();
  const ts = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  // ── Hard noise — always skip ───────────────────────────────────────────────
  const hardNoise = [
    "animalpacket class doesn",
    "animaleventpacket class doesn",
    "packetsettingattributes",
    "no packet handler for type",
    "packetscache.<init>",
    "s_api fail",
    "steamnetworkingutils",
    "steamapi_init",
    "luanet: registering",
    "luanet: initializ",
    "[s_api fail]",
  ];
  if (hardNoise.some(n => line.includes(n))) return null;

  // Skip lines that are just raw connection handshake steps
  const handshakeNoise = ["receive-packet", "send-packet", "connection-details", "login-queue-request", "login-queue-done"];
  if (handshakeNoise.some(n => line.includes(n)) && line.includes("connection: guid")) return null;

  // ── PLAYERS ───────────────────────────────────────────────────────────────
  if (line.includes("fully-connected")) {
    return { category: "players", icon: "🟢", color: "#4caf7d", ts,
      title: "Player fully connected",
      detail: "A player finished loading and joined the game world" };
  }

  if (line.includes("steam client") && line.includes("initiating a connection")) {
    const idMatch = raw.match(/Steam client (\d+)/i);
    return { category: "players", icon: "🔌", color: "#9775cc", ts,
      title: "Player attempting to connect",
      detail: idMatch ? `Steam ID: ${idMatch[1]}` : "A Steam user is connecting to the server" };
  }

  if (line.includes("connected new client")) {
    return { category: "players", icon: "📡", color: "#4fc3f7", ts,
      title: "Connection accepted",
      detail: "Server accepted a new client connection" };
  }

  if (line.includes("saving players") && !line.includes("error")) {
    return { category: "world", icon: "💾", color: "#4caf7d", ts,
      title: "World saved",
      detail: "Player data and world state written to disk" };
  }

  if ((line.includes("disconnected") || line.includes("disconnect")) &&
      (line.includes("player") || line.includes("client") || line.includes("guid"))) {
    return { category: "players", icon: "🔴", color: "#e05555", ts,
      title: "Player disconnected",
      detail: "A player left or lost connection" };
  }

  if (line.includes("kicked")) {
    const nameMatch = raw.match(/kicked[:\s]+([^\s>]+)/i);
    return { category: "players", icon: "👢", color: "#e05555", ts,
      title: "Player kicked",
      detail: nameMatch ? `Player: ${nameMatch[1]}` : "A player was removed from the server" };
  }

  if (line.includes("banned")) {
    return { category: "players", icon: "🚫", color: "#e05555", ts,
      title: "Player banned",
      detail: "A player was permanently banned from the server" };
  }

  // ── MODS ──────────────────────────────────────────────────────────────────
  if (line.includes("log  : mod") || (line.includes("mod ") && line.includes("overrides"))) {
    const modMatch = raw.match(/mod "([^"]+)"/i);
    const modName = modMatch ? modMatch[1] : "Unknown mod";
    if (line.includes("overrides")) {
      return { category: "mods", icon: "🧩", color: "#b07dff", ts,
        title: `Mod override: ${modName}`,
        detail: "This mod is replacing a base game file — this is normal behaviour" };
    }
    return { category: "mods", icon: "🧩", color: "#b07dff", ts,
      title: `Mod loaded: ${modName}`,
      detail: null };
  }

  if (line.includes("mod") && (line.includes("failed") || line.includes("error"))) {
    const modMatch = raw.match(/mod "([^"]+)"/i);
    return { category: "mods", icon: "❌", color: "#e05555", ts,
      title: `Mod error: ${modMatch ? modMatch[1] : "Unknown mod"}`,
      detail: "Check the 💥 Errors tab or PZ Console for details" };
  }

  if (line.includes("items loaded") || line.includes("recipes loaded")) {
    const countMatch = raw.match(/(\d+)\s+(items|recipes)/i);
    return { category: "mods", icon: "📦", color: "#b07dff", ts,
      title: countMatch ? `${countMatch[1]} ${countMatch[2]} loaded from mods` : "Mod items/recipes loaded",
      detail: "Mod content successfully registered with the server" };
  }

  if (line.includes("workshop") || line.includes("steamitemid")) {
    return { category: "mods", icon: "🔧", color: "#b07dff", ts,
      title: "Workshop mod activity",
      detail: raw.substring(0, 100) };
  }

  // ── SERVER LIFECYCLE ──────────────────────────────────────────────────────
  if (line.includes("server started")) {
    return { category: "server", icon: "🖥️", color: "#4caf7d", ts,
      title: "Server started successfully",
      detail: "All systems online and accepting connections" };
  }

  if (line.includes("server stopped") || line.includes("server shutting")) {
    return { category: "server", icon: "🛑", color: "#e05555", ts,
      title: "Server stopped",
      detail: "The server has shut down" };
  }

  if (line.includes("rcon: listening")) {
    const portMatch = raw.match(/port (\d+)/i);
    return { category: "server", icon: "⚡", color: "#4a8fc4", ts,
      title: "RCON interface ready",
      detail: portMatch ? `Listening on port ${portMatch[1]} — admin commands enabled` : "Admin command interface active" };
  }

  if (line.includes("steam is enabled")) {
    return { category: "server", icon: "☁️", color: "#4caf7d", ts,
      title: "Steam connection established",
      detail: "Server is visible on the Steam server browser" };
  }

  if (line.includes("multiplayer: general") || line.includes("loading worlddictionary")) {
    return { category: "server", icon: "🌍", color: "#9775cc", ts,
      title: "Loading world data",
      detail: "Server is reading map and save files" };
  }

  if (line.includes("luanet: initialization [done]") || line.includes("luanet: initialization")) {
    return { category: "server", icon: "🔩", color: "#4caf7d", ts,
      title: "Lua engine initialized",
      detail: "Script system ready — mods can now run" };
  }

  if (line.includes("initialising raknet") || line.includes("initializing raknet")) {
    return { category: "network", icon: "📡", color: "#4a8fc4", ts,
      title: "Network layer starting",
      detail: "RakNet networking initializing" };
  }

  // ── RCON COMMANDS ─────────────────────────────────────────────────────────
  if (line.includes("rcon") && line.includes("password doesn't match")) {
    return { category: "rcon", icon: "🔑", color: "#e05555", ts,
      title: "RCON authentication failed",
      detail: "Someone tried to connect to RCON with the wrong password" };
  }

  if (line.includes("rcon") && !line.includes("listening") && !line.includes("password")) {
    return { category: "rcon", icon: "⚡", color: "#4a8fc4", ts,
      title: "RCON activity",
      detail: raw.substring(0, 100) };
  }

  // ── WARNINGS ──────────────────────────────────────────────────────────────
  if (line.startsWith("warn")) {
    // Skip pure packet handler noise
    if (line.includes("no packet handler") || line.includes("packetscache")) return null;

    if (line.includes("require(") && line.includes("failed")) {
      const reqMatch = raw.match(/require\("([^"]+)"\)/);
      return { category: "warnings", icon: "⚠️", color: "#c8a84b", ts,
        title: "Mod script missing",
        detail: reqMatch
          ? `Could not load script: ${reqMatch[1].split("/").pop()} — a mod may have a missing dependency`
          : "A mod script failed to load — usually harmless unless the mod breaks" };
    }

    return { category: "warnings", icon: "⚠️", color: "#c8a84b", ts,
      title: "Server warning",
      detail: raw.substring(0, 150) };
  }

  // ── ERRORS ────────────────────────────────────────────────────────────────
  if (line.startsWith("error")) {
    // Skip known harmless startup errors
    if (line.includes("animalpacket") || line.includes("animaleventpacket")) return null;
    return { category: "errors", icon: "💥", color: "#e05555", ts,
      title: "Server error",
      detail: raw.substring(0, 180) };
  }

  // ── WORLD ─────────────────────────────────────────────────────────────────
  if (line.includes("chunk") && (line.includes("load") || line.includes("generat"))) {
    return { category: "world", icon: "🗺️", color: "#8a8a8a", ts,
      title: "Map chunk activity",
      detail: "Server loaded or generated a new area of the map" };
  }

  // Everything else — skip to keep the feed clean
  return null;
}

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: "all",      label: "📋 All",       color: "#c8a84b" },
  { key: "players",  label: "👥 Players",   color: "#4fc3f7" },
  { key: "server",   label: "🖥️ Server",    color: "#4caf7d" },
  { key: "mods",     label: "🧩 Mods",      color: "#b07dff" },
  { key: "world",    label: "🌍 World",     color: "#4caf7d" },
  { key: "rcon",     label: "⚡ RCON",      color: "#4a8fc4" },
  { key: "network",  label: "🌐 Network",   color: "#4a8fc4" },
  { key: "warnings", label: "⚠️ Warnings",  color: "#c8a84b" },
  { key: "errors",   label: "💥 Errors",    color: "#e05555" },
  { key: "session",  label: "🔄 Sessions",  color: "#9775cc" },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function ServerActivityTab() {
  const [events, setEvents]           = useState([]);
  const [status, setStatus]           = useState("disconnected");
  const [activeCategory, setCategory] = useState("all");
  const [search, setSearch]           = useState("");

  const wsRef        = useRef(null);
  const reconnectRef = useRef(null);
  const feedRef      = useRef(null);
  const eventIdRef   = useRef(0);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  const addEvent = useCallback((evt) => {
    setEvents(prev => {
      const next = [...prev, { ...evt, id: eventIdRef.current++ }];
      return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
    });
    setTimeout(() => {
      if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }, 20);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) return;
    setStatus("connecting");
    const ws = new WebSocket(`${WS_URL}/ws/admin/pz-console`);
    wsRef.current = ws;

    ws.onopen = () => { setStatus("connected"); clearTimeout(reconnectRef.current); };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.source === "system") return;

        // Session separator — special divider event
        if (msg.event === "session_separator") {
          addEvent({
            category: "session",
            icon: msg.line.includes("ENDED") || msg.line.includes("RESTART") ? "🔴" : "🟢",
            color: msg.line.includes("ENDED") ? "#e05555" : msg.line.includes("RESTART") ? "#c8a84b" : "#4caf7d",
            ts: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            title: msg.line,
            detail: null,
            isSeparator: true,
          });
          return;
        }

        // Player list update — inject as a players event
        if (msg.event === "player_list") {
          const players = msg.players || [];
          if (players.length === 0) {
            addEvent({
              category: "players", icon: "👥", color: "#4fc3f7",
              ts: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              title: "No players currently online",
              detail: null,
            });
          } else {
            addEvent({
              category: "players", icon: "👥", color: "#4fc3f7",
              ts: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              title: `${players.length} player${players.length !== 1 ? "s" : ""} online`,
              detail: players.map(p => p.display ? `${p.ingame} (${p.display})` : p.ingame).join(" · "),
            });
          }
          return;
        }

        // Normal line — translate to plain English
        const evt = translateLine(msg.line || "");
        if (evt) addEvent(evt);
      } catch {}
    };

    ws.onerror = () => setStatus("error");
    ws.onclose = () => {
      setStatus("disconnected");
      reconnectRef.current = setTimeout(connect, 3000);
    };
  }, [addEvent]);

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

  // ── Filter — separators always visible in "all" view ─────────────────────
  const visible = events.filter(e => {
    if (e.isSeparator) return activeCategory === "all" || activeCategory === "session";
    if (activeCategory !== "all" && e.category !== activeCategory) return false;
    if (search.trim()) return (e.title + " " + (e.detail || "")).toLowerCase().includes(search.toLowerCase());
    return true;
  });

  // ── Status ────────────────────────────────────────────────────────────────
  const statusColor = {
    connected: "var(--green)", connecting: "var(--accent)",
    disconnected: "var(--muted)", error: "var(--red)",
  }[status];

  const statusLabel = {
    connected: "LIVE", connecting: "CONNECTING...",
    disconnected: "OFFLINE", error: "ERROR",
  }[status];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <Title t="📋 Server Activity" s="Plain English view of everything happening on the server" />

      {/* ── Top bar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: statusColor, letterSpacing: 1 }}>
          <span style={{
            display: "inline-block", width: 7, height: 7, borderRadius: "50%",
            background: statusColor, marginRight: 5, verticalAlign: "middle",
            boxShadow: status === "connected" ? `0 0 6px ${statusColor}` : "none",
          }} />
          {statusLabel}
        </span>
        {status === "connected"
          ? <B c="ghost" sm onClick={disconnect}>⏹ Stop</B>
          : <B c="gold"  sm onClick={connect}>▶ Connect</B>
        }
        <B c="ghost" sm onClick={() => setEvents([])}>🗑 Clear</B>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search events..."
            style={{
              background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)",
              padding: "5px 12px", fontFamily: "var(--mono)", fontSize: 11,
              outline: "none", borderRadius: 2, width: 180,
            }}
          />
          {search && (
            <button onClick={() => setSearch("")}
              style={{ background: "none", border: "none", color: "var(--textdim)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 11 }}>✕</button>
          )}
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)" }}>
            {visible.length} events
          </span>
        </div>
      </div>

      {/* ── Category tabs ── */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 16 }}>
        {CATEGORIES.map(cat => {
          const count = events.filter(e => cat.key === "all" || e.category === cat.key).length;
          const isActive = activeCategory === cat.key;
          return (
            <button key={cat.key} onClick={() => setCategory(cat.key)} style={{
              fontFamily: "var(--mono)", fontSize: 10, padding: "5px 12px",
              background: isActive ? cat.color + "22" : "var(--surface2)",
              border: `1px solid ${isActive ? cat.color : "var(--border)"}`,
              color: isActive ? cat.color : "var(--textdim)",
              cursor: "pointer", letterSpacing: 0.8,
              fontWeight: isActive ? 700 : 400, transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {cat.label}
              {count > 0 && (
                <span style={{
                  background: isActive ? cat.color : "rgba(255,255,255,0.08)",
                  color: isActive ? "#000" : "var(--textdim)",
                  borderRadius: 10, padding: "0 5px", fontSize: 9, fontWeight: 700,
                }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Event feed ── */}
      <div className="ap-fb" style={{ padding: 0, overflow: "hidden" }}>
        <div ref={feedRef} style={{ height: 560, overflowY: "auto", padding: "6px 0" }}>
          {visible.length === 0 && (
            <div style={{
              textAlign: "center", padding: "60px 20px",
              fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", lineHeight: 2,
            }}>
              {status === "connected"
                ? "⏳ Waiting for server activity...\nEvents will appear here as they happen on the server."
                : "Not connected — click ▶ Connect to start monitoring."}
            </div>
          )}

          {visible.map(evt => {
            // ── Session separator — full width divider ──
            if (evt.isSeparator) {
              return (
                <div key={evt.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 20px 10px",
                  borderTop: `1px solid ${evt.color}44`,
                  borderBottom: `1px solid ${evt.color}44`,
                  background: evt.color + "0a",
                  margin: "6px 0",
                }}>
                  <span style={{ fontSize: 16 }}>{evt.icon}</span>
                  <span style={{
                    fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 2,
                    color: evt.color, fontWeight: 700, textTransform: "uppercase", flex: 1,
                  }}>
                    {evt.title}
                  </span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>
                    {evt.ts}
                  </span>
                </div>
              );
            }

            // ── Normal event card ──
            return (
              <div
                key={evt.id}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 14,
                  padding: "10px 20px", borderBottom: "1px solid rgba(30,37,48,0.5)",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.015)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                {/* Icon bubble */}
                <div style={{
                  width: 34, height: 34, borderRadius: 4, flexShrink: 0,
                  background: evt.color + "18", border: `1px solid ${evt.color}44`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, marginTop: 1,
                }}>
                  {evt.icon}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, color: "var(--text)", fontWeight: 500,
                    marginBottom: evt.detail ? 3 : 0, lineHeight: 1.4,
                  }}>
                    {evt.title}
                  </div>
                  {evt.detail && (
                    <div style={{
                      fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--textdim)",
                      lineHeight: 1.5, wordBreak: "break-word",
                    }}>
                      {evt.detail}
                    </div>
                  )}
                </div>

                {/* Badge + time */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                  <span style={{
                    fontFamily: "var(--mono)", fontSize: 9, padding: "2px 7px",
                    background: evt.color + "18", border: `1px solid ${evt.color}44`,
                    color: evt.color, letterSpacing: 1, textTransform: "uppercase", borderRadius: 2,
                  }}>
                    {evt.category}
                  </span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>
                    {evt.ts}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Info note ── */}
      <div className="ap-note info" style={{ marginTop: 16 }}>
        💡 This view translates raw server logs into plain English. Some harmless startup noise (AnimalPacket errors, packet handler warnings) is filtered out automatically. For the full raw output, use the <strong>🧟 PZ Console</strong> tab.
      </div>
    </div>
  );
}
