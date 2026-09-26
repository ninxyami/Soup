"use client";
// @ts-nocheck
// Leaderboard sessions: END (post the final standings to the /archive page, then start over)
// and RESET (start over, nothing posted). The game server owns the live numbers, so both
// are requests the game picks up within a few seconds (see routers/leaderboards.py).
import { useState, useEffect, useCallback, Fragment } from "react";
import { fetchApi, postApi, relTime, fmtDate, fmtFull, fmt, Title, SC, B, FB, TW, Load, Empty, Inp } from "./shared";

const mono = { fontFamily: "var(--mono)", fontSize: 12 };
const hours = (h) => {
  h = Math.floor(Number(h) || 0);
  const d = Math.floor(h / 24);
  return d > 0 ? `${d}d ${h % 24}h` : `${h}h`;
};
const days = (d) => (d == null ? "—" : `${Number(d).toFixed(1)} days`);

const PlayersTable = ({ players }) => {
  const rows = [...(players || [])].sort((a, b) => (b.overallKills || 0) - (a.overallKills || 0));
  if (!rows.length) return <Empty text="Nobody on this board" />;
  return (
    <div style={{ overflowX: "auto" }}><table className="ap-t"><thead><tr>
      <th>#</th><th>Player</th><th>Kills</th><th>Deaths</th><th>Longest life</th><th>Whitelisted</th>
    </tr></thead><tbody>
      {rows.map((p, i) => <tr key={p.name}>
        <td style={mono}>{i + 1}</td><td style={mono}>{p.name}</td>
        <td style={{ ...mono, color: "var(--accent)" }}>{fmt(p.overallKills)}</td><td style={mono}>{fmt(p.deaths)}</td>
        <td style={mono}>{hours(p.bestLife)}</td><td style={mono}>{p.wl ? "yes" : "—"}</td>
      </tr>)}
    </tbody></table></div>
  );
};

