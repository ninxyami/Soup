"use client";
// Location 2: the game shows a marker (a QR code) on the game screen; this phone's camera reads it.
// Uses the browser's own BarcodeDetector where there is one (Android Chrome), else jsQR (Apache-2.0), loaded on demand.
// A typed box is the fallback for phones without a camera or without camera permission.
import { useEffect, useRef, useState } from "react";

type Detect = (c: HTMLCanvasElement) => Promise<string | null>;

async function makeDetector(): Promise<Detect> {
  const BD = (globalThis as any).BarcodeDetector;
  if (BD) {
    try {
      const formats: string[] = await BD.getSupportedFormats?.() ?? ["qr_code"];
      if (formats.includes("qr_code")) {
        const det = new BD({ formats: ["qr_code"] });
        return async c => { const r = await det.detect(c); return r[0]?.rawValue ?? null; };
      }
    } catch { /* fall through to jsQR */ }
  }
  const jsQR = (await import("jsqr")).default;
  return async c => {
    const ctx = c.getContext("2d", { willReadFrequently: true } as any) as CanvasRenderingContext2D;
    const img = ctx.getImageData(0, 0, c.width, c.height);
    return jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
  };
}

const CLEAN = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

export default function ScanMarker({ busy, onScan, error }: { busy: boolean; onScan: (text: string) => Promise<boolean>; error: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cam, setCam] = useState<"off" | "starting" | "on" | "denied" | "none">("off");
  const [typed, setTyped] = useState("");
  const [seen, setSeen] = useState("");
  const sending = useRef(false);

  const stop = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };
  useEffect(() => stop, []);
  useEffect(() => { if (error) { sending.current = false; setSeen(""); } }, [error]);

  const send = async (text: string) => {
    if (sending.current || busy) return;
    sending.current = true;
    setSeen(text);
    const ok = await onScan(text);
    if (ok) { stop(); setCam("off"); } else { sending.current = false; }
  };

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setCam("none"); return; }
    setCam("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play().catch(() => {});
      setCam("on");
    } catch (e: any) {
      setCam(e?.name === "NotAllowedError" ? "denied" : "none");
    }
  };

  useEffect(() => {
    if (cam !== "on") return;
    let alive = true, timer = 0;
    (async () => {
      const detect = await makeDetector();
      const loop = async () => {
        if (!alive) return;
        const v = videoRef.current, c = canvasRef.current;
        if (v && c && v.videoWidth) {
          const scale = Math.min(1, 640 / v.videoWidth);
          c.width = Math.round(v.videoWidth * scale);
          c.height = Math.round(v.videoHeight * scale);
          c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
          try {
            const text = await detect(c);
            const clean = text ? CLEAN(text) : "";
            if (clean.length === 8 && !sending.current) { send(clean); }
          } catch { /* keep trying */ }
        }
        timer = window.setTimeout(loop, 220);
      };
      loop();
    })();
    return () => { alive = false; clearTimeout(timer); };
  }, [cam]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "1", maxHeight: "46vh", borderRadius: 12, overflow: "hidden", background: "#060807", border: "1px solid #24302a", alignSelf: "center" }}>
        <video ref={videoRef} playsInline muted autoPlay style={{ width: "100%", height: "100%", objectFit: "cover", display: cam === "on" ? "block" : "none" }} />
        <canvas ref={canvasRef} style={{ display: "none" }} />
        {cam === "on" && (
          <div style={{ position: "absolute", inset: "14%", border: "3px solid rgba(159,211,176,0.85)", borderRadius: 14, boxShadow: "0 0 0 999px rgba(0,0,0,0.35)" }}>
            <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "#9fd3b0", top: "50%", animation: "th-blink 1.2s infinite" }} />
          </div>
        )}
        {cam !== "on" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 18, textAlign: "center" }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#9fd3b0" strokeWidth="1.4"><path d="M3 8V4h4M17 4h4v4M21 16v4h-4M7 20H3v-4" /><rect x="7" y="7" width="4" height="4" /><rect x="13" y="7" width="4" height="4" /><rect x="7" y="13" width="4" height="4" /><path d="M13 13h4v4h-4z" opacity=".5" /></svg>
            {cam === "off" && <button className="th-btn big" onClick={start} disabled={busy}>Open the camera</button>}
            {cam === "starting" && <div className="th-note">Starting the camera...</div>}
            {cam === "denied" && <><div className="th-note">The camera is blocked. Allow it in your browser settings, or type the code below.</div><button className="th-btn" onClick={start}>Try again</button></>}
            {cam === "none" && <div className="th-note">No camera found on this device. Type the code below instead.</div>}
          </div>
        )}
      </div>
      {cam === "on" && <div className="th-note">Hold the phone steady with the marker inside the box.{seen ? ` Read: ${seen}` : ""}</div>}
      <div className="th-note" style={{ textAlign: "left", marginBottom: -6 }}>Can&apos;t scan? Type the 8 characters under the marker:</div>
      <form onSubmit={e => { e.preventDefault(); const c = CLEAN(typed); if (c.length === 8) send(c); }}
        style={{ display: "flex", gap: 8 }}>
        <input value={typed} onChange={e => setTyped(e.target.value.toUpperCase())} maxLength={12} placeholder="8 characters" aria-label="Type the 8 characters under the marker"
          autoCapitalize="characters" autoCorrect="off" spellCheck={false} inputMode="text"
          style={{ flex: 1, minWidth: 0, minHeight: 52, borderRadius: 10, border: "1px solid #39403b", background: "rgba(0,0,0,0.5)", color: "#f0ead8", padding: "0 12px", fontSize: 17, letterSpacing: "0.12em", fontFamily: "'Share Tech Mono', monospace" }} />
        <button className="th-btn" type="submit" disabled={busy || CLEAN(typed).length !== 8}>Send</button>
      </form>
    </div>
  );
}
