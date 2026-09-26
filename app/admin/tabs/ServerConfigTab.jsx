"use client";
// @ts-nocheck
import { useState, useEffect } from "react";
import { fetchApi, postApi } from "./shared";

import ModsMapTab         from "./ModsMapTab";
import ServerSettingsTab  from "./ServerSettingsTab";
import WorldLootTab       from "./WorldLootTab";
import ZombiesTab         from "./ZombiesTab";
import SkillsXPTab        from "./SkillsXPTab";
import VehiclesAnimalsTab from "./VehiclesAnimalsTab";
import ActivityLogTab     from "./ActivityLogTab";

const TAB_MAP = {
  mods:     ModsMapTab,
  server:   ServerSettingsTab,
  world:    WorldLootTab,
  zombies:  ZombiesTab,
  skills:   SkillsXPTab,
  vehicles: VehiclesAnimalsTab,
  log:      ActivityLogTab,
};

const ExternalEditAlert = ({ alerts, onDismiss, onClaim }) => {
  if (!alerts || alerts.length === 0) return null;
  return (
    <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 6 }}>
      {alerts.map((a, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
          background: "rgba(224,85,85,0.06)", border: "1px solid rgba(224,85,85,0.3)",
          borderLeft: "3px solid var(--red)", animation: "ap-slide .3s ease",
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: "var(--red)", fontWeight: 500, marginBottom: 2 }}>
              External Edit Detected
            </div>
            <div style={{ fontSize: 11, color: "var(--textdim)", fontFamily: "var(--mono)", lineHeight: 1.4 }}>
              <strong style={{ color: "var(--text)" }}>{a.file}</strong> was modified outside the admin panel.
              {a.last_panel_write && (
                <span>{" "}Last panel write: {new Date(a.last_panel_write).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              )}
              {" "}— Check <span style={{ color: "var(--accent)" }}>Activity Log</span> and{" "}
              <span style={{ color: "var(--accent)" }}>Settings Changelog</span> for details.
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={() => onClaim(a.file)} style={{
              background: "rgba(200,168,75,0.08)", border: "1px solid rgba(200,168,75,0.4)", color: "var(--accent)",
              fontSize: 10, padding: "4px 10px", cursor: "pointer", fontFamily: "var(--mono)", letterSpacing: 1,
            }}>🙋 That was me</button>
            <button onClick={() => onDismiss(i)} style={{
              background: "none", border: "1px solid rgba(224,85,85,0.3)", color: "var(--red)",
              fontSize: 12, padding: "4px 10px", cursor: "pointer", fontFamily: "var(--mono)", letterSpacing: 1,
            }}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function ServerConfigTab({ toast, initialTab = "mods" }) {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchApi("/api/admin/config/filestatus");
        const found = [];
        if (data.ini?.status === "external_edit") found.push({ file: "servertest.ini", ...data.ini });
        if (data.sandbox?.status === "external_edit") found.push({ file: "servertest_SandboxVars.lua", ...data.sandbox });
        if (found.length) setAlerts(found);
      } catch {}
    })();
  }, [initialTab]);

  const claimEdit = async (filename) => {
    try {
      await postApi("/api/admin/config/claim", { file: filename });
      setAlerts(p => p.filter(a => a.file !== filename));
      if (toast) toast("Edit claimed — your name is now on it", "success");
    } catch {
      if (toast) toast("Could not claim edit", "error");
    }
  };

  const ActiveTab = TAB_MAP[initialTab] || ModsMapTab;

  return (
    <>
      <ExternalEditAlert
        alerts={alerts}
        onDismiss={(idx) => setAlerts(p => p.filter((_, i) => i !== idx))}
        onClaim={claimEdit}
      />
      <ActiveTab toast={toast} />
    </>
  );
}
