import type { Schemas } from "@oakly/api-client";

import { api } from "@/src/api/client";
import { ApiError } from "@/src/api/errors";
import { queryKeys } from "@/src/api/keys";
import { queryClient } from "@/src/api/queryClient";
import { unwrap } from "@/src/api/unwrap";
import { session } from "@/src/auth";

export type User = Schemas["UserWithTypeData"];

export const authService = {
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
   * Logs out: clears the keychain tokens, the in-memory session and every cached query (the session's
   * `onSignedOut` hook clears the query cache). No server-side logout route exists today.
   */
  async logout(): Promise<void> {
    await session.signOut();
  },
};
