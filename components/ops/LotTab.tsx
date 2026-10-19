// @ts-nocheck
"use client";
// components/ops/LotTab.tsx - Live Ops > Zombita > LOT & PEN (2026-10-11, mod 1.7.167 ZS_Lot_Server.lua, bot zombita_lot.py / routers/lot.py).
// Duke's cars (admins add a vehicle id + price; a sale spawns that car on the lot) and Hattie's animals (prices, off sale), plus where
// the lot and the pen are and how big. The game keeps the lists; it rewrites zombita_lot_state.txt every minute and after every change.
// Data: GET /api/admin/lot. Changes: POST /api/admin/lot {action, ...}, answer at /api/admin/lot/reply/{id} (only while the server is up).
// 2026-10-19 (mod 1.8.21, lot_shelf_patch.py): Hattie's rotating shelf (8 animals a 12 h roll, limited stock): re-roll, put an
// animal on it, set or refill its stock. Every price box shows its allowed range (the game refuses a price outside it).
import { useCallback, useEffect, useMemo, useState } from "react";
import { API } from "@/lib/constants";

const C = { gold: "#c8a84b", green: "#4caf7d", red: "#e05555", grey: "#9aa", text: "#e6e6e6", bg: "#0b0d10", line: "#2a2f37", teal: "#4ab0a8" };
const mono = { fontFamily: "var(--mono, monospace)" };
const inp = { ...mono, fontSize: 12, padding: "5px 7px", background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 3, boxSizing: "border-box" };
const GROUPS = [["poultry", "Poultry"], ["rabbits", "Rabbits"], ["pigs", "Pigs"], ["sheep", "Sheep"], ["cows", "Cows"], ["dogs", "Dogs"], ["cats", "Cats"]];
const n = (v) => Number(v) || 0;
function money(b) {
  const v = Math.round(n(b));
  const s = Math.floor(v / 1000), r = v % 1000;                    // no gold (Nin 2026-10-13)
  const parts = [];
  if (s) parts.push(`${s.toLocaleString("en-US")}s`);
  if (r || !parts.length) parts.push(`${r}b`);
  return parts.join(" ");
}
// "ZAni.hen.leghorn" -> "ZAni.hen."; "ZAni.cd.husky.pup" -> "ZAni.cd.husky."  (every breed / every age of that kind)
function kindPrefix(id) {
  const p = String(id || "").split(".");
  if (p[1] === "cd") return `ZAni.cd.${p[2]}.`;
  return `ZAni.${p[1]}.`;
}

function Btn({ children, onClick, color = C.gold, disabled = false, title = "" }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ ...mono, fontSize: 11, padding: "3px 8px", background: "transparent", color: disabled ? "#555" : color, border: `1px solid ${disabled ? "#333" : color}`,
        borderRadius: 3, cursor: disabled ? "default" : "pointer", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{children}</button>
  );
}
const Note = ({ children, color = C.grey }) => <div style={{ ...mono, fontSize: 11, color }}>{children}</div>;
const Row = ({ children, style = {} }) => <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", ...style }}>{children}</div>;
const Card = ({ title, children, right = null }) => (
  <div style={{ border: `1px solid ${C.line}`, borderRadius: 3, padding: 10, background: C.bg, display: "flex", flexDirection: "column", gap: 8 }}>
    <Row><b style={{ fontSize: 13 }}>{title}</b><span style={{ marginLeft: "auto" }} />{right}</Row>
    {children}
  </div>
);

function Area({ which, a, busy, send }) {
  const [size, setSize] = useState("");
  const [x, setX] = useState("");
  const [y, setY] = useState("");
  const what = which === "pen" ? "Pen" : "Car lot";
  return (
    <Card title={`${what}${which === "pen" ? " (big animals wait here; fence it in game)" : " (bought cars are parked only inside it)"}`}>
      {a ? <Note>{`${a.size} x ${a.size} tiles, from ${a.x1},${a.y1} to ${a.x2},${a.y2}${a.set ? " (set by an admin)" : " (beside the keeper)"}`}</Note>
        : <Note color={C.gold}>Not placed: the keeper has no kiosk.</Note>}
      <Row>
        <input style={{ ...inp, width: 70 }} placeholder="size" value={size} onChange={(e) => setSize(e.target.value)} title="Tiles a side, 8 to 40" />
        <Btn disabled={busy || !size} onClick={() => send({ action: "lot_size", which, size }, `${what} resized.`)}>Set size</Btn>
        <span style={{ width: 12 }} />
        <input style={{ ...inp, width: 80 }} placeholder="centre x" value={x} onChange={(e) => setX(e.target.value)} />
        <input style={{ ...inp, width: 80 }} placeholder="centre y" value={y} onChange={(e) => setY(e.target.value)} />
        <Btn disabled={busy || !x || !y} onClick={() => send({ action: "spot_at", which, x, y, z: 0 }, `${what} moved.`)}>Move here</Btn>
        <Btn color={C.grey} disabled={busy} onClick={() => send({ action: "spot_reset", which }, `${what} back beside the keeper.`)}>Reset</Btn>
      </Row>
      <Note>In game an admin can also stand in the middle and press {which === "pen" ? "PEN HERE" : "CAR LOT HERE"} in the keeper's window.</Note>
    </Card>
  );
}

