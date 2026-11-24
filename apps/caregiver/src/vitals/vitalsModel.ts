import { ApiError } from "@/src/api/errors";
import type { Booking } from "@/src/services/booking.service";
import type { PatientVital } from "@/src/services/vitals.service";
import { formatClock, formatDayHeading, formatStamp, parseBackendDate } from "@/src/utils/dates";

/**
 * The six vitals on the design's grid. The backend stores `vital_type` as free text, so these keys
 * are the app's own vocabulary (the model's comment names `blood_pressure`, `heart_rate`,
 * `temperature`; the other three follow the same snake_case). Readings of any other type are ignored.
 *
 * Nothing here judges a reading: there are no normal ranges and no Critical/Normal status, because
 * the backend sends none and the thresholds need clinical sign-off first.
 */
export type VitalKind =
  | "heart_rate"
  | "blood_pressure"
  | "temperature"
  | "respiratory_rate"
  | "blood_glucose"
  | "sleep_duration";

export interface VitalKindInfo {
  kind: VitalKind;
  label: string;
  /** Feather icon name, as drawn in the design. */
  icon: "heart" | "activity" | "thermometer" | "wind" | "droplet" | "moon";
  /** Units a caregiver can pick; the first is the default. */
  units: string[];
  /** Subtitle on the manual entry list. */
  entryHint: string;
  /** The name on the monitoring card, the entry popup and its button (Figma says "Respiratory Rate" there and "Respiration Rate" on the tile). */
  heading: string;
  /** The sub-line under the title of the entry popup. */
  entrySubtitle: string;
}

export const VITAL_KINDS: VitalKindInfo[] = [
  { kind: "heart_rate", label: "Heart Rate", icon: "heart", units: ["bpm"], entryHint: "Enter Heart Rate Manually", heading: "Heart Rate", entrySubtitle: "Your Current Heart Rate" },
  { kind: "blood_pressure", label: "Blood Pressure", icon: "activity", units: ["mmHg"], entryHint: "Enter Blood Pressure Manually", heading: "Blood Pressure", entrySubtitle: "Enter Blood Pressure Readings" },
  { kind: "temperature", label: "Temperature", icon: "thermometer", units: ["°C", "°F"], entryHint: "Enter Temperature Manually", heading: "Temperature", entrySubtitle: "Enter your body temperature manually" },
  { kind: "respiratory_rate", label: "Respiration Rate", icon: "wind", units: ["breaths/min"], entryHint: "Enter Respiration Rate Manually", heading: "Respiratory Rate", entrySubtitle: "Enter your Respiratory Rate Reading" },
  { kind: "blood_glucose", label: "Blood Glucose", icon: "droplet", units: ["mg/dL", "mmol/L"], entryHint: "Enter Blood Glucose Manually", heading: "Blood Glucose", entrySubtitle: "Enter Blood Glucose Readings" },
  { kind: "sleep_duration", label: "Sleep Duration", icon: "moon", units: ["hrs"], entryHint: "Enter Sleep Duration Manually", heading: "Sleep Duration", entrySubtitle: "Enter your Sleep Duration" },
];

export function kindInfo(kind: VitalKind): VitalKindInfo {
  return VITAL_KINDS.find((k) => k.kind === kind) as VitalKindInfo;
}

/** When the glucose reading was taken (random, fasting, post-prandial); stored in the reading's `notes`. */
export const GLUCOSE_CONTEXTS = ["RBS", "FBS", "PP"] as const;
export type GlucoseContext = (typeof GLUCOSE_CONTEXTS)[number];
export const GLUCOSE_CONTEXT_LABEL: Record<GlucoseContext, string> = {
  RBS: "Random",
  FBS: "Fasting",
  PP: "After meal",
};

export interface Reading {
  id: string;
  kind: VitalKind;
  /** As stored: "84", "138/85", "36.8". */
  value: string;
  unit: string | null;
  recordedAt: Date;
  /** Glucose only: RBS / FBS / PP, when the entry recorded it. */
  glucoseContext: GlucoseContext | null;
  /** The number a chart plots (systolic for blood pressure), null when the value is not numeric. */
  plot: number | null;
}

const KIND_KEYS: string[] = VITAL_KINDS.map((k) => k.kind);

function plotValue(kind: VitalKind, value: string): number | null {
  const first = kind === "blood_pressure" ? value.split("/")[0] : value;
  const n = Number(first?.trim());
  return Number.isFinite(n) ? n : null;
}

