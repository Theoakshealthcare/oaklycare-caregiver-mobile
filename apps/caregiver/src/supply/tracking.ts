/**
 * When, and how, the app shares the caregiver's location. Pure functions only: the native
 * plumbing lives in `locationTracker.ts` and `backgroundLocationTask.ts`.
 *
 *   off         nothing is sent
 *   foreground  available for work, no visit: expo-location watch while the app is open
 *   background  a visit is active: expo-task-manager keeps sending with the app closed
 */
export type TrackingMode = "off" | "foreground" | "background";

export interface TrackingInput {
  /** `profile_status` from GET /caregiver/home. Only approved caregivers are ever tracked. */
  profileStatus: string;
  isAvailable: boolean;
  /**
   * Statuses of the visits in home `today_visits` (the backend keeps en_route and in_progress
   * there whatever their date). Visits due tomorrow or later (`upcoming_visits`) do not count.
   */
  todayVisitStatuses: readonly string[];
  foregroundGranted: boolean;
  backgroundGranted: boolean;
}

/** accepted / en_route / in_progress: the statuses where a caregiver holds a live visit. */
const ACTIVE_VISIT: readonly string[] = ["accepted", "en_route", "in_progress"];

export function hasActiveVisit(statuses: readonly string[]): boolean {
  return statuses.some((s) => ACTIVE_VISIT.includes(s));
}

/**
 * - Not approved: off.
 * - Active visit: background when "Always" is granted, else foreground (the app is open on the visit).
 * - Available with no visit: foreground only. Going available never asks for background access.
 * - Otherwise off. Going unavailable, or completing the last visit, stops tracking.
 * Without foreground permission nothing can run.
 */
export function decideTracking(input: TrackingInput): TrackingMode {
  if (input.profileStatus !== "approved" || !input.foregroundGranted) return "off";
  if (hasActiveVisit(input.todayVisitStatuses)) {
    return input.backgroundGranted ? "background" : "foreground";
  }
  return input.isAvailable ? "foreground" : "off";
}

/** Foreground cadence from the plan: at most every 60 s, and whenever the caregiver moves more than 100 m. */
export const FOREGROUND_MIN_INTERVAL_MS = 60_000;
export const FOREGROUND_MIN_DISTANCE_M = 100;
/** During a visit the guide asks for a ping every 10 to 15 s. */
export const VISIT_INTERVAL_MS = 15_000;

export interface Fix {
  latitude: number;
  longitude: number;
  /** Epoch ms of the fix. */
  timestamp: number;
}

/** Great-circle distance in metres. */
export function distanceMeters(
  a: Pick<Fix, "latitude" | "longitude">,
  b: Pick<Fix, "latitude" | "longitude">,
): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Foreground throttle: send the first fix, then only when 60 s have passed since the last send or
 * the caregiver moved more than 100 m from where it was sent. iOS ignores the watch's time
 * interval, so this is the single source of truth for the cadence.
 */
export function shouldSendForeground(last: Fix | null, next: Fix): boolean {
  if (!last) return true;
  if (next.timestamp - last.timestamp >= FOREGROUND_MIN_INTERVAL_MS) return true;
  return distanceMeters(last, next) > FOREGROUND_MIN_DISTANCE_M;
}
