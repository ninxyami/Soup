// @ts-nocheck
"use client";
// components/quests/Rewards.tsx: what a win gives, one row at a time.
//
// A reward ROW is one job type at one tier (horde_d = a D horde). A row holds up to 100 TEMPLATES; a win picks one at
// random. The game stores each template as just [item, count] pairs (+ extra rep). This view shows them as cards you can
// read at a glance: item icons, names, counts, and (from the v2 set file) the kit / lore set / value they came from.
//
// Two sources:
//   game     what the game has now (the admin state). Edit, copy, delete, add; every change is a request the game runs
//            within seconds while someone is online.
//   preview  the v2 set (public/quest-rewards-v2-preview.json), NOT loaded yet. Read only: for checking before the load.

import { useEffect, useMemo, useState } from "react";
import { C, MONO, BODY, DISPLAY, TIER, TIERS, Btn, Card, Note, Pill, TierPill, Input, Select, Label, Empty, ItemLine,
  Modal, Confirm, ItemsEditor, Pager, sigOf, itemName, fmt, money } from "./ui";

const MAX = 100;
const ROW_CMDS = { set_reward: 1, del_variant: 1, default: 1 };

/** "horde_d" -> { type: "horde", tier: "D" }; "horde_sssp" -> SSS+ (every S class has rows of its own since mod 1.7.178);
 *  rows like "trap_kill" keep their own words */
function splitRow(id) {
  const m = /^(.*)_(d|c|b|a|s|ss|sss|sssp)$/.exec(id || "");
  if (m) return { type: m[1], tier: m[2] === "sssp" ? "SSS+" : m[2].toUpperCase() };
  return { type: id, tier: "" };
}
const ROW_TIERS = ["D", "C", "B", "A", "A+", "S", "SS", "SSS", "SSS+"];
const titleCase = (s) => String(s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Build the row list the view works with, from either source. */
function rowsFrom(source, state, preview) {
  const out = [];
  if (source === "game") {
    for (const r of state?.rows || []) {
      // Only `variants` are templates. A row without any still reports `items`: that is the game's BUILT-IN reward for
      // the row (S.rewardFor falls back to it), not something an admin made, and it can't be deleted.
      const t = r.variants && r.variants.length ? r.variants : [];
      out.push({ id: r.id, name: r.name || titleCase(r.id), type: r.type || splitRow(r.id).type, tier: r.tier || splitRow(r.id).tier,
        text: r.text, def: r.default, custom: r.custom, builtIn: t.length ? null : { rep: r.rep || 0, items: r.items || [] },
        templates: t.map((v, i) => ({ slot: i + 1, rep: v.rep || 0, items: v.items || [] })) });
    }
  } else if (preview) {
    const names = {};
    for (const r of state?.rows || []) names[r.id] = r;
    for (const [id, list] of Object.entries(preview.rows || {})) {
      const g = names[id], sp = splitRow(id);
      out.push({ id, name: g?.name || (sp.tier ? `${titleCase(sp.type)} ${sp.tier}` : titleCase(id)), type: g?.type || sp.type, tier: g?.tier || sp.tier,
        templates: list.map((t, i) => ({ slot: i + 1, rep: t.r || 0, items: t.i || [], cat: t.c, lore: t.l, value: t.v, kit: t.k })) });
    }
  }
  return out;
}

/** Group rows by job type, tiers in D-C-B-A-S order. */
function groupByType(rows) {
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.type)) by.set(r.type, []);
    by.get(r.type).push(r);
  }
  const order = (t) => { const i = ROW_TIERS.indexOf(t); return i < 0 ? 99 : i; };
  return [...by.entries()].map(([type, list]) => ({ type, rows: list.sort((a, b) => order(a.tier) - order(b.tier) || a.id.localeCompare(b.id)) }))
    .sort((a, b) => a.type.localeCompare(b.type));
}

