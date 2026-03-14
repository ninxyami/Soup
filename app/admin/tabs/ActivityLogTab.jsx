"use client";
// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { fetchApi, postApi, ADMINS } from "../shared";

const AdminChip = ({ discordId, showName = true }) => {
  const admin = ADMINS[discordId] || { name: "Unknown", color: "#4a5568", initials: "??" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{
        width: 20, height: 20, borderRadius: 10, background: admin.color + "33",
        border: `1px solid ${admin.color}`, display: "inline-flex", alignItems: "center",
        justifyContent: "center", fontSize: 9, fontFamily: "var(--mono)", color: admin.color, flexShrink: 0,
      }}>{admin.initials}</span>
      {showName && <span style={{ color: admin.color, fontSize: 12 }}>{admin.name}</span>}
    </span>
  );
};

const ActionIcon = ({ action }) => {
  const icons = {
    add_mod:      { icon: "➕", color: "var(--green)"   },
    remove_mod:   { icon: "➖", color: "var(--red)"     },
    toggle_mod:   { icon: "⚡", color: "var(--orange)"  },
    edit_ini:     { icon: "📝", color: "var(--blue)"    },
    edit_sandbox: { icon: "🔧", color: "var(--purple)"  },
    backup:       { icon: "💾", color: "var(--accent)"  },
    restore:      { icon: "↩",  color: "var(--orange)"  },
    edit_maps:    { icon: "🗺",  color: "var(--green)"   },
  };
  const a = icons[action] || { icon: "•", color: "var(--textdim)" };
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 4, background: a.color + "15",
      border: `1px solid ${a.color}33`, display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: 14, flexShrink: 0,
    }}>{a.icon}</div>
  );
};

const DiffBadge = ({ old_val, new_val }) => {
  if (old_val === undefined && new_val === undefined) return null;
  const fmt = (v) => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "boolean") return v ? "ON" : "OFF";
    return String(v);
  };
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 11 }}>
      {old_val !== undefined && (
        <span style={{ background: "rgba(224,85,85,.12)", color: "var(--red)", padding: "2px 8px", border: "1px solid rgba(224,85,85,.25)" }}>
          {fmt(old_val)}
        </span>
      )}
      {old_val !== undefined && new_val !== undefined && (
        <span style={{ color: "var(--textdim)" }}>→</span>
      )}
      {new_val !== undefined && (
        <span style={{ background: "rgba(76,175,125,.12)", color: "var(--green)", padding: "2px 8px", border: "1px solid rgba(76,175,125,.25)" }}>
          {fmt(new_val)}
        </span>
      )}
    </div>
  );
};

const SectionBadge = ({ section }) => {
  const colors = {
    mods: "var(--orange)", maps: "var(--green)", server: "var(--blue)",
    world: "var(--accent)", zombies: "var(--red)", skills: "var(--purple)",
    vehicles_animals: "var(--blue)", backup: "var(--accent)",
  };
  const color = colors[section] || "var(--textdim)";
  return (
    <span style={{
      fontSize: 9, fontFamily: "var(--mono)", letterSpacing: 1.5, textTransform: "uppercase",
      padding: "2px 7px", border: `1px solid ${color}44`, color, background: color + "11",
    }}>{section || "system"}</span>
  );
};

