"use client";
// @ts-nocheck
import { useState, useEffect } from "react";
import { fetchApi, postApi, Section, FullSection, Card, FieldLabel, Btn, SaveBar, ToggleField, NumberField, SliderField } from "./shared";

const ALL_SKILLS = [
  { key: "Fitness",       label: "Fitness",        group: "Physical" },
  { key: "Strength",      label: "Strength",        group: "Physical" },
  { key: "Sprinting",     label: "Sprinting",       group: "Physical" },
  { key: "Lightfoot",     label: "Light-Footed",    group: "Physical" },
  { key: "Nimble",        label: "Nimble",          group: "Physical" },
  { key: "Sneak",         label: "Sneaking",        group: "Physical" },
  { key: "Axe",          label: "Axe",             group: "Combat" },
  { key: "Blunt",         label: "Long Blunt",      group: "Combat" },
  { key: "SmallBlunt",    label: "Short Blunt",     group: "Combat" },
  { key: "LongBlade",     label: "Long Blade",      group: "Combat" },
  { key: "SmallBlade",    label: "Short Blade",     group: "Combat" },
  { key: "Spear",         label: "Spear",           group: "Combat" },
  { key: "Maintenance",   label: "Maintenance",     group: "Combat" },
  { key: "Aiming",        label: "Aiming",          group: "Combat" },
  { key: "Reloading",     label: "Reloading",       group: "Combat" },
  { key: "Woodwork",      label: "Carpentry",       group: "Crafting" },
  { key: "Cooking",       label: "Cooking",         group: "Crafting" },
  { key: "Farming",       label: "Agriculture",     group: "Crafting" },
  { key: "Doctor",        label: "First Aid",       group: "Crafting" },
  { key: "Electricity",   label: "Electrical",      group: "Crafting" },
  { key: "MetalWelding",  label: "Welding",         group: "Crafting" },
  { key: "Mechanics",     label: "Mechanics",       group: "Crafting" },
  { key: "Tailoring",     label: "Tailoring",       group: "Crafting" },
  { key: "Blacksmith",    label: "Blacksmithing",   group: "Crafting" },
  { key: "Masonry",       label: "Masonry",         group: "Crafting" },
  { key: "Pottery",       label: "Pottery",         group: "Crafting" },
  { key: "Carving",       label: "Carving",         group: "Crafting" },
  { key: "Glassmaking",   label: "Glassmaking",     group: "Crafting" },
  { key: "Fishing",       label: "Fishing",         group: "Survival" },
  { key: "Trapping",      label: "Trapping",        group: "Survival" },
  { key: "PlantScavenging",label: "Foraging",       group: "Survival" },
  { key: "Husbandry",     label: "Animal Care",     group: "Survival" },
  { key: "Tracking",      label: "Tracking",        group: "Survival" },
  { key: "Butchering",    label: "Butchering",      group: "Survival" },
  { key: "FlintKnapping", label: "Knapping",        group: "Survival" },
];

const GROUP_COLORS = {
  Physical: "var(--blue)",
  Combat:   "var(--red)",
  Crafting: "var(--orange)",
  Survival: "var(--green)",
};

const DEFAULT_MULTIPLIERS = Object.fromEntries(ALL_SKILLS.map(s => [s.key, 1.5]));
const DEFAULT = {
  Global: 1.5, GlobalToggle: false,
  LevelForMediaXPCutoff: 3, LevelForDismantleXPCutoff: 0,
  MinutesPerPage: 0.1, CharacterFreePoints: 0,
  NegativeTraitsPenalty: 1,
  ...DEFAULT_MULTIPLIERS,
};

