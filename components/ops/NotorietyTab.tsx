// @ts-nocheck
"use client";
// components/ops/NotorietyTab.tsx - Live Ops > Zombita > NOTORIETY (2026-10-14, mod 1.7.196 ZNO_Server.lua, bot
// zombita_notoriety.py). How much Queen Dusk has noticed each player: Noticed / Warned / Marked, the tab, raids.
// Data: GET /api/admin/notoriety (the game's file). Changes: POST /api/admin/notoriety {cmd, name, value, key, kind},
// the game's answer at /api/admin/notoriety/reply/{id}. The game keeps the score; this only asks it.
// Send a card: AdminCardBox.tsx (an admin's own words on Zombita's or Queen Dusk's in-game card).
import { useCallback, useEffect, useState } from "react";
import BrideSummonBox from "./BrideSummonBox";
import RaidCustomBox from "./RaidCustomBox";
import { API } from "@/lib/constants";
import AdminCardBox from "./AdminCardBox";

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
  // Nin 11-01: every live setting has a button here (the game checks each range and says so). On / off settings take true or false.
  ["RAID_ON", "Raids on (true or false)"], ["FRIEND_SHARE", "Friends' share of a raid (0 to 1)"], ["FADE_PER_HOUR", "Heat fades per hour of play once calm"],
  ["OFFLINE_CALM_HOURS", "Hours offline before heat fades"], ["OFFLINE_FADE_PER_HOUR", "Heat fades per hour offline"],
  ["BRIDE_ON", "The Bride on (true or false)"], ["BRIDE_SCORE", "Bride: score she comes at"], ["BRIDE_HEALTH", "Bride: her HP"],
  ["BRIDESMAIDS", "Bride: her usual bridesmaids"], ["BRIDESMAIDS_SCORE", "Bride: score bridesmaids come at (0 = never)"],
  ["NATURAL_MAIDS", "Natural bridesmaids on (true or false)"], ["MAID_SPEED", "Bridesmaid run speed (0.9 to 1.5)"], ["MAID_ODDS", "Natural bridesmaid odds, 1 in this many (0 = off)"],
  ["MAID_GAP", "Tiles between natural bridesmaids (0 = no gap)"], ["MAID_VOICE", "Bridesmaid voices on (true or false)"],
  ["BRIDE_FAST_SCORE", "Bride: score of her faster run (0 = never)"], ["BRIDE_FAST_SPEED", "Bride: her faster run (1.6 to 3)"],
  ["RAID_RESTEER", "Seconds between re-steers of raid zombies"], ["RAID_FREE_PCT", "% of raid zombies that get distracted"], ["SIREN_RANGE", "Siren range, tiles"],
  ["HARD_ESCALATE", "Stage 2: % bigger per raid survived"], ["HARD_SPRINT", "Stage 2: sprinters %"], ["HARD_SPRINT_MAX", "Stage 2: most sprinters %"],
  ["HARD_DOTD_MAX", "Stage 2: Horde Night top x"], ["HARD_DOTD_SPRINT", "Stage 2: Horde Night +% sprinters"],
  ["FREE_B_DAY", "Free B wins a day"], ["FREE_A_DAY", "Free A wins a day"], ["LOW_S_POINTS", "Points for a low player's S win"],
  ["FREE_WINS_MAX_STAGE", "Highest stage with free wins (-1 = nobody)"], ["MIN_HEAT_FOR_STAGE", "Least heat that shows a stage"],
  ["HUNT_ON", "Raid hunt on (true or false)"], ["HUNT_FAR", "Raid hunt: catch-up distance"], ["HUNT_LAND", "Raid hunt: catch-up lands this far off"], ["HUNT_EVERY", "Raid hunt: seconds between passes"],
  ["RAID_BASE_GAP", "Minutes between two players' raids at one base (0 = off)"], ["RAID_BASE_RADIUS", "Tiles that count as one base (0 = off)"],
];

