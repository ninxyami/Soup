// @ts-nocheck
"use client";
// components/security/CaseCard.tsx - one pair's case on /security. Facts first (their own words, the account switches),
// then the numbers next to real couples and friend pairs, then the admin buttons. share = the clean screenshot layout:
// no buttons, no other player names (the yardsticks become "a real couple on this server" / "friend pairs").
import { C, DISPLAY, METRICS, group, n, has, plural, utc, utcTime, acct, gapText, whyLinked, KIND_LABEL } from "./lib";

export function Chip({ verdict, small = false }) {
  const [, title, color] = group(verdict);
  return (
    <span className={`font-mono uppercase tracking-[0.12em] whitespace-nowrap ${small ? "text-[0.6rem] px-1.5 py-[1px]" : "text-[0.68rem] px-2 py-[2px]"}`}
      style={{ color, border: `1px solid ${color}66`, background: `${color}14`, borderRadius: 2 }}>{title}</span>
  );
}

export function Section({ title, note = null, children }) {
  return (
    <section className="mt-6">
      <div className="flex items-baseline gap-3 flex-wrap border-b pb-1.5 mb-3" style={{ borderColor: C.line }}>
        <h3 className="font-mono text-[0.72rem] uppercase tracking-[0.16em] m-0" style={{ color: C.gold, letterSpacing: "0.16em", fontWeight: "normal" }}>{title}</h3>
        {note && <span className="text-[0.75rem]" style={{ color: C.muted }}>{note}</span>}
      </div>
      {children}
    </section>
  );
}

