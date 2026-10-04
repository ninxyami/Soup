// @ts-nocheck
"use client";
// components/WorldMap.tsx
//
// The server's map: our own top-down render of the whole world (vanilla + every map mod in servertest.ini Map=, merged
// the way the server merges them), served from OUR box as a Deep Zoom image, drawn with OpenSeadragon (BSD, bundled
// into this site). Places (shops, bus stations, the diner, towns) come from /map/places.json, generated from the mod's
// own data by Zombita_PC_Kit/docs/make_map_places.py. Nothing here loads from anyone else's servers.
//
// World coordinates: the image starts at world (x0, y0) and has `sqr` pixels per game square (map_info.json), so
// image px = (world - origin) * sqr. A later "live" layer (own dot for players, everyone for Live Ops) plugs in via
// the `dots` prop.

import { useEffect, useMemo, useRef, useState } from "react";

const TILE_BASE = (process.env.NEXT_PUBLIC_MAP_TILES || "https://api.stateofundeadpurge.site/map-tiles/v1").replace(/\/$/, "");

export type Place = { kind: "shop" | "bus" | "diner" | "town"; id: string; name: string; role?: string; town?: string; x: number; y: number };
export type Dot = { id: string; label: string; x: number; y: number; color?: string };

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
.wm-pin .dot{display:inline-block;flex:0 0 auto;width:10px;height:10px;border-radius:50%;border:2px solid #0b0d10;box-shadow:0 0 0 1px rgba(255,255,255,.35)}
.wm-pin .lbl{font:600 11px/1.2 var(--mono,monospace);color:#e6e6e6;text-shadow:0 1px 2px #000,0 0 3px #000;letter-spacing:.3px}
.wm-pin.town{pointer-events:none}
.wm-pin.town .lbl{font:600 15px/1.2 'Bebas Neue',sans-serif;letter-spacing:1.5px;color:#f2f2f2;text-transform:uppercase}
/* OpenSeadragon writes an inline display on every overlay, so these need !important */
.wm-wrap[data-zoom="far"] .wm-pin.shop,.wm-wrap[data-zoom="far"] .wm-pin.bus,.wm-wrap[data-zoom="far"] .wm-pin.diner{display:none!important}
.wm-wrap[data-zoom="mid"] .wm-pin.shop .lbl,.wm-wrap[data-zoom="mid"] .wm-pin.bus .lbl{display:none!important}
.wm-wrap[data-zoom="near"] .wm-pin.town{opacity:.35}
.wm-hide-shop .wm-pin.shop,.wm-hide-bus .wm-pin.bus,.wm-hide-diner .wm-pin.diner,.wm-hide-town .wm-pin.town{display:none!important}
.wm-dot{transform:translate(-50%,-50%);display:flex!important;align-items:center;gap:4px;pointer-events:none}
.wm-dot .me{display:inline-block;flex:0 0 auto;width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 8px rgba(0,0,0,.8)}
.wm-coords{position:absolute;left:10px;bottom:10px;font:12px var(--mono,monospace);color:#cfd3da;background:rgba(0,0,0,.6);padding:4px 8px;border-radius:3px;pointer-events:none}
.wm-tip{position:absolute;pointer-events:none;background:rgba(10,13,16,.95);border:1px solid #2a2f37;padding:6px 9px;font:12px var(--mono,monospace);color:#e6e6e6;border-radius:3px;z-index:5;max-width:260px}
.wm-tip b{color:#c8a84b}
`;

export default function WorldMap({ places = [], dots = [], hidden = {}, focus = null, onPlaceClick = null, onMapClick = null }:
  { places?: Place[]; dots?: Dot[]; hidden?: Record<string, boolean>; focus?: { x: number; y: number; z?: number } | null;
    onPlaceClick?: ((p: Place) => void) | null; onMapClick?: ((w: { x: number; y: number }) => void) | null }) {
  const host = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const infoRef = useRef<any>({ sqr: 4, x0: 0, y0: 0 });
  const dotEls = useRef<Map<string, HTMLElement>>(new Map());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [tip, setTip] = useState<{ p: Place; left: number; top: number } | null>(null);

  // world <-> viewport
  const toVp = (OSD, x, y) => {
    const v = viewerRef.current, i = infoRef.current;
    const item = v && v.world.getItemAt(0);
    if (!item) return null;
    return item.imageToViewportCoordinates(new OSD.Point((x - i.x0) * i.sqr, (y - i.y0) * i.sqr));
  };

  useEffect(() => {
    let destroyed = false;
    let viewer = null;
    (async () => {
      const OSD = (await import("openseadragon")).default;
      try {
        const r = await fetch(`${TILE_BASE}/map_info.json`);
        if (r.ok) { const j = await r.json(); infoRef.current = { sqr: j.sqr || 4, x0: j.x0 || 0, y0: j.y0 || 0 }; }
      } catch { /* defaults */ }
      if (destroyed || !host.current) return;
      viewer = OSD({
        element: host.current,
        tileSources: `${TILE_BASE}/map.dzi`,
        drawer: "canvas",                  // no CORS needed for plain drawing
        showNavigationControl: false,
        gestureSettingsMouse: { clickToZoom: false, dblClickToZoom: true },
        maxZoomPixelRatio: 3,
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
        setReady(true);
        const p = new URLSearchParams(window.location.search);
        const fx = Number(p.get("x")), fy = Number(p.get("y")), fz = Number(p.get("z"));
        const f = focus || (fx && fy ? { x: fx, y: fy, z: fz || 0.25 } : null);
        if (f) {
          const vp = toVp(OSD, f.x, f.y);
          if (vp) { viewer.viewport.panTo(vp, true); viewer.viewport.zoomTo(viewer.world.getItemAt(0).imageToViewportZoom(f.z || 0.25), null, true); }
        }
      });
      // zoom band -> which labels show (CSS on the wrapper)
      const band = () => {
        const item = viewer.world.getItemAt(0); if (!item || !wrap.current) return;
        const z = item.viewportToImageZoom(viewer.viewport.getZoom(true));   // screen px per image px
        const pxPerSquare = z * infoRef.current.sqr;
        wrap.current.dataset.zoom = pxPerSquare < 0.35 ? "far" : pxPerSquare < 1.5 ? "mid" : "near";
      };
      viewer.addHandler("zoom", band);
      viewer.addHandler("open", band);
      // mouse -> world coords
      new OSD.MouseTracker({
        element: viewer.canvas,
        moveHandler: (e) => {
          const item = viewer.world.getItemAt(0); if (!item) return;
          const img = item.viewerElementToImageCoordinates(e.position);
          const i = infoRef.current;
          setCoords({ x: Math.floor(img.x / i.sqr + i.x0), y: Math.floor(img.y / i.sqr + i.y0) });
        },
        leaveHandler: () => setCoords(null),
      });
      viewer.addHandler("canvas-click", (e) => {
        if (!e.quick || !onMapClick) return;
        const item = viewer.world.getItemAt(0); if (!item) return;
        const img = item.viewerElementToImageCoordinates(e.position);
        const i = infoRef.current;
        onMapClick({ x: Math.floor(img.x / i.sqr + i.x0), y: Math.floor(img.y / i.sqr + i.y0) });
      });
      // shareable view: ?x=&y=&z= kept in the address bar
      viewer.addHandler("animation-finish", () => {
        const item = viewer.world.getItemAt(0); if (!item) return;
        const c = item.viewportToImageCoordinates(viewer.viewport.getCenter(true));
        const i = infoRef.current;
        const z = item.viewportToImageZoom(viewer.viewport.getZoom(true));
        const u = new URL(window.location.href);
        u.searchParams.set("x", String(Math.floor(c.x / i.sqr + i.x0)));
        u.searchParams.set("y", String(Math.floor(c.y / i.sqr + i.y0)));
        u.searchParams.set("z", z.toFixed(3));
        window.history.replaceState(null, "", u.toString());
      });
    })().catch((e) => setError(String(e?.message || e)));
    return () => { destroyed = true; try { viewer && viewer.destroy(); } catch {} viewerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // place pins (OSD overlays follow pan/zoom by themselves)
  useEffect(() => {
    const v = viewerRef.current; if (!ready || !v) return;
    let alive = true;
    (async () => {
      const OSD = (await import("openseadragon")).default;
      if (!alive) return;
      const els = [];
      for (const p of places) {
        const vp = toVp(OSD, p.x, p.y); if (!vp) continue;
        const el = document.createElement("div");
        el.className = `wm-pin ${p.kind}`;
        el.innerHTML = p.kind === "town" ? `<span class="lbl"></span>` : `<span class="dot" style="background:${KIND[p.kind]?.color || "#fff"}"></span><span class="lbl"></span>`;
        el.querySelector(".lbl").textContent = p.name;
        if (p.kind !== "town") {
          el.addEventListener("mouseenter", () => { const r = el.getBoundingClientRect(), w = wrap.current.getBoundingClientRect(); setTip({ p, left: r.left - w.left + 14, top: r.top - w.top + 14 }); });
          el.addEventListener("mouseleave", () => setTip(null));
          el.addEventListener("click", (ev) => { ev.stopPropagation(); onPlaceClick && onPlaceClick(p); });
        }
        v.addOverlay({ element: el, location: vp, checkResize: false });
        els.push(el);
      }
      return () => els.forEach((el) => { try { v.removeOverlay(el); } catch {} });
    })();
    return () => { alive = false; try { v.clearOverlays(); } catch {} dotEls.current.clear(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, places]);

  // live dots (own dot for players; everyone in Live Ops)
  useEffect(() => {
    const v = viewerRef.current; if (!ready || !v) return;
    (async () => {
      const OSD = (await import("openseadragon")).default;
      const seen = new Set();
      for (const d of dots) {
        seen.add(d.id);
        const vp = toVp(OSD, d.x, d.y); if (!vp) continue;
        let el = dotEls.current.get(d.id);
        if (!el) {
          el = document.createElement("div");
          el.className = "wm-dot";
          el.innerHTML = `<span class="me"></span><span class="lbl" style="font:600 12px var(--mono,monospace);color:#fff;text-shadow:0 1px 2px #000"></span>`;
          v.addOverlay({ element: el, location: vp, checkResize: false });
          dotEls.current.set(d.id, el);
        } else {
          v.updateOverlay(el, vp);
        }
        el.querySelector(".me").style.background = d.color || "#4caf7d";
        el.querySelector(".lbl").textContent = d.label;
      }
      for (const [id, el] of dotEls.current) if (!seen.has(id)) { try { v.removeOverlay(el); } catch {} dotEls.current.delete(id); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, dots]);

  const hideCls = useMemo(() => Object.entries(hidden).filter(([, h]) => h).map(([k]) => `wm-hide-${k}`).join(" "), [hidden]);

  return (
    <div ref={wrap} className={`wm-wrap ${hideCls}`} data-zoom="far">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div ref={host} className="wm-osd" />
      {coords && <div className="wm-coords">x {coords.x} &middot; y {coords.y}</div>}
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
