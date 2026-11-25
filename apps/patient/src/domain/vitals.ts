import type { Schemas } from "@oakly/api-client";

import type { IconName } from "@/src/components/ui/icon";

import { utcIso } from "./dates";
import { toFlag, type VitalFlag } from "./vitalStatus";

/**
 * The six vitals. The backend stores `vital_type` as free text, so these keys are the apps' shared vocabulary: the caregiver
 * app writes and reads the same ones (`sleep_duration`, not `sleep`), so a reading entered here shows up there and back.
 */
export type VitalKind = "heart_rate" | "blood_pressure" | "temperature" | "respiratory_rate" | "blood_glucose" | "sleep_duration";
export type VitalRange = "day" | "week" | "month";

export interface VitalMeta {
  kind: VitalKind;
  /** The name on the Vitals tiles (Figma: "Respiration Rate"). */
  label: string;
  /** The unit as it should read on screen (and as it is sent): `bpm`, `mmHg`, `°C`, `breaths/min`, `mg/dL`, `hrs`. */
  unit: string;
  icon: IconName;
  /** The title of the manual-entry sheet and the card on the monitoring page (Figma: "Respiratory Rate", "Sleep Pattern"). */
  title: string;
  /** The grey line under the sheet title. */
  sheetSubtitle: string;
  /** The sheet's button ("Update Heart Rate"). */
  button: string;
  /** The page title ("Heart Rate Monitoring"). */
  monitorTitle: string;
  /** The line under the tile name on the manual list ("Enter Heart Rate Manually"). */
  manualHint: string;
  /** The vital's own icon colour (a soft tint sits behind it). Never a health status: the rating is the server's `flag`. */
  tint: string;
}

export const VITALS: readonly VitalMeta[] = [
  {
    kind: "heart_rate",
    label: "Heart Rate",
    unit: "bpm",
    icon: "heart",
    title: "Heart Rate",
    sheetSubtitle: "Your Current Heart Rate",
    button: "Update Heart Rate",
    monitorTitle: "Heart Rate Monitoring",
    manualHint: "Enter Heart Rate Manually",
    tint: "#E85D4F",
  },
  {
    kind: "blood_pressure",
    label: "Blood Pressure",
    unit: "mmHg",
    icon: "pulse",
    title: "Blood Pressure",
    sheetSubtitle: "Enter Blood Pressure Readings",
    button: "Update Blood Pressure",
    monitorTitle: "Blood Pressure Monitoring",
    manualHint: "Enter Blood Pressure Manually",
    tint: "#E85D4F",
  },
  {
    kind: "temperature",
    label: "Temperature",
    unit: "°C",
    icon: "thermometer-outline",
    title: "Temperature",
    sheetSubtitle: "Enter your body temperature manually",
    button: "Update Temperature",
    monitorTitle: "Temperature Monitoring",
    manualHint: "Enter Temperature Manually",
    tint: "#3FA55B",
  },
  {
    kind: "respiratory_rate",
    label: "Respiration Rate",
    unit: "breaths/min",
    icon: "wind",
    title: "Respiratory Rate",
    sheetSubtitle: "Enter your Respiratory Rate Reading",
    button: "Update Respiratory Rate",
    monitorTitle: "Respiratory Rate Monitoring",
    manualHint: "Enter Respiration Rate Manually",
    tint: "#E85D4F",
  },
  {
    kind: "blood_glucose",
    label: "Blood Glucose",
    unit: "mg/dL",
    icon: "water-outline",
    title: "Blood Glucose",
    sheetSubtitle: "Enter Blood Glucose Readings",
    button: "Update Blood Glucose",
    monitorTitle: "Blood Glucose Monitoring",
    manualHint: "Enter Blood Glucose Manually",
    tint: "#E85D4F",
  },
  {
    kind: "sleep_duration",
    label: "Sleep Duration",
    unit: "hrs",
    icon: "moon-outline",
    title: "Sleep Pattern",
    sheetSubtitle: "Enter your sleep duration and wake-up time.",
    button: "Update Sleep Pattern",
    monitorTitle: "Sleep Duration Monitoring",
    manualHint: "Enter Sleep Duration Manually",
    tint: "#E8A23C",
  },
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
  /** The unit it was saved in (a temperature can be °C or °F, a glucose mg/dL or mmol/L). */
  unit: string;
  /** ISO with a zone. */
  recordedAt: string;
  glucoseContext?: GlucoseContext;
  /** The server's Normal / High / Low / Critical rating; null for sleep and for a reading it could not rate (nothing is drawn). */
  flag: VitalFlag | null;
  /** Sleep only, "22:30" / "06:30", when the entry recorded them. */
  sleepStart?: string;
  sleepWake?: string;
}

