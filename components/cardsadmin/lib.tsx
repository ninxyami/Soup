// @ts-nocheck
"use client";
// components/cardsadmin/lib.tsx: the /cards-admin page's small helpers. The look is the /quests kit (components/quests/ui):
// same colours, buttons, cards, modals, so the admin tools feel like one set.

import { useState } from "react";
import { C, MONO, BODY, money, fmt, inputStyle } from "../quests/ui";

export const CARD_IDS = ["merchant", "artisan", "provider", "hunter", "mechanic", "medic", "adventurer", "guardian"];

/** the game's card colour ([r, g, b] 0..1) as CSS */
export function cardHex(c) {
  if (!Array.isArray(c)) return C.gold;
  return "#" + c.slice(0, 3).map((v) => Math.round(Math.max(0, Math.min(1, +v)) * 255).toString(16).padStart(2, "0")).join("");
}
export const cardArt = (id) => `/cards/${id}.webp`;

/** rank from lifetime points: { i (1..4), name, next (name or ""), nextAt } */
export function rankOf(life, ranks) {
  const rs = ranks?.length ? ranks : [{ name: "Apprentice", min: 0 }, { name: "Journeyman", min: 100 }, { name: "Expert", min: 300 }, { name: "Master", min: 800 }];
  let i = 0;
  rs.forEach((r, k) => { if (Number(life || 0) >= Number(r.min || 0)) i = k; });
  const nx = rs[i + 1];
  return { i: i + 1, name: rs[i].name, next: nx ? nx.name : "", nextAt: nx ? nx.min : 0 };
}
export const RANK_NAMES = ["Apprentice", "Journeyman", "Expert", "Master"];

