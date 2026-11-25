/**
 * API errors and their user-facing messages.
 *
 * The backend answers with FastAPI's `{ "detail": ... }` (a string for most errors, a list of objects for a
 * validation 422, and `{ code, message }` for the newer ones: the "I've arrived" errors since 2026-11-08). Status codes and `detail` strings below come from the backend's verified FE guide
 * (`fe-integration-guide-caregiver.md`, section 11).
 */
import { errorMessage } from "@oakly/api-client";

import { formatStamp, parseBackendDate } from "@/src/utils/dates";

/** Where an error happened; the same status code reads differently on accept and on login. */
export type ErrorContext = "default" | "login" | "accept" | "decline" | "availability" | "visit" | "bank";

export class ApiError extends Error {
  /** HTTP status, 0 when the request never reached the server (offline, DNS, timeout), or -1 for an app-side failure. */
  readonly status: number;
  /** `detail` when the server sent a plain string, else null. */
  readonly detail: string | null;
  /** The parsed error body, as the server sent it. */
  readonly body: unknown;
  /** The `Retry-After` header in seconds (sent with the visit-code 423), else null. */
  readonly retryAfterSeconds: number | null;

  constructor(status: number, body: unknown, message: string, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.retryAfterSeconds = retryAfterSeconds;
    const detail = body && typeof body === "object" ? (body as { detail?: unknown }).detail : undefined;
    this.detail = typeof detail === "string" ? detail : null;
  }
}

/** `ApiError.status` for a failure inside the app (not the network, not a server answer). */
export const CLIENT_FAILURE_STATUS = -1;

export const NETWORK_MESSAGE = "Can't reach Oakly. Check your internet connection and try again.";
export const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";
const SERVER_MESSAGE = "Something went wrong on our side. Please try again in a moment.";
export const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

/** Backend `detail` strings the app maps to its own wording. Matched exactly, never by prefix. */
const DETAIL = {
  notOfferedThisBooking: "You were not offered this booking",
  bookingNotPaid: "Booking has not been paid for",
  caregiverRequired: "Access denied. Caregiver account required.",
  notApprovedToChangeAvailability: "Your account is not approved to change availability",
  shareLocationFirst: "Share your location before going available",
  notApprovedToStartVisits: "Your account is not approved to start visits",
  notAssigned: "This booking is not assigned to you",
  onlyAcceptedOnTheWay: "Only an accepted booking can be marked on the way",
  onlyAcceptedArrived: "Only an accepted booking can be marked as arrived",
  onlyAcceptedStart: "Only an accepted booking can be started",
  onlyInProgressComplete: "Only a booking in progress can be completed",
  noVisitCode: "This booking has no visit code. Contact support",
  visitCodeRequired: "A visit code is required to start the visit",
} as const;

/**
 * Too-early "On my way" 409. The hours follow the backend's booking policy (default "2 hours"), so the
 * whole sentence is matched and only the span is read from it.
 */
const ON_MY_WAY_TOO_EARLY = /^You can mark yourself on the way from (\d+ (?:hours?|minutes?)) before the visit$/;

const TOO_CLOSE_TO_CANCEL = "It's too close to the visit to cancel in the app. Please contact support.";

/** The lock the backend applies after 3 wrong codes (guide, section 8). */
export const VISIT_CODE_LOCK_SECONDS = 900;

export type VisitCodeFailure =
  | { kind: "incorrect"; attemptsLeft: number | null }
  | { kind: "locked"; retryAfterSeconds: number };

/**
 * Reads a failed `start` call: 400 "Incorrect visit code. N attempt(s) left before the code is
 * locked" or 423 (locked, with Retry-After). The attempts count is inside the string, so the 400
 * is matched on its prefix; null for any other error.
 */
export function visitCodeFailure(error: unknown): VisitCodeFailure | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 423) {
    return { kind: "locked", retryAfterSeconds: error.retryAfterSeconds ?? VISIT_CODE_LOCK_SECONDS };
  }
  if (error.status === 400 && error.detail?.startsWith("Incorrect visit code")) {
    const left = /(\d+) attempts? left/.exec(error.detail);
    return { kind: "incorrect", attemptsLeft: left ? Number(left[1]) : null };
  }
  return null;
}

