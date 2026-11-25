import type { Schemas } from "@oakly/api-client";

/**
 * The Normal / High / Low / Critical rating of a reading. It is the SERVER's (`flag` on every reading the vitals API returns;
 * thresholds signed off by the clinical lead, in `backend/app/services/vital_flags.py`): the app shows what it is sent and never
 * works a rating out from a number. `flag` is null for sleep (never rated) and for a reading the server could not rate, and
 * then nothing is drawn: no badge is not "Normal".
 */
export type VitalStatus = "normal" | "high" | "low" | "critical";

export interface VitalFlag {
  status: VitalStatus;
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

/** The flag of a server row, or null when there is none or its status is one this build does not know (shown unrated, never guessed). */
export function toFlag(raw: Schemas["PatientVitalResponse"]["flag"] | undefined): VitalFlag | null {
  if (!raw || !STATUSES.includes(raw.status)) return null;
  return {
    status: raw.status as VitalStatus,
    label: raw.label,
    reason: raw.reason ?? null,
    emergency: raw.emergency === true,
    message: raw.message ?? null,
  };
}
