// @ts-nocheck
"use client";
// components/security/BanWatch.tsx - the Ban watch tab of /security (2026-11-02, Nin: Wicked stays out, even on an alt). The bot
// (zombita_ban_watch.py) checks every connection and every account link against this list and the game's ban tables, and tells the
// admin channel within seconds. This tab keeps the list and shows what matched. Addresses are scrambled the moment they are saved
// and never come back: only a short code shows. Zombita says what matched; nothing here kicks or bans.
import { useCallback, useEffect, useState } from "react";
import { Box } from "./Panels";
import { Btn } from "./ThreatCard";
import { C, plural, utc, when, getBanWatch, postBanWatch } from "./lib";

const inp = "font-mono text-[0.8rem] px-2.5 py-2 outline-none w-full";
const inpStyle = { background: "#080a0c", color: C.bright, border: `1px solid ${C.line}`, borderRadius: 2 };
const EMPTY = { id: "", steam: "", address: "", discord: "", name: "", note: "", low: false };

const STAGE = { connect: ["Connecting", C.amber], ingame: ["In game", C.red], refused: ["Refused by the game", C.muted], link: ["Linking an account", C.gold] };
const LABEL = { steam: "Steam ID", owner: "Family-share owner", address: "Address", discord: "Discord ID", name: "Name" };

function matchText(m) {
  if (m.src === "connection") return "This name matched when it connected";
  const from = m.src === "list" ? `on the list for ${m.who}` : `banned in the game${m.who ? ` (${m.who})` : ""}`;
  const low = m.conf === "low" ? `, low confidence${m.note ? `: ${m.note}` : ""}` : "";
  return `${LABEL[m.kind] || m.kind}: ${from}${low}`;
}

function Chip({ text, title = "", color = C.text, onRemove = null, disabled = false }) {
  return (
    <span title={title} className="inline-flex items-center gap-1.5 font-mono text-[0.72rem] px-2 py-1 max-w-full"
      style={{ color, border: `1px solid ${C.line}`, background: C.inner, borderRadius: 2 }}>
      <span className="truncate">{text}</span>
      {onRemove && (
        <button onClick={onRemove} disabled={disabled} aria-label={`Remove ${text}`} className="cursor-pointer disabled:cursor-default"
          style={{ color: C.muted, background: "transparent", border: 0, padding: 0 }}>x</button>
      )}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label className="block min-w-0">
      <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em]" style={{ color: C.muted }}>{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Status({ d }) {
  const look = d.look || {};
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1.5 font-mono text-[0.72rem]" style={{ color: C.muted }}>
      {!d.on && <span style={{ color: C.amber }}>The live check is switched off on the bot.</span>}
      {look.at ? (
        <span style={{ color: d.stale ? C.red : C.muted }}>Last look <span style={{ color: d.stale ? C.red : C.text }}>{when(look.at)}</span></span>
      ) : <span style={{ color: C.amber }}>The watch hasn&apos;t looked yet.</span>}
      {look.at ? <span>Connections read <span style={{ color: C.text }}>{look.joins || 0}</span></span> : null}
      {d.bans?.ok
        ? <span>Also checked from the game <span style={{ color: C.text }}>{plural(d.bans.steam, "banned Steam ID")}, {plural(d.bans.address, "banned address", "banned addresses")}</span></span>
        : <span style={{ color: C.red }}>Can&apos;t read the game&apos;s ban tables.</span>}
    </div>
  );
}

function Hit({ h, busy, onClear, cleared }) {
  const [label, color] = STAGE[h.stage] || [h.stage, C.muted];
  const low = (h.matched || []).some((m) => m.conf === "low");
  return (
    <div className="py-2.5 border-b last:border-b-0" style={{ borderColor: C.line }}>
      <div className="flex items-baseline gap-x-3 gap-y-1 flex-wrap">
        <span className="text-[0.92rem]" style={{ color: C.bright }}>{h.name || "No name yet"}</span>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em] px-1.5" style={{ color, border: `1px solid ${color}66` }}>{label}</span>
        <span className="font-mono text-[0.7rem]" style={{ color: C.muted }}>{utc(h.ts)}</span>
        {h.delivered === "capped" && <span className="font-mono text-[0.68rem]" style={{ color: C.amber }}>past the hour&apos;s alert limit: this page only</span>}
        {h.delivered === "failed" && <span className="font-mono text-[0.68rem]" style={{ color: C.red }}>the alert didn&apos;t send</span>}
      </div>
      <div className="flex gap-x-4 flex-wrap font-mono text-[0.72rem] mt-1" style={{ color: C.muted }}>
        {h.steam && <span>Steam {h.steam}</span>}
        {h.owner && <span>Owner {h.owner}</span>}
        {h.discord && <span>Discord {h.discord}</span>}
        {h.ip && <span title="A scrambled code. The address itself is never stored.">Address code {h.ip}</span>}
        {h.via && <span>Through {h.via}</span>}
        {h.where && <span>{h.where}</span>}
      </div>
      <ul className="m-0 mt-1.5 pl-4 text-[0.85rem]" style={{ color: C.text }}>
        {(h.matched || []).map((m, i) => <li key={i}>{matchText(m)}</li>)}
      </ul>
      {h.address_only && (
        <p className="m-0 mt-1 text-[0.8rem]" style={{ color: C.muted }}>
          Address only: it could be a housemate or a shared connection.{h.via === "Steam" ? " It came over Steam's relay, so the address may be the relay's." : ""}
          {low ? " Low confidence on top of that." : ""}
        </p>
      )}
      {h.address_only && !cleared && (
        <div className="mt-2"><Btn color={C.blue} disabled={busy} onClick={() => onClear(h)}>Known housemate</Btn></div>
      )}
    </div>
  );
}

