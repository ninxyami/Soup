// @ts-nocheck
"use client";
// components/security/Households.tsx - the Households tab of /security (it was the whole page until 2026-10-16): every
// pair of accounts that look like one home, measured against real couples and friend pairs. Left: the pairs. Right: one
// pair's case card. Share view: one pair, no other names. Data: GET/POST {API}/api/admin/security (zombita_security.py).
import { useEffect, useMemo, useState } from "react";
import CaseCard, { Chip } from "./CaseCard";
import { C, DISPLAY, BODY, PORTRAIT, GROUPS, KIND_LABEL, n, has, plural, pairKey, samePair } from "./lib";

function PairRow({ p, active, onPick, mark }) {
  const m = p.m || {};
  const words = Array.isArray(p.own_words) ? p.own_words.length : 0;
  const sameAcct = n(p.switches?.same_account);
  return (
    <button onClick={onPick} className="w-full text-left block px-3 py-2.5 cursor-pointer transition-colors"
      style={{ background: active ? "#141a22" : "transparent", borderLeft: `3px solid ${active ? C.gold : "transparent"}`, borderBottom: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-2">
        <span className="flex-1 min-w-0 truncate text-[0.92rem]" style={{ color: C.bright }}>{p.a} <span style={{ color: C.muted }}>+</span> {p.b}</span>
        <Chip verdict={p.verdict} small />
      </div>
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-1 font-mono text-[0.68rem]" style={{ color: C.muted }}>
        <span>both moving <span style={{ color: C.text }}>{has(m.both_pct) ? `${m.both_pct}%` : "?"}</span></span>
        <span><span style={{ color: C.text }}>{n(m.shared_min)}</span> min together</span>
        {words > 0 && <span className="px-1" style={{ color: C.red, border: `1px solid ${C.red}66` }}>own words</span>}
        {sameAcct > 0 && <span className="px-1" style={{ color: C.red, border: `1px solid ${C.red}66` }}>same-account switches {sameAcct}</span>}
        {mark && <span style={{ color: C.gold }}>{KIND_LABEL[mark.kind] || mark.kind}</span>}
      </div>
    </button>
  );
}

const inp = "font-mono text-[0.8rem] px-2.5 py-2 outline-none w-full";
const inpStyle = { background: "#080a0c", color: C.bright, border: `1px solid ${C.line}`, borderRadius: 2 };

function Fold({ title, children, open = false }) {
  return (
    <details open={open} className="mt-4 border" style={{ borderColor: C.line, background: C.card }}>
      <summary className="cursor-pointer px-3 py-2.5 font-mono text-[0.72rem] uppercase tracking-[0.14em] select-none" style={{ color: C.gold }}>{title}</summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}

function Explain({ st }) {
  const R = st.rules || {};
  return (
    <details className="mt-10 border" style={{ borderColor: C.line, background: C.card }}>
      <summary className="cursor-pointer px-4 py-3 font-mono text-[0.75rem] uppercase tracking-[0.14em] select-none" style={{ color: C.gold }}>How Zombita checks households, in plain words</summary>
      <div className="px-4 pb-5 text-[0.88rem] leading-relaxed max-w-[860px]" style={{ color: C.text }}>
        <p>
          One person can&apos;t really play two characters at the same time. Two people can. Every night Zombita looks at the last
          {" "}{st.window_days || 14} days. When two accounts look like one home, she checks every minute both were online: did both
          characters actually move, fight, drive and talk? Then she puts those numbers next to real couples and friend pairs on this server.
        </p>
        <p>Two accounts look like one home when one joined on the other&apos;s Steam account, or when they share a home address and keep
          swapping logins ({R.handovers ?? 3} or more handovers within {R.handover_min ?? 10} minutes), or one sits still next to the other
          ({R.parked ?? 2} or more times, {R.parked_min ?? 10} minutes or longer). A shared address alone never links anyone: cafes, dorms and
          phone networks share addresses. Home addresses are never stored, only a scrambled code.</p>
        <div className="grid gap-2 sm:grid-cols-2 my-4">
          {GROUPS.map(([k, title, color, hint]) => (
            <div key={k} className="p-3 border" style={{ borderColor: C.line, background: C.inner }}>
              <div className="font-mono text-[0.72rem] uppercase tracking-[0.12em]" style={{ color }}>{title}</div>
              <div className="text-[0.82rem] mt-1" style={{ color: C.text }}>{hint}</div>
            </div>
          ))}
        </div>
        <p>
          The sorting, after {R.min_shared ?? 60} minutes online together: both moving in at least {R.two_beat_both ?? 30}% of the minutes,
          or {R.two_beat_run ?? 15} minutes in a row, is two heartbeats. Under {R.one_beat_both ?? 15}% and never more than
          {" "}{R.one_beat_run ?? 5} minutes in a row is one heartbeat. Anything between is unclear.
        </p>
        <p className="mb-0" style={{ color: C.bright }}>
          The numbers are not proof. A couple sharing ONE PC can look exactly like one person, because they also play one character
          at a time. So Zombita only states facts: what they said, how the names took turns, and how they play next to real people.
          Admins decide. If you know they are two people, mark them cleared and Zombita stops flagging them.
        </p>
      </div>
    </details>
  );
}

// st = the households report; send(body, label) posts to /api/admin/security; ask(question) -> Promise<bool>
export default function Households({ st, busy, send, ask, onReport }) {
  const [sel, setSel] = useState("");
  const [share, setShare] = useState(false);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ a: "", b: "", kind: "suspect", note: "" });

  const pairs = useMemo(() => (Array.isArray(st?.pairs) ? st.pairs : []), [st]);
  const watch = useMemo(() => (Array.isArray(st?.watch) ? st.watch : []), [st]);
  const counts = useMemo(() => Object.fromEntries(GROUPS.map(([g]) => [g, pairs.filter((p) => p.verdict === g).length])), [pairs]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return pairs.filter((p) => (!filter || p.verdict === filter) && (!s || `${p.a} ${p.b}`.toLowerCase().includes(s)));
  }, [pairs, filter, q]);
  const cur = sel ? pairs.find((p) => pairKey(p) === sel) : null;

  useEffect(() => {
    if (sel || !pairs.length || typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 1024px)").matches) setSel(pairKey(pairs[0]));
  }, [pairs, sel]);

  const pick = (p) => {
    setSel(pairKey(p));
    setShare(false);
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches) window.scrollTo({ top: 0 });
  };
  const mark = async (a, b, kind, question) => {
    if (!(await ask(question))) return;
    send({ cmd: "watch", a, b, kind, note: "" }, "Saving");
  };
  const addPair = async () => {
    const a = form.a.trim(), b = form.b.trim();
    if (!a || !b) return;
    if (!(await ask(`Add ${a} and ${b} as ${KIND_LABEL[form.kind] || form.kind}?`))) return;
    if (await send({ cmd: "watch", ...form, a, b }, "Saving")) setForm({ a: "", b: "", kind: "suspect", note: "" });
  };

  if (share && cur) {
    return (
      <div className="max-w-[820px] mx-auto">
        <button onClick={() => setShare(false)} className="font-mono text-[0.68rem] uppercase tracking-[0.12em] px-2 py-1 mb-4 cursor-pointer"
          style={{ color: C.muted, border: `1px solid ${C.line}`, background: "transparent", borderRadius: 2 }}>Back</button>
        <div className="border p-5 sm:p-8" style={{ borderColor: C.line, background: C.card, fontFamily: BODY }}>
          <header className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PORTRAIT} alt="Zombita" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shrink-0" style={{ border: `2px solid ${C.gold}55` }} />
            <div>
              <div style={{ fontFamily: DISPLAY, fontSize: "clamp(28px, 6vw, 40px)", letterSpacing: 3, color: C.gold, lineHeight: 1 }}>ZOMBITA&apos;S SECURITY</div>
              <p className="m-0 mt-1 text-[0.85rem]" style={{ color: C.text }}>I check every pair of accounts every night: who joins on whose Steam account, who plays when, and what they say.</p>
            </div>
          </header>
          <div className="h-px my-6" style={{ background: C.line }} />
          <CaseCard p={cur} st={st} share />
          <div className="mt-8 pt-4 border-t flex items-center gap-3 flex-wrap" style={{ borderColor: C.line }}>
            <span className="text-[0.85rem] italic" style={{ color: C.text }}>Written by Zombita. I check every pair of accounts every night.</span>
            <span className="ml-auto font-mono text-[0.65rem] uppercase tracking-[0.12em]" style={{ color: C.muted }}>
              Last {st.window_days || 14} days · checked {st.at ? new Date(st.at * 1000).toLocaleDateString() : "never"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-px border" style={{ borderColor: C.line, background: C.line }}>
        {GROUPS.map(([g, title, color]) => {
          const on = filter === g;
          return (
            <button key={g} onClick={() => setFilter(on ? "" : g)} title={on ? "Show every pair" : `Show only: ${title}`}
              className="text-left px-3 py-3 cursor-pointer transition-colors"
              style={{ background: on ? `${color}1f` : C.card, boxShadow: on ? `inset 0 -2px 0 ${color}` : "none" }}>
              <div className="leading-none" style={{ fontFamily: DISPLAY, fontSize: 28, color: counts[g] ? color : "#3a4250" }}>{counts[g] || 0}</div>
              <div className="font-mono text-[0.6rem] uppercase tracking-[0.1em] mt-1" style={{ color: on ? color : C.muted }}>{title}</div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 mt-6 grid-cols-[minmax(0,1fr)] lg:grid-cols-[380px_minmax(0,1fr)] items-start">
        <div className={cur ? "hidden lg:block" : ""}>
          <div className="border" style={{ borderColor: C.line, background: C.card }}>
            <div className="p-3 border-b" style={{ borderColor: C.line }}>
              <input className={inp} style={inpStyle} placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="flex items-center gap-2 mt-2 font-mono text-[0.65rem] uppercase tracking-[0.1em]" style={{ color: C.muted }}>
                <span>{plural(shown.length, "pair")}{filter ? ` · ${GROUPS.find((g) => g[0] === filter)?.[1]}` : ""}</span>
                {(filter || q) && <button onClick={() => { setFilter(""); setQ(""); }} className="ml-auto cursor-pointer uppercase" style={{ color: C.gold, background: "transparent", border: 0 }}>Show all</button>}
              </div>
            </div>
            <div className="lg:max-h-[calc(100vh-260px)] lg:overflow-y-auto">
              {shown.map((p) => (
                <PairRow key={pairKey(p)} p={p} active={pairKey(p) === sel} onPick={() => pick(p)} mark={watch.find((w) => samePair(w, p.a, p.b))} />
              ))}
              {pairs.length === 0 && <div className="p-4 text-[0.85rem]" style={{ color: C.muted }}>No pairs yet. Press Listen now, or wait for tonight&apos;s check.</div>}
              {pairs.length > 0 && shown.length === 0 && <div className="p-4 text-[0.85rem]" style={{ color: C.muted }}>No pair matches.</div>}
            </div>
          </div>

          <Fold title="Add a pair to watch">
            <div className="grid grid-cols-2 gap-2">
              <input className={inp} style={inpStyle} placeholder="First name" value={form.a} onChange={(e) => setForm({ ...form, a: e.target.value })} />
              <input className={inp} style={inpStyle} placeholder="Second name" value={form.b} onChange={(e) => setForm({ ...form, b: e.target.value })} />
              <select className={`${inp} col-span-2`} style={inpStyle} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="suspect">Suspect (check them anyway)</option>
                <option value="couple">Couple (yardstick)</option>
                <option value="friends">Friends (yardstick)</option>
                <option value="cleared">Cleared (two people)</option>
              </select>
              <input className={`${inp} col-span-2`} style={inpStyle} placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              <button onClick={addPair} disabled={busy || !form.a.trim() || !form.b.trim()}
                className="col-span-2 font-mono text-[0.72rem] uppercase tracking-[0.12em] py-2 cursor-pointer disabled:opacity-40 disabled:cursor-default"
                style={{ color: C.gold, border: `1px solid ${C.gold}`, background: `${C.gold}12`, borderRadius: 2 }}>Add</button>
            </div>
            <p className="text-[0.75rem] mt-2 mb-0" style={{ color: C.muted }}>Use the names as they show in game. A new mark shows in the next report (Listen now to see it at once).</p>
          </Fold>

          <Fold title={`Admin marks (${watch.length})`}>
            {watch.length === 0 && <p className="text-[0.82rem] m-0" style={{ color: C.muted }}>No marks yet.</p>}
            {watch.map((w) => (
              <div key={`${w.a}|${w.b}`} className="flex items-start gap-2 py-2 border-b last:border-b-0" style={{ borderColor: C.line }}>
                <div className="flex-1 min-w-0">
                  <div className="text-[0.85rem]" style={{ color: C.bright }}>{w.a} + {w.b}</div>
                  <div className="font-mono text-[0.65rem] uppercase tracking-[0.08em]" style={{ color: C.gold }}>{KIND_LABEL[w.kind] || w.kind}</div>
                  {(w.by || w.at) && <div className="text-[0.72rem]" style={{ color: C.muted }}>{w.by ? `by ${w.by}` : ""}{w.at ? `, ${new Date(w.at * 1000).toLocaleDateString()}` : ""}</div>}
                  {w.note && <div className="text-[0.75rem] italic" style={{ color: C.text }}>&ldquo;{w.note}&rdquo;</div>}
                </div>
                <button disabled={busy} onClick={() => mark(w.a, w.b, "remove", `Remove the admin mark on ${w.a} and ${w.b}?`)}
                  className="font-mono text-[0.62rem] uppercase tracking-[0.1em] px-2 py-1 cursor-pointer disabled:opacity-40"
                  style={{ color: C.muted, border: `1px solid ${C.line}`, background: "transparent", borderRadius: 2 }}>Remove</button>
              </div>
            ))}
          </Fold>
        </div>

        <div className={cur ? "" : "hidden lg:block"}>
          {cur ? (
            <div className="border p-4 sm:p-6" style={{ borderColor: C.line, background: C.card }}>
              <button onClick={() => setSel("")} className="lg:hidden font-mono text-[0.68rem] uppercase tracking-[0.12em] px-2 py-1 mb-4 cursor-pointer"
                style={{ color: C.muted, border: `1px solid ${C.line}`, background: "transparent", borderRadius: 2 }}>Back to the list</button>
              <CaseCard p={cur} st={st} watchMark={watch.find((w) => samePair(w, cur.a, cur.b))} busy={busy} mark={mark}
                onShare={() => { setShare(true); window.scrollTo({ top: 0 }); }} onReport={() => onReport(cur)} />
            </div>
          ) : (
            <div className="border p-10 text-center text-[0.9rem]" style={{ borderColor: C.line, background: C.card, color: C.muted }}>
              {pairs.length ? "Pick a pair on the left to see its case." : "Nothing to show yet."}
            </div>
          )}
        </div>
      </div>

      <Explain st={st} />
    </div>
  );
}
