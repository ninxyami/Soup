// @ts-nocheck
"use client";
// components/ops/ServerControls.tsx - start / stop / restart / save the game server from Live Ops (2026-10-10, Nin:
// "can we add restarting stopping and starting of server in live ops as well"). Same backend as Admin > Server > Controls
// (routers/admin_server.py: GET /api/admin/server/status, POST /start /stop /restart /save), admin session only.
// A small "SERVER" button in the Live Ops header shows whether it is up (and for how long); it opens a menu with the four
// actions. Stop and Restart ask first and say players are disconnected at once; Save is harmless. Nothing here goes through
// the bot's warned countdown (that is Zombita Control > RESTART NOW): this is the direct systemctl stop / start.
import { useCallback, useEffect, useRef, useState } from "react";
import { API } from "@/lib/constants";

const mono = { fontFamily: "var(--mono, monospace)" };
const C = { green: "#4caf7d", red: "#e05555", amber: "#e8a35c", blue: "#4a8fc4", grey: "#9aa", line: "#2a2f37", panel: "#111418", text: "#e6e6e6" };

async function call(path, method) {
  const r = await fetch(`${API}${path}`, method === "POST"
    ? { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" }
    : { credentials: "include" });
  let d = null;
  try { d = await r.json(); } catch {}
  if (!r.ok) throw new Error((d && (d.detail || d.error)) || `HTTP ${r.status}`);
  return d;
}

export default function ServerControls() {
  const [up, setUp] = useState(null);          // true / false / null = unknown
  const [uptime, setUptime] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);        // { ok, text }
  const box = useRef(null);

  const check = useCallback(async () => {
    try {
      const d = await call("/api/admin/server/status", "GET");
      setUp(d.running === true);
      setUptime(d.uptime || "");
    } catch { setUp(null); setUptime(""); }
  }, []);

  useEffect(() => { check(); const t = setInterval(check, 15000); return () => clearInterval(t); }, [check]);
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const run = async (action, ask) => {
    if (busy) return;
    if (ask && !confirm(ask)) return;
    setBusy(action); setMsg(null);
    try {
      const d = await call(`/api/admin/server/${action}`, "POST");
      setMsg({ ok: true, text: d.message || `${action} sent` });
      setTimeout(check, 3000); setTimeout(check, 12000); setTimeout(check, 30000);
    } catch (e) {
      setMsg({ ok: false, text: `${action} failed: ${e.message}` });
    }
    setBusy("");
  };

  const dot = up === true ? C.green : up === false ? C.red : "#777";
  const label = up === true ? `running${uptime ? ` ${uptime}` : ""}` : up === false ? "stopped" : "?";
  const btn = (color, extra = {}) => ({ ...mono, fontSize: 12, fontWeight: 700, padding: "7px 10px", borderRadius: 3, cursor: busy ? "wait" : "pointer",
    background: "#1a1e24", color, border: `1px solid ${color}`, opacity: busy ? 0.6 : 1, ...extra });

  return (
    <span ref={box} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => { setOpen((o) => !o); if (!open) check(); }} title="Start, stop or restart the game server"
        style={{ ...mono, fontSize: 11, padding: "4px 9px", borderRadius: 3, cursor: "pointer", background: open ? "#1a1e24" : "transparent", color: C.text, border: `1px solid ${dot}` }}>
        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: dot, marginRight: 6 }} />SERVER · {label}
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 50, width: 292, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4,
          padding: 12, boxShadow: "0 8px 24px rgba(0,0,0,.5)" }}>
          <div style={{ ...mono, fontSize: 11, color: C.grey, marginBottom: 8 }}>
            Direct control of the game server. Stop and Restart disconnect everyone at once (no countdown); for a warned restart use Zombita Control, then RESTART NOW.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button disabled={!!busy || up === true} style={btn(C.green, up === true ? { opacity: 0.35, cursor: "default" } : {})}
              onClick={() => run("start")}>▶ Start</button>
            <button disabled={!!busy || up === false} style={btn(C.red, up === false ? { opacity: 0.35, cursor: "default" } : {})}
              onClick={() => run("stop", "STOP the game server now?\n\nEveryone online is disconnected at once. It stays down until you press Start.")}>■ Stop</button>
            <button disabled={!!busy} style={btn(C.amber)}
              onClick={() => run("restart", "RESTART the game server now?\n\nEveryone online is disconnected at once and the server is down for a couple of minutes.")}>🔄 Restart</button>
            <button disabled={!!busy || up === false} style={btn(C.blue, up === false ? { opacity: 0.35, cursor: "default" } : {})}
              onClick={() => run("save")}>💾 Save world</button>
          </div>
          {busy && <div style={{ ...mono, fontSize: 11, color: C.amber, marginTop: 8 }}>{busy}... (the restart takes about 10 seconds to send)</div>}
          {msg && <div style={{ ...mono, fontSize: 11, color: msg.ok ? C.green : C.red, marginTop: 8 }}>{msg.text}</div>}
        </div>
      )}
    </span>
  );
}
