"use client";
// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchApi, postApi, Btn, ADMINS } from "./shared";

// ── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const relTime = (ts) => {
  if (!ts) return "";
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
const fmtDateShort = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};
const COLUMNS = [
  { id: "backlog",     label: "Backlog",     color: "var(--textdim)" },
  { id: "in_progress", label: "In Progress", color: "var(--blue)"    },
  { id: "testing",     label: "Testing",     color: "var(--orange)"  },
  { id: "done",        label: "Done",        color: "var(--green)"   },
];
const CATEGORIES = ["Mod", "Event", "Story", "Server", "Economy", "Map", "Bug", "Other"];
const PRIORITIES = ["low", "medium", "high", "urgent"];
const PRIORITY_COLORS = { low: "var(--textdim)", medium: "var(--blue)", high: "var(--orange)", urgent: "var(--red)" };

const ADMIN_LIST = Object.entries(ADMINS).map(([id, a]) => ({ id, ...a }));

// ── Storage key (localStorage replacement: we keep state in memory + API) ────
// For now frontend-only: tasks stored in state, persisted via API when backend is ready.
// Each task: { id, title, description, column, category, priority, assignee, dueDate, createdAt, createdBy, comments: [], history: [] }

// ── AdminAvatar (same as ModsMapTab) ─────────────────────────────────────────
const AdminAvatar = ({ discordId, size = 24 }) => {
  const admin = ADMINS[discordId] || { name: "Unknown", color: "#4a5568", initials: "??" };
  return (
    <div title={admin.name} style={{
      width: size, height: size, borderRadius: size / 2,
      background: admin.color + "33", border: `1px solid ${admin.color}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontFamily: "var(--mono)", color: admin.color,
      flexShrink: 0, letterSpacing: 0,
    }}>
      {admin.initials}
    </div>
  );
};

// ── TaskCard ─────────────────────────────────────────────────────────────────
const TaskCard = ({ task, onEdit, onMove, onDelete, dragHandlers }) => {
  const admin = ADMINS[task.assignee] || null;
  const priColor = PRIORITY_COLORS[task.priority] || "var(--textdim)";
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.column !== "done";

  return (
    <div
      draggable
      {...dragHandlers}
      style={{
        background: "var(--surface2)",
        border: `1px solid ${isOverdue ? "var(--red)" : "var(--border)"}`,
        padding: "10px 12px",
        cursor: "grab",
        transition: "all .15s",
        position: "relative",
        overflow: "hidden",
      }}
      onDoubleClick={() => onEdit(task)}
    >
      {/* Priority stripe */}
      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, background: priColor }} />

      {/* Category + priority */}
      <div style={{ display: "flex", gap: 4, marginBottom: 6, marginLeft: 6, flexWrap: "wrap" }}>
        <span style={{
          fontSize: 8, fontFamily: "var(--mono)", letterSpacing: 1.2, textTransform: "uppercase",
          padding: "1px 5px", background: "rgba(200,168,75,0.1)", color: "var(--accent)", border: "1px solid rgba(200,168,75,0.2)",
        }}>{task.category}</span>
        {task.priority !== "medium" && (
          <span style={{
            fontSize: 8, fontFamily: "var(--mono)", letterSpacing: 1.2, textTransform: "uppercase",
            padding: "1px 5px", background: priColor + "18", color: priColor, border: `1px solid ${priColor}33`,
          }}>{task.priority}</span>
        )}
      </div>

      {/* Title */}
      <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 500, lineHeight: 1.4, marginLeft: 6, marginBottom: 6 }}>
        {task.title}
      </div>

      {/* Footer: assignee + due date */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginLeft: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {admin && <AdminAvatar discordId={task.assignee} size={18} />}
          {!admin && task.assignee && <span style={{ fontSize: 9, color: "var(--textdim)" }}>Unassigned</span>}
        </div>
        {task.dueDate && (
          <span style={{
            fontSize: 9, fontFamily: "var(--mono)", letterSpacing: 1,
            color: isOverdue ? "var(--red)" : "var(--textdim)",
            padding: "1px 5px", background: isOverdue ? "rgba(224,85,85,0.1)" : "transparent",
          }}>
            {isOverdue ? "⚠ " : ""}{fmtDateShort(task.dueDate)}
          </span>
        )}
      </div>

      {/* Comment count */}
      {task.comments?.length > 0 && (
        <div style={{ position: "absolute", top: 8, right: 8, fontSize: 9, color: "var(--textdim)", fontFamily: "var(--mono)" }}>
          💬 {task.comments.length}
        </div>
      )}
    </div>
  );
};

// ── Task Edit Modal ──────────────────────────────────────────────────────────
const TaskModal = ({ task, onSave, onDelete, onClose, currentUser }) => {
  const [form, setForm] = useState({
    title: task?.title || "",
    description: task?.description || "",
    column: task?.column || "backlog",
    category: task?.category || "Other",
    priority: task?.priority || "medium",
    assignee: task?.assignee || "",
    dueDate: task?.dueDate || "",
  });
  const [comment, setComment] = useState("");
  const isNew = !task?.id;

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = () => {
    if (!form.title.trim()) return;
    onSave({
      ...(task || {}),
      ...form,
      id: task?.id || uid(),
      createdAt: task?.createdAt || new Date().toISOString(),
      createdBy: task?.createdBy || currentUser,
      comments: task?.comments || [],
      history: [
        ...(task?.history || []),
        { action: isNew ? "created" : "edited", by: currentUser, at: new Date().toISOString() },
      ],
    });
  };

  const addComment = () => {
    if (!comment.trim()) return;
    const updatedTask = {
      ...task,
      ...form,
      comments: [...(task?.comments || []), { by: currentUser, text: comment, at: new Date().toISOString() }],
    };
    onSave(updatedTask);
    setComment("");
  };

  const selectStyle = {
    width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
    color: "var(--text)", padding: "8px 10px", fontFamily: "var(--mono)", fontSize: 12,
    cursor: "pointer", outline: "none",
  };
  const inputStyle = { ...selectStyle, cursor: "text" };
  const labelStyle = { fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--textdim)", fontFamily: "var(--mono)", marginBottom: 4 };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 300,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "#0f1318", border: "1px solid var(--accent)", width: 580, maxWidth: "95vw",
        maxHeight: "90vh", overflowY: "auto", padding: 28, position: "relative",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--accent)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "var(--display)", fontSize: 22, letterSpacing: 3, color: "var(--accent)" }}>
            {isNew ? "NEW TASK" : "EDIT TASK"}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--textdim)", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Title */}
          <div>
            <div style={labelStyle}>Title</div>
            <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="What needs to be done?"
              style={inputStyle} autoFocus />
          </div>

          {/* Description */}
          <div>
            <div style={labelStyle}>Description</div>
            <textarea value={form.description} onChange={e => set("description", e.target.value)}
              placeholder="Details, context, links..."
              style={{ ...inputStyle, resize: "vertical", minHeight: 80, cursor: "text" }} />
          </div>

          {/* 2x2 grid: column, category, priority, assignee */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={labelStyle}>Status</div>
              <select value={form.column} onChange={e => set("column", e.target.value)} style={selectStyle}>
                {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Category</div>
              <select value={form.category} onChange={e => set("category", e.target.value)} style={selectStyle}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Priority</div>
              <select value={form.priority} onChange={e => set("priority", e.target.value)} style={selectStyle}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Assignee</div>
              <select value={form.assignee} onChange={e => set("assignee", e.target.value)} style={selectStyle}>
                <option value="">Unassigned</option>
                {ADMIN_LIST.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          {/* Due date */}
          <div>
            <div style={labelStyle}>Due Date</div>
            <input type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Comments (only for existing tasks) */}
        {!isNew && (
          <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--textdim)", fontFamily: "var(--mono)", marginBottom: 10 }}>
              Comments ({task?.comments?.length || 0})
            </div>
            {(task?.comments || []).map((c, i) => {
              const ca = ADMINS[c.by] || { name: "Unknown", color: "#4a5568" };
              return (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, padding: "8px 10px", background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <AdminAvatar discordId={c.by} size={20} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                      <span style={{ fontSize: 11, color: ca.color, fontWeight: 500 }}>{ca.name}</span>
                      <span style={{ fontSize: 9, color: "var(--textdim)", fontFamily: "var(--mono)" }}>{relTime(c.at)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.4 }}>{c.text}</div>
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment..."
                style={{ flex: 1, ...inputStyle }} onKeyDown={e => e.key === "Enter" && addComment()} />
              <Btn color="blue" sm onClick={addComment}>Post</Btn>
            </div>
          </div>
        )}

        {/* History (only for existing tasks) */}
        {!isNew && task?.history?.length > 0 && (
          <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--textdim)", fontFamily: "var(--mono)", marginBottom: 6 }}>
              History
            </div>
            {task.history.slice(-5).reverse().map((h, i) => {
              const ha = ADMINS[h.by] || { name: "Unknown", color: "#4a5568" };
              return (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", padding: "3px 0", fontSize: 11 }}>
                  <span style={{ color: ha.color }}>{ha.name}</span>
                  <span style={{ color: "var(--textdim)" }}>{h.action}</span>
                  <span style={{ color: "var(--textdim)", fontFamily: "var(--mono)", fontSize: 9 }}>{relTime(h.at)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
          <div>
            {!isNew && <Btn color="red" sm onClick={() => { onDelete(task.id); onClose(); }}>Delete Task</Btn>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn color="ghost" onClick={onClose}>Cancel</Btn>
            <Btn color="green" onClick={submit} disabled={!form.title.trim()}>
              {isNew ? "➕ Create Task" : "💾 Save Changes"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Kanban Column ────────────────────────────────────────────────────────────
const KanbanColumn = ({ column, tasks, onEdit, onMove, onDelete, onDrop, dragState, setDragState }) => {
  const isOver = dragState.overColumn === column.id;

  return (
    <div
      style={{
        flex: 1, minWidth: 240, display: "flex", flexDirection: "column",
        background: isOver ? "rgba(200,168,75,0.03)" : "transparent",
        border: `1px solid ${isOver ? "rgba(200,168,75,0.3)" : "var(--border)"}`,
        transition: "all .15s",
      }}
      onDragOver={e => { e.preventDefault(); setDragState(s => ({ ...s, overColumn: column.id })); }}
      onDragLeave={() => setDragState(s => ({ ...s, overColumn: null }))}
      onDrop={e => { e.preventDefault(); onDrop(column.id); setDragState({ dragging: null, overColumn: null }); }}
    >
      {/* Column header */}
      <div style={{
        padding: "10px 14px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(0,0,0,.2)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: column.color }} />
          <span style={{ fontSize: 10, fontFamily: "var(--mono)", letterSpacing: 2, textTransform: "uppercase", color: column.color }}>
            {column.label}
          </span>
        </div>
        <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--textdim)", background: "var(--surface2)", padding: "2px 8px", borderRadius: 2 }}>
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6, flex: 1, minHeight: 100, overflowY: "auto" }}>
        {tasks.map(t => (
          <TaskCard
            key={t.id}
            task={t}
            onEdit={onEdit}
            onMove={onMove}
            onDelete={onDelete}
            dragHandlers={{
              onDragStart: () => setDragState({ dragging: t.id, overColumn: null }),
              onDragEnd: () => setDragState({ dragging: null, overColumn: null }),
            }}
          />
        ))}
        {tasks.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", fontSize: 11, color: "var(--textdim)", fontFamily: "var(--mono)", opacity: 0.5 }}>
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
};

// ── Season Timeline ──────────────────────────────────────────────────────────
const SEASON_DATA = {
  start: "2026-03-10",
  end: "2026-04-27",
  chapters: [
    { name: "Prologue",          start: "2026-03-10", end: "2026-03-16", subtitle: "The County That Went Quiet" },
    { name: "Chapter 1",         start: "2026-03-17", end: "2026-03-23", subtitle: "The Dead Don't Stay Dead" },
    { name: "Chapter 2",         start: "2026-03-24", end: "2026-03-30", subtitle: "The Cost of Survival" },
    { name: "Chapter 3",         start: "2026-03-31", end: "2026-04-06", subtitle: "Echoes of the Old World" },
    { name: "Chapter 4",         start: "2026-04-07", end: "2026-04-13", subtitle: "Lines in the Sand" },
    { name: "Chapter 5",         start: "2026-04-14", end: "2026-04-20", subtitle: "The Reckoning" },
    { name: "Finale",            start: "2026-04-21", end: "2026-04-27", subtitle: "The Grand Dilemma" },
  ],
  events: {
    lore: "Tuesday", horde: "Saturday", news: "Thursday",
  },
};

const SeasonTimeline = () => {
  const today = new Date();
  const start = new Date(SEASON_DATA.start);
  const end = new Date(SEASON_DATA.end);
  const totalDays = Math.ceil((end - start) / 86400000);
  const currentDay = Math.ceil((today - start) / 86400000);
  const progress = Math.max(0, Math.min(100, (currentDay / totalDays) * 100));

  return (
    <div>
      {/* Progress bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--accent)" }}>
            Season 2 Progress — Day {Math.max(0, currentDay)} / {totalDays}
          </span>
          <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--textdim)" }}>
            {Math.round(progress)}%
          </span>
        </div>
        <div style={{ height: 6, background: "var(--surface2)", border: "1px solid var(--border)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "var(--accent)", transition: "width .5s", boxShadow: "0 0 8px rgba(200,168,75,.4)" }} />
        </div>
      </div>

      {/* Chapter timeline */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {SEASON_DATA.chapters.map((ch, i) => {
          const chStart = new Date(ch.start);
          const chEnd = new Date(ch.end);
          const isActive = today >= chStart && today <= chEnd;
          const isPast = today > chEnd;

          return (
            <div key={i} style={{
              flex: 1, padding: "10px 8px",
              background: isActive ? "rgba(200,168,75,0.08)" : isPast ? "rgba(76,175,125,0.04)" : "var(--surface)",
              border: `1px solid ${isActive ? "var(--accent)" : isPast ? "rgba(76,175,125,0.2)" : "var(--border)"}`,
              position: "relative", overflow: "hidden",
            }}>
              {isActive && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--accent)" }} />}
              {isPast && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--green)" }} />}
              <div style={{ fontSize: 9, fontFamily: "var(--mono)", letterSpacing: 1.5, color: isActive ? "var(--accent)" : isPast ? "var(--green)" : "var(--textdim)", textTransform: "uppercase", marginBottom: 2 }}>
                {ch.name}{isActive ? " ●" : isPast ? " ✓" : ""}
              </div>
              <div style={{ fontSize: 10, color: "var(--text)", lineHeight: 1.3, marginBottom: 4 }}>{ch.subtitle}</div>
              <div style={{ fontSize: 9, fontFamily: "var(--mono)", color: "var(--textdim)" }}>
                {fmtDateShort(ch.start)} — {fmtDateShort(ch.end)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Weekly events legend */}
      <div style={{ display: "flex", gap: 16, padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>📜</span>
          <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--textdim)" }}>Lore Drops — Every Tuesday</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>🧟</span>
          <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--textdim)" }}>Horde Events — Every Saturday</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>📰</span>
          <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--textdim)" }}>News Bulletins — Every Thursday</span>
        </div>
      </div>
    </div>
  );
};

// ── Admin Checklist ──────────────────────────────────────────────────────────
const CHECKLIST_SEED = [
  { group: "PRE-LAUNCH", items: [
    "Configure & Test Server", "Finalize Lore & Story Assets", "Plan Events & Achievements",
    "Welcome Materials", "Teasers & Announcements", "Q&A Setup",
  ]},
  { group: "LAUNCH WEEK", items: [
    "Server Launch", "Communication Blast", "Launch Announcement",
    "Player Orientation", "Monitor Feedback & Performance",
  ]},
  { group: "RUNNING", items: [
    "Weekly Lore Drops (Tuesdays)", "HTC Horde Events (Saturdays)",
    "Abandoned News Bulletins (Thursdays)", "Outpost Progress Updates", "Community Events",
  ]},
  { group: "ENDING", items: [
    "Final Lore Revelation", "The Final Stand", "Acknowledge Achievements",
    "Feedback Form", "Post-Game Highlights", "Debrief / Plan Season 3",
  ]},
];

const AdminChecklist = ({ checks, setChecks }) => {
  const toggle = (group, item) => {
    const key = `${group}::${item}`;
    setChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {CHECKLIST_SEED.map(g => {
        const doneCount = g.items.filter(i => checks[`${g.group}::${i}`]).length;
        return (
          <div key={g.group} style={{ background: "var(--surface)", border: "1px solid var(--border)", overflow: "hidden" }}>
            <div style={{
              padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,.2)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 10, fontFamily: "var(--mono)", letterSpacing: 2, textTransform: "uppercase", color: "var(--accent)" }}>{g.group}</span>
              <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: doneCount === g.items.length ? "var(--green)" : "var(--textdim)" }}>
                {doneCount}/{g.items.length}
              </span>
            </div>
            {g.items.map(item => {
              const key = `${g.group}::${item}`;
              const done = checks[key];
              return (
                <div key={item} onClick={() => toggle(g.group, item)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 14px",
                    borderBottom: "1px solid rgba(30,37,48,.3)", cursor: "pointer",
                    transition: "background .1s",
                  }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: 2, flexShrink: 0,
                    background: done ? "var(--green)" : "transparent",
                    border: `1px solid ${done ? "var(--green)" : "var(--border)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: "#fff",
                  }}>{done ? "✓" : ""}</div>
                  <span style={{
                    fontSize: 12, color: done ? "var(--textdim)" : "var(--text)",
                    textDecoration: done ? "line-through" : "none",
                  }}>{item}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

// ── Mod Changelog ────────────────────────────────────────────────────────────
const ModChangelog = ({ log }) => {
  if (!log.length) return (
    <div style={{ padding: 32, textAlign: "center", color: "var(--textdim)", fontFamily: "var(--mono)", fontSize: 12 }}>
      No mod changes recorded yet. Changes will appear here when mods are added or removed through the Mods & Maps tab.
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {log.map((entry, i) => {
        const admin = ADMINS[entry.by] || { name: "Unknown", color: "#4a5568", initials: "??" };
        const actionColors = { added: "var(--green)", removed: "var(--red)", toggled: "var(--orange)", edited: "var(--blue)" };
        return (
          <div key={i} style={{
            display: "flex", gap: 10, alignItems: "center", padding: "8px 14px",
            background: "var(--surface)", border: "1px solid var(--border)",
          }}>
            <AdminAvatar discordId={entry.by} size={22} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12 }}>
                <span style={{ color: admin.color, fontWeight: 500 }}>{admin.name}</span>
                <span style={{ color: actionColors[entry.action] || "var(--textdim)", fontFamily: "var(--mono)", fontSize: 10, marginLeft: 6, letterSpacing: 1, textTransform: "uppercase" }}>{entry.action}</span>
                <span style={{ color: "var(--text)", marginLeft: 6 }}>{entry.modName}</span>
                {entry.workshopId && <span style={{ color: "var(--textdim)", fontFamily: "var(--mono)", fontSize: 10, marginLeft: 6 }}>({entry.workshopId})</span>}
              </div>
            </div>
            <span style={{ fontSize: 9, fontFamily: "var(--mono)", color: "var(--textdim)" }}>{relTime(entry.at)}</span>
          </div>
        );
      })}
    </div>
  );
};

// ── Main Planner Tab ─────────────────────────────────────────────────────────
export default function PlannerTab({ toast, initialTab }) {
  const [sub, setSub] = useState(initialTab || "board");

  // Sync sub-tab when sidebar nav changes the prop
  useEffect(() => { if (initialTab) setSub(initialTab); }, [initialTab]);
  const [tasks, setTasks] = useState([]);
  const [editTask, setEditTask] = useState(null); // null | "new" | task object
  const [checks, setChecks] = useState({});
  const [modLog, setModLog] = useState([]);
  const [filterCat, setFilterCat] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [dragState, setDragState] = useState({ dragging: null, overColumn: null });

  // Load from API (or fall back to empty for now since backend isn't ready)
  const load = useCallback(async () => {
    try {
      const d = await fetchApi("/api/admin/planner/tasks");
      setTasks(d.tasks || []);
      setChecks(d.checks || {});
    } catch {
      // Backend not ready yet — use empty state
    }
    try {
      const d = await fetchApi("/api/admin/planner/modlog");
      setModLog(d.log || []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  // Save helper (will POST to API when backend is ready, for now just updates state)
  const saveTasks = useCallback(async (newTasks) => {
    setTasks(newTasks);
    try {
      await postApi("/api/admin/planner/tasks", { tasks: newTasks, checks });
    } catch {} // Backend not ready — that's fine
  }, [checks]);

  const saveChecks = useCallback(async (newChecks) => {
    setChecks(newChecks);
    try {
      await postApi("/api/admin/planner/tasks", { tasks, checks: newChecks });
    } catch {}
  }, [tasks]);

  // Fake current user (will come from session when backend is wired)
  const currentUser = "228533264174940160"; // Nin Nin as default

  const handleSaveTask = (task) => {
    const idx = tasks.findIndex(t => t.id === task.id);
    let newTasks;
    if (idx >= 0) {
      newTasks = [...tasks];
      newTasks[idx] = task;
    } else {
      newTasks = [...tasks, task];
    }
    saveTasks(newTasks);
    setEditTask(null);
    toast(idx >= 0 ? "Task updated" : "Task created", "success");
  };

  const handleDeleteTask = (id) => {
    saveTasks(tasks.filter(t => t.id !== id));
    toast("Task deleted", "info");
  };

  const handleDrop = (columnId) => {
    if (!dragState.dragging) return;
    const newTasks = tasks.map(t =>
      t.id === dragState.dragging ? { ...t, column: columnId, history: [...(t.history || []), { action: `moved to ${columnId}`, by: currentUser, at: new Date().toISOString() }] } : t
    );
    saveTasks(newTasks);
  };

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    if (filterCat !== "all" && t.category !== filterCat) return false;
    if (filterAssignee !== "all" && t.assignee !== filterAssignee) return false;
    return true;
  });

  const subTabs = [
    { key: "board",     label: "📋 Task Board" },
    { key: "timeline",  label: "📅 Season Timeline" },
    { key: "checklist", label: "✅ Admin Checklist" },
    { key: "modlog",    label: "📦 Mod Changelog" },
  ];

  return (
    <>
      {editTask && (
        <TaskModal
          task={editTask === "new" ? null : editTask}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onClose={() => setEditTask(null)}
          currentUser={currentUser}
        />
      )}

      <div style={{ fontFamily: "var(--display)", fontSize: 36, letterSpacing: 4, color: "var(--accent)", marginBottom: 4 }}>
        MISSION PLANNER
      </div>
      <div style={{ color: "var(--textdim)", fontSize: 12, marginBottom: 24, fontFamily: "var(--mono)" }}>
        task board · season timeline · admin checklist · mod changelog
      </div>

      {/* Sub tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--border)" }}>
        {subTabs.map(t => (
          <button key={t.key} onClick={() => setSub(t.key)}
            style={{
              padding: "8px 18px", fontSize: 11, fontFamily: "var(--mono)", letterSpacing: 1, textTransform: "uppercase",
              background: sub === t.key ? "rgba(200,168,75,0.08)" : "transparent",
              border: "none", borderBottom: sub === t.key ? "2px solid var(--accent)" : "2px solid transparent",
              color: sub === t.key ? "var(--accent)" : "var(--textdim)", cursor: "pointer",
            }}>{t.label}</button>
        ))}
      </div>

      {/* ── Task Board ── */}
      {sub === "board" && <>
        {/* Controls */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "7px 10px", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer" }}>
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "7px 10px", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer" }}>
            <option value="all">All Admins</option>
            {ADMIN_LIST.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Btn color="ghost" sm onClick={load}>↻ Refresh</Btn>
            <Btn color="green" onClick={() => setEditTask("new")}>➕ New Task</Btn>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {COLUMNS.map(col => {
            const count = filteredTasks.filter(t => t.column === col.id).length;
            return (
              <div key={col.id} style={{ flex: 1, padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--border)", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontFamily: "var(--display)", letterSpacing: 2, color: col.color }}>{count}</div>
                <div style={{ fontSize: 9, fontFamily: "var(--mono)", letterSpacing: 1.5, color: "var(--textdim)", textTransform: "uppercase" }}>{col.label}</div>
              </div>
            );
          })}
        </div>

        {/* Kanban columns */}
        <div style={{ display: "flex", gap: 8, alignItems: "stretch", minHeight: 400 }}>
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              column={col}
              tasks={filteredTasks.filter(t => t.column === col.id)}
              onEdit={setEditTask}
              onMove={(id, newCol) => handleDrop(newCol)}
              onDelete={handleDeleteTask}
              onDrop={handleDrop}
              dragState={dragState}
              setDragState={setDragState}
            />
          ))}
        </div>

        <div style={{ marginTop: 10, fontSize: 11, color: "var(--textdim)", fontFamily: "var(--mono)" }}>
          Drag cards between columns · Double-click to edit · {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""} shown
        </div>
      </>}

      {/* ── Season Timeline ── */}
      {sub === "timeline" && <SeasonTimeline />}

      {/* ── Admin Checklist ── */}
      {sub === "checklist" && (
        <AdminChecklist checks={checks} setChecks={(newChecks) => saveChecks(newChecks)} />
      )}

      {/* ── Mod Changelog ── */}
      {sub === "modlog" && <ModChangelog log={modLog} />}
    </>
  );
}
