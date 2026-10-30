import type { ApplicationDetail, ApplicationList, IdentityAttempt, IdentityBlock } from "@/lib/caregivers";

/**
 * Identity (KYC) fixtures copied from the backend's real captures (admin guide section 12.14,
 * `docs/fe-captures/admin/600-604`). Ids and names are the captures' placeholders.
 */

export const NEEDS_REVIEW_ID = "a212ac96-46e6-4803-9b1f-aab0cdf66b63";
export const OTHER_CAREGIVER_ID = "7c1a82d1-923e-4fc4-860a-d308103f87f2";

/** 601-a: needs review, same ID number as another caregiver. */
export const IDENTITY_DUPLICATE: IdentityBlock = {
  status: "needs_review",
  review_reason: "duplicate_identity",
  attempts_used: 1,
  attempts_max: 3,
  can_reset: false,
  attempts: [
    {
      id: "afd4a984-4d91-4393-a40e-7ee35f6b0d2e",
      attempt_no: 1,
      status: "needs_review",
      created_at: "2026-10-29T13:53:07.157428",
      started_at: null,
      completed_at: "2026-10-27T10:01:30",
      id_type: "nin",
      face_confidence: 92.0,
      liveness_confidence: 90.0,
      face_threshold: 85,
      name_match: true,
      dob_match: true,
      reason_codes: ["duplicate_identity"],
      provider_reference: null,
      decided_via: "provider",
    },
  ],
  duplicate_of_caregiver_id: OTHER_CAREGIVER_ID,
};

/** 601-b: name mismatch. */
export const IDENTITY_NAME_MISMATCH: IdentityBlock = {
  status: "needs_review",
  review_reason: "name_mismatch",
  attempts_used: 1,
  attempts_max: 3,
  can_reset: false,
  attempts: [
    {
      id: "48f2105f-3e36-45a9-8e66-04ef2b63776e",
      attempt_no: 1,
      status: "needs_review",
      created_at: "2026-10-29T13:53:07.436913",
      started_at: null,
      completed_at: "2026-10-27T10:01:30",
      id_type: "bvn",
      face_confidence: 92.0,
      liveness_confidence: 90.0,
      face_threshold: 85,
      name_match: false,
      dob_match: true,
      reason_codes: ["name_mismatch"],
      provider_reference: null,
      decided_via: "provider",
    },
  ],
  duplicate_of_caregiver_id: null,
};

function failedAttempt(id: string, no: number, status: string, reasons: string[]): IdentityAttempt {
  return {
    id,
    attempt_no: no,
    status,
    created_at: "2026-10-29T13:53:08.347538",
    started_at: null,
    completed_at: "2026-10-27T10:01:30",
    id_type: null,
    face_confidence: 20.0,
    liveness_confidence: null,
    face_threshold: 85,
    name_match: null,
    dob_match: null,
    reason_codes: reasons,
    provider_reference: null,
    decided_via: "provider",
  };
}

/** 601-f: three clean failures; `can_reset` is true. Newest first. */
export const IDENTITY_EXHAUSTED: IdentityBlock = {
  status: "needs_review",
  review_reason: "attempts_exhausted",
  attempts_used: 3,
  attempts_max: 3,
  can_reset: true,
  attempts: [
    failedAttempt("d47f1d27-9f42-44cf-bbae-7fd2c08cc55f", 3, "needs_review", ["face_mismatch", "attempts_exhausted"]),
    failedAttempt("29f54eff-3514-4cef-91ff-44a90f0d5352", 2, "failed", ["face_mismatch"]),
    failedAttempt("34b665ac-50f9-46fc-9afd-dd632044fc62", 1, "failed", ["face_mismatch"]),
  ],
  duplicate_of_caregiver_id: null,
};

/** 601-g: has not started. */
export const IDENTITY_NO_ATTEMPTS: IdentityBlock = {
  status: "pending",
  review_reason: null,
  attempts_used: 0,
  attempts_max: 3,
  can_reset: false,
  attempts: [],
  duplicate_of_caregiver_id: null,
};

