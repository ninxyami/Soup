// @ts-nocheck
"use client";
// components/quests/ui.tsx: the /quests page's look. Same colours and fonts as Live Ops (/ops) and the admin panel,
// so it feels like part of the same tools, but its own small set of parts: one place to change the look.

import { useEffect, useRef, useState } from "react";
import { API } from "@/lib/constants";

export const C = {
  bg: "#0b0d10", panel: "#111418", panel2: "#161a20", line: "#242a33", lineSoft: "#1b2028",
  text: "#e2e5ea", dim: "#8b93a0", faint: "#5d6572",
  gold: "#c8a84b", blue: "#4a8fc4", green: "#4caf7d", red: "#e05555", orange: "#d4873a", purple: "#9775cc", teal: "#3aa8a0",
};
export const MONO = "var(--mono, 'Share Tech Mono', monospace)";
export const DISPLAY = "'Bebas Neue', sans-serif";
export const BODY = "Inter, system-ui, sans-serif";

// the game's tier colours (ZQ_Shared.lua Q.COLORS): D / C yellow, B / A blue, S and up gold
export const TIER = { D: "#edc740", C: "#edc740", B: "#599ef2", A: "#599ef2", S: "#ffcc2e", SS: "#ffcc2e", SSS: "#ffcc2e", "SSS+": "#ffcc2e" };
export const TIERS = ["D", "C", "B", "A", "S"];

// ── numbers and words ──────────────────────────────────────────────────────────────────────────────────────────────
export const fmt = (n) => Number(n || 0).toLocaleString("en-US");
/** bronze as silver + bronze (Nin 2026-10-11: no gold shown). 2500 -> "2s 500b". */
export function money(b) {
  b = Math.floor(Number(b) || 0);
  const neg = b < 0;
  if (neg) b = -b;
  const s = Math.floor(b / 1000), r = b % 1000;
  const t = s && r ? `${fmt(s)}s ${r}b` : s ? `${fmt(s)}s` : `${r}b`;
  return neg ? "-" + t : t;
}
export function dur(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  if (sec >= 2 * 86400) return `${Math.floor(sec / 86400)}d`;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
export function ago(atSec) {
  if (!atSec) return "never";
  const s = Math.max(0, Math.floor(Date.now() / 1000 - atSec));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
/** "Base.BoltCutters" -> "Bolt Cutters", "Base.Bullets9mmBox" -> "Bullets 9mm Box" (the game keeps no names here). */
export function itemName(id) {
  let s = String(id || "");
  const dot = s.indexOf(".");
  if (dot >= 0) s = s.slice(dot + 1);
  s = s.replace(/_/g, " ").replace(/([a-z])([A-Z0-9])/g, "$1 $2").replace(/([0-9])([A-Z][a-z])/g, "$1 $2").replace(/\s+/g, " ").trim();
  return s || String(id || "");
}
export const modOf = (id) => { const s = String(id || ""); const i = s.indexOf("."); return i > 0 ? s.slice(0, i) : ""; };
export const iconUrl = (id) => `${API}/media/items/${id}.png`;
/** the same template, whatever order its items are in */
export const sigOf = (items) => (items || []).map(([id, n]) => `${id}*${n}`).sort().join("|");

// ── small parts ────────────────────────────────────────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, c = "gold", sm, disabled, title, full, style }) {
  const col = C[c] || c;
  const solid = c === "solid";
  return (
    <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled} title={title}
      style={{ fontFamily: MONO, fontSize: sm ? 11 : 12, letterSpacing: 1, textTransform: "uppercase", padding: sm ? "4px 9px" : "7px 14px",
        background: solid ? C.gold : "transparent", color: solid ? "#111" : disabled ? C.faint : col,
        border: `1px solid ${disabled ? C.line : solid ? C.gold : col}`, cursor: disabled ? "default" : "pointer",
        width: full ? "100%" : undefined, whiteSpace: "nowrap", opacity: disabled ? 0.6 : 1, ...style }}>
      {children}
    </button>
  );
}

export function Card({ title, right, children, pad = 16, style }) {
  return (
    <section style={{ background: C.panel, border: `1px solid ${C.line}`, marginBottom: 16, ...style }}>
      {(title || right) && (
        <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 20, letterSpacing: 2, color: C.gold, flex: 1 }}>{title}</div>
          {right}
        </header>
      )}
      <div style={{ padding: pad }}>{children}</div>
    </section>
  );
}

export function Note({ children, c = "dim", style }) {
  const col = C[c] || c;
  return <div style={{ fontFamily: BODY, fontSize: 13, lineHeight: 1.5, color: c === "dim" ? C.dim : col,
    borderLeft: c === "dim" ? "none" : `3px solid ${col}`, paddingLeft: c === "dim" ? 0 : 10, ...style }}>{children}</div>;
}