export interface VitalInput {
  kind: VitalKind;
  value: number;
  secondary?: number;
  /** Left out: the vital's own unit. */
  unit?: string;
  glucoseContext?: GlucoseContext;
  sleepStart?: string;
  sleepWake?: string;
}

/** "128/80" for blood pressure, else the number. */
export function readingText(reading: Pick<VitalReading, "value" | "secondary">): string {
  return reading.secondary !== undefined ? `${reading.value}/${reading.secondary}` : String(reading.value);
}

// --- units ----------------------------------------------------------------------------------------------------------

/** The units the server accepts for a vital (the first is the default). */
export const UNITS: Partial<Record<VitalKind, readonly string[]>> = {
  temperature: ["°C", "°F"],
  blood_glucose: ["mg/dL", "mmol/L"],
};

/** mg/dL per mmol/L of glucose. */
const MGDL_PER_MMOL = 18.016;

/** The same measurement in another unit (temperature, glucose); a value in a unit that needs no change comes back as it was. */
export function convertUnit(kind: VitalKind, value: number, from: string, to: string): number {
  if (from === to) return value;
  if (kind === "temperature") return from === "°F" ? Math.round(((value - 32) * 50) / 9) / 10 : Math.round((value * 9) / 5 * 10 + 320) / 10;
  if (kind === "blood_glucose") return from === "mmol/L" ? Math.round(value * MGDL_PER_MMOL) : Math.round((value / MGDL_PER_MMOL) * 10) / 10;
  return value;
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
  const base = { id: row.id, kind, unit: row.unit?.trim() || vitalMeta(kind).unit, recordedAt: utcIso(row.recorded_at), flag: toFlag(row.flag) };
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
    unit: input.unit ?? meta.unit,
    source: "manual",
    recorded_at: now.toISOString(),
    ...(notes ? { notes } : {}),
    patient_id: ids.patientId,
    recorded_by_user_id: ids.userId,
  };
}

// --- manual entry -----------------------------------------------------------------------------------------------------

/** `RBS`, `FBS` and `PP` are the three glucose boxes; the rest are the other vitals' boxes. */
export type FieldKey = "value" | "secondary" | "start" | "wake" | GlucoseContext;

export interface FieldSpec {
  key: FieldKey;
  /** The label over the box. A `{unit}` in it is replaced by the unit chosen. */
  label: string;
  placeholder: string;
  /** `time` is an `HH:MM` picked from a list. */
  type: "number" | "time";
  /** The plausible range, per unit (a typing mistake, not a clinical limit). */
  range: Record<string, [number, number]>;
}

const any = (min: number, max: number) => ({ "*": [min, max] as [number, number] });

/** What the manual entry sheet asks for, and the plausible range it accepts. */
export const ENTRY_FIELDS: Record<VitalKind, FieldSpec[]> = {
  heart_rate: [{ key: "value", label: "Enter Heart Rate (bpm)", placeholder: "82", type: "number", range: any(20, 250) }],
  blood_pressure: [
    { key: "value", label: "Enter Blood Pressure (mmHg)", placeholder: "120", type: "number", range: any(50, 260) },
    { key: "secondary", label: "Diastolic, bottom number (mmHg)", placeholder: "80", type: "number", range: any(30, 160) },
  ],
  temperature: [{ key: "value", label: "Temperature Reading ({unit})", placeholder: "36.8", type: "number", range: { "°C": [30, 45], "°F": [86, 113] } }],
  respiratory_rate: [{ key: "value", label: "Enter Respiratory Rate (breaths/min)", placeholder: "16", type: "number", range: any(4, 60) }],
  blood_glucose: [
    { key: "RBS", label: "Random Blood Sugar (RBS)", placeholder: "Random reading", type: "number", range: { "mg/dL": [20, 600], "mmol/L": [1.1, 33.3] } },
    { key: "FBS", label: "Fasting Blood Sugar (FBS)", placeholder: "Fasting reading", type: "number", range: { "mg/dL": [20, 600], "mmol/L": [1.1, 33.3] } },
    { key: "PP", label: "Post-prandial (2 hours after meal)", placeholder: "After-meal reading", type: "number", range: { "mg/dL": [20, 600], "mmol/L": [1.1, 33.3] } },
  ],
  sleep_duration: [
    { key: "start", label: "Sleep Start Time", placeholder: "Select time", type: "time", range: any(0, 0) },
    { key: "wake", label: "Wake-Up Time", placeholder: "Select time", type: "time", range: any(0, 0) },
  ],
};

