"use client";
// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { API, B, Title, useStickyState } from "./shared";
import CodeMirror from "@uiw/react-codemirror";
import { langs } from "@uiw/codemirror-extensions-langs";
import { tokyoNight } from "@uiw/codemirror-theme-tokyo-night";

// ── Map file extension → CodeMirror language extension ────────────────────────
function langFor(name = "") {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  const map = {
    ".lua": langs.lua, ".json": langs.json, ".js": langs.javascript,
    ".jsx": langs.jsx, ".ts": langs.typescript, ".tsx": langs.tsx,
    ".py": langs.python, ".html": langs.html, ".css": langs.css,
    ".xml": langs.xml, ".yml": langs.yaml, ".yaml": langs.yaml,
    ".sh": langs.shell, ".sql": langs.sql, ".md": langs.markdown,
    ".ini": langs.properties, ".cfg": langs.properties,
    ".conf": langs.properties, ".properties": langs.properties,
    ".toml": langs.toml,
  };
  const fn = map[ext];
  try { return fn ? [fn()] : []; } catch { return []; }
}

const fmtBytes = (n) => {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};
const fmtTime = (t) =>
  t ? new Date(t * 1000).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "—";

const fileIcon = (e) => {
  if (e.is_dir) return "📁";
  const ext = e.name.slice(e.name.lastIndexOf(".")).toLowerCase();
  if ([".ini", ".cfg", ".conf", ".properties", ".env", ".service"].includes(ext)) return "⚙️";
  if (ext === ".lua") return "🌙";
  if ([".json", ".yml", ".yaml", ".toml"].includes(ext)) return "🗂️";
  if ([".log", ".txt", ".md"].includes(ext)) return "📄";
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(ext)) return "🖼️";
  if ([".zip", ".gz", ".tar", ".7z", ".rar"].includes(ext)) return "📦";
  if ([".sh", ".py", ".js", ".ts"].includes(ext)) return "📜";
  return "📄";
};