/** 601-h: an attempt still open after 30 hours. */
export const IDENTITY_STUCK: IdentityBlock = {
  status: "in_progress",
  review_reason: null,
  attempts_used: 1,
  attempts_max: 3,
  can_reset: false,
  attempts: [
    {
      id: "042ad8ee-0c2e-4c92-90e3-3106bb0443b3",
      attempt_no: 1,
      status: "awaiting_result",
      created_at: "2026-10-28T07:53:08.737428",
      started_at: null,
      completed_at: null,
      id_type: null,
      face_confidence: null,
      liveness_confidence: null,
      face_threshold: null,
      name_match: null,
      dob_match: null,
      reason_codes: [],
      provider_reference: null,
      decided_via: null,
    },
  ],
  duplicate_of_caregiver_id: null,
};

/** 601-d: passed. */
export const IDENTITY_PASSED: IdentityBlock = {
  status: "verified",
  review_reason: null,
  attempts_used: 1,
  attempts_max: 3,
  can_reset: false,
  attempts: [
    {
      id: "d8355c78-3968-4907-a65e-a63306a5f363",
      attempt_no: 1,
      status: "passed",
      created_at: "2026-10-29T13:53:06.847127",
      started_at: null,
      completed_at: "2026-10-27T10:01:30",
      id_type: "nin",
      face_confidence: 92.0,
      liveness_confidence: 90.0,
      face_threshold: 85,
      name_match: true,
      dob_match: true,
      reason_codes: [],
      provider_reference: null,
      decided_via: "provider",
    },
  ],
  duplicate_of_caregiver_id: null,
};

/** An admin failed the caregiver (shape of 602-g): a reset is the usual next step. */
export const IDENTITY_FAILED: IdentityBlock = {
  ...IDENTITY_EXHAUSTED,
  status: "failed",
  review_reason: null,
  can_reset: true,
};

/** 601-a's detail with the identity block swapped in. */
export function detailWith(identity: IdentityBlock, overrides: Partial<ApplicationDetail["profile"]> = {}): ApplicationDetail {
  return {
    profile: {
      id: NEEDS_REVIEW_ID,
      email: "caregiver-3720394287@example.com",
      full_name: "Placeholder Bola Adeyemi",
      phone_number: "+2348599490659",
      date_of_birth: "1990-04-12",
      gender: null,
      state: "Lagos",
      address: null,
      emergency_contact_phone: null,
      specialization: "nurse",
      years_of_experience: 5,
      preferred_work_hours: null,
      service_areas: null,
      profile_status: "under_review",
      identity_verification_status: identity.status,
      background_check_status: "pending",
      created_at: "2026-10-29T13:53:07.153979",
      ...overrides,
    },
    consents: { terms_accepted: false, privacy_policy_accepted: false, background_check_consent: false, consent_date: null },
    documents: [],
    identity,
    background_check: { status: "pending", evidence: null, decided_by: null, decided_at: null },
    decision: { approved_by: null, approved_at: null, suspended_at: null, suspension_reason: null, rejection_reason: null, changes_requested: null },
    skills: [],
    audit_history: [],
  };
}

/** 600-a: the first row of the needs-review queue, and the counts every response carries. */
export const QUEUE_ROW = {
  id: NEEDS_REVIEW_ID,
  full_name: "Placeholder Bola Adeyemi",
  state: "Lagos",
  specialization: "nurse",
  years_of_experience: 5,
  submitted_at: "2026-10-29T13:53:07.153979",
  age_in_days: 0,
  document_count: 0,
  identity_verification_status: "needs_review",
  background_check_status: "pending",
  profile_status: "under_review",
} as const;

export function queue(items: ApplicationList["items"], counts = { needs_review_count: 4, stuck_count: 1 }): ApplicationList {
  return { items, total: items.length, limit: 25, offset: 0, ...counts };
}

/** 409 bodies, verbatim from captures 602-k and 603-c / 603-k. */
export const CASE_CHANGED_BODY = {
  detail: {
    message: "The identity case changed since you opened it. Reload and decide again",
    unmet: [{ code: "IDENTITY_CASE_CHANGED", message: "Identity is now needs_review" }],
  },
};
export const RESET_NOT_ALLOWED_BODY = {
  detail: {
    message: "Identity can only be reset when it has failed or its attempts ran out",
    unmet: [{ code: "IDENTITY_RESET_NOT_ALLOWED", message: "Identity is verified" }],
  },
};
