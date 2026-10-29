/**
 * Placeholder care plan data shaped after the backend's captured responses (`fe-integration-guide-caregiver.md`
 * section 16, captures 200-222). Names, ids and text are obviously fake.
 */
import { ApiError } from "../src/api/errors";
import type {
  CarePlan,
  CarePlanListItem,
  CarePlanMedication,
  CarePlanNote,
  CarePlanNotePage,
  CarePlanProgress,
  CarePlanTemplate,
  CarePlanTemplateItem,
  PlanCandidate,
  TaskCompletion,
  TaskDay,
  VisitCarePlan,
} from "../src/services/carePlans.service";

export const BOOKING = "bd787ad8-949e-4cb5-a428-39c61cd5fd03";
export const PLAN_ID = "34fe9218-f4df-4bca-8261-44a82a0f50db";
export const GOAL_ID = "1fc54f86-fa3b-406e-980b-858831da1bd7";
export const TEMPLATE_ID = "957d1ed4-18a5-45b3-a53f-a8c8e701a163";

export const plan = (over: Partial<CarePlan> = {}): CarePlan => ({
  id: PLAN_ID,
  version: 1,
  status: "active",
  booking_id: BOOKING,
  client: { full_name: "Placeholder Client", age: 71, gender: "female" },
  diagnosis: "Placeholder diagnosis",
  risk_level: "high",
  start_date: "2026-10-28",
  duration_days: 30,
  review_every_days: 14,
  review_due_on: "2026-11-11",
  template: null,
  author: { name: "Placeholder Nurse", kind: "caregiver" },
  allergies: ["Placeholder allergen"],
  special_instructions: ["Placeholder instruction"],
  goals: [{ id: GOAL_ID, title: "Placeholder goal", target: "Placeholder target", frequency: "daily", status: "active" }],
  tasks: [{ id: "b24a7f07-adf8-4417-a884-d6aeead43669", title: "Placeholder task", time_slot: "morning", time_of_day: "08:00", days_of_week: [1, 3, 5] }],
  medications: [],
  capabilities: { can_edit_plan: true, can_tick_tasks: true, can_add_observation: true },
  created_at: "2026-10-28T10:10:50.058340",
  updated_at: "2026-10-28T10:10:50.058343",
  ...over,
});

export const readOnlyPlan = (over: Partial<CarePlan> = {}): CarePlan =>
  plan({ capabilities: { can_edit_plan: false, can_tick_tasks: false, can_add_observation: false }, ...over });

export const listItem = (over: Partial<CarePlanListItem> = {}): CarePlanListItem => ({
  id: PLAN_ID,
  booking_id: BOOKING,
  client: { full_name: "Placeholder Client", age: 71, gender: "female" },
  diagnosis: "Placeholder diagnosis",
  risk_level: "high",
  status: "active",
  start_date: "2026-10-28",
  progress_percent: null,
  ...over,
});

export const templateItem = (over: Partial<CarePlanTemplateItem> = {}): CarePlanTemplateItem => ({
  id: TEMPLATE_ID,
  key: "stroke_recovery",
  name: "Stroke Recovery",
  summary: "Mobility, safe swallowing and falls prevention after a stroke.",
  duration_days: 30,
  review_every_days: 14,
  default_risk_level: "high",
  clinical_review_status: "pending",
  version: 1,
  ...over,
});

export const template = (over: Partial<CarePlanTemplate> = {}): CarePlanTemplate => ({
  ...templateItem(),
  goals: [
    { title: "Safe mobility and transfers", target: null, frequency: "daily" },
    { title: "Prevent falls", target: "No falls this month", frequency: "ongoing" },
  ],
  tasks: [
    { title: "Check and record BP and pulse", time_slot: "morning", time_of_day: "08:00", days_of_week: [1, 2, 3, 4, 5, 6, 7] },
    { title: "Skin and pressure-point check", time_slot: "evening", time_of_day: "18:00", days_of_week: [1, 2, 3, 4, 5, 6, 7] },
  ],
  special_instructions: ["Follow the therapist's exercise sheet"],
  ...over,
});

