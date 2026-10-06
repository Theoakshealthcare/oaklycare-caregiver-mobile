import type { Schemas } from "@oakly/api-client";

import { api } from "@/src/api/client";
import { unwrap } from "@/src/api/unwrap";

export type LocationPing = Schemas["CaregiverLocationUpdate"];
export type CaregiverHome = Schemas["CaregiverHome"];

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

/**
 * The body of a location ping. It NEVER carries `is_available`: on the backend an omitted flag
 * leaves availability exactly as it is, while `true` would silently turn a caregiver back on
 * (guide, section 5). Availability only changes through POST /caregiver/availability.
 */
export function buildPing(coords: Coords): LocationPing {
  const ping: LocationPing = { latitude: coords.latitude, longitude: coords.longitude };
  // GPS reports -1 for "unknown" accuracy / heading / speed; the backend validates >= 0.
  if (coords.accuracy != null && coords.accuracy >= 0) ping.accuracy = coords.accuracy;
  if (coords.heading != null && coords.heading >= 0) ping.heading = coords.heading;
  if (coords.speed != null && coords.speed >= 0) ping.speed = coords.speed;
  return ping;
}

export const locationService = {
  /** POST /booking/caregiver/location. A first ping creates the location record (unavailable). */
  ping(coords: Coords) {
    return unwrap(api.POST("/api/v1/booking/caregiver/location", { body: buildPing(coords) }));
  },

  /** POST /caregiver/availability. The only call that changes the switch. */
  setAvailability(isAvailable: boolean) {
    return unwrap(api.POST("/api/v1/caregiver/availability", { body: { is_available: isAvailable } }));
  },

  getHome() {
    return unwrap(api.GET("/api/v1/caregiver/home"));
  },
};
