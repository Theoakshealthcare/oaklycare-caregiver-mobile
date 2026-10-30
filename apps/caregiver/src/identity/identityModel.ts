/**
 * What the identity (KYC) screens show for a given server state, and the small rules around it.
 * Pure, so the whole table is unit tested. Nothing here knows the verification partner: the widget is behind
 * `IdentityWidgetLauncher`, and the screens only ever see the state object, a local phase and callbacks.
 *
 * The app never decides the outcome. A widget callback is a hint; "verified" is shown only when the server's
 * `status` says `verified` (backend guide, section 4, rule 1).
 */
import type { Schemas } from "@oakly/api-client";

import { ApiError } from "../api/errors";

export type IdentityState = Schemas["IdentityVerificationStateOut"];
export type IdentitySession = Schemas["IdentityVerificationSessionOut"];
export type IdentityWidgetConfig = Schemas["IdentityWidgetConfig"];
export type IdentityClientEvent = Schemas["IdentityVerificationClientEventRequest"]["event"];
export type IdentityFailureHint = NonNullable<IdentityState["failure_hint"]>;

/**
 * The version of the consent text below. The server records the version the caregiver says they saw, so the app
 * sends this constant, and offers Start only when the server's current `policy_version` is the same: otherwise
 * the person would "agree" to words they did not read.
 */
export const CONSENT_TEXT_VERSION = "kyc-2026-10";

/**
 * CONTENT, FOR COUNSEL REVIEW before launch (NDPA 2023 lawful basis for biometric data, DPIA question).
 * Design 10.2, word for word; the "[Privacy Policy]" link has no destination decided yet.
 */
export const CONSENT_TITLE = "Verify your identity";
/** The provider is not final (design section 15); changing it means new words and a new `CONSENT_TEXT_VERSION`. */
export const VERIFICATION_PARTNER_NAME = "Prembly";
export const CONSENT_BODY =
  `To keep patients safe, Oakly checks that you are who you say you are. With your agreement, our verification partner ${VERIFICATION_PARTNER_NAME} will check your National ID (NIN or BVN) or ID document against government records and compare a live photo of your face with the record. ${VERIFICATION_PARTNER_NAME} handles your ID details and photo. Oakly keeps only the result of the check and a reference, not your ID or your photo. You can ask us to delete your data at any time. If the check can't confirm you, a member of our team reviews it.`;
export const CONSENT_LABEL = "I agree to this identity check.";

/** Where the person is in this screen, besides what the server says. */
export type IdentityPhase =
  | { kind: "idle" }
  /** Creating (or resuming) the attempt. */
  | { kind: "starting" }
  /** The widget is open. */
  | { kind: "widget" }
  /** The widget said it finished; waiting for the partner's answer (a hint, never a result). */
  | { kind: "submitted" }
  | { kind: "closed" }
  | { kind: "widgetError" }
  | { kind: "permissionDenied" }
  /** Starting failed; the screen underneath is still the one the server state gives. */
  | { kind: "startFailed"; code: string | null; message: string };

export type IdentityScreen =
  | "loading"
  | "loadError"
  | "offline"
  | "intro"
  | "resume"
  | "starting"
  | "widget"
  | "permissionDenied"
  | "closed"
  | "widgetError"
  | "checking"
  | "verified"
  | "tryAgain"
  | "exhausted"
  | "underReview"
  | "unavailable"
  | "expired"
  | "error"
  | "rejected"
  | "updateRequired";