export const candidate = (over: Partial<PlanCandidate> = {}): PlanCandidate => ({
  booking_id: "cadcc485-1d78-45df-901d-f22575f84e02",
  client: { full_name: "Placeholder Client Two", age: null, gender: "male" },
  booking_status: "accepted",
  scheduled_date: "2026-10-29T10:10:49.287333",
  ...over,
});

export const visitPlan = (over: Partial<VisitCarePlan> = {}): VisitCarePlan => ({
  booking_id: BOOKING,
  subject_ready: true,
  can_author: true,
  plan: null,
  ...over,
});

export const visitSummary = {
  id: PLAN_ID,
  version: 1,
  status: "active" as const,
  diagnosis: "Placeholder diagnosis",
  risk_level: "high" as const,
  start_date: "2026-10-28",
  duration_days: 30,
  review_every_days: 14,
  review_due_on: "2026-11-11",
  goal_count: 1,
  task_count: 1,
};

// The error bodies are the captured ones: `detail` is an object with a `code`, except the plain 404.
export const NO_ACCESS = new ApiError(404, { detail: "Care plan not found" }, "Not found");
export const NOT_A_NURSE = new ApiError(
  403,
  { detail: { code: "not_a_nurse", message: "Only nurses can create or change a care plan." } },
  "Only nurses can create or change a care plan.",
);
export const PLAN_EXISTS = new ApiError(
  409,
  { detail: { code: "care_plan_exists", message: "This client already has an active care plan.", plan_id: PLAN_ID } },
  "This client already has an active care plan.",
);
export const NOT_IDENTIFIED = new ApiError(
  409,
  { detail: { code: "client_not_identified", message: "We can't tell who this visit is for, so a care plan isn't available." } },
  "We can't tell who this visit is for, so a care plan isn't available.",
);
export const versionConflict = (current: CarePlan) =>
  new ApiError(
    409,
    { detail: { code: "version_conflict", message: "Someone just changed this plan. Reload it and try again.", plan: current } },
    "Someone just changed this plan. Reload it and try again.",
  );
export const VALIDATION_DIAGNOSIS = new ApiError(
  422,
  { detail: [{ type: "string_too_short", loc: ["body", "diagnosis"], msg: "String should have at least 1 character" }] },
  "String should have at least 1 character",
);

// --- M2: day view, ticks, notes, progress (captures 230-238, guide 16.13 to 16.20) ------------------------------------

export const TASK_A = "47f653e2-e9e1-4c75-ad77-14d85aa53b7c";
export const TASK_B = "a1ae63c9-ee9b-4dd6-8297-b1799a30f5c5";

/** Today in the capture (a Wednesday). */
export const TODAY_DATE = "2026-10-28";

export const dayView = (over: Partial<TaskDay> = {}): TaskDay => ({
  date: TODAY_DATE,
  is_today: true,
  can_tick: true,
  slots: [
    {
      slot: "morning",
      time_of_day: "08:00",
      tasks: [{ id: TASK_A, title: "Placeholder morning task", time_of_day: "08:00", done: false, done_by: null, done_at: null }],
    },
    {
      slot: "evening",
      time_of_day: null,
      tasks: [{ id: TASK_B, title: "Placeholder evening task", time_of_day: null, done: false, done_by: null, done_at: null }],
    },
  ],
  ...over,
});

export const tickedDay = (): TaskDay => {
  const day = dayView();
  day.slots[0].tasks[0] = { ...day.slots[0].tasks[0], done: true, done_by: "Placeholder Nurse", done_at: "2026-10-28T10:10:52.399709" };
  return day;
};