export function Pill({ children, c = C.dim, solid, title, style }) {
  return <span title={title} style={{ display: "inline-block", fontFamily: MONO, fontSize: 11, padding: "1px 7px", lineHeight: "18px",
    border: `1px solid ${c}`, background: solid ? c : "transparent", color: solid ? "#111" : c, whiteSpace: "nowrap", ...style }}>{children}</span>;
}
export const TierPill = ({ t, style }) => <Pill c={TIER[t] || C.blue} solid style={{ fontWeight: 700, minWidth: 22, textAlign: "center", ...style }}>{t}</Pill>;

export function Stat({ label, value, sub, c = C.text }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: "12px 16px", minWidth: 0 }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: C.dim, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: DISPLAY, fontSize: 30, letterSpacing: 1, color: c, lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontFamily: BODY, fontSize: 12, color: C.dim, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export const inputStyle = { background: C.bg, border: `1px solid ${C.line}`, color: C.text, padding: "7px 10px", fontFamily: MONO, fontSize: 13, outline: "none", boxSizing: "border-box" };
export function Input({ value, onChange, placeholder, type = "text", width, min, max, style, onEnter, autoFocus }) {
  return <input type={type} value={value ?? ""} placeholder={placeholder} min={min} max={max} autoFocus={autoFocus}
    onChange={(e) => onChange(type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
    onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
    style={{ ...inputStyle, width: width ?? "100%", ...style }} />;
}
export function Select({ value, onChange, options, width, style }) {
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, width: width ?? "100%", ...style }}>
      {options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  );
}
export function Label({ children }) {
  return <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.2, color: C.dim, textTransform: "uppercase", marginBottom: 5 }}>{children}</div>;
}
export function Toggle({ on, onChange, disabled }) {
  return (
    <button type="button" onClick={() => !disabled && onChange(!on)} disabled={disabled} title={on ? "On" : "Off"}
      style={{ width: 42, height: 22, borderRadius: 11, border: `1px solid ${on ? C.green : C.line}`, background: on ? "rgba(76,175,125,0.25)" : C.bg,
        position: "relative", cursor: disabled ? "default" : "pointer", padding: 0, flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 16, height: 16, borderRadius: 8, background: on ? C.green : C.faint, transition: "left .15s" }} />
    </button>
  );
}
export function Empty({ children }) {
  return <div style={{ fontFamily: BODY, fontSize: 13, color: C.faint, padding: "18px 0", textAlign: "center" }}>{children}</div>;
}

export function ItemIcon({ id, size = 24 }) {
  const [bad, setBad] = useState(false);
  if (bad) return <span style={{ display: "inline-block", width: size, height: size, background: C.panel2, border: `1px solid ${C.lineSoft}`, flexShrink: 0 }} />;
  return <img src={iconUrl(id)} alt="" width={size} height={size} loading="lazy" onError={() => setBad(true)}
    style={{ imageRendering: "pixelated", flexShrink: 0, objectFit: "contain" }} />;
}

/** one item on a line: icon, readable name, the id underneath, how many */
export function ItemLine({ id, n, highlight }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "3px 0", minWidth: 0 }} title={id}>
      <ItemIcon id={id} size={26} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: BODY, fontSize: 13, color: highlight ? C.gold : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{itemName(id)}</div>
        {modOf(id) !== "Base" && <div style={{ fontFamily: MONO, fontSize: 10, color: C.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{modOf(id)}</div>}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 13, color: C.gold, flexShrink: 0 }}>x{n}</div>
    </div>
  );
}

export function Modal({ title, onClose, children, width = 640, footer }) {
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "flex-start",
      justifyContent: "center", padding: "6vh 16px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.gold}`, width, maxWidth: "100%" }}>
        <header style={{ display: "flex", alignItems: "center", padding: "12px 18px", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 22, letterSpacing: 2, color: C.gold, flex: 1 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.dim, fontSize: 22, cursor: "pointer" }} title="Close">×</button>
        </header>
        <div style={{ padding: 18 }}>{children}</div>
        {footer && <footer style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "12px 18px", borderTop: `1px solid ${C.line}` }}>{footer}</footer>}
      </div>
    </div>
  );
}

/** Ask before something that can't be taken back. word = what they must type (null = a plain yes/no). */
export function Confirm({ title, text, word, yes = "Yes", danger, onYes, onClose }) {
  const [typed, setTyped] = useState("");
  const ok = !word || typed.trim().toUpperCase() === word.toUpperCase();
  return (
    <Modal title={title} onClose={onClose} width={480} footer={<>
      <Btn c="dim" onClick={onClose}>Cancel</Btn>
      <Btn c={danger ? "red" : "gold"} disabled={!ok} onClick={() => { onYes(); onClose(); }}>{yes}</Btn>
    </>}>
      <Note>{text}</Note>
      {word && <div style={{ marginTop: 14 }}><Label>Type {word} to confirm</Label><Input value={typed} onChange={setTyped} autoFocus onEnter={() => ok && (onYes(), onClose())} /></div>}
    </Modal>
  );
}

