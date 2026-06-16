"use client";
// @ts-nocheck
// app/admin/tabs/SystemResourcesTab.jsx
// "Can I afford a test server?" dashboard — total RAM, what's using it, free
// ports, and a live inventory of every PZ server instance on the box.

import { useState, useEffect, useCallback } from "react";
import { fetchApi, Title, B, FB, Load } from "./shared";

const fetchOverview = () => fetchApi("/api/admin/sysresources/overview");

const COLOR_MAP = {
  green:  "var(--green)",
  blue:   "var(--blue)",
  purple: "var(--purple)",
  orange: "var(--orange)",
  red:    "var(--red)",
  muted:  "var(--muted)",
};

function fmtMb(mb) {
  if (mb == null) return "—";
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}

// ── RAM bar ──────────────────────────────────────────────────────────────────

function RamBar({ breakdown, totalMb }) {
  return (
    <div style={{ width: "100%", height: 28, borderRadius: 4, overflow: "hidden",
      display: "flex", border: "1px solid var(--border)", background: "var(--surface2)" }}>
      {breakdown.map((b, i) => {
        const pct = totalMb ? (b.ram_mb / totalMb) * 100 : 0;
        if (pct < 0.3) return null;
        return (
          <div
            key={i}
            title={`${b.label}: ${fmtMb(b.ram_mb)}`}
            style={{
              width: `${pct}%`,
              background: COLOR_MAP[b.color] || "var(--muted)",
              opacity: 0.85,
              borderRight: "1px solid rgba(0,0,0,0.3)",
            }}
          />
        );
      })}
    </div>
  );
}

function RamLegend({ breakdown }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 12 }}>
      {breakdown.filter(b => b.ram_mb > 0).map((b, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6,
          fontFamily: "var(--mono)", fontSize: 11 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2,
            background: COLOR_MAP[b.color] || "var(--muted)", display: "inline-block" }} />
          <span style={{ color: "var(--text)" }}>{b.label}</span>
          <span style={{ color: "var(--textdim)" }}>{fmtMb(b.ram_mb)}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)",
      borderRadius: 4, padding: "14px 18px", flex: 1, minWidth: 130 }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)",
        letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 22, fontWeight: 700,
        color: color || "var(--accent)" }}>{value}</div>
      {sub && <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Memory panel ─────────────────────────────────────────────────────────────

function MemoryPanel({ mem }) {
  if (!mem) return <Load />;

  const headroomColor = mem.headroom_mb > 4096 ? "var(--green)"
    : mem.headroom_mb > 1024 ? "var(--orange)" : "var(--red)";

  return (
    <FB title="🧠 SYSTEM MEMORY">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="TOTAL RAM"     value={fmtMb(mem.total_mb)} />
        <StatCard label="IN USE"        value={fmtMb(mem.used_mb)} color="var(--orange)" />
        <StatCard label="AVAILABLE"     value={fmtMb(mem.available_mb)} color="var(--blue)" />
        <StatCard
          label="HEADROOM FOR TEST SERVER"
          value={fmtMb(mem.headroom_mb)}
          color={headroomColor}
          sub={`after ${fmtMb(mem.safety_margin_mb)} safety margin`}
        />
        {mem.swap_total_mb > 0 && (
          <StatCard label="SWAP USED" value={`${fmtMb(mem.swap_used_mb)} / ${fmtMb(mem.swap_total_mb)}`} color="var(--muted)" />
        )}
      </div>

      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", marginBottom: 8 }}>
        Memory usage by service
      </div>
      <RamBar breakdown={mem.breakdown} totalMb={mem.total_mb} />
      <RamLegend breakdown={mem.breakdown} />

      {mem.headroom_mb < 1024 && (
        <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(224,85,85,0.1)",
          border: "1px solid var(--red)", borderRadius: 3, fontFamily: "var(--mono)",
          fontSize: 12, color: "var(--red)" }}>
          ⚠️ Low headroom. A test server needs at least 512 MB–1 GB to run reliably.
          Consider stopping unused services or freeing RAM before provisioning.
        </div>
      )}
    </FB>
  );
}

// ── Ports panel ──────────────────────────────────────────────────────────────

function PortRow({ row }) {
  const inUse = row.bound_now ?? row.in_use;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px",
      borderBottom: "1px solid var(--border)", fontFamily: "var(--mono)", fontSize: 12 }}>
      <span style={{ width: 60, color: "var(--accent)" }}>{row.port}</span>
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: inUse ? "var(--red)" : "var(--green)",
        display: "inline-block", flexShrink: 0,
      }} />
      <span style={{ color: inUse ? "var(--red)" : "var(--green)", width: 70 }}>
        {inUse ? "IN USE" : "FREE"}
      </span>
      <span style={{ color: "var(--textdim)", flex: 1 }}>{row.label || "—"}</span>
    </div>
  );
}

