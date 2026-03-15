"use client";
// @ts-nocheck
import { useState, useEffect } from "react";
import {
  fetchApi, postApi, Section, FullSection, Card, FieldLabel,
  Toggle, Select, NumberInput, TextInput, SliderInput, Btn, SaveBar,
  ToggleField, SelectField, NumberField, SliderField,
} from "./shared";

const DEFAULT = {
  PVP: true, PVPLogToolChat: true, PVPLogToolFile: true,
  SafetySystem: true, ShowSafety: true, SafetyToggleTimer: 2, SafetyCooldownTimer: 3, SafetyDisconnectDelay: 60,
  PauseEmpty: true, GlobalChat: true, Open: true, AutoCreateUserInWhiteList: false,
  DisplayUserName: true, ShowFirstAndLastName: false,
  MaxPlayers: 32, PingLimit: 0,
  Public: false, PublicName: "My PZ Server", PublicDescription: "",
  DefaultPort: 16261, UDPPort: 16262,
  Password: "", MaxAccountsPerUser: 0, AllowCoop: true,
  PlayerSafehouse: false, AdminSafehouse: false,
  SafehouseAllowTrepass: true, SafehouseAllowFire: true, SafehouseAllowLoot: true,
  SafehouseAllowRespawn: false, SafehouseDaySurvivedToClaim: 0, SafeHouseRemovalTime: 144,
  SafehouseAllowNonResidential: false, SafehousePreventsLootRespawn: true,
  AllowDestructionBySledgehammer: true, SledgehammerOnlyInSafehouse: false,
  NoFire: false, AnnounceDeath: false, AnnounceAnimalDeath: false,
  DropOffWhiteListAfterDeath: false, TrashDeleteAll: false,
  PlayerRespawnWithSelf: false, PlayerRespawnWithOther: false,
  SleepAllowed: false, SleepNeeded: false,
  War: true, WarStartDelay: 600, WarDuration: 3600, WarSafehouseHitPoints: 3,
  Faction: true, FactionDaySurvivedToCreate: 0, FactionPlayersRequiredForTag: 1,
  VoiceEnable: true, VoiceMinDistance: 10.0, VoiceMaxDistance: 100.0, Voice3D: true,
  SteamVAC: true, SteamScoreboard: false,
  PVPMeleeDamageModifier: 30.0, PVPFirearmDamageModifier: 50.0,
  MouseOverToSeeDisplayName: true, HidePlayersBehindYou: true, PlayerBumpPlayer: false,
  MapRemotePlayerVisibility: 1,
  BackupsCount: 5, BackupsOnStart: true, BackupsOnVersionChange: true, BackupsPeriod: 0,
  AntiCheatSafety: 4, AntiCheatMovement: 4, AntiCheatHit: 4, AntiCheatPacket: 4,
  AntiCheatPermission: 4, AntiCheatXP: 4, AntiCheatFire: 4, AntiCheatSafeHouse: 4,
  AntiCheatRecipe: 4, AntiCheatChecksum: 4, AntiCheatItem: 4,
  ChatMessageCharacterLimit: 200, ChatMessageSlowModeTime: 3,
  SpeedLimit: 70.0, CarEngineAttractionModifier: 0.5,
  BloodSplatLifespanDays: 0, ItemNumbersLimitPerContainer: 0,
  SaveWorldEveryMinutes: 0, DisableVehicleTowing: false, DisableTrailerTowing: false,
  DisableBurntTowing: false, PerkLogs: true,
  ServerWelcomeMessage: "Welcome to Project Zomboid Multiplayer!",
};

