// lib/mapIcons.ts - the game's own map signs on the website map (mod 1.8.23, Nin 2026-10-19: "hattie needs her own icon for
// the map"). The same table as the mod's ZS_MapKiosks.lua MK.SHOP_ICONS and the same 24x24 PNGs (copied byte for byte from
// the mod into public/map/icons/), so a kiosk looks the same in game and on the site. A shop type with no sign of its own
// gets the cart, as in game.
export const MAP_ICON_DIR = "/map/icons";

export const SHOP_ICONS: Record<string, string> = {
  gardener: "map_shop_gardener.png",    // Maya: a cabbage
  weapons: "map_shop_weapons.png",      // Viktor: a pistol
  mechanic: "map_shop_mechanic.png",    // Sera: a wrench
  medical: "map_shop_medical.png",      // Dr. Voss: a red cross
  melee: "map_shop_melee.png",          // Bruno: an axe
  tailor: "map_shop_tailor.png",        // Colette: a shirt
  librarian: "map_shop_librarian.png",  // Miles: an open book
  music: "map_shop_music.png",          // Scarlett: a cassette
  animals: "map_shop_animals.png",      // Hattie: a paw print
  cars: "map_shop_cars.png",            // Duke: a car
};
export const CART_ICON = "map_cart.png";   // the general stores, and any shop type without its own sign
export const BUS_ICON = "map_bus.png";
export const DINER_ICON = "map_diner.png";

/** The sign for a place on the map: its shop type's, the cart for any other shop, the bus / diner signs; null = a plain dot. */
export function mapIconFor(p: { kind?: string; shop?: string }): string | null {
  if (p.kind === "shop") return `${MAP_ICON_DIR}/${SHOP_ICONS[String(p.shop || "")] || CART_ICON}`;
  if (p.kind === "bus") return `${MAP_ICON_DIR}/${BUS_ICON}`;
  if (p.kind === "diner") return `${MAP_ICON_DIR}/${DINER_ICON}`;
  return null;
}
