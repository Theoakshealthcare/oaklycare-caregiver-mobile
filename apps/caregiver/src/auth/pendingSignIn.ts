/**
 * The e-mail and password typed on the sign-up form, kept in memory only until the account is verified, so "Set up your
 * Account" on the confirmation page can sign in and go straight on to the setup (Figma) instead of asking for the same
 * password again. Never written to storage, never put in navigation params, and handed out once: a restart, a sign-out
 * or the first `takePendingSignIn()` forgets it. If the sign-in fails the caregiver simply uses the Login screen.
 */
interface PendingSignIn {
  email: string;
  password: string;
}

let pending: PendingSignIn | null = null;

export function rememberPendingSignIn(email: string, password: string): void {
  pending = { email, password };
}

export function takePendingSignIn(): PendingSignIn | null {
  const value = pending;
  pending = null;
  return value;
}

export function forgetPendingSignIn(): void {
  pending = null;
}
