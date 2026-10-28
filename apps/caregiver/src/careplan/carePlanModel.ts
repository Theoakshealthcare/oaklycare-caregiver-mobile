/**
 * Care plans: the pure rules behind the screens. Labels, the create-form draft and its validation,
 * and how the backend's error bodies are read. Shapes follow the backend's verified FE guide
 * (`fe-integration-guide-caregiver.md`, section 16). Nothing here touches the network or the disk.
 */
import { ApiError } from "@/src/api/errors";
import type {
  CarePlan,
  CarePlanCreateBody,
  CarePlanTemplate,
  GoalFrequency,
  GoalWriteResult,
  NewGoal,
} from "@/src/services/carePlans.service";

export type RiskLevel = CarePlan["risk_level"];
export type TimeSlot = CarePlanTemplate["tasks"][number]["time_slot"];

export const RISKS: { value: RiskLevel; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export const FREQUENCIES: { value: GoalFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "ongoing", label: "Ongoing" },
  { value: "one_time", label: "One-time" },
];

export const SLOTS: { value: TimeSlot; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
];

export const riskLabel = (risk: RiskLevel): string => RISKS.find((r) => r.value === risk)?.label ?? risk;
export const frequencyLabel = (f: GoalFrequency): string => FREQUENCIES.find((x) => x.value === f)?.label ?? f;
export const slotLabel = (s: TimeSlot): string => SLOTS.find((x) => x.value === s)?.label ?? s;

export const PLAN_STATUS_LABEL: Record<CarePlan["status"], string> = {
  active: "Active Care Plan",
  completed: "Completed",
  archived: "Archived",
};

/** The Assigned list shows "Ongoing" for an active plan (design frame `8.22.56`). */
export const listStatusLabel = (status: CarePlan["status"]): string => (status === "active" ? "Ongoing" : PLAN_STATUS_LABEL[status]);

// Limits the backend enforces (guide 16.5); checked here so the nurse sees them before sending.
export const LIMITS = {
  diagnosis: 200,
  title: 120,
  target: 200,
  text: 1000,
  goals: 30,
  tasks: 60,
  listItems: 30,
  durationDays: [1, 365],
  reviewDays: [7, 90],
} as const;

// --- Wording shown for the failure states (spec section 9) -----------------------------------------------------------

export const NOT_AVAILABLE_TITLE = "This care plan isn't available";
export const NOT_AVAILABLE_HINT =
  "You can see a client's plan while their visit is accepted, on the way or in progress.";
export const NOT_IDENTIFIED_HINT = "We can't tell who this visit is for, so a care plan isn't available. Contact support.";
export const ONLY_NURSES_HINT = "Only nurses can change a care plan.";
export const ASK_THE_NURSE_HINT = "Ask the nurse on this visit to create one.";
export const NOT_REVIEWED_NOTE = "Not yet clinically reviewed";
export const CONFLICT_HINT = "Someone just changed this plan. We've loaded the latest version; check your changes and save again.";

// --- Reading the backend's error bodies -------------------------------------------------------------------------------

function detailObject(error: unknown): Record<string, unknown> | null {
  if (!(error instanceof ApiError) || !error.body || typeof error.body !== "object") return null;
  const detail = (error.body as { detail?: unknown }).detail;
  return detail && typeof detail === "object" && !Array.isArray(detail) ? (detail as Record<string, unknown>) : null;
}

/** `detail.code` of a care plan refusal (`not_a_nurse`, `care_plan_exists`, ...), else null. */
export function errorCode(error: unknown): string | null {
  const code = detailObject(error)?.code;
  return typeof code === "string" ? code : null;
}

/** The plain `404 "Care plan not found"` (and its siblings): no live visit for this client. */
export function isNoAccess(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404 && errorCode(error) === null;
}

/** A `409 care_plan_exists` carries the existing plan's id; the app opens it. */
export function existingPlanId(error: unknown): string | null {
  if (errorCode(error) !== "care_plan_exists") return null;
  const id = detailObject(error)?.plan_id;
  return typeof id === "string" ? id : null;
}

/** A `409 version_conflict` carries the current plan in `detail.plan`. */
export function conflictPlan(error: unknown): CarePlan | null {
  if (errorCode(error) !== "version_conflict") return null;
  const plan = detailObject(error)?.plan;
  return plan && typeof plan === "object" ? (plan as CarePlan) : null;
}

/** The first `loc` field of a 422 validation list, e.g. `diagnosis`; the value is never echoed by the server. */
export function validationField(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 422 || !error.body || typeof error.body !== "object") return null;
  const detail = (error.body as { detail?: unknown }).detail;
  if (!Array.isArray(detail)) return null;
  const loc = (detail[0] as { loc?: unknown } | undefined)?.loc;
  return Array.isArray(loc) && typeof loc[loc.length - 1] === "string" ? (loc[loc.length - 1] as string) : null;
}

