/**
 * An in-memory stand-in for the caregiver identity endpoints, so the screens can be built and demoed without a
 * backend or a widget. It plays the SERVER's part (the app never decides an outcome): after the widget reports
 * `completed`, the simulated partner answers once the state has been read `pollsToResolve` times, with no timers.
 *
 * Scenarios (`EXPO_PUBLIC_KYC_MOCK_SCENARIO`, or `createMockIdentityService({ scenario })`):
 *   pass          first attempt verifies                         try_again   attempt 1 fails (lighting), the next passes
 *   exhausted     every attempt fails                            needs_review  the case goes to a person
 *   expired       attempt 1 times out, the next passes           error       attempt 1 errors on our side, the next passes
 *   provider_down verification is unavailable (defer allowed)    rejected    a person marked the identity failed
 */
import { ApiError } from "../api/errors";
import { KYC_MOCK_SCENARIO } from "./config";
import type { IdentityClientEvent, IdentitySession, IdentityState } from "./identityModel";
import type { IdentityVerificationService } from "../services/identity.service";
import type { IdentityWidgetLauncher, WidgetOutcome } from "./widget";

export type MockScenario =
  | "pass"
  | "try_again"
  | "exhausted"
  | "needs_review"
  | "expired"
  | "error"
  | "provider_down"
  | "rejected";

const SCENARIOS: readonly MockScenario[] = [
  "pass",
  "try_again",
  "exhausted",
  "needs_review",
  "expired",
  "error",
  "provider_down",
  "rejected",
];

export function parseMockScenario(raw: string | undefined): MockScenario {
  return SCENARIOS.find((s) => s === raw) ?? "pass";
}

export interface MockOptions {
  scenario?: MockScenario;
  /** How many state reads after `completed` before the simulated answer arrives. */
  pollsToResolve?: number;
}

const POLICY_VERSION = "kyc-2026-10";
const MAX_ATTEMPTS = 3;

function apiError(status: number, code: string, message: string): ApiError {
  return new ApiError(status, { detail: { code, message } }, message);
}

export function createMockIdentityService(options: MockOptions = {}): IdentityVerificationService & {
  /** Test/demo helper: the current simulated state without counting as a poll. */
  peek(): IdentityState;
} {
  const scenario = options.scenario ?? "pass";
  const pollsToResolve = options.pollsToResolve ?? 2;

  let state: IdentityState = {
    status: scenario === "rejected" ? "failed" : "pending",
    attempts_used: 0,
    attempts_max: MAX_ATTEMPTS,
    active_verification_id: null,
    last_attempt_status: null,
    can_start: scenario !== "rejected" && scenario !== "provider_down",
    failure_hint: null,
    provider_available: scenario !== "provider_down",
    review_eta_hours: null,
    policy_version: POLICY_VERSION,
  };
  let pollsSinceCompleted: number | null = null;

  const snapshot = (): IdentityState => ({ ...state });

  /** What the simulated partner answers for the attempt that just finished. */
  function resolveAttempt(): void {
    const attempt = state.attempts_used;
    pollsSinceCompleted = null;
    const base = { active_verification_id: null, failure_hint: null, review_eta_hours: null };
    const passes = (): void => {
      state = { ...state, ...base, status: "verified", last_attempt_status: "passed", can_start: false };
    };
    const fails = (hint: IdentityState["failure_hint"]): void => {
      const exhausted = attempt >= state.attempts_max;
      state = {
        ...state,
        ...base,
        status: "in_progress",
        last_attempt_status: "failed",
        failure_hint: hint,
        can_start: !exhausted,
      };
    };
    switch (scenario) {
      case "pass":
        return passes();
      case "try_again":
        return attempt === 1 ? fails("lighting") : passes();
      case "exhausted":
        return fails(attempt === 1 ? "lighting" : attempt === 2 ? "document" : "mismatch_generic");
      case "needs_review":
        state = { ...state, ...base, status: "needs_review", last_attempt_status: "needs_review", can_start: false, review_eta_hours: 24 };
        return;
      case "expired":
      case "error":
        if (attempt === 1) {
          // Neither counts against the cap (backend: expired and error are not failed attempts).
          state = {
            ...state,
            ...base,
            status: "in_progress",
            attempts_used: attempt - 1,
            last_attempt_status: scenario === "expired" ? "expired" : "error",
            can_start: true,
          };
          return;
        }
        return passes();
      default:
        return passes();
    }
  }

  return {
    peek: snapshot,

    async getState() {
      if (state.active_verification_id && state.last_attempt_status === "awaiting_result" && pollsSinceCompleted !== null) {
        pollsSinceCompleted += 1;
        if (pollsSinceCompleted >= pollsToResolve) resolveAttempt();
      }
      return snapshot();
    },

    async startSession({ policyVersion }): Promise<IdentitySession> {
      if (!state.provider_available) {
        throw apiError(503, "PROVIDER_UNAVAILABLE", "Identity verification is temporarily unavailable.");
      }
      if (state.status === "verified") throw apiError(409, "ALREADY_VERIFIED", "Identity already verified");
      if (state.status === "needs_review") throw apiError(409, "UNDER_REVIEW", "Your case is with our team");
      if (state.status === "failed") throw apiError(409, "IDENTITY_REJECTED", "Our team could not confirm your identity");
      if (policyVersion !== state.policy_version) {
        throw apiError(409, "POLICY_VERSION_MISMATCH", "The consent text has changed. Please read and agree again.");
      }
      if (!state.active_verification_id) {
        if (!state.can_start) {
          throw apiError(409, "ATTEMPTS_EXHAUSTED", "You have used all your identity verification attempts. Our team will review your case.");
        }
        const attemptNo = state.attempts_used + 1;
        state = {
          ...state,
          status: "in_progress",
          attempts_used: attemptNo,
          active_verification_id: `mock-verification-${attemptNo}`,
          last_attempt_status: "created",
          failure_hint: null,
        };
      }
      return {
        verification_id: state.active_verification_id!,
        attempt_no: state.attempts_used,
        widget: {
          widget_id: "mock-widget-id",
          widget_key: "mock-widget-key",
          email: "caregiver@example.com",
          first_name: "Placeholder",
          last_name: "Caregiver",
          metadata: { oakly_ref: `mock-ref-${state.attempts_used}` },
        },
        state: snapshot(),
      };
    },

    async sendClientEvent(verificationId: string, event: IdentityClientEvent) {
      if (verificationId !== state.active_verification_id) {
        throw apiError(404, "VERIFICATION_NOT_FOUND", "Verification not found");
      }
      // A hint only moves the attempt along; it can never touch `status` (the server's rule).
      if (event === "opened" && state.last_attempt_status === "created") {
        state = { ...state, last_attempt_status: "started" };
      } else if (event === "completed" && (state.last_attempt_status === "created" || state.last_attempt_status === "started")) {
        state = { ...state, last_attempt_status: "awaiting_result" };
        pollsSinceCompleted = 0;
      }
      return snapshot();
    },

    async defer() {
      if (state.provider_available) {
        throw apiError(409, "PROVIDER_AVAILABLE", "Verification is available right now.");
      }
      return snapshot();
    },
  };
}

/** A simulated widget: plays the given outcomes in order, then completes. */
export function createMockWidgetLauncher(outcomes: WidgetOutcome[] = []): IdentityWidgetLauncher {
  const queue = [...outcomes];
  return {
    async open() {
      return queue.shift() ?? { kind: "completed", sessionId: "mock-session-001" };
    },
  };
}

export const defaultMockScenario: MockScenario = parseMockScenario(KYC_MOCK_SCENARIO);
