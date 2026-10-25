// @ts-nocheck
"use client";
// app/safehouse/page.tsx - safehouse expansion tickets (2026-10-11, Nin: "they draw their own boundary of how big a boundary they want for
// their SH in our 3D map ... the price is calculated on tiles ... the link is sent in the ticket channel so admin can confirm").
//
//   /safehouse?t=TOKEN   the player's page (the link the bot posts in their private ticket channel): their safehouse on the map, they click
//                        two corners or nudge the four sides, the price shows as they go, "Send to the admins". An admin who opens the
//                        same link sees the drawn box (read only) and Approve / Edit price / Reject.
//   /safehouse           admins: the ticket list and the price / limit settings.
//   /safehouse?convert=N 2026-10-25 (mod 1.8.67, Nin: "they need admin ticket to convert ... admins will check and approve"): an application
//                        to make a safehouse the faction safehouse. The other side (the safehouse owner, or someone with the claim permission
//                        in the faction) confirms or declines here; the admins approve here or in the ticket channel. ONE WAY.
//                        The ticket page (?t=) has the FACTION SAFEHOUSE part where the ticket's player files it.
//
// A safehouse in Project Zomboid is a RECTANGLE (x, y, width, height). The price and the limits are the bot's (zombita_sh_pricing.py: a tile
// costs 1 + its row bronze, the biggest is 59 x 49); this page only asks /api/sh/quote and shows the answer.
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API } from "@/lib/constants";

const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

const C = { gold: "#c8a84b", blue: "#4a8fc4", green: "#4caf7d", red: "#e05555", purple: "#9775cc", grey: "#9aa", text: "#e6e6e6", bg: "#0b0d10", panel: "#111418", line: "#2a2f37" };
const mono = { fontFamily: "var(--mono, monospace)" };

const money = (b) => {
  b = Math.max(0, Math.round(Number(b) || 0));
  const s = Math.floor(b / 1000), r = b % 1000;                    // no gold (Nin 2026-10-13)
  const parts = [];
  if (s) parts.push(`${s.toLocaleString("en-US")} silver`);
  if (r || !parts.length) parts.push(`${r} bronze`);
  return parts.join(" ");
};
const thousands = (n) => Number(n || 0).toLocaleString("en-US");
const right = (r) => r.x + r.w - 1;
const bottom = (r) => r.y + r.h - 1;
const same = (a, b) => a && b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

function Btn({ children, onClick, color = C.gold, disabled = false, small = false, title = "", wide = false }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ ...mono, fontSize: small ? 11 : 13, padding: small ? "3px 8px" : "8px 12px", background: "transparent", color: disabled ? "#555" : color,
        border: `1px solid ${disabled ? "#333" : color}`, borderRadius: 3, cursor: disabled ? "default" : "pointer", textTransform: "uppercase", letterSpacing: 0.5,
        width: wide ? "100%" : undefined }}>
      {children}
    </button>
  );
}