function left(sec) {
  const v = Math.max(0, Math.floor(n(sec)));
  const h = Math.floor(v / 3600), m = Math.floor((v % 3600) / 60);
  if (v < 60) return "any moment now";
  return h ? `${h} h ${m} min` : `${m} min`;
}

function Shelf({ st, busy, send }) {
  const [stock, setStock] = useState({});
  const [pick, setPick] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const byId = useMemo(() => Object.fromEntries((st.animals || []).map((a) => [a.id, a])), [st]);
  const shelf = st.shelf || [];
  const onShelf = new Set(shelf.map((s) => s.id));
  const choices = (st.animals || []).filter((a) => !onShelf.has(a.id) && !a.off && !a.missing);
  const secs = n(st.shelf_next) - Math.floor((now / 1000) - n(st.at));
  return (
    <>
      <Card title={`Hattie's shelf now (${shelf.length})`}
        right={<Btn color={C.red} disabled={busy} onClick={() => { if (confirm("Roll a new shelf for Hattie now? Every animal and its stock is replaced.")) send({ action: "shelf_roll" }, "New shelf rolled."); }}>Re-roll now</Btn>}>
        <Note>New animals in {left(secs)}. Each roll puts 8 animals out, picked by rarity, with limited stock. Sold out stays sold out until the next roll.</Note>
        {shelf.length === 0 && <Note color={C.gold}>Nothing on the shelf yet (the game writes it once the server is up).</Note>}
        {shelf.map((s) => {
          const a = byId[s.id] || { name: s.id, price: 0 };
          return (
            <Row key={s.id} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
              <span style={{ ...mono, fontSize: 12, minWidth: 230, color: a.off || a.missing ? C.grey : C.text }}>{a.name}{a.off ? "  (off sale: players don't see it)" : ""}</span>
              <b style={{ ...mono, fontSize: 12, color: C.gold, minWidth: 80 }}>{money(a.price)}</b>
              <span style={{ ...mono, fontSize: 12, minWidth: 90, color: n(s.left) > 0 ? C.green : C.red }}>{n(s.left) > 0 ? `${s.left} of ${s.max} left` : "sold out"}</span>
              <input style={{ ...inp, width: 60 }} placeholder="stock" value={stock[s.id] || ""} onChange={(e) => setStock({ ...stock, [s.id]: e.target.value })} title="0 to 99" />
              <Btn disabled={busy || !(stock[s.id] || "").trim()} onClick={async () => { if (await send({ action: "shelf_stock", id: s.id, stock: stock[s.id] }, "Stock set.")) setStock({ ...stock, [s.id]: "" }); }}>Set stock</Btn>
              <Btn color={C.green} disabled={busy} onClick={() => send({ action: "shelf_stock", id: s.id, stock: "refill" }, "Refilled.")}>Refill</Btn>
            </Row>
          );
        })}
      </Card>
      <Card title="Put an animal on the shelf">
        <Row>
          <select style={{ ...inp, width: 300 }} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">pick an animal...</option>
            {choices.map((a) => <option key={a.id} value={a.id}>{`${a.name} (${money(a.price)})`}</option>)}
          </select>
          <Btn color={C.green} disabled={busy || !pick} onClick={async () => { if (await send({ action: "shelf_add", id: pick }, "On the shelf.")) setPick(""); }}>Put on shelf</Btn>
        </Row>
        <Note>It goes on this shelf with its usual stock until the next roll.</Note>
      </Card>
    </>
  );
}

