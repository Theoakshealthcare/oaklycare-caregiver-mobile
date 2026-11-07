import { formatNaira } from "@/src/home/homeModel";
import type { Booking } from "@/src/services/booking.service";
import type { CaregiverTransaction } from "@/src/services/wallet.service";
import { parseBackendDate } from "@/src/utils/dates";
import { currentMonth } from "@/src/wallet/walletModel";

/** What Job Details shows for the caregiver's own pay on a booking. */
export interface BookingEarningView {
  /** Naira, formatted from the backend's number as is. */
  amount: string;
  /** Wallet wording for the earning once the visit is done ("Pending", "Under review", ...); null before then. */
  statusLabel: string | null;
  /** One line under the amount; only set for a held (short-visit) earning. */
  note: string | null;
}

/** Same words as the wallet list (`walletModel.ts` EARNING_STATUS); kept in step with it by a test. */
const STATUS_LABEL: Record<string, string> = {
  pending_clearance: "Pending",
  held: "Under review",
  successful: "Available",
  voided: "Cancelled",
};

export const HELD_EARNING_NOTE = "Oakly is reviewing this visit before it is paid";

/**
 * The earning row for a booking the caregiver holds, or null when there is nothing to show
 * (the backend sends `caregiver_earning: null` for an offer, a pending or cancelled booking).
 * Nothing is computed here: the amount is the backend's number, the status is the wallet row's.
 */
export function bookingEarningView(
  booking: Pick<Booking, "caregiver_earning">,
  earningRow: Pick<CaregiverTransaction, "status"> | undefined,
): BookingEarningView | null {
  if (booking.caregiver_earning == null) return null;
  const held = earningRow?.status === "held";
  return {
    amount: formatNaira(booking.caregiver_earning),
    statusLabel: earningRow ? (STATUS_LABEL[earningRow.status] ?? earningRow.status) : null,
    note: held ? HELD_EARNING_NOTE : null,
  };
}

/**
 * The wallet month to look the visit's earning up in (Lagos month, the wallet's own grouping). The
 * booking does not carry its completion time, so this uses `updated_at`, which the completion stamps;
 * a visit finished within moments of a month change may miss its row, and the status line is then
 * simply left out (the amount still shows). Null until the visit has completed: nothing is fetched.
 */
export function earningMonthFor(booking: Pick<Booking, "status" | "updated_at" | "caregiver_earning">): string | null {
  if (booking.status !== "completed" || booking.caregiver_earning == null) return null;
  const at = parseBackendDate(booking.updated_at);
  return Number.isNaN(at.getTime()) ? null : currentMonth(at);
}

/** This booking's earning among the month's wallet rows (a late-cancel payment is not it). */
export function findEarningRow(transactions: CaregiverTransaction[] | undefined, bookingId: string) {
  return transactions?.find((tx) => tx.booking_id === bookingId && tx.type === "earning");
}
