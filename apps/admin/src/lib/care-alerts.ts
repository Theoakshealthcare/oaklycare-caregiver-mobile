/**
 * Care alerts (backend slice 1c, guide `docs/fe-integration-guide-care-alerts.md` in the backend repo). Wire types come from the
 * generated schema. The list is summary only: `detail` and `note` are null there for everyone, and are read (and audited) one alert at
 * a time with `fetchCareAlert`. `detail_masked` says whether this admin may open them at all.
 */
import type { Schemas } from "@oakly/api-client";
import type { QueryClient } from "@tanstack/react-query";

import { getApi, unwrap } from "@/lib/api";

export type CareAlert = Schemas["CareAlertOut"];
export type CareAlertType = CareAlert["type"];
export type CareAlertSeverity = CareAlert["severity"];
export type CareAlertStatus = CareAlert["status"];

/** One permission covers the list, the detail, acknowledge and resolve. */
export const CARE_ALERTS_PERMISSION = "support.inbox";
export const PAGE_SIZE = 50;
/** No push to the console: the open page re-reads the queue this often. */
export const POLL_MS = 45_000;

/** `active` (the default work list) is open plus acknowledged; `all` is every status. */
export type StatusFilter = "active" | "open" | "acknowledged" | "resolved" | "all";
export const STATUS_FILTERS: StatusFilter[] = ["active", "open", "acknowledged", "resolved", "all"];
export const STATUS_LABEL: Record<StatusFilter, string> = {
  active: "Needs work (open + acknowledged)",
  open: "Open",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
  all: "All",
};

export const TYPE_LABEL: Record<CareAlertType, string> = {
  vital_out_of_range: "Reading out of range",
  task_missed: "Care task missed",
};

export const CARE_ALERTS_KEY = ["care-alerts"] as const;
export const careAlertKey = (id: string) => [...CARE_ALERTS_KEY, "detail", id] as const;
export const CARE_ALERTS_LIST_KEY = [...CARE_ALERTS_KEY, "list"] as const;

export const invalidateCareAlerts = (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: CARE_ALERTS_KEY });

/** Plain words for who the family contact heard from, taken from the delivery fields. */
export function familyLine(alert: Pick<CareAlert, "family_notified_at" | "family_notified_count">): string {
  if (!alert.family_notified_at) return "Not sent yet";
  if (alert.family_notified_count === 0) return "No family contact could be reached";
  return alert.family_notified_count === 1 ? "1 family contact told" : `${alert.family_notified_count} family contacts told`;
}

export async function fetchCareAlerts(params: {
  status: StatusFilter;
  severity?: CareAlertSeverity;
  type?: CareAlertType;
  offset: number;
}) {
  return unwrap(
    await getApi().GET("/api/v1/admin/care-alerts", {
      params: {
        query: { status: params.status, severity: params.severity, type: params.type, limit: PAGE_SIZE, offset: params.offset },
      },
    }),
  );
}

export async function fetchCareAlert(id: string) {
  return unwrap(await getApi().GET("/api/v1/admin/care-alerts/{alert_id}", { params: { path: { alert_id: id } } }));
}

export async function acknowledgeCareAlert(id: string, note: string) {
  return unwrap(
    await getApi().POST("/api/v1/admin/care-alerts/{alert_id}/acknowledge", {
      params: { path: { alert_id: id } },
      body: { note: note || null },
    }),
  );
}

export async function resolveCareAlert(id: string, note: string) {
  return unwrap(
    await getApi().POST("/api/v1/admin/care-alerts/{alert_id}/resolve", {
      params: { path: { alert_id: id } },
      body: { note: note || null },
    }),
  );
}
