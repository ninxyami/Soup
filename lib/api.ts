import { API } from "./constants";

export async function getMe(): Promise<any | null> {
  try {
    const res = await fetch(`${API}/auth/me`, { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function apiFetch(path: string, options?: RequestInit) {
  return fetch(`${API}${path}`, { credentials: "include", ...options });
}

export function bronzeToDisplay(b: number): string {
  // no gold (Nin 2026-10-13): silver + bronze. (It used to show gold with the silver icon.)
  if (b >= 1000) {
    const s = Math.floor(b / 1000);
    const r = b % 1000;
    return r ? `${s.toLocaleString("en-US")} ⚪ ${r} 🟤` : `${s.toLocaleString("en-US")} ⚪`;
  }
  return `${b} 🟤`;
}
