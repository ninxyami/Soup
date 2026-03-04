"use client";
// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { API, fetchApi, postApi, Title, B, FB, Inp, Load } from "./shared";

const RconConsole = ({ toast, addLog, termLog }) => {
  const [cmd, setCmd] = useState("");
  const termRef = useRef(null);
  useEffect(() => { if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight; }, [termLog]);
  const runCmd = async () => {
    if (!cmd.trim()) return;
    addLog(`> ${cmd}`, "cmd");
    try { const res = await postApi("/api/admin/server/rcon", { command: cmd }); addLog(res.response || "OK", "ok"); }
    catch (e) { addLog(`ERROR: ${e.message}`, "err"); }
    setCmd("");
  };
  const quickCmds = [{ label: "Players", cmd: "players" }, { label: "Save", cmd: "save" }, { label: "Chopper", cmd: "chopper" }, { label: "Gunshot", cmd: "gunshot" }, { label: "Start Rain", cmd: "startrain" }, { label: "Stop Rain", cmd: "stoprain" }];
  return (<FB title="RCON CONSOLE">
    <div className="ap-note danger">⚠ Direct RCON. Commands sent to game server as-is.</div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>{quickCmds.map((q, i) => <button key={i} className="ap-pre" onClick={() => setCmd(q.cmd)}>{q.label}</button>)}</div>
    <div className="ap-inline"><Inp placeholder="type RCON command..." value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={e => { if (e.key === "Enter") runCmd(); }} /><B c="gold" onClick={runCmd}>Execute</B></div>
    <div className="ap-term" ref={termRef} style={{ marginTop: 16 }}>
      {termLog.length === 0 ? <div className="ap-term-line" style={{ color: "var(--muted)" }}>// terminal ready</div> : termLog.map((l, i) => <div key={i} className={`ap-term-line ${l.type}`}>{l.text}</div>)}
    </div>
  </FB>);
};

const GiveItemPanel = ({ toast }) => {
  const [player, setPlayer] = useState(""); const [itemId, setItemId] = useState(""); const [count, setCount] = useState("1");
  const give = async () => {
    if (!player || !itemId) { toast("Player and item required", "error"); return; }
    try { await postApi("/api/admin/server/rcon", { command: `additem "${player}" "${itemId}" ${count || 1}` }); toast(`Gave ${count}x ${itemId} to ${player}`, "success"); }
    catch (e) { toast(`Failed: ${e.message}`, "error"); }
  };
  const presets = [{ label: "Katana", id: "Base.Katana" }, { label: "Axe", id: "Base.Axe" }, { label: "Shotgun", id: "Base.Shotgun" }, { label: "Antibiotics", id: "Base.Antibiotics" }, { label: "Generator", id: "Base.Generator" }, { label: "Gas Can", id: "Base.PetrolCan" }, { label: "Sledgehammer", id: "Base.Sledgehammer" }, { label: "First Aid Kit", id: "Base.FirstAidKit" }];
  return (<div className="ap-2c">
    <FB title="GIVE ITEM">
      <div className="ap-note">Player must be online. Uses RCON additem command.</div>
      <Inp label="Player (exact in-game name)" placeholder="SurvivorDave" value={player} onChange={e => setPlayer(e.target.value)} />
      <Inp label="Item ID" placeholder="Base.Katana" value={itemId} onChange={e => setItemId(e.target.value)} />
      <Inp label="Count" type="number" value={count} onChange={e => setCount(e.target.value)} />
      <B c="gold" onClick={give}>🎁 Give Item</B>
    </FB>
    <FB title="ITEM PRESETS">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{presets.map((p, i) => <button key={i} className="ap-pre" style={{ padding: "8px 12px", textAlign: "left" }} onClick={() => setItemId(p.id)}>{p.label}<br /><span style={{ color: "var(--textdim)", fontSize: 9 }}>{p.id}</span></button>)}</div>
    </FB>
  </div>);
};

export default function ServerTab({ toast }) {
  const [sub, setSub] = useState("status");
  const [serverUp, setServerUp] = useState(null);
  const [termLog, setTermLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const addLog = (text, type = "ok") => setTermLog(prev => [...prev.slice(-49), { text, type }]);

  const checkHealth = useCallback(async () => {
    try { const r = await fetch(`${API}/health`, { credentials: "include" }); setServerUp(r.ok); }
    catch { setServerUp(false); }
  }, []);
  useEffect(() => { checkHealth(); }, [checkHealth]);

  const serverAction = async (action) => {
    setLoading(true); addLog(`> ${action}`, "cmd");
    try { const res = await postApi(`/api/admin/server/${action}`, {}); addLog(res.message || res.response || "OK", "ok"); toast(`${action} complete`, "success"); }
    catch (e) { addLog(`ERROR: ${e.message}`, "err"); toast(`Failed: ${e.message}`, "error"); }
    setLoading(false);
  };

  const tabs = [{ key: "status", icon: "📡", label: "Status" }, { key: "controls", icon: "⚙️", label: "Controls" }, { key: "rcon", icon: "💻", label: "RCON" }, { key: "items", icon: "🎁", label: "Give Items" }];

  return (<>
    <Title t="SERVER ADMIN" s="status · rcon · player management" />
    <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>{tabs.map(t => <button key={t.key} className={`ap-ft ${sub === t.key ? "act" : ""}`} onClick={() => setSub(t.key)}>{t.icon} {t.label}</button>)}</div>

    {sub === "status" && <>
      <div className="ap-sr" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <div className="ap-sc" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div className={`ap-srv-dot ${serverUp === true ? "running" : serverUp === false ? "stopped" : "unknown"}`} />
          <div>
            <div className="ap-sc-l">Game Server</div>
            <div style={{ fontFamily: "var(--display)", fontSize: 24, letterSpacing: 2, color: serverUp ? "var(--green)" : serverUp === false ? "var(--red)" : "var(--textdim)" }}>
              {serverUp === true ? "ONLINE" : serverUp === false ? "OFFLINE" : "CHECKING..."}
            </div>
          </div>
        </div>
        <div className="ap-sc green">
          <div className="ap-sc-l">Bot API</div>
          <div className="ap-sc-v">ONLINE</div>
          <div className="ap-sc-s">api.stateofundeadpurge.site</div>
        </div>
        <div className="ap-sc blue" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <B c="ghost" sm onClick={checkHealth}>↻ Refresh</B>
        </div>
      </div>
      <div className="ap-note info">ℹ Server start/stop/restart controls require additional VPS endpoints to be set up.</div>
    </>}

    {sub === "controls" && <div className="ap-2c">
      <FB title="SERVER CONTROLS">
        <div className="ap-note danger">⚠ These directly affect the live server. Players will be disconnected during restart/stop.</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <B c="orange" disabled={loading} onClick={() => serverAction("restart")}>🔄 Restart</B>
          <B c="blue" disabled={loading} onClick={() => serverAction("save")}>💾 Save World</B>
        </div>
      </FB>
      <FB title="QUICK BROADCASTS">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {["Server restarting in 5 minutes", "Server restarting in 1 minute", "Maintenance starting soon", "Event starting! Check Discord!"].map((msg, i) => (
            <button key={i} className="ap-pre" style={{ textAlign: "left", padding: 10 }} onClick={async () => { try { await postApi("/api/admin/server/broadcast", { message: msg }); toast("Sent!", "success"); } catch (e) { toast(e.message, "error"); } }}>{msg}</button>
          ))}
        </div>
      </FB>
      {termLog.length > 0 && <div style={{ gridColumn: "1/-1" }}><FB title="TERMINAL"><div className="ap-term">{termLog.map((l, i) => <div key={i} className={`ap-term-line ${l.type}`}>{l.text}</div>)}</div></FB></div>}
    </div>}

    {sub === "rcon" && <RconConsole toast={toast} addLog={addLog} termLog={termLog} />}
    {sub === "items" && <GiveItemPanel toast={toast} />}
  </>);
}
