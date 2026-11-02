// @ts-nocheck
// components/security/lib.ts - shared bits for /security (Zombita's Security, its own page since 2026-10-16).
// Data: GET {API}/api/admin/security (bot zombita_security.py: the nightly report + the admin marks + running/error).
// Changes: POST {API}/api/admin/security {cmd: "run"} or {cmd: "watch", a, b, kind, note}. Admins only.
import { API } from "@/lib/constants";

export const C = {
  bg: "#0e0e0e", card: "#0d1117", inner: "#0a0d12", line: "#1e2530", text: "#c8cdd6", bright: "#e6e8ec", muted: "#8a8f98",
  gold: "#c8a84b", red: "#e05555", green: "#4caf7d", amber: "#d08c2c", blue: "#4a8fc4", track: "#161b23",
};
export const DISPLAY = "'Bebas Neue', sans-serif";
export const MONO = "'Share Tech Mono', monospace";
export const BODY = "'Inter', -apple-system, sans-serif";
export const PORTRAIT = "/avatars/stern_01.webp";

export const n = (v) => Number(v) || 0;
export const has = (v) => v !== null && v !== undefined;
export const plural = (k, word, many = word + "s") => `${k} ${k === 1 ? word : many}`;

// [key, title, colour, plain meaning]
export const GROUPS = [
  ["one", "One heartbeat", C.red, "Two names, and only one of them was really played at a time."],
  ["unclear", "Unclear", C.amber, "Sometimes both play, mostly one. Worth a look."],
  ["listening", "Listening", C.muted, "Not enough time online together yet. Zombita keeps listening."],
  ["two", "Two heartbeats", C.green, "Both characters play at the same time."],
  ["cleared", "Cleared", C.blue, "An admin confirmed these are two people."],
  ["control", "Yardstick", C.gold, "Real couples and friend pairs. Every other pair is compared with them."],
];
export const group = (k) => GROUPS.find((g) => g[0] === k) || [k, k || "?", C.muted, ""];
export const KIND_LABEL = { suspect: "watched as suspect", couple: "couple (yardstick)", friends: "friends (yardstick)", cleared: "cleared (two people)" };

// the bars on a case card: key, label, unit, what it means
export const METRICS = [
  ["both_pct", "Both moving", "%", "Of the minutes they were online together, how often both characters moved."],
  ["longest_both", "Longest run of both moving", " min", "The longest stretch where both kept moving, minute after minute."],
  ["kills_same_min", "Kills in the same minute", "", "Minutes where both of them killed a zombie."],
  ["car_together_min", "In a car together", " min", "Minutes both sat in cars right next to each other."],
  ["quick_replies", "Quick replies", "", "Chat lines answered within 10 seconds while both were on."],
  ["lines_to_each_other", "Lines naming the other", "", "Chat lines that mention the other name."],
  ["median_dist", "Usual distance apart", " tiles", "How far apart they usually were. Smaller means closer."],
];

export const pairKey = (p) => `${p.a}|${p.b}`;
export const samePair = (p, a, b) => {
  const x = String(p.a || "").toLowerCase(), y = String(p.b || "").toLowerCase();
  const s = String(a || "").toLowerCase(), t = String(b || "").toLowerCase();
  return (x === s && y === t) || (x === t && y === s);
};

