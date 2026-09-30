"use client";
// @ts-nocheck
// QUEST REWARDS (mod 1.7.98+): the items a winner's duffel carries, for EVERY quest type at EVERY tier (a Scout at D pays
// something different from a Scout at C), plus the beast classes and Lady Dawnie's trap. The game keeps one reward row per
// type and tier and lists them all in its admin state (rows with type + tier); this tab groups them, and every change is a
// request the game runs within a few seconds, the same channel as the Zombita's Jobs tab. Items are picked with the search
// (the whole catalog, mod items included; the game checks each one again).
import { useState, useEffect, useCallback } from "react";
import { fetchApi, postApi, relTime, Title, B, FB, Load, Empty } from "./shared";
import { Items, TierPill } from "./JobsTab";

const mono = { fontFamily: "var(--mono)", fontSize: 12 };
const dim = { ...mono, color: "var(--textdim)" };

const TYPES = [
  { id: "visit", name: "Scout" },
  { id: "bring", name: "Bring me" },
  { id: "deliver", name: "Delivery" },
  { id: "code", name: "Treasure" },
  { id: "bag", name: "Fetch the bag" },
  { id: "horde", name: "Horde hunt" },
  { id: "camp", name: "Bandit camp" },
  { id: "smith", name: "Smith it" },
  { id: "glass", name: "Glassblowing" },
  { id: "cook", name: "Cook it" },
  { id: "beast", name: "Beast hunt" },
  { id: "trap", name: "Lady Dawnie's trap" },
];
const TIER_ORDER = ["", "D", "C", "B", "A", "S", "A+", "SS", "SSS", "SSS+"];
const tierRank = (t) => { const i = TIER_ORDER.indexOf(t || ""); return i < 0 ? 99 : i; };
const TIER_LABEL = { "": "Any tier (fallback)" };

