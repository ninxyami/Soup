"use client";
// Seconds left on a timed board (vial sort, wiring). `started` is set by the API the first time it serves the board,
// on the server clock; 0 means "not yet", then the timer counts from when this page first saw the board.
import { useEffect, useRef, useState } from "react";

export function useTimer(started: number, timeS: number, serverNow: () => number) {
  const firstSeen = useRef(0);
  if (!firstSeen.current) firstSeen.current = serverNow();
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force(x => x + 1), 250);
    return () => clearInterval(id);
  }, []);
  const begin = started || firstSeen.current;
  return Math.max(0, begin + timeS - serverNow());
}

export function fmtClock(s: number) {
  const v = Math.ceil(s);
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
}
