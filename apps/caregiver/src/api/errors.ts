/**
 * API errors and their user-facing messages.
 *
 * The backend answers with FastAPI's `{ "detail": ... }` (a string for almost every error, a list of
 * objects for 422). Status codes and `detail` strings below come from the backend's verified FE guide
 * (`fe-integration-guide-caregiver.md`, section 11).
 */
import { errorMessage } from "@oakly/api-client";

/** Where an error happened; the same status code reads differently on accept and on login. */
export type ErrorContext = "default" | "login" | "accept" | "decline" | "visit";

export class ApiError extends Error {
  /** HTTP status, or 0 when the request never reached the server (offline, DNS, timeout). */
  readonly status: number;
  /** `detail` when the server sent a plain string, else null. */
  readonly detail: string | null;
  /** The parsed error body, as the server sent it. */
  readonly body: unknown;

  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    const detail = body && typeof body === "object" ? (body as { detail?: unknown }).detail : undefined;
    this.detail = typeof detail === "string" ? detail : null;
  }
}

export const NETWORK_MESSAGE = "Can't reach Oakly. Check your internet connection and try again.";
export const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";
const SERVER_MESSAGE = "Something went wrong on our side. Please try again in a moment.";
const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

/** Backend `detail` strings the app maps to its own wording. Matched exactly, never by prefix. */
const DETAIL = {
  notOfferedThisBooking: "You were not offered this booking",
  bookingNotPaid: "Booking has not been paid for",
  caregiverRequired: "Access denied. Caregiver account required.",
} as const;

export function messageForStatus(status: number, detail: string | null, body: unknown, context: ErrorContext): string {
  if (status === 0) return NETWORK_MESSAGE;

  if (status === 403 && detail === DETAIL.caregiverRequired) {
    return "This app is for caregivers. Please use the correct app for your account.";
  }

  if (context === "accept" || context === "decline") {
    if (status === 403) {
      if (detail === DETAIL.notOfferedThisBooking) return "This job is no longer offered to you.";
      return "Your profile isn't approved yet. You can accept jobs once an admin approves it.";
    }
    if (status === 409) {
      if (detail === DETAIL.bookingNotPaid) return "This job isn't confirmed yet. Please try again shortly.";
      return "This job was taken by another caregiver.";
    }
    if (status === 404) return "This booking could not be found. It may have been removed.";
  }

  if (status === 401) {
    return context === "login" ? "Incorrect email/phone or password." : SESSION_EXPIRED_MESSAGE;
  }
  if (status === 429) return "Too many attempts. Please wait a moment and try again.";
  if (status >= 500) return SERVER_MESSAGE;

  return errorMessage(body, detail ?? FALLBACK_MESSAGE);
}

/** Turns anything thrown by the data layer into a message that is safe to show a caregiver. */
export function messageForError(error: unknown, context: ErrorContext = "default"): string {
  if (error instanceof ApiError) {
    return messageForStatus(error.status, error.detail, error.body, context);
  }
  return FALLBACK_MESSAGE;
}

/** True when the offer can never be accepted by this caregiver (taken, not offered, gone). */
export function isOfferGone(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 409 || error.status === 404 || error.detail === DETAIL.notOfferedThisBooking);
}
