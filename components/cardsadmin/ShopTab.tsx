// @ts-nocheck
"use client";
// components/cardsadmin/ShopTab.tsx: each card's shop as its holders see it, by rank (GET /api/admin/cards/shop, the same bot
// code that sells), Mags' shelf, and the card shop numbers. Without the bot zip the lists say what's needed.

import { useMemo, useState } from "react";
import { C, MONO, BODY, Btn, Card, Note, Pill, Empty, ItemIcon, itemName, money, ago } from "../quests/ui";
import { cardHex, groupRows, SHOP_GROUP, RANK_NAMES } from "./lib";
import Settings from "./Settings";

const PER = { term: "a card term", week: "a week", day: "a day" };
const SHOPS = { global: "General store", weapons: "Weapons shop", mechanic: "Mechanic shop", medical: "Medical shop", gardener: "Gardener",
                melee: "Melee shop", tailor: "Tailor", librarian: "Librarian", music: "Music shop" };

function Line({ id, name, price, base, extra, pills }) {
  return (
    <div className="ca-row" style={{ display: "flex", alignItems: "center", gap: "4px 10px", padding: "6px 4px", borderBottom: `1px solid ${C.lineSoft}`, flexWrap: "wrap" }}>
      <ItemIcon id={id} size={26} />
      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
        <div style={{ fontFamily: BODY, fontSize: 13, color: C.text }}>{name || itemName(id)} {pills}</div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: C.faint, overflowWrap: "anywhere" }}>{id}</div>
      </div>
      {extra && <span style={{ fontFamily: MONO, fontSize: 11, color: C.dim }}>{extra}</span>}
      {base != null && base !== price && <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint, textDecoration: "line-through" }}>{money(base)}</span>}
      <span style={{ fontFamily: MONO, fontSize: 13, color: C.gold, minWidth: 70, textAlign: "right" }}>{money(price)}</span>
    </div>
  );
}

function Keeper({ k }) {
  if (!k) return null;
  return (
    <Card title={k.label || "Mags' Garage"} pad={10}>
      <Note style={{ marginBottom: 8 }}>Mags' normal shelf at the Mechanic card spot, open to everyone while the Mechanic card is on. Her CARD tab sells the card itself.</Note>
      {!k.ok && <Note c="orange">{k.why}</Note>}
      {k.ok && (k.rows || []).map((r) => (
        <Line key={r.id} id={r.id} price={r.price} base={r.normal} extra={`${SHOPS[r.from] || r.from}'s price`} pills={r.always ? <Pill c={C.green}>always</Pill> : null} />
      ))}
      {k.ok && (k.missing || []).length > 0 && <Note style={{ marginTop: 8 }}>No shop sells (so not on her shelf): {k.missing.map(itemName).join(", ")}.</Note>}
    </Card>
  );
}

