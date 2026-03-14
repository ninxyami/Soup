"use client";
// @ts-nocheck
import { useState, useEffect } from "react";
import {
  fetchApi, postApi, Section, Card, FieldLabel, Btn, SaveBar,
  ToggleField, SelectField, NumberField, SliderField, FREQ_6, SPEED_6,
} from "./shared";

const DEFAULT = {
  // Population
  Zombies: 4, Distribution: 1, ZombieVoronoiNoise: true,
  ZombieRespawn: 2, ZombieMigrate: true,
  // ZombieLore
  Speed: 4, SprinterPercentage: 1, Strength: 4, Toughness: 4,
  Transmission: 2, Mortality: 5, Reanimate: 3,
  Cognition: 3, DoorOpeningPercentage: 33, CrawlUnderVehicle: 5,
  Memory: 2, Sight: 5, Hearing: 5,
  SpottedLogic: true, ThumpNoChasing: false, ThumpOnConstruction: true,
  ActiveOnly: 1, TriggerHouseAlarm: true, ZombiesDragDown: true,
  ZombiesCrawlersDragDown: false, ZombiesFenceLunge: true,
  ZombiesArmorFactor: 1.0, ZombiesMaxDefense: 70,
  ChanceOfAttachedWeapon: 12, ZombiesFallDamage: 1.0,
  DisableFakeDead: 1, PlayerSpawnZombieRemoval: 1,
  FenceThumpersRequired: 50, FenceDamageMultiplier: 1.0,
  // ZombieConfig
  PopulationMultiplier: 0.65, PopulationStartMultiplier: 0.75,
  PopulationPeakMultiplier: 1.75, PopulationPeakDay: 32,
  RespawnHours: 240.0, RespawnUnseenHours: 240.0, RespawnMultiplier: 0.75,
  RedistributeHours: 24.0, FollowSoundDistance: 100,
  RallyGroupSize: 20, RallyGroupSizeVariance: 50,
  RallyTravelDistance: 20, RallyGroupSeparation: 25, RallyGroupRadius: 3,
  ZombiesCountBeforeDelete: 300,
};

