"use client";
// @ts-nocheck
import { useState, useEffect, useMemo } from "react";
import { fetchApi, postApi, fmt, bronzeToCoins, relTime, fmtDate, Title, SC, TW, B, Inp, FB, Empty, Load, EvBadge } from "./shared";

const PlayerDetail = ({ p, onBack, toast }) => {
  const ww = p.werewolf || {}, rps = p.rps || {}, c4 = p.connect4 || {};
  const [txns, setTxns] = useState([]);
  const [txnLoading, setTxnLoading] = useState(false);
  const [showTxns, setShowTxns] = useState(false);
  const [giveAmt, setGiveAmt] = useState(""); const [giveReason, setGiveReason] = useState("");
  const [takeAmt, setTakeAmt] = useState(""); const [takeReason, setTakeReason] = useState("");

  const loadTxns = async () => {
    setTxnLoading(true);
    try { const r = await fetchApi(`/api/admin/economy/player-transactions?discord_id=${p.discord_id}&limit=30`); setTxns(r.transactions || []); }
    catch (e) { toast(e.message, "error"); }
    setTxnLoading(false); setShowTxns(true);
  };
  const giveCoins = async () => {
    if (!giveAmt) { toast("Enter amount", "error"); return; }
    try { const r = await postApi("/api/admin/economy/give-by-name", { name: p.display_name, amount: parseInt(giveAmt), reason: giveReason || "Admin grant" }); toast(`Sent ${fmt(giveAmt)} 🟤 to ${r.player}`, "success"); setGiveAmt(""); setGiveReason(""); }
    catch (e) { toast(e.message, "error"); }
  };
  const takeCoins = async () => {
    if (!takeAmt) { toast("Enter amount", "error"); return; }
    try { const r = await postApi("/api/admin/economy/take-by-name", { name: p.display_name, amount: parseInt(takeAmt), reason: takeReason || "Admin deduction" }); toast(`Took ${fmt(takeAmt)} 🟤 from ${r.player}`, "success"); setTakeAmt(""); setTakeReason(""); }
    catch (e) { toast(e.message, "error"); }
  };

  return (<>
    <div style={{ marginBottom: 20 }}><B c="ghost" sm onClick={onBack}>← Back to Players</B></div>
    <div style={{ fontFamily: "var(--display)", fontSize: 32, letterSpacing: 3, color: "var(--accent)", marginBottom: 4 }}>{p.display_name}</div>
    <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", marginBottom: 28 }}>
      ID: {p.discord_id} · {p.username ? `@${p.username} · ` : ""}Joined: {fmtDate(p.first_seen)} · Last seen: {relTime(p.last_seen)}
    </div>
    <div className="ap-sr">
      <SC label="Balance" value={bronzeToCoins(p.balance)} />
      <SC label="Messages" value={fmt(p.message_count)} color="blue" />
      <SC label="WW Wins" value={ww.games_won ?? 0} color="green" sub={`${ww.games_played ?? 0} played`} />
      <SC label="Win Rate" value={`${ww.win_rate ?? 0}%`} color="orange" />
    </div>
    <div className="ap-3c">
      <FB title="WEREWOLF">
        <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", lineHeight: 2.2 }}>
          Played: {ww.games_played ?? 0}<br />Won: <span style={{ color: "var(--green)" }}>{ww.games_won ?? 0}</span><br />
          Survived: {ww.times_survived ?? 0}<br />Lynched: <span style={{ color: "var(--red)" }}>{ww.times_lynched ?? 0}</span><br />
          Times Wolf: <span style={{ color: "var(--orange)" }}>{ww.times_wolf ?? 0}</span><br />Streak: <span style={{ color: "var(--accent)" }}>{ww.streak ?? 0}</span>
        </div>
      </FB>
      <FB title="ROCK PAPER SCISSORS">
        <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", lineHeight: 2.2 }}>
          W/L/D: <span style={{ color: "var(--green)" }}>{rps.wins ?? 0}</span> / <span style={{ color: "var(--red)" }}>{rps.losses ?? 0}</span> / {rps.draws ?? 0}<br />
          Win Rate: {rps.win_rate ?? 0}%<br />Earned: <span style={{ color: "var(--green)" }}>+{fmt(rps.coins_won ?? 0)}</span><br />
          Lost: <span style={{ color: "var(--red)" }}>−{fmt(rps.coins_lost ?? 0)}</span><br />vs Zombita: {rps.vs_zombita_wins ?? 0}W / {rps.vs_zombita_losses ?? 0}L
        </div>
      </FB>
      <FB title="CONNECT 4">
        <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", lineHeight: 2.2 }}>
          W/L/D: <span style={{ color: "var(--green)" }}>{c4.wins ?? 0}</span> / <span style={{ color: "var(--red)" }}>{c4.losses ?? 0}</span> / {c4.draws ?? 0}<br />
          Win Rate: {c4.win_rate ?? 0}%<br />Earned: <span style={{ color: "var(--green)" }}>+{fmt(c4.coins_won ?? 0)}</span><br />
          Lost: <span style={{ color: "var(--red)" }}>−{fmt(c4.coins_lost ?? 0)}</span><br />vs Zombita: {c4.vs_zombita_wins ?? 0}W / {c4.vs_zombita_losses ?? 0}L
        </div>
      </FB>
    </div>
    <div className="ap-2c">
      <FB title="GIVE COINS">
        <Inp label="Amount (bronze)" type="number" placeholder="5000" value={giveAmt} onChange={e => setGiveAmt(e.target.value)} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0 12px" }}>{[500, 1000, 5000, 10000].map(n => <button key={n} className="ap-pre" onClick={() => setGiveAmt(String(n))}>{fmt(n)}</button>)}</div>
        <Inp label="Reason" placeholder="Event prize..." value={giveReason} onChange={e => setGiveReason(e.target.value)} />
        <B c="green" onClick={giveCoins}>💸 Give Coins</B>
      </FB>
      <FB title="TAKE COINS">
        <Inp label="Amount (bronze)" type="number" placeholder="5000" value={takeAmt} onChange={e => setTakeAmt(e.target.value)} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0 12px" }}>{[500, 1000, 5000, 10000].map(n => <button key={n} className="ap-pre" onClick={() => setTakeAmt(String(n))}>{fmt(n)}</button>)}</div>
        <Inp label="Reason" placeholder="Penalty, correction..." value={takeReason} onChange={e => setTakeReason(e.target.value)} />
        <B c="red" onClick={takeCoins}>➖ Take Coins</B>
      </FB>
    </div>
    <div style={{ marginTop: 8 }}>
      {!showTxns
        ? <B c="ghost" onClick={loadTxns}>📋 Load Transaction History</B>
        : txnLoading ? <Load />
        : <TW title="TRANSACTION HISTORY" right={<B c="ghost" sm onClick={loadTxns}>↻</B>}>
            {txns.length ? <div>{txns.map((e, i) => <div key={i} className="ap-lr">
              <span className="ap-lr-t">{relTime(e.timestamp)}</span>
              <EvBadge type={e.type || "adjust"} />
              <span className="ap-lr-d">{e.description || "—"}</span>
              <span className={`ap-lr-v ${e.amount > 0 ? "pos" : "neg"}`}>{e.amount > 0 ? "+" : ""}{fmt(e.amount)} 🟤</span>
              <span style={{ color: "var(--textdim)", fontFamily: "var(--mono)", fontSize: 11, minWidth: 80, textAlign: "right" }}>→ {fmt(e.balance_after)}</span>
            </div>)}</div> : <Empty text="no transactions" />}
          </TW>}
    </div>
  </>);
};

