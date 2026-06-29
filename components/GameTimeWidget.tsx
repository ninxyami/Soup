"use client";
import { useState, useEffect, useRef } from "react";
import { API } from "@/lib/constants";

interface GameTime {
  day: number;
  hour: number;
  minute: number;
  month: string;
  year: number;
}

export default function GameTimeWidget() {
  const [time, setTime] = useState<GameTime | null>(null);
  const [live, setLive] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Build WebSocket URL from the API constant
    // e.g. https://api.stateofundeadpurge.site:8443 → wss://api.stateofundeadpurge.site:8443
    const wsUrl = API.replace(/^https/, "wss").replace(/^http/, "ws") + "/ws/gametime";

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let dead = false;

    function connect() {
      if (dead) return;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setLive(true);

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "ping" || data.type === "pong") return;
          if (data.day !== undefined) setTime(data);
        } catch {}
      };

      ws.onclose = () => {
        setLive(false);
        if (!dead) reconnectTimer = setTimeout(connect, 5000);
      };

      ws.onerror = () => ws.close();
    }

    // Fetch current value immediately so widget isn't blank on load
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

  // Day/night colour — green in day, dimmer at night
  const isDay  = time.hour >= 6 && time.hour < 20;

  return (
    <div
      title={`Knox County — Day ${time.day}, ${time.month} ${time.year}`}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1px",
        padding: "3px 8px 4px",
        background: "#080808",
        border: `1px solid ${isDay ? "#1a3320" : "#1a1a2e"}`,
        borderRadius: "3px",
        cursor: "default",
        userSelect: "none",
        lineHeight: 1,
        position: "relative",
      }}
    >
      {/* Digital time display */}
      <div
        style={{
          fontFamily: "'VT323', 'Share Tech Mono', monospace",
          fontSize: "1.15rem",
          letterSpacing: "0.08em",
          color: isDay ? "#3ddc84" : "#2a6644",
          textShadow: isDay ? "0 0 8px rgba(61,220,132,0.4)" : "none",
        }}
      >
        {hStr}:{mStr}
        <span style={{ fontSize: "0.7rem", marginLeft: "3px", opacity: 0.8 }}>{period}</span>
      </div>

      {/* Day + date sub-line */}
      <div
        style={{
          fontFamily: "monospace",
          fontSize: "0.52rem",
          letterSpacing: "0.06em",
          color: "#3a3a3a",
          textTransform: "uppercase",
        }}
      >
        Day {time.day} · {time.month.slice(0, 3)} {time.year}
        {/* Live dot */}
        <span
          style={{
            display: "inline-block",
            width: "4px",
            height: "4px",
            borderRadius: "50%",
            background: live ? "#3ddc84" : "#333",
            marginLeft: "5px",
            verticalAlign: "middle",
            boxShadow: live ? "0 0 4px #3ddc84" : "none",
          }}
        />
      </div>
    </div>
  );
}