async function call(path, body) {
  const r = await fetch(`${API}${path}`, { method: body ? "POST" : "GET", credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

export default function SafehousePage() {
  const [token, setToken] = useState(null);
  const [convertId, setConvertId] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setToken(q.get("t") || ""); setConvertId((q.get("convert") || "").replace(/[^0-9]/g, "")); setReady(true);
  }, []);
  if (!ready) return null;
  return (
    <div style={{ ...mono, background: C.bg, color: C.text, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "10px 16px", borderBottom: `1px solid ${C.line}`, display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
        <a href="/" style={{ color: C.grey, fontSize: 12, textDecoration: "none" }}>← site</a>
        <b style={{ color: C.gold, letterSpacing: 2, fontSize: 15 }}>SAFEHOUSE TICKET</b>
        <span style={{ color: C.grey, fontSize: 12 }}>{convertId ? "make a safehouse the faction safehouse" : "make your safehouse bigger, or make it your faction safehouse"}</span>
      </header>
      {convertId ? <ConvertPage id={convertId} /> : token ? <TicketPage token={token} /> : <AdminList />}
    </div>
  );
}

function Login({ why }) {
  return (
    <div style={{ padding: 40, maxWidth: 560 }}>
      <p style={{ lineHeight: 1.6 }}>{why}</p>
      <a href={`${API}/auth/discord/login`} style={{ color: "#5865F2", textDecoration: "none", fontSize: 14 }}>Log in with Discord →</a>
    </div>
  );
}

// ── the player's page (and an admin reading it) ─────────────────────────────────────────────────────────────────
function TicketPage({ token }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);                 // { status, text }
  const [sel, setSel] = useState(0);                    // which of their safehouses
  const [draft, setDraft] = useState(null);             // the new rectangle
  const [pick, setPick] = useState(null);               // { a: {x, y} | null } while clicking corners
  const [q, setQ] = useState(null);                     // the latest answer from /api/sh/quote
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [mode, setMode] = useState(null);               // "expand" | "convert" (2026-10-25: make it the faction safehouse)
  const [convFocus, setConvFocus] = useState(null);     // the safehouse picked in the FACTION SAFEHOUSE part
  const seq = useRef(0);

  const load = useCallback(async () => {
    const r = await call(`/api/sh/ticket?t=${encodeURIComponent(token)}`);
    if (r.status === 200 && r.data?.ok) { setData(r.data); setErr(null); }
    else setErr({ status: r.status, text: r.data?.detail || "Couldn't load the ticket." });
  }, [token]);
  useEffect(() => { load(); }, [load]);
  // while an admin is deciding / the game is applying, check back now and then so the page changes by itself
  const liveState = data?.ticket?.state;
  useEffect(() => {
    if (!["submitted", "applying"].includes(liveState)) return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [liveState, load]);

  const tk = data?.ticket;
  const isConvert = tk?.kind === "faction_convert";
  const viewMode = mode || (isConvert || (data && data.world_ok && !(data.mine || []).length) ? "convert" : "expand");
  const settings = data?.settings;
  const yours = data?.yours;
  const admin = data?.admin;
  const editable = yours && tk && ["new", "open", "returned", "submitted"].includes(tk.state);   // "returned": an admin sent it back to redraw
  const old = useMemo(() => {
    if (!data) return null;
    if (tk?.old && tk.state !== "new" && tk.state !== "open") return tk.old;
    const m = data.mine?.[sel] || data.mine?.[0];
    return m ? { x: m.x, y: m.y, w: m.w, h: m.h } : null;
  }, [data, sel, tk]);

  // start from what they sent before, or from their safehouse
  useEffect(() => {
    if (!data || !old) return;
    if (tk?.new && ["returned", "submitted", "applying", "done", "stuck", "failed", "rejected"].includes(tk.state) && !draft) setDraft(tk.new);
    else if (!draft || (tk && ["new", "open"].includes(tk.state) && !same(draft, old) && !contains(draft, old))) setDraft({ ...old });
  }, [data, old]);               // eslint-disable-line

  // the price, asked after the box stops moving
  useEffect(() => {
    if (!editable || !old || !draft) { setQ(null); return; }
    if (same(draft, old)) { setQ({ ok: false, reason: "Drag the edges out (or click two corners on the map)." }); return; }
    const my = ++seq.current;
    const timer = setTimeout(async () => {
      const r = await call("/api/sh/quote", { t: token, old, new: draft });
      if (my !== seq.current) return;
      if (r.status === 200 && r.data) setQ(r.data);
      else if (r.status === 429) setQ((c) => c);
      else setQ({ ok: false, reason: r.data?.detail || "Couldn't price it." });
    }, 350);
    return () => clearTimeout(timer);
  }, [draft, old, editable, token]);

  const onMapClick = useCallback((w) => {
    if (!pick || !old) return;
    const x = Math.floor(w.x), y = Math.floor(w.y);
    if (!pick.a) { setPick({ a: { x, y } }); return; }
    const x1 = Math.min(old.x, pick.a.x, x), y1 = Math.min(old.y, pick.a.y, y);
    const x2 = Math.max(right(old), pick.a.x, x), y2 = Math.max(bottom(old), pick.a.y, y);
    setDraft({ x: x1, y: y1, w: x2 - x1 + 1, h: y2 - y1 + 1 });
    setPick(null);
  }, [pick, old]);

  const side = (name, delta) => {
    if (!draft || !old) return;
    const d = { ...draft };
    if (name === "west") { const n = Math.max(0, old.x - d.x + delta); d.x = old.x - n; d.w = right(draft) - d.x + 1; }
    if (name === "east") { const n = Math.max(0, right(d) - right(old) + delta); d.w = right(old) + n - d.x + 1; }
    if (name === "north") { const n = Math.max(0, old.y - d.y + delta); d.y = old.y - n; d.h = bottom(draft) - d.y + 1; }
    if (name === "south") { const n = Math.max(0, bottom(d) - bottom(old) + delta); d.h = bottom(old) + n - d.y + 1; }
    setDraft(d);
  };
  const reach = (name) => !draft || !old ? 0 : name === "west" ? old.x - draft.x : name === "east" ? right(draft) - right(old) : name === "north" ? old.y - draft.y : bottom(draft) - bottom(old);

  const send = async () => {
    setBusy(true); setMsg("");
    const r = await call("/api/sh/submit", { t: token, old, new: draft });
    setBusy(false);
    if (r.data?.ok) { setMsg(r.data.msg || "Sent."); load(); }
    else setMsg(r.data?.reason || r.data?.detail || "Couldn't send it.");
  };
  const cancel = async () => {
    if (!confirm("Close this ticket? It ends here and the expansion price isn't charged. You'll need a new Admin Ticket to try again.")) return;
    const r = await call("/api/sh/cancel", { t: token });
    setMsg(r.data?.msg || ""); load();
  };

  const rects = useMemo(() => {
    const out = [];
    for (let i = 0; i < (data?.others || []).length; i++) {
      const o = data.others[i];
      out.push({ id: `o${i}`, x: o.x, y: o.y, w: o.w, h: o.h, color: "#a05050", fill: "rgba(224,85,85,.10)" });
    }
    if (old) out.push({ id: "old", x: old.x, y: old.y, w: old.w, h: old.h, color: C.gold, fill: "rgba(200,168,75,.18)", label: "your safehouse now" });
    if (draft && old && !same(draft, old)) {
      const ok = q?.ok !== false;
      out.push({ id: "draft", x: draft.x, y: draft.y, w: draft.w, h: draft.h, color: ok ? C.green : C.red, dashed: true,
        fill: ok ? "rgba(76,175,125,.12)" : "rgba(224,85,85,.12)", label: `${draft.w} x ${draft.h}` });
    }
    if (pick?.a) out.push({ id: "corner", x: pick.a.x, y: pick.a.y, w: 1, h: 1, color: C.purple, fill: "rgba(151,117,204,.5)" });
    return out;
  }, [data, old, draft, q, pick]);
  const convRect = viewMode === "convert" ? (convFocus || (isConvert && tk?.convert?.rect?.w ? tk.convert.rect : null)) : null;
  const shownRects = useMemo(() => {
    if (!convRect) return viewMode === "convert" ? (data?.others || []).map((o, i) => ({ id: `o${i}`, ...o, color: "#a05050", fill: "rgba(224,85,85,.10)" })) : rects;
    return [...(data?.others || []).filter((o) => !same(o, convRect)).map((o, i) => ({ id: `o${i}`, x: o.x, y: o.y, w: o.w, h: o.h, color: "#a05050", fill: "rgba(224,85,85,.10)" })),
      { id: "conv", x: convRect.x, y: convRect.y, w: convRect.w, h: convRect.h, color: C.purple, fill: "rgba(151,117,204,.18)", label: `${convRect.w} x ${convRect.h}` }];
  }, [rects, convRect, viewMode, data]);
  const focus = useMemo(() => {
    const r = convRect || old;
    return r ? { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2), z: 1 } : null;
  }, [old && old.x, old && old.y, convRect && convRect.x, convRect && convRect.y]);

  if (err) {
    if (err.status === 401) return <Login why="Log in with the same Discord account you bought the Admin Ticket with." />;
    return <div style={{ padding: 40, color: C.red }}>{err.text}</div>;
  }
  if (!data) return <div style={{ padding: 40, color: C.grey }}>Loading your ticket…</div>;

  const state = tk.state;
  const stateText = {
    new: "Your ticket is open. Draw the new box below.", open: "Your ticket is open. Draw the new box below.",
    submitted: yours ? "Sent. The admins will look at it in your ticket channel. You can still change the box and send it again until they decide." : "Waiting for an admin.",
    returned: `Sent back${tk.decided_by ? " by " + tk.decided_by : ""}${tk.note ? ": " + tk.note : ""}. Change the box and send it again. Nothing was charged.`,
    applying: "Approved. The new boundary is being applied in the game…", done: "Done. Your safehouse has its new size. Log out and back in (restart the game) to see your new zone.",
    failed: "The game couldn't apply it. Anything that was taken was given back.", stuck: "The game hasn't confirmed yet. An admin is checking.",
    rejected: `Rejected${tk.decided_by ? " by " + tk.decided_by : ""}${tk.note ? ": " + tk.note : ""}. The expansion price was not charged.`, cancelled: `Closed${tk.note ? " (" + tk.note + ")" : ""}. The expansion price was not charged.`,
  }[state] || state;

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", height: "calc(100vh - 46px)" }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", cursor: pick ? "crosshair" : "default" }}>
        {pick && <div style={{ ...mono, fontSize: 12, padding: "6px 14px", background: "#2a2410", color: C.gold }}>
          {pick.a ? "Now click the opposite corner of the area you want." : "Click one corner of the area you want. (Your safehouse is always included.)"}
          {" "}<Btn small onClick={() => setPick(null)}>Cancel</Btn></div>}
        {!data.world_ok && <div style={{ ...mono, fontSize: 12, padding: "6px 14px", background: "#2a1414", color: "#f3b0b0" }}>{data.world_error}</div>}
        <WorldMap rects={shownRects} focus={focus} onMapClick={onMapClick} />
      </div>
      <aside style={{ width: 380, maxWidth: "46vw", overflowY: "auto", borderLeft: `1px solid ${C.line}`, background: C.panel, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12, color: C.grey }}>Ticket #{tk.id} for <b style={{ color: C.text }}>{data.owner}</b></div>
        {!admin || yours ? null : <div style={{ fontSize: 11, color: C.purple }}>You're looking at this as an admin.</div>}
        {(yours ? ["new", "open", "returned", "confirming", "submitted"].includes(state) : false) && (
          <div style={{ display: "flex", gap: 6 }}>
            <Btn small color={viewMode === "expand" ? C.gold : C.grey} onClick={() => setMode("expand")}>Make it bigger</Btn>
            <Btn small color={viewMode === "convert" ? C.purple : C.grey} onClick={() => setMode("convert")}>Faction safehouse</Btn>
          </div>)}
        {viewMode === "convert" ? (
          <ConvertPanel token={token} tk={tk} yours={yours} admin={admin} reload={load} onFocus={setConvFocus} />
        ) : (<>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: state === "rejected" || state === "failed" ? C.red : state === "returned" ? C.gold : state === "done" ? C.green : C.text }}>{stateText}</div>

        {!old && data.world_ok && <div style={{ color: C.red, fontSize: 13 }}>The game doesn't list a safehouse for {data.owner}. You need a safehouse before you can grow one.</div>}

        {old && (<>
          {data.mine.length > 1 && editable && (
            <label style={{ fontSize: 12 }}>Which safehouse
              <select value={sel} onChange={(e) => { setSel(Number(e.target.value)); setDraft(null); }}
                style={{ ...mono, width: "100%", marginTop: 4, background: C.bg, color: C.text, border: `1px solid ${C.line}`, padding: 6 }}>
                {data.mine.map((m, i) => <option key={i} value={i}>{m.title || "Safehouse"} - {m.w} x {m.h} at {m.x},{m.y}</option>)}
              </select>
            </label>)}
          <div style={{ fontSize: 12, color: C.grey }}>Now: <b style={{ color: C.gold }}>{old.w} x {old.h}</b> at {old.x},{old.y} ({thousands(old.w * old.h)} tiles)</div>

          {editable && (<>
            <Btn onClick={() => setPick({ a: null })} wide>Click two corners on the map</Btn>
            <div style={{ fontSize: 11, color: C.grey }}>Or add tiles to each side (the map follows):</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[["north", "North (up)"], ["south", "South (down)"], ["west", "West (left)"], ["east", "East (right)"]].map(([k, l]) => (
                <div key={k} style={{ border: `1px solid ${C.line}`, borderRadius: 3, padding: 6 }}>
                  <div style={{ fontSize: 10, color: C.grey, textTransform: "uppercase" }}>{l}</div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 4 }}>
                    <Btn small onClick={() => side(k, -5)}>-5</Btn><Btn small onClick={() => side(k, -1)}>-</Btn>
                    <b style={{ minWidth: 28, textAlign: "center", fontSize: 14 }}>{reach(k)}</b>
                    <Btn small onClick={() => side(k, 1)}>+</Btn><Btn small onClick={() => side(k, 5)}>+5</Btn>
                  </div>
                </div>))}
            </div>
            <Btn small color={C.grey} onClick={() => setDraft({ ...old })}>Start again</Btn>
          </>)}

          {draft && !same(draft, old) && (
            <div style={{ border: `1px solid ${q?.ok === false ? C.red : C.green}`, borderRadius: 3, padding: 10 }}>
              <div style={{ fontSize: 12, color: C.grey }}>New size</div>
              <div style={{ fontSize: 18, color: q?.ok === false ? C.red : C.green }}><b>{draft.w} x {draft.h}</b> <span style={{ fontSize: 12, color: C.grey }}>at {draft.x},{draft.y}</span></div>
              {editable && q?.ok === false && <div style={{ color: C.red, fontSize: 12, marginTop: 6 }}>{q.reason}</div>}
              {editable && q?.ok && (<>
                <div style={{ fontSize: 12, color: C.grey, marginTop: 8 }}>{thousands(q.quote.tiles)} new tiles, up to {q.quote.deepest} rows out</div>
                <div style={{ fontSize: 20, color: C.gold, marginTop: 4 }}><b>{q.quote.money}</b></div>
                <div style={{ fontSize: 11, color: C.grey }}>({thousands(q.quote.price)} bronze). Taken from your wallet only when an admin approves.</div>
              </>)}
              {!editable && tk.quote > 0 && <div style={{ marginTop: 8, fontSize: 16, color: C.gold }}><b>{money(tk.price)}</b>
                {tk.price !== tk.quote && <span style={{ fontSize: 11, color: C.grey }}> (computed {money(tk.quote)}, an admin changed it)</span>}</div>}
            </div>)}

          {editable && <Btn disabled={busy || !q?.ok} color={C.green} onClick={send} wide>{state === "submitted" ? "Send the new box to the admins" : "Send to the admins"}</Btn>}
          {msg && <div style={{ fontSize: 12, color: C.gold }}>{msg}</div>}
          {editable && <Btn small color={C.grey} onClick={cancel}>Close this ticket</Btn>}
        </>)}

        {admin && !yours && ["submitted", "stuck"].includes(state) && <AdminDecision tk={tk} done={load} />}

        <div style={{ fontSize: 11, color: C.grey, lineHeight: 1.6, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
          <b style={{ color: C.text }}>How it works.</b> A new tile next to your safehouse costs {settings.base + settings.step} bronze, and every row further out costs {settings.step} bronze more per tile.
          The biggest safehouse is {settings.max_long} x {settings.max_short} tiles (either way round), and it can't touch another safehouse (red boxes).
          After an approved expansion the next ticket waits {settings.cooldown_days} day{settings.cooldown_days === 1 ? "" : "s"}.
        </div>
        </>)}
        {admin && !yours && !["approving", "applying", "stuck"].includes(state) && <AdminClose tk={tk} done={load} />}
      </aside>
    </div>
  );
}

