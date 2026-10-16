"use client";
// QUIZARIUM ON THE WEBSITE (2026-10-16, quiz_web_patch.py on the bot): Daily Challenge, Survival Run, Blitz, async duels,
// the daily and weekly boards. Logged in with Discord (the soup_session cookie). The bot keeps every answer and times
// every answer itself: this page only ever gets the question and its four options.
// Data: GET /api/quiz/boards, /api/quiz/me, /api/quiz/run/{run}, /api/quiz/duel/{id}, /api/quiz/daily/{day}, /api/quiz/players
//       POST /api/quiz/start, /next, /answer, /quit, /duel, /duel/{id}/accept, /duel/{id}/decline
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { API } from "@/lib/constants";

type Mode = "daily" | "survival" | "blitz" | "duel";
interface Question { n: number; text: string; options: string[]; difficulty: string; category: string; limit: number; time_left: number }
interface ReviewRow { text: string; options: string[]; answer: number; choice: number; ok: boolean; points: number; their_choice?: number }
interface RunState {
  run: string; mode: Mode; label: string; day: string; answered: number; total: number | null; score: number; right: number;
  wrong: number; streak: number; best_streak: number; finished: boolean; duel: string | null; prize: number;
  question: Question | null; lives?: number; multiplier?: number; seconds?: number; time_left?: number; review?: ReviewRow[];
}
interface Result { ok: boolean; late?: boolean; points: number; answer?: number; choice: number }
interface BoardRow { place: number; name: string; score: number; right?: number; seconds?: number; prize?: number }
interface Duel {
  id: string; status: string; creator: string; opponent: string | null; open: boolean; mine: boolean; expires_in: number;
  creator_score: number | null; opponent_score: number | null; winner: string | null; prize: number; my_run?: string; review?: ReviewRow[];
}
interface Prizes { daily_per_right: number; daily_top: number[]; duel_win: number }
interface Me {
  logged: boolean; id?: string; name?: string; today?: string;
  daily?: { state: "new" | "playing" | "done"; run?: string; score?: number; right?: number; answered?: number; place?: number; players?: number; prize?: number };
  active?: { survival?: string; blitz?: string }; best?: { survival: number; blitz: number };
  duels?: { for_you: Duel[]; sent: Duel[]; finished: Duel[] }; duels_left?: number; prizes?: Prizes;
}
interface Boards {
  today: string; resets_in: number; daily: BoardRow[]; yesterday: { day: string; top: BoardRow[] }; weekly: BoardRow[];
  survival: BoardRow[]; blitz: BoardRow[]; prizes: Prizes;
}

const BLUE = "#4a8fc4", GREEN = "#4caf7d", RED = "#e05555", GOLD = "#c8a84b";
const LETTERS = ["A", "B", "C", "D"];
const DIFF_COLOR: Record<string, string> = { easy: GREEN, medium: GOLD, hard: RED };
const RIGHT_LINES = ["Right.", "That's the one.", "Yep.", "Got it."];
const WRONG_LINES = ["Not that one.", "Nope.", "Wrong one.", "No."];
const LATE_LINES = ["Time's up.", "Too slow.", "The clock ran out."];

function money(b: number) {
  const v = Math.max(0, Math.round(Number(b) || 0));
  const s = Math.floor(v / 1000), r = v % 1000;
  const parts: string[] = [];
  if (s) parts.push(`${s.toLocaleString("en-US")} silver`);
  if (r || !parts.length) parts.push(`${r} bronze`);
  return parts.join(" ");
}

function pick(lines: string[]) {
  return lines[Math.floor(Math.random() * lines.length)];
}

