import * as Location from "expo-location";

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
