"use client";
// @ts-nocheck
// Player Stats: what the in-game stat recorder has for each player, laid out for people.
// Every player in one sortable table; click one for all their numbers in sections
// (time, towns, kills, weapons, hunting, PvP, deaths, skills, activities, Dawn of the Dead)
// and their recent events. Read-only — see routers/admin_player_stats.py.
// The raw tables are still in Zombita Data.
import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { fetchApi, relTime, fmtFull, fmt, Title, SC, TW, B, Load, Empty } from "./shared";

const mono = { fontFamily: "var(--mono)", fontSize: 12 };
const dim = { ...mono, color: "var(--textdim)" };
const num = (v, unit) => (v == null ? "—" : `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit ? " " + unit : ""}`);

const COLS = [
  { key: "name", label: "Player", text: true },
  { key: "online_h", label: "Online", unit: "h" },
  { key: "afk_h", label: "AFK", unit: "h" },
  { key: "kills", label: "Kills" },
  { key: "deaths", label: "Deaths" },
  { key: "pvp_kills", label: "PvP kills" },
  { key: "hunt", label: "Hunted" },
  { key: "walk_km", label: "Walked", unit: "km" },
  { key: "drive_km", label: "Driven", unit: "km" },
  { key: "top_town", label: "Most time in", text: true },
  { key: "top_weapon", label: "Top weapon", text: true },
  { key: "dotd", label: "DotD" },
  { key: "last_seen", label: "Last seen" },
];

const EVENT_LABELS = {
  afk_long: "AFK for an hour+", pvp_kill: "Killed a player", death: "Died", dotd_start: "Dawn of the Dead started",
  dotd_end: "Dawn of the Dead ended",
};

// One section as a small table. Activities rows can open to show details (recipes, animals ...).
const SectionCard = ({ s }) => {
  const [open, setOpen] = useState({});
  const rows = s.rows || [];
  const right = s.total != null ? <span style={{ ...mono, color: "var(--accent)" }}>{num(s.total)} total</span> : null;
  return (
    <TW title={s.title} right={right}>
      {!rows.length ? <Empty text="Nothing recorded yet" /> :
        <table className="ap-t"><tbody>
          {rows.map((r, i) => <Fragment key={i}>
            <tr style={r.details?.length ? { cursor: "pointer" } : null}
                onClick={() => r.details?.length && setOpen(o => ({ ...o, [i]: !o[i] }))}>
              <td style={mono}>
                {r.icon && <img src={r.icon} alt="" width={20} height={20} style={{ verticalAlign: "middle", marginRight: 8 }} />}
                {r.details?.length ? (open[i] ? "▾ " : "▸ ") : ""}{r.label}
                {r.sub && <div style={{ ...dim, fontSize: 10 }}>{r.sub}</div>}
              </td>
              <td style={{ ...mono, textAlign: "right", color: r.value ? "var(--text)" : "var(--textdim)" }}>{num(r.value, r.unit)}</td>
            </tr>
            {open[i] && r.details.map((d, j) =>
              <tr key={`${i}-${j}`}><td style={{ ...dim, paddingLeft: 36 }}>{d.label}</td>
                <td style={{ ...dim, textAlign: "right" }}>{num(d.value)}</td></tr>)}
          </Fragment>)}
        </tbody></table>}
    </TW>
  );
};

