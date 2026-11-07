/**
 * Change password: the form rules and the reading of the backend's refusals. Copied from the caregiver app; the bodies of the
 * 400 and 429 answers are the captured ones (`__tests__/fixtures/live/26-..32-`).
 *
 * The rules mirror the server's (`POST /auth/change-password`): at least 8 characters, at most 72 BYTES (bcrypt ignores the
 * rest), at least 5 different characters, and not the current password. The server is still the authority: its `message`
 * for `weak_password` is shown as sent. Both `400` and `429` bodies are `{ detail: { code, message } }`, an OBJECT, unlike
 * most of this API.
 */
import { ApiError } from "@/src/api/errors";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_MIN_DISTINCT = 5;

/** The wait the backend starts with (30 s, then doubling); used only if a 429 arrives without `Retry-After`. */
export const DEFAULT_WAIT_SECONDS = 30;

export const SUCCESS_TITLE = "Password changed";
export const SUCCESS_MESSAGE = "You have been signed out on your other devices.";

export type PasswordField = "current" | "new" | "confirm";

export interface PasswordForm {
  current: string;
  next: string;
  confirm: string;
}

function utf8Length(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** The message the server gives for a too-weak new password, or null when it passes. */
export function weakPasswordMessage(password: string): string | null {
  if ([...password].length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (utf8Length(password) > PASSWORD_MAX_BYTES) return `Password must be at most ${PASSWORD_MAX_BYTES} bytes.`;
  if (new Set(password).size < PASSWORD_MIN_DISTINCT) return "Password is too repetitive.";
  return null;
}

/** Field errors for the form; an empty object means it can be sent. */
export function validatePasswordForm(form: PasswordForm): Partial<Record<PasswordField, string>> {
  const errors: Partial<Record<PasswordField, string>> = {};
  if (!form.current) errors.current = "Enter your current password";

  if (!form.next) errors.new = "Enter a new password";
  else if (weakPasswordMessage(form.next)) errors.new = weakPasswordMessage(form.next) as string;
  else if (form.current && form.next === form.current) errors.new = "Choose a password you are not using now.";

  if (!form.confirm) errors.confirm = "Please confirm your new password";
  else if (form.next && form.next !== form.confirm) errors.confirm = "Passwords do not match";
  return errors;
}

export type ChangePasswordFailure =
  | { kind: "field"; field: "current" | "new"; message: string }
  | { kind: "wait"; seconds: number; message: string }
  | { kind: "other" };

function detailObject(error: ApiError): { code?: unknown; message?: unknown } | null {
  const detail = error.body && typeof error.body === "object" ? (error.body as { detail?: unknown }).detail : undefined;
  return detail && typeof detail === "object" && !Array.isArray(detail) ? (detail as { code?: unknown; message?: unknown }) : null;
}

/**
 * Reads a failed change-password call. Branches on `detail.code`, never on the message. `other` (offline, 401, 5xx, 422)
 * is for the caller to show with `messageForError`.
 */
export function changePasswordFailure(error: unknown): ChangePasswordFailure {
  if (!(error instanceof ApiError)) return { kind: "other" };
  const detail = detailObject(error);
  const message = typeof detail?.message === "string" ? detail.message : null;
  switch (detail?.code) {
    case "wrong_current_password":
      return { kind: "field", field: "current", message: "Your current password is incorrect." };
    case "weak_password":
      return { kind: "field", field: "new", message: message ?? "Choose a stronger password." };
    case "same_password":
      return { kind: "field", field: "new", message: "Choose a password you are not using now." };
    case "too_many_attempts":
      return {
        kind: "wait",
        seconds: error.retryAfterSeconds ?? DEFAULT_WAIT_SECONDS,
        message: "Too many incorrect attempts. Please wait before trying again.",
      };
    default:
      return { kind: "other" };
  }
}

/** "0:30", "1:05": the wait the 429 asks for, as a countdown. */
export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
