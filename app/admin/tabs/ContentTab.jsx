"use client";
// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { fetchApi, postApi, B, Load, SC, Title, TW, API } from "./shared";

// ── Shared field style helpers ──────────────────────────────────────────────
const inp = {
  background: "var(--surface)", border: "1px solid var(--border)",
  color: "var(--text)", padding: "8px 12px", fontFamily: "var(--mono)",
  fontSize: 12, width: "100%", outline: "none", boxSizing: "border-box",
};
const label = (text) => (
  <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>{text}</div>
);
const Field = ({ name, value, onChange, multiline, rows = 3, placeholder = "" }) => (
  <div style={{ marginBottom: 12 }}>
    {label(name)}
    {multiline
      ? <textarea value={value || ""} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder} style={{ ...inp, resize: "vertical" }} />
      : <input value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inp} />
    }
  </div>
);

// ── Image upload component ───────────────────────────────────────────────────
function ImageUpload({ value, onChange, toast }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useState(null);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch(`${API}/api/admin/content/upload-image`, {
        method: "POST", credentials: "include", body: form,
      });
      if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.detail || "Upload failed"); }
      const d = await r.json();
      onChange(d.url);
      toast("Image uploaded ✓", "success");
    } catch (err) { toast(err.message, "error"); }
    finally { setUploading(false); e.target.value = ""; }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Season Image</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <label style={{
          fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase",
          padding: "6px 14px", cursor: uploading ? "wait" : "pointer",
          border: "1px solid var(--border)", color: uploading ? "var(--textdim)" : "var(--text)",
          background: "var(--surface)", display: "inline-block", whiteSpace: "nowrap",
        }}>
          {uploading ? "Uploading…" : "📁 Upload Image"}
          <input type="file" accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={upload} style={{ display: "none" }} disabled={uploading} />
        </label>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)" }}>or paste a URL below</span>
      </div>
      <input value={value || ""} onChange={e => onChange(e.target.value)}
        placeholder="/assets/season.png or https://..." style={{ ...inp }} />
      {value && (
        <div style={{ marginTop: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="preview" style={{ maxHeight: 120, maxWidth: "100%", border: "1px solid var(--border)", opacity: 0.85 }} />
        </div>
      )}
    </div>
  );
}
// ══════════════════════════════════════════════════════════════
function ServerInfoPanel({ toast }) {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setData(await fetchApi("/api/content/server")); }
    catch { toast("Failed to load server content", "error"); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (v) => setData(d => ({ ...d, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await postApi("/api/admin/content/server", data);
      toast("Server info saved ✓", "success");
    } catch (e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  };

  if (!data) return <Load />;

  return (
    <div>
      <Title>Server Page Info</Title>
      <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", marginBottom: 20 }}>
        Edits here update the public /server page immediately after saving.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          {SC("Connection")}
          <Field name="IP Address" value={data.ip} onChange={set("ip")} />
          <Field name="Port" value={data.port} onChange={set("port")} />
          <Field name="Password" value={data.password} onChange={set("password")} />
        </div>
        <div>
          {SC("Server Specs")}
          <Field name="Max Players" value={data.max_players} onChange={set("max_players")} />
          <Field name="RAM" value={data.ram} onChange={set("ram")} />
          <Field name="Region" value={data.region} onChange={set("region")} />
        </div>
      </div>
      {SC("Game Version")}
      <Field name="Version String (e.g. B42.13.1)" value={data.game_version} onChange={set("game_version")} />
      <Field name="Version Note (shown below version)" value={data.version_note} onChange={set("version_note")} multiline rows={2} />
      {SC("External Links")}
      <Field name="Discord URL" value={data.discord_url} onChange={set("discord_url")} />
      <Field name="Steam Workshop Collection URL" value={data.steam_collection_url} onChange={set("steam_collection_url")} />
      <Field name="Spreadsheet URL" value={data.spreadsheet_url} onChange={set("spreadsheet_url")} />
      {SC("Announcement Banner")}
      <Field name="Announcement (leave blank to hide)" value={data.announcement} onChange={set("announcement")} multiline rows={2} placeholder="e.g. Server restarting Sunday 8PM SGT for maintenance" />
      <B c="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Server Info"}</B>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// MODS TAB
// ══════════════════════════════════════════════════════════════
const MOD_CATEGORIES = ["gameplay", "qol", "visual", "audio", "map", "performance", "other"];

function ModsPanel({ toast }) {
  const [links, setLinks] = useState(null);
  const [mods, setMods] = useState([]);
  const [editing, setEditing] = useState(null); // null | { id, name, workshop_id, category, description, sort_order } | "new"
  const [savingLinks, setSavingLinks] = useState(false);
  const [savingMod, setSavingMod] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await fetchApi("/api/admin/content/mods");
      setLinks(d.links);
      setMods(d.mods || []);
    } catch { toast("Failed to load mods", "error"); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const saveLinks = async () => {
    setSavingLinks(true);
    try {
      await postApi("/api/admin/content/mods/links", links);
      toast("Links saved ✓", "success");
    } catch (e) { toast(e.message, "error"); }
    finally { setSavingLinks(false); }
  };

  const saveMod = async () => {
    if (!editing || !editing.name?.trim()) { toast("Name required", "error"); return; }
    setSavingMod(true);
    try {
      await postApi("/api/admin/content/mods/mod", editing);
      toast("Mod saved ✓", "success");
      setEditing(null);
      load();
    } catch (e) { toast(e.message, "error"); }
    finally { setSavingMod(false); }
  };

  const deleteMod = async (id) => {
    if (!confirm("Remove this mod from the public list?")) return;
    try {
      await fetchApi(`/api/admin/content/mods/mod/${id}`, { method: "DELETE" });
      toast("Mod removed", "success");
      load();
    } catch (e) { toast(e.message, "error"); }
  };

  const setE = (k) => (v) => setEditing(e => ({ ...e, [k]: v }));
  const setL = (k) => (v) => setLinks(l => ({ ...l, [k]: v }));

  return (
    <div>
      <Title>Mods Page</Title>

      {SC("Links")}
      {links ? (
        <>
          <Field name="Steam Workshop Collection URL" value={links.steam_collection_url} onChange={setL("steam_collection_url")} />
          <Field name="Spreadsheet URL" value={links.spreadsheet_url} onChange={setL("spreadsheet_url")} />
          <Field name="Philosophy Text" value={links.philosophy} onChange={setL("philosophy")} multiline rows={3} />
          <B c="primary" onClick={saveLinks} disabled={savingLinks}>{savingLinks ? "Saving…" : "Save Links"}</B>
        </>
      ) : <Load />}

      <div style={{ height: 24 }} />
      {SC("Mod List")}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>{mods.length} mods</span>
        <B c="success" sm onClick={() => setEditing({ name: "", workshop_id: "", category: "gameplay", description: "", sort_order: 0, enabled: true })}>+ Add Mod</B>
      </div>

      {editing && (
        <div style={{ border: "1px solid var(--accent)", background: "var(--surface)", padding: 16, marginBottom: 16 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
            {editing.id ? "Edit Mod" : "New Mod"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field name="Mod Name *" value={editing.name} onChange={setE("name")} />
            <Field name="Workshop ID (numbers only)" value={editing.workshop_id} onChange={setE("workshop_id")} placeholder="e.g. 2392709985" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ marginBottom: 12 }}>
              {label("Category")}
              <select value={editing.category} onChange={e => setE("category")(e.target.value)} style={{ ...inp }}>
                {MOD_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <Field name="Sort Order (lower = first)" value={String(editing.sort_order || 0)} onChange={v => setE("sort_order")(parseInt(v) || 0)} />
          </div>
          <Field name="Description (optional)" value={editing.description} onChange={setE("description")} multiline rows={2} placeholder="Brief description shown on the page" />
          <div style={{ display: "flex", gap: 8 }}>
            <B c="primary" onClick={saveMod} disabled={savingMod}>{savingMod ? "Saving…" : "Save Mod"}</B>
            <B c="ghost" onClick={() => setEditing(null)}>Cancel</B>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {mods.map(m => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid var(--border)", background: "var(--surface)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text)" }}>{m.name}</span>
              {m.workshop_id && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)", marginLeft: 8 }}>#{m.workshop_id}</span>}
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)", marginLeft: 8 }}>[{m.category}]</span>
            </div>
            <B c="ghost" sm onClick={() => setEditing({ ...m })}>Edit</B>
            <B c="danger" sm onClick={() => deleteMod(m.id)}>✕</B>
          </div>
        ))}
        {mods.length === 0 && <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", padding: "16px 0" }}>No mods added yet.</div>}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// SEASON TAB
// ══════════════════════════════════════════════════════════════
function SeasonPanel({ toast }) {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setData(await fetchApi("/api/content/season")); }
    catch { toast("Failed to load season content", "error"); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  const set = (k) => (v) => setData(d => ({ ...d, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await postApi("/api/admin/content/season", data);
      toast("Season saved ✓", "success");
    } catch (e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  };

  if (!data) return <Load />;

  return (
    <div>
      <Title>Season Page</Title>
      <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", marginBottom: 20 }}>
        Controls what appears on the public /seasons page.
      </p>
      {SC("Season Identity")}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Field name="Full Name (e.g. Season 2: Dust)" value={data.name} onChange={set("name")} />
        <Field name="Short (e.g. Season 2)" value={data.short} onChange={set("short")} />
        <Field name="Subtitle (e.g. Dust)" value={data.subtitle} onChange={set("subtitle")} />
      </div>
      {SC("Status")}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ marginBottom: 12 }}>
          {label("Status")}
          <select value={data.status} onChange={e => set("status")(e.target.value)} style={{ ...inp }}>
            {["Active", "Upcoming", "Ended", "Paused"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <Field name="Status Note (e.g. 'Starts Jan 15')" value={data.status_note} onChange={set("status_note")} />
      </div>
      {SC("Description")}
      <Field name="Season Description (shown below image)" value={data.description} onChange={set("description")} multiline rows={4} placeholder="A couple sentences about this season's theme, lore, or what's new." />
      {SC("Image")}
      <ImageUpload value={data.image_url} onChange={set("image_url")} toast={toast} />
      {SC("Other Details")}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field name="Map" value={data.map} onChange={set("map")} />
        <Field name="Economy" value={data.economy} onChange={set("economy")} />
      </div>
      <B c="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Season"}</B>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// ARCHIVE TAB
// ══════════════════════════════════════════════════════════════
function ArchivePanel({ toast }) {
  const [seasons, setSeasons] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [storyText, setStoryText] = useState("");
  const [storyTarget, setStoryTarget] = useState(null);
  const [savingStory, setSavingStory] = useState(false);
  const [storyExport, setStoryExport] = useState(null);
  const [loadingExport, setLoadingExport] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await fetchApi("/api/content/archive");
      setSeasons(d.seasons || []);
    } catch { toast("Failed to load archive", "error"); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const setE = (k) => (v) => setEditing(e => ({ ...e, [k]: v }));

  const newEntry = () => setEditing({
    season_name: "", subtitle: "", dates: "", description: "",
    image_url: "", story: "", sort_order: seasons.length,
    standouts: [{ label: "", value: "" }, { label: "", value: "" }, { label: "", value: "" }],
  });

  const save = async () => {
    if (!editing.season_name?.trim()) { toast("Season name required", "error"); return; }
    setSaving(true);
    try {
      await postApi("/api/admin/content/archive", {
        ...editing,
        standouts: editing.standouts.filter(s => s.label.trim()),
      });
      toast("Archive entry saved ✓", "success");
      setEditing(null);
      load();
    } catch (e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const deleteEntry = async (name) => {
    if (!confirm(`Remove ${name} from archive?`)) return;
    try {
      await fetchApi(`/api/admin/content/archive/${encodeURIComponent(name)}`, { method: "DELETE" });
      toast("Removed", "success");
      load();
    } catch (e) { toast(e.message, "error"); }
  };

  const saveStory = async () => {
    if (!storyTarget) return;
    setSavingStory(true);
    try {
      await postApi("/api/admin/content/archive-story", { season_name: storyTarget, story: storyText });
      toast("Story saved ✓", "success");
      setStoryTarget(null);
      load();
    } catch (e) { toast(e.message, "error"); }
    finally { setSavingStory(false); }
  };

  const exportStory = async () => {
    setLoadingExport(true);
    try {
      const d = await fetchApi("/api/admin/content/season-story");
      setStoryExport(d);
    } catch (e) { toast(e.message, "error"); }
    finally { setLoadingExport(false); }
  };

  const setStandout = (i, k, v) => {
    const next = [...(editing.standouts || [])];
    next[i] = { ...next[i], [k]: v };
    setEditing(e => ({ ...e, standouts: next }));
  };

  return (
    <div>
      <Title>Archive</Title>
      <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", marginBottom: 20 }}>
        Manage past season entries and attach written chronicles.
      </p>

      {/* Season Story Export */}
      <div style={{ border: "1px solid var(--border)", background: "var(--surface)", padding: 16, marginBottom: 20 }}>
        {SC("Season Story Export")}
        <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", marginBottom: 12 }}>
          Export all of Zombita&apos;s season observations as a structured text dump — ready to feed to an AI to generate a season chronicle.
        </p>
        <B c="ghost" onClick={exportStory} disabled={loadingExport}>
          {loadingExport ? "Loading…" : "Export Season Events →"}
        </B>
        {storyExport && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)", marginBottom: 8 }}>
              {storyExport.total_events} events · {storyExport.players} players · {storyExport.season}
            </div>
            <textarea
              readOnly
              value={storyExport.prompt_text}
              rows={12}
              style={{ ...inp, resize: "vertical", opacity: 0.7, fontSize: 10 }}
              onClick={e => e.target.select()}
            />
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)", marginTop: 4 }}>
              Click to select all · Copy and paste into Claude or GPT to generate the season story
            </div>
          </div>
        )}
      </div>

      {/* Archive entries */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>{seasons.length} entries</span>
        <B c="success" sm onClick={newEntry}>+ Add Season</B>
      </div>

      {/* Edit form */}
      {editing && (
        <div style={{ border: "1px solid var(--accent)", background: "var(--surface)", padding: 16, marginBottom: 16 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
            {editing.id ? `Edit: ${editing.season_name}` : "New Archive Entry"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field name="Season Name *" value={editing.season_name} onChange={setE("season_name")} placeholder="e.g. Dawnpocalypse" />
            <Field name="Subtitle" value={editing.subtitle} onChange={setE("subtitle")} placeholder="e.g. The Pre-Season" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field name="Dates" value={editing.dates} onChange={setE("dates")} placeholder="e.g. Jan–Apr 2025" />
            <Field name="Sort Order" value={String(editing.sort_order || 0)} onChange={v => setE("sort_order")(parseInt(v) || 0)} />
          </div>
          <Field name="Description" value={editing.description} onChange={setE("description")} multiline rows={3} />
          <ImageUpload value={editing.image_url} onChange={setE("image_url")} toast={toast} />
          {SC("Standout Stats (up to 5)")}
          {(editing.standouts || []).map((s, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 6 }}>
              <input value={s.label} onChange={e => setStandout(i, "label", e.target.value)} placeholder={`Stat ${i + 1} label`} style={{ ...inp, fontSize: 11 }} />
              <input value={s.value} onChange={e => setStandout(i, "value", e.target.value)} placeholder="Value" style={{ ...inp, fontSize: 11 }} />
            </div>
          ))}
          <B c="ghost" sm onClick={() => setEditing(e => ({ ...e, standouts: [...(e.standouts || []), { label: "", value: "" }] }))}>+ Add Stat</B>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <B c="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Entry"}</B>
            <B c="ghost" onClick={() => setEditing(null)}>Cancel</B>
          </div>
        </div>
      )}

      {/* Story editor */}
      {storyTarget && (
        <div style={{ border: "1px solid var(--green)", background: "var(--surface)", padding: 16, marginBottom: 16 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--green)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
            Season Chronicle: {storyTarget}
          </div>
          <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", marginBottom: 10 }}>
            Paste the AI-generated story here. It will appear on the public archive page under this season.
          </p>
          <textarea value={storyText} onChange={e => setStoryText(e.target.value)} rows={12}
            placeholder="Paste the season chronicle here…" style={{ ...inp, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <B c="success" onClick={saveStory} disabled={savingStory}>{savingStory ? "Saving…" : "Save Story"}</B>
            <B c="ghost" onClick={() => setStoryTarget(null)}>Cancel</B>
          </div>
        </div>
      )}

      {/* Season list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {seasons.map(s => (
          <div key={s.season_name} style={{ border: "1px solid var(--border)", background: "var(--surface)", padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text)" }}>{s.season_name}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)", marginLeft: 10 }}>{s.subtitle}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)", marginLeft: 10 }}>{s.dates}</span>
                {s.story && <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--green)", marginLeft: 10 }}>● chronicle written</span>}
              </div>
              <B c="ghost" sm onClick={() => { setStoryTarget(s.season_name); setStoryText(s.story || ""); }}>
                {s.story ? "Edit Story" : "Add Story"}
              </B>
              <B c="ghost" sm onClick={() => setEditing({ ...s, standouts: s.standouts || [] })}>Edit</B>
              <B c="danger" sm onClick={() => deleteEntry(s.season_name)}>✕</B>
            </div>
          </div>
        ))}
        {seasons.length === 0 && <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", padding: "12px 0" }}>No archive entries yet.</div>}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// MAIN ContentTab
// ══════════════════════════════════════════════════════════════
const TABS = [
  { key: "server",  label: "🖥️  Server Info" },
  { key: "mods",    label: "🔧  Mods" },
  { key: "season",  label: "📅  Season" },
  { key: "archive", label: "📜  Archive" },
];

export default function ContentTab({ toast }) {
  const [tab, setTab] = useState("server");

  return (
    <div>
      <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase",
            padding: "8px 16px", cursor: "pointer", background: "transparent",
            border: "none", borderBottom: tab === t.key ? "2px solid var(--accent)" : "2px solid transparent",
            color: tab === t.key ? "var(--accent)" : "var(--textdim)",
            transition: "all 0.15s",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "server"  && <ServerInfoPanel toast={toast} />}
      {tab === "mods"    && <ModsPanel toast={toast} />}
      {tab === "season"  && <SeasonPanel toast={toast} />}
      {tab === "archive" && <ArchivePanel toast={toast} />}
    </div>
  );
}
