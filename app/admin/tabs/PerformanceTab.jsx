"use client";
// The Performance page is its own wide page (/performance); this tab just opens it, the same way LiveOpsTab opens /ops.
import { useEffect } from "react";

export default function PerformanceTab() {
  useEffect(() => {
    try { sessionStorage.setItem("soup:panel.page", JSON.stringify("overview")); } catch {}
    window.location.href = "/performance";
  }, []);
  return <div style={{ padding: 24, fontFamily: "var(--mono, monospace)" }}>Opening Performance... <a href="/performance" style={{ color: "var(--accent)" }}>open it</a></div>;
}
