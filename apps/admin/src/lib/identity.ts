/**
 * Plain-word copy for the identity (KYC) review. The codes are the backend's (admin guide section
 * 12.14); the list can grow, so an unknown code is shown as it is.
 */

export const REASON_WORDS: Record<string, string> = {
  watchlisted: "The ID number is on a watch list. Do not let this caregiver retry with the same number.",
  duplicate_identity: "The same ID number already passed for another account.",
  provider_disagreement: "The webhook and the provider's own record disagreed. Look the person up in the provider dashboard.",
  identity_data_missing: "The provider said pass but did not return a score, name or date of birth the check needs (or the profile has no date of birth).",
  attempts_exhausted: "Three clean failures in a row.",
  face_grey_band: "The face score is between the floor and the pass mark.",
  name_mismatch: "The name on the ID differs from the profile (a married name or a typo is the usual cause).",
  dob_mismatch: "The date of birth on the ID differs from the profile.",
  face_mismatch: "The selfie does not match the ID photo.",
  liveness_failed: "The liveness check failed.",
  record_not_found: "The ID was not found.",
  document_unreadable: "The ID could not be read.",
  provider_failed: "The provider failed the check without a clearer reason.",
  admin_decision: "An admin decided this attempt.",
  admin_reset: "An admin reset the attempts; this attempt no longer counts.",
};

/** The words for a reason code, or the code itself when we do not know it. */
export function reasonWords(code: string): string {
  return REASON_WORDS[code] ?? code;
}

/** `true` / `false` / `null` (could not be compared) as words. */
export function matchWords(value: boolean | null | undefined): string {
  if (value === true) return "Matches the profile";
  if (value === false) return "Differs from the profile";
  return "Not compared";
}

/** A score as the backend sent it (0 to 100); `null` when not known. */
export function scoreWords(value: number | null | undefined): string {
  return value === null || value === undefined ? "Not reported" : String(value);
}

/** Attempt statuses that mean the provider has not answered yet. */
export const OPEN_ATTEMPT_STATUSES = ["created", "started", "awaiting_result"];

/** The statuses accepted as `expected_status` on the decision. */
export type IdentityStatus = "pending" | "in_progress" | "needs_review" | "verified" | "failed";
const IDENTITY_STATUSES: string[] = ["pending", "in_progress", "needs_review", "verified", "failed"];
export function asIdentityStatus(value: string): IdentityStatus | undefined {
  return IDENTITY_STATUSES.includes(value) ? (value as IdentityStatus) : undefined;
}
