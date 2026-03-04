"use client";
// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { fetchApi, postApi, fmt, bronzeToCoins, relTime, Title, SC, TW, B, Inp, Sel, FB, Empty, Load, EvBadge, Toggle } from "./shared";

const AdjustForm = ({ onSubmit }) => {
  const [amt, setAmt] = useState(""); const [r, setR] = useState("");
  return (<><Inp label="Amount (bronze)" type="number" placeholder="50000 or -10000" value={amt} onChange={e => setAmt(e.target.value)} /><Inp label="Reason" placeholder="Season top-up" value={r} onChange={e => setR(e.target.value)} /><B c="gold" onClick={() => { if (!amt || amt == 0) return; onSubmit(parseInt(amt), r); setAmt(""); setR(""); }}>Apply</B></>);
};

const CapForm = ({ t, onSubmit }) => {
  const [cap, setCap] = useState("");
  return (<><div className="ap-note info">Current cap: {t ? fmt(t.cap) : "—"} 🟤</div><div className="ap-inline"><Inp label="New Cap (bronze)" type="number" placeholder="500000" value={cap} onChange={e => setCap(e.target.value)} /><B c="ghost" onClick={() => { if (!cap) return; onSubmit(parseInt(cap)); setCap(""); }}>Set</B></div></>);
};

