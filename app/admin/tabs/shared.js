// shared.js — all constants, helpers, and reusable UI for ServerConfigTab

export const API = "https://api.stateofundeadpurge.site:8443";

export const ADMINS = {
  228533264174940160: { name: "Nin Nin",   color: "#c8a84b", initials: "NN" },
  698164264950693950: { name: "Nikki",     color: "#4a8fc4", initials: "NK" },
  925854911378370600: { name: "Dawnie",    color: "#9775cc", initials: "DW" },
  805074936807948298: { name: "Sheo",      color: "#4caf7d", initials: "SH" },
  733259839429410847: { name: "Sunday",    color: "#d4873a", initials: "SN" },
  1076244823121612850:{ name: "Queen Sheo",color: "#e05555", initials: "QS" },
};

export const fetchApi = async (path, opts = {}) => {
  const r = await fetch(`${API}${path}`, { credentials: "include", ...opts });
  if (!r.ok) {
    const e = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(e.detail || r.statusText);
  }
  return r.json();
};

export const postApi = (path, body) =>
  fetchApi(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

// ── Tiny reusable UI primitives ───────────────────────────────────────────────

export const Section = ({ title, sub, children }) => (
  <div style={{ marginBottom: 28 }}>
    <div style={{ fontFamily: "var(--display)", fontSize: 18, letterSpacing: 2, color: "var(--accent)", marginBottom: 2 }}>{title}</div>
    {sub && <div style={{ fontSize: 11, color: "var(--textdim)", fontFamily: "var(--mono)", marginBottom: 14 }}>{sub}</div>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
      {children}
    </div>
  </div>
);

export const FullSection = ({ title, sub, children }) => (
  <div style={{ marginBottom: 28 }}>
    <div style={{ fontFamily: "var(--display)", fontSize: 18, letterSpacing: 2, color: "var(--accent)", marginBottom: 2 }}>{title}</div>
    {sub && <div style={{ fontSize: 11, color: "var(--textdim)", fontFamily: "var(--mono)", marginBottom: 14 }}>{sub}</div>}
    {children}
  </div>
);

export const Card = ({ children, accent }) => (
  <div style={{
    background: "var(--surface)",
    border: "1px solid var(--border)",
    padding: "14px 16px",
    position: "relative",
    overflow: "hidden",
  }}>
    {accent && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accent }} />}
    {children}
  </div>
);

export const FieldLabel = ({ label, description }) => (
  <div style={{ marginBottom: 6 }}>
    <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--textdim)", fontFamily: "var(--mono)" }}>{label}</div>
    {description && <div style={{ fontSize: 11, color: "#4a5568", marginTop: 2, lineHeight: 1.4 }}>{description}</div>}
  </div>
);

export const Toggle = ({ value, onChange, disabled }) => (
  <div
    onClick={() => !disabled && onChange(!value)}
    style={{
      width: 42, height: 22, borderRadius: 11, position: "relative", cursor: disabled ? "default" : "pointer",
      background: value ? "var(--green)" : "var(--border)", transition: "background .2s", flexShrink: 0,
    }}
  >
    <div style={{
      position: "absolute", top: 3, left: value ? 23 : 3, width: 16, height: 16, borderRadius: 8,
      background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.4)",
    }} />
  </div>
);

