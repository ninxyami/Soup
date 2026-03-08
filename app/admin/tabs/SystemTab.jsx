"use client";
// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { fetchApi, postApi, Title, SC, B, FB, Load } from "./shared";

const API = "https://api.stateofundeadpurge.site:8443";

const StatusDot = ({ status }) => {
  const on = status === "active";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span className={`ap-dot ${on ? "on" : "off"}`} />
      <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: on ? "var(--green)" : "var(--muted)" }}>
        {status || "unknown"}
      </span>
    </span>
  );
};

const ProgressBar = ({ step, total, label }) => {
  const pct = total > 1 ? Math.round((step / (total - 1)) * 100) : 100;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)", marginBottom: 4 }}>
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: pct === 100 ? "var(--green)" : "var(--accent)",
          boxShadow: pct === 100 ? "0 0 8px var(--green)" : "0 0 8px rgba(200,168,75,0.5)",
          transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
};

// ── Wipe modal ────────────────────────────────────────────────────────────────

const WipeModal = ({ type, onClose, toast }) => {
  const [phase, setPhase]   = useState("confirm"); // confirm | running | done | troll
  const [steps, setSteps]   = useState([]);
  const [progress, setProgress] = useState({ step: 0, total: 1 });

  const config = {
    world: {
      icon:    "🌍",
      title:   "World Wipe",
      color:   "var(--orange)",
      warning: "This will delete the map and reset the world.\nPlayer data, mods, and server settings will be kept.",
      label:   "Confirm World Wipe",
      endpoint: "/api/admin/system/wipe-world",
    },
    pure: {
      icon:    "☠️",
      title:   "Pure Wipe",
      color:   "var(--red)",
      warning: "FULL RESET — Everything will be wiped:\n• World & map data\n• All player saves\n• Mods config\n• Server INI (backed up first)\n\nThis cannot be undone.",
      label:   "YES — Wipe Everything",
      endpoint: "/api/admin/system/wipe-pure",
    },
    nuclear: {
      icon:    "☢️",
      title:   "Nuclear Wipe",
      color:   "var(--red)",
      warning: "",
      label:   "",
      endpoint: "/api/admin/system/wipe-nuclear",
    },
  }[type];

  useEffect(() => {
    if (type === "nuclear") {
      setPhase("troll");
    }
  }, [type]);

  const runWipe = async () => {
    setPhase("running");
    setSteps([]);

    try {
      const resp = await fetch(`${API}${config.endpoint}`, {
        method: "POST",
        credentials: "include",
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(err.detail || resp.statusText);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const update = JSON.parse(line.slice(6));
            if (update.error) throw new Error(update.error);
            setProgress({ step: update.step, total: update.total });
            setSteps(prev => [...prev, { msg: update.msg, done: !!update.done }]);
            if (update.done) setPhase("done");
          } catch {}
        }
      }
    } catch (e) {
      toast(e.message, "error");
      setPhase("confirm");
    }
  };

  return (
    <div className="ap-mbd" onClick={e => { if (e.target === e.currentTarget && phase !== "running") onClose(); }}>
      <div className="ap-mod" style={{ borderColor: config.color }}>
        <button className="ap-mod-x" onClick={() => phase !== "running" && onClose()}>×</button>
        <h3 style={{ color: config.color }}>{config.icon} {config.title}</h3>

        {phase === "troll" && (
          <>
            <div className="ap-note danger" style={{ whiteSpace: "pre-line", lineHeight: 1.8 }}>
              ☢️ Nice try.{"\n\n"}
              Nuclear wipe requires direct SSH access to the server.{"\n"}
              If you actually need this, you already know what to do.{"\n"}
              We're not letting you accidentally nuke the server from a browser tab.
            </div>
            <B c="ghost" onClick={onClose}>Close</B>
          </>
        )}

        {phase === "confirm" && (
          <>
            <div className="ap-note danger" style={{ whiteSpace: "pre-line", lineHeight: 1.8 }}>
              {config.warning}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <B c="red" onClick={runWipe}>{config.label}</B>
              <B c="ghost" onClick={onClose}>Cancel</B>
            </div>
          </>
        )}

        {phase === "running" && (
          <>
            <ProgressBar step={progress.step} total={progress.total} label="Wipe in progress..." />
            <div style={{
              background: "var(--bg)", border: "1px solid var(--border)",
              padding: "12px 16px", fontFamily: "var(--mono)", fontSize: 11,
              maxHeight: 220, overflowY: "auto", color: "var(--textdim)",
            }}>
              {steps.map((s, i) => (
                <div key={i} style={{ marginBottom: 4, color: s.done ? "var(--green)" : "var(--textdim)" }}>
                  {s.done ? "✅" : "⏳"} {s.msg}
                </div>
              ))}
            </div>
          </>
        )}

        {phase === "done" && (
          <>
            <ProgressBar step={1} total={1} label="Complete" />
            <div className="ap-note success">✅ {config.title} complete. Server is back up.</div>
            <B c="green" onClick={onClose}>Close</B>
          </>
        )}
      </div>
    </div>
  );
};

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function SystemTab({ toast }) {
  const [status, setStatus]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [restarting, setRestarting] = useState({});
  const [wipeModal, setWipeModal]   = useState(null); // "world" | "pure" | "nuclear"

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetchApi("/api/admin/system/status");
      setStatus(r);
    } catch {
      setStatus({ bot: "unknown", api: "unknown", server: "unknown" });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStatus();
    const iv = setInterval(loadStatus, 15000);
    return () => clearInterval(iv);
  }, [loadStatus]);

  const restart = async (service) => {
    setRestarting(prev => ({ ...prev, [service]: true }));
    try {
      const r = await postApi(`/api/admin/system/restart-${service}`, {});
      toast(r.message, "success");
      setTimeout(loadStatus, 3000);
    } catch (e) {
      toast(e.message, "error");
    }
    setRestarting(prev => ({ ...prev, [service]: false }));
  };

  return (
    <>
      <Title t="SYSTEM PANEL" s="services · wipes · health" />

      {/* Status */}
      <div className="ap-sr" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 28 }}>
        <div className="ap-sc blue">
          <div className="ap-sc-l">Discord Bot</div>
          <div style={{ marginTop: 4 }}>{loading ? <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)" }}>...</span> : <StatusDot status={status?.bot} />}</div>
        </div>
        <div className="ap-sc green">
          <div className="ap-sc-l">Zombita API</div>
          <div style={{ marginTop: 4 }}>{loading ? <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)" }}>...</span> : <StatusDot status={status?.api} />}</div>
        </div>
        <div className="ap-sc orange">
          <div className="ap-sc-l">Game Server</div>
          <div style={{ marginTop: 4 }}>{loading ? <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)" }}>...</span> : <StatusDot status={status?.server} />}</div>
        </div>
      </div>

      {/* Service restarts */}
      <div className="ap-2c" style={{ marginBottom: 24 }}>
        <FB title="DISCORD BOT">
          <div className="ap-note info">Restarts the Discord bot service. Zombita will be offline for a few seconds.</div>
          <div style={{ display: "flex", gap: 10 }}>
            <B c="blue" onClick={() => restart("bot")} disabled={restarting.bot}>
              {restarting.bot ? "⏳ Restarting..." : "🔁 Restart Bot"}
            </B>
            <B c="ghost" onClick={loadStatus}>↻ Refresh</B>
          </div>
        </FB>
        <FB title="ZOMBITA API">
          <div className="ap-note info">Restarts the web API. Website will be briefly unreachable.</div>
          <div style={{ display: "flex", gap: 10 }}>
            <B c="blue" onClick={() => restart("api")} disabled={restarting.api}>
              {restarting.api ? "⏳ Restarting..." : "🔁 Restart API"}
            </B>
            <B c="ghost" onClick={loadStatus}>↻ Refresh</B>
          </div>
        </FB>
      </div>

      {/* Wipes */}
      <div className="ap-fb" style={{ marginBottom: 0 }}>
        <h4 style={{ fontFamily: "var(--display)", fontSize: 18, letterSpacing: 2, color: "var(--text)", margin: "0 0 16px 0" }}>SERVER WIPES</h4>
        <div className="ap-note danger" style={{ marginBottom: 20 }}>
          Wipe operations stop the server, delete files, and restart. Always confirm before proceeding.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>

          <div style={{ background: "var(--bg)", border: "1px solid var(--border)", padding: 20, borderTop: "2px solid var(--orange)" }}>
            <div style={{ fontFamily: "var(--display)", fontSize: 16, letterSpacing: 2, color: "var(--orange)", marginBottom: 8 }}>🌍 WORLD WIPE</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", lineHeight: 1.8, marginBottom: 16 }}>
              Resets the map only.<br />
              Players, mods, settings kept.<br />
              Fresh world, same community.
            </div>
            <B c="orange" onClick={() => setWipeModal("world")}>World Wipe</B>
          </div>

          <div style={{ background: "var(--bg)", border: "1px solid var(--border)", padding: 20, borderTop: "2px solid var(--red)" }}>
            <div style={{ fontFamily: "var(--display)", fontSize: 16, letterSpacing: 2, color: "var(--red)", marginBottom: 8 }}>☠️ PURE WIPE</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", lineHeight: 1.8, marginBottom: 16 }}>
              Wipes everything.<br />
              World, players, mods, INI.<br />
              True fresh start.
            </div>
            <B c="red" onClick={() => setWipeModal("pure")}>Pure Wipe</B>
          </div>

          <div style={{ background: "var(--bg)", border: "1px solid var(--border)", padding: 20, borderTop: "2px solid var(--muted)", opacity: 0.7 }}>
            <div style={{ fontFamily: "var(--display)", fontSize: 16, letterSpacing: 2, color: "var(--muted)", marginBottom: 8 }}>☢️ NUCLEAR WIPE</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", lineHeight: 1.8, marginBottom: 16 }}>
              SSH only.<br />
              Not available here.<br />
              You know why.
            </div>
            <B c="ghost" onClick={() => setWipeModal("nuclear")}>Try It</B>
          </div>

        </div>
      </div>

      {wipeModal && (
        <WipeModal
          type={wipeModal}
          onClose={() => setWipeModal(null)}
          toast={toast}
        />
      )}
    </>
  );
}
