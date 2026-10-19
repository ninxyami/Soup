// Event API calls for the player page (/p). Token only, no Discord login. The API binds the token to this
// device with its own `th_dev` cookie, so every call sends credentials.
// Dev only: a token like `mock-<step>` uses local fake answers (lib/th/mock.ts). The `process.env.NODE_ENV` checks
// are written inline on purpose: the production build drops those branches and never bundles the mock.
import { API } from "@/lib/constants";
import type { ActAction, ActResult, Me } from "./types";

export class ThError extends Error {
  status: number;
  constructor(msg: string, status: number) {
    super(msg);
    this.status = status;
  }
}

async function call(path: string, body?: unknown) {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: body === undefined ? "GET" : "POST",
      credentials: "include",
      cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ThError("No connection. Check your signal, this page keeps trying.", 0);
  }
  let data: any = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const msg = typeof data?.detail === "string" ? data.detail
      : res.status === 429 ? "Slow down a little, then try again."
      : res.status === 404 ? "This phone link is not known."
      : `Something went wrong (${res.status}).`;
    throw new ThError(msg, res.status);
  }
  return data;
}

export async function thMe(t: string): Promise<Me> {
  if (process.env.NODE_ENV !== "production" && t.startsWith("mock-")) {
    const m = await import("./mock");
    return m.mockMe(t);
  }
  return call(`/api/th/me?t=${encodeURIComponent(t)}`);
}

export async function thAct(t: string, from: string, action: ActAction, payload: Record<string, unknown>): Promise<ActResult> {
  if (process.env.NODE_ENV !== "production" && t.startsWith("mock-")) {
    const m = await import("./mock");
    return m.mockAct(t, from, action, payload);
  }
  return call("/api/th/act", { t, from, action, payload });
}

export async function thResult(t: string, id: string): Promise<ActResult> {
  if (process.env.NODE_ENV !== "production" && t.startsWith("mock-")) {
    const m = await import("./mock");
    return m.mockResult(id);
  }
  return call(`/api/th/result/${encodeURIComponent(id)}`);
}

// Map crops for this team (loc2 / final), served by the API
export async function thImg(t: string, kind: "loc2" | "final"): Promise<string> {
  if (process.env.NODE_ENV !== "production" && t.startsWith("mock-")) {
    const m = await import("./mock");
    return m.mockImg(kind);
  }
  return `${API}/api/th/img/${kind}?t=${encodeURIComponent(t)}`;
}

// An image url from the API may be relative ("/api/th/img/loc2?t=..")
export function apiUrl(u: string) {
  return u.startsWith("/api/") ? `${API}${u}` : u;
}
