// DEV ONLY: fake event API for /p/?t=mock-<step>, so every screen can be checked without the bot.
// Only reached through `process.env.NODE_ENV !== "production"` branches in lib/th/client.ts, so it is never in the
// production bundle. Token: mock-<step>[-wiring][-test][-solo][-intro][-buzz], or mock-notmine (another device's phone).
// It answers with a 2.5 s delay like the real game would, and checks answers with the same rules as lib/th/logic.ts.
import { ThError } from "./client";
import {
  photoCanSlide, photoSlide, photoSolved, vialCanPour, vialPour, vialSolved, wireOpenings, wirePowered,
} from "./logic";
import { mockText } from "./mockText";
import type { ActAction, ActResult, Me, Puzzle, Step } from "./types";

const ORDER: Step[] = [
  "linking", "call", "unlock", "mg1_signal", "mg1_photo", "go_loc2", "arrange", "scan", "code_horde",
  "mg2_cipher", "mg2_game", "go_final", "finale", "lastcall", "done", "broken",
];
export const MOCK_ANSWERS = { pattern: "15963", code: "QWERT", scan: "Q7K2M9XA" };
const DELAY = 2500;

interface S {
  step: Step; since: number; fails: number; fail_cap: number; mg2: "vial" | "wiring"; attempt: number;
  tries: number; patternWait: number; cipherWait: number; started: number; test: boolean; size: number; seed: number;
  prize: string; buzz: boolean;
}
const teams = new Map<string, S>();
const pending = new Map<string, { at: number; ok: boolean; msg: string; done: boolean }>();

function now() { return Math.floor(Date.now() / 1000); }

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function team(t: string): S {
  let s = teams.get(t);
  if (s) return s;
  const parts = t.slice(5).split("-");
  if (parts[0] === "notmine") throw new ThError("This link is open on another device. Ask an admin if that is wrong.", 403);
  if (parts[0] === "nothing") throw new ThError("Unknown link.", 404);
  const step = (ORDER.includes(parts[0] as Step) ? parts[0] : "unlock") as Step;
  s = {
    step, since: now(), fails: 0, fail_cap: 6, mg2: parts.includes("wiring") ? "wiring" : "vial", attempt: 1,
    tries: 5, patternWait: 0, cipherWait: 0, started: 0, test: parts.includes("test"), size: parts.includes("solo") ? 1 : 3,
    seed: 1938475, prize: step === "done" || step === "broken" ? "first" : "", buzz: parts.includes("buzz"),
  };
  teams.set(t, s);
  return s;
}

