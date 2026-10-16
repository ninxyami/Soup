// @ts-nocheck
"use client";
// components/security/CaseReport.tsx - "Write case report" on /security: a Zombita case file for one player or one pair,
// in the look of the Hunk + OperatoR report (portrait header, numbered sections of facts, the comparison with normal
// players, Zombita's decision box). Print / save as PDF uses the browser's print. Share mode hides every other player's
// name, Steam digits and admin names, so the file can be shown to the player it is about.
import { useMemo, useState } from "react";
import { SEVS, SEV_ORDER, KINDS, n, has, utc, utcTime, acct, gapText, plural, hideNames, risk } from "./lib";

const CSS = `
.zcf { --bg:#0e0e0e; --surface:#0d1117; --border:#1e2530; --line:#1a1a1a; --text:#c8cdd6; --bright:#e6e8ec; --muted:#8a8f98; --dim:#555;
  --gold:#c8a84b; --danger:#e05555; --success:#4caf7d; --display:'Bebas Neue', Impact, sans-serif; --mono:'Share Tech Mono', ui-monospace, Consolas, monospace;
  --body:'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  background: var(--bg); color: var(--text); font-family: var(--body); font-size: 15px; line-height: 1.65; min-height: 100vh; }
.zcf * { box-sizing: border-box; }
.zcf main { max-width: 860px; margin: 0 auto; padding: 24px 16px 56px; }
.zcf .bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
.zcf .bar button { font-family: var(--mono); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; padding: 7px 12px; cursor: pointer;
  color: var(--muted); border: 1px solid var(--border); background: transparent; border-radius: 2px; }
.zcf .bar button.on, .zcf .bar button.gold { color: var(--gold); border-color: var(--gold); background: rgba(200,168,75,.08); }
.zcf .hero { display: grid; grid-template-columns: 150px 1fr; gap: 24px; align-items: center; }
.zcf .hero img { width: 150px; height: 150px; object-fit: cover; border-radius: 50%; border: 2px solid rgba(200,168,75,.35); }
.zcf .who { font-family: var(--display); font-size: 52px; letter-spacing: .15em; color: #e6e6e6; line-height: 1; }
.zcf .sub { font-family: var(--mono); font-size: 12.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--dim); margin-top: 6px; }
.zcf .case { font-family: var(--display); font-size: 34px; letter-spacing: .08em; color: var(--bright); line-height: 1.05; margin-top: 14px; word-break: break-word; }
.zcf .meta { font-family: var(--mono); font-size: 11.5px; color: #6b7280; margin-top: 6px; display: flex; flex-wrap: wrap; gap: 2px 16px; }
.zcf .divider { height: 1px; background: #222; margin: 28px 0; }
.zcf .say { border: 1px solid var(--line); padding: 14px 16px; color: var(--text); }
.zcf .say .tag { font-family: var(--mono); font-size: 10.5px; letter-spacing: .08em; color: #555; display: block; margin-bottom: 4px; }
.zcf section { margin-top: 34px; display: grid; gap: 12px; }
.zcf h2 { margin: 0; font-family: var(--mono); font-weight: 400; font-size: 13px; letter-spacing: .15em; text-transform: uppercase; color: var(--gold);
  display: flex; gap: 12px; align-items: baseline; }
.zcf h2 .n { color: var(--dim); }
.zcf p { margin: 0; max-width: 68ch; }
.zcf .muted { color: var(--muted); font-size: 14px; }
.zcf .card { background: var(--surface); border: 1px solid var(--border); padding: 14px 16px; min-width: 0; }
.zcf .card.red { border-top: 3px solid #9e2a2b; }
.zcf .card.gold { border-top: 3px solid var(--gold); }
.zcf .src { display: block; font-family: var(--mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: #6b7280; margin-bottom: 6px; }
.zcf .ttl { color: var(--bright); font-size: 16px; }
.zcf .ev { font-family: var(--mono); font-size: 12.5px; color: #b0b0b0; margin-top: 8px; display: grid; gap: 4px; word-break: break-word; }
.zcf .quote { font-family: var(--mono); font-size: 15.5px; color: var(--bright); word-break: break-word; }
.zcf .quote mark { background: transparent; color: var(--danger); }
.zcf .tbl { overflow-x: auto; border: 1px solid var(--border); background: var(--surface); }
.zcf table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.zcf th { text-align: left; padding: 8px 12px; font-family: var(--mono); font-weight: 400; font-size: 11px; letter-spacing: .1em; text-transform: uppercase;
  color: #6b7280; border-bottom: 1px solid #2a2a2a; white-space: nowrap; }
.zcf td { padding: 8px 12px; border-bottom: 1px solid var(--line); color: #b0b0b0; }
.zcf tr:last-child td { border-bottom: 0; }
.zcf td.g { color: var(--gold); } .zcf td.r { color: var(--danger); }
.zcf td .sub2 { display: block; color: #6b7280; font-size: 11.5px; }
.zcf tr.you td { color: var(--danger); background: rgba(224,85,85,.06); }
.zcf .bars { display: grid; gap: 18px; min-width: 0; overflow: hidden; }
.zcf .m .lbl { font-family: var(--mono); font-size: 11.5px; letter-spacing: .1em; text-transform: uppercase; color: #6b7280; margin-bottom: 6px; }
.zcf .row { display: grid; grid-template-columns: 170px minmax(0,1fr) 70px; gap: 12px; align-items: center; font-size: 13px; padding: 3px 0; }
.zcf .row .k { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.zcf .row .v { text-align: right; font-family: var(--mono); color: #b0b0b0; }
.zcf .track { position: relative; height: 10px; background: #141414; border: 1px solid #222; }
.zcf .fill { position: absolute; top: 0; bottom: 0; left: 0; background: var(--success); }
.zcf .row.you .k, .zcf .row.you .v { color: var(--danger); }
.zcf .row.you .fill { background: var(--danger); min-width: 2px; }
.zcf ul.facts { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.zcf ul.facts li { padding-left: 16px; position: relative; color: var(--bright); font-size: 14px; }
.zcf ul.facts li::before { content: "-"; position: absolute; left: 0; color: var(--success); }
.zcf ul.facts.red li::before { color: var(--danger); }
.zcf .decide { display: grid; grid-template-columns: 88px 1fr; gap: 16px; align-items: start; }
.zcf .decide img { width: 88px; height: 88px; object-fit: cover; object-position: top; border: 1px solid var(--border); }
.zcf .decide .title { font-family: var(--display); font-size: 28px; letter-spacing: .1em; color: var(--gold); line-height: 1; margin-bottom: 8px; }
.zcf .decide ul { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 6px; }
.zcf .decide li { padding-left: 16px; position: relative; color: var(--bright); }
.zcf .decide li::before { content: "-"; position: absolute; left: 0; color: var(--dim); }
.zcf .note { margin-top: 12px; font-family: var(--mono); font-size: 12px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 10px; }
.zcf footer { margin-top: 40px; border-top: 1px solid #222; padding-top: 14px; font-family: var(--mono); font-size: 11.5px; color: var(--dim); display: grid; gap: 4px; }
@media (max-width: 600px) {
  .zcf .hero { grid-template-columns: 84px 1fr; gap: 14px; }
  .zcf .hero img { width: 84px; height: 84px; }
  .zcf .who { font-size: 36px; } .zcf .case { font-size: 26px; }
  .zcf .row { grid-template-columns: 96px minmax(0,1fr) 64px; gap: 8px; }
  .zcf .decide { grid-template-columns: 60px 1fr; } .zcf .decide img { width: 60px; height: 60px; }
  .zcf th, .zcf td { padding: 6px 8px; }
}
@page { size: A4; margin: 0; }
@media print {
  html, body { background: #0e0e0e !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body * { visibility: hidden !important; }
  .zcf, .zcf * { visibility: visible !important; }
  .zcf { position: absolute; left: 0; top: 0; width: 100%; }
  .zcf .noprint { display: none !important; }
  .zcf main { max-width: none; padding: 12mm; }
  .zcf .card, .zcf .tbl, .zcf .say, .zcf h2, .zcf .decide { break-inside: avoid; }
  .zcf h2 { break-after: avoid; }
  .zcf .tbl { overflow: visible; }
}
`;

