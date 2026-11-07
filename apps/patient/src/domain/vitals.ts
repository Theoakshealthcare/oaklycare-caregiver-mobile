import type { Schemas } from "@oakly/api-client";

import type { IconName } from "@/src/components/ui/icon";

import { utcIso } from "./dates";

/**
 * The six vitals. The backend stores `vital_type` as free text, so these keys are the apps' shared vocabulary: the caregiver
 * app writes and reads the same ones (`sleep_duration`, not `sleep`), so a reading entered here shows up there and back.
 */
export type VitalKind = "heart_rate" | "blood_pressure" | "temperature" | "respiratory_rate" | "blood_glucose" | "sleep_duration";
export type VitalRange = "day" | "week" | "month";

export interface VitalMeta {
  kind: VitalKind;
  label: string;
  /** The unit as it should read on screen (and as it is sent): `bpm`, `mmHg`, `°C`, `breaths/min`, `mg/dL`, `hrs`. */
  unit: string;
  icon: IconName;
}

export const VITALS: readonly VitalMeta[] = [
  { kind: "heart_rate", label: "Heart rate", unit: "bpm", icon: "heart-outline" },
  { kind: "blood_pressure", label: "Blood pressure", unit: "mmHg", icon: "pulse-outline" },
  { kind: "temperature", label: "Temperature", unit: "°C", icon: "thermometer-outline" },
  { kind: "respiratory_rate", label: "Respiratory rate", unit: "breaths/min", icon: "cloud-outline" },
  { kind: "blood_glucose", label: "Blood glucose", unit: "mg/dL", icon: "water-outline" },
  { kind: "sleep_duration", label: "Sleep duration", unit: "hrs", icon: "moon-outline" },
];

export const vitalMeta = (kind: VitalKind): VitalMeta => VITALS.find((v) => v.kind === kind) ?? VITALS[0];

/** When a glucose reading was taken. Stored in the reading's `notes` as the caregiver app does: RBS random, FBS fasting, PP after a meal. */
export type GlucoseContext = "RBS" | "FBS" | "PP";
export const GLUCOSE_CONTEXTS: readonly { value: GlucoseContext; label: string }[] = [
  { value: "RBS", label: "Random" },
  { value: "FBS", label: "Fasting" },
  { value: "PP", label: "After meal" },
];

export interface VitalReading {
  id: string;
  kind: VitalKind;
  /** The value, or the top (systolic) number for blood pressure; hours for sleep. */
  value: number;
  /** The bottom (diastolic) number, blood pressure only. */
  secondary?: number;
  /** ISO with a zone. */
  recordedAt: string;
  glucoseContext?: GlucoseContext;
  /** Sleep only, "22:30" / "06:30", when the entry recorded them. */
  sleepStart?: string;
  sleepWake?: string;
}

export interface VitalInput {
  kind: VitalKind;
  value: number;
  secondary?: number;
  glucoseContext?: GlucoseContext;
  sleepStart?: string;
  sleepWake?: string;
}

/** "128/80" for blood pressure, else the number. */
export function readingText(reading: Pick<VitalReading, "value" | "secondary">): string {
  return reading.secondary !== undefined ? `${reading.value}/${reading.secondary}` : String(reading.value);
}

// --- what the backend sends and takes ---------------------------------------------------------------------------------

type ApiVital = Schemas["PatientVitalResponse"];
const KINDS: readonly string[] = VITALS.map((v) => v.kind);
const GLUCOSE_VALUES: readonly string[] = GLUCOSE_CONTEXTS.map((g) => g.value);
const NUMBER = /^\d+(?:\.\d+)?$/;
const SLEEP_NOTE = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/;

/**
 * One backend row to a reading, or null for a row the app cannot show: another type (the server accepts any text, a captured
 * `banana` included) or a value that is not a number. Blood pressure is stored as `"120/80"`.
 */
export function toReading(row: ApiVital): VitalReading | null {
  if (!KINDS.includes(row.vital_type)) return null;
  const kind = row.vital_type as VitalKind;
  const base = { id: row.id, kind, recordedAt: utcIso(row.recorded_at) };
  const text = row.value.trim();
  if (kind === "blood_pressure") {
    const parts = text.split("/").map((p) => p.trim());
    if (parts.length !== 2 || !parts.every((p) => NUMBER.test(p))) return null;
    return { ...base, value: Number(parts[0]), secondary: Number(parts[1]) };
  }
  if (!NUMBER.test(text)) return null;
  const reading: VitalReading = { ...base, value: Number(text) };
  if (kind === "blood_glucose" && row.notes && GLUCOSE_VALUES.includes(row.notes)) reading.glucoseContext = row.notes as GlucoseContext;
  if (kind === "sleep_duration" && row.notes) {
    const match = SLEEP_NOTE.exec(row.notes);
    if (match) Object.assign(reading, { sleepStart: match[1], sleepWake: match[2] });
  }
  return reading;
}

