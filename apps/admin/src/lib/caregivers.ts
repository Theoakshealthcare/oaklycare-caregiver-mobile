import type { Schemas } from "@oakly/api-client";

import { ApiError, getApi, unwrap } from "./api";

/**
 * Caregiver applications API. Request bodies use the generated schema types. The generated
 * response types for these routes are `unknown` (the backend returns plain dicts), so the response
 * shapes below are written from `app/services/caregiver_approval.py` (`list_applications`,
 * `get_detail`) and the approval SOP. TODO: replace once the backend declares response models.
 */

export type ProfileStatus =
  | "incomplete"
  | "under_review"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "suspended";

export const PROFILE_STATUSES: ProfileStatus[] = [
  "under_review",
  "changes_requested",
  "approved",
  "suspended",
  "rejected",
  "incomplete",
];

export interface ApplicationRow {
  id: string;
  full_name: string;
  state: string | null;
  specialization: string | null;
  years_of_experience: number | null;
  submitted_at: string | null;
  age_in_days: number | null;
  document_count: number;
  identity_verification_status: string;
  background_check_status: string;
  profile_status: ProfileStatus;
}

export interface ApplicationList {
  items: ApplicationRow[];
  total: number;
  limit: number;
  offset: number;
  /** Badge counts: per profile-status tab and independent of the `identity` filter (K5). */
  needs_review_count: number;
  stuck_count: number;
}

/** The `identity` query filter on the queue; `null` means everyone on the tab. */
export type IdentityFilter = "needs_review" | "stuck" | "failed";
export const IDENTITY_FILTERS: IdentityFilter[] = ["needs_review", "stuck", "failed"];

export type IdentityBlock = Schemas["IdentityOut"];
export type IdentityAttempt = Schemas["IdentityAttemptOut"];

export interface DocumentRow {
  id: string;
  document_type: string;
  document_name: string;
  mime_type: string | null;
  file_size: number | null;
  verification_status: string;
  rejection_reason: string | null;
  expires_on: string | null;
  uploaded_at: string | null;
  verified_at: string | null;
  reviewed_by: string | null;
  download_url: string;
}

/** A role as an admin reads it ("nurse" -> "Nurse"). */
export function roleLabel(serviceType: string): string {
  return serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
}

export interface SkillRow {
  service_type: Schemas["SkillIn"]["service_type"];
  sub_specialty: string | null;
}

export interface AuditEntry {
  id: string;
  action: string;
  admin_user_id: string | null;
  entity_type: string;
  entity_id: string;
  reason: string | null;
  created_at: string;
}

export interface ApplicationDetail {
  profile: {
    id: string;
    email: string;
    full_name: string;
    phone_number: string | null;
    date_of_birth: string | null;
    gender: string | null;
    state: string | null;
    address: string | null;
    emergency_contact_phone: string | null;
    specialization: string | null;
    years_of_experience: number | null;
    preferred_work_hours: string | null;
    service_areas: string[] | null;
    profile_status: ProfileStatus;
    identity_verification_status: string;
    background_check_status: string;
    created_at: string;
  };
  consents: {
    terms_accepted: boolean;
    privacy_policy_accepted: boolean;
    background_check_consent: boolean;
    consent_date: string | null;
  };
  documents: DocumentRow[];
  identity: IdentityBlock;
  background_check: {
    status: string;
    evidence: unknown;
    decided_by: string | null;
    decided_at: string | null;
  };
  decision: {
    approved_by: string | null;
    approved_at: string | null;
    suspended_at: string | null;
    suspension_reason: string | null;
    rejection_reason: string | null;
    changes_requested: unknown;
  };
  skills: SkillRow[];
  /** What the caregiver asked for ("I apply as"): a request only, `[]` when none. Only `skills` are confirmed. */
  requested_skills: SkillRow["service_type"][];
  audit_history: AuditEntry[];
}

export interface Unmet {
  code: string;
  message: string;
}