function PortsPanel({ ports }) {
  if (!ports) return <Load />;
  const [showScan, setShowScan] = useState(false);

  return (
    <FB title="🔌 PORT MAP">
      <div className="ap-note" style={{ marginBottom: 14 }}>
        Reserved / known ports on this box — check before assigning a new server's ports.
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard label="SUGGESTED GAME PORT" value={ports.suggested_game_port ?? "none free"} color="var(--green)" />
        <StatCard label="SUGGESTED RCON PORT" value={ports.suggested_rcon_port ?? "none free"} color="var(--green)" />
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
        {ports.reserved.map((row, i) => <PortRow key={i} row={row} />)}
      </div>

      <B c="ghost" sm onClick={() => setShowScan(s => !s)} style={{ marginTop: 14 }}>
        {showScan ? "Hide" : "Show"} full port range scan
      </B>

      {showScan && (
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", marginBottom: 6 }}>
              GAME PORTS (16261–16300)
            </div>
            <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 4 }}>
              {ports.game_port_scan.map((row, i) => <PortRow key={i} row={row} />)}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", marginBottom: 6 }}>
              RCON PORTS (27015–27034)
            </div>
            <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 4 }}>
              {ports.rcon_port_scan.map((row, i) => <PortRow key={i} row={row} />)}
            </div>
          </div>
        </div>
      )}
    </FB>
  );
}

// ── Servers panel ────────────────────────────────────────────────────────────

function ServerCard({ s }) {
  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)",
      borderRadius: 4, padding: "14px 18px", minWidth: 220, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontFamily: "var(--display)", fontSize: 16, letterSpacing: 1,
          color: s.is_test ? "var(--blue)" : "var(--accent)" }}>
          {s.is_test ? "🧪" : "🖥️"} {s.name}
        </span>
        <span style={{
          marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, padding: "2px 8px",
          borderRadius: 2, background: s.running ? "rgba(76,175,125,0.15)" : "rgba(224,85,85,0.15)",
          border: `1px solid ${s.running ? "var(--green)" : "var(--red)"}`,
          color: s.running ? "var(--green)" : "var(--red)",
        }}>
          {s.running ? "RUNNING" : "STOPPED"}
        </span>
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", lineHeight: 1.8 }}>
        <div>RAM (live): <span style={{ color: "var(--text)" }}>{fmtMb(s.ram_mb)}</span></div>
        {s.ram_allocated_mb && <div>RAM (allocated): <span style={{ color: "var(--text)" }}>{fmtMb(s.ram_allocated_mb)}</span></div>}
        <div>Game port: <span style={{ color: "var(--accent)" }}>{s.game_port ?? "—"}</span></div>
        <div>RCON port: <span style={{ color: "var(--accent)" }}>{s.rcon_port ?? "—"}</span></div>
        {s.description && <div>Purpose: <span style={{ color: "var(--text)" }}>{s.description}</span></div>}
        {s.created_by && <div>Created by: <span style={{ color: "var(--text)" }}>{s.created_by}</span></div>}
      </div>
    </div>
  );
}

function ServersPanel({ servers }) {
  if (!servers) return <Load />;
  return (
    <FB title={`🗂️ SERVER INVENTORY (${servers.total})`}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {servers.servers.map((s, i) => <ServerCard key={i} s={s} />)}
        {!servers.test_server_exists && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px dashed var(--border)", borderRadius: 4, minWidth: 220, flex: 1,
            fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", padding: 18 }}>
            No test server provisioned yet
          </div>
        )}
      </div>
    </FB>
  );
}

// ── main tab ─────────────────────────────────────────────────────────────────

export default function SystemResourcesTab({ toast }) {
  const [data, setData]   = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchOverview();
      setData(res);
      setError(null);
    } catch (e) {
      setError(e.message);
      toast?.(`Failed to load system resources: ${e.message}`, "error");
    }
  }, [toast]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 20000); // auto-refresh every 20s
    return () => clearInterval(iv);
  }, [load]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <Title t="📊 SYSTEM RESOURCES" s="RAM usage, port availability, and server inventory — check this before provisioning a test server" />
        <B c="ghost" sm onClick={load} style={{ marginLeft: "auto" }}>⟳ Refresh</B>
      </div>

      {error && (
        <div className="ap-note danger" style={{ marginBottom: 16 }}>
          Failed to load: {error}
        </div>
      )}

      {!data ? <Load /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <MemoryPanel mem={data.memory} />
          <ServersPanel servers={data.servers} />
          <PortsPanel ports={data.ports} />
        </div>
      )}
    </div>
  );
}