const PORTRAITS = { serious: "/avatars/stern_02.webp", suspicious: "/avatars/thinking_01.webp", watch: "/avatars/looking_left.webp", clean: "/avatars/smile_01.webp" };

function Bars({ label, rows, unit = "" }) {
  const top = Math.max(1, ...rows.map((r) => n(r.v))) * 1.05;
  return (
    <div className="m">
      <div className="lbl">{label}</div>
      {rows.map((r, i) => (
        <div key={i} className={`row${r.you ? " you" : ""}`}>
          <span className="k" title={r.k}>{r.k}</span>
          <span className="track"><span className="fill" style={{ width: `${Math.min(100, (100 * n(r.v)) / top)}%` }} /></span>
          <span className="v">{has(r.v) ? `${r.v}${unit}` : "?"}</span>
        </div>
      ))}
    </div>
  );
}

function Shell({ title, sub, portrait, onClose, share, setShare, children, date }) {
  return (
    <div className="zcf">
      <style>{CSS}</style>
      <main>
        <div className="bar noprint">
          <button onClick={onClose}>Back</button>
          <button className={share ? "on" : ""} onClick={() => setShare(!share)}>{share ? "Share mode: on" : "Share mode: off"}</button>
          <button className="gold" onClick={() => window.print()}>Print / save as PDF</button>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", alignSelf: "center" }}>
            {share ? "Other players' names, Steam digits and admin names are hidden." : "Admin view: everything shown."}
          </span>
        </div>
        <div className="hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={portrait} alt="Zombita" />
          <div>
            <div className="who">ZOMBITA</div>
            <div className="sub">Security · Case file · State of Undead Purge</div>
            <div className="case">{title}</div>
            <div className="meta"><span>Written by Zombita · {date}</span><span>All times UTC</span><span>{sub}</span></div>
          </div>
        </div>
        <div className="divider" />
        {children}
      </main>
    </div>
  );
}

