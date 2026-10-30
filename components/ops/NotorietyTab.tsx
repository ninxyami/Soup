// @ts-nocheck
"use client";
// components/ops/NotorietyTab.tsx - Live Ops > Zombita > NOTORIETY (2026-10-14, mod 1.7.196 ZNO_Server.lua, bot
// zombita_notoriety.py). How much Queen Dusk has noticed each player: Noticed / Warned / Marked, the tab, raids.
// Data: GET /api/admin/notoriety (the game's file). Changes: POST /api/admin/notoriety {cmd, name, value, key, kind},
// the game's answer at /api/admin/notoriety/reply/{id}. The game keeps the score; this only asks it.
import { useCallback, useEffect, useState } from "react";
import { API } from "@/lib/constants";

const C = { gold: "#c8a84b", green: "#4caf7d", red: "#e05555", amber: "#d08c2c", grey: "#9aa", text: "#e6e6e6", bg: "#0b0d10", line: "#2a2f37" };
const mono = { fontFamily: "var(--mono, monospace)" };
const btn = (color = C.grey) => ({ ...mono, fontSize: 11, padding: "3px 8px", background: "transparent", color, border: `1px solid ${color}66`,
  borderRadius: 3, cursor: "pointer", marginRight: 4 });
const n = (v) => Number(v) || 0;
function money(b) {
  const v = Math.max(0, Math.round(n(b)));
  const s = Math.floor(v / 1000), r = v % 1000;                    // no gold (Nin 2026-10-13)
  const parts = [];
  if (s) parts.push(`${s.toLocaleString("en-US")}s`);
  if (r || !parts.length) parts.push(`${r}b`);
  return parts.join(" ");
}

// Raid cleanup status (mod 1.8.77): "2 raids running, 3 areas waiting (the next in about 12 min)".
function cleanupLine(c) {
  const raids = n(c.raids), areas = n(c.areas);
  let line = `${raids} ${raids === 1 ? "raid" : "raids"} running, ${areas} ${areas === 1 ? "area" : "areas"} waiting`;
  const next = Number(c.nextIn);
  if (areas > 0 && Number.isFinite(next) && next >= 0) {
    const m = Math.ceil(next / 60);
    line += m <= 0 ? " (the next one now)" : ` (the next in about ${m} min)`;
  }
  if (c.on === false) line = `Off: a raid's dead stay. ${line}`;
  return line;
}

const SETTINGS = [
  ["TAB_BASE", "Tab per hour while Marked (bronze)"], ["TAB_PER_POINT", "Extra per hour for each point gained while Marked"],
  ["TAB_SINK", "Tab sinks per hour once calm (keep it small)"], ["CALM_HOURS", "Hours of play with nothing new before it fades"],
  ["RAID_EVERY_MIN", "Shortest minutes of play between raids"], ["RAID_EVERY_MAX", "Longest minutes of play between raids"],
  // mod 1.8.13: every raid rolls a template (300 / 600 hordes in waves, sprinter packs, sieges, Crowe's ambushes...);
  // these scale them all. Size: the middle of low/high, 100 = the sizes as listed.
  ["RAID_Z_MIN", "Raid size, low end (100 = normal)"], ["RAID_Z_MAX", "Raid size, high end (100 = normal)"], ["RAID_SPRINT", "Sprinters in every horde (%)"],
  ["RAID_WAVE_GAP", "Seconds between waves"], ["RAID_SPRINTERS", "Sprinter pack size (10 = normal)"],
  ["RAID_B_MIN", "Fewest bandits in Crowe's raid"], ["RAID_B_MAX", "Most bandits in Crowe's raid"],
  // mod 1.8.13: Dawn of the Dead is harder for the wanted
  ["DOTD_MARKED_X", "Dawn of the Dead: Marked get x zombies (2 = double)"], ["DOTD_MARKED_SPRINT", "Dawn of the Dead: Marked get +% sprinters"],
  ["DOTD_LW_X", "Dawn of the Dead: last warning gets x zombies"], ["DOTD_LW_SPRINT", "Dawn of the Dead: last warning gets +% sprinters"],
];

