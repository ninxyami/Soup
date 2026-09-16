"use client";
// @ts-nocheck
// Project MIRA — self-serve acts run by the ZombitaMiraBridge mod, tracked and
// paid out by Zombita (mira_run_watcher.py). Backend: routers/admin_mira.py.
import { useState, useEffect, useCallback } from "react";
import { fetchApi, postApi, relTime, fmtFull, Title, SC, TW, B, Inp, Sel, FB, Load, Empty, Toggle } from "./shared";

const ACTS = [1, 2, 3, 4, 5];
const KINDS = [["start", "Start"], ["clue", "Clue file"], ["props", "Props"], ["areaA", "Area corner A"], ["areaB", "Area corner B"]];
const FAIL = {
  wiped: "party wiped", offline: "2 dropped at once", timeout: "time ran out", abandoned: "abandoned",
  server_restart: "server restart", admin: "ended by admin", too_small: "not enough players",
  restart: "restart pending", empty: "everyone left", puma_refused: "campaign refused",
};
const STATUS_COLOR = {
  completed: "var(--green, #4caf50)", failed: "var(--red, #e05252)", active: "var(--gold, #d4a72c)",
  forming: "var(--blue, #4a90d9)", disbanded: "inherit",
};
const VIEWS = [["overview", "Overview"], ["parties", "Parties"], ["players", "Players"], ["rewards", "Rewards"], ["deliveries", "Deliveries"], ["settings", "Settings"]];

