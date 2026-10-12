// @ts-nocheck
"use client";
// components/quests/QuestsApp.tsx: the /quests page (Nin 2026-10-12: "a separate page like ops, do all the quest control
// there ... not clustered with templates ... readable and easily updatable").
//
// The game owns the quests. This page reads the game's admin state (GET /api/admin/jobs, which the game rewrites every
// 30 s and right after every change) and sends REQUESTS (POST /api/admin/jobs/cmd) that the game runs within a few
// seconds while someone is online. Each request's answer is picked up by one shared poller and shown as a toast and in
// the Log. Nothing is changed here directly.
//
// ?demo=1 on a local dev server (npm run dev) shows made-up data built from the v2 preview file, to check the layout
// without logging in. It is never in the built site.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { API } from "@/lib/constants";
import { C, MONO, BODY, DISPLAY, Btn, Note, Pill, ago, fmt } from "./ui";
import Board from "./Board";
import Rewards from "./Rewards";
import Types from "./Types";
import PayRanks from "./PayRanks";
import { Give, Log } from "./GiveLog";

const TABS = [
  ["board", "Board"], ["rewards", "Rewards"], ["types", "Job types"], ["pay", "Pay & ranks"], ["give", "Give a quest"], ["log", "Log"],
];
const BAD_KEYS = ["by", "now", "lua_dir"];          // the bot's own parameter names: never send them as arguments
const ANSWER_GIVE_UP = 15 * 60;                     // seconds before a request is shown as "no answer yet"

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

