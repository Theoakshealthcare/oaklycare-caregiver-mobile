import type { IconName } from "@/src/components/ui/icon";

export type VitalKind = "heart_rate" | "blood_pressure" | "temperature" | "respiratory_rate" | "blood_glucose" | "sleep";
export type VitalRange = "day" | "week" | "month";

export interface VitalMeta {
  kind: VitalKind;
  label: string;
  /** The unit as it should read on screen; the designs had "bpr", "bpm" on blood pressure, "98.6 C" and "mgd/dl". */
  unit: string;
  icon: IconName;
}

export const VITALS: readonly VitalMeta[] = [
  { kind: "heart_rate", label: "Heart rate", unit: "bpm", icon: "heart-outline" },
  { kind: "blood_pressure", label: "Blood pressure", unit: "mmHg", icon: "pulse-outline" },
  { kind: "temperature", label: "Temperature", unit: "°C", icon: "thermometer-outline" },
  { kind: "respiratory_rate", label: "Respiratory rate", unit: "breaths/min", icon: "cloud-outline" },
  { kind: "blood_glucose", label: "Blood glucose", unit: "mg/dL", icon: "water-outline" },
  { kind: "sleep", label: "Sleep duration", unit: "hrs", icon: "moon-outline" },
];

export const vitalMeta = (kind: VitalKind): VitalMeta => VITALS.find((v) => v.kind === kind) ?? VITALS[0];

export interface VitalReading {
  id: string;
  kind: VitalKind;
  /** The value, or the top (systolic) number for blood pressure. */
  value: number;
  /** The bottom (diastolic) number, blood pressure only. */
  secondary?: number;
  recordedAt: string;
}

export interface VitalInput {
  kind: VitalKind;
  value: number;
  secondary?: number;
}

/** "128/80" for blood pressure, else the number. */
export function readingText(reading: Pick<VitalReading, "value" | "secondary">): string {
  return reading.secondary !== undefined ? `${reading.value}/${reading.secondary}` : String(reading.value);
}

export interface FieldSpec {
  key: "value" | "secondary";
  label: string;
  placeholder: string;
  min: number;
  max: number;
}

/** What the manual entry sheet asks for, and the plausible range it accepts (a typing mistake, not a clinical limit). */
export const ENTRY_FIELDS: Record<VitalKind, FieldSpec[]> = {
  heart_rate: [{ key: "value", label: "Heart rate (bpm)", placeholder: "e.g. 72", min: 20, max: 250 }],
  blood_pressure: [
    { key: "value", label: "Systolic, top number (mmHg)", placeholder: "e.g. 120", min: 50, max: 260 },
    { key: "secondary", label: "Diastolic, bottom number (mmHg)", placeholder: "e.g. 80", min: 30, max: 160 },
  ],
  temperature: [{ key: "value", label: "Temperature (°C)", placeholder: "e.g. 36.8", min: 30, max: 45 }],
  respiratory_rate: [{ key: "value", label: "Respiratory rate (breaths/min)", placeholder: "e.g. 16", min: 4, max: 60 }],
  blood_glucose: [{ key: "value", label: "Blood glucose (mg/dL)", placeholder: "e.g. 110", min: 20, max: 600 }],
  sleep: [{ key: "value", label: "Total sleep (hours)", placeholder: "e.g. 7.5", min: 0.5, max: 24 }],
};

/** Returns an error message per field key, or an empty object when the entry is sendable. */
export function validateEntry(kind: VitalKind, raw: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of ENTRY_FIELDS[kind]) {
    const text = (raw[field.key] ?? "").trim().replace(",", ".");
    const number = Number(text);
    if (!text) errors[field.key] = "Enter a value";
    else if (!Number.isFinite(number) || number < field.min || number > field.max) {
      errors[field.key] = `Enter a number from ${field.min} to ${field.max}`;
    }
  }
  if (kind === "blood_pressure" && Object.keys(errors).length === 0) {
    if (Number(raw.secondary.replace(",", ".")) >= Number(raw.value.replace(",", "."))) {
      errors.secondary = "The bottom number must be lower than the top number";
    }
  }
  return errors;
}

export interface VitalAccessEntry {
  id: string;
  caregiverName: string;
  granted: boolean;
  grantedAt: string | null;
}
