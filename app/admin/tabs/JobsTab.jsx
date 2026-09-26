"use client";
// @ts-nocheck
// Zombita's Jobs (mod 1.7.94+): rewards with real items, tier pay, the daily limit, the job market, running jobs,
// give a job, specials and IOUs. The game owns the jobs, so every change is a REQUEST the game runs within a few
// seconds (routers/jobs_web.py -> Zomboid/Lua/zombita_jobs_web_cmd.txt); the answer shows as a toast.
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchApi, postApi, relTime, fmt, bronzeToCoins, Title, SC, B, FB, TW, Load, Empty } from "./shared";

const TIER = { S: "#f25a47", A: "#599ef2", B: "#9ea39a", C: "#73b873" };
const mono = { fontFamily: "var(--mono)", fontSize: 12 };
const dim = { ...mono, color: "var(--textdim)" };
const dur = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  if (s >= 2 * 86400) return `${Math.floor(s / 86400)}d`;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};
const money = (b) => { try { return bronzeToCoins(b); } catch { return `${fmt(b)} bronze`; } };
const iconFor = (id) => `https://api.stateofundeadpurge.site:8443/media/items/${id}.png`;

const TierPill = ({ t }) => (
  <span className="ap-pill" style={{ background: TIER[t] || TIER.B, color: "#0e0e0e", fontWeight: 700, minWidth: 18, textAlign: "center" }}>{t}</span>
);
const Flag = ({ children, c }) => <span className="ap-pill" style={{ border: `1px solid ${c}`, color: c, marginRight: 4 }}>{children}</span>;

const ItemIcon = ({ id, size = 22 }) => (
  <img src={iconFor(id)} alt="" width={size} height={size} style={{ imageRendering: "pixelated", verticalAlign: "middle" }}
    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
);

