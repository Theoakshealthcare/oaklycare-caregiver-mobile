import { useMutation, useQueryClient } from "@tanstack/react-query";

import { applyMedicationResult } from "@/src/careplan/carePlanModel";
import { queryKeys } from "@/src/api/keys";
import { keepConflictPlan } from "@/src/hooks/useCarePlans";
import { carePlansService, type CarePlan, type NewMedication } from "@/src/services/carePlans.service";

/**
 * Medications are health data and a record only: there is no query of their own (they ride on the plan), nothing is
 * persisted, nothing is optimistic, and nothing is queued. Same `gcTime` rule as the other care plan hooks.
 */
const GC_TIME = 2 * 60_000;

/** Add a medication (nurses). The answer carries the plan's new version, which is put into the cached plan. */
export function useAddMedication(planId: string) {
  const client = useQueryClient();
  return useMutation({
    gcTime: GC_TIME,
    mutationFn: (medication: NewMedication) => carePlansService.addMedication(planId, medication),
    onSuccess: (result) => {
      // Adding sends no version, so it succeeds even when the plan moved on (another nurse edited it). Only when the
      // answer is exactly one version past ours is the cached plan current; otherwise taking `plan_version` would hide
      // the other change and let the next edit overwrite it, so the plan is reloaded instead.
      const held = client.getQueryData<CarePlan>(queryKeys.carePlan(planId));
      if (held && result.plan_version === held.version + 1) {
        client.setQueryData<CarePlan>(queryKeys.carePlan(planId), applyMedicationResult(held, result));
      } else {
        void client.invalidateQueries({ queryKey: queryKeys.carePlan(planId) });
      }
    },
    // `plan_not_editable` reloads the plan so the controls go away. (No `version_conflict`: adding sends no version.)
    onError: (error) => keepConflictPlan(client, planId, error),
  });
}
