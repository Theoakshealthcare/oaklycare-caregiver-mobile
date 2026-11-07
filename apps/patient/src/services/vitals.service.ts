import type { Schemas } from "@oakly/api-client";

import { api } from "@/src/api/client";
import { unwrap } from "@/src/api/unwrap";

export const vitalsService = {
  /** `GET /vitals/{patient_id}`: every reading of that PATIENT id (not the user id). 403 `Access denied` for anyone else's. */
  list(patientId: string) {
    return unwrap(api.GET("/api/v1/vitals/{patient_id}", { params: { path: { patient_id: patientId } } }));
  },

  /** `POST /vitals/`. The server stores whatever text it is given: validate before calling. 403 when `patient_id` is not yours. */
  create(body: Schemas["PatientVitalCreate"]) {
    return unwrap(api.POST("/api/v1/vitals/", { body }));
  },
};
