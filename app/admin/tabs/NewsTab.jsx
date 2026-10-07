"use client";
// @ts-nocheck
// SERVER NEWS (2026-10-07): write a post once, it goes to the website (/news), the Discord news channel and the
// Server Hub in game (text only there: pictures can't load in PZ). Edits and deletes follow everywhere.
// API: routers/news.py (GET/POST /api/admin/news, PUT/DELETE /api/admin/news/{id}); pictures use the existing
// POST /api/admin/content/upload-image.
import { useState, useEffect, useCallback } from "react";
import { fetchApi, postApi, API, B, Title, TW, Inp, Sel, TA, Empty, fmtFull } from "./shared";

const CATS = [
  ["NEWS", "News"],
  ["ANNOUNCEMENT", "Announcement"],
  ["PATCH", "Patch notes"],
  ["EVENT", "Event"],
  ["MAINTENANCE", "Maintenance"],
];
const CAT_COLOR = { NEWS: "#e8b04b", PATCH: "#5b9bd5", EVENT: "#9b59b6", ANNOUNCEMENT: "#e74c3c", MAINTENANCE: "#95a5a6" };
const EMPTY = { title: "", summary: "", body: "", category: "NEWS", pinned: false, image_url: "" };

export default function NewsTab({ toast }) {
  const [posts, setPosts] = useState(null);
  const [channel, setChannel] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);
  const [draft, setDraft] = useState(EMPTY);
  const [editing, setEditing] = useState(null);       // a post id, or null for a new one
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const say = (msg, type = "success") => { if (toast) toast(msg, type); };

  const load = useCallback(async () => {
    try {
      const d = await fetchApi(`/api/admin/news${showDeleted ? "?all=1" : ""}`);
      setPosts(d.posts || []);
      setChannel(!!d.channel);
    } catch (e) {
      say(e.message, "error");
      setPosts([]);
    }
  }, [showDeleted]);

  useEffect(() => { load(); }, [load]);
  // Discord catches up within ~20 s: refresh the "waiting" marks now and then
  useEffect(() => { const iv = setInterval(load, 20000); return () => clearInterval(iv); }, [load]);

  const set = (k) => (e) => setDraft(d => ({ ...d, [k]: e && e.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e }));

  const startEdit = (p) => {
    setEditing(p.id);
    setDraft({ title: p.title, summary: p.summary || "", body: p.body || "", category: p.category, pinned: !!p.pinned, image_url: p.image_url || "" });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const cancel = () => { setEditing(null); setDraft(EMPTY); };

  const save = async () => {
    if (!draft.title.trim()) return say("Give the post a title.", "error");
    if (!draft.body.trim() && !draft.summary.trim()) return say("Write something in the post.", "error");
    setBusy(true);
    try {
      if (editing) {
        await fetchApi(`/api/admin/news/${editing}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
        say("Post updated. Discord and the game follow within a minute.");
      } else {
        await postApi("/api/admin/news", draft);
        say("Posted. It goes to Discord and the game within a minute.");
      }
      cancel();
      await load();
    } catch (e) {
      say(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p) => {
    if (typeof window !== "undefined" && !window.confirm(`Take down "${p.title}"? It disappears from the website, Discord and the game.`)) return;
    try {
      await fetchApi(`/api/admin/news/${p.id}`, { method: "DELETE" });
      say("Taken down everywhere.");
      if (editing === p.id) cancel();
      await load();
    } catch (e) {
      say(e.message, "error");
    }
  };

  const upload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch(`${API}/api/admin/content/upload-image`, { method: "POST", credentials: "include", body: form });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || "Upload failed");
      setDraft(x => ({ ...x, image_url: d.url }));
      say("Picture uploaded.");
    } catch (err) {
      say(err.message, "error");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const imgSrc = (u) => (u && u.startsWith("/") ? API + u : u);

  return (
    <div>
      <Title t="SERVER NEWS" s="Write once: it shows on the website's News page, in the Discord news channel and in the Server Hub in game." />

      {!channel && (
        <div className="ap-fb" style={{ borderColor: "#d4873a", color: "#d4873a", marginBottom: 12 }}>
          The Discord news channel isn&apos;t set up yet (NEWS_CHANNEL_ID). Posts still go to the website and the game, and they
          go to Discord as soon as the channel is set.
        </div>
      )}

      <TW title={editing ? `EDITING POST #${editing}` : "NEW POST"} right={editing ? <B c="ghost" sm onClick={cancel}>Cancel</B> : null}>
        <div style={{ padding: 12 }}>
          <Inp label="Title" value={draft.title} onChange={set("title")} maxLength={160} placeholder="Launch day is October 10" />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px" }}>
              <Sel label="Category" value={draft.category} onChange={set("category")}>
                {CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Sel>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 12, marginTop: 18 }}>
              <input type="checkbox" checked={draft.pinned} onChange={set("pinned")} /> Pin to the top
            </label>
          </div>
          <Inp label="Summary (optional, one line shown in bold)" value={draft.summary} onChange={set("summary")} maxLength={500} />
          <TA label="Post" value={draft.body} onChange={set("body")} rows={10} maxLength={12000}
              placeholder="What's happening. Line breaks are kept on the website, in Discord and in game." />
          <div className="ap-fg">
            <label className="ap-fl">Picture (optional: website and Discord only, the game shows text)</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <label className="ap-b ap-b-ghost ap-b-sm" style={{ cursor: uploading ? "wait" : "pointer" }}>
                {uploading ? "Uploading..." : "Upload a picture"}
                <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={upload} disabled={uploading} style={{ display: "none" }} />
              </label>
              {draft.image_url && <B c="red" sm onClick={() => setDraft(x => ({ ...x, image_url: "" }))}>Remove picture</B>}
            </div>
            {draft.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgSrc(draft.image_url)} alt="" style={{ maxWidth: 320, maxHeight: 180, marginTop: 8, border: "1px solid var(--border)" }} />
            )}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <B onClick={save} disabled={busy}>{busy ? "Saving..." : editing ? "Save changes" : "Post it everywhere"}</B>
          </div>
        </div>
      </TW>

      <TW title={`POSTS${posts ? ` (${posts.length})` : ""}`}
          right={<label style={{ fontFamily: "var(--mono)", fontSize: 11, display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} /> show taken down
          </label>}>
        {posts === null ? <Empty text="Loading..." /> : posts.length === 0 ? <Empty text="No posts yet. Write the first one above." /> : (
          <div>
            {posts.map(p => (
              <div key={p.id} style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", borderLeft: `3px solid ${CAT_COLOR[p.category] || "#888"}`,
                                       opacity: p.deleted ? 0.45 : 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: CAT_COLOR[p.category] }}>{p.category}</span>
                  {p.pinned && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "#c8a84b" }}>📌 PINNED</span>}
                  <strong style={{ fontSize: 14 }}>{p.title}</strong>
                  <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)" }}>
                    #{p.id} · {fmtFull(p.created_at)} · {p.author || "?"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--textdim)", margin: "4px 0 6px", whiteSpace: "pre-wrap" }}>
                  {(p.summary || p.body || "").slice(0, 220)}{(p.summary || p.body || "").length > 220 ? "..." : ""}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: p.deleted ? "#e05555" : p.discord === "posted" ? "#4caf7d" : "#d4873a" }}>
                    {p.deleted ? "TAKEN DOWN" : p.discord === "posted" ? "✓ Website · Discord · Game" : "Website · Game · Discord waiting"}
                  </span>
                  {!p.deleted && (
                    <>
                      <a href={`/news#post-${p.id}`} target="_blank" rel="noreferrer" style={{ fontFamily: "var(--mono)", fontSize: 11, marginLeft: "auto" }}>view</a>
                      <B c="ghost" sm onClick={() => startEdit(p)}>Edit</B>
                      <B c="red" sm onClick={() => remove(p)}>Take down</B>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </TW>
    </div>
  );
}
