// @ts-nocheck
"use client";
// components/cardsadmin/Overview.tsx: the whole system's switch, the launch checklist, each card at a glance.

import { C, MONO, BODY, DISPLAY, Card, Note, Pill, Stat, Toggle, fmt } from "../quests/ui";
import { Check, CardArt, cardHex, grid, when } from "./lib";

export function cardSwitch(c, send, ask) {
  const on = !c.on;
  ask({ title: on ? `Turn the ${c.name} card ON` : `Turn the ${c.name} card OFF`, danger: !on, yes: on ? "Turn it on" : "Turn it off",
        text: on ? `Players can buy, earn and work the ${c.name} card (its shop and jobs too), while the whole system is on.`
                 : `Players see the ${c.name} card as Coming soon: no buying, earning or card jobs. Holders keep it until it runs out.` },
      () => send("setting", { key: "card_" + c.id, value: on }, `${c.name} card ${on ? "ON" : "OFF"}`));
}

export function systemSwitch(st, send, ask) {
  const on = !st.on;
  ask({ title: on ? "Turn Zombita's Cards ON" : "Turn Zombita's Cards OFF", danger: !on, yes: on ? "Turn it on" : "Turn it off",
        text: on ? "Only the cards switched ON can be bought, earned or worked. The others stay Coming soon."
                 : "No new cards, card jobs or card shops for anyone. Held cards run out as normal." },
      () => send("system", { value: on }, `Cards system ${on ? "ON" : "OFF"}`));
}