// Visual population preview
const ZombiePopPreview = ({ pop, start, peak, peakDay }) => {
  const points = Array.from({ length: 8 }, (_, i) => {
    const day = peakDay * (i / 7);
    const t = day / peakDay;
    const mult = t < 1 ? start + (peak - start) * t : peak;
    return { day: Math.round(day), mult: Math.round(mult * pop * 100) / 100 };
  });

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 16, marginBottom: 20 }}>
      <div style={{ fontSize: 10, color: "var(--textdim)", fontFamily: "var(--mono)", letterSpacing: 2, marginBottom: 12 }}>POPULATION CURVE PREVIEW</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60 }}>
        {points.map((p, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{
              width: "100%", background: `rgba(224,85,85,${0.3 + (p.mult / (peak * pop)) * 0.7})`,
              border: "1px solid rgba(224,85,85,.3)",
              height: `${(p.mult / (peak * pop)) * 52}px`, minHeight: 4, transition: "height .3s",
            }} />
            <div style={{ fontSize: 9, color: "var(--textdim)", fontFamily: "var(--mono)" }}>d{p.day}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
        {[["Start", start * pop], ["Peak (day " + peakDay + ")", peak * pop]].map(([l, v]) => (
          <div key={l}>
            <div style={{ fontSize: 9, color: "var(--textdim)", fontFamily: "var(--mono)", letterSpacing: 1 }}>{l}</div>
            <div style={{ fontSize: 14, color: "var(--red)", fontFamily: "var(--mono)" }}>×{Math.round(v * 100) / 100}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function ZombiesTab({ toast }) {
  const [cfg, setCfg] = useState(DEFAULT);
  const [orig, setOrig] = useState(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(cfg) !== JSON.stringify(orig);

  useEffect(() => {
    fetchApi("/api/admin/server/sandbox")
      .then(d => { const v = { ...DEFAULT, ...d, ...d.ZombieLore, ...d.ZombieConfig }; setCfg(v); setOrig(v); })
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
      await postApi("/api/admin/config/sandbox", { changes, section: "zombies" });
      setOrig({ ...cfg });
      toast("Zombie settings saved! Server restart required.", "success");
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };

  if (loading) return <div style={{ padding: 40, color: "var(--textdim)", fontFamily: "var(--mono)" }}>Loading zombie config...</div>;

  const ZOMBIE_PRESETS = [
    { label: "Chill", values: { Zombies: 5, Speed: 3, Strength: 3, Toughness: 3, PopulationMultiplier: 0.35 } },
    { label: "Normal", values: { Zombies: 4, Speed: 4, Strength: 4, Toughness: 4, PopulationMultiplier: 0.65 } },
    { label: "Hard",   values: { Zombies: 3, Speed: 2, Strength: 2, Toughness: 2, PopulationMultiplier: 1.2 } },
    { label: "SOUP S2",values: { Zombies: 4, Speed: 4, Strength: 4, Toughness: 4, PopulationMultiplier: 0.65, PopulationStartMultiplier: 0.75, PopulationPeakMultiplier: 1.75, PopulationPeakDay: 32 } },
  ];

  return (
    <>
      <div style={{ fontFamily: "var(--display)", fontSize: 36, letterSpacing: 4, color: "var(--red)", marginBottom: 4 }}>ZOMBIES</div>
      <div style={{ color: "var(--textdim)", fontSize: 12, marginBottom: 20, fontFamily: "var(--mono)" }}>population · behaviour · lore · advanced config</div>

      {/* Quick presets */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, alignItems: "center" }}>
        <div style={{ fontSize: 10, color: "var(--textdim)", fontFamily: "var(--mono)", letterSpacing: 1 }}>QUICK PRESETS:</div>
        {ZOMBIE_PRESETS.map(p => (
          <button key={p.label} onClick={() => setCfg(prev => ({ ...prev, ...p.values }))}
            style={{
              padding: "6px 14px", fontSize: 10, fontFamily: "var(--mono)", letterSpacing: 1,
              background: "transparent", border: "1px solid var(--border)", color: "var(--textdim)",
              cursor: "pointer", transition: "all .15s",
            }}
            onMouseEnter={e => { e.target.style.borderColor = "var(--red)"; e.target.style.color = "var(--red)"; }}
            onMouseLeave={e => { e.target.style.borderColor = "var(--border)"; e.target.style.color = "var(--textdim)"; }}
          >{p.label}</button>
        ))}
      </div>

      {/* Population overview */}
      <ZombiePopPreview
        pop={cfg.PopulationMultiplier}
        start={cfg.PopulationStartMultiplier}
        peak={cfg.PopulationPeakMultiplier}
        peakDay={cfg.PopulationPeakDay}
      />

      {/* Population */}
      <Section title="POPULATION" sub="how many zombies exist in the world">
        <SelectField label="Population Preset" description="Also sets Population Multiplier below" value={cfg.Zombies} onChange={set("Zombies")} options={[
          {value:1,label:"Insane"},{value:2,label:"Very High"},{value:3,label:"High"},
          {value:4,label:"Normal"},{value:5,label:"Low"},{value:6,label:"None"},
        ]} />
        <SliderField label="Population Multiplier" description="Fine-tune — Normal = 0.65" value={cfg.PopulationMultiplier} onChange={set("PopulationMultiplier")} min={0} max={4} step={0.05} accent="var(--red)" />
        <SliderField label="Start Multiplier" description="Population at day 1" value={cfg.PopulationStartMultiplier} onChange={set("PopulationStartMultiplier")} min={0} max={4} step={0.05} />
        <SliderField label="Peak Multiplier" description="Maximum population reached" value={cfg.PopulationPeakMultiplier} onChange={set("PopulationPeakMultiplier")} min={0} max={4} step={0.05} accent="var(--orange)" />
        <NumberField label="Peak Day" description="Day when population reaches its peak" value={cfg.PopulationPeakDay} onChange={set("PopulationPeakDay")} min={1} max={365} />
        <SelectField label="Distribution" value={cfg.Distribution} onChange={set("Distribution")} options={[
          {value:1,label:"Urban Focused"},{value:2,label:"Uniform"},
        ]} />
        <ToggleField label="Voronoi Noise" description="Randomized zombie distribution" value={cfg.ZombieVoronoiNoise} onChange={set("ZombieVoronoiNoise")} />
        <ToggleField label="Zombie Migration" description="Zombies migrate into empty cells" value={cfg.ZombieMigrate} onChange={set("ZombieMigrate")} />
      </Section>

      {/* Respawn */}
      <Section title="RESPAWN & REDISTRIBUTION" sub="how zombies return and spread">
        <SelectField label="Respawn Rate" value={cfg.ZombieRespawn} onChange={set("ZombieRespawn")} options={[
          {value:1,label:"High"},{value:2,label:"Normal"},{value:3,label:"Low"},{value:4,label:"None"},
        ]} />
        <NumberField label="Respawn Hours" description="Hours before zombies can respawn in a cell (0=disabled)" value={cfg.RespawnHours} onChange={set("RespawnHours")} min={0} max={8760} step={12} />
        <NumberField label="Unseen Hours Before Respawn" description="Cell must be unseen this long" value={cfg.RespawnUnseenHours} onChange={set("RespawnUnseenHours")} min={0} max={8760} step={12} />
        <SliderField label="Respawn Multiplier" description="Fraction of population respawned per cycle" value={cfg.RespawnMultiplier} onChange={set("RespawnMultiplier")} min={0} max={1} step={0.05} />
        <NumberField label="Redistribute Hours" description="Hours before zombies migrate to empty parts of cell" value={cfg.RedistributeHours} onChange={set("RedistributeHours")} min={0} max={8760} step={6} />
      </Section>

      {/* ZOMBIE LORE */}
      <Section title="ZOMBIE BEHAVIOUR" sub="speed, strength, intelligence, senses">
        <SelectField label="Speed" value={cfg.Speed} onChange={set("Speed")} options={[
          {value:1,label:"Sprinters"},{value:2,label:"Fast Shamblers"},
          {value:3,label:"Shamblers"},{value:4,label:"Random"},
        ]} />
        <NumberField label="Sprinter % (when Random)" description="0-100: percentage that are sprinters" value={cfg.SprinterPercentage} onChange={set("SprinterPercentage")} min={0} max={100} />
        <SelectField label="Strength" value={cfg.Strength} onChange={set("Strength")} options={[
          {value:1,label:"Superhuman"},{value:2,label:"Normal"},{value:3,label:"Weak"},{value:4,label:"Random"},
        ]} />
        <SelectField label="Toughness" value={cfg.Toughness} onChange={set("Toughness")} options={[
          {value:1,label:"Tough"},{value:2,label:"Normal"},{value:3,label:"Fragile"},{value:4,label:"Random"},
        ]} />
        <SelectField label="Transmission" description="How the virus spreads" value={cfg.Transmission} onChange={set("Transmission")} options={[
          {value:1,label:"Blood and Saliva"},{value:2,label:"Saliva Only"},
          {value:3,label:"Everyone's Infected"},{value:4,label:"None"},
        ]} />
        <SelectField label="Mortality" description="How fast infection kills" value={cfg.Mortality} onChange={set("Mortality")} options={[
          {value:1,label:"Instant"},{value:2,label:"0-30 Seconds"},{value:3,label:"0-1 Minutes"},
          {value:4,label:"0-12 Hours"},{value:5,label:"2-3 Days"},{value:6,label:"1-2 Weeks"},{value:7,label:"Never"},
        ]} />
        <SelectField label="Reanimate" description="How fast bodies rise as zombies" value={cfg.Reanimate} onChange={set("Reanimate")} options={[
          {value:1,label:"Instant"},{value:2,label:"0-30 Seconds"},{value:3,label:"0-1 Minutes"},
          {value:4,label:"0-12 Hours"},{value:5,label:"2-3 Days"},{value:6,label:"1-2 Weeks"},
        ]} />
        <SelectField label="Cognition (navigation)" value={cfg.Cognition} onChange={set("Cognition")} options={[
          {value:1,label:"Navigate and Use Doors"},{value:2,label:"Navigate"},
          {value:3,label:"Basic Navigation"},{value:4,label:"Random"},
        ]} />
        <NumberField label="Door Opening %" description="Chance zombie uses doors" value={cfg.DoorOpeningPercentage} onChange={set("DoorOpeningPercentage")} min={0} max={100} />
        <SelectField label="Memory" description="How long zombies remember players" value={cfg.Memory} onChange={set("Memory")} options={[
          {value:1,label:"Long"},{value:2,label:"Normal"},{value:3,label:"Short"},
          {value:4,label:"None"},{value:5,label:"Random"},{value:6,label:"Random Normal/None"},
        ]} />
        <SelectField label="Sight" value={cfg.Sight} onChange={set("Sight")} options={[
          {value:1,label:"Eagle"},{value:2,label:"Normal"},{value:3,label:"Poor"},
          {value:4,label:"Random"},{value:5,label:"Random Normal/Poor"},
        ]} />
        <SelectField label="Hearing" value={cfg.Hearing} onChange={set("Hearing")} options={[
          {value:1,label:"Pinpoint"},{value:2,label:"Normal"},{value:3,label:"Poor"},
          {value:4,label:"Random"},{value:5,label:"Random Normal/Poor"},
        ]} />
        <SelectField label="Crawl Under Vehicles" value={cfg.CrawlUnderVehicle} onChange={set("CrawlUnderVehicle")} options={[
          {value:1,label:"Crawlers Only"},{value:2,label:"Extremely Rare"},{value:3,label:"Rare"},
          {value:4,label:"Sometimes"},{value:5,label:"Often"},{value:6,label:"Very Often"},{value:7,label:"Always"},
        ]} />
        <SelectField label="Active Period" description="When zombies are most active" value={cfg.ActiveOnly} onChange={set("ActiveOnly")} options={[
          {value:1,label:"Both Day & Night"},{value:2,label:"Night Only"},{value:3,label:"Day Only"},
        ]} />
      </Section>

      {/* ZOMBIE ABILITIES */}
      <Section title="ZOMBIE ABILITIES" sub="special behaviours and powers">
        <ToggleField label="Advanced Stealth Logic" description="Zombies use cover, traits, and weather" value={cfg.SpottedLogic} onChange={set("SpottedLogic")} />
        <ToggleField label="Thump Without Chasing" description="Idle zombies still attack doors" value={cfg.ThumpNoChasing} onChange={set("ThumpNoChasing")} />
        <ToggleField label="Destroy Player Constructions" value={cfg.ThumpOnConstruction} onChange={set("ThumpOnConstruction")} />
        <ToggleField label="Trigger House Alarms" value={cfg.TriggerHouseAlarm} onChange={set("TriggerHouseAlarm")} />
        <ToggleField label="Drag Down (group)" description="Groups can drag and kill players" value={cfg.ZombiesDragDown} onChange={set("ZombiesDragDown")} />
        <ToggleField label="Crawlers Contribute to Drag Down" value={cfg.ZombiesCrawlersDragDown} onChange={set("ZombiesCrawlersDragDown")} />
        <ToggleField label="Fence Lunge" description="Zombies lunge after climbing fences" value={cfg.ZombiesFenceLunge} onChange={set("ZombiesFenceLunge")} />
        <SelectField label="Fake Dead Bodies" value={cfg.DisableFakeDead} onChange={set("DisableFakeDead")} options={[
          {value:1,label:"World Zombies (reanimation)"},{value:2,label:"World and Combat"},{value:3,label:"Never"},
        ]} />
        <NumberField label="Chance of Attached Weapon %" description="% chance zombie carries a weapon" value={cfg.ChanceOfAttachedWeapon} onChange={set("ChanceOfAttachedWeapon")} min={0} max={100} />
        <SliderField label="Armor Factor" description="How effective zombie armor is (1.0 = normal)" value={cfg.ZombiesArmorFactor} onChange={set("ZombiesArmorFactor")} min={0} max={100} step={0.1} />
        <NumberField label="Max Armor Defense %" description="Max protection worn armor can give a zombie" value={cfg.ZombiesMaxDefense} onChange={set("ZombiesMaxDefense")} min={0} max={100} />
        <SliderField label="Fall Damage" value={cfg.ZombiesFallDamage} onChange={set("ZombiesFallDamage")} min={0} max={100} step={0.1} />
      </Section>

      {/* GROUP BEHAVIOR */}
      <Section title="RALLY & GROUPING" sub="how zombies form packs when idle">
        <NumberField label="Rally Group Size" description="Default zombie group size" value={cfg.RallyGroupSize} onChange={set("RallyGroupSize")} min={0} max={1000} />
        <NumberField label="Group Size Variance %" value={cfg.RallyGroupSizeVariance} onChange={set("RallyGroupSizeVariance")} min={0} max={100} />
        <NumberField label="Rally Travel Distance (tiles)" description="Distance zombies walk to form groups" value={cfg.RallyTravelDistance} onChange={set("RallyTravelDistance")} min={5} max={50} />
        <NumberField label="Group Separation (tiles)" description="Distance between zombie groups" value={cfg.RallyGroupSeparation} onChange={set("RallyGroupSeparation")} min={5} max={25} />
        <NumberField label="Group Radius" description="How close members stay to leader" value={cfg.RallyGroupRadius} onChange={set("RallyGroupRadius")} min={1} max={10} />
        <NumberField label="Sound Follow Distance" description="How far zombies walk toward sounds" value={cfg.FollowSoundDistance} onChange={set("FollowSoundDistance")} min={10} max={1000} />
        <NumberField label="Zombies Counted Before Delete" description="Reduce for performance" value={cfg.ZombiesCountBeforeDelete} onChange={set("ZombiesCountBeforeDelete")} min={10} max={500} />
      </Section>

      {/* FENCES */}
      <Section title="FENCES & BARRIERS" sub="how zombies attack player defenses">
        <SelectField label="Spawn Near Player Protection" value={cfg.PlayerSpawnZombieRemoval} onChange={set("PlayerSpawnZombieRemoval")} options={[
          {value:1,label:"Inside Building + Around It"},{value:2,label:"Inside Building Only"},
          {value:3,label:"Inside Room Only"},{value:4,label:"No Protection"},
        ]} />
        <NumberField label="Fence Thump Threshold" description="How many zombies to damage tall fences" value={cfg.FenceThumpersRequired} onChange={set("FenceThumpersRequired")} min={-1} max={100} />
        <SliderField label="Fence Damage Multiplier" value={cfg.FenceDamageMultiplier} onChange={set("FenceDamageMultiplier")} min={0.01} max={100} step={0.1} />
      </Section>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => setCfg({ ...orig })} label="Unsaved zombie changes — server restart required" />
    </>
  );
}
