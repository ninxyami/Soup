// @ts-nocheck
"use client";
// The community centre (2026-10-09, mod 1.7.158): Zombita's sheet of everything the centre should have (every skill book,
// recipe magazine, 20 VHS tapes, the tools) and what is on its shelves right now. The game counts the shelves every minute
// while someone is near the centre; GET /api/community-centre. Refreshes every 60 s.
import { useMemo, useState } from "react";
import Link from "next/link";
import { useCommunityCentre, CentreMeter } from "@/components/CommunityCentreBar";
import { timeAgo } from "@/lib/utils";

export default function CommunityPage() {
  const v = useCommunityCentre(60000);
  const [show, setShow] = useState<"all" | "missing" | "there">("missing");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");

  const cats = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (v?.cats || [])
      .filter((c) => !cat || c.id === cat)
      .map((c) => ({
        ...c,
        shown: c.lines.filter((l) => (show === "all" || (show === "missing" ? !l.done : l.done))
          && (!term || l.name.toLowerCase().includes(term) || (l.by || "").toLowerCase().includes(term))),
      }));
  }, [v, show, q, cat]);

  const btn = (on: boolean) => `px-3 py-1 text-[0.7rem] tracking-[0.08em] uppercase font-mono cursor-pointer border ${on ? "bg-[#e8913a] text-[#0e0e0e] border-[#e8913a]" : "bg-transparent text-[#888] border-[#333]"}`;

  return (
    <main className="max-w-[960px] mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <section>
        <h1 className="text-xl sm:text-2xl tracking-[0.15em] uppercase mb-2">The community centre</h1>
        <p className="text-[#777] text-[0.85rem] max-w-[680px]">
          Zombita is filling the community centre with things everyone can use: every skill book, every recipe magazine, VHS tapes
          and tools. Read, watch and work there as much as you like. Just don&apos;t walk off with them, she sends them back.
          When every line below is on the shelves at the same time, the centre is complete.
        </p>
      </section>

      <div className="mt-6">
        {!v && <p className="font-mono text-[0.75rem] text-[#666]">loading...</p>}
        {v && !v.ready && <p className="font-mono text-[0.8rem] text-[#c8a84b]">The community centre isn&apos;t open yet. Check back soon.</p>}
        <CentreMeter v={v} />
        {v?.ready && v.at > 0 && <p className="font-mono text-[0.68rem] text-[#555] mt-2">Last counted {timeAgo(v.countAt || v.at)}. Zombita counts while someone is near the centre.</p>}
      </div>

      {v?.ready && <>
        <div className="divider" />
        <section>
          <h2 className="text-[0.8rem] tracking-[0.15em] uppercase text-[#aaa] mb-3">How to help</h2>
          <div className="grid gap-3 sm:grid-cols-3 text-[0.8rem] text-[#aaa]">
            <div className="border border-[#1e2530] bg-[#0f1318] p-4"><div className="text-[#e6e6e6] mb-1">Community jobs</div>Now and then the Jobs app has a COMMUNITY job asking for missing things. Bring them to the centre for reputation.</div>
            <div className="border border-[#1e2530] bg-[#0f1318] p-4"><div className="text-[#e6e6e6] mb-1">Donate any time</div>Right-click a community shelf and pick Donate. Whatever that shelf is still missing goes on it, +1 reputation each.</div>
            <div className="border border-[#1e2530] bg-[#0f1318] p-4"><div className="text-[#e6e6e6] mb-1">Use it, leave it</div>Take a book off the shelf and read it there. Carry it out and Zombita puts it back, with a word about it.</div>
          </div>
        </section>

        <div className="divider" />

        <section>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button className={btn(show === "missing")} onClick={() => setShow("missing")}>Missing</button>
            <button className={btn(show === "there")} onClick={() => setShow("there")}>There</button>
            <button className={btn(show === "all")} onClick={() => setShow("all")}>All</button>
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="bg-[#0f1318] border border-[#333] text-[#ccc] text-[0.75rem] font-mono px-2 py-1">
              <option value="">every kind</option>
              {(v.cats || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search a name or a player"
              className="bg-[#0f1318] border border-[#333] text-[#ccc] text-[0.75rem] font-mono px-2 py-1 flex-1 min-w-[160px]" />
          </div>

          {cats.map((c) => (
            <div key={c.id} className="mb-8">
              <h3 className="text-[0.72rem] tracking-[0.14em] uppercase mb-2 flex items-center gap-2 text-[#e8913a]">
                <span className="inline-block w-2 h-2 bg-[#e8913a]" />{c.name}
                <span className="text-[#666] normal-case tracking-normal font-mono">{c.present} / {c.total} there{c.shelves === 0 ? " · no shelf for these yet" : ""}</span>
              </h3>
              {c.shown.length === 0
                ? <p className="text-[#555] font-mono text-sm italic">{show === "missing" ? "Nothing missing here." : "Nothing to show."}</p>
                : <div className="overflow-x-auto -mx-2 px-2">
                    <table className="lb-table min-w-full">
                      <thead><tr><th>Name</th><th className="text-right">There</th><th className="text-right hidden sm:table-cell">First brought by</th></tr></thead>
                      <tbody>
                        {c.shown.map((l) => (
                          <tr key={l.key} className="lb-row">
                            <td className={l.done ? "text-[#ccc]" : "text-[#888]"}>{l.done ? "✓ " : ""}{l.name}</td>
                            <td className="text-right font-mono" style={{ color: l.done ? "#4caf7d" : "#777" }}>{l.n > 1 ? `${l.have} / ${l.n}` : (l.done ? "yes" : "no")}</td>
                            <td className="text-right font-mono text-[#888] hidden sm:table-cell">{l.by || ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>}
            </div>
          ))}
        </section>
      </>}

      <p className="text-[0.72rem] text-[#555] font-mono mt-6"><Link href="/jobs" className="text-[#4a7c59]">← Zombita&apos;s Jobs</Link></p>
    </main>
  );
}
