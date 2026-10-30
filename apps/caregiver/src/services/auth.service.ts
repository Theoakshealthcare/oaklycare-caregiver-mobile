import type { Schemas } from "@oakly/api-client";

import { api } from "@/src/api/client";
import { ApiError } from "@/src/api/errors";
import { queryKeys } from "@/src/api/keys";
import { queryClient } from "@/src/api/queryClient";
import { unwrap, unwrapEmpty } from "@/src/api/unwrap";
import { session } from "@/src/auth";
import { pushTokenStorage } from "@/src/auth/secureStorage";

export type User = Schemas["UserWithTypeData"];

export interface RegisterInput {
  fullName: string;
  email: string;
  /** Optional, E.164-style (+234...). */
  phoneNumber?: string;
  password: string;
}

export const authService = {
  /** Always registers a caregiver account; the backend creates the caregiver profile too. */
  register(input: RegisterInput) {
    return unwrap(
      api.POST("/api/v1/auth/register", {
        body: {
          email: input.email,
          password: input.password,
          full_name: input.fullName,
          phone_number: input.phoneNumber || undefined,
          user_type: "caregiver",
        },
      }),
    );
  },

  verifyEmail(email: string, code: string) {
    return unwrap(api.POST("/api/v1/auth/verify-email", { body: { email, code } }));
  },

  resendVerification(email: string) {
    return unwrap(api.POST("/api/v1/auth/resend-verification", { body: { email } }));
  },

  requestPasswordReset(email: string) {
    return unwrap(api.POST("/api/v1/auth/password-recovery", { body: { email } }));
  },

  resetPassword(token: string, newPassword: string) {
    return unwrap(api.POST("/api/v1/auth/reset-password", { body: { token, new_password: newPassword } }));
  },

  /**
   * POST /auth/change-password. The backend ends every session issued before the change, this device's included, and
   * answers with a new pair: it is stored here, at once, so the caregiver stays signed in (other devices are signed out).
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const tokens = await unwrap(
      api.POST("/api/v1/auth/change-password", {
        body: { current_password: currentPassword, new_password: newPassword },
      }),
    );
    await session.signIn({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
  },

  getMe() {
    return unwrap(api.GET("/api/v1/auth/me"));
  },

  /**
   * Logs in, stores the tokens and confirms this is a caregiver account. A patient account is
   * signed straight back out: this app is for providers only.
   */
  async login(emailOrPhone: string, password: string): Promise<User> {
    const tokens = await unwrap(
      api.POST("/api/v1/auth/login/mobile", { body: { email_or_phone: emailOrPhone, password } }),
    );
    await session.signIn({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
    let user: User;
    try {
      user = await authService.getMe();
    } catch (error) {
      await session.signOut();
      throw error;
    }
    if (user.user_type !== "caregiver") {
      await session.signOut();
      throw new ApiError(403, { detail: "Access denied. Caregiver account required." }, "Wrong account type");
    }
    queryClient.setQueryData(queryKeys.me, user);
    return user;
  },

  /** Best-effort server-side cleanup, then clears the local session (always). */
  async logout(): Promise<void> {
    await forgetPushToken();
    await session.signOut();
  },

  /**
   * DELETE /auth/profile: the backend deletes the user and their caregiver row for good (no undo, no
   * password check). The push token is forgotten first, while the account still exists; the session
   * is cleared only after the delete succeeded, so a failure leaves the caregiver signed in.
   */
  async deleteAccount(): Promise<void> {
    await forgetPushToken();
    await unwrap(api.DELETE("/api/v1/auth/profile"));
    await session.signOut();
  },
};

async function forgetPushToken(): Promise<void> {
  try {
    // The Expo push token is registered in C4; until then there is nothing to forget.
    const pushToken = await pushTokenStorage.get();
    if (pushToken) {
      await unwrapEmpty(api.DELETE("/api/v1/devices/push-token", { body: { token: pushToken } }));
    }
  } catch {
    // Never block signing out on the network.
  }
}