export default function LotTab() {
  const [st, setSt] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState("cars");
  const [group, setGroup] = useState("poultry");
  const [add, setAdd] = useState({ script: "", name: "", price: "" });
  const [prices, setPrices] = useState({});           // row id -> the price typed in its box

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/admin/lot`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSt(await r.json()); setErr("");
    } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => {
    let stop = false, t = null;
    const tick = async () => { await load(); if (!stop) t = setTimeout(tick, 10000); };
    tick();
    return () => { stop = true; clearTimeout(t); };
  }, [load]);

  const send = useCallback(async (body, okText) => {
    setBusy(true); setMsg("Sent, waiting for the game...");
    try {
      const r = await fetch(`${API}/api/admin/lot`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.detail || `HTTP ${r.status}`); setBusy(false); return false; }
      for (let i = 0; i < 40; i++) {
        await new Promise((res) => setTimeout(res, 1500));
        const q = await (await fetch(`${API}/api/admin/lot/reply/${d.id}`, { credentials: "include" })).json().catch(() => ({}));
        if (q.done) { setMsg(q.msg || okText); setBusy(false); await load(); return q.ok; }
      }
      setMsg("The game hasn't answered yet: it runs requests only while the server is up (it pauses when nobody is online). It will run when it's back.");
    } catch (e) { setMsg(e.message); }
    setBusy(false);
    return false;
  }, [load]);

  const vehicles = useMemo(() => {
    const q = add.script.trim().toLowerCase();
    if (!st || q.length < 2) return [];
    const wrecks = q.includes("burnt") || q.includes("smashed");
    return (st.vehicles || []).filter((v) => v.toLowerCase().includes(q) && (wrecks || !/burnt|smashed/i.test(v))).slice(0, 12);
  }, [st, add.script]);

  if (err) return <Note color={C.red}>Can't read the car lot: {err}</Note>;
  if (!st) return <Note>Loading...</Note>;
  if (!st.ok) return <Note color={C.gold}>{st.why}</Note>;
  const cars = st.cars || [];
  const animals = (st.animals || []).filter((a) => a.group === group);
  const priceBox = (id, row = null) => (
    <>
      <input style={{ ...inp, width: 90 }} placeholder="price" value={prices[id] || ""} onChange={(e) => setPrices({ ...prices, [id]: e.target.value })}
        title="Bronze (52000) or 15s / 15s 200b / 300b" />
      {row && n(row.lo) > 0 && <span style={{ ...mono, fontSize: 10, color: C.grey }}>{`${money(row.lo)} to ${money(row.hi)}`}</span>}
    </>
  );
  const clearBox = (id) => setPrices((p) => ({ ...p, [id]: "" }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {st.stale && <Note color={C.gold}>The game hasn't written this for a while (the server pauses when nobody is online). Changes wait until it's back.</Note>}
      <Row>
        <Btn color={view === "cars" ? C.gold : C.grey} onClick={() => setView("cars")}>Duke: cars</Btn>
        <Btn color={view === "animals" ? C.gold : C.grey} onClick={() => setView("animals")}>Hattie: animals</Btn>
        <Btn color={view === "shelf" ? C.gold : C.grey} onClick={() => setView("shelf")}>Hattie: shelf</Btn>
        <span style={{ marginLeft: "auto" }} />
        <Note color={st.car_on ? C.green : C.gold}>Car shop {st.car_on ? "ON" : "OFF for players"}</Note>
        <Note color={st.animal_on ? C.green : C.gold}>Animal shop {st.animal_on ? "ON" : "OFF for players"}</Note>
      </Row>
      <Note>Turn the shops on or off with the switches "Car shop (Duke)" / "Animal shop (Hattie)" (System tab), or as a goal unlock. Admins can use them while they're off.</Note>
      {msg && <Note color={C.teal}>{msg}</Note>}

      {view === "cars" && (
        <>
          <Card title="Add a car to Duke's list">
            <Row>
              <input style={{ ...inp, width: 240 }} placeholder="vehicle id: type to search (e.g. pickup)" value={add.script}
                onChange={(e) => setAdd({ ...add, script: e.target.value })} />
              <input style={{ ...inp, width: 180 }} placeholder="name players see (optional)" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
              <input style={{ ...inp, width: 110 }} placeholder="price (5g 2s)" value={add.price} onChange={(e) => setAdd({ ...add, price: e.target.value })} />
              <Btn color={C.green} disabled={busy || !add.script.trim() || !add.price.trim()}
                onClick={async () => { if (await send({ action: "car_add", ...add }, "Added.")) setAdd({ script: "", name: "", price: "" }); }}>Add / set</Btn>
            </Row>
            {vehicles.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {vehicles.map((v) => <Btn key={v} color={C.teal} onClick={() => setAdd({ ...add, script: v })}>{v}</Btn>)}
              </div>
            )}
            <Note>A sale spawns a fresh, repaired car with a full tank on the lot, claimed to the buyer, key in their bag. A Pink Slip pays for any car here.</Note>
          </Card>
          <Card title={`On the lot (${cars.length})`}>
            {cars.length === 0 && <Note>Nothing yet: add a car above.</Note>}
            {cars.map((c) => (
              <Row key={c.id} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
                <span style={{ ...mono, fontSize: 12, minWidth: 200, color: c.missing ? C.grey : C.text }}>{c.name}</span>
                <span style={{ ...mono, fontSize: 11, color: C.grey, minWidth: 190 }}>{c.script}{c.missing ? "  (the game can't make it: mod missing?)" : ""}</span>
                <b style={{ ...mono, fontSize: 12, color: C.gold, minWidth: 90 }}>{money(c.price)}</b>
                {priceBox(c.id, c)}
                <Btn disabled={busy || !(prices[c.id] || "").trim()} onClick={async () => { if (await send({ action: "price", id: c.id, price: prices[c.id] }, "Priced.")) clearBox(c.id); }}>Price</Btn>
                <Btn color={C.red} disabled={busy} onClick={() => { if (confirm(`Take ${c.name} off Duke's list?`)) send({ action: "car_remove", script: c.script }, "Removed."); }}>Remove</Btn>
              </Row>
            ))}
          </Card>
          <Area which="car" a={st.lot} busy={busy} send={send} />
        </>
      )}

      {view === "shelf" && <Shelf st={st} busy={busy} send={send} />}

      {view === "animals" && (
        <>
          <Row>
            {GROUPS.map(([g, label]) => <Btn key={g} color={group === g ? C.gold : C.grey} onClick={() => setGroup(g)}>{label}</Btn>)}
          </Row>
          {(group === "dogs" && !st.dogs) && <Note color={C.gold}>Companion Dogs isn't running on the server: dogs aren't sold.</Note>}
          {(group === "cats" && !st.cats) && <Note color={C.gold}>CD: Cats isn't running on the server: cats aren't sold.</Note>}
          <Card title={`${(GROUPS.find((x) => x[0] === group) || [0, ""])[1]} (${animals.length})`}>
            {animals.map((a) => (
              <Row key={a.id} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
                <span style={{ ...mono, fontSize: 12, minWidth: 230, color: a.off || a.missing ? C.grey : C.text }}>
                  {a.name}{a.off ? "  (off sale)" : ""}{a.missing ? "  (not in this world)" : ""}</span>
                <b style={{ ...mono, fontSize: 12, color: C.gold, minWidth: 80 }}>{money(a.price)}</b>
                <span style={{ ...mono, fontSize: 11, color: C.grey, minWidth: 90 }}>{a.price !== a.def ? `(was ${money(a.def)})` : ""}</span>
                {priceBox(a.id, a)}
                <Btn disabled={busy || !(prices[a.id] || "").trim()} onClick={async () => { if (await send({ action: "price", id: a.id, price: prices[a.id] }, "Priced.")) clearBox(a.id); }}>Price</Btn>
                <Btn disabled={busy || !(prices[a.id] || "").trim()} title="Every breed / age of this kind at this price"
                  onClick={async () => { if (await send({ action: "price_group", prefix: kindPrefix(a.id), price: prices[a.id] }, "Priced.")) clearBox(a.id); }}>All breeds</Btn>
                <Btn color={a.off ? C.green : C.red} disabled={busy} onClick={() => send({ action: "toggle", id: a.id }, a.off ? "Back on sale." : "Off sale.")}>{a.off ? "Put on sale" : "Off sale"}</Btn>
              </Row>
            ))}
          </Card>
          <Note>Small animals go into the buyer's arms; big ones appear in the pen (they lead them home with a rope); dogs and cats come bonded.</Note>
          <Area which="pen" a={st.pen} busy={busy} send={send} />
        </>
      )}
    </div>
  );
}