export default function BanWatch({ ask }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    try {
      setD(await getBanWatch());
      setErr("");
    } catch (e) {
      setErr(String(e.message || e));
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  async function send(body, label) {
    setBusy(true);
    setMsg(`${label}...`);
    try {
      const r = await postBanWatch(body);
      setMsg(r.msg || "Saved.");
      await load();
      return true;
    } catch (e) {
      setMsg(`Couldn't save: ${e.message || e}`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const save = async () => {
    if (await send({ cmd: "add", ...form }, "Saving")) setForm(EMPTY);
  };
  const removeEntry = async (e) => {
    const lines = [`${e.name || "This entry"} comes off the ban watch. Connections stop being checked against it. The game's own bans don't change.`];
    if ((e.discord || []).length) lines.push("Its Discord ID loses its protection too: that Discord account can rename itself again, and an admin can clear its whitelist row.");
    if ((await ask({ title: "Take this off the watch", color: C.amber, yes: "Take it off", lines })) === null) return;
    send({ cmd: "remove", id: e.id, name: e.name }, "Saving");
  };
  const removeValue = async (e, kind, value, shown) => {
    const lines = [`${shown} comes off this entry.`];
    if (kind === "discord") lines.push("That Discord account can rename itself again, and an admin can clear its whitelist row.");
    if ((await ask({ title: "Take this off the entry", color: C.amber, yes: "Take it off", lines })) === null) return;
    send({ cmd: "remove", id: e.id, kind, value, name: e.name }, "Saving");
  };
  const clearHit = async (h) => {
    const note = await ask({
      title: `Known housemate: ${h.name || "this account"}`, color: C.blue, yes: "Clear",
      lines: ["Address matches on this account stop, on Discord and here. A match on Steam ID, family-share owner or Discord ID still alerts. Count it again any time below."],
      note: { label: "Why it's fine (admins only)", placeholder: "e.g. his sister, confirmed in a ticket" },
    });
    if (note === null) return;
    send({ cmd: "clear", name: h.name, steam: h.steam, note }, "Saving");
  };

  if (!d) return <p className="text-[0.85rem] m-0" style={{ color: err ? C.red : C.muted }}>{err ? `Can't read the ban watch: ${err}` : "Loading..."}</p>;

  const isCleared = (h) => (d.cleared || []).some((c) => (h.steam && c.steam ? c.steam === h.steam : !!h.name && String(c.name).toLowerCase() === h.name.toLowerCase()));
  const adding = form.id ? (d.entries || []).find((e) => e.id === form.id) : null;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Status d={d} />
        {d.stale && <p className="m-0 text-[0.85rem]" style={{ color: C.red }}>The watch has stopped looking. Connections aren&apos;t being checked right now.</p>}
        {msg && <div className="font-mono text-[0.78rem]" style={{ color: msg.startsWith("Couldn't") ? C.red : C.gold }}>{msg}</div>}
        {err && <div className="font-mono text-[0.78rem]" style={{ color: C.red }}>Can&apos;t read the ban watch: {err}</div>}
      </div>

      <Box title="What matched" note={`Newest first. One alert per account, stage and match every ${d.rules?.repeat_hours || 6} hours.`}>
        {(d.hits || []).length
          ? (d.hits || []).map((h, i) => <Hit key={i} h={h} busy={busy} onClear={clearHit} cleared={isCleared(h)} />)
          : <p className="text-[0.85rem] m-0" style={{ color: C.muted }}>Nothing has matched yet.</p>}
      </Box>

      <div className="grid gap-6 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_380px] items-start">
        <Box title="The watch list" note="The game's bans are checked without being listed here.">
          {(d.entries || []).length === 0 && <p className="text-[0.85rem] m-0" style={{ color: C.muted }}>The list is empty.</p>}
          {(d.entries || []).map((e) => (
            <div key={e.id} className="py-3 border-b last:border-b-0" style={{ borderColor: C.line }}>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-[0.95rem]" style={{ color: C.bright }}>{e.name || "No name"}</span>
                <span className="font-mono text-[0.66rem]" style={{ color: C.muted }}>{e.by ? `added by ${e.by}, ` : ""}{utc(e.at)}</span>
              </div>
              {e.note && <p className="m-0 mt-1 text-[0.82rem]" style={{ color: C.text }}>{e.note}</p>}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(e.steam || []).map((s) => <Chip key={s} text={`Steam ${s}`} disabled={busy} onRemove={() => removeValue(e, "steam", s, `Steam ID ${s}`)} />)}
                {(e.discord || []).map((s) => <Chip key={s} text={`Discord ${s}`} disabled={busy} onRemove={() => removeValue(e, "discord", s, `Discord ID ${s}`)} />)}
                {(e.ips || []).map((x) => (
                  <Chip key={x.h} text={`Address ${x.h}${x.conf === "low" ? " (low)" : ""}`} title={x.note || "A scrambled code. The address itself is never stored."}
                    color={x.conf === "low" ? C.muted : C.text} disabled={busy} onRemove={() => removeValue(e, "address", x.h, `Address ${x.h}`)} />
                ))}
              </div>
              {(e.links || []).map((l) => (l.row === undefined || l.row === null ? null : (
                <p key={l.discord} className="m-0 mt-2 font-mono text-[0.72rem]" style={{ color: l.row ? C.muted : C.red }}>
                  {l.row ? `Whitelist row kept: ${l.row}. It stops this Discord account linking another game name.` : "Whitelist row is empty: this Discord account can link another game name."}
                </p>
              )))}
              <div className="flex flex-wrap gap-2 mt-2.5">
                <Btn disabled={busy} onClick={() => setForm({ ...EMPTY, id: e.id })}>Add to this</Btn>
                <Btn color={C.amber} disabled={busy} onClick={() => removeEntry(e)}>Take it off</Btn>
              </div>
            </div>
          ))}
        </Box>

        <Box title={adding ? `Add to ${adding.name || "this entry"}` : "Add to the watch"} note="Any of these is enough.">
          <div className="flex flex-col gap-3">
            <Field label="Steam ID"><input className={inp} style={inpStyle} value={form.steam} onChange={set("steam")} inputMode="numeric" /></Field>
            <Field label="Discord ID"><input className={inp} style={inpStyle} value={form.discord} onChange={set("discord")} inputMode="numeric" /></Field>
            <Field label="Address">
              <input className={inp} style={inpStyle} value={form.address} onChange={set("address")} placeholder="One exact address" autoComplete="off" />
            </Field>
            <label className="flex items-center gap-2 text-[0.8rem] cursor-pointer" style={{ color: C.text }}>
              <input type="checkbox" checked={form.low} onChange={set("low")} /> Low confidence (seen once, could be a relay)
            </label>
            <p className="m-0 text-[0.76rem]" style={{ color: C.muted }}>The address is scrambled when saved and can&apos;t be read back. Only an exact match counts, never a range: neighbours on the same provider aren&apos;t suspects.</p>
            {!adding && <Field label="Name"><input className={inp} style={inpStyle} value={form.name} onChange={set("name")} maxLength={40} /></Field>}
            <Field label="Note (admins only)"><input className={inp} style={inpStyle} value={form.note} onChange={set("note")} maxLength={300} /></Field>
            <div className="flex flex-wrap gap-2">
              <Btn color={C.gold} disabled={busy || !(form.steam || form.discord || form.address || form.name)} onClick={save}>Save</Btn>
              {adding && <Btn disabled={busy} onClick={() => setForm(EMPTY)}>Cancel</Btn>}
            </div>
          </div>
        </Box>
      </div>

      {(d.cleared || []).length > 0 && (
        <Box title="Known housemates" note="Their address matches don't count. Steam and Discord matches still do.">
          {(d.cleared || []).map((c, i) => (
            <div key={i} className="flex items-center gap-3 flex-wrap py-2 border-b last:border-b-0" style={{ borderColor: C.line }}>
              <span className="text-[0.88rem]" style={{ color: C.bright }}>{c.name || c.steam}</span>
              {c.note && <span className="text-[0.8rem]" style={{ color: C.text }}>{c.note}</span>}
              <span className="font-mono text-[0.66rem]" style={{ color: C.muted }}>{c.by}, {utc(c.at)}</span>
              <span className="ml-auto"><Btn disabled={busy} onClick={() => send({ cmd: "unclear", name: c.name, steam: c.steam }, "Saving")}>Count again</Btn></span>
            </div>
          ))}
        </Box>
      )}

      <p className="m-0 text-[0.82rem] leading-relaxed max-w-[860px]" style={{ color: C.muted }}>
        Zombita says what matched and when. She never says two accounts are one person, and nothing on this tab kicks or bans anyone. Admins decide.
      </p>
    </div>
  );
}
