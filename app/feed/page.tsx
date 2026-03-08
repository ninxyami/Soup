"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { API, SEASON_SHORT } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";

interface Post {
  id: string;
  discord_id: number;
  display_name: string;
  avatar_url: string;
  content: string;
  image_url?: string;
  repost_of?: string;
  repost_author_name?: string;
  repost_content?: string;
  repost_image_url?: string;
  pinned: boolean;
  like_count: number;
  reply_count: number;
  repost_count: number;
  liked_by_me: boolean;
  created_at: number;
}

interface Reply {
  id: string;
  post_id: string;
  discord_id: number;
  display_name: string;
  avatar_url: string;
  content: string;
  image_url?: string;
  like_count: number;
  liked_by_me: boolean;
  created_at: number;
}

interface Me {
  discord_id: number;
  username: string;
  avatar_url: string;
  is_admin?: boolean;
}

// ── helpers ───────────────────────────────────────────────────────────────────
function Avatar({ src, name, size = 36 }: { src: string; name: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} width={size} height={size}
      className="rounded-full object-cover flex-shrink-0 border border-[#222]"
      style={{ width: size, height: size }} />
  );
}

function ActionBtn({ icon, label, active, onClick, danger }: {
  icon: string; label: string | number; active?: boolean; onClick: () => void; danger?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 text-[0.7rem] font-mono tracking-wide border-none bg-transparent cursor-pointer transition-colors px-1 py-0.5 group ${
        active ? (danger ? "text-[#e05555]" : "text-[#4a7c59]") : "text-[#444] hover:text-[#9a9a9a]"
      }`}>
      <span className="text-sm">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ── composer ──────────────────────────────────────────────────────────────────
function Composer({ me, onPost }: { me: Me; onPost: (p: Post) => void }) {
  const [text, setText]         = useState("");
  const [imageFile, setImage]   = useState<File | null>(null);
  const [preview, setPreview]   = useState("");
  const [posting, setPosting]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState("");
  const fileRef                 = useRef<HTMLInputElement>(null);
  const textRef                 = useRef<HTMLTextAreaElement>(null);

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { setError("Max 8MB"); return; }
    setImage(f);
    setPreview(URL.createObjectURL(f));
    setError("");
  };

  const removeImage = () => {
    setImage(null);
    setPreview("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (!text.trim() && !imageFile) return;
    setPosting(true); setError("");
    try {
      let image_url = "";
      if (imageFile) {
        setUploading(true);
        const fd = new FormData();
        fd.append("file", imageFile);
        const ur = await fetch(`${API}/api/feed/upload`, { method: "POST", credentials: "include", body: fd });
        if (!ur.ok) { const d = await ur.json(); throw new Error(d.detail || "Upload failed"); }
        image_url = (await ur.json()).url;
        setUploading(false);
      }
      const res = await fetch(`${API}/api/feed/posts`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.trim(), image_url: image_url || undefined }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Post failed"); }
      const { post_id } = await res.json();
      const now = Math.floor(Date.now() / 1000);
      onPost({
        id: post_id, discord_id: me.discord_id, display_name: me.username,
        avatar_url: me.avatar_url, content: text.trim(), image_url: image_url || undefined,
        pinned: false, like_count: 0, reply_count: 0, repost_count: 0,
        liked_by_me: false, created_at: now,
      });
      setText(""); removeImage();
      if (textRef.current) textRef.current.style.height = "auto";
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPosting(false); setUploading(false);
    }
  };

  const chars = text.length;
  const over  = chars > 500;

  return (
    <div className="border border-[#1e2530] bg-[#0d1117] p-3 sm:p-4 mb-1">
      <div className="flex gap-3">
        <Avatar src={me.avatar_url} name={me.username} size={38} />
        <div className="flex-1 min-w-0">
          <textarea
            ref={textRef}
            value={text}
            onChange={e => {
              setText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
            }}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(); }}
            placeholder="what's happening out there, survivor?"
            rows={2}
            className="w-full bg-transparent text-[#c8cdd6] text-[0.9rem] placeholder:text-[#2a2a2a] outline-none resize-none font-[inherit] border-none"
            style={{ lineHeight: 1.5 }}
          />

          {preview && (
            <div className="relative mt-2 inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="preview" className="max-h-[240px] max-w-full object-contain border border-[#1e2530]" />
              <button onClick={removeImage}
                className="absolute top-1 right-1 w-6 h-6 bg-[rgba(0,0,0,0.8)] text-[#e6e6e6] text-xs flex items-center justify-center cursor-pointer border-none rounded-full">
                ×
              </button>
            </div>
          )}

          {error && <p className="text-[#e05555] font-mono text-xs mt-2">{error}</p>}

          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#1a1a1a]">
            <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} className="hidden" id="feed-img" />
            <label htmlFor="feed-img"
              className="text-[#555] hover:text-[#4a7c59] cursor-pointer transition-colors text-sm" title="Attach image">
              🖼
            </label>
            <span className={`font-mono text-[0.68rem] ml-auto ${over ? "text-[#e05555]" : chars > 400 ? "text-[#c8a84b]" : "text-[#333]"}`}>
              {chars}/500
            </span>
            <button onClick={submit} disabled={posting || over || (!text.trim() && !imageFile)}
              className="px-4 py-1.5 border border-[#4a7c59] text-[#4a7c59] font-mono text-xs uppercase tracking-widest hover:bg-[#4a7c59] hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer bg-transparent">
              {uploading ? "uploading..." : posting ? "posting..." : "post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── reply composer ────────────────────────────────────────────────────────────
function ReplyComposer({ me, postId, onReply }: { me: Me; postId: string; onReply: (r: Reply) => void }) {
  const [text, setText]       = useState("");
  const [imageFile, setImg]   = useState<File | null>(null);
  const [preview, setPrev]    = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError]     = useState("");
  const fileRef               = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!text.trim() && !imageFile) return;
    setPosting(true); setError("");
    try {
      let image_url = "";
      if (imageFile) {
        const fd = new FormData();
        fd.append("file", imageFile);
        const ur = await fetch(`${API}/api/feed/upload`, { method: "POST", credentials: "include", body: fd });
        if (!ur.ok) throw new Error("Upload failed");
        image_url = (await ur.json()).url;
      }
      const res = await fetch(`${API}/api/feed/posts/${postId}/reply`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.trim(), image_url: image_url || undefined }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Failed"); }
      const { reply_id } = await res.json();
      onReply({
        id: reply_id, post_id: postId, discord_id: me.discord_id,
        display_name: me.username, avatar_url: me.avatar_url,
        content: text.trim(), image_url: image_url || undefined,
        like_count: 0, liked_by_me: false, created_at: Math.floor(Date.now() / 1000),
      });
      setText(""); setImg(null); setPrev("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) { setError(e.message); }
    finally { setPosting(false); }
  };

  return (
    <div className="flex gap-2 sm:gap-3 mt-3 pt-3 border-t border-[#111]">
      <Avatar src={me.avatar_url} name={me.username} size={28} />
      <div className="flex-1 min-w-0">
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="reply..." rows={1}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          className="w-full bg-transparent text-[#c8cdd6] text-[0.82rem] placeholder:text-[#2a2a2a] outline-none resize-none font-[inherit] border-none" />
        {preview && (
          <div className="relative mt-1 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="max-h-[120px] max-w-full object-contain border border-[#1e2530]" />
            <button onClick={() => { setImg(null); setPrev(""); }} className="absolute top-0 right-0 w-5 h-5 bg-[rgba(0,0,0,0.8)] text-white text-xs flex items-center justify-center cursor-pointer border-none rounded-full">×</button>
          </div>
        )}
        {error && <p className="text-[#e05555] font-mono text-xs mt-1">{error}</p>}
        <div className="flex items-center gap-2 mt-1">
          <input ref={fileRef} type="file" accept="image/*" id={`reply-img-${postId}`}
            onChange={e => { const f = e.target.files?.[0]; if (f) { setImg(f); setPrev(URL.createObjectURL(f)); } }}
            className="hidden" />
          <label htmlFor={`reply-img-${postId}`} className="text-[#444] hover:text-[#4a7c59] cursor-pointer text-xs" title="Image">🖼</label>
          <button onClick={submit} disabled={posting || (!text.trim() && !imageFile)}
            className="ml-auto text-[0.68rem] font-mono text-[#4a7c59] border border-[#4a7c59] px-2 py-0.5 hover:bg-[#4a7c59] hover:text-black disabled:opacity-30 transition-all cursor-pointer bg-transparent">
            {posting ? "..." : "reply"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── post card ─────────────────────────────────────────────────────────────────
function PostCard({ post: initialPost, me, isAdmin, onDelete }: {
  post: Post; me: Me | null; isAdmin: boolean; onDelete: (id: string) => void;
}) {
  const [post, setPost]         = useState(initialPost);
  const [expanded, setExpanded] = useState(false);
  const [replies, setReplies]   = useState<Reply[]>([]);
  const [loadingR, setLoadingR] = useState(false);
  const [reposting, setReposting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const canDelete = me && (me.discord_id === post.discord_id || isAdmin);
  const canPin    = isAdmin;

  const toggleLike = async () => {
    if (!me) return;
    const optimistic = { ...post, liked_by_me: !post.liked_by_me, like_count: post.like_count + (post.liked_by_me ? -1 : 1) };
    setPost(optimistic);
    const res = await fetch(`${API}/api/feed/posts/${post.id}/like`, { method: "POST", credentials: "include" });
    if (res.ok) { const d = await res.json(); setPost(p => ({ ...p, liked_by_me: d.liked, like_count: d.like_count })); }
    else setPost(post);
  };

  const toggleReplies = async () => {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (replies.length === 0) {
      setLoadingR(true);
      const res = await fetch(`${API}/api/feed/posts/${post.id}`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setReplies(d.replies || []); }
      setLoadingR(false);
    }
  };

  const doRepost = async () => {
    if (!me || reposting) return;
    const quote = window.prompt("Add a comment (optional):");
    if (quote === null) return;
    setReposting(true);
    await fetch(`${API}/api/feed/posts`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: quote || `🔁 reposted`, repost_of: post.id }),
    });
    setPost(p => ({ ...p, repost_count: p.repost_count + 1 }));
    setReposting(false);
  };

  const doPin = async () => {
    const res = await fetch(`${API}/api/feed/posts/${post.id}/pin`, { method: "POST", credentials: "include" });
    if (res.ok) { const d = await res.json(); setPost(p => ({ ...p, pinned: d.pinned })); }
    setShowMenu(false);
  };

  const doDelete = async () => {
    if (!confirm("Delete this post?")) return;
    await fetch(`${API}/api/feed/posts/${post.id}`, { method: "DELETE", credentials: "include" });
    onDelete(post.id);
    setShowMenu(false);
  };

  const likeReply = async (reply: Reply) => {
    if (!me) return;
    const res = await fetch(`${API}/api/feed/replies/${reply.id}/like`, { method: "POST", credentials: "include" });
    if (res.ok) {
      const d = await res.json();
      setReplies(rs => rs.map(r => r.id === reply.id ? { ...r, liked_by_me: d.liked, like_count: d.like_count } : r));
    }
  };

  return (
    <article className={`border-b border-[#111] bg-[#0d1117] p-3 sm:p-4 relative transition-colors hover:bg-[#0f1318] ${post.pinned ? "border-l-2 border-l-[#c8a84b]" : ""}`}>
      {post.pinned && (
        <div className="flex items-center gap-1.5 mb-2 text-[#c8a84b] font-mono text-[0.62rem] tracking-widest uppercase">
          📌 Pinned
        </div>
      )}

      <div className="flex gap-3">
        <a href={`/player?id=${encodeURIComponent(post.display_name)}`}>
          <Avatar src={post.avatar_url} name={post.display_name} size={38} />
        </a>
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <a href={`/player?id=${encodeURIComponent(post.display_name)}`}
              className="font-mono text-[0.85rem] text-[#e6e6e6] no-underline hover:text-[#4a7c59] transition-colors truncate">
              {post.display_name}
            </a>
            <span className="font-mono text-[0.65rem] text-[#333]">{timeAgo(post.created_at)}</span>
            {(canDelete || canPin) && (
              <div className="ml-auto relative">
                <button onClick={() => setShowMenu(v => !v)}
                  className="text-[#333] hover:text-[#666] bg-transparent border-none cursor-pointer text-sm px-1">
                  ···
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-6 bg-[#0f1318] border border-[#1e2530] z-20 min-w-[120px] shadow-xl">
                    {canPin && (
                      <button onClick={doPin} className="w-full text-left px-3 py-2 text-[0.75rem] font-mono text-[#c8a84b] hover:bg-[#1a1a1a] cursor-pointer bg-transparent border-none">
                        {post.pinned ? "📌 Unpin" : "📌 Pin"}
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={doDelete} className="w-full text-left px-3 py-2 text-[0.75rem] font-mono text-[#e05555] hover:bg-[#1a1a1a] cursor-pointer bg-transparent border-none">
                        🗑 Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Repost origin */}
          {post.repost_of && post.repost_author_name && (
            <div className="mt-1 mb-2 border border-[#1e2530] bg-[#080c10] p-2 sm:p-3">
              <p className="font-mono text-[0.62rem] text-[#444] mb-1">🔁 {post.repost_author_name}</p>
              {post.repost_content && <p className="text-[0.8rem] text-[#777] leading-snug">{post.repost_content}</p>}
              {post.repost_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.repost_image_url} alt="" className="mt-2 max-h-[180px] max-w-full object-contain" />
              )}
            </div>
          )}

          {/* Content */}
          {post.content && (
            <p className="text-[0.88rem] text-[#c8cdd6] leading-relaxed mt-1 whitespace-pre-wrap break-words">
              {post.content}
            </p>
          )}

          {/* Image */}
          {post.image_url && (
            <div className="mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.image_url} alt="post image"
                className="max-h-[400px] max-w-full object-contain border border-[#1e2530] cursor-pointer"
                onClick={() => window.open(post.image_url, "_blank")} />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 sm:gap-3 mt-3 -ml-1">
            <ActionBtn icon="💬" label={post.reply_count} onClick={toggleReplies} active={expanded} />
            <ActionBtn icon="🔁" label={post.repost_count} onClick={doRepost} active={reposting} />
            <ActionBtn icon="🩸" label={post.like_count} onClick={toggleLike} active={post.liked_by_me} />
          </div>

          {/* Replies */}
          {expanded && (
            <div className="mt-3">
              {loadingR ? (
                <p className="font-mono text-[0.72rem] text-[#333]">loading replies...</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {replies.map(r => (
                    <div key={r.id} className="flex gap-2 sm:gap-3">
                      <Avatar src={r.avatar_url} name={r.display_name} size={28} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-[0.78rem] text-[#e6e6e6]">{r.display_name}</span>
                          <span className="font-mono text-[0.62rem] text-[#333]">{timeAgo(r.created_at)}</span>
                        </div>
                        {r.content && <p className="text-[0.82rem] text-[#b0b0b0] leading-relaxed mt-0.5 whitespace-pre-wrap">{r.content}</p>}
                        {r.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.image_url} alt="" className="mt-1 max-h-[200px] max-w-full object-contain border border-[#1e2530]" />
                        )}
                        <ActionBtn icon="🩸" label={r.like_count} onClick={() => likeReply(r)} active={r.liked_by_me} />
                      </div>
                    </div>
                  ))}
                  {replies.length === 0 && (
                    <p className="font-mono text-[0.72rem] text-[#2a2a2a] italic">no replies yet. be the first.</p>
                  )}
                  {me && (
                    <ReplyComposer me={me} postId={post.id}
                      onReply={r => { setReplies(rs => [...rs, r]); setPost(p => ({ ...p, reply_count: p.reply_count + 1 })); }} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Close menu on outside click */}
      {showMenu && <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />}
    </article>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function FeedPage() {
  const [me, setMe]             = useState<Me | null>(null);
  const [posts, setPosts]       = useState<Post[]>([]);
  const [loading, setLoading]   = useState(true);
  const [loadingMore, setMore]  = useState(false);
  const [hasMore, setHasMore]   = useState(true);
  const [whitelisted, setWL]    = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const isAdmin = me ? (me as any).is_admin : false;

  // Auth check
  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(async u => {
        if (u) {
          setMe(u);
          const wr = await fetch(`${API}/whitelist/status`, { credentials: "include" });
          if (wr.ok) { const wd = await wr.json(); setWL(wd.whitelisted); }
        }
        setAuthChecked(true);
      }).catch(() => setAuthChecked(true));
  }, []);

  // Load feed
  const loadPosts = useCallback(async (before?: number) => {
    const url = `${API}/api/feed${before ? `?before=${before}` : ""}`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return;
    const d = await res.json();
    const incoming: Post[] = d.posts || [];
    if (!before) {
      setPosts(incoming);
    } else {
      setPosts(p => [...p, ...incoming]);
    }
    setHasMore(incoming.length === 20);
  }, []);

  useEffect(() => {
    loadPosts().finally(() => setLoading(false));
    // Poll for new posts every 30s
    const iv = setInterval(() => loadPosts(), 30000);
    return () => clearInterval(iv);
  }, [loadPosts]);

  const loadMore = async () => {
    if (!hasMore || loadingMore || posts.length === 0) return;
    setMore(true);
    await loadPosts(posts[posts.length - 1].created_at);
    setMore(false);
  };

  const addPost   = (p: Post)    => setPosts(ps => [p, ...ps]);
  const removePost = (id: string) => setPosts(ps => ps.filter(p => p.id !== id));

  return (
    <main className="max-w-[640px] mx-auto px-0 sm:px-0 py-0">
      {/* Page header */}
      <div className="px-4 py-4 border-b border-[#111] sticky top-[49px] z-10 bg-[rgba(13,17,23,0.95)] backdrop-blur-sm flex items-center gap-3">
        <h1 className="font-mono text-[0.75rem] uppercase tracking-[0.2em] text-[#555]">Community Feed</h1>
        <span className="font-mono text-[0.6rem] text-[#2a2a2a]">· {SEASON_SHORT}</span>
        <button onClick={() => loadPosts()} className="ml-auto text-[0.65rem] font-mono text-[#333] hover:text-[#4a7c59] bg-transparent border-none cursor-pointer transition-colors">
          ↻ refresh
        </button>
      </div>

      {/* Composer */}
      {authChecked && !me && (
        <div className="p-4 border-b border-[#111] text-center">
          <p className="font-mono text-[0.78rem] text-[#444] mb-3">login to post and interact</p>
          <a href={`${API}/auth/discord/login`}
            className="font-mono text-xs px-4 py-2 border border-[#5865F2] text-[#5865F2] no-underline hover:bg-[#5865F2] hover:text-white transition-all">
            Login with Discord
          </a>
        </div>
      )}
      {me && !whitelisted && (
        <div className="p-4 border-b border-[#111] flex items-center gap-3">
          <Avatar src={me.avatar_url} name={me.username} size={38} />
          <div>
            <p className="font-mono text-[0.75rem] text-[#444]">whitelist required to post</p>
            <a href="/whitelist" className="font-mono text-[0.72rem] text-[#4a7c59] no-underline hover:underline">apply here →</a>
          </div>
        </div>
      )}
      {me && whitelisted && <Composer me={me} onPost={addPost} />}

      {/* Feed */}
      {loading ? (
        <div className="py-16 text-center">
          <p className="font-mono text-[0.72rem] text-[#2a2a2a] tracking-widest">loading the zone...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="py-16 text-center px-4">
          <p className="text-3xl mb-4">🧟</p>
          <p className="font-mono text-[0.8rem] text-[#333] italic">no transmissions yet. be the first survivor to speak.</p>
        </div>
      ) : (
        <>
          {posts.map(p => (
            <PostCard key={p.id} post={p} me={me} isAdmin={isAdmin} onDelete={removePost} />
          ))}
          {hasMore && (
            <div className="py-6 text-center border-t border-[#111]">
              <button onClick={loadMore} disabled={loadingMore}
                className="font-mono text-[0.72rem] text-[#444] hover:text-[#9a9a9a] border border-[#1a1a1a] px-4 py-2 bg-transparent cursor-pointer disabled:opacity-30 transition-all">
                {loadingMore ? "loading..." : "load more"}
              </button>
            </div>
          )}
          {!hasMore && posts.length > 0 && (
            <p className="py-6 text-center font-mono text-[0.65rem] text-[#2a2a2a]">you've reached the beginning</p>
          )}
        </>
      )}
    </main>
  );
}
