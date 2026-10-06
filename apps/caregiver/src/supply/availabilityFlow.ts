import type { Coords } from "./locationService";

export interface AvailabilityDeps {
  /** Explains, then asks for foreground location when needed. True when granted. */
  ensureForegroundLocation(): Promise<boolean>;
  /** One current fix, or null when none could be read. */
  getPosition(): Promise<Coords | null>;
  /** POST /booking/caregiver/location (never with is_available). */
  ping(coords: Coords): Promise<unknown>;
  /** POST /caregiver/availability. */
  setAvailability(isAvailable: boolean): Promise<{ is_available: boolean }>;
}

export type GoAvailableResult =
  | { ok: true }
  | { ok: false; reason: "permission_denied" | "position_unavailable" };

export const AVAILABILITY_PROBLEM_MESSAGE: Record<Extract<GoAvailableResult, { ok: false }>["reason"], string> = {
  permission_denied:
    "Oakly needs your location to offer you visits near you. Allow location access in Settings, then try again.",
  position_unavailable: "We couldn't get your location. Move to an open area and try again.",
};

/**
 * Going available is location-first: the backend refuses the switch (409 "Share your location
 * before going available") until a location record exists, and offers need a fresh one anyway.
 * So: permission, one position, one ping (no `is_available`), then the switch. ApiErrors from the
 * ping or the switch propagate to the caller to be mapped.
 */
export async function goAvailable(deps: AvailabilityDeps): Promise<GoAvailableResult> {
  if (!(await deps.ensureForegroundLocation())) return { ok: false, reason: "permission_denied" };
  const position = await deps.getPosition();
  if (!position) return { ok: false, reason: "position_unavailable" };
  await deps.ping(position);
  await deps.setAvailability(true);
  return { ok: true };
}

/** Going unavailable needs no location. Accepted visits are unaffected (guide, section 5). */
export async function goUnavailable(deps: Pick<AvailabilityDeps, "setAvailability">): Promise<void> {
  await deps.setAvailability(false);
}
