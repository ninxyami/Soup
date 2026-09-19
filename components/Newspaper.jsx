"use client";
// @ts-nocheck
// Zombita's weekly newspaper, drawn from its JSON ("paper", see discord-bot/zombita_newspaper.py).
// The bot renders the same JSON to a PNG for Discord; here it's HTML on the same paper textures
// (public/assets/newspaper/<template>.jpg), so the website version is readable and selectable.
//
// Fixed on every issue: the masthead title (an admin setting), the dateline (issue no. + the
// Saturday it was written), "Written by Zombita", and the footer with the admins who edited it.

const FONTS = "https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&family=Old+Standard+TT:ital,wght@0,400;0,700;1,400&display=swap";

const STYLE = `
@import url('${FONTS}');
.np { --ink:#181614; --soft:#4a4640; --rule:#2a261e; color:var(--ink); font-family:'Old Standard TT', Georgia, 'Times New Roman', serif;
  background:#f4f1ea center/cover; padding:34px 40px 26px; box-shadow:0 12px 40px rgba(0,0,0,.45); max-width:1000px; margin:0 auto; line-height:1.3; }
.np-classic { background-image:url('/assets/newspaper/classic.jpg'); }
.np-vintage { background-image:url('/assets/newspaper/vintage.jpg'); }
.np-bold    { background-image:url('/assets/newspaper/bold.jpg'); }
.np-special { background-image:url('/assets/newspaper/special.jpg'); }
.np-kicker { text-align:center; font-family:system-ui, sans-serif; font-size:11px; letter-spacing:.18em; color:var(--soft); text-transform:uppercase; }
.np-title { font-family:'UnifrakturMaguntia', 'Old English Text MT', serif; font-size:clamp(38px, 7.2vw, 78px); text-align:center; line-height:1.05; margin:4px 0 8px; }
.np-rule { border:0; border-top:2px solid var(--rule); margin:0; }
.np-rule.thin { border-top-width:1px; }
.np-rule.fat { border-top-width:4px; }
.np-dateline { display:flex; justify-content:space-between; font-family:system-ui, sans-serif; font-size:12px; letter-spacing:.08em; text-transform:uppercase; padding:6px 0; }
.np-section { font-weight:700; font-size:22px; margin:14px 0 2px; }
.np-section.black { font-family:'UnifrakturMaguntia', serif; font-weight:400; font-size:34px; }
.np-headline { font-weight:700; font-size:clamp(26px, 4.6vw, 50px); line-height:1.05; margin:0 0 8px; }
.np-byline { font-style:italic; color:var(--soft); font-size:15px; margin-bottom:14px; }
.np-grid { display:grid; grid-template-columns:1fr 250px; gap:22px; }
.np-lead { width:100%; aspect-ratio:2.6/1; object-fit:cover; border:2px solid var(--rule); filter:grayscale(1) contrast(1.08); background:#cfcac0; display:block; margin-bottom:14px; }
.np-lead.tall { aspect-ratio:1.4/1; }
.np-lead-body { font-size:15.5px; text-align:justify; hyphens:auto; }
.np-lead-body p { margin:0 0 .8em; }
.np-cols { column-count:2; column-gap:22px; font-size:15.5px; text-align:justify; hyphens:auto; clear:both; }
.np-cols p { margin:0 0 .8em; }
.np-story-h { font-weight:700; font-size:20px; margin:.2em 0 .3em; break-after:avoid; line-height:1.15; }
.np-story-pic { width:100%; border:2px solid var(--rule); filter:grayscale(1) contrast(1.08); display:block; margin:0 0 8px; }
.np-hr { border:0; border-top:1px solid var(--rule); margin:10px 0; }
.np-quote { border-top:1px solid var(--rule); border-bottom:1px solid var(--rule); padding:10px 8px; margin:10px 0 14px; text-align:center; font-style:italic; font-size:17px; break-inside:avoid; }
.np-box { border:2px solid var(--rule); padding:10px 12px 6px; break-inside:avoid; margin:8px 0 12px; }
.np-box-t { font-family:'UnifrakturMaguntia', serif; font-size:26px; text-align:center; border-bottom:1px solid var(--rule); margin:0 0 8px; }
.np-pick-h { font-weight:700; font-size:15px; margin-top:6px; }
.np-pick-b { font-size:14px; margin:0 0 4px; }
.np-note { font-style:italic; font-size:15px; margin-top:8px; }
.np-board { border:2px solid var(--rule); padding:10px 12px; align-self:start; }
.np-board-t { font-family:'UnifrakturMaguntia', serif; font-size:30px; text-align:center; border-bottom:2px solid var(--rule); margin:0 0 8px; }
.np-cat { font-weight:700; font-size:14px; margin-top:8px; }
.np-row { display:flex; justify-content:space-between; gap:8px; font-size:14px; padding-left:8px; }
.np-row span:last-child { color:var(--soft); white-space:nowrap; }
.np-foot { display:flex; justify-content:space-between; font-family:system-ui, sans-serif; font-size:12px; padding-top:8px; margin-top:16px; border-top:2px solid var(--rule); color:var(--soft); }
.np-empty { color:var(--soft); font-style:italic; }
@media (max-width:760px) { .np { padding:22px 16px 18px; } .np-grid { grid-template-columns:1fr; } .np-cols { column-count:1; } }
`;