export default function QuestsApp() {
  const [data, setData] = useState(null);           // { state, waiting, log, specials, ious }
  const [err, setErr] = useState("");
  const [authErr, setAuthErr] = useState(0);         // 401 / 403
  const [tab, setTabRaw] = useState("board");
  const [source, setSourceRaw] = useState("game");
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [mine, setMine] = useState([]);              // requests sent from this page: { id, label, at, done, ok, msg }
  const [toasts, setToasts] = useState([]);
  const [demo] = useState(() => process.env.NODE_ENV !== "production" && typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("demo") === "1");
  const mineRef = useRef(mine);
  mineRef.current = mine;

  useEffect(() => {
    setTabRaw(readLocal("soup:quests.tab", "board"));
    setSourceRaw(readLocal("soup:quests.source", "game"));
  }, []);
  const setTab = (t) => { setTabRaw(t); writeLocal("soup:quests.tab", t); window.scrollTo(0, 0); };
  const setSource = (s) => { setSourceRaw(s); writeLocal("soup:quests.source", s); };

  const toast = useCallback((msg, ok = true) => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-4), { id, msg, ok }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ok ? 5000 : 10000);
  }, []);

  // the v2 set (the "New set" view, and the labels on the game's templates)
  useEffect(() => {
    fetch("/quest-rewards-v2-preview.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then(setPreview)
      .catch((e) => setPreviewError(e.message === "404" ? "the preview file isn't on the site" : e.message));
  }, []);

  // the game's state
  const load = useCallback(async () => {
    if (demo) return;
    try { const d = await apiGet("/api/admin/jobs"); setData(d); setErr(""); setAuthErr(0); }
    catch (e) {
      if (e.status === 401 || e.status === 403) setAuthErr(e.status);
      else setErr(`Can't reach the server (${e.message}).`);
    }
  }, [demo]);
  useEffect(() => {
    if (!demo) return;
    import("./demo").then((m) => { if (preview) { setData(m.demoData(preview)); setErr(""); setAuthErr(0); } });
  }, [demo, preview]);

  const anyMine = mine.some((m) => !m.done);
  const waitingN = data?.waiting?.length || 0;
  useEffect(() => {
    if (demo || authErr) return;
    load();
    const every = anyMine || waitingN > 0 ? 5000 : 15000;
    const t = setInterval(load, every);
    return () => clearInterval(t);
  }, [load, anyMine, waitingN > 0, authErr, demo]);   // eslint-disable-line

  // one poller for every request's answer
  useEffect(() => {
    if (!anyMine || demo) return;
    const t = setInterval(async () => {
      const open = mineRef.current.filter((m) => !m.done).slice(0, 8);
      for (const m of open) {
        try {
          const a = await apiGet(`/api/admin/jobs/requests/${m.id}`);
          if (a.done) {
            setMine((list) => list.map((x) => (x.id === m.id ? { ...x, done: true, ok: !!a.ok, msg: a.msg || "" } : x)));
            toast(`${m.label}: ${a.msg || (a.ok ? "done" : "failed")}`, !!a.ok);
            load();
          } else if (Date.now() / 1000 - m.at > ANSWER_GIVE_UP) {
            setMine((list) => list.map((x) => (x.id === m.id ? { ...x, done: true, ok: false, msg: "No answer yet. Is anyone online? It still runs when someone joins." } : x)));
          }
        } catch {}
      }
    }, 3000);
    return () => clearInterval(t);
  }, [anyMine, demo, load, toast]);

  /** Ask the game to do something. label = what the toast and the Log call it. */
  const send = useCallback(async (cmd, args = {}, label = cmd) => {
    const body = { cmd };
    for (const [k, v] of Object.entries(args || {})) if (!BAD_KEYS.includes(k)) body[k] = v;
    if (demo) { toast(`(demo) ${label}`); return null; }
    try {
      const r = await apiPost("/api/admin/jobs/cmd", body);
      setMine((list) => [...list.slice(-80), { id: r.id, label, at: Date.now() / 1000, done: false }]);
      toast(`Sent: ${label}. The game runs it in a few seconds.`);
      load();
      return r.id;
    } catch (e) {
      toast(`${label}: ${e.message}`, false);
      return null;
    }
  }, [demo, load, toast]);

  const state = data?.state;
  const pendingMine = mine.filter((m) => !m.done).length;

  // ── screens before the page itself ──
  let body = null;
  if (authErr === 401) body = <Gate text="Log in with Discord to use the quest page." link={<a href={`${API}/auth/discord/login`} style={{ color: C.gold }}>Log in</a>} />;
  else if (authErr === 403) body = <Gate text="The quest page is for admins only." />;
  else if (!data && err) body = <Gate text={err} />;
  else if (!data) body = <Gate text="Loading..." />;
  else if (!state) body = <Gate text="No word from the game yet. It writes its quest state while the server runs (mod 1.7.94 or newer)." />;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: BODY }}>
      <style>{`
        @media (max-width: 900px) {
          .q-rewards-grid { grid-template-columns: 1fr !important; }
          .q-rewards-grid > div:first-child { position: static !important; max-height: 340px !important; }
        }
      `}</style>
      {/* top bar */}
      <div style={{ borderBottom: `1px solid ${C.line}`, background: C.panel, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "10px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 30, letterSpacing: 3, color: C.gold, lineHeight: 1 }}>QUESTS</div>
          <div style={{ fontFamily: BODY, fontSize: 12, color: C.dim }}>Zombita's Jobs: the board, rewards, types, pay and ranks</div>
          <span style={{ flex: 1 }} />
          {demo && <Pill c={C.purple}>demo data</Pill>}
          {state && <Pill c={state.stale ? C.red : C.green} title="When the game last wrote its quest state">{state.stale ? "game quiet " : "game "}{ago(state.at)}</Pill>}
          {waitingN > 0 && <Pill c={C.orange} title="Requests the game hasn't run yet">{fmt(waitingN)} waiting</Pill>}
          {pendingMine > 0 && <Pill c={C.blue}>{pendingMine} of yours</Pill>}
          <Link href="/ops" style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>Live Ops</Link>
          <Link href="/admin" style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>Admin panel</Link>
        </div>
        <nav style={{ maxWidth: 1400, margin: "0 auto", padding: "0 20px", display: "flex", gap: 2, overflowX: "auto" }}>
          {TABS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", padding: "10px 16px", cursor: "pointer", whiteSpace: "nowrap",
                background: "transparent", border: "none", borderBottom: `2px solid ${tab === k ? C.gold : "transparent"}`, color: tab === k ? C.gold : C.dim }}>
              {l}
            </button>
          ))}
        </nav>
      </div>

      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "20px" }}>
        {body || (
          <>
            {state.stale && <Note c="red" style={{ marginBottom: 16, color: C.text }}>The game last reported {ago(state.at)}: the server may be down, restarting or empty. Requests wait until it's back and someone is online.</Note>}
            {err && <Note c="red" style={{ marginBottom: 16, color: C.text }}>{err} Showing the last state.</Note>}
            {tab === "board" && <Board state={state} send={send} />}
            {tab === "rewards" && <Rewards state={state} waiting={data.waiting} send={send} apiGet={apiGet} preview={preview} previewError={previewError} source={source} setSource={setSource} />}
            {tab === "types" && <Types state={state} send={send} />}
            {tab === "pay" && <PayRanks state={state} send={send} />}
            {tab === "give" && <Give state={state} send={send} apiGet={apiGet} />}
            {tab === "log" && <Log data={data} mine={mine} />}
          </>
        )}
      </main>

      {/* toasts */}
      <div style={{ position: "fixed", right: 16, bottom: 16, display: "flex", flexDirection: "column", gap: 8, zIndex: 300, maxWidth: "min(420px, calc(100vw - 32px))" }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ background: C.panel, border: `1px solid ${t.ok ? C.green : C.red}`, color: C.text, padding: "10px 14px", fontFamily: BODY, fontSize: 13, boxShadow: "0 4px 18px rgba(0,0,0,0.5)" }}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}

function Gate({ text, link }) {
  return (
    <div style={{ padding: "80px 20px", textAlign: "center" }}>
      <div style={{ fontFamily: BODY, fontSize: 15, color: C.dim }}>{text}</div>
      {link && <div style={{ marginTop: 14, fontFamily: MONO }}>{link}</div>}
    </div>
  );
}