const PlayerDetail = ({ name, season, onClose, toast }) => {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    setD(null); setErr("");
    fetchApi(`/api/admin/player-stats/player?name=${encodeURIComponent(name)}&season=${encodeURIComponent(season)}`)
      .then(setD).catch(e => { setErr(e.message); toast?.(e.message, "error"); });
  }, [name, season, toast]);
  if (err) return <TW title={name} right={<B sm c="ghost" onClick={onClose}>Close</B>}><Empty text={err} /></TW>;
  if (!d) return <Load />;
  const sec = Object.fromEntries(d.sections.map(s => [s.key, s]));
  const val = (k, label) => (sec[k]?.rows || []).find(r => r.label === label)?.value;
  const topWeapon = sec.weapons?.rows?.[0];
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="ap-tw" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "var(--display)", fontSize: 30, letterSpacing: 2, color: "var(--accent)" }}>{d.name}</div>
        <div style={dim}>
          {d.last ? <>last seen {relTime(d.last.ts)} in <b style={{ color: "var(--text)" }}>{d.last.town}</b> ({d.last.x}, {d.last.y})</> : "no position yet"}
          {" · "}{d.season}
        </div>
        <div style={{ flex: 1 }} />
        <B sm c="ghost" onClick={onClose}>Close</B>
      </div>
      <div className="ap-sr">
        <SC label="Online" value={num(val("time", "Online"), "h")} sub={`AFK ${num(val("time", "AFK (standing still 10+ min)"), "h")}`} />
        <SC label="Zombie kills" value={num(sec.kills?.total)} color="gold" sub={topWeapon ? `mostly ${topWeapon.label}` : ""} />
        <SC label="Deaths" value={num(sec.deaths?.total)} color="red" sub={`PvP kills ${num(val("pvp", "Players killed"))}`} />
        <SC label="Most time in" value={sec.towns?.rows?.[0]?.label || "—"} color="blue" sub={sec.towns?.rows?.[0] ? num(sec.towns.rows[0].value, "h") : ""} />
      </div>
      <div className="ap-3c" style={{ alignItems: "start" }}>
        {d.sections.map(s => <SectionCard key={s.key} s={s} />)}
      </div>
      <TW title="Recent events" right={<span style={dim}>newest first, last 100</span>}>
        {!d.events.length ? <Empty text="No events yet (deaths, PvP, long AFK, Dawn of the Dead)" /> :
          <div style={{ overflowX: "auto" }}><table className="ap-t"><thead><tr><th>When</th><th>What</th><th>Where</th><th>Details</th></tr></thead><tbody>
            {d.events.map((e, i) => <tr key={i}>
              <td style={dim}>{fmtFull(e.ts)}</td>
              <td style={mono}>{EVENT_LABELS[e.kind] || e.kind}</td>
              <td style={mono}>{e.town || "—"}{e.x != null && <span style={dim}> ({e.x}, {e.y})</span>}</td>
              <td style={dim}>{Object.entries(e.data || {}).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ") || "—"}</td>
            </tr>)}
          </tbody></table></div>}
      </TW>
    </div>
  );
};