function matchesQuery(t, q) {
  if (!q) return true;
  return t.items.some(([id]) => id.toLowerCase().includes(q) || itemName(id).toLowerCase().includes(q))
    || (t.cat || "").toLowerCase().includes(q) || (t.lore || "").toLowerCase().includes(q);
}

// ── one template ───────────────────────────────────────────────────────────────────────────────────────────────────
function TemplateCard({ t, label, q, actions, kitText }) {
  return (
    <div style={{ background: C.panel2, border: `1px solid ${C.line}`, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderBottom: `1px solid ${C.lineSoft}` }}>
        <span style={{ fontFamily: DISPLAY, fontSize: 18, letterSpacing: 1, color: C.gold }}>#{t.slot}</span>
        <span style={{ flex: 1, minWidth: 0, fontFamily: BODY, fontSize: 12, color: C.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          title={kitText || ""}>
          {label ? [label.cat, label.lore].filter(Boolean).join(" / ") : ""}
        </span>
        {label?.value > 0 && <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }} title="Roughly what the items are worth in the shops">~{money(label.value)}</span>}
      </div>
      <div style={{ padding: "6px 10px", flex: 1 }}>
        {t.items.map(([id, n]) => <ItemLine key={id} id={id} n={n} highlight={q && (id.toLowerCase().includes(q) || itemName(id).toLowerCase().includes(q))} />)}
        {t.rep > 0 && <div style={{ fontFamily: MONO, fontSize: 12, color: C.purple, marginTop: 4 }}>+{t.rep} rep</div>}
      </div>
      {actions && <div style={{ display: "flex", gap: 6, padding: "7px 10px", borderTop: `1px solid ${C.lineSoft}` }}>{actions}</div>}
    </div>
  );
}

// ── the template editor ───────────────────────────────────────────────────────────────────────────────────────────
function TemplateEditor({ row, template, slot, apiGet, onSave, onClose }) {
  const [items, setItems] = useState(template ? template.items.map(([id, n]) => [id, n]) : []);
  const [rep, setRep] = useState(template ? template.rep || 0 : 0);
  const fresh = !template;
  return (
    <Modal title={fresh ? `New template for ${row.name}` : `${row.name}: template #${slot}`} onClose={onClose} width={680}
      footer={<>
        <Btn c="dim" onClick={onClose}>Cancel</Btn>
        <Btn c="solid" disabled={items.length === 0} onClick={() => { onSave(items, Math.max(0, Math.min(10, Number(rep) || 0))); onClose(); }}>
          {fresh ? `Add as #${slot}` : `Save #${slot}`}
        </Btn>
      </>}>
      <Label>Items the winner gets</Label>
      <ItemsEditor items={items} onChange={setItems} apiGet={apiGet} />
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", marginTop: 16 }}>
        <div style={{ width: 180, flexShrink: 0 }}>
          <Label>Extra rep (0 to 10)</Label>
          <Input type="number" value={rep} onChange={setRep} min={0} max={10} />
        </div>
        <Note>The coins come from the tier's pot, not from here. A win picks one of the row's templates at random.</Note>
      </div>
    </Modal>
  );
}

