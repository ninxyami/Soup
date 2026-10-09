"use client";
// @ts-nocheck
// QUEST REWARDS (mod 1.7.98+): the items a winner's duffel carries, for EVERY quest type at EVERY tier (a Scout at D pays
// something different from a Scout at C), plus the beast classes and Queen Dusk's trap. Each card can hold several
// TEMPLATES (mod 1.7.102 + jobs_templates_patch): a win gives one of them at random.
//
// How a save travels: the website asks the bot, the bot appends the request to the game's command file, and the game applies
// it the next time it runs its quest loop. The server PAUSES its mods while nobody is in game, so a save made then waits in that
// file (it is never lost) until someone joins. This tab therefore:
//   * shows those queued saves on the cards straight away ("waiting for the game"), read back from the bot (`waiting`);
//   * never locks the buttons while the game is quiet - you can keep editing every card;
//   * keeps your UNSAVED edits for every card in this browser (localStorage), so switching quest type or reloading the page
//     does not throw them away. They are cleared once saved.
// Items are picked with the search (the whole catalog, mod items included; the game checks each one again).
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchApi, postApi, relTime, Title, B, FB, Load, Empty } from "./shared";
import { Items, TierPill } from "./JobsTab";

const mono = { fontFamily: "var(--mono)", fontSize: 12 };
const dim = { ...mono, color: "var(--textdim)" };
const warn = { ...mono, color: "var(--accent)" };

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
  { id: "laptop", name: "Field laptop" },
  { id: "escort", name: "Escort" },
  { id: "collect", name: "Collection" },
  { id: "donate", name: "Donation" },
  { id: "skill", name: "Practice" },
  { id: "route", name: "Route" },
  { id: "trap", name: "Queen Dusk's trap" },
];
const TIER_ORDER = ["", "D", "C", "B", "A", "S", "A+", "SS", "SSS", "SSS+"];
const tierRank = (t) => { const i = TIER_ORDER.indexOf(t || ""); return i < 0 ? 99 : i; };
const TIER_LABEL = { "": "Any tier (fallback)" };
const MAX_TEMPLATES = 12;
const REWARD_CMDS = ["set_reward", "del_variant", "default"];
const DRAFTS_KEY = "soup:quest-reward-drafts";

const clean = (v) => ({ rep: Number(v?.rep) || 0, items: (v?.items || []).map((x) => [x[0], Number(x[1]) || 1]) });
const same = (a, b) => JSON.stringify(clean(a)) === JSON.stringify(clean(b));
// "Base.Nails*2,Base.Rope*1" (what the bot queues for the game) -> [["Base.Nails", 2], ["Base.Rope", 1]]
const itemsFromText = (t) => String(t || "").split(",").filter(Boolean).map((p) => {
  const i = p.lastIndexOf("*");
  return i > 0 ? [p.slice(0, i).trim(), Number(p.slice(i + 1)) || 1] : [p.trim(), 1];
});

// The templates as they WILL be once the game runs the queued saves: the game's own list, then every waiting request on top.
function effective(row, waiting) {
  let list = (row.variants ?? (row.custom ? [{ rep: row.rep, items: row.items || [] }] : [])).map((v) => ({ ...clean(v), pending: false }));
  let pending = 0;
  for (const w of waiting) {
    if (w.row !== row.id) continue;
    pending += 1;
    if (w.cmd === "set_reward") {
      let i = Math.max(0, (Number(w.slot) || 1) - 1);
      if (i > list.length) i = list.length;
      list[i] = { rep: Number(w.rep) || 0, items: itemsFromText(w.items), pending: true };
    } else if (w.cmd === "del_variant") {
      const i = (Number(w.slot) || 0) - 1;
      if (i >= 0 && i < list.length) list.splice(i, 1);
    } else if (w.cmd === "default") {
      list = [];
    }
  }
  return { list, pending };
}