const KICKER = { classic: "The weekly paper of the Purge", vintage: "Survivors' weekly", bold: "All the news that's fit to shamble", special: "Special edition" };
const SECTION = { classic: ["BREAKING NEWS", ""], vintage: ["Breaking News!", "black"], bold: ["Breaking News!", "black"], special: ["BREAKING NEWS", ""] };
const RULE = { classic: "", vintage: "thin", bold: "fat", special: "thin" };

const Paras = ({ text }) => String(text || "").split(/\n+/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>);

export default function Newspaper({ paper }) {
  if (!paper) return null;
  const t = paper.template || "classic";
  const layout = paper.layout || "photo-top";
  const head = paper.headline || {};
  const lead = head.picture?.url;
  const [sectionText, sectionCls] = SECTION[t] || SECTION.classic;
  const stories = paper.stories || [];
  const rankings = (paper.rankings || []).filter((c) => (c.rows || []).length);
  const footer = paper.footer || (paper.contributors?.length ? "With contributions from " + paper.contributors.join(", ") : "");
  return (
    <div className={`np np-${t}`}>
      <style>{STYLE}</style>
      <div className="np-kicker">{KICKER[t] || KICKER.classic}</div>
      <div className="np-title">{paper.title || "State of Undead Purge"}</div>
      <hr className={`np-rule ${RULE[t] || ""}`} />
      <div className="np-dateline"><span>Weekly &nbsp;|&nbsp; Issue No. {paper.issue_no || 0}</span><span>{paper.date_text}</span></div>
      <hr className="np-rule thin" />
      <div className={`np-section ${sectionCls}`}>{sectionText}</div>
      <h1 className="np-headline">{head.title}</h1>
      <div className="np-byline">{paper.byline || "Written by Zombita"}</div>
      {layout === "photo-top" && (lead ? <img className="np-lead" src={lead} alt="" /> : <div className="np-lead np-empty" />)}
      <div className="np-grid">
        <div>
          {layout !== "photo-top" && (lead ? <img className="np-lead tall" src={lead} alt="" style={{ float: layout === "photo-right" ? "right" : "left", width: "55%", margin: layout === "photo-right" ? "0 0 10px 16px" : "0 16px 10px 0" }} /> : null)}
          {layout !== "photo-top" && (
            <div className="np-lead-body">
              <Paras text={head.body} />
              {paper.quote && <div className="np-quote">&ldquo;{String(paper.quote).replace(/^"|"$/g, "")}&rdquo;</div>}
            </div>
          )}
          <div className="np-cols">
            {layout === "photo-top" && <Paras text={head.body} />}
            {layout === "photo-top" && paper.quote && <div className="np-quote">&ldquo;{String(paper.quote).replace(/^"|"$/g, "")}&rdquo;</div>}
            {stories.map((s, i) => (
              <div key={i}>
                <hr className="np-hr" />
                <div className="np-story-h">{s.title}</div>
                {i === 0 && s.picture?.url && <img className="np-story-pic" src={s.picture.url} alt="" />}
                <Paras text={s.body} />
              </div>
            ))}
            {paper.picks?.length > 0 && (
              <div className="np-box">
                <div className="np-box-t">Zombita&rsquo;s Picks</div>
                {paper.picks.map((p, i) => <div key={i}><div className="np-pick-h">{p.title}</div><p className="np-pick-b">{p.body}</p></div>)}
              </div>
            )}
            {paper.editor_note && <div className="np-note">{paper.editor_note} &mdash; Zombita</div>}
          </div>
        </div>
        <div className="np-board">
          <div className="np-board-t">The Board</div>
          {rankings.length === 0 && <div className="np-empty">No rankings yet.</div>}
          {rankings.map((c) => (
            <div key={c.key || c.label}>
              <div className="np-cat">{c.label}</div>
              {c.rows.slice(0, 3).map((r, i) => <div className="np-row" key={i}><span>{i + 1}. {r.name}</span><span>{r.text}</span></div>)}
            </div>
          ))}
        </div>
      </div>
      <div className="np-foot"><span>{footer}</span><span>{paper.title || "State of Undead Purge"} &nbsp;|&nbsp; No. {paper.issue_no || 0}</span></div>
    </div>
  );
}
