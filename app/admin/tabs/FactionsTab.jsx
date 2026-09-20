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
  const [text, setText] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await fetchApi("/api/admin/factions");
      setData(d); setSettings(d.settings || {}); setText(d.text || {});
    } catch (e) { toast(e.message, "error"); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    setBusy(true);
    try {
      const r = await postApi("/api/admin/factions/settings", { ...settings, ...text });
      toast("Settings saved.", "success"); setSettings(r.settings); if (r.text) setText(r.text);
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };
  const num = (key, label, extra = {}) => <Inp label={label} type="number" min={0} value={settings[key] ?? ""} onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })} {...extra} />;
  const giftStash = async (fid, name) => {
    const item = prompt(`Item id to put in ${name}'s stash (e.g. Base.Axe):`, "");
    if (!item) return;
    const qty = Number(prompt("How many?", "1") || 0);
    if (!qty) return;
    setBusy(true);
    try { const r = await postApi(`/api/admin/factions/${fid}/stash`, { item, qty }); toast(r.message, "success"); await load(); }
    catch (e) { toast(e.message, "error"); }
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

      <TW title="Faction & claim settings" right={<B sm disabled={busy} onClick={saveSettings}>Save all</B>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(150px, 220px))", gap: 12 }}>
          {num("unlock_fee", "Unlock fee (bronze)")}
          {num("remind_after", "Unlock reminder delay (seconds)")}
        </div>
        <div style={{ ...mono, color: "#777", marginTop: 6 }}>Unlock = {fmt(settings.unlock_fee)}, to the treasury.</div>
        <div style={{ ...mono, color: "#c8a84b", margin: "12px 0 4px" }}>Claims (the faction's safehouse, paid from its wallet; the tiers cost the difference)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(110px, 160px))", gap: 12 }}>
          {num("claim_t1", "Outpost cost")}{num("claim_r1", "Outpost radius (tiles)")}
          {num("claim_t2", "Compound cost")}{num("claim_r2", "Compound radius")}
          {num("claim_t3", "Stronghold cost")}{num("claim_r3", "Stronghold radius")}
        </div>
        <div style={{ ...mono, color: "#777", marginTop: 8 }}>The same settings are on Zombita Control → FACTIONS in game. Items go to the faction <b>stash</b> (members take one in game); a gift for a faction: the Stash button on its row.</div>
      </TW>

      <TW title={`Factions (${live.length})`} right={<B sm c="gray" onClick={load}>Refresh</B>}>
        {!live.length ? <Empty text="No factions yet." /> : (
          <table className="ap-t">
            <thead><tr><th>Faction</th><th>Owner</th><th>Members</th><th>State</th><th>Wallet</th><th>Pictures</th><th>Links</th></tr></thead>
            <tbody>
              {live.map((r) => (
                <tr key={r.fid}>
                  <td><b>{r.name}</b>{r.tag ? <span style={{ color: "#c8a84b", marginLeft: 6 }}>[{r.tag}]</span> : null}<div style={{ ...mono, color: "#666" }}>{r.fid} · founded {day(r.since)}</div></td>
                  <td>{r.owner || "?"}{r.recruiting ? <div style={{ ...mono, color: "#4a7c59" }}>recruiting</div> : null}</td>
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
                  <td style={mono}><a href={`/faction?id=${r.fid}`} target="_blank" rel="noreferrer">page ↗</a> <B sm c="gray" disabled={busy} onClick={() => giftStash(r.fid, r.name)}>Stash +</B></td>
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
