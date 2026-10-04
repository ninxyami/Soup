// @ts-nocheck
"use client";
// components/PanelGate.tsx
//
// The admin panel's password (Nin 2026-10-04: "use same password for workspace and ops the one we use for admin
// panel") in front of /ops and /workspace too. Same bot routes as the panel (/api/admin/panel-auth/status + verify),
// so unlocking any one of the three unlocks all of them for 24 h (the bot's soup_panel_auth cookie).
// Anything but a clear "locked" answer lets the page through: logged-out visitors and non-admins get the page's own
// "log in" / "admins only" screen, and a bot without a password set means no lock.

import { useEffect, useState } from "react";
import { API } from "@/lib/constants";

export default function PanelGate({ children, title = "SOUP ADMIN" }) {
  const [locked, setLocked] = useState(null);      // null = asking, true = show the lock, false = let through
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`${API}/api/admin/panel-auth/status`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setLocked(!!(d && d.has_password && !d.verified)); })
      .catch(() => { if (alive) setLocked(false); });
    return () => { alive = false; };
  }, []);

  const unlock = async () => {
    setErr("");
    try {
      const r = await fetch(`${API}/api/admin/panel-auth/verify`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }),
      });
      if (r.ok) setLocked(false);
      else setErr("Wrong password");
    } catch { setErr("Can't reach the server"); }
  };

  if (locked === false) return children;
  const mono = "var(--mono, 'Share Tech Mono', monospace)";
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#080a0c", zIndex: 100 }}>
      {locked === null ? (
        <div style={{ fontFamily: mono, color: "#6b7280", letterSpacing: 2 }}>LOADING...</div>
      ) : (
        <div style={{ background: "#0f1318", border: "1px solid #c8a84b", padding: 40, width: 400, maxWidth: "90vw", textAlign: "center" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 4, color: "#c8a84b" }}>{title}</div>
          <div style={{ fontSize: 11, color: "#6b7280", fontFamily: mono, margin: "4px 0 24px" }}>Enter the admin panel password to continue</div>
          <input type="password" value={pw} autoFocus placeholder="Password"
            onChange={(e) => { setPw(e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && unlock()}
            style={{ width: "100%", boxSizing: "border-box", background: "#080a0c", border: `1px solid ${err ? "#e05555" : "#1e2530"}`, color: "#c8cdd6",
              padding: "12px 16px", fontFamily: mono, fontSize: 14, textAlign: "center", letterSpacing: 3, outline: "none", marginBottom: 12 }} />
          {err && <div style={{ fontSize: 11, color: "#e05555", fontFamily: mono, marginBottom: 12 }}>{err}</div>}
          <button onClick={unlock} style={{ width: "100%", padding: 10, fontFamily: mono, fontSize: 12, letterSpacing: 2, textTransform: "uppercase",
            background: "rgba(200,168,75,0.1)", border: "1px solid #c8a84b", color: "#c8a84b", cursor: "pointer" }}>Unlock</button>
        </div>
      )}
    </div>
  );
}
