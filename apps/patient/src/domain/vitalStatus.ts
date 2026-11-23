import type { VitalKind, VitalReading } from "./vitals";

export type VitalStatus = "normal" | "critical";

/**
 * The Normal / Critical badges of the Vitals home and the monitoring page. The component is built (`StatusBadge`) but the
 * badges are OFF, on purpose (owner, 2026-11-23): the thresholds below need a clinician's signature
 * (`backend/docs/clinical/clinician-review-pack.md`, section 3), and a wrong "Normal" can delay care. Nothing here may be
 * filled in from a guess or from the Figma numbers (the design's "Critical" on 138/85 and 16 breaths a minute are sample data).
 */
export const VITAL_STATUS_ENABLED = false;

/** Inclusive normal band per vital, in the vital's own unit. Empty until a clinician signs the numbers. */
export const VITAL_THRESHOLDS: Partial<Record<VitalKind, { min: number; max: number }>> = {};

/** The status of a reading, or null while the badges are off or the vital has no signed band. */
export function vitalStatus(reading: Pick<VitalReading, "kind" | "value">): VitalStatus | null {
  if (!VITAL_STATUS_ENABLED) return null;
  const band = VITAL_THRESHOLDS[reading.kind];
  if (!band) return null;
  return reading.value >= band.min && reading.value <= band.max ? "normal" : "critical";
}
