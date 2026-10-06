/**
 * Admin auth contract (backend work package A0).
 *
 * TODO(A0): the backend's A0 is not merged, so these routes are not in `@oakly/api-client`'s
 * generated schema. This file mirrors the plan's contract table
 * (backend `docs/plans/2026-10-06-admin-console.md`, section A0) exactly. Where the table is silent
 * (list shapes, invite response field names, role slugs) the field is marked `GUESS` and parsed
 * leniently. Replace this file with the generated types once A0 lands and the client is synced,
 * and confirm every `GUESS` against the live captures in the backend's FE integration guide.
 */

export const ADMIN_AUTH_PATHS = {
  login: "/api/v1/admin/auth/login",
  mfaVerify: "/api/v1/admin/auth/mfa/verify",
  refresh: "/api/v1/admin/auth/refresh",
  logout: "/api/v1/admin/auth/logout",
  inviteAccept: "/api/v1/admin/auth/invite/accept",
  me: "/api/v1/admin/me",
  admins: "/api/v1/admin/admins",
} as const;

export interface AdminProfile {
  id: string;
  email: string;
  full_name: string;
  roles: string[];
  permissions: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** `200` when the admin already has MFA enrolled. */
export interface LoginMfaRequired {
  mfa_required: true;
  /** 5-minute token, only valid for `/auth/mfa/verify`. */
  mfa_token: string;
}

/** `200` when MFA is not enrolled yet. Enrollment completes on the first successful verify. */
export interface LoginMfaEnrollment {
  mfa_enrollment_required: true;
  mfa_token: string;
  otpauth_uri: string;
  secret: string;
}

export type LoginResponse = LoginMfaRequired | LoginMfaEnrollment;

export interface MfaVerifyRequest {
  mfa_token: string;
  code: string;
}

/** `200` from `/auth/mfa/verify`. */
export interface MfaVerifyResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  /** Seconds. The plan says 900. */
  expires_in: number;
  admin: AdminProfile;
}

/** `/auth/refresh` returns "a new token pair". GUESS: same shape as verify, `admin` may be absent. */
export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type?: "bearer";
  expires_in: number;
  admin?: AdminProfile;
}

/** What our own BFF routes (`/api/auth/*`) return to the browser. Never includes the refresh token. */
export interface SessionResponse {
  access_token: string;
  expires_in: number;
  admin?: AdminProfile;
}

export type AdminStatus = "invited" | "active" | "disabled";

/** GUESS: columns follow the `admin_users` table in the plan; the list response shape is not specified. */
export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string;
  roles: string[];
  status: AdminStatus;
  mfa_enabled?: boolean;
  last_login_at?: string | null;
}

export interface InviteAdminRequest {
  email: string;
  full_name: string;
  roles: string[];
}

export interface PatchAdminRequest {
  roles?: string[];
  status?: AdminStatus;
}

/**
 * GUESS: "returns a single-use invite link token, valid 48 h". The field name is not in the plan.
 * We accept `invite_token`, `token` or the last segment of an `invite_url`/`invite_link`.
 */
export function extractInviteToken(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  for (const key of ["invite_token", "token"]) {
    if (typeof b[key] === "string" && b[key]) return b[key] as string;
  }
  for (const key of ["invite_url", "invite_link", "link"]) {
    const v = b[key];
    if (typeof v === "string" && v) {
      try {
        const u = new URL(v, "http://placeholder.invalid");
        return u.searchParams.get("token") ?? u.searchParams.get("invite_token") ?? v.split("/").pop() ?? null;
      } catch {
        return v;
      }
    }
  }
  return null;
}

/** GUESS: the list may be a bare array or wrapped in `{items}`. */
export function parseAdminList(body: unknown): AdminUserRow[] {
  const raw = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { items?: unknown }).items)
      ? (body as { items: unknown[] }).items
      : [];
  return raw.filter((r): r is AdminUserRow => !!r && typeof r === "object" && "id" in r && "email" in r);
}

/**
 * GUESS: seeded role slugs. The plan names the roles but not their identifiers, and there is no
 * "list roles" endpoint, so the console hardcodes them. Confirm against the A0 seed.
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
