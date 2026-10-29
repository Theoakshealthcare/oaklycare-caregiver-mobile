import {
  MEDICATION_FREQUENCIES,
  MEDICATION_NOTICE,
  applyMedicationResult,
  buildMedicationBody,
  emptyMedicationDraft,
  medicationDatesLine,
  medicationDoseLine,
  medicationFrequencyLabel,
  medicationGroups,
  medicationScheduleLine,
  medicationStoppedLine,
  validateMedication,
  type MedicationDraft,
} from "../src/careplan/carePlanModel";
import { MEDICATION_B, MEDICATION_A, medication, minimalMedication, plan, stoppedMedication } from "../test-utils/carePlanFixtures";

const draft = (over: Partial<MedicationDraft> = {}): MedicationDraft => ({ ...emptyMedicationDraft(), name: "Placeholder medicine", ...over });

describe("the medication notice", () => {
  // The backend serves these words only inside its OpenAPI descriptions, and they await clinical sign-off. If the
  // committed spec changes them (`pnpm api:sync`), this fails until the app's one string is updated to match.
  const spec = require("../../../packages/api-client/openapi.json");

  it("is the wording in the committed OpenAPI spec, on all three routes and on the plan's list", () => {
    const description = (text: string) => expect(text).toContain(MEDICATION_NOTICE);
    description(spec.paths["/api/v1/caregiver/care-plans/{plan_id}/medications"].post.description);
    description(spec.paths["/api/v1/caregiver/care-plan-medications/{medication_id}"].patch.description);
    description(spec.paths["/api/v1/caregiver/care-plan-medications/{medication_id}/stop"].post.description);
    description(spec.components.schemas.CarePlanOut.properties.medications.description);
  });
});

describe("validateMedication", () => {
  it("needs only a name", () => {
    expect(validateMedication(draft())).toEqual({});
    expect(validateMedication(draft({ name: "   " })).name).toBe("Enter the name of the medicine.");
  });

  it("holds each field to the backend's length", () => {
    const errors = validateMedication(
      draft({ name: "x".repeat(121), strength: "x".repeat(61), doseAmount: "x".repeat(61), doseUnit: "x".repeat(61), route: "x".repeat(61), reason: "x".repeat(201), prescribedBy: "x".repeat(121), note: "x".repeat(1001) }),
    );
    expect(Object.keys(errors).sort()).toEqual(["doseAmount", "doseUnit", "name", "note", "prescribedBy", "reason", "route", "strength"]);
    expect(validateMedication(draft({ name: "x".repeat(120), strength: "x".repeat(60), reason: "x".repeat(200), note: "x".repeat(1000) }))).toEqual({});
  });

  it("checks times as HH:MM, once each, at most twelve", () => {
    expect(validateMedication(draft({ times: "08:00, 20:00" }))).toEqual({});
    expect(validateMedication(draft({ times: "08:00 20:00;12:30" }))).toEqual({});
    expect(validateMedication(draft({ times: "8:00" })).times).toMatch(/24-hour format HH:MM/);
    expect(validateMedication(draft({ times: "25:00" })).times).toMatch(/24-hour format HH:MM/);
    expect(validateMedication(draft({ times: "08:00, 08:00" })).times).toBe("Each time can be listed once.");
    const thirteen = Array.from({ length: 13 }, (_, i) => `${String(i).padStart(2, "0")}:00`).join(",");
    expect(validateMedication(draft({ times: thirteen })).times).toBe("List at most 12 times.");
  });

  it("checks the dates and that the end is not before the start", () => {
    expect(validateMedication(draft({ startDate: "2026-10-28", endDate: "2026-11-25" }))).toEqual({});
    expect(validateMedication(draft({ startDate: "2026-10-28", endDate: "2026-10-28" }))).toEqual({});
    expect(validateMedication(draft({ startDate: "28/10/2026" })).startDate).toMatch(/YYYY-MM-DD/);
    expect(validateMedication(draft({ endDate: "2026-02-30" })).endDate).toMatch(/YYYY-MM-DD/);
    expect(validateMedication(draft({ startDate: "2026-11-25", endDate: "2026-10-28" })).endDate).toBe("The end date can't be before the start date.");
    // No start date: the backend compares with today, so the app does not guess.
    expect(validateMedication(draft({ endDate: "2020-01-01" }))).toEqual({});
  });
});

