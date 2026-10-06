/**
 * Admin auth contract (backend work package A0).
 *
 * Wire types come from the generated schema (`@oakly/api-client`, `pnpm api:sync`); nothing here
 * restates a shape the schema already types. What remains is hand-written because the schema cannot
 * express it, and each item says why. Shapes and strings were confirmed against the backend's
 * live-captured guide (`docs/fe-integration-guide-admin.md`).
 */
import type { Schemas } from "@oakly/api-client";

export const ADMIN_AUTH_PATHS = {
  login: "/api/v1/admin/auth/login",
  mfaVerify: "/api/v1/admin/auth/mfa/verify",
  refresh: "/api/v1/admin/auth/refresh",
  logout: "/api/v1/admin/auth/logout",
  inviteAccept: "/api/v1/admin/auth/invite/accept",
} as const;

export type AdminProfile = Schemas["AdminOut"];
export type LoginRequest = Schemas["LoginIn"];
export type MfaVerifyRequest = Schemas["MfaVerifyIn"];
/** `mfa/verify` response. Only this response carries `admin`. */
export type MfaVerifyResponse = Schemas["MfaVerifyOut"];
/** `refresh` response: a new pair and nothing else (no `admin`). */
export type RefreshResponse = Schemas["TokenPairOut"];
export type AdminUserRow = Schemas["AdminListItem"];
export type AdminStatus = AdminUserRow["status"];
export type InviteAdminRequest = Schemas["AdminInviteIn"];
/** `201` of the invite call: the only response that carries `invite_token`. */
export type InviteAdminResponse = Schemas["AdminInviteOut"];
export type PatchAdminRequest = Schemas["AdminPatchIn"];
export type InviteAcceptRequest = Schemas["InviteAcceptIn"];

/**
 * What our own BFF routes return to the browser. HAND-WRITTEN: the BFF is this app, not the
 * backend, so it is not in the schema. It never includes the refresh token. `admin` is present only
 * after `mfa/verify`; after a refresh the console reads `GET /admin/me`.
 */
export interface RefreshedSession {
  access_token: string;
  expires_in: number;
}
export interface SignInSession extends RefreshedSession {
  admin: AdminProfile;
}

/**
 * HAND-WRITTEN narrowing. The schema types `LoginOut` as one object with every field optional
 * (the backend omits the keys of the other shape). The guide says to branch on which key is present.
 */
export type LoginResponse =
  | { kind: "mfa"; mfaToken: string }
  | { kind: "enroll"; mfaToken: string; otpauthUri: string; secret: string };

export function classifyLogin(out: Schemas["LoginOut"]): LoginResponse | null {
  if (out.mfa_enrollment_required && out.otpauth_uri && out.secret) {
    return { kind: "enroll", mfaToken: out.mfa_token, otpauthUri: out.otpauth_uri, secret: out.secret };
  }
  if (out.mfa_required) return { kind: "mfa", mfaToken: out.mfa_token };
  return null;
}

/** Exact `detail` strings the console branches on (guide sections 3.2, 3.4, 7.2). */
export const AUTH_DETAIL = {
  /** `mfa/verify` 401 for a spent, expired or malformed `mfa_token`: restart at the password step. */
  mfaTokenInvalid: "Invalid or expired MFA token",
} as const;

/**
 * HAND-WRITTEN: the schema types roles as `string[]` and there is no "list roles" endpoint, so the
 * keys and display names are copied from the guide, section 10. Gate on `permissions`, not on these.
 */
export const ADMIN_ROLES: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: "super_admin", label: "Super Admin" },
  { slug: "operations", label: "Operations" },
  { slug: "verification", label: "Verification" },
  { slug: "finance", label: "Finance" },
  { slug: "support", label: "Support" },
  { slug: "clinical_reviewer", label: "Clinical Reviewer" },
  { slug: "read_only_analyst", label: "Read-only Analyst" },
];

/**
 * HAND-WRITTEN: the schema types permissions as `string[]`. This is the full set from the backend's
 * `app/core/admin_permissions.py`; a test checks that every permission the nav asks for is in it.
 */
export const KNOWN_PERMISSIONS: ReadonlySet<string> = new Set([
  "dashboard.read",
  "caregivers.read",
  "caregivers.approve",
  "caregivers.suspend",
  "documents.read",
  "bookings.read",
  "bookings.dispatch",
  "bookings.assign",
  "bookings.cancel",
  "bookings.cancel_request",
  "bookings.address",
  "bookings.correct_status",
  "payments.read",
  "payments.reconcile",
  "refunds.request",
  "refunds.approve",
  "payouts.execute",
  "ledger.adjust",
  "ledger.adjust_request",
  "people.read",
  "people.pii",
  "people.suspend",
  "clinical.read",
  "pricing.write",
  "pricing.request",
  "settings.write",
  "support.inbox",
  "fallguard.write",
  "prescriptions.manage",
  "whatsapp.read",
  "admins.manage",
  "audit.read",
  "exports.pii",
]);
