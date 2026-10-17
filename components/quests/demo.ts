// @ts-nocheck
// components/quests/demo.ts: made-up quest data for checking the /quests layout on a local dev server (?demo=1).
// Built from the v2 preview file so the Rewards view has real-sized rows (20-60 templates). Not real game data.

export function demoData(preview) {
  const rows = [];
  const types = ["horde", "code", "bag", "deliver", "visit", "bring", "cook", "smith", "glass", "camp", "beast", "escort"];
  const names = { horde: "Horde", code: "Treasure", bag: "Her bag", deliver: "Delivery", visit: "Visit", bring: "Bring", cook: "Cook",
    smith: "Smith", glass: "Glass", camp: "Bandit camp", beast: "Beast hunt", escort: "Escort" };
  for (const t of types) for (const tier of ["D", "C", "B", "A", "S"]) {
    const id = `${t}_${tier.toLowerCase()}`;
    const list = (preview?.rows?.[id] || []).map((x) => ({ rep: x.r || 0, items: x.i }));
    // the game has a few rows already set by hand, and some with more templates than the new set
    const variants = id === "horde_b" ? list.concat(list.slice(0, 6)) : id === "cook_c" ? list.slice(0, 12) : list.slice(0, Math.max(0, list.length - 8));
    rows.push({ id, name: `${names[t]} ${tier}`, type: t, tier, rep: 0, items: variants[0]?.items || [], custom: variants.length > 0,
      text: "", default: "", variants });
  }
  // an old per-type row with no templates: the game reports its built-in reward in `items` (2026-10-12 live case)
  rows.push({ id: "code", name: "Treasure", type: "code", tier: "", rep: 0, items: [["Base.TinnedBeans", 2], ["Base.Bandage", 2]], custom: false,
    text: "", default: "", variants: [] });
  const now = Math.floor(Date.now() / 1000);
  const quests = [
    { id: "q27", title: "The Riverside horde", type: "horde", tier: "C", kind: "personal", town: "Riverside", left: 16260, pay: "1 silver", racers: [] },
    { id: "q33", title: "Iron for the watchtower", type: "smith", tier: "B", kind: "big", big: true, town: "Muldraugh", left: 16860, pay: "2.5 silver", racers: [{ name: "Warrior" }] },
    { id: "q34", title: "Clear the hunting trail", type: "horde", tier: "D", kind: "small", town: "Rosewood", left: 2940, pay: "500 bronze", racers: [] },
    { id: "q35", title: "Duct tape run", type: "deliver", tier: "D", kind: "small", town: "West Point", left: 3000, pay: "500 bronze", racers: [{ name: "tuquyy" }, { name: "Kise" }] },
    { id: "q37", title: "Treasure near Fallas Lake", type: "code", tier: "B", kind: "exclusive", town: "Fallas Lake", left: 9060, pay: "3.12 silver", racers: [] },
  ];
  const ctlTypes = types.map((t, i) => ({ id: t, name: names[t], tiers: t === "beast" ? "AS" : "DCBA", board: t !== "escort", on: i < 10, live: t !== "escort",
    new: i > 9, tested: i < 8, testedBy: "Nin", testedAt: now - 86400 * (i + 1), note: i < 8 ? "Works" : "", twists: i < 5 ? "ambush,road" : "" }));
  return {
    state: {
      v: 2, at: now - 12, stale: false, testJobs: true, testGive: true, on: true, cap: 15000, totalKills: 22206, unlockAt: 5000,
      tierUnlocks: { A: 25000, S: 30000, SS: 35000, SSS: 40000, "SSS+": 45000 },
      tierUnlocksDefault: { A: 25000, S: 30000, SS: 35000, SSS: 40000, "SSS+": 45000 },
      tierOpen: { A: false, S: false, SS: false, SSS: false, "SSS+": false }, tierUnlocksCustom: false,
      tiers: [["D", 500, 30], ["C", 1500, 45], ["B", 2500, 60], ["A", 5000, 90], ["S", 20000, 240]].map(([id, pot, min]) =>
        ({ id, pot, potDefault: pot, cool: min * 60, coolDefault: min * 60, life: 7200 * (1 + "DCBAS".indexOf(id)), horde: 10 * (1 + "DCBAS".indexOf(id)), pts: 1 + "DCBAS".indexOf(id), quit: 100 * (1 + "DCBAS".indexOf(id)) })),
      ranks: [{ name: "Rookie", min: 0, maxTier: "B", quit: 0, tax: 0 }, { name: "Runner", min: 20, maxTier: "A", quit: 0.5, tax: 5 },
        { name: "Merc", min: 60, maxTier: "S", quit: 0.75, tax: 10 }, { name: "Legend", min: 150, maxTier: "S", quit: 1, tax: 15 }],
      ranksCustom: false, rows, quests,
      control: {
        switches: [{ id: "quests", name: "Zombita's Jobs", on: true, about: "Quests on the phone (Jobs app), traps, reward codes." },
          { id: "escort", name: "Escort jobs", on: false, about: "Escort a survivor across town." },
          { id: "derby", name: "Fishing Derby", on: false, about: "A weekend fishing contest." }],
        types: ctlTypes, twists: { on: true, chance: { D: 10, C: 15, B: 20, A: 25 }, custom: false, tested: true },
        derby: { on: false, left: 0, entries: 0, prizes: [{ coins: 5000, rep: 3 }, { coins: 3000, rep: 2 }, { coins: 1000, rep: 1 }] },
        community: { present: true, total: 12, complete: 4 }, sClasses: ["S", "SS", "SSS", "SSS+"],
      },
    },
    waiting: [{ id: "jw-1-aaaaaa", cmd: "set_reward", row: "cook_c", slot: 3, by: "Nin (website)", at: now - 40 }],
    log: [{ id: "jw-0-bbbbbb", cmd: "tier_unlocks", by: "Nin (website)", ok: true, msg: "Tier unlocks: A 25000, S 30000", at: now - 900 }],
    specials: [], ious: [],
  };
}
