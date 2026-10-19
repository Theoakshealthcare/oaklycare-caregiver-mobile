/**
 * Bookings operations (backend A2, guide section 12). Wire types come from the generated schema.
 * Money is integer kobo throughout; format with `formatNaira` only at the edge.
 */
import type { Schemas, paths } from "@oakly/api-client";
import type { QueryClient } from "@tanstack/react-query";

import { getApi, unwrap } from "@/lib/api";

export type BookingListItem = Schemas["BookingListItem"];
export type BookingDetail = Schemas["BookingDetail"];
export type UnmatchedItem = Schemas["UnmatchedItem"];
export type Candidate = Schemas["CandidateOut"];
export type BookingPolicy = Schemas["BookingPolicyOut"];
export type BookingActionResult = Schemas["BookingActionOut"];
export type BookingStatus = BookingDetail["status"];
export type PaymentStatus = BookingListItem["payment_status"];
export type DispatchState = NonNullable<BookingListItem["dispatch_state"]>;
export type Channel = BookingDetail["channel"];
export type BookingAction = BookingDetail["available_actions"][number];
export type QueueReason = UnmatchedItem["queue_reason"];
export type CancelBody = Schemas["CancelIn"];
export type CancelReasonCode = CancelBody["reason_code"];
export type RefundChoice = CancelBody["refund"];
export type CorrectionTarget = Schemas["CorrectStatusIn"]["status"];

type ListQuery = NonNullable<paths["/api/v1/admin/bookings"]["get"]["parameters"]["query"]>;

/**
 * Reads need `bookings.read`. Which actions an admin may take on a booking is decided by the backend and sent as
 * `available_actions` on the detail (it combines the admin's permissions with the booking's state), so the console
 * shows exactly those and never re-derives them from this table. The constants below gate pages and navigation only.
 */
export const BOOKINGS_READ = "bookings.read";
export const BOOKINGS_DISPATCH = "bookings.dispatch";
export const BOOKINGS_ASSIGN = "bookings.assign";
export const BOOKINGS_ADDRESS = "bookings.address";
export const PEOPLE_PII = "people.pii";

export const PAGE_SIZE = 25;

export const BOOKING_STATUSES: BookingStatus[] = [
  "pending",
  "accepted",
  "en_route",
  "in_progress",
  "completed",
  "cancelled",
  "declined",
];
export const PAYMENT_STATUSES: PaymentStatus[] = ["pending", "paid", "failed", "refunded"];
export const DISPATCH_STATES: DispatchState[] = ["dispatching", "matched", "unmatched"];
export const CHANNELS: Channel[] = ["app", "whatsapp", "admin"];
export const QUEUE_REASONS: QueueReason[] = ["address_check", "unmatched", "sla_breached"];

export const CANCEL_REASON_CODES: { value: CancelReasonCode; label: string }[] = [
  { value: "patient_request", label: "Patient request" },
  { value: "no_supply", label: "No caregiver available" },
  { value: "caregiver_no_show", label: "Caregiver no-show" },
  { value: "safety", label: "Safety" },
  { value: "duplicate", label: "Duplicate booking" },
  { value: "other", label: "Other" },
];

/** Every bookings screen shares this key prefix so one invalidation refreshes them all. */
export const BOOKINGS_KEY = ["bookings"] as const;

export function invalidateBookings(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: BOOKINGS_KEY });
}

/** Filters as the list screen holds them: empty string means "any". Dates are WAT calendar days (`YYYY-MM-DD`). */
export interface BookingFilters {
  q: string;
  status: BookingStatus | "";
  paymentStatus: PaymentStatus | "";
  dispatchState: DispatchState | "";
  channel: Channel | "";
  city: string;
  scheduledFrom: string;
  scheduledTo: string;
  needsAddressCheck: boolean;
  noShow: boolean;
}