const dur = (s) => (s == null ? "—" : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`);

function StatusCell({ status, reason }) {
  return (
    <span style={{ color: STATUS_COLOR[status] || "inherit", fontWeight: 600 }}>
      {status}
      {reason ? <span style={{ fontWeight: 400, opacity: 0.75 }}> · {FAIL[reason] || reason}</span> : null}
    </span>
  );
}

function usePoll(path, ms = 15000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try { setData(await fetchApi(path)); setError(null); }
    catch (e) { setError(e.message); }
  }, [path]);
  useEffect(() => {
    load();
    if (!ms) return undefined;
    const id = setInterval(load, ms);
    return () => clearInterval(id);
  }, [load, ms]);
  return [data, load, error];
}

export default function MiraTab({ toast }) {
  const [view, setView] = useState("overview");
  return (<>
    <Title t="PROJECT MIRA" s="self-serve acts · parties · Zombita rewards" />
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      {VIEWS.map(([k, label]) => <B key={k} sm c={view === k ? "gold" : "ghost"} onClick={() => setView(k)}>{label}</B>)}
    </div>
    {view === "overview" && <Overview />}
    {view === "parties" && <Parties />}
    {view === "players" && <Players />}
    {view === "rewards" && <Rewards toast={toast} />}
    {view === "deliveries" && <Deliveries toast={toast} />}
    {view === "settings" && <Settings toast={toast} />}
  </>);
}

// ── OVERVIEW ─────────────────────────────────────────────────────────────────

function Overview() {
  const [d, , err] = usePoll("/api/admin/mira/overview");
  if (err && !d) return <Empty text={`Couldn't load: ${err}`} />;
  if (!d) return <Load />;
  const finished = d.acts.reduce((n, a) => n + a.players_finished, 0);
  const restart = d.restart?.state === "scheduled"
    ? `in ${Math.max(0, Math.round((d.restart.at * 1000 - Date.now()) / 60000))} min`
    : d.restart?.state === "restarting" ? "restarting now" : "none";

  return (<>
    <div className="ap-sr" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
      <SC label="Live parties" value={d.live.length} color="gold" />
      <SC label="Act completions" value={finished} color="green" sub="players × acts" />
      <SC label="Rewards queued" value={d.rewards.pending} color="blue" sub={`${d.rewards.delivered} delivered · ${d.rewards.failed} failed`} />
      <SC label="Restart" value={restart} color={d.restart?.state ? "red" : ""} sub="acts won't start if a restart would cut them short" />
    </div>

    <TW title="LIVE NOW">
      {d.live.length === 0 ? <Empty text="No party is forming or playing right now." /> : (
        <table className="ap-t">
          <thead><tr><th>Act</th><th>Status</th><th>Leader</th><th>Members</th><th>Since</th></tr></thead>
          <tbody>{d.live.map((p) => (
            <tr key={p.party_id}>
              <td>Act {p.act}</td><td><StatusCell status={p.status} /></td><td>{p.leader}</td>
              <td>{p.members}</td><td>{relTime(p.started_at || p.formed_at)}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </TW>

    <TW title="ACTS">
      <table className="ap-t">
        <thead><tr><th>Act</th><th>Setup</th><th>Players finished</th><th>Attempts</th><th>Completed</th><th>Failed</th><th>Avg. time</th></tr></thead>
        <tbody>{d.acts.map((a) => {
          const missing = KINDS.filter(([k]) => !a.locations[k]).map(([, label]) => label);
          const where = KINDS.map(([k, label]) => `${label}: ${a.locations[k] ? `${a.locations[k].x}, ${a.locations[k].y}, ${a.locations[k].z}` : "not set"}`).join("\n");
          return (
            <tr key={a.act}>
              <td>Act {a.act}</td>
              <td title={where}>
                {a.ready ? <span style={{ color: STATUS_COLOR.completed }}>ready</span> : <span style={{ color: STATUS_COLOR.failed }}>needs start + clue</span>}
                {missing.length > 0 && <span style={{ opacity: 0.6 }}> · not set: {missing.join(", ")}</span>}
                {a.cleanup_pending && <span style={{ color: STATUS_COLOR.active }}> · site cleanup pending</span>}
              </td>
              <td>{a.players_finished}</td><td>{a.attempts}</td><td>{a.completed}</td><td>{a.failed}</td><td>{dur(a.avg_seconds)}</td>
            </tr>
          );
        })}</tbody>
      </table>
      <div className="ap-note">
        Locations are placed in-game: stand on the spot, right-click → Project MIRA → MIRA admin → Act N → Set … here.
        Area corners are optional — they're only needed for the horde and zombie cleanup. Hover a row to see coordinates.
      </div>
    </TW>
  </>);
}

// ── PARTIES ──────────────────────────────────────────────────────────────────

function Parties() {
  const [act, setAct] = useState("0");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(null);
  const [d, reload] = usePoll(`/api/admin/mira/parties?act=${act}&status=${status}&limit=100`, 20000);

  return (<>
    <div className="ap-fgrid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 220px))" }}>
      <Sel label="Act" value={act} onChange={(e) => setAct(e.target.value)}>
        <option value="0">All acts</option>
        {ACTS.map((a) => <option key={a} value={a}>Act {a}</option>)}
      </Sel>
      <Sel label="Outcome" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All</option>
        {["active", "forming", "completed", "failed", "disbanded"].map((s) => <option key={s} value={s}>{s}</option>)}
      </Sel>
    </div>
    {!d ? <Load /> : d.parties.length === 0 ? <Empty text="No parties yet." /> : (
      <TW title="PARTIES" right={<B sm c="ghost" onClick={reload}>Refresh</B>}>
        <table className="ap-t">
          <thead><tr><th>Formed</th><th>Act</th><th>Outcome</th><th>Members</th><th>Solved by</th><th>Time</th></tr></thead>
          <tbody>{d.parties.map((p) => (
            <tr key={p.party_id} onClick={() => setOpen(p.party_id)} style={{ cursor: "pointer" }}>
              <td title={fmtFull(p.formed_at)}>{relTime(p.formed_at)}</td>
              <td>Act {p.act}</td>
              <td><StatusCell status={p.status} reason={p.fail_reason} /></td>
              <td>{p.members}</td><td>{p.solver || "—"}</td><td>{dur(p.duration_seconds)}</td>
            </tr>
          ))}</tbody>
        </table>
      </TW>
    )}
    {open && <PartyDetail key={open} id={open} onClose={() => setOpen(null)} />}
  </>);
}

function PartyDetail({ id, onClose }) {
  const [d] = usePoll(`/api/admin/mira/party/${encodeURIComponent(id)}`, 0);
  return (
    <FB title="PARTY DETAIL">
      <div style={{ display: "flex", justifyContent: "flex-end" }}><B sm c="ghost" onClick={onClose}>Close</B></div>
      {!d ? <Load /> : (<>
        <div className="ap-note">
          Act {d.party.act} · <StatusCell status={d.party.status} reason={d.party.fail_reason} /> · leader {d.party.leader} · {dur(d.party.duration_seconds)}
        </div>
        <table className="ap-t">
          <thead><tr><th>Member</th><th>Reward tier</th><th>Went offline</th><th>Deaths</th><th>Outcome</th></tr></thead>
          <tbody>{d.members.map((m) => (
            <tr key={m.username}>
              <td>{m.username}</td><td>{m.reward_tier || "—"}</td><td>{m.went_offline ? "yes" : "no"}</td>
              <td>{m.deaths}</td><td>{m.outcome || "—"}</td>
            </tr>
          ))}</tbody>
        </table>
        {d.grants.length > 0 && (
          <table className="ap-t" style={{ marginTop: 12 }}>
            <thead><tr><th>Member</th><th>Tier</th><th>Item</th><th>Qty</th><th>Delivery</th></tr></thead>
            <tbody>{d.grants.map((g) => (
              <tr key={g.id}>
                <td>{g.username}</td><td>{g.tier}</td><td>{g.item}</td><td>{g.qty}</td>
                <td>{g.status}{g.last_error ? ` (${g.last_error})` : ""}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
        <table className="ap-t" style={{ marginTop: 12 }}>
          <thead><tr><th>When</th><th>Event</th><th>Player</th></tr></thead>
          <tbody>{d.events.map((e, i) => (
            <tr key={i}>
              <td title={fmtFull(e.ts)}>{relTime(e.ts)}</td>
              <td>{e.kind.replace(/_/g, " ")}{e.payload?.reason ? ` · ${FAIL[e.payload.reason] || e.payload.reason}` : ""}</td>
              <td>{e.player || "—"}</td>
            </tr>
          ))}</tbody>
        </table>
      </>)}
    </FB>
  );
}

// ── PLAYERS ──────────────────────────────────────────────────────────────────

function Players() {
  const [d] = usePoll("/api/admin/mira/players", 30000);
  if (!d) return <Load />;
  if (d.players.length === 0) return <Empty text="Nobody has played an act yet." />;
  return (
    <TW title="PLAYERS">
      <table className="ap-t">
        <thead><tr><th>Player</th><th>Acts completed</th><th>Attempts</th><th>Fails</th><th>Deaths</th><th>Dropped</th><th>Items delivered</th><th>Items queued</th></tr></thead>
        <tbody>{d.players.map((p) => (
          <tr key={p.username}>
            <td>{p.username}</td>
            <td>{ACTS.map((a) => {
              const done = p.acts_completed.includes(a);
              return (
                <span key={a} style={{
                  display: "inline-block", minWidth: 22, textAlign: "center", marginRight: 2, borderRadius: 4,
                  background: done ? STATUS_COLOR.completed : "transparent", opacity: done ? 1 : 0.35,
                }}>{a}</span>
              );
            })}</td>
            <td>{p.attempts}</td><td>{p.fails}</td><td>{p.deaths}</td><td>{p.drops}</td>
            <td>{p.items_delivered}</td><td>{p.items_pending}</td>
          </tr>
        ))}</tbody>
      </table>
    </TW>
  );
}

// ── REWARDS ──────────────────────────────────────────────────────────────────

function Rewards({ toast }) {
  const [act, setAct] = useState(1);
  const [d, reload] = usePoll(`/api/admin/mira/rewards?act=${act}`, 0);
  const [draft, setDraft] = useState({ tier: "full", item: "", min_qty: 1, max_qty: 1, weight: 10 });

  const add = async () => {
    try {
      await postApi("/api/admin/mira/rewards", { ...draft, item: draft.item.trim(), act });
      toast("Reward added", "success");
      setDraft({ ...draft, item: "" });
      reload();
    } catch (e) { toast(e.message, "error"); }
  };

  return (<>
    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
      {ACTS.map((a) => <B key={a} sm c={act === a ? "gold" : "ghost"} onClick={() => setAct(a)}>Act {a}</B>)}
    </div>
    <div className="ap-note">
      When a party completes an act, every member gets the <b>participation</b> rolls, and members who never went offline also
      get the <b>full</b> rolls. Each roll picks one item by weight, with a random quantity in its range. Rolls per tier are set under Settings.
    </div>
    {!d ? <Load /> : ["full", "participation"].map((tier) => (
      <TW key={tier} title={tier === "full" ? `ACT ${act} · FULL REWARD POOL` : `ACT ${act} · PARTICIPATION REWARD POOL`}>
        <PoolTable rows={d.pool.filter((r) => r.tier === tier)} toast={toast} reload={reload} />
      </TW>
    ))}
    <FB title={`ADD TO ACT ${act}`}>
      <div className="ap-fgrid" style={{ gridTemplateColumns: "repeat(5, minmax(0,1fr)) auto", alignItems: "end" }}>
        <Sel label="Pool" value={draft.tier} onChange={(e) => setDraft({ ...draft, tier: e.target.value })}>
          <option value="full">Full</option>
          <option value="participation">Participation</option>
        </Sel>
        <Inp label="Item id" placeholder="Base.Battery" value={draft.item} onChange={(e) => setDraft({ ...draft, item: e.target.value })} />
        <Inp label="Min qty" type="number" min={1} value={draft.min_qty} onChange={(e) => setDraft({ ...draft, min_qty: Number(e.target.value) })} />
        <Inp label="Max qty" type="number" min={1} value={draft.max_qty} onChange={(e) => setDraft({ ...draft, max_qty: Number(e.target.value) })} />
        <Inp label="Weight" type="number" min={1} value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: Number(e.target.value) })} />
        <B c="gold" onClick={add} disabled={!draft.item.trim()}>Add</B>
      </div>
    </FB>
  </>);
}

function PoolTable({ rows, toast, reload }) {
  if (rows.length === 0) return <Empty text="Empty pool — this tier pays nothing for this act." />;
  const total = rows.filter((r) => r.enabled).reduce((n, r) => n + r.weight, 0) || 1;
  return (
    <table className="ap-t">
      <thead><tr><th>Item</th><th>Min</th><th>Max</th><th>Weight</th><th>Chance per roll</th><th>On</th><th></th></tr></thead>
      <tbody>{rows.map((r) => <PoolRow key={r.id} row={r} total={total} toast={toast} reload={reload} />)}</tbody>
    </table>
  );
}

function PoolRow({ row, total, toast, reload }) {
  const [v, setV] = useState(row);
  useEffect(() => setV(row), [row]);
  const dirty = v.min_qty !== row.min_qty || v.max_qty !== row.max_qty || v.weight !== row.weight;

  const save = async (patch) => {
    try { await postApi(`/api/admin/mira/rewards/${row.id}`, patch); toast("Saved", "success"); reload(); }
    catch (e) { toast(e.message, "error"); }
  };
  const remove = async () => {
    if (!window.confirm(`Remove ${row.item} from this pool?`)) return;
    try { await postApi(`/api/admin/mira/rewards/${row.id}/delete`, {}); toast("Removed", "success"); reload(); }
    catch (e) { toast(e.message, "error"); }
  };
  const num = (k) => (
    <input className="ap-inp" type="number" min={1} style={{ width: 70 }} value={v[k]}
      onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} />
  );

  return (
    <tr style={{ opacity: row.enabled ? 1 : 0.5 }}>
      <td>{row.item}</td><td>{num("min_qty")}</td><td>{num("max_qty")}</td><td>{num("weight")}</td>
      <td>{row.enabled ? `${Math.round((row.weight / total) * 100)}%` : "—"}</td>
      <td><Toggle on={row.enabled} onClick={() => save({ enabled: !row.enabled })} /></td>
      <td style={{ whiteSpace: "nowrap" }}>
        {dirty && <B sm c="gold" onClick={() => save({ min_qty: v.min_qty, max_qty: v.max_qty, weight: v.weight })}>Save</B>}{" "}
        <B sm c="ghost" onClick={remove}>Remove</B>
      </td>
    </tr>
  );
}

// ── DELIVERIES ───────────────────────────────────────────────────────────────

function Deliveries({ toast }) {
  const [status, setStatus] = useState("");
  const [d, reload] = usePoll(`/api/admin/mira/grants?status=${status}&limit=200`, 20000);
  const retry = async (id) => {
    try { await postApi(`/api/admin/mira/grants/${id}/retry`, {}); toast("Queued again", "success"); reload(); }
    catch (e) { toast(e.message, "error"); }
  };
  return (<>
    <div className="ap-fgrid" style={{ gridTemplateColumns: "minmax(0,240px)" }}>
      <Sel label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All</option>
        <option value="pending">Queued (player offline)</option>
        <option value="delivered">Delivered</option>
        <option value="failed">Failed</option>
      </Sel>
    </div>
    <div className="ap-note">Zombita delivers rewards over RCON. If a player is offline, their items wait here and are handed over the next time they're online.</div>
    {!d ? <Load /> : d.grants.length === 0 ? <Empty text="Nothing here." /> : (
      <TW title="REWARD DELIVERIES">
        <table className="ap-t">
          <thead><tr><th>Created</th><th>Player</th><th>Act</th><th>Tier</th><th>Item</th><th>Qty</th><th>Status</th><th></th></tr></thead>
          <tbody>{d.grants.map((g) => (
            <tr key={g.id}>
              <td title={fmtFull(g.created_at)}>{relTime(g.created_at)}</td>
              <td>{g.username}</td><td>{g.act}</td><td>{g.tier}</td><td>{g.item}</td><td>{g.qty}</td>
              <td>
                {g.status}{g.status === "delivered" && g.delivered_at ? ` ${relTime(g.delivered_at)}` : ""}
                {g.last_error ? <span style={{ opacity: 0.6 }}> · {g.last_error}</span> : null}
              </td>
              <td>{g.status === "failed" && <B sm c="ghost" onClick={() => retry(g.id)}>Retry</B>}</td>
            </tr>
          ))}</tbody>
        </table>
      </TW>
    )}
  </>);
}

// ── SETTINGS ─────────────────────────────────────────────────────────────────

function Settings({ toast }) {
  const [d, reload] = usePoll("/api/admin/mira/config", 0);
  const [v, setV] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (d) setV(d.config); }, [d]);
  if (!d || !v) return <Load />;

  const changed = Object.keys(v).filter((k) => v[k] !== d.config[k]);
  const set = (k, val) => setV({ ...v, [k]: val });
  const field = (k, label, min, max) => (
    <Inp key={k} label={label} type="number" min={min} max={max} value={v[k]}
      onChange={(e) => set(k, e.target.value === "" ? "" : Number(e.target.value))} />
  );
  const cell = (k, min, max) => (
    <input className="ap-inp" type="number" min={min} max={max} style={{ width: 80 }} value={v[k]}
      onChange={(e) => set(k, e.target.value === "" ? "" : Number(e.target.value))} />
  );
  const save = async () => {
    setSaving(true);
    try {
      await postApi("/api/admin/mira/config", { config: Object.fromEntries(changed.map((k) => [k, v[k]])) });
      toast("Saved — Zombita pushes game settings within ~15s", "success");
      reload();
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };

  return (<>
    <FB title="PARTIES">
      <div className="ap-fgrid" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        {field("partyMax", "Max party size", 1, 5)}
        {field("partyMin", "Min party size", 1, 5)}
        {field("formingSeconds", "Join window (seconds)", 10, 600)}
        {field("joinRadius", "Start point radius (tiles)", 3, 60)}
      </div>
      <div className="ap-note">
        An act fails if the whole party is wiped, if 2 or more members are offline at the same moment, or when its time limit runs out.
        A member who drops only loses the full reward. Max party size can't go above 5. Clearing a field resets it to the default.
      </div>
    </FB>
    <FB title="ACTS">
      <table className="ap-t">
        <thead><tr><th>Act</th><th>Time limit (min)</th><th>Horde</th><th>Waves</th><th>Zombies / player</th><th>Full rolls</th><th>Participation rolls</th></tr></thead>
        <tbody>{ACTS.map((a) => (
          <tr key={a}>
            <td>Act {a}</td>
            <td>{cell(`act_${a}_timeLimitMinutes`, 5, 240)}</td>
            <td><Toggle on={!!v[`act_${a}_hordeEnabled`]} onClick={() => set(`act_${a}_hordeEnabled`, !v[`act_${a}_hordeEnabled`])} /></td>
            <td>{cell(`act_${a}_hordeWaves`, 1, 10)}</td>
            <td>{cell(`act_${a}_hordeZpp`, 1, 50)}</td>
            <td>{cell(`reward_act_${a}_full_rolls`, 0, 10)}</td>
            <td>{cell(`reward_act_${a}_participation_rolls`, 0, 10)}</td>
          </tr>
        ))}</tbody>
      </table>
    </FB>
    <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
      <B c="gold" disabled={saving || changed.length === 0} onClick={save}>
        {saving ? "Saving..." : changed.length ? `Save ${changed.length} change${changed.length === 1 ? "" : "s"}` : "No changes"}
      </B>
      <B c="ghost" disabled={changed.length === 0} onClick={() => setV(d.config)}>Discard</B>
    </div>
  </>);
}