export const completion = (over: Partial<TaskCompletion> = {}): TaskCompletion => ({
  task_id: TASK_A,
  date: TODAY_DATE,
  done: true,
  done_by: "Placeholder Nurse",
  done_at: "2026-10-28T10:10:52.399709",
  ...over,
});

export const note = (over: Partial<CarePlanNote> = {}): CarePlanNote => ({
  id: "ffd9a4e0-fa3b-41c8-aaca-e9bb778a70b9",
  category: "observation",
  body: "Placeholder observation: ate well.",
  author: { name: "Placeholder Nurse", kind: "caregiver" },
  created_at: "2026-10-28T10:10:52.806793",
  ...over,
});

export const notePage = (items: CarePlanNote[], next?: { before: string; id: string }): CarePlanNotePage => ({
  items,
  next_before: next?.before ?? null,
  next_before_id: next?.id ?? null,
});

export const progress = (over: Partial<CarePlanProgress> = {}): CarePlanProgress => ({
  overall_percent: 55,
  scheduled: 11,
  completed: 6,
  visit_days: 4,
  day: 9,
  of_days: 30,
  review_due_on: "2026-11-03",
  by_day: [
    { date: "2026-10-21", scheduled: 3, completed: 2 },
    { date: "2026-10-28", scheduled: 3, completed: 1 },
  ],
  goals: { active: 1, achieved: 0, discontinued: 0 },
  last_observation_at: "2026-10-28T10:10:52.834517",
  ...over,
});

const refusal = (status: number, code: string, message: string) => new ApiError(status, { detail: { code, message } }, message);
export const VISIT_NOT_IN_PROGRESS = refusal(409, "visit_not_in_progress", "Available during an active visit.");
export const PLAN_NOT_EDITABLE = refusal(409, "plan_not_editable", "This care plan is completed or archived and can no longer be changed.");
export const TASK_DATE_NOT_TODAY = refusal(422, "task_date_not_today", "Tasks can only be ticked for today.");
export const TASK_NOT_SCHEDULED = refusal(422, "task_not_scheduled", "This task is not scheduled for that day.");

// --- M3: medications (captures 240-243, guide 16.21 to 16.25) ----------------------------------------------------------------

export const MEDICATION_A = "61986564-03c8-4ffc-9fc9-75a5f60bbbe4";
export const MEDICATION_B = "7664c137-38d2-4985-a672-d9676b42f4e2";

/** The full capture (240-a response): every field filled. */
export const medication = (over: Partial<CarePlanMedication> = {}): CarePlanMedication => ({
  id: MEDICATION_A,
  name: "Placeholder medicine A",
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
  status: "active",
  stopped_at: null,
  ...over,
});

/** The minimal capture (240-b response): only the required fields, unset text is null. */
export const minimalMedication = (over: Partial<CarePlanMedication> = {}): CarePlanMedication => ({
  id: MEDICATION_B,
  name: "Placeholder medicine B",
  strength: null,
  dose_amount: null,
  dose_unit: null,
  route: null,
  reason: null,
  prescribed_by: null,
  note: null,
  frequency: "as_needed",
  times_of_day: [],
  start_date: "2026-10-28",
  end_date: null,
  status: "active",
  stopped_at: null,
  ...over,
});

/** The stopped one (242-a response). */
export const stoppedMedication = (over: Partial<CarePlanMedication> = {}): CarePlanMedication =>
  medication({ status: "stopped", stopped_at: "2026-10-28T12:55:01.667687", frequency: "once_daily", times_of_day: ["12:00"], ...over });

export const PLAN_FULL = (): CarePlan => plan({ medications: [minimalMedication(), stoppedMedication()] });

export const INVALID_END_DATE = refusal(422, "invalid_care_plan", "end_date cannot be before start_date");
export const MEDICATION_VALIDATION_NAME = new ApiError(
  422,
  { detail: [{ type: "string_too_short", loc: ["body", "name"], msg: "String should have at least 1 character" }] },
  "String should have at least 1 character",
);
