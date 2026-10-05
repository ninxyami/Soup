// @ts-nocheck
"use client";
// components/WorldMap.tsx
//
// The server's map: our own render of the whole world (vanilla + every map mod in servertest.ini Map=, merged the way
// the server merges them), served from OUR box as Deep Zoom images, drawn with OpenSeadragon (BSD, bundled into this
// site). Places (shops, bus stations, the diner, towns) come from /map/places.json, generated from the mod's own data
// by Zombita_PC_Kit/docs/make_map_places.py. Nothing here loads from anyone else's servers.
//
// Two views:
// - Top: one image, top-down. Image starts at world (x0, y0) with `sqr` pixels per square (map_info.json), so
//   image px = (world - origin) * sqr.
// - 3D: the isometric "Zombita World" render (pzmap2dzi), one image per floor (layer{N}.dzi), all the same size and
//   origin. Square (x, y) on floor L: image x = x0 + (x - y) * 64, y = y0 + (x + y) * 32 - 192 * L (x0 / y0 / sqr = 128
//   from its map_info.json; this is the top vertex of the square's diamond, the floor height is baked into the pixels).
//   Floors 0..current are stacked (basements: current..-1), like pzmap's own viewer.
// Every world <-> image conversion goes through w2img / img2w below, so dots, boxes, pins, clicks and flyTo work in both.

import { useEffect, useMemo, useRef, useState } from "react";
import { API } from "@/lib/constants";
import GameTimeWidget from "@/components/GameTimeWidget";

const TILE_BASE = (process.env.NEXT_PUBLIC_MAP_TILES || "https://api.stateofundeadpurge.site/map-tiles/v1").replace(/\/$/, "");
// The second look (Nin 2026-10-04: "keep tab to show both styles"): the same world drawn the way the game's paper map
// draws it (buildings as white floor plans). Same size and origin as v1, so it sits exactly on top as a second layer.
// The button only appears once that folder answers.
const CARTO_BASE = (process.env.NEXT_PUBLIC_MAP_TILES_CARTO || "https://api.stateofundeadpurge.site/map-tiles/carto1").replace(/\/$/, "");
// The 3D (isometric) world. The Top / 3D switch only appears once its map_info.json answers.
const ISO_BASE = (process.env.NEXT_PUBLIC_MAP_TILES_3D || "https://api.stateofundeadpurge.site/map-tiles/3d").replace(/\/$/, "");
// Night lights (map3d kit tools/extract_lights.py): every lamp, sign, street light and switch room in the world
const LIGHTS_BASE = (process.env.NEXT_PUBLIC_MAP_LIGHTS || `${ISO_BASE}/lights`).replace(/\/$/, "");
const STYLES = [{ id: "normal", label: "Normal" }, { id: "carto", label: "Floor plans" }];
const VIEWS = [{ id: "top", label: "Top" }, { id: "3d", label: "3D" }];
// the remembered Top / 3D choice. A new key on 2026-10-04 when 3D became the default, so a "Top" picked before
// that is forgotten once and everyone starts on 3D (Nin: "from now on, because some people already visited")
const VIEW_KEY = "soup-map-view-2";
// iso geometry (pzmap2dzi IsoDZI): half a square's width / height, and one floor's height, in image px
const ISO_GW = 64, ISO_GH = 32, ISO_FLOOR = 192;
// zoom is shared between the views as "screen px per square"; an iso square is 128 px corner to corner, ~90 px a side
const ISO_SQ = 90;

export type Place = { kind: "shop" | "bus" | "diner" | "town"; id: string; name: string; role?: string; town?: string; x: number; y: number };
// z = floor (3D view puts the dot on that floor and fades it when it's above the floor being looked at)
export type Dot = { id: string; label: string; x: number; y: number; z?: number; color?: string; size?: number; onClick?: () => void;
  look?: string; face?: [number, number] | null; inCar?: boolean; dead?: boolean };   // look/face: a player's figure in 3D
// Boxes in world squares (Live Ops: safehouses, zombie heat). They scale with the map; in 3D they're diamonds on the
// ground. onClick makes one clickable.
export type Rect = { id: string; x: number; y: number; w: number; h: number; color?: string; fill?: string; label?: string;
  dashed?: boolean; onClick?: () => void };

const KIND = {
  town:  { label: "Towns",        color: "#e6e6e6" },
  shop:  { label: "Shops",        color: "#c8a84b" },
  bus:   { label: "Bus stations", color: "#4a8fc4" },
  diner: { label: "The diner",    color: "#9775cc" },
};

const CSS = `
.wm-wrap{position:relative;flex:1;min-height:0;background:#07090b}
.wm-osd{position:absolute;inset:0}
.wm-pin{transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer;display:flex!important;align-items:center;gap:4px;white-space:nowrap}
.wm-pin .dot{display:inline-block;flex:0 0 auto;width:15px;height:15px;border-radius:50%;border:2px solid #0b0d10;box-shadow:0 0 0 1px rgba(255,255,255,.45),0 1px 4px rgba(0,0,0,.6)}
.wm-pin .lbl{font:600 12px/1.2 var(--mono,monospace);color:#e6e6e6;text-shadow:0 1px 2px #000,0 0 3px #000;letter-spacing:.3px}
.wm-pin.town{pointer-events:none}
.wm-pin.town .lbl{font:600 15px/1.2 'Bebas Neue',sans-serif;letter-spacing:1.5px;color:#f2f2f2;text-transform:uppercase}
/* OpenSeadragon writes an inline display on every overlay, so these need !important */
.wm-wrap[data-zoom="far"] .wm-pin.shop,.wm-wrap[data-zoom="far"] .wm-pin.bus,.wm-wrap[data-zoom="far"] .wm-pin.diner{display:none!important}
.wm-wrap[data-zoom="mid"] .wm-pin.shop .lbl,.wm-wrap[data-zoom="mid"] .wm-pin.bus .lbl{display:none!important}
.wm-wrap[data-zoom="near"] .wm-pin.town{opacity:.35}
.wm-pin.wm-clash .lbl{visibility:hidden}
.wm-hide-shop .wm-pin.shop,.wm-hide-bus .wm-pin.bus,.wm-hide-diner .wm-pin.diner,.wm-hide-town .wm-pin.town{display:none!important}
.wm-dot{transform:translate(-50%,-50%);display:flex!important;align-items:center;gap:4px;pointer-events:none}
.wm-dot .me{display:inline-block;flex:0 0 auto;width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 8px rgba(0,0,0,.8)}
.wm-dot.click{pointer-events:auto;cursor:pointer}
.wm-dot.above{opacity:.35}
.wm-rect{box-sizing:border-box;pointer-events:none}
.wm-rect.click{pointer-events:auto;cursor:pointer}
.wm-rect .rl{position:absolute;left:0;top:-16px;font:600 11px var(--mono,monospace);color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000;white-space:nowrap}
.wm-rect.iso .rl{left:50%;transform:translateX(-50%)}
.wm-rect svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.wm-bases{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);z-index:3;font:11px var(--mono,monospace);color:#cfd3da;background:rgba(11,13,16,.92);border:1px solid #2a2f37;padding:4px 10px;border-radius:3px;pointer-events:none;white-space:nowrap;max-width:calc(100% - 140px);overflow:hidden;text-overflow:ellipsis}
.wm-bases b{color:#c8a84b;font-weight:600}
.wm-clock{position:absolute;left:50%;top:10px;transform:translateX(-50%);z-index:4;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;background:none;border:0;padding:0;box-shadow:none}
.wm-clock > div:first-child{box-shadow:0 1px 6px rgba(0,0,0,.6)!important}
.wm-clock span{font:600 9px var(--mono,monospace);letter-spacing:1px;color:#9aa;background:rgba(11,13,16,.92);border:1px solid #2a2f37;border-radius:3px;padding:1px 6px;text-transform:uppercase}
.wm-tint{position:absolute;inset:0;pointer-events:none;mix-blend-mode:multiply;transition:background-color 8s linear}
.wm-fog{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity 6s linear;background:radial-gradient(ellipse at center,rgba(205,210,215,.55) 0%,rgba(205,210,215,.8) 55%,rgba(210,214,218,.95) 100%)}
.wm-fx{position:absolute;inset:0;pointer-events:none;width:100%;height:100%}
.wm-props{position:absolute;inset:0;pointer-events:none;width:100%;height:100%}
.wm-glow{position:absolute;inset:0;pointer-events:none;width:100%;height:100%;mix-blend-mode:color-dodge}
.wm-bulb{position:absolute;inset:0;pointer-events:none;width:100%;height:100%;mix-blend-mode:screen}
.wm-flash{position:absolute;inset:0;pointer-events:none;background:#dfe8ff;opacity:0;mix-blend-mode:screen}
.wm-wx{display:flex;align-items:center;gap:5px;padding:4px 8px;background:#0a0e0f;border:1px solid #1a3335;border-radius:3px;box-shadow:0 1px 6px rgba(0,0,0,.6),inset 0 0 12px rgba(79,195,200,.15);color:#4fc3c8;font:600 11px 'DSEG7 Classic','DSEG7Classic',monospace;text-shadow:0 0 6px #4fc3c8}
.wm-wx svg{width:20px;height:20px;filter:drop-shadow(0 0 3px #4fc3c8)}
.wm-clockrow{display:flex;align-items:stretch;gap:4px}
.wm-coords{position:absolute;left:10px;bottom:10px;font:12px var(--mono,monospace);color:#cfd3da;background:rgba(11,13,16,.92);padding:4px 8px;border-radius:3px;pointer-events:none}
.wm-tip{position:absolute;pointer-events:none;background:rgba(10,13,16,.95);border:1px solid #2a2f37;padding:6px 9px;font:12px var(--mono,monospace);color:#e6e6e6;border-radius:3px;z-index:5;max-width:260px}
.wm-tip b{color:#c8a84b}
.wm-fs{position:absolute;left:10px;top:10px;z-index:4;font:600 11px var(--mono,monospace);letter-spacing:.5px;color:#cfd3da;background:rgba(11,13,16,.92);box-shadow:0 1px 6px rgba(0,0,0,.5);border:1px solid #2a2f37;border-radius:3px;padding:5px 10px;cursor:pointer;text-transform:uppercase}
.wm-fs:hover{color:#c8a84b;border-color:#c8a84b}
.wm-bars{position:absolute;right:10px;top:10px;display:flex;flex-direction:column;align-items:flex-end;gap:6px;z-index:4}
.wm-style{display:flex;background:rgba(11,13,16,.92);box-shadow:0 1px 6px rgba(0,0,0,.5);border:1px solid #2a2f37;border-radius:3px;overflow:hidden}
.wm-style button{font:600 11px var(--mono,monospace);letter-spacing:.5px;color:#9aa;padding:5px 10px;background:none;border:0;cursor:pointer;text-transform:uppercase}
.wm-style button.on{color:#0b0d10;background:#c8a84b}
.wm-floor{position:absolute;left:10px;top:44px;z-index:4;display:flex;flex-direction:column;align-items:stretch;background:rgba(11,13,16,.92);box-shadow:0 1px 6px rgba(0,0,0,.5);border:1px solid #2a2f37;border-radius:3px;overflow:hidden;min-width:74px}
.wm-floor button{font:600 13px var(--mono,monospace);color:#cfd3da;padding:3px 0;background:none;border:0;cursor:pointer}
.wm-floor button:hover:not(:disabled){color:#c8a84b}
.wm-floor button:disabled{opacity:.3;cursor:default}
.wm-floor span{font:600 11px var(--mono,monospace);letter-spacing:.5px;color:#c8a84b;text-align:center;padding:3px 6px;border-top:1px solid #2a2f37;border-bottom:1px solid #2a2f37;text-transform:uppercase}
`;

