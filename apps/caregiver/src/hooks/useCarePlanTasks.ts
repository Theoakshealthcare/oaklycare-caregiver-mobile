import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/src/api/keys";
import { useSession } from "@/src/auth";
import { applyCompletion, applyTaskResult } from "@/src/careplan/carePlanModel";
import { keepConflictPlan } from "@/src/hooks/useCarePlans";
import {
  carePlansService,
  type CarePlan,
  type NewTask,
  type NoteCategory,
  type TaskDay,
} from "@/src/services/carePlans.service";

/** Same rules as `useCarePlans`: in memory only, short `gcTime`, cleared on sign-out, nothing persisted. */
const GC_TIME = 2 * 60_000;

/** The query-key name of the default day: today, which the backend resolves in Africa/Lagos. */
export const TODAY = "today";

function useSignedIn(): boolean {
  return useSession((s) => s.status === "signedIn");
}

/** One day of tasks. `date` null is "today" (no `date` is sent, so the backend's Lagos date decides). */
export function useTaskDay(planId: string, date: string | null, enabled = true) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: queryKeys.carePlanTasks(planId, date ?? TODAY),
    queryFn: () => carePlansService.getTaskDay(planId, date ?? undefined),
    enabled: signedIn && enabled,
    gcTime: GC_TIME,
  });
}

/**
 * Tick or untick. Never optimistic and never retried or queued (guide 16.19): the box changes only when the
 * server answers, and the answer (who, when) is what is shown. A refusal is read by the caller (`tickFailure`).
 */
export function useTickTask(planId: string) {
  const client = useQueryClient();
  return useMutation({
    gcTime: GC_TIME,
    mutationFn: (vars: { taskId: string; date: string; done: boolean }) =>
      carePlansService.setCompletion(vars.taskId, vars.date, vars.done),
    onSuccess: (completion) => {
      // "Today" is cached under its own key and under its date: update whichever copy holds this day.
      client.setQueriesData<TaskDay>({ queryKey: queryKeys.allCarePlanTasks(planId) }, (day) =>
        day && day.date === completion.date ? applyCompletion(day, completion) : day,
      );
      void client.invalidateQueries({ queryKey: queryKeys.carePlanProgress(planId) });
      void client.invalidateQueries({ queryKey: queryKeys.allCarePlans });
    },
  });
}

/** Reload what a refused tick showed wrongly: the plan's capabilities, or the day itself. */
export function useReloadAfterTick(planId: string) {
  const client = useQueryClient();
  return (reload: "day" | "plan" | "none") => {
    if (reload === "plan") void client.invalidateQueries({ queryKey: queryKeys.carePlan(planId) });
    if (reload === "day" || reload === "plan") void client.invalidateQueries({ queryKey: queryKeys.allCarePlanTasks(planId) });
  };
}

/** Add a task definition (nurses). The answer carries the plan's new version, which is put into the cached plan. */
export function useAddTask(planId: string) {
  const client = useQueryClient();
  return useMutation({
    gcTime: GC_TIME,
    mutationFn: (task: NewTask) => carePlansService.addTask(planId, task),
    onSuccess: (result) => {
      client.setQueryData<CarePlan>(queryKeys.carePlan(planId), (plan) => (plan ? applyTaskResult(plan, result) : plan));
      void client.invalidateQueries({ queryKey: queryKeys.allCarePlanTasks(planId) });
      void client.invalidateQueries({ queryKey: queryKeys.carePlanProgress(planId) });
      void client.invalidateQueries({ queryKey: queryKeys.allVisitCarePlans });
    },
    onError: (error) => keepConflictPlan(client, planId, error),
  });
}

/** One category of notes, newest first, paged with the server's two-part cursor. */
export function useNotes(planId: string, category: NoteCategory, enabled = true) {
  const signedIn = useSignedIn();
  return useInfiniteQuery({
    queryKey: queryKeys.carePlanNotes(planId, category),
    queryFn: ({ pageParam }) => carePlansService.listNotes(planId, category, pageParam ?? undefined),
    initialPageParam: null as { before: string; beforeId: string } | null,
    getNextPageParam: (last) =>
      last.next_before && last.next_before_id ? { before: last.next_before, beforeId: last.next_before_id } : undefined,
    enabled: signedIn && enabled,
    gcTime: GC_TIME,
  });
}

/** Notes are append-only: a new one is added, never edited. The list reloads so it appears at the top. */
export function useAddNote(planId: string) {
  const client = useQueryClient();
  return useMutation({
    gcTime: GC_TIME,
    mutationFn: (vars: { body: string; category: NoteCategory }) =>
      carePlansService.addNote(planId, vars.body, vars.category),
    onSuccess: (_note, vars) => {
      void client.invalidateQueries({ queryKey: queryKeys.carePlanNotes(planId, vars.category) });
      void client.invalidateQueries({ queryKey: queryKeys.carePlanProgress(planId) });
    },
    onError: (error) => keepConflictPlan(client, planId, error),
  });
}

export function useCarePlanProgress(planId: string, enabled = true) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: queryKeys.carePlanProgress(planId),
    queryFn: () => carePlansService.getProgress(planId),
    enabled: signedIn && enabled,
    gcTime: GC_TIME,
  });
}
