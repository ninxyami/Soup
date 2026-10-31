"use client";
// EVENT PHONE (2026-10-19). Opened from a QR in game: /p/?t=<token>. One token per team member, bound to this device
// by the API. The game owns every step; this page polls GET /api/th/me (3 s, not at all while hidden), shows the mini-game
// the step needs and sends the answer to POST /api/th/act, then shows "syncing..." until the game has reacted.
// Every story word (titles, next steps, hints, quotes, the start and end screens) comes from `me.text`: the site is
// public, so this code holds only neutral UI words. Without a valid token the page says "Nothing here." and nothing
// else (no frame, no picture). Dev only: /p/?t=mock-<step> runs on local fake answers (lib/th/mock.ts).
import { useCallback, useEffect, useRef, useState } from "react";
import "./th.css";
import PhoneShell from "@/components/th/PhoneShell";
import PatternLock from "@/components/th/PatternLock";
import SignalLock from "@/components/th/SignalLock";
import TornPhoto from "@/components/th/TornPhoto";
import SketchView from "@/components/th/SketchView";
import ScanMarker from "@/components/th/ScanMarker";
import CipherWheel from "@/components/th/CipherWheel";
import VialSort from "@/components/th/VialSort";
import LabWiring from "@/components/th/LabWiring";
import WaitView from "@/components/th/WaitView";
import HintCard from "@/components/th/HintCard";
import { useDuskScare } from "@/components/th/DuskScare";
import { DeadScreen, SelfDestruct, type EndText } from "@/components/th/SelfDestruct";
import { WEB_STEPS } from "@/components/th/steps";
import { ART } from "@/lib/th/art";
import { ThError, apiUrl, thAct, thImg, thMe, thResult } from "@/lib/th/client";
import type { ActAction, Me, Puzzle } from "@/lib/th/types";

const POLL_MS = 3000, BACKOFF_MAX_MS = 20000, SLOW_SYNC_MS = 20000;
const RETRY_MS = [1000, 2000, 3000, 5000, 8000]; // an answer that couldn't get through goes again after each of these
const canRetry = (e: ThError) => e.status === 0 || e.status >= 500 || (e.status === 429 && /slow down/i.test(e.message));

function attemptOf(p: Puzzle | null) {
  return p && "attempt" in p ? p.attempt : 0;
}

function store(key: string, value?: string) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch { /* private mode: the API still knows the phone is broken */ }
  return null;
}

// The link was opened on another device. Never a dead end: opening it here takes it back.
function Moved({ text }: { text: string }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "#0b0b0c", color: "#d8d4c8", display: "flex", flexDirection: "column", gap: 18, alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontSize: 17 }}>
      {text}
      <button onClick={() => window.location.reload()} style={{ padding: "12px 22px", borderRadius: 10, border: "1px solid #6a6a62", background: "#1c1c1a", color: "#f0ead8", fontSize: 16, cursor: "pointer" }}>Use it here</button>
    </div>
  );
}

// A plain page: no frame, no picture, no hint of what this is
function Plain({ text }: { text: string }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "#0b0b0c", color: "#8a8a8a", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif", fontSize: 16 }}>
      {text}
    </div>
  );
}