// ── the view ──────────────────────────────────────────────────────────────────────────────────────────────────────
export default function Rewards({ state, waiting, send, apiGet, preview, previewError, source, setSource }) {
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [onlyFilled, setOnlyFilled] = useState(true);
  const [pageSize, setPageSize] = useState(24);
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState(null);         // { slot, template|null }
  const [ask, setAsk] = useState(null);           // a Confirm

  const rows = useMemo(() => rowsFrom(source, state, preview), [source, state, preview]);
  const gameRows = useMemo(() => (source === "game" ? rows : rowsFrom("game", state, null)), [source, rows, state]);
  const gameCount = useMemo(() => Object.fromEntries(gameRows.map((r) => [r.id, r.templates.length])), [gameRows]);

  // labels for the game's templates: the v2 file knows each template's kit, lore set and value
  const labels = useMemo(() => {
    const m = new Map();
    for (const list of Object.values(preview?.rows || {})) for (const t of list) {
      const s = sigOf(t.i);
      if (!m.has(s)) m.set(s, { cat: t.c, lore: t.l, value: t.v, kit: t.k });
    }
    return m;
  }, [preview]);

  // changes the game hasn't run yet, per row (a row with any is locked: slots move when one is deleted)
  const pendingByRow = useMemo(() => {
    const m = {};
    for (const w of waiting || []) if (ROW_CMDS[w.cmd] && w.row) m[w.row] = (m[w.row] || 0) + 1;
    return m;
  }, [waiting]);

  const ql = q.trim().toLowerCase();
  const visibleRows = rows.filter((r) => (!onlyFilled || r.templates.length > 0) && (!ql || r.templates.some((t) => matchesQuery(t, ql))));
  const groups = useMemo(() => groupByType(visibleRows), [visibleRows]);

  useEffect(() => {
    if (sel && rows.some((r) => r.id === sel)) return;
    const first = visibleRows[0];
    setSel(first ? first.id : null);
  }, [rows, source]);                                                   // eslint-disable-line
  useEffect(() => { setPage(1); }, [sel, q, cat, source, pageSize]);
  useEffect(() => { setCat(""); }, [sel, source]);

  const row = rows.find((r) => r.id === sel) || null;
  const pending = row ? pendingByRow[row.id] || 0 : 0;
  const locked = source === "game" && pending > 0;
  const labelOf = (t) => (source === "preview" ? { cat: t.cat, lore: t.lore, value: t.value, kit: t.kit } : labels.get(sigOf(t.items)));

  const cats = useMemo(() => {
    const m = new Map();
    for (const t of row?.templates || []) { const l = labelOf(t); const k = l?.cat || "Not in the v2 set"; m.set(k, (m.get(k) || 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [row, labels, source]);                                            // eslint-disable-line

  const shown = (row?.templates || []).filter((t) => matchesQuery(t, ql) && (!cat || (labelOf(t)?.cat || "Not in the v2 set") === cat));
  const pages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(shown.length / pageSize));
  const pageItems = pageSize === 0 ? shown : shown.slice((page - 1) * pageSize, page * pageSize);

  const total = rows.reduce((s, r) => s + r.templates.length, 0);
  const filled = rows.filter((r) => r.templates.length > 0).length;

  const save = (slot, items, rep, label) => send("set_reward", { row: row.id, slot, rep, items: items.map(([id, n]) => ({ id, n })) }, label);

  return (
    <div>
      {/* source switch */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", border: `1px solid ${C.line}` }}>
          {[["game", "In the game"], ["preview", "New set (preview)"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setSource(k)}
              style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", padding: "8px 16px", cursor: "pointer", border: "none",
                background: source === k ? C.gold : "transparent", color: source === k ? "#111" : C.dim }}>{l}</button>
          ))}
        </div>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>{fmt(total)} templates in {filled} rows</span>
      </div>
      {source === "preview" && (
        <Note c="blue" style={{ marginBottom: 14, color: C.text }}>
          {previewError ? `The new set couldn't be read: ${previewError}` :
            <>This is the <b>new v2 set</b>{preview?.made ? ` (${preview.made})` : ""}, not loaded into the game yet. Look through it here; nothing on this view changes anything.
            Once it's loaded, each row's templates replace the game's, in this order. A row the game has more templates for keeps its extras after these
            (marked below).</>}
        </Note>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(250px, 300px) minmax(0, 1fr)", gap: 16, alignItems: "start" }} className="q-rewards-grid">
        {/* ── row list ── */}
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, position: "sticky", top: 12, maxHeight: "calc(100vh - 24px)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 12, borderBottom: `1px solid ${C.line}` }}>
            <Input value={q} onChange={setQ} placeholder="Find an item in any row..." />
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontFamily: BODY, fontSize: 12, color: C.dim, cursor: "pointer" }}>
              <input type="checkbox" checked={onlyFilled} onChange={(e) => setOnlyFilled(e.target.checked)} /> Only rows with templates
            </label>
          </div>
          <div style={{ overflowY: "auto", padding: "6px 0" }}>
            {groups.length === 0 && <Empty>{ql ? "No row has that item." : "No rows yet."}</Empty>}
            {groups.map((g) => (
              <div key={g.type} style={{ padding: "6px 12px" }}>
                <div style={{ fontFamily: BODY, fontSize: 13, color: C.text, marginBottom: 5 }}>{titleCase(g.type)}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {g.rows.map((r) => {
                    const on = r.id === sel;
                    const n = ql ? r.templates.filter((t) => matchesQuery(t, ql)).length : r.templates.length;
                    const p = source === "game" ? pendingByRow[r.id] || 0 : 0;
                    return (
                      <button key={r.id} type="button" title={r.name} onClick={() => {
                        setSel(r.id);
                        if (typeof window !== "undefined" && window.innerWidth < 900)       // phones: the row's templates are below the list
                          setTimeout(() => document.getElementById("q-row-card")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                      }}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 8px", cursor: "pointer", fontFamily: MONO, fontSize: 12,
                          background: on ? "rgba(200,168,75,0.15)" : C.bg, border: `1px solid ${on ? C.gold : C.line}`, color: C.text }}>
                        <span style={{ color: TIER[r.tier] || C.dim, fontWeight: 700 }}>{r.tier || titleCase(r.id).slice(0, 10)}</span>
                        <span style={{ color: n ? C.dim : C.faint }}>{n}</span>
                        {p > 0 && <span style={{ color: C.orange }} title={`${p} changes waiting for the game`}>*</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── the chosen row ── */}
        <div style={{ minWidth: 0, scrollMarginTop: 110 }} id="q-row-card">
          {!row ? <Card><Empty>Pick a row on the left.</Empty></Card> : (
            <Card title={<span>{row.name} {row.tier && <TierPill t={row.tier} style={{ marginLeft: 8, verticalAlign: "middle" }} />}</span>}
              right={<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: MONO, fontSize: 12, color: row.templates.length >= MAX ? C.red : C.dim }}>{row.templates.length} of {MAX} templates</span>
                <span style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>Show</span>
                <Select value={String(pageSize)} onChange={(v) => setPageSize(Number(v))} width={80}
                  options={[{ value: "12", label: "12" }, { value: "24", label: "24" }, { value: "48", label: "48" }, { value: "0", label: "All" }]} />
              </div>}>

              {source === "game" && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
                  <Btn c="solid" disabled={locked || row.templates.length >= MAX} onClick={() => setEdit({ slot: row.templates.length + 1, template: null })}>+ New template</Btn>
                  <Btn c="red" disabled={locked || row.templates.length === 0}
                    onClick={() => setAsk({ title: `Reset ${row.name}`, word: "RESET", danger: true, yes: "Reset row",
                      text: `This removes all ${row.templates.length} templates from ${row.name} and puts back the game's built-in reward. It can't be undone from here.`,
                      onYes: () => send("default", { row: row.id }, `Reset ${row.name}`) })}>Reset row</Btn>
                  <span style={{ flex: 1 }} />
                  {preview && (
                    <span style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>
                      New set: {(preview.rows?.[row.id] || []).length} templates
                    </span>
                  )}
                </div>
              )}
              {source === "preview" && (
                <div style={{ fontFamily: MONO, fontSize: 12, color: C.dim, marginBottom: 12 }}>
                  In the game now: {gameCount[row.id] ?? 0} templates.
                  {(gameCount[row.id] || 0) > row.templates.length &&
                    <span style={{ color: C.orange }}> After the load the game keeps its {gameCount[row.id] - row.templates.length} extra ones (#{row.templates.length + 1} and up). Delete them in "In the game" if they shouldn't stay.</span>}
                </div>
              )}

              {locked && (
                <Note c="orange" style={{ marginBottom: 12, color: C.text }}>
                  The game hasn't run {pending} change{pending === 1 ? "" : "s"} to this row yet (it only runs them while someone is online).
                  Editing this row is paused until it does, because deleting moves the numbers of the templates after it.
                </Note>
              )}

              {/* filters */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
                {cats.length > 1 && (
                  <>
                    <button type="button" onClick={() => setCat("")} style={chip(!cat)}>All {row.templates.length}</button>
                    {cats.map(([k, n]) => <button key={k} type="button" onClick={() => setCat(cat === k ? "" : k)} style={chip(cat === k)}>{k} {n}</button>)}
                  </>
                )}
              </div>

              {row.templates.length === 0 && source === "game" && (
                <div style={{ background: C.bg, border: `1px dashed ${C.line}`, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontFamily: BODY, fontSize: 13, color: C.dim, marginBottom: 6 }}>
                    No templates yet, so a win gives the game's <b>built-in reward</b> for this row{row.builtIn?.items?.length ? ":" : " (coins only)."}
                    {" "}It isn't a template and can't be deleted; adding a template replaces it.
                  </div>
                  {(row.builtIn?.items || []).map(([id, n]) => <ItemLine key={id} id={id} n={n} />)}
                  {row.builtIn?.rep > 0 && <div style={{ fontFamily: MONO, fontSize: 12, color: C.purple }}>+{row.builtIn.rep} rep</div>}
                </div>
              )}
              {shown.length === 0 ? (row.templates.length ? <Empty>No template matches.</Empty> : null) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 10 }}>
                  {pageItems.map((t) => {
                    const label = labelOf(t);
                    const extra = source === "game" && preview && (preview.rows?.[row.id] || []).length > 0 && t.slot > (preview.rows[row.id] || []).length;
                    return (
                      <TemplateCard key={t.slot} t={t} q={ql} label={label} kitText={label?.kit && preview?.kits?.[label.kit]}
                        actions={source === "game" ? <>
                          <Btn sm disabled={locked} onClick={() => setEdit({ slot: t.slot, template: t })}>Edit</Btn>
                          <Btn sm c="dim" disabled={locked || row.templates.length >= MAX} title="Add a copy at the end"
                            onClick={() => save(row.templates.length + 1, t.items, t.rep, `Copied #${t.slot} of ${row.name}`)}>Copy</Btn>
                          <span style={{ flex: 1 }} />
                          {extra && <Pill c={C.orange} title="Past the end of the new set">extra</Pill>}
                          <Btn sm c="red" disabled={locked} onClick={() => setAsk({ title: `Delete template #${t.slot}`, yes: "Delete", danger: true,
                            text: `Delete template #${t.slot} from ${row.name}? The ones after it move up one number.`,
                            onYes: () => send("del_variant", { row: row.id, slot: t.slot }, `Deleted #${t.slot} of ${row.name}`) })}>Delete</Btn>
                        </> : null} />
                    );
                  })}
                </div>
              )}
              <Pager page={page} pages={pages} onPage={setPage} />
            </Card>
          )}
        </div>
      </div>

      {edit && row && (
        <TemplateEditor row={row} template={edit.template} slot={edit.slot} apiGet={apiGet} onClose={() => setEdit(null)}
          onSave={(items, rep) => save(edit.slot, items, rep, edit.template ? `Saved #${edit.slot} of ${row.name}` : `Added #${edit.slot} to ${row.name}`)} />
      )}
      {ask && <Confirm {...ask} onClose={() => setAsk(null)} />}
    </div>
  );
}

function chip(on) {
  return { fontFamily: MONO, fontSize: 11, padding: "4px 9px", cursor: "pointer", background: on ? "rgba(200,168,75,0.15)" : C.bg,
    border: `1px solid ${on ? C.gold : C.line}`, color: on ? C.gold : C.dim };
}