// ── RCON Password Component ──────────────────────────────────────────────────
const RconPassword = ({ toast }) => {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orig, setOrig] = useState("");

  useEffect(() => {
    fetchApi("/api/admin/config/rcon-password").then(d => {
      setPw(d.password || "");
      setOrig(d.password || "");
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const save = async () => {
    if (!pw.trim()) { toast("RCON password cannot be empty", "error"); return; }
    setSaving(true);
    try {
      await postApi("/api/admin/config/rcon-password", { password: pw });
      setOrig(pw);
      toast("RCON password updated across all files! Restart server + API to apply.", "success");
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };

  const changed = pw !== orig;

  return (
    <div>
      <FieldLabel label="RCON Password" description="Changes ini + config.py + shared.py. Restart required." />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input
            type={show ? "text" : "password"}
            value={loaded ? pw : "Loading..."}
            onChange={e => setPw(e.target.value)}
            disabled={!loaded}
            style={{
              width: "100%", background: "var(--surface2)", border: `1px solid ${changed ? "var(--accent)" : "var(--border)"}`,
              color: "var(--text)", padding: "8px 10px", fontFamily: "var(--mono)", fontSize: 12, outline: "none",
              paddingRight: 36,
            }}
          />
          <button onClick={() => setShow(s => !s)} style={{
            position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", color: "var(--textdim)", cursor: "pointer",
            fontSize: 12, fontFamily: "var(--mono)",
          }}>{show ? "🙈" : "👁"}</button>
        </div>
        {changed && (
          <>
            <Btn color="ghost" sm onClick={() => setPw(orig)}>Reset</Btn>
            <Btn color="green" sm onClick={save} disabled={saving}>{saving ? "Saving..." : "💾 Save"}</Btn>
          </>
        )}
      </div>
      {changed && <div style={{ fontSize: 10, color: "var(--accent)", fontFamily: "var(--mono)", marginTop: 4 }}>⚠ Unsaved — will update servertest.ini, config.py, and shared.py</div>}
    </div>
  );
};

export default function ServerSettingsTab({ toast, currentUser }) {
  const [cfg, setCfg] = useState(DEFAULT);
  const [orig, setOrig] = useState(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(cfg) !== JSON.stringify(orig);

  useEffect(() => {
    fetchApi("/api/admin/server/config")
      .then(d => { const v = { ...DEFAULT, ...d }; setCfg(v); setOrig(v); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (key) => (val) => setCfg(p => ({ ...p, [key]: val }));

  const save = async () => {
    setSaving(true);
    try {
      const changes = Object.entries(cfg)
        .filter(([k, v]) => v !== orig[k])
        .map(([key, value]) => ({ key, value }));
      await postApi("/api/admin/config/ini", { changes, section: "server" });
      setOrig({ ...cfg });
      toast("Server settings saved! Restart required for some changes.", "success");
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };

  if (loading) return <div style={{ padding: 40, color: "var(--textdim)", fontFamily: "var(--mono)" }}>Loading server config...</div>;

  const anticheatOpts = [
    { value: 1, label: "1 — Disabled" },
    { value: 2, label: "2 — Low" },
    { value: 3, label: "3 — Medium" },
    { value: 4, label: "4 — High (Default)" },
  ];

  return (
    <>
      <div style={{ fontFamily: "var(--display)", fontSize: 36, letterSpacing: 4, color: "var(--accent)", marginBottom: 4 }}>SERVER SETTINGS</div>
      <div style={{ color: "var(--textdim)", fontSize: 12, marginBottom: 28, fontFamily: "var(--mono)" }}>servertest.ini · multiplayer · safety · access · backups</div>

      {/* PVP */}
      <Section title="PVP & COMBAT" sub="player vs player rules and damage modifiers">
        <ToggleField label="PVP Enabled" description="Players can hurt and kill each other" value={cfg.PVP} onChange={set("PVP")} />
        <ToggleField label="Safety System" description="Players can individually toggle PVP mode" value={cfg.SafetySystem} onChange={set("SafetySystem")} />
        <ToggleField label="Show Safety Status" description="Skull icon over players in PVP mode" value={cfg.ShowSafety} onChange={set("ShowSafety")} />
        <NumberField label="Safety Toggle Timer (sec)" description="Time to enter/leave PVP mode" value={cfg.SafetyToggleTimer} onChange={set("SafetyToggleTimer")} min={0} max={1000} />
        <NumberField label="Safety Cooldown (sec)" description="Delay before toggling PVP again" value={cfg.SafetyCooldownTimer} onChange={set("SafetyCooldownTimer")} min={0} max={1000} />
        <NumberField label="Safety Disconnect Delay (sec)" value={cfg.SafetyDisconnectDelay} onChange={set("SafetyDisconnectDelay")} min={0} max={60} />
      </Section>

      <Section title="PVP DAMAGE" sub="damage multipliers for PVP hits">
        <SliderField label="PVP Melee Damage %" description="Multiplier for melee hits on players" value={cfg.PVPMeleeDamageModifier} onChange={set("PVPMeleeDamageModifier")} min={0} max={500} step={5} accent="var(--orange)" />
        <SliderField label="PVP Ranged Damage %" description="Multiplier for firearm hits on players" value={cfg.PVPFirearmDamageModifier} onChange={set("PVPFirearmDamageModifier")} min={0} max={500} step={5} accent="var(--red)" />
        <ToggleField label="Melee While Hit Reaction" description="Can hit again while being struck" value={cfg.PVPMeleeWhileHitReaction || false} onChange={set("PVPMeleeWhileHitReaction")} />
      </Section>

      {/* SERVER ACCESS */}
      <Section title="SERVER ACCESS" sub="who can join, player limits, passwords">
        <ToggleField label="Open Server" description="Players can join without whitelist approval" value={cfg.Open} onChange={set("Open")} />
        <ToggleField label="Auto-Create Whitelist Users" description="New players auto-added to whitelist on join" value={cfg.AutoCreateUserInWhiteList} onChange={set("AutoCreateUserInWhiteList")} />
        <NumberField label="Max Players" description="Maximum concurrent players (excl. admins)" value={cfg.MaxPlayers} onChange={set("MaxPlayers")} min={1} max={100} />
        <NumberField label="Ping Limit (ms)" description="0 = disabled" value={cfg.PingLimit} onChange={set("PingLimit")} min={0} />
        <NumberField label="Max Accounts Per User" description="0 = unlimited" value={cfg.MaxAccountsPerUser} onChange={set("MaxAccountsPerUser")} min={0} />
        <ToggleField label="Allow Co-op / Split Screen" value={cfg.AllowCoop} onChange={set("AllowCoop")} />
      </Section>

      <Section title="SERVER IDENTITY" sub="name, description, public visibility">
        <ToggleField label="Public Server" description="Visible in the in-game server browser" value={cfg.Public} onChange={set("Public")} />
        <ToggleField label="Steam Scoreboard" description="Show Steam usernames and avatars in player list" value={cfg.SteamScoreboard} onChange={set("SteamScoreboard")} />
        <ToggleField label="Steam VAC" description="Enable Valve Anti-Cheat" value={cfg.SteamVAC} onChange={set("SteamVAC")} />
      </Section>

      <FullSection title="SERVER NAME & DESCRIPTION">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Card>
            <FieldLabel label="Public Name" />
            <TextInput value={cfg.PublicName} onChange={set("PublicName")} placeholder="My PZ Server" />
          </Card>
          <Card>
            <FieldLabel label="Password (leave blank for none)" />
            <TextInput value={cfg.Password} onChange={set("Password")} placeholder="(no password)" />
          </Card>
          <Card>
            <RconPassword toast={toast} />
          </Card>
        </div>
        <Card>
          <FieldLabel label="Welcome Message" description="Shown in chat when players join. Use <LINE> for line breaks." />
          <textarea value={cfg.ServerWelcomeMessage} onChange={e => set("ServerWelcomeMessage")(e.target.value)}
            style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 10px", fontFamily: "var(--mono)", fontSize: 12, resize: "vertical", minHeight: 80, outline: "none" }}
          />
        </Card>
      </FullSection>

      {/* SAFEHOUSES */}
      <Section title="SAFEHOUSES" sub="claiming, permissions, and protection">
        <ToggleField label="Player Safehouses" description="Players can claim safehouses" value={cfg.PlayerSafehouse} onChange={set("PlayerSafehouse")} />
        <ToggleField label="Admin Safehouses Only" description="Only admins can claim safehouses" value={cfg.AdminSafehouse} onChange={set("AdminSafehouse")} />
        <ToggleField label="Allow Non-Residential" description="Players can claim non-residential buildings" value={cfg.SafehouseAllowNonResidential} onChange={set("SafehouseAllowNonResidential")} />
        <ToggleField label="Allow Trespass" description="Non-members can enter safehouses uninvited" value={cfg.SafehouseAllowTrepass} onChange={set("SafehouseAllowTrepass")} />
        <ToggleField label="Allow Fire Damage" description="Fire can damage safehouses" value={cfg.SafehouseAllowFire} onChange={set("SafehouseAllowFire")} />
        <ToggleField label="Allow Looting" description="Non-members can take items" value={cfg.SafehouseAllowLoot} onChange={set("SafehouseAllowLoot")} />
        <ToggleField label="Allow Respawn in Safehouse" description="Dead players respawn in their safehouse" value={cfg.SafehouseAllowRespawn} onChange={set("SafehouseAllowRespawn")} />
        <ToggleField label="Safehouse Prevents Loot Respawn" value={cfg.SafehousePreventsLootRespawn} onChange={set("SafehousePreventsLootRespawn")} />
        <NumberField label="Days Survived to Claim" description="Minimum in-game days before claiming" value={cfg.SafehouseDaySurvivedToClaim} onChange={set("SafehouseDaySurvivedToClaim")} min={0} />
        <NumberField label="Safehouse Removal Time (hours)" description="Hours of no visits before auto-removal" value={cfg.SafeHouseRemovalTime} onChange={set("SafeHouseRemovalTime")} min={0} />
      </Section>

      {/* WORLD PROTECTION */}
      <Section title="WORLD & FIRE" sub="destruction, fire, and corpse rules">
        <ToggleField label="Allow Sledgehammer Destruction" description="Players can destroy world objects" value={cfg.AllowDestructionBySledgehammer} onChange={set("AllowDestructionBySledgehammer")} />
        <ToggleField label="Sledgehammer Only in Safehouse" value={cfg.SledgehammerOnlyInSafehouse} onChange={set("SledgehammerOnlyInSafehouse")} />
        <ToggleField label="No Fire" description="All fire disabled except campfires" value={cfg.NoFire} onChange={set("NoFire")} />
        <ToggleField label="Announce Death" description="Global message when a player dies" value={cfg.AnnounceDeath} onChange={set("AnnounceDeath")} />
        <ToggleField label="Announce Animal Death" value={cfg.AnnounceAnimalDeath} onChange={set("AnnounceAnimalDeath")} />
        <NumberField label="Blood Splat Lifespan (days)" description="0 = never disappear" value={cfg.BloodSplatLifespanDays} onChange={set("BloodSplatLifespanDays")} min={0} max={365} />
        <ToggleField label="Delete All from Trash Bins" value={cfg.TrashDeleteAll} onChange={set("TrashDeleteAll")} />
      </Section>

      {/* WAR */}
      <Section title="WAR MODE" sub="scheduled PVP war events">
        <ToggleField label="War Enabled" value={cfg.War} onChange={set("War")} />
        <NumberField label="War Start Delay (sec)" description="Countdown before war begins" value={cfg.WarStartDelay} onChange={set("WarStartDelay")} min={60} />
        <NumberField label="War Duration (sec)" description="How long the war lasts (3600 = 1 hour)" value={cfg.WarDuration} onChange={set("WarDuration")} min={60} />
        <NumberField label="Safehouse HP During War" description="Hit points before a safehouse falls" value={cfg.WarSafehouseHitPoints} onChange={set("WarSafehouseHitPoints")} min={0} />
      </Section>

      {/* FACTIONS */}
      <Section title="FACTIONS" sub="player group management">
        <ToggleField label="Factions Enabled" value={cfg.Faction} onChange={set("Faction")} />
        <NumberField label="Days to Create Faction" description="In-game days before faction creation" value={cfg.FactionDaySurvivedToCreate} onChange={set("FactionDaySurvivedToCreate")} min={0} />
        <NumberField label="Players for Faction Tag" description="Members needed before tag can be created" value={cfg.FactionPlayersRequiredForTag} onChange={set("FactionPlayersRequiredForTag")} min={1} />
      </Section>

      {/* CHAT & VOIP */}
      <Section title="CHAT & VOIP" sub="communication settings">
        <ToggleField label="Global Chat" description="Server-wide /all chat channel" value={cfg.GlobalChat} onChange={set("GlobalChat")} />
        <ToggleField label="VOIP Enabled" value={cfg.VoiceEnable} onChange={set("VoiceEnable")} />
        <ToggleField label="3D Directional VOIP" value={cfg.Voice3D} onChange={set("Voice3D")} />
        <NumberField label="VOIP Min Distance (tiles)" value={cfg.VoiceMinDistance} onChange={set("VoiceMinDistance")} min={0} max={100000} step={1} />
        <NumberField label="VOIP Max Distance (tiles)" value={cfg.VoiceMaxDistance} onChange={set("VoiceMaxDistance")} min={0} max={100000} step={10} />
        <NumberField label="Chat Message Character Limit" value={cfg.ChatMessageCharacterLimit} onChange={set("ChatMessageCharacterLimit")} min={64} max={1024} />
        <NumberField label="Chat Slow Mode (sec)" description="Seconds between messages" value={cfg.ChatMessageSlowModeTime} onChange={set("ChatMessageSlowModeTime")} min={1} max={30} />
      </Section>

      {/* PLAYERS */}
      <Section title="PLAYER VISIBILITY" sub="what players can see about each other">
        <ToggleField label="Display Username Above Head" value={cfg.DisplayUserName} onChange={set("DisplayUserName")} />
        <ToggleField label="Show First & Last Name" value={cfg.ShowFirstAndLastName} onChange={set("ShowFirstAndLastName")} />
        <ToggleField label="Mouse-over to See Name" description="Must hover to reveal player name" value={cfg.MouseOverToSeeDisplayName} onChange={set("MouseOverToSeeDisplayName")} />
        <ToggleField label="Hide Players Behind You" value={cfg.HidePlayersBehindYou} onChange={set("HidePlayersBehindYou")} />
        <ToggleField label="Player Bump (collide when running)" value={cfg.PlayerBumpPlayer} onChange={set("PlayerBumpPlayer")} />
        <SelectField label="Map — Remote Player Visibility"
          value={cfg.MapRemotePlayerVisibility} onChange={set("MapRemotePlayerVisibility")}
          options={[{ value: 1, label: "Hidden" }, { value: 2, label: "Friends" }, { value: 3, label: "Everyone" }]} />
      </Section>

      {/* RESPAWN & SLEEP */}
      <Section title="RESPAWN & SLEEP" sub="death and sleep mechanics">
        <ToggleField label="Sleep Allowed" value={cfg.SleepAllowed} onChange={set("SleepAllowed")} />
        <ToggleField label="Sleep Required" description="Players must sleep when tired" value={cfg.SleepNeeded} onChange={set("SleepNeeded")} />
        <ToggleField label="Respawn at Death Location" value={cfg.PlayerRespawnWithSelf} onChange={set("PlayerRespawnWithSelf")} />
        <ToggleField label="Respawn at Co-op Partner" value={cfg.PlayerRespawnWithOther} onChange={set("PlayerRespawnWithOther")} />
        <ToggleField label="Drop from Whitelist on Death" value={cfg.DropOffWhiteListAfterDeath} onChange={set("DropOffWhiteListAfterDeath")} />
      </Section>

      {/* ANTI-CHEAT */}
      <Section title="ANTI-CHEAT" sub="protection levels (1=off, 4=high) — set high unless you have issues">
        {[
          ["AntiCheatSafety","Safety"], ["AntiCheatMovement","Movement"], ["AntiCheatHit","Hit Detection"],
          ["AntiCheatPacket","Packets"], ["AntiCheatPermission","Permissions"], ["AntiCheatXP","XP"],
          ["AntiCheatFire","Fire"], ["AntiCheatSafeHouse","Safehouses"], ["AntiCheatRecipe","Recipes"],
          ["AntiCheatChecksum","Checksums"], ["AntiCheatItem","Items"],
        ].map(([key, label]) => (
          <SelectField key={key} label={label} value={cfg[key]} onChange={set(key)} options={anticheatOpts} />
        ))}
      </Section>

      {/* VEHICLES */}
      <Section title="VEHICLES" sub="driving and towing settings">
        <NumberField label="Speed Limit (km/h)" value={cfg.SpeedLimit} onChange={set("SpeedLimit")} min={10} max={150} step={5} />
        <SliderField label="Car Engine Zombie Attraction" description="Lower = less zombies chasing cars" value={cfg.CarEngineAttractionModifier} onChange={set("CarEngineAttractionModifier")} min={0} max={10} step={0.1} />
        <ToggleField label="Disable Vehicle Towing" value={cfg.DisableVehicleTowing} onChange={set("DisableVehicleTowing")} />
        <ToggleField label="Disable Trailer Towing" value={cfg.DisableTrailerTowing} onChange={set("DisableTrailerTowing")} />
        <ToggleField label="Disable Burnt Vehicle Towing" value={cfg.DisableBurntTowing} onChange={set("DisableBurntTowing")} />
      </Section>

      {/* BACKUPS */}
      <Section title="AUTO-BACKUPS" sub="server save backups">
        <NumberField label="Backup Count" description="Number of backups to keep" value={cfg.BackupsCount} onChange={set("BackupsCount")} min={1} max={300} />
        <ToggleField label="Backup on Server Start" value={cfg.BackupsOnStart} onChange={set("BackupsOnStart")} />
        <ToggleField label="Backup on Version Change" value={cfg.BackupsOnVersionChange} onChange={set("BackupsOnVersionChange")} />
        <NumberField label="Backup Period (min)" description="0 = only on start/version change" value={cfg.BackupsPeriod} onChange={set("BackupsPeriod")} min={0} max={1500} />
        <NumberField label="Auto-Save World (min)" description="0 = only on player leave" value={cfg.SaveWorldEveryMinutes} onChange={set("SaveWorldEveryMinutes")} min={0} />
        <ToggleField label="Perk Logs" description="Track perk changes in server logs" value={cfg.PerkLogs} onChange={set("PerkLogs")} />
      </Section>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => setCfg({ ...orig })} label="Unsaved server setting changes" />
    </>
  );
}
