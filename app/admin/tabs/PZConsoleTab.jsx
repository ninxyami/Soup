"use client";
// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { API, B, FB, Title } from "./shared";

// ── Config ────────────────────────────────────────────────────────────────────

const WS_URL = API.replace(/^https/, "wss").replace(/^http/, "ws");

const MAX_LINES = 800;

// Smart filter presets — each has a list of keywords to match against log lines
const FILTER_PRESETS = [
  { key: "all",     label: "📋 All",          keywords: [] },
  { key: "errors",  label: "🔴 Errors",        keywords: ["error", "exception", "failed", "fatal", "crash", "traceback", "s_api fail"] },
  { key: "warns",   label: "🟡 Warnings",      keywords: ["warn", "warning"] },
  { key: "mods",    label: "🧩 Mods",          keywords: ["mod", "workshop", "steamitemid", "loaded mod", "loading mod", "mod loaded", "mod failed", "mod error", "items loaded", "recipes loaded"] },
  { key: "rcon",    label: "⚡ RCON",          keywords: ["rcon"] },
  { key: "players", label: "👥 Players",       keywords: ["player", "connected", "disconnect", "join", "left", "kicked", "banned", "steamid", "zombie.network.gameserver"] },
  { key: "network", label: "🌐 Network",       keywords: ["network", "steam", "connect", "packet", "udp", "tcp", "ping"] },
  { key: "world",   label: "🌍 World",         keywords: ["world", "chunk", "save", "load", "spawn", "map", "cell"] },
  { key: "server",  label: "🖥️ Server",        keywords: ["server started", "server stopped", "rcon: listening", "lua", "luanet", "startup"] },
];

