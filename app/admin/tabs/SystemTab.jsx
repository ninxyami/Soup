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

// ── The one wipe ──────────────────────────────────────────────────────────────
// Same three questions as Zombita's card in Discord (wipe.wipe(characters, season, settings)):
// nothing has a default, START only unlocks once every row is answered. The map is always
// reset and the characters are always backed up first, whatever is picked.

const QUESTIONS = [
  {
    key: "characters", title: "CHARACTERS", options: [
      ["keep", "👤 Keep", "Everyone keeps their character, skills and inventory on the fresh map."],
      ["delete", "🗑️ Delete", "Everyone starts a new character.", "var(--red)"],
    ],
  },
  {
    key: "season", title: "THIS SEASON", options: [
      ["fix", "🔧 Fix only", "Just the map. Stats, money, shops, leaderboard and the paper carry on (for a broken map)."],
      ["keep", "💾 New season, save stats", "Economy reset, shops rolled, leaderboard ended, published papers taken down. This season's stats go into ALL TIME first."],
      ["reset", "🗑️ New season, delete stats", "Same, but the stats are thrown away and ALL TIME is cleared. Tests only.", "var(--red)"],
    ],
  },
  {
    key: "settings", title: "SERVER SETTINGS", options: [
      ["keep", "⚙️ Keep", "servertest.ini and the mods config stay as they are."],
      ["reset", "♻️ Reset INI + mods config", "The server comes back with default settings and NO mods until the INI is restored from a backup.", "var(--red)"],
    ],
  },
];

const describeWipe = (a) => [
  "map reset",
  a.characters === "keep" ? "characters KEPT" : "characters DELETED",
  { fix: "fix only (stats, money, shops, leaderboard kept)", keep: "new season, stats saved to ALL TIME", reset: "new season, stats deleted (ALL TIME cleared)" }[a.season],
  a.settings === "keep" ? "server settings KEPT" : "server settings + mods config RESET",
].join(", ");

