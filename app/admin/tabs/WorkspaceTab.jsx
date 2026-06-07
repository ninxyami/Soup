"use client";
// @ts-nocheck
// app/admin/tabs/WorkspaceTab.jsx
//
// Thin wrapper: the admin panel's "Workspace" tab renders the ONE shared
// <Workspace/> component (components/Workspace.jsx). All workspace logic lives
// there now, so the admin tab and the standalone /workspace page are identical.
// This tab's only job is to resolve the current admin's identity (for live
// cursors) and pass it + the panel toast through.

import { useState, useEffect } from "react";
import { API, ADMINS, Title } from "./shared";
import Workspace from "@/components/Workspace";

export default function WorkspaceTab({ toast }) {
  const [me, setMe] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/auth/me`, { credentials: "include" });
        const d = await r.json();
        const info = ADMINS[d.discord_id] || { name: d.username || "Admin", color: "#c8a84b", initials: "AD" };
        setMe({ id: String(d.discord_id), name: info.name, color: info.color, initials: info.initials });
      } catch {
        setMe({ id: "unknown", name: "Admin", color: "#c8a84b", initials: "AD" });
      }
    })();
  }, []);

  return (
    <div>
      <Title t="WORKSPACE" s="Live collaborative planning — projects, documents, real-time" />
      <Workspace me={me} toast={toast} />
    </div>
  );
}