// Defaults made once: a fresh [] on every render would look like new places each time and wipe the overlays.
const NONE = [];
const NO_HIDDEN = {};

// "Bases updated 2 h ago · next update in 40 min" (or "Updating player bases now...")
const span = (s) => (s < 90 ? "a minute" : s < 5400 ? `${Math.round(s / 60)} min` : s < 129600 ? `${Math.round(s / 3600)} h` : `${Math.round(s / 86400)} days`);
const basesLine = (b, now) => {
  if (b.running) return <><b>Updating player bases now</b>, new builds appear as each area finishes</>;
  const ago = b.updated ? `Bases updated ${span(Math.max(0, now - b.updated))} ago` : "Bases not drawn yet";
  const next = b.next ? (b.next > now ? `next update in ${span(b.next - now)}` : "next update soon") : "";
  return <><b>{ago}</b>{next ? <> &middot; {next}</> : null}</>;
};

const floorName = (f) => (f === 0 ? "Ground" : f > 0 ? `Floor ${f}` : `Basement ${-f}`);

// ── In-game light (Nin 2026-10-05, approved mock-up): the map dims and tints with the game clock. The map canvas gets
// saturate/brightness, and a multiply layer sits between the map and the pins, so names and dots stay readable.
// Looks: day, dawn, evening (warm), night (dark blue-grey, colours drained). Sunrise / sunset move with the month.
const LOOKS = {
  day:     { sat: 1,    bri: 1,    tint: [255, 255, 255], amt: 0 },
  dawn:    { sat: 0.9,  bri: 0.85, tint: [255, 185, 130], amt: 0.35 },
  evening: { sat: 1,    bri: 0.85, tint: [255, 150, 80],  amt: 0.55 },
  night:   { sat: 0.55, bri: 0.55, tint: [70, 95, 170],   amt: 0.75 },
};
const SUN = { 1: [7.5, 17.5], 2: [7, 18], 3: [7, 19.5], 4: [6.5, 20], 5: [6, 20.5], 6: [6, 21], 7: [6, 21],
  8: [6.5, 20.5], 9: [7, 19.5], 10: [7.5, 19], 11: [7, 17.5], 12: [7.5, 17.5] };