export default function FilesTab({ toast }) {
  const [path, setPath] = useStickyState("/home/zomboid", "files.path");
  const [data, setData] = useState(null);   // { path, parent, entries }
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // editor state
  const [editing, setEditing] = useState(null); // { path, name, content, ext }
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);

  const fileInputRef = useRef(null);

  const notify = (m, kind = "info") => toast?.(m, kind);

  // ── Load directory ──────────────────────────────────────────────────────────
  const load = useCallback(async (p) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/files/list?path=${encodeURIComponent(p)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      notify(`Couldn't open ${p}: ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => { load(path); }, [path, load]);

  const go = (p) => { if (p) setPath(p); };

  // ── Breadcrumb segments ─────────────────────────────────────────────────────
  const crumbs = (() => {
    const cur = data?.path || path;
    const parts = cur.split("/").filter(Boolean);
    const out = [{ label: "/", path: "/" }];
    let acc = "";
    for (const part of parts) { acc += "/" + part; out.push({ label: part, path: acc }); }
    return out;
  })();

  // ── Open a file in the editor ───────────────────────────────────────────────
  const openFile = async (e) => {
    if (!e.editable) {
      notify(`${e.name} isn't an editable text file — use Download.`, "info");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/admin/files/read?path=${encodeURIComponent(e.path)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const f = await res.json();
      setEditing(f);
      setDraft(f.content);
      setDirty(false);
    } catch (err) {
      notify(`Can't open ${e.name}: ${err.message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const saveFile = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/admin/files/write`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: editing.path, content: draft }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      notify(`Saved ${editing.name}`, "success");
      setDirty(false);
      load(path);
    } catch (err) {
      notify(`Save failed: ${err.message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const closeEditor = () => {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    setEditing(null); setDraft(""); setDirty(false);
  };

  // ── Mutations ───────────────────────────────────────────────────────────────
  const post = async (endpoint, body) => {
    const res = await fetch(`${API}/api/admin/files/${endpoint}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  };

  const newFolder = async () => {
    const name = prompt("New folder name:");
    if (!name) return;
    setBusy(true);
    try {
      await post("mkdir", { path: `${data.path}/${name}` });
      notify(`Created ${name}`, "success");
      load(path);
    } catch (e) { notify(e.message, "error"); } finally { setBusy(false); }
  };

  const newFile = async () => {
    const name = prompt("New file name (e.g. notes.txt):");
    if (!name) return;
    setBusy(true);
    try {
      await post("write", { path: `${data.path}/${name}`, content: "" });
      notify(`Created ${name}`, "success");
      load(path);
    } catch (e) { notify(e.message, "error"); } finally { setBusy(false); }
  };

  const rename = async (e) => {
    const next = prompt(`Rename / move "${e.name}" to (full path or new name):`, e.path);
    if (!next || next === e.path) return;
    // bare name → keep in same dir
    const dst = next.includes("/") ? next : `${data.path}/${next}`;
    setBusy(true);
    try {
      await post("move", { src: e.path, dst });
      notify(`Moved ${e.name}`, "success");
      load(path);
    } catch (err) { notify(err.message, "error"); } finally { setBusy(false); }
  };

  const copy = async (e) => {
    const next = prompt(`Copy "${e.name}" to (full path):`, `${e.path}.copy`);
    if (!next) return;
    setBusy(true);
    try {
      await post("move", { src: e.path, dst: next, copy: true });
      notify(`Copied ${e.name}`, "success");
      load(path);
    } catch (err) { notify(err.message, "error"); } finally { setBusy(false); }
  };

  const remove = async (e) => {
    const word = e.is_dir ? "folder and everything in it" : "file";
    if (!confirm(`Delete this ${word}?\n\n${e.path}\n\nThis cannot be undone.`)) return;
    setBusy(true);
    try {
      await post("delete", { path: e.path });
      notify(`Deleted ${e.name}`, "success");
      load(path);
    } catch (err) { notify(err.message, "error"); } finally { setBusy(false); }
  };

  const download = (e) => {
    window.open(`${API}/api/admin/files/download?path=${encodeURIComponent(e.path)}`, "_blank");
  };

  // ── Upload ──────────────────────────────────────────────────────────────────
  const onUploadPick = () => fileInputRef.current?.click();
  const onUpload = async (ev) => {
    const files = Array.from(ev.target.files || []);
    if (!files.length) return;
    const form = new FormData();
    form.append("dest", data.path);
    files.forEach((f) => form.append("files", f));
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/admin/files/upload`, {
        method: "POST", credentials: "include", body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const r = await res.json();
      notify(`Uploaded ${r.count} file(s)`, "success");
      load(path);
    } catch (e) { notify(`Upload failed: ${e.message}`, "error"); }
    finally { setBusy(false); ev.target.value = ""; }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="ap-files">
      <Title t="File Browser" s="Browse, edit, upload, and manage server files — every change is tracked." />

      {/* Toolbar */}
      <div className="fb-toolbar">
        <B c="ghost" sm onClick={() => go(data?.parent)} disabled={!data?.parent}>⬆ Up</B>
        <div className="fb-crumbs">
          {crumbs.map((c, i) => (
            <span key={c.path}>
              {i > 0 && <span className="fb-sep">/</span>}
              <button className="fb-crumb" onClick={() => go(c.path)}>{c.label}</button>
            </span>
          ))}
        </div>
        <div className="fb-actions">
          <B c="ghost" sm onClick={() => load(path)}>↻</B>
          <B c="ghost" sm onClick={newFolder} disabled={busy}>+ Folder</B>
          <B c="ghost" sm onClick={newFile} disabled={busy}>+ File</B>
          <B c="gold" sm onClick={onUploadPick} disabled={busy}>⬆ Upload</B>
          <input ref={fileInputRef} type="file" multiple hidden onChange={onUpload} />
        </div>
      </div>

      {/* Quick jumps */}
      <div className="fb-jumps">
        {[
          ["Zomboid", "/home/zomboid/Zomboid"],
          ["Server INI", "/home/zomboid/Zomboid/Server"],
          ["Saves", "/home/zomboid/Zomboid/Saves"],
          ["Logs", "/home/zomboid/Zomboid/Logs"],
          ["Lua", "/home/zomboid/Zomboid/Lua"],
          ["Home", "/home/zomboid"],
        ].map(([label, p]) => (
          <button key={p} className="fb-jump" onClick={() => go(p)}>{label}</button>
        ))}
      </div>

      {/* Listing */}
      {loading ? (
        <div className="fb-empty">Loading…</div>
      ) : !data ? (
        <div className="fb-empty">—</div>
      ) : data.entries.length === 0 ? (
        <div className="fb-empty">Empty folder.</div>
      ) : (
        <div className="fb-table">
          <div className="fb-row fb-head">
            <div className="fb-c-name">Name</div>
            <div className="fb-c-size">Size</div>
            <div className="fb-c-time">Modified</div>
            <div className="fb-c-act">Actions</div>
          </div>
          {data.entries.map((e) => (
            <div key={e.path} className={`fb-row${e.error ? " fb-err" : ""}`}>
              <div className="fb-c-name">
                <button
                  className="fb-name"
                  onClick={() => (e.is_dir ? go(e.path) : openFile(e))}
                  title={e.error || e.path}
                >
                  <span className="fb-icon">{fileIcon(e)}</span>
                  {e.name}{e.symlink && <span className="fb-link"> ↪</span>}
                </button>
              </div>
              <div className="fb-c-size">{e.is_dir ? "" : fmtBytes(e.size)}</div>
              <div className="fb-c-time">{fmtTime(e.modified)}</div>
              <div className="fb-c-act">
                {!e.is_dir && e.editable && (
                  <button className="fb-mini" onClick={() => openFile(e)} title="Edit">✏️</button>
                )}
                {!e.is_dir && (
                  <button className="fb-mini" onClick={() => download(e)} title="Download">⬇</button>
                )}
                <button className="fb-mini" onClick={() => rename(e)} title="Rename / move">↦</button>
                <button className="fb-mini" onClick={() => copy(e)} title="Copy">⧉</button>
                <button className="fb-mini fb-del" onClick={() => remove(e)} title="Delete">🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor overlay */}
      {editing && (
        <div className="fb-editor-wrap">
          <div className="fb-editor-bar">
            <span className="fb-editor-name">{editing.path}{dirty && " •"}</span>
            <div className="fb-editor-btns">
              <B c="gold" sm onClick={saveFile} disabled={busy || !dirty}>💾 Save</B>
              <B c="ghost" sm onClick={closeEditor}>✕ Close</B>
            </div>
          </div>
          <CodeMirror
            value={draft}
            height="60vh"
            theme={tokyoNight}
            extensions={langFor(editing.name)}
            onChange={(v) => { setDraft(v); setDirty(v !== editing.content); }}
          />
        </div>
      )}

      <style jsx>{`
        .ap-files { display: flex; flex-direction: column; gap: 12px; }
        .fb-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 8px; padding: 8px 12px; }
        .fb-crumbs { flex: 1; min-width: 0; overflow-x: auto; white-space: nowrap;
          font-family: var(--mono); font-size: 13px; }
        .fb-crumb { background: none; border: none; color: var(--blue);
          cursor: pointer; padding: 2px 4px; font-family: var(--mono); font-size: 13px; }
        .fb-crumb:hover { color: var(--accent); text-decoration: underline; }
        .fb-sep { color: var(--textdim); margin: 0 1px; }
        .fb-actions { display: flex; gap: 6px; }
        .fb-jumps { display: flex; gap: 6px; flex-wrap: wrap; }
        .fb-jump { background: var(--surface); border: 1px solid var(--border);
          color: var(--textdim); border-radius: 6px; padding: 4px 10px;
          font-size: 12px; cursor: pointer; }
        .fb-jump:hover { color: var(--accent); border-color: var(--accent); }
        .fb-empty { color: var(--textdim); padding: 30px; text-align: center;
          font-family: var(--mono); }
        .fb-table { border: 1px solid var(--border); border-radius: 8px;
          overflow: hidden; background: var(--surface); }
        .fb-row { display: grid; grid-template-columns: 1fr 90px 150px 180px;
          align-items: center; padding: 6px 12px; border-bottom: 1px solid var(--border);
          font-size: 13px; }
        .fb-row:last-child { border-bottom: none; }
        .fb-row:hover:not(.fb-head) { background: var(--surface2); }
        .fb-head { background: var(--surface2); color: var(--textdim);
          font-family: var(--mono); font-size: 11px; text-transform: uppercase;
          letter-spacing: 0.5px; }
        .fb-err .fb-name { color: var(--red); }
        .fb-name { background: none; border: none; color: var(--text);
          cursor: pointer; text-align: left; display: flex; align-items: center;
          gap: 8px; font-size: 13px; width: 100%; overflow: hidden;
          text-overflow: ellipsis; white-space: nowrap; }
        .fb-name:hover { color: var(--accent); }
        .fb-icon { flex-shrink: 0; }
        .fb-link { color: var(--blue); }
        .fb-c-size, .fb-c-time { color: var(--textdim); font-family: var(--mono);
          font-size: 12px; }
        .fb-c-act { display: flex; gap: 4px; justify-content: flex-end; }
        .fb-mini { background: var(--surface2); border: 1px solid var(--border);
          border-radius: 5px; cursor: pointer; padding: 3px 7px; font-size: 12px;
          line-height: 1; }
        .fb-mini:hover { border-color: var(--accent); }
        .fb-del:hover { border-color: var(--red); background: rgba(224,85,85,0.12); }
        .fb-editor-wrap { position: fixed; inset: 0; z-index: 1000;
          background: rgba(8,10,12,0.96); display: flex; flex-direction: column;
          padding: 16px; }
        .fb-editor-bar { display: flex; justify-content: space-between;
          align-items: center; margin-bottom: 10px; }
        .fb-editor-name { font-family: var(--mono); font-size: 13px;
          color: var(--text); overflow: hidden; text-overflow: ellipsis;
          white-space: nowrap; }
        .fb-editor-btns { display: flex; gap: 8px; flex-shrink: 0; }
      `}</style>
    </div>
  );
}