function hm(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

async function call(path: string, body?: any) {
  const res = await fetch(`${API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const msg = typeof data?.detail === "string" ? data.detail : res.status === 404 ? "Not found." : `Something went wrong (${res.status}).`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return data;
}

// ── small pieces ─────────────────────────────────────────────────────────────────────────────────────────────────────

function Card({ children, color = BLUE, className = "" }: { children: React.ReactNode; color?: string; className?: string }) {
  return (
    <div className={`bg-[#0d1117] border border-[#1e2530] p-4 ${className}`} style={{ borderTop: `3px solid ${color}` }}>
      {children}
    </div>
  );
}

function Label({ children, color = "#8a8f98" }: { children: React.ReactNode; color?: string }) {
  return <div className="font-mono text-[0.68rem] uppercase tracking-widest mb-2" style={{ color }}>{children}</div>;
}

function Btn({ children, onClick, color = BLUE, disabled = false, small = false }:
  { children: React.ReactNode; onClick?: () => void; color?: string; disabled?: boolean; small?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`font-mono uppercase tracking-widest border cursor-pointer transition-all disabled:opacity-40 disabled:cursor-default ${small ? "text-[0.62rem] px-2 py-1" : "text-[0.72rem] px-4 py-2"}`}
      style={{ borderColor: color, color, background: "transparent" }}>
      {children}
    </button>
  );
}

function Board({ rows, empty, showRight = false, me }: { rows: BoardRow[]; empty: string; showRight?: boolean; me?: string }) {
  if (!rows.length) return <p className="text-[#8a8f98] text-[0.85rem] italic">{empty}</p>;
  return (
    <table className="w-full text-[0.85rem]">
      <tbody>
        {rows.map((r) => (
          <tr key={r.place + r.name} className="border-b border-[#161b22]" style={{ color: r.name === me ? BLUE : "#c9ced6" }}>
            <td className="py-1.5 w-8 font-mono text-[#8a8f98]">{r.place <= 3 ? ["🥇", "🥈", "🥉"][r.place - 1] : r.place}</td>
            <td className="py-1.5">{r.name}</td>
            {showRight && <td className="py-1.5 text-right font-mono text-[#8a8f98] hidden sm:table-cell">{r.right}/10</td>}
            <td className="py-1.5 text-right font-mono">{r.score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Review({ rows, theirs }: { rows: ReviewRow[]; theirs?: string }) {
  return (
    <ol className="list-none p-0 m-0 space-y-3">
      {rows.map((r, i) => (
        <li key={i} className="border border-[#1e2530] p-3 text-[0.85rem]">
          <div className="text-[#e6e8ec] mb-2">{i + 1}. {r.text}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {r.options.map((o, j) => {
              const right = j === r.answer, mine = j === r.choice;
              return (
                <div key={j} className="px-2 py-1 font-mono text-[0.78rem]"
                  style={{ color: right ? GREEN : mine ? RED : "#8a8f98", border: `1px solid ${right ? GREEN + "66" : mine ? RED + "66" : "#1e2530"}` }}>
                  {LETTERS[j]}. {o}{mine ? " (you)" : ""}{theirs && r.their_choice === j ? ` (${theirs})` : ""}
                </div>
              );
            })}
          </div>
          <div className="font-mono text-[0.7rem] mt-1" style={{ color: r.ok ? GREEN : "#8a8f98" }}>
            {r.ok ? `+${r.points}` : r.choice < 0 ? "no answer" : "0"}
          </div>
        </li>
      ))}
    </ol>
  );
}

// ── the game screen ──────────────────────────────────────────────────────────────────────────────────────────────────

function Play({ start, onDone, onLeave }: { start: RunState; onDone: () => void; onLeave: () => void }) {
  const [st, setSt] = useState<RunState>(start);
  const [result, setResult] = useState<Result | null>(null);
  const [line, setLine] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(Date.now());
  const qDeadline = useRef(0);
  const blitzDeadline = useRef(0);
  const shownFor = useRef("");
  const lastQ = useRef<Question | null>(null);

  const apply = useCallback((s: RunState) => {
    setSt(s);
    if (s.question) {
      const key = `${s.run}:${s.question.n}`;
      if (shownFor.current !== key) {
        shownFor.current = key;
        qDeadline.current = Date.now() + s.question.time_left * 1000;
      }
    }
    if (s.mode === "blitz" && typeof s.time_left === "number" && s.answered + (s.question ? 1 : 0) > 0) {
      blitzDeadline.current = Date.now() + s.time_left * 1000;
    }
    if (s.finished) onDone();
  }, [onDone]);

  useEffect(() => { apply(start); }, [start, apply]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  const next = useCallback(async () => {
    setBusy(true); setErr(""); setResult(null); setLine("");
    try { apply(await call("/api/quiz/next", { run: st.run })); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }, [st.run, apply]);

  const answer = useCallback(async (choice: number) => {
    if (busy || !st.question || (result && st.mode !== "blitz")) return;
    lastQ.current = st.question;
    setBusy(true); setErr("");
    try {
      const d = await call("/api/quiz/answer", { run: st.run, choice });
      const r: Result | null = d.result;
      if (r) {
        setResult(r);
        setLine(r.ok ? pick(RIGHT_LINES) : r.late ? pick(LATE_LINES) : pick(WRONG_LINES));
      }
      if (d.state.mode === "blitz" && !d.state.finished) {
        setTimeout(() => { setResult(null); setLine(""); }, 450);
      }
      apply(d.state);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }, [busy, st.question, st.run, st.mode, result, apply]);

  // the clock ran out here: ask the server, which records the timeout itself
  const qLeft = st.question ? Math.max(0, (qDeadline.current - now) / 1000) : 0;
  const bLeft = st.mode === "blitz" && blitzDeadline.current ? Math.max(0, (blitzDeadline.current - now) / 1000) : null;
  const timedOut = useRef("");
  useEffect(() => {
    if (!st.question || result || busy) return;
    const out = qDeadline.current - now < -1700 || (bLeft !== null && blitzDeadline.current - now < -1700);
    const key = `${st.run}:${st.question.n}`;
    if (out && timedOut.current !== key) {
      timedOut.current = key;
      call(`/api/quiz/run/${st.run}`).then((s: RunState) => {
        setResult({ ok: false, late: true, points: 0, choice: -1 });
        setLine(pick(LATE_LINES));
        apply(s);
        if (s.mode === "blitz" && !s.finished) {
          setTimeout(() => { setResult(null); setLine(""); }, 450);
          if (!s.question) call("/api/quiz/next", { run: s.run }).then(apply).catch((e) => setErr(e.message));
        }
      }).catch((e) => setErr(e.message));
    }
  }, [now, st.question, st.run, result, busy, bLeft, apply]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (st.question && (!result || st.mode === "blitz") && ["1", "2", "3", "4"].includes(e.key)) answer(Number(e.key) - 1);
      else if (e.key === "Enter" && !st.question && !st.finished && !busy) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [st.question, st.finished, st.mode, result, busy, answer, next]);

  const quit = async () => {
    if (!confirm(st.mode === "daily" ? "Stop here? The questions you haven't answered count as wrong, and there's only one Daily a day." : "Stop here? Your score so far stands.")) return;
    try { apply(await call("/api/quiz/quit", { run: st.run })); } catch (e: any) { setErr(e.message); }
  };

  const q = st.question;
  const reveal = st.mode === "survival" || st.mode === "blitz";
  const showQ = q && !(result && st.mode !== "blitz");
  const last = result && !q ? result : result && st.mode !== "blitz" ? result : null;

  return (
    <Card color={BLUE} className="mb-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-4">
        <b className="text-[#e6e8ec] text-[1.05rem]">{st.label}</b>
        <span className="font-mono text-[0.75rem] text-[#8a8f98]">score <b className="text-[#e6e8ec]">{st.score}</b></span>
        {st.total && <span className="font-mono text-[0.75rem] text-[#8a8f98]">question {Math.min(st.total, st.answered + (q ? 1 : 0)) || 1} of {st.total}</span>}
        {st.mode === "survival" && (
          <span className="font-mono text-[0.75rem]" style={{ color: RED }}>{"♥".repeat(st.lives ?? 0)}<span className="text-[#333]">{"♥".repeat(3 - (st.lives ?? 0))}</span></span>
        )}
        {st.mode === "survival" && (st.multiplier ?? 1) > 1 && <span className="font-mono text-[0.75rem]" style={{ color: GOLD }}>x{st.multiplier}</span>}
        {st.streak >= 3 && <span className="font-mono text-[0.75rem]" style={{ color: GOLD }}>{st.streak} in a row</span>}
        {bLeft !== null && <span className="font-mono text-[0.9rem] ml-auto" style={{ color: bLeft < 10 ? RED : GOLD }}>{Math.ceil(bLeft)}s</span>}
      </div>

      {showQ && q && (
        <div>
          <div className="flex gap-3 mb-2 font-mono text-[0.68rem] uppercase tracking-widest">
            <span className="text-[#8a8f98]">{q.category}</span>
            <span style={{ color: DIFF_COLOR[q.difficulty] || "#8a8f98" }}>{q.difficulty}</span>
          </div>
          <div className="h-1 bg-[#161b22] mb-4">
            <div className="h-1 transition-[width] duration-100" style={{ width: `${Math.min(100, (qLeft / q.limit) * 100)}%`, background: qLeft < 5 ? RED : BLUE }} />
          </div>
          <p className="text-[#e6e8ec] text-[1.05rem] leading-relaxed mb-4">{q.text}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {q.options.map((o, i) => (
              <button key={i} onClick={() => answer(i)} disabled={busy || (!!result && st.mode !== "blitz")}
                className="text-left px-3 py-3 border border-[#2a3340] bg-[#0a0d10] text-[#e6e8ec] text-[0.9rem] cursor-pointer hover:border-[#4a8fc4] transition-colors disabled:cursor-default">
                <span className="font-mono text-[#8a8f98] mr-2">{LETTERS[i]}</span>{o}
              </button>
            ))}
          </div>
          {st.mode === "blitz" && line && (
            <p className="font-mono text-[0.8rem] mt-3" style={{ color: result?.ok ? GREEN : RED }}>{line} {result?.ok ? `+${result.points}` : ""}</p>
          )}
        </div>
      )}

      {last && st.mode !== "blitz" && (
        <div className="mb-4">
          <p className="text-[1.05rem] font-semibold m-0" style={{ color: last.ok ? GREEN : RED }}>
            {line} {last.ok ? <span className="font-mono">+{last.points}</span> : null}
          </p>
          {reveal && typeof last.answer === "number" && !last.ok && lastQ.current && (
            <p className="text-[0.85rem] text-[#8a8f98] mt-1">It was <b className="text-[#e6e8ec]">{lastQ.current.options[last.answer]}</b>.</p>
          )}
          {!reveal && !st.finished && <p className="text-[0.8rem] text-[#8a8f98] mt-1">The right answers show {st.mode === "daily" ? "tomorrow" : "once you've both played"}.</p>}
        </div>
      )}

      {!q && !st.finished && (
        <div className="flex gap-3 items-center">
          <Btn onClick={next} disabled={busy}>{st.answered === 0 ? "Start" : "Next question"}</Btn>
          {st.answered === 0 && <span className="text-[0.8rem] text-[#8a8f98]">
            {st.mode === "blitz" ? "60 seconds start with the first question." : "Each question has 20 seconds. The faster you answer, the more it's worth."}
          </span>}
        </div>
      )}

      {err && <p className="text-[0.82rem] mt-3" style={{ color: RED }}>{err}</p>}

      <div className="flex justify-between mt-5 pt-3 border-t border-[#161b22]">
        <span className="font-mono text-[0.62rem] text-[#555] uppercase tracking-widest">keys 1 to 4 answer, Enter goes on</span>
        <div className="flex gap-3">
          {!st.finished && <button onClick={quit} className="font-mono text-[0.62rem] uppercase tracking-widest text-[#555] hover:text-[#e05555] bg-transparent border-0 cursor-pointer">give up</button>}
          <button onClick={onLeave} className="font-mono text-[0.62rem] uppercase tracking-widest text-[#555] hover:text-[#e6e8ec] bg-transparent border-0 cursor-pointer">back</button>
        </div>
      </div>
    </Card>
  );
}

function Finished({ st, me, onBack }: { st: RunState; me: Me | null; onBack: () => void }) {
  const [copied, setCopied] = useState(false);
  const duelLink = st.duel ? `${typeof window !== "undefined" ? window.location.origin : ""}/quiz?duel=${st.duel}` : "";
  const sentDuel = st.mode === "duel" && me?.duels?.sent.find((d) => d.id === st.duel);
  const doneDuel = st.mode === "duel" && me?.duels?.finished.find((d) => d.id === st.duel);
  return (
    <Card color={GREEN} className="mb-6">
      <Label color={GREEN}>{st.label}: done</Label>
      <div className="flex flex-wrap gap-x-6 gap-y-1 items-baseline mb-3">
        <span className="text-[2rem] text-[#e6e8ec] font-semibold">{st.score}</span>
        <span className="font-mono text-[0.8rem] text-[#8a8f98]">{st.right} right of {st.answered} · best streak {st.best_streak}</span>
        {st.prize > 0 && <span className="font-mono text-[0.8rem]" style={{ color: GOLD }}>won {money(st.prize)}</span>}
      </div>
      {st.mode === "daily" && me?.daily?.place && (
        <p className="text-[0.88rem] text-[#aab1bc]">You&apos;re <b className="text-[#e6e8ec]">#{me.daily.place}</b> of {me.daily.players} today. The answers show tomorrow. Come back for a new Daily after midnight UTC.</p>
      )}
      {st.mode === "survival" && me?.best && (
        <p className="text-[0.88rem] text-[#aab1bc]">{st.score >= me.best.survival ? "That's your best run yet." : `Your best is ${me.best.survival}.`}</p>
      )}
      {st.mode === "blitz" && me?.best && (
        <p className="text-[0.88rem] text-[#aab1bc]">{st.score >= me.best.blitz ? "That's your best Blitz yet." : `Your best is ${me.best.blitz}.`}</p>
      )}
      {sentDuel && (
        <div className="text-[0.88rem] text-[#aab1bc]">
          {sentDuel.open ? (
            <>
              <p className="mb-2">Your round is in. Send this link to whoever you want to duel. The first one to take it plays your 10 questions.</p>
              <div className="flex gap-2 items-center flex-wrap">
                <code className="text-[0.78rem] bg-[#0a0d10] border border-[#1e2530] px-2 py-1 text-[#e6e8ec] break-all">{duelLink}</code>
                <Btn small onClick={() => { navigator.clipboard?.writeText(duelLink); setCopied(true); }}>{copied ? "copied" : "copy"}</Btn>
              </div>
            </>
          ) : <p>Your round is in. Now it&apos;s {sentDuel.opponent}&apos;s turn. You&apos;ll see who won here.</p>}
        </div>
      )}
      {doneDuel && (
        <p className="text-[0.95rem]" style={{ color: doneDuel.winner === me?.name ? GREEN : doneDuel.winner ? RED : GOLD }}>
          {doneDuel.winner ? `${doneDuel.winner} wins` : "A draw"}: {doneDuel.creator} {doneDuel.creator_score} · {doneDuel.opponent} {doneDuel.opponent_score}
          {doneDuel.prize > 0 && doneDuel.winner === me?.name ? ` · you won ${money(doneDuel.prize)}` : ""}
        </p>
      )}
      {st.review && st.review.length > 0 && (
        <details className="mt-3">
          <summary className="font-mono text-[0.7rem] uppercase tracking-widest text-[#8a8f98] cursor-pointer">your answers</summary>
          <div className="mt-3"><Review rows={st.review} /></div>
        </details>
      )}
      <div className="mt-4"><Btn onClick={onBack} color={GREEN}>Back to Quizarium</Btn></div>
    </Card>
  );
}

// ── duels ────────────────────────────────────────────────────────────────────────────────────────────────────────────

function DuelRow({ d, me, onPlay, onRefresh }: { d: Duel; me: Me; onPlay: (s: RunState) => void; onRefresh: () => void }) {
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const other = d.mine ? (d.opponent || "an open link") : d.creator;
  const act = async (fn: () => Promise<any>) => {
    setErr("");
    try { await fn(); } catch (e: any) { setErr(e.message); }
  };
  const accept = () => act(async () => onPlay(await call(`/api/quiz/duel/${d.id}/accept`, {})));
  const decline = () => act(async () => { await call(`/api/quiz/duel/${d.id}/decline`, {}); onRefresh(); });
  const carryOn = () => act(async () => onPlay(await call(`/api/quiz/run/${d.my_run}`)));
  let status = "";
  if (d.status === "done") status = d.winner ? `${d.winner} won, ${d.creator_score} to ${d.opponent_score}` : `a draw, ${d.creator_score} each`;
  else if (d.status === "declined") status = "turned down";
  else if (d.status === "expired") status = "nobody finished in time";
  else if (d.mine && d.status === "playing") status = "your round isn't finished";
  else if (d.mine) status = `waiting for ${d.opponent || "someone to take the link"} · ${hm(d.expires_in)} left`;
  else status = `${hm(d.expires_in)} left`;
  return (
    <li className="border-b border-[#161b22] py-2 text-[0.85rem]">
      <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
        <span className="text-[#e6e8ec]">{d.mine ? `You vs ${other}` : `${other} challenged you`}</span>
        <span className="font-mono text-[0.72rem] text-[#8a8f98]">{status}</span>
        <span className="ml-auto flex gap-2">
          {d.my_run && <Btn small onClick={carryOn}>carry on</Btn>}
          {!d.mine && d.status === "open" && <Btn small color={GREEN} onClick={accept}>play</Btn>}
          {!d.mine && d.status === "open" && <Btn small color={RED} onClick={decline}>no thanks</Btn>}
          {d.mine && d.open && d.status === "open" && (
            <Btn small onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/quiz?duel=${d.id}`)}>copy link</Btn>
          )}
          {d.mine && (d.status === "open" || d.status === "playing") && <Btn small color="#8a8f98" onClick={decline}>take back</Btn>}
          {d.review && <Btn small color="#8a8f98" onClick={() => setOpen(!open)}>{open ? "hide" : "answers"}</Btn>}
        </span>
      </div>
      {err && <p className="text-[0.78rem] mt-1" style={{ color: RED }}>{err}</p>}
      {open && d.review && <div className="mt-3"><Review rows={d.review} theirs={d.mine ? d.opponent || "them" : d.creator} /></div>}
      {d.prize > 0 && d.winner === me.name && <p className="font-mono text-[0.72rem] mt-1" style={{ color: GOLD }}>you won {money(d.prize)}</p>}
    </li>
  );
}

function Duels({ me, onPlay, onRefresh }: { me: Me; onPlay: (s: RunState) => void; onRefresh: () => void }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ id: string; name: string }[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (q.trim().length < 2) { setFound([]); return; }
    const t = setTimeout(() => {
      call(`/api/quiz/players?q=${encodeURIComponent(q.trim())}`).then((d) => setFound(d.players || [])).catch(() => setFound([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const make = async (opponent?: string) => {
    setErr("");
    try { onPlay(await call("/api/quiz/duel", opponent ? { opponent } : {})); } catch (e: any) { setErr(e.message); }
  };
  const d = me.duels || { for_you: [], sent: [], finished: [] };
  return (
    <Card color={GOLD}>
      <Label color={GOLD}>Duels</Label>
      <p className="text-[0.85rem] text-[#aab1bc] mt-0 mb-3">
        You both answer the same 10 questions, whenever you like, within 48 hours. The higher score wins.
        You play your round first, then it&apos;s their turn.
        {me.prizes && me.prizes.duel_win > 0 && <> The winner gets {money(me.prizes.duel_win)}.</>}
      </p>
      <div className="flex flex-wrap gap-2 items-center mb-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a player by name"
          className="bg-[#0a0d10] border border-[#2a3340] text-[#e6e8ec] px-3 py-2 text-[0.85rem] flex-1 min-w-[180px] outline-none focus:border-[#c8a84b]" />
        <Btn color={GOLD} onClick={() => make()} disabled={!me.duels_left}>open link</Btn>
      </div>
      {found.length > 0 && (
        <ul className="list-none p-0 m-0 mb-3">
          {found.map((p) => (
            <li key={p.id} className="flex items-center justify-between border-b border-[#161b22] py-1.5 text-[0.85rem] text-[#e6e8ec]">
              {p.name} <Btn small color={GOLD} onClick={() => make(p.id)} disabled={!me.duels_left}>challenge</Btn>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && !found.length && <p className="text-[0.78rem] text-[#8a8f98] mb-3">Nobody by that name has played Quizarium yet. Send an open link instead.</p>}
      <p className="font-mono text-[0.68rem] text-[#8a8f98] mb-3">{me.duels_left ?? 0} duel rounds left today</p>
      {err && <p className="text-[0.8rem] mb-2" style={{ color: RED }}>{err}</p>}
      {d.for_you.length > 0 && <><Label color={GREEN}>Waiting for you</Label><ul className="list-none p-0 m-0 mb-4">{d.for_you.map((x) => <DuelRow key={x.id} d={x} me={me} onPlay={onPlay} onRefresh={onRefresh} />)}</ul></>}
      {d.sent.length > 0 && <><Label>Sent</Label><ul className="list-none p-0 m-0 mb-4">{d.sent.map((x) => <DuelRow key={x.id} d={x} me={me} onPlay={onPlay} onRefresh={onRefresh} />)}</ul></>}
      {d.finished.length > 0 && <><Label>This week</Label><ul className="list-none p-0 m-0">{d.finished.map((x) => <DuelRow key={x.id} d={x} me={me} onPlay={onPlay} onRefresh={onRefresh} />)}</ul></>}
    </Card>
  );
}

function DuelInvite({ id, me, onPlay, onClose }: { id: string; me: Me; onPlay: (s: RunState) => void; onClose: () => void }) {
  const [d, setD] = useState<Duel | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    call(`/api/quiz/duel/${id}`).then(setD).catch((e) => setErr(e.message));
  }, [id]);
  const accept = async () => {
    setErr("");
    try { onPlay(await call(`/api/quiz/duel/${id}/accept`, {})); } catch (e: any) { setErr(e.message); }
  };
  return (
    <Card color={GOLD} className="mb-6">
      <Label color={GOLD}>A duel</Label>
      {!d && !err && <p className="text-[#8a8f98] text-[0.85rem]">Loading...</p>}
      {d && d.mine && <p className="text-[0.9rem] text-[#aab1bc]">This is your own duel. Send the link to someone else.</p>}
      {d && !d.mine && (
        <>
          <p className="text-[0.95rem] text-[#e6e8ec] mt-0">
            <b>{d.creator}</b> challenged {d.open ? "anyone with this link" : "you"} to a duel: the same 10 questions, the higher score wins.
          </p>
          {d.status === "open" && !d.my_run && <Btn color={GREEN} onClick={accept}>Play my round</Btn>}
          {d.my_run && <Btn onClick={() => call(`/api/quiz/run/${d.my_run}`).then(onPlay).catch((e) => setErr(e.message))}>Carry on</Btn>}
          {d.status === "playing" && <p className="text-[0.85rem] text-[#8a8f98]">{d.creator} is still playing their round. Try again in a few minutes.</p>}
          {d.status === "done" && <p className="text-[0.85rem] text-[#aab1bc]">{d.winner ? `${d.winner} won` : "It was a draw"}, {d.creator_score} to {d.opponent_score}.</p>}
          {(d.status === "declined" || d.status === "expired") && <p className="text-[0.85rem] text-[#8a8f98]">This duel is closed.</p>}
          {d.status === "accepted" && !d.my_run && <p className="text-[0.85rem] text-[#8a8f98]">Someone else already took this one.</p>}
        </>
      )}
      {err && <p className="text-[0.85rem]" style={{ color: RED }}>{err}</p>}
      <div className="mt-3"><button onClick={onClose} className="font-mono text-[0.62rem] uppercase tracking-widest text-[#555] hover:text-[#e6e8ec] bg-transparent border-0 cursor-pointer">close</button></div>
    </Card>
  );
}

// ── the boards ───────────────────────────────────────────────────────────────────────────────────────────────────────

function Boards({ boards, me }: { boards: Boards | null; me: Me | null }) {
  const [tab, setTab] = useState<"daily" | "weekly" | "survival" | "blitz" | "yesterday">("daily");
  const [answers, setAnswers] = useState<any[] | null>(null);
  const [aErr, setAErr] = useState("");
  if (!boards) return null;
  const tabs: [typeof tab, string][] = [["daily", "Today"], ["weekly", "This week"], ["survival", "Survival"], ["blitz", "Blitz"], ["yesterday", "Yesterday"]];
  const showAnswers = () => {
    setAErr("");
    call(`/api/quiz/daily/${boards.yesterday.day}`).then((d) => setAnswers(d.questions || [])).catch((e) => setAErr(e.message));
  };
  return (
    <Card color={BLUE}>
      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-[0.35rem] text-[0.66rem] tracking-[0.08em] uppercase border font-mono cursor-pointer bg-transparent transition-all ${tab === id ? "border-[#4a8fc4] text-[#4a8fc4]" : "border-[#222] text-[#555] hover:text-[#e6e6e6]"}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "daily" && <>
        <p className="text-[0.78rem] text-[#8a8f98] mt-0">Daily Challenge, {boards.today}. A new one in {hm(boards.resets_in)}.</p>
        <Board rows={boards.daily} empty="Nobody has finished today's Daily yet. Be the first." showRight me={me?.name} />
      </>}
      {tab === "weekly" && <>
        <p className="text-[0.78rem] text-[#8a8f98] mt-0">The last 7 days: every Daily and duel, your best Survival run and your best Blitz, plus Quizarium games on Discord with 2 or more players. The weekly Quizarium prize goes by this board.</p>
        <Board rows={boards.weekly} empty="No points this week yet." me={me?.name} />
      </>}
      {tab === "survival" && <>
        <p className="text-[0.78rem] text-[#8a8f98] mt-0">Best Survival run of the week.</p>
        <Board rows={boards.survival} empty="No Survival runs this week yet." me={me?.name} />
      </>}
      {tab === "blitz" && <>
        <p className="text-[0.78rem] text-[#8a8f98] mt-0">Best Blitz of the week.</p>
        <Board rows={boards.blitz} empty="No Blitz runs this week yet." me={me?.name} />
      </>}
      {tab === "yesterday" && <>
        <p className="text-[0.78rem] text-[#8a8f98] mt-0">Daily Challenge, {boards.yesterday.day}.</p>
        <Board rows={boards.yesterday.top} empty="Nobody played the Daily yesterday." showRight me={me?.name} />
        <div className="mt-3">
          {!answers && <Btn small onClick={showAnswers}>show yesterday&apos;s answers</Btn>}
          {aErr && <p className="text-[0.8rem]" style={{ color: RED }}>{aErr}</p>}
          {answers && answers.length === 0 && <p className="text-[0.82rem] text-[#8a8f98]">There was no Daily that day.</p>}
          {answers && answers.length > 0 && (
            <ol className="list-none p-0 m-0 mt-2 space-y-2">
              {answers.map((a, i) => (
                <li key={i} className="text-[0.85rem] border-b border-[#161b22] pb-2">
                  <span className="text-[#e6e8ec]">{i + 1}. {a.text}</span>
                  <span className="block font-mono text-[0.78rem] mt-0.5" style={{ color: GREEN }}>{a.options[a.answer]}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </>}
    </Card>
  );
}

// ── the page ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export default function QuizPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [boards, setBoards] = useState<Boards | null>(null);
  const [run, setRun] = useState<RunState | null>(null);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [down, setDown] = useState(false);
  const [invite, setInvite] = useState<string | null>(null);

  const load = useCallback(() => {
    call("/api/quiz/me").then(setMe).catch((e) => { if (e.status === 404) setDown(true); setMe({ logged: false }); });
    call("/api/quiz/boards").then(setBoards).catch((e) => { if (e.status === 404) setDown(true); });
  }, []);

  useEffect(() => {
    load();
    try {
      const d = new URLSearchParams(window.location.search).get("duel");
      if (d && /^[A-Za-z0-9_-]{4,40}$/.test(d)) setInvite(d);
    } catch { /* no window */ }
  }, [load]);

  const play = (s: RunState) => { setErr(""); setDone(!!s.finished); setRun(s); setInvite(null); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const start = async (mode: Mode) => {
    setErr("");
    try { play(await call("/api/quiz/start", { mode })); } catch (e: any) { setErr(e.message); }
  };
  const resume = async (runId: string) => {
    setErr("");
    try { play(await call(`/api/quiz/run/${runId}`)); } catch (e: any) { setErr(e.message); }
  };
  const back = () => {
    setRun(null); setDone(false);
    if (invite) setInvite(null);
    try { if (window.location.search) window.history.replaceState(null, "", "/quiz"); } catch { /* ignore */ }
    load();
  };
  const onDone = useCallback(() => { setDone(true); load(); }, [load]);

  const p = me?.prizes;
  const daily = me?.daily;

  return (
    <main className="max-w-[1000px] mx-auto px-4 py-8">
      <Link href="/features/games" className="font-mono text-[0.65rem] tracking-widest text-[#444] hover:text-[#4a8fc4] no-underline uppercase">← Games</Link>
      <h1 className="text-[1.6rem] text-[#e6e8ec] font-semibold mt-3 mb-0">🧠 Quizarium</h1>
      <p className="text-[0.9rem] text-[#8a8f98] mt-2 mb-6 leading-relaxed max-w-[760px]">
        Zombita&apos;s trivia, right here on the site. Over 2,000 questions, from Project Zomboid and our own world to movies,
        music, science and history. The faster you answer, the more it&apos;s worth. Your points count for the weekly
        Quizarium board, the same one as the Discord games.
      </p>

      {down && <Card color={RED} className="mb-6"><p className="m-0 text-[0.9rem] text-[#aab1bc]">The quiz isn&apos;t open on the website yet. Play with <b>/quiz</b> on Discord for now.</p></Card>}

      {me && !me.logged && !down && (
        <Card className="mb-6">
          <p className="m-0 text-[0.9rem] text-[#aab1bc]">
            Log in with Discord to play. It takes you to your profile after; come back here to start.
          </p>
          <a href={`${API}/auth/discord/login`} className="inline-block mt-3 font-mono text-[0.72rem] uppercase tracking-widest no-underline px-4 py-2 border" style={{ borderColor: "#5865F2", color: "#5865F2" }}>Login with Discord</a>
        </Card>
      )}

      {err && <p className="text-[0.85rem] mb-4" style={{ color: RED }}>{err}</p>}

      {me?.logged && invite && !run && <DuelInvite id={invite} me={me} onPlay={play} onClose={back} />}

      {run && !done && <Play start={run} onDone={onDone} onLeave={back} />}
      {run && done && <FinishedFresh runId={run.run} first={run} me={me} onBack={back} />}

      {me?.logged && !run && (
        <>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-6">
            <Card color={BLUE}>
              <Label color={BLUE}>Daily Challenge</Label>
              <p className="text-[0.85rem] text-[#aab1bc] mt-0">The same 10 questions for everyone today, from easy to hard. One try.</p>
              {p && p.daily_per_right > 0 && <p className="text-[0.8rem] mt-0" style={{ color: GOLD }}>{money(p.daily_per_right)} for each right answer.</p>}
              {p && p.daily_top.length > 0 && <p className="text-[0.8rem] mt-0" style={{ color: GOLD }}>Top {p.daily_top.length} of the day win {p.daily_top.map(money).join(" / ")}.</p>}
              {daily?.state === "new" && <Btn onClick={() => start("daily")}>Play today&apos;s</Btn>}
              {daily?.state === "playing" && daily.run && <Btn onClick={() => resume(daily.run!)}>Carry on ({daily.answered}/10)</Btn>}
              {daily?.state === "done" && (
                <p className="font-mono text-[0.8rem] text-[#e6e8ec] m-0">
                  Done: {daily.score} points, {daily.right}/10 right{daily.place ? `, #${daily.place} of ${daily.players}` : ""}.
                  <span className="block text-[#8a8f98] mt-1">A new one in {boards ? hm(boards.resets_in) : "a while"}.</span>
                </p>
              )}
            </Card>
            <Card color={RED}>
              <Label color={RED}>Survival Run</Label>
              <p className="text-[0.85rem] text-[#aab1bc] mt-0">Keep going until your 3rd wrong answer. It gets harder. 5 right in a row and every answer counts x1.5, then x2, then x2.5.</p>
              <p className="font-mono text-[0.75rem] text-[#8a8f98] mt-0">your best: {me.best?.survival || "none yet"}</p>
              {me.active?.survival ? <Btn color={RED} onClick={() => resume(me.active!.survival!)}>Carry on</Btn> : <Btn color={RED} onClick={() => start("survival")}>Start a run</Btn>}
            </Card>
            <Card color={GREEN}>
              <Label color={GREEN}>Blitz</Label>
              <p className="text-[0.85rem] text-[#aab1bc] mt-0">60 seconds. As many as you can. No waiting between questions.</p>
              <p className="font-mono text-[0.75rem] text-[#8a8f98] mt-0">your best: {me.best?.blitz || "none yet"}</p>
              {me.active?.blitz ? <Btn color={GREEN} onClick={() => resume(me.active!.blitz!)}>Carry on</Btn> : <Btn color={GREEN} onClick={() => start("blitz")}>Go</Btn>}
            </Card>
          </div>
          <div className="mb-6"><Duels me={me} onPlay={play} onRefresh={load} /></div>
        </>
      )}

      {!run && <Boards boards={boards} me={me} />}

      {!run && (
        <p className="text-[0.82rem] text-[#8a8f98] mt-6 leading-relaxed max-w-[760px]">
          Stuck on a Zombita&apos;s World question? The answers are out there in the game: the keepers, the jobs board,
          the guide on your phone. Go and have a look.
        </p>
      )}
    </main>
  );
}

// the finished screen re-reads the run once, so a duel or a Daily place shows up to date
function FinishedFresh({ runId, first, me, onBack }: { runId: string; first: RunState; me: Me | null; onBack: () => void }) {
  const [st, setSt] = useState<RunState>(first);
  useEffect(() => {
    const t = setTimeout(() => { call(`/api/quiz/run/${runId}`).then(setSt).catch(() => {}); }, 300);
    return () => clearTimeout(t);
  }, [runId]);
  return <Finished st={st} me={me} onBack={onBack} />;
}
