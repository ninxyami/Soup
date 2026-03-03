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
  if (b >= 10000) {
    const g = Math.floor(b / 10000);
    const s = Math.floor((b % 10000) / 1000);
    const r = b % 1000;
    return `${g} ⚪ ${s} ⚫ ${r} 🟤`;
  } else if (b >= 1000) {
    const s = Math.floor(b / 1000);
    const r = b % 1000;
    return `${s} ⚫ ${r} 🟤`;
  }
  return `${b} 🟤`;
}
