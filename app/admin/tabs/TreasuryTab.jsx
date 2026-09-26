"use client";
// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { useLiveRefresh } from "../realtime";
import { fetchApi, postApi, fmt, bronzeToCoins, relTime, Title, SC, TW, B, Inp, Sel, FB, Empty, Load, EvBadge, Toggle, useStickyState } from "./shared";

const AdjustForm = ({ onSubmit }) => {
  const [amt, setAmt] = useState(""); const [r, setR] = useState("");
  return (<><Inp label="Amount (bronze)" type="number" placeholder="50000 or -10000" value={amt} onChange={e => setAmt(e.target.value)} /><Inp label="Reason" placeholder="Season top-up" value={r} onChange={e => setR(e.target.value)} /><B c="gold" onClick={() => { if (!amt || amt == 0) return; onSubmit(parseInt(amt), r); setAmt(""); setR(""); }}>Apply</B></>);
};

const CapInfo = ({ t, m }) => (<>
  <div className="ap-note info">Current cap: {t ? fmt(t.cap) : "—"} 🟤 · set automatically</div>
  <div className="ap-note">The cap is the healthy level × {m?.cap_over_healthy ?? 1.25}. Healthy = the {fmt(m?.base)} 🟤 base fund + the allotment of every player who has joined this season and played in the last {m?.active_days ?? 7} days. It moves on its own as players join or go quiet, so there is nothing to set by hand.</div>
</>);

const HEALTH_COL = { BOOMING: "var(--green)", HEALTHY: "var(--green)", TIGHT: "var(--accent)", LOW: "var(--orange)", CRITICAL: "var(--red)" };
const healthFill = (h) => (h === "CRITICAL" ? "red" : h === "LOW" || h === "TIGHT" ? "amber" : "");

const MoneyModel = ({ m }) => {
  if (!m) return null;
  if (m.error) return <div className="ap-alert low">⚠ Money model unavailable: {m.error}</div>;
  const supply = Math.min(100, m.supply_pct || 0);
  const joinedTotal = (m.joined || []).reduce((a, p) => a + (p.allotment || 0), 0);
  return (<>
    {m.burn_mode && <div className="ap-alert dep">🔥 BURN MODE: {fmt(m.total)} 🟤 in circulation is over the {fmt(m.limit)} 🟤 limit. Zombita's cut of every sale is destroyed until it drifts back under.</div>}
    <TW title="MONEY MODEL" right={<span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>{m.season}</span>}>
      <div style={{ padding: "4px 4px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", marginBottom: 6 }}>
          <span>Total money: <span style={{ color: m.burn_mode ? "var(--red)" : "var(--text)" }}>{fmt(m.total)} 🟤</span> ({m.supply_pct}% of the limit)</span>
          <span>Limit: {fmt(m.limit)} 🟤 (healthy × {m.limit_over_healthy})</span>
        </div>
        <div className="ap-hbar"><div className={`ap-hfill ${m.burn_mode ? "red" : m.supply_pct > 90 ? "amber" : ""}`} style={{ width: `${supply}%` }} /></div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", lineHeight: 1.9, marginTop: 8 }}>
          Treasury {fmt(m.treasury)} · player wallets {fmt(m.wallets)} · shopkeepers {fmt(m.keepers)} · cash in hands {fmt(m.cash)}
        </div>
      </div>
      <div className="ap-sr">
        <SC label="Healthy Level" value={fmt(m.healthy)} sub={`${fmt(m.base)} base + ${fmt(joinedTotal)} from ${(m.joined || []).length} joined`} color="green" />
        <SC label="Treasury Cap" value={fmt(m.cap)} sub={`automatic · healthy × ${m.cap_over_healthy}`} color="blue" />
        <SC label="Joined This Season" value={(m.joined || []).length} sub={`active in the last ${m.active_days}d`} />
        <SC label="Not Joined Yet" value={(m.waiting || []).length} sub={`allotment ${fmt(m.allotments?.min)} / ${fmt(m.allotments?.neutral)} / ${fmt(m.allotments?.max)} by her feelings`} color="orange" />
      </div>
      <div className="ap-2c">
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 2, color: "var(--textdim)", textTransform: "uppercase", margin: "6px 0" }}>Joined + active (count toward healthy)</div>
          {(m.joined || []).length ? <table className="ap-t"><thead><tr><th>Player</th><th>Allotment</th><th>Last seen</th></tr></thead><tbody>
            {m.joined.map(p => <tr key={p.discord_id}><td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{p.name}</td><td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)" }}>{fmt(p.allotment)} 🟤</td><td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>{relTime(p.last_seen)}</td></tr>)}
          </tbody></table> : <Empty text="nobody has joined this season yet" />}
        </div>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 2, color: "var(--textdim)", textTransform: "uppercase", margin: "6px 0" }}>Active, allotment on first join</div>
          {(m.waiting || []).length ? <table className="ap-t"><thead><tr><th>Player</th><th>Last seen</th></tr></thead><tbody>
            {m.waiting.map(p => <tr key={p.discord_id}><td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{p.name}</td><td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>{relTime(p.last_seen)}</td></tr>)}
          </tbody></table> : <Empty text="every active player has joined" />}
        </div>
      </div>
      {(m.seeds || []).length > 0 && <>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 2, color: "var(--textdim)", textTransform: "uppercase", margin: "14px 0 6px" }}>Join allotments this season</div>
        <div>{m.seeds.map((e, i) => <div key={i} className="ap-lr"><span className="ap-lr-t">{relTime(e.seeded_at)}</span><EvBadge type="inject" /><span className="ap-lr-d">{e.applied ? "first join" : "computed only (seeding off)"}</span><span className="ap-lr-p">{e.name || `#${e.discord_id}`}</span><span className="ap-lr-v pos">+{fmt(e.amount)} 🟤</span></div>)}</div>
      </>}
    </TW>
  </>);
};

