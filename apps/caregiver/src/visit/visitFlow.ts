/**
 * The visit flow: accepted -> (on my way) -> visit code -> in progress -> complete.
 * Pure logic; the screens in `src/screens/visit` only render it.
 */
import { isSuspendedStop, messageForError, visitCodeFailure } from "@/src/api/errors";

export type VisitStep = "on_my_way" | "enter_code" | "in_progress" | "done" | "closed";

/** Which screen a booking status gets. `start` also works from `accepted` (On my way is optional). */
export function stepForStatus(status: string): VisitStep {
  switch (status) {
    case "accepted":
      return "on_my_way";
    case "en_route":
      return "enter_code";
    case "in_progress":
      return "in_progress";
    case "completed":
      return "done";
    default:
      // pending, cancelled, declined: nothing left to do here.
      return "closed";
  }
}

export const VISIT_CODE_LENGTH = 4;

/** Keeps only digits, at most 4: the backend takes `^[0-9]{4}$` and rejects anything else with a 422. */
export function sanitizeCode(input: string): string {
  return input.replace(/\D/g, "").slice(0, VISIT_CODE_LENGTH);
}

export function isCompleteCode(code: string): boolean {
  return new RegExp(`^[0-9]{${VISIT_CODE_LENGTH}}$`).test(code);
}

/** Whole seconds left on a lock, rounded up so the countdown never shows 0:00 while still locked. */
export function secondsLeft(lockedUntil: number | null, now: number): number {
  if (lockedUntil === null) return 0;
  return Math.max(0, Math.ceil((lockedUntil - now) / 1000));
}

/** Remembers a lock per booking, so leaving and re-entering the screen keeps the countdown. */
export function createCodeLocks(now: () => number = Date.now) {
  const until = new Map<string, number>();
  return {
    lock(bookingId: string, seconds: number): number {
      const at = now() + seconds * 1000;
      until.set(bookingId, at);
      return at;
    },
    get(bookingId: string): number | null {
      const at = until.get(bookingId);
      if (at === undefined) return null;
      if (at <= now()) {
        until.delete(bookingId);
        return null;
      }
      return at;
    },
    clear(bookingId: string): void {
      until.delete(bookingId);
    },
  };
}

export const codeLocks = createCodeLocks();

export type SubmitCodeResult =
  | { kind: "started" }
  | { kind: "incorrect"; attemptsLeft: number | null; message: string }
  | { kind: "locked"; lockedUntil: number; message: string }
  /** The backend refused because the caregiver is no longer approved: stop the flow. */
  | { kind: "suspended"; message: string }
  | { kind: "error"; message: string };

interface SubmitDeps {
  /** POST action `start` with the code. Throws an ApiError on failure. */
  start(bookingId: string, code: string): Promise<unknown>;
  locks?: ReturnType<typeof createCodeLocks>;
}

/**
 * Sends the code. Refuses locally while a lock is running (the backend would answer 423 even for
 * the right code and the guide says to stop sending until Retry-After has passed). Maps 400
 * "attempts left", 423 + Retry-After, and the suspended 403 to a result the screen renders.
 */
export async function submitVisitCode(bookingId: string, code: string, deps: SubmitDeps): Promise<SubmitCodeResult> {
  const locks = deps.locks ?? codeLocks;
  const existing = locks.get(bookingId);
  if (existing !== null) {
    return {
      kind: "locked",
      lockedUntil: existing,
      message: "The visit code is locked. Wait for the timer, and ask the patient to check the code in their Oakly app.",
    };
  }
  if (!isCompleteCode(code)) {
    return { kind: "error", message: "Enter the 4-digit visit code." };
  }
  try {
    await deps.start(bookingId, code);
    locks.clear(bookingId);
    return { kind: "started" };
  } catch (error) {
    const message = messageForError(error, "visit");
    if (isSuspendedStop(error)) return { kind: "suspended", message };
    const failure = visitCodeFailure(error);
    if (failure?.kind === "locked") {
      return { kind: "locked", lockedUntil: locks.lock(bookingId, failure.retryAfterSeconds), message };
    }
    if (failure?.kind === "incorrect") {
      return { kind: "incorrect", attemptsLeft: failure.attemptsLeft, message };
    }
    return { kind: "error", message };
  }
}

/**
 * The backend only accepts "On my way" from `onmyway_compensation_window_minutes` before the start
 * (policy default 120; it is not in any response). The server is authoritative: this only decides
 * whether the button looks enabled, and a too-early 409 is still mapped to a message.
 */
export const ON_MY_WAY_WINDOW_MINUTES = 120;

export function onMyWayUnlocksAt(scheduledDateMs: number, windowMinutes = ON_MY_WAY_WINDOW_MINUTES): number {
  return scheduledDateMs - windowMinutes * 60_000;
}

export function isOnMyWayOpen(scheduledDateMs: number, nowMs: number): boolean {
  return nowMs >= onMyWayUnlocksAt(scheduledDateMs);
}

/**
 * The drop-out button is only for a WhatsApp booking that is still `accepted` and more than the same
 * window (2 h) before the start; the backend refuses inside it with a 409.
 */
export function canDropOut(channel: string, status: string, scheduledDateMs: number, nowMs: number): boolean {
  return channel === "whatsapp" && status === "accepted" && nowMs < onMyWayUnlocksAt(scheduledDateMs);
}

/** Wording for the confirmation before a caregiver drops a job they accepted. Promises nothing about money. */
export const DROP_OUT_CONFIRM = {
  title: "Can't make this visit?",
  message: "We'll let the family know and find another professional.",
  confirm: "Yes, I can't make it",
  keep: "Keep visit",
  done: "Thanks for letting us know. We'll let the family know and find another professional.",
} as const;
