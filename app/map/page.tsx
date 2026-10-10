// @ts-nocheck
"use client";
// app/map/page.tsx - the server's world map (our own render, our own server). Everyone sees the map, the places and
// every online player; a logged-in player's own dot is gold. Admins get the separate Live Ops panel.
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { KIND } from "@/components/WorldMap";
import MapSidebar from "@/components/MapSidebar";
import { API } from "@/lib/constants";

const MARK = { go: { color: "#e8be4a" }, event: { color: "#ec8c3c" }, info: { color: "#60a0dc" }, danger: { color: "#e05246" } };
const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

export default function MapPage() {
  const [places, setPlaces] = useState([]);
  const [hidden, setHidden] = useState({});
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(null);

  // live dots (Nin 2026-10-04: "it should draw for everyone"): everyone sees every online player (/api/map/players);
  // a logged-in player's own dot is gold (their linked name from /api/map/me, asked once); admins get /api/map/live
  // (same dots + the in-game clock). Positions come from mod 1.7.110 (every 5 s); polled every 5 s while the page is open.
  const [dots, setDots] = useState([]);
  // the admins' map markers (Live Ops, mod 1.7.112): the same ones players see on their map in game
  const [markers, setMarkers] = useState([]);
  useEffect(() => {
    let stop = false, timer = null;
    const tick = async () => {
      try { const r = await fetch(`${API}/api/map/markers`); if (r.ok) setMarkers((await r.json()).markers || []); } catch {}
      if (!stop) timer = setTimeout(tick, 30000);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, []);
  const [live, setLive] = useState(null);       // { mode: "admin"|"public", text }
  useEffect(() => {
    let stop = false, timer = null, mode = "admin", myName = null, loggedIn = false;
    const colour = (p, mine) => (mine ? "#c8a84b" : p.dead ? "#e05555" : p.in_vehicle ? "#4a8fc4" : "#4caf7d");
    const clockOf = (g) => (g ? ` - in game ${String(g.hour).padStart(2, "0")}:${String(g.minute).padStart(2, "0")}` : "");
    const show = (d, m) => {
      const mine = (p) => myName && p.name.toLowerCase() === myName.toLowerCase();
      setDots((d.players || []).map((p) => ({ id: p.name, label: mine(p) ? `${p.name} (you)` : p.name, x: p.x, y: p.y, z: p.z, color: colour(p, mine(p)),
        look: p.look, face: p.face, inCar: !!p.in_vehicle, dead: !!p.dead, car: p.car, carAngle: p.car_angle })));
      const n = d.count ?? (d.players || []).length;
      setLive({ mode: m, text: d.stale ? "Nobody online right now" : `${n} online${clockOf(d.game)}` });
    };
    const tick = async () => {
      try {
        if (mode === "admin") {
          const r = await fetch(`${API}/api/map/live`, { credentials: "include" });
          if (r.ok) show(await r.json(), "admin");
          else {
            loggedIn = r.status === 403;                       // 403 = logged in but not an admin
            mode = "public";
            if (loggedIn) {
              try {
                const m = await fetch(`${API}/api/map/me`, { credentials: "include" });
                if (m.ok) myName = (await m.json()).name || null;
              } catch { /* no name: no gold dot */ }
            }
          }
        }
        if (mode === "public") {
          const r = await fetch(`${API}/api/map/players`);
          if (r.ok) show(await r.json(), "public");
          else if (r.status === 404 && loggedIn) {              // older API without the public route: just yourself
            const m = await fetch(`${API}/api/map/me`, { credentials: "include" });
            const d = m.ok ? await m.json() : {};
            setDots(d.me ? [{ id: "me", label: "You", x: d.me.x, y: d.me.y, color: "#c8a84b" }] : []);
            setLive(d.me ? { mode: "public", text: "You're on the map" } : null);
          } else { setDots([]); setLive(null); }
        }
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
      const floating = nav && getComputedStyle(nav).position === "fixed";     // the menu called up over the map
      setTop(document.fullscreenElement || !nav || floating ? 0 : Math.round(nav.getBoundingClientRect().bottom));
    };
    measure();
    window.addEventListener("resize", measure);
    document.addEventListener("fullscreenchange", measure);
    const t = setTimeout(measure, 300);
    return () => { window.removeEventListener("resize", measure); clearTimeout(t); };
  }, []);

  // the build-time list, then where shops and stations stand NOW (admins move them; destroyed ones drop out)
  useEffect(() => {
    (async () => {
      let list = [];
      try { list = (await (await fetch("/map/places.json")).json()).places || []; } catch {}
      try {
        const r = await fetch(`${API}/api/map/kiosks`);
        const ks = r.ok ? (await r.json()).kiosks || [] : [];
        if (ks.length) {
          const by = {};
          for (const k of ks) by[k.kind + ":" + k.id] = k;
          list = list.filter((p) => !(by[p.kind + ":" + p.id]?.off)).map((p) => {
            const live = by[p.kind + ":" + p.id];          // where it stands now; a moved bus station is named after its town (mod 1.7.160)
            return live ? { ...p, x: live.x, y: live.y, name: p.kind === "bus" && live.name ? live.name : p.name } : p;
          });
        }
      } catch {}
      setPlaces(list);
    })();
  }, []);

  const shownDots = useMemo(() => [
    ...(hidden.markers ? [] : markers.map((m) => ({ id: "m:" + m.id, label: m.text ? `${m.title} - ${m.text}` : m.title, x: m.x, y: m.y, size: 12,
      color: (MARK[m.kind] || MARK.go).color }))),
    ...(hidden.players ? [] : dots),
  ], [dots, markers, hidden.players, hidden.markers]);

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
    <div data-fs-root style={{ position: "fixed", top, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", background: "#07090b" }}>
      <div className="flex items-center gap-3 flex-wrap px-4 pt-4 pb-2 border-b border-[#1a1a1a]">
        <a href="/" title="Back to the website" className="font-mono text-[11px] text-[#777] no-underline hover:text-[#e6e6e6]">← site</a>
        <h1 className="text-[1.2rem] tracking-[0.2em] !m-0 mr-2">WORLD MAP</h1>
        {Object.entries(KIND).map(([k, v]) => (
          <button key={k} onClick={() => setHidden((h) => ({ ...h, [k]: !h[k] }))}
            className="font-mono text-[0.68rem] px-2 py-1 border rounded-sm"
            style={{ borderColor: hidden[k] ? "#222" : "#333", color: hidden[k] ? "#555" : "#ddd", background: "transparent" }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: v.color, marginRight: 6, opacity: hidden[k] ? 0.3 : 1 }} />
            {v.label}
          </button>
        ))}
        {[["players", "Players", "#4caf7d"], ["markers", "Markers", "#e8be4a"]].map(([k, label, color]) => (
          <button key={k} onClick={() => setHidden((h) => ({ ...h, [k]: !h[k] }))}
            className="font-mono text-[0.68rem] px-2 py-1 border rounded-sm"
            style={{ borderColor: hidden[k] ? "#222" : "#333", color: hidden[k] ? "#555" : "#ddd", background: "transparent" }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: color, marginRight: 6, opacity: hidden[k] ? 0.3 : 1 }} />
            {label}{k === "markers" && markers.length ? ` (${markers.length})` : ""}
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
      <div style={{ flex: 1, minHeight: 0, display: "flex", position: "relative" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <WorldMap places={places} dots={shownDots} hidden={hidden} focus={focus} />
        </div>
        <MapSidebar players={dots} markers={markers} places={places} live={live} />
      </div>
    </div>
  );
}
