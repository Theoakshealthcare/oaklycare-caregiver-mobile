/**
 * Background location for active visits (expo-location + expo-task-manager).
 *
 * `TaskManager.defineTask` must run at module scope, before the app renders, so this file is
 * imported by `index.ts`. The task body runs without any React tree: it restores the session if
 * the process was started headless, then sends one ping per batch. It sends NO `is_available`.
 */
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { session } from "@/src/auth";

import { coordsFromLocation } from "./coords";
import { locationService } from "./locationService";
import { shouldKeepVisitTracking, VISIT_INTERVAL_MS, VISIT_RECHECK_MS } from "./tracking";

export const VISIT_LOCATION_TASK = "oakly-visit-location";

interface LocationTaskData {
  locations: Location.LocationObject[];
}

export async function stopVisitUpdates(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(VISIT_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(VISIT_LOCATION_TASK);
  }
}

export async function startVisitUpdates(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(VISIT_LOCATION_TASK)) return;
  await Location.startLocationUpdatesAsync(VISIT_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: VISIT_INTERVAL_MS,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Oakly visit in progress",
      notificationBody: "Sharing your location until you complete the visit.",
    },
  });
}

// In-memory only: a fresh (headless) process re-checks on its first batch.
let lastVisitCheck = 0;

TaskManager.defineTask<LocationTaskData>(VISIT_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const latest = data.locations[data.locations.length - 1];
  if (!latest) return;

  // Started headless by the OS: the in-memory session is empty until restored from the keychain.
  if (session.store.getState().status === "restoring") await session.restore();
  if (!session.getAccessToken()) {
    // Signed out while a visit task was still registered: nothing may be sent, stop for good.
    await stopVisitUpdates();
    return;
  }
  try {
    await locationService.ping(coordsFromLocation(latest));
  } catch {
    // A dropped ping is fine: the next batch carries a newer position.
  }
  // The visit may have been completed or cancelled while the app was closed: re-check now and then
  // and stop instead of waking forever.
  if (Date.now() - lastVisitCheck >= VISIT_RECHECK_MS) {
    lastVisitCheck = Date.now();
    try {
      const home = await locationService.getHome();
      if (!shouldKeepVisitTracking(home)) await stopVisitUpdates();
    } catch {
      // Offline: keep going and try again at the next re-check.
    }
  }
});
