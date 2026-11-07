import { createOaklyClient } from "@oakly/api-client";
import { useStore } from "zustand";

import { API_BASE_URL } from "@/src/api/config";
import { queryClient } from "@/src/api/queryClient";

import { secureTokenStorage } from "./secureStorage";
import { createSession, type SessionState, type SessionTokens } from "./session";

// The refresh call is unauthenticated, so it uses its own client with no bearer and no retry hook.
// That is what makes a 401 on the refresh itself a verdict (sign out) and never a request queued
// behind the refresh that is already running.
const refreshClient = createOaklyClient({ baseUrl: API_BASE_URL, getAccessToken: () => null });

async function refreshRequest(refreshToken: string): Promise<SessionTokens | null> {
  // Rejects on network failure (the session must survive being offline).
  const { data, response } = await refreshClient.POST("/api/v1/auth/refresh", {
    body: { refresh_token: refreshToken },
  });
  if (data) return { accessToken: data.access_token, refreshToken: data.refresh_token };
  // Only 401 ("Invalid refresh token") is a verdict on the token: sign out. Anything else (429,
  // 422, a 5xx outage) throws, so the session is kept and the caller sees the original 401.
  if (response.status === 401) return null;
  throw new Error(`refresh failed with ${response.status}`);
}

export const session = createSession({
  storage: secureTokenStorage,
  refreshRequest,
  onSignedOut: () => queryClient.clear(),
});

export function useSession<T>(selector: (state: SessionState) => T): T {
  return useStore(session.store, selector);
}