/** The plausible range of a field in the unit chosen. */
export function rangeFor(field: FieldSpec, unit: string): [number, number] {
  return field.range[unit] ?? field.range["*"];
}

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

/** "10:00 pm" for "22:00", as the Figma pickers write it. */
export function timeLabel(hhmm: string): string {
  const minutes = minutesOf(hhmm);
  if (minutes === null) return hhmm;
  const h = Math.floor(minutes / 60);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(minutes % 60).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** Every quarter hour of the day, for the sleep time pickers. */
export const TIME_OPTIONS: readonly { value: string; label: string }[] = Array.from({ length: 96 }, (_, i) => {
  const value = `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`;
  return { value, label: timeLabel(value) };
});

/** "8 hours", "7 hours 30 minutes", "45 minutes": the total under the sleep pickers. */
export function durationLabel(hours: number): string {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hText = h === 0 ? "" : `${h} ${h === 1 ? "hour" : "hours"}`;
  const mText = m === 0 ? "" : `${m} ${m === 1 ? "minute" : "minutes"}`;
  return [hText, mText].filter(Boolean).join(" ");
}

const toNumber = (text: string): number => Number(text.trim().replace(",", "."));
const isNumberText = (text: string): boolean => NUMBER.test(text.trim().replace(",", "."));

/**
 * Returns an error message per field key, or an empty object when the entry is sendable. The SERVER checks none of this for the
 * shape of the text (it accepted a captured 300/20 blood pressure before DP1-16), so this is the first guard. Glucose has three
 * boxes of which at least one must be filled; the empty ones are simply not sent.
 */
export function validateEntry(kind: VitalKind, raw: Record<string, string>, unit: string = vitalMeta(kind).unit): Record<string, string> {
  const errors: Record<string, string> = {};
  const fields = ENTRY_FIELDS[kind];
  const optional = kind === "blood_glucose";
  if (optional && fields.every((f) => !(raw[f.key] ?? "").trim())) {
    errors[fields[0].key] = "Enter at least one reading";
    return errors;
  }
  for (const field of fields) {
    const text = (raw[field.key] ?? "").trim();
    if (!text) {
      if (!optional) errors[field.key] = field.type === "time" ? "Select a time" : "Enter a value";
      continue;
    }
    if (field.type === "time") {
      if (minutesOf(text) === null) errors[field.key] = "Select a time";
      continue;
    }
    const [min, max] = rangeFor(field, unit);
    if (!isNumberText(text) || toNumber(text) < min || toNumber(text) > max) errors[field.key] = `Enter a number from ${min} to ${max}`;
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

/** The typed entry, once `validateEntry` passed: one reading, or up to three for glucose (one per filled box, each with its own context). */
export function entryToInputs(kind: VitalKind, raw: Record<string, string>, unit: string = vitalMeta(kind).unit): VitalInput[] {
  if (kind === "sleep_duration") {
    const start = normalizeTime(raw.start);
    const wake = normalizeTime(raw.wake);
    return [{ kind, value: sleepHours(start, wake) ?? 0, sleepStart: start, sleepWake: wake }];
  }
  if (kind === "blood_glucose") {
    return GLUCOSE_CONTEXTS.filter((c) => (raw[c.value] ?? "").trim()).map((c) => ({ kind, value: toNumber(raw[c.value]), unit, glucoseContext: c.value }));
  }
  return [
    {
      kind,
      value: toNumber(raw.value),
      ...(kind === "blood_pressure" ? { secondary: toNumber(raw.secondary) } : {}),
      ...(UNITS[kind] ? { unit } : {}),
    },
  ];
}

// --- AI notes -----------------------------------------------------------------------------------------------------------

/** What the server writes when its AI call failed; not a note, never shown as one (the same rule as the FallGuard summary). */
const INSIGHTS_FAILED = /^unable to analy[sz]e/i;

const sentence = (item: unknown): string => {
  if (typeof item === "string") return item.trim();
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    for (const key of ["text", "description", "message", "recommendation", "concern"]) if (typeof o[key] === "string") return (o[key] as string).trim();
  }
  return "";
};

/**
 * The sentences of `GET /vitals/{id}/insights`, in the order the server's AI gave them: the summary, then each concern, then each
 * recommendation. The shape is not in the API schema (an AI writes it), so anything that is not a sentence is skipped, and an
 * answer that is only the "Unable to analyze" stand-in gives none.
 */
export function toInsights(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const summary = sentence(o.summary);
  const list = (value: unknown): string[] => (Array.isArray(value) ? value.map(sentence).filter(Boolean) : []);
  return [...(summary && !INSIGHTS_FAILED.test(summary) ? [summary] : []), ...list(o.concerns), ...list(o.recommendations)];
}
