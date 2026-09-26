"use client";
// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { API, fetchApi, postApi, Title, B, FB, Inp, Load } from "./shared";

const OnlinePlayers = () => {
  const [data, setData] = useState(null);
  const load = useCallback(async () => {
    try { setData(await fetchApi("/api/admin/server/online-players")); }
    catch { setData({ players: [], count: 0 }); }
  }, []);
  useEffect(() => { load(); const iv = setInterval(load, 30000); return () => clearInterval(iv); }, [load]);

  return (
    <div className="ap-tw" style={{ marginTop: 24 }}>
      <div className="ap-tw-h">
        <h3>👥 ONLINE PLAYERS</h3>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>auto-refresh 30s</span>
        <B c="ghost" sm onClick={load}>↻</B>
      </div>
      {data === null ? <Load /> : data.count === 0
        ? <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--textdim)", padding: "16px 0" }}>😴 No survivors online right now</div>
        : <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 0" }}>
            {data.players.map((name, i) => (
              <span key={i} style={{ fontFamily: "var(--mono)", fontSize: 12, background: "var(--surface2)", border: "1px solid var(--border)", padding: "4px 12px", borderRadius: 2, color: "var(--green)" }}>
                🧟 {name}
              </span>
            ))}
          </div>
      }
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)", marginTop: 4 }}>
        {data ? `${data.count} survivor${data.count !== 1 ? "s" : ""} in the zone` : ""}
      </div>
    </div>
  );
};

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
  const quickCmds = [
    { label: "Players", cmd: "players" }, { label: "Save", cmd: "save" },
    { label: "Chopper", cmd: "chopper" }, { label: "Gunshot", cmd: "gunshot" },
    { label: "Start Rain", cmd: "startrain" }, { label: "Stop Rain", cmd: "stoprain" },
  ];
  return (
    <FB title="RCON CONSOLE">
      <div className="ap-note danger">⚠ Direct RCON. Commands sent to game server as-is.</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {quickCmds.map((q, i) => <button key={i} className="ap-pre" onClick={() => setCmd(q.cmd)}>{q.label}</button>)}
      </div>
      <div className="ap-inline">
        <Inp placeholder="type RCON command..." value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={e => { if (e.key === "Enter") runCmd(); }} />
        <B c="gold" onClick={runCmd}>Execute</B>
      </div>
      <div className="ap-term" ref={termRef} style={{ marginTop: 16 }}>
        {termLog.length === 0
          ? <div className="ap-term-line" style={{ color: "var(--muted)" }}>// terminal ready</div>
          : termLog.map((l, i) => <div key={i} className={`ap-term-line ${l.type}`}>{l.text}</div>)}
      </div>
    </FB>
  );
};

const GiveItemPanel = ({ toast }) => {
  const [player, setPlayer] = useState(""); const [itemId, setItemId] = useState(""); const [count, setCount] = useState("1");
  const give = async () => {
    if (!player || !itemId) { toast("Player and item required", "error"); return; }
    try { await postApi("/api/admin/server/rcon", { command: `additem "${player}" "${itemId}" ${count || 1}` }); toast(`Gave ${count}x ${itemId} to ${player}`, "success"); }
    catch (e) { toast(`Failed: ${e.message}`, "error"); }
  };
  const presets = [
    { label: "Katana", id: "Base.Katana" }, { label: "Axe", id: "Base.Axe" },
    { label: "Shotgun", id: "Base.Shotgun" }, { label: "Antibiotics", id: "Base.Antibiotics" },
    { label: "Generator", id: "Base.Generator" }, { label: "Gas Can", id: "Base.PetrolCan" },
    { label: "Sledgehammer", id: "Base.Sledgehammer" }, { label: "First Aid Kit", id: "Base.FirstAidKit" },
  ];
  return (
    <div className="ap-2c">
      <FB title="GIVE ITEM">
        <div className="ap-note">Player must be online. Uses RCON additem command.</div>
        <Inp label="Player (exact in-game name)" placeholder="SurvivorDave" value={player} onChange={e => setPlayer(e.target.value)} />
        <Inp label="Item ID" placeholder="Base.Katana" value={itemId} onChange={e => setItemId(e.target.value)} />
        <Inp label="Count" type="number" value={count} onChange={e => setCount(e.target.value)} />
        <B c="gold" onClick={give}>🎁 Give Item</B>
      </FB>
      <FB title="ITEM PRESETS">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {presets.map((p, i) => (
            <button key={i} className="ap-pre" style={{ padding: "8px 12px", textAlign: "left" }} onClick={() => setItemId(p.id)}>
              {p.label}<br /><span style={{ color: "var(--textdim)", fontSize: 9 }}>{p.id}</span>
            </button>
          ))}
        </div>
      </FB>
    </div>
  );
};