const LINE_COLORS = {
  err:     "#e05555",
  warn:    "#c8a84b",
  ok:      "#4caf7d",
  cmd:     "#4a8fc4",
  mod:     "#b07dff",
  player:  "#4fc3f7",
  rcon:    "#4a8fc4",
  system:  "#9775cc",
  default: "#8a8a8a",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function PZConsoleTab() {
  const [lines, setLines]               = useState([]);
  const [status, setStatus]             = useState("disconnected");
  const [activePreset, setActivePreset] = useState("all");
  const [customFilter, setCustomFilter] = useState("");
  const [autoScroll, setAutoScroll]     = useState(true);
  const [cmd, setCmd]                   = useState("");
  const [lineCount, setLineCount]       = useState(0);
  const [fullscreen, setFullscreen]     = useState(false);

  const wsRef        = useRef(null);
  const termRef      = useRef(null);
  const cmdRef       = useRef(null);
  const reconnectRef = useRef(null);
  const lineIdRef    = useRef(0);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoScroll && termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!termRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = termRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  }, []);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  const addLine = useCallback((msg) => {
    setLines(prev => {
      const next = [...prev, { ...msg, id: lineIdRef.current++ }];
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
    setLineCount(c => c + 1);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) return;
    setStatus("connecting");
    const ws = new WebSocket(`${WS_URL}/ws/admin/pz-console`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      clearTimeout(reconnectRef.current);
    };

    ws.onmessage = (e) => {
      try { addLine(JSON.parse(e.data)); } catch {}
    };

    ws.onerror = () => setStatus("error");

    ws.onclose = () => {
      setStatus("disconnected");
      reconnectRef.current = setTimeout(() => {
        addLine({ source: "system", line: "🔄 Reconnecting...", color: "system" });
        connect();
      }, 3000);
    };
  }, [addLine]);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectRef.current);
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("disconnected");
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectRef.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
    };
  }, [connect]);

  // ── Filtering logic ───────────────────────────────────────────────────────
  const visibleLines = lines.filter(l => {
    const low = l.line.toLowerCase();
    // custom text filter takes priority
    if (customFilter.trim()) return low.includes(customFilter.toLowerCase());
    // preset filter
    const preset = FILTER_PRESETS.find(p => p.key === activePreset);
    if (!preset || preset.keywords.length === 0) return true;
    return preset.keywords.some(kw => low.includes(kw));
  });

  // ── RCON ──────────────────────────────────────────────────────────────────
  const sendCmd = useCallback(() => {
    const c = cmd.trim();
    if (!c) return;
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ action: "rcon", command: c }));
    } else {
      addLine({ source: "system", line: "⚠ Not connected", color: "warn" });
    }
    setCmd("");
    cmdRef.current?.focus();
  }, [cmd, addLine]);

  // ── Status ────────────────────────────────────────────────────────────────
  const statusColor = {
    connected:    "var(--green)",
    connecting:   "var(--accent)",
    disconnected: "var(--muted)",
    error:        "var(--red)",
  }[status] || "var(--muted)";

  const statusLabel = {
    connected:    "LIVE",
    connecting:   "CONNECTING...",
    disconnected: "OFFLINE",
    error:        "ERROR",
  }[status];

  const QUICK_CMDS = [
    { label: "Players",     cmd: "players"    },
    { label: "Save",        cmd: "save"       },
    { label: "Chopper",     cmd: "chopper"    },
    { label: "Gunshot",     cmd: "gunshot"    },
    { label: "Start Rain",  cmd: "startrain"  },
    { label: "Stop Rain",   cmd: "stoprain"   },
    { label: "Start Storm", cmd: "startstorm" },
    { label: "Stop Storm",  cmd: "stopstorm"  },
    { label: "Add XP",      cmd: "addxp"      },
    { label: "Give Item",   cmd: "additem"    },
    { label: "Teleport",    cmd: "teleport"   },
    { label: "Ban User",    cmd: "banuser"    },
    { label: "Kick User",   cmd: "kickuser"   },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <Title t="🧟 PZ Server Console" s="Live journalctl stream from zomboid.service with smart filters" />

      {/* ── Top bar: status + controls ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
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
        <B c="ghost" sm onClick={() => { setLines([]); setLineCount(0); }}>🗑 Clear</B>
        <B c="ghost" sm onClick={() => setFullscreen(f => !f)}>{fullscreen ? "⊠ Exit Fullscreen" : "⛶ Fullscreen"}</B>
        <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)" }}>
          {visibleLines.length} / {lineCount} lines
        </span>
      </div>

      {/* ── Smart filter tabs ── */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
        {FILTER_PRESETS.map(p => (
          <button
            key={p.key}
        onClick={() => {
              setActivePreset(p.key);
              setCustomFilter("");
              // scroll to bottom so latest matching lines are visible
              setTimeout(() => {
                if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
              }, 20);
            }}
            style={{
              fontFamily:    "var(--mono)",
              fontSize:      10,
              padding:       "4px 11px",
              background:    activePreset === p.key && !customFilter ? "var(--accent)" : "var(--surface2)",
              border:        `1px solid ${activePreset === p.key && !customFilter ? "var(--accent)" : "var(--border)"}`,
              color:         activePreset === p.key && !customFilter ? "#000" : "var(--textdim)",
              cursor:        "pointer",
              letterSpacing: 0.8,
              fontWeight:    activePreset === p.key && !customFilter ? 700 : 400,
              transition:    "all 0.15s",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Terminal window ── */}
      <div style={fullscreen ? {
        position: "fixed", inset: 0, zIndex: 9000,
        background: "#060a0d", display: "flex", flexDirection: "column",
        padding: 16,
      } : {}}>

        {/* Fullscreen header — only shown in fullscreen mode */}
        {fullscreen && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexShrink: 0 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)", letterSpacing: 2 }}>🧟 PZ SERVER CONSOLE</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: statusColor, marginLeft: 8 }}>
              <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: statusColor, marginRight: 5, verticalAlign: "middle" }} />
              {statusLabel}
            </span>
            {/* Filter tabs in fullscreen */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginLeft: 8 }}>
              {FILTER_PRESETS.map(p => (
                <button key={p.key} onClick={() => { setActivePreset(p.key); setCustomFilter(""); setTimeout(() => { if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight; }, 20); }} style={{
                  fontFamily: "var(--mono)", fontSize: 10, padding: "3px 9px",
                  background: activePreset === p.key && !customFilter ? "var(--accent)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${activePreset === p.key && !customFilter ? "var(--accent)" : "rgba(255,255,255,0.1)"}`,
                  color: activePreset === p.key && !customFilter ? "#000" : "#666",
                  cursor: "pointer", letterSpacing: 0.8,
                }}>{p.label}</button>
              ))}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              <input value={customFilter} onChange={e => setCustomFilter(e.target.value)} placeholder="search..." style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#ccc", padding: "3px 10px", fontFamily: "var(--mono)", fontSize: 11, outline: "none", borderRadius: 2, width: 180,
              }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "#555" }}>{visibleLines.length} / {lineCount}</span>
              <button onClick={() => setFullscreen(false)} style={{
                background: "rgba(224,85,85,0.15)", border: "1px solid rgba(224,85,85,0.4)",
                color: "#e05555", fontFamily: "var(--mono)", fontSize: 11, padding: "4px 12px",
                cursor: "pointer", letterSpacing: 1,
              }}>✕ EXIT</button>
            </div>
          </div>
        )}

        <div className={fullscreen ? "" : "ap-fb"} style={{ padding: 0, overflow: "hidden", flex: fullscreen ? 1 : undefined, display: "flex", flexDirection: "column" }}>

        {/* Custom text filter bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "7px 12px", borderBottom: "1px solid var(--border)", background: "var(--surface)",
        }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)", minWidth: 44 }}>SEARCH</span>
          <input
            value={customFilter}
            onChange={e => setCustomFilter(e.target.value)}
            placeholder="type to search log lines... (overrides filter tabs)"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontFamily: "var(--mono)", fontSize: 11, color: "var(--text)",
            }}
          />
          {customFilter && (
            <button
              onClick={() => setCustomFilter("")}
              style={{ background: "none", border: "none", color: "var(--textdim)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 10 }}
            >✕</button>
          )}
        </div>

        {/* Log output */}
        <div
          ref={termRef}
          onScroll={handleScroll}
          style={{
            height: fullscreen ? undefined : 500,
            flex: fullscreen ? 1 : undefined,
            overflowY: "auto", padding: "12px 16px",
            background: "#060a0d", fontFamily: "var(--mono)",
            fontSize: 11.5, lineHeight: 1.75, letterSpacing: 0.2,
          }}
        >
          {visibleLines.length === 0 && (
            <div style={{ color: "var(--textdim)", fontFamily: "var(--mono)", fontSize: 11, paddingTop: 8 }}>
              {status === "connected" ? "Waiting for PZ server output..." : "Not connected."}
            </div>
          )}
          {visibleLines.map(l => (
            <div
              key={l.id}
              style={{
                color:        LINE_COLORS[l.color] || LINE_COLORS.default,
                borderLeft:   l.color === "err"    ? "2px solid #e05555"
                            : l.color === "warn"   ? "2px solid #c8a84b"
                            : l.color === "cmd"    ? "2px solid #4a8fc4"
                            : l.color === "mod"    ? "2px solid #b07dff"
                            : l.color === "player" ? "2px solid #4fc3f7"
                            : "2px solid transparent",
                paddingLeft:  ["err","warn","cmd","mod","player"].includes(l.color) ? 8 : 0,
                marginBottom: 1,
                wordBreak:    "break-all",
                whiteSpace:   "pre-wrap",
              }}
            >
              {l.line}
            </div>
          ))}
        </div>

        {/* Auto-scroll nudge */}
        {!autoScroll && (
          <div
            onClick={() => { setAutoScroll(true); termRef.current?.scrollTo({ top: termRef.current.scrollHeight, behavior: "smooth" }); }}
            style={{
              textAlign: "center", padding: "6px", cursor: "pointer",
              background: "rgba(200,168,75,0.1)", borderTop: "1px solid var(--accent)",
              fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)", letterSpacing: 1,
            }}
          >
            ↓ NEW OUTPUT — click to resume auto-scroll
          </div>
        )}
        </div>{/* end ap-fb / inner */}
      </div>{/* end fullscreen wrapper */}

      {/* ── RCON Command Input ── */}
      <div className="ap-fb" style={{ marginTop: 16 }}>
        <h4>⚡ RCON COMMAND</h4>
        <div className="ap-note danger" style={{ marginBottom: 12 }}>
          ⚠ Direct RCON. Commands are sent to the game server as-is. No confirmation.
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {QUICK_CMDS.map((q, i) => (
            <button key={i} className="ap-pre" onClick={() => setCmd(q.cmd)} style={{ cursor: "pointer" }}>
              {q.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--accent)" }}>❯</span>
          <input
            ref={cmdRef}
            value={cmd}
            onChange={e => setCmd(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendCmd()}
            placeholder="type rcon command and press Enter..."
            disabled={status !== "connected"}
            className="ap-inp"
            style={{ flex: 1, fontFamily: "var(--mono)", fontSize: 12 }}
          />
          <B c="gold" sm onClick={sendCmd} disabled={status !== "connected" || !cmd.trim()}>Send ↵</B>
        </div>
        {status !== "connected" && (
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", marginTop: 6 }}>
            Connect to the console above to enable RCON.
          </div>
        )}
      </div>
    </div>
  );
}
