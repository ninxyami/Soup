"use client";
// @ts-nocheck
// QUEST CONTROL (mod 1.7.159, 2026-10-10). Nin: "a more detailed and better control panel for quests at our website which
// includes everything so i can control and test". One page for testing and running Zombita's Jobs: the quest switches, every
// job type (players get it or not, tested or not, give it to yourself at any tier with any twist), the twists, every open
// quest in detail (finish it as won, call it off), the board, the Fishing Derby, the community centre, and the old Jobs tab
// (pay, ranks, specials) folded in at the bottom. Data: GET /api/admin/jobs (the game's admin state, its "control" block);
// every change is a request the game runs within a few seconds (POST /api/admin/jobs/cmd).
import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchApi, postApi, relTime, fmt, bronzeToCoins, Title, SC, B, FB, TW, Load } from "./shared";
import JobsTab from "./JobsTab";

const TIER = { S: "#ffcc2e", A: "#599ef2", B: "#599ef2", C: "#edc740", D: "#edc740" };
const mono = { fontFamily: "var(--mono)", fontSize: 12 };
const dim = { ...mono, color: "var(--textdim)" };
const inp = { background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", padding: "4px 6px", ...mono };
const dur = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  if (s >= 2 * 86400) return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};
const money = (b) => { try { return bronzeToCoins(b); } catch { return `${fmt(b)} bronze`; } };
const Pill = ({ c, children, title }) => <span className="ap-pill" title={title} style={{ border: `1px solid ${c}`, color: c, marginRight: 4 }}>{children}</span>;
const TierPill = ({ t }) => <span className="ap-pill" style={{ background: TIER[t] || TIER.B, color: "#0e0e0e", fontWeight: 700, minWidth: 18, textAlign: "center" }}>{t}</span>;
const TWISTS = ["ambush", "road", "moved", "bandits", "bait"];
const KIND = { S: "S", big: "board", small: "board", personal: "personal", exclusive: "exclusive", admin: "admin", card: "card", rescue: "rescue" };

