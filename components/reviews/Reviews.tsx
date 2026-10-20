"use client";
// PLAYER REVIEWS (2026-10-19; v2 2026-10-20): players rate the server 1 to 5 stars and write reviews in Discord
// (#server-feedback, the "Rate SOUP" and "Write a review" buttons; the cards are in the reviews channel). A review shows the writer's stars when they rated.
// Public data: GET /api/feedback?limit=N -> { score: {average, count, stars}, reviews: [...], updated }.
// Texts are plain text from players: always rendered as text, never as HTML. Dates are relative only.
// Used by the home page section (HomeReviews) and /reviews (ReviewsView).
import Link from "next/link";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";

export const DISCORD_INVITE = "https://discord.gg/zDwa2g37R";

export interface Review {
  id: number; kind: "rating" | "review"; name: string; stars: number | null; title: string;
  liked: string; improve: string; at: number; edited: boolean;
}
export interface FeedbackScore {
  average: number | null; count: number; stars: Record<string, number>;
}
export interface Feedback {
  score: FeedbackScore; reviews: Review[]; updated: number;
}

const GOLD = "#c8a84b";

function clean(d: any): Feedback | null {
  if (!d || typeof d !== "object" || !d.score) return null;
  const count = Number(d.score.count) || 0;
  const avg = d.score.average == null ? null : Number(d.score.average);
  const reviews: Review[] = (Array.isArray(d.reviews) ? d.reviews : [])
    .filter((r: any) => r && typeof r === "object")
    .map((r: any) => ({
      id: Number(r.id) || 0,
      name: String(r.name ?? ""),
      kind: (r.kind === "review" ? "review" : "rating") as Review["kind"],
      stars: Number(r.stars) >= 1 ? Math.min(5, Math.round(Number(r.stars))) : null,
      title: String(r.title ?? ""),
      liked: String(r.liked ?? ""),
      improve: String(r.improve ?? ""),
      at: Number(r.at) || 0,
      edited: !!r.edited,
    }));
  return {
    score: { average: avg != null && isFinite(avg) ? avg : null, count, stars: d.score.stars || {} },
    reviews,
    updated: Number(d.updated) || 0,
  };
}

// "loading" while the request runs, null when the API is down or not there yet, else the data
export function useFeedback(limit: number): Feedback | null | "loading" {
  const [data, setData] = useState<Feedback | null | "loading">("loading");
  useEffect(() => {
    let alive = true;
    fetch(`${API}/api/feedback?limit=${limit}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setData(clean(d)); })
      .catch(() => { if (alive) setData(null); });
    return () => { alive = false; };
  }, [limit]);
  return data;
}

// "today", "yesterday", "3 days ago", "2 weeks ago", "4 months ago", "1 year ago"
export function relativeDay(epoch: number): string {
  if (!epoch) return "";
  const days = Math.floor((Date.now() / 1000 - epoch) / 86400);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  const y = Math.floor(days / 365);
  return y === 1 ? "1 year ago" : `${y} years ago`;
}

function StarShape({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0">
      <path fill={color} d="M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96z" />
    </svg>
  );
}

// Five stars, filled up to `value` (partial fill for averages like 4.6)
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const v = Math.max(0, Math.min(5, value));
  const label = `${Number.isInteger(v) ? v : v.toFixed(1)} out of 5 stars`;
  const row = (color: string) => (
    <span className="flex gap-[2px]">
      {[0, 1, 2, 3, 4].map((i) => <StarShape key={i} size={size} color={color} />)}
    </span>
  );
  return (
    <span role="img" aria-label={label} className="relative inline-flex align-middle">
      {row("#2a2a2a")}
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${(v / 5) * 100}%` }}>
        {row(GOLD)}
      </span>
    </span>
  );
}

