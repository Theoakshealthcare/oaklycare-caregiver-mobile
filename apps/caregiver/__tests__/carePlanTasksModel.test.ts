import {
  applyCompletion,
  applyTaskResult,
  buildTaskBody,
  clockLabel,
  dayOfPlan,
  doneByText,
  emptyTaskDraft,
  formatClock,
  formatStamp,
  isTimeOfDay,
  needsClockOutPrompt,
  progressHeadline,
  shortDate,
  slotHeading,
  tickFailure,
  validateNote,
  validateTask,
  weekOf,
} from "../src/careplan/carePlanModel";
import { ApiError } from "../src/api/errors";
import {
  NO_ACCESS,
  PLAN_NOT_EDITABLE,
  TASK_A,
  TASK_DATE_NOT_TODAY,
  TASK_NOT_SCHEDULED,
  VISIT_NOT_IN_PROGRESS,
  completion,
  dayView,
  plan,
  progress,
} from "../test-utils/carePlanFixtures";

describe("weekOf", () => {
  it("returns Monday to Sunday around a Wednesday", () => {
    const week = weekOf("2026-10-28");
    expect(week.map((d) => d.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(week[0].date).toBe("2026-10-26");
    expect(week[2].date).toBe("2026-10-28");
    expect(week[6].date).toBe("2026-11-01");
  });

  it("puts a Monday first and a Sunday last, and crosses month and year ends", () => {
    expect(weekOf("2026-10-26")[0].date).toBe("2026-10-26");
    expect(weekOf("2026-11-01")[0].date).toBe("2026-10-26");
    expect(weekOf("2026-11-01")[6].date).toBe("2026-11-01");
    expect(weekOf("2027-01-01").map((d) => d.date)).toEqual([
      "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03",
    ]);
  });

  it("is empty for something that is not a date", () => {
    expect(weekOf("")).toEqual([]);
    expect(weekOf("not-a-date")).toEqual([]);
  });
});

describe("clock labels", () => {
  it.each([
    ["08:00", "8:00 AM"],
    ["00:30", "12:30 AM"],
    ["12:00", "12:00 PM"],
    ["18:00", "6:00 PM"],
    ["23:59", "11:59 PM"],
  ])("%s -> %s", (input, label) => expect(clockLabel(input)).toBe(label));

  it("keeps what it cannot read and handles missing", () => {
    expect(clockLabel("soon")).toBe("soon");
    expect(clockLabel(null)).toBe("");
  });

  it("builds the slot heading with or without a time", () => {
    expect(slotHeading("morning", "08:00")).toBe("Morning (8:00 AM)");
    expect(slotHeading("evening", null)).toBe("Evening");
  });

  it("accepts only 24-hour HH:MM", () => {
    expect(isTimeOfDay("08:00")).toBe(true);
    expect(isTimeOfDay(" 23:59 ")).toBe(true);
    expect(isTimeOfDay("24:00")).toBe(false);
    expect(isTimeOfDay("8:00")).toBe(false);
    expect(isTimeOfDay("08:60")).toBe(false);
  });

  it("formats backend UTC stamps, or nothing when unreadable", () => {
    expect(formatClock("2026-10-28T10:10:52.399709")).toMatch(/^\d{2}:\d{2}$/);
    expect(formatStamp("2026-10-28T10:10:52.399709")).toMatch(/28/);
    expect(formatClock(null)).toBe("");
    expect(formatStamp("garbage")).toBe("");
  });

  it("says who ticked it and when", () => {
    expect(doneByText({ done_by: "Placeholder Nurse", done_at: "2026-10-28T10:10:52.399709" })).toMatch(/^Done by Placeholder Nurse, \d{2}:\d{2}$/);
    expect(doneByText({ done_by: "Placeholder Nurse", done_at: null })).toBe("Done by Placeholder Nurse");
    expect(doneByText({ done_by: null, done_at: null })).toBe("Done by a caregiver");
  });
});

describe("task draft", () => {
  it("starts as a daily morning task", () => {
    expect(emptyTaskDraft()).toEqual({ title: "", slot: "morning", time: "", days: [1, 2, 3, 4, 5, 6, 7] });
  });

  it("requires a title, a valid time when given, and at least one day", () => {
    expect(validateTask({ ...emptyTaskDraft(), title: "  " }).title).toBeTruthy();
    expect(validateTask({ ...emptyTaskDraft(), title: "x".repeat(121) }).title).toBeTruthy();
    expect(validateTask({ ...emptyTaskDraft(), title: "Walk", time: "9am" }).time).toBeTruthy();
    expect(validateTask({ ...emptyTaskDraft(), title: "Walk", days: [] }).days).toBeTruthy();
    expect(validateTask({ ...emptyTaskDraft(), title: "Walk", time: "09:00" })).toEqual({});
  });

  it("builds the request body: trimmed title, no time when blank, sorted days", () => {
    expect(buildTaskBody({ title: " Walk ", slot: "afternoon", time: "", days: [5, 1, 3] })).toEqual({
      title: "Walk",
      time_slot: "afternoon",
      days_of_week: [1, 3, 5],
    });
    expect(buildTaskBody({ title: "Walk", slot: "morning", time: " 08:00 ", days: [1] }).time_of_day).toBe("08:00");
  });
});

describe("applying server answers", () => {
  it("adds a task to the plan and takes the new version", () => {
    const task = { id: "t9", title: "New", time_slot: "night" as const, time_of_day: null, days_of_week: [1] };
    const next = applyTaskResult(plan(), { task, plan_version: 2 });
    expect(next.version).toBe(2);
    expect(next.tasks.map((t) => t.id)).toContain("t9");
    // the same task twice is replaced, not duplicated
    expect(applyTaskResult(next, { task: { ...task, title: "Renamed" }, plan_version: 3 }).tasks.filter((t) => t.id === "t9")).toHaveLength(1);
  });

  it("puts the server's tick (who, when) into the day, and nothing else", () => {
    const next = applyCompletion(dayView(), completion());
    const [a] = next.slots[0].tasks;
    expect(a).toMatchObject({ id: TASK_A, done: true, done_by: "Placeholder Nurse" });
    expect(next.slots[1].tasks[0].done).toBe(false);
    const undone = applyCompletion(next, completion({ done: false, done_by: null, done_at: null }));
    expect(undone.slots[0].tasks[0]).toMatchObject({ done: false, done_by: null, done_at: null });
  });
});

describe("tickFailure", () => {
  it("maps each refusal to wording and a reload", () => {
    expect(tickFailure(VISIT_NOT_IN_PROGRESS, "x")).toEqual({ message: "Available during an active visit.", reload: "plan", noAccess: false });
    expect(tickFailure(PLAN_NOT_EDITABLE, "x").reload).toBe("plan");
    expect(tickFailure(TASK_DATE_NOT_TODAY, "x")).toMatchObject({ reload: "day", message: expect.stringContaining("day changed") });
    expect(tickFailure(TASK_NOT_SCHEDULED, "x")).toMatchObject({ reload: "day", message: expect.stringContaining("not scheduled") });
  });

  it("reports no access for the plain 404 and passes any other error's message through", () => {
    expect(tickFailure(NO_ACCESS, "x").noAccess).toBe(true);
    expect(tickFailure(new ApiError(0, null, "offline"), "You're offline.")).toEqual({ message: "You're offline.", reload: "none", noAccess: false });
  });
});

describe("notes and progress wording", () => {
  it("validates a note: required, at most 2000 characters after trimming", () => {
    expect(validateNote("   ")).toBeTruthy();
    expect(validateNote("a".repeat(2001))).toBeTruthy();
    expect(validateNote(" ok ")).toBeNull();
    expect(validateNote("a".repeat(2000))).toBeNull();
  });

  it("never shows 0% for a plan with nothing to measure", () => {
    expect(progressHeadline(progress({ overall_percent: null }))).toBe("No visits yet");
    expect(progressHeadline(progress({ overall_percent: 0 }))).toBe("0%");
    expect(progressHeadline(progress())).toBe("55%");
  });

  it("describes the plan day", () => {
    expect(dayOfPlan({ day: 9, of_days: 30 })).toBe("Day 9 of 30");
    expect(dayOfPlan({ day: 0, of_days: 30 })).toBe("Not started yet");
  });

  it("labels a chart date with its weekday", () => {
    expect(shortDate("2026-10-28")).toBe("Wed 28 Oct");
    expect(shortDate("2026-11-01")).toBe("Sun 1 Nov");
  });
});

describe("clock-out prompt rule", () => {
  it("asks only when the client has an active plan", () => {
    expect(needsClockOutPrompt({ plan: { status: "active" } })).toBe(true);
    expect(needsClockOutPrompt({ plan: { status: "completed" } })).toBe(false);
    expect(needsClockOutPrompt({ plan: null })).toBe(false);
    expect(needsClockOutPrompt(undefined)).toBe(false);
  });
});
