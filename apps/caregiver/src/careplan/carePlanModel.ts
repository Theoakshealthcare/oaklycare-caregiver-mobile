/**
 * Care plans: the pure rules behind the screens. Labels, the create-form draft and its validation,
 * and how the backend's error bodies are read. Shapes follow the backend's verified FE guide
 * (`fe-integration-guide-caregiver.md`, section 16). Nothing here touches the network or the disk.
 */
import { ApiError } from "@/src/api/errors";
import type {
  CarePlan,
  CarePlanCreateBody,
  CarePlanMedication,
  CarePlanProgress,
  CarePlanTemplate,
  GoalFrequency,
  GoalWriteResult,
  MedicationFrequency,
  MedicationWriteResult,
  NewGoal,
  NewMedication,
  NewTask,
  TaskCompletion,
  TaskDay,
  TaskWriteResult,
} from "@/src/services/carePlans.service";
import { parseBackendDate } from "@/src/utils/dates";

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

// --- M2: daily tasks, ticks, notes, progress (guide sections 16.13 to 16.19) -----------------------------------------

export const VISIT_ONLY_HINT = "Available during an active visit.";
export const PAST_DAY_HINT = "Only today's tasks can be ticked. Other days are read-only.";
export const NOTE_PERMANENT_HINT = "A note can't be edited or deleted once you submit it. To correct one, add a new note.";
export const TICK_DAY_CHANGED_HINT = "The day changed, so your tick was not saved. We've loaded today's tasks.";
export const TICK_NOT_SCHEDULED_HINT = "That task is not scheduled for this day. We've refreshed the list.";
export const NO_PROGRESS_YET = "No visits yet";

/** Monday to Sunday in the order the day tabs show them (backend numbering: 1 = Monday .. 7 = Sunday). */
export const WEEK_TABS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const isoOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * The Monday-to-Sunday week that contains `today` (a `YYYY-MM-DD` the backend resolved in Africa/Lagos). Pure
 * calendar arithmetic in UTC: the phone's time zone and clock never decide which day is "today".
 */
export function weekOf(today: string): { date: string; label: string }[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!m) return [];
  const base = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const sinceMonday = (new Date(base).getUTCDay() + 6) % 7;
  return WEEK_TABS.map((label, i) => ({ date: isoOf(base + (i - sinceMonday) * 86_400_000), label }));
}

/** "08:00" -> "8:00 AM", "18:00" -> "6:00 PM". Anything else is returned as it came. */
export function clockLabel(time: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(time ?? "");
  if (!m) return time ?? "";
  const hour = Number(m[1]);
  return `${hour % 12 === 0 ? 12 : hour % 12}:${m[2]} ${hour < 12 ? "AM" : "PM"}`;
}

/** "Morning (8:00 AM)", or just "Evening" when no task in the slot has a time. */
export function slotHeading(slot: TimeSlot, time: string | null | undefined): string {
  return time ? `${slotLabel(slot)} (${clockLabel(time)})` : slotLabel(slot);
}

