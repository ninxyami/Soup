"use client";
// @ts-nocheck
// app/admin/realtime.js
//
// P1 foundation — the shared real-time layer for the whole admin panel.
//
// PROBLEM with the old approach: AdminPanel used `<ActivePanel key={refreshKey}>`
// and bumped refreshKey on EVERY change broadcast. That remounts the entire tab
// from scratch on any change anywhere — losing scroll, open modals, in-progress
// typing, and firing even for changes the tab doesn't care about.
//
// THIS replaces that with a surgical model:
//   • ONE shared WebSocket for the whole panel (not one per tab).
//   • Every change broadcast carries a `scope` ("shop", "treasury", "mods"…).
//   • A tab calls useLiveRefresh(scope, reloadFn). When a change with a matching
//     scope arrives, the tab re-runs its OWN data loader IN PLACE. No remount,
//     no lost state, and only the relevant tabs react.
//
// Backend sends: { event:"change", scope, actor_id, action, description, at }
//
// Usage in a tab:
//   const loadItems = useCallback(async () => { ... }, []);
//   useEffect(() => { loadItems(); }, [loadItems]);
//   useLiveRefresh("shop", loadItems);   // ← that's the whole migration per tab

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

const WS_URL = "wss://api.stateofundeadpurge.site:8443/ws/admin";

const RealtimeContext = createContext(null);

// ── Provider: owns the single WebSocket, fans events out to subscribers ──
export function RealtimeProvider({ enabled = true, onToast, children }) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  // subscribers: Map<id, { scopes:Set<string>|null, cb:fn }>
  const subsRef = useRef(new Map());
  const subIdRef = useRef(0);

  const subscribe = useCallback((scopes, cb) => {
    const id = ++subIdRef.current;
    const scopeSet = scopes == null ? null : new Set(Array.isArray(scopes) ? scopes : [scopes]);
    subsRef.current.set(id, { scopes: scopeSet, cb });
    return () => { subsRef.current.delete(id); };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let reconnectTimer = null;

    const connect = () => {
      if (stopped) return;
      let ws;
      try { ws = new WebSocket(WS_URL); } catch { scheduleReconnect(); return; }
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => { setConnected(false); scheduleReconnect(); };
      ws.onerror = () => { try { ws.close(); } catch {} };
      ws.onmessage = (evt) => {
        let msg;
        try { msg = JSON.parse(evt.data); } catch { return; }
        if (msg.event !== "change") return;

        const scope = msg.scope || msg.data?.scope || null;

        // Optional toast for human-readable changes (kept from old behavior)
        const desc = msg.description || msg.data?.description;
        if (desc && onToast) {
          onToast(desc, msg.actor_name || msg.data?.actor_name, msg.actor_id || msg.data?.actor_id);
        }

        // Fan out to subscribers whose scope matches (or who listen to all)
        for (const { scopes, cb } of subsRef.current.values()) {
          if (scopes == null || (scope && scopes.has(scope))) {
            try { cb(msg); } catch {}
          }
        }
      };
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 4000);
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      if (wsRef.current) { try { wsRef.current.close(); } catch {} }
    };
  }, [enabled, onToast]);

  return (
    <RealtimeContext.Provider value={{ connected, subscribe }}>
      {children}
    </RealtimeContext.Provider>
  );
}

// ── Hook a tab uses to refresh-in-place when its scope changes ──
// scope: a string or array of strings (e.g. "shop" or ["shop","economy"])
// reloadFn: the tab's existing data loader (stable via useCallback)
// opts.debounceMs: coalesce bursts of changes (default 250ms)
export function useLiveRefresh(scope, reloadFn, opts = {}) {
  const ctx = useContext(RealtimeContext);
  const { debounceMs = 250 } = opts;
  const timerRef = useRef(null);
  const fnRef = useRef(reloadFn);
  fnRef.current = reloadFn;

  useEffect(() => {
    if (!ctx) return; // not inside a provider — no-op, tab still works via its own useEffect
    const unsub = ctx.subscribe(scope, () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try { fnRef.current?.(); } catch {}
      }, debounceMs);
    });
    return () => { clearTimeout(timerRef.current); unsub(); };
  }, [ctx, JSON.stringify(scope), debounceMs]);
}

// ── Connection status, for a header indicator ──
export function useRealtimeStatus() {
  const ctx = useContext(RealtimeContext);
  return ctx?.connected ?? false;
}