function OwnWords({ words }) {
  if (!words.length) return <p className="text-[0.85rem] m-0" style={{ color: C.muted }}>Neither name said anything about an alt or a second account.</p>;
  return (
    <div className="flex flex-col gap-3">
      {words.map((h, i) => (
        <div key={i} className="pl-3" style={{ borderLeft: `2px solid ${h.first_join_after ? C.red : C.line}` }}>
          <div className="font-mono text-[0.68rem] uppercase tracking-[0.08em]" style={{ color: C.muted }}>{utc(h.ts)} · {h.channel} chat</div>
          <div className="text-[0.95rem] mt-0.5 leading-relaxed" style={{ color: C.bright }}>
            <span style={{ color: C.text }}>{h.name}:</span> &ldquo;{h.text}&rdquo;
          </div>
          {h.first_join_after && (
            <div className="text-[0.85rem] mt-1" style={{ color: C.red }}>
              {h.first_join_after.name} joined for the first time {plural(n(h.first_join_after.minutes_after), "minute")} later ({utc(h.first_join_after.ts)}).
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Switches({ sw, share }) {
  if (!sw) return <p className="text-[0.85rem] m-0" style={{ color: C.muted }}>No switch record for this pair.</p>;
  const list = Array.isArray(sw.list) ? sw.list : [];
  const th = "text-left font-mono text-[0.62rem] uppercase tracking-[0.1em] font-normal px-2 py-1.5 whitespace-nowrap";
  const td = "px-2 py-1.5 whitespace-nowrap align-top";
  return (
    <>
      <p className="text-[0.85rem] leading-relaxed m-0 mb-3" style={{ color: C.text }}>
        {plural(n(sw.n), "time")} one name left and the other came in within 10 minutes.{" "}
        <b style={{ color: n(sw.same_account) ? C.red : C.bright, fontWeight: 500 }}>{n(sw.same_account)} on the same Steam account</b>
        {n(sw.quick_same) ? <>, <b style={{ color: C.red, fontWeight: 500 }}>{n(sw.quick_same)} of them within 2 minutes</b></> : null}.{" "}
        {n(sw.both_in_same_home_min) > 0
          ? `Both were in game at the same time on different Steam accounts from the same home ${plural(n(sw.both_in_same_home_times), "time")} (${n(sw.both_in_same_home_min)} min).`
          : "Never in game at the same time on different Steam accounts from the same home."}
      </p>
      {list.length > 0 && (
        <div className="overflow-x-auto border" style={{ borderColor: C.line }}>
          <table className="w-full text-[0.8rem]" style={{ borderCollapse: "collapse" }}>
            <thead style={{ background: C.inner, color: C.muted }}>
              <tr><th className={th}>Out</th><th className={th}>In</th><th className={th}>Gap</th><th className={th}>Same Steam account</th><th className={th}>Distance</th></tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${C.line}`, background: r.quick_same ? `${C.red}12` : "transparent" }}>
                  <td className={td}>
                    <div style={{ color: C.bright }}>{r.out}</div>
                    <div className="font-mono text-[0.7rem]" style={{ color: C.muted }}>{utcTime(r.out_ts)}{!share && ` · ${acct(r.steam_out)}`}</div>
                  </td>
                  <td className={td}>
                    <div style={{ color: C.bright }}>{r.in}</div>
                    <div className="font-mono text-[0.7rem]" style={{ color: C.muted }}>{utcTime(r.in_ts)}{!share && ` · ${acct(r.steam_in)}`}</div>
                  </td>
                  <td className={`${td} font-mono`} style={{ color: r.quick_same ? C.red : C.text }}>{gapText(r.gap_sec)}</td>
                  <td className={`${td} font-mono`}>
                    <span className="px-1.5 py-[1px]" style={r.same_account ? { color: C.red, border: `1px solid ${C.red}88`, background: `${C.red}18` } : { color: C.muted }}>
                      {r.same_account ? "YES" : "no"}
                    </span>
                  </td>
                  <td className={`${td} font-mono`} style={{ color: has(r.dist) && n(r.dist) === 0 ? C.red : C.text }}>
                    {has(r.dist) ? (n(r.dist) === 0 ? "same tile" : `${r.dist} tiles`) : "?"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="font-mono text-[0.65rem] mt-2 m-0" style={{ color: C.muted }}>Times in UTC.{!share && " Steam accounts show their last 4 digits."}</p>
    </>
  );
}

// one number drawn to scale against the couple and friends bands
function Bar({ label, unit, hint, value, couple, friends, coupleLabel, friendsLabel, color }) {
  const top = Math.max(n(value), couple ? n(couple[1]) : 0, friends ? n(friends[1]) : 0, 1) * 1.1;
  const pct = (v) => Math.min(100, (100 * n(v)) / top);
  const fmt = (v) => (has(v) ? `${v}${unit}` : "no data");
  const rtxt = (r) => (r ? (r[0] === r[1] ? `${r[0]}${unit}` : `${r[0]} to ${r[1]}${unit}`) : "none yet");
  const band = (r, col) => r
    ? <div className="absolute top-0 bottom-0" style={{ left: `${pct(r[0])}%`, width: `max(3px, ${pct(r[1]) - pct(r[0])}%)`, background: col, opacity: 0.75, borderRadius: 2 }} />
    : null;
  const row = (title, col, inner, txt, h) => (
    <div className="grid items-center gap-2 mt-1" style={{ gridTemplateColumns: "minmax(88px, 150px) 1fr minmax(64px, auto)" }}>
      <span className="text-[0.72rem] truncate" style={{ color: col }}>{title}</span>
      <div className="relative" style={{ height: h, background: C.track, borderRadius: 2 }}>{inner}</div>
      <span className="font-mono text-[0.72rem] text-right whitespace-nowrap" style={{ color: col }}>{txt}</span>
    </div>
  );
  return (
    <div className="mb-5">
      <div className="text-[0.9rem]" style={{ color: C.bright }}>{label}</div>
      <div className="text-[0.75rem] mb-1" style={{ color: C.muted }}>{hint}</div>
      {row("this pair", color, has(value) ? <div className="absolute left-0 top-0 bottom-0" style={{ width: `max(2px, ${pct(value)}%)`, background: color, borderRadius: 2 }} /> : null, fmt(value), 12)}
      {row(coupleLabel, C.gold, band(couple, C.gold), rtxt(couple), 6)}
      {row(friendsLabel, C.green, band(friends, C.green), rtxt(friends), 6)}
    </div>
  );
}

// the measured minutes split four ways, one stacked bar
function Minutes({ p, m }) {
  const parts = [
    ["both moved", n(m.both_min), C.green], [`only ${p.a} moved`, n(m.only_a), C.amber], [`only ${p.b} moved`, n(m.only_b), "#b8762a"], ["neither moved", n(m.neither), "#3a4250"],
  ];
  const total = parts.reduce((s, x) => s + x[1], 0);
  if (!total) return null;
  return (
    <div className="mb-6">
      <div className="text-[0.85rem] mb-2" style={{ color: C.text }}>
        {n(m.shared_min)} minutes online together. Of the {total} minutes Zombita could measure:
      </div>
      <div className="flex h-4 overflow-hidden" style={{ background: C.track, borderRadius: 2 }}>
        {parts.map(([l, v, col]) => v > 0 && <div key={l} title={`${l}: ${v} min`} style={{ width: `${(100 * v) / total}%`, background: col }} />)}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {parts.map(([l, v, col]) => (
          <span key={l} className="text-[0.75rem] inline-flex items-center gap-1.5" style={{ color: C.text }}>
            <span className="inline-block w-2.5 h-2.5" style={{ background: col }} />{l} <span className="font-mono" style={{ color: C.muted }}>{v} min</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Moving({ name, other, alone, together, afk, lines }) {
  const bar = (v, col) => (
    <div className="relative flex-1" style={{ height: 8, background: C.track, borderRadius: 2 }}>
      {has(v) && <div className="absolute left-0 top-0 bottom-0" style={{ width: `max(2px, ${Math.min(100, n(v))}%)`, background: col, borderRadius: 2 }} />}
    </div>
  );
  return (
    <div className="p-3 border" style={{ borderColor: C.line, background: C.inner }}>
      <div className="text-[0.95rem] mb-2" style={{ color: C.bright }}>{name}</div>
      <div className="flex items-center gap-2 text-[0.75rem]" style={{ color: C.muted }}>
        <span className="w-[110px] shrink-0">playing alone</span>{bar(alone, C.text)}<span className="font-mono w-[48px] text-right" style={{ color: C.text }}>{has(alone) ? `${alone}%` : "?"}</span>
      </div>
      <div className="flex items-center gap-2 text-[0.75rem] mt-1.5" style={{ color: C.muted }}>
        <span className="w-[110px] shrink-0 truncate">with {other} on</span>{bar(together, C.gold)}<span className="font-mono w-[48px] text-right" style={{ color: C.gold }}>{has(together) ? `${together}%` : "?"}</span>
      </div>
      <div className="text-[0.75rem] mt-2" style={{ color: C.muted }}>
        Away (AFK) while both online: {n(afk)} min. Chat while both online: {plural(n(lines), "line")}.
      </div>
    </div>
  );
}

function Btn({ children, onClick, color = C.muted, disabled = false }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="font-mono text-[0.7rem] uppercase tracking-[0.1em] px-3 py-2 cursor-pointer disabled:opacity-40 disabled:cursor-default transition-colors"
      style={{ color, border: `1px solid ${color}88`, background: `${color}10`, borderRadius: 2 }}>{children}</button>
  );
}

// st = the whole report (controls, pairs, rules); mark(a, b, kind, question) asks first, then saves
export default function CaseCard({ p, st, share = false, watchMark = null, busy = false, mark = null, onShare = null, onReport = null }) {
  const m = p.m || {};
  const cc = st.controls || {};
  const nc = n(cc.n_couple), nf = n(cc.n_friends);
  const coupleLabel = share ? (nc === 1 ? "a real couple on this server" : "real couples on this server") : `couples (${nc})`;
  const friendsLabel = share ? "friend pairs" : `friend pairs (${nf})`;
  const [, , color] = group(p.verdict);
  const words = Array.isArray(p.own_words) ? p.own_words : [];
  const isControl = p.kind === "couple" || p.kind === "friends";
  const minShared = st.rules?.min_shared ?? 60;
  const yard = (kind) => (Array.isArray(st.pairs) ? st.pairs : [])
    .filter((x) => x.kind === kind && n(x.m?.shared_min) >= minShared)
    .map((x) => `${x.a} + ${x.b}`);
  const couples = yard("couple"), friends = yard("friends");

  return (
    <div>
      {/* names + state */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="leading-none break-words" style={{ fontFamily: DISPLAY, fontSize: 34, letterSpacing: 1.5, color: C.bright }}>
            {p.a} <span style={{ color: C.muted, fontSize: 24 }}>and</span> {p.b}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <Chip verdict={p.verdict} />
            {!share && watchMark && <span className="font-mono text-[0.65rem] uppercase tracking-[0.1em]" style={{ color: C.gold }}>
              {KIND_LABEL[watchMark.kind] || watchMark.kind}{watchMark.by ? ` by ${watchMark.by}` : ""}</span>}
            {p.outside_controls && <span className="font-mono text-[0.65rem] uppercase tracking-[0.1em]" style={{ color: C.red }}>below every couple and friend pair</span>}
          </div>
        </div>
        {!share && (onShare || onReport) && (
          <div className="flex flex-wrap gap-2">
            {onReport && <Btn color={C.gold} onClick={onReport}>Write case report</Btn>}
            {onShare && <Btn onClick={onShare}>Share view</Btn>}
          </div>
        )}
      </div>

      {/* Zombita's line */}
      <blockquote className="m-0 mt-4 pl-4 py-2 text-[1rem] leading-relaxed italic" style={{ borderLeft: `3px solid ${color}`, color: C.bright, background: `${color}0d` }}>
        {p.line}
        <div className="not-italic font-mono text-[0.65rem] uppercase tracking-[0.12em] mt-1" style={{ color: C.muted }}>Zombita</div>
      </blockquote>

      {!isControl && (
        <Section title="In their own words" note="Anything either name said about an alt or a second account.">
          <OwnWords words={words} />
        </Section>
      )}

      {!isControl && (
        <Section title="Account switches" note="One name left, the other came in.">
          <Switches sw={p.switches} share={share} />
        </Section>
      )}

      <Section title="How they play vs real people" note="Drawn to scale. The bands show the range of the yardstick pairs.">
        <Minutes p={p} m={m} />
        {METRICS.map(([k, label, unit, hint]) => (
          <Bar key={k} label={label} unit={unit} hint={hint} value={m[k]} couple={cc.couple?.[k]} friends={cc.friends?.[k]}
               coupleLabel={coupleLabel} friendsLabel={friendsLabel} color={color} />
        ))}
        {!share && (
          <div className="text-[0.75rem] leading-relaxed" style={{ color: C.muted }}>
            <div><span style={{ color: C.gold }}>Couples:</span> {couples.length ? couples.join(", ") : "none marked yet (mark a real couple so Zombita has something to compare with)"}.</div>
            <div><span style={{ color: C.green }}>Friend pairs:</span> {friends.length ? friends.join(", ") : "none yet"}.</div>
          </div>
        )}
      </Section>

      <Section title="Moving alone vs together" note="A person plays the same with or without the other name online.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Moving name={p.a} other={p.b} alone={m.a_move_alone} together={m.a_move_together} afk={m.afk_a} lines={m.a_lines_together} />
          <Moving name={p.b} other={p.a} alone={m.b_move_alone} together={m.b_move_together} afk={m.afk_b} lines={m.b_lines_together} />
        </div>
      </Section>

      {!share && p.style && (
        <Section title="Writing style">
          <p className="text-[0.85rem] m-0 leading-relaxed" style={{ color: C.text }}>
            Rank <b style={{ color: C.bright, fontWeight: 500 }}>{n(p.style.rank)} of {n(p.style.of)}</b> pairs (1 means the two most alike writers on the server).
          </p>
          {Array.isArray(p.style.rare_shared) && p.style.rare_shared.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-[0.75rem] mr-1" style={{ color: C.muted }}>Rare words only these two use:</span>
              {p.style.rare_shared.map((w) => <span key={w} className="font-mono text-[0.72rem] px-1.5" style={{ color: C.bright, border: `1px solid ${C.line}`, background: C.inner }}>{w}</span>)}
            </div>
          )}
        </Section>
      )}

      {!share && (
        <Section title="Why Zombita looked">
          <ul className="m-0 pl-5 text-[0.85rem] leading-relaxed" style={{ color: C.text }}>
            {whyLinked(p).map((w) => <li key={w}>{w}</li>)}
          </ul>
        </Section>
      )}

      {!share && mark && (
        <Section title="Decide" note="Zombita states facts. Admins decide.">
          <div className="flex flex-wrap gap-2">
            <Btn color={C.green} disabled={busy} onClick={() => mark(p.a, p.b, "cleared", `Mark ${p.a} and ${p.b} as two people?\n\nZombita never flags them again.`)}>Mark cleared (two people)</Btn>
            <Btn color={C.red} disabled={busy} onClick={() => mark(p.a, p.b, "suspect", `Keep watching ${p.a} and ${p.b} as a suspect pair?`)}>Watch as suspect</Btn>
            <Btn color={C.gold} disabled={busy} onClick={() => mark(p.a, p.b, "couple", `Use ${p.a} and ${p.b} as a real couple?\n\nEvery other pair is compared with them.`)}>Mark as couple (yardstick)</Btn>
            {watchMark && <Btn disabled={busy} onClick={() => mark(p.a, p.b, "remove", `Remove the admin mark on ${p.a} and ${p.b}?`)}>Remove mark</Btn>}
          </div>
          <p className="text-[0.75rem] mt-2 m-0" style={{ color: C.muted }}>A new mark shows in the next report. Press Listen now to see it at once.</p>
        </Section>
      )}

    </div>
  );
}