// --- Small formatters ------------------------------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-28" -> "28 Oct 2026", read as a calendar date (no time zone shift). */
export function formatPlanDate(isoDate: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate ?? "");
  if (!m) return "";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? ""} ${m[1]}`;
}

const SEX_LABEL: Record<string, string> = { male: "Male", female: "Female", other: "Other" };

/** "Age 71. Female", or whichever part is known; null when neither is. */
export function ageAndSex(client: { age?: number | null; gender?: string | null }): string | null {
  const parts = [
    client.age !== null && client.age !== undefined ? `Age ${client.age}` : null,
    client.gender ? (SEX_LABEL[client.gender.toLowerCase()] ?? client.gender) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(". ") : null;
}

/** "Review every 14 days" or "No review date". */
export function reviewText(plan: Pick<CarePlan, "review_every_days" | "review_due_on">): string {
  if (!plan.review_every_days) return "No review date";
  const due = plan.review_due_on ? ` (next ${formatPlanDate(plan.review_due_on)})` : "";
  return `Review every ${plan.review_every_days} days${due}`;
}

export const planLength = (days: number): string => (days === 1 ? "1 day" : `${days} days`);

export const splitLines = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export const joinLines = (items: string[]): string => items.join("\n");

// --- Days of the week for a task -------------------------------------------------------------------------------------

export const DAILY = [1, 2, 3, 4, 5, 6, 7];
export const WEEKDAYS = [1, 2, 3, 4, 5];
export const WEEKENDS = [6, 7];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function daysLabel(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const same = (target: number[]) => sorted.length === target.length && sorted.every((d, i) => d === target[i]);
  if (same(DAILY)) return "Daily";
  if (same(WEEKDAYS)) return "Weekdays";
  if (same(WEEKENDS)) return "Weekends";
  return sorted.map((d) => DAY_NAMES[d - 1] ?? "").join(", ");
}

// --- The create-plan draft ---------------------------------------------------------------------------------------------

export interface DraftTask {
  title: string;
  time_slot: TimeSlot;
  time_of_day: string | null;
  days_of_week: number[];
}

export interface PlanDraft {
  diagnosis: string;
  risk: RiskLevel | null;
  /** Blank = today (the backend defaults it in Africa/Lagos). */
  startDate: string;
  /** Blank = the template's, else 30. */
  durationDays: string;
  reviewEveryDays: string;
  goals: NewGoal[];
  tasks: DraftTask[];
  allergies: string;
  specialInstructions: string;
}

export const emptyDraft = (): PlanDraft => ({
  diagnosis: "",
  risk: null,
  startDate: "",
  durationDays: "",
  reviewEveryDays: "",
  goals: [],
  tasks: [],
  allergies: "",
  specialInstructions: "",
});

/** "Use template": the diagnosis stays empty and required; everything else is copied and editable. */
export function templateToDraft(template: CarePlanTemplate): PlanDraft {
  return {
    ...emptyDraft(),
    risk: template.default_risk_level,
    durationDays: String(template.duration_days),
    reviewEveryDays: template.review_every_days ? String(template.review_every_days) : "",
    goals: template.goals.map((g) => ({ title: g.title, target: g.target ?? null, frequency: g.frequency })),
    tasks: template.tasks.map((t) => ({
      title: t.title,
      time_slot: t.time_slot,
      time_of_day: t.time_of_day ?? null,
      days_of_week: [...t.days_of_week],
    })),
    specialInstructions: joinLines(template.special_instructions),
  };
}

export type DraftErrors = Partial<Record<"diagnosis" | "risk" | "startDate" | "durationDays" | "reviewEveryDays" | "allergies" | "specialInstructions" | "goals" | "tasks", string>>;

const wholeNumber = (text: string): number | null => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null);

/** A real calendar date written YYYY-MM-DD. */
export function isIsoDate(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** Checks the header fields shared by the create form and the edit sheet. */
export function validateHeader(fields: {
  diagnosis: string;
  startDate: string;
  durationDays: string;
  reviewEveryDays: string;
}): DraftErrors {
  const errors: DraftErrors = {};
  const diagnosis = fields.diagnosis.trim();
  if (!diagnosis) errors.diagnosis = "Enter the diagnosis.";
  else if (diagnosis.length > LIMITS.diagnosis) errors.diagnosis = `Keep the diagnosis to ${LIMITS.diagnosis} characters.`;
  if (fields.startDate.trim() && !isIsoDate(fields.startDate)) errors.startDate = "Use the format YYYY-MM-DD, for example 2026-10-28.";
  if (fields.durationDays.trim()) {
    const n = wholeNumber(fields.durationDays);
    const [min, max] = LIMITS.durationDays;
    if (n === null || n < min || n > max) errors.durationDays = `Enter a whole number of days from ${min} to ${max}.`;
  }
  if (fields.reviewEveryDays.trim()) {
    const n = wholeNumber(fields.reviewEveryDays);
    const [min, max] = LIMITS.reviewDays;
    if (n === null || n < min || n > max) errors.reviewEveryDays = `Enter a whole number of days from ${min} to ${max}, or leave it blank.`;
  }
  return errors;
}

/** One list-of-lines field (allergies, special instructions): at most 30 lines of at most 1000 characters. */
export function validateLines(text: string): string | null {
  const lines = splitLines(text);
  if (lines.length > LIMITS.listItems) return `Add at most ${LIMITS.listItems} lines.`;
  if (lines.some((l) => l.length > LIMITS.text)) return `Keep each line to ${LIMITS.text} characters.`;
  return null;
}

export function validateDraft(draft: PlanDraft): DraftErrors {
  const errors = validateHeader(draft);
  if (!draft.risk) errors.risk = "Choose a risk level.";
  const allergies = validateLines(draft.allergies);
  if (allergies) errors.allergies = allergies;
  const instructions = validateLines(draft.specialInstructions);
  if (instructions) errors.specialInstructions = instructions;
  if (draft.goals.length > LIMITS.goals) errors.goals = `A plan can have at most ${LIMITS.goals} goals.`;
  if (draft.tasks.length > LIMITS.tasks) errors.tasks = `A plan can have at most ${LIMITS.tasks} tasks.`;
  return errors;
}

/**
 * The request body. The lists are always sent: the backend lets a list you send win over the
 * template's (an empty list included), so removing a template item in the form removes it from the plan.
 */
export function buildCreateBody(draft: PlanDraft, templateId: string | null): CarePlanCreateBody {
  const start = draft.startDate.trim();
  const duration = wholeNumber(draft.durationDays);
  const review = wholeNumber(draft.reviewEveryDays);
  return {
    ...(templateId ? { template_id: templateId } : {}),
    diagnosis: draft.diagnosis.trim(),
    risk_level: draft.risk,
    ...(start ? { start_date: start } : {}),
    ...(duration !== null ? { duration_days: duration } : {}),
    ...(review !== null ? { review_every_days: review } : {}),
    goals: draft.goals.map((g) => ({ title: g.title.trim(), target: g.target?.trim() || null, frequency: g.frequency })),
    tasks: draft.tasks.map((t) => ({
      title: t.title.trim(),
      time_slot: t.time_slot,
      time_of_day: t.time_of_day,
      days_of_week: [...t.days_of_week].sort((a, b) => a - b),
    })),
    allergies: splitLines(draft.allergies),
    special_instructions: splitLines(draft.specialInstructions),
  };
}

/** Checks one goal typed into the add-goal form or the create form. */
export function validateGoal(goal: { title: string; target: string }): { title?: string; target?: string } {
  const errors: { title?: string; target?: string } = {};
  const title = goal.title.trim();
  if (!title) errors.title = "Enter the goal.";
  else if (title.length > LIMITS.title) errors.title = `Keep the goal to ${LIMITS.title} characters.`;
  if (goal.target.trim().length > LIMITS.target) errors.target = `Keep the target to ${LIMITS.target} characters.`;
  return errors;
}

// --- Reading a plan ------------------------------------------------------------------------------------------------------

/** A removed goal stays on the plan as `discontinued`; the app hides it. */
export const visibleGoals = (plan: Pick<CarePlan, "goals">) => plan.goals.filter((g) => g.status !== "discontinued");

/**
 * A goal write answers `{ goal, plan_version }`: put the goal in the plan we hold and take the new
 * version, which is the next `expected_version` (guide 16.9).
 */
export function applyGoalResult(plan: CarePlan, result: GoalWriteResult): CarePlan {
  const exists = plan.goals.some((g) => g.id === result.goal.id);
  return {
    ...plan,
    version: result.plan_version,
    goals: exists ? plan.goals.map((g) => (g.id === result.goal.id ? result.goal : g)) : [...plan.goals, result.goal],
  };
}

/** A template list item or detail, searched by name or summary. */
export function matchesQuery(item: { name: string; summary: string }, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || item.name.toLowerCase().includes(q) || item.summary.toLowerCase().includes(q);
}
