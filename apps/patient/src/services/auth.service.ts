import type { Schemas } from "@oakly/api-client";

import { api } from "@/src/api/client";
import { ApiError } from "@/src/api/errors";
import { queryKeys } from "@/src/api/keys";
import { queryClient } from "@/src/api/queryClient";
import { unwrap } from "@/src/api/unwrap";
import { session } from "@/src/auth";
import { forgetPushToken } from "@/src/push/forget";

export type User = Schemas["UserWithTypeData"];

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
}

export const authService = {
  /**
   * Always registers a patient account. The backend sends the 5-digit verification email itself; the answer carries
   * no tokens, so the person verifies first and then signs in. Duplicate email is a 400 ("A user with this email
   * already exists"), a malformed body a 422.
   */
  register(input: RegisterInput) {
    return unwrap(
      api.POST("/api/v1/auth/register", {
        body: { email: input.email, password: input.password, full_name: input.fullName, user_type: "patient" },
      }),
    );
  },

  /** `code` is the 5 digits from the email. 400 "Invalid verification code" for a wrong or expired one. */
  verifyEmail(email: string, code: string) {
    return unwrap(api.POST("/api/v1/auth/verify-email", { body: { email, code } }));
  },

  /** A new code replaces the old one. 400 "Email already verified", 404 "User not found". */
  resendVerification(email: string) {
    return unwrap(api.POST("/api/v1/auth/resend-verification", { body: { email } }));
  },

  /** Answers 200 with the same body whether or not the email has an account, so the screen never says which. */
  requestPasswordReset(email: string) {
    return unwrap(api.POST("/api/v1/auth/password-recovery", { body: { email } }));
  },

  /**
   * THE ONE PLACE the reset submit lives. The reset screen collects a 5-digit `code`, but today's endpoint still
   * takes the long token from the emailed link (`{ token, new_password }`), so the code is sent as the token and a
   * 5-digit code is refused with 400 "Invalid token" until the backend reset-by-code slice lands. When it does, only
   * this function changes (new route or body); the screen, its tests' call sites and the SOP note follow.
   */
  resetPassword({ code, newPassword }: { code: string; newPassword: string }) {
    return unwrap(api.POST("/api/v1/auth/reset-password", { body: { token: code, new_password: newPassword } }));
  },

  /**
   * POST /auth/change-password. The backend ends every session issued before the change, this device's included, and
   * answers with a NEW token pair: it is stored here at once, so the person stays signed in (other devices are signed out).
   * 400 `detail = { code, message }` for `wrong_current_password` / `weak_password` / `same_password`; 429
   * `too_many_attempts` with `Retry-After`.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const tokens = await unwrap(
      api.POST("/api/v1/auth/change-password", { body: { current_password: currentPassword, new_password: newPassword } }),
    );
    await session.signIn({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
  },

  /**
   * PUT /auth/profile, then a fresh GET /auth/me. The PUT answers with the flat profile, which has NO `patient` object:
   * storing it as the user (what the old app did) dropped `user.patient`, and every vitals call lost the patient id.
   * The re-read is what goes into the cache. Returns the fresh user so the caller can check what was really saved.
   * The backend ignores blank values and does not persist `full_name` / `phone_number` today (see the SOP).
   */
  async updateProfile(fields: Schemas["UserProfileUpdate"]): Promise<User> {
    await unwrap(api.PUT("/api/v1/auth/profile", { body: fields }));
    const fresh = await authService.getMe();
    queryClient.setQueryData(queryKeys.me, fresh);
    return fresh;
  },

  getMe() {
    return unwrap(api.GET("/api/v1/auth/me"));
  },

  /**
   * Normal email + password sign-in. The new token is used for one GET /auth/me BEFORE the session is
   * opened: a non-patient account is refused without ever being signed in, so the Login screen stays
   * mounted and can show why (opening the session first swaps the screen out from under the error).
   */
  async login(email: string, password: string): Promise<User> {
    const tokens = await unwrap(api.POST("/api/v1/auth/login/mobile", { body: { email_or_phone: email, password } }));
    const user = await unwrap(
      api.GET("/api/v1/auth/me", { headers: { Authorization: `Bearer ${tokens.access_token}` } }),
    );
    if (user.user_type !== "patient") {
      const message = "This app is for patients and families. Please use the Oakly app for your account type.";
      throw new ApiError(403, { detail: message }, message);
    }
    queryClient.setQueryData(queryKeys.me, user);
    await session.signIn({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
    return user;
  },

  /**
   * DELETE /auth/profile: the backend erases the person's data and refuses with 409 and a plain-language `detail`
   * while bookings or money are still open (shown as sent). The session is cleared only after the delete succeeded,
   * so a refusal leaves the person signed in. The push token is forgotten first, while the account still exists.
   */
  async deleteAccount(): Promise<void> {
    await forgetPushToken();
    await unwrap(api.DELETE("/api/v1/auth/profile"));
    await session.signOut();
  },

  /**
   * Logs out: first (best effort, never blocking) tells the server to stop pushing to this device, then clears the
   * keychain tokens, the in-memory session and every cached query (the session's `onSignedOut` hook clears the query
   * cache). No server-side logout route exists today.
   */
  async logout(): Promise<void> {
    await forgetPushToken();
    await session.signOut();
  },
};
