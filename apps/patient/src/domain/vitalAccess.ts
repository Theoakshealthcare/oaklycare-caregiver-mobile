import { ApiError } from "@/src/api/errors";

/**
 * The sentence for a refused grant / revoke / list (backend guide `fe-integration-guide-patient-profile-vitals.md`, section 5.5).
 * These refusals are plain STRINGS (`detail: "Caregiver not found."`), not coded objects, so the exact sentences are matched
 * and anything else falls back to the generic wording.
 */
const BY_DETAIL: Record<string, string> = {
  "You can only manage access to your own vitals.": "Your profile isn't ready to share vitals yet. Please sign out and in again, then try again.",
  "Caregiver not found.": "We couldn't find that caregiver any more, so nothing was shared.",
  "Access not found or already revoked.": "You had already stopped sharing with this caregiver.",
  "Only the patient can grant access.": "Only the patient can share their vitals.",
  "Only the patient can revoke access.": "Only the patient can stop sharing their vitals.",
};

export function vitalAccessMessage(error: unknown, fallback: (e: unknown) => string): string {
  if (error instanceof ApiError && error.detail && BY_DETAIL[error.detail]) return BY_DETAIL[error.detail];
  return fallback(error);
}

export const SHARE_WARNING = (name: string) => `${name} will be able to see and add to your vitals until you stop sharing.`;
export const STOPPED_NOTICE = (name: string) =>
  `You've stopped sharing with ${name}. It took effect straight away. They can still see your vitals while a visit of theirs with you is in progress.`;
