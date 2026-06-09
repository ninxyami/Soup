"use client";
// @ts-nocheck
// app/admin/tabs/WorkspaceTab.jsx
//
// Thin wrapper: the admin panel's "Workspace" tab renders the ONE shared
// <Workspace/> component (components/Workspace.jsx). All workspace logic lives
// there now, so the admin tab and the standalone /workspace page are identical.
// This tab's only job is to resolve the current admin's identity (for live
// cursors) and pass it + the panel toast through.

import { useState, useEffect, useMemo } from "react";
import { API, ADMINS, Title } from "./shared";
import Workspace from "@/components/Workspace";

export default function WorkspaceTab({ toast }) {
  const [meRaw, setMeRaw] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/auth/me`, { credentials: "include" });
        const d = await r.json();
        const info = ADMINS[d.discord_id] || { name: d.username || "Admin", color: "#c8a84b", initials: "AD" };
        setMeRaw({ id: String(d.discord_id), name: info.name, color: info.color, initials: info.initials });
      } catch {
        setMeRaw({ id: "unknown", name: "Admin", color: "#c8a84b", initials: "AD" });
      }
    })();
  }, []);

  // Stable identity: only a genuinely new id/name/etc produces a new object,
  // so child editors keyed on `me` don't tear down on incidental re-renders.
  const me = useMemo(
    () => meRaw,
    [meRaw?.id, meRaw?.name, meRaw?.color, meRaw?.initials] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Workspace me={me} toast={toast} fillViewport />
    </div>
  );
}
