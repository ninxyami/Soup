// @ts-nocheck
"use client";
// components/security/Panels.tsx - the tabs of /security besides Households: Players (risk list + threat card), Zombita
// Bites, Access, Server and Staff actions. All read the threats report (bot zombita_threats.py).
import { useEffect, useMemo, useState } from "react";
import ThreatCard, { RiskChip, Btn } from "./ThreatCard";
import { C, DISPLAY, RISKS, KINDS, SEV_ORDER, n, plural, utc, risk } from "./lib";

const inp = "font-mono text-[0.8rem] px-2.5 py-2 outline-none w-full";
const inpStyle = { background: "#080a0c", color: C.bright, border: `1px solid ${C.line}`, borderRadius: 2 };

export function Box({ title, note = null, children, className = "" }) {
  return (
    <section className={`border p-4 min-w-0 ${className}`} style={{ borderColor: C.line, background: C.card }}>
      <div className="flex items-baseline gap-3 flex-wrap border-b pb-1.5 mb-3" style={{ borderColor: C.line }}>
        <h3 className="font-mono text-[0.72rem] uppercase tracking-[0.16em] m-0" style={{ color: C.gold, fontWeight: "normal" }}>{title}</h3>
        {note && <span className="text-[0.75rem]" style={{ color: C.muted }}>{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Table({ head, rows, empty = "Nothing here." }) {
  const th = "text-left font-mono text-[0.62rem] uppercase tracking-[0.1em] font-normal px-2 py-1.5 whitespace-nowrap";
  if (!rows.length) return <p className="text-[0.85rem] m-0" style={{ color: C.muted }}>{empty}</p>;
  return (
    <div className="overflow-x-auto border" style={{ borderColor: C.line }}>
      <table className="w-full text-[0.8rem]" style={{ borderCollapse: "collapse" }}>
        <thead style={{ background: C.inner, color: C.muted }}><tr>{head.map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
              {r.map((c, j) => <td key={j} className="px-2 py-1.5 align-top" style={{ color: j === 0 ? C.bright : C.text }}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- Players ----------------
function PlayerRow({ p, active, onPick }) {
  const live = (p.findings || []).filter((f) => !f.cleared && f.severity !== "info");
  const kinds = [...new Set(live.map((f) => f.kind))];
  return (
    <button onClick={onPick} className="w-full text-left block px-3 py-2.5 cursor-pointer transition-colors"
      style={{ background: active ? "#141a22" : "transparent", borderLeft: `3px solid ${active ? C.gold : "transparent"}`, borderBottom: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-2">
        <span className="flex-1 min-w-0 truncate text-[0.92rem]" style={{ color: C.bright }}>{p.name}</span>
        {p.marked && <span className="font-mono text-[0.58rem] uppercase px-1" style={{ color: C.red, border: `1px solid ${C.red}66` }}>bites</span>}
        <RiskChip r={p.risk} small />
      </div>
      <div className="flex items-center gap-x-2 gap-y-1 flex-wrap mt-1 font-mono text-[0.64rem]" style={{ color: C.muted }}>
        {kinds.length ? kinds.map((k) => <span key={k}>{KINDS[k] || k}</span>) : <span>nothing open</span>}
        {p.watched && <span style={{ color: C.gold }}>watched</span>}
      </div>
    </button>
  );
}

export function PlayersTab({ rep, filter, setFilter, sel, setSel, busy, act, onReport }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const players = useMemo(() => {
    const order = { serious: 0, suspicious: 1, watch: 2, clean: 3 };
    const top = (p) => Math.max(0, ...(p.findings || []).filter((f) => !f.cleared).map((f) => SEV_ORDER[f.severity] || 0));
    return (Array.isArray(rep.players) ? [...rep.players] : [])
      .sort((a, b) => (order[a.risk] ?? 9) - (order[b.risk] ?? 9) || top(b) - top(a) || a.name.localeCompare(b.name));
  }, [rep.players]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return players.filter((p) => (!filter || p.risk === filter) && (!s || p.name.toLowerCase().includes(s))
      && (!kind || (p.findings || []).some((f) => f.kind === kind && !f.cleared && f.severity !== "info")));
  }, [players, filter, q, kind]);
  const cur = sel ? players.find((p) => p.name === sel) : null;
  useEffect(() => {
    if (sel || !players.length || typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 1024px)").matches) setSel(players[0].name);
  }, [players, sel, setSel]);
  const pick = (p) => {
    setSel(p.name);
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches) window.scrollTo({ top: 0 });
  };
  return (
    <div className="grid gap-6 grid-cols-[minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)] items-start">
      <div className={cur ? "hidden lg:block" : ""}>
        <div className="border" style={{ borderColor: C.line, background: C.card }}>
          <div className="p-3 border-b" style={{ borderColor: C.line }}>
            <input className={inp} style={inpStyle} placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {RISKS.map(([r, title, color]) => (
                <button key={r} onClick={() => setFilter(filter === r ? "" : r)}
                  className="font-mono text-[0.6rem] uppercase tracking-[0.1em] px-2 py-1 cursor-pointer"
                  style={{ color: filter === r ? C.bg : color, background: filter === r ? color : "transparent", border: `1px solid ${color}88`, borderRadius: 2 }}>{title}</button>
              ))}
            </div>
            <select className={`${inp} mt-2`} style={inpStyle} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">Any kind of finding</option>
              {Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <div className="flex items-center gap-2 mt-2 font-mono text-[0.65rem] uppercase tracking-[0.1em]" style={{ color: C.muted }}>
              <span>{plural(shown.length, "player")}</span>
              {(filter || q || kind) && <button onClick={() => { setFilter(""); setQ(""); setKind(""); }} className="ml-auto cursor-pointer uppercase" style={{ color: C.gold, background: "transparent", border: 0 }}>Show all</button>}
            </div>
          </div>
          <div className="lg:max-h-[calc(100vh-300px)] lg:overflow-y-auto">
            {shown.map((p) => <PlayerRow key={p.name} p={p} active={p.name === sel} onPick={() => pick(p)} />)}
            {players.length === 0 && <div className="p-4 text-[0.85rem]" style={{ color: C.muted }}>No report yet. Press Listen now, or wait for tonight&apos;s check.</div>}
            {players.length > 0 && shown.length === 0 && <div className="p-4 text-[0.85rem]" style={{ color: C.muted }}>No player matches.</div>}
          </div>
        </div>
      </div>
      <div className={cur ? "" : "hidden lg:block"}>
        {cur ? (
          <div className="border p-4 sm:p-6" style={{ borderColor: C.line, background: C.card }}>
            <ThreatCard p={cur} rep={rep} busy={busy} act={act} onReport={() => onReport(cur)} onBack={() => setSel("")} />
          </div>
        ) : (
          <div className="border p-10 text-center text-[0.9rem]" style={{ borderColor: C.line, background: C.card, color: C.muted }}>
            {players.length ? "Pick a player on the left to see their threat card." : "Nothing to show yet."}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Zombita Bites ----------------
const BITE_KIND = { mark: "marked", hunt: "hunted", kill: "killed by Zombita", kick: "kicked", ban: "banned (3rd kick)", died: "died, mark cleared",
  unmark: "taken off the list", skillguard: "skill guard: impossible new character", autokick_kick: "the bot kicked", autokick_ban: "the bot banned",
  site_mark: "marked on the site", site_unmark: "unmarked on the site", site_kick: "kick asked on the site", site_ban: "ban asked on the site" };

export function BitesTab({ rep, busy, act, openPlayer }) {
  const B = rep.bites || {};
  const people = Array.isArray(B.people) ? B.people : [];
  const marked = Array.isArray(B.marked) ? B.marked : [];
  return (
    <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-2 items-start">
      <Box title={`Marked now (${marked.length})`} note="On zombita_bite.txt: hunted every time they are online, until the character dies.">
        {marked.length === 0 && <p className="text-[0.85rem] m-0" style={{ color: C.muted }}>Nobody is marked.</p>}
        <div className="flex flex-col gap-2">
          {marked.map((m) => (
            <div key={m} className="flex items-center gap-2 flex-wrap">
              <button onClick={() => openPlayer(m)} className="text-[0.95rem] cursor-pointer" style={{ color: C.bright, background: "transparent", border: 0, padding: 0 }}>{m}</button>
              <span className="ml-auto"><Btn color={C.green} disabled={busy} onClick={() => act("unmark", m)}>Unmark</Btn></span>
            </div>
          ))}
        </div>
      </Box>
      <Box title="Everyone Zombita bit" note={`Last ${rep.window_days || 14} days`}>
        <Table head={["Player", "Marked", "Hunted", "Kicked", "Banned", "Last"]} empty="Nobody yet."
          rows={people.map((p) => [
            <button key="n" onClick={() => openPlayer(p.name)} className="cursor-pointer" style={{ color: C.bright, background: "transparent", border: 0, padding: 0 }}>{p.name}</button>,
            p.marked ? <span style={{ color: C.red }}>yes</span> : "no", n(p.hunts), n(p.kicks), p.banned ? <span style={{ color: C.red }}>yes</span> : "no",
            <span key="t" className="font-mono text-[0.7rem]">{p.last ? utc(p.last) : "?"}</span>])} />
      </Box>
      <Box title="What happened" note="Newest first: the game's lines, the bot's kicks and bans, and the site's buttons." className="lg:col-span-2">
        <Table head={["When", "Player", "What", "Detail"]} empty="No events in the window."
          rows={(B.events || []).slice(0, 150).map((e) => [<span key="t" className="font-mono text-[0.7rem] whitespace-nowrap">{utc(e.ts)}</span>, e.name, BITE_KIND[e.kind] || e.kind,
            <span key="d" className="font-mono text-[0.7rem] break-words">{e.text}</span>])} />
      </Box>
    </div>
  );
}

// ---------------- Access ----------------
export function AccessTab({ rep }) {
  const A = rep.access || {};
  const reasons = Object.entries(A.by_reason || {});
  return (
    <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-2 items-start">
      <Box title="Join rejects by reason" note="Not whitelisted, wrong password, banned, server full ...">
        <Table head={["Reason", "Times"]} rows={reasons.map(([r, c]) => [r, c])} empty="No rejected joins." />
      </Box>
      <Box title="Join floods" note="10 or more tries within 10 minutes from one address or one name.">
        <Table head={["By", "Who", "Tries", "From", "To", "Names"]} empty="No floods."
          rows={(A.floods || []).map((f) => [f.by === "ip" ? "address" : "name", <span key="w" className="font-mono">{f.who}</span>, f.n,
            <span key="a" className="font-mono text-[0.7rem]">{utc(f.first)}</span>, <span key="b" className="font-mono text-[0.7rem]">{utc(f.last)}</span>, (f.names || []).join(", ")])} />
      </Box>
      <Box title="Zombita Control lock-outs" note="Five wrong panel passwords in game.">
        <Table head={["When", "Player"]} empty="No lock-outs." rows={(A.lockouts || []).map((l) => [<span key="t" className="font-mono text-[0.7rem]">{l.ts ? utc(l.ts) : "?"}</span>, l.name])} />
      </Box>
      <Box title="Wrong admin panel passwords on the website" note="From the API's log. Addresses are scrambled codes.">
        <Table head={["Address code", "Times"]} empty="None." rows={((rep.server || {}).panel_wrong || []).map((x) => [<span key="i" className="font-mono">{x.ip}</span>, x.n])} />
      </Box>
      <Box title="Latest rejects" note="Steam ids show their last 4 digits; addresses are scrambled codes." className="lg:col-span-2">
        <Table head={["When", "Name", "Reason", "Steam", "Address"]} empty="None."
          rows={(A.rejects || []).slice(0, 150).map((r) => [<span key="t" className="font-mono text-[0.7rem] whitespace-nowrap">{utc(r.ts)}</span>, r.name || "?", r.reason,
            <span key="s" className="font-mono">{r.steam}</span>, <span key="i" className="font-mono">{r.ip}</span>])} />
      </Box>
    </div>
  );
}

// ---------------- Server ----------------
export function ServerTab({ rep }) {
  const S = rep.server || {};
  const src = rep.sources || {};
  return (
    <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-2 items-start">
      <Box title="Server threats" note={`Last ${rep.window_days || 14} days`} className="lg:col-span-2">
        <ul className="m-0 pl-5 text-[0.9rem] leading-relaxed" style={{ color: C.text }}>
          {(S.lines || ["No report yet."]).map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </Box>
      <Box title="Repeated mod errors" note="The same file and line, 25 times or more.">
        <Table head={["File", "Line", "Mod", "Times"]} empty="None."
          rows={(S.mod_errors || []).map((e) => [<span key="f" className="font-mono text-[0.75rem]">{e.file}</span>, e.line, e.mod || "?", e.n])} />
      </Box>
      <Box title="Crash and lag lines">
        <Table head={["When", "Line"]} empty="None."
          rows={[...(S.crashes || []), ...(S.lag || [])].sort((a, b) => b.ts - a.ts).slice(0, 40).map((x) => [<span key="t" className="font-mono text-[0.7rem] whitespace-nowrap">{utc(x.ts)}</span>,
            <span key="l" className="font-mono text-[0.7rem] break-words">{x.text}</span>])} />
      </Box>
      <Box title="RCON failures" note="From the bot's logs.">
        <Table head={["When", "Line"]} empty="None."
          rows={(S.rcon_fail || []).map((x) => [<span key="t" className="font-mono text-[0.7rem] whitespace-nowrap">{x.ts ? utc(x.ts) : "?"}</span>, <span key="l" className="font-mono text-[0.7rem] break-words">{x.text}</span>])} />
      </Box>
      <Box title="Server starts">
        <p className="text-[0.85rem] m-0 mb-2" style={{ color: C.text }}>{n(S.starts)} starts, {n(S.unclean)} without a clean shutdown before.</p>
        <div className="flex flex-wrap gap-1.5">
          {(S.start_times || []).slice().reverse().map((t) => <span key={t} className="font-mono text-[0.68rem] px-1.5" style={{ color: C.text, border: `1px solid ${C.line}` }}>{utc(t)}</span>)}
        </div>
      </Box>
      <Box title="What Zombita read tonight" className="lg:col-span-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[0.7rem]" style={{ color: C.muted }}>
          {[["players with positions", src.positions_players], ["joins", src.joins], ["skill log lines", src.perk_lines], ["anti-cheat lines", src.anticheat_lines],
            ["admin lines", src.admin_lines], ["join rejects", src.rejects], ["Zombita Bites lines", src.bite_lines], ["deaths", src.deaths],
            ["Dawn of the Dead nights", src.dotd_windows], ["restores", src.restores], ["XP rates from the sandbox", src.multipliers_from_sandbox ? "yes" : "no (built-in)"],
            ["game database", src.server_db ? "read" : "not read"]].map(([k, v]) => (
            <div key={k} className="px-2 py-1.5 border" style={{ borderColor: C.line, background: C.inner }}>{k} <span style={{ color: C.bright }}>{v ?? "?"}</span></div>
          ))}
        </div>
        {Array.isArray(src.errors) && src.errors.length > 0 && <div className="mt-2 font-mono text-[0.72rem]" style={{ color: C.red }}>{src.errors.join(" | ")}</div>}
        {Array.isArray(src.not_checked) && src.not_checked.map((t) => <div key={t} className="mt-2 text-[0.78rem]" style={{ color: C.muted }}>Not checked: {t}</div>)}
      </Box>
    </div>
  );
}

// ---------------- Staff actions ----------------
export function StaffTab({ rep }) {
  const rows = Array.isArray(rep.staff_actions) ? rep.staff_actions : [];
  const [who, setWho] = useState("");
  const actors = useMemo(() => {
    const c = {};
    rows.forEach((r) => { c[r.actor] = (c[r.actor] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const shown = rows.filter((r) => !who || r.actor === who);
  return (
    <div className="grid gap-4 grid-cols-[minmax(0,1fr)]">
      <Box title="Staff" note="Not judged by Zombita. Their admin commands are listed here so everyone can see them.">
        <div className="flex flex-wrap gap-1.5">
          {(rep.staff || []).map((s) => <span key={s} className="font-mono text-[0.72rem] px-1.5" style={{ color: C.text, border: `1px solid ${C.line}` }}>{s}</span>)}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {actors.map(([a, c]) => (
            <button key={a} onClick={() => setWho(who === a ? "" : a)} className="font-mono text-[0.66rem] uppercase tracking-[0.08em] px-2 py-1 cursor-pointer"
              style={{ color: who === a ? C.bg : C.gold, background: who === a ? C.gold : "transparent", border: `1px solid ${C.gold}88`, borderRadius: 2 }}>{a} {c}</button>
          ))}
        </div>
      </Box>
      <Box title={`Admin commands (${shown.length})`} note="admin.txt and cmd.txt, newest first.">
        <Table head={["When", "Who", "What", "Target", "Line"]} empty="None in the window."
          rows={shown.slice(0, 300).map((r) => [<span key="t" className="font-mono text-[0.7rem] whitespace-nowrap">{utc(r.ts)}</span>, r.actor, r.verb, r.target || r.item || "",
            <span key="l" className="font-mono text-[0.7rem] break-words">{r.text}</span>])} />
      </Box>
    </div>
  );
}
