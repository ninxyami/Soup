"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";

interface Post {
  id: string;
  display_name: string;
  avatar_url: string;
  content: string;
  image_url?: string;
  repost_of?: string;
  repost_author_name?: string;
  pinned: boolean;
  like_count: number;
  reply_count: number;
  created_at: number;
}

function RecentPosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/feed`, { credentials: "include" })
      .then(r => r.ok ? r.json() : { posts: [] })
      .then(d => setPosts((d.posts || []).slice(0, 4)))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="py-6 text-center">
      <p className="font-mono text-[0.68rem] text-[#222] tracking-widest">loading transmissions...</p>
    </div>
  );

  if (posts.length === 0) return null;

  return (
    <section className="animate-fadeUp">
      <div className="flex items-center justify-between mb-4">
        <h2 className="!mb-0 !mt-0">Recent Transmissions</h2>
        <Link href="/feed"
          className="font-mono text-[0.68rem] text-[#444] hover:text-[#4a7c59] no-underline transition-colors tracking-widest uppercase">
          all posts →
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {posts.map(post => (
          <Link key={post.id} href="/feed" className="no-underline block group">
            <div className="border border-[#1a1a1a] bg-[#0a0d10] p-3 hover:border-[#2a2a2a] hover:bg-[#0d1117] transition-all">
              <div className="flex items-center gap-2 mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.avatar_url} alt={post.display_name} width={24} height={24}
                  className="rounded-full border border-[#222] flex-shrink-0" style={{ width: 24, height: 24 }} />
                <span className="font-mono text-[0.75rem] text-[#9a9a9a] group-hover:text-[#4a7c59] transition-colors truncate">
                  {post.display_name}
                </span>
                <span className="font-mono text-[0.62rem] text-[#2a2a2a] ml-auto flex-shrink-0">
                  {timeAgo(post.created_at)}
                </span>
              </div>
              {post.repost_of && post.repost_author_name && (
                <p className="font-mono text-[0.62rem] text-[#333] mb-1">🔁 {post.repost_author_name}</p>
              )}
              {post.content && (
                <p className="text-[0.82rem] text-[#777] leading-relaxed line-clamp-2 whitespace-pre-wrap break-words">
                  {post.content}
                </p>
              )}
              {post.image_url && !post.content && (
                <p className="font-mono text-[0.68rem] text-[#333] italic">📷 image post</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span className="font-mono text-[0.62rem] text-[#2a2a2a]">💬 {post.reply_count}</span>
                <span className="font-mono text-[0.62rem] text-[#2a2a2a]">🩸 {post.like_count}</span>
                {post.pinned && <span className="font-mono text-[0.62rem] text-[#c8a84b]">📌</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-3 text-center">
        <Link href="/feed"
          className="font-mono text-[0.72rem] text-[#333] hover:text-[#4a7c59] no-underline border border-[#1a1a1a] px-4 py-2 inline-block hover:border-[#2a2a2a] transition-all">
          view all transmissions →
        </Link>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <main>
      <header className="hero-bg min-h-[50vh] sm:min-h-[70vh] flex items-center justify-center text-center relative px-4">
        <div className="animate-fadeUp z-10">
          <h1 className="text-[1.8rem] sm:text-[2.5rem] tracking-[0.2em] sm:tracking-[0.25em]">STATE OF UNDEAD PURGE</h1>
          <p className="mt-2 text-[#cfcfcf] text-[0.85rem] sm:text-[0.9rem]">Season 1 — New Dawn</p>
        </div>
      </header>

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <section className="animate-fadeUp">
          <p>
            State of Undead Purge is a long-term, PVE-focused Project Zomboid server
            built for players who value survival, cooperation, and persistence.
          </p>
          <p>This is not a fast-wipe server. Progress is slow by design. Seasons last.</p>
        </section>

        <div className="divider" />

        <RecentPosts />

        <div className="divider" />

        <section className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/dawn.png" alt="State of Undead Purge — New Dawn" className="max-w-full h-auto rounded opacity-95 mx-auto" />
        </section>

        <div className="divider" />

        <section>
          <h2>What This Server Is</h2>
          <ul>
            <li>Player vs Environment focused</li>
            <li>Friendly, cooperative community</li>
            <li>Long-term progression</li>
            <li>Designed for both casual and dedicated survivors</li>
          </ul>
        </section>

        <div className="divider" />

        <section>
          <h2>What This Server Is Not</h2>
          <ul>
            <li>No rush-focused gameplay</li>
            <li>No griefing or toxicity</li>
            <li>No instant gratification systems</li>
            <li>No pressure to min-max</li>
          </ul>
        </section>

        <div className="divider" />

        <section className="text-center">
          <div className="flex gap-3 sm:gap-4 flex-wrap justify-center mt-6">
            <a href="https://discord.gg/NCBPqP5Q" target="_blank" rel="noopener noreferrer"
              className="inline-block px-[1.2rem] py-[0.55rem] border border-[#2a2a2a] text-[#9a9a9a] no-underline text-[0.78rem] sm:text-[0.8rem] tracking-[0.1em] sm:tracking-[0.12em] uppercase hover:border-[#5865F2] hover:text-[#5865F2] transition-all">
              Join Discord
            </a>
            <Link href="/whitelist"
              className="inline-block px-[1.2rem] py-[0.55rem] border border-[#2a2a2a] text-[#9a9a9a] no-underline text-[0.78rem] sm:text-[0.8rem] tracking-[0.1em] sm:tracking-[0.12em] uppercase hover:border-[#4a7c59] hover:text-[#4a7c59] transition-all">
              Apply Whitelist
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
