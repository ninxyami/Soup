// @ts-nocheck
"use client";
// components/ops/SecurityTab.tsx - Live Ops > Zombita > SECURITY (2026-10-16, bot zombita_security.py + routers/security.py,
// security_patch.py). Zombita's households and heartbeats: pairs of accounts that look like one home, and whether both
// characters are really played at the same time. Facts only: a couple sharing ONE PC also plays one at a time, so admins
// can mark a pair cleared. Data: GET /api/admin/security (the nightly report + the admin marks). Changes: POST
// /api/admin/security {cmd: "run"} (listen now) or {cmd: "watch", a, b, kind, note}. Admins only.
import { useCallback, useEffect, useState } from "react";
import { API } from "@/lib/constants";

const C = { gold: "#c8a84b", green: "#4caf7d", red: "#e05555", amber: "#d08c2c", grey: "#9aa", text: "#e6e6e6", bg: "#0b0d10", line: "#2a2f37" };
const mono = { fontFamily: "var(--mono, monospace)" };
const btn = (color = C.grey) => ({ ...mono, fontSize: 11, padding: "3px 8px", background: "transparent", color, border: `1px solid ${color}66`,
  borderRadius: 3, cursor: "pointer", marginRight: 4 });
const inp = { ...mono, fontSize: 12, padding: "4px 6px", background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 3 };
const n = (v) => Number(v) || 0;
const has = (v) => v !== null && v !== undefined;

const GROUPS = [
  ["one", "One heartbeat", C.red, "Two names, and only one of them was really played at a time."],
  ["unclear", "Unclear", C.amber, "Sometimes both play, mostly one. Worth a look."],
  ["listening", "Listening", C.grey, "Not enough time online together yet."],
  ["two", "Two heartbeats", C.green, "Both characters play at the same time."],
  ["cleared", "Cleared", C.green, "An admin confirmed these are two people."],
  ["control", "Yardstick", C.gold, "Real couples and friend pairs. Every other pair is compared with them."],
];
const KIND_LABEL = { suspect: "suspect", couple: "couple (yardstick)", friends: "friends (yardstick)", cleared: "cleared (two people)" };

// the numbers in the detail card: key, label, unit, what a high number means
const METRICS = [
  ["both_pct", "Both moving", "%", "of the minutes they were online together, both characters moved"],
  ["longest_both", "Longest both-moving run", " min", "the longest stretch where both kept moving, minute after minute"],
  ["kills_same_min", "Kills in the same minute", "", "minutes where both killed a zombie"],
  ["car_together_min", "In a car together", " min", "minutes both sat in cars right next to each other"],
  ["quick_replies", "Quick replies", "", "chat lines answered within 10 seconds while both were on"],
  ["lines_to_each_other", "Lines naming the other", "", "chat lines that mention the other name"],
  ["median_dist", "Usual distance apart", " tiles", "how far apart they usually were (smaller = closer)"],
];

