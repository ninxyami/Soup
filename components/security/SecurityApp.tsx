// @ts-nocheck
"use client";
// components/security/SecurityApp.tsx - Zombita's Security, the full watch (/security, 2026-10-16). Every night the bot
// (zombita_threats.py, which runs zombita_security.py's households first) checks every player: skills, kills, the game's
// anti-cheat, movement, admin powers, money, items, ban evasion, access, Zombita Bites and households, plus the server's
// own troubles. Top: Zombita's status line, the count per risk level and Listen now. Tabs: Players (risk list + threat
// card), Households (the pairs view), Bites, Access, Server, Staff actions. "Write case report" opens a printable case file.
// Zombita states facts; admins decide.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { API } from "@/lib/constants";
import Households from "./Households";
import CaseReport from "./CaseReport";
import Confirm from "./Confirm";
import { PlayersTab, BitesTab, AccessTab, ServerTab, StaffTab } from "./Panels";
import { C, DISPLAY, BODY, PORTRAIT, RISKS, n, when, getReport, postSecurity, getThreats, postThreats } from "./lib";

const TABS = [["players", "Players"], ["households", "Households"], ["bites", "Bites"], ["access", "Access"], ["server", "Server"], ["staff", "Staff actions"]];

function Gate({ text, link = null }) {
  return (
    <main className="max-w-[640px] mx-auto px-4 py-24 text-center" style={{ fontFamily: BODY }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PORTRAIT} alt="Zombita" className="w-20 h-20 rounded-full object-cover mx-auto mb-5 opacity-80" />
      <div className="text-[0.95rem]" style={{ color: C.muted }}>{text}</div>
      {link && <div className="mt-4 font-mono">{link}</div>}
    </main>
  );
}

// the exact words of every confirm box: what happens, to whom, and how to undo it
function askFor(cmd, name, extra) {
  const bites = [
    `${name} goes on Zombita Bites' list (zombita_bite.txt).`,
    `The next time ${name} is online: god mode, invisibility and noclip are switched off, a pop-up tells them "You cheated. This is what you get for cheating.", everyone online reads "${name} cheated. Zombita bites back.", and a horde spawns right around the character.`,
    "Still alive after 10 seconds: Zombita kills the character. Still alive after 20 seconds: the bot kicks them. The hunt repeats on every login until that character dies, and the 3rd kick is a ban (account and Steam id).",
    `When that character dies, ${name} waits for an appeal: every login is kicked at once with "Zombita caught you cheating. Open a ticket on our Discord to appeal." Only Release (or a new mark) changes that.`,
    "Unmark stops the hunt within seconds. A character that already died is not given back automatically (restore it on the Deaths tab).",
  ];
  switch (cmd) {
    case "watch": return { title: `Watch ${name}`, color: C.gold, yes: "Watch", lines: [`${name} goes on the watch list and shows as "watch" at least. Nothing happens to the player.`],
      note: { label: "Why (optional, admins only)", placeholder: "e.g. reported in a ticket" } };
    case "unwatch": return { title: `Stop watching ${name}`, yes: "Stop watching", lines: ["The risk goes back to what the findings say."] };
    case "mark": return { title: extra.again ? `Hunt ${name} again` : `Mark ${name} for Zombita Bites`, color: C.red, yes: "Mark and hunt", lines: bites };
    case "mark_forever": return { title: `Mark ${name} permanently`, color: C.red, yes: "Mark permanently", lines: [
      `${name} goes on Zombita Bites' list with a permanent mark ("!${name}" in zombita_bite.txt).`,
      "Every character they make is hunted the same way: god mode and noclip switched off, a horde right around them, killed at 10 seconds, kicked at 20 seconds, the 3rd kick is a ban.",
      "The mark stays through every death. There is no appeal lock: it only ends when an admin presses Unmark."] };
    case "release": return { title: `Release ${name}`, color: C.green, yes: "Release", lines: [
      `${name} comes off Zombita Bites' list. They can join and play again within seconds: no horde, no kick.`,
      "Do this when their appeal ticket is accepted. The character Zombita killed is not given back automatically (restore it on the Deaths tab if you want to)."] };
    case "unmark": return { title: `Unmark ${name}`, color: C.green, yes: "Unmark", lines: [`${name} comes off Zombita Bites' list (a permanent mark too). A hunt going on stops within seconds, and the next login is normal.`] };
    case "kick": return { title: `Kick ${name}`, color: C.amber, yes: "Kick", lines: [
      `The bot kicks ${name} within a few seconds if they are online (a line in zombita_autokick.txt, source "security").`,
      "If they are not online in the next 15 minutes, nothing happens. They can join again right away. The admin channel gets a line."],
      note: { label: "Reason the player sees (optional)", placeholder: "Zombita's Security: removed by the admin team." } };
    case "ban": return { title: `Ban ${name}`, color: C.red, yes: "Ban", lines: [
      `The bot bans ${name}'s account and their Steam id (banuser and banid) within a few seconds, online or not.`,
      `Undo: unbanuser "${name}" and unbanid with the Steam id; the admin channel line shows both.`],
      note: { label: "Reason the player sees (optional)", placeholder: "Zombita's Security: banned by the admin team." } };
    case "note": return { title: `Note on ${name}`, yes: "Save note", lines: ["Admins only. It shows under Who did what on the card."],
      note: { label: "Note", placeholder: "", required: true } };
    case "clear": return { title: "Clear this finding", color: C.blue, yes: "Clear", lines: [`"${extra.title}"`, "It stays on the card, crossed out with your name, and stops counting toward the risk. Tonight's check keeps it cleared."],
      note: { label: "Why it's fine (admins only)", placeholder: "e.g. crafting the vaccine all evening" } };
    case "unclear": return { title: "Count this finding again", yes: "Count it", lines: [`"${extra.title}"`] };
    default: return { title: cmd, lines: [] };
  }
}