describe("buildMedicationBody", () => {
  it("sends only the required fields for a bare draft (the minimal capture)", () => {
    expect(buildMedicationBody(draft({ name: " Placeholder medicine B ", frequency: "as_needed" }))).toEqual({ name: "Placeholder medicine B", frequency: "as_needed" });
  });

  it("sends the filled fields trimmed, the times earliest first and once each, and never a version", () => {
    const body = buildMedicationBody(
      draft({
        strength: " 500 mg ",
        doseAmount: "1",
        doseUnit: "tablet",
        route: "oral",
        reason: "Placeholder reason",
        prescribedBy: "Placeholder prescriber",
        note: "Placeholder note",
        frequency: "twice_daily",
        times: "20:00, 08:00 ,20:00",
        startDate: "2026-10-28",
        endDate: "2026-11-25",
      }),
    );
    expect(body).toEqual({
      name: "Placeholder medicine",
      strength: "500 mg",
      dose_amount: "1",
      dose_unit: "tablet",
      route: "oral",
      reason: "Placeholder reason",
      prescribed_by: "Placeholder prescriber",
      note: "Placeholder note",
      frequency: "twice_daily",
      times_of_day: ["08:00", "20:00"],
      start_date: "2026-10-28",
      end_date: "2026-11-25",
    });
    expect(body).not.toHaveProperty("expected_version");
  });
});

describe("reading medications", () => {
  it("keeps the server's order inside the active and stopped groups", () => {
    const groups = medicationGroups({ medications: [medication({ id: "a" }), stoppedMedication({ id: "s" }), minimalMedication({ id: "b" })] });
    expect(groups.active.map((m) => m.id)).toEqual(["a", "b"]);
    expect(groups.stopped.map((m) => m.id)).toEqual(["s"]);
  });

  it("writes the dose, schedule and dates as recorded, without calculating anything", () => {
    expect(medicationDoseLine(medication())).toBe("500 mg · 1 tablet · oral");
    expect(medicationDoseLine(minimalMedication())).toBe("");
    expect(medicationDoseLine(medication({ strength: null, dose_unit: null, route: null, dose_amount: "1/2" }))).toBe("1/2");
    expect(medicationScheduleLine(medication())).toBe("Twice daily · 8:00 AM, 8:00 PM");
    expect(medicationScheduleLine(minimalMedication())).toBe("As needed");
    expect(medicationDatesLine(medication())).toBe("From 28 Oct 2026 to 25 Nov 2026");
    expect(medicationDatesLine(minimalMedication())).toBe("From 28 Oct 2026");
    expect(medicationStoppedLine(stoppedMedication())).toMatch(/^Stopped 28 Oct, \d{2}:\d{2}$/);
    expect(medicationStoppedLine({ stopped_at: null })).toBe("Stopped");
  });

  it("labels every frequency the server knows", () => {
    expect(MEDICATION_FREQUENCIES.map((f) => f.value)).toEqual(["once_daily", "twice_daily", "three_times_daily", "four_times_daily", "weekly", "as_needed", "other"]);
    expect(medicationFrequencyLabel("three_times_daily")).toBe("Three times daily");
  });
});

describe("applyMedicationResult", () => {
  it("puts a new active medicine after the last active one and before the stopped history, and takes the new version", () => {
    const held = plan({ version: 3, medications: [medication(), stoppedMedication({ id: "old" })] });
    const next = applyMedicationResult(held, { medication: minimalMedication(), plan_version: 4 });
    expect(next.version).toBe(4);
    expect(next.medications.map((m) => m.id)).toEqual([MEDICATION_A, MEDICATION_B, "old"]);
    expect(held.medications).toHaveLength(2);
  });

  it("replaces a medicine it already holds", () => {
    const held = plan({ medications: [medication()] });
    const next = applyMedicationResult(held, { medication: medication({ name: "Renamed" }), plan_version: 2 });
    expect(next.medications).toHaveLength(1);
    expect(next.medications[0].name).toBe("Renamed");
  });
});