// ── fake map crops (the API serves real ones from the map renders) ──────────────────────────────────────────────────
export function mockImg(kind: "loc2" | "final") {
  if (kind === "final") {
    // a second fake picture, so the final step looks different from location 2
    const isl = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
<rect width="300" height="300" fill="#2f5d78"/><path d="M0 40 Q150 10 300 50 L300 0 L0 0Z" fill="#6f7f4a"/>
<g stroke="#4f7f9a" stroke-width="2" fill="none" opacity="0.7"><path d="M20 120 q20 -8 40 0 t40 0"/><path d="M160 220 q20 -8 40 0 t40 0"/><path d="M40 250 q20 -8 40 0 t40 0"/></g>
<ellipse cx="200" cy="140" rx="48" ry="30" fill="#c9b27a"/><ellipse cx="200" cy="136" rx="34" ry="20" fill="#5f7a3a"/>
<circle cx="190" cy="130" r="8" fill="#2f4a22"/><circle cx="208" cy="134" r="10" fill="#2f4a22"/>
<rect x="40" y="40" width="26" height="18" fill="#7a4a4a" stroke="#2a2a2a" stroke-width="2"/>
</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(isl)}`;
  }
  const g = kind === "loc2" ? ["#6f7f4a", "#55663a", "#8a6b4a"] : ["#4d5a66", "#3b4652", "#7a4a4a"];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
<rect width="300" height="300" fill="${g[0]}"/>
<path d="M0 60 Q80 40 120 110 T300 170 L300 230 Q200 190 150 160 T0 120Z" fill="${g[1]}"/>
<path d="M-10 250 C60 200 110 260 170 220 S260 120 320 140" stroke="#3d6f8f" stroke-width="18" fill="none"/>
<path d="M40 0 L90 300" stroke="#9a9488" stroke-width="12"/><path d="M0 190 L300 80" stroke="#9a9488" stroke-width="9"/>
<g fill="${g[2]}" stroke="#2a2a2a" stroke-width="2"><rect x="150" y="30" width="44" height="30"/><rect x="205" y="40" width="30" height="40"/>
<rect x="120" y="200" width="36" height="26"/><rect x="230" y="230" width="46" height="34"/><rect x="20" y="140" width="28" height="24"/></g>
<g fill="#2f3d22"><circle cx="250" cy="120" r="14"/><circle cx="268" cy="140" r="10"/><circle cx="70" cy="40" r="12"/><circle cx="30" cy="270" r="16"/></g>
<circle cx="${kind === "loc2" ? 205 : 140}" cy="${kind === "loc2" ? 150 : 90}" r="22" fill="none" stroke="#e05555" stroke-width="6"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ── puzzles, built from the seed like the API does ──────────────────────────────────────────────────────────────────
function photoTiles(rand: () => number) {
  let tiles = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  let last = -1;
  for (let i = 0; i < 60; i++) {
    const opts = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(p => photoCanSlide(tiles, 3, p) && p !== last);
    const p = opts[Math.floor(rand() * opts.length)];
    last = tiles.indexOf(8);
    tiles = photoSlide(tiles, p);
  }
  if (photoSolved(tiles)) tiles = photoSlide(tiles, 5);
  return tiles;
}

function vials(rand: () => number) {
  const segs: string[] = [];
  for (const c of ["r", "g", "b", "y", "p"]) for (let i = 0; i < 4; i++) segs.push(c);
  for (let i = segs.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [segs[i], segs[j]] = [segs[j], segs[i]]; }
  const out: string[][] = [];
  for (let v = 0; v < 5; v++) out.push(segs.slice(v * 4, v * 4 + 4));
  out.push([], []);
  return out;
}

function wiring(rand: () => number, w: number, h: number) {
  // a random self-avoiding path from the top left to the bottom right, then tiles that fit it, then scrambled
  const path: number[] = [];
  const seen = new Set<number>();
  const walk = (i: number): boolean => {
    path.push(i); seen.add(i);
    if (i === w * h - 1) return true;
    const x = i % w, y = Math.floor(i / w);
    const nb = [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([dx, dy]) => [x + dx, y + dy])
      .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < w && ny < h && !seen.has(ny * w + nx))
      .sort(() => rand() - 0.5);
    for (const [nx, ny] of nb) if (walk(ny * w + nx)) return true;
    path.pop();
    return false;
  };
  walk(0);
  const dirBit = (a: number, b: number) => (b === a - w ? 1 : b === a + 1 ? 2 : b === a + w ? 4 : 8);
  const types: string[] = [], rots: number[] = [];
  for (let i = 0; i < w * h; i++) {
    const k = path.indexOf(i);
    if (k < 0) { types.push(["I", "L", "L", "T", "I", "E", "X"][Math.floor(rand() * 7)]); rots.push(0); continue; }
    let mask = 0;
    if (k > 0) mask |= dirBit(i, path[k - 1]);
    if (k < path.length - 1) mask |= dirBit(i, path[k + 1]);
    let found = false;
    for (const t of ["E", "I", "L", "T", "X"]) {
      for (let r = 0; r < 4 && !found; r++) if (wireOpenings(t, r) === mask) { types.push(t); rots.push(r); found = true; }
      if (found) break;
    }
  }
  const tiles = types.map((t, i) => [t, (rots[i] + 1 + Math.floor(rand() * 3)) % 4] as [string, number]);
  return tiles;
}

function puzzleFor(t: string, s: S): Puzzle {
  const r = mulberry32(s.seed + s.attempt * 7919);
  switch (s.step) {
    case "unlock": return { game: "pattern", grid: 3, tries_left: s.tries, wait_until: s.patternWait };
    case "mg1_signal": return { game: "signal", min: 88, max: 108, target: Math.round((88.5 + r() * 19) * 10) / 10 };
    case "mg1_photo": return { game: "photo", img: mockImg("loc2"), size: 3, tiles: photoTiles(r) };
    case "go_loc2": case "arrange":
      return {
        game: "sketch", img: mockImg("loc2"),
        tiles: { A: { type: "Base.Candle", name: "Candle" }, B: { type: "Base.TeddyBear", name: "Teddy Bear" }, C: { type: "Base.Spoon", name: "Spoon" } },
      };
    case "scan":
      return {
        game: "scan", img: mockImg("loc2"),
        tiles: { A: { type: "Base.Candle", name: "Candle" }, B: { type: "Base.TeddyBear", name: "Teddy Bear" }, C: { type: "Base.Spoon", name: "Spoon" } },
      };
    case "mg2_cipher": {
      const shift = 7;
      const az = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      return { game: "cipher", len: 5, wait_until: s.cipherWait, shift, letters: az.slice(shift) + az.slice(0, shift) };
    }
    case "go_final": return { game: "wait", key: "go_final", img: mockImg("final") };
    case "mg2_game":
      if (!s.started) s.started = now();
      if (s.mg2 === "vial") return { game: "vial", vials: vials(r), cap: 4, move_limit: 40, time_s: 180, started: s.started, attempt: s.attempt };
      return { game: "wiring", w: 5, h: 5, tiles: wiring(r, 5, 5), src: [0, 0], dst: [4, 4], time_s: 120, started: s.started, attempt: s.attempt };
    default: return { game: "wait", key: s.step };
  }
}

function setStep(s: S, step: Step) {
  s.step = step; s.since = now(); s.started = 0;
  if (step === "done") s.prize = "first";
}

export async function mockMe(t: string): Promise<Me> {
  const s = team(t);
  return {
    step: s.step, since: s.since, team_size: s.size, members_here: s.size, fails: s.fails, fail_cap: s.fail_cap,
    broken: s.step === "broken", prize: s.prize, test: s.test, puzzle: puzzleFor(t, s), now: now(),
    buzz: s.step === "go_final" && s.buzz, text: mockText(s.step, s.mg2, s.prize),
  };
}

function queue(apply: () => { ok: boolean; msg: string }): ActResult {
  const id = "th-" + Math.random().toString(16).slice(2, 14).padEnd(12, "0");
  const p = { at: Date.now() + DELAY, ok: false, msg: "", done: false };
  pending.set(id, p);
  setTimeout(() => { const r = apply(); p.ok = r.ok; p.msg = r.msg; p.done = true; }, DELAY);
  return { id };
}

function check(s: S, t: string, payload: Record<string, any>): string {
  const p = puzzleFor(t, s);
  switch (p.game) {
    case "pattern":
      if (s.patternWait > now()) throw new ThError("Locked for a moment. Wait, then try again.", 429);
      if (payload.pattern === MOCK_ANSWERS.pattern) return "";
      s.tries -= 1;
      if (s.tries <= 0) { s.tries = 5; s.patternWait = now() + 30; throw new ThError("Wrong pattern. The phone locked for 30 seconds.", 400); }
      throw new ThError(`Wrong pattern. ${s.tries} tries left.`, 400);
    case "signal":
      if (Math.abs(Number(payload.freq) - p.target) <= 0.3 && Number(payload.held_ms) >= 2000) return "";
      throw new ThError("The signal slipped away. Find it again and hold it.", 400);
    case "photo": {
      let tiles = p.tiles;
      for (const m of payload.moves || []) {
        if (!photoCanSlide(tiles, 3, m)) throw new ThError("That photo didn't add up. Try again.", 400);
        tiles = photoSlide(tiles, m);
      }
      if (photoSolved(tiles)) return "";
      throw new ThError("The photo is not whole yet.", 400);
    }
    case "cipher":
      if (s.cipherWait > now()) throw new ThError("The wheel is stuck. Wait a moment.", 429);
      if (String(payload.code).toUpperCase() === MOCK_ANSWERS.code) return "";
      s.cipherWait = now() + 10;
      throw new ThError("Wrong code. The wheel jams for 10 seconds.", 400);
    case "vial": {
      if (payload.attempt !== p.attempt) throw new ThError("That board is old. Here is the new one.", 409);
      let v = p.vials;
      const moves: number[][] = payload.moves || [];
      if (moves.length > p.move_limit) throw new ThError("Too many moves.", 400);
      for (const [a, b] of moves) {
        if (!vialCanPour(v, p.cap, a, b)) throw new ThError("A pour didn't work. Try again.", 400);
        v = vialPour(v, p.cap, a, b);
      }
      if (vialSolved(v, p.cap)) return "";
      throw new ThError("The vials are not sorted yet.", 400);
    }
    case "wiring": {
      if (payload.attempt !== p.attempt) throw new ThError("That panel is old. Here is the new one.", 409);
      const rots: number[] = payload.rots || [];
      if (rots.length !== p.tiles.length) throw new ThError("The panel didn't send right.", 400);
      if (wirePowered(p.tiles.map(x => x[0]), rots, p.w, p.h, p.src).has(p.dst[1] * p.w + p.dst[0])) return "";
      throw new ThError("Not connected yet.", 400);
    }
    default:
      throw new ThError("Nothing to solve on this phone right now.", 400);
  }
}

export async function mockAct(t: string, from: string, action: ActAction, payload: Record<string, any>): Promise<ActResult> {
  const s = team(t);
  if (from !== s.step) return queue(() => ({ ok: false, msg: "stale" }));
  if (action === "scan") {
    if (s.step !== "scan") throw new ThError("Nothing to scan right now.", 400);
    if (String(payload.text || "").trim().toUpperCase() !== MOCK_ANSWERS.scan) throw new ThError("That is not the marker. Scan the one on your game screen.", 400);
    return queue(() => { setStep(s, "code_horde"); return { ok: true, msg: "" }; });
  }
  if (action === "fail") {
    if (s.step !== "mg2_game") throw new ThError("Nothing to fail here.", 400);
    return queue(() => {
      if (s.fails >= s.fail_cap) return { ok: false, msg: "cap" };
      s.fails += 1; s.attempt += 1; s.started = 0;
      return { ok: true, msg: "" };
    });
  }
  check(s, t, payload);
  const step = s.step;
  return queue(() => {
    if (s.step !== step) return { ok: false, msg: "stale" };
    setStep(s, ORDER[ORDER.indexOf(step) + 1]);
    return { ok: true, msg: "" };
  });
}

export async function mockResult(id: string): Promise<ActResult> {
  const p = pending.get(id);
  if (!p) throw new ThError("Unknown command.", 404);
  if (!p.done) return { done: false, pending: true };
  return { done: true, ok: p.ok, msg: p.msg, at: Math.floor(p.at / 1000) };
}

// The dev bar's "do the in-game part" button: the game moves the step on by itself
export function mockGameStep(t: string) {
  const s = team(t);
  const i = ORDER.indexOf(s.step);
  if (i < ORDER.length - 1) setStep(s, ORDER[i + 1]);
}

// The dev bar's "buzz on/off" button: the API's `buzz` flag (the team is at the special spot) in go_final
export function mockToggleBuzz(t: string) {
  const s = team(t);
  s.buzz = !s.buzz;
}

export function mockReset(t: string) {
  teams.delete(t);
}
