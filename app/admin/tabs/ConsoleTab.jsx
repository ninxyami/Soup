"use client";
// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { API, B, FB, Title } from "./shared";

// ── Config ────────────────────────────────────────────────────────────────────

const WS_URL = API.replace(/^https/, "wss").replace(/^http/, "ws");

const SOURCES = [
  { key: "bot",  label: "🤖 Bot",         desc: "bot.log"           },
  { key: "api",  label: "🌐 API",          desc: "api.log"           },
  { key: "shop", label: "🏪 Shop Watcher", desc: "shop_watcher.log"  },
];

const QUICK_CMDS = [
  { label: "Players",    cmd: "players"   },
  { label: "Save",       cmd: "save"      },
  { label: "Chopper",    cmd: "chopper"   },
  { label: "Gunshot",    cmd: "gunshot"   },
  { label: "Start Rain", cmd: "startrain" },
  { label: "Stop Rain",  cmd: "stoprain"  },
];

const LINE_COLORS = {
  err:     "#e05555",
  warn:    "#c8a84b",
  ok:      "#4caf7d",
  cmd:     "#4a8fc4",
  default: "#8a8a8a",
  system:  "#9775cc",
  rcon:    "#4a8fc4",
};

const MAX_LINES = 1000;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ConsoleTab() {
  const [lines, setLines]               = useState([]);
  const [activeSource, setActiveSource] = useState("bot");
  const [status, setStatus]             = useState("disconnected");
  const [cmd, setCmd]                   = useState("");
  const [autoScroll, setAutoScroll]     = useState(true);
  const [filter, setFilter]             = useState("");

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
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) return;
    setStatus("connecting");
    const ws = new WebSocket(`${WS_URL}/ws/admin/console`);
    wsRef.current = ws;

    ws.onopen = () => { setStatus("connected"); clearTimeout(reconnectRef.current); };
    ws.onmessage = (e) => { try { addLine(JSON.parse(e.data)); } catch {} };
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

  // ── Source switching ──────────────────────────────────────────────────────
  const switchSource = useCallback((src) => {
    setActiveSource(src);
    setLines([]);
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ action: "switch", source: src }));
    }
  }, []);

  // ── RCON ──────────────────────────────────────────────────────────────────
  const sendCmd = useCallback(() => {
    const c = cmd.trim();
    if (!c) return;
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ action: "rcon", command: c }));
    } else {
      addLine({ source: "system", line: "⚠ Not connected — command not sent", color: "warn" });
    }
    setCmd("");
    cmdRef.current?.focus();
  }, [cmd, addLine]);

  const clearLines = () => setLines([]);

  const visibleLines = filter.trim()
    ? lines.filter(l => l.line.toLowerCase().includes(filter.toLowerCase()))
    : lines;

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
  }[status] || "UNKNOWN";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <Title t="🖥️ Service Logs" s="Live log viewer — Bot · API · Shop Watcher" />

      {/* ── Source tabs ── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {SOURCES.map(src => (
          <button
            key={src.key}
            onClick={() => switchSource(src.key)}
            style={{
              fontFamily:    "var(--mono)",
              fontSize:      11,
              padding:       "5px 14px",
              background:    activeSource === src.key ? "var(--accent)" : "var(--surface2)",
              border:        `1px solid ${activeSource === src.key ? "var(--accent)" : "var(--border)"}`,
              color:         activeSource === src.key ? "#000" : "var(--textdim)",
              cursor:        "pointer",
              letterSpacing: 1,
              transition:    "all 0.15s",
              fontWeight:    activeSource === src.key ? 700 : 400,
            }}
          >
            {src.label}
            <span style={{ opacity: 0.6, marginLeft: 6, fontSize: 9 }}>{src.desc}</span>
          </button>
        ))}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
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
          <B c="ghost" sm onClick={clearLines}>🗑 Clear</B>
        </div>
      </div>

      {/* ── Terminal window ── */}
      <div className="ap-fb" style={{ padding: 0, overflow: "hidden" }}>
        {/* Filter bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", borderBottom: "1px solid var(--border)", background: "var(--surface)",
        }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)", minWidth: 40 }}>FILTER</span>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="type to filter lines..."
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontFamily: "var(--mono)", fontSize: 11, color: "var(--text)",
            }}
          />
          {filter && (
            <button
              onClick={() => setFilter("")}
              style={{ background: "none", border: "none", color: "var(--textdim)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 10 }}
            >✕</button>
          )}
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)", minWidth: 60, textAlign: "right" }}>
            {visibleLines.length} lines
          </span>
        </div>

        {/* Log output */}
        <div
          ref={termRef}
          onScroll={handleScroll}
          style={{
            height: 460, overflowY: "auto", padding: "12px 16px",
            background: "#080b0e", fontFamily: "var(--mono)",
            fontSize: 11.5, lineHeight: 1.7, letterSpacing: 0.2,
          }}
        >
          {visibleLines.length === 0 && (
            <div style={{ color: "var(--textdim)", fontFamily: "var(--mono)", fontSize: 11, paddingTop: 8 }}>
              {status === "connected" ? "Waiting for log output..." : "Not connected."}
            </div>
          )}
          {visibleLines.map(l => (
            <div
              key={l.id}
              style={{
                color:        LINE_COLORS[l.color] || LINE_COLORS.default,
                borderLeft:   l.color === "err"  ? "2px solid #e05555"
                            : l.color === "warn" ? "2px solid #c8a84b"
                            : l.color === "cmd"  ? "2px solid #4a8fc4"
                            : "2px solid transparent",
                paddingLeft:  ["err","warn","cmd"].includes(l.color) ? 8 : 0,
                marginBottom: 1,
                wordBreak:    "break-all",
                whiteSpace:   "pre-wrap",
              }}
            >
              {l.source !== "bot" && l.source !== activeSource && (
                <span style={{ opacity: 0.4, marginRight: 6, fontSize: 9 }}>[{l.source}]</span>
              )}
              {l.line}
            </div>
          ))}
        </div>

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
      </div>

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
