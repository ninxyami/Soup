"use client";
// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { fetchApi, postApi, Title, TW, B, Inp, TA, FB, Empty, Load, Toggle } from "./shared";

export default function ModsTab({ toast }) {
  const [sub, setSub] = useState("broadcast");
  const [bcastType, setBcastType] = useState("info"); const [bcastMsg, setBcastMsg] = useState("");
  const [mods, setMods] = useState([]); const [modsLoading, setModsLoading] = useState(true); const [newModId, setNewModId] = useState("");

  const loadMods = useCallback(async () => {
    try { const d = await fetchApi("/api/admin/mods/list"); setMods(d.mods || []); } catch { setMods([]); }
    setModsLoading(false);
  }, []);
  useEffect(() => { loadMods(); }, [loadMods]);

  const broadcast = async () => {
    if (!bcastMsg.trim()) { toast("Message required", "error"); return; }
    try { await postApi("/api/admin/server/broadcast", { type: bcastType, message: bcastMsg }); toast("Broadcast sent!", "success"); setBcastMsg(""); }
    catch (e) { toast(`Broadcast failed: ${e.message}`, "error"); }
  };
  const sendIngame = async () => {
    if (!bcastMsg.trim()) { toast("Message required", "error"); return; }
    try { await postApi("/api/admin/server/rcon", { command: `servermsg "${bcastMsg}"` }); toast("Sent to server!", "success"); }
    catch (e) { toast(e.message, "error"); }
  };
  const toggleMod = async (id, en) => { try { await postApi("/api/admin/mods/toggle", { workshop_id: id, enabled: en }); toast(en ? "Mod enabled" : "Mod disabled", "success"); loadMods(); } catch (e) { toast(`Failed: ${e.message}`, "error"); } };
  const addMod = async () => { if (!newModId.trim()) { toast("Workshop ID required", "error"); return; } try { await postApi("/api/admin/mods/add", { workshop_id: newModId.trim() }); toast("Mod added!", "success"); setNewModId(""); loadMods(); } catch (e) { toast(`Failed: ${e.message}`, "error"); } };
  const removeMod = async (id) => { if (!confirm(`Remove mod ${id}?`)) return; try { await postApi("/api/admin/mods/remove", { workshop_id: id }); toast("Mod removed", "success"); loadMods(); } catch (e) { toast(`Failed: ${e.message}`, "error"); } };

  const tabs = [{ key: "broadcast", icon: "📢", label: "Broadcast" }, { key: "modlist", icon: "🔧", label: "Mod List" }];
  const typeColors = { info: "var(--blue)", warning: "var(--orange)", alert: "var(--red)", event: "var(--accent)" };

  return (<>
    <Title t="MODS & BROADCAST" s="announcements · mod management" />
    <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>{tabs.map(t => <button key={t.key} className={`ap-ft ${sub === t.key ? "act" : ""}`} onClick={() => setSub(t.key)}>{t.icon} {t.label}</button>)}</div>

    {sub === "broadcast" && <div className="ap-2c">
      <FB title="BROADCAST TO DISCORD">
        <div className="ap-note">Sends an announcement to the Discord server.</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["info", "warning", "alert", "event"].map(type => (
            <button key={type} style={{ padding: "10px 20px", border: `2px solid ${bcastType === type ? typeColors[type] : "var(--border)"}`, background: bcastType === type ? `${typeColors[type]}11` : "transparent", color: bcastType === type ? typeColors[type] : "var(--textdim)", fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer", borderRadius: 2, transition: "all .15s" }} onClick={() => setBcastType(type)}>
              {{ info: "ℹ️", warning: "⚠️", alert: "🚨", event: "🎉" }[type]} {type}
            </button>
          ))}
        </div>
        <TA label="Message" placeholder="Type your announcement here..." value={bcastMsg} onChange={e => setBcastMsg(e.target.value)} />
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}><B c="gold" onClick={broadcast}>📢 Discord Broadcast</B><B c="blue" onClick={sendIngame}>💬 In-Game Msg</B></div>
      </FB>
      <FB title="QUICK MESSAGES">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {["Server restarting in 5 minutes", "Server restarting in 1 minute", "Maintenance starting soon", "Event starting! Check Discord!", "Server updated — please reconnect"].map((msg, i) => (
            <button key={i} className="ap-pre" style={{ textAlign: "left", padding: 10 }} onClick={() => setBcastMsg(msg)}>{msg}</button>
          ))}
        </div>
      </FB>
    </div>}

    {sub === "modlist" && <>
      <div className="ap-inline" style={{ marginBottom: 20 }}>
        <Inp label="Add Mod (Workshop ID)" placeholder="2895447475" value={newModId} onChange={e => setNewModId(e.target.value)} />
        <B c="green" onClick={addMod}>➕ Add Mod</B>
      </div>
      <TW title="SERVER MODS" right={<B c="ghost" sm onClick={loadMods}>↻</B>}>
        {modsLoading ? <Load /> : mods.length ? <table className="ap-t"><thead><tr><th>⚡</th><th>Name</th><th>Workshop ID</th><th>Actions</th></tr></thead>
          <tbody>{mods.map((m, i) => <tr key={i}>
            <td><Toggle on={m.enabled !== false} onClick={() => toggleMod(m.workshop_id, !m.enabled)} /></td>
            <td style={{ fontWeight: 500 }}>{m.name || "Unknown Mod"}</td>
            <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>{m.workshop_id}</td>
            <td><B c="red" sm onClick={() => removeMod(m.workshop_id)}>Remove</B></td>
          </tr>)}</tbody></table> : <Empty text="No mods loaded — endpoint may not exist yet" />}
      </TW>
    </>}
  </>);
}