/** The 409 from approve/reinstate, and from the identity routes (`IDENTITY_CASE_CHANGED`, `IDENTITY_RESET_NOT_ALLOWED`): `{"detail": {"message", "unmet": [{"code","message"}]}}`. */
export function unmetFromError(error: unknown): { message: string; unmet: Unmet[] } | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const detail = (error.body as { detail?: unknown } | null)?.detail;
  if (!detail || typeof detail !== "object") return null;
  const { message, unmet } = detail as { message?: unknown; unmet?: unknown };
  if (!Array.isArray(unmet) || unmet.length === 0) return null;
  return {
    message: typeof message === "string" ? message : "This can't be done yet.",
    unmet: unmet.filter((u): u is Unmet => !!u && typeof (u as Unmet).message === "string"),
  };
}

export async function listApplications(
  profile_status: ProfileStatus,
  limit: number,
  offset: number,
  identity: IdentityFilter | null = null,
): Promise<ApplicationList> {
  const result = await getApi().GET("/api/v1/admin/caregivers", {
    params: { query: { profile_status, limit, offset, ...(identity ? { identity } : {}) } },
  });
  return unwrap(result) as ApplicationList;
}

export async function getApplication(id: string): Promise<ApplicationDetail> {
  const result = await getApi().GET("/api/v1/admin/caregivers/{caregiver_id}", {
    params: { path: { caregiver_id: id } },
  });
  return unwrap(result) as ApplicationDetail;
}

export async function decideDocument(docId: string, body: Schemas["DocumentDecision"]) {
  return unwrap(
    await getApi().POST("/api/v1/admin/caregivers/documents/{doc_id}/decision", {
      params: { path: { doc_id: docId } },
      body,
    }),
  );
}

export async function decideIdentity(id: string, body: Schemas["IdentityDecision"]) {
  return unwrap(
    await getApi().POST("/api/v1/admin/caregivers/{caregiver_id}/identity-decision", {
      params: { path: { caregiver_id: id } },
      body,
    }),
  );
}

export async function resetIdentity(id: string, body: Schemas["IdentityReset"]) {
  return unwrap(
    await getApi().POST("/api/v1/admin/caregivers/{caregiver_id}/identity-reset", {
      params: { path: { caregiver_id: id } },
      body,
    }),
  ) as { attempts_used: number; attempts_max: number } | null;
}

export async function decideBackgroundCheck(id: string, body: Schemas["BackgroundCheckDecision"]) {
  return unwrap(
    await getApi().POST("/api/v1/admin/caregivers/{caregiver_id}/background-check-decision", {
      params: { path: { caregiver_id: id } },
      body,
    }),
  );
}

export async function saveSkills(id: string, skills: Schemas["SkillIn"][]) {
  return unwrap(
    await getApi().PUT("/api/v1/admin/caregivers/{caregiver_id}/skills", {
      params: { path: { caregiver_id: id } },
      body: { skills },
    }),
  );
}

export async function approveCaregiver(id: string) {
  return unwrap(
    await getApi().POST("/api/v1/admin/caregivers/{caregiver_id}/approve", {
      params: { path: { caregiver_id: id } },
    }),
  );
}

export async function rejectCaregiver(id: string, reason: string) {
  return unwrap(
    await getApi().POST("/api/v1/admin/caregivers/{caregiver_id}/reject", {
      params: { path: { caregiver_id: id } },
      body: { reason },
    }),
  );
}

export async function requestChanges(id: string, items: string[], note: string) {
  return unwrap(
    await getApi().POST("/api/v1/admin/caregivers/{caregiver_id}/request-changes", {
      params: { path: { caregiver_id: id } },
      body: { items, note },
    }),
  );
}

export async function suspendCaregiver(id: string, reason: string) {
  return unwrap(
    await getApi().POST("/api/v1/admin/caregivers/{caregiver_id}/suspend", {
      params: { path: { caregiver_id: id } },
      body: { reason },
    }),
  );
}

export async function reinstateCaregiver(id: string) {
  return unwrap(
    await getApi().POST("/api/v1/admin/caregivers/{caregiver_id}/reinstate", {
      params: { path: { caregiver_id: id } },
    }),
  );
}

/** Fetch a document through the authorized download route and return a blob for inline viewing. */
export async function fetchDocumentBlob(documentId: string): Promise<Blob> {
  const result = await getApi().GET("/api/v1/caregiver/documents/{document_id}/file", {
    params: { path: { document_id: documentId } },
    parseAs: "blob",
  });
  return unwrap(result) as Blob;
}
