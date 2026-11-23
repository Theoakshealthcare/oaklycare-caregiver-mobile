import { useEffect, useState } from "react";

/** "10:10:00": whole hours, minutes and seconds of an elapsed span, two digits each (hours may pass 99). */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(total / 3600))}:${p(Math.floor((total % 3600) / 60))}:${p(total % 60)}`;
}

/**
 * The running timer in the clock-out dialog: time since the visit really started (the instant the visit code was
 * accepted). `null` when the app never saw the start (a visit resumed after a restart): the dialog then shows no timer
 * rather than a made-up one. Ticks once a second only while `active`.
 */
export function useElapsed(startMs: number | null, active: boolean, now: () => number = Date.now): string | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active || startMs === null) return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [active, startMs]);
  return startMs === null ? null : formatElapsed(now() - startMs);
}