function when(ts) {
  if (!ts) return "never";
  const d = new Date(ts * 1000);
  const mins = Math.max(0, Math.round((Date.now() / 1000 - ts) / 60));
  const ago = mins < 60 ? `${mins} min ago` : mins < 2880 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} days ago`;
  return `${d.toLocaleString()} (${ago})`;
}
const same = (p, a, b) => {
  const x = String(p.a || "").toLowerCase(), y = String(p.b || "").toLowerCase();
  const s = String(a || "").toLowerCase(), t = String(b || "").toLowerCase();
  return (x === s && y === t) || (x === t && y === s);
};

function whyLinked(p) {
  const L = p.link;
  if (!L) return p.source === "admin" ? "added by an admin" : "picked by Zombita: they play together a lot";
  const out = [];
  const why = Array.isArray(L.why) ? L.why : [];
  if (why.includes("steam_swap")) out.push("one joined on the other's Steam account");
  if (why.includes("same_owner")) out.push("same Steam family-share owner");
  if (L.same_home) out.push("same home address");
  if (n(L.handovers)) out.push(`${L.handovers} handover${n(L.handovers) === 1 ? "" : "s"} (one logs out, the other logs in)`);
  if (n(L.parked)) out.push(`${L.parked} time${n(L.parked) === 1 ? "" : "s"} one sat still next to the other`);
  return out.join(" · ") || "linked";
}

// one number drawn to scale: this pair, the couple range, the friends range
function Bar({ label, unit, hint, value, couple, friends, coupleLabel, friendsLabel, color }) {
  const top = Math.max(n(value), couple ? n(couple[1]) : 0, friends ? n(friends[1]) : 0, 1) * 1.1;
  const pct = (v) => `${Math.min(100, (100 * n(v)) / top)}%`;
  const range = (r, col) => r
    ? <div style={{ position: "absolute", left: pct(r[0]), width: `max(3px, calc(${pct(r[1])} - ${pct(r[0])}))`, top: 0, bottom: 0, background: col, opacity: 0.8, borderRadius: 2 }} />
    : null;
  const fmt = (v) => (has(v) ? `${v}${unit}` : "none");
  const rtxt = (r) => (r ? (r[0] === r[1] ? `${r[0]}${unit}` : `${r[0]} to ${r[1]}${unit}`) : "none yet");
  const row = (title, col, inner, txt) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
      <span style={{ width: 150, flexShrink: 0, color: col, fontSize: 11 }}>{title}</span>
      <div style={{ position: "relative", flex: 1, minWidth: 60, height: 8, background: C.line, borderRadius: 2 }}>{inner}</div>
      <span style={{ width: 90, flexShrink: 0, textAlign: "right", fontSize: 11, color: col }}>{txt}</span>
    </div>
  );
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: C.text }}>{label} <span style={{ color: C.grey, fontSize: 11 }}>{hint}</span></div>
      {row("this pair", color, has(value) ? <div style={{ position: "absolute", left: 0, width: `max(2px, ${pct(value)})`, top: 0, bottom: 0, background: color, borderRadius: 2 }} /> : null, fmt(value))}
      {row(coupleLabel, C.gold, range(couple, C.gold), rtxt(couple))}
      {row(friendsLabel, C.green, range(friends, C.green), rtxt(friends))}
    </div>
  );
}

function Detail({ p, controls, share, names }) {
  const m = p.m || {};
  const cc = controls || {};
  const nc = n(cc.n_couple), nf = n(cc.n_friends);
  const coupleLabel = share ? (nc === 1 ? "a real couple on this server" : "real couples on this server") : `couple${nc === 1 ? "" : "s"} (${nc})`;
  const friendsLabel = share ? "friend pairs" : `friend pairs (${nf})`;
  const col = GROUPS.find((g) => g[0] === p.verdict)?.[2] || C.text;
  const moveLine = (name, alone, tog) => (
    <div style={{ marginBottom: 4 }}>
      <span style={{ color: C.text }}>{name}</span>
      <span style={{ color: C.grey }}> moves in </span>{has(alone) ? `${alone}%` : "?"}
      <span style={{ color: C.grey }}> of minutes when playing alone, and in </span>{has(tog) ? `${tog}%` : "?"}
      <span style={{ color: C.grey }}> when {names[1] === name ? names[0] : names[1]} is online too.</span>
    </div>
  );
  return (
    <div style={{ ...mono, fontSize: 12 }}>
      <div style={{ color: col, marginBottom: 10, lineHeight: 1.5 }}>"{p.line}"</div>
      <div style={{ color: C.grey, marginBottom: 10, lineHeight: 1.5 }}>
        {n(m.shared_min)} minutes online together. Of the minutes Zombita could measure: both moved {n(m.both_min)},
        only {p.a} moved {n(m.only_a)}, only {p.b} moved {n(m.only_b)}, neither moved {n(m.neither)}.
      </div>
      {METRICS.map(([k, label, unit, hint]) => (
        <Bar key={k} label={label} unit={unit} hint={hint} value={m[k]} couple={cc.couple?.[k]} friends={cc.friends?.[k]}
             coupleLabel={coupleLabel} friendsLabel={friendsLabel} color={col} />
      ))}
      <div style={{ marginTop: 6, lineHeight: 1.6 }}>
        {moveLine(p.a, m.a_move_alone, m.a_move_together)}
        {moveLine(p.b, m.b_move_alone, m.b_move_together)}
        <div style={{ color: C.grey }}>Away (AFK) while both were online: {p.a} {n(m.afk_a)} min, {p.b} {n(m.afk_b)} min.</div>
        <div style={{ color: C.grey }}>Chat while both were online: {p.a} {n(m.a_lines_together)} lines, {p.b} {n(m.b_lines_together)} lines.</div>
        {!share && p.style && (
          <div style={{ color: C.grey }}>
            Writing style: {n(p.style.rank)} of {n(p.style.of)} pairs (1 = the two most alike writers on the server).
            {Array.isArray(p.style.rare_shared) && p.style.rare_shared.length > 0 && <> Rare words only these two use: <span style={{ color: C.text }}>{p.style.rare_shared.join(", ")}</span>.</>}
          </div>
        )}
        {!share && p.link && <div style={{ color: C.grey }}>Why Zombita looked: {whyLinked(p)}.</div>}
      </div>
    </div>
  );
}

export default function SecurityTab() {
  const [st, setSt] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState("");
  const [share, setShare] = useState("");
  const [form, setForm] = useState({ a: "", b: "", kind: "suspect", note: "" });

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/admin/security`, { credentials: "include", cache: "no-store" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `HTTP ${r.status}`);
      setSt(await r.json());
      setErr("");
    } catch (e) {
      setErr(String(e.message || e));
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  // while Zombita is listening, read again every 5 s
  useEffect(() => {
    if (!st?.running) return;
    const t = setTimeout(load, 5000);
    return () => clearTimeout(t);
  }, [st, load]);

  async function send(body, label) {
    setBusy(true);
    setMsg(`${label}...`);
    try {
      const r = await fetch(`${API}/api/admin/security`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`);
      setMsg(d.msg || "Done.");
      await load();
    } catch (e) {
      setMsg(`Couldn't send: ${e.message || e}`);
    }
    setBusy(false);
  }
  const sure = (q) => (typeof window !== "undefined" ? window.confirm(q) : false);
  const mark = (a, b, kind, q) => sure(q) && send({ cmd: "watch", a, b, kind, note: "" }, "Saving");

  if (err) return <div style={{ ...mono, color: C.red, padding: 12 }}>Security: {err}</div>;
  if (!st) return <div style={{ ...mono, color: C.grey, padding: 12 }}>Loading...</div>;
  const pairs = Array.isArray(st.pairs) ? st.pairs : [];
  const watch = Array.isArray(st.watch) ? st.watch : [];
  const key = (p) => `${p.a}|${p.b}`;

  // SHARE VIEW: one pair, no other names, made for a clean screenshot
  const sp = share && pairs.find((p) => key(p) === share);
  if (sp) {
    return (
      <div style={{ padding: 12, color: C.text }}>
        <button style={{ ...btn(), marginBottom: 10 }} onClick={() => setShare("")}>Close share view</button>
        <div style={{ ...mono, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, padding: 16, maxWidth: 720 }}>
          <div style={{ color: C.gold, fontSize: 16, letterSpacing: 1 }}>Zombita's Security</div>
          <div style={{ color: C.grey, fontSize: 12, marginBottom: 12 }}>
            Zombita checks every pair every night. One person can't really play two characters at once; two people can.
          </div>
          <div style={{ fontSize: 15, marginBottom: 8 }}>{sp.a} <span style={{ color: C.grey }}>and</span> {sp.b}</div>
          <Detail p={sp} controls={st.controls} share names={[sp.a, sp.b]} />
          <div style={{ color: C.grey, fontSize: 11, marginTop: 10 }}>
            Last {st.window_days || 14} days, checked {st.at ? new Date(st.at * 1000).toLocaleDateString() : "never"}.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 12, color: C.text }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ ...mono, fontSize: 13, color: C.gold }}>Zombita's Security</span>
        <span style={{ ...mono, fontSize: 12, color: C.grey }}>
          Last report: {when(st.at)} · {n(st.players_seen)} players seen · {pairs.length} pairs
        </span>
        <button style={btn(C.gold)} disabled={busy || st.running}
                onClick={() => send({ cmd: "run" }, "Asking Zombita to listen")}>{st.running ? "Listening..." : "Listen now"}</button>
      </div>
      {st.running && <div style={{ ...mono, fontSize: 12, color: C.gold, marginBottom: 8 }}>Zombita is listening. This page reads again every 5 seconds.</div>}
      {st.error && <div style={{ ...mono, fontSize: 12, color: C.red, marginBottom: 8 }}>The last run failed: {st.error}</div>}
      {msg && <div style={{ ...mono, fontSize: 12, color: C.gold, marginBottom: 8 }}>{msg}</div>}
      <p style={{ ...mono, fontSize: 12, color: C.grey, lineHeight: 1.6, marginTop: 0 }}>
        One person can't really play two characters at once; a couple or two friends can. Every night Zombita looks at the
        last {st.window_days || 14} days. When two accounts look like one home (one joined on the other's Steam account, or
        they share a home address and keep swapping logins, or one sits still next to the other), she checks every minute
        both were online: did both characters actually move, fight, drive, talk? She puts those numbers next to real couples
        and friend pairs on this server. These are facts, not proof: a couple sharing one PC can also only play one at a
        time. If you know they are two people, mark them cleared. Home addresses are never stored, only a scrambled code.
      </p>

      {GROUPS.map(([g, title, color, hint]) => {
        const rows = pairs.filter((p) => p.verdict === g);
        if (!rows.length) return null;
        return (
          <div key={g} style={{ marginTop: 14 }}>
            <div style={{ ...mono, fontSize: 13, color, borderBottom: `1px solid ${C.line}`, paddingBottom: 4 }}>
              {title} ({rows.length}) <span style={{ fontSize: 11, color: C.grey }}>{hint}</span>
            </div>
            {rows.map((p) => {
              const m = p.m || {};
              const k = key(p);
              const isOpen = open === k;
              const w = watch.find((x) => same(x, p.a, p.b));
              return (
                <div key={k} style={{ ...mono, fontSize: 12, borderBottom: `1px solid ${C.line}`, padding: "6px 0" }}>
                  <div onClick={() => setOpen(isOpen ? "" : k)} style={{ cursor: "pointer" }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                      <span style={{ color, fontSize: 13 }}>{isOpen ? "▾" : "▸"} {p.a} + {p.b}</span>
                      <span style={{ color: C.grey, fontSize: 11 }}>{whyLinked(p)}</span>
                      {w && <span style={{ color: C.gold, fontSize: 11 }}>marked {KIND_LABEL[w.kind] || w.kind}{w.by ? ` by ${w.by}` : ""}</span>}
                      {p.outside_controls && <span style={{ color: C.red, fontSize: 11 }}>below every couple and friend pair</span>}
                    </div>
                    <div style={{ color: C.text, marginTop: 3, display: "flex", gap: 14, flexWrap: "wrap" }}>
                      <span>{n(m.shared_min)} min together</span>
                      <span>both moving {has(m.both_pct) ? `${m.both_pct}%` : "?"}</span>
                      <span>longest run {n(m.longest_both)} min</span>
                      <span>kills same minute {n(m.kills_same_min)}</span>
                      <span>car together {n(m.car_together_min)} min</span>
                      <span>quick replies {n(m.quick_replies)}</span>
                      {p.style && <span>style {n(p.style.rank)} of {n(p.style.of)}</span>}
                      {p.style && Array.isArray(p.style.rare_shared) && p.style.rare_shared.length > 0 &&
                        <span style={{ color: C.grey }}>rare shared words: {p.style.rare_shared.slice(0, 5).join(", ")}</span>}
                    </div>
                    <div style={{ color, marginTop: 3 }}>"{p.line}"</div>
                  </div>
                  {isOpen && (
                    <div style={{ marginTop: 8, padding: 10, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 3 }}>
                      <div style={{ marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 4 }}>
                        <button style={btn(C.green)} disabled={busy} onClick={() => mark(p.a, p.b, "cleared", `Mark ${p.a} and ${p.b} as two people? Zombita never flags them again.`)}>Mark cleared (two people)</button>
                        <button style={btn(C.red)} disabled={busy} onClick={() => mark(p.a, p.b, "suspect", `Keep watching ${p.a} and ${p.b} as a suspect pair?`)}>Watch as suspect</button>
                        <button style={btn(C.gold)} disabled={busy} onClick={() => mark(p.a, p.b, "couple", `Use ${p.a} and ${p.b} as a real couple (the yardstick every other pair is compared with)?`)}>Mark as couple (yardstick)</button>
                        {w && <button style={btn()} disabled={busy} onClick={() => mark(p.a, p.b, "remove", `Remove the admin mark on ${p.a} and ${p.b}?`)}>Remove mark</button>}
                        <button style={btn(C.gold)} onClick={() => setShare(k)}>Share view</button>
                      </div>
                      <Detail p={p} controls={st.controls} share={false} names={[p.a, p.b]} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      {pairs.length === 0 && <div style={{ ...mono, fontSize: 12, color: C.grey, marginTop: 10 }}>No pairs yet. Press Listen now, or wait for tonight's check.</div>}

      <div style={{ marginTop: 18, ...mono, fontSize: 12 }}>
        <div style={{ color: C.gold, marginBottom: 6 }}>Add a pair</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <input style={{ ...inp, width: 130 }} placeholder="first name" value={form.a} onChange={(e) => setForm({ ...form, a: e.target.value })} />
          <input style={{ ...inp, width: 130 }} placeholder="second name" value={form.b} onChange={(e) => setForm({ ...form, b: e.target.value })} />
          <select style={inp} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="suspect">suspect (check them anyway)</option>
            <option value="couple">couple (yardstick)</option>
            <option value="friends">friends (yardstick)</option>
            <option value="cleared">cleared (two people)</option>
          </select>
          <input style={{ ...inp, width: 200 }} placeholder="note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button style={btn(C.gold)} disabled={busy || !form.a.trim() || !form.b.trim()}
                  onClick={() => send({ cmd: "watch", ...form }, "Saving").then(() => setForm({ a: "", b: "", kind: "suspect", note: "" }))}>Add</button>
        </div>
        <div style={{ color: C.grey, marginTop: 4 }}>Use the account names as they show in game. A new mark shows in the next report (Listen now to see it at once).</div>
      </div>

      {watch.length > 0 && (
        <div style={{ marginTop: 18, ...mono, fontSize: 12 }}>
          <div style={{ color: C.gold, marginBottom: 6 }}>Admin marks ({watch.length})</div>
          {watch.map((w) => (
            <div key={`${w.a}|${w.b}`} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", padding: "3px 0", borderBottom: `1px solid ${C.line}` }}>
              <span>{w.a} + {w.b}</span>
              <span style={{ color: C.gold }}>{KIND_LABEL[w.kind] || w.kind}</span>
              {w.by && <span style={{ color: C.grey }}>by {w.by}{w.at ? `, ${new Date(w.at * 1000).toLocaleDateString()}` : ""}</span>}
              {w.note && <span style={{ color: C.grey }}>"{w.note}"</span>}
              <button style={btn()} disabled={busy} onClick={() => mark(w.a, w.b, "remove", `Remove the admin mark on ${w.a} and ${w.b}?`)}>Remove</button>
            </div>
          ))}
        </div>
      )}

      <p style={{ ...mono, fontSize: 11, color: C.grey, lineHeight: 1.6, marginTop: 16 }}>
        How Zombita sorts a pair (after {st.rules?.min_shared ?? 60} minutes online together): both moving in at least
        {" "}{st.rules?.two_beat_both ?? 30}% of the minutes, or {st.rules?.two_beat_run ?? 15} minutes in a row, means two heartbeats.
        Under {st.rules?.one_beat_both ?? 15}% and never more than {st.rules?.one_beat_run ?? 5} minutes in a row means one heartbeat.
        Anything between is unclear. Linked = one joined on the other's Steam account, or the same home address plus
        {" "}{st.rules?.handovers ?? 3}+ handovers within {st.rules?.handover_min ?? 10} minutes or {st.rules?.parked ?? 2}+ times one sat
        still {st.rules?.parked_min ?? 10}+ minutes next to the other. A shared address alone never links anyone (cafes, dorms, phone networks).
      </p>
    </div>
  );
}
