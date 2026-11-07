import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/api/client";
import { unwrap } from "@/src/api/unwrap";
import { vitalsService } from "@/src/services/vitals.service";

import { useMe } from "./queries";

export const accessKeys = {
  list: ["vitals", "access"] as const,
  candidates: ["vitals", "access", "candidates"] as const,
};

export interface AccessGrant {
  caregiverId: string;
  name: string;
}

/** The caregivers the patient has shared their vitals with now (active grants only). */
export function useVitalAccessList() {
  return useQuery({
    queryKey: accessKeys.list,
    queryFn: vitalsService.accessList,
    select: (rows): AccessGrant[] =>
      rows.map((row) => ({ caregiverId: row.caregiver_id, name: row.caregiver_name?.trim() || "Your caregiver" })),
  });
}

/**
 * Caregivers the patient could share with: the ones on their own bookings (a booking's `caregiver_id` is the caregiver PROFILE id
 * the grant needs; there is no caregiver search). Cancelled and declined bookings are left out; each caregiver appears once.
 */
export function useShareableCaregivers() {
  return useQuery({
    queryKey: accessKeys.candidates,
    queryFn: async (): Promise<AccessGrant[]> => {
      const rows = await unwrap(api.GET("/api/v1/booking/patient/bookings", { params: { query: {} } }));
      const seen = new Map<string, AccessGrant>();
      for (const row of rows) {
        if (!row.caregiver_id || row.status === "cancelled" || row.status === "declined" || seen.has(row.caregiver_id)) continue;
        seen.set(row.caregiver_id, { caregiverId: row.caregiver_id, name: row.caregiver_details?.full_name?.trim() || "Your caregiver" });
      }
      return [...seen.values()];
    },
  });
}

/** Shares (`grant`) or stops sharing (`revoke`) with one caregiver, then reads the list again. */
export function useChangeVitalAccess(action: "grant" | "revoke") {
  const client = useQueryClient();
  const me = useMe();
  return useMutation({
    mutationFn: async (caregiverId: string) => {
      const patientId = me.data?.patient?.id;
      if (!patientId) throw new Error("Your profile is not ready yet.");
      return action === "grant" ? vitalsService.grant(patientId, caregiverId) : vitalsService.revoke(patientId, caregiverId);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: accessKeys.list }),
  });
}