function contains(outer, inner) {
  return outer.x <= inner.x && outer.y <= inner.y && right(outer) >= right(inner) && bottom(outer) >= bottom(inner);
}

// ── the admins' decision ────────────────────────────────────────────────────────────────────────────────────────
function AdminDecision({ tk, done }) {
  const [price, setPrice] = useState(String(tk.price ?? 0));
  const [out, setOut] = useState("");
  useEffect(() => { setPrice(String(tk.price ?? 0)); }, [tk.price]);
  const cmd = async (c, extra = {}) => {
    const r = await call("/api/admin/sh/cmd", { cmd: c, id: tk.id, ...extra });
    setOut(r.data?.msg || r.data?.detail || "");
    done();
  };
  return (
    <div style={{ border: `1px solid ${C.purple}`, borderRadius: 3, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <b style={{ color: C.purple, fontSize: 12, textTransform: "uppercase" }}>Admin</b>
      {tk.state === "submitted" && (<>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input value={price} onChange={(e) => setPrice(e.target.value)} style={{ ...mono, width: 110, background: C.bg, color: C.text, border: `1px solid ${C.line}`, padding: 6 }} />
          <span style={{ fontSize: 11, color: C.grey }}>bronze = {money(price)}</span>
          <Btn small onClick={() => cmd("price", { price: String(price).trim() === "" ? "" : Number(price) })}>Set price</Btn>
        </div>
        <Btn color={C.green} onClick={() => { if (confirm(`Take ${money(tk.price)} from ${tk.username} and resize the safehouse?`)) cmd("approve", { submitted_at: tk.submitted_at }); }} wide>Approve and take {money(tk.price)}</Btn>
        <Btn color={C.red} onClick={() => { const why = prompt("What should they change? (the player sees this; they redraw and send again)", ""); if (why !== null) cmd("reject", { reason: why }); }} wide>Send back to redraw</Btn>
      </>)}
      {tk.state === "stuck" && (<>
        <div style={{ fontSize: 11, color: C.grey }}>The game hasn't confirmed. Check Live Ops: did the safehouse change?</div>
        <Btn color={C.red} onClick={() => cmd("refund")} wide>It did NOT change: refund</Btn>
        <Btn color={C.green} onClick={() => cmd("done")} wide>It DID change: mark done</Btn>
      </>)}
      {out && <div style={{ fontSize: 12, color: C.gold }}>{out}</div>}
    </div>
  );
}

// ── an admin's Close: the ticket ends and its Discord channel is deleted (a player's close keeps the channel) ─────────────────
function AdminClose({ tk, done }) {
  const [out, setOut] = useState("");
  const go = async () => {
    if (!confirm(`Close ticket #${tk.id} for ${tk.username}? It ends here and its Discord channel is deleted.`)) return;
    const r = await call("/api/admin/sh/cmd", { cmd: "close", id: tk.id });
    setOut(r.data?.msg || r.data?.detail || "");
    done();
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Btn small color={C.grey} onClick={go}>Close ticket (deletes its channel)</Btn>
      {out && <div style={{ fontSize: 12, color: C.gold }}>{out}</div>}
    </div>
  );
}

// ── /safehouse with no ticket: the admins' list and settings ────────────────────────────────────────────────────
function AdminList() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState("open");
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const states = filter === "open" ? "new,open,returned,confirming,submitted,approving,applying,stuck" : "";
    const r = await call(`/api/admin/sh/tickets${states ? `?state=${states}` : ""}`);
    if (r.status === 200 && r.data?.ok) { setD(r.data); setForm(r.data.settings); setErr(null); }
    else setErr(r.status);
  }, [filter]);
  useEffect(() => { load(); }, [load]);
  if (err === 401) return <Login why="This page lists every safehouse ticket for the admins. Log in with Discord." />;
  if (err === 403) return <div style={{ padding: 40, color: C.red }}>Admins only. If you bought an Admin Ticket, open the link from your private ticket channel on Discord.</div>;
  if (err) return <div style={{ padding: 40, color: C.red }}>Couldn't load the tickets.</div>;
  if (!d) return <div style={{ padding: 40, color: C.grey }}>Loading…</div>;
  const save = async () => {
    const r = await call("/api/admin/sh/cmd", { cmd: "settings", settings: form });
    setMsg(r.data?.msg || ""); load();
  };
  const fields = [["base", "Base (bronze per tile)"], ["step", "Step (more per row out)"], ["max_long", "Longest side"], ["max_short", "Shorter side"],
    ["cooldown_days", "Days between expansions"], ["ticket_price", "Ticket price (info)"]];
  return (
    <div style={{ padding: 20, maxWidth: 1000 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Btn small color={filter === "open" ? C.gold : C.grey} onClick={() => setFilter("open")}>Open tickets</Btn>
        <Btn small color={filter === "all" ? C.gold : C.grey} onClick={() => setFilter("all")}>All</Btn>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr style={{ color: C.grey, textAlign: "left" }}><th>#</th><th>Player</th><th>Kind</th><th>State</th><th>Size</th><th>Price</th><th></th></tr></thead>
        <tbody>
          {d.tickets.length === 0 && <tr><td colSpan={7} style={{ padding: 14, color: C.grey }}>No tickets.</td></tr>}
          {d.tickets.map((t) => (
            <tr key={t.id} style={{ borderTop: `1px solid ${C.line}` }}>
              <td style={{ padding: 6 }}>{t.id}</td><td>{t.username}</td>
              <td style={{ color: t.kind === "faction_convert" ? C.purple : C.grey }}>{t.kind === "faction_convert" ? `faction: ${t.convert?.faction || "?"}` : "bigger"}</td>
              <td style={{ color: t.state === "submitted" ? C.gold : t.state === "stuck" ? C.red : C.text }}>{t.state}{t.kind === "faction_convert" && t.state === "confirming" ? ` (waits for ${t.convert?.waits_for === "owner" ? "the owner" : "the faction"})` : ""}</td>
              <td>{t.new ? `${t.new.w} x ${t.new.h}` : "-"}</td><td>{t.kind === "faction_convert" ? "free" : t.new ? money(t.price) : "-"}</td>
              <td><a href={t.kind === "faction_convert" && t.convert?.owner ? `/safehouse?convert=${t.id}` : `/safehouse?t=${t.token}`} style={{ color: C.gold }}>open</a></td>
            </tr>))}
        </tbody>
      </table>
      <div style={{ marginTop: 28, border: `1px solid ${C.line}`, borderRadius: 3, padding: 14 }}>
        <b style={{ color: C.gold, fontSize: 12, textTransform: "uppercase" }}>Prices and limits</b>
        <div style={{ fontSize: 11, color: C.grey, margin: "6px 0 10px" }}>A tile costs base + step x (its row). Rows are counted outward from the current safehouse.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
          {fields.map(([k, l]) => (
            <label key={k} style={{ fontSize: 11, color: C.grey }}>{l}
              <input value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                style={{ ...mono, width: "100%", marginTop: 4, boxSizing: "border-box", background: C.bg, color: C.text, border: `1px solid ${C.line}`, padding: 6 }} />
            </label>))}
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}><Btn onClick={save}>Save settings</Btn><span style={{ fontSize: 12, color: C.gold }}>{msg}</span></div>
      </div>
    </div>
  );
}

