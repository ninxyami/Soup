"use client";
// @ts-nocheck
// Faction spaces: every in-game faction Zombita knows (locked / unlocked, channel, wallet, pictures),
// the money settings (unlock fee, war wager minimum, war tax), and the moderation buttons — remove a
// logo or banner someone shouldn't have uploaded. The bot (cogs/factions.py) does the Discord work.
import { useState, useEffect, useCallback } from "react";
import { fetchApi, postApi, Title, TW, B, Inp, Load, Empty } from "./shared";
import { API } from "@/lib/constants";

const mono = { fontFamily: "var(--mono)", fontSize: 12 };
const fmt = (b) => {
  b = Math.max(0, Math.floor(b || 0));
  const g = Math.floor(b / 10000), s = Math.floor((b % 10000) / 1000), br = b % 1000, out = [];
  if (g) out.push(`${g} gold`); if (s) out.push(`${s} silver`); if (br || !out.length) out.push(`${br} bronze`);
  return out.join(" ");
};
const day = (ts) => (ts ? new Date(ts * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");

export default function FactionsTab({ toast }) {
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await fetchApi("/api/admin/factions");
      setData(d); setSettings(d.settings || {});
    } catch (e) { toast(e.message, "error"); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    setBusy(true);
    try {
      const r = await postApi("/api/admin/factions/settings", { unlock_fee: settings.unlock_fee, min_wager: settings.min_wager, war_tax_pct: settings.war_tax_pct });
      toast("Settings saved.", "success"); setSettings(r.settings);
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };
  const removePic = async (fid, kind, name) => {
    if (!confirm(`Remove the ${kind} of ${name}?`)) return;
    setBusy(true);
    try { await postApi(`/api/admin/factions/${fid}/picture/${kind}/remove`); toast(`${kind} removed.`, "success"); await load(); }
    catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  if (!data) return <Load />;
  const rows = data.factions || [];
  const live = rows.filter((r) => !r.disbanded_at);
  const gone = rows.filter((r) => r.disbanded_at);

  return (
    <div>
      <Title t="Factions" s="In-game factions and their spaces. Zombita makes the channel and page once the founder unlocks it; you set the prices and can pull a picture." />

      <TW title="Money settings" right={<B sm disabled={busy} onClick={saveSettings}>Save</B>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(160px, 220px))", gap: 12 }}>
          <Inp label="Unlock fee (bronze)" type="number" min={0} value={settings.unlock_fee ?? ""} onChange={(e) => setSettings({ ...settings, unlock_fee: Number(e.target.value) })} />
          <Inp label="Minimum war wager (bronze, per side)" type="number" min={0} value={settings.min_wager ?? ""} onChange={(e) => setSettings({ ...settings, min_wager: Number(e.target.value) })} />
          <Inp label="War tax (% of the pot, to the treasury)" type="number" min={0} max={50} value={settings.war_tax_pct ?? ""} onChange={(e) => setSettings({ ...settings, war_tax_pct: Number(e.target.value) })} />
        </div>
        <div style={{ ...mono, color: "#777", marginTop: 6 }}>
          Unlock = {fmt(settings.unlock_fee)}. A war at the minimum: pot {fmt(2 * (settings.min_wager || 0))}, Zombita keeps {fmt(Math.floor(2 * (settings.min_wager || 0) * (settings.war_tax_pct || 0) / 100))}, the winner gets {fmt(2 * (settings.min_wager || 0) - Math.floor(2 * (settings.min_wager || 0) * (settings.war_tax_pct || 0) / 100))}.
        </div>
      </TW>

      <TW title={`Factions (${live.length})`} right={<B sm c="gray" onClick={load}>Refresh</B>}>
        {!live.length ? <Empty text="No factions yet." /> : (
          <table className="ap-t">
            <thead><tr><th>Faction</th><th>Owner</th><th>Members</th><th>State</th><th>Wallet</th><th>Pictures</th><th>Links</th></tr></thead>
            <tbody>
              {live.map((r) => (
                <tr key={r.fid}>
                  <td><b>{r.name}</b>{r.tag ? <span style={{ color: "#c8a84b", marginLeft: 6 }}>[{r.tag}]</span> : null}<div style={{ ...mono, color: "#666" }}>{r.fid} · founded {day(r.since)}</div></td>
                  <td>{r.owner || "?"}{r.coleaders?.length ? <div style={{ ...mono, color: "#777" }}>co: {r.coleaders.join(", ")}</div> : null}</td>
                  <td>{r.members?.length || 0}<div style={{ ...mono, color: "#666", maxWidth: 220, whiteSpace: "normal" }}>{(r.members || []).join(", ")}</div></td>
                  <td style={{ color: r.unlocked_at ? "#4a7c59" : "#c8a84b" }}>{r.unlocked_at ? `unlocked ${day(r.unlocked_at)} by ${r.unlocked_by}` : "locked"}{r.channel_id ? <div style={{ ...mono, color: "#777" }}>channel {r.channel_id}</div> : null}</td>
                  <td style={mono}>{fmt(r.wallet)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {r.pictures?.logo ? <img src={`${API}${r.pictures.logo}`} alt="" style={{ width: 28, height: 28, objectFit: "cover", border: "1px solid #333" }} /> : <span style={{ ...mono, color: "#555" }}>no logo</span>}
                      {r.pictures?.logo && <B sm c="red" disabled={busy} onClick={() => removePic(r.fid, "logo", r.name)}>✕ logo</B>}
                      {r.pictures?.banner ? <img src={`${API}${r.pictures.banner}`} alt="" style={{ width: 80, height: 20, objectFit: "cover", border: "1px solid #333" }} /> : <span style={{ ...mono, color: "#555" }}>no banner</span>}
                      {r.pictures?.banner && <B sm c="red" disabled={busy} onClick={() => removePic(r.fid, "banner", r.name)}>✕ banner</B>}
                    </div>
                  </td>
                  <td style={mono}><a href={`/faction?id=${r.fid}`} target="_blank" rel="noreferrer">page ↗</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TW>

      {gone.length > 0 && (
        <TW title={`Disbanded (${gone.length})`}>
          <div style={{ ...mono, color: "#777" }}>
            {gone.map((r) => <div key={r.fid}>{r.name}{r.tag ? ` [${r.tag}]` : ""} · {day(r.since)} – {day(r.disbanded_at)} · owner {r.owner} · wallet left {fmt(r.wallet)} · <a href={`/faction?id=${r.fid}`} target="_blank" rel="noreferrer">page ↗</a></div>)}
          </div>
        </TW>
      )}
    </div>
  );
}
