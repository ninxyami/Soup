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
  // subscribers: Map<id, { scopesOrMatcher, cb }>
  const subsRef = useRef(new Map());
  const subIdRef = useRef(0);

  // Keep onToast in a ref. If we put it in the WS effect's deps, every parent
  // render (which creates a new onToast arrow) would re-run the effect, tearing
  // down and recreating the WebSocket on a loop. Ref it; effect depends only on
  // `enabled`.
  const onToastRef = useRef(onToast);
  onToastRef.current = onToast;

  const subscribe = useCallback((scopesOrMatcher, cb) => {
    const id = ++subIdRef.current;
    subsRef.current.set(id, { scopesOrMatcher, cb });
    return () => { subsRef.current.delete(id); };
  }, []);

  // Expose a STABLE context object. If we spread {connected, subscribe} fresh
  // each render, `ctx` changes identity every render → every useLiveRefresh
  // effect (dep [ctx]) tears down and re-subscribes, cancelling its pending
  // debounce timer before it can fire. So we keep ONE stable object and mutate
  // its `connected` field in place.
  const ctxRef = useRef(null);
  if (ctxRef.current === null) {
    ctxRef.current = { connected, subscribe };
  }
  ctxRef.current.connected = connected;
  ctxRef.current.subscribe = subscribe;

  // Resolve a subscriber's current scope Set (supports a plain value, array,
  // Set, null=all, or a live matcher object exposing a `scopes` getter).
  const resolveScopes = (x) => {
    if (x == null) return null;
    if (x && typeof x === "object" && !(x instanceof Set) && !Array.isArray(x) && "scopes" in x) {
      return x.scopes; // live matcher getter → Set|null
    }
    if (x instanceof Set) return x;
    return new Set(Array.isArray(x) ? x : [x]);
  };

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
        if (desc && onToastRef.current) {
          onToastRef.current(desc, msg.actor_name || msg.data?.actor_name, msg.actor_id || msg.data?.actor_id);
        }

        // Fan out to subscribers whose scope matches (or who listen to all)
        for (const { scopesOrMatcher, cb } of subsRef.current.values()) {
          const scopes = resolveScopes(scopesOrMatcher);
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
  }, [enabled]); // only re-run when enabled flips; onToast is reffed

  return (
    <RealtimeContext.Provider value={ctxRef.current}>
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
  const { debounceMs = 250, debug = false, shouldReload, onSkip } = opts;
  const timerRef = useRef(null);
  const fnRef = useRef(reloadFn);
  fnRef.current = reloadFn;            // always points at the latest loader
  const guardRef = useRef(shouldReload);
  guardRef.current = shouldReload;     // latest guard (e.g. () => !dirty)
  const skipRef = useRef(onSkip);
  skipRef.current = onSkip;            // called when a reload is suppressed

  // Keep scope in a ref so the subscription effect NEVER needs to re-run when
  // the parent re-renders (which is what was tearing the subscription down
  // after the first refresh). Subscribe exactly once per mount.
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  useEffect(() => {
    if (!ctx) return;
    // Subscribe with a scope-matcher that reads the ref live, so we can pass a
    // stable () => {} and never resubscribe on re-render.
    const matcher = {
      get scopes() {
        const s = scopeRef.current;
        return s == null ? null : new Set(Array.isArray(s) ? s : [s]);
      },
    };
    const unsub = ctx.subscribe(matcher, (msg) => {
      if (debug) console.log("[useLiveRefresh] event matched, scope", scopeRef.current, "action", msg.action);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        // If a guard says don't reload now (e.g. admin is mid-edit / form dirty),
        // skip the reload and notify instead of clobbering unsaved work.
        const guard = guardRef.current;
        if (typeof guard === "function" && !guard()) {
          if (debug) console.log("[useLiveRefresh] reload SKIPPED (guard false)");
          try { skipRef.current?.(msg); } catch {}
          return;
        }
        if (debug) console.log("[useLiveRefresh] debounce elapsed → calling reloadFn now");
        try {
          const r = fnRef.current?.();
          if (debug) console.log("[useLiveRefresh] reloadFn called, returned:", r);
        } catch (e) { if (debug) console.log("[useLiveRefresh] reload err", e); }
      }, debounceMs);
    });
    return () => { unsub(); };
    // Depends ONLY on ctx (now a stable object) — subscribe once, live-read
    // scope via ref. We do NOT clear the pending timer here, so a queued reload
    // still fires even if this effect re-runs.
  }, [ctx]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ── Connection status, for a header indicator ──
export function useRealtimeStatus() {
  const ctx = useContext(RealtimeContext);
  return ctx?.connected ?? false;
}
