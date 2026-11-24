import { ApiError, messageForError } from "./errors";

/**
 * One plain sentence for each stable `detail.code` the booking routes answer with (see the patient bookings FE
 * guide, section 6). Anything else falls back to the generic wording, so the network message and the server message
 * stay what they are everywhere else.
 */
const CODE_MESSAGES: Record<string, string> = {
  terms_changed: "The cancellation fee has changed since you last looked. Please check the new amount.",
  booking_in_progress: "The visit has already started, so it can't be cancelled in the app. Please contact support.",
  booking_completed: "This visit is already completed, so it can't be cancelled.",
  booking_already_cancelled: "This booking has already been cancelled.",
  booking_closed: "This booking is closed, so it can't be cancelled.",
  payment_under_review:
    "We are checking your payment with our payment provider, so we can't cancel yet. Please contact support and we will sort it out.",
  payment_check_unavailable: "We couldn't check your payment with our payment provider, so nothing was cancelled. Please try again in a moment.",
  not_your_booking: "Only the person who made this booking can cancel it.",
  booking_not_found: "We couldn't find that booking.",
  // 503 on preview / create in an environment with no pricing yet (guide section 10.1).
  booking_settings_not_configured: "Booking isn't available right now. Please try again later.",
};

/**
 * "Pay now" after a restart (`POST /booking/{id}/payment-link`, guide section 10.3). Same codes as above can mean something
 * else here (a cancel and a payment link are different questions), so this map comes first.
 */
const PAYMENT_LINK_MESSAGES: Record<string, string> = {
  not_your_booking: "Only the person who made this booking can pay for it.",
  booking_not_found: "We couldn't find that booking.",
  booking_already_cancelled: "This booking has been cancelled, so it can no longer be paid. You can book again.",
  booking_not_payable: "This booking can't be paid for any more. We've refreshed it so you can see where it stands.",
  payment_window_expired: "The time to pay for this booking has run out. Please make a new booking.",
  payment_under_review:
    "We are checking your payment with our payment provider. Please contact support and we will sort it out.",
  // Still running after the app waited a little: not a failure, just not ready.
  payment_link_in_progress: "Your payment link is still being prepared. Please try again in a moment.",
  payment_check_unavailable:
    "We couldn't check your payment with our payment provider, so no payment link was prepared. Nothing was charged. Please try again in a moment.",
  payment_link_unavailable:
    "We couldn't prepare your payment link right now. Your booking is still waiting for payment and nothing was charged. Please try again in a moment, and contact support if it keeps happening.",
  booking_settings_not_configured: "Booking isn't available right now. Please try again later.",
};

export function paymentLinkErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code && PAYMENT_LINK_MESSAGES[error.code]) return PAYMENT_LINK_MESSAGES[error.code];
  return messageForError(error);
}

/**
 * What "Pay now" does with a refused payment link:
 * - `paid`: not an error. The booking was already paid (maybe a moment ago): confirm it.
 * - `wait`: another request for the same booking is still running: wait a second and ask again, no error shown.
 * - `closed`: the booking can no longer be paid (cancelled, expired, not payable, someone else's, gone): say why, no Pay now.
 * - `retry`: nothing changed; offer "Pay now" again.
 */
export type PaymentLinkOutcome = "paid" | "wait" | "closed" | "retry";

export function paymentLinkOutcome(error: unknown): PaymentLinkOutcome {
  if (!(error instanceof ApiError)) return "retry";
  switch (error.code) {
    case "booking_already_paid":
      return "paid";
    case "payment_link_in_progress":
      return "wait";
    case "booking_already_cancelled":
    case "booking_not_payable":
    case "payment_window_expired":
    case "payment_under_review":
    case "not_your_booking":
    case "booking_not_found":
      return "closed";
    default:
      return "retry";
  }
}

export function bookingErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code && CODE_MESSAGES[error.code]) return CODE_MESSAGES[error.code];
  return messageForError(error);
}

/** Codes that hand the person over to support rather than "try again". */
export function pointsToSupport(error: unknown): boolean {
  return error instanceof ApiError && (error.code === "booking_in_progress" || error.code === "payment_under_review");
}

/**
 * What "Make Payment" shows when creating the booking is refused. A `422` that names `channels` (a value the backend does not
 * allow) would otherwise show FastAPI's validation sentence; every other error reads as it does elsewhere, including a coded
 * `503 payment_link_unavailable`, whose own `message` is shown.
 */
export function paymentMethodErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 422) {
    const detail = (error.body as { detail?: unknown } | null)?.detail;
    const namesChannels = Array.isArray(detail) && detail.some((d) => Array.isArray((d as { loc?: unknown })?.loc) && (d as { loc: unknown[] }).loc.includes("channels"));
    if (namesChannels) return "That payment method can't be used right now. Please choose another one and try again.";
  }
  return bookingErrorMessage(error);
}
