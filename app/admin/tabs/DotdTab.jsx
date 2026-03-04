"use client";
// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { fetchApi, postApi, relTime, fmtFull, Title, SC, B, FB, Load, Toggle } from "./shared";

const DEFAULTS = { enabled: 1, interval_hours: 13, waves: 3, zombies_per_wave: 40, wave_interval_mins: 10, min_spawn_distance: 80, max_spawn_distance: 150 };

export default function DotdTab({ toast }) {
  const [c, setC] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { const d = await fetchApi("/api/admin/dotd/config"); setC({ ...DEFAULTS, ...d }); }
    catch { setC(DEFAULTS); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (updates) => {
    setSaving(true);
    try { await postApi("/api/admin/dotd/update", updates); toast("Config saved", "success"); load(); }
    catch (e) { toast("Failed: " + e.message, "error"); }
    setSaving(false);
  };
  const trigger = async () => {
    try { await postApi("/api/admin/dotd/trigger", {}); toast("💀 DotD triggered!", "success"); load(); }
    catch (e) { toast(e.message, "error"); }
  };
  const cancel = async () => {
    try { await postApi("/api/admin/dotd/cancel", {}); toast("🛑 Event cancelled", "success"); }
    catch (e) { toast(e.message, "error"); }
  };

  if (loading) return <><Title t="DAWN OF THE DEAD" s="horde event configuration" /><Load /></>;

  return (<>
    <Title t="DAWN OF THE DEAD" s="horde event · config · triggers · scheduling" />
    <div className="ap-sr" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
      <div className="ap-sc" style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Toggle on={!!c.enabled} onClick={() => save({ enabled: c.enabled ? 0 : 1 })} />
        <div><div className="ap-sc-l">Status</div><div style={{ fontFamily: "var(--display)", fontSize: 22, letterSpacing: 2, color: c.enabled ? "var(--green)" : "var(--red)" }}>{c.enabled ? "ENABLED" : "DISABLED"}</div></div>
      </div>
      <SC label="Last Event" value={c.last_event_at ? relTime(c.last_event_at) : "never"} color="blue" sub={c.last_event_at ? fmtFull(c.last_event_at) : ""} />
      <div className="ap-sc" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <B c="red" onClick={trigger}>💀 TRIGGER NOW</B>
        <B c="ghost" onClick={cancel}>🛑 Cancel</B>
      </div>
    </div>
    <FB title="EVENT CONFIGURATION">
      <div className="ap-note">Defaults: 13h interval · 3 waves · 40 zombies · 10min gap · 80–150 tile spawn range.</div>
      {[
        ["Interval (hours)", "interval_hours", 0.5, 48, 0.5, "h"],
        ["Waves per Event", "waves", 1, 10, 1, ""],
        ["Zombies / Wave", "zombies_per_wave", 10, 200, 5, ""],
        ["Wave Gap (min)", "wave_interval_mins", 1, 60, 1, "m"],
        ["Min Spawn Dist", "min_spawn_distance", 20, 300, 5, " tiles"],
        ["Max Spawn Dist", "max_spawn_distance", 50, 500, 5, " tiles"],
      ].map(([label, key, min, max, step, suffix]) =>
        <div key={key} className="ap-sl">
          <label>{label}</label>
          <input type="range" min={min} max={max} step={step} value={c[key]} onChange={e => setC({ ...c, [key]: parseFloat(e.target.value) })} />
          <span className="ap-sl-v">{c[key]}{suffix}</span>
        </div>
      )}
      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <B c="gold" disabled={saving} onClick={() => save({ interval_hours: c.interval_hours, waves: c.waves, zombies_per_wave: c.zombies_per_wave, wave_interval_mins: c.wave_interval_mins, min_spawn_distance: c.min_spawn_distance, max_spawn_distance: c.max_spawn_distance })}>{saving ? "Saving..." : "Save Config"}</B>
        <B c="ghost" onClick={() => { setC(DEFAULTS); toast("Reset to defaults (not saved)", "info"); }}>Reset Defaults</B>
      </div>
    </FB>
  </>);
}