export default function PlayerStatsTab({ toast }) {
  const [o, setO] = useState(null);
  const [season, setSeason] = useState("");
  const [sort, setSort] = useState({ key: "online_h", dir: -1 });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await fetchApi(`/api/admin/player-stats/overview?season=${encodeURIComponent(season)}`);
      setO(r);
      if (!season) setSeason(r.season);
    } catch (e) { toast?.("Player stats: " + e.message, "error"); }
  }, [season, toast]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const list = (o?.players || []).filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()));
    const col = COLS.find(c => c.key === sort.key);
    return [...list].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      const c = col?.text ? String(x || "").localeCompare(String(y || "")) : (Number(x) || 0) - (Number(y) || 0);
      return c * sort.dir;
    });
  }, [o, q, sort]);

  if (!o) return <Load />;
  const onlineNow = o.players.filter(p => p.online_now).length;
  const totals = o.players.reduce((t, p) => ({ kills: t.kills + p.kills, online: t.online + p.online_h, deaths: t.deaths + p.deaths }),
    { kills: 0, online: 0, deaths: 0 });

  return (
    <div>
      <Title t="PLAYER STATS" s="What the in-game stat recorder has for each player. Click a player to see everything. Raw tables are in Zombita Data." />
      <div className="ap-sr">
        <SC label="Players recorded" value={fmt(o.players.length)} sub={`${onlineNow} online now`} />
        <SC label="Hours online (all)" value={num(Math.round(totals.online))} color="blue" />
        <SC label="Zombie kills (all)" value={fmt(totals.kills)} color="gold" />
        <SC label="Deaths (all)" value={fmt(totals.deaths)} color="red" />
      </div>

      {open && <PlayerDetail name={open} season={season} onClose={() => setOpen(null)} toast={toast} />}

      <TW title="Players" right={<>
        <input className="ap-search" placeholder="Search player..." value={q} onChange={e => setQ(e.target.value)} />
        <select className="ap-sel" style={{ width: "auto" }} value={season} onChange={e => { setSeason(e.target.value); setOpen(null); }}>
          {o.seasons.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <B sm c="ghost" onClick={load}>Refresh</B>
      </>}>
        {!rows.length ? <Empty text="The recorder has nobody for this season yet" /> :
          <div style={{ overflowX: "auto" }}><table className="ap-t"><thead><tr>
            {COLS.map(c => <th key={c.key} style={{ cursor: "pointer", whiteSpace: "nowrap" }}
              onClick={() => setSort(s => ({ key: c.key, dir: s.key === c.key ? -s.dir : (c.text ? 1 : -1) }))}>
              {c.label}{sort.key === c.key ? (sort.dir < 0 ? " ▾" : " ▴") : ""}</th>)}
          </tr></thead><tbody>
            {rows.map(p => <tr key={p.name} onClick={() => setOpen(p.name === open ? null : p.name)}
                               style={{ cursor: "pointer", background: p.name === open ? "rgba(200,168,75,0.06)" : undefined }}>
              <td style={{ ...mono, color: "var(--accent)", whiteSpace: "nowrap" }}>
                <span title={p.online_now ? `online, in ${p.where}` : "offline"}
                      style={{ display: "inline-block", width: 7, height: 7, borderRadius: 4, marginRight: 8,
                               background: p.online_now ? "var(--green)" : "var(--muted)" }} />{p.name}</td>
              <td style={mono}>{num(p.online_h)}</td>
              <td style={mono}>{num(p.afk_h)}{p.afk_pct ? <span style={dim}> ({p.afk_pct}%)</span> : null}</td>
              <td style={mono}>{fmt(p.kills)}</td>
              <td style={mono}>{fmt(p.deaths)}</td>
              <td style={mono}>{fmt(p.pvp_kills)}</td>
              <td style={mono}>{fmt(p.hunt)}</td>
              <td style={mono}>{num(p.walk_km)}</td>
              <td style={mono}>{num(p.drive_km)}</td>
              <td style={mono}>{p.top_town || "—"}</td>
              <td style={mono}>{p.top_weapon || "—"}</td>
              <td style={mono}>{fmt(p.dotd)}</td>
              <td style={dim}>{p.last_seen ? relTime(p.last_seen) : "—"}</td>
            </tr>)}
          </tbody></table></div>}
      </TW>

      <TW title="Towns the recorder knows" right={<span style={dim}>turn towns ON/OFF in-game: Zombita Control → TOWNS</span>}>
        {!o.towns.length ? <Empty text="Towns haven't been read from the map files yet" /> :
          <div style={{ overflowX: "auto" }}><table className="ap-t"><thead><tr>
            <th>Town</th><th>From</th><th>On the server's map list</th><th>Recorder</th><th>Why</th><th>Hours this season</th>
          </tr></thead><tbody>
            {o.towns.map(t => <tr key={t.town}>
              <td style={{ ...mono, color: t.on ? "var(--text)" : "var(--textdim)" }}>{t.town}</td>
              <td style={dim}>{t.source === "vanilla" ? "Kentucky (base map)" : t.map}</td>
              <td style={{ ...mono, color: t.on_map_list ? "var(--green)" : "var(--textdim)" }}>{t.on_map_list ? "yes" : "no"}</td>
              <td style={{ ...mono, color: t.on ? "var(--green)" : "var(--red)" }}>{t.on ? "ON" : "OFF"}</td>
              <td style={dim}>{t.chosen ? `set by ${t.set_by} ${t.set_at ? relTime(t.set_at) : ""}` : "follows map list"}</td>
              <td style={mono}>{num(t.hours)}</td>
            </tr>)}
          </tbody></table></div>}
      </TW>
    </div>
  );
}
