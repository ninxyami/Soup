"use client";
import { useState, useEffect, useRef } from "react";
import { API } from "@/lib/constants";

// Install the font: npm install @fontsource/dseg7-classic
// Then import it once in your app/layout.tsx or globals.css:
// import "@fontsource/dseg7-classic";

interface GameTime {
  day: number;
  hour: number;
  minute: number;
  month: string;
  year: number;
}

export default function GameTimeWidget() {
  const [time, setTime]   = useState<GameTime | null>(null);
  const [live, setLive]   = useState(false);
  const wsRef             = useRef<WebSocket | null>(null);

  useEffect(() => {
    const wsUrl = API.replace(/^https/, "wss").replace(/^http/, "ws") + "/ws/gametime";
    let dead = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (dead) return;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen    = () => setLive(true);
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          if (d.type === "ping" || d.type === "pong") return;
          if (d.day !== undefined) setTime(d);
        } catch {}
      };
      ws.onclose = () => { setLive(false); if (!dead) reconnectTimer = setTimeout(connect, 5000); };
      ws.onerror = () => ws.close();
    }

    fetch(`${API}/api/gametime`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.ok) setTime(d); })
      .catch(() => {});

    connect();
    return () => {
      dead = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  if (!time) return null;

  const h12    = time.hour % 12 || 12;
  const period = time.hour < 12 ? "AM" : "PM";
  const hStr   = String(h12).padStart(2, "0");
  const mStr   = String(time.minute).padStart(2, "0");
  const isDay  = time.hour >= 6 && time.hour < 20;

  // PZ clock color: cyan-teal (#4fc3c8) in day, dimmer at night
  const glowColor = isDay ? "#4fc3c8" : "#2a7a7e";
  const dimColor  = isDay ? "rgba(79,195,200,0.15)" : "rgba(42,122,126,0.1)";

  return (
    <div
      title={`Knox County — Day ${time.day}, ${time.month} ${time.year}`}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1px",
        padding: "4px 10px 5px",
        background: "#0a0e0f",
        border: `1px solid ${isDay ? "#1a3335" : "#111820"}`,
        borderRadius: "3px",
        cursor: "default",
        userSelect: "none",
        lineHeight: 1,
        boxShadow: `inset 0 0 12px ${dimColor}`,
      }}
    >
      {/* Segment display background (unlit segments) */}
      <div style={{ position: "relative" }}>
        {/* Unlit segments — ghost layer */}
        <div style={{
          fontFamily: "'DSEG7 Classic', 'DSEG7Classic', monospace",
          fontSize: "1.1rem",
          letterSpacing: "0.05em",
          color: "rgba(79,195,200,0.12)",
          position: "absolute",
          top: 0, left: 0,
          userSelect: "none",
          pointerEvents: "none",
        }}>
          88:88
        </div>
        {/* Lit segments */}
        <div style={{
          fontFamily: "'DSEG7 Classic', 'DSEG7Classic', monospace",
          fontSize: "1.1rem",
          letterSpacing: "0.05em",
          color: glowColor,
          textShadow: `0 0 6px ${glowColor}, 0 0 12px ${glowColor}55`,
          position: "relative",
        }}>
          {hStr}:{mStr}
          <span style={{ fontSize: "0.6rem", marginLeft: "3px", fontFamily: "monospace", opacity: 0.85 }}>
            {period}
          </span>
        </div>
      </div>

      {/* Sub-line: temp style from PZ + day info */}
      <div style={{
        fontFamily: "'DSEG7 Classic', 'DSEG7Classic', monospace",
        fontSize: "0.48rem",
        letterSpacing: "0.04em",
        color: isDay ? "rgba(79,195,200,0.55)" : "rgba(79,195,200,0.3)",
        display: "flex",
        alignItems: "center",
        gap: "4px",
      }}>
        <span>D{String(time.day).padStart(2,"0")}/{time.month.slice(0,3).toUpperCase()}</span>
        {/* Live dot */}
        <span style={{
          display: "inline-block",
          width: "3px",
          height: "3px",
          borderRadius: "50%",
          background: live ? glowColor : "#222",
          boxShadow: live ? `0 0 4px ${glowColor}` : "none",
          flexShrink: 0,
        }} />
      </div>
    </div>
  );
}
