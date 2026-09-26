"use client";
// @ts-nocheck
// Zombita Data Observatory — a research-grade, read-only window into EVERY table
// Zombita writes: the hidden gauges (trust/respect/disposition/reputation), mood,
// per-player knowledge files, cognition, the economy brain, treasury, and shop
// pricing. Two modes: browse any table (sortable + CSV export) or look up one
// person across every gauge at once. Backend: /api/admin/zombita/data/*.
import { useState, useEffect, useMemo } from "react";
import { API, fetchApi, relTime, Load, Empty, Title } from "./shared";

// columns whose big-int values are unix timestamps — show a relative hint next to raw
const TIME_COLS = new Set([
  "updated_at","created_at","set_at","decays_at","last_decay","shifted_at",
  "computed_at","requested_at","rotated_at","next_rotation","last_updated",
  "timestamp","ts","asked_at","last_confirmed","fulfilled_at","last_analyzed",
]);

const isTs = (col, v) =>
  TIME_COLS.has(col) && typeof v === "number" && v > 1_000_000_000;

// columns holding a discord id → resolve to the player's name (id kept alongside)
const isIdCol = (col) =>
  col === "discord_id" || col.endsWith("_discord") || col.endsWith("discord_id");

// `names` is an {idString: displayName} map; resolves id columns to "Name (id)".
const cell = (col, v, names) => {
  if (v === null || v === undefined || v === "") return <span style={{ color: "var(--muted)" }}>—</span>;
  if (isIdCol(col)) {
    // raw id, no thousands-grouping. The name lives in the separate `player`
    // column the backend injects beside discord_id.
    return <span style={{ color: "var(--textdim)" }}>{String(v)}</span>;
  }
  if (isTs(col, v)) {
    return (
      <span title={new Date((v > 1e12 ? v : v * 1000)).toISOString()}>
        {v} <span style={{ color: "var(--textdim)", fontSize: 10 }}>({relTime(v)})</span>
      </span>
    );
  }
  if (typeof v === "number") {
    // keep full precision for research; just group thousands on large ints
    return Number.isInteger(v) && Math.abs(v) >= 1000 ? v.toLocaleString() : String(v);
  }
  const s = String(v);
  return s.length > 240 ? s.slice(0, 240) + "…" : s;
};

const box = {
  background: "var(--surface)", border: "1px solid var(--border)",
};
const th = {
  textAlign: "left", padding: "8px 12px", fontSize: 10, letterSpacing: 1.5,
  textTransform: "uppercase", color: "var(--textdim)", fontFamily: "var(--mono)",
  fontWeight: 400, borderBottom: "1px solid var(--border)",
  background: "rgba(0,0,0,0.25)", whiteSpace: "nowrap", cursor: "pointer",
  position: "sticky", top: 0,
};
const td = {
  padding: "7px 12px", fontSize: 12, fontFamily: "var(--mono)",
  borderBottom: "1px solid rgba(30,37,48,0.5)", whiteSpace: "nowrap",
  color: "var(--text)",
};

function Btn({ children, onClick, disabled, active, color = "gold", sm }) {
  const c = { gold: "var(--accent)", green: "var(--green)", blue: "var(--blue)", ghost: "var(--border)" }[color];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: sm ? "4px 10px" : "6px 14px", fontSize: sm ? 10 : 11,
      fontFamily: "var(--mono)", letterSpacing: 1, textTransform: "uppercase",
      border: `1px solid ${disabled ? "var(--border)" : c}`,
      color: disabled ? "var(--muted)" : (active ? "#0b0d10" : c),
      background: active ? c : (disabled ? "transparent" : "rgba(200,168,75,0.06)"),
      cursor: disabled ? "not-allowed" : "pointer", transition: "all .15s",
    }}>{children}</button>
  );
}

