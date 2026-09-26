"use client";
// @ts-nocheck
// Zombita's weekly newspaper: the latest published issue (or ?issue=N), and every issue before it.
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";
import Newspaper from "@/components/Newspaper";

interface IssueRef { id: number; issue_no: number; published_at: number; date_text: string; headline: string; png_url: string; }

export default function NewspaperPage() {
  const [issue, setIssue] = useState<any>(null);
  const [issues, setIssues] = useState<IssueRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadIssue = async (id?: number, push = true) => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${API}/api/newspaper/${id ? "issues/" + id : "latest"}`);
      const d = await r.json();
      setIssue(d.issue || null);
      if (d.error) setError(d.error);
      if (push && typeof window !== "undefined") {
        const url = id ? `/newspaper?issue=${id}` : "/newspaper";
        window.history.replaceState(null, "", url);
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const wanted = Number(new URLSearchParams(window.location.search).get("issue")) || undefined;
    loadIssue(wanted, false);
    fetch(`${API}/api/newspaper/issues?limit=60`).then((r) => r.json()).then((d) => setIssues(d.issues || [])).catch(() => {});
  }, []);

  const published = (ts: number) => (ts ? new Date(ts * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");

  return (
    <main className="max-w-[1100px] mx-auto px-4 py-8">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-6">
        <h1 className="font-mono text-[0.75rem] tracking-[0.25em] uppercase text-[#c8a84b] m-0">Zombita&rsquo;s Newspaper</h1>
        <span className="font-mono text-[0.65rem] text-[#555]">Every Sunday. Written by Zombita, checked by the admins.</span>
      </div>
      {loading && <div className="font-mono text-[0.7rem] text-[#555]">LOADING...</div>}
      {!loading && !issue && (
        <div className="font-mono text-[0.75rem] text-[#777] border border-[#222] p-6 text-center">
          No issue has been published yet. The first one comes out on Sunday.
          {error && <span className="block mt-2 text-[#a55]">({error})</span>}
        </div>
      )}
      {issue && (
        <>
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2 font-mono text-[0.65rem] text-[#777]">
            <span>No. {issue.issue_no} &middot; published {published(issue.published_at)}</span>
            <span className="flex gap-3">
              {issues[0] && issues[0].id !== issue.id && (
                <button onClick={() => loadIssue()} className="text-[#c8a84b] hover:underline bg-transparent border-0 p-0 cursor-pointer font-mono text-[0.65rem]">latest issue &rarr;</button>
              )}
              {issue.png_url && <a href={issue.png_url} target="_blank" rel="noreferrer" className="hover:text-[#c8a84b]">open as a picture &#8599;</a>}
            </span>
          </div>
          <Newspaper paper={issue.paper} />
        </>
      )}
      {issues.length > 0 && (
        <section className="mt-12">
          <h2 className="font-mono text-[0.7rem] tracking-[0.2em] uppercase text-[#777] mb-4">All issues</h2>
          <ul className="m-0 p-0 list-none grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
            {issues.map((it) => {
              const active = issue?.id === it.id;
              return (
                <li key={it.id}>
                  <button
                    onClick={() => loadIssue(it.id)}
                    className={`w-full text-left border p-2 transition-colors bg-transparent cursor-pointer ${active ? "border-[#c8a84b]" : "border-[#222] hover:border-[#555]"}`}
                  >
                    {it.png_url
                      ? <img src={it.png_url} alt={`Issue ${it.issue_no}`} loading="lazy" className="w-full aspect-[1414/2000] object-cover object-top block bg-[#111]" style={{ filter: active ? "none" : "brightness(.85)" }} />
                      : <div className="w-full aspect-[1414/2000] bg-[#111] flex items-center justify-center font-mono text-[0.6rem] text-[#444]">No. {it.issue_no}</div>}
                    <div className="mt-2 font-mono text-[0.62rem] leading-snug">
                      <span className="text-[#c8a84b]">No. {it.issue_no}</span> <span className="text-[#555]">&middot; {published(it.published_at)}</span>
                      <div className="text-[#aaa] mt-1 line-clamp-2">{it.headline}</div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