/** True when the backend refused a visit action because the caregiver is no longer approved (suspended). */
export function isSuspendedStop(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 403 &&
    (error.detail === DETAIL.notApprovedToStartVisits || detailCodeOf(error.body) === ARRIVED_CODE.notApproved)
  );
}

/** "45 seconds", "3 minutes": how long a 429 `Retry-After` asks the person to wait. */
export function waitText(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 90) return `${s} ${s === 1 ? "second" : "seconds"}`;
  return `${Math.ceil(s / 60)} minutes`;
}

export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function visitMessage(status: number, detail: string | null, body: unknown, retryAfterSeconds: number | null): string | null {
  // The "I've arrived" errors are `{ code, message }` objects: read the code. A plain-string `detail` (an older backend,
  // or any other action) falls through to the sentence matching below.
  const code = detailCodeOf(body);
  if (code) {
    if (status === 422 && code === ARRIVED_TOO_EARLY_CODE) return arrivedTooEarlyMessage(body);
    if (status === 403 && code === ARRIVED_CODE.notApproved) return `${DETAIL.notApprovedToStartVisits}. Contact Oakly support.`;
    if (status === 403 && code === ARRIVED_CODE.notAssigned) return "This visit isn't assigned to you.";
    if (status === 409 && code === ARRIVED_CODE.notArrivable) return "This visit has already moved past this step. We've refreshed it.";
    if (status === 404 && code === ARRIVED_CODE.bookingNotFound) return "This booking could not be found. It may have been removed.";
    if (status === 404 && code === ARRIVED_CODE.profileNotFound) return "We couldn't find your caregiver profile. Please contact Oakly support.";
  }
  if (status === 403) {
    if (detail === DETAIL.notApprovedToStartVisits) {
      return `${DETAIL.notApprovedToStartVisits}. Contact Oakly support.`;
    }
    if (detail === DETAIL.notAssigned) return "This visit isn't assigned to you.";
  }
  if (status === 409) {
    if (detail === DETAIL.onlyAcceptedOnTheWay) return "This visit has already moved past this step. We've refreshed it.";
    if (detail === TOO_CLOSE_TO_CANCEL) {
      return "It's too close to the visit to cancel in the app. Please contact support from the Contact screen.";
    }
    const early = detail ? ON_MY_WAY_TOO_EARLY.exec(detail) : null;
    if (early) return `You can mark yourself on the way from ${early[1]} before the visit.`;
    if (detail === DETAIL.onlyAcceptedArrived) return "This visit has already moved past this step. We've refreshed it.";
    if (detail === DETAIL.onlyAcceptedStart) return "This visit can't be started right now. We've refreshed it.";
    if (detail === DETAIL.onlyInProgressComplete) return "This visit isn't in progress, so it can't be completed yet.";
    if (detail === DETAIL.noVisitCode) return "This visit has no visit code. Please contact Oakly support.";
  }
  if (status === 400 && detail === DETAIL.visitCodeRequired) return "Enter the 4-digit visit code.";
  if (status === 400 && detail?.startsWith("Incorrect visit code")) {
    const left = /(\d+) attempts? left/.exec(detail);
    const tries = left ? `${left[1]} ${left[1] === "1" ? "try" : "tries"} left before the code is locked. ` : "";
    return `That code isn't right. ${tries}Ask the patient to check the code in their Oakly app.`;
  }
  if (status === 423) {
    const seconds = retryAfterSeconds ?? VISIT_CODE_LOCK_SECONDS;
    return `Too many wrong codes. You can try again in ${formatCountdown(seconds)}. Ask the patient to check the code in their app rather than guessing.`;
  }
  return null;
}

/**
 * The machine code of a structured error: the backend answers some failures with
 * `detail = { code, message }` instead of a plain string (backend convention: read `detail.code`, never match on
 * the sentence). Null for a plain-string detail or any other body.
 */
export function detailCodeOf(body: unknown): string | null {
  const detail = body && typeof body === "object" ? (body as { detail?: unknown }).detail : undefined;
  const code = detail && typeof detail === "object" ? (detail as { code?: unknown }).code : undefined;
  return typeof code === "string" ? code : null;
}

