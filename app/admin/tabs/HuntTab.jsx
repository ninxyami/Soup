"use client";
// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { fetchApi, postApi, relTime, fmtFull, HUNT_TYPES, HUNT_REGIONS, Title, SC, TW, B, Inp, Sel, FB, Empty, Load, Toggle } from "./shared";

const SchedulerConfigForm = ({ c, onSave }) => {
  const [interval, setInterval] = useState(String(c.interval_hours || 6));
  const [duration, setDuration] = useState(String(c.duration_mins || 30));
  return (<><Inp label="Interval (hours)" type="number" step="0.5" value={interval} onChange={e => setInterval(e.target.value)} /><Inp label="Default Duration (min)" type="number" value={duration} onChange={e => setDuration(e.target.value)} /><B c="gold" onClick={() => onSave({ interval_hours: parseFloat(interval) || 6, duration_mins: parseInt(duration) || 30 })}>Save</B></>);
};

export default function HuntTab({ toast }) {
  const [c, setC] = useState({ enabled: 1, interval_hours: 6, duration_mins: 30 });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tType, setTType] = useState(""); const [tRegion, setTRegion] = useState(""); const [tDur, setTDur] = useState("30");

  const load = useCallback(async () => {
    try { const cfg = await fetchApi("/api/admin/hunt/config"); setC(cfg); } catch {}
    try { const h = await fetchApi("/api/admin/hunt/history?limit=50"); setHistory(h.history || []); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const updateConfig = async (updates) => {
    try { await postApi("/api/admin/hunt/update", updates); toast("Config updated", "success"); load(); }
    catch (e) { toast(e.message, "error"); }
  };
  const trigger = async () => {
    try {
      const r = await postApi("/api/admin/hunt/trigger", { hunt_type: tType || null, region: tRegion || null, duration: parseInt(tDur) || 30 });
      toast(`🗺️ Hunt triggered! (${r.hunt_type} @ ${r.region})`, "success");
      setTimeout(load, 1000);
    } catch (e) { toast(e.message, "error"); }
  };
  const cancel = async () => {
    try { await postApi("/api/admin/hunt/cancel", {}); toast("🛑 Hunt cancelled", "success"); }
    catch (e) { toast(e.message, "error"); }
  };

  if (loading) return <><Title t="TREASURE HUNT" s="world events" /><Load /></>;

  return (<>
    <Title t="TREASURE HUNT" s="triggers · scheduling · history" />
    <div className="ap-sr" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
      <div className="ap-sc" style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Toggle on={!!c.enabled} onClick={() => updateConfig({ enabled: c.enabled ? 0 : 1 })} />
        <div><div className="ap-sc-l">Auto Scheduler</div><div style={{ fontFamily: "var(--display)", fontSize: 22, letterSpacing: 2, color: c.enabled ? "var(--green)" : "var(--red)" }}>{c.enabled ? "ENABLED" : "DISABLED"}</div></div>
      </div>
      <SC label="Interval" value={`${c.interval_hours}h`} color="blue" sub={`${c.duration_mins}min default duration`} />
      <SC label="Last Hunt" value={c.last_hunt_at ? relTime(c.last_hunt_at) : "never"} color="orange" sub={c.last_hunt_at ? fmtFull(c.last_hunt_at) : ""} />
    </div>
    <div className="ap-2c">
      <FB title="TRIGGER HUNT">
        <div className="ap-note">Leave type/region blank for random. The bot will pick it up and execute.</div>
        <Sel label="Hunt Type" value={tType} onChange={e => setTType(e.target.value)}>
          <option value="">🎲 Random</option>
          {HUNT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </Sel>
        <Sel label="Region" value={tRegion} onChange={e => setTRegion(e.target.value)}>
          <option value="">🎲 Random</option>
          {HUNT_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </Sel>
        <Inp label="Duration (min)" type="number" value={tDur} onChange={e => setTDur(e.target.value)} />
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <B c="gold" onClick={trigger}>🗺️ TRIGGER HUNT</B>
          <B c="ghost" onClick={cancel}>🛑 Cancel Active</B>
        </div>
      </FB>
      <FB title="SCHEDULER CONFIG">
        <div className="ap-note info">Changes take effect on next auto-trigger.</div>
        <SchedulerConfigForm c={c} onSave={updateConfig} />
      </FB>
    </div>
    <TW title="HUNT HISTORY" right={<B c="ghost" sm onClick={load}>↻</B>}>
      {history.length ? <table className="ap-t"><thead><tr><th>Type</th><th>Region</th><th>Outcome</th><th>Winner</th><th>Zombies</th><th>Triggered By</th><th>Started</th></tr></thead>
        <tbody>{history.map((h, i) => <tr key={i}>
          <td><span className="ap-pill ap-tier-rare">{(h.hunt_type || "").charAt(0).toUpperCase() + (h.hunt_type || "").slice(1)}</span></td>
          <td style={{ fontFamily: "var(--mono)" }}>{h.region || "—"}</td>
          <td><span className={`ap-pill ${h.outcome === "claimed" ? "ap-tier-uncommon" : "ap-tier-common"}`}>{h.outcome || "running"}</span></td>
          <td style={{ fontFamily: "var(--mono)", color: "var(--accent)" }}>{h.winner || "—"}</td>
          <td style={{ fontFamily: "var(--mono)" }}>{h.zombie_count || "—"}</td>
          <td style={{ fontFamily: "var(--mono)", color: "var(--textdim)" }}>{h.triggered_by || "auto"}</td>
          <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>{fmtFull(h.started_at)}</td>
        </tr>)}</tbody></table> : <Empty text="no hunt history yet" />}
    </TW>
  </>);
}
