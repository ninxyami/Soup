"use client";
// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { fetchApi, fmt, bronzeToCoins, relTime, SC, Title, TW, B, Empty, Load, EvBadge } from "./shared";

export default function OverviewTab({ toast }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [tres, shopR, comR] = await Promise.allSettled([
        fetchApi("/api/treasury/admin/overview"),
        fetchApi("/api/admin/shop/items"),
        fetchApi("/api/community"),
      ]);
      setD({
        t: tres.status === "fulfilled" ? tres.value : null,
        shop: shopR.status === "fulfilled" ? shopR.value : null,
        com: comR.status === "fulfilled" ? comR.value : null,
      });
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, 30000); return () => clearInterval(iv); }, [load]);

  if (loading) return <Load />;

  const t = d?.t?.treasury, s24 = d?.t?.stats_24h, items = d?.shop?.items || [], com = d?.com, log = d?.t?.recent_log || [], oos = items.filter(i => i.stock === 0).length;

  return (<>
    <Title t="COMMAND CENTER" s="system overview · treasury health · recent activity" />
    <div className="ap-sr">
      <SC label="Treasury Balance" value={t ? fmt(t.balance) : "—"} sub={t ? `${t.health_pct}% health` : ""} />
      <SC label="Paid Out (24h)" value={s24 ? fmt(s24.paid_out) : "—"} color="green" sub={s24 ? `${s24.payout_count} payouts` : ""} />
      <SC label="Shop Items" value={items.filter(i => i.enabled).length || "—"} color="blue" sub={`${oos} out of stock`} />
      <SC label="Total Players" value={com?.total_players ?? "—"} color="orange" sub={com?.online_count ? `${com.online_count} online` : ""} />
    </div>
    {t && <div className="ap-hero" style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 3, color: "var(--textdim)", textTransform: "uppercase", marginBottom: 6 }}>Treasury Status</div>
          <div style={{ fontFamily: "var(--display)", fontSize: 42, letterSpacing: 3, color: t.balance === 0 ? "var(--red)" : t.health_pct < 20 ? "var(--orange)" : "var(--accent)", lineHeight: 1 }}>{fmt(t.balance)} <span style={{ fontSize: 18, color: "var(--textdim)" }}>🟤</span></div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", marginTop: 4 }}>{bronzeToCoins(t.balance)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className={`ap-mbadge ${t.model}`}>{t.model === "B" ? "♻ MODEL B — CIRCULATING" : "🔥 MODEL A — HARD CAP"}</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 2, color: "var(--textdim)", textTransform: "uppercase" }}>Cycle</div>
          <div style={{ fontFamily: "var(--display)", fontSize: 24, letterSpacing: 2, color: "var(--text)" }}>{t.cycle_days_remaining > 0 ? `${t.cycle_days_remaining}d left` : "OVERDUE"}</div>
        </div>
      </div>
      <div className="ap-hbar"><div className={`ap-hfill ${t.health_pct < 10 ? "red" : t.health_pct < 25 ? "amber" : ""}`} style={{ width: `${t.health_pct}%` }} /></div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)" }}><span>{t.health_pct}% of cap</span><span>Cap: {fmt(t.cap)} 🟤</span></div>
    </div>}
    <TW title="RECENT ACTIVITY" right={<B c="ghost" sm onClick={load}>↻ Refresh</B>}>
      {log.length ? <div>{log.slice(0, 12).map((e, i) => <div key={i} className="ap-lr">
        <span className="ap-lr-t">{relTime(e.timestamp)}</span><EvBadge type={e.event_type} />
        <span className="ap-lr-d">{e.reason || "—"}</span>
        <span className="ap-lr-p">{e.player || (e.discord_id ? `#${e.discord_id}` : "—")}</span>
        <span className={`ap-lr-v ${["payout", "burn"].includes(e.event_type) ? "neg" : e.amount > 0 ? "pos" : "neu"}`}>{["payout", "burn"].includes(e.event_type) ? "−" : e.amount > 0 ? "+" : ""}{fmt(Math.abs(e.amount))} 🟤</span>
      </div>)}</div> : <Empty text="no events yet" />}
    </TW>
  </>);
}
