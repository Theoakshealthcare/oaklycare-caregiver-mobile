import * as Location from "expo-location";

import { formatPlace } from "@/src/domain/visitLocation";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Why the phone's location could not be read, in words for the person (a message, not a status code). */
export class LocationError extends Error {
  readonly denied: boolean;
  constructor(message: string, denied = false) {
    super(message);
    this.name = "LocationError";
    this.denied = denied;
  }
}

const TIMEOUT_MS = 20_000;

/**
 * The phone's location once, asked only when the person taps "Use my current location" (foreground permission only,
 * nothing runs in the background). The booking API needs coordinates, and the backend has no address lookup route.
 */
export async function getCurrentCoordinates(): Promise<Coordinates> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    throw new LocationError(
      permission.canAskAgain
        ? "Oakly needs your location to find caregivers near the visit address. Please allow it and try again."
        : "Location is switched off for Oakly. Turn it on in your phone's Settings, then try again.",
      true,
    );
  }
  const unreadable = new LocationError("We could not read your location. Please try again.");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(unreadable), TIMEOUT_MS);
      }),
    ]);
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    throw unreadable;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * The address text for a position, read with the phone's own geocoder (Apple's on iOS, Android's `Geocoder`): no Google key and no
 * server call. Null when the phone has none, is offline, or knows nothing about that spot: the caller then says only that the
 * location is saved.
 */
export async function addressOf(coords: Coordinates): Promise<string | null> {
  try {
    const places = await Location.reverseGeocodeAsync(coords);
    return formatPlace(places[0]);
  } catch {
    return null;
  }
}

/** A typed address found on the map: where it is, and the address text the geocoder gives for that spot (null when it gives none). */
export interface FoundAddress extends Coordinates {
  label: string | null;
}

/** Thrown by `findAddress` when the phone's geocoder could not be asked at all (offline, no geocoder service), as opposed to "no match". */
export class GeocoderUnavailable extends Error {
  constructor() {
    super("We could not look the address up right now.");
    this.name = "GeocoderUnavailable";
  }
}

/**
 * The typed address looked up on the phone (forward geocoding, `Location.geocodeAsync`), for a visit at somebody else's home. Needs
 * no location permission. Null when the geocoder found nothing; `GeocoderUnavailable` when it could not be asked. The first match is
 * used, and its address text is read back so the person can see what was understood.
 */
export async function findAddress(query: string): Promise<FoundAddress | null> {
  let matches: Location.LocationGeocodedLocation[];
  try {
    matches = await Location.geocodeAsync(query);
  } catch {
    throw new GeocoderUnavailable();
  }
  const first = matches[0];
  if (!first || !Number.isFinite(first.latitude) || !Number.isFinite(first.longitude)) return null;
  const coords = { latitude: first.latitude, longitude: first.longitude };
  return { ...coords, label: await addressOf(coords) };
}