/** Keeps the six known kinds, newest first. Anything else (a future type, a malformed row) is dropped. */
export function toReadings(vitals: PatientVital[]): Reading[] {
  const readings: Reading[] = [];
  for (const v of vitals) {
    if (!KIND_KEYS.includes(v.vital_type)) continue;
    const recordedAt = parseBackendDate(v.recorded_at);
    if (Number.isNaN(recordedAt.getTime())) continue;
    const kind = v.vital_type as VitalKind;
    const context = (GLUCOSE_CONTEXTS as readonly string[]).includes(v.notes ?? "") ? (v.notes as GlucoseContext) : null;
    readings.push({
      id: v.id,
      kind,
      value: v.value,
      unit: v.unit ?? null,
      recordedAt,
      glucoseContext: kind === "blood_glucose" ? context : null,
      plot: plotValue(kind, v.value),
    });
  }
  return readings.sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());
}

export function latestByKind(readings: Reading[]): Partial<Record<VitalKind, Reading>> {
  const latest: Partial<Record<VitalKind, Reading>> = {};
  for (const r of readings) {
    const current = latest[r.kind];
    if (!current || r.recordedAt > current.recordedAt) latest[r.kind] = r;
  }
  return latest;
}

export function readingsOfKind(readings: Reading[], kind: VitalKind): Reading[] {
  return readings.filter((r) => r.kind === kind);
}

/** "84 bpm", "138/85 mmHg". */
export function formatReading(r: Pick<Reading, "value" | "unit">): string {
  return r.unit ? `${r.value} ${r.unit}` : r.value;
}

/** "Updated at 10:45" for today, "Updated 24 Oct, 10:45" before. */
export function formatUpdated(date: Date, now: Date = new Date()): string {
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return `Updated at ${formatClock(date)}`;
  return `Updated ${formatStamp(date)}`;
}

// --- Chart range -----------------------------------------------------------------------------

export type ChartRange = "day" | "week" | "month";
export const CHART_RANGES: { id: ChartRange; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

const HOUR = 60 * 60 * 1000;
const RANGE_MS: Record<ChartRange, number> = { day: 24 * HOUR, week: 7 * 24 * HOUR, month: 30 * 24 * HOUR };

/** How far back the app asks the backend for readings: the longest chart range. */
export const HISTORY_WINDOW_MS = RANGE_MS.month;

/**
 * `start` for GET /vitals/{patient_id}. The backend stores UTC without an offset, so the filter is
 * sent the same way (no "Z"): "2026-10-27T09:30:00".
 */
export function historyStart(now: Date = new Date()): string {
  return new Date(now.getTime() - HISTORY_WINDOW_MS).toISOString().replace(/\.\d+Z$/, "");
}

/** Oldest first, for plotting. */
export function readingsInRange(readings: Reading[], range: ChartRange, now: Date = new Date()): Reading[] {
  const from = now.getTime() - RANGE_MS[range];
  return readings
    .filter((r) => r.recordedAt.getTime() >= from && r.recordedAt.getTime() <= now.getTime() + HOUR)
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
}

export interface ChartPoint {
  id: string;
  /** When the reading was taken, in ms: the chart places points by time. */
  at: number;
  /** What the line follows: the number itself, or the top (systolic) number for blood pressure. */
  value: number;
  /** Blood pressure only: the bottom (diastolic) number, drawn as a second, lighter line. */
  low?: number;
  /** The reading as stored ("138/85"), for screen readers. */
  label: string;
}

/** The two numbers of a stored "138/85", or null when the value is not that shape. */
export function parsePressure(value: string): { systolic: number; diastolic: number } | null {
  const [top, bottom, ...rest] = value.split("/");
  const systolic = Number(top?.trim());
  const diastolic = Number(bottom?.trim());
  if (rest.length > 0 || !top?.trim() || !bottom?.trim() || !Number.isFinite(systolic) || !Number.isFinite(diastolic)) return null;
  return { systolic, diastolic };
}

/** Plottable readings (oldest first, as `readingsInRange` returns them) as chart points. A reading that is not a number is left out. */
export function chartPoints(readings: Reading[]): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (const r of readings) {
    const at = r.recordedAt.getTime();
    if (r.kind === "blood_pressure") {
      const pressure = parsePressure(r.value);
      if (pressure) points.push({ id: r.id, at, value: pressure.systolic, low: pressure.diastolic, label: r.value });
    } else if (r.plot !== null) {
      points.push({ id: r.id, at, value: r.plot, label: r.value });
    }
  }
  return points;
}

/** "Today, 08:45" for today, "24 Oct, 10:45" before: the client row's "Last updated". */
export function formatLastUpdated(date: Date, now: Date = new Date()): string {
  return date.toDateString() === now.toDateString() ? `Today, ${formatClock(date)}` : formatStamp(date);
}

const SEX_LABEL: Record<string, string> = { male: "Male", female: "Female", other: "Other" };

