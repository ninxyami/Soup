"use client";
// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { useLiveRefresh } from "../realtime";
import { fetchApi, fmt, relTime, Title, SC, TW, B, FB, Empty, Load, EvBadge, useStickyState } from "./shared";

const mono = { fontFamily: "var(--mono)", fontSize: 12 };
const dim = { ...mono, fontSize: 11, color: "var(--textdim)" };
const SHOP_LABEL = { global: "General store", weapons: "Guns & ammo", mechanic: "Mechanic", medical: "Medical", melee: "Melee & tools", gardener: "Gardener", tailor: "Tailor", librarian: "Librarian" };

const Till = ({ balance, target }) => {
  const pct = target > 0 ? Math.min(100, (balance / target) * 100) : balance > 0 ? 100 : 0;
  const cls = balance <= 0 ? "red" : target > 0 && balance < target * 0.35 ? "amber" : "";
  return (<div style={{ minWidth: 140 }}>
    <div style={{ ...mono, color: balance <= 0 ? "var(--red)" : "var(--accent)" }}>{fmt(balance)} 🟤</div>
    <div className="ap-hbar" style={{ margin: "4px 0 0", height: 4 }}><div className={`ap-hfill ${cls}`} style={{ width: `${pct}%` }} /></div>
  </div>);
};

const LedgerRows = ({ rows, showKeeper }) => rows.length ? <div>{rows.map((e, i) => (
  <div key={i} className="ap-lr">
    <span className="ap-lr-t">{relTime(e.ts)}</span>
    <EvBadge type={e.kind} />
    <span className="ap-lr-d">
      {showKeeper && <strong style={{ color: "var(--text)" }}>{e.persona} </strong>}
      {e.quantity ? `${e.quantity}x ${e.item_id}` : ""}{e.kind === "sale" && e.treasury_cut ? ` · Zombita's cut ${fmt(e.treasury_cut)}` : ""}{e.detail ? ` · ${e.detail}` : ""}
    </span>
    <span className="ap-lr-p">{e.player_name || e.npc_id || "—"}</span>
    <span className={`ap-lr-v ${e.amount > 0 ? "pos" : e.amount < 0 ? "neg" : "neu"}`}>{e.amount > 0 ? "+" : e.amount < 0 ? "−" : ""}{fmt(Math.abs(e.amount))} 🟤</span>
    <span style={{ ...dim, minWidth: 80, textAlign: "right" }}>→ {e.balance_after != null ? fmt(e.balance_after) : "—"}</span>
  </div>))}</div> : <Empty text="no activity yet" />;

const KeeperDetail = ({ persona, onClose }) => {
  const [d, setD] = useState(null);
  const load = useCallback(async () => { try { setD(await fetchApi(`/api/treasury/admin/keepers?persona=${encodeURIComponent(persona)}`)); } catch { setD({ error: true }); } }, [persona]);
  useEffect(() => { setD(null); load(); }, [load]);
  if (!d) return <TW title={persona.toUpperCase()}><Load /></TW>;
  if (d.error) return <TW title={persona.toUpperCase()} right={<B c="ghost" sm onClick={onClose}>✕</B>}><Empty text="couldn't load this shopkeeper" /></TW>;
  return (<TW title={`${d.name} · ${SHOP_LABEL[d.shop_type] || d.shop_type} · ${d.kiosks} kiosk${d.kiosks === 1 ? "" : "s"}`} right={<><span style={dim}>till {fmt(d.balance)} / target {fmt(d.target)}</span><B c="ghost" sm onClick={load}>↻</B><B c="ghost" sm onClick={onClose}>✕</B></>}>
    <div style={{ ...dim, textTransform: "uppercase", letterSpacing: 2, fontSize: 10, margin: "4px 0 6px" }}>Customers (all time)</div>
    {d.customers.length ? <div style={{ overflowX: "auto" }}><table className="ap-t"><thead><tr><th>Player</th><th>Bought</th><th>Spent</th><th>Sold to them</th><th>Paid out</th><th>Refused</th><th>Last</th></tr></thead><tbody>
      {d.customers.map(c => <tr key={c.discord_id}>
        <td style={mono}>{c.name || `#${c.discord_id}`}</td><td style={mono}>{c.buys}</td>
        <td style={{ ...mono, color: "var(--accent)" }}>{fmt(c.spent)}</td><td style={mono}>{c.sells}</td>
        <td style={{ ...mono, color: "var(--orange)" }}>{fmt(c.paid)}</td>
        <td style={{ ...mono, color: c.refusals ? "var(--red)" : "var(--textdim)" }}>{c.refusals}</td><td style={dim}>{relTime(c.last)}</td>
      </tr>)}
    </tbody></table></div> : <Empty text="nobody has traded with them yet" />}
    <div style={{ ...dim, textTransform: "uppercase", letterSpacing: 2, fontSize: 10, margin: "16px 0 6px" }}>Ledger</div>
    <LedgerRows rows={d.ledger} />
  </TW>);
};

