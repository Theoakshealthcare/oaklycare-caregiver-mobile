import type { Schemas } from "@oakly/api-client";

import { api } from "@/src/api/client";
import { unwrap } from "@/src/api/unwrap";

export type PatientVital = Schemas["PatientVitalResponse"];

export interface NewVital {
  patientId: string;
  /** The signed-in caregiver's user id (`GET /auth/me`); the API requires it in the body. */
  recordedByUserId: string;
  vital_type: string;
  value: string;
  unit: string;
  notes: string | null;
}

/**
 * Vitals are health data: nothing here logs, stores or caches a reading. Responses live only in the
 * in-memory query cache, which is cleared on sign-out.
 */
export const vitalsService = {
  /** Newest first. 403 `Access denied` unless a visit with this patient is in progress. */
  list(patientId: string, start?: string) {
    return unwrap(
      api.GET("/api/v1/vitals/{patient_id}", {
        params: { path: { patient_id: patientId }, query: start ? { start } : {} },
      }),
    );
  },

  create(input: NewVital) {
    return unwrap(
      api.POST("/api/v1/vitals/", {
        body: {
          patient_id: input.patientId,
          recorded_by_user_id: input.recordedByUserId,
          vital_type: input.vital_type,
          value: input.value,
          unit: input.unit,
          notes: input.notes,
          source: "manual",
        },
      }),
    );
  },

  /** The report is CSV, not JSON: read as text (the schema types the body as unknown). */
  async downloadCsv(patientId: string): Promise<string> {
    const body: unknown = await unwrap(
      api.GET("/api/v1/vitals/{patient_id}/download", { params: { path: { patient_id: patientId } }, parseAs: "text" }),
    );
    return typeof body === "string" ? body : "";
  },
};