// ── one data table (sortable, paginated, exportable) ─────────────────────────
function TableView({ name, toast, names }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [order, setOrder] = useState("");
  const [dir, setDir] = useState("desc");

  useEffect(() => { setOffset(0); setOrder(""); setDir("desc"); }, [name]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const q = new URLSearchParams({ name, limit, offset, dir, ...(order ? { order } : {}) });
    fetchApi(`/api/admin/zombita/data/table?${q}`)
      .then(d => { if (live) { setData(d); setLoading(false); } })
      .catch(e => { if (live) { toast?.(e.message, "error"); setLoading(false); } });
    return () => { live = false; };
  }, [name, limit, offset, order, dir]);

  const sortBy = (col) => {
    if (order === col || (!order && data?.order === col)) setDir(d => d === "desc" ? "asc" : "desc");
    else { setOrder(col); setDir("desc"); }
  };

  const exportCsv = async () => {
    try {
      const q = new URLSearchParams({ name, dir, ...(order ? { order } : {}) });
      const r = await fetch(`${API}/api/admin/zombita/data/table.csv?${q}`, { credentials: "include" });
      if (!r.ok) throw new Error("export failed");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${name}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast?.(e.message, "error"); }
  };

  if (loading && !data) return <Load />;
  if (!data) return <Empty text="Could not load table." />;
  const activeOrder = order || data.order;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "var(--display)", fontSize: 20, letterSpacing: 1.5, color: "var(--accent)" }}>
          {data.label}
        </div>
        <code style={{ fontSize: 11, color: "var(--textdim)" }}>{data.name}</code>
        <div style={{ fontSize: 11, color: "var(--textdim)", fontFamily: "var(--mono)" }}>
          {data.total.toLocaleString()} rows
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Btn color="green" sm onClick={exportCsv}>⬇ CSV</Btn>
        </div>
      </div>

      <div style={{ ...box, overflow: "auto", maxHeight: "62vh" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {data.columns.map(c => (
                <th key={c} style={th} onClick={() => sortBy(c)}
                    title="click to sort">
                  {c}{activeOrder === c ? (data.dir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i}>
                {row.map((v, j) => (
                  <td key={j} style={td}>{cell(data.columns[j], v, names)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.rows.length === 0 && <Empty text="No rows." />}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <Btn sm color="ghost" disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - limit))}>‹ Prev</Btn>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>
          {data.total === 0 ? "0" : `${offset + 1}–${Math.min(offset + limit, data.total)}`} / {data.total.toLocaleString()}
        </span>
        <Btn sm color="ghost" disabled={offset + limit >= data.total} onClick={() => setOffset(o => o + limit)}>Next ›</Btn>
      </div>
    </div>
  );
}

// ── a person's rows across every per-person table ────────────────────────────
function PersonView({ toast }) {
  const [people, setPeople] = useState([]);
  const [sel, setSel] = useState("");
  const [snap, setSnap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetchApi("/api/admin/zombita/data/people")
      .then(d => setPeople(d.people || []))
      .catch(e => toast?.(e.message, "error"));
  }, []);

  const names = useMemo(
    () => Object.fromEntries((people || []).map(p => [p.discord_id, p.name])),
    [people]);

  useEffect(() => {
    if (!sel) { setSnap(null); return; }
    let live = true; setLoading(true);
    fetchApi(`/api/admin/zombita/data/person?discord_id=${sel}`)
      .then(d => { if (live) { setSnap(d); setLoading(false); } })
      .catch(e => { if (live) { toast?.(e.message, "error"); setLoading(false); } });
    return () => { live = false; };
  }, [sel]);

  const filtered = people.filter(p =>
    !q || (p.name || "").toLowerCase().includes(q.toLowerCase()) || p.discord_id.includes(q));

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="Search player…" value={q} onChange={e => setQ(e.target.value)}
          style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)",
                   padding: "8px 10px", fontFamily: "var(--mono)", fontSize: 12, minWidth: 200 }} />
        <select value={sel} onChange={e => setSel(e.target.value)}
          style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)",
                   padding: "8px 10px", fontFamily: "var(--mono)", fontSize: 12, minWidth: 260 }}>
          <option value="">— pick a player ({filtered.length}) —</option>
          {filtered.map(p => <option key={p.discord_id} value={p.discord_id}>{p.name} ({p.discord_id})</option>)}
        </select>
      </div>

      {loading && <Load />}
      {snap && !loading && (
        <div>
          <div style={{ fontFamily: "var(--display)", fontSize: 22, letterSpacing: 1.5, color: "var(--accent)", marginBottom: 2 }}>
            {snap.display_name}
          </div>
          <code style={{ fontSize: 11, color: "var(--textdim)" }}>{snap.discord_id}</code>
          {snap.sections.length === 0 && <Empty text="No per-person data recorded yet." />}
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 18 }}>
            {snap.sections.map(sec => (
              <div key={sec.name}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 12, letterSpacing: 1, color: "var(--text)", textTransform: "uppercase" }}>{sec.label}</div>
                  <code style={{ fontSize: 10, color: "var(--textdim)" }}>{sec.name}</code>
                  <span style={{ fontSize: 10, color: "var(--muted)" }}>{sec.rows.length} row{sec.rows.length !== 1 ? "s" : ""}</span>
                </div>
                <div style={{ ...box, overflow: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead><tr>{sec.columns.map(c => <th key={c} style={{ ...th, cursor: "default" }}>{c}</th>)}</tr></thead>
                    <tbody>
                      {sec.rows.map((row, i) => (
                        <tr key={i}>{row.map((v, j) => <td key={j} style={td}>{cell(sec.columns[j], v, names)}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── main ─────────────────────────────────────────────────────────────────────
export default function ZombitaDataTab({ toast }) {
  const [mode, setMode] = useState("table");
  const [catalog, setCatalog] = useState(null);
  const [table, setTable] = useState("zombita_trust");
  const [people, setPeople] = useState([]);

  useEffect(() => {
    fetchApi("/api/admin/zombita/data/catalog")
      .then(d => setCatalog(d.groups || []))
      .catch(e => toast?.(e.message, "error"));
    fetchApi("/api/admin/zombita/data/people")
      .then(d => setPeople(d.people || []))
      .catch(() => {});
  }, []);

  // {idString: name} — resolves discord_id columns to player names in the table view
  const names = useMemo(
    () => Object.fromEntries((people || []).map(p => [p.discord_id, p.name])),
    [people]);

  return (
    <div style={{ padding: "4px 2px" }}>
      <Title t="Zombita Data Observatory" s="Read-only view of every variable Zombita writes — gauges, mood, memory, economy, treasury. Browse any table or look up one person across all gauges. Export any table to CSV." />

      <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
        <Btn sm active={mode === "table"} onClick={() => setMode("table")}>By Table</Btn>
        <Btn sm active={mode === "person"} onClick={() => setMode("person")} color="blue">By Person</Btn>
      </div>

      {mode === "person" ? (
        <PersonView toast={toast} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 18, alignItems: "start" }}>
          <div style={{ ...box, maxHeight: "74vh", overflow: "auto" }}>
            {!catalog ? <Load /> : catalog.map(g => (
              <div key={g.group}>
                <div style={{ padding: "10px 12px 4px", fontSize: 9, letterSpacing: 2, color: "var(--muted)", fontFamily: "var(--mono)", textTransform: "uppercase" }}>{g.group}</div>
                {g.tables.map(t => (
                  <div key={t.name} onClick={() => setTable(t.name)}
                    style={{
                      padding: "7px 12px", cursor: "pointer", fontSize: 12,
                      display: "flex", justifyContent: "space-between", gap: 8,
                      borderLeft: `2px solid ${table === t.name ? "var(--accent)" : "transparent"}`,
                      background: table === t.name ? "rgba(200,168,75,0.08)" : "transparent",
                      color: table === t.name ? "var(--accent)" : "var(--textdim)",
                    }}>
                    <span>{t.label}</span>
                    <span style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 10 }}>{t.rows ?? "—"}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <TableView name={table} toast={toast} names={names} />
        </div>
      )}
    </div>
  );
}
