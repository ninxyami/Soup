"use client";
// @ts-nocheck
import { useState, useEffect } from "react";
import {
  fetchApi, postApi, Section, FullSection, Card, FieldLabel,
  Toggle, Select, Btn, SaveBar,
  ToggleField, SelectField, NumberField, SliderField, FREQ_6, SPEED_5, AMOUNT_5,
} from "./shared";

const DEFAULT_WORLD = {
  // Time
  DayLength: 5, StartYear: 1, StartMonth: 8, StartDay: 9, StartTime: 1,
  DayNightCycle: 1, NightDarkness: 2, NightLength: 3,
  // Climate
  ClimateCycle: 1, FogCycle: 1, Temperature: 3, Rain: 3,
  MaxFogIntensity: 1, MaxRainFxIntensity: 1, EnableSnowOnGround: true,
  // Water / Electricity
  WaterShut: 1, ElecShut: 1, WaterShutModifier: -1, ElecShutModifier: -1,
  AlarmDecay: 2, AlarmDecayModifier: 14,
  // Erosion
  ErosionSpeed: 2, ErosionDays: 0, Farming: 3, FarmingSpeedNew: 1.5, FarmingAmountNew: 0.75,
  CompostTime: 1, PlantResilience: 3, PlantAbundance: 3,
  PlantGrowingSeasons: true, KillInsideCrops: true, FarmingLootNew: 0.4,
  // World stories
  SurvivorHouseChance: 3, VehicleStoryChance: 3, ZoneStoryChance: 3,
  // Misc world
  FireSpread: false, AllowExteriorGenerator: true, TimeSinceApo: 2,
  HoursForCorpseRemoval: 216.0, DecayingCorpseHealthImpact: 3, ZombieHealthImpact: false,
  BloodLevel: 3, BloodSplatLifespanDays: 0, MaggotSpawn: 1,
  DaysForRottenFoodRemoval: -1, HoursForWorldItemRemoval: 24.0,
  LightBulbLifespan: 0.0,
  // Loot
  FoodLootNew: 0.4, LiteratureLootNew: 0.4, SkillBookLoot: 0.4, RecipeResourceLoot: 0.4,
  MedicalLootNew: 0.5, SurvivalGearsLootNew: 0.5, CannedFoodLootNew: 0.4,
  WeaponLootNew: 0.5, RangedWeaponLootNew: 0.5, AmmoLootNew: 0.5,
  MechanicsLootNew: 0.4, OtherLootNew: 0.6, ClothingLootNew: 0.4,
  ContainerLootNew: 0.4, KeyLootNew: 0.6, MediaLootNew: 0.5,
  MementoLootNew: 0.4, CookwareLootNew: 0.4, MaterialLootNew: 0.4,
  ToolLootNew: 0.4, WeaponLootNew: 0.5,
  ZombiePopLootEffect: 10, HoursForLootRespawn: 0, MaxItemsForLootRespawn: 5,
  SeenHoursPreventLootRespawn: 0, ConstructionPreventsLootRespawn: true,
  MaximumLooted: 0, DaysUntilMaximumLooted: 90,
  // Player stats
  StatsDecrease: 3, NatureAbundance: 4, FoodRotSpeed: 3, FridgeFactor: 3,
  Alarm: 2, LockedHouses: 4, Nutrition: true, StarterKit: false,
  BoneFracture: true, InjurySeverity: 2, EndRegen: 3,
  ClothingDegradation: 3, AttackBlockMovements: true, EasyClimbing: false,
  MultiHitZombies: true, RearVulnerability: 1,
  Helicopter: 3, MetaEvent: 2, SleepingEvent: 1,
  GeneratorFuelConsumption: 0.1, GeneratorSpawning: 4,
  AnnotatedMapChance: 4, CharacterFreePoints: 0, ConstructionBonusPoints: 3,
  MuscleStrainFactor: 0.5, DiscomfortFactor: 0.5, WoundInfectionFactor: 0.0,
  NegativeTraitsPenalty: 1, MinutesPerPage: 0.1, MaximumFireFuelHours: 8,
  FishAbundance: 4, LiteratureCooldown: 45,
  EnablePoisoning: 1, MetaKnowledge: 3, SeeNotLearntRecipe: true,
  NoBlackClothes: true, FirearmUseDamageChance: true,
};

