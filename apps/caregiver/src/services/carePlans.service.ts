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
};