export function isOffline(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

/** The machine `code` of an identity error (`detail` is `{ code, message }` on every identity error), else null. */
export function identityErrorCode(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const detail = error.body && typeof error.body === "object" ? (error.body as { detail?: unknown }).detail : undefined;
  const code = detail && typeof detail === "object" ? (detail as { code?: unknown }).code : undefined;
  return typeof code === "string" ? code : null;
}

/**
 * The words for a refused identity call. The backend writes these for the caregiver (guide section 4, error table), so
 * a call that carries a code shows the server's own message even on a 503; anything else gets the app's usual wording.
 */
export function identityErrorMessage(error: unknown, fallback: (error: unknown) => string): string {
  if (error instanceof ApiError && identityErrorCode(error)) {
    const detail = (error.body as { detail: { message?: unknown } }).detail;
    if (typeof detail.message === "string" && detail.message) return detail.message;
  }
  return fallback(error);
}

/** Codes whose meaning the refreshed state already shows, so the screen needs no extra message. */
export const SELF_EXPLAINING_CODES: readonly string[] = [
  "ALREADY_VERIFIED",
  "UNDER_REVIEW",
  "IDENTITY_REJECTED",
  "ATTEMPTS_EXHAUSTED",
];

/** True while the caregiver can still be offered "Continue without for now" (backend: only while the provider is down). */
export function canDefer(state: IdentityState | undefined): boolean {
  return !!state && !state.provider_available && (state.status === "pending" || state.status === "in_progress");
}

/** Which screen to draw. The server's decision beats anything local; local phases cover only the widget in between. */
export function resolveIdentityScreen(input: {
  state: IdentityState | undefined;
  loadError?: unknown;
  phase: IdentityPhase;
  /** The consent text version this build shows. */
  textVersion?: string;
}): IdentityScreen {
  const { state, loadError, phase, textVersion = CONSENT_TEXT_VERSION } = input;
  if (!state) {
    if (!loadError) return "loading";
    return isOffline(loadError) ? "offline" : "loadError";
  }

  // 1. What only a person or the partner decides.
  if (state.status === "verified") return "verified";
  if (state.status === "needs_review") return "underReview";
  if (state.status === "failed") return "rejected";

  // 2. The widget moments (pending / in_progress only).
  switch (phase.kind) {
    case "starting":
      return "starting";
    case "widget":
      return "widget";
    case "submitted":
      // Only while the server still shows a running attempt; once it has answered, its state decides.
      if (state.active_verification_id) return "checking";
      break;
    case "closed":
      return "closed";
    case "widgetError":
      return "widgetError";
    case "permissionDenied":
      return "permissionDenied";
    case "idle":
    case "startFailed":
      break;
  }

  // 3. Server state.
  const last = state.last_attempt_status ?? null;
  if (state.active_verification_id) {
    if (last === "awaiting_result") return "checking";
    if (!state.provider_available) return "unavailable";
    return "resume";
  }
  if (!state.provider_available) return "unavailable";
  if (state.policy_version !== textVersion) return "updateRequired";
  if (last === "failed") return state.can_start ? "tryAgain" : "exhausted";
  if (last === "expired") return state.can_start ? "expired" : "exhausted";
  if (last === "error") return state.can_start ? "error" : "exhausted";
  return state.can_start ? "intro" : "exhausted";
}

/** "Attempt 2 of 3". A running attempt is already counted in `attempts_used`; a new one is the next number. */
export function attemptLabel(state: IdentityState, screen: IdentityScreen): string {
  const running = screen === "resume" || screen === "checking" || screen === "closed" || screen === "widgetError";
  const number = running ? state.attempts_used : state.attempts_used + 1;
  return `Attempt ${Math.min(Math.max(number, 1), state.attempts_max)} of ${state.attempts_max}`;
}

/** Screens where a new attempt starts, so the separate consent is asked (one consent per attempt). */
export function asksConsent(screen: IdentityScreen): boolean {
  return screen === "intro" || screen === "tryAgain" || screen === "expired" || screen === "error";
}

const TIPS: Record<IdentityFailureHint, string> = {
  lighting: "Find good light, face it, and take off any cap or glasses.",
  document: "Hold your ID flat and fill the frame, so every corner shows.",
  mismatch_generic: "Use the ID that matches the name on your Oakly profile.",
};
const GENERIC_TIP = "Find good light, take off any cap or glasses, and hold your ID flat so it fills the frame.";

export function tipFor(hint: IdentityFailureHint | null | undefined): string {
  return hint ? TIPS[hint] : GENERIC_TIP;
}

/** "usually within 24 hours" (the server says how long), else a plain fallback. */
export function reviewEtaText(hours: number | null | undefined): string {
  return hours && hours > 0 ? `usually within ${hours} hours` : "as soon as they can";
}

/**
 * Polling while a result is awaited: 3 s, then 5 s after 30 s, then 10 s after 60 s (design 6 and the guide:
 * "3 s backing off to 10 s"). After 2 minutes the screen says it is taking longer and the caregiver may leave; after
 * 5 minutes polling stops (no never-ending timer) and "Check again" restarts it.
 */
export type PollStage = "fast" | "mid" | "slow" | "stopped";

export const POLL_STAGES: readonly { atMs: number; stage: PollStage }[] = [
  { atMs: 30_000, stage: "mid" },
  { atMs: 60_000, stage: "slow" },
  { atMs: 300_000, stage: "stopped" },
];

export const POLL_DELAY_MS: Record<PollStage, number | false> = {
  fast: 3_000,
  mid: 5_000,
  slow: 10_000,
  stopped: false,
};

/** The stage after `elapsedMs` of waiting. */
export function pollStageAt(elapsedMs: number): PollStage {
  let stage: PollStage = "fast";
  for (const step of POLL_STAGES) if (elapsedMs >= step.atMs) stage = step.stage;
  return stage;
}

/** True from 2 minutes on: show "This is taking longer. You can leave this screen; we'll notify you." */
export const SLOW_AFTER_MS = 120_000;
export function isSlow(elapsedMs: number): boolean {
  return elapsedMs >= SLOW_AFTER_MS;
}

/** Whether the screen waits for the partner's answer (and so polls). */
export function shouldPoll(screen: IdentityScreen): boolean {
  return screen === "checking";
}

/**
 * Where "Continue" goes. Onboarding goes on to consent; the status-screen stack (after submission, or when an admin
 * asked for changes) has no consent step and returns to the status screen.
 */
export function nextRouteAfterIdentity(routeNames: readonly string[] | undefined): "ConsentScreen" | "VerificationStatus" {
  return routeNames?.includes("ConsentScreen") ? "ConsentScreen" : "VerificationStatus";
}