export default function NotorietyTab() {
  const [st, setSt] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/admin/notoriety`, { credentials: "include", cache: "no-store" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `HTTP ${r.status}`);
      setSt(await r.json());
      setErr("");
    } catch (e) {
      setErr(String(e.message || e));
    }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  async function send(body, label) {
    setBusy(true);
    setMsg(`${label}...`);
    try {
      const r = await fetch(`${API}/api/admin/notoriety`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`);
      for (let i = 0; i < 20; i++) {
        await new Promise((res) => setTimeout(res, 1500));
        const a = await fetch(`${API}/api/admin/notoriety/reply/${d.id}`, { credentials: "include", cache: "no-store" }).then((x) => x.json()).catch(() => ({}));
        if (a.done) { setMsg(`${a.ok ? "Done" : "Refused"}: ${a.msg}`); load(); setBusy(false); return; }
      }
      setMsg("Sent. The game answers when it next looks (the server may be empty or restarting).");
    } catch (e) {
      setMsg(`Couldn't send: ${e.message || e}`);
    }
    setBusy(false);
  }

  const ask = (q, def = "") => (typeof window !== "undefined" ? window.prompt(q, def) : null);
  const sure = (q) => (typeof window !== "undefined" ? window.confirm(q) : false);

  if (err) return <div style={{ ...mono, color: C.red, padding: 12 }}>Notoriety: {err}</div>;
  if (!st) return <div style={{ ...mono, color: C.grey, padding: 12 }}>Loading...</div>;
  const players = Array.isArray(st.players) ? st.players : [];
  const lines = st.lines || {};

  return (
    <div style={{ padding: 12, color: C.text }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ ...mono, fontSize: 13, color: st.on ? C.green : C.red }}>{st.on ? "ON" : "OFF (MODS > Notoriety + bounties)"}</span>
        <span style={{ ...mono, fontSize: 12, color: C.grey }}>
          Noticed {lines.noticed ?? 10} · Warned {lines.warned ?? 25} · Marked {lines.marked ?? 40}
          {st.seeded ? " · seeded from job history" : ""}
        </span>
        <button style={btn(st.paused ? C.green : C.red)} disabled={busy}
                onClick={() => send({ cmd: st.paused ? "resume" : "pause" }, st.paused ? "Resuming raids" : "Pausing raids")}>
          {st.paused ? "Resume raids" : "Pause raids"}
        </button>
        <a href="/wanted" target="_blank" rel="noreferrer" style={{ ...mono, fontSize: 12, color: C.gold }}>Public Wanted board</a>
      </div>
      {msg && <div style={{ ...mono, fontSize: 12, color: C.gold, marginBottom: 8 }}>{msg}</div>}

      {/* One card per player (was a 7-column table: in the narrow Live Ops panel the buttons fell off the right edge). */}
      <div style={{ ...mono, fontSize: 12 }}>
          {players.length === 0 && <div style={{ padding: 8, color: C.grey }}>Nobody yet.</div>}
          {players.map((p) => {
            const color = p.marked ? C.red : p.lastWarning ? C.amber : n(p.stage) >= 2 ? C.gold : C.text;
            const why = (Array.isArray(p.why) ? p.why : []).slice(0, 2).map((w) => (n(w.pts) > 0 ? `+${w.pts} ` : "") + w.why).join("; ");
            const tab = (n(p.tab) > 0 ? money(p.tab) : "") + (n(p.rate) > 0 ? ` +${money(p.rate)}/h` : n(p.rate) < 0 ? ` -${money(-p.rate)}/h` : "");
            return (
              <div key={p.name} style={{ borderBottom: `1px solid ${C.line}`, padding: "8px 4px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", alignItems: "baseline" }}>
                  <span style={{ color, fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                  <span style={{ color }}>{p.marked ? "MARKED" : p.lastWarning ? "LAST WARNING" : p.stageName}{p.calm ? " (calm)" : ""}</span>
                  <span>score {p.score} <span style={{ color: C.grey }}>({p.heat} + {p.standing})</span></span>
                  {tab && <span style={{ color: C.gold }}>tab {tab}</span>}
                  {n(p.raids) > 0 && <span>raids {n(p.raids)}</span>}
                </div>
                {why && <div style={{ color: C.grey, marginTop: 4, lineHeight: 1.4, wordBreak: "break-word" }}>{why}</div>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                  <button style={btn()} disabled={busy} onClick={() => sure(`Clear ${p.name}'s notoriety (back to 0, unmarked)? The tab stays.`) && send({ cmd: "clear", name: p.name }, "Clearing")}>Clear</button>
                  <button style={btn(C.gold)} disabled={busy} onClick={() => {
                    const v = ask(`${p.name}'s tab in bronze (0 clears it):`, String(n(p.tab)));
                    if (v !== null && v !== "") send({ cmd: "set_tab", name: p.name, value: Number(v) }, "Setting the tab");
                  }}>Tab</button>
                  {p.marked
                    ? <button style={btn(C.green)} disabled={busy} onClick={() => sure(`Let ${p.name} go? Zombita says so in public; the tab stays.`) && send({ cmd: "unmark", name: p.name }, "Unmarking")}>Unmark</button>
                    : <button style={btn(C.red)} disabled={busy} onClick={() => sure(`Mark ${p.name}? Zombita gives the last warning in public first; the Mark follows after 5 minutes of play.`) && send({ cmd: "mark", name: p.name }, "Marking")}>Mark</button>}
                  {p.marked && <>
                    <button style={btn(C.red)} disabled={busy} onClick={() => sure(`Send Queen Dusk's horde at ${p.name} now? Friends near them get half.`) && send({ cmd: "raid_now", name: p.name, kind: "dusk" }, "Sending a raid")}>Dusk raid</button>
                    <button style={btn(C.red)} disabled={busy} onClick={() => sure(`Send Silas Crowe's bandits at ${p.name} now?`) && send({ cmd: "raid_now", name: p.name, kind: "crowe" }, "Sending bandits")}>Crowe raid</button>
                  </>}
                </div>
              </div>
            );
          })}
      </div>

      <div style={{ marginTop: 16, ...mono, fontSize: 12 }}>
        <div style={{ color: C.gold, marginBottom: 6 }}>Numbers (changed in the game at once, kept across restarts)</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {SETTINGS.map(([key, label]) => (
            <button key={key} style={btn()} disabled={busy} onClick={() => {
              const v = ask(`${label}:`, "");
              if (v !== null && v !== "") send({ cmd: "setting", key, value: v }, `Setting ${key}`);
            }}>{label}</button>
          ))}
        </div>
        {/* Horde Night hold (mod 1.8.75, ZNO_Server.lua V.holdCheck): with this many players online or more, a raid that would
            start while Dawn of the Dead is warned, running or only just over waits, then starts after it at full size, one by
            one. Fewer online: the raid starts on top of Horde Night. Same three settings as Zombita Control > NOTORIETY.
            Current values come from the game's "hold" block (st.hold: on, gap, players, held, names) when the API passes it
            through; without it the buttons still work and the game's answer says the new value. */}
        <div style={{ color: C.gold, margin: "12px 0 6px" }}>
          Horde Night hold{st.hold ? (st.hold.on ? " (on" : " (off") + (n(st.hold.held) > 0 ? `, ${n(st.hold.held)} waiting: ${st.hold.names || ""})` : ")") : ""}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button style={btn(C.red)} disabled={busy} onClick={() => {
            if (sure("Hold raids for Horde Night? On a busy server a raid due while Dawn of the Dead is warned, running or only just over waits, then starts after it at full size.")) {
              send({ cmd: "setting", key: "HOLD_DOTD", value: "true" }, "Turning the Horde Night hold on");
            }
          }}>{st.hold && st.hold.on ? "Hold: ON" : "Hold on"}</button>
          <button style={btn()} disabled={busy} onClick={() => {
            if (sure("Stop holding raids for Horde Night? Raids then start on top of it whatever the player count; any waiting now start at once, one by one.")) {
              send({ cmd: "setting", key: "HOLD_DOTD", value: "false" }, "Turning the Horde Night hold off");
            }
          }}>{st.hold && st.hold.on === false ? "Hold: OFF" : "Hold off"}</button>
          {[["HOLD_GAP_MIN", "gap", "Minutes after Horde Night before held raids start (0-120)"],
            ["HOLD_MIN_PLAYERS", "players", "Hold only with this many players online or more (1-100)"]].map(([key, field, label]) => (
            <button key={key} style={btn()} disabled={busy} onClick={() => {
              const cur = st.hold && st.hold[field] != null ? String(st.hold[field]) : "";
              const v = ask(`${label}:`, cur);
              if (v !== null && v !== "") send({ cmd: "setting", key, value: v }, `Setting ${key}`);
            }}>{label}{st.hold && st.hold[field] != null ? `: ${st.hold[field]}` : ""}</button>
          ))}
        </div>
        {/* Raid cleanup (mod 1.8.77, server/ZNO_Cleanup.lua): a raid's zombie bodies and its leftover zombies go this many
            minutes after the raid is over, within this many tiles of where it was fought (players' and animals' bodies stay,
            nothing in front of a player). Zombita tells the raided player and the friends it hit, in game only. Same three
            settings as Zombita Control > NOTORIETY > RAID CLEANUP. Current values come from the game's "cleanup" block
            (st.cleanup: on, min, radius, raids, areas, nextIn) when the API passes it through; without it the buttons still
            work and the game's answer says the new value. */}
        <div style={{ color: C.gold, margin: "12px 0 6px" }}>
          Raid cleanup{st.cleanup ? (st.cleanup.on ? " (on)" : " (off)") : ""}
        </div>
        {st.cleanup && (
          <div style={{ color: st.cleanup.on ? C.text : C.amber, marginBottom: 6 }}>
            {cleanupLine(st.cleanup)}
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button style={btn(C.red)} disabled={busy} onClick={() => {
            if (sure("Turn the raid cleanup on? A raid's zombie bodies and its leftover zombies go a set number of minutes after it is over. Players' and animals' bodies stay.")) {
              send({ cmd: "setting", key: "RAID_CLEANUP", value: "true" }, "Turning the raid cleanup on");
            }
          }}>{st.cleanup && st.cleanup.on ? "Cleanup: ON" : "Cleanup on"}</button>
          <button style={btn()} disabled={busy} onClick={() => {
            if (sure("Turn the raid cleanup off? A raid's dead and its leftover zombies then stay where it was fought. Areas already waiting are not cleared.")) {
              send({ cmd: "setting", key: "RAID_CLEANUP", value: "false" }, "Turning the raid cleanup off");
            }
          }}>{st.cleanup && st.cleanup.on === false ? "Cleanup: OFF" : "Cleanup off"}</button>
          {[["RAID_CLEANUP_MIN", "min", "Minutes after a raid is over before its dead go", 5, 240],
            ["RAID_CLEANUP_RADIUS", "radius", "Tiles around where a raid was fought", 20, 150]].map(([key, field, label, lo, hi]) => (
            <button key={key} style={btn()} disabled={busy} onClick={() => {
              const cur = st.cleanup && st.cleanup[field] != null ? String(st.cleanup[field]) : "";
              const v = ask(`${label} (${lo}-${hi}):`, cur);
              if (v === null || v === "") return;
              const num = Number(v);
              if (!Number.isFinite(num) || num < lo || num > hi) { setMsg(`${label}: ${lo} to ${hi}, please.`); return; }
              send({ cmd: "setting", key, value: String(Math.floor(num)) }, `Setting ${key}`);
            }}>{label}{st.cleanup && st.cleanup[field] != null ? `: ${st.cleanup[field]}` : ""}</button>
          ))}
        </div>
        {/* Crowe's men (mod 1.8.78, server/ZNO_BanditGrace.lua): his raid bandits rise on their own ring, never closer than
            "Ring from" to anyone online and never inside their longest gun's reach + 10 (the game pushes the ring out), and
            hold fire for "Grace" seconds after they rise (they still come in). Same three settings as Zombita Control >
            NOTORIETY > CROWE'S MEN. Current values come from the game's "bandits" block (st.bandits: grace, ringMin, ringMax,
            usedMin, usedMax, gun, holding, last) when the API passes it through (bot zip Zombita_bandit_grace.zip); without
            it the buttons still work and the game's answer says the new value. */}
        <div style={{ color: C.gold, margin: "12px 0 6px" }}>
          Crowe's men{st.bandits ? (n(st.bandits.grace) > 0 ? ` (hold fire ${n(st.bandits.grace)} s)` : " (may fire at once)") : ""}
        </div>
        {st.bandits && (
          <div style={{ color: n(st.bandits.grace) > 0 ? C.text : C.amber, marginBottom: 6, lineHeight: 1.5 }}>
            They rise {st.bandits.usedMin}-{st.bandits.usedMax} tiles out (their longest gun reaches {st.bandits.gun})
            {n(st.bandits.holding) > 0 ? `, ${n(st.bandits.holding)} holding fire now` : ""}.
            {st.bandits.last ? <span style={{ color: C.grey }}> Last first hit: {st.bandits.last}</span> : null}
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[["RAID_BANDIT_GRACE", "grace", "Seconds they hold fire after they rise (0 = at once)", 0, 60],
            ["RAID_B_RING_MIN", "ringMin", "Closest tiles they rise from anyone online", 20, 150],
            ["RAID_B_RING_MAX", "ringMax", "Furthest tiles they rise from their target", 25, 200]].map(([key, field, label, lo, hi]) => (
            <button key={key} style={btn()} disabled={busy} onClick={() => {
              const cur = st.bandits && st.bandits[field] != null ? String(st.bandits[field]) : "";
              const v = ask(`${label} (${lo}-${hi}):`, cur);
              if (v === null || v === "") return;
              const num = Number(v);
              if (!Number.isFinite(num) || num < lo || num > hi) { setMsg(`${label}: ${lo} to ${hi}, please.`); return; }
              send({ cmd: "setting", key, value: String(Math.floor(num)) }, `Setting ${key}`);
            }}>{label}{st.bandits && st.bandits[field] != null ? `: ${st.bandits[field]}` : ""}</button>
          ))}
        </div>
        {/* Raid pacing (server/ZNO_Server.lua V.paceHold, Nin 10-30): same number of zombies, only the timing changes. A raid's
            next wave waits until fewer than the cap of its zombies are alive near the target, then comes in full. Same three
            settings as Zombita Control > NOTORIETY > RAID PACING, plus stage 2's growth top. Current values come from the game's
            "pace" block (st.pace: on, cap, radius, held, names, growMax) when the API passes it through (bot zip Zombita_raid_pace.zip); without it the buttons
            still work and the game's answer says the new value. */}
        <div style={{ color: C.gold, margin: "12px 0 6px" }}>
          Raid pacing{st.pace ? (st.pace.on ? " (on)" : " (off)") : ""}
        </div>
        {st.pace && (
          <div style={{ color: st.pace.on ? C.text : C.amber, marginBottom: 6, lineHeight: 1.5 }}>
            {st.pace.on
              ? `Same zombies, only the timing changes: the next wave waits for under ${n(st.pace.cap)} alive within ${n(st.pace.radius)} tiles of the target. ${n(st.pace.held) > 0 ? `Waiting now: ${st.pace.names || ""}.` : "None waiting."}`
              : "Off: every wave comes at its gap."}
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button style={btn(C.red)} disabled={busy} onClick={() => {
            if (sure("Turn raid pacing on? Same zombies, only the timing changes: a raid's next wave waits until fewer than the cap are alive near the target, then comes in full.")) {
              send({ cmd: "setting", key: "RAID_PACE", value: "true" }, "Turning raid pacing on");
            }
          }}>{st.pace && st.pace.on ? "Pacing: ON" : "Pacing on"}</button>
          <button style={btn()} disabled={busy} onClick={() => {
            if (sure("Turn raid pacing off? Same zombies either way, but every wave then comes at its gap, on top of whatever is still alive. The big raids lag the whole server.")) {
              send({ cmd: "setting", key: "RAID_PACE", value: "false" }, "Turning raid pacing off");
            }
          }}>{st.pace && st.pace.on === false ? "Pacing: OFF" : "Pacing off"}</button>
          {[["RAID_ALIVE_CAP", "cap", "Next wave waits until fewer than this are alive", 50, 5000],
            ["RAID_ALIVE_RADIUS", "radius", "Tiles around the target that count", 20, 150],
            ["HARD_ESCALATE_MAX", "growMax", "Stage 2 raids grow by at most this % (raids already under way keep their size)", 0, 2000]].map(([key, field, label, lo, hi]) => (
            <button key={key} style={btn()} disabled={busy} onClick={() => {
              const cur = st.pace && st.pace[field] != null ? String(st.pace[field]) : "";
              const v = ask(`${label} (${lo}-${hi}):`, cur);
              if (v === null || v === "") return;
              const num = Number(v);
              if (!Number.isFinite(num) || num < lo || num > hi) { setMsg(`${label}: ${lo} to ${hi}, please.`); return; }
              send({ cmd: "setting", key, value: String(Math.floor(num)) }, `Setting ${key}`);
            }}>{label}{st.pace && st.pace[field] != null ? `: ${st.pace[field]}` : ""}</button>
          ))}
        </div>
        {/* The last stage (Nin 10-30, server/ZNO_Server.lua V.isFinal): from this score a Marked player only gets the Bride + one
            pack of sprinters, growing with the score. Same four settings as Zombita Control > NOTORIETY. Current values come from
            the game's "pace" block (finalScore, finalSprinters, finalPerPoint, finalMax). */}
        {st.pace && st.pace.finalScore != null && <>
        <div style={{ color: C.gold, margin: "12px 0 6px" }}>
          Last stage{st.pace && st.pace.finalScore != null ? (n(st.pace.finalScore) > 0 ? ` (from ${n(st.pace.finalScore)})` : " (off)") : ""}
        </div>
        {st.pace && st.pace.finalScore != null && n(st.pace.finalScore) > 0 && (
          <div style={{ color: C.text, marginBottom: 6, lineHeight: 1.5 }}>
            From score {n(st.pace.finalScore)}: only the Bride + one pack of {n(st.pace.finalSprinters)} sprinters, {n(st.pace.finalPerPoint)} more a point, {n(st.pace.finalMax)} at most.
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[["FINAL_SCORE", "finalScore", "Starts at this score (0 = never)", 0, 500],
            ["FINAL_SPRINTERS", "finalSprinters", "Sprinters at that score", 1, 500],
            ["FINAL_PER_POINT", "finalPerPoint", "More a point above it", 0, 50],
            ["FINAL_MAX", "finalMax", "Biggest pack", 1, 1000]].map(([key, field, label, lo, hi]) => (
            <button key={key} style={btn()} disabled={busy} onClick={() => {
              const cur = st.pace && st.pace[field] != null ? String(st.pace[field]) : "";
              const v = ask(`${label} (${lo}-${hi}):`, cur);
              if (v === null || v === "") return;
              const num = Number(v);
              if (!Number.isFinite(num) || num < lo || num > hi) { setMsg(`${label}: ${lo} to ${hi}, please.`); return; }
              send({ cmd: "setting", key, value: String(Math.floor(num)) }, `Setting ${key}`);
            }}>{label}{st.pace && st.pace[field] != null ? `: ${st.pace[field]}` : ""}</button>
          ))}
        </div>
        </>}
        <p style={{ color: C.grey, lineHeight: 1.6, marginTop: 10 }}>
          Score = deeds (A and S wins, hot streaks, keeper hopping, emptying tills, buy limits, earning a lot and spending little) plus
          stats (skills, days alive, kills, bank; 30 at most, so stats alone never Mark anyone). Deeds only fade when the player is calm.
          At 25 Zombita warns in public, often. At 40 she gives the last warning, and after 30 minutes of play they are Marked:
          raids at random times (one of 11 templates: 300 or 600 zombies in waves, sprinter packs, a siege, Crowe's bandits alone or after a horde; each raid they survive makes the next one bigger), wanted posters on zombies, no sending or withdrawing money, and the tab
          grows every hour they play. If they die while Marked the tab goes to the treasury (debt if the bank is short).
        </p>
      </div>
    </div>
  );
}
