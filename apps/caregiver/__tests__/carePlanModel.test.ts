import { ApiError } from "../src/api/errors";
import {
  ageAndSex,
  applyGoalResult,
  buildCreateBody,
  conflictPlan,
  daysLabel,
  emptyDraft,
  errorCode,
  existingPlanId,
  formatPlanDate,
  isIsoDate,
  isNoAccess,
  matchesQuery,
  reviewText,
  splitLines,
  templateToDraft,
  validateDraft,
  validateGoal,
  validateHeader,
  validateLines,
  validationField,
  visibleGoals,
} from "../src/careplan/carePlanModel";
import {
  GOAL_ID,
  NOT_A_NURSE,
  NO_ACCESS,
  PLAN_EXISTS,
  PLAN_ID,
  TEMPLATE_ID,
  VALIDATION_DIAGNOSIS,
  plan,
  template,
  versionConflict,
} from "../test-utils/carePlanFixtures";

describe("reading the backend's error bodies", () => {
  it("reads the code out of detail.code", () => {
    expect(errorCode(NOT_A_NURSE)).toBe("not_a_nurse");
    expect(errorCode(PLAN_EXISTS)).toBe("care_plan_exists");
    expect(errorCode(NO_ACCESS)).toBeNull();
    expect(errorCode(new Error("x"))).toBeNull();
  });

  it("tells the plain 404 (no access) apart from a coded 404", () => {
    expect(isNoAccess(NO_ACCESS)).toBe(true);
    const templateMissing = new ApiError(404, { detail: { code: "template_not_found", message: "Care plan template not found." } }, "x");
    expect(isNoAccess(templateMissing)).toBe(false);
    expect(isNoAccess(NOT_A_NURSE)).toBe(false);
  });

  it("takes the existing plan id from a care_plan_exists 409", () => {
    expect(existingPlanId(PLAN_EXISTS)).toBe(PLAN_ID);
    expect(existingPlanId(NOT_A_NURSE)).toBeNull();
  });

  it("takes the current plan from a version_conflict 409", () => {
    const current = plan({ version: 4 });
    expect(conflictPlan(versionConflict(current))?.version).toBe(4);
    expect(conflictPlan(PLAN_EXISTS)).toBeNull();
  });

  it("names the field of a 422 validation list", () => {
    expect(validationField(VALIDATION_DIAGNOSIS)).toBe("diagnosis");
    expect(validationField(NOT_A_NURSE)).toBeNull();
  });
});

describe("formatters", () => {
  it("writes a calendar date without shifting its day", () => {
    expect(formatPlanDate("2026-10-28")).toBe("28 Oct 2026");
    expect(formatPlanDate("2026-01-01")).toBe("1 Jan 2026");
    expect(formatPlanDate(null)).toBe("");
  });

  it("shows whichever of age and sex is known", () => {
    expect(ageAndSex({ age: 71, gender: "female" })).toBe("Age 71. Female");
    expect(ageAndSex({ age: null, gender: "male" })).toBe("Male");
    expect(ageAndSex({ age: null, gender: null })).toBeNull();
  });

  it("describes the review date", () => {
    expect(reviewText({ review_every_days: 14, review_due_on: "2026-11-11" })).toBe("Review every 14 days (next 11 Nov 2026)");
    expect(reviewText({ review_every_days: null, review_due_on: null })).toBe("No review date");
  });

  it("names the days of a task", () => {
    expect(daysLabel([1, 2, 3, 4, 5, 6, 7])).toBe("Daily");
    expect(daysLabel([5, 4, 3, 2, 1])).toBe("Weekdays");
    expect(daysLabel([6, 7])).toBe("Weekends");
    expect(daysLabel([1, 3, 5])).toBe("Mon, Wed, Fri");
  });

  it("splits a box of lines, dropping blanks", () => {
    expect(splitLines(" a \n\n b\n  ")).toEqual(["a", "b"]);
  });
});

