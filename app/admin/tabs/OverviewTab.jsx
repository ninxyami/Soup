"use client";
// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { fetchApi, postApi, fmt, bronzeToCoins, relTime, SC, Title, TW, B, Empty, Load, EvBadge } from "./shared";

const OnlinePlayers = () => {
  const [data, setData] = useState(null);
  const load = useCallback(async () => {
    try { setData(await fetchApi("/api/admin/server/online-players")); }
    catch { setData({ players: [], count: 0 }); }
  }, []);
  useEffect(() => { load(); const iv = setInterval(load, 30000); return () => clearInterval(iv); }, [load]);

  return (
    <div className="ap-tw" style={{ marginBottom: 28 }}>
      <div className="ap-tw-h">
        <h3>🟢 ONLINE NOW</h3>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>auto-refresh 30s</span>
        <B c="ghost" sm onClick={load}>↻</B>
      </div>
      {data === null ? <Load /> : data.count === 0
        ? <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", padding: "16px 0" }}>😴 No survivors online</div>
        : <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 0" }}>
            {data.players.map((name, i) => (
              <span key={i} style={{ fontFamily: "var(--mono)", fontSize: 12, background: "var(--surface2)", border: "1px solid var(--border)", padding: "4px 12px", borderRadius: 2, color: "var(--green)" }}>
                🧟 {name}
              </span>
            ))}
          </div>
      }
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)", marginTop: 4 }}>
        {data ? `${data.count} survivor${data.count !== 1 ? "s" : ""} in the zone` : ""}
      </div>
    </div>
  );
};


