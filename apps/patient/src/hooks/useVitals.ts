import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toCreateBody, toInsights, toReading, type VitalInput, type VitalReading } from "@/src/domain/vitals";
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

/**
 * The AI's notes on the readings, as sentences. The server calls the AI on every request, so this waits for a reading to exist,
 * keeps the answer for half an hour and does not refetch on focus; a new reading does refresh it (the key is under `vitalKeys.all`).
 */
export function useVitalInsights() {
  const me = useMe();
  const patientId = me.data?.patient?.id;
  const readings = useVitalReadings();
  return useQuery({
    queryKey: [...vitalKeys.all, "insights", patientId, readings.data?.length ?? 0] as const,
    enabled: Boolean(patientId) && (readings.data?.length ?? 0) > 0,
    queryFn: () => vitalsService.insights(patientId as string),
    select: toInsights,
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** Fetches the whole record as CSV (the share sheet then hands it on). The id is the PATIENT's. */
export function useDownloadVitals() {
  const me = useMe();
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const patientId = me.data?.patient?.id;
      if (!patientId) throw new Error("Your profile is not ready yet.");
      return vitalsService.downloadCsv(patientId);
    },
  });
}

export function useAddVital() {
  const client = useQueryClient();
  const me = useMe();
  return useMutation({
    // Glucose can send up to three readings at once (one per box): in order, stopping at the first the server refuses.
    mutationFn: async (inputs: VitalInput[]) => {
      const patientId = me.data?.patient?.id;
      const userId = me.data?.id;
      if (!patientId || !userId) throw new Error("Your profile is not ready yet.");
      for (const input of inputs) await vitalsService.create(toCreateBody(input, { patientId, userId }));
    },
    // Also after a failure: a reading saved before the refusal is on record.
    onSettled: () => client.invalidateQueries({ queryKey: vitalKeys.all }),
  });
}