describe("validation", () => {
  it("accepts only real calendar dates", () => {
    expect(isIsoDate("2026-10-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("28/10/2026")).toBe(false);
  });

  it("requires a diagnosis and a risk level", () => {
    const errors = validateDraft(emptyDraft());
    expect(errors.diagnosis).toBeTruthy();
    expect(errors.risk).toBeTruthy();
  });

  it("keeps duration and review inside the backend's limits, and blank means the default", () => {
    const base = { diagnosis: "x", startDate: "", durationDays: "", reviewEveryDays: "" };
    expect(validateHeader(base)).toEqual({});
    expect(validateHeader({ ...base, durationDays: "0" }).durationDays).toBeTruthy();
    expect(validateHeader({ ...base, durationDays: "366" }).durationDays).toBeTruthy();
    expect(validateHeader({ ...base, durationDays: "365" }).durationDays).toBeUndefined();
    expect(validateHeader({ ...base, reviewEveryDays: "6" }).reviewEveryDays).toBeTruthy();
    expect(validateHeader({ ...base, reviewEveryDays: "90" }).reviewEveryDays).toBeUndefined();
    expect(validateHeader({ ...base, reviewEveryDays: "abc" }).reviewEveryDays).toBeTruthy();
    expect(validateHeader({ ...base, startDate: "tomorrow" }).startDate).toBeTruthy();
  });

  it("limits the diagnosis to 200 characters", () => {
    expect(validateHeader({ diagnosis: "a".repeat(201), startDate: "", durationDays: "", reviewEveryDays: "" }).diagnosis).toBeTruthy();
  });

  it("limits lines and goals", () => {
    expect(validateLines("a\n".repeat(31))).toBeTruthy();
    expect(validateLines("a".repeat(1001))).toBeTruthy();
    expect(validateLines("a\nb")).toBeNull();
    expect(validateGoal({ title: "  ", target: "" }).title).toBeTruthy();
    expect(validateGoal({ title: "ok", target: "t".repeat(201) }).target).toBeTruthy();
    expect(validateGoal({ title: "ok", target: "" })).toEqual({});
  });
});

describe("buildCreateBody", () => {
  const filled = () => ({
    ...emptyDraft(),
    diagnosis: "  Placeholder diagnosis  ",
    risk: "medium" as const,
    goals: [{ title: " Walk ", target: "  ", frequency: "daily" as const }],
    tasks: [{ title: "Wash", time_slot: "morning" as const, time_of_day: null, days_of_week: [5, 1] }],
    allergies: "Placeholder allergen\n\n",
    specialInstructions: "",
  });

  it("omits what was left blank so the backend defaults apply", () => {
    const body = buildCreateBody(filled(), null);
    expect(body).not.toHaveProperty("template_id");
    expect(body).not.toHaveProperty("start_date");
    expect(body).not.toHaveProperty("duration_days");
    expect(body).not.toHaveProperty("review_every_days");
    expect(body.diagnosis).toBe("Placeholder diagnosis");
    expect(body.risk_level).toBe("medium");
  });

  it("trims, drops empty targets, sorts days and always sends the lists", () => {
    const body = buildCreateBody(filled(), null);
    expect(body.goals).toEqual([{ title: "Walk", target: null, frequency: "daily" }]);
    expect(body.tasks).toEqual([{ title: "Wash", time_slot: "morning", time_of_day: null, days_of_week: [1, 5] }]);
    expect(body.allergies).toEqual(["Placeholder allergen"]);
    expect(body.special_instructions).toEqual([]);
  });

  it("sends the numbers and the template id when given", () => {
    const body = buildCreateBody({ ...filled(), startDate: "2026-11-01", durationDays: "21", reviewEveryDays: "7" }, TEMPLATE_ID);
    expect(body).toMatchObject({ template_id: TEMPLATE_ID, start_date: "2026-11-01", duration_days: 21, review_every_days: 7 });
  });
});

describe("templateToDraft", () => {
  it("copies the template but leaves the diagnosis empty and required", () => {
    const draft = templateToDraft(template());
    expect(draft.diagnosis).toBe("");
    expect(draft.risk).toBe("high");
    expect(draft.durationDays).toBe("30");
    expect(draft.reviewEveryDays).toBe("14");
    expect(draft.goals.map((g) => g.title)).toEqual(["Safe mobility and transfers", "Prevent falls"]);
    expect(draft.goals[1]?.target).toBe("No falls this month");
    expect(draft.tasks).toHaveLength(2);
    expect(draft.tasks[0]?.time_of_day).toBe("08:00");
    expect(draft.specialInstructions).toBe("Follow the therapist's exercise sheet");
    expect(validateDraft(draft).diagnosis).toBeTruthy();
  });
});

describe("goals on a plan", () => {
  it("hides discontinued goals", () => {
    const p = plan({
      goals: [
        { id: "a", title: "A", target: null, frequency: "daily", status: "active" },
        { id: "b", title: "B", target: null, frequency: "daily", status: "discontinued" },
        { id: "c", title: "C", target: null, frequency: "daily", status: "achieved" },
      ],
    });
    expect(visibleGoals(p).map((g) => g.id)).toEqual(["a", "c"]);
  });

  it("adds a new goal and takes the plan's new version", () => {
    const next = applyGoalResult(plan(), {
      goal: { id: "new", title: "New", target: null, frequency: "weekly", status: "active" },
      plan_version: 3,
    });
    expect(next.version).toBe(3);
    expect(next.goals.map((g) => g.id)).toEqual([GOAL_ID, "new"]);
  });

  it("replaces an edited goal in place", () => {
    const next = applyGoalResult(plan(), {
      goal: { id: GOAL_ID, title: "Placeholder goal", target: null, frequency: "daily", status: "achieved" },
      plan_version: 2,
    });
    expect(next.goals).toHaveLength(1);
    expect(next.goals[0]?.status).toBe("achieved");
  });
});

describe("matchesQuery", () => {
  it("searches the name and the summary, ignoring case", () => {
    const item = { name: "Stroke Recovery", summary: "Mobility after a stroke" };
    expect(matchesQuery(item, "")).toBe(true);
    expect(matchesQuery(item, "STROKE")).toBe(true);
    expect(matchesQuery(item, "mobility")).toBe(true);
    expect(matchesQuery(item, "cardiac")).toBe(false);
  });
});
