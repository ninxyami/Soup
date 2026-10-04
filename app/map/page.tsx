// @ts-nocheck
"use client";
// app/map/page.tsx - the server's world map (our own render, our own server). Players see the map and the places;
// a logged-in player's own dot comes with the live layer. Admins get the separate Live Ops panel.
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { KIND } from "@/components/WorldMap";
import { API } from "@/lib/constants";

const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

export default function MapPage() {
  const [places, setPlaces] = useState([]);
  const [hidden, setHidden] = useState({});
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(null);

  // live dots: admins see everyone (/api/map/live), a logged-in player only themselves (/api/map/me), others nobody.
  // Positions come from mod 1.7.110 (every 5 s); polled every 5 s while the page is open.
  const [dots, setDots] = useState([]);
  const [live, setLive] = useState(null);       // { mode: "admin"|"me", text }
  useEffect(() => {
    let stop = false, timer = null, mode = "admin";
    const tick = async () => {
      try {
        if (mode === "admin") {
          const r = await fetch(`${API}/api/map/live`, { credentials: "include" });
          if (r.ok) {
            const d = await r.json();
            const g = d.game;
            const clock = g ? ` - in game ${String(g.hour).padStart(2, "0")}:${String(g.minute).padStart(2, "0")}` : "";
            setDots((d.players || []).map((p) => ({ id: p.name, label: p.name, x: p.x, y: p.y,
              color: p.dead ? "#e05555" : p.in_vehicle ? "#4a8fc4" : "#4caf7d" })));
            setLive({ mode: "admin", text: d.stale ? "No live positions (nobody online, or the server is paused)" : `${d.count} online${clock}` });
          } else mode = r.status === 401 ? "none" : "me";     // 403 = logged in but not an admin
        }
        if (mode === "me") {
          const r = await fetch(`${API}/api/map/me`, { credentials: "include" });
          if (r.ok) {
            const d = await r.json();
            setDots(d.me ? [{ id: "me", label: "You", x: d.me.x, y: d.me.y, color: "#c8a84b" }] : []);
            setLive({ mode: "me", text: d.me ? "You're on the map" : (d.name ? `${d.name} isn't in game right now` : "Link your in-game name to see yourself") });
          } else mode = "none";
        }
        if (mode === "none") { setDots([]); setLive(null); return; }   // logged out: nothing to poll
      } catch { /* network blip: try again next tick */ }
      if (!stop) timer = setTimeout(tick, 5000);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, []);
  // fill exactly the space under the site menu (its height changes with the screen width)
  const [top, setTop] = useState(0);
  useEffect(() => {
    const measure = () => {
      const nav = document.querySelector("body > nav, body > header, nav");
      setTop(nav ? Math.round(nav.getBoundingClientRect().bottom) : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    const t = setTimeout(measure, 300);
    return () => { window.removeEventListener("resize", measure); clearTimeout(t); };
  }, []);

  useEffect(() => {
    fetch("/map/places.json").then((r) => r.json()).then((d) => setPlaces(d.places || [])).catch(() => {});
  }, []);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return places.filter((p) => (p.name + " " + (p.role || "") + " " + (p.town || "")).toLowerCase().includes(s)).slice(0, 8);
  }, [q, places]);

  const go = (p) => {
    setQ("");
    const u = new URL(window.location.href);
    u.searchParams.set("x", String(p.x)); u.searchParams.set("y", String(p.y)); u.searchParams.set("z", p.kind === "town" ? "0.3" : "1.2");
    window.location.href = u.toString();            // simplest reliable re-centre: reload with the new view
  };

  return (
    <div style={{ position: "fixed", top, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", background: "#07090b" }}>
      <div className="flex items-center gap-3 flex-wrap px-4 py-2 border-b border-[#1a1a1a]">
        <h1 className="text-[1.2rem] tracking-[0.2em] !m-0 mr-2">WORLD MAP</h1>
        {Object.entries(KIND).map(([k, v]) => (
          <button key={k} onClick={() => setHidden((h) => ({ ...h, [k]: !h[k] }))}
            className="font-mono text-[0.68rem] px-2 py-1 border rounded-sm"
            style={{ borderColor: hidden[k] ? "#222" : "#333", color: hidden[k] ? "#555" : "#ddd", background: "transparent" }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: v.color, marginRight: 6, opacity: hidden[k] ? 0.3 : 1 }} />
            {v.label}
          </button>
        ))}
        {live && (
          <span className="font-mono text-[0.68rem]" style={{ color: live.mode === "admin" ? "#c8a84b" : "#9aa" }}>
            {live.mode === "admin" ? "ADMIN VIEW - " : ""}{live.text}
          </span>
        )}
        <div className="flex-1" />
        <div style={{ position: "relative" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a shop, station or town"
            className="font-mono text-[0.75rem] px-3 py-1.5 bg-[#0d1014] border border-[#2a2f37] text-[#ddd] rounded-sm" style={{ width: 260 }} />
          {matches.length > 0 && (
            <div style={{ position: "absolute", right: 0, top: "110%", zIndex: 20, width: 300, background: "#0d1014", border: "1px solid #2a2f37" }}>
              {matches.map((p) => (
                <button key={p.kind + p.id + p.x} onClick={() => go(p)} className="block w-full text-left px-3 py-1.5 font-mono text-[0.72rem] hover:bg-[#151a20]"
                  style={{ color: "#ddd", background: "transparent", border: "none" }}>
                  <span style={{ color: KIND[p.kind]?.color }}>&#9679;</span> {p.name}
                  <span style={{ color: "#666" }}>{p.role ? " - " + p.role : ""}{p.town ? " - " + p.town : ""}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <WorldMap places={places} dots={dots} hidden={hidden} focus={focus} />
    </div>
  );
}
