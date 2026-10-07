"use client";
// SERVER NEWS (2026-10-07): the official posts. Admins write them on the website (Admin > Server News); the same post
// goes to the Discord news channel and to the Server Hub in game. Zombita's shop hints moved to /intel.
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";

interface Post {
  id: number;
  title: string;
  summary: string;
  body: string;
  category: string;
  pinned: boolean;
  image: string;
  author: string;
  created_at: number;
  updated_at: number;
}

const CAT_COLOR: Record<string, string> = {
  NEWS: "#e8b04b",
  PATCH: "#5b9bd5",
  EVENT: "#9b59b6",
  ANNOUNCEMENT: "#e74c3c",
  MAINTENANCE: "#95a5a6",
};
const CAT_LABEL: Record<string, string> = {
  NEWS: "News",
  PATCH: "Patch notes",
  EVENT: "Event",
  ANNOUNCEMENT: "Announcement",
  MAINTENANCE: "Maintenance",
};

function fullDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function PostCard({ post, open, onToggle }: { post: Post; open: boolean; onToggle: () => void }) {
  const color = CAT_COLOR[post.category] || CAT_COLOR.NEWS;
  const long = post.body.length > 600;
  const body = open || !long ? post.body : post.body.slice(0, 600).trimEnd() + "...";
  const edited = post.updated_at - post.created_at > 120;
  return (
    <article id={`post-${post.id}`} className="border-b border-[#111] bg-[#0d1117] p-5 scroll-mt-[120px]"
             style={{ borderLeft: `3px solid ${color}` }}>
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="font-mono text-[0.58rem] uppercase tracking-widest px-1.5 py-0.5 border"
              style={{ color, borderColor: color + "55", background: color + "14" }}>
          {CAT_LABEL[post.category] || post.category}
        </span>
        {post.pinned && (
          <span className="font-mono text-[0.58rem] uppercase tracking-widest px-1.5 py-0.5 border border-[#c8a84b55] text-[#c8a84b]">
            📌 Pinned
          </span>
        )}
        <span className="font-mono text-[0.62rem] text-[#444] ml-auto" title={new Date(post.created_at * 1000).toLocaleString()}>
          {fullDate(post.created_at)} · {timeAgo(post.created_at)}{edited ? " · edited" : ""}
        </span>
      </div>
      <h2 className="text-[1.15rem] text-[#e6e8ec] font-semibold leading-snug m-0 mb-2">{post.title}</h2>
      {post.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.image} alt="" className="w-full max-h-[420px] object-cover border border-[#1e2530] mb-3" loading="lazy" />
      )}
      {post.summary && <p className="text-[0.92rem] text-[#c8cdd6] font-semibold leading-relaxed m-0 mb-2">{post.summary}</p>}
      {post.body && (
        <p className="text-[0.88rem] text-[#aab1bc] leading-relaxed whitespace-pre-wrap break-words m-0">{body}</p>
      )}
      <div className="flex items-center gap-3 mt-3">
        {long && (
          <button onClick={onToggle}
                  className="font-mono text-[0.62rem] text-[#c8a84b] bg-transparent border-none cursor-pointer p-0 hover:underline">
            {open ? "Show less" : "Read more"}
          </button>
        )}
        {post.author && <span className="font-mono text-[0.6rem] text-[#3a3a3a] ml-auto">posted by {post.author}</span>}
      </div>
    </article>
  );
}

export default function NewsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [jumpTo, setJumpTo] = useState<number | null>(null);

  useEffect(() => {
    let first = true;
    const load = async () => {
      try {
        const r = await fetch(`${API}/api/news`);
        if (!r.ok) throw new Error(String(r.status));
        const d = await r.json();
        setPosts(d.posts || []);
        setFailed(false);
        // a link from Discord (/news#post-12): open that post and scroll to it
        if (first && typeof window !== "undefined" && window.location.hash.startsWith("#post-")) {
          const id = Number(window.location.hash.slice(6));
          setOpen(o => ({ ...o, [id]: true }));
          setJumpTo(id);
        }
      } catch {
        setFailed(true);
      } finally {
        first = false;
        setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, []);

  // scroll to the linked post once it is on the page (after the list rendered)
  useEffect(() => {
    if (jumpTo === null) return;
    const el = document.getElementById(`post-${jumpTo}`);
    if (!el) return;
    const t = setTimeout(() => { el.scrollIntoView({ behavior: "smooth", block: "start" }); setJumpTo(null); }, 50);
    return () => clearTimeout(t);
  }, [jumpTo, posts, open]);

  const cats = Array.from(new Set(posts.map(p => p.category)));
  const shown = filter === "all" ? posts : posts.filter(p => p.category === filter);

  return (
    <div className="scanline min-h-screen" style={{ background: "#080a0c", color: "#c8cdd6" }}>
      <header className="px-4 sm:px-8 py-4 border-b border-[#1e2530] bg-[#0f1318] sticky top-[49px] z-10">
        <div className="max-w-[720px] mx-auto flex items-center gap-3">
          <a href="/" className="font-mono text-[0.65rem] text-[#444] hover:text-[#c8cdd6] no-underline tracking-widest hidden sm:block">← S.O.U.P</a>
          <span className="text-2xl tracking-[3px] text-[#c8a84b]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            SERVER NEWS
          </span>
          <div className="flex-1" />
          <a href="/newspaper" className="font-mono text-[0.65rem] px-3 py-1.5 border border-[#1e2530] text-[#555] no-underline hover:border-accent hover:text-accent transition-all">
            📰 Paper
          </a>
          <a href="/intel" className="font-mono text-[0.65rem] px-3 py-1.5 border border-[#1e2530] text-[#555] no-underline hover:border-accent hover:text-accent transition-all">
            🧟 Intel
          </a>
        </div>
      </header>

      <div className="max-w-[720px] mx-auto">
        <div className="px-4 py-4 border-b border-[#111]">
          <p className="text-[0.84rem] text-[#6b7280] leading-relaxed m-0">
            Announcements, patch notes and events from the admins. Every post here is also in our Discord news channel and
            in the Server Hub in game, so you can catch up wherever you are.
          </p>
        </div>

        {cats.length > 1 && (
          <div className="px-4 py-3 border-b border-[#111] flex items-center gap-1 flex-wrap">
            {["all", ...cats].map(c => (
              <button key={c} onClick={() => setFilter(c)}
                className={`font-mono text-[0.6rem] uppercase tracking-widest px-2 py-1 border transition-all cursor-pointer bg-transparent ${
                  filter === c ? "border-[rgba(200,168,75,0.4)] text-accent" : "border-transparent text-[#444] hover:text-[#888]"
                }`}>
                {c === "all" ? `All (${posts.length})` : `${CAT_LABEL[c] || c} (${posts.filter(p => p.category === c).length})`}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center">
            <p className="font-mono text-[0.72rem] text-[#2a2a2a] tracking-widest">loading the news...</p>
          </div>
        ) : failed && posts.length === 0 ? (
          <div className="py-16 text-center px-4">
            <p className="font-mono text-[0.8rem] text-[#555]">The news couldn&apos;t be loaded right now. Try again in a minute.</p>
          </div>
        ) : shown.length === 0 ? (
          <div className="py-16 text-center px-4">
            <p className="text-3xl mb-4">📭</p>
            <p className="font-mono text-[0.8rem] text-[#444]">No news yet. Check back soon.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {shown.map(p => (
              <PostCard key={p.id} post={p} open={!!open[p.id]} onToggle={() => setOpen(o => ({ ...o, [p.id]: !o[p.id] }))} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