const ResetCycleForm = ({ onConfirm, onClose }) => {
  const [bal, setBal] = useState("");
  return (<><div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", lineHeight: 1.7, marginBottom: 24 }}>New cycle starts. All counters reset. Balance refills to cap or value below.<br /><br /><span style={{ color: "var(--red)" }}>Cannot be undone.</span></div><Inp label="Starting balance (blank = full cap)" type="number" placeholder="Leave blank for cap" value={bal} onChange={e => setBal(e.target.value)} /><div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}><B c="ghost" onClick={onClose}>Cancel</B><B c="red" onClick={() => onConfirm(bal || null)}>Confirm Reset</B></div></>);
};

const TreasuryPayout = ({ t, doPayout }) => {
  const [did, setDid] = useState(""); const [amt, setAmt] = useState(""); const [r, setR] = useState("");
  return (<div className="ap-2c">
    <FB title="MANUAL PAYOUT">
      <div className="ap-note">Pays from treasury directly to a player's wallet.</div>
      <Inp label="Discord ID" placeholder="228533264174940160" value={did} onChange={e => setDid(e.target.value)} />
      <Inp label="Amount (bronze)" type="number" placeholder="5000" value={amt} onChange={e => setAmt(e.target.value)} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0 16px" }}>{[1000, 5000, 10000, 50000, 100000].map(n => <button key={n} className="ap-pre" onClick={() => setAmt(String(n))}>{n >= 10000 ? `${n / 10000} Gold` : `${n / 1000} Silver`}</button>)}</div>
      <Inp label="Reason" placeholder="Event prize..." value={r} onChange={e => setR(e.target.value)} />
      <B c="green" full onClick={() => { if (!did || !amt) return; doPayout(did, amt, r); setDid(""); setAmt(""); setR(""); }}>▶ Send from Treasury</B>
    </FB>
    <div>
      <FB title="REWARD REFERENCE"><table className="ap-t"><thead><tr><th>Source</th><th>Amount</th><th>Flow</th></tr></thead><tbody>
        {[["🐺 Werewolf Win", "150 🟤", "payout"], ["🎯 Quiz Win", "150 🟤", "payout"], ["🚀 Travel Fee", "5,000 🟤", "recycle"], ["⚔️ RPS/C4 Rake", "5% of pot", "recycle"], ["🎟️ Lottery", "1,000 🟤", "recycle"]].map(([s, a, f], i) => <tr key={i}><td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{s}</td><td style={{ fontFamily: "var(--mono)", fontSize: 12, color: f === "payout" ? "var(--accent)" : "var(--orange)" }}>{a}</td><td><EvBadge type={f} /></td></tr>)}
      </tbody></table></FB>
      {t && <FB title="SNAPSHOT"><div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", lineHeight: 2.2 }}>Balance: <span style={{ color: "var(--accent)" }}>{fmt(t.balance)} 🟤</span><br />Health: <span style={{ color: t.health_pct > 25 ? "var(--green)" : t.health_pct > 10 ? "var(--orange)" : "var(--red)" }}>{t.health_pct}%</span><br />Model: <span style={{ color: "var(--text)" }}>{t.model === "B" ? "Circulating" : "Hard Cap"}</span><br />Cycle: <span style={{ color: "var(--text)" }}>{t.cycle_days_remaining}d left</span></div></FB>}
    </div>
  </div>);
};

export default function TreasuryTab({ toast }) {
  const [sub, setSub] = useState("overview");
  const [data, setData] = useState(null);
  const [log, setLog] = useState([]);
  const [logFilter, setLogFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReset, setShowReset] = useState(false);

  const loadOv = useCallback(async () => { try { setData(await fetchApi("/api/treasury/admin/overview")); } catch {} setLoading(false); }, []);
  const loadLog = useCallback(async (f) => { try { const qs = f ? `&event_type=${f}` : ""; setLog((await fetchApi(`/api/treasury/admin/log?limit=200${qs}`)).log || []); } catch {} }, []);
  useEffect(() => { loadOv(); const iv = setInterval(loadOv, 20000); return () => clearInterval(iv); }, [loadOv]);

  const t = data?.treasury, s24 = data?.stats_24h, rLog = data?.recent_log || [];
  const doAdjust = async (amt, reason) => { try { await postApi("/api/treasury/admin/adjust", { amount: amt, reason: reason || "Admin" }); toast(`Adjusted ${amt > 0 ? "+" : ""}${fmt(amt)}`, "success"); loadOv(); } catch (e) { toast("Failed: " + e.message, "error"); } };
  const doConfig = async (body) => { try { await postApi("/api/treasury/admin/config", body); toast("Updated", "success"); loadOv(); } catch (e) { toast("Failed: " + e.message, "error"); } };
  const doReset = async (bal) => { try { await postApi("/api/treasury/admin/reset-cycle", bal ? { new_balance: parseInt(bal) } : {}); toast("Cycle reset!", "success"); setShowReset(false); loadOv(); } catch (e) { toast("Reset failed", "error"); setShowReset(false); } };
  const doPayout = async (did, amt, reason) => { try { await postApi("/api/treasury/admin/payout", { discord_id: parseInt(did), amount: parseInt(amt), reason: reason || "Admin payout" }); toast(`Sent ${fmt(amt)} 🟤`, "success"); loadOv(); } catch (e) { toast("Payout failed: " + e.message, "error"); } };

  const tabs = [{ key: "overview", icon: "🏦", label: "Overview" }, { key: "controls", icon: "⚙️", label: "Controls" }, { key: "payout", icon: "💰", label: "Payout" }, { key: "log", icon: "📋", label: "Event Log" }];
  if (loading) return <><Title t="TREASURY" s="economy health · coin flow" /><Load /></>;

  return (<>
    <Title t="TREASURY" s="economy health · coin flow · cycle status" />
    <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>{tabs.map(tab => <button key={tab.key} className={`ap-ft ${sub === tab.key ? "act" : ""}`} onClick={() => { setSub(tab.key); if (tab.key === "log") loadLog(logFilter); }}>{tab.icon} {tab.label}</button>)}</div>

    {sub === "overview" && t && <>
      {t.balance === 0 && <div className="ap-alert dep">⚠ TREASURY DEPLETED — reward payouts are paused.</div>}
      {t.balance > 0 && t.health_pct < 15 && <div className="ap-alert low">⚠ Treasury low ({t.health_pct}%) — consider a top-up or cycle reset.</div>}
      <div className="ap-hero"><div className="ap-hero-g">
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 3, color: "var(--textdim)", textTransform: "uppercase", marginBottom: 10 }}>Current Treasury Balance</div>
          <div className={`ap-big ${t.balance === 0 ? "dep" : t.health_pct < 20 ? "low" : ""}`}>{fmt(t.balance)}</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", marginTop: 6 }}>{bronzeToCoins(t.balance)}</div>
          <div className="ap-hbar"><div className={`ap-hfill ${t.health_pct < 10 ? "red" : t.health_pct < 25 ? "amber" : ""}`} style={{ width: `${t.health_pct}%` }} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)" }}><span>{t.health_pct}%</span><span>Cap: {fmt(t.cap)} 🟤</span></div>
        </div>
        <div style={{ textAlign: "right", minWidth: 180 }}>
          <div className={`ap-mbadge ${t.model}`}>{t.model === "B" ? "♻ CIRCULATING" : "🔥 HARD CAP"}</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 2, color: "var(--textdim)", textTransform: "uppercase", marginBottom: 4 }}>Cycle</div>
          <div style={{ fontFamily: "var(--display)", fontSize: 24, letterSpacing: 2, color: "var(--text)", marginBottom: 8 }}>{t.cycle_days_remaining > 0 ? `${t.cycle_days_remaining}d left` : "OVERDUE"}</div>
          <div className="ap-cyc" style={{ marginLeft: "auto" }}><div className="ap-cyc-f" style={{ width: `${t.cycle_pct}%` }} /></div>
        </div>
      </div></div>
      <div className="ap-sr"><SC label="Paid Out (24h)" value={s24 ? fmt(s24.paid_out) : "—"} sub={s24 ? `${s24.payout_count} payouts` : ""} /><SC label="Burned (24h)" value={s24 ? fmt(s24.burned) : "—"} color="red" /><SC label="Recycled (24h)" value={s24 ? fmt(s24.recycled) : "—"} color="green" /><SC label="Cycle Total" value={t ? fmt(t.total_paid_out) : "—"} color="blue" /></div>
      <TW title="RECENT EVENTS" right={<><B c="ghost" sm onClick={loadOv}>↻</B><B c="ghost" sm onClick={() => { setSub("log"); loadLog(null); }}>All →</B></>}>
        {rLog.length ? <div>{rLog.slice(0, 12).map((e, i) => <div key={i} className="ap-lr"><span className="ap-lr-t">{relTime(e.timestamp)}</span><EvBadge type={e.event_type} /><span className="ap-lr-d">{e.reason || "—"}</span><span className="ap-lr-p">{e.player || (e.discord_id ? `#${e.discord_id}` : "—")}</span><span className={`ap-lr-v ${["payout", "burn"].includes(e.event_type) ? "neg" : e.amount > 0 ? "pos" : "neu"}`}>{["payout", "burn"].includes(e.event_type) ? "−" : e.amount > 0 ? "+" : ""}{fmt(Math.abs(e.amount))} 🟤</span><span style={{ color: "var(--textdim)", fontFamily: "var(--mono)", fontSize: 11, minWidth: 80, textAlign: "right" }}>→ {fmt(e.balance_after)}</span></div>)}</div> : <Empty text="no events" />}
      </TW>
    </>}

    {sub === "controls" && <div className="ap-2c">
      <div>
        <FB title="ADJUST BALANCE"><div className="ap-note">Positive = add to treasury, negative = remove.</div><AdjustForm onSubmit={doAdjust} /></FB>
        <FB title="TREASURY CAP"><CapForm t={t} onSubmit={(cap) => doConfig({ cap })} /></FB>
      </div>
      <div>
        <FB title="ECONOMY MODEL"><div className="ap-note"><strong style={{ color: "var(--text)" }}>Model B — Circulating:</strong> Fees return to treasury.<br /><strong style={{ color: "var(--text)" }}>Model A — Hard Cap:</strong> Fees destroyed.</div><Sel label="Active Model" value={t?.model || "B"} onChange={e => doConfig({ model: e.target.value })}><option value="B">Model B — Circulating</option><option value="A">Model A — Hard Cap</option></Sel></FB>
        <FB title="RESET CYCLE"><div className="ap-note danger">⚠ Resets all counters. Cannot be undone.</div><B c="red" onClick={() => setShowReset(true)}>⚠ Reset Cycle</B></FB>
      </div>
    </div>}

    {sub === "payout" && <TreasuryPayout t={t} doPayout={doPayout} />}

    {sub === "log" && <TW title="EVENTS" right={<><div style={{ display: "flex", gap: 6 }}>{[null, "payout", "burn", "recycle", "reset", "adjust"].map(f => <button key={f || "all"} className={`ap-ft ${logFilter === f ? "act" : ""}`} onClick={() => { setLogFilter(f); loadLog(f); }}>{f || "All"}</button>)}</div><B c="ghost" sm onClick={() => loadLog(logFilter)}>↻</B></>}>
      {log.length ? <div>{log.map((e, i) => <div key={i} className="ap-lr"><span className="ap-lr-t">{relTime(e.timestamp)}</span><EvBadge type={e.event_type} /><span className="ap-lr-d">{e.reason || "—"}</span><span className="ap-lr-p">{e.player || (e.discord_id ? `#${e.discord_id}` : "—")}</span><span className={`ap-lr-v ${["payout", "burn"].includes(e.event_type) ? "neg" : e.amount > 0 ? "pos" : "neu"}`}>{["payout", "burn"].includes(e.event_type) ? "−" : e.amount > 0 ? "+" : ""}{fmt(Math.abs(e.amount))} 🟤</span><span style={{ color: "var(--textdim)", fontFamily: "var(--mono)", fontSize: 11, minWidth: 80, textAlign: "right" }}>→ {fmt(e.balance_after)}</span></div>)}</div> : <Empty text="no events" />}
    </TW>}

    {showReset && <div className="ap-mbd" onClick={e => { if (e.target === e.currentTarget) setShowReset(false); }}><div className="ap-mod" style={{ width: 480 }}>
      <button className="ap-mod-x" onClick={() => setShowReset(false)}>✕</button><h3>RESET CYCLE?</h3>
      <ResetCycleForm onConfirm={doReset} onClose={() => setShowReset(false)} />
    </div></div>}
  </>);
}
