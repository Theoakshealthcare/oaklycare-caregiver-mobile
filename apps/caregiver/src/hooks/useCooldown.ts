import { useCallback, useEffect, useState } from "react";

/** A countdown in whole seconds (the resend throttle). `start(n)` restarts it; it stops at 0 and on unmount. */
export function useCooldown(initialSeconds = 0): [number, (seconds: number) => void] {
  const [left, setLeft] = useState(initialSeconds);

  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  const start = useCallback((seconds: number) => setLeft(Math.max(0, Math.ceil(seconds))), []);
  return [left, start];
}