export default function ServerTab({ toast }) {
  const [sub, setSub] = useState("status");
  const [serverUp, setServerUp] = useState(null);
  const [statusDetail, setStatusDetail] = useState(null);
  const [termLog, setTermLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");

  const addLog = (text, type = "ok") => setTermLog(prev => [...prev.slice(-49), { text, type }]);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetchApi("/api/admin/server/status");
      setServerUp(res.running);
      setStatusDetail(res);
    } catch {
      try {
        const r = await fetch(`${API}/health`, { credentials: "include" });
        setServerUp(r.ok ? null : false);
        setStatusDetail(null);
      } catch {
        setServerUp(false);
        setStatusDetail(null);
      }
    }
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  const serverAction = async (action) => {
    setLoading(true);
    addLog(`> server ${action}`, "cmd");
    try {
      const res = await postApi(`/api/admin/server/${action}`, {});
      addLog(res.message || res.response || "OK", "ok");
      toast(`${action} sent`, "success");
      setTimeout(checkStatus, 3000);
    } catch (e) {
      addLog(`ERROR: ${e.message}`, "err");
      toast(`Failed: ${e.message}`, "error");
    }
    setLoading(false);
  };

  const sendBroadcast = async (msg) => {
    if (!msg.trim()) return;
    try { await postApi("/api/admin/server/broadcast", { message: msg }); toast("Broadcast sent!", "success"); setBroadcastMsg(""); }
    catch (e) { toast(e.message, "error"); }
  };

  const tabs = [
    { key: "status", icon: "📡", label: "Status" },
    { key: "controls", icon: "⚙️", label: "Controls" },
    { key: "rcon", icon: "💻", label: "RCON" },
    { key: "items", icon: "🎁", label: "Give Items" },
  ];

  const statusColor = serverUp === true ? "var(--green)" : serverUp === false ? "var(--red)" : "var(--textdim)";
  const statusText = serverUp === true ? "ONLINE" : serverUp === false ? "OFFLINE" : "UNKNOWN";
  const dotClass = serverUp === true ? "running" : serverUp === false ? "stopped" : "unknown";

  return (<>
    <Title t="SERVER ADMIN" s="status · rcon · player management" />
    <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
      {tabs.map(t => <button key={t.key} className={`ap-ft ${sub === t.key ? "act" : ""}`} onClick={() => setSub(t.key)}>{t.icon} {t.label}</button>)}
    </div>

    {sub === "status" && <>
      <div className="ap-sr" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <div className="ap-sc" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div className={`ap-srv-dot ${dotClass}`} />
          <div>
            <div className="ap-sc-l">Game Server (PZ)</div>
            <div style={{ fontFamily: "var(--display)", fontSize: 24, letterSpacing: 2, color: statusColor }}>{statusText}</div>
            {statusDetail?.uptime && <div className="ap-sc-s">Up {statusDetail.uptime}</div>}
          </div>
        </div>
        <div className="ap-sc green">
          <div className="ap-sc-l">Bot API</div>
          <div className="ap-sc-v">ONLINE</div>
          <div className="ap-sc-s">api.stateofundeadpurge.site</div>
        </div>
        <div className="ap-sc blue" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <B c="ghost" sm onClick={checkStatus}>↻ Refresh</B>
        </div>
      </div>

      <OnlinePlayers />

      {termLog.length > 0 && (
        <FB title="LOG">
          <div className="ap-term">{termLog.map((l, i) => <div key={i} className={`ap-term-line ${l.type}`}>{l.text}</div>)}</div>
        </FB>
      )}
    </>}

    {sub === "controls" && <div className="ap-2c">
      <FB title="SERVER CONTROLS">
        <div className="ap-note danger">⚠ These directly affect the live server. Players will be disconnected during restart/stop.</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <B c="green" disabled={loading} onClick={() => serverAction("start")}>▶ Start</B>
          <B c="red" disabled={loading} onClick={() => serverAction("stop")}>■ Stop</B>
          <B c="orange" disabled={loading} onClick={() => serverAction("restart")}>🔄 Restart</B>
          <B c="blue" disabled={loading} onClick={() => serverAction("save")}>💾 Save World</B>
        </div>
        {termLog.length > 0 && (
          <div className="ap-term" style={{ marginTop: 16 }}>
            {termLog.map((l, i) => <div key={i} className={`ap-term-line ${l.type}`}>{l.text}</div>)}
          </div>
        )}
      </FB>
      <FB title="BROADCAST">
        <div className="ap-note">Sends a visible message to all online players.</div>
        <Inp
          label="Custom message"
          placeholder="Server restarting in 5 minutes..."
          value={broadcastMsg}
          onChange={e => setBroadcastMsg(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") sendBroadcast(broadcastMsg); }}
        />
        <B c="gold" full onClick={() => sendBroadcast(broadcastMsg)}>📢 Send Broadcast</B>
        <div style={{ marginTop: 16 }}>
          <div className="ap-sc-l" style={{ marginBottom: 8 }}>QUICK MESSAGES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {["Server restarting in 5 minutes", "Server restarting in 1 minute", "Maintenance starting soon", "Event starting! Check Discord!"].map((msg, i) => (
              <button key={i} className="ap-pre" style={{ textAlign: "left", padding: 10 }} onClick={() => sendBroadcast(msg)}>{msg}</button>
            ))}
          </div>
        </div>
      </FB>
    </div>}

    {sub === "rcon" && <RconConsole toast={toast} addLog={addLog} termLog={termLog} />}
    {sub === "items" && <GiveItemPanel toast={toast} />}
  </>);
}