export default function Overview({ st, zc, switches, jobs, send, ask, goCard, setTab, mine }) {
  const cards = st.cards || [];
  const mech = cards.find((c) => c.id === "mechanic");
  const held = (st.players || []).filter((p) => p.card && Number(p.until) > Date.now() / 1000).length;
  const quests = jobs?.state?.quests || [];
  const cardJobs = quests.filter((q) => q.kind === "card" || q.type === "callmech").length;
  const yards = zc?.yards ? String(zc.yards).split(";").filter((s) => s.trim()).length : 0;
  const known = !!zc;
  const toolwear = switches ? switches.toolwear === true : null;

  return (
    <div>
      <div style={{ ...grid(140), marginBottom: 16 }}>
        <Stat label="System" value={st.on ? "ON" : "OFF"} c={st.on ? C.green : C.red} sub="all cards" />
        <Stat label="Cards on" value={`${cards.filter((c) => c.on).length} / ${cards.length}`} c={C.gold} sub="the rest: Coming soon" />
        <Stat label="Cards held" value={fmt(held)} sub={`${fmt((st.players || []).length)} players with points`} />
        <Stat label="Open card jobs" value={jobs?.state ? fmt(cardJobs) : "-"} sub={jobs?.state ? "incl. Call a Mechanic" : "reading the job board..."} />
      </div>

      <div className="ca-half">
        <Card title="The whole system">
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <Toggle on={!!st.on} onChange={() => systemSwitch(st, send, ask)} />
            <div style={{ fontFamily: DISPLAY, fontSize: 32, letterSpacing: 2, color: st.on ? C.green : C.red, lineHeight: 1 }}>{st.on ? "ON" : "OFF"}</div>
            <div style={{ fontFamily: BODY, fontSize: 13, color: C.dim, flex: "1 1 200px" }}>
              Zombita's Cards for everyone. The same switch as Zombita Control &gt; MODS in game.
            </div>
          </div>
          <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: "4px 18px", fontFamily: MONO, fontSize: 12, color: C.dim }}>
            <span>price <b style={{ color: C.text }}>{fmt(st.price)}b</b></span>
            <span>lasts <b style={{ color: C.text }}>{st.days} days</b></span>
            <span>slots <b style={{ color: C.text }}>{st.boughtSlots} bought + {st.earnedSlots} earned</b> per card</span>
            <span>card jobs <b style={{ color: C.text }}>{st.offersPerDay} a day</b></span>
          </div>
        </Card>

        <Card title="Launch checklist" pad={"4px 16px 8px"}>
          {!known && <Note c="orange" style={{ margin: "10px 0" }}>Live Ops can't read Zombita Control right now (server down, or a mod older than 1.8.52), so the spot, scrapyards and reset are unknown.</Note>}
          <Check ok={!!st.on} label="Cards system ON" sub={st.on ? "Players can use the cards that are on." : "Off: nobody can buy or earn a card. Switch it on the left."} />
          <Check ok={!!mech?.on} label="Mechanic card ON" sub={mech?.on ? "Bought from Mags at Zombita's garage." : "Off: players see Coming soon. Switch it on in the tiles below or the CARDS tab."} />
          <Check ok={known ? !!zc.mechSpot : null} warn={!known} label="Mechanic card spot (Zombita's garage)"
            sub={known ? (zc.mechSpot ? `Set: ${zc.mechSpot}. Mags stands here.` : "Not set. In game, stand at the garage: Zombita Control > CARDS > LAUNCH > SET MECHANIC CARD SPOT HERE.") : "Unknown."} />
          <Check ok={known && yards > 0} warn={!known || yards === 0} label={`Scrapyards for tow jobs${known ? `: ${yards}` : ""}`}
            sub={known ? (yards ? String(zc.yards) : "None yet: no tow jobs. In game at a scrapyard: Zombita Control > CARDS > ADD SCRAPYARD HERE.") : "Unknown."} />
          <Check ok={known && !!zc.resetDone} warn label="Launch: card points reset"
            sub={known ? (zc.resetDone ? `Done ${zc.resetDone}${zc.resetAt ? `, ${when(zc.resetAt)}` : ""}.` : "Not run yet. Launch day only, once: Zombita Control > CARDS > LAUNCH > RESET CARD POINTS.") : "Unknown."} />
          <Check ok={toolwear === true} warn label={`Tool wear ${toolwear === null ? "" : toolwear ? "ON" : "OFF"}`}
            sub={zc?.wearLine || (toolwear ? "On." : "Off: no tool wears. See the TOOL WEAR tab.")}>
            <button type="button" onClick={() => setTab("wear")} style={{ background: "none", border: "none", padding: 0, marginTop: 4, color: C.gold, fontFamily: MONO, fontSize: 12, cursor: "pointer" }}>Open Tool wear</button>
          </Check>
        </Card>
      </div>

      <div style={{ fontFamily: DISPLAY, fontSize: 22, letterSpacing: 2, color: C.gold, margin: "8px 0 10px" }}>The cards</div>
      <div style={grid(300)}>
        {cards.map((c) => {
          const top = (c.top || []).filter((t) => t.recent > 0).slice(0, 3);
          return (
            <div key={c.id} onClick={() => goCard(c.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && goCard(c.id)}
              style={{ background: C.panel, border: `1px solid ${c.on ? cardHex(c.color) : C.line}`, padding: 12, display: "flex", gap: 12, cursor: "pointer", minWidth: 0 }}>
              <CardArt card={c} size={70} on={c.on} />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontFamily: DISPLAY, fontSize: 24, letterSpacing: 1.5, color: c.on ? cardHex(c.color) : C.dim, lineHeight: 1, flex: 1 }}>{c.name}</div>
                  <span onClick={(e) => e.stopPropagation()}><Toggle on={!!c.on} onChange={() => cardSwitch(c, send, ask)} /></span>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>
                  bought <b style={{ color: C.text }}>{c.bought}/{st.boughtSlots}</b> · earned <b style={{ color: C.text }}>{c.earned}/{st.earnedSlots}</b>
                </div>
                <div style={{ fontFamily: BODY, fontSize: 12, color: C.text, overflowWrap: "anywhere" }}>
                  {(c.holders || []).length ? (c.holders || []).map((h) => h.name).join(", ") : <span style={{ color: C.faint }}>nobody holds it</span>}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: C.dim, overflowWrap: "anywhere" }}>
                  {top.length ? <>lately: {top.map((t) => `${t.name} ${t.recent}`).join(", ")}</> : "no points lately"}
                </div>
                {!c.on && <Pill c={C.faint} style={{ alignSelf: "flex-start" }}>players see: Coming soon</Pill>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
