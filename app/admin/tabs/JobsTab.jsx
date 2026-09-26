"use client";
// @ts-nocheck
// Zombita's Jobs v2 (mod 1.7.94+): the board (fill it, post an S), tier pots and rests, the Job Rank ladder (renamable),
// what a win gives (items + rep), open quests with who's racing, give a quest, specials and IOUs. The game owns the jobs, so every change is a REQUEST the game runs within a few
// seconds (routers/jobs_web.py -> Zomboid/Lua/zombita_jobs_web_cmd.txt); the answer shows as a toast.
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchApi, postApi, relTime, fmt, bronzeToCoins, Title, SC, B, FB, TW, Load, Empty } from "./shared";

// the game's colours (ZQ_Shared.lua Q.COLORS): D / C yellow, B / A blue, S gold
const TIER = { S: "#ffcc2e", A: "#599ef2", B: "#599ef2", C: "#edc740", D: "#edc740" };
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

// ── one reward row (v2: the coins are the tier's pot - a row is the winner's duffel + extra rep) ─────────
function RewardRow({ row, send, busy }) {
  const [rep, setRep] = useState(row.rep);
  const [items, setItems] = useState(row.items || []);
  useEffect(() => { setRep(row.rep); setItems(row.items || []); }, [row.rep, JSON.stringify(row.items)]);
  const dirty = Number(rep) !== row.rep || JSON.stringify(items) !== JSON.stringify(row.items || []);
  return (
    <tr>
      <td style={{ verticalAlign: "top", paddingTop: 12 }}>
        <div style={{ color: "var(--text)" }}>{row.name}</div>
        <div style={dim}>{row.custom ? <span style={{ color: "var(--accent)" }}>custom</span> : "default"} · default: {row.default}</div>
      </td>
      <td style={{ verticalAlign: "top", paddingTop: 8, width: 80 }}>
        <input className="ap-search" style={{ width: 60 }} type="number" min={0} max={10} value={rep} onChange={(e) => setRep(e.target.value)} />
      </td>
      <td style={{ verticalAlign: "top", paddingTop: 8 }}><Items items={items} onChange={setItems} /></td>
      <td style={{ verticalAlign: "top", paddingTop: 8, whiteSpace: "nowrap" }}>
        <B sm c={dirty ? "gold" : "ghost"} disabled={!dirty || busy} onClick={() => send("set_reward", { row: row.id, rep: Number(rep) || 0, items: items.map(([id, n]) => ({ id, n })) })}>SAVE</B>{" "}
        {row.custom && <B sm c="ghost" disabled={busy} onClick={() => confirm(`Put "${row.name}" back to its default (${row.default})?`) && send("default", { row: row.id })}>DEFAULT</B>}
      </td>
    </tr>
  );
}

// ── one tier: its pot (a solo win; a crew splits it) and its rest ────────────────────────────────────────
function TierRow({ t, send, busy }) {
  const [pot, setPot] = useState(String(t.pot));
  const [rest, setRest] = useState(String(Math.round(t.cool / 60)));
  useEffect(() => { setPot(String(t.pot)); setRest(String(Math.round(t.cool / 60))); }, [t.pot, t.cool]);
  const potDirty = Number(pot) !== t.pot, restDirty = Number(rest) * 60 !== t.cool;
  return (
    <tr>
      <td><TierPill t={t.id} /></td>
      <td style={{ whiteSpace: "nowrap" }}>
        <input className="ap-search" style={{ width: 100 }} type="number" min={0} max={1000000} value={pot} onChange={(e) => setPot(e.target.value)} />{" "}
        {potDirty && <B sm c="gold" disabled={busy} onClick={() => send("pot", { tier: t.id, coins: Number(pot) })}>SAVE</B>}
        <div style={dim}>{money(Number(pot) || 0)}{t.pot !== t.potDefault ? ` · default ${money(t.potDefault)}` : ""}</div>
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        <input className="ap-search" style={{ width: 70 }} type="number" min={0} max={1440} value={rest} onChange={(e) => setRest(e.target.value)} /> <span style={dim}>min</span>{" "}
        {restDirty && <B sm c="gold" disabled={busy} onClick={() => send("cool", { tier: t.id, minutes: Number(rest) })}>SAVE</B>}
        {t.cool !== t.coolDefault && <div style={dim}>default {Math.round(t.coolDefault / 60)} min</div>}
      </td>
      <td style={mono}>{dur(t.life)}</td>
      <td style={mono}>{t.horde}{t.id === "S" ? " (+200 big)" : ""}</td>
      <td style={mono}>{t.pts}</td>
      <td style={mono}>{t.quit}</td>
    </tr>
  );
}