/** `detail.message` of a structured error, else null. */
function detailMessageOf(body: unknown): string | null {
  const detail = body && typeof body === "object" ? (body as { detail?: unknown }).detail : undefined;
  const message = detail && typeof detail === "object" ? (detail as { message?: unknown }).message : undefined;
  return typeof message === "string" ? message : null;
}

/** `detail.earliest_at` (UTC, no "Z") of an `arrived_too_early` error, else null. */
function earliestAtOf(body: unknown): string | null {
  const detail = body && typeof body === "object" ? (body as { detail?: unknown }).detail : undefined;
  const at = detail && typeof detail === "object" ? (detail as { earliest_at?: unknown }).earliest_at : undefined;
  return typeof at === "string" ? at : null;
}

/** `detail.code` of the "I've arrived" refusal for an early tap (HTTP 422). */
export const ARRIVED_TOO_EARLY_CODE = "arrived_too_early";

/** The `{ code, message }` codes of the "I've arrived" action (backend guide, section 7, "Your earning, I've arrived..."). */
const ARRIVED_CODE = {
  notAssigned: "booking_not_assigned",
  notApproved: "caregiver_not_approved",
  notArrivable: "booking_not_arrivable",
  bookingNotFound: "booking_not_found",
  profileNotFound: "caregiver_profile_not_found",
} as const;

/** True when a visit refusal is the "I've arrived" tap before its window opens. */
export function isArrivedTooEarly(error: unknown): boolean {
  return error instanceof ApiError && error.status === 422 && detailCodeOf(error.body) === ARRIVED_TOO_EARLY_CODE;
}

/** Plain wording for the early tap: the opening time in the phone's local time, else the backend's sentence. */
function arrivedTooEarlyMessage(body: unknown): string {
  const at = earliestAtOf(body);
  const when = at ? parseBackendDate(at) : null;
  if (when && !Number.isNaN(when.getTime())) {
    return `It's too early to mark yourself as arrived. You can do it from ${formatStamp(when)}.`;
  }
  return detailMessageOf(body) ?? "It's too early to mark yourself as arrived. Try again closer to the visit.";
}

export function messageForStatus(
  status: number,
  detail: string | null,
  body: unknown,
  context: ErrorContext,
  retryAfterSeconds: number | null = null,
): string {
  if (status === 0) return NETWORK_MESSAGE;

  if (status === 403 && detail === DETAIL.caregiverRequired) {
    return "This app is for caregivers. Please use the correct app for your account.";
  }

  if (context === "availability") {
    if (status === 403 && detail === DETAIL.notApprovedToChangeAvailability) {
      return "You're not approved yet. You can go available once an admin approves your profile.";
    }
    if (status === 409 && detail === DETAIL.shareLocationFirst) {
      return "We need your location before you can go available. Turn on location and try again.";
    }
  }

  // Bank lookups/saves: the backend's sentences are written for the caregiver (guide, section 10.3),
  // so show them as sent (wrong number, unknown bank, Paystack down, lookup rate limit).
  if (context === "bank" && detail && (status === 400 || status === 429 || status === 503)) return detail;

  if (context === "visit") {
    const mapped = visitMessage(status, detail, body, retryAfterSeconds);
    if (mapped) return mapped;
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
    return context === "login" ? "Incorrect email or password." : SESSION_EXPIRED_MESSAGE;
  }
  if (status === 429) return "Too many attempts. Please wait a moment and try again.";
  if (status >= 500) return SERVER_MESSAGE;

  return errorMessage(body, detail ?? FALLBACK_MESSAGE);
}

/** Turns anything thrown by the data layer into a message that is safe to show a caregiver. */
export function messageForError(error: unknown, context: ErrorContext = "default"): string {
  if (error instanceof ApiError) {
    return messageForStatus(error.status, error.detail, error.body, context, error.retryAfterSeconds);
  }
  return FALLBACK_MESSAGE;
}

/** True when the offer can never be accepted by this caregiver (taken, not offered, gone). */
export function isOfferGone(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 409 || error.status === 404 || error.detail === DETAIL.notOfferedThisBooking);
}
