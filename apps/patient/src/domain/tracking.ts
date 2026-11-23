import { utcIso } from "./dates";

/**
 * Where the caregiver is, as `GET /booking/booking/{id}/live-tracking` reports it. The app has no map (a map needs a native
 * module and a Google Maps key, and the owner has no key yet), so the screen shows the distance, the estimated arrival and how
 * fresh the position is, as text.
 */
export interface CaregiverPosition {
  latitude: number;
  longitude: number;
  distanceKm: number;
  /** The backend's estimate (straight-line distance at 25 km/h, never less than 5 minutes). */
  etaMinutes: number;
  /** When the caregiver's phone last reported this position (an ISO instant). */
  updatedAt: string;
  isMoving: boolean;
}

/**
 * What the patient is told:
 *  - `live`: a position is known;
 *  - `waiting`: nothing to show yet (404: the caregiver's phone has not shared a position);
 *  - `closed`: the booking is not accepted / on the way / in progress (409): tracking has ended or never began.
 */
export type LiveTracking = { kind: "live"; position: CaregiverPosition } | { kind: "waiting" } | { kind: "closed" };

/** A position older than this is called out as out of date instead of being presented as "now". */
export const STALE_AFTER_MINUTES = 5;

export function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
}

export function isStale(position: Pick<CaregiverPosition, "updatedAt">, now: number): boolean {
  return minutesSince(position.updatedAt, now) >= STALE_AFTER_MINUTES;
}

/** "just now", "3 minutes ago", "2 hours ago", "3 days ago". Relative, so no clock text depends on the phone's zone. */
export function agoText(iso: string, now: number): string {
  const minutes = minutesSince(iso, now);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

/** The short form on Home's vital tiles (Figma): "just now", "10 mins ago", "2 hours ago", "3 days ago". */
export function shortAgoText(iso: string, now: number): string {
  const minutes = minutesSince(iso, now);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "min" : "mins"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

/** "3.3 km away", "800 m away". */
export function distanceText(km: number): string {
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m away`;
  return `${km.toFixed(1)} km away`;
}

/** "about 8 minutes", "about 1 hour 5 minutes". It is an estimate and says so. */
export function etaText(minutes: number): string {
  if (minutes < 60) return `about ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `about ${hours} ${hours === 1 ? "hour" : "hours"}${rest ? ` ${rest} minutes` : ""}`;
}

/**
 * The caregiver's position in the phone's own maps app: a plain https link, no key and no native module. iOS gets the Apple Maps
 * link (it opens the Maps app at once; Google's page greets a first-time visitor with a cookie wall), everything else the
 * Google Maps link (Android opens the Maps app).
 */
export function mapsUrl(position: Pick<CaregiverPosition, "latitude" | "longitude">, os: string = "android"): string {
  const point = `${position.latitude},${position.longitude}`;
  return os === "ios" ? `https://maps.apple.com/?ll=${point}&q=Your%20caregiver` : `https://www.google.com/maps/search/?api=1&query=${point}`;
}

interface LiveTrackingBody {
  current_latitude: number;
  current_longitude: number;
  distance_km: number;
  estimated_arrival_minutes: number;
  last_updated: string;
  is_moving: boolean;
}

export function toPosition(body: LiveTrackingBody): CaregiverPosition {
  return {
    latitude: body.current_latitude,
    longitude: body.current_longitude,
    distanceKm: body.distance_km,
    etaMinutes: body.estimated_arrival_minutes,
    updatedAt: utcIso(body.last_updated),
    isMoving: body.is_moving,
  };
}
