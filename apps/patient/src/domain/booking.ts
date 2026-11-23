/**
 * What the patient screens know about a booking. `src/services/bookingMapper.ts` maps the api-client `BookingResponse`
 * to this shape (statuses and `dispatch_state` as the backend sends them), so the screens never read raw API fields.
 */
export type BookingStatus = "pending" | "accepted" | "en_route" | "in_progress" | "completed" | "cancelled" | "declined";
export type DispatchState = "dispatching" | "matched" | "unmatched";
export type PaymentState = "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
export type BookingTab = "upcoming" | "completed" | "canceled";
export type RefundStatus = "under_review" | "processing" | "needs_bank_details" | "refunded" | "declined" | "contact_support";
export type FeeTier = "none" | "standard" | "late";

export interface Refund {
  status: RefundStatus;
  /** Naira, or null while the person approving still has to decide the amount. */
  amount: number | null;
}

export interface Booking {
  id: string;
  /** The booking code shown to the family (`booking_code`). */
  reference: string;
  service: string;
  bookingFor: string;
  scheduledAt: string;
  /** The length in minutes (the API stores minutes; a visit can be 90). */
  durationMinutes: number;
  address: string;
  amount: number;
  paymentStatus: PaymentState;
  status: BookingStatus;
  dispatchState: DispatchState | null;
  /**
   * Only the first name: that is what the family needs, and the API sends no caregiver phone number. `photoUrl` is the
   * caregiver's profile photo (null when none was uploaded) and `role` their specialization, both as the API sends them.
   */
  caregiver: { firstName: string; photoUrl: string | null; role: string | null } | null;
  /** The 4-digit code the patient reads out to the caregiver on arrival; only the detail carries it, only while accepted / en route. */
  visitCode: string | null;
  /** Naira charged for cancelling: `null` unless the booker cancelled (`null` is not `0`; `0` is a free cancel). */
  cancelFee: number | null;
  cancelFeeTier: FeeTier | null;
  refund: Refund | null;
}

export function tabForStatus(status: BookingStatus): BookingTab {
  if (status === "completed") return "completed";
  if (status === "cancelled" || status === "declined") return "canceled";
  return "upcoming";
}

/** Created but not paid yet (so no caregiver is being looked for): the "Pay now" case. */
export function needsPayment(booking: Pick<Booking, "status" | "paymentStatus">): boolean {
  return booking.status === "pending" && booking.paymentStatus === "pending";
}

/**
 * One plain sentence for where a booking is. `status` comes first: `dispatch_state` is never cleared on a cancelled
 * booking (it can still read "dispatching"), so it only matters while the booking is `pending` and paid.
 */
export function statusLabel(booking: Pick<Booking, "status" | "dispatchState" | "paymentStatus">): string {
  switch (booking.status) {
    case "pending":
      if (booking.paymentStatus !== "paid") return "Payment pending";
      return booking.dispatchState === "unmatched" ? "No caregiver found yet" : "Looking for a caregiver";
    case "accepted":
      return "Caregiver assigned";
    case "en_route":
      return "Caregiver is on the way";
    case "in_progress":
      return "Visit in progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return booking.paymentStatus === "failed" ? "Payment failed" : "Canceled";
    case "declined":
      return "Declined";
  }
}

/**
 * A booking that is still moving: the detail and the lists refresh while it is open. A visit under way counts: it is the last
 * step before "completed", and a screen that stops reading at "in progress" still says so long after the visit has ended.
 */
export function isActive(booking: Pick<Booking, "status">): boolean {
  return booking.status === "pending" || booking.status === "accepted" || booking.status === "en_route" || booking.status === "in_progress";
}

/** The visit code is only for the patient to read out, and only until the visit starts. */
export function showsVisitCode(booking: Pick<Booking, "status" | "visitCode">): boolean {
  return booking.visitCode !== null && (booking.status === "accepted" || booking.status === "en_route");
}

/** The app offers cancel while the booking is looking for a caregiver, accepted or on the way (`cancel-terms` has the last word). */
export function canCancel(booking: Pick<Booking, "status">): boolean {
  return booking.status === "pending" || booking.status === "accepted" || booking.status === "en_route";
}

/** The chat is for the visit: once a booking is cancelled there is nobody left to talk to about it. */
export function canChat(booking: Pick<Booking, "status"> & { caregiver: unknown | null }): boolean {
  return booking.caregiver !== null && booking.status !== "cancelled";
}

export type ChipTone = "primary" | "success" | "warning" | "error" | "neutral";

/**
 * The money chip on the booking detail. A cancelled booking is never "PAID": the chip says where the refund is, or just
 * "CANCELED" when nothing was charged, so it can never sit beside the status line and contradict it.
 */
export function paymentChip(booking: Pick<Booking, "status" | "paymentStatus" | "refund">): { label: string; tone: ChipTone } {
  if (booking.status === "cancelled") {
    const refund = booking.refund;
    if (refund?.status === "refunded") return { label: "REFUNDED", tone: "neutral" };
    if (refund?.status === "declined") return { label: "REFUND DECLINED", tone: "error" };
    if (refund) return { label: "REFUND PENDING", tone: "warning" };
    if (booking.paymentStatus === "refunded" || booking.paymentStatus === "partially_refunded") return { label: "REFUNDED", tone: "neutral" };
    if (booking.paymentStatus === "failed") return { label: "PAYMENT FAILED", tone: "error" };
    return { label: "CANCELED", tone: "neutral" };
  }
  switch (booking.paymentStatus) {
    case "paid":
      return { label: "PAID", tone: "success" };
    case "refunded":
    case "partially_refunded":
      return { label: "REFUNDED", tone: "neutral" };
    case "failed":
      return { label: "PAYMENT FAILED", tone: "error" };
    case "pending":
      return { label: "PAYMENT PENDING", tone: "warning" };
  }
}