export default function ShopTab({ st, shop, loadShop, send, ask, pickCard, selectCard }) {
  const [q, setQ] = useState("");
  const cards = st.cards || [];
  const rows = shop?.cards || [];
  const sel = rows.find((r) => r.id === pickCard) || rows.find((r) => r.id === "mechanic") || rows[0];
  const s = shop?.settings || {};
  const goods = useMemo(() => (sel?.goods || []).filter((g) => !q || (g.name + " " + g.id).toLowerCase().includes(q.toLowerCase())), [sel, q]);
  const groups = groupRows(st.settingRows, (r) => r.group === SHOP_GROUP);
  const shopRank = RANK_NAMES[(s.shopRank || Number(st.settings?.shopRank) || 3) - 1];

  return (
    <div>
      {!shop && <Note style={{ marginBottom: 12 }}>Reading the card shops...</Note>}
      {shop?.missing && <Note c="orange" style={{ marginBottom: 14, color: C.text }}>The shop lists need the bot update (Zombita_cards_admin_page.zip, not installed yet). The card shop numbers below work now.</Note>}
      {shop?.error && <Note c="red" style={{ marginBottom: 14, color: C.text }}>Can't read the card shops ({shop.error}).</Note>}
      {shop && shop.ok === false && <Note c="red" style={{ marginBottom: 14, color: C.text }}>{shop.why}</Note>}
      {(shop?.errors || []).length > 0 && <Note c="red" style={{ marginBottom: 14, color: C.text }}>Some lists couldn't be read: {shop.errors.join("; ")}</Note>}

      {rows.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {rows.map((r) => {
              const c = cards.find((k) => k.id === r.id) || {};
              return (
                <button key={r.id} type="button" onClick={() => selectCard(r.id)}
                  style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", padding: "7px 12px", cursor: "pointer", flex: "1 1 120px",
                    background: sel?.id === r.id ? C.panel2 : C.panel, border: `1px solid ${sel?.id === r.id ? C.gold : C.line}`,
                    color: !r.has_shop ? C.faint : sel?.id === r.id ? C.gold : C.text }}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: c.on ? cardHex(c.color) : C.faint, marginRight: 6 }} />{r.name}
                </button>
              );
            })}
            <Btn sm c="dim" onClick={loadShop} title="Read the lists again">Refresh</Btn>
          </div>
          <div style={{ display: "flex", gap: "4px 18px", flexWrap: "wrap", fontFamily: MONO, fontSize: 12, color: C.dim, marginBottom: 14 }}>
            <span>goods and books from <b style={{ color: C.text }}>{shopRank}</b></span>
            <span><b style={{ color: C.text }}>{s.discount}%</b> off the shop price</span>
            <span><b style={{ color: C.text }}>{s.cap}</b> of each a day</span>
            <span>magazines <b style={{ color: C.text }}>{s.cardMagPct}%</b> (card copies, 1 read)</span>
            <span>replicas <b style={{ color: C.text }}>{s.replicaPct}%</b></span>
            {shop.at && <span>read {ago(shop.at)}</span>}
          </div>

          {sel && !sel.has_shop && <Card title={`${sel.name}: no card shop`}><Empty>The {sel.name} card has no shop of its own.</Empty></Card>}
          {sel?.has_shop && (
            <div className="ca-half">
              <div style={{ minWidth: 0 }}>
                {sel.mech.length > 0 && (
                  <Card title="The Mechanic's own (replicas, orb materials)" pad={10}>
                    {RANK_NAMES.map((rn, i) => {
                      const list = sel.mech.filter((m) => m.rank === i + 1);
                      if (!list.length) return null;
                      return (
                        <div key={rn} style={{ marginBottom: 10 }}>
                          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.2, color: C.gold, textTransform: "uppercase", margin: "6px 0 2px" }}>From {rn}</div>
                          {list.map((m) => <Line key={m.id} id={m.id} name={String(m.name).replace(/ \(replica\)$/, "")} price={m.price} base={m.base} extra={`${m.cap} ${PER[m.per] || m.per}`}
                            pills={m.replica ? <Pill c={C.teal}>replica</Pill> : null} />)}
                        </div>
                      );
                    })}
                  </Card>
                )}
                {(sel.mags.length > 0 || sel.mags_missing.length > 0) && (
                  <Card title="Magazines and manuals by rank" pad={10}>
                    <Note style={{ marginBottom: 6 }}>Each list is the rank it belongs to (the free rank-up gift comes from it). With the
                      every-rank update (bot zip card_mags_all + mod 1.8.54) holders see them all, buy with money from Expert, or take one with a Magazine Voucher.</Note>
                    {RANK_NAMES.map((rn, i) => {
                      const list = sel.mags.filter((m) => m.rank === i + 1);
                      if (!list.length) return null;
                      return (
                        <div key={rn} style={{ marginBottom: 10 }}>
                          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.2, color: C.gold, textTransform: "uppercase", margin: "6px 0 2px" }}>{rn} list ({list.length})</div>
                          {list.map((m) => <Line key={m.id} id={m.id} name={m.name} price={m.price} base={m.base} extra="1 a day" />)}
                        </div>
                      );
                    })}
                    {sel.mags_missing.length > 0 && <Note c="orange" style={{ marginTop: 6 }}>Not sold (no shop price): {sel.mags_missing.map((m) => `${itemName(m.id)} (${RANK_NAMES[m.rank - 1]})`).join(", ")}.</Note>}
                  </Card>
                )}
                {sel.id === "mechanic" && <Keeper k={shop.keeper} />}
              </div>
              <Card title={`Goods and books (${sel.goods.length})`} pad={10}>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search"
                  style={{ background: C.bg, border: `1px solid ${C.line}`, color: C.text, padding: "7px 10px", fontFamily: MONO, fontSize: 13, width: "100%", boxSizing: "border-box", outline: "none", marginBottom: 6 }} />
                <Note style={{ marginBottom: 6 }}>From {shopRank}, {s.discount}% off, {s.cap} of each a day (recipe magazines 1).</Note>
                {goods.length === 0 && <Empty>Nothing{q ? " matches" : ""}.</Empty>}
                {goods.slice(0, 150).map((g) => <Line key={g.id} id={g.id} name={g.name} price={g.price} base={g.base} />)}
                {goods.length > 150 && <Note style={{ marginTop: 6 }}>First 150 of {goods.length}. Search to narrow it.</Note>}
              </Card>
            </div>
          )}
        </>
      )}
      <Settings groups={groups} send={send} ask={ask} empty="The game hasn't sent the card shop settings." />
    </div>
  );
}