export default function EventPhone() {
  const [tok, setTok] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [fatal, setFatal] = useState<ThError | null>(null);
  const [offline, setOffline] = useState(false);
  const [gameDown, setGameDown] = useState(false);
  const [woke, setWoke] = useState(false);
  const [dead, setDead] = useState(false);
  const [deadText, setDeadText] = useState<EndText | null>(null);
  const [dying, setDying] = useState(false);
  // a command on its way: kept until /me shows the game moved on (a new step, or a new board after a fail)
  const [sync, setSync] = useState<{ id: string; from: string; at: number; kind: ActAction; attempt: number; okAt: number } | null>(null);
  const [slow, setSlow] = useState(false);
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [resend, setResend] = useState<{ action: ActAction; payload: Record<string, unknown> } | null>(null);
  const sendingRef = useRef(false);
  const backoff = useRef(0);
  const opened = useRef(false);
  const moved = useRef(false);
  const [flash, setFlash] = useState("");
  const [buzzing, setBuzzing] = useState(false);
  const [placeImg, setPlaceImg] = useState("");
  const offset = useRef(0);
  const meRef = useRef<Me | null>(null);
  const syncRef = useRef(sync);
  syncRef.current = sync;
  const mock = process.env.NODE_ENV !== "production" && !!tok?.startsWith("mock-");
  const scare = useDuskScare(me, tok, woke && !dead && !dying);

  useEffect(() => {
    const t = (new URLSearchParams(window.location.search).get("t") || "").trim();
    setTok(t);
    if (t && !t.startsWith("mock-")) {
      if (store(`th_dead_${t}`) === "1") {
        setDead(true);
        try { setDeadText(JSON.parse(store(`th_end_${t}`) || "null")); } catch { /* nothing kept */ }
      }
      if (store(`th_seen_${t}`) === "1") setWoke(true);
    }
    if (process.env.NODE_ENV !== "production" && t.startsWith("mock-") && !t.includes("-intro")) setWoke(true);
  }, []);

  const serverNow = useCallback(() => Date.now() / 1000 + offset.current, []);

  const load = useCallback(async () => {
    if (!tok) return;
    try {
      const m = await thMe(tok, !opened.current);
      opened.current = true;
      if (typeof m.now === "number") offset.current = m.now - Date.now() / 1000;
      const prev = meRef.current;
      if (prev && prev.step !== m.step && !syncRef.current && WEB_STEPS.has(prev.step)) setFlash("Someone on your team did it. On to the next part.");
      meRef.current = m;
      setMe(m);
      backoff.current = 0;
      setOffline(false);
      setGameDown(!!m.stale);
      setFatal(null);
      const s = syncRef.current;
      if (s && (m.step !== s.from || (s.kind === "fail" && attemptOf(m.puzzle) !== s.attempt))) { setSync(null); setSlow(false); }
    } catch (e) {
      const te = e as ThError;
      if (te.status === 403) moved.current = true;
      if (te.status === 403 || te.status === 404 || te.status === 401) setFatal(te);
      else if (te.status === 410) {
        // the API says this phone is broken: play the wipe if the app is on screen, else go straight to the end
        if (meRef.current) setDying(true);
        else { setDead(true); if (!tok.startsWith("mock-")) store(`th_dead_${tok}`, "1"); }
      }
      else if (te.status === 503) setGameDown(true);
      else if (te.status === 429) backoff.current = Math.min(BACKOFF_MAX_MS, (backoff.current || POLL_MS) * 2);
      else setOffline(true);
    }
  }, [tok]);

  // poll /me, and the pending command's result
  useEffect(() => {
    if (!tok || dead) return;
    // one poller per page: a tab coming back never starts a second one, and a hidden tab doesn't poll at all
    let alive = true, timer = 0, running = false;
    const loop = async () => {
      if (running || !alive || document.hidden || moved.current) return;
      running = true;
      const s = syncRef.current;
      if (s) {
        try {
          const r = s.okAt ? null : await thResult(tok, s.id);
          if (r && !(r.pending || r.done === false)) {
            if (r.ok === false) {
              if (r.msg && r.msg !== "stale" && r.msg !== "cap") setErr(r.msg);
              setSync(null); setSlow(false);
            } else setSync({ ...s, okAt: Date.now() });
          } else if (s.okAt && Date.now() - s.okAt > SLOW_SYNC_MS) { setSync(null); setSlow(false); }
          else if (Date.now() - s.at > SLOW_SYNC_MS) setSlow(true);
        } catch { /* keep the sync up, try again */ }
      }
      await load();
      running = false;
      if (alive && !moved.current) timer = window.setTimeout(loop, Math.max(POLL_MS, backoff.current));
    };
    loop();
    const vis = () => { if (!document.hidden) { clearTimeout(timer); loop(); } };
    document.addEventListener("visibilitychange", vis);
    return () => { alive = false; clearTimeout(timer); document.removeEventListener("visibilitychange", vis); };
  }, [tok, dead, load]);

  useEffect(() => { if (!flash) return; const id = setTimeout(() => setFlash(""), 3500); return () => clearTimeout(id); }, [flash]);

  // the buzz: when the API says the team is at the spot, the phone buzzes once and the card stays while they're there
  const buzz = !!me?.buzz && !!me.text?.buzz;
  useEffect(() => {
    if (!buzz) return;
    setBuzzing(true);
    try { navigator.vibrate?.([200, 100, 200, 100, 400]); } catch { /* no vibration on this phone */ }
    const id = setTimeout(() => setBuzzing(false), 1200);
    return () => clearTimeout(id);
  }, [buzz]);
  useEffect(() => { setErr(""); setPlaceImg(""); setResend(null); }, [me?.step]);
  useEffect(() => { if (!err) return; const id = setTimeout(() => setErr(""), 8000); return () => clearTimeout(id); }, [err]);

  // the end: done or broken plays the wipe once, then the phone stays ended for this token
  useEffect(() => {
    if (!me || dead || dying) return;
    if (me.step === "done" || me.step === "broken" || me.broken) setDying(true);
  }, [me, dead, dying]);
  const onDead = useCallback(() => {
    setDead(true);
    setDying(false);
    const end = meRef.current?.text?.end ?? null;
    setDeadText(end);
    if (tok && !tok.startsWith("mock-")) { store(`th_dead_${tok}`, "1"); store(`th_end_${tok}`, JSON.stringify(end)); }
  }, [tok]);

  // a wait step with a location picture (go_final): the API names it in the puzzle; the old contract used img/final
  useEffect(() => {
    if (!me || !tok || placeImg) return;
    const p = me.puzzle;
    if (p && p.game === "wait" && p.img) setPlaceImg(apiUrl(p.img));
    else if (me.step === "go_final") thImg(tok, "final").then(setPlaceImg);
  }, [me, tok, placeImg]);

  // An answer that can't get through goes again by itself, and the player is told. It's never `err`: games clear their
  // board on an error, and a solved board has to stay solved. If it still can't, "Send it again" sends the same answer.
  const act = useCallback(async (action: ActAction, payload: Record<string, unknown>) => {
    const m = meRef.current;
    if (!tok || !m || syncRef.current || sendingRef.current) return false;
    sendingRef.current = true;
    setSending(true);
    setErr("");
    setResend(null);
    try {
      for (let i = 0; ; i++) {
        try {
          const r = await thAct(tok, m.step, action, payload);
          setSync({ id: r.id ?? "", from: m.step, at: Date.now(), kind: action, attempt: attemptOf(m.puzzle), okAt: 0 });
          return true;
        } catch (e) {
          const te = e as ThError;
          if (!canRetry(te)) {
            setErr(te.message || "That didn't go through. Try again.");
            load();
            return false;
          }
          if (i >= RETRY_MS.length) {
            setResend({ action, payload });
            return false;
          }
          setRetrying(true);
          await new Promise(r => setTimeout(r, RETRY_MS[i]));
        }
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
      setRetrying(false);
    }
  }, [tok, load]);
  const solve = useCallback((p: Record<string, unknown>) => act("solve", p), [act]);
  const fail = useCallback((p: Record<string, unknown>) => act("fail", p), [act]);
  const scan = useCallback((text: string) => act("scan", { text }), [act]);

  // ── screens before the app: nothing about the event shows until the API knows the token ────────────────────────
  if (tok === null) return <Plain text="" />;
  if (!tok) return <Plain text="Nothing here." />;
  if (fatal) return fatal.status === 403 ? <Moved text={fatal.message} /> : <Plain text="Nothing here." />;
  if (dead) return <PhoneShell signal={0} battery={0} carrier=""><DeadScreen end={me?.text?.end ?? deadText} /></PhoneShell>;
  if (!me) return <Plain text={offline ? "No connection yet. This page keeps trying." : "Connecting..."} />;

  const tx = me.text ?? {};
  if (!woke) {
    return (
      <PhoneShell signal={1} carrier={tx.carrier}>
        <div className="th-full" style={{ justifyContent: "flex-start", paddingTop: "18%", backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.85) 10%, rgba(0,0,0,0.2) 60%, rgba(0,0,0,0.7)), url(${ART.start})`, backgroundSize: "cover", backgroundPosition: "center" }}>
          {tx.intro?.title && <h1>{tx.intro.title}</h1>}
          {tx.intro?.text && <p>{tx.intro.text}</p>}
          <div style={{ flex: 1 }} />
          <button className="th-btn big" onClick={() => { setWoke(true); if (!tok.startsWith("mock-")) store(`th_seen_${tok}`, "1"); }}>Wake the phone</button>
          <p style={{ fontSize: 12 }}>Keep this page open while you play. It updates by itself.</p>
        </div>
      </PhoneShell>
    );
  }

  // ── the app ───────────────────────────────────────────────────────────────────────────────────────────────────
  const pz = me.puzzle;
  const busy = !!sync || sending || !!resend;
  const gp = { busy, serverNow, onSolve: solve, onFail: fail, error: err };
  const attempt = attemptOf(pz);
  const webStep = WEB_STEPS.has(me.step);

  const game = (p: Puzzle | null) => {
    if (me.step === "scan") {
      const sk = p && p.game === "scan" && p.tiles && p.img ? { game: "sketch" as const, img: p.img, tiles: p.tiles } : null;
      return (
        <>
          <ScanMarker busy={busy} onScan={scan} error={err} />
          {sk && (
            <details>
              <summary className="th-note" style={{ cursor: "pointer", padding: "6px 0" }}>Show the sketch</summary>
              <SketchView puzzle={sk} arranging />
            </details>
          )}
        </>
      );
    }
    if (!p) return <WaitView step={me.step} />;
    switch (p.game) {
      case "pattern": return <PatternLock puzzle={p} {...gp} />;
      case "signal": return <SignalLock puzzle={p} flavor={tx.flavor} {...gp} />;
      case "photo": return <TornPhoto puzzle={p} {...gp} />;
      case "sketch": return <SketchView puzzle={p} arranging={me.step === "arrange"} />;
      case "scan": return <ScanMarker busy={busy} onScan={scan} error={err} />;
      case "cipher": return <CipherWheel puzzle={p} {...gp} />;
      case "vial": return <VialSort puzzle={p} {...gp} />;
      case "wiring": return <LabWiring puzzle={p} {...gp} />;
      default: return <WaitView step={me.step} ringing={me.step === "call" || me.step === "lastcall"} img={placeImg || undefined} quote={tx.quote ?? undefined} />;
    }
  };

  return (
    <PhoneShell signal={offline ? 0 : buzz ? 4 : 3} carrier={tx.carrier} shake={dying || buzzing}>
      <div className={`th-body${dying ? " th-glitch-anim" : ""}`}>
        <div className="th-head">
          <div>
            {tx.act && <div className="th-act">{tx.act}</div>}
            {tx.title && <div className="th-title">{tx.title}</div>}
          </div>
          <div className="th-chip">
            {me.test && <div className="th-test">TEST</div>}
            <div>{me.team_size === 1 ? "Solo" : `Team of ${me.team_size}`}</div>
            {me.team_size > 1 && <div>{me.members_here} in game</div>}
            {me.step === "mg2_game" && <div style={{ color: me.fails ? "#ff9a9a" : undefined }}>Hordes {me.fails} of {me.fail_cap}</div>}
          </div>
        </div>
        {buzz && tx.buzz && (
          <div className="th-buzz-card" role="status">
            <span className="th-buzz-icon" aria-hidden>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#5ff0ff" strokeWidth="1.6" strokeLinecap="round"><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2M3 9v6M21 9v6M5 7v10M19 7v10" /></svg>
            </span>
            <div>
              <div style={{ fontSize: 16, color: "#dffbff", fontWeight: 600 }}>{tx.buzz.title}</div>
              {tx.buzz.sub && <div className="th-next-s" style={{ color: "#9fd8e0" }}>{tx.buzz.sub}</div>}
            </div>
          </div>
        )}
        {tx.next && <div className="th-next">
          <div className="th-next-k">DO THIS NEXT</div>
          <div className="th-next-t">{tx.next}</div>
          {(tx.sub || (webStep && me.team_size > 1)) && (
            <div className="th-next-s">{tx.sub}{webStep && me.team_size > 1 ? `${tx.sub ? " " : ""}Anyone on your team can do it: the first one to finish moves everyone on.` : ""}</div>
          )}
        </div>}
        {tx.hint && <HintCard text={tx.hint.text} img={tx.hint.img ? apiUrl(tx.hint.img) : undefined} />}
        {gameDown && !offline && <div className="th-err" style={{ background: "rgba(40,30,10,0.9)", borderColor: "#6a5520", color: "#e8d49a" }}>The game isn&apos;t answering right now. Hang on, this page keeps trying.</div>}
        {offline && <div className="th-err" style={{ background: "rgba(40,30,10,0.9)", borderColor: "#6a5520", color: "#e8d49a" }}>Lost the connection. This page keeps trying.</div>}
        {flash && <div className="th-err" style={{ background: "rgba(14,40,24,0.92)", borderColor: "#2c6a44", color: "#bdf0cf" }}>{flash}</div>}
        {retrying && <div className="th-err" role="status" style={{ background: "rgba(40,30,10,0.9)", borderColor: "#6a5520", color: "#e8d49a" }}>Your answer is safe. Still sending it to the game...</div>}
        {resend && (
          <div className="th-err" role="alert">
            Your answer didn&apos;t reach the game. Nothing is lost.
            <button className="th-btn big" style={{ width: "100%", marginTop: 8 }} onClick={() => act(resend.action, resend.payload)}>Send it again</button>
          </div>
        )}
        {err && <div className="th-err" role="alert">{err}</div>}
        <div className="th-game" key={`${me.step}-${attempt}`}>{game(pz)}</div>
      </div>
      {sync && (
        <div className="th-sync" role="status" style={mock ? { bottom: 64 } : undefined}><span className="th-dot" />{slow ? "still waiting for the game..." : "syncing..."}</div>
      )}
      {dying && <SelfDestruct onDone={onDead} />}
      {scare}
      {mock && <DevBar tok={tok} step={me.step} reload={load} />}
    </PhoneShell>
  );
}

// Dev only (mock tokens): move the in-game steps on and jump between screens
function DevBar({ tok, step, reload }: { tok: string; step: string; reload: () => void }) {
  // the whole body sits in this branch so the production build drops it, mock import included
  if (process.env.NODE_ENV !== "production") {
    const go = (s: string) => { window.location.search = `?t=mock-${s}`; };
    return (
    <div className="th-dev">
      <span>MOCK {step}</span>
      <button onClick={async () => { const m = await import("@/lib/th/mock"); m.mockGameStep(tok); reload(); }}>game moves on</button>
      <button onClick={async () => { const m = await import("@/lib/th/mock"); m.mockScare(tok); reload(); }}>Dusk</button>
      <button onClick={async () => { const m = await import("@/lib/th/mock"); m.mockMoved(tok); reload(); }}>Move away</button>
      {step === "go_final" && <button onClick={async () => { const m = await import("@/lib/th/mock"); m.mockToggleBuzz(tok); reload(); }}>buzz on/off</button>}
      <select value="" onChange={e => e.target.value && go(e.target.value)} style={{ background: "#2c1840", color: "#ead8fb", border: "1px solid #6b3f8f", font: "inherit" }}>
        <option value="">jump to...</option>
        {["linking", "call", "unlock", "mg1_signal", "mg1_photo", "go_loc2", "arrange", "scan", "code_horde", "mg2_cipher", "mg2_game", "mg2_game-wiring", "go_final", "go_final-buzz", "finale", "lastcall", "done", "unlock-test-solo", "unlock-intro", "notmine", "nothing"].map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <span style={{ opacity: 0.75 }}>answers: see lib/th/mock.ts</span>
    </div>
    );
  }
  return null;
}
