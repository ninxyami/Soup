"use client";
// @ts-nocheck
// app/admin/tabs/TestServerTab.jsx
// Manage the Project Zomboid TEST server — isolated from the main server.
// Create / Delete / Start / Stop / Restart + live config editing (RAM, slots, etc.)

import { useState, useEffect, useCallback, useRef } from "react";
import { API, fetchApi, postApi, Title, B, FB, Inp, Sel, Load } from "./shared";

// ── helpers ──────────────────────────────────────────────────────────────────

const apiFetch = fetchApi;

function StatusBadge({ running, exists }) {
  if (!exists) return (
    <span style={{ fontFamily: "var(--mono)", fontSize: 11, padding: "3px 10px",
      background: "rgba(100,100,100,0.15)", border: "1px solid var(--border)",
      color: "var(--textdim)", borderRadius: 2 }}>
      NOT PROVISIONED
    </span>
  );
  return (
    <span style={{ fontFamily: "var(--mono)", fontSize: 11, padding: "3px 10px",
      background: running ? "rgba(76,175,125,0.15)" : "rgba(224,85,85,0.15)",
      border: `1px solid ${running ? "var(--green)" : "var(--red)"}`,
      color: running ? "var(--green)" : "var(--red)", borderRadius: 2 }}>
      {running ? "● RUNNING" : "● STOPPED"}
    </span>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)",
      borderRadius: 4, padding: "14px 18px", flex: 1, minWidth: 120 }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)",
        letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 22, fontWeight: 700,
        color: color || "var(--accent)" }}>{value ?? "—"}</div>
    </div>
  );
}

// ── sub-panels ────────────────────────────────────────────────────────────────

