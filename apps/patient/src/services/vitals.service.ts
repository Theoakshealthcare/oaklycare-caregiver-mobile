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

  /**
   * `GET /vitals/access/list`: the caregivers THIS patient has shared with (active grants only; `caregiver_name` is the name to
   * show). The patient and caregiver ids are the PROFILE ids (`/auth/me` -> `patient.id`, a booking's `caregiver_id`), never the
   * user id.
   */
  accessList() {
    return unwrap(api.GET("/api/v1/vitals/access/list"));
  },

  /** `POST /vitals/access/grant`. Granting twice returns the same grant. The caregiver can read and add vitals straight away. */
  grant(patientId: string, caregiverId: string) {
    return unwrap(api.POST("/api/v1/vitals/access/grant", { body: { patient_id: patientId, caregiver_id: caregiverId } }));
  },

  /** `POST /vitals/access/revoke`. Ends the grant at once; a visit already in progress still gives that caregiver access. */
  revoke(patientId: string, caregiverId: string) {
    return unwrap(api.POST("/api/v1/vitals/access/revoke", { body: { patient_id: patientId, caregiver_id: caregiverId } }));
  },
};
