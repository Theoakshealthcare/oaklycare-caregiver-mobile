import type { Schemas } from "@oakly/api-client";

import { api } from "@/src/api/client";
import { unwrap } from "@/src/api/unwrap";

export type CarePlan = Schemas["CarePlanOut"];
export type CarePlanListItem = Schemas["CarePlanListItem"];
export type CarePlanCreateBody = Schemas["CarePlanCreate"];
export type CarePlanPatchBody = Schemas["CarePlanPatch"];
export type CarePlanGoal = Schemas["GoalOut"];
export type GoalWriteResult = Schemas["GoalWriteResult"];
export type VisitCarePlan = Schemas["VisitCarePlan"];
export type CarePlanTemplateItem = Schemas["TemplateListItem"];
export type CarePlanTemplate = Schemas["TemplateDetail"];
export type PlanCandidate = Schemas["Candidate"];
export type TaskDay = Schemas["TaskDay"];
export type DayTask = Schemas["DayTask"];
export type TaskCompletion = Schemas["CompletionOut"];
export type TaskWriteResult = Schemas["TaskWriteResult"];
export type CarePlanNote = Schemas["ObservationOut"];
export type CarePlanNotePage = Schemas["ObservationList"];
export type CarePlanProgress = Schemas["Progress"];
export type NoteCategory = Schemas["ObservationIn"]["category"];
export type NewTask = Schemas["TaskIn"];
export type CarePlanMedication = Schemas["MedicationOut"];
export type MedicationWriteResult = Schemas["MedicationWriteResult"];
export type NewMedication = Schemas["MedicationCreate"];
export type MedicationFrequency = NewMedication["frequency"];

export type PlanListStatus = "active" | "completed";
export type GoalFrequency = Schemas["GoalIn"]["frequency"];
export type GoalStatus = CarePlanGoal["status"];

export interface NewGoal {
  title: string;
  target: string | null;
  frequency: GoalFrequency;
}

/**
 * Care plans are health data: nothing here logs, stores or caches a response. They live only in the
 * in-memory query cache, which is cleared on sign-out. Backend contract: `fe-integration-guide-caregiver.md`
 * section 16 (B1).
 */
export const carePlansService = {
  /** Nurses only (403 `not_a_nurse`). */
  listTemplates() {
    return unwrap(api.GET("/api/v1/caregiver/care-plan-templates"));
  },

  getTemplate(templateId: string) {
    return unwrap(
      api.GET("/api/v1/caregiver/care-plan-templates/{template_id}", { params: { path: { template_id: templateId } } }),
    );
  },

  /** The Assigned tab: plans for the clients of the caller's live visits. `q` searches the client name. */
  listPlans(status: PlanListStatus, q?: string) {
    return unwrap(
      api.GET("/api/v1/caregiver/care-plans", { params: { query: { status, ...(q ? { q } : {}) } } }),
    );
  },

  /** Nurses only: live-visit clients without an active plan. */
  listCandidates() {
    return unwrap(api.GET("/api/v1/caregiver/care-plans/candidates"));
  },

  /** `plan: null` means access is fine and the client has no active plan yet; a 404 means no access. */
  getVisitPlan(bookingId: string) {
    return unwrap(
      api.GET("/api/v1/caregiver/bookings/{booking_id}/care-plan", { params: { path: { booking_id: bookingId } } }),
    );
  },

  createPlan(bookingId: string, body: CarePlanCreateBody) {
    return unwrap(
      api.POST("/api/v1/caregiver/bookings/{booking_id}/care-plan", {
        params: { path: { booking_id: bookingId } },
        body,
      }),
    );
  },

  getPlan(planId: string) {
    return unwrap(api.GET("/api/v1/caregiver/care-plans/{plan_id}", { params: { path: { plan_id: planId } } }));
  },

  patchPlan(planId: string, body: CarePlanPatchBody) {
    return unwrap(
      api.PATCH("/api/v1/caregiver/care-plans/{plan_id}", { params: { path: { plan_id: planId } }, body }),
    );
  },

  /** Adding never overwrites anything, so no `expected_version` is sent (the backend makes it optional). */
  addGoal(planId: string, goal: NewGoal) {
    return unwrap(
      api.POST("/api/v1/caregiver/care-plans/{plan_id}/goals", {
        params: { path: { plan_id: planId } },
        body: goal,
      }),
    );
  },

  /** `target: null` clears the target. */
  patchGoal(
    goalId: string,
    expectedVersion: number,
    changes: Partial<NewGoal> & { status?: GoalStatus },
  ) {
    return unwrap(
      api.PATCH("/api/v1/caregiver/care-plan-goals/{goal_id}", {
        params: { path: { goal_id: goalId } },
        body: { expected_version: expectedVersion, ...changes },
      }),
    );
  },

  /** The day view. No `date` means today, which the backend resolves in Africa/Lagos (the phone's clock is never used). */
  getTaskDay(planId: string, date?: string) {
    return unwrap(
      api.GET("/api/v1/caregiver/care-plans/{plan_id}/tasks", {
        params: { path: { plan_id: planId }, query: date ? { date } : {} },
      }),
    );
  },

  /** Adding never overwrites anything, so no `expected_version` is sent (the backend makes it optional). */
  addTask(planId: string, task: NewTask) {
    return unwrap(
      api.POST("/api/v1/caregiver/care-plans/{plan_id}/tasks", { params: { path: { plan_id: planId } }, body: task }),
    );
  },

  /**
   * Record a medicine the prescriber ordered (nurses). A record only: nothing here checks, reminds or counts doses.
   * Adding never overwrites anything, so no `expected_version` is sent (the backend makes it optional).
   */
  addMedication(planId: string, medication: NewMedication) {
    return unwrap(
      api.POST("/api/v1/caregiver/care-plans/{plan_id}/medications", {
        params: { path: { plan_id: planId } },
        body: medication,
      }),
    );
  },

  /** Idempotent: repeating it changes nothing. Today only, during the caller's own in-progress visit. */
  setCompletion(taskId: string, date: string, done: boolean) {
    return unwrap(
      api.PUT("/api/v1/caregiver/care-plan-tasks/{task_id}/completion", {
        params: { path: { task_id: taskId } },
        body: { date, done },
      }),
    );
  },

  /** Newest first. Pass both halves of the previous page's cursor (`next_before`, `next_before_id`). */
  listNotes(planId: string, category: NoteCategory, cursor?: { before: string; beforeId: string }) {
    return unwrap(
      api.GET("/api/v1/caregiver/care-plans/{plan_id}/observations", {
        params: {
          path: { plan_id: planId },
          query: { category, ...(cursor ? { before: cursor.before, before_id: cursor.beforeId } : {}) },
        },
      }),
    );
  },

  addNote(planId: string, body: string, category: NoteCategory) {
    return unwrap(
      api.POST("/api/v1/caregiver/care-plans/{plan_id}/observations", {
        params: { path: { plan_id: planId } },
        body: { body, category },
      }),
    );
  },

  getProgress(planId: string) {
    return unwrap(api.GET("/api/v1/caregiver/care-plans/{plan_id}/progress", { params: { path: { plan_id: planId } } }));
  },
};
