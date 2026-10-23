// @ts-nocheck
"use client";
// components/cardsadmin/CardsAdminApp.tsx: the /cards-admin page (Nin 2026-10-23: "the whole settings page is so pathetic,
// make cards its own page ... it needs multiple tabs and stuff, make a better UI").
//
// The game owns the cards. This page reads:
//   GET /api/admin/cards        the game's cards state (settings, cards, holders, every player with points), every 2 min
//                               and right after a change (ZCards_Server writeState)
//   GET /api/admin/ops/board    Live Ops' copy of Zombita Control (every 10 s): the CARDS tab's launch facts (Mechanic
//                               spot, scrapyards, calls, points reset, tool wear line) and the MODS switches (cards, toolwear)
//   GET /api/admin/jobs         Zombita's Jobs: the open card jobs and Call a Mechanic jobs
//   GET /api/admin/cards/shop   the card shops by rank + Mags' shelf (bot zip cards_admin_page; "needs the bot update" without)
//   GET /api/admin/cards/log    recent card events, resets, card shop buys (same zip)
// and changes nothing itself: every button is a REQUEST the game runs within seconds (POST /api/admin/cards/cmd, or
// /api/admin/ops/do for a MODS switch). One poller picks up each answer; it shows on the page and as a toast.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { API } from "@/lib/constants";
import { C, MONO, BODY, DISPLAY, Btn, Note, Pill, Confirm, ago } from "../quests/ui";
import Overview from "./Overview";
import CardsTab from "./CardsTab";
import PlayersTab from "./PlayersTab";
import JobsTab from "./JobsTab";
import ShopTab from "./ShopTab";
import WearTab from "./WearTab";
import LogTab from "./LogTab";

const TABS = [["overview", "Overview"], ["cards", "Cards"], ["players", "Players"], ["jobs", "Jobs"], ["shop", "Shop"], ["wear", "Tool wear"], ["log", "Log"]];
const GIVE_UP = 10 * 60;               // seconds before a request shows as "no answer yet"

