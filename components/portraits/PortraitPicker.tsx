"use client";
// The portrait picker: the same choices as the phone's Portrait app, so a pick on either side shows on both.
// routers/portraits.py on the bot. Pictures come from the API, so new art needs no site build.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { API } from "@/lib/constants";

export interface Template { key: string; look: string; group: string; name: string; desc: string }
export interface Upload { id: number; key: string; status: string; reason: string; created_at: number }
export interface MyPortrait {
  name: string; linked: boolean; pick: string; wanted: string; hall: string; head: string;
  uploads: Upload[]; upload_wait: number; upload_waiting: boolean; rules: string[];
}
interface Catalogue { looks: { id: string; name: string }[]; rules: string[]; items: Template[] }

const DISCORD = "discord";
const GREEN = "#7ee06a";

export function portraitUrl(key: string) {
  return `${API}/media/portraits/${key}.webp`;
}

/** The picture for a pick, or "" for the live 3D character. */
function pickUrl(key: string, discord: string) {
  if (key === "") return "";
  return key === DISCORD ? discord : portraitUrl(key);
}

function Picture({ url, size, label, round }: { url: string; size: number; label?: string; round?: boolean }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={label || ""} width={size} height={size} style={{ width: size, height: size, borderRadius: round ? "50%" : 3 }}
         className="object-cover bg-[#0a0d0a] flex-shrink-0" />
  ) : (
    <div style={{ width: size, height: size, borderRadius: round ? "50%" : 3 }}
         className="flex-shrink-0 flex items-center justify-center text-center bg-[#0f1a12] border border-[#23382a] text-[#7c9a84] font-mono text-[0.62rem] leading-tight px-1">
      {size >= 80 ? "your live 3D character" : "3D"}
    </div>
  );
}

/** The real bubble's shape: dark, thin border, tail, the picture poking out on the left. */
function BubbleSample({ url, name }: { url: string; name: string }) {
  return (
    <div className="relative rounded-md bg-[radial-gradient(circle_at_50%_120%,#26332a,#0b0f0c_70%)] border border-[#1e2530] px-3 pt-4 pb-7 overflow-hidden">
      <p className="font-mono text-[0.6rem] uppercase tracking-widest text-[#5d6b62] m-0 mb-3">over your head</p>
      <div className="relative mx-auto flex items-end" style={{ maxWidth: 240 }}>
        <div className="relative z-10 mb-[-1px] mr-[-10px]"><Picture url={url} size={58} label="" /></div>
        <div className="relative flex-1 min-w-0 bg-black/80 border border-[#b8b8b8]/70 rounded-md pl-5 pr-3 py-2">
          <div className="font-mono text-[0.72rem] text-[#7ee06a] truncate">{name || "You"}</div>
          <div className="text-[0.8rem] text-white leading-snug">Anyone got 1 silver?</div>
          <span className="absolute left-1/2 -bottom-[7px] w-3 h-3 bg-black border-r border-b border-[#b8b8b8]/70 rotate-45" />
        </div>
      </div>
    </div>
  );
}