// ── 2026-10-25 (mod 1.8.67): make a safehouse the faction safehouse. ONE WAY. ───────────────────────────────────────
// The ticket's player (the safehouse owner, or someone with the claim permission in the faction) files it on their ticket page; the
// OTHER side confirms on /safehouse?convert=N within 3 days (the same person = one confirmation); then an admin approves.
const when = (ts) => (Number(ts) > 0 ? new Date(Number(ts) * 1000).toLocaleString() : "not yet");
const sideText = (side) => (side === "owner" ? "the safehouse owner" : "the faction (the leader or anyone with the claim permission)");

function OneWayNote() {
  return (
    <div style={{ fontSize: 12, lineHeight: 1.6, color: C.text, border: `1px solid ${C.purple}`, borderRadius: 3, padding: 10, background: "#14101c" }}>
      <b style={{ color: C.purple }}>What happens.</b> The safehouse becomes your faction&apos;s safehouse <b>exactly as it is</b>: same ground, same size,
      everything inside stays. It is free (the Admin Ticket is the only cost) and the faction&apos;s leader becomes its owner, with every member on it.
      <div style={{ color: C.red, marginTop: 6 }}><b>It is one way.</b> A faction safehouse can&apos;t be turned back into a normal safehouse. If the faction
        releases it later, it is gone like any faction claim.</div>
    </div>
  );
}

