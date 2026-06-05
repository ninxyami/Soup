"use client";
// @ts-nocheck
import { useState, useEffect, useCallback, useMemo } from "react";
import { API, fetchApi, postApi, Title, SC, TW, B, Empty, Load } from "./shared";

// ──────────────────────────────────────────────────────────────────────────
// P6 — Owner-only settings page.
//
// Edits the ZOMBITA_* tuning knobs in .env via owner-only endpoints. These
// knobs are read at process start, so changes apply on RESTART — the page is
// upfront about that and gives a restart button. Security is enforced
// SERVER-SIDE (get_owner_session → 403); this UI just hides the controls from
// non-owners as a courtesy.
//
// Owner = Nin Nin. Matches OWNER_DISCORD_ID on the backend.
// ──────────────────────────────────────────────────────────────────────────

const OWNER_DISCORD_ID = "228533264174940160";

const GROUP_ORDER = ["Switches", "Models", "Chattiness", "Summary", "Thinking", "Memory", "Console"];
const GROUP_ICON = {
  Switches: "🔌", Models: "🧠", Chattiness: "💬",
  Summary: "📓", Thinking: "🌙", Memory: "📖", Console: "🧟",
};

// ── one editable field, by type ──
const Field = ({ spec, value, onChange }) => {
  const t = spec.type;
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 14, padding: "12px 0",
      borderBottom: "1px solid var(--border)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text)" }}>
          {spec.label || spec.key}
        </div>
        {spec.help && (
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", marginTop: 2, lineHeight: 1.5 }}>
            {spec.help}
          </div>
        )}
        <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--muted)", marginTop: 3, opacity: 0.6 }}>
          {spec.key} · default {spec.default}
        </div>
      </div>
      <div style={{ flexShrink: 0, width: 150, textAlign: "right" }}>
        {t === "bool" ? (
          <button
            onClick={() => onChange(value === "true" ? "false" : "true")}
            style={{
              fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 1, textTransform: "uppercase",
              padding: "6px 14px", borderRadius: 3, cursor: "pointer",
              border: `1px solid ${value === "true" ? "var(--green)" : "var(--border)"}`,
              background: value === "true" ? "rgba(74,124,89,0.12)" : "transparent",
              color: value === "true" ? "var(--green)" : "var(--muted)",
              minWidth: 70,
            }}>
            {value === "true" ? "● ON" : "○ OFF"}
          </button>
        ) : (
          <input
            className="ap-inp"
            type={t === "int" || t === "float" ? "number" : "text"}
            step={t === "float" ? "0.01" : t === "int" ? "1" : undefined}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: "100%", textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}
          />
        )}
      </div>
    </div>
  );
};

export default function SettingsTab({ toast }) {
  const [me, setMe]           = useState(null);
  const [schema, setSchema]   = useState([]);
  const [values, setValues]   = useState({});
  const [original, setOriginal] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [savedNeedsRestart, setSavedNeedsRestart] = useState(false);

  // resolve identity (owner gate is server-side; this is just UX)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/auth/me`, { credentials: "include" });
        const d = await r.json();
        setMe(String(d.discord_id || ""));
      } catch { setMe(""); }
    })();
  }, []);

  const isOwner = me === OWNER_DISCORD_ID;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchApi("/api/admin/settings/schema");
      setSchema(data.schema || []);
      setValues(data.values || {});
      setOriginal(data.values || {});
    } catch (e) {
      // 403 for non-owners is expected; don't alarm them
      if (!String(e.message).includes("Owner")) toast?.(e.message, "error");
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { if (isOwner) load(); else setLoading(false); }, [isOwner, load]);

  const dirty = useMemo(
    () => Object.keys(values).some(k => values[k] !== original[k]),
    [values, original]
  );

  const grouped = useMemo(() => {
    const g = {};
    for (const s of schema) (g[s.group] ||= []).push(s);
    return g;
  }, [schema]);

  const setVal = (k, v) => setValues(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    // only send changed keys
    const changed = {};
    for (const k of Object.keys(values)) if (values[k] !== original[k]) changed[k] = values[k];
    if (!Object.keys(changed).length) return;
    setSaving(true);
    try {
      const r = await postApi("/api/admin/settings/save", { values: changed });
      setOriginal({ ...original, ...changed });
      setSavedNeedsRestart(true);
      toast?.(`Saved ${r.saved} setting${r.saved === 1 ? "" : "s"} · restart to apply`, "success");
    } catch (e) { toast?.(e.message, "error"); }
    setSaving(false);
  };

  const restart = async () => {
    if (!confirm("Restart discord-bot and zombita-api now? Brief downtime while they come back up.")) return;
    setRestarting(true);
    try {
      const r = await postApi("/api/admin/settings/restart", {});
      if (r.ok) {
        toast?.("Services restarting — settings now applied", "success");
        setSavedNeedsRestart(false);
      } else {
        toast?.("Some services failed to restart — check the box", "error");
      }
    } catch (e) { toast?.(e.message, "error"); }
    setRestarting(false);
  };

  if (loading) return <><Title t="SETTINGS" s="zombita tuning knobs · owner only" /><Load /></>;

  if (!isOwner) {
    return (
      <>
        <Title t="SETTINGS" s="owner only" />
        <Empty text="this page is owner-only." />
      </>
    );
  }

  return (
    <>
      <Title t="SETTINGS" s="zombita tuning knobs · owner only · applies on restart" />

      <div className="ap-sr">
        <SC label="Knobs" value={schema.length} />
        <SC label="Unsaved" value={Object.keys(values).filter(k => values[k] !== original[k]).length}
            color={dirty ? "orange" : ""} />
        <SC label="Apply" value={savedNeedsRestart ? "restart" : "—"}
            color={savedNeedsRestart ? "blue" : ""} />
      </div>

      {/* sticky action bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap",
        padding: "12px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4,
      }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", flex: 1, minWidth: 180 }}>
          {dirty ? "Unsaved changes — save, then restart to apply."
                 : savedNeedsRestart ? "Saved. Restart the services to apply."
                 : "All settings saved and applied."}
        </span>
        <B c="gold" sm onClick={save} disabled={!dirty || saving}>
          {saving ? "⏳ Saving…" : "💾 Save to .env"}
        </B>
        <B c={savedNeedsRestart ? "green" : "ghost"} sm onClick={restart} disabled={restarting}>
          {restarting ? "⏳ Restarting…" : "♻ Restart services"}
        </B>
      </div>

      {GROUP_ORDER.filter(g => grouped[g]?.length).map(group => (
        <TW key={group} title={`${GROUP_ICON[group] || ""} ${group.toUpperCase()}`}>
          <div style={{ padding: "0 2px" }}>
            {grouped[group].map(spec => (
              <Field key={spec.key} spec={spec} value={values[spec.key]}
                     onChange={(v) => setVal(spec.key, v)} />
            ))}
          </div>
        </TW>
      ))}

      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", marginTop: 16, lineHeight: 1.7 }}>
        Secrets (API keys, database, tokens) are never shown or editable here.
        Every save backs up the previous .env first.
      </div>
    </>
  );
}