/** "32, Male": the client row's age and sex, only the parts the profile has; null when it has neither. */
export function ageAndSexLine(profile: { age?: number | null; gender?: string | null } | undefined): string | null {
  if (!profile) return null;
  const parts = [
    profile.age !== null && profile.age !== undefined ? String(profile.age) : null,
    profile.gender ? (SEX_LABEL[profile.gender.toLowerCase()] ?? profile.gender) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/** Readings (already newest first) grouped under "Today", "Yesterday" or the date, keeping their order. */
export function groupReadingsByDay(readings: Reading[], now: Date = new Date()): { title: string; readings: Reading[] }[] {
  const yesterday = new Date(now.getTime() - 24 * HOUR);
  const groups: { title: string; readings: Reading[] }[] = [];
  for (const r of readings) {
    const title =
      r.recordedAt.toDateString() === now.toDateString()
        ? "Today"
        : r.recordedAt.toDateString() === yesterday.toDateString()
          ? "Yesterday"
          : formatDayHeading(r.recordedAt);
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.readings.push(r);
    else groups.push({ title, readings: [r] });
  }
  return groups;
}

/** The clock time of a reading, "10:45". */
export function formatTime(date: Date): string {
  return formatClock(date);
}

// --- Manual entry ----------------------------------------------------------------------------

export interface EntryFields {
  /** Heart rate, temperature, respiration, glucose, sleep; or the systolic number for blood pressure. */
  value: string;
  /** Diastolic number, blood pressure only. */
  diastolic?: string;
  unit?: string;
  glucoseContext?: GlucoseContext;
}

export interface VitalInput {
  vital_type: VitalKind;
  value: string;
  unit: string;
  notes: string | null;
}

export type EntryResult = { ok: true; input: VitalInput } | { ok: false; error: string };

function positive(text: string | undefined): number | null {
  const n = Number((text ?? "").trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Checks what the caregiver typed is a usable number and builds the request. This is input hygiene
 * only (a positive number, systolic above diastolic, a day has 24 hours): it never decides whether a
 * reading is normal.
 */
export function buildVitalInput(kind: VitalKind, fields: EntryFields): EntryResult {
  const info = kindInfo(kind);
  const unit = fields.unit && info.units.includes(fields.unit) ? fields.unit : info.units[0];

  if (kind === "blood_pressure") {
    const sys = positive(fields.value);
    const dia = positive(fields.diastolic);
    if (sys === null || dia === null || !Number.isInteger(sys) || !Number.isInteger(dia)) {
      return { ok: false, error: "Enter both blood pressure numbers, for example 120 and 80." };
    }
    if (sys <= dia) return { ok: false, error: "The top number should be higher than the bottom number." };
    return { ok: true, input: { vital_type: kind, value: `${sys}/${dia}`, unit, notes: null } };
  }

  const n = positive(fields.value);
  if (n === null) return { ok: false, error: `Enter a number for ${info.label.toLowerCase()}.` };
  if ((kind === "heart_rate" || kind === "respiratory_rate") && !Number.isInteger(n)) {
    return { ok: false, error: `Enter a whole number for ${info.label.toLowerCase()}.` };
  }
  if (kind === "sleep_duration" && n > 24) return { ok: false, error: "Sleep can't be more than 24 hours." };

  const notes = kind === "blood_glucose" ? (fields.glucoseContext ?? null) : null;
  return { ok: true, input: { vital_type: kind, value: String(n), unit, notes } };
}

// --- Who, and whether the backend allows it ---------------------------------------------------

export interface VitalsPatient {
  patientId: string;
  name: string;
}

/**
 * The backend lets a caregiver read and write vitals only while a visit with that patient is in
 * progress (or the patient granted explicit access, which the app has no way to see). So the app
 * offers exactly the patients of `in_progress` bookings, and tells the caregiver when they only have
 * visits that haven't started.
 */
export function vitalsPatients(bookings: Booking[]): { ready: VitalsPatient[]; waiting: boolean } {
  const ready = new Map<string, VitalsPatient>();
  let waiting = false;
  for (const b of bookings) {
    if (b.status === "in_progress") {
      if (!ready.has(b.patient_id)) {
        ready.set(b.patient_id, { patientId: b.patient_id, name: b.patient_details?.full_name ?? "Patient" });
      }
    } else if (b.status === "accepted" || b.status === "en_route") {
      waiting = true;
    }
  }
  return { ready: [...ready.values()], waiting };
}

/** The backend's refusal when there is no live visit: 403 `{"detail": "Access denied"}`. Matched exactly. */
export function isVitalsAccessDenied(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && error.detail === "Access denied";
}

export const VITALS_UNAVAILABLE_TITLE = "Available during an active visit";
export const VITALS_UNAVAILABLE_HINT =
  "You can view and record vitals while a visit with the patient is in progress. Start the visit to continue.";
