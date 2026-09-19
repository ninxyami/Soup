"use client";
// @ts-nocheck
// Zombita's weekly newspaper: settings, this week's draft (approve / edit / remake / publish),
// the editor with a live preview, and past issues. The bot (cogs/newspaper.py) writes the
// draft on Saturday, posts it to the admin channel with the same buttons, and publishes on
// Sunday; anything decided here shows up there within a minute. Editing here counts as
// approval and puts your name on the paper ("With contributions from ...").
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchApi, postApi, fmtFull, Title, SC, B, TW, Load, Empty, Inp, Sel, TA, Toggle } from "./shared";
import Newspaper from "@/components/Newspaper";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const mono = { fontFamily: "var(--mono)", fontSize: 12 };
const STATUS_COL = { draft: "#c8a84b", approved: "#4a7c59", edited: "#4a7c59", published: "#8fb", expired: "#888", skipped: "#888", rejected: "#a55", remade: "#888", withdrawn: "#a55" };
const STATUS_TEXT = {
  draft: "waiting for a decision", approved: "approved, goes out at publish time", edited: "edited here, goes out at publish time",
  published: "published", expired: "nobody decided in time", skipped: "skipped", rejected: "rejected", remade: "sent back and rewritten",
  withdrawn: "taken down (Publish puts it back)",
};

const putApi = (path, body) => fetchApi(path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const when = (ts) => (ts ? fmtFull(ts) + " UTC" : "—");

// ── the editor ───────────────────────────────────────────────────────────────
function Editor({ issue, templates, layouts, onSaved, toast }) {
  const [p, setP] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileHead = useRef(null);
  const fileStory = useRef(null);
  useEffect(() => { setP(issue ? JSON.parse(JSON.stringify(issue.paper)) : null); }, [issue?.id, issue?.published_at, issue?.contributors?.length]);
  if (!issue || !p) return null;
  const editable = ["draft", "approved", "edited", "expired"].includes(issue.status);
  const set = (fn) => setP((old) => { const n = JSON.parse(JSON.stringify(old)); fn(n); return n; });

  const save = async () => {
    setBusy(true);
    try {
      const r = await putApi(`/api/admin/newspaper/issues/${issue.id}`, {
        headline: { title: p.headline.title, body: p.headline.body },
        stories: p.stories.map((s) => ({ title: s.title, body: s.body })),
        picks: p.picks, quote: p.quote, editor_note: p.editor_note, template: p.template, layout: p.layout,
      });
      toast(r.message, "success"); onSaved(r.issue);
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };
  const upload = async (slot, input) => {
    const f = input.current?.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await fetchApi(`/api/admin/newspaper/issues/${issue.id}/picture/${slot}`, { method: "POST", body: fd });
      toast(r.message, "success"); onSaved(r.issue);
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
    input.current.value = "";
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: 18, alignItems: "start" }}>
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Sel label="Paper" value={p.template} disabled={!editable} onChange={(e) => set((n) => { n.template = e.target.value; })}>
            {templates.map((t) => <option key={t} value={t}>{t}</option>)}
          </Sel>
          <Sel label="Layout" value={p.layout} disabled={!editable} onChange={(e) => set((n) => { n.layout = e.target.value; })}>
            {layouts.map((l) => <option key={l} value={l}>{l}</option>)}
          </Sel>
        </div>
        <Inp label="Headline" value={p.headline.title} disabled={!editable} onChange={(e) => set((n) => { n.headline.title = e.target.value; })} />
        <TA label="Lead story" rows={7} value={p.headline.body} disabled={!editable} onChange={(e) => set((n) => { n.headline.body = e.target.value; })} />
        <div className="ap-fg"><label className="ap-fl">Lead picture</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="file" accept="image/*" ref={fileHead} disabled={!editable || busy} onChange={() => upload("head", fileHead)} style={{ fontSize: 12 }} />
            <span style={{ ...mono, color: "#888" }}>{p.headline.picture?.source || "none"}</span>
          </div>
          {p.headline.picture?.prompt && <div style={{ ...mono, color: "#666", marginTop: 4 }}>Zombita asked for: {p.headline.picture.prompt}</div>}
        </div>
        {p.stories.map((s, i) => (
          <div key={i} style={{ borderTop: "1px solid #222", paddingTop: 8, marginTop: 8 }}>
            <Inp label={`Story ${i + 1} title`} value={s.title} disabled={!editable} onChange={(e) => set((n) => { n.stories[i].title = e.target.value; })} />
            <TA label={`Story ${i + 1}`} rows={5} value={s.body} disabled={!editable} onChange={(e) => set((n) => { n.stories[i].body = e.target.value; })} />
            {i === 0 && (
              <div className="ap-fg"><label className="ap-fl">Story 1 picture</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="file" accept="image/*" ref={fileStory} disabled={!editable || busy} onChange={() => upload("story1", fileStory)} style={{ fontSize: 12 }} />
                  <span style={{ ...mono, color: "#888" }}>{s.picture?.source || "none"}</span>
                </div>
              </div>
            )}
            {editable && <B c="ghost" sm onClick={() => set((n) => { n.stories.splice(i, 1); })}>remove story</B>}
          </div>
        ))}
        {editable && p.stories.length < 4 && <B c="ghost" sm onClick={() => set((n) => { n.stories.push({ title: "New story", body: "", picture: {} }); })}>+ story</B>}
        <div style={{ borderTop: "1px solid #222", paddingTop: 8, marginTop: 8 }}>
          <div className="ap-fl">Zombita&rsquo;s picks</div>
          {p.picks.map((k, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 6, alignItems: "end" }}>
              <Inp value={k.title} disabled={!editable} onChange={(e) => set((n) => { n.picks[i].title = e.target.value; })} />
              <Inp value={k.body} disabled={!editable} onChange={(e) => set((n) => { n.picks[i].body = e.target.value; })} />
              {editable && <B c="ghost" sm onClick={() => set((n) => { n.picks.splice(i, 1); })}>×</B>}
            </div>
          ))}
          {editable && p.picks.length < 5 && <B c="ghost" sm onClick={() => set((n) => { n.picks.push({ title: "", body: "" }); })}>+ pick</B>}
        </div>
        <Inp label="Quote of the week" value={p.quote || ""} disabled={!editable} onChange={(e) => set((n) => { n.quote = e.target.value; })} />
        <Inp label="Zombita's note to the readers" value={p.editor_note || ""} disabled={!editable} onChange={(e) => set((n) => { n.editor_note = e.target.value; })} />
        <div style={{ ...mono, color: "#777", margin: "6px 0 10px" }}>
          Fixed on every paper: the title (settings), the date it was written, &ldquo;Written by Zombita&rdquo;, and the footer naming who edited it.
        </div>
        {editable
          ? <B onClick={save} disabled={busy}>Save (counts as approval)</B>
          : <span style={{ ...mono, color: "#888" }}>This issue is {issue.status}; it can&rsquo;t be edited any more.</span>}
      </div>
      <div style={{ minWidth: 0 }}><Newspaper paper={p} /></div>
    </div>
  );
}