const WipeModal = ({ answers, onClose, toast }) => {
  const [phase, setPhase]   = useState("confirm"); // confirm | running | done | failed
  const [steps, setSteps]   = useState([]);
  const [progress, setProgress] = useState({ step: 0, total: 1 });
  const [results, setResults] = useState([]);
  const [stopped, setStopped] = useState([]);
  const [failMsg, setFailMsg] = useState("");

  const runWipe = async () => {
    setPhase("running");
    setSteps([]);
    try {
      const resp = await fetch(`${API}/api/admin/system/wipe`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(err.detail || resp.statusText);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let ended = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let update;
          try { update = JSON.parse(line.slice(6)); } catch { continue; }
          if (update.error) {
            // "wipe_running" (another wipe holds the guard) / "bad_choice": nothing was done
            ended = true;
            setFailMsg(update.msg || update.error);
            setPhase("failed");
            continue;
          }
          setProgress({ step: update.step, total: update.total });
          setSteps(prev => [...prev, { msg: update.msg, done: !!update.done }]);
          if (update.results) setResults(update.results);
          if (update.restarts_stopped) setStopped(update.restarts_stopped);
          if (update.done) { ended = true; setPhase("done"); }
        }
      }
      if (!ended) throw new Error("The connection dropped before the wipe reported it was done. Check the server.");
    } catch (e) {
      toast(e.message, "error");
      setFailMsg(e.message);
      setPhase("failed");
    }
  };

  const busy = phase === "running";
  return (
    <div className="ap-mbd" onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="ap-mod" style={{ borderColor: "var(--red)" }}>
        <button className="ap-mod-x" onClick={() => !busy && onClose()}>×</button>
        <h3 style={{ color: "var(--red)" }}>☠️ Server Wipe</h3>

        {phase === "confirm" && (
          <>
            <div className="ap-note danger" style={{ whiteSpace: "pre-line", lineHeight: 1.8 }}>
              {describeWipe(answers)}{"\n\n"}
              The server warns players, saves, kicks everyone, stops, backs the characters up to Zomboid/wipe_backups/, wipes, {answers.season !== "fix" ? "runs the season reset, " : ""}and starts again. Scheduled restarts are stopped while it runs.{"\n"}
              This cannot be undone.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <B c="red" onClick={runWipe}>START</B>
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
            <div className="ap-note success">✅ Wipe complete ({describeWipe(answers)}). Server is back up.</div>
            {results.length > 0 && (
              <div style={{
                background: "var(--bg)", border: "1px solid var(--border)", marginBottom: 12,
                padding: "12px 16px", fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.8, color: "var(--textdim)",
              }}>
                <div style={{ color: "var(--accent)", marginBottom: 4 }}>SEASON RESET</div>
                {results.map((r, i) => <div key={i}>• {r}</div>)}
              </div>
            )}
            {stopped.length > 0 && (
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", marginBottom: 12 }}>
                Restarts stopped for the wipe: {stopped.join(", ")}.
              </div>
            )}
            <B c="green" onClick={onClose}>Close</B>
          </>
        )}

        {phase === "failed" && (
          <>
            <div className="ap-note danger" style={{ whiteSpace: "pre-line" }}>⛔ {failMsg}</div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <B c="ghost" onClick={onClose}>Close</B>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const NuclearModal = ({ onClose }) => (
  <div className="ap-mbd" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="ap-mod" style={{ borderColor: "var(--red)" }}>
      <button className="ap-mod-x" onClick={onClose}>×</button>
      <h3 style={{ color: "var(--red)" }}>☢️ Nuclear Wipe</h3>
      <div className="ap-note danger" style={{ whiteSpace: "pre-line", lineHeight: 1.8 }}>
        ☢️ Nice try.{"\n\n"}
        Nuclear wipe requires direct SSH access to the server.{"\n"}
        If you actually need this, you already know what to do.{"\n"}
        We're not letting you accidentally nuke the server from a browser tab.
      </div>
      <B c="ghost" onClick={onClose}>Close</B>
    </div>
  </div>
);

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function SystemTab({ toast }) {
  const [status, setStatus]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [restarting, setRestarting] = useState({});
  const [answers, setAnswers]       = useState({});   // characters / season / settings — no defaults
  const [wipeModal, setWipeModal]   = useState(null); // "wipe" | "nuclear"
  const answered = QUESTIONS.every(q => answers[q.key]);

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

      {/* The one wipe */}
      <div className="ap-fb" style={{ marginBottom: 0 }}>
        <h4 style={{ fontFamily: "var(--display)", fontSize: 18, letterSpacing: 2, color: "var(--text)", margin: "0 0 16px 0" }}>SERVER WIPE</h4>
        <div className="ap-note danger" style={{ marginBottom: 20, lineHeight: 1.8 }}>
          One wipe, three questions — the same card Zombita shows in Discord. The map is always reset and the characters are
          always backed up first (Zomboid/wipe_backups/). Answer every row, then START. Nothing has a default.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {QUESTIONS.map(q => (
            <div key={q.key} style={{ background: "var(--bg)", border: "1px solid var(--border)", padding: 20,
                                       borderTop: `2px solid ${answers[q.key] ? "var(--accent)" : "var(--border)"}` }}>
              <div style={{ fontFamily: "var(--display)", fontSize: 16, letterSpacing: 2, color: "var(--accent)", marginBottom: 12 }}>{q.title}</div>
              <div style={{ display: "grid", gap: 8 }}>
                {q.options.map(([v, label, sub, color]) => (
                  <label key={v} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer",
                                          padding: "8px 10px", border: "1px solid var(--border)",
                                          background: answers[q.key] === v ? "rgba(200,168,75,0.08)" : "transparent" }}>
                    <input type="radio" name={`wipe-${q.key}`} value={v} checked={answers[q.key] === v}
                           onChange={() => setAnswers(a => ({ ...a, [q.key]: v }))} style={{ marginTop: 3 }} />
                    <span>
                      <b style={{ color: color || "var(--text)" }}>{label}</b>
                      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", lineHeight: 1.6 }}>{sub}</div>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 20, flexWrap: "wrap" }}>
          <B c="red" disabled={!answered} onClick={() => answered && setWipeModal("wipe")}>☠️ START</B>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", flex: 1 }}>
            {answered ? describeWipe(answers) : `Answer every row first (${QUESTIONS.filter(q => !answers[q.key]).map(q => q.title.toLowerCase()).join(", ")}).`}
          </div>
          <B c="ghost" onClick={() => setAnswers({})}>Clear answers</B>
          <B c="ghost" onClick={() => setWipeModal("nuclear")} title="SSH only. You know why.">☢️ Nuclear</B>
        </div>
      </div>

      {wipeModal === "wipe" && <WipeModal answers={answers} onClose={() => setWipeModal(null)} toast={toast} />}
      {wipeModal === "nuclear" && <NuclearModal onClose={() => setWipeModal(null)} />}
    </>
  );
}
