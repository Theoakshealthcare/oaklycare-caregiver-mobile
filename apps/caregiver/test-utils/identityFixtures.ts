import type { IdentitySession, IdentityState } from "../src/identity/identityModel";

/**
 * Identity state bodies. Values are the backend's real captured responses (guide section 4; captures 200, 205,
 * 207, 210, 211, 213, 218 under `docs/fe-captures/caregiver`), including their placeholder ids. States the captures
 * do not cover (verified, rejected, expired, error) are the same shape with the combination of fields the guide's
 * table gives for them, and are labelled "assumed".
 */
const VERIFICATION_ID = "bdc04b87-e29e-473c-b566-47bb1ae52ab0";

const base: IdentityState = {
  status: "pending",
  attempts_used: 0,
  attempts_max: 3,
  active_verification_id: null,
  last_attempt_status: null,
  can_start: true,
  failure_hint: null,
  provider_available: true,
  review_eta_hours: null,
  policy_version: "kyc-2026-10",
};

/** capture 200 */
export const fresh = (): IdentityState => ({ ...base });
/** capture 205: widget opened */
export const started = (): IdentityState => ({
  ...base,
  status: "in_progress",
  attempts_used: 1,
  active_verification_id: VERIFICATION_ID,
  last_attempt_status: "started",
});
/** capture 207: widget finished, waiting for the partner */
export const checking = (): IdentityState => ({ ...started(), last_attempt_status: "awaiting_result" });
/** capture 210 */
export const tryAgain = (): IdentityState => ({
  ...base,
  status: "in_progress",
  attempts_used: 1,
  last_attempt_status: "failed",
  failure_hint: "lighting",
});
/** capture 211 */
export const exhausted = (): IdentityState => ({
  ...base,
  status: "in_progress",
  attempts_used: 3,
  last_attempt_status: "failed",
  can_start: false,
  failure_hint: "lighting",
});
/** capture 213 */
export const underReview = (): IdentityState => ({
  ...base,
  status: "needs_review",
  attempts_used: 1,
  last_attempt_status: "needs_review",
  can_start: false,
  review_eta_hours: 24,
});
/** capture 218 */
export const providerDown = (): IdentityState => ({ ...base, can_start: false, provider_available: false });
/** assumed from the guide's table: `verified`, no running attempt, last attempt passed */
export const verified = (): IdentityState => ({
  ...base,
  status: "verified",
  attempts_used: 1,
  last_attempt_status: "passed",
  can_start: false,
});
/** assumed: `failed` is set only by our team */
export const rejected = (): IdentityState => ({ ...base, status: "failed", attempts_used: 1, last_attempt_status: "failed", can_start: false });
/** assumed from the guide's table: timed out, start again */
export const expired = (): IdentityState => ({ ...base, status: "in_progress", last_attempt_status: "expired" });
/** assumed: an attempt that errored on our side does not count */
export const errored = (): IdentityState => ({ ...base, status: "in_progress", last_attempt_status: "error" });

/** capture 204 / 203 (placeholder widget values) */
export const session = (state: IdentityState = started()): IdentitySession => ({
  verification_id: VERIFICATION_ID,
  attempt_no: 1,
  widget: {
    widget_id: "placeholder-widget-id",
    widget_key: "placeholder-widget-key",
    email: "caregiver-616524d402@example.com",
    first_name: "Placeholder",
    last_name: "Caregiver",
    metadata: { oakly_ref: "a0fbe750-b549-4a8a-95ae-512fbe35358c" },
  },
  state,
});

/** A placeholder for the hosted page's URL (backend slice KD2, `widget_url`); not a real page. */
export const WIDGET_URL = "https://api.example.test/kyc/widget/placeholder-token";

/** The session body once KD2 adds `widget_url` (same shape as capture 203/204 plus that one field). */
export const sessionWithUrl = (state: IdentityState = started()): IdentitySession => ({ ...session(state), widget_url: WIDGET_URL });

export { VERIFICATION_ID };
