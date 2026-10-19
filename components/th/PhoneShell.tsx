"use client";
// The phone around the app: the frame picture on desktop browsers, a thin themed bar on real phones.
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ART, FRAME_SCREEN } from "@/lib/th/art";

function Clock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);
  return <span>{t}</span>;
}

export default function PhoneShell({ children, signal = 3, battery = 0.34, carrier = "", shake = false }: {
  children: ReactNode; signal?: number; battery?: number; carrier?: string; shake?: boolean;
}) {
  const vars = {
    "--sl": `${FRAME_SCREEN.left}%`, "--st": `${FRAME_SCREEN.top}%`,
    "--sw": `${FRAME_SCREEN.width}%`, "--sh": `${FRAME_SCREEN.height}%`,
  } as CSSProperties;
  return (
    <div className="th-root">
      <div className="th-backdrop" style={{ backgroundImage: `url(${ART.wallpaper})` }} />
      <div className={`th-phone${shake ? " th-shake" : ""}`} style={vars}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="th-frame-img" src={ART.frame} alt="" />
        <div className="th-screen">
          <div className="th-wall" style={{ backgroundImage: `url(${ART.wallpaper})` }} />
          <div className="th-bar">
            <Clock />
            <span style={{ marginLeft: "auto" }}>{carrier}</span>
            <span className="th-bars" aria-label={`signal ${signal} of 4`}>
              {[4, 6, 8, 10].map((h, i) => <i key={h} style={{ height: h, opacity: i < signal ? 1 : 0.25 }} />)}
            </span>
            <span className="th-batt" aria-label="battery"><i style={{ width: `${Math.round(battery * 15)}px` }} /></span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
