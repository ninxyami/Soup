// @ts-nocheck
"use client";
// components/MapSidebar.tsx - the public map's side list (Nin 2026-10-04): who's online, events (the admins' markers),
// shops by town, bus stations, towns and the diner. Click anything to fly the map there. Collapses to a thin tab;
// open / closed and which sections are open are remembered per browser. Over the map on small screens.
import { useEffect, useMemo, useState } from "react";
import { flyTo, KIND } from "@/components/WorldMap";

const MARK = { go: "#e8be4a", event: "#ec8c3c", info: "#60a0dc", danger: "#e05246" };
const mono = { fontFamily: "var(--mono, monospace)" };

function load(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } }
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

function Item({ color, title, sub, onClick, ring = false }) {
  return (
    <button onClick={onClick} className="block w-full text-left hover:bg-[#151a20]"
      style={{ ...mono, fontSize: 12, padding: "5px 12px", background: "transparent", border: 0, color: "#ddd", cursor: "pointer" }}>
      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: color, marginRight: 8,
        boxShadow: ring ? "0 0 0 2px #c8a84b" : "none" }} />
      {title}{sub && <span style={{ color: "#6b737d" }}> {sub}</span>}
    </button>
  );
}

function Section({ id, title, count, open, toggle, children }) {
  return (
    <div style={{ borderBottom: "1px solid #1c2128" }}>
      <button onClick={() => toggle(id)} className="w-full text-left"
        style={{ ...mono, fontSize: 11, padding: "9px 12px", background: "transparent", border: 0, color: "#c9cdd2", cursor: "pointer",
          textTransform: "uppercase", letterSpacing: 1, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "#6b737d", width: 10 }}>{open ? "▾" : "▸"}</span>{title}
        <span style={{ marginLeft: "auto", color: "#6b737d" }}>{count}</span>
      </button>
      {open && <div style={{ paddingBottom: 6 }}>{children}</div>}
    </div>
  );
}