function CreatePanel({ toast, onCreated }) {
  const [ramMb,    setRamMb]    = useState("4096");
  const [slots,    setSlots]    = useState("16");
  const [desc,     setDesc]     = useState("Test server");
  const [gamePort, setGamePort] = useState("16262");
  const [rconPort, setRconPort] = useState("27016");
  const [busy,     setBusy]     = useState(false);
  const [resources, setResources] = useState(null); // headroom + suggested ports

  const ramPresets = [512, 1024, 2048, 4096, 6144, 8192, 12288, 16384];

  useEffect(() => {
    fetchApi("/api/admin/sysresources/overview")
      .then(res => {
        setResources(res);
        if (res.ports?.suggested_game_port) setGamePort(String(res.ports.suggested_game_port));
        if (res.ports?.suggested_rcon_port) setRconPort(String(res.ports.suggested_rcon_port));
      })
      .catch(() => {}); // non-fatal — form still works without it
  }, []);

  const headroomMb = resources?.memory?.headroom_mb ?? null;
  const overBudget = headroomMb != null && parseInt(ramMb || "0") > headroomMb;

  const create = async () => {
    if (!ramMb || !slots) { toast("RAM and slots are required", "error"); return; }
    if (overBudget) {
      toast(`That's more than the ${headroomMb} MB free right now — pick a smaller allocation or free up RAM first`, "error");
      return;
    }
    setBusy(true);
    try {
      const res = await postApi("/api/admin/testserver/create", {
        ram_mb:      parseInt(ramMb),
        slots:       parseInt(slots),
        description: desc,
        game_port:   parseInt(gamePort),
        rcon_port:   parseInt(rconPort),
      });
      toast(res.message || "Test server created!", "success");
      onCreated?.();
    } catch (e) {
      toast(`Failed: ${e.message}`, "error");
    }
    setBusy(false);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <FB title="⚙️ PROVISION TEST SERVER">
        <div className="ap-note" style={{ marginBottom: 16 }}>
          Creates an isolated PZ instance with its own service, port, saves, and config.
          The main server is <strong>never affected</strong>.
        </div>

        {headroomMb != null && (
          <div style={{
            marginBottom: 16, padding: "10px 14px", borderRadius: 3,
            background: overBudget ? "rgba(224,85,85,0.1)" : "rgba(76,175,125,0.08)",
            border: `1px solid ${overBudget ? "var(--red)" : "var(--green)"}`,
            fontFamily: "var(--mono)", fontSize: 12,
            color: overBudget ? "var(--red)" : "var(--green)",
          }}>
            {overBudget ? "⚠️" : "✅"} {headroomMb >= 1024 ? `${(headroomMb / 1024).toFixed(1)} GB` : `${headroomMb} MB`} free on this box right now
            {overBudget ? " — your selected RAM exceeds this" : ""}.
            {" "}<a onClick={() => {}} style={{ color: "var(--accent)", cursor: "pointer", textDecoration: "underline" }}>
              See full breakdown in System Resources tab
            </a>
          </div>
        )}

        <Inp
          label="Description / purpose"
          placeholder="e.g. Mod testing, Wipe prep, Balance tests…"
          value={desc}
          onChange={e => setDesc(e.target.value)}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <Sel label="RAM allocation" value={ramMb} onChange={e => setRamMb(e.target.value)}>
              {ramPresets.map(mb => (
                <option key={mb} value={mb}>
                  {mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`} ({mb} MB)
                  {headroomMb != null && mb > headroomMb ? " ⚠ exceeds free RAM" : ""}
                </option>
              ))}
            </Sel>
          </div>
          <div>
            <Sel label="Max player slots" value={slots} onChange={e => setSlots(e.target.value)}>
              {[2, 4, 8, 12, 16, 24, 32, 48, 64].map(s => (
                <option key={s} value={s}>{s} players</option>
              ))}
            </Sel>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
          <Inp label="Game port" type="number" value={gamePort} onChange={e => setGamePort(e.target.value)} />
          <Inp label="RCON port" type="number" value={rconPort} onChange={e => setRconPort(e.target.value)} />
        </div>

        <div style={{ marginTop: 8, padding: "10px 14px", background: "rgba(200,168,75,0.07)",
          border: "1px solid rgba(200,168,75,0.2)", borderRadius: 3,
          fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", lineHeight: 1.7 }}>
          The RAM you pick above becomes the max heap (Xmx). The JVM starts smaller
          (Xms ≈ ¼ of that, min 512 MB) and grows into it — so it won't grab the
          full amount immediately on boot.<br />
          Ports above are auto-suggested as free — double-check in the
          {" "}<strong>System Resources</strong> tab if you're not sure.<br />
          Service: <span style={{ color: "var(--accent)" }}>pz-testserver</span><br />
          Saves dir: <span style={{ color: "var(--accent)" }}>/home/zomboid/testserver/</span>
        </div>

        <B c="gold" full onClick={create} disabled={busy || overBudget} style={{ marginTop: 16 }}>
          {busy ? "Provisioning…" : overBudget ? "Reduce RAM to continue" : "🚀 Create & Start Test Server"}
        </B>
      </FB>

      <FB title="📋 WHAT IS A TEST SERVER?">
        <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", lineHeight: 1.9 }}>
          <div style={{ marginBottom: 12, color: "var(--text)" }}>
            A completely separate PZ instance running alongside your main server.
          </div>
          <div>✅ Separate saves, config and ports</div>
          <div>✅ Full start / stop / restart control</div>
          <div>✅ Adjust RAM without touching main server</div>
          <div>✅ Wipe / delete anytime — main server unaffected</div>
          <div>✅ No Steam VAC (for easy testing)</div>
          <div>✅ Pauses when empty (saves resources)</div>
          <div style={{ marginTop: 14, color: "var(--red)" }}>
            ❌ Shares host machine resources (RAM, CPU)<br />
            ❌ Not publicly listed on Steam<br />
            ❌ No automatic backups
          </div>
        </div>
      </FB>
    </div>
  );
}

function StatusPanel({ status, toast, onRefresh, setBusy, busy }) {
  const action = async (act, body = {}) => {
    setBusy(true);
    try {
      const res = await postApi(`/api/admin/testserver/${act}`, body);
      toast(res.message || `${act} OK`, "success");
      setTimeout(onRefresh, 2000);
    } catch (e) {
      toast(`Failed: ${e.message}`, "error");
    }
    setBusy(false);
  };

  return (
    <div>
      {/* Stat row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="STATUS"    value={status.running ? "ONLINE" : "OFFLINE"} color={status.running ? "var(--green)" : "var(--red)"} />
        <StatCard label="UPTIME"    value={status.uptime || (status.running ? "—" : "—")} />
        <StatCard
          label="HEAP (Xms / Xmx)"
          value={status.ram_mb
            ? `${status.xms_mb ? (status.xms_mb >= 1024 ? (status.xms_mb/1024).toFixed(1)+"G" : status.xms_mb+"M") : "?"} / ${status.ram_mb >= 1024 ? (status.ram_mb/1024).toFixed(1)+"G" : status.ram_mb+"M"}`
            : "—"}
        />
        <StatCard label="SLOTS"     value={status.slots ?? "—"} />
        <StatCard label="GAME PORT" value={status.game_port ?? "16262"} color="var(--blue)" />
        <StatCard label="RCON PORT" value={status.rcon_port ?? "27016"} color="var(--blue)" />
      </div>

      {status.description && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)",
          marginBottom: 20, padding: "8px 14px", background: "var(--surface2)",
          border: "1px solid var(--border)", borderRadius: 3 }}>
          📋 {status.description}
          {status.created_by && (
            <span style={{ marginLeft: 16 }}>created by <span style={{ color: "var(--accent)" }}>{status.created_by}</span></span>
          )}
        </div>
      )}

      {/* Control buttons */}
      <FB title="🖥️ SERVER CONTROL">
        <div className="ap-note" style={{ marginBottom: 12 }}>
          Controls the <strong>test server only</strong>. Main server is unaffected.
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {!status.running ? (
            <B c="gold" onClick={() => action("start")} disabled={busy}>▶ Start</B>
          ) : (
            <B c="danger" onClick={() => action("stop")} disabled={busy}>■ Stop</B>
          )}
          <B c="ghost" onClick={() => action("restart")} disabled={busy}>↺ Restart</B>
          <B c="ghost" onClick={onRefresh} disabled={busy}>⟳ Refresh Status</B>
        </div>
      </FB>
    </div>
  );
}

function ConfigPanel({ status, toast, onRefresh }) {
  const [ramMb,  setRamMb]  = useState(String(status.ram_mb || 4096));
  const [slots,  setSlots]  = useState(String(status.slots  || 16));
  const [desc,   setDesc]   = useState(status.description || "");
  const [busy,   setBusy]   = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const body = { ram_mb: parseInt(ramMb), slots: parseInt(slots), description: desc };
      const res  = await postApi("/api/admin/testserver/config", body);
      toast(res.message || "Config saved", "success");
      onRefresh?.();
    } catch (e) {
      toast(`Failed: ${e.message}`, "error");
    }
    setBusy(false);
  };

  const ramPresets = [512, 1024, 2048, 4096, 6144, 8192, 12288, 16384];

  return (
    <FB title="⚙️ EDIT CONFIGURATION">
      <div className="ap-note" style={{ marginBottom: 16 }}>
        Changing RAM while the server is running will trigger an automatic restart.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <Sel label="RAM allocation" value={ramMb} onChange={e => setRamMb(e.target.value)}>
          {ramPresets.map(mb => (
            <option key={mb} value={mb}>{mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`}</option>
          ))}
        </Sel>
        <Sel label="Max player slots" value={slots} onChange={e => setSlots(e.target.value)}>
          {[2, 4, 8, 12, 16, 24, 32, 48, 64].map(s => (
            <option key={s} value={s}>{s} players</option>
          ))}
        </Sel>
        <Inp
          label="Description"
          value={desc}
          onChange={e => setDesc(e.target.value)}
        />
      </div>
      <B c="gold" onClick={save} disabled={busy} style={{ marginTop: 12 }}>
        {busy ? "Saving…" : "💾 Save Config"}
      </B>
    </FB>
  );
}

