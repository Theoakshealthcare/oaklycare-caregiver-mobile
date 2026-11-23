/**
 * Reset password by the emailed 5-digit code (backend guide `fe-integration-guide-password-reset.md`).
 *
 * Flow: `POST /auth/password-recovery {email}` -> email with a code (valid 15 minutes, works once) ->
 * `POST /auth/reset-password {email, code, new_password}` -> back to Login (no tokens come back, and every other
 * session of the account is ended). Refusals are `{ detail: { code, message } }`, an OBJECT; this reads `detail.code`
 * and never the message. The old long-token form still exists on the server for the build already installed, but
 * nothing here uses it.
 */
import { ApiError, waitText } from "@/src/api/errors";

export const RESET_CODE_LENGTH = 5;
/** Seconds before "Resend code" opens again. The server sends at most 3 emails per address per hour and drops the rest silently. */
export const RESEND_SECONDS = 60;

export const SENT_TITLE = "Check your email";
export const SENT_MESSAGE = "If that email has an account, we've sent a 5-digit code. It works once and for 15 minutes. Check your spam folder too.";
export const RESENT_NOTICE = "If that email has an account, we've sent a new code. Use the newest email and check your spam folder.";
export const INVALID_CODE_MESSAGE = "That code isn't right or has expired. Request a new one.";
/** The green toast after a reset (Figma). Every other session of the account is ended by the server. */
export const SUCCESS_TOAST = "Password has been Reset Successfully";

/** Digits only, never more than 5: what the code box keeps after typing, pasting or the keyboard's "code from email". */
export const codeDigits = (value: string): string => value.replace(/\D/g, "").slice(0, RESET_CODE_LENGTH);

export type ResetFailure =
  /** Wrong / expired / used code: clear the box, offer Resend. */
  | { kind: "invalid_code"; message: string }
  /** The server's own sentence for a weak password goes under the password field; the code is still good. */
  | { kind: "weak_password"; message: string }
  /** 5 wrong codes: the code is dead, only a new one helps. */
  | { kind: "request_new_code"; message: string }
  /** The 24-hour budget: nothing helps until the window ends (Retry-After), so Resend is not offered. */
  | { kind: "locked"; message: string }
  /** Offline, 5xx, 422 and anything unexpected: show `messageForError`. */
  | { kind: "other" };

function detailObject(error: ApiError): { code?: unknown; message?: unknown } | null {
  const detail = error.body && typeof error.body === "object" ? (error.body as { detail?: unknown }).detail : undefined;
  return detail && typeof detail === "object" && !Array.isArray(detail) ? (detail as { code?: unknown; message?: unknown }) : null;
}

export function resetFailure(error: unknown): ResetFailure {
  if (!(error instanceof ApiError)) return { kind: "other" };
  const detail = detailObject(error);
  switch (detail?.code) {
    case "invalid_or_expired_code":
      return { kind: "invalid_code", message: INVALID_CODE_MESSAGE };
    case "weak_password":
      return { kind: "weak_password", message: typeof detail.message === "string" ? detail.message : "Choose a stronger password." };
    case "too_many_attempts":
      return error.retryAfterSeconds
        ? { kind: "locked", message: `Too many tries. Try again in ${waitText(error.retryAfterSeconds)}.` }
        : { kind: "request_new_code", message: "Too many tries. Request a new code." };
    default:
      return { kind: "other" };
  }
}
