// @ts-nocheck
"use client";
// components/security/ThreatCard.tsx - one player's threat card on /security: Zombita's line, the numbers, every finding
// (newest first) with what the logs show and the innocent explanations she checked, the admin buttons and who did what.
import { C, DISPLAY, SEVS, SEV_ORDER, KINDS, n, has, utc, risk, plural } from "./lib";

export function RiskChip({ r, small = false }) {
  const [, title, color] = risk(r);
  return (
    <span className={`font-mono uppercase tracking-[0.12em] whitespace-nowrap ${small ? "text-[0.6rem] px-1.5 py-[1px]" : "text-[0.68rem] px-2 py-[2px]"}`}
      style={{ color, border: `1px solid ${color}66`, background: `${color}14`, borderRadius: 2 }}>{title}</span>
  );
}

export function SevChip({ s }) {
  const [title, color] = SEVS[s] || [s, C.muted];
  return (
    <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] px-1.5 py-[1px] whitespace-nowrap"
      style={{ color, border: `1px solid ${color}77`, background: `${color}14`, borderRadius: 2 }}>{title}</span>
  );
}

export function Btn({ children, onClick, color = C.muted, disabled = false, title = "" }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className="font-mono text-[0.68rem] uppercase tracking-[0.1em] px-3 py-2 cursor-pointer disabled:opacity-40 disabled:cursor-default transition-colors"
      style={{ color, border: `1px solid ${color}88`, background: `${color}10`, borderRadius: 2 }}>{children}</button>
  );
}

const NUM_SKIP = new Set(["pair"]);
function Numbers({ nums }) {
  const ks = Object.keys(nums || {}).filter((k) => !NUM_SKIP.has(k) && has(nums[k]) && typeof nums[k] !== "object");
  if (!ks.length) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 font-mono text-[0.66rem]" style={{ color: C.muted }}>
      {ks.map((k) => <span key={k}>{k.replace(/_/g, " ")} <span style={{ color: C.text }}>{String(nums[k])}</span></span>)}
    </div>
  );
}

function Finding({ f, busy, onClear, onUnclear }) {
  const cl = f.cleared;
  const [, color] = SEVS[f.severity] || ["", C.muted];
  return (
    <div className="p-3 border" style={{ borderColor: C.line, background: C.inner, borderLeft: `3px solid ${cl ? C.line : color}`, opacity: cl ? 0.72 : 1 }}>
      <div className="flex items-start gap-2 flex-wrap">
        <SevChip s={f.severity} />
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em] pt-[2px]" style={{ color: C.muted }}>{KINDS[f.kind] || f.kind}</span>
        <span className="ml-auto font-mono text-[0.62rem]" style={{ color: C.muted }}>{f.when ? utc(f.when) : ""}</span>
      </div>
      <div className="mt-1.5 text-[0.95rem] leading-snug" style={{ color: C.bright, textDecoration: cl ? "line-through" : "none" }}>{f.title}</div>
      {Array.isArray(f.evidence) && f.evidence.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {f.evidence.map((e, i) => (
            <div key={i} className="font-mono text-[0.72rem] leading-snug break-words px-2 py-1" style={{ color: C.text, background: "#080a0c", borderLeft: `2px solid ${C.line}` }}>{e}</div>
          ))}
        </div>
      )}
      <Numbers nums={f.numbers} />
      {Array.isArray(f.innocent) && f.innocent.length > 0 && (
        <div className="mt-2 text-[0.8rem] leading-relaxed" style={{ color: C.green }}>
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em]" style={{ color: C.muted }}>Could be innocent: </span>
          {f.innocent.join(" ")}
        </div>
      )}
      {cl && (
        <div className="mt-2 text-[0.78rem]" style={{ color: C.blue }}>
          Cleared by {cl.by || "an admin"}{cl.at ? ` on ${utc(cl.at)}` : ""}{cl.note ? `: "${cl.note}"` : "."}
        </div>
      )}
      {f.severity !== "info" && (
        <div className="mt-2 flex justify-end">
          {cl
            ? <Btn disabled={busy} onClick={onUnclear}>Count it again</Btn>
            : <Btn color={C.blue} disabled={busy} onClick={onClear}>Clear finding</Btn>}
        </div>
      )}
    </div>
  );
}