function DeletePanel({ toast, onDeleted }) {
  const [confirm, setConfirm] = useState(false);
  const [busy,    setBusy]    = useState(false);

  const doDelete = async () => {
    setBusy(true);
    try {
      const res = await postApi("/api/admin/testserver/delete", { confirm: true });
      toast(res.message || "Test server deleted.", "success");
      setConfirm(false);
      onDeleted?.();
    } catch (e) {
      toast(`Failed: ${e.message}`, "error");
    }
    setBusy(false);
  };

  return (
    <FB title="🗑️ DELETE TEST SERVER">
      <div className="ap-note danger" style={{ marginBottom: 12 }}>
        ⚠️ This permanently deletes the test server directory, all its saves, config,
        and the systemd service. The main server is <strong>not affected</strong>.
        This cannot be undone.
      </div>
      {!confirm ? (
        <B c="danger" onClick={() => setConfirm(true)}>🗑️ Delete Test Server…</B>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--red)" }}>
            Are you sure? All test server data will be wiped.
          </span>
          <B c="danger" onClick={doDelete} disabled={busy}>
            {busy ? "Deleting…" : "⚠️ Yes, Delete Everything"}
          </B>
          <B c="ghost" onClick={() => setConfirm(false)} disabled={busy}>Cancel</B>
        </div>
      )}
    </FB>
  );
}