export default function SecurityApp() {
  const [thr, setThr] = useState(null);
  const [sec, setSec] = useState(null);
  const [authErr, setAuthErr] = useState(0);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("players");
  const [filter, setFilter] = useState("");
  const [sel, setSel] = useState("");
  const [report, setReport] = useState(null);
  const [confirm, setConfirm] = useState(null);       // {ask, resolve}

  const load = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([getThreats(), getReport()]);
      setThr(t);
      setSec(s);
      setErr("");
    } catch (e) {
      if (e.status === 401 || e.status === 403) setAuthErr(e.status);
      else setErr(String(e.message || e));
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = window.location.hash.replace("#", "");
    if (TABS.some(([k]) => k === h)) setTab(h);
  }, []);
  useEffect(() => {
    if (!(thr?.running || sec?.running)) return;
    const t = setTimeout(load, 5000);
    return () => clearTimeout(t);
  }, [thr, sec, load]);

  const go = (t) => {
    setTab(t);
    if (typeof window !== "undefined") window.history.replaceState(null, "", `#${t}`);
  };
  const ask = (a) => new Promise((resolve) => setConfirm({ ask: a, resolve }));
  const askYesNo = async (question) => (await ask({ title: "Are you sure?", lines: [question], yes: "Yes" })) !== null;

  async function run(fn, label) {
    setBusy(true);
    setMsg(`${label}...`);
    try {
      const d = await fn();
      setMsg(d.msg || "Done.");
      await load();
      return true;
    } catch (e) {
      setMsg(`Couldn't send: ${e.message || e}`);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const listen = () => run(() => postThreats({ cmd: "run" }), "Asking Zombita to listen");
  const sendHouse = (body, label) => run(() => postSecurity(body), label);
  const act = async (cmd, player, extra = {}) => {
    const note = await ask(askFor(cmd, player, extra));
    if (note === null) return;
    run(() => postThreats({ cmd, player, finding: extra.finding || "", note }), "Saving");
  };
  const openPlayer = (name) => {
    setSel(name);
    go("players");
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  if (authErr === 401) return <Gate text="Log in with Discord to see Zombita's Security." link={<a href={`${API}/auth/discord/login`} style={{ color: C.gold }}>Log in</a>} />;
  if (authErr === 403) return <Gate text="Zombita's Security is for admins only." />;
  if (!thr && err) return <Gate text={`Can't reach the server: ${err}`} />;
  if (!thr || !sec) return <Gate text="Loading..." />;

  const box = <Confirm ask={confirm?.ask} onYes={(note) => { confirm.resolve(note ?? ""); setConfirm(null); }} onNo={() => { confirm.resolve(null); setConfirm(null); }} />;

  if (report) {
    return (
      <>
        <CaseReport what={report} rep={thr} sec={sec} onClose={() => { setReport(null); window.scrollTo({ top: 0 }); }} />
        {box}
      </>
    );
  }

  const counts = thr.counts || {};
  const running = thr.running || sec.running;
  return (
    <main className="min-h-screen" style={{ background: C.bg, fontFamily: BODY }}>
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex justify-end gap-4 mb-3 font-mono text-[0.7rem] uppercase tracking-[0.12em]">
          <Link href="/ops" style={{ color: C.muted }}>Live Ops</Link>
          <Link href="/admin" style={{ color: C.muted }}>Admin panel</Link>
        </div>

        <header className="flex items-center gap-4 sm:gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PORTRAIT} alt="Zombita" className="w-16 h-16 sm:w-24 sm:h-24 rounded-full object-cover shrink-0"
            style={{ border: `2px solid ${C.gold}55`, boxShadow: `0 0 24px ${C.gold}22` }} />
          <div className="flex-1 min-w-0">
            <h1 className="m-0 leading-none" style={{ fontFamily: DISPLAY, fontSize: "clamp(30px, 6vw, 48px)", letterSpacing: 3, color: C.gold, fontWeight: "normal", textTransform: "none" }}>
              ZOMBITA&apos;S SECURITY
            </h1>
            <p className="m-0 mt-1.5 text-[0.95rem] leading-relaxed" style={{ color: C.bright }}>{thr.status}</p>
            <div className="flex items-center gap-x-4 gap-y-2 flex-wrap mt-2.5">
              <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em]" style={{ color: C.muted }}>
                Last check <span style={{ color: C.text }}>{when(thr.at)}</span>
              </span>
              <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em]" style={{ color: C.muted }}>
                Window <span style={{ color: C.text }}>{thr.window_days || 14} days</span>
              </span>
              <button onClick={listen} disabled={busy || running}
                className="font-mono text-[0.72rem] uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer disabled:cursor-default"
                style={{ color: C.gold, border: `1px solid ${C.gold}`, background: running ? `${C.gold}22` : `${C.gold}12`, borderRadius: 2, opacity: busy && !running ? 0.5 : 1 }}>
                {running ? "Listening..." : "Listen now"}
              </button>
            </div>
          </div>
        </header>

        {(running || thr.error || sec.error || msg || err) && (
          <div className="mt-4 flex flex-col gap-1.5 font-mono text-[0.78rem]">
            {running && <div style={{ color: C.gold }}>Zombita is listening. This page reads again every 5 seconds.</div>}
            {(thr.error || sec.error) && <div style={{ color: C.red }}>The last run failed: {thr.error || sec.error}</div>}
            {msg && <div style={{ color: msg.startsWith("Couldn't") ? C.red : C.gold }}>{msg}</div>}
            {err && <div style={{ color: C.red }}>Can&apos;t read the report: {err}</div>}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px mt-6 border" style={{ borderColor: C.line, background: C.line }}>
          {RISKS.map(([r, title, color, hint]) => {
            const on = tab === "players" && filter === r;
            return (
              <button key={r} onClick={() => { setFilter(on ? "" : r); go("players"); }} title={hint}
                className="text-left px-3 py-3 cursor-pointer transition-colors"
                style={{ background: on ? `${color}1f` : C.card, boxShadow: on ? `inset 0 -2px 0 ${color}` : "none" }}>
                <div className="leading-none" style={{ fontFamily: DISPLAY, fontSize: 34, color: n(counts[r]) ? color : "#3a4250" }}>{n(counts[r])}</div>
                <div className="font-mono text-[0.62rem] uppercase tracking-[0.1em] mt-1" style={{ color: on ? color : C.muted }}>{title}</div>
              </button>
            );
          })}
        </div>

        <nav className="flex gap-1 mt-6 overflow-x-auto border-b" style={{ borderColor: C.line }}>
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => go(k)} className="font-mono text-[0.72rem] uppercase tracking-[0.12em] px-3 py-2 cursor-pointer whitespace-nowrap"
              style={{ color: tab === k ? C.gold : C.muted, background: "transparent", border: 0, borderBottom: `2px solid ${tab === k ? C.gold : "transparent"}`, marginBottom: -1 }}>
              {label}{k === "households" && Array.isArray(sec.pairs) ? ` (${sec.pairs.filter((p) => p.verdict === "one").length})` : ""}
              {k === "bites" && ((thr.bites?.marked || []).length + (thr.bites?.appeal || []).length) ? ` (${(thr.bites?.marked || []).length + (thr.bites?.appeal || []).length})` : ""}
            </button>
          ))}
        </nav>

        <div className="mt-6">
          {tab === "players" && <PlayersTab rep={thr} filter={filter} setFilter={setFilter} sel={sel} setSel={setSel} busy={busy} act={act}
            onReport={(p) => { setReport({ kind: "player", subject: p }); window.scrollTo({ top: 0 }); }} />}
          {tab === "households" && <Households st={sec} busy={busy} send={sendHouse} ask={askYesNo}
            onReport={(p) => { setReport({ kind: "pair", subject: p }); window.scrollTo({ top: 0 }); }} />}
          {tab === "bites" && <BitesTab rep={thr} busy={busy} act={act} openPlayer={openPlayer} />}
          {tab === "access" && <AccessTab rep={thr} />}
          {tab === "server" && <ServerTab rep={thr} />}
          {tab === "staff" && <StaffTab rep={thr} />}
        </div>

        <details className="mt-10 border" style={{ borderColor: C.line, background: C.card }}>
          <summary className="cursor-pointer px-4 py-3 font-mono text-[0.75rem] uppercase tracking-[0.14em] select-none" style={{ color: C.gold }}>How Zombita watches, in plain words</summary>
          <div className="px-4 pb-5 text-[0.88rem] leading-relaxed max-w-[860px]" style={{ color: C.text }}>
            <p>Every night at 04:30 UTC Zombita reads the last {thr.window_days || 14} days: skill logs, kills per minute, the game&apos;s own anti-cheat
              lines, where everyone stood each minute, admin commands, money records, joins and refused joins. For every player she writes down what
              normal play can&apos;t explain, and next to it the innocent reasons she checked: an admin restore, crafting recipes with big XP, a journal,
              a Dawn of the Dead horde, a basement edge, RespawnInCar moving someone to their car at login, a bus ride, a car flung by a crash.</p>
            <p>Risk levels: <b style={{ color: C.red, fontWeight: 500 }}>serious</b> (a critical finding or two serious ones), <b style={{ color: C.amber, fontWeight: 500 }}>suspicious</b> (one
              serious finding), <b style={{ color: C.gold, fontWeight: 500 }}>watch</b> (smaller things, or an admin is watching), <b style={{ color: C.green, fontWeight: 500 }}>clean</b>. Staff are
              never judged; their admin commands are listed under Staff actions for everyone on the team to see.</p>
            <p className="mb-0" style={{ color: C.bright }}>Zombita states what the logs show. She never calls anyone a cheater and never decides who
              someone is. Admins decide, and every button here is written down with the admin&apos;s name.</p>
          </div>
        </details>
      </div>
      {box}
    </main>
  );
}
