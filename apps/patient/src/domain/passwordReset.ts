/**
 * Reading the refusals of `POST /auth/reset-password` (code form). Branches on `detail.code`, never on the message.
 * The shape is `{ detail: { code, message } }`, an OBJECT; the server answers 400 `invalid_or_expired_code` for a wrong,
 * expired, used, replaced or malformed code AND for an address with no account (one answer on purpose), 400
 * `weak_password` (code not used up), and 429 `too_many_attempts` (5 wrong codes: the code is dead until a new one is
 * asked for; or the 24-hour budget, which carries `Retry-After`).
 */
import { ApiError, waitText } from "@/src/api/errors";

export const RESET_CODE_LENGTH = 5;
/** Seconds before "Resend code" opens again. The server sends at most 3 emails per address per hour and drops the rest silently. */
export const RESEND_SECONDS = 60;

export const INVALID_CODE_MESSAGE = "That code isn't right or has expired. Request a new one.";
export const SENT_NOTICE = "If that email has an account, we've sent a new code. Use the newest email and check your spam folder.";
/** The green toast after a reset (Figma). The server also ends every other session of the account. */
export const SUCCESS_TOAST = "Password has been Reset Successfully";

export type ResetFailure =
  /** Wrong / expired / used code: clear the boxes, offer Resend. */
  | { kind: "invalid_code"; message: string }
  /** The server's own sentence for a weak password goes under the password field; the code is still good. */
  | { kind: "weak_password"; message: string }
  /** 5 wrong codes: the code is dead, only a new one helps. */
  | { kind: "request_new_code"; message: string }
  /** The 24-hour budget: nothing helps until the window ends (Retry-After), so Resend is not offered. */
  | { kind: "locked"; message: string }
  /** Offline, 5xx, 422 and anything unexpected: show `messageForError`. */
  | { kind: "other" };

export function resetFailure(error: unknown): ResetFailure {
  if (!(error instanceof ApiError)) return { kind: "other" };
  switch (error.code) {
    case "invalid_or_expired_code":
      return { kind: "invalid_code", message: INVALID_CODE_MESSAGE };
    case "weak_password": {
      const detail = (error.body as { detail?: { message?: unknown } } | null)?.detail;
      return { kind: "weak_password", message: typeof detail?.message === "string" ? detail.message : "Choose a stronger password." };
    }
    case "too_many_attempts":
      return error.retryAfterSeconds
        ? { kind: "locked", message: `Too many tries. Try again in ${waitText(error.retryAfterSeconds)}.` }
        : { kind: "request_new_code", message: "Too many tries. Request a new code." };
    default:
      return { kind: "other" };
  }
}
