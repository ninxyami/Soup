"use client";
// @ts-nocheck
// Zombita's weekly newspaper: the latest published issue, and the ones before it.
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";
import Newspaper from "@/components/Newspaper";

interface IssueRef { id: number; issue_no: number; published_at: number; date_text: string; headline: string; png_url: string; }

export default function NewspaperPage() {
  const [issue, setIssue] = useState<any>(null);
  const [issues, setIssues] = useState<IssueRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadIssue = async (id?: number) => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/newspaper/${id ? "issues/" + id : "latest"}`);
      const d = await r.json();
      setIssue(d.issue || null);
      if (d.error) setError(d.error);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadIssue();
    fetch(`${API}/api/newspaper/issues?limit=40`).then((r) => r.json()).then((d) => setIssues(d.issues || [])).catch(() => {});
  }, []);

  return (
    <main className="max-w-[1100px] mx-auto px-4 py-8">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-6">
        <h1 className="font-mono text-[0.75rem] tracking-[0.25em] uppercase text-[#c8a84b] m-0">Zombita&rsquo;s Newspaper</h1>
        <span className="font-mono text-[0.65rem] text-[#555]">Every Sunday, written by Zombita, checked by the admins.</span>
      </div>
      {loading && <div className="font-mono text-[0.7rem] text-[#555]">LOADING...</div>}
      {!loading && !issue && <div className="font-mono text-[0.75rem] text-[#777]">No issue has been published yet. {error && <span className="text-[#a55]">({error})</span>}</div>}
      {issue && (
        <>
          <Newspaper paper={issue.paper} />
          {issue.png_url && (
            <div className="text-center mt-3">
              <a href={issue.png_url} target="_blank" rel="noreferrer" className="font-mono text-[0.65rem] text-[#777] hover:text-[#c8a84b]">open as a picture ↗</a>
            </div>
          )}
        </>
      )}
      {issues.length > 1 && (
        <section className="mt-10">
          <h2 className="font-mono text-[0.7rem] tracking-[0.2em] uppercase text-[#777] mb-3">Back issues</h2>
          <ul className="m-0 p-0 list-none grid gap-2 sm:grid-cols-2">
            {issues.map((it) => (
              <li key={it.id}>
                <button
                  onClick={() => loadIssue(it.id)}
                  className={`w-full text-left border px-3 py-2 font-mono text-[0.72rem] transition-colors ${issue?.id === it.id ? "border-[#c8a84b] text-[#c8a84b]" : "border-[#222] text-[#aaa] hover:border-[#555]"}`}
                >
                  <span className="text-[#c8a84b]">No. {it.issue_no}</span> &middot; {it.date_text} &middot; {it.headline}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