// ── main tab ─────────────────────────────────────────────────────────────────

export default function TestServerTab({ toast }) {
  const [status,  setStatus]  = useState(null);
  const [sub,     setSub]     = useState("status");
  const [busy,    setBusy]    = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await apiFetch("/api/admin/testserver/status");
      setStatus(s);
      // If no server exists yet, show create panel
      if (!s.exists) setSub("create");
    } catch (e) {
      setStatus({ exists: false, running: false, error: e.message });
      setSub("create");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const serverExists = status?.exists;

  // Sub-tab definitions
  const tabs = [
    ...(serverExists
      ? [
          { key: "status", label: "Status & Control" },
          { key: "config", label: "Configuration" },
          { key: "delete", label: "Delete" },
        ]
      : [{ key: "create", label: "Create Server" }]
    ),
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <Title t="🧪 TEST SERVER" s="Isolated Project Zomboid test instance — separate from main server" />
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {status && <StatusBadge running={status.running} exists={status.exists} />}
          <B c="ghost" sm onClick={load}>⟳</B>
        </div>
      </div>

      {/* Sub-nav */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setSub(t.key)}
            style={{
              fontFamily: "var(--mono)", fontSize: 11, padding: "5px 14px",
              background: sub === t.key ? "var(--accent)" : "transparent",
              color: sub === t.key ? "#000" : "var(--textdim)",
              border: `1px solid ${sub === t.key ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 2, cursor: "pointer", letterSpacing: 1,
            }}
          >
            {t.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content */}
      {status === null ? (
        <Load />
      ) : sub === "create" ? (
        <CreatePanel
          toast={toast}
          onCreated={() => { load(); setSub("status"); }}
        />
      ) : sub === "status" ? (
        <StatusPanel
          status={status}
          toast={toast}
          onRefresh={load}
          setBusy={setBusy}
          busy={busy}
        />
      ) : sub === "config" ? (
        <ConfigPanel
          status={status}
          toast={toast}
          onRefresh={load}
        />
      ) : sub === "delete" ? (
        <DeletePanel
          toast={toast}
          onDeleted={() => { load(); setSub("create"); }}
        />
      ) : null}
    </div>
  );
}
