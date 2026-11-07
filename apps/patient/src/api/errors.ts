/**
 * API errors and their user-facing messages.
 *
 * The backend answers with FastAPI's `{ "detail": ... }` (a string for almost every error, a list of
 * objects for 422). Screen-specific wording is added per slice, next to the screen that needs it.
 */
import { errorMessage } from "@oakly/api-client";

/** Where an error happened; the same status code reads differently on login and elsewhere. */
export type ErrorContext = "default" | "login";

export class ApiError extends Error {
  /** HTTP status, or 0 when the request never reached the server (offline, DNS, timeout). */
  readonly status: number;
  /** `detail` when the server sent a plain string, else null. */
  readonly detail: string | null;
  /** The parsed error body, as the server sent it. */
  readonly body: unknown;
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
  }
}

export const NETWORK_MESSAGE = "Can't reach Oakly. Check your internet connection and try again.";
export const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";
const SERVER_MESSAGE = "Something went wrong on our side. Please try again in a moment.";
const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

export function messageForStatus(
  status: number,
  detail: string | null,
  body: unknown,
  context: ErrorContext,
): string {
  if (status === 0) return NETWORK_MESSAGE;
  if (status === 401) {
    return context === "login" ? "Incorrect email or password." : SESSION_EXPIRED_MESSAGE;
  }
  if (status === 429) return "Too many attempts. Please wait a moment and try again.";
  if (status >= 500) return SERVER_MESSAGE;
  return errorMessage(body, detail ?? FALLBACK_MESSAGE);
}

/** Turns anything thrown by the data layer into a message that is safe to show a user. */
export function messageForError(error: unknown, context: ErrorContext = "default"): string {
  if (error instanceof ApiError) return messageForStatus(error.status, error.detail, error.body, context);
  return FALLBACK_MESSAGE;
}
