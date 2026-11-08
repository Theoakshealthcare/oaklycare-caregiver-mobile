import type { Schemas } from "@oakly/api-client";

import { api } from "@/src/api/client";
import { appendPickedFile } from "@/src/api/filePart";
import { unwrap } from "@/src/api/unwrap";
import { markProfileEdited } from "@/src/onboarding/reviewEdits";

export type CaregiverProfile = Schemas["CaregiverProfile"];
export type CaregiverProfileStep1 = Schemas["CaregiverProfileStep1"];
export type CaregiverProfileStep2 = Schemas["CaregiverProfileStep2"];
export type CaregiverConsent = Schemas["CaregiverConsentData"];
export type DocumentUploadResponse = Schemas["DocumentUploadResponse"];

/** `profile_status` state machine (backend guide, section 4). */
export type ProfileStatus =
  | "incomplete"
  | "under_review"
  | "changes_requested"
  | "rejected"
  | "approved"
  | "suspended";

const PROFILE_STATUSES: readonly ProfileStatus[] = [
  "incomplete",
  "under_review",
  "changes_requested",
  "rejected",
  "approved",
  "suspended",
];

export interface ChangesRequested {
  items: string[];
  note: string | null;
}

/**
 * GET /caregiver/verification-status. The OpenAPI schema types this response as a free-form object
 * (backend gap, see the SOP follow-ups), so it is narrowed here at the boundary from the shape the
 * backend guide captured. `rejection_reason` and `changes_requested` are always present, null unless
 * they apply.
 */
export interface VerificationStatus {
  profileStatus: ProfileStatus;
  profileCompletionStep: number;
  identityVerificationStatus: string;
  backgroundCheckStatus: string;
  rejectionReason: string | null;
  changesRequested: ChangesRequested | null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function parseVerificationStatus(raw: unknown): VerificationStatus {
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const status = PROFILE_STATUSES.find((s) => s === body.profile_status);
  if (!status) {
    throw new Error(`Unexpected profile_status: ${String(body.profile_status)}`);
  }
  let changesRequested: ChangesRequested | null = null;
  const cr = body.changes_requested;
  if (cr && typeof cr === "object") {
    const items = (cr as { items?: unknown }).items;
    changesRequested = {
      items: Array.isArray(items) ? items.filter((i): i is string => typeof i === "string") : [],
      note: asString((cr as { note?: unknown }).note),
    };
  }
  return {
    profileStatus: status,
    profileCompletionStep: typeof body.profile_completion_step === "number" ? body.profile_completion_step : 0,
    identityVerificationStatus: asString(body.identity_verification_status) ?? "pending",
    backgroundCheckStatus: asString(body.background_check_status) ?? "pending",
    rejectionReason: asString(body.rejection_reason),
    changesRequested,
  };
}

/** GET /caregiver/form-options (untyped in the schema; shape from the backend guide capture 013). */
export interface FormOptions {
  specializations: string[];
  service_areas: string[];
  work_hours: string[];
  states: string[];
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function parseFormOptions(raw: unknown): FormOptions {
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    specializations: stringList(body.specializations),
    service_areas: stringList(body.service_areas),
    work_hours: stringList(body.work_hours),
    states: stringList(body.states),
  };
}

/** A picked file as expo-document-picker reports it. */
export interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string | null;
}

export const caregiverService = {
  getProfile() {
    return unwrap(api.GET("/api/v1/caregiver/profile"));
  },

  async updateProfileStep1(data: CaregiverProfileStep1) {
    const result = await unwrap(api.PUT("/api/v1/caregiver/profile/step1", { body: data }));
    markProfileEdited();
    return result;
  },

  async updateProfileStep2(data: CaregiverProfileStep2) {
    const result = await unwrap(api.PUT("/api/v1/caregiver/profile/step2", { body: data }));
    markProfileEdited();
    return result;
  },

  /**
   * Multipart upload, sent by the client's plain-`fetch` multipart path (never `api.POST`, whose
   * `Request` wrapper cannot carry a React Native file part: DP1-02). React Native's FormData takes
   * `{ uri, name, type }` for a file. Content-Type is deliberately NOT set: fetch adds
   * `multipart/form-data` with the boundary (a hand-written header would omit it).
   */
  async uploadDocument(file: PickedFile, documentType: string) {
    const result = await unwrap(
      api.uploadMultipart<DocumentUploadResponse>("/api/v1/caregiver/documents/upload", buildDocumentForm(file, documentType)),
    );
    markProfileEdited();
    return result;
  },

  /** Submits consent, which moves `incomplete` and `changes_requested` to `under_review`. */
  updateConsent(data: CaregiverConsent = ALL_CONSENTS) {
    return unwrap(api.PUT("/api/v1/caregiver/consent", { body: data }));
  },

  async getVerificationStatus(): Promise<VerificationStatus> {
    return parseVerificationStatus(await unwrap(api.GET("/api/v1/caregiver/verification-status")));
  },

  async getFormOptions(): Promise<FormOptions> {
    return parseFormOptions(await unwrap(api.GET("/api/v1/caregiver/form-options")));
  },
};

export const ALL_CONSENTS: CaregiverConsent = {
  terms_accepted: true,
  privacy_policy_accepted: true,
  background_check_consent: true,
};

export function buildDocumentForm(file: PickedFile, documentType: string): FormData {
  const form = new FormData();
  form.append("document_type", documentType);
  appendPickedFile(form, "file", { uri: file.uri, name: file.name, type: file.mimeType ?? "application/octet-stream" });
  return form;
}
