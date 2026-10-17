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

const SETTINGS = [
  ["TAB_BASE", "Tab per hour while Marked (bronze)"], ["TAB_PER_POINT", "Extra per hour for each point gained while Marked"],
  ["TAB_SINK", "Tab sinks per hour once calm (keep it small)"], ["CALM_HOURS", "Hours of play with nothing new before it fades"],
  ["RAID_EVERY_MIN", "Shortest minutes of play between raids"], ["RAID_EVERY_MAX", "Longest minutes of play between raids"],
  ["RAID_Z_MIN", "Fewest zombies in a raid"], ["RAID_Z_MAX", "Most zombies in a raid"], ["RAID_SPRINT", "Sprinters in a raid (%)"],
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
        <p style={{ color: C.grey, lineHeight: 1.6, marginTop: 10 }}>
          Score = deeds (A and S wins, hot streaks, keeper hopping, emptying tills, buy limits, earning a lot and spending little) plus
          stats (skills, days alive, kills, bank; 30 at most, so stats alone never Mark anyone). Deeds only fade when the player is calm.
          At 25 Zombita warns in public, often. At 40 she gives the last warning, and after 30 minutes of play they are Marked:
          Dusk's hordes and Crowe's bandits at random times, wanted posters on zombies, no sending or withdrawing money, and the tab
          grows every hour they play. If they die while Marked the tab goes to the treasury (debt if the bank is short).
        </p>
      </div>
    </div>
  );
}