export default function MapSidebar({ players = [], markers = [], places = [], live = null }) {
  const [shown, setShown] = useState(true);
  const [open, setOpen] = useState({ players: true, events: true, shop: false, bus: false, town: false, diner: false });
  const [q, setQ] = useState("");
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const small = window.innerWidth < 760;
    setNarrow(small);
    setShown(load("soup-map-side", !small));
    setOpen((o) => ({ ...o, ...load("soup-map-side-open", {}) }));
    const r = () => setNarrow(window.innerWidth < 760);
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);
  const show = (v) => { setShown(v); save("soup-map-side", v); };
  const toggle = (id) => setOpen((o) => { const n = { ...o, [id]: !o[id] }; save("soup-map-side-open", n); return n; });

  const s = q.trim().toLowerCase();
  const hit = (...parts) => !s || parts.join(" ").toLowerCase().includes(s);
  const fly = (x, y, z) => { flyTo(x, y, z); if (narrow) show(false); };

  const byKind = useMemo(() => {
    const out = { shop: [], bus: [], town: [], diner: [] };
    for (const p of places) (out[p.kind] || (out[p.kind] = [])).push(p);
    for (const k of Object.keys(out)) out[k].sort((a, b) => String(a.town || a.name).localeCompare(String(b.town || b.name)) || a.name.localeCompare(b.name));
    return out;
  }, [places]);
  const shopsByTown = useMemo(() => {
    const g = {};
    for (const p of byKind.shop) if (hit(p.name, p.role, p.town)) (g[p.town || "Elsewhere"] = g[p.town || "Elsewhere"] || []).push(p);
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  }, [byKind, s]);

  if (!shown) {
    return (
      <button onClick={() => show(true)} title="Show the list"
        style={{ ...mono, position: "absolute", right: 0, top: 70, zIndex: 15, fontSize: 11, padding: "10px 6px", writingMode: "vertical-rl",
          background: "rgba(13,16,20,.92)", color: "#c9cdd2", border: "1px solid #2a2f37", borderRight: 0, borderRadius: "4px 0 0 4px", cursor: "pointer",
          letterSpacing: 2, textTransform: "uppercase" }}>
        ◂ Players &amp; places
      </button>
    );
  }

  const ps = players.filter((p) => hit(p.label));
  const ms = markers.filter((m) => hit(m.title, m.text));
  const list = (kind, z) => byKind[kind].filter((p) => hit(p.name, p.role, p.town)).map((p) =>
    <Item key={kind + p.id + p.x} color={KIND[kind]?.color} title={p.name} sub={kind === "town" ? "" : [p.role, kind === "bus" ? p.town : ""].filter(Boolean).join(" · ")}
      onClick={() => fly(p.x, p.y, z)} />);

  return (
    <aside style={{ width: 280, maxWidth: "86vw", display: "flex", flexDirection: "column", background: "rgba(13,16,20,.97)", borderLeft: "1px solid #1c2128",
      ...(narrow ? { position: "absolute", right: 0, top: 0, bottom: 0, zIndex: 15 } : { position: "relative" }) }}>
      <div style={{ display: "flex", gap: 6, padding: "8px 10px", borderBottom: "1px solid #1c2128", alignItems: "center" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter the list"
          style={{ ...mono, flex: 1, minWidth: 0, fontSize: 12, padding: "5px 8px", background: "#0b0d10", color: "#ddd", border: "1px solid #2a2f37", borderRadius: 3 }} />
        <button onClick={() => show(false)} title="Hide the list"
          style={{ ...mono, fontSize: 12, padding: "4px 8px", background: "transparent", color: "#9aa", border: "1px solid #2a2f37", borderRadius: 3, cursor: "pointer" }}>▸</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 72 }}>{/* room for the Zombita chat bubble in the corner */}
        <Section id="players" title="Online now" count={players.length} open={open.players} toggle={toggle}>
          {ps.length === 0 && <div style={{ ...mono, fontSize: 11, color: "#6b737d", padding: "4px 12px" }}>{live?.text || "Nobody online right now"}</div>}
          {ps.map((p) => <Item key={p.id} color={p.color} title={p.label} ring={p.color === "#c8a84b"} onClick={() => fly(p.x, p.y, 1.6)} />)}
        </Section>
        <Section id="events" title="Events & markers" count={markers.length} open={open.events} toggle={toggle}>
          {ms.length === 0 && <div style={{ ...mono, fontSize: 11, color: "#6b737d", padding: "4px 12px" }}>No events on the map right now.</div>}
          {ms.map((m) => <Item key={m.id} color={MARK[m.kind] || MARK.go} title={m.title} sub={m.text || ""} onClick={() => fly(m.x, m.y, 1.4)} />)}
        </Section>
        <Section id="shop" title="Shops" count={byKind.shop.length} open={open.shop} toggle={toggle}>
          {shopsByTown.map(([town, shops]) => (
            <div key={town}>
              <div style={{ ...mono, fontSize: 10, color: "#6b737d", padding: "6px 12px 2px", textTransform: "uppercase", letterSpacing: 1 }}>{town}</div>
              {shops.map((p) => <Item key={p.id} color={KIND.shop.color} title={p.name} sub={p.role || ""} onClick={() => fly(p.x, p.y, 1.4)} />)}
            </div>
          ))}
        </Section>
        <Section id="bus" title="Bus stations" count={byKind.bus.length} open={open.bus} toggle={toggle}>{list("bus", 1.4)}</Section>
        <Section id="town" title="Towns" count={byKind.town.length} open={open.town} toggle={toggle}>{list("town", 0.35)}</Section>
        {byKind.diner.length > 0 && <Section id="diner" title="Zombita's diner" count={byKind.diner.length} open={open.diner} toggle={toggle}>{list("diner", 1.6)}</Section>}
      </div>
    </aside>
  );
}
