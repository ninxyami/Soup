// @ts-nocheck
"use client";
// components/ops/CorpseClearBox.tsx - Live Ops > World: "Clear zombie bodies" (2026-10-30, mod 1.8.77; Nin: zombie bodies
// around Greed's base lag). The game request is corpse_clear (player | x y [z]) radius (corpse_clear_patch.py on the bot,
// server/ZO_Corpses.lua in the mod): ZOMBIE bodies only (players' and animals' bodies are never touched), radius 1-300,
// floors z-1 to z+3, loaded squares only. A big radius answers "Started: ..." first and "Done: ..." when it has finished
// (a second answer with the same id), so this box keeps asking for the answer until it says Done.
// Its own file so the /ops page only gets one line (other branches edit that page too).
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";

const mono = { fontFamily: "var(--mono, monospace)" };
const C = { red: "#e05555", green: "#4caf7d", amber: "#e8a35c", grey: "#9aa", text: "#e6e6e6", bg: "#0b0d10", line: "#2a2f37" };
const inp = { ...mono, fontSize: 12, padding: "6px 8px", background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 3, boxSizing: "border-box" };
const MAX_R = 300;
const WAIT_MS = 120000;

async function api(path, body) {
  const r = await fetch(`${API}${path}`, body === undefined ? { credentials: "include" } :
    { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let d = null;
  try { d = await r.json(); } catch {}
  if (!r.ok) throw new Error((d && (d.detail || d.error)) || `HTTP ${r.status}`);
  return d;
}

export default function CorpseClearBox({ spot, pickSpot, players = [], box, row, Btn }) {
  const [who, setWho] = useState("");          // a player's name, or "__spot"
  const [at, setAt] = useState({ x: "", y: "", z: "0" });
  const [r, setR] = useState(25);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);        // { ok, text }

  useEffect(() => {
    if (spot?.for === "corpses" && spot.x != null) { setAt((a) => ({ ...a, x: String(spot.x), y: String(spot.y) })); setWho("__spot"); }
  }, [spot]);

  const isSpot = who === "__spot";
  const x = parseInt(at.x, 10), y = parseInt(at.y, 10), z = parseInt(at.z || "0", 10);
  const ready = !busy && (isSpot ? x > 0 && y > 0 && !Number.isNaN(z) : who !== "");
  const where = isSpot ? `${x}, ${y} (floor ${z})` : who;

  const run = async () => {
    if (!confirm(`Remove every zombie body within ${r} squares of ${where}?\n\nPlayers' and animals' bodies stay. Floors one down to three up. This can't be undone.`)) return;
    setBusy(true);
    setRes({ ok: true, text: "Sent to the game..." });
    try {
      const args = isSpot ? { x, y, z, radius: r } : { player: who, radius: r };
      const d = await api("/api/admin/ops/do", { cmd: "corpse_clear", ...args });
      if (!d.queued) { setRes({ ok: d.ok, text: d.msg || (d.ok ? "Done." : "Failed.") }); return; }
      const until = Date.now() + WAIT_MS;
      let seen = false;
      while (Date.now() < until) {
        await new Promise((ok) => setTimeout(ok, 1500));
        const a = await api(`/api/admin/ops/result/${d.id}`);
        if (!a.done) continue;
        seen = true;
        const msg = String(a.msg || "");
        setRes({ ok: a.ok, text: msg });
        if (!a.ok || !msg.startsWith("Started")) return;
      }
      setRes(seen ? { ok: true, text: "Still working on it. The game sends Done when it has finished: look in the log tab." }
        : { ok: false, text: "No answer from the game in 2 minutes. Is anyone online? (The server pauses when it's empty.)" });
    } catch (e) {
      setRes({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={box}>
      <b>Clear zombie bodies</b>
      <div style={{ ...mono, fontSize: 11, color: C.grey }}>
        Removes zombie bodies around a player or a spot (lag around a base). Players' and animals' bodies are never touched.
        Only works where someone is nearby (the game only has those squares loaded).
      </div>
      <div style={row}>
        <select style={{ ...inp, width: 160 }} value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Around who?</option>
          {players.map((pp) => <option key={pp.name} value={pp.name}>{pp.name}</option>)}
          <option value="__spot">a spot on the map</option>
        </select>
        {isSpot && <>
          <Btn small onClick={() => pickSpot("corpses", r, "Click the middle of the area.")}>{x > 0 && y > 0 ? `Spot: ${x}, ${y}` : "Pick the spot"}</Btn>
          <input style={{ ...inp, width: 72 }} placeholder="x" value={at.x} onChange={(e) => setAt({ ...at, x: e.target.value.replace(/[^0-9]/g, "") })} />
          <input style={{ ...inp, width: 72 }} placeholder="y" value={at.y} onChange={(e) => setAt({ ...at, y: e.target.value.replace(/[^0-9]/g, "") })} />
          <span style={{ ...mono, fontSize: 11 }}>floor</span>
          <input style={{ ...inp, width: 48 }} value={at.z} onChange={(e) => setAt({ ...at, z: e.target.value.replace(/[^0-9-]/g, "") })} />
        </>}
      </div>
      <div style={row}>
        <span style={{ ...mono, fontSize: 11 }}>radius</span>
        <input style={{ ...inp, width: 64 }} type="number" min={1} max={MAX_R} value={r}
          onChange={(e) => setR(Math.max(1, Math.min(MAX_R, Number(e.target.value) || 1)))} />
        <span style={{ ...mono, fontSize: 11, color: C.grey }}>1 to {MAX_R} squares</span>
        <Btn small color={C.red} disabled={!ready} onClick={run}>{busy ? "Working..." : "Clear zombie bodies"}</Btn>
      </div>
      {res && <div style={{ ...mono, fontSize: 12, color: res.ok ? (res.text.startsWith("Done") ? C.green : C.amber) : C.red }}>{res.text}</div>}
    </div>
  );
}