function Decision({ lines, who, portrait }) {
  return (
    <section>
      <div className="card gold decide">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={portrait} alt="Zombita" />
        <div>
          <div className="title">ZOMBITA&apos;S DECISION</div>
          <p>This is my recommendation from the logs. The admin team decides{who ? `, and can ask ${who} first` : ""}.</p>
          <ul>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
          <div className="note">I state what the logs show. I never decide who someone is; people do.</div>
        </div>
      </div>
    </section>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

// ---------------- one player ----------------
function PlayerReport({ p, rep, sec, onClose }) {
  const [share, setShare] = useState(false);
  const all = useMemo(() => [...(rep.players || []).map((x) => x.name), ...(rep.staff || []), ...((sec?.pairs) || []).flatMap((x) => [x.a, x.b])], [rep, sec]);
  const H = (t) => (share ? hideNames(t, [p.name], all) : String(t ?? ""));
  const st = p.stats || {};
  const nm = rep.norms || {};
  const live = (p.findings || []).filter((f) => !f.cleared && f.severity !== "info")
    .sort((a, b) => SEV_ORDER[b.severity] - SEV_ORDER[a.severity] || (b.when || 0) - (a.when || 0));
  const quiet = (p.findings || []).filter((f) => f.cleared || f.severity === "info");
  const innocent = [...new Set(live.flatMap((f) => f.innocent || []))];
  const fresh = live.find((f) => has(f.numbers?.skill_total));
  const ac = Object.entries(st.anticheat || {}).filter(([, v]) => n(v) > 0);
  const portrait = PORTRAITS[p.risk] || PORTRAITS.watch;
  let k = 0;
  const num = () => String(++k).padStart(2, "0");
  const tops = live.slice(0, 3).map((f) => H(f.title));
  const dec = p.risk === "serious"
    ? [`The logs show things normal play can't do: ${tops.join("; ")}.`,
      p.marked ? "The character is already marked for Zombita Bites; let the hunt run." : "Mark the character for Zombita Bites. It hunts that character only; the next one plays clean.",
      "If it happens again on a new character, ban the account."]
    : p.risk === "suspicious"
      ? [`Ask ${p.name} about: ${tops.join("; ")}.`, "Watch the account for a week. I check it again every night.", "No punishment from these logs alone."]
      : p.risk === "watch"
        ? ["Nothing to do now. I keep watching.", ...(tops.length ? [`Worth a look: ${tops.join("; ")}.`] : [])]
        : [`Nothing to do. ${p.name} plays like everyone else here.`];
  if (live.some((f) => f.kind === "household")) dec.push("For the linked accounts: ask both to play at the same time while an admin watches. Two people manage that in minutes.");
  return (
    <Shell title={p.name.toUpperCase()} sub="From this server's logs, positions and money records" portrait={portrait} onClose={onClose} share={share} setShare={setShare} date={today()}>
      <div className="say"><span className="tag">ZOMBITA</span>
        {H(p.line)} Here is everything this server wrote down about {p.name} in the last {rep.window_days || 14} days, with the times, so you can check every line yourself.
      </div>

      <section>
        <h2><span className="n">{num()}</span>Who</h2>
        <div className="tbl"><table><tbody>
          <tr><td>Account</td><td className="g">{p.name}</td></tr>
          {!share && <tr><td>Steam</td><td>{st.steam || "?"} <span className="sub2">last 4 digits</span></td></tr>}
          <tr><td>First seen</td><td>{st.first_seen ? utc(st.first_seen) : "?"}</td></tr>
          <tr><td>Last seen</td><td>{st.last_seen ? utc(st.last_seen) : "?"}</td></tr>
          <tr><td>Online</td><td>{n(st.online_h)} h, {plural(n(st.joins), "join")}</td></tr>
          <tr><td>Characters</td><td>{n(st.characters)}{has(st.hours_survived) ? `, the current one ${Math.round(n(st.hours_survived))} h survived` : ""}</td></tr>
          <tr><td>Status</td><td className={p.risk === "serious" || p.risk === "suspicious" ? "r" : ""}>{risk(p.risk)[1]}{p.marked ? ", marked for Zombita Bites" : ""}{p.watched ? ", on the watch list" : ""}</td></tr>
        </tbody></table></div>
      </section>

      <section>
        <h2><span className="n">{num()}</span>What the logs show</h2>
        {live.length === 0 && <p className="muted">Nothing I can&apos;t explain.</p>}
        {live.map((f) => (
          <div key={f.id} className={`card${f.severity === "critical" || f.severity === "serious" ? " red" : ""}`}>
            <span className="src">{f.when ? utc(f.when) : "over the window"} · {KINDS[f.kind] || f.kind} · {(SEVS[f.severity] || [f.severity])[0]}</span>
            <div className="ttl">{H(f.title)}</div>
            {(f.evidence || []).length > 0 && <div className="ev">{f.evidence.map((e, i) => <div key={i}>{H(e)}</div>)}</div>}
          </div>
        ))}
      </section>

      <section>
        <h2><span className="n">{num()}</span>Next to everyone else</h2>
        <div className="card bars">
          {has(st.kph) && (
            <Bars label="Kills an hour, outside Dawn of the Dead" rows={[
              { k: "Server median", v: nm.kph_median }, { k: "Top 10% start at", v: nm.kph_p90 }, { k: p.name, v: st.kph, you: true }]} />
          )}
          {fresh && (
            <Bars label="Skill levels on a brand new character" rows={[
              { k: "Most new characters", v: nm.fresh_total_p90 }, { k: p.name, v: fresh.numbers.skill_total, you: true }]} />
          )}
          {ac.length > 0 && (
            <Bars label="Anti-cheat flags left after the known false alarms" rows={[{ k: "Most players", v: 0 }, ...ac.map(([t, v]) => ({ k: `${p.name}: ${t}`, v, you: true }))]} />
          )}
          {!has(st.kph) && !fresh && !ac.length && <p className="muted">Nothing to compare: too little play time in the window.</p>}
        </div>
        {n(st.kills_dotd) > 0 && <p className="muted">{n(st.kills_dotd)} kills during Dawn of the Dead nights are left out of the rate: those nights make huge numbers normal.</p>}
      </section>

      {(innocent.length > 0 || quiet.length > 0) && (
        <section>
          <h2><span className="n">{num()}</span>What could be innocent</h2>
          {innocent.length > 0 && <div className="card"><ul className="facts">{innocent.map((t, i) => <li key={i}>{H(t)}</li>)}</ul></div>}
          {quiet.length > 0 && (
            <div className="card">
              <span className="src">Checked and explained, or cleared by an admin</span>
              <ul className="facts">
                {quiet.map((f) => (
                  <li key={f.id}>{H(f.title)}{f.cleared ? ` (cleared${share ? "" : ` by ${f.cleared.by}`}${f.cleared.note ? `: "${H(f.cleared.note)}"` : ""})` : (f.innocent || []).length ? `: ${H(f.innocent[0])}` : ""}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {Array.isArray(p.actions) && p.actions.length > 0 && (
        <section>
          <h2><span className="n">{num()}</span>What the admins did</h2>
          <div className="tbl"><table>
            <thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead>
            <tbody>{[...p.actions].reverse().map((a, i) => (
              <tr key={i}><td>{utc(a.at)}</td><td>{share ? "an admin" : a.by}</td><td>{a.action}{a.note ? `: ${H(a.note)}` : ""}</td></tr>
            ))}</tbody>
          </table></div>
        </section>
      )}

      <Decision lines={dec} who={p.name} portrait="/avatars/stern_01.webp" />
      <footer>
        <span>Zombita&apos;s Security · State of Undead Purge · {today()}</span>
        <span>Facts from this server&apos;s join, chat, skill, anti-cheat, admin and money logs. Addresses are never stored.</span>
      </footer>
    </Shell>
  );
}

// ---------------- one pair ----------------
const PAIR_DEC = {
  one: ["Only one of the two names was really played at a time, again and again.",
    "Ask them to play both characters at the same time while an admin watches. Two people manage that in minutes.",
    "Until then keep them on the suspect list. If they are a couple sharing one PC, mark them cleared."],
  unclear: ["Keep listening. The logs don't say it either way yet."],
  two: ["Both characters play at the same time: two people. Mark them cleared."],
  listening: ["Not enough time online together yet. I keep listening."],
  cleared: ["An admin already confirmed two people. Nothing to do."],
  control: ["This pair is a yardstick. Nothing to do."],
};

function PairReport({ p, rep, sec, onClose }) {
  const [share, setShare] = useState(false);
  const all = useMemo(() => [...(rep?.players || []).map((x) => x.name), ...(rep?.staff || []), ...((sec?.pairs) || []).flatMap((x) => [x.a, x.b])], [rep, sec]);
  const H = (t) => (share ? hideNames(t, [p.a, p.b], all) : String(t ?? ""));
  const m = p.m || {};
  const sw = p.switches || {};
  const words = Array.isArray(p.own_words) ? p.own_words : [];
  const minShared = sec?.rules?.min_shared ?? 60;
  const controls = ((sec?.pairs) || []).filter((x) => (x.kind === "couple" || x.kind === "friends") && n(x.m?.shared_min) >= minShared);
  let fi = 0;
  const cname = (x) => (share ? (x.kind === "couple" ? "a real couple" : `friend pair ${++fi}`) : `${x.a} + ${x.b}`);
  const crow = controls.map((x) => ({ x, label: cname(x) }));
  const other = ((rep?.players) || []).filter((x) => [p.a, p.b].some((y) => y.toLowerCase() === x.name.toLowerCase()))
    .flatMap((x) => (x.findings || []).filter((f) => !f.cleared && f.severity !== "info" && f.kind !== "household"));
  const portrait = p.verdict === "one" ? "/avatars/thinking_01.webp" : "/avatars/smile_01.webp";
  let k = 0;
  const num = () => String(++k).padStart(2, "0");
  return (
    <Shell title={`${p.a} AND ${p.b}`.toUpperCase()} sub="From this server's join, chat and position logs" portrait={portrait} onClose={onClose} share={share} setShare={setShare} date={today()}>
      <div className="say"><span className="tag">ZOMBITA</span>
        {H(p.line)} Here is what this server wrote down about these two names, with the times, so you can check every line yourself.
      </div>

      {words.length > 0 && (
        <section>
          <h2><span className="n">{num()}</span>In their own words</h2>
          {words.map((h, i) => (
            <div key={i} className={`card quote${h.first_join_after ? " red" : ""}`}>
              <span className="src">{utc(h.ts)} · {h.channel} chat · {h.name}</span>
              {H(h.text)}
              {h.first_join_after && <div className="muted" style={{ marginTop: 8, color: "var(--danger)", fontFamily: "var(--body)" }}>
                {h.first_join_after.name} joined this server for the first time {plural(n(h.first_join_after.minutes_after), "minute")} later.</div>}
            </div>
          ))}
        </section>
      )}

      {sw && n(sw.n) > 0 && (
        <section>
          <h2><span className="n">{num()}</span>One name out, the other in</h2>
          <p>{plural(n(sw.n), "time")} one name left and the other came in within 10 minutes. {n(sw.same_account)} of them on the same Steam account
            {n(sw.quick_same) ? `, ${n(sw.quick_same)} within 2 minutes` : ""}.</p>
          <div className="tbl"><table>
            <thead><tr><th>Logged out</th><th>Logged in</th><th>Gap</th><th>Steam account</th><th>Where</th></tr></thead>
            <tbody>{(sw.list || []).map((r, i) => (
              <tr key={i}>
                <td>{r.out} · {utcTime(r.out_ts)}</td><td>{r.in} · {utcTime(r.in_ts)}</td>
                <td className={r.quick_same ? "g" : ""}>{gapText(r.gap_sec)}</td>
                <td className={r.same_account ? "r" : ""}>{r.same_account ? `same${share ? "" : ` (${acct(r.steam_in)})`}` : "different"}</td>
                <td className={has(r.dist) && n(r.dist) === 0 ? "g" : ""}>{has(r.dist) ? (n(r.dist) === 0 ? "same tile" : `${r.dist} tiles`) : "?"}</td>
              </tr>
            ))}</tbody>
          </table></div>
          {n(sw.both_in_same_home_min) > 0 && <p className="muted">Both were in game at the same time on different Steam accounts from the same home {plural(n(sw.both_in_same_home_times), "time")} ({n(sw.both_in_same_home_min)} min).</p>}
        </section>
      )}

      <section>
        <h2><span className="n">{num()}</span>How real people play together</h2>
        <p>For every minute two people were online together, I checked whether both characters were actually moving. Here are the real couples and friend pairs on this server next to these two.</p>
        <div className="card bars">
          <Bars label="Minutes where both characters moved" unit="%" rows={[...crow.map(({ x, label }) => ({ k: label, v: x.m?.both_pct })), { k: `${p.a} + ${p.b}`, v: m.both_pct, you: true }]} />
        </div>
        <div className="tbl"><table>
          <thead><tr><th>Pair</th><th>Both moving</th><th>Longest run</th><th>Kills same min</th><th>Same car</th><th>Quick replies</th></tr></thead>
          <tbody>
            {crow.map(({ x, label }, i) => (
              <tr key={i}><td>{label}{!share && <span className="sub2">{x.kind === "couple" ? "a real couple" : "friends"}</span>}</td><td>{x.m?.both_pct ?? "?"}%</td>
                <td>{n(x.m?.longest_both)} min</td><td>{n(x.m?.kills_same_min)}</td><td>{n(x.m?.car_together_min)} min</td><td>{n(x.m?.quick_replies)}</td></tr>
            ))}
            <tr className="you"><td>{p.a} + {p.b}</td><td>{m.both_pct ?? "?"}%</td><td>{n(m.longest_both)} min</td><td>{n(m.kills_same_min)}</td><td>{n(m.car_together_min)} min</td><td>{n(m.quick_replies)}</td></tr>
          </tbody>
        </table></div>
        <p className="muted">{n(m.shared_min)} minutes online together in the last {sec?.window_days || 14} days.</p>
      </section>

      {other.length > 0 && (
        <section>
          <h2><span className="n">{num()}</span>What else the logs show</h2>
          {other.map((f) => (
            <div key={f.id} className={`card${f.severity === "critical" || f.severity === "serious" ? " red" : ""}`}>
              <span className="src">{f.player} · {f.when ? utc(f.when) : "over the window"} · {KINDS[f.kind] || f.kind}</span>
              <div className="ttl">{H(f.title)}</div>
              {(f.evidence || []).length > 0 && <div className="ev">{f.evidence.map((e, i) => <div key={i}>{H(e)}</div>)}</div>}
            </div>
          ))}
        </section>
      )}

      <section>
        <h2><span className="n">{num()}</span>What could be innocent</h2>
        <div className="card"><ul className="facts">
          <li>A couple sharing ONE PC also plays one character at a time. The numbers can&apos;t tell them apart from one person with two names.</li>
          <li>Two people who live together share one home address. That alone never links anyone.</li>
        </ul></div>
      </section>

      <Decision lines={PAIR_DEC[p.verdict] || PAIR_DEC.listening} who="" portrait="/avatars/stern_01.webp" />
      <footer>
        <span>Zombita&apos;s Security · State of Undead Purge · {today()}</span>
        <span>Facts from this server&apos;s join, chat and position logs. Addresses are never stored, only a scrambled code.</span>
      </footer>
    </Shell>
  );
}

export default function CaseReport({ what, rep, sec, onClose }) {
  if (!what) return null;
  return what.kind === "pair"
    ? <PairReport p={what.subject} rep={rep} sec={sec} onClose={onClose} />
    : <PlayerReport p={what.subject} rep={rep} sec={sec} onClose={onClose} />;
}