// unsaved edits, per card, kept in this browser
function useDrafts() {
  const [drafts, setDrafts] = useState({});
  const loaded = useRef(false);
  useEffect(() => {
    try { const s = localStorage.getItem(DRAFTS_KEY); if (s) setDrafts(JSON.parse(s) || {}); } catch {}
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)); } catch {}
  }, [drafts]);
  const setDraft = (id, v) => setDrafts((d) => { const n = { ...d }; if (v) n[id] = v; else delete n[id]; return n; });
  return [drafts, setDraft];
}

// one reward card: its templates (a winner gets one at random), each with extra rep and items
function RewardCard({ row, label, siblings, eff, draft, setDraft, send }) {
  const [sending, setSending] = useState(false);
  const base = eff.list.length ? eff.list : [{ rep: 0, items: [], pending: false }];
  const list = draft?.list || base.map(clean);
  const sel = Math.min(draft?.sel ?? 0, list.length - 1);
  const d = list[sel] || { rep: 0, items: [] };
  const known = eff.list[sel];
  const isDirty = (i) => (eff.list[i] ? !same(list[i], eff.list[i]) : (list[i]?.items?.length || 0) > 0 || Number(list[i]?.rep) > 0);
  const anyDirty = list.some((_, i) => isDirty(i)) || list.length < eff.list.length;
  const put = (newList, newSel = sel) => {
    const unchanged = newList.length === eff.list.length && newList.every((v, i) => same(v, eff.list[i]));
    setDraft(row.id, unchanged && newSel === 0 ? null : { list: newList, sel: newSel });
  };
  const patch = (p) => put(list.map((x, i) => (i === sel ? { ...x, ...p } : x)));
  const copyFrom = (id) => {
    const src = siblings.find((x) => x.id === id);
    if (!src) return;
    const v = (src.variants && src.variants[0]) || { rep: src.rep, items: src.items || [] };
    patch(clean(v));
  };
  const go = async (cmd, args, after) => {
    setSending(true);
    const ok = await send(cmd, { row: row.id, ...args });
    setSending(false);
    if (ok && after) after();
  };
  const save = () => go("set_reward", { rep: Number(d.rep) || 0, items: d.items.map(([id, n]) => ({ id, n })), slot: sel + 1 }, () => {
    // this template is now queued: keep only the OTHER unsaved templates in the draft
    const rest = list.map((v, i) => (i === sel ? clean(d) : v));
    const otherDirty = rest.some((v, i) => i !== sel && (eff.list[i] ? !same(v, eff.list[i]) : v.items.length > 0));
    setDraft(row.id, otherDirty ? { list: rest, sel } : null);
  });
  const count = eff.list.length;
  return (
    <div style={{ background: "var(--bg)", border: `1px solid ${anyDirty ? "var(--accent)" : "var(--border)"}`, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {row.tier && !["A+", "SS", "SSS", "SSS+"].includes(row.tier) ? <TierPill t={row.tier} /> : row.tier ? <span className="ap-pill" style={{ background: "#ffcc2e", color: "#0e0e0e", fontWeight: 700 }}>{row.tier}</span> : null}
        <strong>{label}</strong>
        {count > 0 ? <span style={warn}>{count} template{count > 1 ? "s" : ""}</span> : <span style={dim}>default</span>}
        {eff.pending > 0 && <span style={warn} title="Saved and queued. The game applies it as soon as it is running (someone in game).">⏳ {eff.pending} waiting for the game</span>}
        {anyDirty && <span style={{ ...mono, color: "var(--red)" }}>unsaved</span>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {list.map((x, i) => (
          <button key={i} onClick={() => put(list, i)} title={x.items.length ? x.items.map((it) => `${it[0]} x${it[1]}`).join(", ") : "empty"}
            style={{ padding: "3px 10px", ...mono, cursor: "pointer", background: i === sel ? "var(--accent)" : "var(--surface)", color: i === sel ? "#0e0e0e" : "var(--text)", border: `1px solid ${isDirty(i) ? "var(--red)" : "var(--border)"}` }}>
            #{i + 1}{eff.list[i]?.pending ? " ⏳" : ""}{isDirty(i) ? " *" : ""} <span style={{ opacity: 0.7 }}>({x.items.length})</span>
          </button>
        ))}
        {list.length < MAX_TEMPLATES && (
          <B sm c="ghost" onClick={() => put([...list, { rep: 0, items: [] }], list.length)}>+ TEMPLATE</B>
        )}
      </div>
      {list.length > 1 && <div style={dim}>A winner gets one of these {list.length} at random. * = not saved yet, ⏳ = saved, waiting for the game.</div>}
      <div><Items items={d.items} onChange={(items) => patch({ items })} /></div>
      {d.items.length === 0 && <div style={dim}>Empty. Falls back to {row.tier ? "the general row for this quest, then the default goods on S" : "nothing"}.</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={dim}>EXTRA REP</span>
        <input className="ap-search" style={{ width: 56 }} type="number" min={0} max={10} value={d.rep} onChange={(e) => patch({ rep: e.target.value })} />
        {siblings.length > 0 && (
          <select className="ap-search" style={{ width: "auto" }} value="" onChange={(e) => e.target.value && copyFrom(e.target.value)} title="Copy another card's first template in (not saved until you press SAVE)">
            <option value="">Copy from...</option>
            {siblings.map((x) => <option key={x.id} value={x.id}>{x.tier || "Any tier"}{(x.items || []).length ? ` (${x.items.length} items)` : " (empty)"}</option>)}
          </select>
        )}
        <span style={{ flex: 1 }} />
        <B sm c={isDirty(sel) ? "gold" : "ghost"} disabled={!isDirty(sel) || sending} onClick={save}>{sending ? "SAVING..." : `SAVE #${sel + 1}`}</B>
        {known && count > 1 && <B sm c="ghost" disabled={sending} onClick={() => confirm(`Remove template #${sel + 1} from "${row.name}"?`) && go("del_variant", { slot: sel + 1 }, () => setDraft(row.id, null))}>REMOVE #{sel + 1}</B>}
        {!known && list.length > 1 && <B sm c="ghost" onClick={() => put(list.filter((_, i) => i !== sel), Math.max(0, sel - 1))}>DISCARD</B>}
        {anyDirty && <B sm c="ghost" onClick={() => confirm("Throw away your unsaved changes on this card?") && setDraft(row.id, null)}>UNDO EDITS</B>}
        {(row.custom || count > 0) && <B sm c="ghost" disabled={sending} onClick={() => confirm(`Put "${row.name}" back to its default (removes ALL ${count} template${count > 1 ? "s" : ""})?`) && go("default", {}, () => setDraft(row.id, null))}>DEFAULT</B>}
      </div>
    </div>
  );
}

export default function QuestRewardsTab({ toast }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("visit");
  const [drafts, setDraft] = useDrafts();

  const load = useCallback(async () => {
    try { setD(await fetchApi("/api/admin/jobs")); } catch (e) { toast?.("Quest rewards: " + e.message, "error"); }
    setLoading(false);
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  const waiting = (d?.waiting || []).filter((w) => REWARD_CMDS.includes(w.cmd)).sort((a, b) => (a.at || 0) - (b.at || 0));
  useEffect(() => { const t = setInterval(load, waiting.length ? 5000 : 30000); return () => clearInterval(t); }, [load, waiting.length]);

  // queue it, then let the game answer in its own time - nothing waits on it
  const send = async (cmd, args = {}) => {
    try {
      const r = await postApi("/api/admin/jobs/cmd", { cmd, ...args });
      const quiet = d?.state?.stale;
      toast?.(quiet ? "Saved. The game is paused (nobody in game), so it goes in as soon as someone joins." : "Saved. The game applies it in a few seconds.", "success");
      load();
      (async () => {
        for (let i = 0; i < 20; i++) {
          await new Promise((ok) => setTimeout(ok, 3000));
          const a = await fetchApi(`/api/admin/jobs/requests/${r.id}`).catch(() => ({}));
          if (a.done) { if (!a.ok) toast?.(a.msg || "The game refused that change.", "error"); load(); return; }
        }
      })();
      return true;
    } catch (e) { toast?.(e.message, "error"); return false; }
  };

  if (loading) return <Load />;
  const s = d?.state;
  const rows = (s?.rows || []).filter((r) => r.type);
  const hasTypes = rows.length > 0;
  const byType = (id) => rows.filter((r) => r.type === id).sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
  const cur = byType(type);
  const effOf = (r) => effective(r, waiting);
  const setCount = (id) => byType(id).filter((r) => effOf(r).list.some((v) => v.items.length > 0 || v.rep > 0)).length;
  const unsavedIn = (id) => byType(id).filter((r) => drafts[r.id]).length;
  const totalUnsaved = Object.keys(drafts).filter((k) => rows.some((r) => r.id === k)).length;

  return (
    <div>
      <Title t="QUEST REWARDS" s="What a winner's duffel carries, for every quest type at every tier. A Scout at D can pay something very different from a Scout at C." />
      {!s && <div className="ap-note danger">No word from the game yet. This tab needs mod 1.7.98 running on the server.</div>}
      {s?.stale && (
        <div className="ap-note info">
          The game last reported {relTime(s.at)}. The server pauses its mods while nobody is in game (or it is restarting).
          You can keep editing: every save is kept and goes in as soon as someone joins.
          {waiting.length > 0 && <> <strong>{waiting.length} change{waiting.length > 1 ? "s" : ""} waiting.</strong></>}
        </div>
      )}
      {!s?.stale && waiting.length > 0 && <div className="ap-note info">The game is applying {waiting.length} change{waiting.length > 1 ? "s" : ""}...</div>}
      {totalUnsaved > 0 && <div className="ap-note" style={{ borderColor: "var(--red)" }}>You have unsaved changes on {totalUnsaved} card{totalUnsaved > 1 ? "s" : ""} (marked <span style={{ color: "var(--red)" }}>unsaved</span>). They stay in this browser until you press SAVE on each template.</div>}
      {s && !hasTypes && <div className="ap-note danger">The server is still on an older mod without per-tier rewards. Update it to 1.7.98 and this fills in.</div>}

      {hasTypes && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "4px 0 16px" }}>
            {TYPES.filter((t) => byType(t.id).length).map((t) => {
              const total = byType(t.id).length, set = setCount(t.id), uns = unsavedIn(t.id);
              return (
                <button key={t.id} onClick={() => setType(t.id)}
                  style={{ padding: "8px 12px", background: type === t.id ? "var(--accent)" : "var(--bg)", color: type === t.id ? "#0e0e0e" : "var(--text)", border: `1px solid ${uns ? "var(--red)" : "var(--border)"}`, cursor: "pointer", textAlign: "left" }}>
                  <div style={{ fontWeight: 700 }}>{t.name}</div>
                  <div style={{ ...mono, opacity: 0.75 }}>{set} of {total} set{uns ? ` · ${uns} unsaved` : ""}</div>
                </button>
              );
            })}
          </div>

          <FB title={(TYPES.find((t) => t.id === type)?.name || type).toUpperCase()}>
            <div className="ap-note" style={{ margin: "0 0 12px" }}>
              {type === "trap"
                ? "What a player gets after one of Queen Dusk's traps: for clearing it, or for getting away."
                : type === "beast"
                  ? "Each beast class has its own loot, with as many random templates as you like. A+ is the easy boss with a small horde, S to SSS+ are the flash sale bosses. Empty gives the default goods (bandages, batteries, duct tape, beans), scaled up for the harder classes."
                  : "One card per tier this quest can appear at. Search any item, mods included, and set how many. Add several templates to a card with + TEMPLATE: each win gives one of them at random, so quests do not always pay the same. A card left empty uses the Any tier card, and on S the default goods. Coins are separate: they come from the tier's pot."}
            </div>
            {cur.length === 0 ? <Empty text="No reward rows for this quest yet" /> : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
                {cur.map((r) => (
                  <RewardCard key={r.id} row={r} label={TIER_LABEL[r.tier] ?? (type === "trap" ? r.name : `${TYPES.find((t) => t.id === type)?.name} ${r.tier}`)}
                    siblings={cur.filter((x) => x.id !== r.id)} eff={effOf(r)} draft={drafts[r.id]} setDraft={setDraft} send={send} />
                ))}
              </div>
            )}
          </FB>
        </>
      )}
    </div>
  );
}