/** Search the game's item list (the bot's catalog) and pick one. */
export function ItemPicker({ apiGet, onPick, onClose }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [n, setN] = useState(1);
  const [loading, setLoading] = useState(false);
  const t = useRef(null);
  useEffect(() => {
    clearTimeout(t.current);
    if (q.trim().length < 2) { setRes([]); return; }
    t.current = setTimeout(async () => {
      setLoading(true);
      try { const d = await apiGet(`/api/admin/jobs/items?q=${encodeURIComponent(q.trim())}`); setRes(d.matches || []); }
      catch { setRes([]); }
      setLoading(false);
    }, 300);
  }, [q]);
  return (
    <Modal title="Add an item" onClose={onClose} width={620}>
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <Input autoFocus value={q} onChange={setQ} placeholder="Search: bandage, katana, Base.Battery..." />
        <Input type="number" value={n} onChange={(v) => setN(Math.max(1, Math.min(100, Number(v) || 1)))} width={80} min={1} max={100} />
      </div>
      {loading && <Note>Searching...</Note>}
      {!loading && q.trim().length >= 2 && res.length === 0 && <Empty>No item found.</Empty>}
      <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: "50vh", overflowY: "auto" }}>
        {res.map((it) => (
          <button key={it.id} type="button" onClick={() => onPick(it, n)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", background: C.bg, border: `1px solid ${C.line}`, color: C.text, cursor: "pointer", textAlign: "left" }}>
            <ItemIcon id={it.id} size={30} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: BODY, fontSize: 14 }}>{it.name}</div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: C.dim }}>{it.id}{it.category ? ` / ${it.category}` : ""}{it.mod ? ` / ${it.mod}` : ""}{it.rarity ? ` / ${it.rarity} (tier ${it.tier})` : ""}</div>
            </span>
            <span style={{ fontFamily: MONO, color: C.gold }}>+ {n}</span>
          </button>
        ))}
      </div>
      <Note style={{ marginTop: 12 }}>The game checks every item again. One it doesn't have (a removed mod) is refused.</Note>
    </Modal>
  );
}

/** Edit a list of [item, count] pairs. */
export function ItemsEditor({ items, onChange, apiGet, onMeta = null }) {
  const [pick, setPick] = useState(false);
  const set = (i, n) => onChange(items.map((it, k) => (k === i ? [it[0], Math.max(1, Math.min(100, Number(n) || 1))] : it)));
  return (
    <div>
      {items.length === 0 && <Empty>No items yet. Add at least one.</Empty>}
      {items.map(([id, n], i) => (
        <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
          <ItemIcon id={id} size={30} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: BODY, fontSize: 14, color: C.text }}>{itemName(id)}</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{id}</div>
          </div>
          <Btn sm c="dim" onClick={() => set(i, n - 1)}>-</Btn>
          <Input type="number" value={n} onChange={(v) => set(i, v)} width={64} min={1} max={100} style={{ textAlign: "center" }} />
          <Btn sm c="dim" onClick={() => set(i, n + 1)}>+</Btn>
          <Btn sm c="red" onClick={() => onChange(items.filter((_, k) => k !== i))} title="Remove this item">Remove</Btn>
        </div>
      ))}
      <div style={{ marginTop: 10 }}>
        <Btn sm onClick={() => setPick(true)} disabled={items.length >= 20}>+ Add item</Btn>
        {items.length >= 20 && <span style={{ marginLeft: 10, fontFamily: BODY, fontSize: 12, color: C.dim }}>20 items is the most a template can hold.</span>}
      </div>
      {pick && (
        <ItemPicker apiGet={apiGet} onClose={() => setPick(false)} onPick={(it, n) => {
          if (onMeta) onMeta(it);           // the Give form keeps each item's rarity tier (give_tiers)
          const i = items.findIndex((x) => x[0] === it.id);
          onChange(i >= 0 ? items.map((x, k) => (k === i ? [x[0], Math.min(100, x[1] + n)] : x)) : [...items, [it.id, n]]);
          setPick(false);
        }} />
      )}
    </div>
  );
}

/** Pages for a long list. */
export function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", margin: "14px 0 4px" }}>
      <Btn sm c="dim" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</Btn>
      <span style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>Page {page} of {pages}</span>
      <Btn sm c="dim" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Btn>
    </div>
  );
}