export default function WorldLootTab({ toast }) {
  const [cfg, setCfg] = useState(DEFAULT_WORLD);
  const [orig, setOrig] = useState(DEFAULT_WORLD);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(cfg) !== JSON.stringify(orig);

  useEffect(() => {
    fetchApi("/api/admin/server/sandbox")
      .then(d => { const v = { ...DEFAULT_WORLD, ...d }; setCfg(v); setOrig(v); })
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
      await postApi("/api/admin/config/sandbox", { changes, section: "world" });
      setOrig({ ...cfg });
      toast("World settings saved! Server restart required.", "success");
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };

  if (loading) return <div style={{ padding: 40, color: "var(--textdim)", fontFamily: "var(--mono)" }}>Loading world config...</div>;

  const LOOT_FIELDS = [
    ["FoodLootNew",          "Fresh Food",      "Rotting/fresh food"],
    ["CannedFoodLootNew",    "Canned Food",     "Canned goods & beverages"],
    ["MedicalLootNew",       "Medical",         "Bandages, medicine, first aid"],
    ["WeaponLootNew",        "Melee Weapons",   "Non-tool melee weapons"],
    ["RangedWeaponLootNew",  "Ranged Weapons",  "Firearms & attachments"],
    ["AmmoLootNew",          "Ammo",            "Bullets, mags, loose rounds"],
    ["MechanicsLootNew",     "Mechanics",       "Car parts & tools"],
    ["ClothingLootNew",      "Clothing",        "Wearable items"],
    ["ContainerLootNew",     "Containers",      "Backpacks & cases"],
    ["SkillBookLoot",        "Skill Books",     "Books with XP multipliers"],
    ["LiteratureLootNew",    "Literature",      "Books, flyers, newspapers"],
    ["RecipeResourceLoot",   "Recipe Books",    "Recipe teaching items"],
    ["MaterialLootNew",      "Materials",       "Crafting materials"],
    ["ToolLootNew",          "Tools",           "General tools"],
    ["CookwareLootNew",      "Cookware",        "Cooking tools & ingredients"],
    ["FarmingLootNew",       "Farming",         "Seeds, trowels, farm tools"],
    ["SurvivalGearsLootNew", "Survival Gear",   "Tents, rods, camping gear"],
    ["KeyLootNew",           "Keys",            "Building & car keys"],
    ["MediaLootNew",         "Media",           "VHS, CDs, tapes"],
    ["MementoLootNew",       "Collectibles",    "Spiffo items, photos, plushies"],
    ["OtherLootNew",         "Everything Else", "Also affects forage in town zones"],
  ];

  return (
    <>
      <div style={{ fontFamily: "var(--display)", fontSize: 36, letterSpacing: 4, color: "var(--accent)", marginBottom: 4 }}>WORLD & LOOT</div>
      <div style={{ color: "var(--textdim)", fontSize: 12, marginBottom: 28, fontFamily: "var(--mono)" }}>sandbox settings · environment · loot rates · player survival</div>

      {/* TIME */}
      <Section title="TIME & DATE" sub="when the apocalypse starts and how fast days pass">
        <SelectField label="Day Length" value={cfg.DayLength} onChange={set("DayLength")} options={[
          {value:1,label:"15 Minutes"},{value:2,label:"30 Minutes"},{value:3,label:"1 Hour"},
          {value:4,label:"1.5 Hours"},{value:5,label:"2 Hours"},{value:6,label:"3 Hours"},
          {value:7,label:"4 Hours"},{value:8,label:"5 Hours"},{value:9,label:"6 Hours"},
          {value:10,label:"7 Hours"},{value:15,label:"12 Hours"},{value:27,label:"Real-time"},
        ]} />
        <SelectField label="Start Month" value={cfg.StartMonth} onChange={set("StartMonth")} options={
          ["January","February","March","April","May","June","July","August","September","October","November","December"]
          .map((m,i) => ({value:i+1,label:m}))
        } />
        <NumberField label="Start Day of Month" value={cfg.StartDay} onChange={set("StartDay")} min={1} max={31} />
        <SelectField label="Start Time of Day" value={cfg.StartTime} onChange={set("StartTime")} options={[
          {value:1,label:"7 AM"},{value:2,label:"9 AM"},{value:3,label:"12 PM"},
          {value:4,label:"2 PM"},{value:5,label:"5 PM"},{value:6,label:"9 PM"},
          {value:7,label:"12 AM"},{value:8,label:"2 AM"},{value:9,label:"5 AM"},
        ]} />
        <SelectField label="Day/Night Cycle" value={cfg.DayNightCycle} onChange={set("DayNightCycle")} options={[
          {value:1,label:"Normal"},{value:2,label:"Endless Day"},{value:3,label:"Endless Night"},
        ]} />
        <SelectField label="Night Darkness" value={cfg.NightDarkness} onChange={set("NightDarkness")} options={[
          {value:1,label:"Pitch Black"},{value:2,label:"Dark"},{value:3,label:"Normal"},{value:4,label:"Bright"},
        ]} />
        <SelectField label="Night Length" value={cfg.NightLength} onChange={set("NightLength")} options={[
          {value:1,label:"Always Night"},{value:2,label:"Long"},{value:3,label:"Normal"},
          {value:4,label:"Short"},{value:5,label:"Always Day"},
        ]} />
      </Section>

      {/* CLIMATE */}
      <Section title="WEATHER & CLIMATE" sub="temperature, rain, fog, and snow">
        <SelectField label="Climate Cycle" value={cfg.ClimateCycle} onChange={set("ClimateCycle")} options={[
          {value:1,label:"Normal"},{value:2,label:"No Weather"},{value:3,label:"Endless Rain"},
          {value:4,label:"Endless Storm"},{value:5,label:"Endless Snow"},{value:6,label:"Endless Blizzard"},
        ]} />
        <SelectField label="Global Temperature" value={cfg.Temperature} onChange={set("Temperature")} options={[
          {value:1,label:"Very Cold"},{value:2,label:"Cold"},{value:3,label:"Normal"},
          {value:4,label:"Hot"},{value:5,label:"Very Hot"},
        ]} />
        <SelectField label="Rain Frequency" value={cfg.Rain} onChange={set("Rain")} options={[
          {value:1,label:"Very Dry"},{value:2,label:"Dry"},{value:3,label:"Normal"},
          {value:4,label:"Rainy"},{value:5,label:"Very Rainy"},
        ]} />
        <SelectField label="Fog Cycle" value={cfg.FogCycle} onChange={set("FogCycle")} options={[
          {value:1,label:"Normal"},{value:2,label:"No Fog"},{value:3,label:"Endless Fog"},
        ]} />
        <SelectField label="Max Fog Intensity" value={cfg.MaxFogIntensity} onChange={set("MaxFogIntensity")} options={[
          {value:1,label:"Normal"},{value:2,label:"Moderate"},{value:3,label:"Low"},{value:4,label:"None"},
        ]} />
        <ToggleField label="Snow Accumulates on Ground" value={cfg.EnableSnowOnGround} onChange={set("EnableSnowOnGround")} />
      </Section>

      {/* WATER & POWER */}
      <Section title="WATER & ELECTRICITY SHUTOFF" sub="when utilities fail">
        <SelectField label="Water Shutoff" description="When taps run dry" value={cfg.WaterShut} onChange={set("WaterShut")} options={[
          {value:1,label:"Instant"},{value:2,label:"0-30 Days"},{value:3,label:"0-2 Months"},
          {value:4,label:"0-6 Months"},{value:5,label:"0-1 Year"},{value:6,label:"0-5 Years"},
          {value:7,label:"2-6 Months"},{value:8,label:"6-12 Months"},{value:9,label:"Disabled"},
        ]} />
        <SelectField label="Electricity Shutoff" description="When the grid goes dark" value={cfg.ElecShut} onChange={set("ElecShut")} options={[
          {value:1,label:"Instant"},{value:2,label:"14-30 Days"},{value:3,label:"14 Days-2 Months"},
          {value:4,label:"14 Days-6 Months"},{value:5,label:"14 Days-1 Year"},{value:6,label:"14 Days-5 Years"},
          {value:7,label:"2-6 Months"},{value:8,label:"6-12 Months"},{value:9,label:"Disabled"},
        ]} />
        <SelectField label="Alarm Battery Decay" value={cfg.AlarmDecay} onChange={set("AlarmDecay")} options={[
          {value:1,label:"Instant"},{value:2,label:"0-30 Days"},{value:3,label:"0-2 Months"},
          {value:4,label:"0-6 Months"},{value:5,label:"0-1 Year"},{value:6,label:"0-5 Years"},
        ]} />
        <ToggleField label="Generators Work Outside" description="Can power gas pumps etc." value={cfg.AllowExteriorGenerator} onChange={set("AllowExteriorGenerator")} />
        <SliderField label="Generator Fuel Consumption (/hr)" value={cfg.GeneratorFuelConsumption} onChange={set("GeneratorFuelConsumption")} min={0} max={100} step={0.01} />
        <SelectField label="Generator Spawn Frequency" value={cfg.GeneratorSpawning} onChange={set("GeneratorSpawning")} options={[
          {value:1,label:"None"},{value:2,label:"Insanely Rare"},{value:3,label:"Extremely Rare"},
          {value:4,label:"Rare"},{value:5,label:"Normal"},{value:6,label:"Common"},{value:7,label:"Abundant"},
        ]} />
      </Section>

      {/* EROSION */}
      <Section title="EROSION & FARMING" sub="world overgrowth and crop speed">
        <SelectField label="Erosion Speed" description="How fast vines/grass/trees regrow" value={cfg.ErosionSpeed} onChange={set("ErosionSpeed")} options={[
          {value:1,label:"Very Fast (20 days)"},{value:2,label:"Fast (50 days)"},{value:3,label:"Normal (100 days)"},
          {value:4,label:"Slow (200 days)"},{value:5,label:"Very Slow (500 days)"},
        ]} />
        <SelectField label="Plant Growth Speed" value={cfg.Farming} onChange={set("Farming")} options={SPEED_5} />
        <SliderField label="Farming Speed Multiplier" value={cfg.FarmingSpeedNew} onChange={set("FarmingSpeedNew")} min={0.1} max={100} step={0.1} />
        <SliderField label="Farming Harvest Amount" value={cfg.FarmingAmountNew} onChange={set("FarmingAmountNew")} min={0.1} max={10} step={0.05} />
        <SelectField label="Plant Resilience (watering needs)" value={cfg.PlantResilience} onChange={set("PlantResilience")} options={[
          {value:1,label:"Very High"},{value:2,label:"High"},{value:3,label:"Normal"},
          {value:4,label:"Low"},{value:5,label:"Very Low"},
        ]} />
        <SelectField label="Plant Harvest Abundance" value={cfg.PlantAbundance} onChange={set("PlantAbundance")} options={AMOUNT_5} />
        <ToggleField label="Seasons Affect Plant Growth" value={cfg.PlantGrowingSeasons} onChange={set("PlantGrowingSeasons")} />
        <ToggleField label="Indoor Crops Die" description="Crops inside buildings die" value={cfg.KillInsideCrops} onChange={set("KillInsideCrops")} />
      </Section>

      {/* LOOT */}
      <FullSection title="LOOT RATES" sub="0.0 = nothing spawns · 1.0 = default · 2.0+ = generous. These multiply base loot tables.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10, marginBottom: 16 }}>
          {LOOT_FIELDS.map(([key, label, desc]) => (
            <div key={key} style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "12px 14px", position: "relative" }}>
              <div style={{
                position: "absolute", top: 0, left: 0, bottom: 0, width: 3,
                background: cfg[key] < 0.5 ? "var(--red)" : cfg[key] < 0.8 ? "var(--orange)" : cfg[key] > 1.5 ? "var(--green)" : "var(--border)",
              }} />
              <div style={{ paddingLeft: 8 }}>
                <FieldLabel label={label} description={desc} />
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="range" min={0} max={4} step={0.05} value={cfg[key]}
                    onChange={e => set(key)(parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: cfg[key] < 0.5 ? "var(--red)" : "var(--accent)" }}
                  />
                  <input type="number" min={0} max={4} step={0.05} value={cfg[key]}
                    onChange={e => set(key)(parseFloat(e.target.value))}
                    style={{
                      width: 52, background: "var(--surface2)", border: "1px solid var(--border)",
                      color: "var(--accent)", padding: "4px 6px", fontFamily: "var(--mono)", fontSize: 12, outline: "none",
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          <NumberField label="Zombie Pop Loot Bonus" description="Loot increases near zombies (0=off, max 20)" value={cfg.ZombiePopLootEffect} onChange={set("ZombiePopLootEffect")} min={0} max={20} />
          <NumberField label="Loot Respawn (hours)" description="0 = disabled" value={cfg.HoursForLootRespawn} onChange={set("HoursForLootRespawn")} min={0} />
          <NumberField label="Max Items Before No Respawn" description="Containers with ≥ this many items won't respawn" value={cfg.MaxItemsForLootRespawn} onChange={set("MaxItemsForLootRespawn")} min={0} />
          <ToggleField label="Construction Blocks Loot Respawn" value={cfg.ConstructionPreventsLootRespawn} onChange={set("ConstructionPreventsLootRespawn")} />
        </div>
      </FullSection>

      {/* SURVIVAL */}
      <Section title="PLAYER SURVIVAL" sub="food, health, stamina, and difficulty">
        <SelectField label="Stats Decrease Speed" description="Hunger, thirst, fatigue drain rate" value={cfg.StatsDecrease} onChange={set("StatsDecrease")} options={SPEED_5} />
        <SelectField label="Food Rot Speed" value={cfg.FoodRotSpeed} onChange={set("FoodRotSpeed")} options={SPEED_5} />
        <SelectField label="Fridge Effectiveness" value={cfg.FridgeFactor} onChange={set("FridgeFactor")} options={[
          {value:1,label:"Very Low"},{value:2,label:"Low"},{value:3,label:"Normal"},
          {value:4,label:"High"},{value:5,label:"Very High"},{value:6,label:"No Decay"},
        ]} />
        <ToggleField label="Nutrition System" description="Weight gain/loss from food" value={cfg.Nutrition} onChange={set("Nutrition")} />
        <SelectField label="Injury Severity" value={cfg.InjurySeverity} onChange={set("InjurySeverity")} options={[
          {value:1,label:"Low"},{value:2,label:"Normal"},{value:3,label:"High"},
        ]} />
        <ToggleField label="Bone Fractures" description="Can break legs from falls etc." value={cfg.BoneFracture} onChange={set("BoneFracture")} />
        <SelectField label="Endurance Regen" description="Recovery from physical actions" value={cfg.EndRegen} onChange={set("EndRegen")} options={SPEED_5} />
        <SliderField label="Muscle Strain Factor" value={cfg.MuscleStrainFactor} onChange={set("MuscleStrainFactor")} min={0} max={10} step={0.1} />
        <SliderField label="Discomfort Factor (clothing)" value={cfg.DiscomfortFactor} onChange={set("DiscomfortFactor")} min={0} max={10} step={0.1} />
        <SliderField label="Wound Infection Factor" description="0 = infections can't kill" value={cfg.WoundInfectionFactor} onChange={set("WoundInfectionFactor")} min={0} max={10} step={0.1} />
        <ToggleField label="Starter Kit" description="Spawn with chips, water, bat, hammer" value={cfg.StarterKit} onChange={set("StarterKit")} />
        <NumberField label="Character Free Points" description="Bonus points during character creation" value={cfg.CharacterFreePoints} onChange={set("CharacterFreePoints")} min={-100} max={100} />
      </Section>

      {/* WORLD EVENTS */}
      <Section title="WORLD EVENTS" sub="helicopters, gunshots, meta events">
        <SelectField label="Helicopter Events" value={cfg.Helicopter} onChange={set("Helicopter")} options={[
          {value:1,label:"Never"},{value:2,label:"Once"},{value:3,label:"Sometimes"},{value:4,label:"Often"},
        ]} />
        <SelectField label="Meta Events (distant gunshots)" value={cfg.MetaEvent} onChange={set("MetaEvent")} options={[
          {value:1,label:"Never"},{value:2,label:"Sometimes"},{value:3,label:"Often"},
        ]} />
        <SelectField label="Sleep Events (nightmares)" value={cfg.SleepingEvent} onChange={set("SleepingEvent")} options={[
          {value:1,label:"Never"},{value:2,label:"Sometimes"},{value:3,label:"Often"},
        ]} />
        <SelectField label="House Alarm Frequency" value={cfg.Alarm} onChange={set("Alarm")} options={[
          {value:1,label:"Never"},{value:2,label:"Extremely Rare"},{value:3,label:"Rare"},
          {value:4,label:"Sometimes"},{value:5,label:"Often"},{value:6,label:"Very Often"},
        ]} />
        <SelectField label="Locked Houses" value={cfg.LockedHouses} onChange={set("LockedHouses")} options={[
          {value:1,label:"Never"},{value:2,label:"Extremely Rare"},{value:3,label:"Rare"},
          {value:4,label:"Sometimes"},{value:5,label:"Often"},{value:6,label:"Very Often"},
        ]} />
        <SelectField label="Survivor House Chance" description="Pre-looted / abandoned buildings" value={cfg.SurvivorHouseChance} onChange={set("SurvivorHouseChance")} options={[
          {value:1,label:"Never"},{value:2,label:"Extremely Rare"},{value:3,label:"Rare"},
          {value:4,label:"Sometimes"},{value:5,label:"Often"},{value:6,label:"Very Often"},{value:7,label:"Always"},
        ]} />
      </Section>

      {/* COMBAT */}
      <Section title="COMBAT" sub="melee and firearm mechanics">
        <ToggleField label="Multi-Hit Zombies" description="Melee can hit multiple zombies" value={cfg.MultiHitZombies} onChange={set("MultiHitZombies")} />
        <SelectField label="Rear Vulnerability" description="Chance of bite from behind" value={cfg.RearVulnerability} onChange={set("RearVulnerability")} options={[
          {value:1,label:"Low"},{value:2,label:"Medium"},{value:3,label:"High"},
        ]} />
        <ToggleField label="Attack Slows Movement" value={cfg.AttackBlockMovements} onChange={set("AttackBlockMovements")} />
        <ToggleField label="Easy Climbing" description="No failure chance on sheet ropes" value={cfg.EasyClimbing} onChange={set("EasyClimbing")} />
        <ToggleField label="Firearm Damage Chance Mode" description="Aiming replaces chance-to-hit" value={cfg.FirearmUseDamageChance} onChange={set("FirearmUseDamageChance")} />
        <ToggleField label="Fire Spreads" description="Fire propagates to nearby tiles" value={cfg.FireSpread} onChange={set("FireSpread")} />
      </Section>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => setCfg({ ...orig })} label="Unsaved world & loot changes — server restart required" />
    </>
  );
}