/** `HH:MM` on a 24-hour clock, the format the backend stores. */
export const isTimeOfDay = (text: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(text.trim());

export interface TaskDraft {
  title: string;
  slot: TimeSlot;
  /** Blank = no time. */
  time: string;
  days: number[];
}

export const emptyTaskDraft = (): TaskDraft => ({ title: "", slot: "morning", time: "", days: [...DAILY] });

export function validateTask(draft: TaskDraft): { title?: string; time?: string; days?: string } {
  const errors: { title?: string; time?: string; days?: string } = {};
  const title = draft.title.trim();
  if (!title) errors.title = "Enter the task.";
  else if (title.length > LIMITS.title) errors.title = `Keep the task to ${LIMITS.title} characters.`;
  if (draft.time.trim() && !isTimeOfDay(draft.time)) errors.time = "Use the 24-hour format HH:MM, for example 08:00.";
  if (draft.days.length === 0) errors.days = "Choose at least one day.";
  return errors;
}

export function buildTaskBody(draft: TaskDraft): NewTask {
  const time = draft.time.trim();
  return {
    title: draft.title.trim(),
    time_slot: draft.slot,
    ...(time ? { time_of_day: time } : {}),
    days_of_week: [...draft.days].sort((a, b) => a - b),
  };
}

/** A task write answers `{ task, plan_version }`: add the task to the plan we hold and take the new version. */
export function applyTaskResult(plan: CarePlan, result: TaskWriteResult): CarePlan {
  const exists = plan.tasks.some((t) => t.id === result.task.id);
  return {
    ...plan,
    version: result.plan_version,
    tasks: exists ? plan.tasks.map((t) => (t.id === result.task.id ? result.task : t)) : [...plan.tasks, result.task],
  };
}

/** The server's answer to a tick is the truth (who, when), including when another caregiver ticked first. */
export function applyCompletion(day: TaskDay, completion: TaskCompletion): TaskDay {
  return {
    ...day,
    slots: day.slots.map((slot) => ({
      ...slot,
      tasks: slot.tasks.map((t) =>
        t.id === completion.task_id
          ? { ...t, done: completion.done, done_by: completion.done_by ?? null, done_at: completion.done_at ?? null }
          : t,
      ),
    })),
  };
}

export interface TickFailure {
  message: string;
  /** What to reload so the screen shows the truth again. */
  reload: "day" | "plan" | "none";
  noAccess: boolean;
}

/** What to tell the caregiver, and what to reload, when a tick is refused (guide 16.16). Never retried or queued. */
export function tickFailure(error: unknown, fallback: string): TickFailure {
  if (isNoAccess(error)) return { message: NOT_AVAILABLE_TITLE, reload: "none", noAccess: true };
  switch (errorCode(error)) {
    case "visit_not_in_progress":
      return { message: VISIT_ONLY_HINT, reload: "plan", noAccess: false };
    case "plan_not_editable":
      return { message: "This plan is completed or archived and can't be changed.", reload: "plan", noAccess: false };
    case "task_date_not_today":
      return { message: TICK_DAY_CHANGED_HINT, reload: "day", noAccess: false };
    case "task_not_scheduled":
      return { message: TICK_NOT_SCHEDULED_HINT, reload: "day", noAccess: false };
    default:
      return { message: fallback, reload: "none", noAccess: false };
  }
}

export const NOTE_MAX = 2000;

/** The note box: 1 to 2000 characters after trimming (the backend trims too). */
export function validateNote(text: string): string | null {
  const body = text.trim();
  if (!body) return "Write a note first.";
  if (body.length > NOTE_MAX) return `Keep the note to ${NOTE_MAX} characters.`;
  return null;
}

/** "28 Oct, 09:14" in the phone's own zone, from a backend UTC timestamp (no `Z`). Empty when it can't be read. */
export function formatStamp(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = parseBackendDate(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

/** "09:14" for the "Nurse Saliu, 09:14" line under a ticked task. */
export function formatClock(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = parseBackendDate(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** "Done by Nurse Saliu, 09:14". */
export const doneByText = (task: { done_by?: string | null; done_at?: string | null }): string => {
  const who = task.done_by ?? "a caregiver";
  const when = formatClock(task.done_at);
  return when ? `Done by ${who}, ${when}` : `Done by ${who}`;
};

/** The headline of View Progress: a percentage, or "No visits yet" (never 0%) when nothing is measurable yet. */
export const progressHeadline = (progress: Pick<CarePlanProgress, "overall_percent">): string =>
  progress.overall_percent === null || progress.overall_percent === undefined ? NO_PROGRESS_YET : `${progress.overall_percent}%`;

/** "Day 9 of 30", or "Starts soon" before the plan's first day. */
export const dayOfPlan = (progress: Pick<CarePlanProgress, "day" | "of_days">): string =>
  progress.day <= 0 ? "Not started yet" : `Day ${progress.day} of ${progress.of_days}`;

/** "Mon 21 Oct" label for a bar of the per-day chart. */
export function shortDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return isoDate;
  const dow = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
  return `${WEEK_TABS[(dow + 6) % 7]} ${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? ""}`;
}

// --- The prompt before "Complete visit" ----------------------------------------------------------------------------------

export const CLOCK_OUT_PROMPT = {
  title: "Add your notes before you finish?",
  message:
    "Once the visit is complete you can no longer tick tasks or add notes to this client's care plan. Check today's tasks and add a visit note first.",
  review: "Review care plan",
  anyway: "Complete visit",
  cancel: "Not yet",
} as const;

/** Only a live plan that can still be ticked is worth a prompt; a missing, completed or archived plan is not. */
export const needsClockOutPrompt = (visit: { plan?: { status: string } | null } | undefined): boolean => visit?.plan?.status === "active";

// --- Medications (a record of what the prescriber ordered; guide 16.21 to 16.25) -------------------------------------------

/**
 * The notice shown on the medications section, always. The backend serves these words only inside its OpenAPI
 * descriptions (never in a response body), and the wording is pending clinical sign-off: it lives in this one string,
 * and a test fails if it drifts from the committed spec (`packages/api-client/openapi.json`). Do not paraphrase it.
 */
export const MEDICATION_NOTICE =
  "This is a record of what the prescriber ordered. Oakly does not check doses or interactions and does not remind anyone to give medicines. Follow the prescriber's instructions.";

export const MEDICATION_FREQUENCIES: { value: MedicationFrequency; label: string }[] = [
  { value: "once_daily", label: "Once daily" },
  { value: "twice_daily", label: "Twice daily" },
  { value: "three_times_daily", label: "Three times daily" },
  { value: "four_times_daily", label: "Four times daily" },
  { value: "weekly", label: "Weekly" },
  { value: "as_needed", label: "As needed" },
  { value: "other", label: "Other" },
];

export const medicationFrequencyLabel = (f: MedicationFrequency): string =>
  MEDICATION_FREQUENCIES.find((x) => x.value === f)?.label ?? f;

// Limits the backend enforces (guide 16.21 and 16.22).
export const MEDICATION_LIMITS = { name: 120, short: 60, reason: 200, prescribedBy: 120, note: 1000, times: 12 } as const;

export const MEDICATION_EMPTY = "No medications recorded yet.";
export const STOPPED_HEADING = "Stopped";

export interface MedicationDraft {
  name: string;
  strength: string;
  doseAmount: string;
  doseUnit: string;
  route: string;
  reason: string;
  prescribedBy: string;
  note: string;
  frequency: MedicationFrequency;
  /** `HH:MM` times separated by commas or spaces; optional. */
  times: string;
  /** Blank = the backend uses today (Africa/Lagos). */
  startDate: string;
  /** Blank = ongoing. */
  endDate: string;
}

export const emptyMedicationDraft = (): MedicationDraft => ({
  name: "",
  strength: "",
  doseAmount: "",
  doseUnit: "",
  route: "",
  reason: "",
  prescribedBy: "",
  note: "",
  frequency: "once_daily",
  times: "",
  startDate: "",
  endDate: "",
});

/** "08:00, 20:00" or "08:00 20:00" -> ["08:00", "20:00"]: the pieces as typed, without blanks. */
const timePieces = (text: string): string[] => text.split(/[\s,;]+/).filter(Boolean);

export type MedicationErrors = Partial<
  Record<"name" | "strength" | "doseAmount" | "doseUnit" | "route" | "reason" | "prescribedBy" | "note" | "times" | "startDate" | "endDate", string>
>;

export function validateMedication(draft: MedicationDraft): MedicationErrors {
  const errors: MedicationErrors = {};
  const name = draft.name.trim();
  if (!name) errors.name = "Enter the name of the medicine.";
  else if (name.length > MEDICATION_LIMITS.name) errors.name = `Keep the name to ${MEDICATION_LIMITS.name} characters.`;
  const capped = (
    key: "strength" | "doseAmount" | "doseUnit" | "route" | "reason" | "prescribedBy" | "note",
    max: number,
  ) => {
    if (draft[key].trim().length > max) errors[key] = `Keep this to ${max} characters.`;
  };
  capped("strength", MEDICATION_LIMITS.short);
  capped("doseAmount", MEDICATION_LIMITS.short);
  capped("doseUnit", MEDICATION_LIMITS.short);
  capped("route", MEDICATION_LIMITS.short);
  capped("reason", MEDICATION_LIMITS.reason);
  capped("prescribedBy", MEDICATION_LIMITS.prescribedBy);
  capped("note", MEDICATION_LIMITS.note);

  const times = timePieces(draft.times);
  if (times.some((t) => !isTimeOfDay(t))) errors.times = "Use the 24-hour format HH:MM, for example 08:00, separated by commas.";
  else if (new Set(times).size !== times.length) errors.times = "Each time can be listed once.";
  else if (times.length > MEDICATION_LIMITS.times) errors.times = `List at most ${MEDICATION_LIMITS.times} times.`;

  const start = draft.startDate.trim();
  const end = draft.endDate.trim();
  if (start && !isIsoDate(start)) errors.startDate = "Use the format YYYY-MM-DD, for example 2026-10-28.";
  if (end && !isIsoDate(end)) errors.endDate = "Use the format YYYY-MM-DD, for example 2026-11-25.";
  // ISO dates compare as text. With no start date the backend uses today and checks the end date itself.
  else if (end && start && !errors.startDate && end < start) errors.endDate = "The end date can't be before the start date.";
  return errors;
}

/** Only the filled-in fields are sent (an unset text is `null` on the server); the times go in earliest first. */
export function buildMedicationBody(draft: MedicationDraft): NewMedication {
  const text = (value: string) => value.trim() || undefined;
  const times = [...new Set(timePieces(draft.times))].sort();
  return {
    name: draft.name.trim(),
    frequency: draft.frequency,
    ...(text(draft.strength) ? { strength: text(draft.strength) } : {}),
    ...(text(draft.doseAmount) ? { dose_amount: text(draft.doseAmount) } : {}),
    ...(text(draft.doseUnit) ? { dose_unit: text(draft.doseUnit) } : {}),
    ...(text(draft.route) ? { route: text(draft.route) } : {}),
    ...(text(draft.reason) ? { reason: text(draft.reason) } : {}),
    ...(text(draft.prescribedBy) ? { prescribed_by: text(draft.prescribedBy) } : {}),
    ...(text(draft.note) ? { note: text(draft.note) } : {}),
    ...(times.length > 0 ? { times_of_day: times } : {}),
    ...(text(draft.startDate) ? { start_date: text(draft.startDate) } : {}),
    ...(text(draft.endDate) ? { end_date: text(draft.endDate) } : {}),
  };
}

/** Active medicines first, then the stopped ones (history), each in the order the server sent them. */
export function medicationGroups(plan: Pick<CarePlan, "medications">): { active: CarePlanMedication[]; stopped: CarePlanMedication[] } {
  return {
    active: plan.medications.filter((m) => m.status === "active"),
    stopped: plan.medications.filter((m) => m.status !== "active"),
  };
}

/** "500 mg · 1 tablet · oral": the strength, the dose and the route as the nurse wrote them. Never calculated. */
export function medicationDoseLine(m: Pick<CarePlanMedication, "strength" | "dose_amount" | "dose_unit" | "route">): string {
  const dose = [m.dose_amount, m.dose_unit].filter(Boolean).join(" ");
  return [m.strength, dose, m.route].filter(Boolean).join(" · ");
}

/** "Twice daily · 8:00 AM, 8:00 PM". The times are what was written down; nothing is "due" or "overdue". */
export function medicationScheduleLine(m: Pick<CarePlanMedication, "frequency" | "times_of_day">): string {
  const times = m.times_of_day.map(clockLabel).join(", ");
  return [medicationFrequencyLabel(m.frequency), times].filter(Boolean).join(" · ");
}

/** "From 28 Oct 2026 to 25 Nov 2026", or "From 28 Oct 2026" while it has no end date. */
export function medicationDatesLine(m: Pick<CarePlanMedication, "start_date" | "end_date">): string {
  const start = `From ${formatPlanDate(m.start_date)}`;
  return m.end_date ? `${start} to ${formatPlanDate(m.end_date)}` : start;
}

/** "Stopped 28 Oct, 13:55" in the phone's own zone, from the backend's UTC `stopped_at`. */
export const medicationStoppedLine = (m: Pick<CarePlanMedication, "stopped_at">): string => {
  const when = formatStamp(m.stopped_at);
  return when ? `Stopped ${when}` : "Stopped";
};

/**
 * A medication write answers `{ medication, plan_version }`: put the medicine in the plan we hold (a new active one goes
 * after the last active one, before the stopped history, as the server lists them) and take the new version.
 */
export function applyMedicationResult(plan: CarePlan, result: MedicationWriteResult): CarePlan {
  const exists = plan.medications.some((m) => m.id === result.medication.id);
  if (exists) {
    return { ...plan, version: result.plan_version, medications: plan.medications.map((m) => (m.id === result.medication.id ? result.medication : m)) };
  }
  const { active, stopped } = medicationGroups(plan);
  const medications = result.medication.status === "active" ? [...active, result.medication, ...stopped] : [...active, ...stopped, result.medication];
  return { ...plan, version: result.plan_version, medications };
}