function PosterSample({ url, name }: { url: string; name: string }) {
  return (
    <div className="flex-shrink-0 w-[92px] bg-[#e3cc99] text-[#3a2514] text-center px-1.5 pt-1.5 pb-2 border border-[#8c6a3d]" aria-label="Wanted poster sample">
      <div className="font-display text-[0.95rem] leading-none text-[#731a14] tracking-wider">WANTED</div>
      <div className="mx-auto mt-1 w-[68px] h-[68px] border-2 border-[#4d331e] bg-[#6b5438] flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt="" className="w-full h-full object-cover sepia-[.3]" /> : <span className="text-[#d7c195] text-xl">?</span>}
      </div>
      <div className="font-mono text-[0.58rem] mt-1 truncate">{name || "You"}</div>
    </div>
  );
}

function Segment({ value, options, onPick, busy }: { value: string; options: [string, string][]; onPick: (v: string) => void; busy: boolean }) {
  return (
    <div className="inline-flex flex-wrap border border-[#2a3038] rounded-[3px] overflow-hidden">
      {options.map(([v, label]) => (
        <button key={v} type="button" disabled={busy} onClick={() => onPick(v)} aria-pressed={value === v}
                className="font-mono text-[0.72rem] px-3 py-1.5 border-none cursor-pointer transition-colors disabled:cursor-wait"
                style={{ background: value === v ? GREEN : "transparent", color: value === v ? "#07100a" : "#9aa3ad" }}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ── the crop tool: drag and zoom inside a square, sent as a 512 px PNG. The bot re-encodes it anyway ──────────────────
const VIEW = 288;

function Cropper({ file, onCancel, onDone, busy }: { file: File; onCancel: () => void; onDone: (b: Blob) => void; busy: boolean }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [error, setError] = useState("");
  const [small, setSmall] = useState("");
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    let live = true;
    i.onload = () => {
      if (!live) return;
      setError(Math.min(i.naturalWidth, i.naturalHeight) < 128 ? "That picture is too small. It needs to be at least 128 x 128." : "");
      setImg(i);
      setZoom(1);
      setPos({ x: 0, y: 0 });
    };
    i.onerror = () => { if (live) setError("That file isn't a picture we can read."); };
    i.src = url;
    return () => { live = false; URL.revokeObjectURL(url); };
  }, [file]);

  const scale = img ? (VIEW / Math.min(img.naturalWidth, img.naturalHeight)) * zoom : 1;
  const clamp = useCallback((p: { x: number; y: number }) => {
    if (!img) return p;
    const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    return { x: Math.min(0, Math.max(VIEW - w, p.x)), y: Math.min(0, Math.max(VIEW - h, p.y)) };
  }, [img, scale]);

  useEffect(() => {
    if (!img) return;
    const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    setPos((p) => (p.x === 0 && p.y === 0 && zoom === 1 ? { x: (VIEW - w) / 2, y: (VIEW - h) / 2 } : clamp(p)));
  }, [img, zoom, scale, clamp]);

  const draw = useCallback(() => {
    const c = canvas.current;
    if (!c || !img) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 512, 512);
    const k = 512 / VIEW;
    ctx.drawImage(img, pos.x * k, pos.y * k, img.naturalWidth * scale * k, img.naturalHeight * scale * k);
    setSmall(c.toDataURL("image/png"));
  }, [img, pos, scale]);

  useEffect(draw, [draw]);

  const down = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d) setPos(clamp({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y }));
  };

  return (
    <div className="border border-[#2a3038] bg-[#0b0e12] p-4 mt-4">
      {error ? <p className="text-[#e05555] text-[0.85rem] m-0 mb-3">{error}</p> : (
        <div className="flex flex-col sm:flex-row gap-5">
          <div>
            <div onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }}
                 className="relative overflow-hidden bg-[#050505] border border-[#7ee06a]/50 cursor-move touch-none select-none"
                 style={{ width: VIEW, height: VIEW, maxWidth: "100%" }}>
              {img && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.src} alt="Your picture" draggable={false} className="absolute max-w-none pointer-events-none"
                     style={{ left: pos.x, top: pos.y, width: img.naturalWidth * scale, height: img.naturalHeight * scale }} />
              )}
            </div>
            <label className="flex items-center gap-3 mt-3 font-mono text-[0.7rem] text-[#8a8f98]">
              Zoom
              <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))}
                     className="flex-1 accent-[#7ee06a]" />
            </label>
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[0.62rem] uppercase tracking-widest text-[#5d636d] m-0 mb-2">At game size</p>
            <div className="flex items-end gap-3 mb-4">
              {[96, 58, 32].map((s) => (
                // eslint-disable-next-line @next/next/no-img-element
                small ? <img key={s} src={small} alt="" style={{ width: s, height: s }} className="border border-[#2a3038]" /> : null
              ))}
            </div>
            <p className="text-[0.82rem] text-[#9aa3ad] leading-relaxed m-0 mb-4">Drag the picture and zoom until your face sits in the middle. Staff look at it before anyone else can see it.</p>
            <div className="flex gap-3">
              <button type="button" disabled={busy} className="btn-submit" style={{ borderColor: GREEN, color: GREEN }}
                      onClick={() => canvas.current?.toBlob((b) => b && onDone(b), "image/png")}>
                {busy ? "Sending..." : "Send for approval"}
              </button>
              <button type="button" className="btn-logout" onClick={onCancel}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {error && <button type="button" className="btn-logout" onClick={onCancel}>Pick another</button>}
      <canvas ref={canvas} width={512} height={512} className="hidden" />
    </div>
  );
}