function LoseList({ lose, faction }) {
  if (!lose || !lose.length) return <div style={{ fontSize: 12, color: C.green }}>Nobody loses access: everyone on it is in {faction || "the faction"}.</div>;
  return <div style={{ fontSize: 12, color: C.red }}>These players are on the safehouse but not in {faction || "the faction"}, so they <b>lose access</b>: {lose.join(", ")}.</div>;
}

function ConvertSummary({ cv, state }) {
  const r = cv.rect || {};
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, lineHeight: 1.5 }}>
      <div><span style={{ color: C.grey }}>Safehouse:</span> <b>{cv.owner}</b>&apos;s, {r.w} x {r.h} at {r.x},{r.y} ({thousands(r.w * r.h)} tiles){cv.title ? ` "${cv.title}"` : ""}</div>
      <div><span style={{ color: C.grey }}>Becomes the safehouse of:</span> <b style={{ color: C.purple }}>{cv.faction}</b> (leader {cv.leader || "?"})</div>
      <div><span style={{ color: C.grey }}>Owner side:</span> {cv.owner_ok_at ? <span style={{ color: C.green }}>{cv.owner_ok_by} said yes, {when(cv.owner_ok_at)}</span> : <span style={{ color: C.gold }}>{cv.owner} has not confirmed yet</span>}</div>
      <div><span style={{ color: C.grey }}>Faction side:</span> {cv.leader_ok_at ? <span style={{ color: C.green }}>{cv.leader_ok_by} said yes, {when(cv.leader_ok_at)}</span> : <span style={{ color: C.gold }}>nobody with the claim permission has confirmed yet</span>}</div>
      {state === "confirming" && cv.confirm_by ? <div style={{ color: C.grey }}>Waiting for {sideText(cv.waits_for)} until {when(cv.confirm_by)}. Not confirmed by then: it closes and the ticket price comes back.</div> : null}
      <LoseList lose={cv.lose} faction={cv.faction} />
      {cv.overlap && <div style={{ color: C.grey }}>Overlap check: {cv.overlap}</div>}
    </div>
  );
}