const TimeStamp = ({ ts }) => {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - d.getTime();
  const s = Math.floor(diff / 1000);
  const rel = s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`;
  const abs = d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <span title={abs} style={{ fontSize: 11, color: "var(--textdim)", fontFamily: "var(--mono)", cursor: "default" }}>
      {rel}
    </span>
  );
};

const LogEntry = ({ entry, onRevertBackup }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      marginBottom: 4, overflow: "hidden", transition: "border-color .15s",
    }}>
      <div
        onClick={() => entry.changes?.length > 0 && setExpanded(x => !x)}
        style={{
          display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
          cursor: entry.changes?.length > 0 ? "pointer" : "default",
        }}
      >
        <ActionIcon action={entry.action} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <AdminChip discordId={entry.admin_id} />
            <span style={{ fontSize: 12, color: "var(--text)" }}>{entry.description}</span>
            <SectionBadge section={entry.section} />
          </div>
          {entry.changes?.length === 1 && (
            <div style={{ marginTop: 4 }}>
              <DiffBadge old_val={entry.changes[0].old_val} new_val={entry.changes[0].new_val} />
              <span style={{ fontSize: 11, color: "var(--textdim)", marginLeft: 8, fontFamily: "var(--mono)" }}>
                {entry.changes[0].key}
              </span>
            </div>
          )}
          {entry.changes?.length > 1 && (
            <div style={{ marginTop: 4, fontSize: 11, color: "var(--textdim)", fontFamily: "var(--mono)" }}>
              {entry.changes.length} changes {expanded ? "▲" : "▼"}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {entry.backup_file && (
            <button onClick={(e) => { e.stopPropagation(); onRevertBackup(entry.backup_file); }}
              style={{
                padding: "4px 10px", fontSize: 10, fontFamily: "var(--mono)", letterSpacing: 1,
                background: "rgba(212,135,58,.1)", border: "1px solid rgba(212,135,58,.4)",
                color: "var(--orange)", cursor: "pointer",
              }}>
              ↩ Revert
            </button>
          )}
          <TimeStamp ts={entry.created_at} />
        </div>
      </div>

      {expanded && entry.changes?.length > 1 && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "10px 16px 12px 60px", background: "rgba(0,0,0,.15)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {entry.changes.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "var(--textdim)", fontFamily: "var(--mono)", minWidth: 120 }}>{c.key}</span>
                <DiffBadge old_val={c.old_val} new_val={c.new_val} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const BackupCard = ({ backup, onRestore, isBusy }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
    background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 6,
  }}>
    <div style={{ fontSize: 18 }}>💾</div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12, fontFamily: "var(--mono)", color: "var(--text)" }}>{backup.filename}</div>
      <div style={{ fontSize: 11, color: "var(--textdim)", marginTop: 2 }}>
        {backup.label && <span style={{ marginRight: 8, color: "var(--accent)" }}>{backup.label}</span>}
        <TimeStamp ts={backup.created_at} />
        {backup.size && <span style={{ marginLeft: 8 }}>{Math.round(backup.size / 1024)}KB</span>}
      </div>
    </div>
    <button onClick={() => onRestore(backup.filename)} disabled={isBusy}
      style={{
        padding: "6px 14px", fontSize: 10, fontFamily: "var(--mono)", letterSpacing: 1,
        background: "rgba(212,135,58,.1)", border: "1px solid rgba(212,135,58,.5)",
        color: isBusy ? "var(--textdim)" : "var(--orange)", cursor: isBusy ? "not-allowed" : "pointer",
      }}>
      {isBusy ? "Restoring..." : "↩ Restore This"}
    </button>
  </div>
);

export default function ActivityLogTab({ toast }) {
  const [logs, setLogs] = useState([]);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState("activity");
  const [filterSection, setFilterSection] = useState("all");
  const [filterAdmin, setFilterAdmin] = useState("all");
  const [restoring, setRestoring] = useState(false);
  const [page, setPage] = useState(0);
  const PER_PAGE = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, b] = await Promise.all([
        fetchApi("/api/admin/config/log"),
        fetchApi("/api/admin/config/backups"),
      ]);
      setLogs(l.entries || []);
      setBackups(b.backups || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const revertBackup = async (filename) => {
    if (!confirm(`Restore backup "${filename}"? Current settings will be overwritten.`)) return;
    setRestoring(true);
    try {
      await postApi("/api/admin/config/restore", { filename });
      toast(`Restored from ${filename}`, "success");
      load();
    } catch (e) { toast(e.message, "error"); }
    setRestoring(false);
  };

  const allSections = ["all", ...new Set(logs.map(l => l.section).filter(Boolean))];
  const allAdmins = ["all", ...new Set(logs.map(l => l.admin_id).filter(Boolean))];

  const filtered = logs.filter(l => {
    if (filterSection !== "all" && l.section !== filterSection) return false;
    if (filterAdmin !== "all" && String(l.admin_id) !== String(filterAdmin)) return false;
    return true;
  });

  const paginated = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  // Live stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = logs.filter(l => new Date(l.created_at) >= today).length;
  const lastEditor = logs[0]?.admin_id;
  const sectionCounts = logs.reduce((acc, l) => { acc[l.section] = (acc[l.section] || 0) + 1; return acc; }, {});
  const topSection = Object.entries(sectionCounts).sort((a, b) => b[1] - a[1])[0];

  const subTabs = [
    { key: "activity", label: "📋 Activity Feed" },
    { key: "backups",  label: "💾 Backups (last 10)" },
  ];

  return (
    <>
      <div style={{ fontFamily: "var(--display)", fontSize: 36, letterSpacing: 4, color: "var(--accent)", marginBottom: 4 }}>ACTIVITY LOG</div>
      <div style={{ color: "var(--textdim)", fontSize: 12, marginBottom: 20, fontFamily: "var(--mono)" }}>who changed what · when · diffs · backup restore</div>

      {/* Live stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 24 }}>
        {[
          { label: "Total Changes", value: logs.length, color: "var(--accent)" },
          { label: "Today", value: todayCount, color: "var(--green)" },
          { label: "Last Editor", value: lastEditor ? (ADMINS[lastEditor]?.name || "Unknown") : "—", color: lastEditor ? (ADMINS[lastEditor]?.color || "var(--textdim)") : "var(--textdim)" },
          { label: "Most Changed", value: topSection ? `${topSection[0]} (${topSection[1]})` : "—", color: "var(--blue)" },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "12px 16px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: s.color }} />
            <div style={{ fontSize: 9, letterSpacing: 2, color: "var(--textdim)", fontFamily: "var(--mono)" }}>{s.label}</div>
            <div style={{ fontFamily: "var(--display)", fontSize: 22, letterSpacing: 2, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Sub tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)" }}>
        {subTabs.map(t => (
          <button key={t.key} onClick={() => setSub(t.key)}
            style={{
              padding: "8px 18px", fontSize: 11, fontFamily: "var(--mono)", letterSpacing: 1, textTransform: "uppercase",
              background: sub === t.key ? "rgba(200,168,75,0.08)" : "transparent", border: "none",
              borderBottom: sub === t.key ? "2px solid var(--accent)" : "2px solid transparent",
              color: sub === t.key ? "var(--accent)" : "var(--textdim)", cursor: "pointer",
            }}>{t.label}</button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, paddingBottom: 8 }}>
          <button onClick={load} style={{
            padding: "5px 12px", fontSize: 10, fontFamily: "var(--mono)", letterSpacing: 1,
            background: "transparent", border: "1px solid var(--border)", color: "var(--textdim)", cursor: "pointer",
          }}>↻ Refresh</button>
        </div>
      </div>

      {sub === "activity" && <>
        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <select value={filterSection} onChange={e => { setFilterSection(e.target.value); setPage(0); }}
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "7px 10px", fontFamily: "var(--mono)", fontSize: 11 }}>
            {allSections.map(s => <option key={s} value={s}>{s === "all" ? "All Sections" : s}</option>)}
          </select>
          <select value={filterAdmin} onChange={e => { setFilterAdmin(e.target.value); setPage(0); }}
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "7px 10px", fontFamily: "var(--mono)", fontSize: 11 }}>
            <option value="all">All Admins</option>
            {allAdmins.filter(a => a !== "all").map(a => (
              <option key={a} value={a}>{ADMINS[a]?.name || a}</option>
            ))}
          </select>
          <div style={{ fontSize: 11, color: "var(--textdim)", fontFamily: "var(--mono)", padding: "7px 4px" }}>
            {filtered.length} entries
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--textdim)", fontFamily: "var(--mono)" }}>Loading activity...</div>
        ) : paginated.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div style={{ color: "var(--textdim)", fontFamily: "var(--mono)", fontSize: 12 }}>No activity yet. Changes made through this panel will appear here.</div>
          </div>
        ) : (
          <>
            {paginated.map((entry, i) => (
              <LogEntry key={entry.id || i} entry={entry} onRevertBackup={revertBackup} />
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  style={{ padding: "6px 14px", fontSize: 11, fontFamily: "var(--mono)", background: "transparent", border: "1px solid var(--border)", color: "var(--textdim)", cursor: page > 0 ? "pointer" : "not-allowed" }}>
                  ← Prev
                </button>
                <span style={{ padding: "6px 14px", fontSize: 11, fontFamily: "var(--mono)", color: "var(--textdim)", background: "var(--surface)", border: "1px solid var(--border)" }}>
                  {page + 1} / {totalPages}
                </span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  style={{ padding: "6px 14px", fontSize: 11, fontFamily: "var(--mono)", background: "transparent", border: "1px solid var(--border)", color: "var(--textdim)", cursor: page < totalPages - 1 ? "pointer" : "not-allowed" }}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </>}

      {sub === "backups" && <>
        <div style={{ padding: "12px 16px", background: "rgba(200,168,75,0.05)", border: "1px solid rgba(200,168,75,0.2)", marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--mono)" }}>
            ⚠ Restoring a backup will overwrite the current servertest.ini or SandboxVars.lua. A pre-restore backup is created automatically. The server must be restarted after restoring.
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--textdim)", fontFamily: "var(--mono)" }}>Loading backups...</div>
        ) : backups.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💾</div>
            <div style={{ color: "var(--textdim)", fontFamily: "var(--mono)", fontSize: 12 }}>No backups found. Backups are created automatically each time you save settings.</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 11, color: "var(--textdim)", fontFamily: "var(--mono)", marginBottom: 12 }}>
              Last {backups.length} backups shown — older ones are auto-deleted
            </div>
            {backups.map((b, i) => (
              <BackupCard key={b.filename || i} backup={b} onRestore={revertBackup} isBusy={restoring} />
            ))}
          </div>
        )}
      </>}
    </>
  );
}
