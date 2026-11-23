/**
 * The e-mail and password typed on the sign-up form, kept in memory only until the account is verified, so "Start Booking
 * Journey" on the confirmation page can sign in and go straight on to booking (Figma) instead of asking for the same
 * password again. Never written to storage, never put in navigation params, and handed out once: a restart, a sign-out
 * or the first `takePendingSignIn()` forgets it. If the sign-in fails the person simply uses the Login screen.
 *
 * `wantsBooking` is the other half of "Start Booking Journey": once the app is open, Home reads it once and opens the booking form.
 */
interface PendingSignIn {
  email: string;
  password: string;
}

let pending: PendingSignIn | null = null;
let booking = false;

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

/** Asks Home to open the booking form the next time it shows. */
export function requestBookingStart(): void {
  booking = true;
}

/** True once after `requestBookingStart()`. */
export function takeBookingStart(): boolean {
  const value = booking;
  booking = false;
  return value;
}
