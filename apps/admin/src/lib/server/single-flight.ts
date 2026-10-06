import { createHash } from "node:crypto";

/**
 * Serialise work per key. Used for the admin refresh: refresh tokens rotate on use and the backend
 * treats a second use of the same token as theft (it revokes every session of that admin), so two
 * concurrent refreshes with one cookie must become one upstream call.
 *
 * Callers that arrive while the call is in flight share its promise. After it settles the result is
 * kept for `graceMs`, because a second tab or request may have been sent with the old cookie before
 * the browser applied the rotated one. The map lives in this process's memory: it protects a single
 * Next.js instance; with several instances the proxy must pin a session to one (see the SOP).
 */
interface Entry {
  promise: Promise<unknown>;
  timer?: ReturnType<typeof setTimeout>;
}

const entries = new Map<string, Entry>();

export interface SingleFlightOptions<T> {
  /** How long to keep a settled result for late callers with the same key. Default 0. */
  graceMs?: number;
  /** Return false to drop the settled result at once (e.g. the upstream was unreachable). */
  reusable?: (value: T) => boolean;
}

/** Keys are hashed so refresh tokens are not held as map keys. */
export function flightKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function singleFlight<T>(key: string, fn: () => Promise<T>, options: SingleFlightOptions<T> = {}): Promise<T> {
  const { graceMs = 0, reusable = () => true } = options;
  const existing = entries.get(key);
  if (existing) return existing.promise as Promise<T>;

  const entry: Entry = { promise: Promise.resolve() };
  const drop = () => {
    if (entries.get(key) === entry) entries.delete(key);
    if (entry.timer) clearTimeout(entry.timer);
  };
  entry.promise = fn().then(
    (value) => {
      if (graceMs > 0 && reusable(value)) {
        entry.timer = setTimeout(drop, graceMs);
        entry.timer.unref?.();
      } else {
        drop();
      }
      return value;
    },
    (err: unknown) => {
      drop();
      throw err;
    },
  );
  entries.set(key, entry);
  return entry.promise as Promise<T>;
}

export function _resetSingleFlight(): void {
  for (const e of entries.values()) if (e.timer) clearTimeout(e.timer);
  entries.clear();
}
