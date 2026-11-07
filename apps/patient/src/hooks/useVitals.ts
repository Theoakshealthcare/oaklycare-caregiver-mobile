import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { VitalAccessEntry, VitalInput, VitalReading } from "@/src/domain/vitals";
import { sampleAccess, sampleReadings } from "@/src/fixtures/vitals";

import { sampleKeys, useFixtureQuery } from "./fixture";

/** Sample readings until the vitals slice reads `GET /vitals/{patient_id}`. */
export function useVitalReadings() {
  return useFixtureQuery(["readings"], () => sampleReadings());
}

export function useAddVital() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: VitalInput) => {
      const reading: VitalReading = { ...input, id: `r-${Date.now()}`, recordedAt: new Date().toISOString() };
      client.setQueryData<VitalReading[]>(sampleKeys.readings, (list) => [reading, ...(list ?? [])]);
    },
  });
}

/** Which caregivers can read the patient's vitals. */
export function useVitalAccess() {
  return useFixtureQuery(["access"], () => sampleAccess());
}

export function useSetVitalAccess() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, granted }: { id: string; granted: boolean }) => {
      client.setQueryData<VitalAccessEntry[]>(sampleKeys.access, (list) =>
        list?.map((a) => (a.id === id ? { ...a, granted, grantedAt: granted ? new Date().toISOString() : null } : a)),
      );
    },
  });
}
