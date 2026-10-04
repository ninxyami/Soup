"use client";
// The Live Ops panel is its own full-screen page (/ops); this tab just opens it.
import { useEffect } from "react";

export default function LiveOpsTab() {
  useEffect(() => { window.location.href = "/ops"; }, []);
  return <div style={{ padding: 24, fontFamily: "var(--mono, monospace)" }}>Opening Live Ops... <a href="/ops" style={{ color: "var(--accent)" }}>open it</a></div>;
}