function Stat({ k, v, note = "" }) {
  return (
    <div className="px-3 py-2 border min-w-0" style={{ borderColor: C.line, background: C.inner }}>
      <div className="font-mono text-[0.6rem] uppercase tracking-[0.1em] truncate" style={{ color: C.muted }}>{k}</div>
      <div className="text-[1rem] leading-tight mt-0.5" style={{ color: C.bright }}>{v}</div>
      {note && <div className="text-[0.68rem]" style={{ color: C.muted }}>{note}</div>}
    </div>
  );
}

const ACT_LABEL = { watch: "watch", unwatch: "stopped watching", clear: "cleared a finding", unclear: "counted a finding again", note: "note",
  mark: "marked for Zombita Bites", unmark: "took off Zombita Bites", kick: "asked a kick", ban: "asked a ban" };

// act(cmd, extra) asks first (Confirm) and then posts
export default function ThreatCard({ p, rep, busy, act, onReport, onBack = null }) {
  const st = p.stats || {};
  const nm = rep.norms || {};
  const [, , color] = risk(p.risk);
  const fs = [...(p.findings || [])].sort((a, b) => (b.when || 0) - (a.when || 0) || SEV_ORDER[b.severity] - SEV_ORDER[a.severity]);
  const live = fs.filter((f) => !f.cleared && f.severity !== "info");
  const quiet = fs.filter((f) => f.cleared || f.severity === "info");
  const name = p.name;
  return (
    <div>
      {onBack && <button onClick={onBack} className="lg:hidden font-mono text-[0.68rem] uppercase tracking-[0.12em] px-2 py-1 mb-4 cursor-pointer"
        style={{ color: C.muted, border: `1px solid ${C.line}`, background: "transparent", borderRadius: 2 }}>Back to the list</button>}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="leading-none break-words" style={{ fontFamily: DISPLAY, fontSize: 38, letterSpacing: 1.5, color: C.bright }}>{name}</div>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <RiskChip r={p.risk} />
            {p.watched && <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em]" style={{ color: C.gold }}>on the watch list</span>}
            {p.marked && <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em] px-1.5" style={{ color: C.red, border: `1px solid ${C.red}66` }}>marked for Zombita Bites</span>}
          </div>
        </div>
        <Btn color={C.gold} onClick={onReport}>Write case report</Btn>
      </div>

      <blockquote className="m-0 mt-4 pl-4 py-2 text-[1rem] leading-relaxed italic" style={{ borderLeft: `3px solid ${color}`, color: C.bright, background: `${color}0d` }}>
        {p.line}
        <div className="not-italic font-mono text-[0.65rem] uppercase tracking-[0.12em] mt-1" style={{ color: C.muted }}>Zombita</div>
      </blockquote>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        <Stat k="Online" v={`${n(st.online_h)} h`} note={`${plural(n(st.joins), "join")}`} />
        <Stat k="Kills an hour" v={has(st.kph) ? st.kph : "?"} note={nm.kph_median ? `server median ${nm.kph_median}` : ""} />
        <Stat k="Dawn of the Dead kills" v={n(st.kills_dotd)} note="counted apart" />
        <Stat k="Characters" v={n(st.characters)} note={has(st.hours_survived) ? `${Math.round(n(st.hours_survived))} h survived now` : ""} />
        <Stat k="First seen" v={st.first_seen ? utc(st.first_seen).slice(0, 10) : "?"} />
        <Stat k="Last seen" v={st.last_seen ? utc(st.last_seen).slice(0, 10) : "?"} />
        <Stat k="Steam" v={st.steam || "?"} note="last 4 digits" />
        <Stat k="Findings" v={`${live.length} open`} note={`${quiet.length} explained or cleared`} />
      </div>

      <section className="mt-6">
        <div className="flex items-baseline gap-3 flex-wrap border-b pb-1.5 mb-3" style={{ borderColor: C.line }}>
          <h3 className="font-mono text-[0.72rem] uppercase tracking-[0.16em] m-0" style={{ color: C.gold, fontWeight: "normal" }}>Act</h3>
          <span className="text-[0.75rem]" style={{ color: C.muted }}>Zombita states facts. Admins decide. Every button is logged with your name.</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.watched
            ? <Btn disabled={busy} onClick={() => act("unwatch", name)}>Stop watching</Btn>
            : <Btn color={C.gold} disabled={busy} onClick={() => act("watch", name)}>Watch</Btn>}
          {p.marked
            ? <Btn color={C.green} disabled={busy} onClick={() => act("unmark", name)}>Unmark (stop the hunt)</Btn>
            : <Btn color={C.red} disabled={busy} onClick={() => act("mark", name)}>Mark for Zombita Bites</Btn>}
          <Btn color={C.amber} disabled={busy} onClick={() => act("kick", name)}>Kick</Btn>
          <Btn color={C.red} disabled={busy || !rep.can_ban} title={rep.can_ban ? "" : "The bot can't ban yet: install Zombita_autokick_ban.zip"} onClick={() => act("ban", name)}>Ban</Btn>
          <Btn disabled={busy} onClick={() => act("note", name)}>Add a note</Btn>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-baseline gap-3 flex-wrap border-b pb-1.5 mb-3" style={{ borderColor: C.line }}>
          <h3 className="font-mono text-[0.72rem] uppercase tracking-[0.16em] m-0" style={{ color: C.gold, fontWeight: "normal" }}>What the logs show</h3>
          <span className="text-[0.75rem]" style={{ color: C.muted }}>Newest first. Last {rep.window_days || 14} days.</span>
        </div>
        {live.length === 0 && <p className="text-[0.85rem] m-0" style={{ color: C.muted }}>Nothing open. Zombita found nothing she can't explain.</p>}
        <div className="flex flex-col gap-2">
          {live.map((f) => <Finding key={f.id} f={f} busy={busy} onClear={() => act("clear", name, { finding: f.id, title: f.title })} onUnclear={() => act("unclear", name, { finding: f.id, title: f.title })} />)}
        </div>
        {quiet.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer font-mono text-[0.68rem] uppercase tracking-[0.12em] select-none" style={{ color: C.muted }}>
              Explained or cleared ({quiet.length})
            </summary>
            <div className="flex flex-col gap-2 mt-2">
              {quiet.map((f) => <Finding key={f.id} f={f} busy={busy} onClear={() => act("clear", name, { finding: f.id, title: f.title })} onUnclear={() => act("unclear", name, { finding: f.id, title: f.title })} />)}
            </div>
          </details>
        )}
      </section>

      {Array.isArray(p.actions) && p.actions.length > 0 && (
        <section className="mt-6">
          <div className="border-b pb-1.5 mb-3" style={{ borderColor: C.line }}>
            <h3 className="font-mono text-[0.72rem] uppercase tracking-[0.16em] m-0" style={{ color: C.gold, fontWeight: "normal" }}>Who did what</h3>
          </div>
          <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
            {[...p.actions].reverse().map((a, i) => (
              <li key={i} className="text-[0.8rem] leading-snug" style={{ color: C.text }}>
                <span className="font-mono text-[0.68rem]" style={{ color: C.muted }}>{utc(a.at)}</span>{" "}
                <span style={{ color: C.bright }}>{a.by}</span> {ACT_LABEL[a.action] || a.action}
                {a.note ? <span style={{ color: C.muted }}>: &ldquo;{a.note}&rdquo;</span> : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