export default function QuestControlTab({ toast }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState([]);
  const [tester, setTester] = useState("");
  const [twist, setTwist] = useState("");
  const [filter, setFilter] = useState("all");
  const [chance, setChance] = useState(null);
  const [prizes, setPrizes] = useState(null);
  const [sCls, setSCls] = useState("S");
  const [winner, setWinner] = useState({});
  const [more, setMore] = useState(false);

  const load = useCallback(async () => {
    try { setD(await fetchApi("/api/admin/jobs")); } catch (e) { toast?.("Quest Control: " + e.message, "error"); }
    setLoading(false);
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, waiting.length ? 3000 : 15000); return () => clearInterval(t); }, [load, waiting.length]);
  useEffect(() => {
    fetchApi("/api/jobs/me").then((m) => { if (m?.name) setTester((v) => v || m.name); }).catch(() => {});
  }, []);

  const send = async (cmd, args = {}) => {
    try {
      const r = await postApi("/api/admin/jobs/cmd", { cmd, ...args });
      setWaiting((w) => [...w, r.id]);
      for (let i = 0; i < 25; i++) {
        await new Promise((ok) => setTimeout(ok, 1500));
        const a = await fetchApi(`/api/admin/jobs/requests/${r.id}`).catch(() => ({}));
        if (a.done) { toast?.(a.msg || (a.ok ? "Done" : "Failed"), a.ok ? "success" : "error"); break; }
        if (i === 24) toast?.("The game hasn't answered yet. Is the server up?", "error");
      }
      setWaiting((w) => w.filter((x) => x !== r.id));
      load();
    } catch (e) { toast?.(e.message, "error"); }
  };

  const s = d?.state;
  const c = s?.control;
  const types = c?.types || [];
  const quests = useMemo(() => [...(s?.quests || [])].sort((a, b) => "SABCD".indexOf(a.tier) - "SABCD".indexOf(b.tier)), [s]);
  useEffect(() => { if (c && chance === null) setChance({ ...c.twists.chance }); }, [c, chance]);
  useEffect(() => { if (c?.derby && prizes === null) setPrizes(c.derby.prizes.map((p) => ({ ...p }))); }, [c, prizes]);

  if (loading) return <Load />;
  const busy = waiting.length > 0;

  // the OFF list from the types (+ twists), with one of them flipped
  const offList = (flipId) => {
    const off = types.filter((t) => (t.id === flipId ? t.on : !t.on)).map((t) => t.id);
    const twistsOn = flipId === "twists" ? !c.twists.on : c.twists.on;
    if (!twistsOn) off.push("twists");
    return off.join(",");
  };
  const flipType = (t) => {
    if (confirm(`${t.on ? "Switch OFF" : "Switch ON"} ${t.name} for players?${t.on ? "" : t.tested ? "" : "\n\nIt isn't marked tested yet."}`)) send("types_off", { off: offList(t.id) });
  };
  const bulk = (fn, what) => {
    const off = types.filter((t) => !fn(t)).map((t) => t.id);
    if (!c.twists.on) off.push("twists");
    if (confirm(what)) send("types_off", { off: off.join(",") });
  };
  const markTested = (t) => {
    if (t.tested) { if (confirm(`Mark ${t.name} as NOT tested?`)) send("tested", { type: t.id, on: false }); return; }
    const note = prompt(`Mark ${t.name} tested. A note (what you tried, what worked)?`, "");
    if (note !== null) send("tested", { type: t.id, on: true, note });
  };
  const giveTest = (t, tier) => {
    if (!tester.trim()) return toast?.("Who gets the test quest? Type a player name at the top.", "error");
    const args = { player: tester.trim(), type: t.id, tier };
    if (twist) args.twist = twist;
    send("give", args);
  };
  const shown = types.filter((t) => filter === "all" || (filter === "new" && t.new) || (filter === "off" && !t.on) || (filter === "untested" && !t.tested)
    || (filter === "ready" && t.tested && !t.on));
  const newTypes = types.filter((t) => t.new);

  return (
    <div>
      <Title t="QUEST CONTROL" s="Test and run Zombita's Jobs from one place. Every change is a request the game runs within a few seconds." />
      {!s && <div className="ap-note danger">No word from the game yet. Is the server up?</div>}
      {s && !c && <div className="ap-note danger">The server runs a mod older than 1.7.159: Quest Control needs it. The old Jobs tab still works.</div>}
      {s?.stale && <div className="ap-note danger">The game last reported {relTime(s.at)}. The server may be down or restarting; requests wait until it's back.</div>}
      {busy && <div className="ap-note info">Waiting for the game to answer {waiting.length} request{waiting.length > 1 ? "s" : ""}...</div>}

      {c && <div className="ap-sr">
        <SC label="Jobs" value={s.on ? "ON" : "OFF"} color={s.on ? "green" : "red"} sub={`mod ${c.version || "?"}`} />
        <SC label="Job types on" value={`${types.filter((t) => t.on).length} / ${types.length}`} sub={`twists ${c.twists.on ? "on" : "off"}`} />
        <SC label="New types tested" value={`${newTypes.filter((t) => t.tested).length} / ${newTypes.length}`} sub={`${newTypes.filter((t) => t.on).length} switched on for players`} />
        <SC label="Open quests" value={fmt(quests.length)} sub={`${quests.filter((q) => (q.members || []).length).length} taken`} />
      </div>}

      {c && <FB title="SWITCHES">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {c.switches.map((w) => (
            <B key={w.id} c={w.on ? "green" : "ghost"} disabled={busy} title={w.about}
              onClick={() => confirm(`Turn ${w.name} ${w.on ? "OFF" : "ON"}?`) && send("switch", { id: w.id, on: !w.on })}>
              {w.on ? "✓" : "✕"} {w.name}</B>))}
        </div>
        <div style={{ ...dim, marginTop: 8 }}>
          Mods some types need: Zombita Raft {c.mods.raft ? "running" : "not running"} (island jobs) · Bandits {c.mods.bandits ? "running" : "not running"} (escorts, bandit camps, twists)
          · B42 Tiger {c.mods.tiger ? "running" : "not running"} (beasts) · Zombita Bosses {c.mods.bosses ? "running" : "not running"} (boss fights)
        </div>
      </FB>}

      {c && <FB title="TEST CONSOLE">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <label style={dim}>GIVE TEST QUESTS TO <input style={{ ...inp, width: 160 }} value={tester} onChange={(e) => setTester(e.target.value)} placeholder="in-game name" /></label>
          <label style={dim}>WITH TWIST <select style={inp} value={twist} onChange={(e) => setTwist(e.target.value)}>
            <option value="">none</option>{TWISTS.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
          <span style={dim}>Use the tier buttons in the table below. Test quests come as admin quests (red on the phone, near the player); the game still gives them when the type is off for players.</span>
        </div>
      </FB>}

      {c && <TW title={`JOB TYPES (${types.length})`} right={<span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[["all", "All"], ["new", "New"], ["untested", "Not tested"], ["ready", "Tested but off"], ["off", "Off"]].map(([k, l]) =>
          <B key={k} sm c={filter === k ? "gold" : "ghost"} onClick={() => setFilter(k)}>{l}</B>)}
        <B sm c="green" disabled={busy} onClick={() => bulk((t) => t.on || t.tested, "Switch ON every type that is marked tested? (The rest stay as they are.)")}>Tested ones on</B>
        <B sm c="red" disabled={busy} onClick={() => bulk((t) => (t.new && !t.tested ? false : t.on), "Switch OFF every new type that isn't tested? (The rest stay as they are.)")}>Untested new off</B>
      </span>}>
        <div style={{ overflowX: "auto" }}><table className="ap-table"><thead><tr>
          <th>Type</th><th>Tiers</th><th>Players get it</th><th>Tested</th><th>Twists it can get</th><th>Give a test quest</th>
        </tr></thead><tbody>{shown.map((t) => (
          <tr key={t.id} style={{ opacity: t.live ? 1 : 0.6 }}>
            <td><div>{t.name} {t.new && <Pill c="var(--orange)">NEW</Pill>}{!t.board && <Pill c="var(--textdim)" title="Never on the board itself">not on board</Pill>}</div>
              <div style={dim}>{t.id}{!t.live && " · not running (its mod is off or missing)"}</div></td>
            <td>{t.tiers.split("").map((x) => <TierPill key={x} t={x} />)}</td>
            <td><B sm c={t.on ? "green" : "ghost"} disabled={busy} onClick={() => flipType(t)}>{t.on ? "ON" : "OFF"}</B></td>
            <td><B sm c={t.tested ? "green" : "ghost"} disabled={busy} onClick={() => markTested(t)}>{t.tested ? "✓ tested" : "not yet"}</B>
              {t.tested && <div style={dim} title={t.note}>{t.testedBy}{t.testedAt ? `, ${relTime(t.testedAt)}` : ""}{t.note ? `: ${t.note}` : ""}</div>}</td>
            <td style={dim}>{t.twists ? t.twists.split(",").join(", ") : "-"}</td>
            <td style={{ whiteSpace: "nowrap" }}>{t.tiers.split("").map((x) =>
              <B key={x} sm c="ghost" disabled={busy || !t.live} title={`Give ${tester || "?"} a ${x} ${t.name}${twist ? ` with the ${twist} twist` : ""}`} onClick={() => giveTest(t, x)}>{x}</B>)}</td>
          </tr>))}</tbody></table></div>
        {shown.length === 0 && <div style={{ ...dim, padding: 10 }}>Nothing in this list.</div>}
      </TW>}

      {c && <FB title="TWISTS">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <B c={c.twists.on ? "green" : "ghost"} disabled={busy} onClick={() => confirm(`Turn twists ${c.twists.on ? "OFF" : "ON"} for players?`) && send("types_off", { off: offList("twists") })}>
            {c.twists.on ? "✓ Twists on" : "✕ Twists off"}</B>
          <B c={c.twists.tested ? "green" : "ghost"} disabled={busy} onClick={() => markTested({ id: "twists", name: "Twists", tested: c.twists.tested })}>{c.twists.tested ? "✓ tested" : "not tested yet"}</B>
          {chance && ["D", "C", "B", "A"].map((tid) => (
            <label key={tid} style={dim}><TierPill t={tid} /> <input style={{ ...inp, width: 52 }} type="number" min={0} max={100} value={chance[tid]}
              onChange={(e) => setChance({ ...chance, [tid]: e.target.value })} />%</label>))}
          <B c="gold" disabled={busy || !chance} onClick={() => send("twist_chance", chance)}>Save chances</B>
        </div>
        <div style={{ ...dim, marginTop: 6 }}>How often a plain job goes wrong on the way, by tier{c.twists.custom ? " (your numbers)" : " (the defaults)"}. Never on S, escorts, fights, traps, community or rescue jobs. Pay doesn't change.</div>
      </FB>}

      {c && <TW title={`OPEN QUESTS (${quests.length})`} right={<span style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <B sm c="gold" disabled={busy} onClick={() => send("post_now")}>Fill the board now</B>
        <select style={inp} value={sCls} onChange={(e) => setSCls(e.target.value)}>{(c.sClasses || ["S"]).map((x) => <option key={x}>{x}</option>)}</select>
        <B sm c="gold" disabled={busy} onClick={() => confirm(`Post an ${sCls} quest now? Everyone online hears about it.`) && send("post_s", { cls: sCls })}>Post S</B>
      </span>}>
        {quests.length === 0 ? <div style={{ ...dim, padding: 10 }}>None open.</div> :
          <div style={{ overflowX: "auto" }}><table className="ap-table"><thead><tr>
            <th>Tier</th><th>Quest</th><th>Where</th><th>Who</th><th>Progress</th><th>Left</th><th>Where it stands</th><th></th>
          </tr></thead><tbody>{quests.map((q) => {
            const members = q.members || [];
            return (
              <tr key={q.id}>
                <td><TierPill t={q.tier} /></td>
                <td><div>{q.title}</div><div style={dim}>{q.id} · {q.type} · {KIND[q.kind] || q.kind}{q.onlyFor ? ` for ${q.onlyFor}` : ""}{q.trap ? " · TRAP" : ""}</div>
                  {q.secret && <div style={dim}>code {q.secret}</div>}</td>
                <td style={dim}>{q.place || "-"}{q.x ? <div>{q.x}, {q.y}</div> : null}</td>
                <td style={dim}>{members.length ? members.join(", ") : "nobody yet"}</td>
                <td style={mono}>{q.total > 1 ? `${q.progress}/${q.total}` : q.progress ? "done" : "-"}{q.bagOut ? <div style={dim}>bag / arrow out</div> : null}</td>
                <td style={mono}>{dur(q.left)}</td>
                <td style={dim}>{q.detail || "-"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {members.length > 0 && <>
                    <select style={inp} value={winner[q.id] || members[0]} onChange={(e) => setWinner({ ...winner, [q.id]: e.target.value })}>
                      {members.map((m) => <option key={m}>{m}</option>)}</select>
                    <B sm c="green" disabled={busy} onClick={() => confirm(`Finish "${q.title}" as WON for ${winner[q.id] || members[0]}? They get paid like a real win.`) && send("complete", { job: q.id, player: winner[q.id] || members[0] })}>Win</B></>}
                  <B sm c="red" disabled={busy} onClick={() => confirm(`Call off "${q.title}"? Nobody on it loses anything.`) && send("cancel", { job: q.id })}>Cancel</B>
                </td>
              </tr>);
          })}</tbody></table></div>}
      </TW>}

      {c?.derby && <FB title="FISHING DERBY">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          <div style={{ ...mono, minWidth: 220 }}>
            <div>{c.derby.on ? "Running" : "Switched off (see SWITCHES)"} · {c.derby.entries} fishing this week · ends in {dur(c.derby.left)}</div>
            {c.derby.top.length === 0 ? <div style={dim}>No fish yet.</div> : c.derby.top.map((r, i) => <div key={i}>{i + 1}. {r.name} <span style={dim}>{r.kg} kg, {r.fish}</span></div>)}
            <div style={{ marginTop: 8 }}><B sm c="red" disabled={busy} onClick={() => confirm("End this derby week now? The top 3 get their prize codes and the standings start empty (the week's end date stays).") && send("derby_end")}>End this week now</B></div>
          </div>
          {prizes && <table className="ap-table" style={{ width: "auto" }}><thead><tr><th>Place</th><th>Trophy</th><th>Coins (bronze)</th><th>Rep</th><th></th></tr></thead><tbody>
            {prizes.map((p, i) => (
              <tr key={p.place}><td>{p.place}.</td><td style={dim}>{p.item}</td>
                <td><input style={{ ...inp, width: 90 }} type="number" min={0} value={p.coins} onChange={(e) => { const x = [...prizes]; x[i] = { ...p, coins: e.target.value }; setPrizes(x); }} /> <span style={dim}>{money(Number(p.coins) || 0)}</span></td>
                <td><input style={{ ...inp, width: 50 }} type="number" min={0} max={10} value={p.rep} onChange={(e) => { const x = [...prizes]; x[i] = { ...p, rep: e.target.value }; setPrizes(x); }} /></td>
                <td><B sm c="gold" disabled={busy} onClick={() => send("derby_prize", { place: p.place, coins: Number(p.coins) || 0, rep: Number(p.rep) || 0 })}>Save</B></td></tr>))}
          </tbody></table>}
        </div>
      </FB>}

      {c?.community && <FB title="COMMUNITY CENTRE">
        <div style={mono}>{c.community.present} / {c.community.total} on the shelves{c.community.complete ? " · COMPLETE" : ""}</div>
        <div style={dim}>Shelves: {Object.entries(c.community.shelves).map(([k, n]) => `${k} ${n}`).join(", ")}. Mark shelves in game (right-click a container &gt; Zombita: community shelf). Community jobs are the "collect" type above.</div>
        <div style={{ marginTop: 6 }}><a href="/community" target="_blank" rel="noreferrer" style={{ ...mono, color: "var(--accent)" }}>The full table on the website →</a></div>
      </FB>}

      <FB title="PAY, RANKS, REWARDS, SPECIALS, IOUS, REQUEST LOG">
        <B c="ghost" onClick={() => setMore(!more)}>{more ? "Hide" : "Show"} the rest of the Jobs settings</B>
        <span style={{ ...dim, marginLeft: 10 }}>Item rewards per type and tier are in the Quest Rewards tab.</span>
      </FB>
      {more && <JobsTab toast={toast} />}
    </div>
  );
}
