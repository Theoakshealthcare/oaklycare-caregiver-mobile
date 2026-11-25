import type { PatientVital } from "@/src/services/vitals.service";

/**
 * The clinician-approved rating the server sends with every reading (`flag`; null for sleep, weight and a value that is not a
 * number). The app NEVER works a rating out from a reading: it shows what the server says. The thresholds, and the extra
 * rules for a patient's conditions, live only in the backend (`app/services/vital_flags.py`).
 */
export type VitalFlagStatus = "normal" | "high" | "low" | "critical";

export interface VitalFlag {
  status: VitalFlagStatus;
  /** "Normal" | "High" | "Low" | "Critical", as the server words it. */
  label: string;
  /** Why it is flagged; null for normal. */
  reason: string | null;
  /** True for critical: show `message`. */
  emergency: boolean;
  /** "This may be an emergency. Call 112 now." when `emergency`, else null. */
  message: string | null;
}

const STATUSES: readonly string[] = ["normal", "high", "low", "critical"];

/** The flag of a server row, or null when there is none or it is a status this build does not know (shown unrated, never guessed). */
export function toFlag(raw: PatientVital["flag"] | undefined): VitalFlag | null {
  if (!raw || !STATUSES.includes(raw.status)) return null;
  return {
    status: raw.status as VitalFlagStatus,
    label: raw.label,
    reason: raw.reason ?? null,
    emergency: raw.emergency === true,
    message: raw.message ?? null,
  };
}
