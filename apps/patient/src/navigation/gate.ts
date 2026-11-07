/**
 * Decides which part of the app the user sees. Pure, so the whole decision table is unit tested.
 *
 *   session restoring                     -> loading
 *   signed out                            -> signedOut (login)
 *   signed in, /auth/me loading           -> loading
 *   signed in, /auth/me failed (first load) -> error (retry / sign out)
 *   not a patient account                 -> wrongAccount
 *   email not verified                    -> verifyEmail (placeholder until the verify screen is ported)
 *   otherwise                             -> app
 */
import type { SessionStatus } from "../auth/session";

export type Gate =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "signedOut" }
  | { kind: "wrongAccount" }
  | { kind: "verifyEmail"; email: string }
  | { kind: "app" };

interface QueryLike<T> {
  data: T | undefined;
  isError: boolean;
}

export interface GateInput {
  session: SessionStatus;
  me: QueryLike<{ user_type: string; is_verified: boolean; email?: string | null }>;
}

export function resolveGate({ session, me }: GateInput): Gate {
  if (session === "restoring") return { kind: "loading" };
  if (session === "signedOut") return { kind: "signedOut" };

  // A failed background refetch keeps the data it already has; only a first load can fail the gate.
  if (!me.data) return me.isError ? { kind: "error" } : { kind: "loading" };
  if (me.data.user_type !== "patient") return { kind: "wrongAccount" };
  if (!me.data.is_verified) return { kind: "verifyEmail", email: me.data.email ?? "" };
  return { kind: "app" };
}