const STATUS: Record<string, { label: string; color: string; note: string }> = {
  pending: { label: "Waiting for approval", color: "#e0b54b", note: "Staff will look at it soon." },
  approved: { label: "Approved", color: GREEN, note: "It reaches the game after the next server restart." },
  rejected: { label: "Not approved", color: "#e05555", note: "" },
};

function Uploads({ me, busy, onPick, onWithdraw, onFile, pick }: {
  me: MyPortrait; busy: boolean; pick: string; onPick: (k: string) => void; onWithdraw: (id: number) => void; onFile: (f: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const wait = Math.ceil(me.upload_wait / 60);
  const blocked = me.upload_waiting || me.upload_wait > 0;
  return (
    <div>
      <div className="flex flex-wrap items-start gap-4 mb-5">
        <div className="min-w-0 flex-1" style={{ flexBasis: 280 }}>
          <h3 className="text-[0.95rem] text-[#e6e8ec] m-0 mb-1">Add your own</h3>
          <p className="text-[0.82rem] text-[#9aa3ad] leading-relaxed m-0 mb-3">PNG, JPEG or WEBP, up to 8 MB. Staff check every picture first. Once approved it reaches the game after the next server restart.</p>
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                 onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
          <button type="button" disabled={busy || blocked} className="btn-submit" onClick={() => input.current?.click()}>Choose a picture</button>
          {me.upload_waiting && <p className="font-mono text-[0.72rem] text-[#e0b54b] mt-2 mb-0">One of yours is waiting for approval.</p>}
          {!me.upload_waiting && me.upload_wait > 0 && <p className="font-mono text-[0.72rem] text-[#8a8f98] mt-2 mb-0">You can upload again in {wait} minutes.</p>}
        </div>
        <ul className="m-0 p-3 border border-[#1e2530] bg-[#0b0e12] text-[0.78rem] text-[#9aa3ad]" style={{ flexBasis: 260 }}>
          {me.rules.map((r) => <li key={r} className="mb-1">{r}</li>)}
        </ul>
      </div>
      {me.uploads.length > 0 && (
        <div className="flex flex-col gap-2">
          {me.uploads.map((u) => {
            const s = STATUS[u.status] || STATUS.pending;
            return (
              <div key={u.id} className="flex items-center gap-3 border border-[#1e2530] bg-[#0b0e12] p-2">
                {u.status === "rejected"
                  ? <div className="w-14 h-14 flex-shrink-0 bg-[#180f0f] border border-[#3a1f1f]" />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={`${API}/api/portraits/upload/${u.id}/image`} alt="Your upload" className="w-14 h-14 object-cover flex-shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[0.75rem]" style={{ color: s.color }}>{s.label}</div>
                  <div className="text-[0.78rem] text-[#9aa3ad]">{u.status === "rejected" ? u.reason : s.note}</div>
                </div>
                {u.status === "approved" && (
                  <button type="button" disabled={busy || pick === u.key} onClick={() => onPick(u.key)} className="btn-submit !py-1 !px-3 !text-[0.7rem]">
                    {pick === u.key ? "In use" : "Use"}
                  </button>
                )}
                {u.status !== "rejected" && (
                  <button type="button" disabled={busy} onClick={() => onWithdraw(u.id)} className="btn-logout !py-1 !px-3 !text-[0.7rem]">Delete</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PortraitPicker({ discordUrl }: { discordUrl: string }) {
  const [cat, setCat] = useState<Catalogue | null>(null);
  const [me, setMe] = useState<MyPortrait | null>(null);
  const [look, setLook] = useState("3d");
  const [group, setGroup] = useState("");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [failed, setFailed] = useState(false);

  const loadMe = useCallback(async () => {
    const r = await fetch(`${API}/api/portraits/me`, { credentials: "include", cache: "no-store" });
    if (r.ok) setMe(await r.json());
  }, []);

  useEffect(() => {
    fetch(`${API}/api/portraits`).then((r) => (r.ok ? r.json() : null)).then((c) => { if (c) setCat(c); else setFailed(true); }).catch(() => setFailed(true));
    loadMe().catch(() => setFailed(true));
  }, [loadMe]);

  const say = (text: string, ok: boolean) => {
    setNote({ text, ok });
    window.setTimeout(() => setNote(null), 4000);
  };

  const save = async (changes: Record<string, string>) => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/portraits/me`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { say(d.detail || "That didn't save. Try again.", false); return; }
      setMe((m) => (m ? { ...m, pick: d.pick, wanted: d.wanted, hall: d.hall, head: d.head } : m));
      setPreview(null);
      say("Saved. It shows in game in about a minute.", true);
    } catch { say("Connection error. Try again.", false); } finally { setBusy(false); }
  };

  const upload = async (b: Blob) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", b, "portrait.png");
      const r = await fetch(`${API}/api/portraits/upload`, { method: "POST", credentials: "include", body: form });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { say(d.detail || "That didn't send. Try again.", false); return; }
      setFile(null);
      say("Sent. Staff will look at it soon.", true);
      await loadMe();
    } catch { say("Connection error. Try again.", false); } finally { setBusy(false); }
  };

  const withdraw = async (id: number) => {
    setBusy(true);
    try {
      await fetch(`${API}/api/portraits/upload/${id}/withdraw`, { method: "POST", credentials: "include" });
      await loadMe();
    } finally { setBusy(false); }
  };

  const items = useMemo(() => (cat?.items || []).filter((t) => t.look === look), [cat, look]);
  const groups = useMemo(() => [...new Set(items.map((t) => t.group).filter(Boolean))], [items]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((t) => (!group || t.group === group) && (!q || `${t.name} ${t.desc} ${t.group}`.toLowerCase().includes(q)));
  }, [items, group, search]);

  if (failed) return <p className="text-[#e05555] text-[0.85rem]">The picker couldn&apos;t load. Try again in a minute.</p>;
  if (!cat || !me) return <p className="text-[#777] text-[0.85rem]">Opening your portraits...</p>;
  if (!me.linked) {
    return (
      <div className="border border-[#1e2530] bg-[#0b0e12] p-5">
        <p className="text-[#c8cdd6] mb-3">Your Discord isn&apos;t linked to a character yet, so there&apos;s nothing to put a portrait on.</p>
        <Link href="/whitelist" className="btn-submit no-underline inline-block">Get whitelisted</Link>
      </div>
    );
  }

  const current = preview ?? me.pick;
  const name = (() => {
    if (current === "") return "My 3D character";
    if (current === DISCORD) return "My Discord picture";
    return cat.items.find((t) => t.key === current)?.name || "My own picture";
  })();
  const currentUrl = pickUrl(current, discordUrl);
  const unsaved = current !== me.pick;
  const posterUrl = me.wanted === "hidden" ? "" : me.wanted === "portrait" && current !== "" && current !== DISCORD ? portraitUrl(current) : discordUrl;
  const looks = [...cat.looks, { id: "mine", name: "Mine" }];

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] items-start">
      <aside className="lg:sticky lg:top-20 flex flex-col gap-3">
        <div className="border border-[#1e2530] bg-[#0b0e12] p-4 text-center">
          <div className="inline-block p-1 border" style={{ borderColor: unsaved ? "#e0b54b" : "#2f6b3f" }}>
            <Picture url={currentUrl} size={200} label={name} />
          </div>
          <div className="text-[#e6e8ec] font-semibold mt-2">{name}</div>
          <div className="font-mono text-[0.66rem] uppercase tracking-widest mb-3" style={{ color: unsaved ? "#e0b54b" : "#5d6b62" }}>
            {unsaved ? "not saved yet" : "your picture now"}
          </div>
          <button type="button" disabled={!unsaved || busy} onClick={() => save({ key: current })}
                  className="w-full border-none rounded-[3px] py-2.5 font-mono text-[0.8rem] uppercase tracking-wider cursor-pointer disabled:cursor-default"
                  style={{ background: unsaved ? GREEN : "#161c18", color: unsaved ? "#07100a" : "#4d5a51" }}>
            {busy ? "Saving..." : "Use this picture"}
          </button>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {([["", "3D character"], [DISCORD, "Discord picture"]] as [string, string][]).map(([k, label]) => (
              <button key={label} type="button" onClick={() => setPreview(k)}
                      className="font-mono text-[0.68rem] py-1.5 bg-transparent border rounded-[3px] cursor-pointer"
                      style={{ borderColor: current === k ? GREEN : "#2a3038", color: current === k ? GREEN : "#9aa3ad" }}>{label}</button>
            ))}
          </div>
        </div>
        <BubbleSample url={currentUrl} name={me.name} />
        {note && <p role="status" className="font-mono text-[0.75rem] m-0" style={{ color: note.ok ? GREEN : "#e05555" }}>{note.text}</p>}
      </aside>

      <div className="min-w-0 flex flex-col gap-6">
        <section className="border border-[#1e2530] bg-[#0b0e12] p-4">
          <div className="flex flex-wrap gap-x-1 gap-y-1 border-b border-[#1e2530] mb-3" role="tablist">
            {looks.map((l) => (
              <button key={l.id} type="button" role="tab" aria-selected={look === l.id}
                      onClick={() => { setLook(l.id); setGroup(""); setSearch(""); }}
                      className="bg-transparent border-none border-b-2 px-3 py-2 font-mono text-[0.76rem] uppercase tracking-wider cursor-pointer"
                      style={{ color: look === l.id ? "#e6e8ec" : "#7c858f", borderBottom: `2px solid ${look === l.id ? GREEN : "transparent"}` }}>
                {l.name}
              </button>
            ))}
          </div>

          {look === "mine" ? (
            <>
              <Uploads me={me} busy={busy} pick={me.pick} onPick={(k) => save({ key: k })} onWithdraw={withdraw} onFile={setFile} />
              {file && <Cropper file={file} busy={busy} onCancel={() => setFile(null)} onDone={upload} />}
            </>
          ) : items.length === 0 ? (
            <p className="text-[#8a8f98] text-[0.88rem] py-8 text-center m-0">The pictures are on their way. In the meantime you can add your own under Mine.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search: gas mask, cat, medic..."
                       className="form-input !py-1.5 !text-[0.82rem] !max-w-[240px]" />
                <span className="font-mono text-[0.68rem] text-[#5d636d] ml-auto">{shown.length} pictures</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {["", ...groups].map((g) => (
                  <button key={g || "all"} type="button" onClick={() => setGroup(g)}
                          className="font-mono text-[0.68rem] px-2.5 py-1 rounded-full border cursor-pointer bg-transparent"
                          style={{ borderColor: group === g ? GREEN : "#2a3038", color: group === g ? GREEN : "#8a8f98" }}>{g || "All"}</button>
                ))}
              </div>
              {shown.length === 0 ? <p className="text-[#8a8f98] text-[0.85rem]">Nothing matches that.</p> : (
                <div className="grid gap-2 max-h-[400px] overflow-y-auto pr-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))" }}>
                  {shown.map((t) => {
                    const on = current === t.key, mine = me.pick === t.key;
                    return (
                      <button key={t.key} type="button" title={t.name} aria-pressed={on} onClick={() => setPreview(t.key)}
                              className="relative p-0 bg-[#10151a] border-2 cursor-pointer aspect-square overflow-hidden transition-transform hover:scale-[1.03]"
                              style={{ borderColor: on ? GREEN : "transparent", outline: mine && !on ? "1px solid #5d6b62" : "none" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={portraitUrl(t.key)} alt={t.name} loading="lazy" className="w-full h-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        <section className="border border-[#1e2530] bg-[#0b0e12] p-4">
          <h2 className="!text-[0.95rem] !tracking-[0.12em] m-0 mb-1">Your choice, everywhere else</h2>
          <p className="text-[0.82rem] text-[#8a8f98] m-0 mb-4">Chat and the leaderboards always use your Discord picture.</p>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <PosterSample url={posterUrl} name={me.name} />
            <div className="min-w-0 flex-1 flex flex-col gap-4">
              <div>
                <div className="text-[0.86rem] text-[#e6e8ec] mb-1">Wanted page</div>
                <Segment busy={busy} value={me.wanted} onPick={(v) => save({ wanted: v })}
                         options={[["discord", "Discord picture"], ["portrait", "My portrait"], ["hidden", "No picture"]]} />
              </div>
              <div>
                <div className="text-[0.86rem] text-[#e6e8ec] mb-1">Hall of Infamy</div>
                <Segment busy={busy} value={me.hall} onPick={(v) => save({ hall: v })}
                         options={[["discord", "Discord picture"], ["portrait", "My portrait"], ["hidden", "No picture"]]} />
              </div>
              <div>
                <div className="text-[0.86rem] text-[#e6e8ec] mb-1">Chat over heads <span className="text-[#6b7280]">(only changes what you see)</span></div>
                <Segment busy={busy} value={me.head} onPick={(v) => save({ head: v })}
                         options={[["bubbles", "Bubbles"], ["classic", "Classic text"]]} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
