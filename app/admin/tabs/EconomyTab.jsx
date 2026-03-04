"use client";
// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { fetchApi, postApi, fmt, relTime, Title, TW, B, Inp, FB, Empty, Load, EvBadge } from "./shared";

export default function EconomyTab({ toast }) {
  const [tab, setTab] = useState("give");
  const [name, setName] = useState(""); const [amt, setAmt] = useState(""); const [reason, setReason] = useState("");
  const [txns, setTxns] = useState([]); const [txnId, setTxnId] = useState(""); const [txnLoading, setTxnLoading] = useState(false);
  const [allTxns, setAllTxns] = useState([]); const [allLoading, setAllLoading] = useState(false);

  const give = async () => {
    if (!name || !amt) { toast("Name and amount required", "error"); return; }
    try { const r = await postApi("/api/admin/economy/give-by-name", { name, amount: parseInt(amt), reason: reason || "Admin grant" }); toast(`Sent ${fmt(amt)} 🟤 to ${r.player}`, "success"); setAmt(""); setReason(""); }
    catch (e) { toast(e.message, "error"); }
  };
  const take = async () => {
    if (!name || !amt) { toast("Name and amount required", "error"); return; }
    try { const r = await postApi("/api/admin/economy/take-by-name", { name, amount: parseInt(amt), reason: reason || "Admin deduction" }); toast(`Took ${fmt(amt)} 🟤 from ${r.player}`, "success"); setAmt(""); setReason(""); }
    catch (e) { toast(e.message, "error"); }
  };
  const loadPlayerTxns = async () => {
    if (!txnId) { toast("Enter Discord ID", "error"); return; }
    setTxnLoading(true);
    try { const r = await fetchApi(`/api/admin/economy/player-transactions?discord_id=${txnId}&limit=50`); setTxns(r.transactions || []); }
    catch (e) { toast(e.message, "error"); }
    setTxnLoading(false);
  };
  const loadAllTxns = useCallback(async () => {
    setAllLoading(true);
    try { const r = await fetchApi("/api/admin/economy/transactions?limit=100"); setAllTxns(r.transactions || []); } catch {}
    setAllLoading(false);
  }, []);
  useEffect(() => { if (tab === "log") loadAllTxns(); }, [tab, loadAllTxns]);

  return (<>
    <Title t="WALLETS" s="give · take · transaction history" />
    <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
      {[{ k: "give", l: "💸 Give/Take" }, { k: "lookup", l: "🔍 Player Lookup" }, { k: "log", l: "📋 All Transactions" }].map(({ k, l }) => <button key={k} className={`ap-ft ${tab === k ? "act" : ""}`} onClick={() => setTab(k)}>{l}</button>)}
    </div>

    {tab === "give" && <div className="ap-2c">
      <FB title="GIVE / TAKE COINS">
        <div className="ap-note">Look up by Discord display name or in-game name. Give sends from treasury; Take deducts from wallet.</div>
        <Inp label="Player Name (display or in-game)" placeholder="Nin" value={name} onChange={e => setName(e.target.value)} />
        <Inp label="Amount (bronze)" type="number" placeholder="5000" value={amt} onChange={e => setAmt(e.target.value)} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0 16px" }}>{[500, 1000, 5000, 10000, 50000].map(n => <button key={n} className="ap-pre" onClick={() => setAmt(String(n))}>{fmt(n)}</button>)}</div>
        <Inp label="Reason (optional)" placeholder="Event prize, compensation..." value={reason} onChange={e => setReason(e.target.value)} />
        <div style={{ display: "flex", gap: 12 }}><B c="green" onClick={give}>💸 Give Coins</B><B c="red" onClick={take}>➖ Take Coins</B></div>
      </FB>
      <FB title="ECONOMY REFERENCE">
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", lineHeight: 2.2 }}>
          <strong style={{ color: "var(--text)" }}>Currency:</strong><br />1 🟡 Gold = 10,000 🟤 Bronze<br />1 ⚪ Silver = 1,000 🟤 Bronze<br /><br />
          <strong style={{ color: "var(--text)" }}>Income sources:</strong><br />Werewolf/Quiz wins (150🟤)<br />In-game cash deposits<br />Shop sales<br /><br />
          <strong style={{ color: "var(--text)" }}>Coin sinks:</strong><br />Shop purchases, Travel (5⚪)<br />Lottery (1⚪), RPS/C4 bets
        </div>
      </FB>
    </div>}

    {tab === "lookup" && <FB title="PLAYER TRANSACTION HISTORY">
      <div className="ap-note info">Enter a player's Discord ID to view their full transaction history.</div>
      <div className="ap-inline" style={{ marginBottom: 20 }}><Inp label="Discord ID" placeholder="228533264174940160" value={txnId} onChange={e => setTxnId(e.target.value)} /><B c="blue" onClick={loadPlayerTxns}>Load</B></div>
      {txnLoading ? <Load /> : txns.length > 0 ? <div>{txns.map((e, i) => <div key={i} className="ap-lr">
        <span className="ap-lr-t">{relTime(e.timestamp)}</span><EvBadge type={e.type || e.event_type || "adjust"} />
        <span className="ap-lr-d">{e.description || "—"}</span>
        <span className={`ap-lr-v ${e.amount > 0 ? "pos" : "neg"}`}>{e.amount > 0 ? "+" : ""}{fmt(e.amount)} 🟤</span>
        <span style={{ color: "var(--textdim)", fontFamily: "var(--mono)", fontSize: 11, minWidth: 80, textAlign: "right" }}>→ {fmt(e.balance_after)}</span>
      </div>)}</div> : <Empty text="enter a discord id and click load" />}
    </FB>}

    {tab === "log" && <TW title="ALL TRANSACTIONS" right={<B c="ghost" sm onClick={loadAllTxns}>↻</B>}>
      {allLoading ? <Load /> : allTxns.length ? <div>{allTxns.map((e, i) => <div key={i} className="ap-lr">
        <span className="ap-lr-t">{relTime(e.timestamp)}</span><EvBadge type={e.type || e.event_type || "adjust"} />
        <span className="ap-lr-d">{e.description || "—"}</span>
        <span className="ap-lr-p">{e.display_name || `#${e.discord_id}` || "—"}</span>
        <span className={`ap-lr-v ${e.amount > 0 ? "pos" : "neg"}`}>{e.amount > 0 ? "+" : ""}{fmt(e.amount)} 🟤</span>
        <span style={{ color: "var(--textdim)", fontFamily: "var(--mono)", fontSize: 11, minWidth: 80, textAlign: "right" }}>→ {fmt(e.balance_after)}</span>
      </div>)}</div> : <Empty text="no transactions found" />}
    </TW>}
  </>);
}