// ── settings ─────────────────────────────────────────────────────────────────
function Settings({ settings, onSaved, toast }) {
  const [s, setS] = useState(settings);
  const [busy, setBusy] = useState(false);
  useEffect(() => setS(settings), [settings]);
  const f = (k) => ({ value: s[k] ?? "", onChange: (e) => setS({ ...s, [k]: e.target.value }) });
  const save = async () => {
    setBusy(true);
    try { const r = await putApi("/api/admin/newspaper/settings", s); toast("Newspaper settings saved", "success"); onSaved(r.settings); }
    catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
        <Inp label="Newspaper title (masthead)" {...f("title")} />
        <div className="ap-fg"><label className="ap-fl">Weekly paper</label><Toggle value={s.enabled === "1"} onChange={(v) => setS({ ...s, enabled: v ? "1" : "0" })} /></div>
        <Sel label="Zombita writes on" {...f("write_dow")}>{DAYS.map((d, i) => <option key={i} value={String(i)}>{d}</option>)}</Sel>
        <Inp label="at (hour, UTC)" type="number" min="0" max="23" {...f("write_hour")} />
        <Sel label="Published on" {...f("publish_dow")}>{DAYS.map((d, i) => <option key={i} value={String(i)}>{d}</option>)}</Sel>
        <Inp label="at (hour, UTC)" type="number" min="0" max="23" {...f("publish_hour")} />
        <Inp label="Reminders (hours after writing, comma separated)" {...f("reminders")} />
        <Inp label="Skip the week if the activity score is under" type="number" min="0" {...f("min_activity")} />
        <Inp label="Stories besides the headline (1-4)" type="number" min="1" max="4" {...f("max_stories")} />
        <div className="ap-fg"><label className="ap-fl">Only name whitelisted players</label><Toggle value={s.whitelist_only === "1"} onChange={(v) => setS({ ...s, whitelist_only: v ? "1" : "0" })} /></div>
        <Inp label="Admin review channel id" {...f("review_channel")} />
        <Inp label="Public news channel id" {...f("news_channel")} />
        <Inp label="Website address (for the buttons)" {...f("website_url")} />
      </div>
      <div style={{ borderTop: "1px solid #222", margin: "12px 0 8px", paddingTop: 8 }} className="ap-fl">Pictures</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
        <div className="ap-fg"><label className="ap-fl">Generate pictures (OpenAI, on the bot's key)</label><Toggle value={s.images === "1"} onChange={(v) => setS({ ...s, images: v ? "1" : "0" })} /></div>
        <Sel label="Model" {...f("image_model")}><option value="gpt-image-1">gpt-image-1</option><option value="dall-e-3">dall-e-3</option></Sel>
        <Sel label="Quality" {...f("image_quality")}><option value="low">low (~1c)</option><option value="medium">medium (~4c)</option><option value="high">high (~17c)</option></Sel>
        <TA label="Picture style (added to every prompt)" rows={2} {...f("image_style")} />
      </div>
      <div style={{ ...mono, color: "#777", margin: "6px 0 10px" }}>Off or failed: pictures from discord-bot/media/newspaper/presets/, else none. Admins can upload their own in the editor.</div>
      <B onClick={save} disabled={busy}>Save settings</B>
    </div>
  );
}

// ── the media pack (same button as Zombita Control's UPDATE MEDIA NOW and /mediapack) ──
function MediaPack({ toast }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const check = async () => {
    setBusy(true); setMsg("Looking (fetches every avatar, up to ~30 s)...");
    try { const r = await fetchApi("/api/admin/media/check"); setMsg(r.message); }
    catch (e) { setMsg(""); toast(e.message, "error"); }
    setBusy(false);
  };
  const update = async () => {
    if (!confirm("Look for new pictures (Discord avatars, post pictures, newspaper photos)? If there are new ones, the server restarts with a 5-minute warning to everyone online and the pack is uploaded while it's down. If there's nothing new, nothing happens.")) return;
    setBusy(true); setMsg("Checking...");
    try { const r = await postApi("/api/admin/media/update"); setMsg(r.message); toast(r.message, "success"); }
    catch (e) { setMsg(""); toast(e.message, "error"); }
    setBusy(false);
  };
  return (
    <div>
      <div style={{ ...mono, color: "#777", marginBottom: 8 }}>
        Pictures reach the game through the Zombita Media Workshop pack, which is rebuilt and uploaded during restarts while the server is stopped.
        Newspaper photos ride the next restart by themselves; this only brings that restart forward.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <B c="ghost" sm disabled={busy} onClick={check}>Check for new pictures</B>
        <B c="gold" sm disabled={busy} onClick={update}>Update media now</B>
        {msg && <span style={{ ...mono, color: "#aaa" }}>{msg}</span>}
      </div>
    </div>
  );
}

// ── the tab ──────────────────────────────────────────────────────────────────
export default function NewspaperTab({ toast }) {
  const [st, setSt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);       // issue open in the editor
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await fetchApi("/api/admin/newspaper/state");
      setSt(d);
      setSel((cur) => {
        const wanted = cur?.id || Number(new URLSearchParams(window.location.search).get("issue")) || d.current?.id;
        return [...d.queue, ...d.history].find((i) => i.id === wanted) || d.current || d.queue[0] || null;
      });
    } catch (e) { toast?.("Newspaper: " + e.message, "error"); }
    setLoading(false);
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const act = async (issue, action, question) => {
    if (question && !confirm(question)) return;
    setBusy(true);
    try { const r = await postApi(`/api/admin/newspaper/issues/${issue.id}/${action}`); toast(r.message, "success"); await load(); if (r.issue) setSel(r.issue); }
    catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };
  const takeDown = (issue) => act(issue, "withdraw",
    `Take No. ${issue.issue_no} down?\n\nIt leaves the website and the hub now, and Zombita removes its post in the news channel within a minute. Nothing is deleted: it stays here as "withdrawn", and Publish puts it back out.`);
  const writeNow = async () => {
    if (!confirm("Ask Zombita to write a fresh draft now? It replaces this week's draft (if any) and goes to the admin channel for approval. Takes a minute or two.")) return;
    setBusy(true);
    try { const r = await postApi("/api/admin/newspaper/write"); toast(r.message, "success"); await load(); if (r.issue) setSel(r.issue); }
    catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  if (loading) return <Load />;
  if (!st) return <Empty text="The newspaper API isn't answering (zombita-api needs the new routers/newspaper.py)." />;
  const cur = st.current;
  const col = (s) => STATUS_COL[s] || "#888";

  return (
    <div>
      <Title t="NEWSPAPER" s="Zombita writes it on Saturday from everything she saw that week; an admin approves, edits or sends it back; it goes out Sunday on Discord, here (/newspaper) and in the Server Hub." />
      <div className="ap-sc-row" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <SC label="This week" value={cur ? `No. ${cur.issue_no}` : "not written"} sub={cur ? STATUS_TEXT[cur.status] || cur.status : `writes ${when(st.week.write_at)}`} color={cur ? "" : "dim"} />
        <SC label="Publishes" value={when(st.week.publish_at)} sub={st.settings.enabled === "1" ? "if approved or edited" : "paper is OFF"} />
        <SC label="Week" value={st.week.key} sub={`covers ${when(st.week.since)} → ${when(st.week.write_at)}`} />
      </div>

      <TW title="THIS WEEK'S PAPER" right={<B c="ghost" sm onClick={writeNow} disabled={busy}>Write now</B>}>
        {!cur && <Empty text={`Nothing written yet. Zombita writes ${when(st.week.write_at)}; or press Write now.`} />}
        {cur && (
          <div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{ ...mono, color: col(cur.status), border: `1px solid ${col(cur.status)}44`, padding: "2px 8px" }}>{cur.status.toUpperCase()}</span>
              <span style={mono}>{(cur.paper.headline || {}).title}</span>
              <span style={{ ...mono, color: "#777" }}>written {when(cur.written_at)} · activity {cur.activity}{cur.decided_by ? ` · ${cur.status} by ${cur.decided_by}` : ""}{cur.contributors?.length ? ` · edited by ${cur.contributors.join(", ")}` : ""}</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["draft", "expired"].includes(cur.status) && <B c="green" sm disabled={busy} onClick={() => act(cur, "approve")}>✅ Approve</B>}
              {["draft", "approved", "edited", "expired"].includes(cur.status) && <B c="ghost" sm disabled={busy} onClick={() => setSel(cur)}>✏️ Edit</B>}
              {["draft", "approved", "edited", "expired"].includes(cur.status) && <B c="red" sm disabled={busy} onClick={() => act(cur, "remake", "Send it back? Zombita writes a new draft (takes a minute or two).")}>🔁 Reject &amp; remake</B>}
              {["draft", "approved", "edited", "expired"].includes(cur.status) && <B c="ghost" sm disabled={busy} onClick={() => act(cur, "reject", "Reject it for good? No paper this week.")}>❌ Reject</B>}
              {["approved", "edited", "draft", "expired"].includes(cur.status) && <B c="gold" sm disabled={busy} onClick={() => act(cur, "publish", "Publish right now (Discord, website, hub) instead of waiting for Sunday?")}>📰 Publish now</B>}
              {!["published", "skipped", "rejected", "remade"].includes(cur.status) && <B c="ghost" sm disabled={busy} onClick={() => act(cur, "skip", "Skip this week's paper?")}>Skip week</B>}
              {cur.status === "published" && <B c="red" sm disabled={busy} onClick={() => takeDown(cur)}>⛔ Take down</B>}
              {cur.status === "withdrawn" && <B c="gold" sm disabled={busy} onClick={() => act(cur, "publish", "Put it back out (website, hub, and a new post in the news channel)?")}>📰 Publish again</B>}
            </div>
          </div>
        )}
      </TW>

      {sel && (
        <TW title={`EDITOR — No. ${sel.issue_no} (${sel.status})`} right={<span style={{ ...mono, color: "#777" }}>the preview updates as you type; Save puts your name on the paper</span>}>
          <Editor issue={sel} templates={st.templates} layouts={st.layouts} toast={toast} onSaved={(i) => { setSel(i); load(); }} />
        </TW>
      )}

      <TW title="PAST ISSUES">
        {!st.history.length && <Empty text="No issues yet." />}
        {st.history.length > 0 && (
          <div style={{ overflowX: "auto" }}><table className="ap-t"><thead><tr><th>No.</th><th>Week</th><th>Status</th><th>Headline</th><th>Written</th><th>Decided</th><th>Edited by</th><th></th></tr></thead><tbody>
            {st.history.map((i) => <tr key={i.id} style={{ background: sel?.id === i.id ? "#161616" : undefined }}>
              <td style={mono}>{i.issue_no}</td><td style={mono}>{i.week_key}</td>
              <td style={{ ...mono, color: col(i.status) }}>{i.status}</td>
              <td style={mono}>{(i.paper.headline || {}).title}</td>
              <td style={mono}>{when(i.written_at)}</td>
              <td style={mono}>{i.decided_by || "—"}</td>
              <td style={mono}>{i.contributors?.length ? i.contributors.join(", ") : "—"}</td>
              <td style={{ whiteSpace: "nowrap" }}><B c="ghost" sm onClick={() => setSel(i)}>open</B>
                {i.status === "published" && <> <B c="ghost" sm disabled={busy} onClick={() => takeDown(i)}>take down</B></>}
                {i.status === "withdrawn" && <> <B c="ghost" sm disabled={busy} onClick={() => act(i, "publish", "Put it back out (website, hub, and a new post in the news channel)?")}>publish again</B></>}</td>
            </tr>)}
          </tbody></table></div>
        )}
      </TW>

      <TW title="PICTURES IN GAME  (Zombita Media pack)">
        <MediaPack toast={toast} />
      </TW>

      <TW title="SETTINGS"><Settings settings={st.settings} toast={toast} onSaved={(s) => setSt({ ...st, settings: s })} /></TW>
    </div>
  );
}
