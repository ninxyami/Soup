export const API = "https://api.stateofundeadpurge.site:8443";
export const AVATAR_BASE = "https://stateofundeadpurge.site/avatars";
export const GUEST_LIMIT = 10;

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/server", label: "Server" },
  { href: "/shop", label: "Shop" },
  { href: "/marketplace", label: "Market" },
  { href: "/news", label: "Intel" },
  { href: "/mods", label: "Mods" },
  { href: "/seasons", label: "Season" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/players", label: "Players" },
  { href: "/archive", label: "Archive" },
  { href: "/zombita", label: "Zombita" },
  { href: "/whitelist", label: "Whitelist" },
];

export const ADMIN_NAV_LINKS = [
  { href: "/admin", label: "Admin" },
];

// ── Season ──────────────────────────────────────────────────────────────────
// Change these two lines when a new season starts. Everything on the site reads from here.
export const CURRENT_SEASON = "Season 1: New Dawn";
export const SEASON_SHORT   = "Season 1";
export const SEASON_SUBTITLE = "New Dawn";
