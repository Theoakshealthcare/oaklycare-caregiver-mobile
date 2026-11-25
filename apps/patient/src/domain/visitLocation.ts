import type { BookingDraft } from "./booking";

/** The parts of the phone's geocoder answer that make an address line (expo-location's `LocationGeocodedAddress`, as far as it is used). */
export interface PlaceParts {
  name?: string | null;
  streetNumber?: string | null;
  street?: string | null;
  district?: string | null;
  city?: string | null;
  region?: string | null;
  formattedAddress?: string | null;
}

const clean = (value: string | null | undefined) => (value ?? "").trim();

/**
 * One readable line for a place the geocoder found ("12 Allen Avenue, Ikeja, Lagos"), or null when it gave nothing the person could
 * recognise. The street line is the street number and street (or the placemark name when there is no street); parts that repeat
 * the one before are dropped, so a city that is also the region is said once.
 */
export function formatPlace(place: PlaceParts | null | undefined): string | null {
  if (!place) return null;
  const street = [clean(place.streetNumber), clean(place.street)].filter(Boolean).join(" ");
  const line = street || clean(place.name);
  const parts: string[] = [];
  for (const part of [line, clean(place.district), clean(place.city), clean(place.region)]) {
    if (part && parts.at(-1)?.toLowerCase() !== part.toLowerCase()) parts.push(part);
  }
  if (parts.length > 0) return parts.join(", ");
  return clean(place.formattedAddress) || null;
}

type AddressFields = Pick<BookingDraft, "address" | "city" | "state">;

/** The typed visit address as one lower-cased line, so that only a real edit (not spacing or capitals) changes it; "" while nothing is typed. */
export const addressKey = ({ address, city, state }: AddressFields): string => {
  const parts = [address, city, state].map((part) => part.trim().toLowerCase().replace(/\s+/g, " "));
  // Nothing typed at all is "" (so a position taken before any address was typed is told apart from an edited address).
  return parts.every((part) => part === "") ? "" : parts.join(" | ");
};

/** The text handed to the phone's geocoder: the typed address with the country added, which keeps it from resolving to another country. */
export const addressQuery = ({ address, city, state }: AddressFields): string =>
  [address, city, state, "Nigeria"].map((part) => part.trim()).filter(Boolean).join(", ");

/** True when the three typed parts are all filled in, the least a lookup needs. */
export const hasTypedAddress = ({ address, city, state }: AddressFields): boolean => Boolean(address.trim() && city.trim() && state.trim());

type LocationFields = Pick<BookingDraft, "latitude" | "longitude" | "locationSource" | "locationKey"> & AddressFields;

export const hasCoordinates = (draft: Pick<BookingDraft, "latitude" | "longitude">): boolean => draft.latitude !== null && draft.longitude !== null;

/**
 * Whether the coordinates no longer belong to the typed address. A looked-up address is stale after ANY edit of it. A position taken
 * with "Use my current location" is stale only when an address that was already typed at that moment has since been changed (typing
 * the address in after standing there is the normal order and is not an edit).
 */
export function locationIsStale(draft: LocationFields): boolean {
  if (!hasCoordinates(draft)) return false;
  const now = addressKey(draft);
  if (draft.locationSource === "address") return now !== draft.locationKey;
  return draft.locationKey !== "" && now !== draft.locationKey;
}

/** What the draft is cleared to when its coordinates go stale. */
export const NO_LOCATION: Pick<BookingDraft, "latitude" | "longitude" | "locationSource" | "locationLabel" | "locationKey"> = {
  latitude: null,
  longitude: null,
  locationSource: null,
  locationLabel: null,
  locationKey: "",
};