export function ScoreSummary({ score }: { score: FeedbackScore }) {
  const avg = score.average ?? 0;
  const total = score.count || 0;
  return (
    <div className="border border-[#1a1a1a] bg-[#0a0d10] relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c8a84b44] to-transparent" />
      <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 sm:gap-10 items-center">
        <div className="flex sm:flex-col items-center sm:items-start gap-4 sm:gap-1">
          <div className="font-['Bebas_Neue'] text-[3.4rem] leading-none tracking-[0.05em] text-[#e6e6e6]">
            {avg.toFixed(1)}
          </div>
          <div>
            <Stars value={avg} size={18} />
            <p className="font-mono text-[0.62rem] tracking-widest text-[#555] uppercase mt-1.5 mb-0">
              from {total} {total === 1 ? "player" : "players"}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {[5, 4, 3, 2, 1].map((n) => {
            const c = Number(score.stars?.[String(n)]) || 0;
            const pct = total > 0 ? (c / total) * 100 : 0;
            return (
              <div key={n} className="flex items-center gap-3" role="img"
                   aria-label={`${n} ${n === 1 ? "star" : "stars"}: ${c} ${c === 1 ? "player" : "players"}`}>
                <span className="font-mono text-[0.62rem] tracking-widest text-[#555] w-6 flex-shrink-0" aria-hidden="true">{n}★</span>
                <div className="flex-1 h-1.5 bg-[#111] rounded-full overflow-hidden" aria-hidden="true">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: GOLD }} />
                </div>
                <span className="font-mono text-[0.62rem] text-[#444] w-6 text-right flex-shrink-0" aria-hidden="true">{c}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ReviewCard({ r }: { r: Review }) {
  return (
    <article className="border border-[#1a1a1a] bg-[#0a0d10] p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
        {r.stars != null && <Stars value={r.stars} size={13} />}
        <span className="font-mono text-[0.7rem] text-[#777] truncate max-w-[180px]">{r.name}</span>
        <span className="font-mono text-[0.6rem] text-[#333] ml-auto">
          {relativeDay(r.at)}{r.edited ? " · edited" : ""}
        </span>
      </div>
      {r.title.trim() !== "" && (
        <h3 className="!normal-case !tracking-normal text-[0.95rem] text-[#e6e6e6] font-semibold leading-snug mt-0 mb-1.5 break-words">{r.title}</h3>
      )}
      {r.liked.trim() !== "" && (
        <p className="text-[0.85rem] text-[#aaa] leading-relaxed whitespace-pre-line break-words m-0">{r.liked}</p>
      )}
      {r.improve.trim() !== "" && (
        <div className="mt-3 pt-2.5 border-t border-[#141414]">
          <p className="font-mono text-[0.58rem] tracking-widest text-[#444] uppercase mb-1">Could be better:</p>
          <p className="text-[0.75rem] text-[#555] leading-relaxed whitespace-pre-line break-words m-0">{r.improve}</p>
        </div>
      )}
    </article>
  );
}

// Something worth reading: a written review, or a rating with a line
const hasWords = (r: Review) => r.title.trim() !== "" || r.liked.trim() !== "" || r.improve.trim() !== "";
const hasScore = (d: Feedback) => d.score.count > 0 && d.score.average != null;

// Home page section: hidden completely while loading, when the API fails, or when there's nothing yet
export function HomeReviews() {
  const data = useFeedback(12);
  if (data === "loading" || !data) return null;
  const recent = data.reviews.filter(hasWords).slice(0, 3);
  if (!hasScore(data) && recent.length === 0) return null;
  return (
    <>
      <section className="py-14 sm:py-20">
        <div className="flex items-end justify-between mb-6 gap-4">
          <div>
            <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#c8a84b] uppercase mb-2">Player reviews</p>
            <h2 className="!mb-0 !normal-case text-[1.2rem] tracking-[0.1em]">What players say</h2>
          </div>
          <Link href="/reviews" className="font-mono text-[0.65rem] tracking-widest text-[#444] hover:text-[#c8a84b] no-underline transition-colors uppercase hidden sm:block">
            Read all reviews →
          </Link>
        </div>
        {hasScore(data) && <ScoreSummary score={data.score} />}
        {recent.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            {recent.map((r) => <ReviewCard key={r.id} r={r} />)}
          </div>
        )}
        <Link href="/reviews" className="sm:hidden inline-block mt-4 font-mono text-[0.65rem] tracking-widest text-[#777] hover:text-[#c8a84b] no-underline transition-colors uppercase">
          Read all reviews →
        </Link>
      </section>
      <div className="h-px bg-[#1a1a1a]" />
    </>
  );
}

function HowToRate() {
  return (
    <p className="text-[0.8rem] text-[#666] leading-relaxed m-0">
      Played with us? Go to the #server-feedback channel on our{" "}
      <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="text-[#5865F2] hover:text-[#8891f7]">Discord</a>.
      Press <span className="text-[#c8a84b]">Rate SOUP</span> to give stars, or <span className="text-[#c8a84b]">Write a review</span> to
      tell others what it&apos;s like.
    </p>
  );
}

// The /reviews page body
export function ReviewsView() {
  const data = useFeedback(50);
  const has = data !== "loading" && !!data && (hasScore(data) || data.reviews.length > 0);
  return (
    <main className="max-w-[900px] mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <section>
        <h1 className="text-xl sm:text-2xl tracking-[0.15em] uppercase mb-2">Reviews</h1>
        <p className="text-[#777] text-[0.85rem]">What players say about the server, in their own words.</p>
      </section>

      <div className="divider" />

      {data === "loading" ? (
        <p className="text-[#555] font-mono text-sm">loading reviews...</p>
      ) : !has ? (
        <div className="border border-[#1a1a1a] bg-[#0a0d10] p-5 sm:p-6">
          <p className="font-mono text-[0.62rem] tracking-[0.25em] text-[#c8a84b] uppercase mb-2">No reviews yet</p>
          <p className="text-[0.85rem] text-[#777] leading-relaxed mb-3">Nobody has rated or reviewed the server yet. Yours could be the first.</p>
          <HowToRate />
        </div>
      ) : (
        <>
          {hasScore(data!) && <ScoreSummary score={data!.score} />}
          <div className="mt-4 mb-8"><HowToRate /></div>
          {data!.reviews.length > 0 && (
            <>
              <p className="font-mono text-[0.65rem] tracking-[0.3em] text-[#555] uppercase mb-3">Latest reviews</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data!.reviews.map((r) => <ReviewCard key={r.id} r={r} />)}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