async function apiGet(path) {
  const r = await fetch(`${API}${path}`, { credentials: "include" });
  if (!r.ok) { const e = new Error(`${r.status}`); e.status = r.status; throw e; }
  return r.json();
}
async function apiPost(path, body) {
  const r = await fetch(`${API}${path}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let j = null;
  try { j = await r.json(); } catch {}
  if (!r.ok) { const e = new Error((j && (j.detail || j.message)) || `${r.status}`); e.status = r.status; throw e; }
  return j;
}
function readLocal(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }
function writeLocal(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

/** an optional endpoint: its data, or { missing: true } when the bot doesn't have it yet (404) */
async function optional(path) {
  try { return await apiGet(path); }
  catch (e) { return e.status === 404 ? { missing: true } : { error: e.message }; }
}

export default function CardsAdminApp() {
  const [data, setData] = useState(null);          // /api/admin/cards
  const [board, setBoard] = useState(null);        // /api/admin/ops/board
  const [jobs, setJobs] = useState(null);          // /api/admin/jobs
  const [shop, setShop] = useState(null);
  const [log, setLog] = useState(null);
  const [err, setErr] = useState("");
  const [authErr, setAuthErr] = useState(0);
  const [tab, setTabRaw] = useState("overview");
  const [pickCard, setPickCard] = useState("mechanic");
  const [pickPlayer, setPickPlayer] = useState("");
  const [mine, setMine] = useState([]);            // { id, kind: cards|ops, label, at, done, ok, msg }
  const [toasts, setToasts] = useState([]);
  const [asking, setAsking] = useState(null);
  const mineRef = useRef(mine);
  mineRef.current = mine;

  useEffect(() => {                                  // ?tab=players (a link straight to a tab), else the last tab used here
    const q = new URLSearchParams(window.location.search).get("tab");
    setTabRaw(TABS.some(([k]) => k === q) ? q : readLocal("soup:cardsadmin.tab", "overview"));
    setPickCard(readLocal("soup:cardsadmin.card", "mechanic"));
  }, []);
  const setTab = useCallback((t) => { setTabRaw(t); writeLocal("soup:cardsadmin.tab", t); window.scrollTo(0, 0); }, []);
  const goCard = useCallback((id) => { setPickCard(id); writeLocal("soup:cardsadmin.card", id); setTab("cards"); }, [setTab]);
  const goPlayer = useCallback((name) => { setPickPlayer(name); setTab("players"); }, [setTab]);
  const selectCard = useCallback((id) => { setPickCard(id); writeLocal("soup:cardsadmin.card", id); }, []);

  const toast = useCallback((msg, ok = true) => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-3), { id, msg, ok }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ok ? 6000 : 12000);
  }, []);

  // ── reading ──
  const load = useCallback(async () => {
    try { setData(await apiGet("/api/admin/cards")); setErr(""); setAuthErr(0); }
    catch (e) {
      if (e.status === 401 || e.status === 403) setAuthErr(e.status);
      else setErr(`Can't reach the server (${e.message}).`);
    }
  }, []);
  const loadBoard = useCallback(async () => { try { setBoard(await apiGet("/api/admin/ops/board")); } catch { setBoard((b) => b || { failed: true }); } }, []);
  const loadJobs = useCallback(async () => { try { setJobs(await apiGet("/api/admin/jobs")); } catch { setJobs((j) => j || { failed: true }); } }, []);
  const loadShop = useCallback(async () => setShop(await optional("/api/admin/cards/shop")), []);
  const loadLog = useCallback(async () => setLog(await optional("/api/admin/cards/log?limit=400")), []);

  const open = mine.some((m) => !m.done);
  useEffect(() => {
    if (authErr) return;
    load(); loadBoard();
    const t = setInterval(() => { load(); loadBoard(); }, open ? 4000 : 15000);
    return () => clearInterval(t);
  }, [load, loadBoard, open, authErr]);
  useEffect(() => {
    if (authErr || !["overview", "jobs"].includes(tab)) return;
    loadJobs();
    const t = setInterval(loadJobs, 20000);
    return () => clearInterval(t);
  }, [tab, loadJobs, authErr]);
  useEffect(() => { if (!authErr && tab === "shop" && !shop) loadShop(); }, [tab, shop, loadShop, authErr]);
  useEffect(() => {
    if (authErr || tab !== "log") return;
    loadLog();
    const t = setInterval(loadLog, 30000);
    return () => clearInterval(t);
  }, [tab, loadLog, authErr]);

  // ── one poller for every answer ──
  useEffect(() => {
    if (!open) return;
    const t = setInterval(async () => {
      for (const m of mineRef.current.filter((x) => !x.done).slice(0, 8)) {
        try {
          const a = await apiGet(m.kind === "ops" ? `/api/admin/ops/result/${m.id}` : `/api/admin/cards/requests/${m.id}`);
          if (a.done) {
            setMine((list) => list.map((x) => (x.id === m.id ? { ...x, done: true, ok: !!a.ok, msg: a.msg || "", end: Date.now() / 1000 } : x)));
            toast(`${m.label}: ${a.msg || (a.ok ? "done" : "failed")}`, !!a.ok);
            load(); loadBoard();
          } else if (Date.now() / 1000 - m.at > GIVE_UP) {
            setMine((list) => list.map((x) => (x.id === m.id ? { ...x, done: true, ok: false, msg: "No answer yet. Is the server up and someone online? It still runs when the game wakes." } : x)));
          }
        } catch {}
      }
    }, 2000);
    return () => clearInterval(t);
  }, [open, toast, load, loadBoard]);

  /** a cards request: setting / system / grant / revoke / points / job */
  const send = useCallback(async (cmd, args, label) => {
    try {
      const r = await apiPost("/api/admin/cards/cmd", { cmd, ...args });
      setMine((list) => [...list.slice(-60), { id: r.id, kind: "cards", label, at: Date.now() / 1000, done: false }]);
    } catch (e) { toast(`${label}: ${e.message}`, false); }
  }, [toast]);
  /** a Zombita Control switch (Live Ops' za_switch) */
  const sendSwitch = useCallback(async (id, on, label) => {
    try {
      const r = await apiPost("/api/admin/ops/do", { cmd: "za_switch", id, on });
      if (!r.queued) { toast(`${label}: ${r.msg || (r.ok ? "done" : "failed")}`, !!r.ok); loadBoard(); return; }
      setMine((list) => [...list.slice(-60), { id: r.id, kind: "ops", label, at: Date.now() / 1000, done: false }]);
    } catch (e) { toast(`${label}: ${e.message}`, false); }
  }, [toast, loadBoard]);
  /** ask first, then send. q = { title, text, yes, danger, word } */
  const ask = useCallback((q, run) => setAsking({ ...q, run }), []);

  const st = data?.state || {};
  const zc = board?.board?.mods?.cards || null;             // Zombita Control > CARDS (null = no board / older mod)
  const switches = board?.board?.switches || null;
  const pending = mine.filter((m) => !m.done);
  const recent = mine.filter((m) => m.done && Date.now() / 1000 - (m.end || 0) < 90).slice(-3);
  const x = { st, data, board, zc, switches, jobs, shop, log, loadShop, loadLog, send, sendSwitch, ask, goCard, goPlayer, setTab,
              pickCard, selectCard, pickPlayer, setPickPlayer, mine, busy: pending.length > 0 };

  let gate = null;
  if (authErr === 401) gate = <Gate text="Log in with Discord to use the Cards page." link={<a href={`${API}/auth/discord/login`} style={{ color: C.gold }}>Log in</a>} />;
  else if (authErr === 403) gate = <Gate text="The Cards page is for admins only." />;
  else if (!data && err) gate = <Gate text={err} />;
  else if (!data) gate = <Gate text="Loading..." />;
  else if (!data.ready) gate = <Gate text="No word from the game yet. It writes the cards state every couple of minutes while the server runs." />;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: BODY, overflowX: "hidden" }}>
      <style>{`
        .ca-two { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 16px; align-items: start; }
        .ca-pick { display: flex; flex-direction: column; gap: 6px; position: sticky; top: 110px; }
        .ca-half { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
        @media (max-width: 860px) {
          .ca-two, .ca-half { grid-template-columns: minmax(0, 1fr); }
          .ca-pick { flex-direction: row; flex-wrap: wrap; position: static; }
          .ca-pick > button { flex: 1 1 140px; }
          .ca-hide-narrow { display: none !important; }
        }
        .ca-row:hover { background: ${C.panel2}; }
      `}</style>
      <div style={{ borderBottom: `1px solid ${C.line}`, background: C.panel, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "10px 16px", display: "flex", alignItems: "center", gap: "8px 14px", flexWrap: "wrap" }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 30, letterSpacing: 3, color: C.gold, lineHeight: 1 }}>CARDS</div>
          <div style={{ fontFamily: BODY, fontSize: 12, color: C.dim }} className="ca-hide-narrow">Zombita's Cards: switches, players, points, jobs, shops</div>
          <span style={{ flex: 1 }} />
          {data?.ready && <Pill c={st.on ? C.green : C.red} title="The whole cards system (Zombita Control > MODS)">{st.on ? "system ON" : "system OFF"}</Pill>}
          {data?.ready && <Pill c={st.stale ? C.red : C.green} title="When the game last wrote the cards state">{st.stale ? "game quiet " : "game "}{ago(st.at)}</Pill>}
          {pending.length > 0 && <Pill c={C.orange}>{pending.length} waiting</Pill>}
          <Link href="/quests" style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>Quests</Link>
          <Link href="/ops" style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>Live Ops</Link>
          <Link href="/admin" style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>Admin</Link>
        </div>
        <nav style={{ maxWidth: 1400, margin: "0 auto", padding: "0 8px", display: "flex", flexWrap: "wrap" }}>
          {TABS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", padding: "10px 12px", cursor: "pointer", whiteSpace: "nowrap",
                background: "transparent", border: "none", borderBottom: `2px solid ${tab === k ? C.gold : "transparent"}`, color: tab === k ? C.gold : C.dim }}>
              {l}
            </button>
          ))}
        </nav>
      </div>

      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "16px" }}>
        {gate || (
          <>
            {st.stale && <Note c="red" style={{ marginBottom: 14, color: C.text }}>The game last reported {ago(st.at)}: the server may be down or restarting. Requests wait until it's back.</Note>}
            {err && <Note c="red" style={{ marginBottom: 14, color: C.text }}>{err} Showing the last state.</Note>}
            {(pending.length > 0 || recent.length > 0) && (
              <div style={{ background: C.panel, border: `1px solid ${pending.length ? C.orange : C.line}`, padding: "10px 14px", marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                {pending.map((m) => (
                  <div key={m.id} style={{ fontFamily: BODY, fontSize: 13, display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 5, background: C.orange, flexShrink: 0, animation: "pulse 1s infinite alternate" }} />
                    <span><b>{m.label}</b>: waiting for the game...</span>
                  </div>
                ))}
                {recent.map((m) => (
                  <div key={m.id} style={{ fontFamily: BODY, fontSize: 13, display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ color: m.ok ? C.green : C.red, fontFamily: MONO }}>{m.ok ? "✓" : "×"}</span>
                    <span><b>{m.label}</b>: {m.msg || (m.ok ? "done" : "failed")}</span>
                  </div>
                ))}
                <style>{`@keyframes pulse { from { opacity: 1 } to { opacity: .3 } }`}</style>
              </div>
            )}
            {tab === "overview" && <Overview {...x} />}
            {tab === "cards" && <CardsTab {...x} />}
            {tab === "players" && <PlayersTab {...x} />}
            {tab === "jobs" && <JobsTab {...x} />}
            {tab === "shop" && <ShopTab {...x} />}
            {tab === "wear" && <WearTab {...x} />}
            {tab === "log" && <LogTab {...x} />}
          </>
        )}
      </main>

      {asking && <Confirm title={asking.title} text={asking.text} yes={asking.yes || "Yes, send it"} danger={asking.danger} word={asking.word}
        onYes={() => asking.run()} onClose={() => setAsking(null)} />}

      <div style={{ position: "fixed", right: 16, bottom: 16, display: "flex", flexDirection: "column", gap: 8, zIndex: 300, maxWidth: "min(420px, calc(100vw - 32px))" }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ background: C.panel, border: `1px solid ${t.ok ? C.green : C.red}`, color: C.text, padding: "10px 14px", fontFamily: BODY, fontSize: 13, boxShadow: "0 4px 18px rgba(0,0,0,0.5)" }}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}

function Gate({ text, link = null }) {
  return (
    <div style={{ padding: "80px 20px", textAlign: "center" }}>
      <div style={{ fontFamily: BODY, fontSize: 15, color: C.dim }}>{text}</div>
      {link && <div style={{ marginTop: 14, fontFamily: MONO }}>{link}</div>}
    </div>
  );
}