export const EMPTY_FILTERS: BookingFilters = {
  q: "",
  status: "",
  paymentStatus: "",
  dispatchState: "",
  channel: "",
  city: "",
  scheduledFrom: "",
  scheduledTo: "",
  needsAddressCheck: false,
  noShow: false,
};

const WAT_OFFSET_HOURS = 1; // Africa/Lagos is UTC+1 all year (no daylight saving).

/**
 * The start of a WAT calendar day as the backend's naive UTC (`2026-10-10` -> `2026-10-09T23:00:00`). The backend stores
 * naive UTC timestamps, so the value is sent without a zone. `addDays` gives an exclusive upper bound (`to` is exclusive).
 */
export function watDayStartUtc(day: string, addDays = 0): string {
  const [y = 0, m = 1, d = 1] = day.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d + addDays, -WAT_OFFSET_HOURS);
  return new Date(ms).toISOString().slice(0, 19);
}

/** The list query for a set of filters: blanks are left out so the URL carries only what was chosen. */
export function listQuery(filters: BookingFilters, offset: number): ListQuery {
  const q: ListQuery = { limit: PAGE_SIZE, offset };
  if (filters.q.trim()) q.q = filters.q.trim();
  if (filters.status) q.status = filters.status;
  if (filters.paymentStatus) q.payment_status = filters.paymentStatus;
  if (filters.dispatchState) q.dispatch_state = filters.dispatchState;
  if (filters.channel) q.channel = filters.channel;
  if (filters.city.trim()) q.city = filters.city.trim();
  if (filters.scheduledFrom) q.scheduled_from = watDayStartUtc(filters.scheduledFrom);
  if (filters.scheduledTo) q.scheduled_to = watDayStartUtc(filters.scheduledTo, 1);
  if (filters.needsAddressCheck) q.needs_address_check = true;
  if (filters.noShow) q.no_show = true;
  return q;
}

export async function fetchBookings(filters: BookingFilters, offset: number) {
  return unwrap(await getApi().GET("/api/v1/admin/bookings", { params: { query: listQuery(filters, offset) } }));
}

export async function fetchUnmatched(params: { reason?: QueueReason; offset: number }) {
  return unwrap(
    await getApi().GET("/api/v1/admin/bookings/unmatched", {
      params: { query: { reason: params.reason, limit: PAGE_SIZE, offset: params.offset } },
    }),
  );
}

export async function fetchBooking(id: string) {
  return unwrap(await getApi().GET("/api/v1/admin/bookings/{booking_id}", { params: { path: { booking_id: id } } }));
}

export async function fetchCandidates(id: string, radiusKm?: number) {
  return unwrap(
    await getApi().GET("/api/v1/admin/bookings/{booking_id}/candidates", {
      params: { path: { booking_id: id }, query: { radius_km: radiusKm } },
    }),
  );
}

export async function fetchBookingPolicy() {
  return unwrap(await getApi().GET("/api/v1/admin/booking-policy"));
}

const path = (id: string) => ({ params: { path: { booking_id: id } } });

export async function redispatchBooking(id: string, body: Schemas["RedispatchIn"]) {
  return unwrap(await getApi().POST("/api/v1/admin/bookings/{booking_id}/redispatch", { ...path(id), body }));
}

export async function assignBooking(id: string, body: Schemas["AssignIn"]) {
  return unwrap(await getApi().POST("/api/v1/admin/bookings/{booking_id}/assign", { ...path(id), body }));
}

export async function reassignBooking(id: string, body: Schemas["ReassignIn"]) {
  return unwrap(await getApi().POST("/api/v1/admin/bookings/{booking_id}/reassign", { ...path(id), body }));
}

export async function cancelBooking(id: string, body: CancelBody) {
  return unwrap(await getApi().POST("/api/v1/admin/bookings/{booking_id}/cancel", { ...path(id), body }));
}

export async function confirmAddress(id: string, body: Schemas["ConfirmAddressIn"]) {
  return unwrap(await getApi().POST("/api/v1/admin/bookings/{booking_id}/confirm-address", { ...path(id), body }));
}

