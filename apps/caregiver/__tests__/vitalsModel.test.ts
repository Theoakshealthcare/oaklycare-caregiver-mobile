import { ApiError } from "../src/api/errors";
import type { Booking } from "../src/services/booking.service";
import type { PatientVital } from "../src/services/vitals.service";
import {
  VITAL_KINDS,
  buildVitalInput,
  chartBars,
  formatReading,
  formatUpdated,
  historyStart,
  isVitalsAccessDenied,
  latestByKind,
  readingsInRange,
  toReadings,
  vitalsPatients,
} from "../src/vitals/vitalsModel";

const NOW = new Date("2026-10-27T12:00:00Z");

// Shapes follow PatientVitalResponse: timestamps are UTC without a "Z", value is a string.
const vital = (over: Partial<PatientVital>): PatientVital => ({
  id: "v1",
  patient_id: "p1",
  recorded_by_user_id: "u1",
  vital_type: "heart_rate",
  value: "84",
  unit: "bpm",
  source: "manual",
  recorded_at: "2026-10-27T10:45:00",
  notes: null,
  ...over,
});

describe("toReadings / latestByKind", () => {
  it("keeps the six known kinds newest first and drops anything else", () => {
    const readings = toReadings([
      vital({ id: "old", recorded_at: "2026-10-26T08:00:00", value: "70" }),
      vital({ id: "new", recorded_at: "2026-10-27T09:00:00", value: "90" }),
      vital({ id: "odd", vital_type: "mood", value: "ok" }),
      vital({ id: "bad-date", recorded_at: "not a date" }),
    ]);
    expect(readings.map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("reads timestamps as UTC", () => {
    const [r] = toReadings([vital({ recorded_at: "2026-10-27T10:45:00" })]);
    expect(r.recordedAt.toISOString()).toBe("2026-10-27T10:45:00.000Z");
  });

  it("picks the newest reading of each kind", () => {
    const latest = latestByKind(
      toReadings([
        vital({ id: "a", recorded_at: "2026-10-27T08:00:00", value: "70" }),
        vital({ id: "b", recorded_at: "2026-10-27T09:00:00", value: "90" }),
        vital({ id: "c", vital_type: "blood_pressure", value: "138/85", unit: "mmHg" }),
      ]),
    );
    expect(latest.heart_rate?.id).toBe("b");
    expect(latest.blood_pressure?.value).toBe("138/85");
    expect(latest.temperature).toBeUndefined();
  });

  it("plots the systolic number of a blood pressure and reads the glucose context from notes", () => {
    const [bp, glucose, odd] = toReadings([
      vital({ id: "bp", vital_type: "blood_pressure", value: "138/85", unit: "mmHg", recorded_at: "2026-10-27T11:00:00" }),
      vital({ id: "g", vital_type: "blood_glucose", value: "110", unit: "mg/dL", notes: "FBS", recorded_at: "2026-10-27T10:00:00" }),
      vital({ id: "g2", vital_type: "blood_glucose", value: "5.5", unit: "mmol/L", notes: "free text", recorded_at: "2026-10-27T09:00:00" }),
    ]);
    expect(bp.plot).toBe(138);
    expect(glucose.glucoseContext).toBe("FBS");
    expect(odd.glucoseContext).toBeNull();
  });

  it("has no status or threshold on a reading: the app never rates a value", () => {
    const [r] = toReadings([vital({})]);
    expect(Object.keys(r).sort()).toEqual(["glucoseContext", "id", "kind", "plot", "recordedAt", "unit", "value"]);
  });
});

describe("formatting", () => {
  it("joins value and unit", () => {
    expect(formatReading({ value: "138/85", unit: "mmHg" })).toBe("138/85 mmHg");
    expect(formatReading({ value: "7", unit: null })).toBe("7");
  });

  it("says 'at' for today and adds the date for earlier readings", () => {
    const today = new Date("2026-10-27T10:45:00");
    const earlier = new Date("2026-10-24T10:45:00");
    const sameDay = new Date("2026-10-27T15:00:00");
    expect(formatUpdated(today, sameDay)).toMatch(/^Updated at /);
    expect(formatUpdated(earlier, sameDay)).toMatch(/^Updated 24 Oct/);
  });
});

describe("chart range", () => {
  const at = (iso: string, id: string, value = "80") => vital({ id, recorded_at: iso, value });
  const readings = toReadings([
    at("2026-10-27T11:00:00", "hour-ago"),
    at("2026-10-26T11:00:00", "yesterday"),
    at("2026-10-22T12:00:00", "five-days"),
    at("2026-10-05T12:00:00", "three-weeks"),
    at("2026-09-20T12:00:00", "too-old"),
  ]);

  it.each([
    ["day", ["hour-ago"]],
    ["week", ["five-days", "yesterday", "hour-ago"]],
    ["month", ["three-weeks", "five-days", "yesterday", "hour-ago"]],
  ] as const)("%s keeps only readings inside the window, oldest first", (range, ids) => {
    expect(readingsInRange(readings, range, NOW).map((r) => r.id)).toEqual(ids);
  });

  it("asks the backend for 30 days, as UTC without a zone", () => {
    expect(historyStart(NOW)).toBe("2026-09-27T12:00:00");
  });

  it("scales bars between the lowest and highest value, never to zero", () => {
    const bars = chartBars(
      toReadings([
        vital({ id: "lo", value: "60", recorded_at: "2026-10-27T08:00:00" }),
        vital({ id: "hi", value: "100", recorded_at: "2026-10-27T09:00:00" }),
      ]).reverse(),
    );
    expect(bars.map((b) => b.id)).toEqual(["lo", "hi"]);
    expect(bars[0].height).toBeCloseTo(0.15);
    expect(bars[1].height).toBe(1);
  });

  it("draws equal readings at a steady height and no readings as no bars", () => {
    const same = chartBars(toReadings([vital({ id: "a" }), vital({ id: "b", recorded_at: "2026-10-27T11:00:00" })]));
    expect(same.map((b) => b.height)).toEqual([0.6, 0.6]);
    expect(chartBars([])).toEqual([]);
  });
});

describe("buildVitalInput", () => {
  it("builds each kind with its default unit", () => {
    expect(buildVitalInput("heart_rate", { value: "82" })).toEqual({
      ok: true,
      input: { vital_type: "heart_rate", value: "82", unit: "bpm", notes: null },
    });
    expect(buildVitalInput("respiratory_rate", { value: "16" })).toMatchObject({ ok: true, input: { unit: "breaths/min" } });
    expect(buildVitalInput("sleep_duration", { value: "6,5" })).toMatchObject({ ok: true, input: { value: "6.5", unit: "hrs" } });
  });

  it("writes blood pressure as 'systolic/diastolic' in mmHg", () => {
    expect(buildVitalInput("blood_pressure", { value: "120", diastolic: "80" })).toEqual({
      ok: true,
      input: { vital_type: "blood_pressure", value: "120/80", unit: "mmHg", notes: null },
    });
  });

  it("takes the chosen unit for temperature and glucose, and the glucose context as notes", () => {
    expect(buildVitalInput("temperature", { value: "98.6", unit: "°F" })).toMatchObject({ ok: true, input: { unit: "°F" } });
    expect(buildVitalInput("temperature", { value: "37", unit: "kelvin" })).toMatchObject({ ok: true, input: { unit: "°C" } });
    expect(buildVitalInput("blood_glucose", { value: "5.5", unit: "mmol/L", glucoseContext: "PP" })).toEqual({
      ok: true,
      input: { vital_type: "blood_glucose", value: "5.5", unit: "mmol/L", notes: "PP" },
    });
    expect(buildVitalInput("blood_glucose", { value: "110" })).toMatchObject({ ok: true, input: { unit: "mg/dL", notes: null } });
  });

  it.each([
    ["heart_rate", { value: "" }],
    ["heart_rate", { value: "abc" }],
    ["heart_rate", { value: "0" }],
    ["heart_rate", { value: "-4" }],
    ["heart_rate", { value: "82.5" }],
    ["temperature", { value: "hot" }],
    ["sleep_duration", { value: "25" }],
    ["blood_pressure", { value: "120" }],
    ["blood_pressure", { value: "80", diastolic: "120" }],
    ["blood_pressure", { value: "120.5", diastolic: "80" }],
  ] as const)("rejects %s %j", (kind, fields) => {
    const result = buildVitalInput(kind, fields);
    expect(result.ok).toBe(false);
  });

  it("does not set a normal range for any kind: input checks are not clinical thresholds", () => {
    // A very high or low but valid number is accepted; judging it is for a clinician, not this app.
    expect(buildVitalInput("heart_rate", { value: "250" }).ok).toBe(true);
    expect(buildVitalInput("temperature", { value: "45" }).ok).toBe(true);
  });

  it("covers the six vitals of the design", () => {
    expect(VITAL_KINDS.map((k) => k.kind)).toEqual([
      "heart_rate",
      "blood_pressure",
      "temperature",
      "respiratory_rate",
      "blood_glucose",
      "sleep_duration",
    ]);
  });
});

describe("vitalsPatients", () => {
  const booking = (over: Partial<Booking>): Booking => ({ id: "b", patient_id: "p1", status: "in_progress", ...over }) as Booking;

  it("offers the patient of each in-progress visit once", () => {
    const { ready, waiting } = vitalsPatients([
      booking({ id: "b1", patient_details: { full_name: "Placeholder Patient" } as Booking["patient_details"] }),
      booking({ id: "b2" }),
      booking({ id: "b3", patient_id: "p2" }),
    ]);
    expect(ready).toEqual([
      { patientId: "p1", name: "Placeholder Patient" },
      { patientId: "p2", name: "Patient" },
    ]);
    expect(waiting).toBe(false);
  });

  it("reports waiting when the visits have not started, and offers nobody", () => {
    expect(vitalsPatients([booking({ status: "accepted" }), booking({ status: "en_route", patient_id: "p2" })])).toEqual({
      ready: [],
      waiting: true,
    });
    expect(vitalsPatients([])).toEqual({ ready: [], waiting: false });
  });
});

describe("isVitalsAccessDenied", () => {
  it("matches only the backend's 403 'Access denied'", () => {
    expect(isVitalsAccessDenied(new ApiError(403, { detail: "Access denied" }, "x"))).toBe(true);
    expect(isVitalsAccessDenied(new ApiError(403, { detail: "Access denied. Caregiver account required." }, "x"))).toBe(false);
    expect(isVitalsAccessDenied(new ApiError(500, { detail: "Access denied" }, "x"))).toBe(false);
    expect(isVitalsAccessDenied(new Error("Access denied"))).toBe(false);
  });
});