export function canTrack(booking: Pick<Booking, "status">): boolean {
  return booking.status === "accepted" || booking.status === "en_route" || booking.status === "in_progress";
}

/** What the family is told about a refund (the backend's six simplified statuses; internal refund states are never shown). */
export function refundText(refund: Refund): string {
  switch (refund.status) {
    case "under_review":
      return "Your refund is being reviewed.";
    case "processing":
      return "Your refund has been approved and is on its way.";
    case "needs_bank_details":
      return "Our team will contact you for your bank details.";
    case "refunded":
      return "Your refund has been sent.";
    case "declined":
      return "This refund was not approved. Contact support.";
    case "contact_support":
      return "Please contact support about this refund.";
  }
}

export const REFUND_DESTINATION_TEXT = "Refunds are reviewed and sent to your original payment method.";

/** What canceling would cost right now, from `GET /booking/{id}/cancel-terms`. Naira for display, kobo to echo back. */
export interface CancelTerms {
  bookingId: string;
  canCancel: boolean;
  /** `booking_in_progress`, `booking_completed`, `booking_already_cancelled`, `booking_closed`, or null when it can be canceled. */
  reason: string | null;
  /** A sentence that is safe to show, present when it cannot be canceled. */
  message: string | null;
  feeTier: FeeTier;
  feePercent: number;
  feeAmount: number;
  feeAmountKobo: number;
  paidAmount: number;
  refundableAmount: number;
  refundWillBeQueued: boolean;
  caregiverAssigned: boolean;
  /** The admin-editable policy the fee came from; null when it cannot be canceled. */
  policy: { freeHours: number; lateHours: number; feePercent: number; lateFeePercent: number } | null;
}

/** The answer to a cancel: what was charged and what the refund request is. */
export interface CancelResult {
  bookingId: string;
  alreadyCancelled: boolean;
  feeTier: FeeTier;
  feeAmount: number;
  paidAmount: number;
  refundableAmount: number;
  /** `refund_queued`: read this, not "was it unpaid": an unpaid booking whose payment was a moment ahead of its webhook gets a refund. */
  refundQueued: boolean;
  refund: Refund | null;
}

/** Why the fee is what it is, built from the policy numbers in the response (they are admin-editable, never hard-coded). */
export function feeReason(terms: CancelTerms): string {
  const { policy } = terms;
  if (terms.feeTier === "none") {
    if (terms.paidAmount === 0) return "You have not paid yet, so cancelling is free.";
    if (!terms.caregiverAssigned) return "No caregiver is assigned yet, so cancelling is free.";
    return `The visit is more than ${policy?.freeHours} hours away, so cancelling is free.`;
  }
  if (terms.feeTier === "standard") {
    return `The visit is less than ${policy?.freeHours} hours away, so Oakly keeps ${terms.feePercent}% of the service fee.`;
  }
  return `The visit is less than ${policy?.lateHours} hours away or your caregiver is already on the way, so Oakly keeps ${terms.feePercent}% of the service fee.`;
}

export interface BookingDraft {
  /** The chosen relation ("My Mother"): the backend stores it as `booking_for`. */
  forWhom: string;
  /** `service_type` of the chosen service ("nurse"), and its name from the catalogue ("Nurse visit"). */
  serviceType: string;
  serviceLabel: string;
  /** A choice from the list; "Other" opens `assistanceOther`. The text sent is `helpNeeded(draft)`. */
  assistance: string;
  assistanceOther: string;
  /** Optional: "" (nothing chosen), "None", a choice, or "Other" with `conditionOther`. */
  condition: string;
  conditionOther: string;
  date: string;
  time: string;
  /** From the catalogue's allowed lengths; null until chosen. */
  durationMinutes: number | null;
  state: string;
  city: string;
  address: string;
  /** Contact details (prefilled from the account). The booking has no field for them, so they travel inside the special instructions. */
  phone: string;
  email: string;
  /** Where the phone was when the person tapped "Use my current location"; the API needs coordinates. */
  latitude: number | null;
  longitude: number | null;
  /** "any" or one of the gender / language choices; they travel inside the special instructions text. */
  genderPreference: string;
  languagePreference: string;
  instructions: string;
}

/** What `GET /booking/services` lists: a service that is on sale now, with the lengths it allows. */
export interface BookableService {
  serviceType: string;
  displayName: string;
  minMinutes: number;
  stepMinutes: number;
  maxMinutes: number;
}

/** The assistance as one sentence for the backend and the summary ("Other" is replaced by what was typed). */
export function helpNeeded(draft: Pick<BookingDraft, "assistance" | "assistanceOther">): string {
  return draft.assistance === "Other" ? draft.assistanceOther.trim() : draft.assistance;
}

/** The condition as text, or null when none was named ("None" means nothing to send). */
export function conditionText(draft: Pick<BookingDraft, "condition" | "conditionOther">): string | null {
  if (!draft.condition || draft.condition === "None") return null;
  const text = draft.condition === "Other" ? draft.conditionOther.trim() : draft.condition;
  return text || null;
}

/** The price the backend preview gave (`POST /booking/preview`). Nothing here is computed on the device. */
export interface BookingQuote {
  serviceFee: number;
  platformFee: number;
  total: number;
  surgeActive: boolean;
  surgeMultiplier: number | null;
  discountActive: boolean;
  discountPercent: number | null;
  peakHoursWarning: string | null;
}

/** One chat message. `senderId` is the sender's USER id: the patient's own messages carry the `id` of `GET /auth/me`. */
export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  /** An ISO instant (the API's zone-less UTC time, made explicit). */
  sentAt: string;
}