// ── the Job Rank ladder (Nin: "allow admins to rename rank scaling") ─────────────────────────────────────
function RankEditor({ ranks, custom, send, busy }) {
  const [rows, setRows] = useState(ranks);
  useEffect(() => { setRows(ranks); }, [JSON.stringify(ranks)]);
  const set = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const dirty = JSON.stringify(rows) !== JSON.stringify(ranks);
  const text = rows.map((r) => `${String(r.name).trim()}:${Math.floor(Number(r.min) || 0)}:${r.maxTier}:${Number(r.quit) || 0}`).join(",");
  const bad = rows.length < 1 || rows.length > 8 || !rows.some((r) => Number(r.min) === 0) || rows.some((r) => !/^[A-Za-z0-9 '\-]{1,20}$/.test(String(r.name).trim()));
  return (
    <div>
      <table className="ap-t"><thead><tr><th>Name</th><th>From score</th><th>Highest tier</th><th>Give-up share</th><th></th></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i}>
            <td><input className="ap-search" style={{ width: 140 }} maxLength={20} value={r.name} onChange={(e) => set(i, "name", e.target.value)} /></td>
            <td><input className="ap-search" style={{ width: 80 }} type="number" value={r.min} onChange={(e) => set(i, "min", e.target.value)} /></td>
            <td><select className="ap-search" value={r.maxTier} onChange={(e) => set(i, "maxTier", e.target.value)}>{["D", "C", "B", "A", "S"].map((t) => <option key={t}>{t}</option>)}</select></td>
            <td><input className="ap-search" style={{ width: 70 }} type="number" step={0.25} min={0} max={2} value={r.quit} onChange={(e) => set(i, "quit", e.target.value)} />
              <span style={{ ...dim, marginLeft: 6 }}>{Number(r.quit) === 0 ? "gives up for free" : `x${r.quit} of the tier's cost`}</span></td>
            <td>{rows.length > 1 && <button onClick={() => setRows(rows.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer" }} title="Remove">×</button>}</td>
          </tr>
        ))}</tbody></table>
      <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        {rows.length < 8 && <B sm c="ghost" onClick={() => setRows([...rows, { name: "New rank", min: 300, maxTier: "S", quit: 1 }])}>+ RANK</B>}
        <B sm c={dirty ? "gold" : "ghost"} disabled={!dirty || bad || busy} onClick={() => send("ranks", { ranks: text })}>SAVE RANKS</B>
        {custom && <B sm c="ghost" disabled={busy} onClick={() => confirm("Back to Rookie / Runner / Merc / Legend?") && send("ranks_default")}>DEFAULT</B>}
        {bad && <span style={{ ...dim, color: "var(--red)" }}>1-8 ranks, one starting at 0, names of letters / digits / spaces.</span>}
      </div>
      <div className="ap-note" style={{ marginTop: 10, marginBottom: 0 }}>
        Score = kills / 25 + best life (days) x 2 + DotD nights survived x 5 + quest points x 2 - deaths. Below 0 quest points a player is
        Disgraced (D and C only, half the give-up cost) whatever their score.
      </div>
    </div>
  );
}

const KIND = { S: ["S", "#ffcc2e"], big: ["BIG", "#599ef2"], small: ["", ""], personal: ["PERSONAL", "#e64d4d"], exclusive: ["EXCLUSIVE", "#ad73f5"], admin: ["ADMIN", "#e64d4d"] };

export default function JobsTab({ toast }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState([]);       // our request ids still unanswered
  const [cap, setCap] = useState("");
  const [bigS, setBigS] = useState(false);
  const [give, setGive] = useState({ player: "", type: "horde", tier: "B", coins: "", hours: "", title: "", text: "" });
  const [giveItems, setGiveItems] = useState([]);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  const load = useCallback(async () => {
    try {
      const x = await fetchApi("/api/admin/jobs");
      setD(x);
      if (x.state) setCap((v) => (v === "" ? String(x.state.cap) : v));
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
  const v2 = s && s.v === 2;
  const quests = v2 ? s.quests || [] : [];
  const busy = waiting.length > 0;
  const order = { S: 0, big: 1, small: 2, personal: 3, exclusive: 4, admin: 5 };

  return (
    <div>
      <Title t="ZOMBITA'S JOBS" s="Races for her quests: tier pay, Job Rank, rewards, the board. The game owns the quests: every change is a request it runs within a few seconds." />
      {!s && <div className="ap-note danger">No word from the game yet. The Jobs admin needs mod 1.7.94 on the server (and the jobs v2 bot zip).</div>}
      {s && !v2 && <div className="ap-note danger">The server still runs the old Jobs (before 1.7.94). Upload the new mod first.</div>}
      {s?.stale && <div className="ap-note danger">The game last reported {relTime(s.at)} - the server may be down or restarting. Requests wait until it's back.</div>}
      {busy && <div className="ap-note info">Waiting for the game to answer {waiting.length} request{waiting.length > 1 ? "s" : ""}...</div>}

      {v2 && <div className="ap-sr">
        <SC label="Jobs" value={s.on ? "ON" : "OFF"} color={s.on ? "green" : "red"} sub="MODS switch in game" />
        <SC label="Open quests" value={fmt(quests.length)} sub={`${quests.filter((q) => (q.racers || []).length).length} being raced`} />
        <SC label="S minted this week" value={money(s.mintWeek)} sub={`of ${money(s.mintCap)} · last S ${s.sAt ? relTime(s.sAt) : "never"}`} />
        <SC label="Codes waiting" value={fmt(s.codes)} sub={`${fmt(s.pending)} payouts at the bot`} />
      </div>}

      {v2 && <FB title="THE BOARD">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={dim}>DAILY LIMIT PER PLAYER (BRONZE, S ASIDE)</div>
            <input className="ap-search" style={{ width: 110 }} type="number" min={0} value={cap} onChange={(e) => setCap(e.target.value)} />{" "}
            <B sm disabled={busy} onClick={() => send("cap", { coins: Number(cap) })}>SAVE</B>
            <span style={{ ...dim, marginLeft: 8 }}>{money(Number(cap) || 0)}</span>
          </div>
          <div style={{ flex: 1 }} />
          <B c="green" disabled={busy} onClick={() => confirm("Fill every empty slot now (3 small D/C + 2 big B/A)?") && send("post_now")}>FILL THE BOARD</B>
          <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <label style={{ ...dim, display: "inline-flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={bigS} onChange={(e) => setBigS(e.target.checked)} /> big (2 hordes, 2-3 gold)</label>
            <B c="gold" disabled={busy} onClick={() => confirm(`Put ${bigS ? "a BIG" : "an"} S tier quest up now? Everyone online hears about it; its pay is minted (not the treasury).`) && send("post_s", { big: bigS })}>POST S</B>
          </span>
        </div>
        <div className="ap-note" style={{ marginTop: 14, marginBottom: 0 }}>
          The board keeps itself full: a slot refills 5-15 minutes after its quest is won or runs out. S rolls twice a day (50%, never within a day of the last).
        </div>
      </FB>}

      {v2 && <TW title="TIERS" right={<span style={dim}>pot = a solo win, split evenly by a crew · rest = cooldown after one</span>}>
        <div style={{ overflowX: "auto" }}><table className="ap-t"><thead><tr><th>Tier</th><th>Pot (bronze)</th><th>Rest</th><th>On board</th><th>Horde</th><th>Rank pts</th><th>Give-up cost</th></tr></thead>
          <tbody>{(s.tiers || []).slice().reverse().map((t) => <TierRow key={t.id} t={t} send={send} busy={busy} />)}</tbody></table></div>
        <div className="ap-note" style={{ margin: "8px 16px 14px" }}>S splits by Nin&apos;s table (1 gold / 5s / 3s / 2.5s each), scaled by S&apos;s pot. Personal quests pay 1.5x, exclusive 1.25x.</div>
      </TW>}

      {v2 && <FB title="JOB RANK">
        <RankEditor ranks={(s.ranks || []).map((r) => ({ name: r.name, min: r.min, maxTier: r.maxTier, quit: r.quit }))} custom={s.ranksCustom} send={send} busy={busy} />
      </FB>}

      {v2 && <TW title="WHAT A WIN GIVES" right={<span style={dim}>per quest type · the winner&apos;s duffel · +rep (split with the crew)</span>}>
        <div style={{ overflowX: "auto" }}><table className="ap-t"><thead><tr><th>Quest / ending</th><th>Extra rep</th><th>Items (duffel)</th><th></th></tr></thead>
          <tbody>{(s.rows || []).map((r) => <RewardRow key={r.id} row={r} send={send} busy={busy} />)}</tbody></table></div>
      </TW>}

      {v2 && <TW title={`OPEN QUESTS (${quests.length})`}>
        {quests.length === 0 ? <Empty text="Nothing on the board - FILL THE BOARD" /> :
          <div style={{ overflowX: "auto" }}><table className="ap-t"><thead><tr><th>Tier</th><th>Quest</th><th>Racing</th><th>Progress</th><th>Left</th><th></th><th></th></tr></thead>
            <tbody>{[...quests].sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9) || a.id.localeCompare(b.id)).map((q) => (
              <tr key={q.id}>
                <td><TierPill t={q.tier} /></td>
                <td><div>{q.title}</div><div style={dim}>{q.id} · {q.type}{q.place ? ` · ${q.place}` : ""} · {q.pay}{q.x ? ` · ${q.x},${q.y}` : ""}</div></td>
                <td style={mono}>{(q.racers || []).length === 0 ? <span style={{ color: "var(--green)" }}>{q.onlyFor ? `offered to ${q.onlyFor}` : "open"}</span>
                  : (q.racers || []).map((r) => (
                    <div key={r.name}>{r.name} <span style={dim}>({r.kills} kills)</span>{(r.crew || []).map((c) => (
                      <div key={c.name} style={{ ...dim, paddingLeft: 10 }}>+ {c.name} · {c.kills} kills · near {c.ticks ? Math.round((100 * c.near) / c.ticks) : 0}%</div>))}</div>))}</td>
                <td style={mono}>{q.total > 1 ? `${q.progress}/${q.total}` : "—"}{q.bagOut ? <div style={dim}>bag out</div> : null}</td>
                <td style={mono}>{dur(q.left)}</td>
                <td>{KIND[q.kind]?.[0] && <Flag c={KIND[q.kind][1]}>{KIND[q.kind][0]}</Flag>}{q.big && <Flag c="#ffcc2e">2 HORDES</Flag>}
                  {q.sprung && <Flag c="var(--red)">TRAP SPRUNG</Flag>}{q.trap && !q.sprung && <Flag c="var(--orange)">TRAP</Flag>}
                  {q.secret && <div style={dim} title="The note's code (admins only)">code {q.secret}</div>}</td>
                <td><B sm c="red" disabled={busy} onClick={() => confirm(`Call off "${q.title}"? Nobody on it loses anything.`) && send("cancel", { job: q.id })}>CANCEL</B></td>
              </tr>
            ))}</tbody></table></div>}
      </TW>}

      {v2 && <FB title="GIVE A QUEST">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
          <label style={dim}>PLAYER<input className="ap-search" style={{ width: "100%" }} value={give.player} onChange={(e) => setGive({ ...give, player: e.target.value })} placeholder="in-game name" /></label>
          <label style={dim}>TYPE<select className="ap-search" style={{ width: "100%" }} value={give.type} onChange={(e) => setGive({ ...give, type: e.target.value })}>
            {(s.types || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label style={dim}>TIER<select className="ap-search" style={{ width: "100%" }} value={give.tier} onChange={(e) => setGive({ ...give, tier: e.target.value })}>
            {["D", "C", "B", "A", "S"].map((t) => <option key={t}>{t}</option>)}</select></label>
          <label style={dim}>COINS (blank = tier pot)<input className="ap-search" style={{ width: "100%" }} type="number" value={give.coins} onChange={(e) => setGive({ ...give, coins: e.target.value })} /></label>
          <label style={dim}>HOURS (blank = 8)<input className="ap-search" style={{ width: "100%" }} type="number" value={give.hours} onChange={(e) => setGive({ ...give, hours: e.target.value })} /></label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginTop: 12 }}>
          <label style={dim}>TITLE (optional)<input className="ap-search" style={{ width: "100%" }} maxLength={60} value={give.title} onChange={(e) => setGive({ ...give, title: e.target.value })} /></label>
          <label style={dim}>ZOMBITA&apos;S WORDS (optional)<input className="ap-search" style={{ width: "100%" }} maxLength={200} value={give.text} onChange={(e) => setGive({ ...give, text: e.target.value })} /></label>
        </div>
        <div style={{ marginTop: 12 }}><div style={dim}>ITEMS (optional - replaces the type&apos;s duffel)</div><Items items={giveItems} onChange={setGiveItems} /></div>
        <div style={{ marginTop: 16 }}>
          <B disabled={busy || !give.player.trim()} onClick={() => send("give", {
            ...give, coins: give.coins === "" ? undefined : Number(give.coins), hours: give.hours === "" ? undefined : Number(give.hours),
            items: giveItems.map(([id, n]) => ({ id, n })),
          })}>GIVE QUEST</B>
          <span style={{ ...dim, marginLeft: 10 }}>Red on their phone, only theirs. A spot near them needs them online (bring quests don&apos;t).</span>
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