export default function KeepersTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useStickyState(null, "keepers.open");
  const load = useCallback(async () => { try { setData(await fetchApi("/api/treasury/admin/keepers")); } catch {} setLoading(false); }, []);
  useEffect(() => { load(); const iv = setInterval(load, 30000); return () => clearInterval(iv); }, [load]);
  useLiveRefresh("treasury", load);

  if (loading) return <><Title t="SHOPKEEPERS" s="wallets · tills · who trades with whom" /><Load /></>;
  if (!data || data.error) return <><Title t="SHOPKEEPERS" s="wallets · tills · who trades with whom" /><div className="ap-alert low">⚠ Couldn't load shopkeepers{data?.error ? `: ${data.error}` : ""}.</div></>;

  const ks = data.keepers || [];
  const refusals = ks.reduce((a, k) => a + k.refusals, 0);
  const dry = ks.filter(k => k.balance <= 0).length;
  const cut = ks.reduce((a, k) => a + k.cut_to_zombita, 0);
  const seeded = ks.some(k => k.funded_total > 0 || k.balance > 0);
  const st = data.settings || {};

  return (<>
    <Title t="SHOPKEEPERS" s="every persona keeps a till · buys fill it · sells empty it · Zombita sweeps and refills every 3 days" />
    {!seeded && <div className="ap-alert low">⚠ Keepers haven't been seeded yet. The shop watcher moves {Math.round((st.seed_pct || 0.2) * 100)}% of the base fund from the treasury to them the next time it starts.</div>}
    {data.burn_mode && <div className="ap-alert dep">🔥 Burn mode: Zombita's cut of every sale and any swept surplus is being destroyed.</div>}
    <div className="ap-sr">
      <SC label="In All Tills" value={fmt(data.total)} sub={`${ks.length} shopkeepers`} />
      <SC label="Zombita's Cut (3d)" value={fmt(cut)} sub="from shop sales" color="blue" />
      <SC label="Refused Sells (3d)" value={refusals} sub="keeper couldn't pay" color={refusals ? "red" : "green"} />
      <SC label="Empty Tills" value={dry} sub="can't buy anything" color={dry ? "orange" : "green"} />
    </div>

    <TW title="TILLS" right={<B c="ghost" sm onClick={load}>↻</B>}>
      <div style={{ overflowX: "auto" }}><table className="ap-t"><thead><tr>
        <th>Shopkeeper</th><th>Till</th><th>Target</th><th>Sales (3d)</th><th>Kept</th><th>Bought back (3d)</th><th>Refused</th><th>Customers</th><th>Swept / Funded</th>
      </tr></thead><tbody>
        {ks.map(k => <tr key={k.persona} onClick={() => setOpen(open === k.persona ? null : k.persona)} style={{ cursor: "pointer", background: open === k.persona ? "rgba(200,168,75,0.06)" : undefined }}>
          <td><div style={{ ...mono, color: "var(--text)" }}>{k.name}</div><div style={dim}>{SHOP_LABEL[k.shop_type] || k.shop_type || "—"} · {k.kiosks} kiosk{k.kiosks === 1 ? "" : "s"}</div></td>
          <td><Till balance={k.balance} target={k.target} /></td>
          <td style={dim}>{fmt(k.target)}{k.target > k.base_target ? " (busy)" : ""}</td>
          <td style={mono}>{k.sales}</td>
          <td style={{ ...mono, color: "var(--accent)" }}>{fmt(k.sales_kept)}</td>
          <td style={mono}>{k.buybacks} · <span style={{ color: "var(--orange)" }}>{fmt(k.buybacks_paid)}</span></td>
          <td style={{ ...mono, color: k.refusals ? "var(--red)" : "var(--textdim)" }}>{k.refusals}</td>
          <td style={mono}>{k.customers}</td>
          <td style={dim}>{fmt(k.swept_total)} / {fmt(k.funded_total)}</td>
        </tr>)}
      </tbody></table></div>
      <div style={{ ...dim, padding: "10px 4px 2px" }}>Click a shopkeeper for their customers and ledger.</div>
    </TW>

    {open && ks.some(k => k.persona === open) && <KeeperDetail persona={open} onClose={() => setOpen(null)} />}

    <div className="ap-2c">
      <TW title="RECENT ACTIVITY"><LedgerRows rows={data.ledger || []} showKeeper /></TW>
      <FB title="HOW THE TILLS WORK">
        <div className="ap-note" style={{ lineHeight: 1.8 }}>
          <strong style={{ color: "var(--text)" }}>Player buys:</strong> Zombita takes her tier cut (to the treasury, destroyed in burn mode); the keeper keeps the rest.<br />
          <strong style={{ color: "var(--text)" }}>Player sells:</strong> the keeper pays from their till, or refuses if they can't.<br />
          <strong style={{ color: "var(--text)" }}>Every 3 days:</strong> target = {Math.round((st.float_pct || 0.2) * 100)}% of the healthy level shared by kiosk count, raised to last cycle's payouts (at most {st.busy_max || 3}×). Tills above {st.sweep_over || 1.5}× target are swept back to target; tills below are refilled, keepers who refused sells first, without taking the treasury under {Math.round((st.fund_floor || 0.6) * 100)}% of its cap.<br />
          <strong style={{ color: "var(--text)" }}>Every trade</strong> is recorded with the player, for keeper relationships later.
        </div>
      </FB>
    </div>
  </>);
}