/** time left to an epoch second: "4d 3h" / "5h 20m" / "ended" */
export function left(until) {
  const s = Math.floor(Number(until || 0) - Date.now() / 1000);
  if (s <= 0) return "ended";
  if (s >= 86400) return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
export function when(at) {
  if (!at) return "-";
  return new Date(at * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ── the settings: which card each belongs to, which are money ──────────────────────────────────────────────────────
const MONEY_KEYS = ["price", "deliveryMin", "deliveryMax", "rankFee2", "rankFee3", "rankFee4", "callMin", "callMax", "whMaxUnit"];
export const isMoney = (row) => MONEY_KEYS.includes(row.key) || /\(bronze\)/i.test(row.label || "");
export function showValue(row, v = row.value) {
  if (v === undefined || v === null || v === "") return "-";
  if (isMoney(row)) return Number.isInteger(Number(v)) ? money(v) : `${v} b`;
  return String(v);
}

/** the card a setting belongs to ("" = every card) */
export function cardOfSetting(row) {
  const k = row.key || "", g = row.group || "";
  if (g === "Mechanic card" || k === "roadsideFixed") return "mechanic";
  if (/^hunter\d$/.test(k)) return "hunter";
  if (/^rest(\d|Master)$/.test(k)) return "adventurer";
  if (g === "Market" || g === "Wholesale") return "merchant";
  if (k === "goalKillsPerPoint") return "guardian";
  return "";
}
export const WEAR_GROUP = "Tool wear";
export const SHOP_GROUP = "Card shop";

/** settingRows -> [[group, rows]] in the game's order, filtered */
export function groupRows(rows, keep) {
  const out = [];
  for (const r of rows || []) {
    if (!keep(r)) continue;
    const g = r.group || "Other";
    let e = out.find((x) => x[0] === g);
    if (!e) { e = [g, []]; out.push(e); }
    e[1].push(r);
  }
  return out;
}

// ── tool wear: what wears with which card (the same list as the mod's ZW_Wear.lua W.ACTIONS) ───────────────────────
export const WEAR_ACTIONS = [
  ["car", "Car work (installs, take-offs, tires, engine, car welding, burnt wrecks, Zombita's Garage)", ["mechanic"]],
  ["torchrefill", "Torch refills from a propane tank", ["mechanic"]],
  ["medical", "Bullets, glass, stitches", ["medic"]],
  ["crafting", "Crafting recipes", ["smith", "carpenter", "tailor", "artisan"]],
  ["building", "Building", ["carpenter", "smith", "artisan"]],
  ["fixing", "Fixing items (not cars)", ["smith", "tailor"]],
  ["wood", "Chopping, barricades, dismantling", ["carpenter"]],
  ["smash", "Smashing things", ["artisan", "guardian"]],
  ["digging", "Digging", ["provider", "artisan"]],
  ["farming", "Farming", ["provider"]],
  ["animals", "Butchering, shearing", ["provider", "hunter"]],
  ["fishing", "Fishing", ["provider"]],
];
export const FUTURE_CARDS = { smith: "Smith", carpenter: "Carpenter", tailor: "Tailor" };

// ── the log's words ────────────────────────────────────────────────────────────────────────────────────────────────
export const EVENT_WORDS = {
  bought: ["Bought", C.green], earned: ["Took an earned card", C.green], granted: ["Given by an admin", C.blue],
  offer: ["Offered (earned slot)", C.gold], declined: ["Turned the offer down", C.dim], renewed: ["Renewed", C.teal],
  lapsed: ["Ran out", C.orange], ended: ["Card ended", C.red], points_reset: ["CARD POINTS RESET", C.red],
};
export function eventLine(e) {
  if (e.t === "points_reset") return `${e.by || "?"} reset every card's points (${fmt(e.players)} players, occupation head starts kept)`;
  const bits = [];
  if (e.pts) bits.push(`${fmt(e.pts)} recent points`);
  if (e.why && e.t === "ended") bits.push(e.why);
  if (e.until && e.t !== "offer") bits.push(`until ${when(e.until)}`);
  return bits.join(", ");
}

// ── small parts the quests kit doesn't have ────────────────────────────────────────────────────────────────────────
export function Check({ ok, warn, label, sub, children }) {
  const col = ok ? C.green : warn ? C.orange : C.red;
  return (
    <div style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.lineSoft}`, alignItems: "flex-start" }}>
      <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 11, border: `2px solid ${col}`, color: col, display: "inline-flex",
        alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 13, marginTop: 1 }}>{ok ? "✓" : warn ? "!" : "×"}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: BODY, fontSize: 14, color: C.text }}>{label}</div>
        {sub && <div style={{ fontFamily: BODY, fontSize: 12, color: C.dim, marginTop: 2, overflowWrap: "anywhere" }}>{sub}</div>}
        {children}
      </div>
    </div>
  );
}

/** a row of label / value pairs that wraps on a phone */
export function KV({ k, v, c = C.text }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "4px 0", fontFamily: MONO, fontSize: 12, flexWrap: "wrap" }}>
      <span style={{ color: C.dim, minWidth: 130 }}>{k}</span><span style={{ color: c, overflowWrap: "anywhere" }}>{v}</span>
    </div>
  );
}

/** a card's picture with its colour edge; dim when the card is off */
export function CardArt({ card, size = 64, on = true }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={cardArt(card.id)} alt="" width={size} height={Math.round(size * 1.4)} loading="lazy"
      style={{ objectFit: "cover", border: `2px solid ${cardHex(card.color)}`, flexShrink: 0, filter: on ? "none" : "grayscale(0.85) brightness(0.6)", background: C.bg }} />
  );
}

/** an in-game name box that suggests the players the game knows */
let nameListN = 0;
export function NameInput({ value, onChange, names = [], placeholder = "in-game name", onEnter = null, big = false }) {
  const [id] = useState(() => `ca-names-${++nameListN}`);
  return (
    <>
      <input list={id} value={value ?? ""} placeholder={placeholder} autoComplete="off" spellCheck={false}
        onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
        style={{ ...inputStyle, width: "100%", ...(big ? { fontSize: 16, padding: "10px 12px" } : {}) }} />
      <datalist id={id}>{names.slice(0, 400).map((n) => <option key={n} value={n} />)}</datalist>
    </>
  );
}

/** the list a thin page sees as rows and a wide one as a grid */
export const grid = (min) => ({ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))`, gap: 12 });
