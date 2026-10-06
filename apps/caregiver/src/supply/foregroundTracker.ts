import * as Location from "expo-location";

import { coordsFromLocation } from "./coords";
import type { Coords } from "./locationService";
import { FOREGROUND_MIN_DISTANCE_M, FOREGROUND_MIN_INTERVAL_MS, shouldSendForeground, type Fix } from "./tracking";

export interface ForegroundTrackerDeps {
  /** Subscribes to position changes; returns an unsubscribe. */
  watch(onFix: (fix: Fix & Coords) => void): Promise<() => void>;
  /** One current fix, for the 60 s heartbeat (a stationary caregiver would otherwise go stale on iOS). */
  getCurrent(): Promise<(Fix & Coords) | null>;
  send(coords: Coords): Promise<unknown>;
  now?: () => number;
}

/**
 * Foreground location while the caregiver is available. The watch reports moves of 100 m or more;
 * a 60 s heartbeat keeps the position fresh when they stand still (offers need a fix newer than
 * 15 minutes). Both go through the same throttle, so pings are never closer than 60 s unless the
 * caregiver moved more than 100 m.
 */
export function createForegroundTracker(deps: ForegroundTrackerDeps) {
  let stop: (() => void) | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let last: Fix | null = null;
  let generation = 0;

  async function onFix(fix: Fix & Coords): Promise<void> {
    if (!shouldSendForeground(last, fix)) return;
    last = { latitude: fix.latitude, longitude: fix.longitude, timestamp: fix.timestamp };
    try {
      await deps.send(fix);
    } catch {
      // Dropped ping: allow the next fix through immediately instead of waiting out the interval.
      last = null;
    }
  }

  return {
    async start(): Promise<void> {
      if (stop) return;
      const mine = ++generation;
      const unsubscribe = await deps.watch((fix) => void onFix(fix));
      if (mine !== generation) {
        // stop() ran while the watch was being set up.
        unsubscribe();
        return;
      }
      stop = unsubscribe;
      timer = setInterval(() => {
        void deps.getCurrent().then((fix) => (fix ? onFix(fix) : undefined)).catch(() => undefined);
      }, FOREGROUND_MIN_INTERVAL_MS);
    },
    stop(): void {
      generation += 1;
      stop?.();
      stop = null;
      if (timer) clearInterval(timer);
      timer = null;
      last = null;
    },
    isRunning: () => stop !== null,
  };
}

function toFix(location: Location.LocationObject): Fix & Coords {
  return { ...coordsFromLocation(location), timestamp: location.timestamp };
}

export function createExpoForegroundTracker(send: (coords: Coords) => Promise<unknown>) {
  return createForegroundTracker({
    send,
    async watch(onFix) {
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: FOREGROUND_MIN_INTERVAL_MS,
          distanceInterval: FOREGROUND_MIN_DISTANCE_M,
        },
        (location) => onFix(toFix(location)),
      );
      return () => sub.remove();
    },
    async getCurrent() {
      return toFix(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    },
  });
}

/** One current position for the availability flow, or null when it cannot be read. */
export async function readCurrentPosition(): Promise<Coords | null> {
  try {
    return coordsFromLocation(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  } catch {
    return null;
  }
}
