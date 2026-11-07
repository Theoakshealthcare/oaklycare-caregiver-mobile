/**
 * Decides which part of the app the caregiver sees. Pure, so the whole decision table is unit tested.
 *
 *   session restoring                    -> loading
 *   signed out                           -> signedOut (onboarding / login / register)
 *   signed in, /auth/me or status loading -> loading
 *   signed in, a request failed          -> error (retry / sign out)
 *   not a caregiver account              -> wrongAccount
 *   email not verified                   -> verifyEmail
 *   profile_status incomplete            -> setup (resume at the right step; the identity step sits between
 *                                           Step 2 and Consent while it is switched on, see identity/config.ts)
 *   under_review / changes_requested / rejected / suspended -> status
 *   approved                             -> app
 */
import type { SessionStatus } from "../auth/session";
import type { ProfileStatus, VerificationStatus } from "../services/caregiver.service";

export type SetupRoute = "CaregiverSetupStep1" | "CaregiverSetupStep2" | "IdentityVerification" | "ConsentScreen";

export type Gate =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "signedOut" }
  | { kind: "wrongAccount" }
  | { kind: "verifyEmail"; email: string }
  | { kind: "setup"; initialRoute: SetupRoute }
  | { kind: "status"; status: Exclude<ProfileStatus, "incomplete" | "approved"> }
  | { kind: "app" };

interface QueryLike<T> {
  data: T | undefined;
  isError: boolean;
}

export interface GateInput {
  session: SessionStatus;
  me: QueryLike<{ user_type: string; is_verified: boolean; email?: string | null }>;
  status: QueryLike<VerificationStatus>;
  /** Whether the identity step is part of onboarding (`kycEnabled()`); off keeps Step 2 -> Consent. */
  kycEnabled?: boolean;
}

/**
 * Step 2 done (`completionStep` 2) goes to the identity step; the backend sets step 3 when a result arrives or the
 * caregiver continues during an outage (design 11.3), and 3 and up go to Consent. With the identity step off, Step 2
 * goes straight to Consent, as before.
 */
export function setupRouteFor(completionStep: number, kycEnabled = false): SetupRoute {
  if (completionStep <= 0) return "CaregiverSetupStep1";
  if (completionStep === 1) return "CaregiverSetupStep2";
  if (completionStep === 2 && kycEnabled) return "IdentityVerification";
  return "ConsentScreen";
}

export function resolveGate({ session, me, status, kycEnabled = false }: GateInput): Gate {
  if (session === "restoring") return { kind: "loading" };
  if (session === "signedOut") return { kind: "signedOut" };

  // A failed background refetch keeps the data it already has; only a first load can fail the gate.
  if (!me.data) return me.isError ? { kind: "error" } : { kind: "loading" };
  if (me.data.user_type !== "caregiver") return { kind: "wrongAccount" };
  if (!me.data.is_verified) return { kind: "verifyEmail", email: me.data.email ?? "" };
  if (!status.data) return status.isError ? { kind: "error" } : { kind: "loading" };

  switch (status.data.profileStatus) {
    case "incomplete":
      return { kind: "setup", initialRoute: setupRouteFor(status.data.profileCompletionStep, kycEnabled) };
    case "approved":
      return { kind: "app" };
    default:
      return { kind: "status", status: status.data.profileStatus };
  }
}

/** First screen when signed out: Login for a device that has signed in before, the welcome slides for a new install (DP1-12). */
export function firstSignedOutRoute(returning: boolean): "Login" | "Onboarding" {
  return returning ? "Login" : "Onboarding";
}
