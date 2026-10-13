"use client";
// @ts-nocheck
// Deaths: every death the in-game recorder saw (mod 1.7.185), in full, and the character restore (mod 1.7.186).
// Read: routers/deaths.py (GET /api/admin/deaths, /api/admin/deaths/one). A restore or "check in game" goes through Live Ops
// (POST /api/admin/ops/do de_restore / de_list, audited with the admin's name) and its answer is polled from
// /api/admin/ops/result/{id}. Rules (the game's): within 24 hours of the death, once; items are moved from the body.
import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchApi, postApi, relTime, fmtFull, fmt, Title, SC, TW, B, Load, Empty } from "./shared";

const mono = { fontFamily: "var(--mono)", fontSize: 12 };
const dim = { ...mono, color: "var(--textdim)" };
const RED = "#e05a4f", GREEN = "#4caf7d", GOLD = "var(--accent)", BLUE = "#4a8fc4", GREY = "var(--textdim)";

const STATUS = {
  ready:   { label: "Can restore", color: GREEN },
  queued:  { label: "Queued", color: BLUE },
  done:    { label: "Restored", color: GOLD },
  expired: { label: "Too old", color: GREY },
  none:    { label: "No copy", color: GREY },
  unknown: { label: "Check in game", color: BLUE },
};

const Badge = ({ color, children, title }) => (
  <span title={title} style={{ ...mono, fontSize: 11, padding: "2px 7px", borderRadius: 3, border: `1px solid ${color}`, color, whiteSpace: "nowrap" }}>
    {children}
  </span>
);
const Chips = ({ list, empty = "none" }) => !list?.length ? <span style={dim}>{empty}</span> :
  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{list.map((x, i) => <Badge key={i} color="var(--border)"><span style={{ color: "var(--text)" }}>{x}</span></Badge>)}</div>;
const Row = ({ k, children }) => (
  <tr><td style={{ ...dim, width: 190, verticalAlign: "top" }}>{k}</td><td style={mono}>{children}</td></tr>
);
const prettyItem = (t) => String(t || "").replace(/^Base\./, "").replace(/_/g, " ");

// health over the last 30 seconds as small bars (0-100), newest on the right
const HealthBars = ({ pts }) => {
  if (!pts?.length) return <span style={dim}>no health history (no report from their game)</span>;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 60 }}>
        {pts.map((p, i) => (
          <div key={i} title={`${p.t} s: ${p.h}`} style={{ flex: 1, minWidth: 3, height: `${Math.max(2, p.h * 0.6)}px`,
            background: p.h > 60 ? GREEN : p.h > 25 ? "#d8a03a" : RED, opacity: 0.85 }} />
        ))}
      </div>
      <div style={{ ...dim, display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span>{pts[0].t} s</span><span>health {pts[0].h} to {pts[pts.length - 1].h}</span><span>death</span>
      </div>
    </div>
  );
};

// ask the game through Live Ops and wait for its answer (up to ~25 s)
async function askGame(cmd, ref) {
  const r = await postApi("/api/admin/ops/do", { cmd, ref });
  if (!r?.id) return { ok: r?.ok !== false, msg: r?.msg || "Sent." };
  for (let i = 0; i < 17; i++) {
    await new Promise(res => setTimeout(res, 1500));
    const a = await fetchApi(`/api/admin/ops/result/${encodeURIComponent(r.id)}`);
    if (a?.done) return { ok: a.ok, msg: a.msg };
  }
  return { ok: null, msg: "Sent. The game hasn't answered yet (a restart, or nobody near). Check again in a minute." };
}