// Queen Dusk's favors by tier (Nin 11-01): the setting's ending, the name. Setting keys are letters and _ only, so SSS+ is SSSP.
const FAVOR_TIERS = [["A", "A"], ["S", "S"], ["SS", "SS"], ["SSS", "SSS"], ["SSSP", "SSS+"]];

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
      <AdminCardBox send={send} busy={busy} C={C} mono={mono} btn={btn} />

      <BrideSummonBox send={send} busy={busy} C={C} mono={mono} btn={btn} />
      <RaidCustomBox send={send} busy={busy} C={C} mono={mono} btn={btn} kindsText={st.pace && st.pace.kinds} />
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
                  <button style={btn(C.gold)} disabled={busy} onClick={() => {
                    const v = ask(`${p.name}'s heat (now ${n(p.heat)}):`, String(n(p.heat)));
                    if (v !== null && v !== "") send({ cmd: "set_heat", name: p.name, value: Number(v) }, "Setting the heat");
                  }}>Heat</button>
                  <button style={btn()} disabled={busy} onClick={() => sure(`Take ${p.name} off the Hall of Infamy, this season and all time?`) && send({ cmd: "hall_remove", name: p.name }, "Taking them off the Hall")}>Off the Hall</button>
                  <button style={btn()} disabled={busy} onClick={() => sure(`Start ${p.name}'s Bride over at stage 1?`) && send({ cmd: "bride_duel", name: p.name }, "Bride duel")}>Bride duel</button>
                  <button style={btn()} disabled={busy} onClick={() => {
                    const v = ask(`A test Bride on ${p.name}, staff only. Her HP (empty = full):`, "");
                    if (v !== null) send({ cmd: "bride_test", name: p.name, ...(v !== "" ? { hp: Number(v) } : {}) }, "Test Bride");
                  }}>Test Bride</button>
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
        {/* Raid heat (Nin 10-31, server/ZNO_Server.lua V.raidBurn, V.activity): a raid survived takes heat off, and raid + Horde
            Night kills barely count toward the kill-farm rule. Same two settings as Zombita Control > NOTORIETY. Shown once the
            game reports them in its "pace" block (heatBurn, killWeight). */}
        {st.pace && st.pace.heatBurn != null && <>
        <div style={{ color: C.gold, margin: "12px 0 6px" }}>Raid heat</div>
        <div style={{ color: C.text, marginBottom: 6, lineHeight: 1.5 }}>
          {n(st.pace.heatBurn) > 0 ? `A raid survived takes ${n(st.pace.heatBurn)} heat off.` : "A raid survived takes no heat off."}{" "}
          Raid and Horde Night kills count 1 in {n(st.pace.killWeight)} toward the kill-farm rule.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[["RAID_HEAT_BURN", "heatBurn", "Heat a survived raid takes off (0 = off)", 0, 100],
            ["RAID_KILL_WEIGHT", "killWeight", "Raid and Horde Night kills count 1 in", 1, 1000]].map(([key, field, label, lo, hi]) => (
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
        {/* Ways out of wanted and the floor break (Nin 10-31, server/ZNO_FloorBreak.lua, ZNO_HenchServer.lua, ZNO_Favors.lua). The pay-off works at every General Store; the collectors' spots wait for real NPCs. Same
            settings as Zombita Control > WANTED. Shown once the game reports them in its "pace" block. */}
        {st.pace && st.pace.floorMin != null && (() => {
          const p = st.pace;
          const numbers = (rows) => rows.map(([key, field, label, lo, hi]) => (
            <button key={key} style={btn()} disabled={busy} onClick={() => {
              const v = ask(`${label} (${lo}-${hi}):`, String(p[field]));
              if (v === null || v === "") return;
              const num = Number(v);
              if (!Number.isFinite(num) || num < lo || num > hi) { setMsg(`${label}: ${lo} to ${hi}, please.`); return; }
              send({ cmd: "setting", key, value: String(Math.floor(num)) }, `Setting ${key}`);
            }}>{label}: {p[field]}</button>
          ));
          const toggle = (key, field, label) => (
            <button key={key} style={btn(p[field] ? C.red : undefined)} disabled={busy} onClick={() => {
              if (sure(`${label}: turn ${p[field] ? "off" : "on"}?`)) send({ cmd: "setting", key, value: p[field] ? "false" : "true" }, `Setting ${key}`);
            }}>{label}: {p[field] ? "ON" : "OFF"}</button>
          );
          const spots = String(p.henchSpots || "off;off").split(";");
          const spot = (i) => (
            <button key={i} style={btn()} disabled={busy} onClick={() => {
              const v = ask(`Collector ${i}: x,y to place them, or off to take them away:`, spots[i - 1] === "off" ? "" : spots[i - 1]);
              if (v === null || v === "") return;
              const clean = v.replace(/\s/g, "").toLowerCase();
              if (clean !== "off" && !/^\d+,\d+$/.test(clean)) { setMsg("Collector spot: x,y or off, please."); return; }
              send({ cmd: "setting", key: "HENCH_SPOT", value: `${i}:${clean}` }, `Placing collector ${i}`);
            }}>Collector {i}: {spots[i - 1]}</button>
          );
          return <>
            <div style={{ color: C.gold, margin: "12px 0 6px" }}>Floor break{p.floorOn ? " (on)" : " (off)"}</div>
            <div style={{ color: C.text, marginBottom: 6, lineHeight: 1.5 }}>
              Only floors players built, under a Marked player, in a raid or Horde Night, with {n(p.floorMin)}+ of their hunters stuck
              underneath for {n(p.floorStuck)} s. Then a warning, and {n(p.floorWarn)} s later {n(p.floorTiles)} tiles go. Never map floors, buildings, stairs or walls.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {toggle("FLOOR_ON", "floorOn", "Floor break")}
              {toggle("FLOOR_IN_SAFEHOUSE", "floorInSafehouse", "In safehouses")}
              {numbers([["FLOOR_MIN_ZOMBIES", "floorMin", "Zombies stuck underneath", 2, 200],
                        ["FLOOR_STUCK_SEC", "floorStuck", "Seconds stuck", 10, 900],
                        ["FLOOR_WARN", "floorWarn", "Seconds of warning", 5, 120],
                        ["FLOOR_TILES", "floorTiles", "Tiles (3 at most)", 1, 3]])}
              <button style={btn()} disabled={busy} onClick={() => {
                const v = ask("Check the floor under which player? (only looks, changes nothing)", "");
                if (v) send({ cmd: "setting", key: "FLOOR_TEST", value: v }, "Checking the floor");
              }}>Check a floor</button>
            </div>
            <div style={{ color: C.gold, margin: "12px 0 6px" }}>Bounty pay-off{p.payoffOn ? " (on)" : " (off)"}</div>
            <div style={{ color: C.text, marginBottom: 6, lineHeight: 1.5 }}>
              A Marked player pays at any General Store, in carried coin: the tab{n(p.payoffMarkup) > 0 ? ` plus ${n(p.payoffMarkup)}%` : ""}{n(p.payoffMin) > 0 ? `, ${money(p.payoffMin)} at the least` : ""}. The Mark goes and the money goes to the treasury. Silas' collectors come later: leave their spots off for now.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {toggle("PAYOFF_ON", "payoffOn", "Pay-off")}
              {spot(1)}
              {spot(2)}
              {numbers([["PAYOFF_MARKUP", "payoffMarkup", "% on top of the tab", 0, 1000],
                        ["PAYOFF_MIN", "payoffMin", "Lowest price in bronze", 0, 10000000]])}
            </div>
            <div style={{ color: C.gold, margin: "12px 0 6px" }}>Raid gap and bodies</div>
            <div style={{ color: C.text, marginBottom: 6, lineHeight: 1.5 }}>
              Raids never overlap: the next one is timed once the last is over, {n(p.gapMin)} to {n(p.gapMax)} minutes of play, longer when Zombita is in a good mood and shorter in a bad one.
              A raid's bodies go {n(p.bodyMin)} minutes after it is over{p.bagOn ? `, and what they carried stays in a bag, on the map for ${n(p.bagMark)} minutes` : ""}. Leftover zombies keep their own time.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {toggle("RAID_BAG_ON", "bagOn", "Raid bag")}
              {numbers([["RAID_GAP_MIN", "gapMin", "Gap, fewest minutes", 10, 1440],
                        ["RAID_GAP_MAX", "gapMax", "Gap, most minutes", 10, 1440],
                        ["RAID_BODY_MIN", "bodyMin", "Bodies go after (minutes)", 1, 240],
                        ["RAID_BAG_MARK_MIN", "bagMark", "Bag on the map (minutes)", 1, 240]])}
            </div>
            <div style={{ color: C.gold, margin: "12px 0 6px" }}>Queen Dusk's favors{p.favorOn ? " (on)" : " (off)"}</div>
            <div style={{ color: C.text, marginBottom: 6, lineHeight: 1.5 }}>
              {p.favorHeatA != null
                ? <>One A tier or higher job at a time for Marked players, on the phone. Done: the tier's heat off, one Dusk favor point and no pay. The next offer comes {n(p.favorCooldown)} minutes later, done or not. An offer stays up {n(p.favorMinutes)} minutes. Once taken, an A tier has {n(p.favorMinutes)} minutes and S and up have 24 hours.</>
                : <>One job at a time for Marked players, on the phone. Done: {n(p.favorHeat)} heat off and no pay. The next offer comes {n(p.favorCooldown)} minutes later, done or not.</>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {toggle("FAVOR_ON", "favorOn", "Favors")}
              {numbers([...(p.favorHeatA != null ? [] : [["FAVOR_HEAT", "favorHeat", "Heat off", 0, 100]]),
                        ["FAVOR_COOLDOWN_MIN", "favorCooldown", "Minutes between offers", 1, 1440],
                        ["FAVOR_MINUTES", "favorMinutes", p.favorHeatA != null ? "Minutes to take it, and for an A tier" : "Minutes to do it", 10, 600]])}
            </div>
            {p.favorHeatA != null && <>
              <div style={{ color: C.text, margin: "6px 0", lineHeight: 1.5 }}>Heat each tier takes off, how often it rolls (bigger odds = more often, 0 = never), and how many real minutes, offline too, pass with no new raid once it's done (a second favor replaces the first's pause).</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {numbers(FAVOR_TIERS.map(([key, name]) => [`FAVOR_HEAT_${key}`, `favorHeat${key}`, `${name} heat`, 0, 100]))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {numbers(FAVOR_TIERS.map(([key, name]) => [`FAVOR_ODDS_${key}`, `favorOdds${key}`, `${name} odds`, 0, 1000]))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {numbers(FAVOR_TIERS.map(([key, name]) => [`FAVOR_RAID_PAUSE_${key}`, `favorPause${key}`, `${name} raid pause`, 0, 1440]))}
              </div>
              <div style={{ color: C.grey, marginTop: 6, lineHeight: 1.5 }}>Dusk favor points (staff only, they do nothing yet): {p.favorPoints || "nobody yet"}</div>
            </>}
          </>;
        })()}
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
        {/* No safe cars (server/ZNO_CarBreak.lua): the Bride, or a crowd of raid / Horde Night zombies around a car with a player in it,
            burst its tires; the flip is off until Nin has tried it live. Same settings as Zombita Control > NOTORIETY. The tests go
            through the "setting" command, value = the player in the car. */}
        {st.pace && st.pace.tiresOn != null && <>
        <div style={{ color: C.gold, margin: "12px 0 6px" }}>
          Cars (tires {st.pace.tiresOn ? "on" : "off"}, Bride flip {st.pace.flipOn ? "on" : "off"}, crowd flip {st.pace.flipCrowd ? "on" : "off"})
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[["TIRES_ON", "tiresOn", "Tires"], ["TIRE_SCRAPS", "tireScraps", "Tire scraps"], ["FLIP_ON", "flipOn", "Bride flip"], ["FLIP_CROWD", "flipCrowd", "Crowd flip"]].map(([key, field, label]) => {
            const on = st.pace && st.pace[field] === true;
            return <button key={key} style={btn(on ? C.red : C.grey)} disabled={busy} onClick={() => {
              if (sure(`${label}: turn it ${on ? "off" : "on"}?`)) send({ cmd: "setting", key, value: on ? "false" : "true" }, `Setting ${key}`);
            }}>{label}: {on ? "ON" : "OFF"}</button>;
          })}
          {[["FLIP_COUNT", "flipCount", "Zombies around a car", 2, 50],
            ["TIRES_WARN", "tiresWarn", "Warning before the tires go: a crowd (s)", 1, 60],
            ["BRIDE_TIRES_WARN", "brideTiresWarn", "Warning before the tires go: the Bride (s)", 0, 30],
            ["FLIP_SECONDS", "flipSeconds", "Seconds a crowd needs for a flip", 1, 60],
            ["BRIDE_FLIP_SECONDS", "brideFlipSeconds", "Seconds the Bride needs for a flip", 0, 30]].map(([key, field, label, lo, hi]) => (
            <button key={key} style={btn()} disabled={busy} onClick={() => {
              const cur = st.pace && st.pace[field] != null ? String(st.pace[field]) : "";
              const v = ask(`${label} (${lo}-${hi}):`, cur);
              if (v === null || v === "") return;
              const num = Number(v);
              if (!Number.isFinite(num) || num < lo || num > hi) { setMsg(`${label}: ${lo} to ${hi}, please.`); return; }
              send({ cmd: "setting", key, value: String(Math.floor(num)) }, `Setting ${key}`);
            }}>{label}{st.pace && st.pace[field] != null ? `: ${st.pace[field]}` : ""}</button>
          ))}
          {[["CAR_TEST_FLIP", "Test flip"], ["CAR_TEST_TIRES", "Test tires"]].map(([key, label]) => (
            <button key={key} style={btn(C.amber)} disabled={busy} onClick={() => {
              const who = ask(`${label}: who is in the car? (The flip needs them driving, slow, no trailer. Test flip again rights it.)`, "");
              if (who) send({ cmd: "setting", key, value: who }, label);
            }}>{label}</button>
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