/** The body of `POST /vitals/`. `patient_id` is the PATIENT's id (`/auth/me` -> `patient.id`), `recorded_by_user_id` the user's. */
export function toCreateBody(input: VitalInput, ids: { patientId: string; userId: string }, now = new Date()): Schemas["PatientVitalCreate"] {
  const meta = vitalMeta(input.kind);
  const value = input.kind === "blood_pressure" ? `${input.value}/${input.secondary}` : String(input.value);
  let notes: string | undefined;
  if (input.kind === "blood_glucose" && input.glucoseContext) notes = input.glucoseContext;
  if (input.kind === "sleep_duration" && input.sleepStart && input.sleepWake) notes = `${input.sleepStart}-${input.sleepWake}`;
  return {
    vital_type: input.kind,
    value,
    unit: meta.unit,
    source: "manual",
    recorded_at: now.toISOString(),
    ...(notes ? { notes } : {}),
    patient_id: ids.patientId,
    recorded_by_user_id: ids.userId,
  };
}

// --- manual entry -----------------------------------------------------------------------------------------------------

export type FieldKey = "value" | "secondary" | "start" | "wake";

export interface FieldSpec {
  key: FieldKey;
  label: string;
  placeholder: string;
  /** `time` is a 24-hour `HH:MM`. */
  type: "number" | "time";
  min: number;
  max: number;
}

/** What the manual entry sheet asks for, and the plausible range it accepts (a typing mistake, not a clinical limit). */
export const ENTRY_FIELDS: Record<VitalKind, FieldSpec[]> = {
  heart_rate: [{ key: "value", label: "Heart rate (bpm)", placeholder: "e.g. 72", type: "number", min: 20, max: 250 }],
  blood_pressure: [
    { key: "value", label: "Systolic, top number (mmHg)", placeholder: "e.g. 120", type: "number", min: 50, max: 260 },
    { key: "secondary", label: "Diastolic, bottom number (mmHg)", placeholder: "e.g. 80", type: "number", min: 30, max: 160 },
  ],
  temperature: [{ key: "value", label: "Temperature (°C)", placeholder: "e.g. 36.8", type: "number", min: 30, max: 45 }],
  respiratory_rate: [{ key: "value", label: "Respiratory rate (breaths/min)", placeholder: "e.g. 16", type: "number", min: 4, max: 60 }],
  blood_glucose: [{ key: "value", label: "Blood glucose (mg/dL)", placeholder: "e.g. 110", type: "number", min: 20, max: 600 }],
  sleep_duration: [
    { key: "start", label: "Went to bed (24-hour time)", placeholder: "e.g. 22:30", type: "time", min: 0, max: 0 },
    { key: "wake", label: "Woke up (24-hour time)", placeholder: "e.g. 06:30", type: "time", min: 0, max: 0 },
  ],
};

/** The shortest and longest night the entry accepts, in hours. */
export const SLEEP_MIN_HOURS = 0.5;
export const SLEEP_MAX_HOURS = 18;

const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** "22:30" to minutes after midnight, or null. */
function minutesOf(text: string): number | null {
  const match = TIME.exec(text.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Hours from bed time to wake time, across midnight when the wake time is earlier (22:30 to 06:30 is 8). Null when a time is not valid. */
export function sleepHours(start: string, wake: string): number | null {
  const from = minutesOf(start);
  const to = minutesOf(wake);
  if (from === null || to === null) return null;
  return Math.round((((to - from + 1440) % 1440) / 60) * 100) / 100;
}

/** `7:5` and `07:05` both read as 07:05. */
export function normalizeTime(text: string): string {
  const match = TIME.exec(text.trim());
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : text.trim();
}

const toNumber = (text: string): number => Number(text.trim().replace(",", "."));
const isNumberText = (text: string): boolean => NUMBER.test(text.trim().replace(",", "."));

/**
 * Returns an error message per field key, or an empty object when the entry is sendable. The SERVER checks none of this (it
 * accepted a captured 300/20 blood pressure and a "banana" vital), so this is the only guard.
 */
export function validateEntry(kind: VitalKind, raw: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of ENTRY_FIELDS[kind]) {
    const text = (raw[field.key] ?? "").trim();
    if (!text) errors[field.key] = "Enter a value";
    else if (field.type === "time") {
      if (minutesOf(text) === null) errors[field.key] = "Enter a time like 22:30";
    } else if (!isNumberText(text) || toNumber(text) < field.min || toNumber(text) > field.max) {
      errors[field.key] = `Enter a number from ${field.min} to ${field.max}`;
    }
  }
  if (Object.keys(errors).length > 0) return errors;
  if (kind === "blood_pressure" && toNumber(raw.secondary) >= toNumber(raw.value)) {
    errors.secondary = "The bottom number must be lower than the top number";
  }
  if (kind === "sleep_duration") {
    const hours = sleepHours(raw.start, raw.wake) ?? 0;
    if (hours < SLEEP_MIN_HOURS) errors.wake = "That is less than 30 minutes of sleep. Check the two times";
    else if (hours > SLEEP_MAX_HOURS) errors.wake = `That is more than ${SLEEP_MAX_HOURS} hours of sleep. Check the two times`;
  }
  return errors;
}

/** The typed entry, once `validateEntry` passed. */
export function entryToInput(kind: VitalKind, raw: Record<string, string>, glucoseContext?: GlucoseContext): VitalInput {
  if (kind === "sleep_duration") {
    const start = normalizeTime(raw.start);
    const wake = normalizeTime(raw.wake);
    return { kind, value: sleepHours(start, wake) ?? 0, sleepStart: start, sleepWake: wake };
  }
  return {
    kind,
    value: toNumber(raw.value),
    ...(kind === "blood_pressure" ? { secondary: toNumber(raw.secondary) } : {}),
    ...(kind === "blood_glucose" ? { glucoseContext: glucoseContext ?? "RBS" } : {}),
  };
}
