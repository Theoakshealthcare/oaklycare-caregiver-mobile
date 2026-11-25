import type { Schemas } from "@oakly/api-client";

import { api } from "@/src/api/client";
import { unwrap } from "@/src/api/unwrap";

export type VisitDocument = Schemas["DocumentOut"];
export type VisitDocumentList = Schemas["DocumentList"];

/**
 * The caregiver's own documentation for a visit. Private: it is read only by its author and the admin console, and the
 * family never sees it. Health text: nothing here logs, stores or persists a response.
 */
export const visitDocumentationService = {
  list(bookingId: string) {
    return unwrap(
      api.GET("/api/v1/caregiver/bookings/{booking_id}/documentation", { params: { path: { booking_id: bookingId } } }),
    );
  },

  add(bookingId: string, body: string) {
    return unwrap(
      api.POST("/api/v1/caregiver/bookings/{booking_id}/documentation", {
        params: { path: { booking_id: bookingId } },
        body: { body },
      }),
    );
  },
};