// ── the item picker ──────────────────────────────────────────────────────────
function ItemPicker({ onPick, onClose }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [n, setN] = useState(1);
  const [loading, setLoading] = useState(false);
  const t = useRef(null);
  useEffect(() => {
    clearTimeout(t.current);
    if (q.trim().length < 2) { setRes([]); return; }
    t.current = setTimeout(async () => {
      setLoading(true);
      try { const d = await fetchApi(`/api/admin/jobs/items?q=${encodeURIComponent(q.trim())}`); setRes(d.matches || []); }
      catch { setRes([]); }
      setLoading(false);
    }, 300);
  }, [q]);
  return (
    <div className="ap-mbd" onClick={onClose}>
      <div className="ap-mod" style={{ width: 620 }} onClick={(e) => e.stopPropagation()}>
        <button className="ap-mod-x" onClick={onClose}>×</button>
        <h3>ADD AN ITEM</h3>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input autoFocus className="ap-search" style={{ flex: 1, width: "auto" }} placeholder="Search 28,000 items: bandage, katana, Base.Battery..."
            value={q} onChange={(e) => setQ(e.target.value)} />
          <input className="ap-search" style={{ width: 80 }} type="number" min={1} max={100} value={n} onChange={(e) => setN(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} title="How many" />
        </div>
        {loading && <div style={dim}>searching...</div>}
        {!loading && q.trim().length >= 2 && res.length === 0 && <Empty text="No item found" />}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {res.map((it) => (
            <button key={it.id} onClick={() => onPick(it, n)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer", textAlign: "left" }}>
              <ItemIcon id={it.id} size={28} />
              <span style={{ flex: 1 }}>
                <div>{it.name}</div>
                <div style={dim}>{it.id}{it.category ? ` · ${it.category}` : ""}{it.mod ? ` · ${it.mod}` : ""}</div>
              </span>
              <span style={{ ...mono, color: "var(--accent)" }}>+ {n}</span>
            </button>
          ))}
        </div>
        <div className="ap-note" style={{ marginTop: 14, marginBottom: 0 }}>The game checks every item again: one it doesn't have (a removed mod) is refused.</div>
      </div>
    </div>
  );
}

// ── an item list editor (chips) ─────────────────────────────────────────────
function Items({ items, onChange }) {
  const [pick, setPick] = useState(false);
  const set = (i, n) => onChange(items.map((it, k) => (k === i ? [it[0], Math.max(1, Math.min(100, n))] : it)));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {items.map(([id, n], i) => (
        <span key={id} title={id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 6px", background: "var(--bg)", border: "1px solid var(--border)", ...mono }}>
          <ItemIcon id={id} size={20} />
          <span style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{id.replace(/^Base\./, "")}</span>
          <button onClick={() => set(i, n - 1)} style={{ background: "none", border: "none", color: "var(--textdim)", cursor: "pointer" }}>−</button>
          <span style={{ color: "var(--accent)" }}>{n}</span>
          <button onClick={() => set(i, n + 1)} style={{ background: "none", border: "none", color: "var(--textdim)", cursor: "pointer" }}>+</button>
          <button onClick={() => onChange(items.filter((_, k) => k !== i))} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer" }} title="Remove">×</button>
        </span>
      ))}
      <B c="ghost" sm onClick={() => setPick(true)}>+ ITEM</B>
      {pick && (
        <ItemPicker onClose={() => setPick(false)} onPick={(it, n) => {
          const i = items.findIndex((x) => x[0] === it.id);
          onChange(i >= 0 ? items.map((x, k) => (k === i ? [x[0], Math.min(100, x[1] + n)] : x)) : [...items, [it.id, n]]);
          setPick(false);
        }} />
      )}
    </div>
  );
}

// ── one reward row ───────────────────────────────────────────────────────────
function RewardRow({ row, send, busy }) {
  const [coins, setCoins] = useState(row.coins);
  const [rep, setRep] = useState(row.rep);
  const [items, setItems] = useState(row.items || []);
  useEffect(() => { setCoins(row.coins); setRep(row.rep); setItems(row.items || []); }, [row.coins, row.rep, JSON.stringify(row.items)]);
  const dirty = Number(coins) !== row.coins || Number(rep) !== row.rep || JSON.stringify(items) !== JSON.stringify(row.items || []);
  return (
    <tr>
      <td style={{ verticalAlign: "top", paddingTop: 12 }}>
        <div style={{ color: "var(--text)" }}>{row.name}</div>
        <div style={dim}>{row.custom ? <span style={{ color: "var(--accent)" }}>custom</span> : "default"} · default: {row.default}</div>
      </td>
      <td style={{ verticalAlign: "top", paddingTop: 8, width: 120 }}>
        <input className="ap-search" style={{ width: 100 }} type="number" min={0} max={100000} value={coins} onChange={(e) => setCoins(e.target.value)} />
        <div style={dim}>{money(Number(coins) || 0)}</div>
      </td>
      <td style={{ verticalAlign: "top", paddingTop: 8, width: 80 }}>
        <input className="ap-search" style={{ width: 60 }} type="number" min={0} max={10} value={rep} onChange={(e) => setRep(e.target.value)} />
      </td>
      <td style={{ verticalAlign: "top", paddingTop: 8 }}><Items items={items} onChange={setItems} /></td>
      <td style={{ verticalAlign: "top", paddingTop: 8, whiteSpace: "nowrap" }}>
        <B sm c={dirty ? "gold" : "ghost"} disabled={!dirty || busy} onClick={() => send("set_reward", { row: row.id, coins: Number(coins) || 0, rep: Number(rep) || 0, items: items.map(([id, n]) => ({ id, n })) })}>SAVE</B>{" "}
        {row.custom && <B sm c="ghost" disabled={busy} onClick={() => confirm(`Put "${row.name}" back to its default (${row.default})?`) && send("default", { row: row.id })}>DEFAULT</B>}
      </td>
    </tr>
  );
}

export default function JobsTab({ toast }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState([]);       // our request ids still unanswered
  const [every, setEvery] = useState("");
  const [cap, setCap] = useState("");
  const [mults, setMults] = useState({});
  const [give, setGive] = useState({ player: "", type: "horde", tier: "B", coins: "", rep: "", hours: "", title: "", text: "" });
  const [giveItems, setGiveItems] = useState([]);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  const load = useCallback(async () => {
    try {
      const x = await fetchApi("/api/admin/jobs");
      setD(x);
      const s = x.state;
      if (s) {
        setEvery((v) => (v === "" ? String(Math.round((s.every / 3600) * 100) / 100) : v));
        setCap((v) => (v === "" ? String(s.cap) : v));
        setMults((m) => (Object.keys(m).length ? m : { ...s.mults }));
      }
    } catch (e) { toast?.("Jobs: " + e.message, "error"); }
    setLoading(false);
  }, [toast]);
  useEffect(() => { load(); const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(load, waiting.length ? 3000 : 20000); return () => clearInterval(t); }, [load, waiting.length]);

  // one request -> wait for the game's answer -> toast
  const send = async (cmd, args = {}) => {
    try {
      const r = await postApi("/api/admin/jobs/cmd", { cmd, ...args });
      setWaiting((w) => [...w, r.id]);
      toast?.("Sent to the game...", "info");
      for (let i = 0; i < 25; i++) {
        await new Promise((ok) => setTimeout(ok, 1500));
        const a = await fetchApi(`/api/admin/jobs/requests/${r.id}`).catch(() => ({}));
        if (a.done) { toast?.(a.msg || (a.ok ? "Done" : "Failed"), a.ok ? "success" : "error"); break; }
        if (i === 24) toast?.("The game hasn't answered yet - is the server up?", "error");
      }
      setWaiting((w) => w.filter((x) => x !== r.id));
      load();
    } catch (e) { toast?.(e.message, "error"); }
  };

  if (loading) return <Load />;
  const s = d?.state;
  const jobs = s?.jobs || [];
  const open = jobs.filter((j) => j.state === "market");
  const running = jobs.filter((j) => j.state === "active");
  const nextIn = s ? s.next - now : 0;
  const busy = waiting.length > 0;

  return (
    <div>
      <Title t="ZOMBITA'S JOBS" s="Rewards, tier pay and the job market. The game owns the jobs: every change is a request it runs within a few seconds." />
      {!s && <div className="ap-note danger">No word from the game yet. The Jobs admin needs mod 1.7.94 on the server (and the round38 bot zip).</div>}
      {s?.stale && <div className="ap-note danger">The game last reported {relTime(s.at)} - the server may be down or restarting. Requests wait until it's back.</div>}
      {busy && <div className="ap-note info">Waiting for the game to answer {waiting.length} request{waiting.length > 1 ? "s" : ""}...</div>}

      {s && <div className="ap-sr">
        <SC label="Jobs" value={s.on ? "ON" : "OFF"} color={s.on ? "green" : "red"} sub={s.market ? "job market" : "daily boards"} />
        <SC label="Next batch" value={nextIn > 60 ? dur(nextIn) : "soon"} sub={`batch #${s.batch} · every ${dur(s.every)}`} />
        <SC label="Open / running" value={`${open.length} / ${running.length}`} sub="on the board / taken" />
        <SC label="Codes waiting" value={fmt(s.codes)} sub={`${fmt(s.pending)} payouts at the bot`} />
      </div>}

      {s && <FB title="JOB MARKET">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={dim}>HOURS BETWEEN BATCHES</div>
            <input className="ap-search" style={{ width: 90 }} type="number" step={0.25} min={0.25} max={48} value={every} onChange={(e) => setEvery(e.target.value)} />{" "}
            <B sm disabled={busy} onClick={() => send("market_every", { hours: Number(every) })}>SAVE</B>
          </div>
          <div>
            <div style={dim}>DAILY LIMIT PER PLAYER (BRONZE)</div>
            <input className="ap-search" style={{ width: 110 }} type="number" min={0} value={cap} onChange={(e) => setCap(e.target.value)} />{" "}
            <B sm disabled={busy} onClick={() => send("cap", { coins: Number(cap) })}>SAVE</B>
            <span style={{ ...dim, marginLeft: 8 }}>{money(Number(cap) || 0)}</span>
          </div>
          <div style={{ flex: 1 }} />
          <B c="green" disabled={busy} onClick={() => confirm("Post a new batch of jobs now? (Works during Dawn of the Dead too.)") && send("post_now")}>POST JOBS NOW</B>
        </div>
        <div style={{ marginTop: 20 }}>
          <div style={dim}>TIER PAY - each reward row's coins are multiplied by this</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
            {["C", "B", "A", "S"].map((t) => (
              <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <TierPill t={t} />
                <span style={dim}>x</span>
                <input className="ap-search" style={{ width: 70 }} type="number" step={0.1} min={0} max={50} value={mults[t] ?? ""}
                  onChange={(e) => setMults((m) => ({ ...m, [t]: e.target.value }))} />
                {Number(mults[t]) !== Number(s.mults?.[t]) && <B sm disabled={busy} onClick={() => send("tier_mult", { tier: t, mult: Number(mults[t]) })}>SAVE</B>}
              </span>
            ))}
          </div>
        </div>
      </FB>}

      {s && <TW title="REWARDS" right={<span style={dim}>per job type · coins x tier pay · items come in a duffel · +rep</span>}>
        <div className="ap-note" style={{ margin: "12px 16px" }}>A finished job gives a code; entered on the phone it pays the row below (coins x the tier's pay, +1 rep for A, +2 for S). Items arrive in Zombita&apos;s duffel.</div>
        <div style={{ overflowX: "auto" }}><table className="ap-t"><thead><tr><th>Job / ending</th><th>Coins</th><th>Rep</th><th>Items</th><th></th></tr></thead>
          <tbody>{(s.rows || []).map((r) => <RewardRow key={r.id} row={r} send={send} busy={busy} />)}</tbody></table></div>
      </TW>}

      {s && <TW title={`ON THE BOARD & RUNNING (${jobs.length})`}>
        {jobs.length === 0 ? <Empty text="No jobs right now" /> :
          <div style={{ overflowX: "auto" }}><table className="ap-t"><thead><tr><th>Tier</th><th>Job</th><th>Who</th><th>Spots</th><th>Progress</th><th>Left</th><th></th><th></th></tr></thead>
            <tbody>{[...jobs].sort((a, b) => (a.state === b.state ? a.id.localeCompare(b.id) : a.state === "active" ? -1 : 1)).map((j) => (
              <tr key={j.id}>
                <td><TierPill t={j.tier} /></td>
                <td><div>{j.title}</div><div style={dim}>{j.id} · {j.type}{j.place ? ` · ${j.place}` : ""} · {j.reward}</div></td>
                <td style={mono}>{j.state === "market" ? <span style={{ color: "var(--green)" }}>open</span> : (j.who || []).join(", ")}</td>
                <td style={mono}>{j.market ? `${j.taken}/${j.spots}` : "—"}</td>
                <td style={mono}>{j.total > 1 ? `${j.progress}/${j.total}` : "—"}</td>
                <td style={mono}>{dur(j.left)}</td>
                <td>{j.sprung && <Flag c="var(--red)">TRAP SPRUNG</Flag>}{j.trap && !j.sprung && <Flag c="var(--orange)">TRAP</Flag>}{j.special && <Flag c="var(--accent)">SPECIAL</Flag>}{j.admin && <Flag c="var(--blue)">ADMIN</Flag>}</td>
                <td><B sm c="red" disabled={busy} onClick={() => confirm(`Call off "${j.title}"?`) && send("cancel", { job: j.id })}>CANCEL</B></td>
              </tr>
            ))}</tbody></table></div>}
      </TW>}

      {s && <FB title="GIVE A JOB">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
          <label style={dim}>PLAYER<input className="ap-search" style={{ width: "100%" }} value={give.player} onChange={(e) => setGive({ ...give, player: e.target.value })} placeholder="in-game name" /></label>
          <label style={dim}>TYPE<select className="ap-search" style={{ width: "100%" }} value={give.type} onChange={(e) => setGive({ ...give, type: e.target.value })}>
            {(s.types || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label style={dim}>TIER<select className="ap-search" style={{ width: "100%" }} value={give.tier} onChange={(e) => setGive({ ...give, tier: e.target.value })}>
            {["C", "B", "A", "S"].map((t) => <option key={t}>{t}</option>)}</select></label>
          <label style={dim}>COINS (blank = row)<input className="ap-search" style={{ width: "100%" }} type="number" value={give.coins} onChange={(e) => setGive({ ...give, coins: e.target.value })} /></label>
          <label style={dim}>REP (blank = row)<input className="ap-search" style={{ width: "100%" }} type="number" value={give.rep} onChange={(e) => setGive({ ...give, rep: e.target.value })} /></label>
          <label style={dim}>HOURS (blank = normal)<input className="ap-search" style={{ width: "100%" }} type="number" value={give.hours} onChange={(e) => setGive({ ...give, hours: e.target.value })} /></label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginTop: 12 }}>
          <label style={dim}>TITLE (optional)<input className="ap-search" style={{ width: "100%" }} maxLength={60} value={give.title} onChange={(e) => setGive({ ...give, title: e.target.value })} /></label>
          <label style={dim}>ZOMBITA&apos;S WORDS (optional)<input className="ap-search" style={{ width: "100%" }} maxLength={200} value={give.text} onChange={(e) => setGive({ ...give, text: e.target.value })} /></label>
        </div>
        <div style={{ marginTop: 12 }}><div style={dim}>ITEMS (optional - replaces the row&apos;s items)</div><Items items={giveItems} onChange={setGiveItems} /></div>
        <div style={{ marginTop: 16 }}>
          <B disabled={busy || !give.player.trim()} onClick={() => send("give", {
            ...give, coins: give.coins === "" ? undefined : Number(give.coins), rep: give.rep === "" ? undefined : Number(give.rep),
            hours: give.hours === "" ? undefined : Number(give.hours), items: giveItems.map(([id, n]) => ({ id, n })),
          })}>GIVE JOB</B>
          <span style={{ ...dim, marginLeft: 10 }}>Places need the player online (bring jobs don&apos;t).</span>
        </div>
      </FB>}

      <div className="ap-2c" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <TW title="SPECIALS" right={<span style={dim}>Jev decides · templates write</span>}>
          {(d?.specials || []).length === 0 ? <Empty text="No specials yet" /> :
            <div style={{ maxHeight: 380, overflowY: "auto" }}><table className="ap-t"><tbody>{d.specials.map((x, i) => (
              <tr key={i}><td style={mono}>{x.player}<div style={dim}>{relTime(x.at)} · {x.decided_by}{x.jev != null ? ` ${Math.round(x.jev * 100)}%` : ""}</div></td>
                <td style={mono}>{x.type ? <><TierPill t={x.tier || "B"} /> {x.kind}</> : <span style={dim}>not now</span>}
                  <div style={dim}>{x.given === true ? "given" : x.given === false ? `not given: ${x.why}` : x.type ? "sent" : ""}</div></td>
                <td style={{ ...dim, maxWidth: 260 }}>{String(x.line || "").replace(/\{place\}/g, "(the spot)").replace(/\{n\}/g, "(n)").replace(/\{what\}/g, "(item)")}</td></tr>
            ))}</tbody></table></div>}
        </TW>
        <TW title="IOUS" right={<span style={dim}>rep 50+ only · paid oldest first</span>}>
          {(d?.ious || []).length === 0 ? <Empty text="Zombita owes nobody" /> :
            <div style={{ maxHeight: 380, overflowY: "auto" }}><table className="ap-t"><tbody>{d.ious.map((x, i) => (
              <tr key={i}><td style={mono}>{x.player}<div style={dim}>{relTime(x.at)}</div></td><td style={dim}>{x.title}</td>
                <td style={mono}>{money(x.paid)} / {money(x.owed)}<div style={{ ...dim, color: x.state === "paid" ? "var(--green)" : x.state === "lapsed" ? "var(--red)" : "var(--accent)" }}>{x.state}</div></td></tr>
            ))}</tbody></table></div>}
        </TW>
      </div>

      <TW title="REQUEST LOG" right={<span style={dim}>what the website asked, what the game said</span>}>
        {(d?.log || []).length === 0 ? <Empty text="Nothing asked yet" /> :
          <table className="ap-t"><tbody>{d.log.map((x) => (
            <tr key={x.id}><td style={dim}>{relTime(x.at)}</td><td style={mono}>{x.cmd}</td><td style={dim}>{x.by}</td>
              <td style={{ ...mono, color: x.ok ? "var(--green)" : "var(--red)" }}>{x.msg}</td></tr>
          ))}</tbody></table>}
      </TW>
    </div>
  );
}
