import { Platform } from "react-native";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Native maps app deep links: Apple Maps on iOS, the Google Maps directions URL everywhere else. */
export function buildDirectionsUrl({ latitude, longitude }: Coordinates, os: string = Platform.OS): string {
  return os === "ios"
    ? `http://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

/** Statuses where the caregiver holds a live assignment; a finished or un-accepted job has no route to show. */
const ACTIVE_STATUSES: readonly string[] = ["accepted", "en_route", "in_progress"];

interface DirectionsSource {
  status: string;
  patient_latitude?: number | null;
  patient_longitude?: number | null;
}

/** The visit location, only while the job is active and the booking really carries coordinates. */
export function directionsTarget(booking: DirectionsSource): Coordinates | null {
  if (!ACTIVE_STATUSES.includes(booking.status)) return null;
  const { patient_latitude: latitude, patient_longitude: longitude } = booking;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  // 0,0 is a "no location" placeholder, not a place in Lagos.
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}