export async function flagNoShow(id: string, reason: string) {
  return unwrap(await getApi().POST("/api/v1/admin/bookings/{booking_id}/no-show", { ...path(id), body: { reason } }));
}

export async function correctStatus(id: string, body: Schemas["CorrectStatusIn"]) {
  return unwrap(await getApi().POST("/api/v1/admin/bookings/{booking_id}/correct-status", { ...path(id), body }));
}

/** Status correction moves forward only (guide 12.6): the targets offered for each current status. */
export function correctionTargets(status: BookingStatus): CorrectionTarget[] {
  switch (status) {
    case "accepted":
      return ["en_route", "in_progress", "completed"];
    case "en_route":
      return ["in_progress", "completed"];
    case "in_progress":
      return ["completed"];
    default:
      return [];
  }
}

/** The coordinates confirm-address accepts: a rough box around Nigeria (the backend refuses anything outside). */
export const NIGERIA_BOX = { latMin: 3.5, latMax: 14, lngMin: 2.5, lngMax: 15 } as const;

export function insideNigeria(lat: number, lng: number): boolean {
  return lat >= NIGERIA_BOX.latMin && lat <= NIGERIA_BOX.latMax && lng >= NIGERIA_BOX.lngMin && lng <= NIGERIA_BOX.lngMax;
}

/** "12,500.50" or "12500" naira typed by an admin -> integer kobo, or null when it isn't a positive amount. */
export function parseNairaToKobo(text: string): number | null {
  const clean = text.replace(/[₦,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const kobo = Math.round(Number(clean) * 100);
  return kobo > 0 ? kobo : null;
}

export type CancelTier = "free" | "standard" | "late";

export interface CancelEstimate {
  tier: CancelTier;
  feePercent: number;
  feeKobo: number;
  refundKobo: number;
  /** True for an en-route booking: the late tier applies only if the caregiver's on-my-way tap qualifies. */
  dependsOnOnMyWay: boolean;
}

/**
 * What the family's cancellation policy would charge if they cancelled now, from the LIVE policy. Mirrors the backend's
 * `booking_cancellation.terms`, with two gaps the console cannot close: each booking keeps the tiers it was quoted (not
 * sent on the detail) and an en-route booking is late only when the on-my-way tap qualifies. So this is a guide for the
 * admin's refund choice, never applied on its own. Null when the booking is unpaid or can't be cancelled.
 */
export function cancelEstimate(booking: BookingDetail, policy: BookingPolicy, now: Date): CancelEstimate | null {
  if (booking.payment.status !== "paid") return null;
  const total = booking.price.total_kobo;
  const free: CancelEstimate = { tier: "free", feePercent: 0, feeKobo: 0, refundKobo: total, dependsOnOnMyWay: false };
  if (booking.status === "pending") return free;
  if (booking.status !== "accepted" && booking.status !== "en_route") return null;
  const start = Date.parse(/(Z|[+-]\d\d:?\d\d)$/.test(booking.scheduled_date) ? booking.scheduled_date : `${booking.scheduled_date}Z`);
  const hoursLeft = (start - now.getTime()) / 3_600_000;
  const enRoute = booking.status === "en_route";
  let tier: CancelTier;
  if (enRoute || hoursLeft < policy.cancel_late_hours) tier = "late";
  else if (hoursLeft <= policy.cancel_free_hours) tier = "standard";
  else return free;
  const percent = Math.max(0, Math.min(100, tier === "late" ? policy.cancel_late_fee_percent : policy.cancel_fee_percent));
  // Rounded half up to the kobo, as the backend does.
  const fee = Math.min(Math.floor((booking.price.service_fee_kobo * percent + 50) / 100), total);
  return {
    tier,
    feePercent: percent,
    feeKobo: fee,
    refundKobo: total - fee,
    dependsOnOnMyWay: enRoute && hoursLeft >= policy.cancel_late_hours,
  };
}
