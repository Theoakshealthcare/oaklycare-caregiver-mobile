import type { Schemas } from "@oakly/api-client";

import { api } from "@/src/api/client";
import { unwrap } from "@/src/api/unwrap";

export type ClientProfile = Schemas["CaregiverClientProfile"];
export type ClientVital = Schemas["ClientVital"];

export const clientsService = {
  /**
   * Who the visit is for. Health data: not logged, not cached to disk (in-memory query cache only).
   * 404 `Client not found` for anything that is not your accepted / on-the-way / in-progress visit.
   */
  getClientProfile(bookingId: string) {
    return unwrap(
      api.GET("/api/v1/caregiver/bookings/{booking_id}/client", { params: { path: { booking_id: bookingId } } }),
    );
  },
};