export const Select = ({ value, onChange, options, disabled }) => (
  <select
    value={value}
    onChange={e => onChange(isNaN(e.target.value) ? e.target.value : Number(e.target.value))}
    disabled={disabled}
    style={{
      width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
      color: "var(--text)", padding: "8px 10px", fontFamily: "var(--mono)", fontSize: 12,
      cursor: "pointer", outline: "none",
    }}
  >
    {options.map(o => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);

export const NumberInput = ({ value, onChange, min, max, step = 1, disabled }) => (
  <input
    type="number" value={value} min={min} max={max} step={step}
    onChange={e => onChange(parseFloat(e.target.value))}
    disabled={disabled}
    style={{
      width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
      color: "var(--text)", padding: "8px 10px", fontFamily: "var(--mono)", fontSize: 12,
      outline: "none",
    }}
  />
);

export const TextInput = ({ value, onChange, placeholder, disabled }) => (
  <input
    type="text" value={value} placeholder={placeholder}
    onChange={e => onChange(e.target.value)}
    disabled={disabled}
    style={{
      width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
      color: "var(--text)", padding: "8px 10px", fontFamily: "var(--mono)", fontSize: 12,
      outline: "none",
    }}
  />
);

export const SliderInput = ({ value, onChange, min, max, step = 0.1, disabled }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <input
      type="range" value={value} min={min} max={max} step={step}
      onChange={e => onChange(parseFloat(e.target.value))}
      disabled={disabled}
      style={{ flex: 1, accentColor: "var(--accent)" }}
    />
    <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)", minWidth: 36, textAlign: "right" }}>
      {value}
    </span>
  </div>
);

export const Btn = ({ children, onClick, color = "gold", sm, disabled }) => {
  const colors = {
    gold:  { border: "var(--accent)",  text: "var(--accent)",  bg: "rgba(200,168,75,0.08)"  },
    green: { border: "var(--green)",   text: "var(--green)",   bg: "rgba(76,175,125,0.08)"  },
    red:   { border: "var(--red)",     text: "var(--red)",     bg: "rgba(224,85,85,0.08)"   },
    blue:  { border: "var(--blue)",    text: "var(--blue)",    bg: "rgba(74,143,196,0.08)"  },
    ghost: { border: "var(--border)",  text: "var(--textdim)", bg: "transparent"            },
  };
  const c = colors[color] || colors.gold;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: sm ? "5px 12px" : "8px 18px",
        fontSize: sm ? 10 : 11,
        fontFamily: "var(--mono)", letterSpacing: 1, textTransform: "uppercase",
        border: `1px solid ${disabled ? "var(--border)" : c.border}`,
        color: disabled ? "var(--textdim)" : c.text,
        background: disabled ? "transparent" : c.bg,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all .15s",
      }}
    >
      {children}
    </button>
  );
};

export const SaveBar = ({ dirty, saving, onSave, onReset, label = "Unsaved changes" }) => {
  if (!dirty) return null;
  return (
    <div style={{
      position: "sticky", bottom: 0, left: 0, right: 0,
      background: "#0f1318", borderTop: "1px solid var(--accent)",
      padding: "12px 0", display: "flex", alignItems: "center", gap: 12,
      zIndex: 50,
    }}>
      <div style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--mono)", letterSpacing: 1 }}>
        ⚠ {label}
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <Btn color="ghost" sm onClick={onReset}>Discard</Btn>
        <Btn color="green" sm onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "💾 Save & Push to Server"}
        </Btn>
      </div>
    </div>
  );
};

// ── ToggleField: the most common field type ───────────────────────────────────
export const ToggleField = ({ label, description, value, onChange }) => (
  <Card>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
      <FieldLabel label={label} description={description} />
      <Toggle value={value} onChange={onChange} />
    </div>
  </Card>
);

export const SelectField = ({ label, description, value, onChange, options }) => (
  <Card>
    <FieldLabel label={label} description={description} />
    <Select value={value} onChange={onChange} options={options} />
  </Card>
);

export const NumberField = ({ label, description, value, onChange, min, max, step }) => (
  <Card>
    <FieldLabel label={label} description={description} />
    <NumberInput value={value} onChange={onChange} min={min} max={max} step={step} />
  </Card>
);

export const SliderField = ({ label, description, value, onChange, min, max, step, accent }) => (
  <Card accent={accent}>
    <FieldLabel label={label} description={description} />
    <SliderInput value={value} onChange={onChange} min={min} max={max} step={step} />
  </Card>
);

// ── Frequency options (used everywhere) ──────────────────────────────────────
export const FREQ_6 = [
  { value: 1, label: "Never" },
  { value: 2, label: "Extremely Rare" },
  { value: 3, label: "Rare" },
  { value: 4, label: "Sometimes" },
  { value: 5, label: "Often" },
  { value: 6, label: "Very Often" },
];

export const FREQ_7 = [
  ...FREQ_6,
  { value: 7, label: "Always" },
];

export const SPEED_6 = [
  { value: 1, label: "Ultra Fast" },
  { value: 2, label: "Very Fast" },
  { value: 3, label: "Fast" },
  { value: 4, label: "Normal" },
  { value: 5, label: "Slow" },
  { value: 6, label: "Very Slow" },
];

export const SPEED_5 = [
  { value: 1, label: "Very Fast" },
  { value: 2, label: "Fast" },
  { value: 3, label: "Normal" },
  { value: 4, label: "Slow" },
  { value: 5, label: "Very Slow" },
];

export const AMOUNT_5 = [
  { value: 1, label: "Very Poor" },
  { value: 2, label: "Poor" },
  { value: 3, label: "Normal" },
  { value: 4, label: "Abundant" },
  { value: 5, label: "Very Abundant" },
];
