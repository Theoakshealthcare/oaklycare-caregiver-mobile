/**
 * The booking policy screen (backend guide section 12.9). Reading needs `bookings.read`; changing needs `settings.write`
 * and a reason. Only `short_visit_min_percent` is editable here; the other fields are shown read-only.
 */
import type { QueryClient } from "@tanstack/react-query";

import { getApi, unwrap } from "@/lib/api";
import { type BookingPolicy, BOOKINGS_KEY, fetchBookingPolicy } from "@/lib/bookings";
import { formatNairaValue } from "@/lib/format";

export const BOOKING_POLICY_READ = ["bookings.read"];
export const BOOKING_POLICY_WRITE = "settings.write";
/** The same key the booking detail's cancel dialog reads, so an edit here refreshes it too. */
export const BOOKING_POLICY_KEY = [...BOOKINGS_KEY, "policy"] as const;

export { fetchBookingPolicy };

export async function updateShortVisitThreshold(percent: number, reason: string) {
  return unwrap(
    await getApi().PATCH("/api/v1/admin/booking-policy", { body: { reason, short_visit_min_percent: percent } }),
  );
}

export function invalidateBookingPolicy(client: QueryClient) {
  return client.invalidateQueries({ queryKey: BOOKING_POLICY_KEY });
}

/** A whole number from 0 to 100, or null: the server's rule for every percent field (guide 12.9). */
export function parsePercent(text: string): number | null {
  if (!/^\d{1,3}$/.test(text.trim())) return null;
  const n = Number(text.trim());
  return n >= 0 && n <= 100 ? n : null;
}

export interface PolicyRow {
  key: keyof BookingPolicy;
  label: string;
  value: string;
  help: string;
}

export interface PolicyGroup {
  title: string;
  rows: PolicyRow[];
}

const hours = (n: number) => `${n} ${n === 1 ? "hour" : "hours"}`;
const minutes = (n: number) => `${n} ${n === 1 ? "minute" : "minutes"}`;
const percent = (n: number) => `${n}%`;

/** The policy in reading order. Words follow the backend guide's field table. */
export function policyGroups(p: BookingPolicy): PolicyGroup[] {
  return [
    {
      title: "Family cancellation",
      rows: [
        { key: "cancel_free_hours", label: "Free cancellation", value: `More than ${hours(p.cancel_free_hours)} before the visit`, help: "Full refund when the visit is further away than this, or nobody is assigned." },
        { key: "cancel_late_hours", label: "Late window", value: `Inside ${hours(p.cancel_late_hours)}`, help: "Inside this, or once the caregiver is on the way, the late fee applies." },
        { key: "cancel_fee_percent", label: "Standard fee", value: percent(p.cancel_fee_percent), help: "Percent of the service fee between the two lines." },
        { key: "cancel_late_fee_percent", label: "Late fee", value: percent(p.cancel_late_fee_percent), help: "Percent of the service fee in the late window." },
      ],
    },
    {
      title: "Caregiver drop-outs",
      rows: [
        { key: "dropout_redispatch_min_lead_minutes", label: "Automatic re-dispatch", value: `More than ${minutes(p.dropout_redispatch_min_lead_minutes)} before the start`, help: "A drop-out further ahead than this is re-dispatched automatically." },
        { key: "dropout_decision_lead_minutes", label: "Ask the family", value: `${minutes(p.dropout_decision_lead_minutes)} before the start`, help: "With no replacement by then, the family is asked what to do." },
        { key: "onmyway_compensation_window_minutes", label: "On-my-way window", value: minutes(p.onmyway_compensation_window_minutes), help: "An on my way tapped no earlier than this before the start can qualify for compensation." },
      ],
    },
    {
      title: "Caregiver earnings",
      rows: [
        { key: "caregiver_visit_share_percent", label: "Visit share", value: percent(p.caregiver_visit_share_percent), help: "The caregiver's share of the service fee. Copied onto each booking when it is created." },
        { key: "caregiver_late_fee_share_percent", label: "Late fee share", value: percent(p.caregiver_late_fee_share_percent), help: "The caregiver's share of a kept late-cancellation fee." },
        { key: "earning_hold_hours", label: "Earning hold", value: hours(p.earning_hold_hours), help: "An earning becomes withdrawable this long after the visit is completed." },
        { key: "short_visit_min_percent", label: "Short-visit threshold", value: `Under ${percent(p.short_visit_min_percent)} of the booked time`, help: "A completed visit with less time on site than this is held for Finance review. Copied onto each booking when it is created." },
      ],
    },
    {
      title: "Payouts and refunds (not read by the backend yet)",
      rows: [
        { key: "payout_cadence", label: "Payout cadence", value: p.payout_cadence, help: "Stored for the payouts work." },
        { key: "payout_min_naira", label: "Smallest scheduled payout", value: formatNairaValue(p.payout_min_naira), help: "Stored for the payouts work." },
        { key: "finance_refund_limit_naira", label: "Finance refund limit", value: formatNairaValue(p.finance_refund_limit_naira), help: "Largest refund Finance may approve alone." },
      ],
    },
  ];
}