export function when(ts) {
  if (!ts) return "never";
  const mins = Math.max(0, Math.round((Date.now() / 1000 - ts) / 60));
  const ago = mins < 60 ? `${mins} min ago` : mins < 2880 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} days ago`;
  return `${new Date(ts * 1000).toLocaleString()} (${ago})`;
}
export const utc = (ts) => (ts ? new Date(ts * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "?");
export const utcTime = (ts) => (ts ? new Date(ts * 1000).toISOString().slice(0, 19).replace("T", " ") : "?");
export const acct = (s) => (s ? `...${String(s).slice(-4)}` : "?");
export function gapText(sec) {
  const s = n(sec);
  if (s < 0) return "overlap";
  if (s < 120) return `${s} s`;
  return `${Math.round(s / 60)} min`;
}

export function whyLinked(p) {
  const L = p.link;
  if (!L) return [p.source === "admin" ? "Added by an admin." : "Picked by Zombita: they play together a lot."];
  const out = [];
  const why = Array.isArray(L.why) ? L.why : [];
  if (why.includes("steam_swap")) out.push("One joined on the other's Steam account.");
  if (why.includes("same_owner")) out.push("Same Steam family share owner.");
  if (L.same_home) out.push("Same home address (only a scrambled code is stored).");
  if (n(L.handovers)) out.push(`${plural(n(L.handovers), "handover")}: one logs out, the other logs in.`);
  if (n(L.parked)) out.push(`${plural(n(L.parked), "time")} one sat still next to the other.`);
  return out.length ? out : ["Linked."];
}

export async function getReport() {
  const r = await fetch(`${API}/api/admin/security`, { credentials: "include", cache: "no-store" });
  if (!r.ok) {
    const e = new Error((await r.json().catch(() => ({}))).detail || `HTTP ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

// ---- the full watch (bot zombita_threats.py): GET/POST {API}/api/admin/security/threats ----

// [key, title, colour, plain meaning]
export const RISKS = [
  ["serious", "Serious", C.red, "Needs the admins today."],
  ["suspicious", "Suspicious", C.amber, "Normal play doesn't explain something."],
  ["watch", "Watch", C.gold, "Worth a look, or an admin is watching."],
  ["clean", "Clean", C.green, "Nothing odd."],
];
export const risk = (k) => RISKS.find((r) => r[0] === k) || [k, k || "?", C.muted, ""];
export const SEVS = { critical: ["Critical", C.red], serious: ["Serious", "#e0794f"], watch: ["Watch", C.gold], info: ["Info", C.muted] };
export const SEV_ORDER = { critical: 3, serious: 2, watch: 1, info: 0 };
export const KINDS = {
  character: "Skills", kills: "Kills", anticheat: "Anti-cheat", moves: "Movement", admin: "Admin powers", money: "Money",
  items: "Items", ban_evasion: "Ban evasion", access: "Access", bites: "Zombita Bites", household: "Household",
};

export async function getThreats() {
  const r = await fetch(`${API}/api/admin/security/threats`, { credentials: "include", cache: "no-store" });
  if (!r.ok) {
    const e = new Error((await r.json().catch(() => ({}))).detail || `HTTP ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

export async function postThreats(body) {
  const r = await fetch(`${API}/api/admin/security/threats`, {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`);
  return d;
}

// bronze as silver + bronze (never gold)
export function money(b) {
  const v = Math.round(n(b));
  const s = Math.floor(Math.abs(v) / 1000), r = Math.abs(v) % 1000;
  return `${v < 0 ? "-" : ""}${s ? `${s}s ${r}b` : `${r}b`}`;
}
export const day = (ts) => (ts ? new Date(ts * 1000).toISOString().slice(0, 10) : "?");

// share mode: every player name but the ones on the case becomes "another player"
export function hideNames(text, keep, all) {
  let t = String(text ?? "");
  const k = new Set((keep || []).map((x) => String(x).toLowerCase()));
  const names = [...new Set((all || []).map(String))].filter((x) => x.length >= 3 && !k.has(x.toLowerCase())).sort((a, b) => b.length - a.length);
  for (const name of names) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp(`(^|[^A-Za-z0-9_])${esc}(?=$|[^A-Za-z0-9_])`, "gi"), "$1another player");
  }
  return t;
}

// ---- the ban watch (bot zombita_ban_watch.py): GET/POST {API}/api/admin/security/ban-watch ----
export async function getBanWatch() {
  const r = await fetch(`${API}/api/admin/security/ban-watch`, { credentials: "include", cache: "no-store" });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `HTTP ${r.status}`);
  return r.json();
}

export async function postBanWatch(body) {
  const r = await fetch(`${API}/api/admin/security/ban-watch`, {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`);
  return d;
}

export async function postSecurity(body) {
  const r = await fetch(`${API}/api/admin/security`, {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`);
  return d;
}
