/**
 * Caregivers' own documentation for a visit (backend `visit_documentation.py`). Read only: the admin console never writes it.
 * It is private to the caregiver and the console and is never shown to the family. Reading needs `careplans.read`, and the
 * backend records every read in the audit log (the row holds the filters and the count, never the text).
 */
import type { Schemas } from "@oakly/api-client";

import { getApi, unwrap } from "@/lib/api";

export type VisitDocument = Schemas["AdminDocumentOut"];

export const DOCUMENTATION_READ = "careplans.read";
export const DOCUMENTATION_KEY = ["visit-documentation"] as const;
export const PAGE_SIZE = 20;

export interface DocumentationFilter {
  bookingId?: string;
  caregiverId?: string;
  offset: number;
}

/** A filter box takes a pasted id; anything else would be a 422, so it is ignored until it looks like one. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const cleanId = (value: string): string | undefined => {
  const trimmed = value.trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : undefined;
};

export async function fetchDocumentation({ bookingId, caregiverId, offset }: DocumentationFilter) {
  return unwrap(
    await getApi().GET("/api/v1/admin/visit-documentation", {
      params: { query: { booking_id: bookingId, caregiver_id: caregiverId, limit: PAGE_SIZE, offset } },
    }),
  );
}
