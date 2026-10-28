/**
 * Placeholder care plan data shaped after the backend's captured responses (`fe-integration-guide-caregiver.md`
 * section 16, captures 200-222). Names, ids and text are obviously fake.
 */
import { ApiError } from "../src/api/errors";
import type {
  CarePlan,
  CarePlanListItem,
  CarePlanTemplate,
  CarePlanTemplateItem,
  PlanCandidate,
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
