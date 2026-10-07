/**
 * Decides which part of the app the caregiver sees. Pure, so the whole decision table is unit tested.
 *
 *   session restoring                    -> loading
 *   signed out                           -> signedOut (onboarding / login / register)
 *   signed in, /auth/me or status loading -> loading
 *   signed in, a request failed          -> error (retry / sign out)
 *   not a caregiver account              -> wrongAccount
 *   email not verified                   -> verifyEmail
 *   profile_status incomplete            -> setup (resume at the right step)
 *   under_review / changes_requested / rejected / suspended -> status
 *   approved                             -> app
 */
import type { SessionStatus } from "../auth/session";
import type { ProfileStatus, VerificationStatus } from "../services/caregiver.service";

export type SetupRoute = "CaregiverSetupStep1" | "CaregiverSetupStep2" | "ConsentScreen";

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
}

export function setupRouteFor(completionStep: number): SetupRoute {
  if (completionStep <= 0) return "CaregiverSetupStep1";
  if (completionStep === 1) return "CaregiverSetupStep2";
  return "ConsentScreen";
}

export function resolveGate({ session, me, status }: GateInput): Gate {
  if (session === "restoring") return { kind: "loading" };
  if (session === "signedOut") return { kind: "signedOut" };

  // A failed background refetch keeps the data it already has; only a first load can fail the gate.
  if (!me.data) return me.isError ? { kind: "error" } : { kind: "loading" };
  if (me.data.user_type !== "caregiver") return { kind: "wrongAccount" };
  if (!me.data.is_verified) return { kind: "verifyEmail", email: me.data.email ?? "" };
  if (!status.data) return status.isError ? { kind: "error" } : { kind: "loading" };

  switch (status.data.profileStatus) {
    case "incomplete":
      return { kind: "setup", initialRoute: setupRouteFor(status.data.profileCompletionStep) };
    case "approved":
      return { kind: "app" };
    default:
      return { kind: "status", status: status.data.profileStatus };
  }
}
