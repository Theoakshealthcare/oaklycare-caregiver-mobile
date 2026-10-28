import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/src/api/keys";
import { useSession } from "@/src/auth";
import { applyGoalResult, conflictPlan, errorCode } from "@/src/careplan/carePlanModel";
import {
  carePlansService,
  type CarePlan,
  type CarePlanCreateBody,
  type CarePlanPatchBody,
  type GoalStatus,
  type NewGoal,
  type PlanListStatus,
} from "@/src/services/carePlans.service";

/**
 * Care plans are health data: every query lives in memory only, with a short `gcTime`, and the whole
 * cache is cleared on sign-out (`src/auth/index.ts`). Nothing is persisted.
 */
const GC_TIME = 2 * 60_000;

function useSignedIn(): boolean {
  return useSession((s) => s.status === "signedIn");
}

/** Nurses only; a non-nurse gets 403 `not_a_nurse`, which is not retried. */
export function usePlanTemplates(enabled = true) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: queryKeys.carePlanTemplates,
    queryFn: carePlansService.listTemplates,
    enabled: signedIn && enabled,
    gcTime: GC_TIME,
  });
}

export function usePlanTemplate(templateId: string | undefined) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: queryKeys.carePlanTemplate(templateId ?? ""),
    queryFn: () => carePlansService.getTemplate(templateId as string),
    enabled: signedIn && !!templateId,
    gcTime: GC_TIME,
  });
}

/** The Assigned tab. Keeps the previous list on screen while a new search loads. */
export function useAssignedPlans(status: PlanListStatus, q: string, enabled = true) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: queryKeys.carePlans(status, q),
    queryFn: () => carePlansService.listPlans(status, q),
    enabled: signedIn && enabled,
    gcTime: GC_TIME,
    // Keep the list on screen while a search loads, but never show Active plans under the Completed filter.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[1] === status ? previous : undefined),
  });
}

export function usePlanCandidates(enabled = true) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: queryKeys.carePlanCandidates,
    queryFn: carePlansService.listCandidates,
    enabled: signedIn && enabled,
    gcTime: GC_TIME,
  });
}

/** One visit's view of the client's plan: `plan: null` is "no plan yet", a 404 is "no access". */
export function useVisitCarePlan(bookingId: string) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: queryKeys.visitCarePlan(bookingId),
    queryFn: () => carePlansService.getVisitPlan(bookingId),
    enabled: signedIn,
    gcTime: GC_TIME,
  });
}

export function useCarePlan(planId: string, enabled = true) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: queryKeys.carePlan(planId),
    queryFn: () => carePlansService.getPlan(planId),
    enabled: signedIn && enabled,
    gcTime: GC_TIME,
  });
}

/** Anything that lists plans (the hub, the picker, the client-profile row) is stale after a plan changes. */
function refreshLists(client: QueryClient) {
  void client.invalidateQueries({ queryKey: queryKeys.allCarePlans });
  void client.invalidateQueries({ queryKey: queryKeys.allVisitCarePlans });
  void client.invalidateQueries({ queryKey: queryKeys.carePlanCandidates });
}

/**
 * A 409 `version_conflict` carries the current plan: keep it so the next save uses the right version.
 * A 409 `plan_not_editable` means it was completed or archived elsewhere: reload so the controls go away.
 */
function keepConflictPlan(client: QueryClient, planId: string, error: unknown) {
  const current = conflictPlan(error);
  if (current) client.setQueryData(queryKeys.carePlan(planId), current);
  else if (errorCode(error) === "plan_not_editable") void client.invalidateQueries({ queryKey: queryKeys.carePlan(planId) });
}

export function useCreateCarePlan() {
  const client = useQueryClient();
  return useMutation({
    gcTime: GC_TIME,
    mutationFn: (vars: { bookingId: string; body: CarePlanCreateBody }) =>
      carePlansService.createPlan(vars.bookingId, vars.body),
    onSuccess: (plan) => client.setQueryData(queryKeys.carePlan(plan.id), plan),
    // Also after a 409 `care_plan_exists`: what is on the lists is stale.
    onSettled: () => refreshLists(client),
  });
}

/** Header fields, allergies, special instructions, complete or archive. `expected_version` is added by the caller. */
export function usePatchCarePlan(planId: string) {
  const client = useQueryClient();
  return useMutation({
    gcTime: GC_TIME,
    mutationFn: (body: CarePlanPatchBody) => carePlansService.patchPlan(planId, body),
    onSuccess: (plan: CarePlan) => {
      client.setQueryData(queryKeys.carePlan(planId), plan);
      refreshLists(client);
    },
    onError: (error) => keepConflictPlan(client, planId, error),
  });
}

function putGoalResult(client: QueryClient, planId: string, result: Parameters<typeof applyGoalResult>[1]) {
  client.setQueryData<CarePlan>(queryKeys.carePlan(planId), (plan) => (plan ? applyGoalResult(plan, result) : plan));
  // The lists carry a goal count in the visit summary only; the plan itself was updated in place.
  void client.invalidateQueries({ queryKey: queryKeys.allVisitCarePlans });
}

export function useAddGoal(planId: string) {
  const client = useQueryClient();
  return useMutation({
    gcTime: GC_TIME,
    mutationFn: (goal: NewGoal) => carePlansService.addGoal(planId, goal),
    onSuccess: (result) => putGoalResult(client, planId, result),
    onError: (error) => keepConflictPlan(client, planId, error),
  });
}

export function useEditGoal(planId: string) {
  const client = useQueryClient();
  return useMutation({
    gcTime: GC_TIME,
    mutationFn: (vars: { goalId: string; expectedVersion: number; changes: Partial<NewGoal> & { status?: GoalStatus } }) =>
      carePlansService.patchGoal(vars.goalId, vars.expectedVersion, vars.changes),
    onSuccess: (result) => putGoalResult(client, planId, result),
    onError: (error) => keepConflictPlan(client, planId, error),
  });
}