export default function SkillsXPTab({ toast }) {
  const [cfg, setCfg] = useState(DEFAULT);
  const [orig, setOrig] = useState(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [group, setGroup] = useState("all");

  const dirty = JSON.stringify(cfg) !== JSON.stringify(orig);

  useEffect(() => {
    fetchApi("/api/admin/server/sandbox")
      .then(d => {
        const mult = d.MultiplierConfig || {};
        const v = { ...DEFAULT, ...d, ...mult };
        setCfg(v); setOrig(v);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (key) => (val) => setCfg(p => ({ ...p, [key]: val }));

  const setAll = (val) => {
    const updates = Object.fromEntries(ALL_SKILLS.map(s => [s.key, val]));
    setCfg(p => ({ ...p, ...updates, Global: val }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const changes = Object.entries(cfg)
        .filter(([k, v]) => v !== orig[k])
        .map(([key, value]) => ({ key, value }));
      await postApi("/api/admin/config/sandbox", { changes, section: "skills" });
      setOrig({ ...cfg });
      toast("Skill multipliers saved! Server restart required.", "success");
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };

  if (loading) return <div style={{ padding: 40, color: "var(--textdim)", fontFamily: "var(--mono)" }}>Loading skill config...</div>;

  const groups = ["all", "Physical", "Combat", "Crafting", "Survival"];
  const visibleSkills = group === "all" ? ALL_SKILLS : ALL_SKILLS.filter(s => s.group === group);
  const avgMult = Math.round((ALL_SKILLS.reduce((s, sk) => s + (cfg[sk.key] || 1), 0) / ALL_SKILLS.length) * 100) / 100;

  return (
    <>
      <div style={{ fontFamily: "var(--display)", fontSize: 36, letterSpacing: 4, color: "var(--accent)", marginBottom: 4 }}>SKILLS & XP</div>
      <div style={{ color: "var(--textdim)", fontSize: 12, marginBottom: 24, fontFamily: "var(--mono)" }}>level-up multipliers · xp cutoffs · character points</div>

      {/* Overview stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Global Toggle", value: cfg.GlobalToggle ? "ON" : "OFF", color: cfg.GlobalToggle ? "var(--green)" : "var(--textdim)" },
          { label: "Global Rate", value: `×${cfg.Global}`, color: "var(--accent)" },
          { label: "Avg Rate", value: `×${avgMult}`, color: avgMult >= 1 ? "var(--green)" : "var(--red)" },
          { label: "Media XP Cutoff", value: `Level ${cfg.LevelForMediaXPCutoff}`, color: "var(--blue)" },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", padding: "14px 16px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: s.color }} />
            <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--textdim)", fontFamily: "var(--mono)" }}>{s.label}</div>
            <div style={{ fontFamily: "var(--display)", fontSize: 24, letterSpacing: 2, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Global control */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", padding: 18, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--accent)", fontFamily: "var(--mono)", letterSpacing: 1 }}>GLOBAL MULTIPLIER MODE</div>
            <div style={{ fontSize: 11, color: "var(--textdim)", marginTop: 2 }}>When ON — all skills use the single Global rate below, ignoring individual settings</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--textdim)", fontFamily: "var(--mono)" }}>
              {cfg.GlobalToggle ? "GLOBAL MODE" : "INDIVIDUAL MODE"}
            </span>
            <div onClick={() => set("GlobalToggle")(!cfg.GlobalToggle)}
              style={{
                width: 42, height: 22, borderRadius: 11, position: "relative", cursor: "pointer",
                background: cfg.GlobalToggle ? "var(--accent)" : "var(--border)", transition: "background .2s",
              }}>
              <div style={{
                position: "absolute", top: 3, left: cfg.GlobalToggle ? 23 : 3, width: 16, height: 16,
                borderRadius: 8, background: "#fff", transition: "left .2s",
              }} />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <input type="range" min={0.1} max={10} step={0.1} value={cfg.Global}
            onChange={e => set("Global")(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: "var(--accent)" }}
          />
          <input type="number" min={0.1} max={1000} step={0.1} value={cfg.Global}
            onChange={e => set("Global")(parseFloat(e.target.value))}
            style={{ width: 70, background: "var(--surface2)", border: "1px solid var(--accent)", color: "var(--accent)", padding: "6px 8px", fontFamily: "var(--mono)", fontSize: 14, outline: "none" }}
          />
          <button onClick={() => setAll(cfg.Global)}
            style={{ padding: "6px 14px", fontSize: 10, fontFamily: "var(--mono)", background: "rgba(200,168,75,.1)", border: "1px solid var(--accent)", color: "var(--accent)", cursor: "pointer", letterSpacing: 1 }}>
            APPLY TO ALL
          </button>
        </div>
      </div>

      {/* Quick preset buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 10, color: "var(--textdim)", fontFamily: "var(--mono)", letterSpacing: 1 }}>QUICK RATES:</div>
        {[["×1.0 Vanilla", 1.0], ["×1.5 SOUP", 1.5], ["×2.0 Boosted", 2.0], ["×3.0 Fast", 3.0]].map(([l, v]) => (
          <button key={l} onClick={() => setAll(v)}
            style={{ padding: "5px 12px", fontSize: 10, fontFamily: "var(--mono)", background: "transparent", border: "1px solid var(--border)", color: "var(--textdim)", cursor: "pointer" }}>
            {l}
          </button>
        ))}
      </div>

      {/* Group filter */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {groups.map(g => (
          <button key={g} onClick={() => setGroup(g)}
            style={{
              padding: "6px 14px", fontSize: 10, fontFamily: "var(--mono)", letterSpacing: 1, cursor: "pointer",
              background: group === g ? (GROUP_COLORS[g] ? GROUP_COLORS[g] + "22" : "rgba(200,168,75,.1)") : "transparent",
              border: `1px solid ${group === g ? (GROUP_COLORS[g] || "var(--accent)") : "var(--border)"}`,
              color: group === g ? (GROUP_COLORS[g] || "var(--accent)") : "var(--textdim)",
            }}>
            {g === "all" ? `All (${ALL_SKILLS.length})` : `${g} (${ALL_SKILLS.filter(s => s.group === g).length})`}
          </button>
        ))}
      </div>

      {/* Individual skill sliders */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8, marginBottom: 24 }}>
        {visibleSkills.map(skill => {
          const val = cfg[skill.key] ?? 1.5;
          const color = GROUP_COLORS[skill.group];
          const changed = val !== (orig[skill.key] ?? 1.5);
          return (
            <div key={skill.key} style={{
              background: "var(--surface)", border: `1px solid ${changed ? color : "var(--border)"}`,
              padding: "10px 14px", position: "relative", overflow: "hidden",
              transition: "border-color .15s",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, background: color }} />
              <div style={{ paddingLeft: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: changed ? "var(--text)" : "var(--textdim)", fontFamily: "var(--mono)" }}>{skill.label}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: val < 1 ? "var(--red)" : val > 2 ? "var(--green)" : color }}>×{val}</div>
                </div>
                <input type="range" min={0.1} max={10} step={0.1} value={val}
                  onChange={e => set(skill.key)(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* XP Cutoffs */}
      <Section title="XP CUTOFFS" sub="when media and crafting stop giving XP">
        <NumberField label="Media XP Cutoff Level" description="TV/VHS stops giving XP at this skill level" value={cfg.LevelForMediaXPCutoff} onChange={set("LevelForMediaXPCutoff")} min={0} max={10} />
        <NumberField label="Dismantle XP Cutoff Level" description="Scrapping furniture stops XP at this level (0=always)" value={cfg.LevelForDismantleXPCutoff} onChange={set("LevelForDismantleXPCutoff")} min={0} max={10} />
        <NumberField label="Minutes Per Book Page" description="0.1 = very fast reading" value={cfg.MinutesPerPage} onChange={set("MinutesPerPage")} min={0} max={60} step={0.1} />
        <NumberField label="Literature Cooldown (days)" description="Days before re-reading gives XP again" value={cfg.LiteratureCooldown} onChange={set("LiteratureCooldown")} min={1} max={365} />
        <NumberField label="Character Free Points" description="Bonus points in character creation" value={cfg.CharacterFreePoints} onChange={set("CharacterFreePoints")} min={-100} max={100} />
      </Section>

      <Section title="TRAITS" sub="character creation balance">
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "14px 16px" }}>
          <FieldLabel label="Negative Traits Penalty" description="Diminishing returns on stacking negative traits" />
          <select value={cfg.NegativeTraitsPenalty} onChange={e => set("NegativeTraitsPenalty")(Number(e.target.value))}
            style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 10px", fontFamily: "var(--mono)", fontSize: 12 }}>
            <option value={1}>None — Stack freely</option>
            <option value={2}>-1 point per 3 negative traits</option>
            <option value={3}>-1 point per 2 negative traits</option>
            <option value={4}>-1 point per negative trait after first</option>
          </select>
        </div>
      </Section>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => setCfg({ ...orig })} label="Unsaved skill changes — server restart required" />
    </>
  );
}