const RconPasswordWidget = ({ toast }) => {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orig, setOrig] = useState("");

  useEffect(() => {
    fetchApi("/api/admin/config/rcon-password").then(d => {
      setPw(d.password || ""); setOrig(d.password || ""); setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const save = async () => {
    if (!pw.trim()) { toast("RCON password cannot be empty", "error"); return; }
    setSaving(true);
    try {
      await postApi("/api/admin/config/rcon-password", { password: pw });
      setOrig(pw);
      toast("RCON password updated! Restart server + API to apply.", "success");
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };

  const changed = pw !== orig;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input type={show ? "text" : "password"} className="ap-inp"
            value={loaded ? pw : "Loading..."} onChange={e => setPw(e.target.value)} disabled={!loaded}
            style={{ paddingRight: 36, borderColor: changed ? "var(--accent)" : undefined }}
          />
          <button onClick={() => setShow(s => !s)} style={{
            position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", color: "var(--textdim)", cursor: "pointer", fontSize: 12,
          }}>{show ? "🙈" : "👁"}</button>
        </div>
        {changed && <>
          <B c="ghost" sm onClick={() => setPw(orig)}>Reset</B>
          <B c="gold" sm onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</B>
        </>}
      </div>
      {changed && <div style={{ fontSize: 10, color: "var(--accent)", fontFamily: "var(--mono)", marginTop: 4 }}>⚠ Unsaved — will update servertest.ini, config.py, and shared.py</div>}
    </div>
  );
};

export default function OverviewTab({ toast }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [season, setSeason]               = useState(null);
  const [seasonInput, setSeasonInput]     = useState("");
  const [shortInput, setShortInput]       = useState("");
  const [subtitleInput, setSubtitleInput] = useState("");
  const [seasonSaving, setSeasonSaving]   = useState(false);

  const loadSeason = useCallback(async () => {
    try {
      const r = await fetchApi("/api/admin/server/season");
      setSeason(r);
      setSeasonInput(r.current_season || "");
      setShortInput(r.season_short || "");
      setSubtitleInput(r.season_subtitle || "");
    } catch {}
  }, []);

  const saveSeason = async () => {
    if (!seasonInput.trim()) { toast("Season name can't be empty", "error"); return; }
    setSeasonSaving(true);
    try {
      await postApi("/api/admin/server/season", {
        current_season:  seasonInput.trim(),
        season_short:    shortInput.trim(),
        season_subtitle: subtitleInput.trim(),
      });
      toast("Season updated — restart bot + API to apply", "success");
      await loadSeason();
    } catch (e) { toast(e.message, "error"); }
    setSeasonSaving(false);
  };

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

  useEffect(() => { load(); loadSeason(); const iv = setInterval(load, 30000); return () => clearInterval(iv); }, [load, loadSeason]);

  if (loading) return <Load />;

  const t = d?.t?.treasury, s24 = d?.t?.stats_24h, items = d?.shop?.items || [], com = d?.com, log = d?.t?.recent_log || [], oos = items.filter(i => i.stock === 0).length;

  return (<>
    <Title t="COMMAND CENTER" s="system overview · treasury health · recent activity" />
    <div className="ap-sr">
      <SC label="Treasury Balance" value={t ? fmt(t.balance) : "—"} sub={t ? `${t.health_pct}% health` : ""} />
      <SC label="Paid Out (24h)" value={s24 ? fmt(s24.paid_out) : "—"} color="green" sub={s24 ? `${s24.payout_count} payouts` : ""} />
      <SC label="Shop Items" value={items.filter(i => i.enabled).length || "—"} color="blue" sub={`${oos} out of stock`} />
      <SC label="Total Players" value={com?.total_players ?? "—"} color="orange" sub={com?.total_games ? `${com.total_games} games played` : ""} />
    </div>

    <OnlinePlayers />

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

    <div className="ap-fb" style={{ marginBottom: 24 }}>
      <h4 style={{ fontFamily: "var(--display)", fontSize: 18, letterSpacing: 2, color: "var(--text)", margin: "0 0 12px 0" }}>🗓 SEASON CONFIG</h4>
      <div className="ap-note">
        Changes are written to config.py on the server. Restart the bot + API after saving for everything to update.
      </div>
      {season && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)", marginBottom: 16, padding: "8px 12px", background: "rgba(200,168,75,0.05)", border: "1px solid rgba(200,168,75,0.15)" }}>
          Current: <strong>{season.current_season}</strong> · Short: {season.season_short} · Subtitle: {season.season_subtitle}
        </div>
      )}
      <div className="ap-3c" style={{ marginBottom: 12 }}>
        <div className="ap-fg">
          <label className="ap-fl">Full Season Name</label>
          <input className="ap-inp" placeholder="Season 2: Blood Moon" value={seasonInput} onChange={e => setSeasonInput(e.target.value)} />
        </div>
        <div className="ap-fg">
          <label className="ap-fl">Short Name</label>
          <input className="ap-inp" placeholder="Season 2" value={shortInput} onChange={e => setShortInput(e.target.value)} />
        </div>
        <div className="ap-fg">
          <label className="ap-fl">Subtitle</label>
          <input className="ap-inp" placeholder="Blood Moon" value={subtitleInput} onChange={e => setSubtitleInput(e.target.value)} />
        </div>
      </div>
      <B c="gold" onClick={saveSeason} disabled={seasonSaving}>
        {seasonSaving ? "Saving..." : "Save Season"}
      </B>
    </div>

    <div className="ap-fb" style={{ marginBottom: 24 }}>
      <h4 style={{ fontFamily: "var(--display)", fontSize: 18, letterSpacing: 2, color: "var(--text)", margin: "0 0 12px 0" }}>🔑 RCON PASSWORD</h4>
      <div className="ap-note">
        Changes are synced to servertest.ini, config.py, and shared.py. Restart the server + API after changing.
      </div>
      <RconPasswordWidget toast={toast} />
    </div>

    <TW title="RECENT ACTIVITY" right={<B c="ghost" sm onClick={load}>Refresh</B>}>
      {log.length ? <div>{log.slice(0, 12).map((e, i) => <div key={i} className="ap-lr">
        <span className="ap-lr-t">{relTime(e.timestamp)}</span><EvBadge type={e.event_type} />
        <span className="ap-lr-d">{e.reason || "—"}</span>
        <span className="ap-lr-p">{e.player || (e.discord_id ? `#${e.discord_id}` : "—")}</span>
        <span className={`ap-lr-v ${["payout", "burn"].includes(e.event_type) ? "neg" : e.amount > 0 ? "pos" : "neu"}`}>{["payout", "burn"].includes(e.event_type) ? "−" : e.amount > 0 ? "+" : ""}{fmt(Math.abs(e.amount))} 🟤</span>
      </div>)}</div> : <Empty text="no events yet" />}
    </TW>
  </>);
}
