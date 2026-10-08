"use client";
// @ts-nocheck
// Zombita's Cards (mod 1.7.146): a switch per card, the numbers (price, days, slots, card job pay, jobs a day, points to be
// offered), who holds what, give / take a card, add / take points, send a card job, every player with points. The game owns the cards, so
// every change is a REQUEST it runs within a few seconds (routers/cards.py -> Zomboid/Lua/zombita_cards_web_cmd.txt); the
// answer shows as a toast. The whole system's switch is in game: Zombita Control > MODS > Zombita's Cards.
import { useState, useEffect, useCallback } from "react";
import { fetchApi, postApi, relTime, bronzeToCoins, Title, TW, B, Load, Empty } from "./shared";

const mono = { fontFamily: "var(--mono)", fontSize: 12 };
const dim = { ...mono, color: "var(--textdim)" };
const hex = (c) => (Array.isArray(c) ? "#" + c.slice(0, 3).map((v) => Math.round(Math.max(0, Math.min(1, +v)) * 255).toString(16).padStart(2, "0")).join("") : "var(--accent)");
const left = (until) => {
  const s = Math.max(0, Math.floor(until - Date.now() / 1000));
  if (s >= 86400) return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

// the settings list comes from the game itself (state.settingRows) - see `groups` below

export default function CardsTab({ toast }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState(0);
  const [vals, setVals] = useState({});
  const [grant, setGrant] = useState({ player: "", card: "medic" });
  const [pts, setPts] = useState({ player: "", card: "medic", points: "" });
  const [job, setJob] = useState({ player: "", card: "medic", kind: "random" });
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    try { setD(await fetchApi("/api/admin/cards")); }
    catch (e) { toast?.("Cards: " + e.message, "error"); }
    setLoading(false);
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, waiting ? 3000 : 20000); return () => clearInterval(t); }, [load, waiting]);

  const send = async (cmd, args = {}) => {
    try {
      const r = await postApi("/api/admin/cards/cmd", { cmd, ...args });
      setWaiting((w) => w + 1);
      toast?.("Sent to the game...", "info");
      for (let i = 0; i < 25; i++) {
        await new Promise((ok) => setTimeout(ok, 1500));
        const a = await fetchApi(`/api/admin/cards/requests/${r.id}`).catch(() => ({}));
        if (a.done) { toast?.(a.msg || (a.ok ? "Done" : "Failed"), a.ok ? "success" : "error"); break; }
        if (i === 24) toast?.("The game hasn't answered yet. Is the server up?", "error");
      }
      setWaiting((w) => Math.max(0, w - 1));
      load();
    } catch (e) { toast?.(e.message, "error"); }
  };

  if (loading) return <Load />;
  const s = d?.state || {};
  const cards = s.cards || [];
  // every setting the game keeps, in its groups, in the game's order (ZCards_Server.lua S.SETTING_ROWS)
  const groups = [];
  for (const row of s.settingRows || []) {
    let g = groups.find((x) => x[0] === (row.group || "Other"));
    if (!g) { g = [row.group || "Other", []]; groups.push(g); }
    g[1].push(row);
  }
  const jobKinds = cards.find((c) => c.id === job.card)?.kinds || [];     // mod 1.7.154 lists each card's job kinds
  const players = (s.players || []).filter((p) => !filter || p.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div>
      <Title t="ZOMBITA'S CARDS" s="Role cards: a switch per card, the numbers, who holds what. Every change is a request the game runs within a few seconds." />
      {!d?.ready && <div className="ap-note danger">No word from the game yet. Cards need mod 1.7.146 on the server and the cards bot zips.</div>}
      {d?.ready && s.stale && <div className="ap-note danger">The game last reported {relTime(s.at)}. The server may be down or restarting; requests wait until it's back.</div>}
      {waiting > 0 && <div className="ap-note info">Waiting for the game to answer...</div>}

      {d?.ready && (
        <>
          <TW title="THE WHOLE SYSTEM" right={
            <B c={s.on ? "red" : "green"} disabled={waiting > 0}
               onClick={() => { if (confirm(s.on ? "Turn Zombita's Cards OFF for everyone? Held cards run out as normal; no new cards, jobs or shop." : "Turn Zombita's Cards ON? Only the cards switched ON below can be bought, earned or worked.")) send("system", { value: !s.on }); }}>
              {s.on ? "TURN OFF" : "TURN ON"}
            </B>}>
            <div style={{ ...mono, fontSize: 14 }}>
              Zombita's Cards are <b style={{ color: s.on ? "var(--green, #4caf7d)" : "var(--red, #e05555)" }}>{s.on ? "ON" : "OFF"}</b>
              <span style={dim}> (the same switch as Zombita Control &gt; MODS in game)</span>
            </div>
          </TW>
          <TW title="THE CARDS">
            <table className="ap-t">
              <thead><tr><th>Card</th><th>Switch</th><th>Slots in use</th><th>Held by</th><th>Lately</th></tr></thead>
              <tbody>
                {cards.map((c) => (
                  <tr key={c.id}>
                    <td style={{ color: hex(c.color), fontWeight: 600 }}>{c.name}</td>
                    <td>
                      <B sm c={c.on ? "green" : "ghost"} disabled={waiting > 0}
                         onClick={() => send("setting", { key: "card_" + c.id, value: !c.on })}>{c.on ? "ON" : "OFF"}</B>
                    </td>
                    <td style={mono}>bought {c.bought}/{s.boughtSlots} · earned {c.earned}/{s.earnedSlots}</td>
                    <td style={mono}>
                      {(c.holders || []).length === 0 ? <span style={dim}>nobody</span> : c.holders.map((h) => (
                        <div key={h.name}>
                          {h.name} <span style={dim}>({h.how}, {left(h.until)} left)</span>{" "}
                          <B sm c="red" disabled={waiting > 0} onClick={() => { if (confirm(`Take ${h.name}'s ${c.name} card back?`)) send("revoke", { player: h.name }); }}>take back</B>
                        </div>
                      ))}
                    </td>
                    <td style={mono}>{(c.top || []).filter((t) => t.recent > 0).slice(0, 3).map((t) => `${t.name} ${t.recent}`).join(", ") || <span style={dim}>-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ap-note" style={{ marginTop: 10 }}>
              A card that is OFF can't be bought, earned or worked. Holders keep it to the end. Turn a card on once its jobs and perks are what you want.
            </div>
          </TW>

          {groups.map(([group, rows]) => (
            <TW key={group} title={"SETTINGS: " + group.toUpperCase()}>
              <table className="ap-t">
                <tbody>
                  {rows.map((n) => {
                    const money = ["price", "deliveryMin", "deliveryMax"].includes(n.key);
                    return (
                      <tr key={n.key}>
                        <td style={{ width: 280 }}>{n.label}</td>
                        <td style={{ ...mono, width: 120, color: "var(--accent)" }}>{money ? bronzeToCoins(n.value) : String(n.value ?? "-")}</td>
                        <td style={{ width: 170 }}>
                          <input className="ap-search" style={{ width: 90 }} value={vals[n.key] ?? ""} placeholder={String(n.min) + "-" + String(n.max)}
                                 onChange={(e) => setVals((v) => ({ ...v, [n.key]: e.target.value }))} />
                          <B sm disabled={waiting > 0 || vals[n.key] === undefined || vals[n.key] === ""}
                             onClick={() => { send("setting", { key: n.key, value: vals[n.key] }); setVals((v) => ({ ...v, [n.key]: "" })); }}>SET</B>
                        </td>
                        <td style={dim}>{n.help}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TW>
          ))}
          {groups.length === 0 && <div className="ap-note danger">The game hasn't sent its settings list yet (an older 1.7.146 build?). Upload the latest mod.</div>}

          <TW title="GIVE A CARD / POINTS / A CARD JOB">
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
              <span style={dim}>Give</span>
              <input className="ap-search" style={{ width: 160 }} placeholder="in-game name" value={grant.player} onChange={(e) => setGrant({ ...grant, player: e.target.value })} />
              <select className="ap-sel" style={{ width: 150 }} value={grant.card} onChange={(e) => setGrant({ ...grant, card: e.target.value })}>
                {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <B sm disabled={waiting > 0 || !grant.player.trim()} onClick={() => send("grant", grant)}>GIVE</B>
              <span style={dim}>Free, for the usual days. It replaces the card they hold.</span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={dim}>Points</span>
              <input className="ap-search" style={{ width: 160 }} placeholder="in-game name" value={pts.player} onChange={(e) => setPts({ ...pts, player: e.target.value })} />
              <select className="ap-sel" style={{ width: 150 }} value={pts.card} onChange={(e) => setPts({ ...pts, card: e.target.value })}>
                {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input className="ap-search" style={{ width: 90 }} placeholder="+20 / -20" value={pts.points} onChange={(e) => setPts({ ...pts, points: e.target.value })} />
              <B sm disabled={waiting > 0 || !pts.player.trim() || !Number(pts.points)} onClick={() => send("points", { ...pts, points: Number(pts.points) })}>ADD</B>
              <span style={dim}>Plus adds to lifetime and recent points; minus takes from lifetime only.</span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
              <span style={dim}>Send a card job</span>
              <input className="ap-search" style={{ width: 160 }} placeholder="in-game name" value={job.player} onChange={(e) => setJob({ ...job, player: e.target.value })} />
              <select className="ap-sel" style={{ width: 150 }} value={job.card} onChange={(e) => setJob({ ...job, card: e.target.value, kind: "random" })}>
                {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="ap-sel" style={{ width: 160 }} value={job.kind} onChange={(e) => setJob({ ...job, kind: e.target.value })}>
                <option value="random">Any kind</option>
                {jobKinds.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
              <B sm disabled={waiting > 0 || !job.player.trim()} onClick={() => send("job", job)}>SEND</B>
              <span style={dim}>Now, to a player who is online. Gives them the card first if they don't hold it. Not counted in their jobs a day.</span>
            </div>
          </TW>

          <TW title={`PLAYERS WITH POINTS (${(s.players || []).length})`}
              right={<input className="ap-search" style={{ width: 180 }} placeholder="filter by name" value={filter} onChange={(e) => setFilter(e.target.value)} />}>
            {players.length === 0 ? <Empty text="Nobody has card points yet" /> : (
              <table className="ap-t">
                <thead><tr><th>Player</th><th>Holds</th>{cards.map((c) => <th key={c.id} style={{ color: hex(c.color) }}>{c.name}</th>)}</tr></thead>
                <tbody>
                  {players.slice(0, 200).map((p) => (
                    <tr key={p.name}>
                      <td>{p.name}</td>
                      <td style={mono}>{p.card ? `${p.card} (${p.how}, ${left(p.until)})` : <span style={dim}>-</span>}</td>
                      {cards.map((c) => {
                        const v = p.pts?.[c.id];
                        return <td key={c.id} style={mono} title="lifetime / last 5 days">{v ? `${v[0]} / ${v[1]}` : <span style={dim}>-</span>}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="ap-note" style={{ marginTop: 10 }}>Points: lifetime (sets the rank) / last 5 days (decides who is offered the earned slot). Updated {relTime(s.at)}.</div>
          </TW>
        </>
      )}
    </div>
  );
}
