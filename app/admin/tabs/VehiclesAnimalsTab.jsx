"use client";
// @ts-nocheck
import { useState, useEffect } from "react";
import { fetchApi, postApi, Section, SaveBar, ToggleField, SelectField, NumberField, SliderField, FREQ_6, SPEED_6 } from "./shared";

const DEFAULT = {
  // Vehicles
  EnableVehicles: true, CarSpawnRate: 3, VehicleEasyUse: false,
  InitialGas: 2, CarGasConsumption: 1.0, FuelStationGasInfinite: false,
  FuelStationGasMin: 0.0, FuelStationGasMax: 0.8, FuelStationGasEmptyChance: 20,
  ChanceHasGas: 1, RecentlySurvivorVehicles: 2,
  CarAlarm: 2, LockedCar: 3, CarGeneralCondition: 2,
  CarDamageOnImpact: 3, DamageToPlayerFromHitByACar: 1, PlayerDamageFromCrash: true,
  TrafficJam: true, SirenEffectsZombies: true, SirenShutoffHours: 0.0,
  ZombieAttractionMultiplier: 1.0,
  // Animals
  AnimalStatsModifier: 4, AnimalMetaStatsModifier: 4,
  AnimalPregnancyTime: 4, AnimalAgeModifier: 5,
  AnimalMilkIncModifier: 5, AnimalWoolIncModifier: 5,
  AnimalRanchChance: 5, AnimalGrassRegrowTime: 240,
  AnimalMetaPredator: false, AnimalMatingSeason: true,
  AnimalEggHatch: 5, AnimalSoundAttractZombies: true,
  AnimalTrackChance: 4, AnimalPathChance: 4,
  MaximumRatIndex: 25, DaysUntilMaximumRatIndex: 90,
  FishAbundance: 4,
};