const ResetCycleForm = ({ onConfirm, onClose }) => {
  const [bal, setBal] = useState("");
  return (<><div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", lineHeight: 1.7, marginBottom: 24 }}>New cycle starts. The paid/burned/recycled counters reset. The balance stays as it is unless you enter one below (money is finite, so a reset never refills the treasury by itself).<br /><br /><span style={{ color: "var(--red)" }}>Cannot be undone.</span></div><Inp label="Starting balance (blank = keep current)" type="number" placeholder="Leave blank to keep the balance" value={bal} onChange={e => setBal(e.target.value)} /><div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}><B c="ghost" onClick={onClose}>Cancel</B><B c="red" onClick={() => onConfirm(bal || null)}>Confirm Reset</B></div></>);
};

const TreasuryPayout = ({ t, m, doPayout }) => {
  const [did, setDid] = useState(""); const [amt, setAmt] = useState(""); const [r, setR] = useState("");
  return (<div className="ap-2c">
    <FB title="MANUAL PAYOUT">
      <div className="ap-note">Pays from treasury directly to a player's wallet. The treasury is small by design ({t ? fmt(t.balance) : "—"} 🟤 now), so keep prizes modest.</div>
      <Inp label="Discord ID" placeholder="228533264174940160" value={did} onChange={e => setDid(e.target.value)} />
      <Inp label="Amount (bronze)" type="number" placeholder="500" value={amt} onChange={e => setAmt(e.target.value)} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0 16px" }}>{[100, 250, 500, 1000, 2500].map(n => <button key={n} className="ap-pre" onClick={() => setAmt(String(n))}>{n >= 1000 ? `${n / 1000} Silver` : `${n} Bronze`}</button>)}</div>
      <Inp label="Reason" placeholder="Event prize..." value={r} onChange={e => setR(e.target.value)} />
      <B c="green" full onClick={() => { if (!did || !amt) return; doPayout(did, amt, r); setDid(""); setAmt(""); setR(""); }}>▶ Send from Treasury</B>
    </FB>
    <div>
      <FB title="REWARD REFERENCE"><table className="ap-t"><thead><tr><th>Source</th><th>Amount</th><th>Flow</th></tr></thead><tbody>
        {[["🐺 Werewolf Win", "150 🟤", "payout"], ["🎯 Quiz Win", "150 🟤", "payout"], ["🚀 Travel Fee", "5,000 🟤", "recycle"], ["⚔️ RPS/C4 Rake", "5% of pot", "recycle"], ["🎟️ Lottery", "1,000 🟤", "recycle"]].map(([s, a, f], i) => <tr key={i}><td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{s}</td><td style={{ fontFamily: "var(--mono)", fontSize: 12, color: f === "payout" ? "var(--accent)" : "var(--orange)" }}>{a}</td><td><EvBadge type={f} /></td></tr>)}
      </tbody></table></FB>
      {t && <FB title="SNAPSHOT"><div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", lineHeight: 2.2 }}>Balance: <span style={{ color: "var(--accent)" }}>{fmt(t.balance)} 🟤</span><br />Health: <span style={{ color: HEALTH_COL[m?.health] || "var(--text)" }}>{m?.health || "—"} · {t.health_pct}%</span><br />Model: <span style={{ color: "var(--text)" }}>{t.model === "B" ? "Circulating" : "Hard Cap"}</span><br />Cycle: <span style={{ color: "var(--text)" }}>{t.cycle_days_remaining}d left</span></div></FB>}
    </div>
  </div>);
};

export default function TreasuryTab({ toast }) {
  const [sub, setSub] = useStickyState("overview", "treasury.sub");
  const [data, setData] = useState(null);
  const [log, setLog] = useState([]);
  const [logFilter, setLogFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReset, setShowReset] = useState(false);

  const loadOv = useCallback(async () => { try { setData(await fetchApi("/api/treasury/admin/overview")); } catch {} setLoading(false); }, []);
  const loadLog = useCallback(async (f) => { try { const qs = f ? `&event_type=${f}` : ""; setLog((await fetchApi(`/api/treasury/admin/log?limit=200${qs}`)).log || []); } catch {} }, []);
  useEffect(() => { loadOv(); const iv = setInterval(loadOv, 20000); return () => clearInterval(iv); }, [loadOv]);
  useLiveRefresh("treasury", loadOv);

  const t = data?.treasury, s24 = data?.stats_24h, rLog = data?.recent_log || [], m = data?.money;
  const health = m && !m.error ? m.health : null;
  const doAdjust = async (amt, reason) => { try { const r = await postApi("/api/treasury/admin/adjust", { amount: amt, reason: reason || "Admin" }); const got = r?.treasury?.applied ?? amt; toast(got === amt ? `Adjusted ${amt > 0 ? "+" : ""}${fmt(amt)}` : `Adjusted ${got > 0 ? "+" : ""}${fmt(got)} (asked for ${fmt(amt)}: ${amt > 0 ? "the cap stopped it" : "it can't go below 0"})`, got === amt ? "success" : "error"); loadOv(); } catch (e) { toast("Failed: " + e.message, "error"); } };
  const doConfig = async (body) => { try { await postApi("/api/treasury/admin/config", body); toast("Updated", "success"); loadOv(); } catch (e) { toast("Failed: " + e.message, "error"); } };
  const doReset = async (bal) => { try { await postApi("/api/treasury/admin/reset-cycle", bal ? { new_balance: parseInt(bal) } : {}); toast("Cycle reset!", "success"); setShowReset(false); loadOv(); } catch (e) { toast("Reset failed", "error"); setShowReset(false); } };
  const doPayout = async (did, amt, reason) => { try { await postApi("/api/treasury/admin/payout", { discord_id: parseInt(did), amount: parseInt(amt), reason: reason || "Admin payout" }); toast(`Sent ${fmt(amt)} 🟤`, "success"); loadOv(); } catch (e) { toast("Payout failed: " + e.message, "error"); } };

  const tabs = [{ key: "overview", icon: "🏦", label: "Overview" }, { key: "controls", icon: "⚙️", label: "Controls" }, { key: "payout", icon: "💰", label: "Payout" }, { key: "log", icon: "📋", label: "Event Log" }];
  if (loading) return <><Title t="TREASURY" s="economy health · coin flow" /><Load /></>;

  return (<>
    <Title t="TREASURY" s="finite money · grows only when players join · health follows who is playing" />
    <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>{tabs.map(tab => <button key={tab.key} className={`ap-ft ${sub === tab.key ? "act" : ""}`} onClick={() => { setSub(tab.key); if (tab.key === "log") loadLog(logFilter); }}>{tab.icon} {tab.label}</button>)}</div>

    {sub === "overview" && t && <>
      {t.balance === 0 && <div className="ap-alert dep">⚠ TREASURY DEPLETED — reward payouts are paused.</div>}
      {t.balance > 0 && (health === "LOW" || health === "CRITICAL") && <div className="ap-alert low">⚠ Treasury {health} ({t.health_pct}% of the cap). It refills from Zombita's cut of sales and from players joining for the first time this season.</div>}
      <div className="ap-hero"><div className="ap-hero-g">
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 3, color: "var(--textdim)", textTransform: "uppercase", marginBottom: 10 }}>Current Treasury Balance</div>
          <div className={`ap-big ${t.balance === 0 ? "dep" : health === "LOW" || health === "CRITICAL" ? "low" : ""}`}>{fmt(t.balance)}</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", marginTop: 6 }}>{bronzeToCoins(t.balance)}</div>
          <div className="ap-hbar"><div className={`ap-hfill ${healthFill(health)}`} style={{ width: `${Math.min(100, t.health_pct)}%` }} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)" }}><span style={{ color: HEALTH_COL[health] || "var(--textdim)" }}>{health ? `${health} · ` : ""}{t.health_pct}%</span><span>Cap: {fmt(t.cap)} 🟤 (automatic)</span></div>
        </div>
        <div style={{ textAlign: "right", minWidth: 180 }}>
          <div className={`ap-mbadge ${t.model}`}>{t.model === "B" ? "♻ CIRCULATING" : "🔥 HARD CAP"}</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 2, color: "var(--textdim)", textTransform: "uppercase", marginBottom: 4 }}>Cycle</div>
          <div style={{ fontFamily: "var(--display)", fontSize: 24, letterSpacing: 2, color: "var(--text)", marginBottom: 8 }}>{t.cycle_days_remaining > 0 ? `${t.cycle_days_remaining}d left` : "OVERDUE"}</div>
          <div className="ap-cyc" style={{ marginLeft: "auto" }}><div className="ap-cyc-f" style={{ width: `${t.cycle_pct}%` }} /></div>
        </div>
      </div></div>
      <MoneyModel m={m} />
      <div className="ap-sr"><SC label="Paid Out (24h)" value={s24 ? fmt(s24.paid_out) : "—"} sub={s24 ? `${s24.payout_count} payouts` : ""} /><SC label="Burned (24h)" value={s24 ? fmt(s24.burned) : "—"} color="red" /><SC label="Recycled (24h)" value={s24 ? fmt(s24.recycled) : "—"} color="green" /><SC label="Cycle Total" value={t ? fmt(t.total_paid_out) : "—"} color="blue" /></div>
      <TW title="RECENT EVENTS" right={<><B c="ghost" sm onClick={loadOv}>↻</B><B c="ghost" sm onClick={() => { setSub("log"); loadLog(null); }}>All →</B></>}>
        {rLog.length ? <div>{rLog.slice(0, 12).map((e, i) => <div key={i} className="ap-lr"><span className="ap-lr-t">{relTime(e.timestamp)}</span><EvBadge type={e.event_type} /><span className="ap-lr-d">{e.reason || "—"}</span><span className="ap-lr-p">{e.player || (e.discord_id ? `#${e.discord_id}` : "—")}</span><span className={`ap-lr-v ${["payout", "burn"].includes(e.event_type) ? "neg" : e.amount > 0 ? "pos" : "neu"}`}>{["payout", "burn"].includes(e.event_type) ? "−" : e.amount > 0 ? "+" : ""}{fmt(Math.abs(e.amount))} 🟤</span><span style={{ color: "var(--textdim)", fontFamily: "var(--mono)", fontSize: 11, minWidth: 80, textAlign: "right" }}>→ {fmt(e.balance_after)}</span></div>)}</div> : <Empty text="no events" />}
      </TW>
    </>}

    {sub === "controls" && <div className="ap-2c">
      <div>
        <FB title="ADJUST BALANCE"><div className="ap-note">Positive = add to treasury, negative = remove. Adding mints new coins, for corrections only.</div><AdjustForm onSubmit={doAdjust} /></FB>
        <FB title="TREASURY CAP (AUTOMATIC)"><CapInfo t={t} m={m} /></FB>
      </div>
      <div>
        <FB title="ECONOMY MODEL"><div className="ap-note"><strong style={{ color: "var(--text)" }}>Model B — Circulating:</strong> Fees return to treasury.<br /><strong style={{ color: "var(--text)" }}>Model A — Hard Cap:</strong> Fees destroyed.</div><Sel label="Active Model" value={t?.model || "B"} onChange={e => doConfig({ model: e.target.value })}><option value="B">Model B — Circulating</option><option value="A">Model A — Hard Cap</option></Sel></FB>
        <FB title="RESET CYCLE"><div className="ap-note danger">⚠ Resets all counters. Cannot be undone.</div><B c="red" onClick={() => setShowReset(true)}>⚠ Reset Cycle</B></FB>
      </div>
    </div>}

    {sub === "payout" && <TreasuryPayout t={t} m={m} doPayout={doPayout} />}

    {sub === "log" && <TW title="EVENTS" right={<><div style={{ display: "flex", gap: 6 }}>{[null, "payout", "burn", "recycle", "inject", "reset", "adjust"].map(f => <button key={f || "all"} className={`ap-ft ${logFilter === f ? "act" : ""}`} onClick={() => { setLogFilter(f); loadLog(f); }}>{f || "All"}</button>)}</div><B c="ghost" sm onClick={() => loadLog(logFilter)}>↻</B></>}>
      {log.length ? <div>{log.map((e, i) => <div key={i} className="ap-lr"><span className="ap-lr-t">{relTime(e.timestamp)}</span><EvBadge type={e.event_type} /><span className="ap-lr-d">{e.reason || "—"}</span><span className="ap-lr-p">{e.player || (e.discord_id ? `#${e.discord_id}` : "—")}</span><span className={`ap-lr-v ${["payout", "burn"].includes(e.event_type) ? "neg" : e.amount > 0 ? "pos" : "neu"}`}>{["payout", "burn"].includes(e.event_type) ? "−" : e.amount > 0 ? "+" : ""}{fmt(Math.abs(e.amount))} 🟤</span><span style={{ color: "var(--textdim)", fontFamily: "var(--mono)", fontSize: 11, minWidth: 80, textAlign: "right" }}>→ {fmt(e.balance_after)}</span></div>)}</div> : <Empty text="no events" />}
    </TW>}

    {showReset && <div className="ap-mbd" onClick={e => { if (e.target === e.currentTarget) setShowReset(false); }}><div className="ap-mod" style={{ width: 480 }}>
      <button className="ap-mod-x" onClick={() => setShowReset(false)}>✕</button><h3>RESET CYCLE?</h3>
      <ResetCycleForm onConfirm={doReset} onClose={() => setShowReset(false)} />
    </div></div>}
  </>);
}