export default function LeaderboardsTab({ toast }) {
  const [s, setS] = useState(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [open, setOpen] = useState(null);
  const [openPlayers, setOpenPlayers] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setS(await fetchApi("/api/admin/leaderboards/state")); }
    catch (e) { toast?.("Leaderboards: " + e.message, "error"); }
    setLoading(false);
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  // Poll while the game still has requests to run, so the result shows up by itself.
  useEffect(() => {
    if (!s?.pending?.length) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [s, load]);

  const endSession = async () => {
    if (!confirm(`End this leaderboard session${title ? ` as "${title}"` : ""}?\n\nThe final standings are posted to the website archive, then everyone's kills, deaths and survival start from zero.`)) return;
    setBusy(true);
    try { await postApi("/api/admin/leaderboards/end", { title }); toast("Asked the game to end the session", "success"); setTitle(""); load(); }
    catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };
  const reset = async () => {
    if (!confirm("Reset the leaderboard WITHOUT posting it to the archive?\n\nEveryone's kills, deaths and survival start from zero. (A private copy is kept in case it was a mistake.)")) return;
    setBusy(true);
    try { await postApi("/api/admin/leaderboards/reset", {}); toast("Asked the game to reset the leaderboard", "success"); load(); }
    catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };
  const saveStart = async () => {
    if (!startDate) return;
    try { await postApi("/api/admin/leaderboards/start", { started_at: startDate }); toast("Session start saved", "success"); load(); }
    catch (e) { toast(e.message, "error"); }
  };
  const view = async (id) => {
    if (open === id) { setOpen(null); return; }
    setOpen(id); setOpenPlayers(null);
    try { setOpenPlayers((await fetchApi(`/api/admin/leaderboards/sessions/${id}`)).players || []); }
    catch (e) { toast(e.message, "error"); }
  };
  const remove = async (x) => {
    if (!confirm(`Delete "${x.title || x.season}" (${x.kind === "end" ? "archived" : "reset copy"}, ended ${fmtDate(x.ended_at)})?\n\nIt disappears from the archive page. This can't be undone.`)) return;
    try { await fetchApi(`/api/admin/leaderboards/sessions/${x.id}`, { method: "DELETE" }); toast("Session deleted", "success"); load(); }
    catch (e) { toast(e.message, "error"); }
  };

  if (loading) return <><Title t="LEADERBOARDS" s="sessions · archive · reset" /><Load /></>;
  if (!s) return <><Title t="LEADERBOARDS" s="sessions · archive · reset" /><Empty text="Couldn't load the leaderboard state" /></>;

  const live = s.live || {};
  return (<>
    <Title t="LEADERBOARDS" s="end a session (posts to the archive) · reset (no archive) · history" />
    <div className="ap-sr" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
      <SC label="Season" value={s.season || "—"} color="gold" />
      <SC label="Session started" value={s.started_at ? fmtDate(s.started_at) : "not recorded"} color="blue"
          sub={s.started_at ? `${days(s.days_running)} ago` : "set it below"} />
      <SC label="Players on the board" value={fmt(live.count || 0)} color="green"
          sub={s.game_writing ? `game updated ${relTime(live.updated_at)}` : "game server isn't updating it right now"} />
      <SC label="Waiting for the game" value={fmt(s.pending?.length || 0)} color={s.pending?.length ? "red" : undefined}
          sub={s.pending?.length ? "runs within a few seconds while the server is up" : "nothing waiting"} />
    </div>

    <FB title="THIS SESSION">
      <div className="ap-note">
        END SESSION posts the final standings to the website archive (season, dates, days, every whitelisted player), then starts over.
        RESET starts over without posting anything. Both run on the game server; if it's down they wait until it's back.
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ minWidth: 260 }}><Inp label="Name in the archive (optional)" placeholder="e.g. Pre-launch test" value={title} onChange={e => setTitle(e.target.value)} maxLength={80} /></div>
        <B c="gold" disabled={busy} onClick={endSession}>🏁 END SESSION &amp; ARCHIVE</B>
        <B c="red" disabled={busy} onClick={reset}>↺ RESET (NO ARCHIVE)</B>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginTop: 12 }}>
        <div style={{ minWidth: 200 }}><Inp label="Session started on (UTC date)" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <B c="ghost" onClick={saveStart} disabled={!startDate}>SET START DATE</B>
      </div>
      {s.pending?.length > 0 && <div className="ap-note" style={{ marginTop: 12 }}>
        {s.pending.map(p => <div key={p.id}>⏳ {p.cmd === "end" ? "END SESSION" : "RESET"} requested by {p.by} {relTime(p.at)}{p.title ? ` — "${p.title}"` : ""}</div>)}
      </div>}
    </FB>

    <TW title="TOP RIGHT NOW">
      <PlayersTable players={live.players} />
    </TW>

    <TW title="SESSIONS" right={<span style={{ ...mono, color: "var(--textdim)" }}>ENDED = on the archive page · RESET = private copy</span>}>
      {!s.sessions?.length ? <Empty text="No session has been ended or reset yet" /> :
        <div style={{ overflowX: "auto" }}><table className="ap-t"><thead><tr>
          <th>Kind</th><th>Name / season</th><th>Started</th><th>Ended</th><th>Days</th><th>Players</th><th>By</th><th></th>
        </tr></thead><tbody>
          {s.sessions.map(x => <Fragment key={x.id}>
            <tr>
              <td style={{ ...mono, color: x.kind === "end" ? "var(--green)" : "var(--orange)" }}>{x.kind === "end" ? "ENDED" : "RESET"}</td>
              <td style={mono}>{x.title || "—"}<div style={{ color: "var(--textdim)", fontSize: 11 }}>{x.season}</div></td>
              <td style={mono}>{x.started_at ? fmtDate(x.started_at) : "not recorded"}</td>
              <td style={mono}>{fmtFull(x.ended_at)}</td>
              <td style={mono}>{days(x.days)}</td>
              <td style={mono}>{fmt(x.player_count)}</td>
              <td style={mono}>{x.ended_by}{x.source ? <div style={{ color: "var(--textdim)", fontSize: 11 }}>{x.source === "game" ? "in game" : "website"}</div> : null}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                <B c="ghost" sm onClick={() => view(x.id)}>{open === x.id ? "HIDE" : "VIEW"}</B>{" "}
                <B c="red" sm onClick={() => remove(x)}>DELETE</B>
              </td>
            </tr>
            {open === x.id && <tr><td colSpan={8} style={{ padding: 0 }}>
              {openPlayers ? <PlayersTable players={openPlayers} /> : <Load />}
            </td></tr>}
          </Fragment>)}
        </tbody></table></div>}
    </TW>
  </>);
}
