import type { Schemas } from "@oakly/api-client";

import { api } from "@/src/api/client";
import { appendPickedFile } from "@/src/api/filePart";
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

  /**
   * Emails a 5-digit code (valid 15 minutes, once). Answers 200 with the same body whether or not the email has an account,
   * is over its 3-an-hour limit, or the mail server is down, so the screen never says which.
   */
  requestPasswordReset(email: string) {
    return unwrap(api.POST("/api/v1/auth/password-recovery", { body: { email } }));
  },

  /**
   * POST /auth/reset-password with the emailed 5-digit code. `email` must be the exact string used to ask for the code
   * (the counters and the lookup are per exact address). No tokens come back: the person signs in afterwards, and every
   * other session of the account is ended. Refusals are `detail = { code, message }` (see `domain/passwordReset.ts`).
   */
  resetPassword({ email, code, newPassword }: { email: string; code: string; newPassword: string }) {
    return unwrap(api.POST("/api/v1/auth/reset-password", { body: { email, code, new_password: newPassword } }));
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
   * The backend now saves `full_name` and `phone_number` (trimmed, phone without separators); refusals are read by `profileRefusal`.
   */
  async updateProfile(fields: Schemas["UserProfileUpdate"]): Promise<User> {
    await unwrap(api.PUT("/api/v1/auth/profile", { body: fields }));
    const fresh = await authService.getMe();
    queryClient.setQueryData(queryKeys.me, fresh);
    return fresh;
  },

  /**
   * `POST /auth/profile/upload-image` (multipart, field `file`): the only way to set the photo (`PUT /auth/profile` can only clear it).
   * Answers `{ profile_image_url }`; `/auth/me` is read again so every screen shows the new photo. The multipart call goes through the
   * client's plain-fetch path (openapi-fetch's Request wrapper cannot carry a file part).
   */
  async uploadProfileImage(image: { uri: string; fileName?: string | null; mimeType?: string | null }): Promise<string | null> {
    const form = new FormData();
    appendPickedFile(form, "file", { uri: image.uri, name: image.fileName ?? "profile.jpg", type: image.mimeType ?? "image/jpeg" });
    const raw: unknown = await unwrap(api.uploadMultipart("/api/v1/auth/profile/upload-image", form));
    queryClient.setQueryData(queryKeys.me, await authService.getMe());
    const url = raw && typeof raw === "object" ? (raw as { profile_image_url?: unknown }).profile_image_url : undefined;
    return typeof url === "string" ? url : null;
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