export default function VehiclesAnimalsTab({ toast }) {
  const [cfg, setCfg] = useState(DEFAULT);
  const [orig, setOrig] = useState(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(cfg) !== JSON.stringify(orig);

  useEffect(() => {
    fetchApi("/api/admin/server/sandbox")
      .then(d => { const v = { ...DEFAULT, ...d }; setCfg(v); setOrig(v); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (key) => (val) => setCfg(p => ({ ...p, [key]: val }));

  const save = async () => {
    setSaving(true);
    try {
      const changes = Object.entries(cfg).filter(([k, v]) => v !== orig[k]).map(([key, value]) => ({ key, value }));
      await postApi("/api/admin/config/sandbox", { changes, section: "vehicles_animals" });
      setOrig({ ...cfg });
      toast("Vehicles & Animals saved! Server restart required.", "success");
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };

  if (loading) return <div style={{ padding: 40, color: "var(--textdim)", fontFamily: "var(--mono)" }}>Loading config...</div>;

  return (
    <>
      <div style={{ fontFamily: "var(--display)", fontSize: 36, letterSpacing: 4, color: "var(--blue)", marginBottom: 4 }}>VEHICLES & ANIMALS</div>
      <div style={{ color: "var(--textdim)", fontSize: 12, marginBottom: 28, fontFamily: "var(--mono)" }}>car spawning · gas · damage · farm animals · wildlife</div>

      <Section title="VEHICLE SPAWNING" sub="how many and what condition cars spawn in">
        <ToggleField label="Vehicles Enabled" value={cfg.EnableVehicles} onChange={set("EnableVehicles")} />
        <SelectField label="Car Spawn Rate" value={cfg.CarSpawnRate} onChange={set("CarSpawnRate")} options={[
          {value:1,label:"None"},{value:2,label:"Very Low"},{value:3,label:"Low"},
          {value:4,label:"Normal"},{value:5,label:"High"},
        ]} />
        <SelectField label="General Car Condition" value={cfg.CarGeneralCondition} onChange={set("CarGeneralCondition")} options={[
          {value:1,label:"Very Low"},{value:2,label:"Low"},{value:3,label:"Normal"},
          {value:4,label:"High"},{value:5,label:"Very High"},
        ]} />
        <SelectField label="Recently Survivor Vehicles" description="Well-maintained cars post-apocalypse" value={cfg.RecentlySurvivorVehicles} onChange={set("RecentlySurvivorVehicles")} options={[
          {value:1,label:"None"},{value:2,label:"Low"},{value:3,label:"Normal"},{value:4,label:"High"},
        ]} />
        <ToggleField label="Easy Vehicle Use" description="No keys needed, no lock picking" value={cfg.VehicleEasyUse} onChange={set("VehicleEasyUse")} />
        <SelectField label="Locked Car Frequency" value={cfg.LockedCar} onChange={set("LockedCar")} options={[
          {value:1,label:"Never"},{value:2,label:"Extremely Rare"},{value:3,label:"Rare"},
          {value:4,label:"Sometimes"},{value:5,label:"Often"},{value:6,label:"Very Often"},
        ]} />
        <SelectField label="Car Alarm Frequency" value={cfg.CarAlarm} onChange={set("CarAlarm")} options={[
          {value:1,label:"Never"},{value:2,label:"Extremely Rare"},{value:3,label:"Rare"},
          {value:4,label:"Sometimes"},{value:5,label:"Often"},{value:6,label:"Very Often"},
        ]} />
        <ToggleField label="Traffic Jams on Roads" description="Wrecked car roadblocks" value={cfg.TrafficJam} onChange={set("TrafficJam")} />
      </Section>

      <Section title="FUEL & GAS" sub="vehicle fuel and gas station settings">
        <SelectField label="Initial Gas in Cars" value={cfg.InitialGas} onChange={set("InitialGas")} options={[
          {value:1,label:"Very Low"},{value:2,label:"Low"},{value:3,label:"Normal"},
          {value:4,label:"High"},{value:5,label:"Very High"},{value:6,label:"Full"},
        ]} />
        <SelectField label="Chance Car Has Gas" value={cfg.ChanceHasGas} onChange={set("ChanceHasGas")} options={[
          {value:1,label:"Low"},{value:2,label:"Normal"},{value:3,label:"High"},
        ]} />
        <SliderField label="Gas Consumption Rate" description="1.0 = default. Higher = burns faster" value={cfg.CarGasConsumption} onChange={set("CarGasConsumption")} min={0} max={100} step={0.1} />
        <ToggleField label="Gas Stations Never Run Out" value={cfg.FuelStationGasInfinite} onChange={set("FuelStationGasInfinite")} />
        <SliderField label="Gas Station Min Fuel" description="0.0 = empty is possible" value={cfg.FuelStationGasMin} onChange={set("FuelStationGasMin")} min={0} max={1} step={0.05} />
        <SliderField label="Gas Station Max Fuel" value={cfg.FuelStationGasMax} onChange={set("FuelStationGasMax")} min={0} max={1} step={0.05} />
        <NumberField label="Empty Pump Chance %" value={cfg.FuelStationGasEmptyChance} onChange={set("FuelStationGasEmptyChance")} min={0} max={100} />
      </Section>

      <Section title="VEHICLE DAMAGE" sub="crashes, impacts, and player damage">
        <SelectField label="Damage on Impact" description="How much damage cars take in crashes" value={cfg.CarDamageOnImpact} onChange={set("CarDamageOnImpact")} options={[
          {value:1,label:"Very Low"},{value:2,label:"Low"},{value:3,label:"Normal"},
          {value:4,label:"High"},{value:5,label:"Very High"},
        ]} />
        <SelectField label="Player Hit by Car Damage" value={cfg.DamageToPlayerFromHitByACar} onChange={set("DamageToPlayerFromHitByACar")} options={[
          {value:1,label:"None"},{value:2,label:"Low"},{value:3,label:"Normal"},
          {value:4,label:"High"},{value:5,label:"Very High"},
        ]} />
        <ToggleField label="Player Injured in Crash" value={cfg.PlayerDamageFromCrash} onChange={set("PlayerDamageFromCrash")} />
        <NumberField label="Siren Shutoff Hours" description="Hours before wailing sirens stop. 0 = never" value={cfg.SirenShutoffHours} onChange={set("SirenShutoffHours")} min={0} max={168} step={0.5} />
        <ToggleField label="Sirens Attract Zombies" value={cfg.SirenEffectsZombies} onChange={set("SirenEffectsZombies")} />
        <SliderField label="Engine Zombie Attraction" description="1.0 = default" value={cfg.ZombieAttractionMultiplier} onChange={set("ZombieAttractionMultiplier")} min={0} max={100} step={0.1} />
      </Section>

      <Section title="FARM ANIMALS" sub="chickens, cows, pigs, sheep stats">
        <SelectField label="Animal Ranch Spawn Chance" value={cfg.AnimalRanchChance} onChange={set("AnimalRanchChance")} options={[
          {value:1,label:"Never"},{value:2,label:"Extremely Rare"},{value:3,label:"Rare"},
          {value:4,label:"Sometimes"},{value:5,label:"Often"},{value:6,label:"Very Often"},{value:7,label:"Always"},
        ]} />
        <SelectField label="Animal Stats Speed" description="How fast hunger/thirst reduces" value={cfg.AnimalStatsModifier} onChange={set("AnimalStatsModifier")} options={SPEED_6} />
        <SelectField label="Animal Meta Stats Speed" description="While animal is off-screen" value={cfg.AnimalMetaStatsModifier} onChange={set("AnimalMetaStatsModifier")} options={SPEED_6} />
        <SelectField label="Pregnancy Time" value={cfg.AnimalPregnancyTime} onChange={set("AnimalPregnancyTime")} options={SPEED_6} />
        <SelectField label="Animal Aging Speed" value={cfg.AnimalAgeModifier} onChange={set("AnimalAgeModifier")} options={SPEED_6} />
        <SelectField label="Milk Production Rate" value={cfg.AnimalMilkIncModifier} onChange={set("AnimalMilkIncModifier")} options={SPEED_6} />
        <SelectField label="Wool Production Rate" value={cfg.AnimalWoolIncModifier} onChange={set("AnimalWoolIncModifier")} options={SPEED_6} />
        <SelectField label="Egg Hatch Time" value={cfg.AnimalEggHatch} onChange={set("AnimalEggHatch")} options={SPEED_6} />
        <NumberField label="Grass Regrow Time (hours)" description="After animal eating or player cutting" value={cfg.AnimalGrassRegrowTime} onChange={set("AnimalGrassRegrowTime")} min={1} max={9999} />
        <ToggleField label="Mating Seasons" description="Animals only breed during their season" value={cfg.AnimalMatingSeason} onChange={set("AnimalMatingSeason")} />
        <ToggleField label="Meta Predator (foxes attack chickens)" value={cfg.AnimalMetaPredator} onChange={set("AnimalMetaPredator")} />
        <ToggleField label="Animal Sounds Attract Zombies" value={cfg.AnimalSoundAttractZombies} onChange={set("AnimalSoundAttractZombies")} />
      </Section>

      <Section title="WILDLIFE & HUNTING" sub="wild animals, fish, and tracks">
        <SelectField label="Fish Abundance" value={cfg.FishAbundance} onChange={set("FishAbundance")} options={[
          {value:1,label:"Very Poor"},{value:2,label:"Poor"},{value:3,label:"Normal"},
          {value:4,label:"Abundant"},{value:5,label:"Very Abundant"},
        ]} />
        <SelectField label="Animal Track Chance" value={cfg.AnimalTrackChance} onChange={set("AnimalTrackChance")} options={FREQ_6} />
        <SelectField label="Animal Path Chance" description="Huntable paths for tracking" value={cfg.AnimalPathChance} onChange={set("AnimalPathChance")} options={FREQ_6} />
        <NumberField label="Max Rat Index" description="Intensity of vermin in infested buildings" value={cfg.MaximumRatIndex} onChange={set("MaximumRatIndex")} min={0} max={50} />
        <NumberField label="Days Until Max Rat Index" value={cfg.DaysUntilMaximumRatIndex} onChange={set("DaysUntilMaximumRatIndex")} min={0} max={365} />
      </Section>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => setCfg({ ...orig })} label="Unsaved vehicle & animal changes — server restart required" />
    </>
  );
}
