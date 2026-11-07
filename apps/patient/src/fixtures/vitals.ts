import type { VitalAccessEntry, VitalReading } from "@/src/domain/vitals";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Placeholder readings until the vitals slice reads `GET /vitals/{patient_id}`. Values are made up. */
export function sampleReadings(now = Date.now()): VitalReading[] {
  const at = (offset: number) => new Date(now + offset).toISOString();
  return [
    { id: "r1", kind: "heart_rate", value: 74, recordedAt: at(-2 * HOUR) },
    { id: "r2", kind: "heart_rate", value: 80, recordedAt: at(-1 * DAY) },
    { id: "r3", kind: "heart_rate", value: 71, recordedAt: at(-3 * DAY) },
    { id: "r4", kind: "blood_pressure", value: 124, secondary: 82, recordedAt: at(-2 * HOUR) },
    { id: "r5", kind: "blood_pressure", value: 130, secondary: 84, recordedAt: at(-2 * DAY) },
    { id: "r6", kind: "temperature", value: 36.7, recordedAt: at(-2 * HOUR) },
    { id: "r7", kind: "respiratory_rate", value: 16, recordedAt: at(-2 * HOUR) },
    { id: "r8", kind: "blood_glucose", value: 105, recordedAt: at(-1 * DAY) },
    { id: "r9", kind: "sleep", value: 6.5, recordedAt: at(-1 * DAY) },
  ];
}

export function sampleAccess(): VitalAccessEntry[] {
  return [
    { id: "a1", caregiverName: "Sample Nurse", granted: true, grantedAt: new Date(Date.now() - 2 * DAY).toISOString() },
    { id: "a2", caregiverName: "Another Sample Nurse", granted: false, grantedAt: null },
  ];
}
