"use client";
// Zombita's Security is its own page (/security); this tab just opens it (same as the Live Ops tab).
import { useEffect } from "react";

export default function SecurityTab() {
  // park the panel's remembered tab on Overview first, so "back to the admin panel" doesn't bounce straight to /security again
  useEffect(() => {
    try { sessionStorage.setItem("soup:panel.page", JSON.stringify("overview")); } catch {}
    window.location.href = "/security";
  }, []);
  return <div style={{ padding: 24, fontFamily: "var(--mono, monospace)" }}>Opening Zombita&apos;s Security... <a href="/security" style={{ color: "var(--accent)" }}>open it</a></div>;
}
