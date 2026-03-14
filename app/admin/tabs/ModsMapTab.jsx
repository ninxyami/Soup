"use client";
// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { API, fetchApi, postApi, Section, FullSection, Card, FieldLabel, TextInput, Btn, ADMINS } from "./shared";

// ── Helpers ───────────────────────────────────────────────────────────────────
const parseWorkshopUrl = (input) => {
  const trimmed = input.trim();
  const match = trimmed.match(/[?&]id=(\d+)/);
  if (match) return match[1];
  if (/^\d+$/.test(trimmed)) return trimmed;
  return null;
};

const AdminAvatar = ({ discordId, size = 26 }) => {
  const admin = ADMINS[discordId] || { name: "Unknown", color: "#4a5568", initials: "??" };
  return (
    <div title={admin.name} style={{
      width: size, height: size, borderRadius: size / 2,
      background: admin.color + "33", border: `1px solid ${admin.color}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontFamily: "var(--mono)", color: admin.color,
      flexShrink: 0, letterSpacing: 0,
    }}>
      {admin.initials}
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const map = {
    active:   { color: "var(--green)",   label: "Active"   },
    testing:  { color: "var(--orange)",  label: "Testing"  },
    disabled: { color: "var(--textdim)", label: "Disabled" },
    removed:  { color: "var(--red)",     label: "Removed"  },
    denied:   { color: "var(--red)",     label: "Denied"   },
  };
  const s = map[status] || map.active;
  return (
    <span style={{
      fontSize: 9, fontFamily: "var(--mono)", letterSpacing: 1.5, textTransform: "uppercase",
      padding: "2px 7px", border: `1px solid ${s.color}33`, color: s.color,
      background: s.color + "11",
    }}>{s.label}</span>
  );
};

const CategoryBadge = ({ cat }) => {
  const map = {
    library:   "#9775cc",
    map:       "#4caf7d",
    cars:      "#4a8fc4",
    qol:       "#c8a84b",
    clothing:  "#e05555",
    weapons:   "#d4873a",
    admin:     "#7b3f3f",
    other:     "#4a5568",
  };
  const color = map[cat] || map.other;
  return (
    <span style={{
      fontSize: 9, fontFamily: "var(--mono)", letterSpacing: 1, textTransform: "uppercase",
      padding: "2px 7px", background: color + "22", color, border: `1px solid ${color}44`,
    }}>{cat}</span>
  );
};

const TimeAgo = ({ ts }) => {
  if (!ts) return <span style={{ color: "var(--textdim)" }}>—</span>;
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60) return <span>{s}s ago</span>;
  if (s < 3600) return <span>{Math.floor(s / 60)}m ago</span>;
  if (s < 86400) return <span>{Math.floor(s / 3600)}h ago</span>;
  return <span>{Math.floor(s / 86400)}d ago</span>;
};

// ── AddModModal ───────────────────────────────────────────────────────────────
const AddModModal = ({ onClose, onAdd, toast }) => {
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [modIds, setModIds] = useState("");
  const [category, setCategory] = useState("qol");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("testing");
  const [loading, setLoading] = useState(false);

  const workshopId = parseWorkshopUrl(input);

  const submit = async () => {
    if (!workshopId) { toast("Enter a valid Workshop ID or Steam URL", "error"); return; }
    if (!name.trim()) { toast("Mod name is required", "error"); return; }
    setLoading(true);
    try {
      await onAdd({ workshop_id: workshopId, name: name.trim(), mod_ids: modIds, category, notes, status });
      onClose();
    } catch (e) {
      toast(e.message, "error");
    }
    setLoading(false);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "#0f1318", border: "1px solid var(--accent)", width: 520, maxWidth: "95vw",
        padding: 28, position: "relative",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--accent)" }} />
        <div style={{ fontFamily: "var(--display)", fontSize: 22, letterSpacing: 3, color: "var(--accent)", marginBottom: 20 }}>
          ADD MOD
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <FieldLabel label="Steam Workshop URL or ID" description="Paste the full Steam URL or just the numeric workshop ID" />
            <TextInput value={input} onChange={setInput} placeholder="https://steamcommunity.com/sharedfiles/filedetails/?id=3171167894" />
            {workshopId && <div style={{ fontSize: 11, color: "var(--green)", fontFamily: "var(--mono)", marginTop: 4 }}>✓ Workshop ID: {workshopId}</div>}
            {input && !workshopId && <div style={{ fontSize: 11, color: "var(--red)", fontFamily: "var(--mono)", marginTop: 4 }}>✗ Could not parse workshop ID</div>}
          </div>

          <div>
            <FieldLabel label="Mod Name" description="Display name shown in the mod list" />
            <TextInput value={name} onChange={setName} placeholder="that DAMN Library" />
          </div>

          <div>
            <FieldLabel label="Mod IDs (comma separated)" description="The internal mod IDs from info.txt — e.g. damnlib, tsarslib" />
            <TextInput value={modIds} onChange={setModIds} placeholder="damnlib" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <FieldLabel label="Category" />
              <select value={category} onChange={e => setCategory(e.target.value)}
                style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 10px", fontFamily: "var(--mono)", fontSize: 12 }}>
                {["library","map","cars","qol","clothing","weapons","admin","other"].map(c =>
                  <option key={c} value={c}>{c}</option>
                )}
              </select>
            </div>
            <div>
              <FieldLabel label="Status" />
              <select value={status} onChange={e => setStatus(e.target.value)}
                style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 10px", fontFamily: "var(--mono)", fontSize: 12 }}>
                {["active","testing","disabled","denied"].map(s =>
                  <option key={s} value={s}>{s}</option>
                )}
              </select>
            </div>
          </div>

          <div>
            <FieldLabel label="Notes (optional)" />
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Install this before car mods. Tested on 42.13."
              style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 10px", fontFamily: "var(--mono)", fontSize: 12, resize: "vertical", minHeight: 60 }}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <Btn color="ghost" onClick={onClose}>Cancel</Btn>
          <Btn color="green" onClick={submit} disabled={loading || !workshopId || !name.trim()}>
            {loading ? "Adding..." : "➕ Add Mod"}
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ── Mod Row ───────────────────────────────────────────────────────────────────
const ModRow = ({ mod, index, onToggle, onRemove, onStatusChange, toast, dragHandlers, isDragOver }) => {
  const [expanded, setExpanded] = useState(false);
  const admin = ADMINS[mod.added_by] || { name: "Unknown", color: "#4a5568", initials: "??" };

  return (
    <>
      <tr
        draggable
        {...dragHandlers}
        style={{
          cursor: "grab",
          background: isDragOver ? "rgba(200,168,75,0.06)" : "transparent",
          borderTop: isDragOver ? "2px solid var(--accent)" : "none",
        }}
        onClick={() => setExpanded(x => !x)}
      >
        <td style={{ padding: "10px 8px", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "var(--textdim)", fontFamily: "var(--mono)", minWidth: 18, textAlign: "right" }}>{index + 1}</span>
            <div style={{
              width: 10, height: 10, borderRadius: 5,
              background: mod.status === "active" ? "var(--green)" : mod.status === "testing" ? "var(--orange)" : "var(--border)",
            }} />
          </div>
        </td>
        <td>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 500, color: "var(--text)" }}>{mod.name}</span>
            <CategoryBadge cat={mod.category || "other"} />
          </div>
          {mod.mod_ids && <div style={{ fontSize: 10, color: "var(--textdim)", fontFamily: "var(--mono)", marginTop: 2 }}>{mod.mod_ids}</div>}
        </td>
        <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>{mod.workshop_id}</td>
        <td><StatusBadge status={mod.status} /></td>
        <td>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <AdminAvatar discordId={mod.added_by} />
            <div>
              <div style={{ fontSize: 11, color: admin.color }}>{admin.name}</div>
              <div style={{ fontSize: 10, color: "var(--textdim)" }}><TimeAgo ts={mod.added_at} /></div>
            </div>
          </div>
        </td>
        <td onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", gap: 6 }}>
            <Btn color="ghost" sm onClick={() => onToggle(mod)}>
              {mod.status === "active" ? "Disable" : "Enable"}
            </Btn>
            <Btn color="red" sm onClick={() => onRemove(mod)}>Remove</Btn>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6}>
            <div style={{ padding: "10px 16px", background: "#0a0c0f", borderLeft: "2px solid var(--accent)", margin: "0 0 4px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--textdim)", fontFamily: "var(--mono)", letterSpacing: 1, marginBottom: 4 }}>WORKSHOP ID</div>
                  <a href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.workshop_id}`} target="_blank" rel="noopener noreferrer"
                    style={{ color: "var(--blue)", fontSize: 12, fontFamily: "var(--mono)" }} onClick={e => e.stopPropagation()}>
                    {mod.workshop_id} ↗
                  </a>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--textdim)", fontFamily: "var(--mono)", letterSpacing: 1, marginBottom: 4 }}>STATUS</div>
                  <select value={mod.status} onChange={e => onStatusChange(mod, e.target.value)}
                    onClick={e => e.stopPropagation()}
                    style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "4px 8px", fontFamily: "var(--mono)", fontSize: 11 }}>
                    {["active","testing","disabled","denied","removed"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--textdim)", fontFamily: "var(--mono)", letterSpacing: 1, marginBottom: 4 }}>LAST EDITED BY</div>
                  <div style={{ fontSize: 12, color: admin.color }}>{admin.name}</div>
                </div>
              </div>
              {mod.notes && (
                <div style={{ marginTop: 10, padding: 10, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, color: "var(--textdim)", lineHeight: 1.5 }}>
                  {mod.notes}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ── Maps Manager ──────────────────────────────────────────────────────────────
const KNOWN_MAPS = [
  { id: "Muldraugh, KY",      label: "Muldraugh (Vanilla)" },
  { id: "RaccoonCityB42",     label: "Raccoon City B42" },
  { id: "Maplewood",          label: "Maplewood B42" },
  { id: "FoxtrotWarehouse",   label: "Foxtrot Warehouse B42" },
  { id: "Frogtown",           label: "Frogtown [42+]" },
  { id: "Constown, KY",       label: "Constown B42" },
  { id: "Coryerdon B42",      label: "Coryerdon B42" },
  { id: "Raven Creek B42",    label: "Raven Creek B42" },
  { id: "Grapeseed",          label: "Grapeseed B42" },
  { id: "LittleTownshipB42",  label: "Little Township B42" },
  { id: "map_distanciado",    label: "Project RV Interior B42" },
  { id: "rvupdate",           label: "RV Interior Expansion B42" },
  { id: "rv2",                label: "RV Interior Expansion Part 2" },
];

const MapsManager = ({ maps, setMaps, toast, currentUser }) => {
  const [custom, setCustom] = useState("");

  const isActive = (id) => maps.includes(id);

  const toggle = (id) => {
    if (id === "Muldraugh, KY") { toast("Vanilla map cannot be removed", "error"); return; }
    setMaps(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const addCustom = () => {
    const val = custom.trim();
    if (!val) return;
    if (maps.includes(val)) { toast("Map already in list", "error"); return; }
    setMaps(prev => [...prev, val]);
    setCustom("");
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8, marginBottom: 16 }}>
        {KNOWN_MAPS.map(m => (
          <div key={m.id} onClick={() => toggle(m.id)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", background: "var(--surface)", border: `1px solid ${isActive(m.id) ? "var(--green)" : "var(--border)"}`,
              cursor: m.id === "Muldraugh, KY" ? "not-allowed" : "pointer",
              transition: "border-color .15s",
            }}>
            <div>
              <div style={{ fontSize: 12, color: isActive(m.id) ? "var(--green)" : "var(--text)" }}>{m.label}</div>
              <div style={{ fontSize: 10, color: "var(--textdim)", fontFamily: "var(--mono)" }}>{m.id}</div>
            </div>
            <div style={{
              width: 16, height: 16, borderRadius: 2,
              background: isActive(m.id) ? "var(--green)" : "transparent",
              border: `1px solid ${isActive(m.id) ? "var(--green)" : "var(--border)"}`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10,
            }}>
              {isActive(m.id) && "✓"}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <TextInput value={custom} onChange={setCustom} placeholder="Custom map folder ID (e.g. Constown, KY)" />
        <Btn color="blue" onClick={addCustom}>+ Add Custom</Btn>
      </div>

      {maps.filter(m => !KNOWN_MAPS.find(k => k.id === m)).map(m => (
        <div key={m} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--blue)", marginTop: 6 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--blue)" }}>{m} (custom)</span>
          <Btn color="red" sm onClick={() => setMaps(p => p.filter(x => x !== m))}>Remove</Btn>
        </div>
      ))}
    </div>
  );
};

// ── INI Paste Importer ────────────────────────────────────────────────────────
const IniImporter = ({ onImportMods, onImportMaps, toast }) => {
  const [iniText, setIniText] = useState("");
  const [parsed, setParsed] = useState(null); // { mods: [], maps: [], workshopIds: [] }

  const parseIni = (text) => {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const result = { mods: [], maps: [], workshopIds: [], modIds: [] };

    for (const line of lines) {
      // Match Mods= line
      const modsMatch = line.match(/^Mods\s*=\s*(.+)/i);
      if (modsMatch) {
        result.modIds = modsMatch[1].split(";").map(s => s.trim()).filter(Boolean);
      }

      // Match WorkshopItems= line
      const wsMatch = line.match(/^WorkshopItems\s*=\s*(.+)/i);
      if (wsMatch) {
        result.workshopIds = wsMatch[1].split(";").map(s => s.trim()).filter(Boolean);
      }

      // Match Map= line
      const mapMatch = line.match(/^Map\s*=\s*(.+)/i);
      if (mapMatch) {
        result.maps = mapMatch[1].split(";").map(s => s.trim()).filter(Boolean);
      }
    }

    // Also handle raw paste of just IDs separated by semicolons or newlines
    if (!result.workshopIds.length && !result.modIds.length && !result.maps.length) {
      // Try to detect if it's a list of workshop IDs
      const allNums = text.split(/[;\n,]+/).map(s => s.trim()).filter(s => /^\d{5,}$/.test(s));
      if (allNums.length > 0) {
        result.workshopIds = allNums;
      }
      // Try to detect mod IDs (alphanumeric, no spaces)
      const allMods = text.split(/[;\n,]+/).map(s => s.trim()).filter(s => /^[A-Za-z_][\w.-]*$/.test(s) && s.length > 2);
      if (allMods.length > 0 && allNums.length === 0) {
        result.modIds = allMods;
      }
    }

    // Build mod list: pair workshop IDs with mod IDs if both exist
    if (result.workshopIds.length > 0) {
      result.mods = result.workshopIds.map((wsId, i) => ({
        workshop_id: wsId,
        name: result.modIds[i] || `Mod ${wsId}`,
        mod_ids: result.modIds[i] || "",
        category: "other",
        status: "testing",
        notes: "Imported from INI paste",
      }));
    } else if (result.modIds.length > 0) {
      // Only mod IDs, no workshop IDs — still useful
      result.mods = result.modIds.map(modId => ({
        workshop_id: "",
        name: modId,
        mod_ids: modId,
        category: "other",
        status: "testing",
        notes: "Imported from INI paste (no workshop ID — add manually)",
      }));
    }

    return result;
  };

  const handleParse = () => {
    if (!iniText.trim()) { toast("Paste some INI content first", "error"); return; }
    const result = parseIni(iniText);
    if (!result.mods.length && !result.maps.length) {
      toast("Could not find Mods=, WorkshopItems=, or Map= lines. Try pasting the full INI section.", "error");
      return;
    }
    setParsed(result);
    toast(`Found ${result.mods.length} mods, ${result.maps.length} maps`, "success");
  };

  const selectStyle = {
    background: "var(--surface2)", border: "1px solid var(--border)",
    color: "var(--text)", padding: "4px 8px", fontFamily: "var(--mono)", fontSize: 11,
    cursor: "pointer",
  };

  return (
    <div>
      <div style={{ marginBottom: 16, padding: "12px 16px", background: "rgba(74,143,196,0.06)", border: "1px solid rgba(74,143,196,0.2)" }}>
        <div style={{ fontSize: 12, color: "var(--blue)", marginBottom: 4, fontWeight: 500 }}>Quick Import from INI</div>
        <div style={{ fontSize: 11, color: "var(--textdim)", lineHeight: 1.5 }}>
          Paste the <code style={{ color: "var(--accent)", background: "rgba(200,168,75,0.1)", padding: "1px 4px" }}>Mods=</code>,
          {" "}<code style={{ color: "var(--accent)", background: "rgba(200,168,75,0.1)", padding: "1px 4px" }}>WorkshopItems=</code>,
          or <code style={{ color: "var(--accent)", background: "rgba(200,168,75,0.1)", padding: "1px 4px" }}>Map=</code> lines
          from servertest.ini below. The system will auto-detect and separate them into individual entries.
          You can also paste raw workshop IDs separated by semicolons or newlines.
        </div>
      </div>

      <textarea
        value={iniText}
        onChange={e => { setIniText(e.target.value); setParsed(null); }}
        placeholder={`Paste INI lines here, e.g.:\n\nMods=damnlib;tsarslib;RaccoonCityB42;Maplewood;FoxtrotWarehouse\nWorkshopItems=3171167894;3402491515;3388468313;3644794945;3600377019\nMap=Muldraugh, KY;RaccoonCityB42;Maplewood;FoxtrotWarehouse\n\nOr just paste workshop IDs:\n3171167894;3402491515;3388468313`}
        style={{
          width: "100%", minHeight: 140, background: "var(--bg)", border: "1px solid var(--border)",
          color: "var(--text)", padding: "12px 14px", fontFamily: "var(--mono)", fontSize: 12,
          resize: "vertical", outline: "none", lineHeight: 1.6,
        }}
      />

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Btn color="blue" onClick={handleParse}>🔍 Parse INI</Btn>
        {iniText && <Btn color="ghost" sm onClick={() => { setIniText(""); setParsed(null); }}>Clear</Btn>}
      </div>

      {/* Parsed results */}
      {parsed && (
        <div style={{ marginTop: 20 }}>
          {/* Mods */}
          {parsed.mods.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontFamily: "var(--display)", letterSpacing: 2, color: "var(--accent)" }}>
                  DETECTED MODS ({parsed.mods.length})
                </div>
                <Btn color="green" sm onClick={() => onImportMods(parsed.mods)}>
                  ➕ Import All to Mod List
                </Btn>
              </div>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Workshop ID", "Mod ID / Name", "Category", "Status"].map(h => (
                        <th key={h} style={{
                          textAlign: "left", padding: "8px 14px", fontSize: 9, letterSpacing: 2,
                          textTransform: "uppercase", color: "var(--textdim)", fontFamily: "var(--mono)",
                          fontWeight: 400, borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,.2)",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.mods.map((m, i) => (
                      <tr key={i}>
                        <td style={{ padding: "6px 14px", borderBottom: "1px solid rgba(30,37,48,.4)", fontFamily: "var(--mono)", fontSize: 11, color: m.workshop_id ? "var(--text)" : "var(--red)" }}>
                          {m.workshop_id || "—"}
                          {m.workshop_id && (
                            <a href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${m.workshop_id}`} target="_blank" rel="noopener noreferrer"
                              style={{ marginLeft: 6, color: "var(--blue)", fontSize: 10 }}>↗</a>
                          )}
                        </td>
                        <td style={{ padding: "6px 14px", borderBottom: "1px solid rgba(30,37,48,.4)", fontSize: 12, color: "var(--text)" }}>
                          {m.name}
                        </td>
                        <td style={{ padding: "6px 14px", borderBottom: "1px solid rgba(30,37,48,.4)" }}>
                          <select value={m.category} onChange={e => {
                            const newMods = [...parsed.mods];
                            newMods[i] = { ...m, category: e.target.value };
                            setParsed({ ...parsed, mods: newMods });
                          }} style={selectStyle}>
                            {["library","map","cars","qol","clothing","weapons","admin","other"].map(c =>
                              <option key={c} value={c}>{c}</option>
                            )}
                          </select>
                        </td>
                        <td style={{ padding: "6px 14px", borderBottom: "1px solid rgba(30,37,48,.4)" }}>
                          <select value={m.status} onChange={e => {
                            const newMods = [...parsed.mods];
                            newMods[i] = { ...m, status: e.target.value };
                            setParsed({ ...parsed, mods: newMods });
                          }} style={selectStyle}>
                            {["active","testing","disabled","denied"].map(s =>
                              <option key={s} value={s}>{s}</option>
                            )}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Maps */}
          {parsed.maps.length > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontFamily: "var(--display)", letterSpacing: 2, color: "var(--accent)" }}>
                  DETECTED MAPS ({parsed.maps.length})
                </div>
                <Btn color="green" sm onClick={() => onImportMaps(parsed.maps)}>
                  ➕ Import All to Map List
                </Btn>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 6 }}>
                {parsed.maps.map((m, i) => (
                  <div key={i} style={{
                    padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--green)",
                    fontSize: 12, fontFamily: "var(--mono)", color: "var(--green)",
                  }}>{m}</div>
                ))}
              </div>
            </div>
          )}

          {/* Nothing found feedback */}
          {parsed.mods.length === 0 && parsed.maps.length === 0 && (
            <div style={{ padding: 20, textAlign: "center", color: "var(--red)", fontFamily: "var(--mono)", fontSize: 12 }}>
              No mods or maps detected. Make sure you're pasting valid INI lines.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Lua Sandbox Paste Importer ────────────────────────────────────────────────
const LuaImporter = ({ toast }) => {
  const [luaText, setLuaText] = useState("");
  const [parsed, setParsed] = useState(null);
  const [saving, setSaving] = useState(false);

  const parseLua = (text) => {
    const result = {};

    const parseValue = (v) => {
      v = v.trim().replace(/,$/, "");
      if (v.toLowerCase() === "true") return true;
      if (v.toLowerCase() === "false") return false;
      if (/^-?\d+$/.test(v)) return parseInt(v, 10);
      if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
      return v.replace(/^"|"$/g, "");
    };

    // Flat keys (top-level SandboxVars)
    for (const m of text.matchAll(/^\s{2,6}(\w+)\s*=\s*([^,\n{]+),?\s*$/gm)) {
      result[m[1]] = parseValue(m[2]);
    }

    // Nested blocks
    const blockRe = /(\w+)\s*=\s*\{([^}]+)\}/gs;
    let bm;
    while ((bm = blockRe.exec(text)) !== null) {
      const blockName = bm[1];
      const blockContent = bm[2];
      const block = {};
      for (const km of blockContent.matchAll(/(\w+)\s*=\s*([^,\n]+)/g)) {
        block[km[1]] = parseValue(km[2]);
      }
      result[blockName] = block;
    }

    return result;
  };

  const handleParse = () => {
    if (!luaText.trim()) { toast("Paste some Lua content first", "error"); return; }
    const result = parseLua(luaText);
    const keyCount = Object.keys(result).length;
    if (keyCount === 0) {
      toast("Could not find any SandboxVars settings. Make sure you're pasting the Lua file content.", "error");
      return;
    }
    setParsed(result);
    // Count flat keys only (not nested block objects)
    const flatKeys = Object.entries(result).filter(([, v]) => typeof v !== "object").length;
    const blockKeys = Object.entries(result).filter(([, v]) => typeof v === "object").length;
    toast(`Parsed ${flatKeys} settings + ${blockKeys} blocks`, "success");
  };

  const handlePushToServer = async () => {
    if (!parsed) return;
    setSaving(true);
    try {
      // Convert parsed dict to changes array for the API
      const changes = [];
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "object" && value !== null) {
          // Nested block — send each sub-key
          for (const [subKey, subVal] of Object.entries(value)) {
            changes.push({ key: subKey, value: subVal });
          }
        } else {
          changes.push({ key, value });
        }
      }
      await postApi("/api/admin/config/sandbox", { changes, section: "lua_import" });
      toast(`Pushed ${changes.length} settings to server!`, "success");
    } catch (e) {
      toast(e.message || "Failed to push settings", "error");
    }
    setSaving(false);
  };

  // Group parsed results by category for display
  const getGroups = () => {
    if (!parsed) return [];
    const flat = [];
    const blocks = [];
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "object" && value !== null) {
        blocks.push({ name: key, entries: Object.entries(value) });
      } else {
        flat.push([key, value]);
      }
    }
    return { flat, blocks };
  };

  return (
    <div>
      <div style={{ marginBottom: 16, padding: "12px 16px", background: "rgba(151,117,204,0.06)", border: "1px solid rgba(151,117,204,0.2)" }}>
        <div style={{ fontSize: 12, color: "var(--purple)", marginBottom: 4, fontWeight: 500 }}>Quick Import from SandboxVars Lua</div>
        <div style={{ fontSize: 11, color: "var(--textdim)", lineHeight: 1.5 }}>
          Paste the contents of <code style={{ color: "var(--accent)", background: "rgba(200,168,75,0.1)", padding: "1px 4px" }}>servertest_SandboxVars.lua</code> below.
          The system will parse all settings including nested blocks (ZombieLore, ZombieConfig, MultiplierConfig, etc.)
          and let you push them directly to the server.
        </div>
      </div>

      <textarea
        value={luaText}
        onChange={e => { setLuaText(e.target.value); setParsed(null); }}
        placeholder={`Paste SandboxVars.lua contents here, e.g.:\n\nSandboxVars = {\n    Zombies = 1,\n    Distribution = 1,\n    DayLength = 2,\n    StartMonth = 7,\n    WaterShut = 14,\n    ElecShut = 14,\n    \n    ZombieLore = {\n        Speed = 2,\n        Strength = 2,\n        Toughness = 2,\n    },\n}`}
        style={{
          width: "100%", minHeight: 180, background: "var(--bg)", border: "1px solid var(--border)",
          color: "var(--text)", padding: "12px 14px", fontFamily: "var(--mono)", fontSize: 12,
          resize: "vertical", outline: "none", lineHeight: 1.6,
        }}
      />

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Btn color="blue" onClick={handleParse}>🔍 Parse Lua</Btn>
        {luaText && <Btn color="ghost" sm onClick={() => { setLuaText(""); setParsed(null); }}>Clear</Btn>}
      </div>

      {parsed && (() => {
        const { flat, blocks } = getGroups();
        return (
          <div style={{ marginTop: 20 }}>
            {/* Flat settings */}
            {flat.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontFamily: "var(--display)", letterSpacing: 2, color: "var(--accent)" }}>
                    TOP-LEVEL SETTINGS ({flat.length})
                  </div>
                </div>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Setting", "Value", "Type"].map(h => (
                          <th key={h} style={{
                            textAlign: "left", padding: "8px 14px", fontSize: 9, letterSpacing: 2,
                            textTransform: "uppercase", color: "var(--textdim)", fontFamily: "var(--mono)",
                            fontWeight: 400, borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,.2)",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {flat.map(([key, val]) => (
                        <tr key={key}>
                          <td style={{ padding: "5px 14px", borderBottom: "1px solid rgba(30,37,48,.4)", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text)" }}>{key}</td>
                          <td style={{ padding: "5px 14px", borderBottom: "1px solid rgba(30,37,48,.4)", fontFamily: "var(--mono)", fontSize: 11, color: typeof val === "boolean" ? (val ? "var(--green)" : "var(--red)") : "var(--accent)" }}>
                            {String(val)}
                          </td>
                          <td style={{ padding: "5px 14px", borderBottom: "1px solid rgba(30,37,48,.4)", fontSize: 9, color: "var(--textdim)", fontFamily: "var(--mono)", letterSpacing: 1 }}>
                            {typeof val}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Nested blocks */}
            {blocks.map(block => (
              <div key={block.name} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontFamily: "var(--display)", letterSpacing: 2, color: "var(--purple)", marginBottom: 6 }}>
                  {block.name} ({block.entries.length} settings)
                </div>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      {block.entries.map(([key, val]) => (
                        <tr key={key}>
                          <td style={{ padding: "4px 14px", borderBottom: "1px solid rgba(30,37,48,.3)", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text)", width: "50%" }}>{key}</td>
                          <td style={{ padding: "4px 14px", borderBottom: "1px solid rgba(30,37,48,.3)", fontFamily: "var(--mono)", fontSize: 11, color: typeof val === "boolean" ? (val ? "var(--green)" : "var(--red)") : "var(--accent)" }}>
                            {String(val)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* Push to server button */}
            <div style={{ marginTop: 16, padding: "14px 16px", background: "rgba(200,168,75,0.05)", border: "1px solid var(--accent)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--mono)" }}>
                ⚠ This will overwrite current SandboxVars on the server. A backup is created automatically.
              </div>
              <Btn color="green" onClick={handlePushToServer} disabled={saving}>
                {saving ? "Pushing..." : "🚀 Push All to Server"}
              </Btn>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ── Main ModsTab ──────────────────────────────────────────────────────────────
export default function ModsMapTab({ toast, currentUser }) {
  const [sub, setSub] = useState("mods");
  const [mods, setMods] = useState([]);
  const [maps, setMaps] = useState(["Muldraugh, KY"]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [mapsDirty, setMapsDirty] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const origMaps = useRef([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchApi("/api/admin/mods/list");
      setMods(d.mods || []);
    } catch { setMods([]); }
    try {
      const d = await fetchApi("/api/admin/server/config");
      const mapVal = d.Map || "Muldraugh, KY";
      const parsed = mapVal.split(";").map(m => m.trim()).filter(Boolean);
      setMaps(parsed);
      origMaps.current = parsed;
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMapChange = (newMaps) => {
    setMaps(newMaps);
    setMapsDirty(JSON.stringify(newMaps) !== JSON.stringify(origMaps.current));
  };

  const saveMaps = async () => {
    try {
      await postApi("/api/admin/config/ini", {
        changes: [{ key: "Map", value: maps.join(";") }],
        section: "maps",
      });
      origMaps.current = maps;
      setMapsDirty(false);
      toast("Maps saved!", "success");
    } catch (e) { toast(e.message, "error"); }
  };

  const addMod = async (data) => {
    await postApi("/api/admin/mods/add", data);
    toast(`${data.name} added!`, "success");
    load();
  };

  const toggleMod = async (mod) => {
    const newStatus = mod.status === "active" ? "disabled" : "active";
    try {
      await postApi("/api/admin/mods/toggle", { workshop_id: mod.workshop_id, status: newStatus });
      toast(`${mod.name} → ${newStatus}`, "success");
      load();
    } catch (e) { toast(e.message, "error"); }
  };

  const removeMod = async (mod) => {
    if (!confirm(`Remove "${mod.name}" from the mod list?`)) return;
    try {
      await postApi("/api/admin/mods/remove", { workshop_id: mod.workshop_id });
      toast(`${mod.name} removed`, "success");
      load();
    } catch (e) { toast(e.message, "error"); }
  };

  const changeStatus = async (mod, status) => {
    try {
      await postApi("/api/admin/mods/toggle", { workshop_id: mod.workshop_id, status });
      toast(`${mod.name} → ${status}`, "success");
      load();
    } catch (e) { toast(e.message, "error"); }
  };

  const saveOrder = async () => {
    try {
      const ordered = mods.map((m, i) => ({
        workshop_id: m.workshop_id || "",
        mod_ids: m.mod_ids || "",
        position: i,
      }));
      await postApi("/api/admin/mods/reorder", { order: ordered });
      setOrderDirty(false);
      toast("Mod order saved to INI!", "success");
    } catch (e) { toast(e.message, "error"); }
  };

  const filteredMods = mods.filter(m => {
    if (filter !== "all" && m.status !== filter) return false;
    if (search && !m.name?.toLowerCase().includes(search.toLowerCase()) && !m.workshop_id?.includes(search)) return false;
    return true;
  });

  const counts = {
    all: mods.length,
    active: mods.filter(m => m.status === "active").length,
    testing: mods.filter(m => m.status === "testing").length,
    disabled: mods.filter(m => m.status === "disabled").length,
  };

  const filterTabs = [
    { key: "all",      label: `All (${counts.all})` },
    { key: "active",   label: `Active (${counts.active})` },
    { key: "testing",  label: `Testing (${counts.testing})` },
    { key: "disabled", label: `Disabled (${counts.disabled})` },
  ];

  const subTabs = [
    { key: "mods", label: "🔧 Mod List" },
    { key: "maps", label: "🗺 Map List" },
    { key: "import", label: "📋 Paste INI" },
    { key: "lua", label: "📋 Paste Lua" },
  ];

  return (
    <>
      {showAdd && <AddModModal onClose={() => setShowAdd(false)} onAdd={addMod} toast={toast} />}

      <div style={{ fontFamily: "var(--display)", fontSize: 36, letterSpacing: 4, color: "var(--accent)", marginBottom: 4 }}>MODS & MAPS</div>
      <div style={{ color: "var(--textdim)", fontSize: 12, marginBottom: 24, fontFamily: "var(--mono)" }}>manage workshop mods · active maps · push to servertest.ini</div>

      {/* Sub tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {subTabs.map(t => (
          <button key={t.key} onClick={() => setSub(t.key)}
            style={{
              padding: "8px 18px", fontSize: 11, fontFamily: "var(--mono)", letterSpacing: 1, textTransform: "uppercase",
              background: sub === t.key ? "rgba(200,168,75,0.08)" : "transparent",
              border: "none", borderBottom: sub === t.key ? "2px solid var(--accent)" : "2px solid transparent",
              color: sub === t.key ? "var(--accent)" : "var(--textdim)", cursor: "pointer",
            }}>{t.label}</button>
        ))}
      </div>

      {sub === "mods" && <>
        {/* Controls */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search mods..."
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 12px", fontFamily: "var(--mono)", fontSize: 12, width: 220, outline: "none" }}
          />
          <div style={{ display: "flex", gap: 2 }}>
            {filterTabs.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                style={{
                  padding: "7px 14px", fontSize: 10, fontFamily: "var(--mono)", letterSpacing: 1, cursor: "pointer",
                  background: filter === f.key ? "rgba(200,168,75,0.1)" : "transparent",
                  border: `1px solid ${filter === f.key ? "var(--accent)" : "var(--border)"}`,
                  color: filter === f.key ? "var(--accent)" : "var(--textdim)",
                }}>{f.label}</button>
            ))}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Btn color="ghost" sm onClick={() => {
              // Auto-sort: libraries first, then maps, then rest
              const order = { library: 0, map: 1, admin: 2, qol: 3, cars: 4, weapons: 5, clothing: 6, other: 7 };
              const sorted = [...mods].sort((a, b) => (order[a.category] ?? 7) - (order[b.category] ?? 7));
              setMods(sorted);
              setOrderDirty(true);
            }}>⬆ Sort by Category</Btn>
            <Btn color="ghost" sm onClick={load}>↻ Refresh</Btn>
            <Btn color="blue" sm onClick={() => {
              window.open(`${API}/api/admin/export/mods`, '_blank');
            }}>📊 Export .xlsx</Btn>
            <Btn color="green" onClick={() => setShowAdd(true)}>➕ Add Mod</Btn>
          </div>
        </div>

        {/* Order save bar */}
        {orderDirty && (
          <div style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", marginBottom: 12,
            background: "rgba(200,168,75,0.06)", border: "1px solid var(--accent)",
          }}>
            <span style={{ flex: 1, fontSize: 11, color: "var(--accent)", fontFamily: "var(--mono)" }}>
              ⚠ Mod order changed — this affects load order in the server. Libraries should be first.
            </span>
            <Btn color="ghost" sm onClick={() => { load(); setOrderDirty(false); }}>Discard</Btn>
            <Btn color="green" sm onClick={saveOrder}>💾 Save Order to INI</Btn>
          </div>
        )}

        {/* Mod table */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["#", "Name", "Workshop ID", "Status", "Added By", "Actions"].map(h => (
                    <th key={h} style={{
                      textAlign: "left", padding: "10px 16px", fontSize: 10, letterSpacing: 2,
                      textTransform: "uppercase", color: "var(--textdim)", fontFamily: "var(--mono)",
                      fontWeight: 400, borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,.2)",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--textdim)", fontFamily: "var(--mono)", fontSize: 12 }}>Loading...</td></tr>
                ) : filteredMods.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--textdim)", fontFamily: "var(--mono)", fontSize: 12 }}>
                    {search ? "No mods match your search" : "No mods in this category"}
                  </td></tr>
                ) : filteredMods.map((mod, idx) => (
                  <ModRow key={mod.workshop_id || mod.mod_ids || idx} mod={mod} index={idx}
                    onToggle={toggleMod} onRemove={removeMod} onStatusChange={changeStatus} toast={toast}
                    isDragOver={dragOver === idx}
                    dragHandlers={{
                      onDragStart: (e) => { setDragging(idx); e.dataTransfer.effectAllowed = "move"; },
                      onDragEnd: () => { setDragging(null); setDragOver(null); },
                      onDragOver: (e) => { e.preventDefault(); setDragOver(idx); },
                      onDragLeave: () => setDragOver(null),
                      onDrop: (e) => {
                        e.preventDefault();
                        if (dragging === null || dragging === idx) { setDragOver(null); return; }
                        const newMods = [...mods];
                        const [moved] = newMods.splice(dragging, 1);
                        newMods.splice(idx, 0, moved);
                        setMods(newMods);
                        setOrderDirty(true);
                        setDragging(null);
                        setDragOver(null);
                      },
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 11, color: "var(--textdim)", fontFamily: "var(--mono)" }}>
          Showing {filteredMods.length} of {mods.length} mods · Click any row to expand details
        </div>
      </>}

      {sub === "maps" && <>
        <div style={{ marginBottom: 16, padding: "12px 16px", background: "rgba(200,168,75,0.05)", border: "1px solid rgba(200,168,75,0.2)" }}>
          <div style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--mono)" }}>
            ⚠ Maps require a server restart to take effect. Map mods must also be in the Mod List above.
          </div>
        </div>
        <MapsManager maps={maps} setMaps={handleMapChange} toast={toast} currentUser={currentUser} />
        {mapsDirty && (
          <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", padding: "12px 16px", background: "rgba(200,168,75,0.05)", border: "1px solid var(--accent)" }}>
            <span style={{ flex: 1, fontSize: 11, color: "var(--accent)", fontFamily: "var(--mono)" }}>⚠ Unsaved map changes</span>
            <Btn color="ghost" sm onClick={() => { setMaps(origMaps.current); setMapsDirty(false); }}>Discard</Btn>
            <Btn color="green" sm onClick={saveMaps}>💾 Save Maps</Btn>
          </div>
        )}
      </>}

      {sub === "import" && <IniImporter onImportMods={(imported) => {
        // Merge imported mods with existing — skip duplicates by workshop_id
        const existingIds = new Set(mods.map(m => m.workshop_id));
        const newMods = imported.filter(m => !existingIds.has(m.workshop_id));
        if (newMods.length === 0) { toast("All mods already in list — nothing to import", "info"); return; }
        // Add each via API
        const doImport = async () => {
          let added = 0;
          for (const m of newMods) {
            try {
              await postApi("/api/admin/mods/add", m);
              added++;
            } catch {}
          }
          toast(`Imported ${added} new mod${added !== 1 ? "s" : ""}`, "success");
          load();
        };
        doImport();
      }} onImportMaps={(importedMaps) => {
        const merged = [...new Set([...maps, ...importedMaps])];
        setMaps(merged);
        setMapsDirty(true);
        toast(`Imported ${importedMaps.length} map entries — review in Map List tab`, "success");
      }} toast={toast} />}

      {sub === "lua" && <LuaImporter toast={toast} />}
    </>
  );
}