const DeathDetail = ({ id, onClose, onChanged, toast }) => {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState("");
  const [answer, setAnswer] = useState(null);
  const [showRecipes, setShowRecipes] = useState(false);
  const load = useCallback(() => {
    fetchApi(`/api/admin/deaths/one?id=${encodeURIComponent(id)}`).then(setD).catch(e => toast?.(e.message, "error"));
  }, [id, toast]);
  useEffect(() => { setD(null); setAnswer(null); load(); }, [load]);

  const restore = async () => {
    if (!confirm(`Restore ${d.player}'s character from this death?\n\n` +
      "Skills go back up to at least what they had, traits and recipes come back, and the items still on the body are moved " +
      "into their bag (the body is removed). Once per death, within 24 hours. They need a new character in game; " +
      "the items wait until someone is near the body.")) return;
    setBusy("restore");
    try {
      const a = await askGame("de_restore", d.id);
      setAnswer(a);
      toast?.(a.msg, a.ok === false ? "error" : "success");
      load(); onChanged?.();
    } catch (e) { toast?.(e.message, "error"); }
    setBusy("");
  };
  const checkGame = async () => {
    setBusy("check");
    try { setAnswer(await askGame("de_list", d.player)); } catch (e) { toast?.(e.message, "error"); }
    setBusy("");
  };

  if (!d) return <Load />;
  const st = STATUS[d.restore] || STATUS.unknown;
  const canRestore = d.restore === "ready" || d.restore === "unknown";
  return (
    <TW title={`${d.player}${d.name ? " (" + d.name + ")" : ""} - ${fmtFull(d.at)}`} right={<B sm c="ghost" onClick={onClose}>Close</B>}>
      <div style={{ padding: "4px 16px 16px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "8px 0 14px" }}>
          <Badge color={st.color}>{st.label}</Badge>
          <span style={dim}>{d.restore_text}</span>
          <span style={{ flex: 1 }} />
          {canRestore && <B sm c="gold" disabled={!!busy} onClick={restore}>{busy === "restore" ? "Asking the game..." : "Restore this character"}</B>}
          <B sm c="ghost" disabled={!!busy} onClick={checkGame}>{busy === "check" ? "Asking..." : "Check in game"}</B>
        </div>
        {answer && <div className="ap-note" style={{ marginBottom: 14, borderColor: answer.ok === false ? RED : GREEN }}>
          {String(answer.msg || "").split(" ;; ").map((l, i) => <div key={i} style={mono}>{l}</div>)}
        </div>}

        <h4 style={{ margin: "6px 0" }}>What happened</h4>
        <table className="ap-t"><tbody>
          <Row k="Best guess">{d.guess}{d.desync && <> <Badge color={RED} title="The server had zombies on them that their screen didn't show">DESYNC</Badge></>}</Row>
          <Row k="Where">{d.x}, {d.y}, {d.z} {d.in_car ? "(in a car)" : d.inside ? "(indoors)" : "(outdoors)"}</Row>
          <Row k="Health, last 30 s"><HealthBars pts={d.health_timeline} /></Row>
          <Row k="Hits, last 60 s">{d.hits?.length ? <table style={{ width: "100%" }}><tbody>
            {d.hits.map((h, i) => <tr key={i}><td style={dim}>{h.t} s</td><td style={mono}>{String(h.kind).toLowerCase()}</td><td style={{ ...mono, textAlign: "right" }}>{h.dmg}</td></tr>)}
          </tbody></table> : <span style={dim}>none recorded</span>}</Row>
          <Row k="Wounds"><Chips list={d.wounds} /></Row>
          <Row k="Moodles"><Chips list={d.moodles} /></Row>
          <Row k="Zombie infection">{d.infection > 0 ? <span style={{ color: RED }}>{d.infection}</span> : "no"}</Row>
          <Row k="Zombies near">
            <table style={{ width: "100%" }}><thead><tr><td style={dim}></td><td style={dim}>2 tiles</td><td style={dim}>5 tiles</td><td style={dim}>15 tiles</td><td style={dim}>on them</td></tr></thead><tbody>
              <tr><td style={dim}>their screen</td><td>{d.screen.within2}</td><td>{d.screen.within5}</td><td>{d.screen.within15}</td><td>{d.screen.on_me}</td></tr>
              <tr><td style={dim}>the server</td><td>{d.server.within2}</td><td>{d.server.within5}</td><td>{d.server.within15}</td><td>{d.server.on_me}</td></tr>
            </tbody></table>
            {!d.reported && <div style={{ ...dim, marginTop: 4 }}>No report from their game (a crash or disconnect): the server's view only.</div>}
          </Row>
          <Row k="Players near"><Chips list={d.near_players} empty="nobody within 15 tiles" /></Row>
          <Row k="Server freezes, last minute">{d.freezes ? `${d.freezes} (worst ${fmt(d.worst_freeze_ms)} ms)` : "none"}</Row>
        </tbody></table>

        <h4 style={{ margin: "18px 0 6px" }}>The character they lost</h4>
        <table className="ap-t"><tbody>
          <Row k="Name">{d.name || "-"}</Row>
          <Row k="Profession">{d.profession || "-"}</Row>
          <Row k="Survived">{d.hours} in-game hours, {fmt(d.kills)} kills</Row>
          <Row k="Traits"><Chips list={d.traits} /></Row>
          <Row k="Recipes known">{d.recipes?.length ? <>
            <span>{d.recipes.length} </span><B sm c="ghost" onClick={() => setShowRecipes(v => !v)}>{showRecipes ? "Hide" : "Show"}</B>
            {showRecipes && <div style={{ marginTop: 8 }}><Chips list={d.recipes} /></div>}
          </> : <span style={dim}>none saved</span>}</Row>
        </tbody></table>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginTop: 14 }}>
          <div>
            <h4 style={{ margin: "6px 0" }}>Skills</h4>
            {!d.skills?.length ? <Empty text="No skills saved" /> :
              <table className="ap-t"><thead><tr><th>Skill</th><th style={{ textAlign: "right" }}>Level</th><th style={{ textAlign: "right" }}>XP</th></tr></thead><tbody>
                {d.skills.map(s => <tr key={s.name}><td style={mono}>{s.name}{s.passive ? <span style={dim}> (passive)</span> : ""}</td>
                  <td style={{ ...mono, textAlign: "right", color: GOLD }}>{s.level}</td><td style={{ ...dim, textAlign: "right" }}>{fmt(Math.round(s.xp))}</td></tr>)}
              </tbody></table>}
          </div>
          <div>
            <h4 style={{ margin: "6px 0" }}>What they carried</h4>
            {!d.items?.length ? <Empty text="No items saved" /> :
              <table className="ap-t"><tbody>
                {d.items.map((it, i) => <tr key={i}><td style={mono} title={it.type}>{prettyItem(it.type)}</td>
                  <td style={{ ...mono, textAlign: "right" }}>x{it.count}</td></tr>)}
              </tbody></table>}
            <div style={{ ...dim, marginTop: 6 }}>A restore moves what is still on the body. Anything a friend already took is not given twice.</div>
          </div>
        </div>
      </div>
    </TW>
  );
};

export default function DeathsTab({ toast }) {
  const [data, setData] = useState(null);
  const [player, setPlayer] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchApi(`/api/admin/deaths?limit=150${player ? "&player=" + encodeURIComponent(player) : ""}`));
    } catch (e) { toast?.("Deaths: " + e.message, "error"); }
  }, [player, toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const rows = useMemo(() => (data?.deaths || []).filter(d =>
    filter === "all" ? true : filter === "restorable" ? (d.restore === "ready" || d.restore === "unknown")
      : filter === "desync" ? d.desync : filter === "restored" ? (d.restore === "done" || d.restore === "queued") : true), [data, filter]);

  if (!data) return <Load />;
  const all = data.deaths;
  return (
    <div>
      <Title t="DEATHS" s="Every death the game recorded, in full. A character can be restored within 24 hours of the death, once: skills, traits, recipes, and the items still on the body." />
      <div className="ap-sr">
        <SC label="Deaths shown" value={fmt(all.length)} sub={`${fmt(data.total)} recorded${player ? " for " + player : ""}`} />
        <SC label="Can restore now" value={fmt(all.filter(d => d.restore === "ready").length)} color="green" />
        <SC label="Queued / restored" value={`${all.filter(d => d.restore === "queued").length} / ${all.filter(d => d.restore === "done").length}`} color="orange" />
        <SC label="Desync deaths" value={fmt(all.filter(d => d.desync).length)} color="red" sub="zombies the screen didn't show" />
      </div>
      {!data.state_ts && <div className="ap-note" style={{ margin: "0 0 12px" }}>The game isn't writing its restore list yet (mod 1.7.190), so "Can restore" is worked out from the death records. Use "Check in game" to be sure.</div>}

      {open && <DeathDetail id={open} onClose={() => setOpen(null)} onChanged={load} toast={toast} />}

      <TW title="Deaths, newest first" right={<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select className="ap-sel" value={player} onChange={e => setPlayer(e.target.value)} style={{ minWidth: 140 }}>
          <option value="">Every player</option>
          {data.players.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="ap-sel" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All</option><option value="restorable">Can restore</option>
          <option value="restored">Queued or restored</option><option value="desync">Desync only</option>
        </select>
        <B sm c="ghost" onClick={load}>Refresh</B>
      </div>}>
        {!rows.length ? <Empty text="No deaths here" /> :
          <table className="ap-t">
            <thead><tr><th>When</th><th>Player</th><th>Where</th><th>Best guess</th><th title="zombies within 5 tiles: their screen / the server">Zombies 5 tiles</th><th>Freezes</th><th>Restore</th><th></th></tr></thead>
            <tbody>
              {rows.map(d => {
                const st = STATUS[d.restore] || STATUS.unknown;
                return (
                  <tr key={d.id} style={{ cursor: "pointer", background: open === d.id ? "rgba(200,168,75,0.08)" : undefined }} onClick={() => setOpen(d.id)}>
                    <td style={mono} title={fmtFull(d.at)}>{relTime(d.at)}</td>
                    <td style={mono}>{d.player}{d.name ? <div style={{ ...dim, fontSize: 10 }}>{d.name}</div> : null}</td>
                    <td style={dim}>{d.x}, {d.y}{d.z ? ", " + d.z : ""}</td>
                    <td style={mono}>{d.guess}{d.desync && <> <Badge color={RED}>DESYNC</Badge></>}</td>
                    <td style={mono}>{d.reported ? d.seen5 : "?"} / {d.srv5}</td>
                    <td style={d.freezes ? { ...mono, color: RED } : dim}>{d.freezes || "-"}</td>
                    <td title={d.restore_text}><Badge color={st.color}>{st.label}</Badge></td>
                    <td><B sm c="ghost" onClick={e => { e.stopPropagation(); setOpen(d.id); }}>Details</B></td>
                  </tr>
                );
              })}
            </tbody>
          </table>}
      </TW>
    </div>
  );
}
