/**
 * API errors and their user-facing messages.
 *
 * The backend answers with FastAPI's `{ "detail": ... }` (a string for almost every error, a list of
 * objects for 422). Screen-specific wording is added per slice, next to the screen that needs it.
 */
import { errorMessage } from "@oakly/api-client";

/** Where an error happened; the same status code reads differently on login and elsewhere. */
export type ErrorContext = "default" | "login" | "register";

export class ApiError extends Error {
  /** HTTP status, or 0 when the request never reached the server (offline, DNS, timeout). */
  readonly status: number;
  /** `detail` when the server sent a plain string, else null. */
  readonly detail: string | null;
  /** The parsed error body, as the server sent it. */
  readonly body: unknown;
  /** `detail.code` when the server sent the coded object shape (`{ detail: { code, message } }`), else null. */
  readonly code: string | null;
  /** The `Retry-After` header in seconds, else null. */
  readonly retryAfterSeconds: number | null;

  constructor(status: number, body: unknown, message: string, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.retryAfterSeconds = retryAfterSeconds;
    const detail = body && typeof body === "object" ? (body as { detail?: unknown }).detail : undefined;
    this.detail = typeof detail === "string" ? detail : null;
    const code = detail && typeof detail === "object" && !Array.isArray(detail) ? (detail as { code?: unknown }).code : undefined;
    this.code = typeof code === "string" ? code : null;
  }
}

/** `ApiError.status` of a failure inside our own code (not the network, not the server): never shown as "Can't reach Oakly". */
export const CLIENT_FAILURE_STATUS = -1;

export const NETWORK_MESSAGE = "Can't reach Oakly. Check your internet connection and try again.";
export const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";
const SERVER_MESSAGE = "Something went wrong on our side. Please try again in a moment.";
export const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

/** "45 seconds", "3 minutes": how long a 429 `Retry-After` asks the person to wait. */
export function waitText(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 90) return `${s} ${s === 1 ? "second" : "seconds"}`;
  const minutes = Math.ceil(s / 60);
  return `${minutes} minutes`;
}

/** `detail.message` of the coded error shape, else null. */
function codedMessage(body: unknown): string | null {
  const detail = body && typeof body === "object" ? (body as { detail?: unknown }).detail : undefined;
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  const message = (detail as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

export function messageForStatus(
  status: number,
  detail: string | null,
  body: unknown,
  context: ErrorContext,
  retryAfterSeconds: number | null = null,
): string {
  if (status === 0) return NETWORK_MESSAGE;
  if (status === CLIENT_FAILURE_STATUS) return FALLBACK_MESSAGE;
  if (status === 401) {
    return context === "login" ? "Incorrect email or password." : SESSION_EXPIRED_MESSAGE;
  }
  if (status === 429) {
    return retryAfterSeconds
      ? `Too many attempts. Please try again in ${waitText(retryAfterSeconds)}.`
      : "Too many attempts. Please wait a moment and try again.";
  }
  if (status >= 500) {
    // A coded 5xx (the cancel route's 503 `payment_check_unavailable`) carries a sentence meant for the person.
    const coded = codedMessage(body);
    return coded ?? SERVER_MESSAGE;
  }
  return errorMessage(body, detail ?? FALLBACK_MESSAGE);
}

/** Turns anything thrown by the data layer into a message that is safe to show a user. */
export function messageForError(error: unknown, context: ErrorContext = "default"): string {
  if (error instanceof ApiError) {
    return messageForStatus(error.status, error.detail, error.body, context, error.retryAfterSeconds);
  }
  return FALLBACK_MESSAGE;
}
