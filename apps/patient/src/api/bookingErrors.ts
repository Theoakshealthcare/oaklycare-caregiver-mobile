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
};

export function bookingErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code && CODE_MESSAGES[error.code]) return CODE_MESSAGES[error.code];
  return messageForError(error);
}

/** Codes that hand the person over to support rather than "try again". */
export function pointsToSupport(error: unknown): boolean {
  return error instanceof ApiError && (error.code === "booking_in_progress" || error.code === "payment_under_review");
}