const CONVERT_STATE = {
  confirming: "Filed. Waiting for the other side to confirm.", submitted: "Both sides said yes. Waiting for an admin.",
  approving: "An admin is approving it…", applying: "Approved. The game is making it the faction safehouse…",
  done: "Done. It is the faction safehouse now (one way). Log out and back in to see the new owner and title.",
  failed: "The game didn't convert it. Nothing changed, and the ticket price was given back.",
  stuck: "The game hasn't confirmed yet. An admin is checking.", returned: "An admin sent it back. Pick the safehouse and file it again.",
  cancelled: "Closed. Nothing changed in the game.",
};

// the ticket page's FACTION SAFEHOUSE part
function ConvertPanel({ token, tk, yours, admin, reload, onFocus }) {
  const [d, setD] = useState(null);
  const [sel, setSel] = useState(-1);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const filed = tk.kind === "faction_convert" && tk.convert && tk.convert.owner;
  const canFile = yours && ["new", "open", "returned", "confirming", "submitted"].includes(tk.state);
  const load = useCallback(async () => {
    if (!yours) return;
    const r = await call(`/api/sh/convert/options?t=${encodeURIComponent(token)}`);
    setD(r.status === 200 && r.data ? r.data : { options: [], why: r.data?.detail || "Couldn't load your safehouses." });
  }, [token, yours]);
  useEffect(() => { load(); }, [load]);
  const opt = d && sel >= 0 ? d.options[sel] : null;
  useEffect(() => { onFocus(opt ? { x: opt.x, y: opt.y, w: opt.w, h: opt.h } : null); }, [opt && opt.x, opt && opt.y, opt && opt.w, opt && opt.h]);   // eslint-disable-line
  const file = async () => {
    if (!opt) return;
    const lose = opt.lose && opt.lose.length ? `\n\nThese players are not in ${opt.faction} and lose access: ${opt.lose.join(", ")}.` : "";
    if (!confirm(`Make ${opt.owner}'s safehouse (${opt.w} x ${opt.h} at ${opt.x},${opt.y}) the faction safehouse of ${opt.faction}?\n\n`
      + `The exact rectangle is kept and it is free. ONE WAY: it can't be turned back into a normal safehouse.${lose}`)) return;
    setBusy(true); setMsg("");
    const r = await call("/api/sh/convert/submit", { t: token, x: opt.x, y: opt.y, w: opt.w, h: opt.h, owner: opt.owner, fid: opt.fid });
    setBusy(false);
    setMsg(r.data?.msg || r.data?.reason || r.data?.detail || "Couldn't file it.");
    if (r.data?.ok) { setSel(-1); setSure(false); reload(); }
  };
  const cancel = async () => {
    if (!confirm("Close this ticket? It ends here. You get the ticket price back.")) return;
    const r = await call("/api/sh/cancel", { t: token });
    setMsg(r.data?.msg || ""); reload();
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <b style={{ color: C.purple, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Make a safehouse our faction safehouse</b>
      {filed && (
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 3, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 13, color: tk.state === "failed" ? C.red : tk.state === "done" ? C.green : C.text }}>{CONVERT_STATE[tk.state] || tk.state}{tk.note && ["returned", "cancelled", "failed"].includes(tk.state) ? ` (${tk.note})` : ""}</div>
          <ConvertSummary cv={tk.convert} state={tk.state} />
          {tk.state === "confirming" && <div style={{ fontSize: 12, color: C.gold }}>Send this link to {tk.convert.waits_for === "owner" ? tk.convert.owner : "your faction's leader (or anyone with the claim permission)"}: <a href={`/safehouse?convert=${tk.id}`} style={{ color: C.gold }}>/safehouse?convert={tk.id}</a>. They log in and press Confirm. It is in the ticket channel too.</div>}
        </div>)}
      {admin && !yours && filed && <ConvertAdmin tk={tk} done={reload} />}
      {canFile && (<>
        <OneWayNote />
        {!d && <div style={{ fontSize: 12, color: C.grey }}>Loading your faction&apos;s safehouses…</div>}
        {d && !d.options.length && <div style={{ fontSize: 12, color: C.red }}>{d.why}</div>}
        {d && d.options.map((o, i) => (
          <button key={i} onClick={() => { setSel(i); setSure(false); }}
            style={{ ...mono, textAlign: "left", fontSize: 12, padding: 8, background: sel === i ? "#1a1424" : C.bg, color: C.text,
              border: `1px solid ${sel === i ? C.purple : C.line}`, borderRadius: 3, cursor: "pointer" }}>
            <div><b>{o.owner}</b>&apos;s safehouse{o.title ? ` "${o.title}"` : ""}: {o.w} x {o.h} at {o.x},{o.y}</div>
            <div style={{ color: C.grey }}>for {o.faction} · {o.side === "both" ? "you own it and may claim: one confirmation is enough" : o.side === "owner" ? "you own it: the faction confirms" : `you claim for the faction: ${o.owner} confirms`}</div>
            {!o.ok && <div style={{ color: C.red }}>{o.why}</div>}
          </button>))}
        {opt && (
          <div style={{ border: `1px solid ${opt.ok ? C.purple : C.red}`, borderRadius: 3, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12 }}>Kept exactly: <b>{opt.w} x {opt.h}</b> at {opt.x},{opt.y} ({thousands(opt.w * opt.h)} tiles). New owner: {opt.leader || "the faction's leader"}.</div>
            <LoseList lose={opt.lose} faction={opt.faction} />
            {opt.waits_for ? <div style={{ fontSize: 12, color: C.gold }}>{opt.waits_for} has to confirm it on the website within {d.confirm_days || 3} days. Then an admin checks it.</div>
              : <div style={{ fontSize: 12, color: C.grey }}>No one else has to confirm. An admin checks it next.</div>}
            {opt.ok && <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "flex-start" }}>
              <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} />
              <span>I understand this is one way: it can&apos;t be turned back into a normal safehouse.</span></label>}
            <Btn color={C.purple} disabled={busy || !opt.ok || !sure} onClick={file} wide>{filed ? "File this one instead" : "File it"}</Btn>
          </div>)}
        {msg && <div style={{ fontSize: 12, color: C.gold }}>{msg}</div>}
        <Btn small color={C.grey} onClick={cancel}>Close this ticket</Btn>
      </>)}
    </div>
  );
}

