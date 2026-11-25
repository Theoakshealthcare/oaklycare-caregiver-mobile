/**
 * Caregiver earnings (backend AD-FR-38, `admin_earnings.py`). Wire types come from the generated schema.
 * Money is integer kobo; format with `formatNaira` only at the edge.
 *
 * Reads need `payments.read`. Hold and release-hold need `ledger.adjust_request` (Finance), and releasing the hold of a
 * no-show-flagged booking also needs `ledger.adjust`. Void needs `ledger.adjust` (Super Admin). The backend enforces all
 * of it; the console only hides what the admin could not do.
 */
import type { Schemas } from "@oakly/api-client";
import { type QueryClient, useQuery } from "@tanstack/react-query";

import { getApi, unwrap } from "@/lib/api";

export type Earning = Schemas["EarningOut"];
export type EarningStatus = Earning["status"];

export const EARNINGS_READ = "payments.read";
export const EARNINGS_HOLD = "ledger.adjust_request";
export const EARNINGS_VOID = "ledger.adjust";
/** Releasing the hold of a no-show-flagged booking needs this on top of `EARNINGS_HOLD`. */
export const EARNINGS_CLEAR_NO_SHOW = "ledger.adjust";

export const PAGE_SIZE = 50;
/** The API's maximum page. The held tabs read every held earning in pages of this size. */
const HELD_PAGE = 200;
/** A safety stop for the held read: 1,000 held earnings is far beyond anything Finance can review by hand. */
const HELD_MAX_PAGES = 5;

/** Every earnings screen shares this key prefix so one invalidation refreshes them all (and the nav badge). */
export const EARNINGS_KEY = ["earnings"] as const;

export function invalidateEarnings(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: EARNINGS_KEY });
}

export type TabId = "review" | "admin" | "pending" | "released" | "all";

export const TABS: { id: TabId; label: string; hint: string }[] = [
  {
    id: "review",
    label: "Held for review",
    hint: "Held by the system or a no-show flag, waiting for Finance: a visit that was too short, or a booking flagged as a no-show.",
  },
  { id: "admin", label: "On hold by admin", hint: "Held by a person in the console. Releasing it puts the earning back on its normal clearing schedule." },
  { id: "pending", label: "Pending", hint: "Credited and counting down to release. Nothing here has reached the caregiver's balance yet." },
  { id: "released", label: "Released", hint: "Paid into the caregiver's available balance. These can no longer be changed here." },
  { id: "all", label: "All", hint: "Every earning, newest first, including voided ones." },
];

/** Why an earning is held. The API has no field for it: it is read off `status_reason` and `status_changed_by`. */
export type HoldKind = "short_visit" | "no_show" | "system" | "admin";

export const HOLD_KIND_LABEL: Record<HoldKind, string> = {
  short_visit: "Short visit",
  no_show: "No-show flag",
  system: "Held by the system",
  admin: "Held by an admin",
};

/**
 * The backend writes both system holds itself: "Short visit: under N% of the booked time ..." (no admin attached) and
 * "No-show flagged ..." (attributed to the admin who flagged it). Anything else on a held row was typed by an admin.
 */
export function holdKind(e: Pick<Earning, "status" | "status_reason" | "status_changed_by">): HoldKind | null {
  if (e.status !== "held") return null;
  const reason = e.status_reason ?? "";
  if (reason.startsWith("Short visit")) return "short_visit";
  if (reason.startsWith("No-show flagged")) return "no_show";
  return e.status_changed_by === null ? "system" : "admin";
}

/** Held rows that Finance should look at: everything held except what an admin chose to hold. */
export const needsReview = (e: Earning) => {
  const kind = holdKind(e);
  return kind !== null && kind !== "admin";
};

export const isAdminHold = (e: Earning) => holdKind(e) === "admin";

export const STATUS_LABEL: Record<EarningStatus, string> = {
  pending_clearance: "Pending",
  held: "Held",
  successful: "Released",
  voided: "Voided",
};

export const TYPE_LABEL: Record<Earning["type"], string> = {
  earning: "Visit earning",
  late_cancel_compensation: "Late-cancel compensation",
};

/** What can be done to an earning, by status. A released or voided earning cannot be changed here. */
export const canHold = (e: Earning) => e.status === "pending_clearance";
export const canReleaseHold = (e: Earning) => e.status === "held";
export const canVoid = (e: Earning) => e.status === "pending_clearance" || e.status === "held";

/** The backend sends naive UTC timestamps (`datetime.utcnow()`), so a missing zone means UTC. */
export function clearanceHasPassed(e: Pick<Earning, "available_at">, now: number = Date.now()): boolean {
  if (!e.available_at) return false;
  const text = /(Z|[+-]\d\d:?\d\d)$/.test(e.available_at) ? e.available_at : `${e.available_at}Z`;
  const at = new Date(text).getTime();
  return !Number.isNaN(at) && at <= now;
}

/** One line for a list cell: why it is in this state, in the words of the person or system that put it there. */
export function reasonSummary(e: Earning): string | null {
  const kind = holdKind(e);
  if (kind) return e.status_reason ?? HOLD_KIND_LABEL[kind];
  if (e.status === "voided") return e.status_reason ? `Voided: ${e.status_reason}` : "Voided";
  if (e.status === "pending_clearance" && e.status_reason) return `Hold released: ${e.status_reason}`;
  return null;
}

export async function fetchEarnings(params: { status?: EarningStatus; offset: number; limit?: number; bookingId?: string }) {
  return unwrap(
    await getApi().GET("/api/v1/admin/earnings", {
      params: {
        query: {
          status: params.status,
          booking_id: params.bookingId,
          limit: params.limit ?? PAGE_SIZE,
          offset: params.offset,
        },
      },
    }),
  );
}

/** Every held earning (the API cannot filter by hold reason, so the two held tabs split this list in the browser). */
export async function fetchAllHeld(): Promise<{ items: Earning[]; total: number }> {
  const items: Earning[] = [];
  let total = 0;
  for (let page = 0; page < HELD_MAX_PAGES; page += 1) {
    const res = await fetchEarnings({ status: "held", offset: items.length, limit: HELD_PAGE });
    total = res.total;
    items.push(...res.items);
    if (items.length >= total || res.items.length === 0) break;
  }
  return { items, total };
}

export async function holdEarning(id: string, reason: string) {
  return unwrap(
    await getApi().POST("/api/v1/admin/earnings/{earning_id}/hold", { params: { path: { earning_id: id } }, body: { reason } }),
  );
}

export async function releaseEarningHold(id: string, reason: string) {
  return unwrap(
    await getApi().POST("/api/v1/admin/earnings/{earning_id}/release-hold", {
      params: { path: { earning_id: id } },
      body: { reason },
    }),
  );
}

export async function voidEarning(id: string, reason: string) {
  return unwrap(
    await getApi().POST("/api/v1/admin/earnings/{earning_id}/void", { params: { path: { earning_id: id } }, body: { reason } }),
  );
}

/** How many earnings are waiting for Finance, for the nav badge. Quiet on failure: a badge must never raise an error. */
export function useHeldForReviewCount(enabled: boolean): { count: number; truncated: boolean } | null {
  const held = useQuery({
    queryKey: [...EARNINGS_KEY, "held"],
    queryFn: fetchAllHeld,
    enabled,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
  });
  if (!held.data) return null;
  return { count: held.data.items.filter(needsReview).length, truncated: held.data.items.length < held.data.total };
}
