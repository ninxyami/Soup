"use client";
// The Live Ops panel is its own full-screen page (/ops); this tab just opens it.
import { useEffect } from "react";

export default function LiveOpsTab() {
  // the admin panel remembers its last tab for the session, so without this "back to the admin panel" would reopen THIS tab
  // and bounce straight to /ops again (Nin 2026-10-10: no way back from Live Ops). Park the memory on Overview first.
  useEffect(() => {
    try { sessionStorage.setItem("soup:panel.page", JSON.stringify("overview")); } catch {}
    window.location.href = "/ops";
  }, []);
  return <div style={{ padding: 24, fontFamily: "var(--mono, monospace)" }}>Opening Live Ops... <a href="/ops" style={{ color: "var(--accent)" }}>open it</a></div>;
}
