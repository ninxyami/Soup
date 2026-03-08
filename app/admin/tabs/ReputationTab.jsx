"use client";
// @ts-nocheck
import { useState, useEffect, useMemo } from "react";
import { fetchApi, postApi, fmt, relTime, fmtFull, Title, SC, TW, B, Inp, FB, Empty, Load } from "./shared";

const TIER_LABEL = (pts) => {
  if (pts >= 200) return { label: "Legendary", color: "var(--accent)" };
  if (pts >= 100) return { label: "Honored",   color: "var(--green)" };
  if (pts >= 50)  return { label: "Respected", color: "var(--blue)" };
  if (pts >= 20)  return { label: "Known",     color: "var(--textdim)" };
  if (pts >= 0)   return { label: "Neutral",   color: "var(--muted)" };
  return           { label: "Notorious",  color: "var(--red)" };
};

const RepBadge = ({ pts }) => {
  const { label, color } = TIER_LABEL(pts);
  return (
    <span style={{
      fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 1,
      padding: "2px 8px", borderRadius: 2,
      border: `1px solid ${color}22`,
      background: `${color}11`, color
    }}>{label}</span>
  );
};

// ── Player detail / edit view ──────────────────────────────────────────────

const RepDetail = ({ player, onBack, toast }) => {
  const [rep, setRep]           = useState(null);
  const [events, setEvents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [adjAmt, setAdjAmt]     = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [newOpinion, setNewOpinion] = useState("");
  const [newArchetype, setNewArchetype] = useState("");
  const [saving, setSaving]     = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [repData, evData] = await Promise.all([
          fetchApi(`/api/admin/reputation/player?discord_id=${player.discord_id}`),
          fetchApi(`/api/admin/reputation/events?discord_id=${player.discord_id}&limit=50`),
        ]);
        setRep(repData.reputation || null);
        setEvents(evData.events || []);
        if (repData.reputation) {
          setNewOpinion(repData.reputation.zombita_opinion || "");
          setNewArchetype(repData.reputation.archetype || "");
        }
      } catch (e) {
        toast(e.message, "error");
      }
      setLoading(false);
    })();
  }, [player.discord_id]);

  const adjustRep = async (sign) => {
    if (!adjAmt) { toast("Enter amount", "error"); return; }
    setSaving(true);
    try {
      const delta = parseInt(adjAmt) * sign;
      const r = await postApi("/api/admin/reputation/adjust", {
        discord_id: player.discord_id,
        display_name: player.display_name,
        delta,
        reason: adjReason || "Admin adjustment",
      });
      toast(`${delta > 0 ? "+" : ""}${delta} rep → ${player.display_name}`, "success");
      setRep(r.reputation);
      setAdjAmt(""); setAdjReason("");
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };

  const saveOpinion = async () => {
    setSaving(true);
    try {
      const r = await postApi("/api/admin/reputation/set-opinion", {
        discord_id: player.discord_id,
        display_name: player.display_name,
        opinion: newOpinion,
        archetype: newArchetype,
      });
      toast("Opinion & archetype saved", "success");
      setRep(r.reputation);
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };

  const forceAnalyze = async () => {
    setAnalyzing(true);
    try {
      await postApi("/api/admin/reputation/analyze-player", {
        discord_id: player.discord_id,
        display_name: player.display_name,
      });
      toast(`GPT analysis queued for ${player.display_name}`, "success");
    } catch (e) { toast(e.message, "error"); }
    setAnalyzing(false);
  };

  const pts = rep?.rep_points ?? 0;
  const tier = TIER_LABEL(pts);

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <B c="ghost" sm onClick={onBack}>← Back to Reputation</B>
      </div>

      <div style={{ fontFamily: "var(--display)", fontSize: 32, letterSpacing: 3, color: "var(--accent)", marginBottom: 4 }}>
        {player.display_name}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", marginBottom: 28 }}>
        ID: {player.discord_id} · Season 1: New Dawn
      </div>

      {loading ? <Load /> : (<>
        <div className="ap-sr" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          <SC label="Rep Points" value={fmt(pts)} color={pts < 0 ? "red" : pts >= 50 ? "green" : ""} sub={tier.label} />
          <SC label="Archetype" value={rep?.archetype?.replace(/_/g, " ") || "—"} color="purple" />
          <SC label="Last Analyzed" value={rep?.last_analyzed ? relTime(rep.last_analyzed) : "Never"} color="blue" />
        </div>

        {/* Zombita's current opinion */}
        {rep?.zombita_opinion && (
          <div style={{
            background: "rgba(200,168,75,0.04)", border: "1px solid rgba(200,168,75,0.12)",
            padding: "16px 20px", marginBottom: 24, fontFamily: "var(--mono)",
            fontSize: 12, color: "var(--textdim)", lineHeight: 1.8, borderLeft: "3px solid var(--accent)"
          }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--accent)", marginBottom: 8, textTransform: "uppercase" }}>
              Zombita's Current Take
            </div>
            "{rep.zombita_opinion}"
          </div>
        )}

        <div className="ap-2c">
          {/* Manual rep adjustment */}
          <FB title="ADJUST REPUTATION">
            <div className="ap-note">Manual override. Logged separately from GPT daily analysis.</div>
            <Inp label="Points" type="number" placeholder="10" value={adjAmt} onChange={e => setAdjAmt(e.target.value)} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0 12px" }}>
              {[5, 10, 25, 50].map(n => (
                <button key={n} className="ap-pre" onClick={() => setAdjAmt(String(n))}>{n}</button>
              ))}
            </div>
            <Inp label="Reason" placeholder="Legendary play, rule violation..." value={adjReason} onChange={e => setAdjReason(e.target.value)} />
            <div style={{ display: "flex", gap: 10 }}>
              <B c="green" onClick={() => adjustRep(+1)} disabled={saving}>＋ Add Rep</B>
              <B c="red"   onClick={() => adjustRep(-1)} disabled={saving}>－ Remove Rep</B>
            </div>
          </FB>

          {/* Override opinion + archetype */}
          <FB title="OVERRIDE OPINION">
            <div className="ap-note">Write Zombita's opinion directly. Next GPT cycle will overwrite this.</div>
            <div className="ap-fg">
              <label className="ap-fl">Archetype</label>
              <input className="ap-inp" placeholder="grinder, helper, chaos agent..." value={newArchetype} onChange={e => setNewArchetype(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0 12px" }}>
              {["grinder","helper","lurker","veteran","competitor","troublemaker","chaos agent","community pillar"].map(a => (
                <button key={a} className="ap-pre" onClick={() => setNewArchetype(a)}>{a}</button>
              ))}
            </div>
            <div className="ap-fg">
              <label className="ap-fl">Zombita's Opinion</label>
              <textarea className="ap-ta" rows={3} placeholder="She's been reliable. Shows up, doesn't complain..."
                value={newOpinion} onChange={e => setNewOpinion(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <B c="gold" onClick={saveOpinion} disabled={saving}>💾 Save Override</B>
              <B c="ghost" onClick={forceAnalyze} disabled={analyzing}>
                {analyzing ? "⏳ Analyzing..." : "🤖 Force GPT Analysis"}
              </B>
            </div>
          </FB>
        </div>

        {/* Event log */}
        <TW title={`OBSERVATION LOG (${events.length})`} right={
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)" }}>last 50 events</span>
        }>
          {events.length === 0 ? <Empty text="no events logged yet" /> : (
            <div>
              {events.map((e, i) => (
                <div key={i} className="ap-lr">
                  <span className="ap-lr-t">{relTime(e.timestamp)}</span>
                  <span style={{
                    fontFamily: "var(--mono)", fontSize: 10, padding: "2px 8px",
                    background: "rgba(255,255,255,0.04)", color: "var(--text)",
                    borderRadius: 2, whiteSpace: "nowrap"
                  }}>
                    {e.event_type?.replace(/_/g, " ")}
                  </span>
                  <span className="ap-lr-d" style={{ color: "var(--textdim)", fontSize: 11 }}>
                    {e.context && typeof e.context === "object" && Object.keys(e.context).length > 0
                      ? Object.entries(e.context).map(([k, v]) => `${k}: ${v}`).join(" · ")
                      : "—"}
                  </span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)", minWidth: 90, textAlign: "right" }}>
                    {fmtFull(e.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TW>
      </>)}
    </>
  );
};


// ── Main leaderboard view ──────────────────────────────────────────────────

export default function ReputationTab({ toast }) {
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState(null);
  const [running, setRunning]   = useState(false);
  const [logs, setLogs]         = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchApi("/api/admin/reputation/leaderboard?limit=100");
      setRows(data.leaderboard || []);
    } catch (e) {
      toast(e.message, "error");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.display_name?.toLowerCase().includes(q) ||
      r.archetype?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const runDailyAnalysis = async () => {
    setRunning(true);
    setLogs(["⏳ Starting daily analysis..."]);
    try {
      const r = await postApi("/api/admin/reputation/run-analysis", {});
      setLogs(prev => [...prev, `✅ ${r.message || "Analysis complete"}`, `📊 Updated: ${r.updated ?? "?"} players`]);
      toast("Daily analysis complete", "success");
      await load();
    } catch (e) {
      setLogs(prev => [...prev, `❌ Error: ${e.message}`]);
      toast(e.message, "error");
    }
    setRunning(false);
  };

  if (selected) {
    return <RepDetail player={selected} onBack={() => { setSelected(null); load(); }} toast={toast} />;
  }

  const totalPlayers  = rows.length;
  const legendary     = rows.filter(r => r.rep_points >= 200).length;
  const notorious     = rows.filter(r => r.rep_points < 0).length;
  const avgRep        = rows.length ? Math.round(rows.reduce((a, b) => a + (b.rep_points || 0), 0) / rows.length) : 0;

  return (
    <>
      <Title t="REPUTATION" s="zombita's opinion system · season 1: new dawn" />

      <div className="ap-sr">
        <SC label="Tracked Players" value={totalPlayers} />
        <SC label="Legendary"       value={legendary}    color="orange" />
        <SC label="Notorious"       value={notorious}    color="red" />
        <SC label="Avg Rep"         value={avgRep}       color="blue" />
      </div>

      {/* GPT Daily Analysis */}
      <div className="ap-fb" style={{ marginBottom: 24 }}>
        <h4 style={{ fontFamily: "var(--display)", fontSize: 18, letterSpacing: 2, color: "var(--text)", margin: "0 0 12px 0" }}>
          GPT DAILY ANALYSIS
        </h4>
        <div className="ap-note">
          Normally runs at 3am. Analyzes all active players from the last 24h and updates rep points, archetypes, and Zombita's opinion. Can be manually triggered here.
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <B c="gold" onClick={runDailyAnalysis} disabled={running}>
            {running ? "⏳ Running..." : "🤖 Run Analysis Now"}
          </B>
        </div>
        {logs.length > 0 && (
          <div className="ap-term" style={{ marginTop: 14 }}>
            {logs.map((l, i) => (
              <div key={i} className={`ap-term-line ${l.startsWith("✅") || l.startsWith("📊") ? "ok" : l.startsWith("❌") ? "err" : "cmd"}`}>
                {l}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leaderboard table */}
      <TW
        title="LEADERBOARD"
        right={
          <input
            className="ap-search"
            placeholder="search name or archetype..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        }
      >
        {loading ? <Load /> : (
          <table className="ap-t">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Rep Points</th>
                <th>Tier</th>
                <th>Archetype</th>
                <th>Zombita's Take</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={7}><Empty text="no reputation data yet" /></td></tr>
                : filtered.map((r, i) => {
                    const tier = TIER_LABEL(r.rep_points ?? 0);
                    const rank = rows.indexOf(r) + 1;
                    const rankDisplay = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
                    return (
                      <tr key={r.discord_id}>
                        <td style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--textdim)", width: 40 }}>
                          {rankDisplay}
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{r.display_name}</div>
                          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)" }}>{r.discord_id}</div>
                        </td>
                        <td>
                          <span style={{ fontFamily: "var(--display)", fontSize: 20, letterSpacing: 1, color: tier.color }}>
                            {fmt(r.rep_points ?? 0)}
                          </span>
                        </td>
                        <td><RepBadge pts={r.rep_points ?? 0} /></td>
                        <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--purple ?? #9775cc)" }}>
                          {r.archetype?.replace(/_/g, " ") || <span style={{ color: "var(--muted)" }}>—</span>}
                        </td>
                        <td style={{
                          fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)",
                          maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                        }}>
                          {r.zombita_opinion
                            ? `"${r.zombita_opinion}"`
                            : <span style={{ color: "var(--muted)" }}>no opinion yet</span>}
                        </td>
                        <td>
                          <B c="blue" sm onClick={() => setSelected(r)}>Manage</B>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        )}
      </TW>
    </>
  );
}