const lightAt = (hour, month) => {
  const [rise, set] = SUN[month] || [6.5, 20];
  const K = [[rise - 1.5, "night"], [rise - 0.25, "dawn"], [rise + 1, "day"], [set - 1.5, "day"], [set, "evening"], [set + 1.25, "night"]];
  if (hour <= K[0][0] || hour >= K[K.length - 1][0]) return LOOKS.night;
  for (let i = 1; i < K.length; i++) {
    if (hour <= K[i][0]) {
      const a = LOOKS[K[i - 1][1]], b = LOOKS[K[i][1]], t = (hour - K[i - 1][0]) / (K[i][0] - K[i - 1][0]);
      const mix = (x, y) => x + (y - x) * t;
      return { sat: mix(a.sat, b.sat), bri: mix(a.bri, b.bri), amt: mix(a.amt, b.amt), tint: a.tint.map((c, j) => mix(c, b.tint[j])) };
    }
  }
  return LOOKS.day;
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── Night lights (L2, 2026-10-05): lamps, signs and street lights glow, rooms with a light switch light up, and lit
// windows spill onto the ground, at night while the game's power is on. Data = <LIGHTS_BASE>/index.json + one file
// per 256-square cell (extract_lights.py). The glow layer is colour-dodge, so a lit spot gets the map's own colours
// back, warm-tinted, rather than a flat wash; bulbs and window panes are a small "screen" layer on top.
// Which rooms have the light on: each room has a fixed number 0-99 and is on below the share for the hour, so
// houses go dark one by one through the night and the same ones come back on the next evening.
const LIT_SHARE = [[0, 35], [2, 20], [5, 22], [7, 30], [17, 55], [20, 65], [22, 55], [24, 35]];
const litShare = (mins) => {
  const h = (mins / 60) % 24;
  for (let i = 1; i < LIT_SHARE.length; i++) {
    const [h0, a] = LIT_SHARE[i - 1], [h1, b] = LIT_SHARE[i];
    if (h <= h1) return a + ((b - a) * (h - h0)) / (h1 - h0);
  }
  return 35;
};
// light colour -> colour-dodge colour. The game's colours are very saturated (street lamps 255,80,20), and dodged
// over the blue night they turn pink, so each is mixed 55% toward a warm white first; never 1 (that would blow the
// channel out to white).
// The night underneath is blue-grey, and dodge multiplies per channel, so blue is held back and green given room:
// otherwise warm light over blue asphalt comes out magenta.
const WARM = [255, 205, 150];
const dodgeOf = (r, g, b) => {
  const m = [r, g, b].map((c, i) => (0.45 * c + 0.55 * WARM[i]) / 255);
  return [0.3 + 0.56 * m[0], 0.35 + 0.6 * m[1], 0.08 + 0.3 * m[2]].map((x) => Math.round(255 * x));
};
const ROOM_RGB = [205, 178, 95];
const ROOM_DODGE = `rgb(${ROOM_RGB.join(",")})`;      // a warm ceiling light
const WALL_UP = 0.85 * ISO_FLOOR;            // how high a lit room's back walls catch the light, image px
// soft round glow sprites, one per colour (quantised), drawn stretched into ellipses
const glowSprites = new Map();
const glowSprite = (rgb) => {
  const key = rgb.map((c) => c & 0xf8).join(",");
  let s = glowSprites.get(key);
  if (!s) {
    s = document.createElement("canvas"); s.width = s.height = 64;
    const g = s.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${key},1)`); gr.addColorStop(0.35, `rgba(${key},0.75)`); gr.addColorStop(1, `rgba(${key},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    glowSprites.set(key, s);
  }
  return s;
};

// ── Weather (mod 1.7.119 writes it, /api/map/players returns it): rain / snow particles, fog haze, lightning flashes,
// a grey overcast look, and a badge by the clock. ?weather=rain|storm|fog|snow|cloud previews one.
const OVERCAST = { sat: 0.7, bri: 0.78, tint: [150, 165, 185], amt: 0.5 };
const mixLook = (a, b, t) => ({ sat: a.sat + (b.sat - a.sat) * t, bri: a.bri * (1 - t * (1 - b.bri)), amt: Math.max(a.amt, b.amt * t),
  tint: a.amt >= b.amt * t ? a.tint : a.tint.map((c, j) => c + (b.tint[j] - c) * t) });
const WX_PREVIEW = {
  rain:  { rain: 0.7, fog: 0.1, snow: 0, wind: 0.4, cloud: 0.9, temp: 17, thunder: false, snowing: false },
  storm: { rain: 0.95, fog: 0.15, snow: 0, wind: 0.8, cloud: 1, temp: 21, thunder: true, snowing: false },
  fog:   { rain: 0, fog: 0.85, snow: 0, wind: 0.05, cloud: 0.5, temp: 12, thunder: false, snowing: false },
  snow:  { rain: 0, fog: 0.15, snow: 0.7, wind: 0.3, cloud: 0.9, temp: -3, thunder: false, snowing: true },
  cloud: { rain: 0, fog: 0, snow: 0, wind: 0.3, cloud: 0.85, temp: 19, thunder: false, snowing: false },
};
// what the badge shows
const wxKind = (w, mins) => {
  if (!w) return null;
  const n = (v) => (typeof v === "number" ? v : 0);
  if (w.blizzard || (w.snowing && n(w.snow) > 0.05) || n(w.snow) > 0.2) return "snow";
  if (w.thunder) return "storm";
  if (n(w.rain) > 0.05) return "rain";
  if (n(w.fog) > 0.35) return "fog";
  if (n(w.cloud) > 0.6) return "cloud";
  return mins != null && (mins < 6 * 60 || mins >= 20 * 60) ? "moon" : "sun";
};
const WX_TITLE = { sun: "Clear", moon: "Clear night", cloud: "Cloudy", rain: "Rain", storm: "Thunderstorm", fog: "Fog", snow: "Snow" };
const WX_ICON = {
  sun: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></svg>,
  moon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.2 6.2 0 0 0 10.1 10.1z" /></svg>,
  cloud: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M7 18.5h10.2a4 4 0 0 0 .5-8 5.6 5.6 0 0 0-10.8 1.4A3.4 3.4 0 0 0 7 18.5z" /></svg>,
  rain: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 14.5h10.2a4 4 0 0 0 .5-8 5.6 5.6 0 0 0-10.8 1.4A3.4 3.4 0 0 0 7 14.5z" /><path d="M8.5 17.5l-1 3M12.5 17.5l-1 3M16.5 17.5l-1 3" /></svg>,
  storm: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 14h10.2a4 4 0 0 0 .5-8 5.6 5.6 0 0 0-10.8 1.4A3.4 3.4 0 0 0 7 14z" /><path d="M12.5 15l-2.5 4h3l-2 3.5" /></svg>,
  fog: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 8h16M3 12h14M6 16h15M4 20h12" /></svg>,
  snow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5" /></svg>,
};
// the game's own season name ("Early Summer", "Late Summer"...) -> our season set
const seasonFromName = (name) => {
  const s = String(name || "").toLowerCase();
  if (!s) return null;
  if (s.includes("winter")) return "winter";
  if (s.includes("spring")) return "spring";
  if (s.includes("autumn") || s.includes("fall")) return "autumn";
  if (s.includes("late") && s.includes("summer")) return "summer2";
  if (s.includes("summer")) return "summer";
  return null;
};
// ── Shop kiosks and bus stations in 3D (2026-10-05): the mod puts these down client-side (IsoObject.new near a player),
// so they are never in the map or the save and the render can't draw them. The site draws the mod's own sprites
// (unpacked from zombitakiosk.pack / zombitabus.pack) at each place's live position, anchored like the render does:
// the frame's bottom centre on the square's bottom vertex, offsets from the pack. Under the night tint, over the map.
const PROPS = {
  shop: { src: "/map/sprites/zombita_kiosk_0.png", ox: -64, oy: -152 },
  bus:  { src: "/map/sprites/zombita_bus_0.png",   ox: -64, oy: -111 },
};
const svgNS = "http://www.w3.org/2000/svg";
// OpenSeadragon grabs the pointer on press (to drag the map), so the click then lands on its canvas and never on a
// pin (Live Ops: shop pins in Zombita mode did nothing, 2026-10-04). A clickable overlay keeps its press to itself;
// `when` says whether it is clickable right now (dots and boxes switch on and off).
const keepPress = (el, when = () => true) => {
  const stop = (ev) => { if (when()) ev.stopPropagation(); };
  for (const t of ["pointerdown", "mousedown", "touchstart"]) el.addEventListener(t, stop);
};

export default function WorldMap({ places = NONE, dots = NONE, rects = NONE, hidden = NO_HIDDEN, focus = null, onPlaceClick = null, onMapClick = null }:
  { places?: Place[]; dots?: Dot[]; rects?: Rect[]; hidden?: Record<string, boolean>; focus?: { x: number; y: number; z?: number } | null;
    onPlaceClick?: ((p: Place) => void) | null; onMapClick?: ((w: { x: number; y: number; z?: number }) => void) | null }) {
  const host = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const infoRef = useRef<any>({ sqr: 4, x0: 0, y0: 0 });          // the top view's map_info
  const isoRef = useRef<any>(null);                                 // the 3D view's map_info (null = no 3D yet)
  const dotEls = useRef<Map<string, HTMLElement>>(new Map());
  const rectEls = useRef<Map<string, HTMLElement>>(new Map());
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;
  // pins are made once, so they call whatever handler the page has NOW (a captured one went stale: Live Ops' mode switch)
  const placeClickRef = useRef(onPlaceClick);
  placeClickRef.current = onPlaceClick;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [tip, setTip] = useState<{ p: Place; left: number; top: number } | null>(null);
  const [hasCarto, setHasCarto] = useState(false);
  // player bases on the 3D map (map3d_kit run_bases.sh writes bases_status.json next to the 3D tiles every few hours):
  // "Bases updated 2 h ago, next update in 40 min". Hidden until the file exists. ?t= skips the tiles' 1 h cache.
  const [bases, setBases] = useState<any>(null);
  const [nowS, setNowS] = useState(() => Math.floor(Date.now() / 1000));
  // fullscreen (Nin: "full screen option for maps"): the page root marked data-fs-root, else the map itself
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const on = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFs = () => {
    if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
    const root = wrap.current?.closest("[data-fs-root]") || wrap.current;
    root?.requestFullscreen?.().catch(() => {});
  };
  const [look, setLook] = useState(() => { try { return localStorage.getItem("soup-map-look") || "normal"; } catch { return "normal"; } });
  const cartoItem = useRef<any>(null);

  // Top / 3D. 3D is the default (Nin 2026-10-04: "make sure 3D is whats visible first"); ?v=top|3d in the address wins
  // over the remembered choice, which wins over the default. A visitor headed for 3D waits for the 3D check before
  // the map starts (so they don't load the top map first); if 3D isn't there they get the top map.
  const wish3d = useRef<boolean | null>(null);
  if (wish3d.current === null) {
    try { const v = new URLSearchParams(window.location.search).get("v"); wish3d.current = (v || localStorage.getItem(VIEW_KEY) || "3d") === "3d"; }
    catch { wish3d.current = true; }
  }
  const [has3d, setHas3d] = useState<boolean | null>(null);
  const [boot, setBoot] = useState(!wish3d.current);
  const [view, setView] = useState<"top" | "3d">("top");
  const [floor, setFloor] = useState(0);
  const viewRef = useRef(view);
  viewRef.current = view;
  const floorRef = useRef(floor);
  floorRef.current = floor;
  const camRef = useRef<any>(null);                                 // world centre + zoom kept across a view switch
  const floorItems = useRef<Map<number, any>>(new Map());           // 3D: floor -> tiled image (or "loading")
  // Seasons (map3d kit run_seasons.sh): the main render is late summer; other seasons are extra floor-0 sets in
  // seasons/<season>/, listed in seasons.json. The set matching the in-game month is drawn as a "skin" over floor 0
  // (the main floor 0 is hidden meanwhile, so it loads nothing). ?season=<name> shows one on purpose.
  const [skin, setSkin] = useState<string | null>(null);            // null = the main render's own floor 0
  const skinRef = useRef(skin);
  skinRef.current = skin;
  const skinItems = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    let alive = true;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    fetch(`${ISO_BASE}/map_info.json`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        if (j && j.sqr) {
          isoRef.current = { x0: j.x0, y0: j.y0, w: j.w, h: j.h, min: j.minlayer ?? -32, max: (j.maxlayer ?? 32) - 1 };
          if (wish3d.current) {
            try {
              const f = Number(new URLSearchParams(window.location.search).get("f"));
              if (Number.isFinite(f)) setFloor(Math.max(isoRef.current.min, Math.min(isoRef.current.max, Math.round(f))));
            } catch {}
            setView("3d");
          }
          setHas3d(true);
        } else setHas3d(false);
        setBoot(true);
      })
      .catch(() => { if (alive) { setHas3d(false); setBoot(true); } })
      .finally(() => clearTimeout(t));
    return () => { alive = false; clearTimeout(t); };
  }, []);

  // Labels that would overlap one already placed are hidden (the dot stays; hover still names it). Priority:
  // towns, the diner, bus stations, shops. Runs after every pan / zoom (throttled to one per frame).
  const PRIO = { town: 0, diner: 1, bus: 2, shop: 3 };
  const declutterQueued = useRef(false);
  const declutter = () => {
    if (declutterQueued.current) return;
    declutterQueued.current = true;
    requestAnimationFrame(() => {
      declutterQueued.current = false;
      const root = wrap.current; if (!root) return;
      const pins = Array.from(root.querySelectorAll(".wm-pin"));
      const items = [];
      for (const el of pins) {
        el.classList.remove("wm-clash");
        const lbl = el.querySelector(".lbl");
        if (!lbl || getComputedStyle(el).display === "none" || getComputedStyle(lbl).display === "none") continue;
        const kind = el.classList.contains("town") ? "town" : el.classList.contains("diner") ? "diner" : el.classList.contains("bus") ? "bus" : "shop";
        items.push({ el, kind, r: lbl.getBoundingClientRect() });
      }
      items.sort((a, b) => PRIO[a.kind] - PRIO[b.kind]);
      const kept = [];
      const hit = (a, b) => !(a.right < b.left - 2 || a.left > b.right + 2 || a.bottom < b.top - 1 || a.top > b.bottom + 1);
      for (const it of items) {
        if (kept.some((k) => hit(k, it.r))) it.el.classList.add("wm-clash");
        else kept.push(it.r);
      }
    });
  };

  // ── world <-> image (squares, floor) ──
  // `iso` defaults to the view on screen; the viewer's cleanup passes the view it was built for
  const is3d = () => viewRef.current === "3d" && !!isoRef.current;
  const w2img = (x, y, z = 0, iso = is3d()) => {
    if (iso) { const g = isoRef.current; return [g.x0 + (x - y) * ISO_GW, g.y0 + (x + y) * ISO_GH - ISO_FLOOR * z]; }
    const i = infoRef.current; return [(x - i.x0) * i.sqr, (y - i.y0) * i.sqr];
  };
  // image -> world on the floor being looked at (fractional squares)
  const img2w = (px, py, iso = is3d()) => {
    if (iso) {
      const g = isoRef.current;
      const u = (px - g.x0) / ISO_GW, v = (py - g.y0 + ISO_FLOOR * floorRef.current) / ISO_GH;
      return [(v + u) / 2, (v - u) / 2];
    }
    const i = infoRef.current; return [px / i.sqr + i.x0, py / i.sqr + i.y0];
  };
  const sqPx = (iso = is3d()) => (iso ? ISO_SQ : infoRef.current.sqr);       // image px per square, for zoom
  // a point marker sits in the middle of its square in 3D (a whole-number spot is the diamond's top vertex)
  const mid = (n) => (is3d() && Number.isInteger(n) ? n + 0.5 : n);
  const toVp = (OSD, x, y, z = 0) => {
    const v = viewerRef.current;
    const item = v && v.world.getItemAt(0);
    if (!item) return null;
    const [px, py] = w2img(x, y, z);
    return item.imageToViewportCoordinates(new OSD.Point(px, py));
  };
  // flyTo / ?z= use the top map's zoom (screen px per top-map px) in both views, so links and buttons mean the same
  const topZoomToItem = (z) => (z * infoRef.current.sqr) / sqPx();

  useEffect(() => {
    if (!boot) return;
    let destroyed = false;
    let viewer = null;
    const builtIso = view === "3d" && !!isoRef.current;
    (async () => {
      const OSD = (await import("openseadragon")).default;
      try {
        const r = await fetch(`${TILE_BASE}/map_info.json`);
        if (r.ok) { const j = await r.json(); infoRef.current = { sqr: j.sqr || 4, x0: j.x0 || 0, y0: j.y0 || 0 }; }
      } catch { /* defaults */ }
      if (destroyed || !host.current) return;
      const iso = builtIso;
      viewer = OSD({
        element: host.current,
        tileSources: iso ? `${ISO_BASE}/layer0.dzi` : `${TILE_BASE}/map.dzi`,
        drawer: "canvas",                  // no CORS needed for plain drawing
        showNavigationControl: false,
        gestureSettingsMouse: { clickToZoom: false, dblClickToZoom: true },
        maxZoomPixelRatio: iso ? 2 : 3,
        minZoomImageRatio: 0.6,
        visibilityRatio: 0.4,
        animationTime: 0.6,
        blendTime: 0.15,
        immediateRender: false,
        preserveImageSizeOnResize: true,
        background: "#07090b",
      });
      viewerRef.current = viewer;
      if (process.env.NODE_ENV !== "production") (window as any).__soupMap = viewer;   // dev-only debugging handle
      viewer.addHandler("open-failed", () => setError("The map couldn't load. Try again in a minute."));
      viewer.addHandler("open", () => {
        if (destroyed) return;
        if (iso) floorItems.current.set(0, viewer.world.getItemAt(0));
        const item = viewer.world.getItemAt(0);
        const cam = camRef.current;
        camRef.current = null;
        if (cam) {                          // switched view: same spot, same scale
          const vp = toVp(OSD, cam.x, cam.y, iso ? floorRef.current : 0);
          if (vp) { viewer.viewport.panTo(vp, true); viewer.viewport.zoomTo(item.imageToViewportZoom(cam.pps / sqPx()), null, true); }
        } else {
          const p = new URLSearchParams(window.location.search);
          const fx = Number(p.get("x")), fy = Number(p.get("y")), fz = Number(p.get("z"));
          const f = focus || (fx && fy ? { x: fx, y: fy, z: fz || 0.25 } : null);
          if (f) {
            const vp = toVp(OSD, f.x, f.y, iso ? floorRef.current : 0);
            if (vp) { viewer.viewport.panTo(vp, true); viewer.viewport.zoomTo(item.imageToViewportZoom(topZoomToItem(f.z || 0.25)), null, true); }
          }
        }
        setReady(true);
      });
      const fly = (ev) => {
        const { x, y, z } = ev.detail || {};
        const vp = toVp(OSD, mid(x), mid(y), is3d() ? floorRef.current : 0); const item = viewer.world.getItemAt(0);
        if (!vp || !item) return;
        viewer.viewport.panTo(vp); if (z) viewer.viewport.zoomTo(item.imageToViewportZoom(topZoomToItem(z)));
      };
      window.addEventListener("wm-fly", fly);
      viewer.addHandler("destroy", () => window.removeEventListener("wm-fly", fly));
      // zoom band -> which labels show (CSS on the wrapper)
      const band = () => {
        const item = viewer.world.getItemAt(0); if (!item || !wrap.current) return;
        const z = item.viewportToImageZoom(viewer.viewport.getZoom(true));   // screen px per image px
        const pxPerSquare = z * sqPx();
        wrap.current.dataset.zoom = pxPerSquare < 0.35 ? "far" : pxPerSquare < 1.5 ? "mid" : "near";
      };
      viewer.addHandler("zoom", band);
      viewer.addHandler("animation", declutter);
      viewer.addHandler("animation-finish", declutter);
      viewer.addHandler("resize", declutter);
      viewer.addHandler("open", band);
      // mouse -> world coords
      new OSD.MouseTracker({
        element: viewer.canvas,
        moveHandler: (e) => {
          const item = viewer.world.getItemAt(0); if (!item) return;
          const img = item.viewerElementToImageCoordinates(e.position);
          const [x, y] = img2w(img.x, img.y);
          setCoords({ x: Math.floor(x), y: Math.floor(y) });
        },
        leaveHandler: () => setCoords(null),
      });
      viewer.addHandler("canvas-click", (e) => {
        if (!e.quick || !clickRef.current) return;
        const item = viewer.world.getItemAt(0); if (!item) return;
        const img = item.viewerElementToImageCoordinates(e.position);
        const [x, y] = img2w(img.x, img.y);
        clickRef.current({ x: Math.floor(x), y: Math.floor(y), z: is3d() ? floorRef.current : 0 });
      });
      // shareable view: ?x=&y=&z= (+ v=3d&f=floor) kept in the address bar
      viewer.addHandler("animation-finish", () => {
        const item = viewer.world.getItemAt(0); if (!item) return;
        const c = item.viewportToImageCoordinates(viewer.viewport.getCenter(true));
        const [x, y] = img2w(c.x, c.y);
        const pps = item.viewportToImageZoom(viewer.viewport.getZoom(true)) * sqPx();
        const u = new URL(window.location.href);
        u.searchParams.set("x", String(Math.floor(x)));
        u.searchParams.set("y", String(Math.floor(y)));
        u.searchParams.set("z", (pps / infoRef.current.sqr).toFixed(3));
        if (is3d()) { u.searchParams.set("v", "3d"); u.searchParams.set("f", String(floorRef.current)); }
        else { u.searchParams.set("v", "top"); u.searchParams.delete("f"); }   // 3D is the default, so a top link says so
        window.history.replaceState(null, "", u.toString());
      });
    })().catch((e) => setError(String(e?.message || e)));
    return () => {
      destroyed = true;
      // remember where we were (world centre + screen px per square) for the other view
      try {
        const item = viewer && viewer.world.getItemAt(0);
        if (item) {
          const c = item.viewportToImageCoordinates(viewer.viewport.getCenter(true));
          const [x, y] = img2w(c.x, c.y, builtIso);
          camRef.current = { x, y, pps: item.viewportToImageZoom(viewer.viewport.getZoom(true)) * sqPx(builtIso) };
        }
      } catch {}
      try { viewer && viewer.destroy(); } catch {}
      viewerRef.current = null;
      dotEls.current.clear(); rectEls.current.clear(); floorItems.current.clear(); skinItems.current.clear();
      cartoItem.current = null;
      setReady(false);
    };
    // viewRef is read inside; the switch itself tears the viewer down and builds the other one
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boot, view]);

  // the camera handed over by the cleanup above is in the OLD view's floor; keep the switch on the same floor
  const switchView = (v) => {
    if (v === view) return;
    try { localStorage.setItem(VIEW_KEY, v); } catch {}
    setView(v);
  };

  useEffect(() => {
    if (view !== "3d") return;
    let stop = false, t = null;
    const load = () => fetch(`${ISO_BASE}/bases_status.json?t=${Date.now()}`).then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!stop) setBases(d && (d.updated || d.running) ? d : null); }).catch(() => {});
    load();
    t = setInterval(load, 60000);
    const tick = setInterval(() => setNowS(Math.floor(Date.now() / 1000)), 30000);
    return () => { stop = true; clearInterval(t); clearInterval(tick); };
  }, [view]);

  // ── game clock + light ──
  // The public player feed carries the in-game date/time (mod 1.7.110+). Between polls the clock runs on at the
  // rate measured from the last two samples (this server: 1 real hour = 1 game day); frozen while the feed is stale
  // (the server pauses when empty). Clicking the clock turns the light off / on (remembered per visitor).
  const [game, setGame] = useState<any>(null);       // { year, month, day, mins, at, rate }
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [lightOn, setLightOn] = useState(() => { try { return localStorage.getItem("soup-map-light") !== "off"; } catch { return true; } });
  const tintRef = useRef<HTMLDivElement | null>(null);
  // the nav bar's PZ clock (live websocket) is shown on the map too; its time drives the light when it has one
  const [wsTime, setWsTime] = useState<any>(null);
  const [weather, setWeather] = useState<any>(null);  // the feed's "weather" (1.7.119+), null before / older mods
  const fxRef = useRef<any>({ canvas: null, fog: null, flash: null, w: null, raf: 0 });
  // night lights: canvases, darkness 0-1, share of rooms lit, power, index + loaded cells, and the redraw
  const propsRef = useRef<any>({ canvas: null });
  const litRef = useRef<any>({ glow: null, bulb: null, s: 0, share: 50, power: true, idx: null, cells: new Map(), draw: null });
  useEffect(() => {
    let stop = false;
    const load = () => fetch(`${API}/api/map/players`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (stop || !d) return;
      setWeather(d.weather || null);
      if (!d.game) return;
      const g = d.game, mins = (Number(g.hour) || 0) * 60 + (Number(g.minute) || 0), at = Date.now();
      setGame((prev) => {
        let rate = prev ? prev.rate : 0.4;                       // game minutes per real second
        if (prev && prev.day === g.day && at > prev.at) {
          const dm = mins - prev.mins, ds = (at - prev.at) / 1000;
          if (dm > 0 && ds > 3) rate = Math.min(4, dm / ds);
        }
        return { year: g.year, month: Number(g.month) || 7, day: Number(g.day) || 1, mins, at, rate: d.stale ? 0 : rate };
      });
    }).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    const tick = setInterval(() => setClockNow(Date.now()), 2500);
    return () => { stop = true; clearInterval(t); clearInterval(tick); };
  }, []);
  // ?time=23:00 (and optional &month=12) previews the light at that hour
  const timeOverride = useMemo(() => {
    try {
      const p = new URLSearchParams(window.location.search), t = p.get("time");
      if (!t) return null;
      const [h, m] = t.split(":").map(Number);
      return { month: Number(p.get("month")) || null, mins: (h || 0) * 60 + (m || 0) };
    } catch { return null; }
  }, []);
  const wxOverride = useMemo(() => {
    try { const k = new URLSearchParams(window.location.search).get("weather"); return k && WX_PREVIEW[k] ? WX_PREVIEW[k] : null; } catch { return null; }
  }, []);
  const wxNow = wxOverride || weather;
  const powerOff = useMemo(() => { try { return new URLSearchParams(window.location.search).get("power") === "off"; } catch { return false; } }, []);
  const gameNow = useMemo(() => {
    if (timeOverride) return { month: timeOverride.month || game?.month || 7, day: game?.day || 1, mins: timeOverride.mins };
    if (wsTime && wsTime.hour !== undefined) {
      const mi = MONTHS.findIndex((m) => String(wsTime.month || "").toLowerCase().startsWith(m.toLowerCase()));
      return { month: mi >= 0 ? mi + 1 : (game?.month || 7), day: wsTime.day, mins: Number(wsTime.hour) * 60 + Number(wsTime.minute || 0) };
    }
    if (!game) return null;
    let m = game.mins + ((clockNow - game.at) / 1000) * game.rate, day = game.day;
    if (m >= 1440) { m -= 1440; day += 1; }                  // a poll catches the month change
    return { month: game.month, day, mins: m };
  }, [game, clockNow, wsTime, timeOverride]);

  // paint the light: canvas filter (colour, brightness) + the multiply layer between the map and the pins
  useEffect(() => {
    const v = viewerRef.current; if (!ready || !v || !v.drawer || !v.drawer.canvas) return;
    const canvas = v.drawer.canvas;
    if (!tintRef.current || !tintRef.current.isConnected) {
      // kiosks and stations first (under the tint, so night falls on them too)
      const props = document.createElement("canvas"); props.className = "wm-props";
      v.overlaysContainer.parentNode.insertBefore(props, v.overlaysContainer);
      propsRef.current.canvas = props;
      const div = document.createElement("div");
      div.className = "wm-tint";
      v.overlaysContainer.parentNode.insertBefore(div, v.overlaysContainer);
      tintRef.current = div;
      canvas.style.transition = "filter 8s linear";
      // weather layers, also under the pins: fog haze, rain / snow particles, lightning
      const fog = document.createElement("div"); fog.className = "wm-fog";
      const fx = document.createElement("canvas"); fx.className = "wm-fx";
      const flash = document.createElement("div"); flash.className = "wm-flash";
      // night lights right above the tint (so they light up the darkened map), under the weather
      const glow = document.createElement("canvas"); glow.className = "wm-glow";
      const bulb = document.createElement("canvas"); bulb.className = "wm-bulb";
      for (const el of [glow, bulb, fog, fx, flash]) v.overlaysContainer.parentNode.insertBefore(el, v.overlaysContainer);
      fxRef.current.canvas = fx; fxRef.current.fog = fog; fxRef.current.flash = flash;
      litRef.current.glow = glow; litRef.current.bulb = bulb;
    }
    let L = lightOn && gameNow ? lightAt(gameNow.mins / 60, gameNow.month) : LOOKS.day;
    // lights: how dark it is from the clock alone (a stormy afternoon doesn't switch the street lights on), the
    // share of rooms lit at this hour, and the power (weather line; unknown = on). ?power=off previews a blackout.
    const lit = litRef.current;
    lit.s = Math.max(0, Math.min(1, (1 - L.bri) / 0.45));
    lit.share = gameNow ? litShare(gameNow.mins) : 50;
    lit.power = !(wxNow && wxNow.power === false) && !powerOff;
    lit.draw && lit.draw();
    const w = lightOn ? wxNow : null;
    const num = (x) => (typeof x === "number" ? x : 0);
    const over = w ? Math.min(1, Math.max(num(w.rain), num(w.snow) * 0.8, num(w.cloud) * 0.5, w.thunder ? 1 : 0)) : 0;
    if (over > 0.02) L = mixLook(L, OVERCAST, over);
    if (fxRef.current.fog) fxRef.current.fog.style.opacity = String(Math.min(0.7, num(w?.fog) * 0.8));
    fxRef.current.w = w;
    canvas.style.filter = L.amt > 0.001 || L.bri < 0.999 ? `saturate(${L.sat.toFixed(3)}) brightness(${L.bri.toFixed(3)})` : "";
    if (propsRef.current.canvas) { propsRef.current.canvas.style.transition = canvas.style.transition; propsRef.current.canvas.style.filter = canvas.style.filter; }
    const c = L.tint.map((x) => Math.round(255 - L.amt * (255 - x)));
    tintRef.current.style.backgroundColor = `rgb(${c[0]},${c[1]},${c[2]})`;
  }, [ready, lightOn, gameNow, wxNow]);

  // rain / snow particles and lightning, drawn only while there is some (pauses in a background tab)
  useEffect(() => {
    if (!ready) return;
    const st = fxRef.current;
    let drops = [], last = 0, nextFlash = performance.now() + 4000 + Math.random() * 8000;
    const frame = (t) => {
      st.raf = requestAnimationFrame(frame);
      const c = st.canvas, w = st.w;
      if (!c) return;
      const num = (x) => (typeof x === "number" ? x : 0);
      const rain = num(w?.rain), snow = Math.max(num(w?.snow), w?.blizzard ? 0.9 : 0), wind = num(w?.wind);
      const W = c.clientWidth, H = c.clientHeight;
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, W, H);
      if (st.flash) {
        if (w && w.thunder && t > nextFlash) {
          st.flash.style.opacity = "0.45";
          setTimeout(() => { if (st.flash) st.flash.style.opacity = "0"; }, 90);
          setTimeout(() => { if (st.flash) st.flash.style.opacity = "0.3"; }, 160);
          setTimeout(() => { if (st.flash) st.flash.style.opacity = "0"; }, 230);
          nextFlash = t + 5000 + Math.random() * 14000;
        }
      }
      const want = Math.round((rain > 0.03 ? rain * 0.0009 : 0) * W * H + (snow > 0.03 ? snow * 0.00035 : 0) * W * H);
      if (!want) { drops = []; return; }
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016; last = t;
      while (drops.length < want) drops.push({ x: Math.random() * W, y: Math.random() * H, snow: snow > rain ? true : Math.random() < snow / Math.max(0.01, rain + snow), r: Math.random() });
      if (drops.length > want) drops.length = want;
      const slant = 60 + wind * 220;
      ctx.lineCap = "round";
      for (const d of drops) {
        if (d.snow) {
          d.x += (slant * 0.25 + Math.sin(t / 600 + d.r * 9) * 20) * dt; d.y += (40 + d.r * 40) * dt;
          ctx.fillStyle = `rgba(245,248,255,${0.55 + d.r * 0.35})`;
          ctx.beginPath(); ctx.arc(d.x, d.y, 1 + d.r * 1.6, 0, Math.PI * 2); ctx.fill();
        } else {
          const vy = 700 + d.r * 300, vx = slant;
          d.x += vx * dt; d.y += vy * dt;
          ctx.strokeStyle = `rgba(205,215,235,${0.25 + d.r * 0.3})`; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - vx * 0.018, d.y - vy * 0.018); ctx.stroke();
        }
        if (d.y > H + 20 || d.x > W + 40 || d.x < -40) { d.y = -10 - Math.random() * 40; d.x = Math.random() * (W + 80) - 80; }
      }
    };
    st.raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(st.raf);
  }, [ready]);
  // night lights: index once, cell files as they come into view (close enough), redrawn on every camera move.
  // Far out: the index's per-cell summary (a 16-square grid of glow). Closer: each lamp's pool, lit rooms (floor +
  // the back walls they light), and close up the bulbs, window panes and the light falling out of windows.
  useEffect(() => {
    if (!ready) return;
    const v = viewerRef.current, lit = litRef.current;
    if (process.env.NODE_ENV !== "production") (window as any).__soupLights = lit;   // dev-only debugging handle
    let alive = true, queued = false, OSD = null, inflight = 0;
    import("openseadragon").then((m) => { OSD = m.default; req(); });
    if (!lit.idx) fetch(`${LIGHTS_BASE}/index.json`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && j.cells) { lit.idx = j; req(); } }).catch(() => {});
    const load = (key) => {
      lit.cells.set(key, "loading"); inflight++;
      fetch(`${LIGHTS_BASE}/${key.replace(",", "_")}.json`).then((r) => (r.ok ? r.json() : null))
        .then((d) => { lit.cells.set(key, d || null); }).catch(() => lit.cells.delete(key))
        .finally(() => { inflight--; req(); });
    };
    const clear = (c) => { if (c) { const g = c.getContext("2d"); g.clearRect(0, 0, c.width, c.height); } };
    const draw = () => {
      queued = false;
      const G = lit.glow, Bc = lit.bulb, item = v && v.world && v.world.getItemAt(0);
      if (!alive || !G || !Bc || !item || !OSD) return;
      const W = G.clientWidth, H = G.clientHeight;
      for (const c of [G, Bc]) if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      clear(G); clear(Bc);
      const s = lit.s;
      if (!lightOn || s < 0.03 || !lit.power || !lit.idx) return;
      const iso = is3d(), F = iso ? floorRef.current : 0, share = lit.share;
      // image px -> screen px is a plain scale + offset
      const p0 = item.imageToViewerElementCoordinates(new OSD.Point(0, 0));
      const p1 = item.imageToViewerElementCoordinates(new OSD.Point(10000, 0));
      const k = (p1.x - p0.x) / 10000;
      const scr = (x, y, z) => { const [px, py] = w2img(x, y, z, iso); return [p0.x + px * k, p0.y + py * k]; };
      const pps = k * sqPx(iso);                                  // screen px per square
      // world squares on screen (any floor up to ~6 above, which sit higher on the image)
      const corners = [[0, 0], [W, 0], [0, H + ISO_FLOOR * 6 * k], [W, H + ISO_FLOOR * 6 * k]].map(([sx, sy]) => {
        const im = item.viewerElementToImageCoordinates(new OSD.Point(sx, sy));
        return iso ? (() => { const g = isoRef.current, u = (im.x - g.x0) / ISO_GW, w = (im.y - g.y0) / ISO_GH; return [(w + u) / 2, (w - u) / 2]; })()
          : img2w(im.x, im.y, false);
      });
      const xs = corners.map((c) => c[0]), ys = corners.map((c) => c[1]);
      const cx0 = Math.floor(Math.min(...xs) / 256) - 1, cx1 = Math.floor(Math.max(...xs) / 256) + 1;
      const cy0 = Math.floor(Math.min(...ys) / 256) - 1, cy1 = Math.floor(Math.max(...ys) / 256) + 1;
      const ell = (g, sprite, x, y, rx, ry, a) => {
        if (x + rx < 0 || x - rx > W || y + ry < 0 || y - ry > H) return;
        g.globalAlpha = a; g.drawImage(sprite, x - rx, y - ry, rx * 2, ry * 2);
      };
      // a circle of R squares on the ground: iso = 2:1 ellipse, top view = circle
      const rxy = (R) => (iso ? [R * 90.5 * k, R * 45.25 * k] : [R * pps, R * pps]);
      const g = G.getContext("2d"), b = Bc.getContext("2d");
      const far = pps < 0.45;
      if (far) {
        for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
          const sm = lit.idx.sum && lit.idx.sum[`${cx},${cy}`];
          if (!sm) continue;
          for (const [bx, by, w, r, gg, bb] of sm) {
            const [x, y] = scr(cx * 256 + (bx + 0.5) * 16, cy * 256 + (by + 0.5) * 16, 0);
            const [rx, ry] = rxy(16 * (0.75 + Math.min(1.25, Math.sqrt(w) / 4)));
            ell(g, glowSprite(dodgeOf(r, gg, bb)), x, y, rx, ry, s * Math.min(0.9, 0.1 + 0.12 * Math.sqrt(w)));
          }
        }
        return;
      }
      const near = pps >= 1.6;
      const rooms = new Path2D();
      let anyRoom = false;
      const onFloor = (z) => z === F;
      const upTo = (z) => (F >= 0 ? z >= 0 && z <= F : z === F);
      for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
        const key = `${cx},${cy}`;
        if (!lit.idx.cells[key]) continue;
        const d = lit.cells.get(key);
        if (d === undefined) { if (inflight < 6) load(key); continue; }
        if (!d || d === "loading") continue;
        // lit rooms: the floor diamond and its back walls, as one shape (overlaps don't double up)
        if (iso) for (const [z, h, rects] of d.r) {
          if (h >= share || !onFloor(z)) continue;
          for (const [x, y, w, hh] of rects) {
            const A = scr(x, y, z), B = scr(x + w, y, z), C = scr(x + w, y + hh, z), D = scr(x, y + hh, z), up = WALL_UP * k;
            if (Math.max(A[0], B[0], C[0], D[0]) < 0 || Math.min(A[0], B[0], C[0], D[0]) > W || C[1] < 0 || A[1] - up > H) continue;
            rooms.moveTo(A[0], A[1] - up); rooms.lineTo(B[0], B[1] - up); rooms.lineTo(B[0], B[1]); rooms.lineTo(C[0], C[1]);
            rooms.lineTo(D[0], D[1]); rooms.lineTo(D[0], D[1] - up); rooms.closePath();
            anyRoom = true;
          }
        }
        // lamps, signs, street lights: a pool on the ground (street lamp heads sit one floor up), the bulb close up
        for (const [x, y, z, r, gg, bb, rad, street, room] of d.l) {
          if (room >= 0 && room >= share) continue;                 // an indoor lamp in a room that's dark
          const zg = room < 0 && street && z > 0 ? z - 1 : z;
          if (room >= 0 ? !onFloor(z) || !iso : !upTo(zg)) continue;
          const R = street ? Math.min(rad, 9) : Math.min(rad, 6);
          const [px, py] = scr(x + 0.5, y + 0.5, zg), [rx, ry] = rxy(R);
          ell(g, glowSprite(dodgeOf(r, gg, bb)), px, py, rx, ry, s * (street ? 0.85 : 0.7));
          if (near && iso) {
            const [qx, qy] = scr(x + 0.5, y + 0.5, z), q = Math.max(2, 0.22 * 90 * k);
            ell(b, glowSprite([Math.min(255, r + 60), Math.min(255, gg + 60), Math.min(255, bb + 60)]), qx, qy - (street ? 0.5 * ISO_FLOOR * k : 0.25 * ISO_FLOOR * k), q, q, s);
          }
        }
        // windows of lit rooms: the light falling out onto the ground, and the pane itself
        if (pps >= 0.9) for (const [x, y, z, dir, out, h] of d.w) {
          if (h >= share || !upTo(z) || (!iso && z !== 0)) continue;
          if (out !== 0 && z === (F >= 0 ? 0 : F)) {                  // spill: ground floor (or the basement looked at)
            const ox = dir === 1 ? (out < 0 ? -0.9 : 0.9) : 0.5, oy = dir === 0 ? (out < 0 ? -0.9 : 0.9) : 0.5;
            const [px, py] = scr(dir === 1 ? x + ox : x + 0.5, dir === 0 ? y + oy : y + 0.5, z), [rx, ry] = rxy(1.7);
            ell(g, glowSprite(ROOM_RGB), px, py, rx, ry, s * 0.55);
          }
          if (near && iso) {
            const [px, py] = scr(dir === 1 ? x : x + 0.5, dir === 0 ? y : y + 0.5, z);
            ell(b, glowSprite([255, 214, 150]), px, py - 0.45 * ISO_FLOOR * k, Math.max(1.5, 14 * k), Math.max(2.5, 30 * k), s * 0.8);
          }
        }
      }
      if (anyRoom) { g.globalAlpha = s * 0.85; g.fillStyle = ROOM_DODGE; g.fill(rooms); }
      g.globalAlpha = 1; b.globalAlpha = 1;
    };
    const safeDraw = () => { try { draw(); } catch { queued = false; } };   // a bad cell file must never break the map
    const req = () => { if (!queued && alive) { queued = true; requestAnimationFrame(safeDraw); } };
    lit.draw = req;
    for (const ev of ["animation", "animation-finish", "resize", "update-viewport"]) v.addHandler(ev, req);
    req();
    return () => {
      alive = false; lit.draw = null;
      for (const ev of ["animation", "animation-finish", "resize", "update-viewport"]) try { v.removeHandler(ev, req); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, view, floor, lightOn]);
  // Player figures (2026-10-05): each online player drawn the way the game draws them (map3d kit figures/render_figures.py
  // renders <ISO_BASE>/figures/<look>.webp from mod 1.7.121's zombita_looks.txt: 8 frames of 192 x 256, N NE E SE S SW
  // W NW, feet at 96,224). A new position glides in over the time since the last one (the feed is every ~5 s), a jump
  // of 40+ squares (teleport, bus) snaps. Not drawn in a car or dead (the dot still shows); no figure yet = just the dot.
  const figRef = useRef<any>({ items: new Map(), imgs: new Map(), req: null });
  useEffect(() => {
    const st = figRef.current, now = performance.now(), seen = new Set();
    const at = (it, t) => {
      const u = it.dur > 0 ? Math.min(1, (t - it.t0) / it.dur) : 1;
      return [it.from[0] + (it.to[0] - it.from[0]) * u, it.from[1] + (it.to[1] - it.from[1]) * u, it.to[2]];
    };
    for (const d of dots) {
      if (!d.look || d.inCar || d.dead || !Number.isFinite(d.x)) continue;
      seen.add(d.id);
      const to = [d.x + 0.5, d.y + 0.5, d.z || 0];
      const it = st.items.get(d.id);
      if (!it) { st.items.set(d.id, { from: to, to, t0: now, dur: 0, last: now, face: d.face, look: d.look }); }
      else {
        const cur = at(it, now);
        const jump = Math.hypot(to[0] - cur[0], to[1] - cur[1]) > 40 || to[2] !== it.to[2];
        Object.assign(it, { from: jump ? to : [cur[0], cur[1]], to, t0: now, dur: jump ? 0 : Math.min(7000, Math.max(800, now - it.last)),
          last: now, face: d.face || it.face, look: d.look });
      }
      if (!st.imgs.has(d.look)) {
        const im = new Image();
        im.onload = () => st.req && st.req();
        im.onerror = () => setTimeout(() => st.imgs.delete(d.look), 60000);      // not rendered yet: ask again in a minute
        im.src = `${ISO_BASE}/figures/${d.look}.webp`;
        st.imgs.set(d.look, im);
      }
    }
    for (const id of Array.from(st.items.keys())) if (!seen.has(id)) st.items.delete(id);
    st.at = at;
    st.req && st.req();
  }, [dots]);

  // kiosks, stations and player figures (3D only, close enough to see them), drawn together back to front so a player
  // in front of a kiosk covers it and one behind is covered
  useEffect(() => {
    if (!ready || view !== "3d") { const c = propsRef.current.canvas; if (c) c.getContext("2d").clearRect(0, 0, c.width, c.height); return; }
    const v = viewerRef.current, fig = figRef.current;
    let alive = true, queued = false, OSD = null;
    const imgs = {};
    for (const [kind, p] of Object.entries(PROPS)) { const im = new Image(); im.onload = () => req(); im.src = p.src; imgs[kind] = im; }
    import("openseadragon").then((m) => { OSD = m.default; req(); });
    const frameOf = (face) => {
      if (!face) return 4;                                       // unknown: facing the camera-ish (S)
      const a = Math.atan2(face[0], -face[1]);                   // clockwise from north (x east, y south)
      return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
    };
    const draw = () => {
      queued = false;
      const c = propsRef.current.canvas, item = v && v.world && v.world.getItemAt(0);
      if (!alive || !c || !item || !OSD) return;
      const W = c.clientWidth, H = c.clientHeight;
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      const g = c.getContext("2d");
      g.clearRect(0, 0, W, H);
      const F = floorRef.current;
      const p0 = item.imageToViewerElementCoordinates(new OSD.Point(0, 0));
      const k = (item.imageToViewerElementCoordinates(new OSD.Point(10000, 0)).x - p0.x) / 10000;
      if (k * ISO_SQ < 1.2) return;                                // too far out to make one out
      const list = [];
      if (F >= 0) for (const pl of places) {                       // kiosks / stations stand on the ground floor
        const P = PROPS[pl.kind], im = imgs[pl.kind];
        if (!P || !im || !im.complete || !im.naturalWidth || !Number.isFinite(pl.x)) continue;
        const [ax, ay] = w2img(pl.x + 1, pl.y + 1, 0, true);         // the square's bottom vertex
        list.push({ d: pl.x + pl.y + 1, im, sx: 0, sw: im.naturalWidth, x: ax + P.ox, y: ay + P.oy });
      }
      const t = performance.now();
      let moving = false;
      for (const it of fig.items.values()) {
        const im = fig.imgs.get(it.look);
        if (!im || !im.complete || !im.naturalWidth) continue;
        const [x, y, z] = fig.at(it, t);
        if (it.dur > 0 && t - it.t0 < it.dur) moving = true;
        if (F >= 0 ? z > F || z < 0 : z !== F) continue;           // above the floor looked at (cut away), or not this basement
        const [ax, ay] = w2img(x, y, z, true);                       // the square's middle = where the feet stand
        const fw = im.naturalWidth / 8;
        list.push({ d: x + y, im, sx: frameOf(it.face) * fw, sw: fw, x: ax - fw / 2, y: ay - (im.naturalHeight - 32) });
      }
      list.sort((a, b) => a.d - b.d);
      for (const o of list) {
        const x = p0.x + o.x * k, y = p0.y + o.y * k, w = o.sw * k, h = o.im.naturalHeight * k;
        if (x > W || y > H || x + w < 0 || y + h < 0) continue;
        g.drawImage(o.im, o.sx, 0, o.sw, o.im.naturalHeight, x, y, w, h);
      }
      if (moving) req();                                           // keep gliding until everyone has arrived
    };
    const req = () => { if (!queued && alive) { queued = true; requestAnimationFrame(() => { try { draw(); } catch { queued = false; } }); } };
    fig.req = req;
    for (const ev of ["animation", "animation-finish", "resize", "update-viewport"]) v.addHandler(ev, req);
    req();
    return () => {
      alive = false; if (fig.req === req) fig.req = null;
      for (const ev of ["animation", "animation-finish", "resize", "update-viewport"]) try { v.removeHandler(ev, req); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, view, floor, places]);
  useEffect(() => { try { localStorage.setItem("soup-map-light", lightOn ? "on" : "off"); } catch {} }, [lightOn]);

  // is the second look on the server yet?
  useEffect(() => {
    fetch(`${CARTO_BASE}/map.dzi`, { method: "HEAD" }).then((r) => setHasCarto(r.ok)).catch(() => setHasCarto(false));
  }, []);

  // the second look is a layer over the first: added the first time it's picked, then just shown / hidden
  // (a hidden layer loads no tiles). Top view only.
  useEffect(() => {
    try { localStorage.setItem("soup-map-look", look); } catch {}
    const v = viewerRef.current; if (!ready || !v || !hasCarto || view !== "top") return;
    const want = look === "carto";
    if (cartoItem.current) { if (cartoItem.current !== "loading") cartoItem.current.setOpacity(want ? 1 : 0); return; }
    if (!want) return;
    cartoItem.current = "loading";
    v.addTiledImage({
      tileSource: `${CARTO_BASE}/map.dzi`, index: 1, x: 0, width: v.world.getItemAt(0).getBounds().width,
      success: (e) => { cartoItem.current = e.item; e.item.setOpacity(look === "carto" ? 1 : 0); },
      error: () => { cartoItem.current = null; setHasCarto(false); setLook("normal"); },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [look, ready, hasCarto, view]);

  // What's visible and in what order, from the current floor and season: floors 0..current (basements: current..-1),
  // the season skin in place of floor 0 once it has loaded, draw order lowest floor first with the skin just above
  // floor 0. Every change (floor picked, a floor or skin finished loading, season switched) runs this.
  const applyFloors = (v) => {
    const f = floorRef.current, s = skinRef.current;
    const ok = (n) => (f >= 0 ? n >= 0 && n <= f : n >= f && n < 0);
    const sk = s ? skinItems.current.get(s) : null;
    const skinReady = !!sk && sk !== "loading";
    const items = [];
    for (const [n, it] of floorItems.current) {
      if (!it || it === "loading") continue;
      it.setOpacity(ok(n) && !(n === 0 && skinReady) ? 1 : 0);
      items.push([n, it]);
    }
    for (const [name, it] of skinItems.current) {
      if (!it || it === "loading") continue;
      it.setOpacity(name === s && ok(0) ? 1 : 0);
      items.push([0.5, it]);
    }
    items.sort((a, b) => a[0] - b[0]).forEach(([, it], i) => { try { v.world.setItemIndex(it, i); } catch {} });
  };

  // which season to show: seasons.json (the sets that exist) + the in-game month from the public player feed
  useEffect(() => {
    if (view !== "3d") return;
    let stop = false;
    const seasonOf = (m) => (m === 12 || m <= 2 ? "winter" : m <= 5 ? "spring" : m <= 7 ? "summer" : m <= 9 ? "summer2" : "autumn");
    const load = async () => {
      try {
        const [sj, pl] = await Promise.all([
          fetch(`${ISO_BASE}/seasons.json?t=${Date.now()}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(`${API}/api/map/players`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);
        if (stop || !sj || !Array.isArray(sj.sets)) return;
        const main = sj.main || "summer2";
        let want = null;
        try { want = new URLSearchParams(window.location.search).get("season"); } catch {}
        if (!want && pl && pl.weather && pl.weather.season) want = seasonFromName(pl.weather.season);
        if (!want && pl && pl.game && pl.game.month) want = seasonOf(Number(pl.game.month));
        setSkin(want && want !== main && sj.sets.includes(want) ? want : null);
      } catch {}
    };
    load();
    const t = setInterval(load, 5 * 60000);
    return () => { stop = true; clearInterval(t); };
  }, [view]);

  // load the chosen season's floor 0 the first time it's needed
  useEffect(() => {
    const v = viewerRef.current; if (!ready || !v || view !== "3d") return;
    const base = floorItems.current.get(0);
    if (!base || base === "loading") return;
    if (skin && !skinItems.current.has(skin)) {
      skinItems.current.set(skin, "loading");
      v.addTiledImage({
        tileSource: `${ISO_BASE}/seasons/${skin}/layer0.dzi`, x: 0, width: base.getBounds().width, opacity: 0,
        success: (e) => { if (viewerRef.current !== v) return; skinItems.current.set(skin, e.item); applyFloors(v); },
        error: () => { skinItems.current.delete(skin); },
      });
    }
    applyFloors(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, view, skin]);

  // 3D floors: ground and up to the chosen floor stacked (a basement shows itself and the basements above it, no
  // ground). Each floor is its own image, added the first time it's needed, then shown / hidden.
  useEffect(() => {
    const v = viewerRef.current; if (!ready || !v || view !== "3d") return;
    const base = floorItems.current.get(0);
    if (!base || base === "loading") return;
    const lo = floor >= 0 ? 1 : floor, hi = floor >= 0 ? floor : -1;
    for (let L = lo; L <= hi; L++) {
      if (floorItems.current.has(L)) continue;
      floorItems.current.set(L, "loading");
      v.addTiledImage({
        tileSource: `${ISO_BASE}/layer${L}.dzi`, x: 0, width: base.getBounds().width,
        success: (e) => {
          if (viewerRef.current !== v) return;
          floorItems.current.set(L, e.item);
          applyFloors(v);         // the floor may have changed while this loaded: show / hide by the current one
        },
        error: () => { floorItems.current.delete(L); },
      });
    }
    applyFloors(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, view, floor]);

  // place pins (OSD overlays follow pan/zoom by themselves); on the ground in 3D
  useEffect(() => {
    const v = viewerRef.current; if (!ready || !v) return;
    let alive = true;
    const els = [];
    (async () => {
      const OSD = (await import("openseadragon")).default;
      if (!alive) return;
      for (const p of places) {
        const vp = toVp(OSD, mid(p.x), mid(p.y), 0); if (!vp) continue;
        const el = document.createElement("div");
        el.className = `wm-pin ${p.kind}`;
        el.innerHTML = p.kind === "town" ? `<span class="lbl"></span>` : `<span class="dot" style="background:${KIND[p.kind]?.color || "#fff"}"></span><span class="lbl"></span>`;
        el.querySelector(".lbl").textContent = p.name;
        if (p.kind !== "town") {
          el.addEventListener("mouseenter", () => { const r = el.getBoundingClientRect(), w = wrap.current.getBoundingClientRect(); setTip({ p, left: r.left - w.left + 14, top: r.top - w.top + 14 }); });
          el.addEventListener("mouseleave", () => setTip(null));
          el.addEventListener("click", (ev) => { ev.stopPropagation(); placeClickRef.current && placeClickRef.current(p); });
          keepPress(el);
        }
        v.addOverlay({ element: el, location: vp, checkResize: false });
        els.push(el);
      }
      setTimeout(declutter, 50);
    })();
    // only this effect's own pins: the live dots and boxes stay (clearing everything here made them blink out)
    return () => { alive = false; els.forEach((el) => { try { v.removeOverlay(el); } catch {} }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, places]);

  // live dots (players, markers, Live Ops layers). In 3D a dot stands on its own floor and fades when that floor is
  // above the one being looked at.
  useEffect(() => {
    const v = viewerRef.current; if (!ready || !v) return;
    (async () => {
      const OSD = (await import("openseadragon")).default;
      const seen = new Set();
      const iso = is3d();
      for (const d of dots) {
        seen.add(d.id);
        const dz = iso ? Number(d.z) || 0 : 0;
        const vp = toVp(OSD, mid(d.x), mid(d.y), dz); if (!vp) continue;
        let el = dotEls.current.get(d.id);
        if (!el) {
          el = document.createElement("div");
          el.className = "wm-dot";
          keepPress(el, () => !!el.onclick);
          el.innerHTML = `<span class="me"></span><span class="lbl" style="font:600 12px var(--mono,monospace);color:#fff;text-shadow:0 1px 2px #000"></span>`;
          v.addOverlay({ element: el, location: vp, checkResize: false });
          dotEls.current.set(d.id, el);
        } else {
          v.updateOverlay(el, vp);
        }
        const me = el.querySelector(".me");
        me.style.background = d.color || "#4caf7d";
        const sz = d.size || 14;
        me.style.width = me.style.height = sz + "px";
        me.style.borderWidth = (sz < 10 ? 1 : 3) + "px";
        el.querySelector(".lbl").textContent = d.label + (iso && dz && d.label ? ` (${floorName(dz).toLowerCase()})` : "");
        el.classList.toggle("above", iso && dz > floor);
        el.classList.toggle("click", !!d.onClick);
        el.onclick = d.onClick ? (ev) => { ev.stopPropagation(); d.onClick(); } : null;
      }
      for (const [id, el] of dotEls.current) if (!seen.has(id)) { try { v.removeOverlay(el); } catch {} dotEls.current.delete(id); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, dots, floor]);

  // boxes (Live Ops): keyed by id like the dots, moved / restyled in place. In 3D a box is a diamond on the ground:
  // the overlay covers the diamond's bounding box and an SVG polygon draws the four corners inside it.
  useEffect(() => {
    const v = viewerRef.current; if (!ready || !v) return;
    (async () => {
      const OSD = (await import("openseadragon")).default;
      const seen = new Set();
      const iso = is3d();
      for (const r of rects) {
        seen.add(r.id);
        let loc;
        if (iso) {
          const [lx] = w2img(r.x, r.y + r.h), [rx] = w2img(r.x + r.w, r.y);
          const [, ty] = w2img(r.x, r.y), [, by] = w2img(r.x + r.w, r.y + r.h);
          const item = v.world.getItemAt(0);
          if (!item) continue;
          const p0 = item.imageToViewportCoordinates(new OSD.Point(lx, ty)), p1 = item.imageToViewportCoordinates(new OSD.Point(rx, by));
          loc = new OSD.Rect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
        } else {
          const a = toVp(OSD, r.x, r.y), b = toVp(OSD, r.x + r.w, r.y + r.h);
          if (!a || !b) continue;
          loc = new OSD.Rect(a.x, a.y, b.x - a.x, b.y - a.y);
        }
        let el = rectEls.current.get(r.id);
        if (!el) {
          el = document.createElement("div");
          el.className = iso ? "wm-rect iso" : "wm-rect";
          if (!iso) keepPress(el, () => !!el.onclick);
          el.innerHTML = `<span class="rl"></span>`;
          if (iso) {
            const svg = document.createElementNS(svgNS, "svg");
            svg.setAttribute("preserveAspectRatio", "none");
            const poly = document.createElementNS(svgNS, "polygon");
            poly.setAttribute("vector-effect", "non-scaling-stroke");
            poly.setAttribute("stroke-width", "2");
            svg.appendChild(poly);
            keepPress(poly, () => !!poly.onclick);
            el.prepend(svg);
          }
          v.addOverlay({ element: el, location: loc });
          rectEls.current.set(r.id, el);
        } else {
          v.updateOverlay(el, loc);
        }
        if (iso) {
          const W = (r.w + r.h) * ISO_GW, H = (r.w + r.h) * ISO_GH;
          const svg = el.querySelector("svg"), poly = el.querySelector("polygon");
          svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
          poly.setAttribute("points", `${r.h * ISO_GW},0 ${W},${r.w * ISO_GH} ${r.w * ISO_GW},${H} 0,${r.h * ISO_GH}`);
          poly.setAttribute("fill", r.fill || "transparent");
          poly.setAttribute("stroke", r.color || "transparent");
          poly.setAttribute("stroke-dasharray", r.dashed ? "6 4" : "none");
          poly.style.pointerEvents = r.onClick ? "all" : "none";
          poly.style.cursor = r.onClick ? "pointer" : "";
          poly.onclick = r.onClick ? (ev) => { ev.stopPropagation(); r.onClick(); } : null;
        } else {
          el.style.border = `2px ${r.dashed ? "dashed" : "solid"} ${r.color || "transparent"}`;
          el.style.background = r.fill || "transparent";
          el.classList.toggle("click", !!r.onClick);
          el.onclick = r.onClick ? (ev) => { ev.stopPropagation(); r.onClick(); } : null;
        }
        el.querySelector(".rl").textContent = r.label || "";
      }
      for (const [id, el] of rectEls.current) if (!seen.has(id)) { try { v.removeOverlay(el); } catch {} rectEls.current.delete(id); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, rects]);

  useEffect(() => { if (ready) declutter(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [hidden, ready]);

  // keep ?f= in step with the floor picker
  useEffect(() => {
    if (!ready || view !== "3d") return;
    try { const u = new URL(window.location.href); u.searchParams.set("f", String(floor)); window.history.replaceState(null, "", u.toString()); } catch {}
  }, [floor, ready, view]);

  const hideCls = useMemo(() => Object.entries(hidden).filter(([, h]) => h).map(([k]) => `wm-hide-${k}`).join(" "), [hidden]);
  const fl = isoRef.current;

  return (
    <div ref={wrap} className={`wm-wrap ${hideCls}`} data-zoom="far">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div ref={host} className="wm-osd" />
      <button className="wm-fs" onClick={toggleFs} title={isFs ? "Leave full screen (Esc)" : "Full screen"}>{isFs ? "Exit full screen" : "Full screen"}</button>
      {ready && (
        <div className="wm-bars">
          {has3d && (
            <div className="wm-style">
              {VIEWS.map((v) => <button key={v.id} className={view === v.id ? "on" : ""} onClick={() => switchView(v.id)}>{v.label}</button>)}
            </div>
          )}
          {view === "top" && hasCarto && (
            <div className="wm-style">
              {STYLES.map((st) => <button key={st.id} className={look === st.id ? "on" : ""} onClick={() => setLook(st.id)}>{st.label}</button>)}
            </div>
          )}
        </div>
      )}
      {ready && view === "3d" && fl && (
        <div className="wm-floor">
          <button disabled={floor >= fl.max} onClick={() => setFloor((f) => Math.min(fl.max, f + 1))} title="Go up a floor">&#9650;</button>
          <span>{floorName(floor)}</span>
          <button disabled={floor <= fl.min} onClick={() => setFloor((f) => Math.max(fl.min, f - 1))} title="Go down a floor">&#9660;</button>
        </div>
      )}
      {view === "3d" && bases && <div className="wm-bases">{basesLine(bases, nowS)}</div>}
      {ready && (
        <button className="wm-clock" onClick={() => setLightOn((x) => !x)}>
          <div className="wm-clockrow">
            <GameTimeWidget onTime={setWsTime}
              title={lightOn ? "In-game time. The map follows day, night and weather; click to keep it in daylight." : "In-game time. Click to show day, night and weather on the map."} />
            {wxNow && (() => {
              const k = wxKind(wxNow, gameNow ? gameNow.mins : null);
              return k ? (
                <div className="wm-wx" title={`${WX_TITLE[k]}${typeof wxNow.temp === "number" ? `, ${Math.round(wxNow.temp)} C` : ""}${wxNow.power === false ? ". The power is out." : ""}`}>
                  {WX_ICON[k]}{typeof wxNow.temp === "number" ? <>{Math.round(wxNow.temp)}&deg;</> : null}
                </div>
              ) : null;
            })()}
          </div>
          {!lightOn && <span>daylight</span>}
        </button>
      )}
      {coords && <div className="wm-coords">x {coords.x} &middot; y {coords.y}{view === "3d" ? <> &middot; {floorName(floor).toLowerCase()}</> : null}</div>}
      {tip && (
        <div className="wm-tip" style={{ left: tip.left, top: tip.top }}>
          <b>{tip.p.name}</b>{tip.p.role ? <><br />{tip.p.role}</> : null}{tip.p.town ? <><br /><span style={{ color: "#888" }}>{tip.p.town}</span></> : null}
          <br /><span style={{ color: "#666" }}>{tip.p.x}, {tip.p.y}</span>
        </div>
      )}
      {error && <div className="wm-coords" style={{ bottom: "auto", top: 10, color: "#e05555" }}>{error}</div>}
      {!ready && !error && <div className="wm-coords" style={{ bottom: "auto", top: 10 }}>Loading the map&hellip;</div>}
    </div>
  );
}

export { KIND };

/** Pan / zoom the map to a world spot (squares); z = screen px per top-map px (the same scale in 3D). */
export function flyTo(x: number, y: number, z = 0.5) {
  window.dispatchEvent(new CustomEvent("wm-fly", { detail: { x, y, z } }));
}
