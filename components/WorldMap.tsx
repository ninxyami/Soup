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

const TILE_BASE = (process.env.NEXT_PUBLIC_MAP_TILES || "https://api.stateofundeadpurge.site/map-tiles/v1").replace(/\/$/, "");
// The second look (Nin 2026-10-04: "keep tab to show both styles"): the same world drawn the way the game's paper map
// draws it (buildings as white floor plans). Same size and origin as v1, so it sits exactly on top as a second layer.
// The button only appears once that folder answers.
const CARTO_BASE = (process.env.NEXT_PUBLIC_MAP_TILES_CARTO || "https://api.stateofundeadpurge.site/map-tiles/carto1").replace(/\/$/, "");
// The 3D (isometric) world. The Top / 3D switch only appears once its map_info.json answers.
const ISO_BASE = (process.env.NEXT_PUBLIC_MAP_TILES_3D || "https://api.stateofundeadpurge.site/map-tiles/3d").replace(/\/$/, "");
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
export type Dot = { id: string; label: string; x: number; y: number; z?: number; color?: string; size?: number; onClick?: () => void };
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

const floorName = (f) => (f === 0 ? "Ground" : f > 0 ? `Floor ${f}` : `Basement ${-f}`);
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
      dotEls.current.clear(); rectEls.current.clear(); floorItems.current.clear();
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

  // 3D floors: ground and up to the chosen floor stacked (a basement shows itself and the basements above it, no
  // ground). Each floor is its own image, added the first time it's needed, then shown / hidden.
  useEffect(() => {
    const v = viewerRef.current; if (!ready || !v || view !== "3d") return;
    const base = floorItems.current.get(0);
    if (!base || base === "loading") return;
    const shown = (L) => (floor >= 0 ? L >= 0 && L <= floor : L >= floor && L < 0);
    const order = () => {                 // draw order = floor order, lowest first (item 0 stays a floor-sized image)
      const items = [...floorItems.current.entries()].filter(([, it]) => it && it !== "loading").sort((a, b) => a[0] - b[0]);
      items.forEach(([, it], i) => { try { v.world.setItemIndex(it, i); } catch {} });
    };
    for (const [L, it] of floorItems.current) if (it && it !== "loading") it.setOpacity(shown(L) ? 1 : 0);
    const lo = floor >= 0 ? 1 : floor, hi = floor >= 0 ? floor : -1;
    for (let L = lo; L <= hi; L++) {
      if (floorItems.current.has(L)) continue;
      floorItems.current.set(L, "loading");
      v.addTiledImage({
        tileSource: `${ISO_BASE}/layer${L}.dzi`, x: 0, width: base.getBounds().width,
        success: (e) => {
          if (viewerRef.current !== v) return;
          floorItems.current.set(L, e.item);
          // the floor may have changed while this loaded: show / hide by the current one
          const f = floorRef.current, ok = (n) => (f >= 0 ? n >= 0 && n <= f : n >= f && n < 0);
          for (const [n, it] of floorItems.current) if (it && it !== "loading") it.setOpacity(ok(n) ? 1 : 0);
          order();
        },
        error: () => { floorItems.current.delete(L); },
      });
    }
    order();
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