// the admins' decision on a conversion
function ConvertAdmin({ tk, done }) {
  const [out, setOut] = useState("");
  const cv = tk.convert || {};
  const both = cv.owner_ok_at > 0 && cv.leader_ok_at > 0;
  const cmd = async (c, extra = {}) => {
    const r = await call("/api/admin/sh/cmd", { cmd: c, id: tk.id, ...extra });
    setOut(r.data?.msg || r.data?.detail || "");
    done();
  };
  const approve = () => {
    const lose = cv.lose && cv.lose.length ? `\n\nThey lose access: ${cv.lose.join(", ")}.` : "";
    if (confirm(`Make ${cv.owner}'s safehouse (${cv.rect?.w} x ${cv.rect?.h} at ${cv.rect?.x},${cv.rect?.y}) the faction safehouse of ${cv.faction}?\n\nOne way. Everything is checked again first.${lose}`)) cmd("approve", { submitted_at: tk.submitted_at });
  };
  return (
    <div style={{ border: `1px solid ${C.purple}`, borderRadius: 3, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <b style={{ color: C.purple, fontSize: 12, textTransform: "uppercase" }}>Admin</b>
      {["confirming", "submitted"].includes(tk.state) && (<>
        <Btn color={C.green} disabled={tk.state !== "submitted" || !both} title={both ? "" : "Both sides have to confirm first"} onClick={approve} wide>Approve (one way)</Btn>
        {!both && <div style={{ fontSize: 11, color: C.grey }}>Approve unlocks when both the owner side and the faction side have said yes.</div>}
        <Btn color={C.red} onClick={() => { const why = prompt("Why? (the player sees this; they can file again)", ""); if (why !== null) cmd("reject", { reason: why }); }} wide>Send back</Btn>
      </>)}
      {tk.state === "stuck" && (<>
        <div style={{ fontSize: 11, color: C.grey }}>The game hasn&apos;t confirmed. Check Live Ops: is it the faction safehouse now?</div>
        <Btn color={C.red} onClick={() => cmd("refund")} wide>It is NOT: take the claim back, refund the ticket</Btn>
        <Btn color={C.green} onClick={() => cmd("done")} wide>It IS: mark done</Btn>
      </>)}
      {out && <div style={{ fontSize: 12, color: C.gold }}>{out}</div>}
    </div>
  );
}

// /safehouse?convert=N: the other side confirms here; the admins decide here
function ConvertPage({ id }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await call(`/api/sh/convert?id=${encodeURIComponent(id)}`);
    if (r.status === 200 && r.data?.ok) { setD(r.data); setErr(null); }
    else setErr({ status: r.status, text: r.data?.detail || "Couldn't load the application." });
  }, [id]);
  useEffect(() => { load(); }, [load]);
  const tk = d?.ticket;
  const cv = tk?.convert || {};
  const r = cv.rect;
  const rects = useMemo(() => (r && r.w ? [{ id: "conv", x: r.x, y: r.y, w: r.w, h: r.h, color: C.purple, fill: "rgba(151,117,204,.18)", label: `${r.w} x ${r.h}` }] : []), [r && r.x, r && r.y, r && r.w, r && r.h]);
  const focus = useMemo(() => (r && r.w ? { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2), z: 1 } : null), [r && r.x, r && r.y]);
  if (err) {
    if (err.status === 401) return <Login why="Log in with Discord to see this application (the account linked to your in-game name)." />;
    return <div style={{ padding: 40, color: C.red }}>{err.text}</div>;
  }
  if (!d) return <div style={{ padding: 40, color: C.grey }}>Loading the application…</div>;
  const answer = async (yes) => {
    const text = yes
      ? `Confirm: make ${cv.owner}'s safehouse (${r.w} x ${r.h} at ${r.x},${r.y}) the faction safehouse of ${cv.faction}?\n\nOne way: it can't be turned back.${cv.lose?.length ? `\n\nThey lose access: ${cv.lose.join(", ")}.` : ""}`
      : `Decline? The application closes and ${tk.username} gets the ticket price back.`;
    if (!confirm(text)) return;
    setBusy(true);
    const res = await call("/api/sh/convert/answer", { id: tk.id, yes });
    setBusy(false);
    setMsg(res.data?.msg || res.data?.detail || "");
    load();
  };
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", height: "calc(100vh - 46px)", flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 280, minHeight: 300, display: "flex", flexDirection: "column" }}>
        <WorldMap rects={rects} focus={focus} onMapClick={() => {}} />
      </div>
      <aside style={{ width: 400, maxWidth: "100%", overflowY: "auto", borderLeft: `1px solid ${C.line}`, background: C.panel, padding: 14, display: "flex", flexDirection: "column", gap: 12, boxSizing: "border-box" }}>
        <div style={{ fontSize: 12, color: C.grey }}>Application #{tk.id}, filed by <b style={{ color: C.text }}>{tk.username}</b>{d.me ? <> · you are {d.me}</> : null}</div>
        <b style={{ color: C.purple, letterSpacing: 1, fontSize: 13 }}>MAKE A SAFEHOUSE THE FACTION SAFEHOUSE</b>
        <div style={{ fontSize: 13, color: tk.state === "failed" ? C.red : tk.state === "done" ? C.green : C.text }}>{CONVERT_STATE[tk.state] || tk.state}{tk.note && ["returned", "cancelled", "failed"].includes(tk.state) ? ` (${tk.note})` : ""}</div>
        <ConvertSummary cv={cv} state={tk.state} />
        <OneWayNote />
        {d.can_answer && (
          <div style={{ border: `1px solid ${C.gold}`, borderRadius: 3, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12 }}>You can answer for {sideText(d.side)}.</div>
            <Btn color={C.green} disabled={busy} onClick={() => answer(true)} wide>Confirm</Btn>
            <Btn color={C.red} disabled={busy} onClick={() => answer(false)} wide>Decline</Btn>
          </div>)}
        {!d.can_answer && tk.state === "confirming" && !d.admin && <div style={{ fontSize: 12, color: C.grey }}>Waiting for {sideText(cv.waits_for)}. {d.yours ? "Send them this page's link." : "You can't answer this one."}</div>}
        {msg && <div style={{ fontSize: 12, color: C.gold }}>{msg}</div>}
        {d.admin && <ConvertAdmin tk={tk} done={load} />}
        {d.admin && !["approving", "applying", "stuck"].includes(tk.state) && <AdminClose tk={tk} done={load} />}
      </aside>
    </div>
  );
}