export default function PlayersTab({ toast }) {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        // /api/players returns { players: [...] } with full player list
        const data = await fetchApi("/api/players");
        setPlayers(data.players || []);
      } catch {
        toast("Failed to load players", "error");
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return players;
    const q = search.toLowerCase();
    return players.filter(p =>
      p.display_name?.toLowerCase().includes(q) ||
      String(p.discord_id).includes(q) ||
      p.username?.toLowerCase().includes(q)
    );
  }, [players, search]);

  const loadDetail = async (id) => {
    try { setSelected(await fetchApi(`/api/stats/player/${id}`)); }
    catch { toast("Failed to load player", "error"); }
  };

  if (selected) return <PlayerDetail p={selected} onBack={() => setSelected(null)} toast={toast} />;

  const [online, setOnline] = useState(null);
  useEffect(() => {
    const load = async () => {
      try { setOnline(await fetchApi("/api/admin/server/online-players")); }
      catch { setOnline({ players: [], count: 0 }); }
    };
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  const active30d = players.filter(p => p.last_seen && (Date.now() / 1000 - p.last_seen) < 2592000).length;

  return (<>
    <Title t="PLAYERS" s="community roster · stats · profiles" />
    <div className="ap-sr" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
      <SC label="Total Players" value={players.length} />
      <SC label="Active (30d)" value={active30d} color="green" />
      <SC label="In-Game Now" value={online?.count ?? "—"} color="orange"
        sub={online?.players?.length ? online.players.slice(0, 3).join(", ") + (online.players.length > 3 ? "…" : "") : "nobody online"} />
      <SC label="Shown" value={filtered.length} color="blue" />
    </div>
    <TW title="ROSTER" right={
      <input className="ap-search" placeholder="search name, id, username..." value={search} onChange={e => setSearch(e.target.value)} />
    }>
      {loading ? <Load /> : <table className="ap-t">
        <thead><tr><th>Player</th><th>Username</th><th>Messages</th><th>Games</th><th>Win Rate</th><th>Last Seen</th><th></th></tr></thead>
        <tbody>
          {filtered.length === 0
            ? <tr><td colSpan={7}><Empty text="no players found" /></td></tr>
            : filtered.slice(0, 100).map(p => {
                const wr = p.games_played > 0 ? Math.round(p.games_won / p.games_played * 100) : 0;
                return <tr key={p.discord_id}>
                  <td><div style={{ fontWeight: 500 }}>{p.display_name}</div><div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)" }}>{p.discord_id}</div></td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>{p.username ? `@${p.username}` : "—"}</td>
                  <td style={{ fontFamily: "var(--mono)" }}>{fmt(p.message_count)}</td>
                  <td style={{ fontFamily: "var(--mono)" }}>{p.games_played || 0}</td>
                  <td style={{ fontFamily: "var(--mono)", color: wr > 50 ? "var(--green)" : "var(--textdim)" }}>{wr}%</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>{relTime(p.last_seen)}</td>
                  <td><B c="blue" sm onClick={() => loadDetail(p.discord_id)}>View</B></td>
                </tr>;
              })}
        </tbody>
      </table>}
    </TW>
  </>);
}
