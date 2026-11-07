import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toCreateBody, toReading, type VitalInput, type VitalReading } from "@/src/domain/vitals";
import { vitalsService } from "@/src/services/vitals.service";

import { useMe } from "./queries";

export const vitalKeys = {
  all: ["vitals"] as const,
  list: (patientId: string | undefined) => ["vitals", "list", patientId] as const,
};

/**
 * The patient's readings, newest first, from `GET /vitals/{patient_id}`. The id is the PATIENT's (`/auth/me` -> `patient.id`),
 * which is why an edit of the profile must never drop `user.patient`. Rows the app cannot show (another type, a value that is
 * not a number) are left out.
 */
export function useVitalReadings() {
  const me = useMe();
  const patientId = me.data?.patient?.id;
  return useQuery({
    queryKey: vitalKeys.list(patientId),
    enabled: Boolean(patientId),
    queryFn: () => vitalsService.list(patientId as string),
    select: (rows): VitalReading[] =>
      rows
        .map(toReading)
        .filter((r): r is VitalReading => r !== null)
        .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
  });
}

export function useAddVital() {
  const client = useQueryClient();
  const me = useMe();
  return useMutation({
    mutationFn: async (input: VitalInput) => {
      const patientId = me.data?.patient?.id;
      const userId = me.data?.id;
      if (!patientId || !userId) throw new Error("Your profile is not ready yet.");
      return vitalsService.create(toCreateBody(input, { patientId, userId }));
    },
    onSuccess: () => client.invalidateQueries({ queryKey: vitalKeys.all }),
  });
}