// one reward card: rep + items for one row
function RewardCard({ row, label, siblings, send, busy }) {
  const [rep, setRep] = useState(row.rep);
  const [items, setItems] = useState(row.items || []);
  useEffect(() => { setRep(row.rep); setItems(row.items || []); }, [row.rep, JSON.stringify(row.items)]);
  const dirty = Number(rep) !== row.rep || JSON.stringify(items) !== JSON.stringify(row.items || []);
  const copyFrom = (id) => {
    const src = siblings.find((x) => x.id === id);
    if (!src) return;
    setItems((src.items || []).map((x) => [x[0], x[1]]));
    setRep(src.rep);
  };
  return (
    <div style={{ background: "var(--bg)", border: `1px solid ${dirty ? "var(--accent)" : "var(--border)"}`, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {row.tier && !["A+", "SS", "SSS", "SSS+"].includes(row.tier) ? <TierPill t={row.tier} /> : row.tier ? <span className="ap-pill" style={{ background: "#ffcc2e", color: "#0e0e0e", fontWeight: 700 }}>{row.tier}</span> : null}
        <strong>{label}</strong>
        {row.custom ? <span style={{ ...mono, color: "var(--accent)" }}>custom</span> : <span style={dim}>default</span>}
      </div>
      <div><Items items={items} onChange={setItems} /></div>
      {items.length === 0 && <div style={dim}>Empty. Falls back to {row.tier ? "the general row for this quest, then the default goods on S" : "nothing"}.</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={dim}>EXTRA REP</span>
        <input className="ap-search" style={{ width: 56 }} type="number" min={0} max={10} value={rep} onChange={(e) => setRep(e.target.value)} />
        {siblings.length > 0 && (
          <select className="ap-search" style={{ width: "auto" }} value="" onChange={(e) => e.target.value && copyFrom(e.target.value)} title="Copy another tier's items in (not saved until you press SAVE)">
            <option value="">Copy from...</option>
            {siblings.map((x) => <option key={x.id} value={x.id}>{x.tier || "Any tier"}{(x.items || []).length ? ` (${x.items.length} items)` : " (empty)"}</option>)}
          </select>
        )}
        <span style={{ flex: 1 }} />
        <B sm c={dirty ? "gold" : "ghost"} disabled={!dirty || busy} onClick={() => send("set_reward", { row: row.id, rep: Number(rep) || 0, items: items.map(([id, n]) => ({ id, n })) })}>SAVE</B>
        {row.custom && <B sm c="ghost" disabled={busy} onClick={() => confirm(`Put "${row.name}" back to its default?`) && send("default", { row: row.id })}>DEFAULT</B>}
      </div>
    </div>
  );
}

export default function QuestRewardsTab({ toast }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState([]);
  const [type, setType] = useState("visit");

  const load = useCallback(async () => {
    try { setD(await fetchApi("/api/admin/jobs")); } catch (e) { toast?.("Quest rewards: " + e.message, "error"); }
    setLoading(false);
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, waiting.length ? 3000 : 30000); return () => clearInterval(t); }, [load, waiting.length]);

  const send = async (cmd, args = {}) => {
    try {
      const r = await postApi("/api/admin/jobs/cmd", { cmd, ...args });
      setWaiting((w) => [...w, r.id]);
      toast?.("Sent to the game...", "info");
      for (let i = 0; i < 25; i++) {
        await new Promise((ok) => setTimeout(ok, 1500));
        const a = await fetchApi(`/api/admin/jobs/requests/${r.id}`).catch(() => ({}));
        if (a.done) { toast?.(a.msg || (a.ok ? "Saved" : "Failed"), a.ok ? "success" : "error"); break; }
        if (i === 24) toast?.("The game hasn't answered yet. Is the server up?", "error");
      }
      setWaiting((w) => w.filter((x) => x !== r.id));
      load();
    } catch (e) { toast?.(e.message, "error"); }
  };

  if (loading) return <Load />;
  const s = d?.state;
  const rows = (s?.rows || []).filter((r) => r.type);
  const hasTypes = rows.length > 0;
  const busy = waiting.length > 0;
  const byType = (id) => rows.filter((r) => r.type === id).sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
  const cur = byType(type);
  const setCount = (id) => byType(id).filter((r) => r.custom && (r.items || []).length > 0).length;

  return (
    <div>
      <Title t="QUEST REWARDS" s="What a winner's duffel carries, for every quest type at every tier. A Scout at D can pay something very different from a Scout at C." />
      {!s && <div className="ap-note danger">No word from the game yet. This tab needs mod 1.7.98 running on the server.</div>}
      {s?.stale && <div className="ap-note danger">The game last reported {relTime(s.at)}. The server may be down or restarting. Saves wait until it is back.</div>}
      {s && !hasTypes && <div className="ap-note danger">The server is still on an older mod without per-tier rewards. Update it to 1.7.98 and this fills in.</div>}
      {busy && <div className="ap-note info">Waiting for the game to answer {waiting.length} request{waiting.length > 1 ? "s" : ""}...</div>}

      {hasTypes && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "4px 0 16px" }}>
            {TYPES.filter((t) => byType(t.id).length).map((t) => {
              const total = byType(t.id).length, set = setCount(t.id);
              return (
                <button key={t.id} onClick={() => setType(t.id)}
                  style={{ padding: "8px 12px", background: type === t.id ? "var(--accent)" : "var(--bg)", color: type === t.id ? "#0e0e0e" : "var(--text)", border: "1px solid var(--border)", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ fontWeight: 700 }}>{t.name}</div>
                  <div style={{ ...mono, opacity: 0.75 }}>{set} of {total} set</div>
                </button>
              );
            })}
          </div>

          <FB title={(TYPES.find((t) => t.id === type)?.name || type).toUpperCase()}>
            <div className="ap-note" style={{ margin: "0 0 12px" }}>
              {type === "trap"
                ? "What a player gets after one of Lady Dawnie's traps: for clearing it, or for getting away."
                : type === "beast"
                  ? "Each beast class has its own loot. A+ is the easy boss with a small horde, S to SSS+ are the flash sale bosses. Empty gives the default goods (bandages, batteries, duct tape, beans), scaled up for the harder classes."
                  : "One card per tier this quest can appear at. Search any item, mods included, and set how many. A card left empty uses the Any tier card, and on S the default goods. Coins are separate: they come from the tier's pot."}
            </div>
            {cur.length === 0 ? <Empty text="No reward rows for this quest yet" /> : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
                {cur.map((r) => (
                  <RewardCard key={r.id} row={r} label={TIER_LABEL[r.tier] ?? (type === "trap" ? r.name : `${TYPES.find((t) => t.id === type)?.name} ${r.tier}`)}
                    siblings={cur.filter((x) => x.id !== r.id)} send={send} busy={busy} />
                ))}
              </div>
            )}
          </FB>
        </>
      )}
    </div>
  );
}
