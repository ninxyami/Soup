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
  const [champion, setChampion] = useState(null);
  const [busy, setBusy] = useState(false);
  const [wars, setWars] = useState(null);
  const [arena, setArena] = useState({ name: "", kind: "town", town: "", x1: "", y1: "", x2: "", y2: "", exit_x: "", exit_y: "", exit_z: 0, start_ax: "", start_ay: "", start_bx: "", start_by: "" });

  const load = useCallback(async () => {
    try {
      const d = await fetchApi("/api/admin/factions");
      setData(d); setSettings(d.settings || {}); setText(d.text || {}); setChampion(d.champion || null);
      try { setWars(await fetchApi("/api/admin/wars")); } catch (e) { setWars({ error: e.message }); }
    } catch (e) { toast(e.message, "error"); }
  }, [toast]);
  const addArena = async () => {
    setBusy(true);
    try { const r = await postApi("/api/admin/wars/arenas", arena); toast(r.message, "success"); setArena({ ...arena, name: "" }); await load(); }
    catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };
  const voidWar = async (id) => {
    const reason = prompt("Void war #" + id + " (both wagers go back). Reason?", "");
    if (reason === null) return;
    setBusy(true);
    try { const r = await postApi(`/api/admin/wars/${id}/void`, { reason }); toast(r.message, "success"); await load(); }
    catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };
  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    setBusy(true);
    try {
      const r = await postApi("/api/admin/factions/settings", { ...settings, ...text });
      toast("Settings saved.", "success"); setSettings(r.settings); if (r.text) setText(r.text);
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };
  const crownNow = async () => {
    if (!confirm("Crown the champion of the last 7 days now, with the reward set above? (Mondays this happens by itself.)")) return;
    setBusy(true);
    try { const r = await postApi("/api/admin/factions/award"); toast(r.message, "success"); await load(); }
    catch (e) { toast(e.message, "error"); }
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

      <TW title="Faction, war, claim & reward settings" right={<B sm disabled={busy} onClick={saveSettings}>Save all</B>}>
        <div style={{ ...mono, color: "#c8a84b", marginBottom: 4 }}>Money</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(150px, 220px))", gap: 12 }}>
          {num("unlock_fee", "Unlock fee (bronze)")}
          {num("min_wager", "Minimum war wager (bronze, per side)")}
          {num("war_tax_pct", "War tax (% of the pot, to the treasury)", { max: 50 })}
          <Inp label="Public war channel (Discord channel id)" value={settings.war_channel ?? ""} onChange={(e) => setSettings({ ...settings, war_channel: e.target.value })} />
        </div>
        <div style={{ ...mono, color: "#777", marginTop: 6 }}>
          Unlock = {fmt(settings.unlock_fee)}. A war at the minimum: pot {fmt(2 * (settings.min_wager || 0))}, Zombita keeps {fmt(Math.floor(2 * (settings.min_wager || 0) * (settings.war_tax_pct || 0) / 100))}, the winner gets {fmt(2 * (settings.min_wager || 0) - Math.floor(2 * (settings.min_wager || 0) * (settings.war_tax_pct || 0) / 100))}.
        </div>
        <div style={{ ...mono, color: "#c8a84b", margin: "12px 0 4px" }}>War rules</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(150px, 220px))", gap: 12 }}>
          {num("war_roster", "Fighters a side (1–10)", { max: 10, min: 1 })}
          {num("war_length", "War length (seconds; 7200 = 2 h)")}
          {num("war_grace", "Grace to join at the desk / offline (seconds)")}
          {num("war_crowd_warn", "Crowd warning before the teleport (seconds)")}
          {num("war_fog_damage", "Battle royale: fog damage outside the zone (tenths per body part per second)")}
          {num("war_hud_bars", "War HUD: comrades' life bars (1 = shown, 0 = hidden)", { max: 1 })}
          {num("war_dotd", "Dawn of the Dead during wars (0 = blocked, a running one is cancelled at the bell; 1 = allowed)", { max: 1 })}
          {num("war_desk_x", "War desk x (the diner; 0,0 = join from anywhere)")}
          {num("war_desk_y", "War desk y")}
          {num("war_desk_z", "War desk z (floor)")}
          <Inp label="Restart times to keep wars clear of (HH:MM, server time; empty = read from the crontab)" value={text.war_blackouts ?? ""} placeholder="00:00,06:00,12:00,18:00" onChange={(e) => setText({ ...text, war_blackouts: e.target.value })} />
        </div>
        <div style={{ ...mono, color: "#777", marginTop: 6 }}>Any restart (mod update, /restart_with_delay, the scheduled ones) pauses a live war on its warning: fighters are told to get somewhere safe, the war resumes after when everyone is back; anyone who dies meanwhile is out. The Discord restart commands ask &ldquo;a war is on — restart anyway?&rdquo; first.</div>
        <div style={{ ...mono, color: "#c8a84b", margin: "12px 0 4px" }}>Claims (the faction's safehouse, paid from its wallet; the tiers cost the difference)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(110px, 160px))", gap: 12 }}>
          {num("claim_t1", "Outpost cost")}{num("claim_r1", "Outpost radius (tiles)")}
          {num("claim_t2", "Compound cost")}{num("claim_r2", "Compound radius")}
          {num("claim_t3", "Stronghold cost")}{num("claim_r3", "Stronghold radius")}
        </div>
        <div style={{ ...mono, color: "#c8a84b", margin: "12px 0 4px" }}>Champion of the week (most war wins Mon–Mon; crowned every Monday)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(150px, 220px))", gap: 12 }}>
          <Inp label="Title" value={text.weekly_reward_title ?? ""} onChange={(e) => setText({ ...text, weekly_reward_title: e.target.value })} />
          {num("weekly_reward_bronze", "Bronze into the faction wallet (0 = none)")}
          <Inp label="Item id to the faction owner (empty = none)" value={text.weekly_reward_item ?? ""} placeholder="Base.Axe" onChange={(e) => setText({ ...text, weekly_reward_item: e.target.value })} />
          {num("weekly_reward_qty", "How many of the item (into the faction stash; one per fighter = 5)", { min: 1 })}
          {num("war_participation", "War participation reward (bronze to each fighter's own wallet, both sides)")}
        </div>
        <div style={{ ...mono, color: "#777", marginTop: 8, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span>Current champion: {champion?.fid ? <b style={{ color: "#c8a84b" }}>{champion.name}</b> : "nobody yet"}{champion?.fid ? ` — ${champion.wins} win(s), ${champion.week}` : ""}.</span>
          <B sm c="gray" disabled={busy} onClick={crownNow}>Crown now (last 7 days)</B>
          <span>The same settings are on Zombita Control → FACTIONS in game. Items go to the faction <b>stash</b> (members take one in game); a gift for a faction: the Stash button on its row.</span>
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

      <TW title="War arenas" right={<B sm disabled={busy || !arena.name || (arena.kind === "town" ? !arena.town : !arena.x1)} onClick={addArena}>Add arena</B>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <Inp label="Name" value={arena.name} onChange={(e) => setArena({ ...arena, name: e.target.value })} />
          <div className="ap-fg"><label className="ap-fl">Kind</label>
            <select className="ap-sel" value={arena.kind} onChange={(e) => setArena({ ...arena, kind: e.target.value })}><option value="town">a whole town (the recorder's area)</option><option value="rect">a rectangle (x1,y1 – x2,y2)</option></select></div>
          {arena.kind === "town" ? (
            <div className="ap-fg"><label className="ap-fl">Town</label>
              <select className="ap-sel" value={arena.town} onChange={(e) => setArena({ ...arena, town: e.target.value })}><option value="">pick…</option>{(wars?.towns || []).map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          ) : (<>
            <Inp label="x1" type="number" value={arena.x1} onChange={(e) => setArena({ ...arena, x1: e.target.value })} />
            <Inp label="y1" type="number" value={arena.y1} onChange={(e) => setArena({ ...arena, y1: e.target.value })} />
            <Inp label="x2" type="number" value={arena.x2} onChange={(e) => setArena({ ...arena, x2: e.target.value })} />
            <Inp label="y2" type="number" value={arena.y2} onChange={(e) => setArena({ ...arena, y2: e.target.value })} />
          </>)}
          <Inp label="Exit point x (outside; where the 6th+ is dropped)" type="number" value={arena.exit_x} onChange={(e) => setArena({ ...arena, exit_x: e.target.value })} />
          <Inp label="Exit point y" type="number" value={arena.exit_y} onChange={(e) => setArena({ ...arena, exit_y: e.target.value })} />
          <Inp label="Start A x (challenger's side, inside)" type="number" value={arena.start_ax} onChange={(e) => setArena({ ...arena, start_ax: e.target.value })} />
          <Inp label="Start A y" type="number" value={arena.start_ay} onChange={(e) => setArena({ ...arena, start_ay: e.target.value })} />
          <Inp label="Start B x (defender's side, inside, ≥20 tiles from A)" type="number" value={arena.start_bx} onChange={(e) => setArena({ ...arena, start_bx: e.target.value })} />
          <Inp label="Start B y" type="number" value={arena.start_by} onChange={(e) => setArena({ ...arena, start_by: e.target.value })} />
        </div>
        <div style={{ ...mono, color: "#777", marginTop: 6 }}>Coordinates as the game shows them (F11 / the AREAS tab). A town arena uses the stat recorder's town areas. Nobody walks in: at the bell the fighters right-click the <b>war desk</b> (set below, or in Zombita Control) and are teleported to their side's start point — so put A and B at opposite ends, and the exit outside. Easier in game: Zombita Control → FACTIONS, stand on each spot.</div>
        {wars?.arenas?.length ? (
          <table className="ap-t" style={{ marginTop: 8 }}>
            <thead><tr><th>Arena</th><th>Kind</th><th>Where</th><th>Exit</th><th>Active</th><th>Starts A / B</th><th></th></tr></thead>
            <tbody>{wars.arenas.map((a) => (
              <tr key={a.id}><td><b>{a.name}</b></td><td>{a.kind}</td><td style={mono}>{a.kind === "town" ? a.town : `${a.x1},${a.y1} – ${a.x2},${a.y2}`}</td><td style={mono}>{a.exit_x},{a.exit_y}</td><td style={{ color: a.active ? "#4a7c59" : "#a55" }}>{a.active ? "yes" : "no"}</td>
                <td style={mono}>{a.start_ax},{a.start_ay} / {a.start_bx},{a.start_by}</td><td><B sm c="gray" disabled={busy} onClick={async () => { await postApi(`/api/admin/wars/arenas/${a.id}/toggle`); await load(); }}>{a.active ? "Retire" : "Activate"}</B></td></tr>
            ))}</tbody>
          </table>
        ) : <div style={{ ...mono, color: "#555", marginTop: 8 }}>No arenas yet — wars can't be declared until there is one.</div>}
      </TW>

      <TW title="Wars" right={wars?.weekly?.length ? <span style={{ ...mono, color: "#c8a84b" }}>this week: {wars.weekly.map((w) => `${w.name} ${w.wins}`).join(" · ")}</span> : null}>
        {wars?.error ? <Empty text={wars.error} /> : !wars?.wars?.length ? <Empty text="No wars yet." /> : (
          <table className="ap-t">
            <thead><tr><th>#</th><th>Sides</th><th>Mode · arena</th><th>When</th><th>Wager</th><th>State</th><th>Result</th><th></th></tr></thead>
            <tbody>{wars.wars.map((w) => (
              <tr key={w.id}><td style={mono}>{w.id}</td><td>{w.challengerName} vs {w.defenderName}</td><td style={mono}>{w.modeText} · {w.arenaName}</td><td style={mono}>{w.whenText}</td><td style={mono}>{fmt(w.wager)}</td>
                <td style={{ color: w.state === "live" ? "#e55" : w.state === "accepted" ? "#4a7c59" : "#c8a84b" }}>{w.state}</td>
                <td style={mono}>{w.state === "finished" ? (w.result === "draw" ? "draw" : `${w.winnerName} +${fmt(w.pot - w.fee)} (tax ${fmt(w.fee)})`) : ""}{w.reason ? ` · ${w.reason}` : ""}</td>
                <td>{["proposed", "accepted", "live"].includes(w.state) && <B sm c="red" disabled={busy} onClick={() => voidWar(w.id)}>Void</B>}</td></tr>
            ))}</tbody>
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
