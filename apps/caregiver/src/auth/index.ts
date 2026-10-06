import { createOaklyClient } from "@oakly/api-client";
import { useStore } from "zustand";

import { API_BASE_URL } from "@/src/api/config";
import { queryClient } from "@/src/api/queryClient";

import { secureTokenStorage } from "./secureStorage";
import { createSession, type SessionState, type SessionTokens } from "./session";

// The refresh call is unauthenticated, so it uses its own client with no bearer and no retry hook.
const refreshClient = createOaklyClient({ baseUrl: API_BASE_URL, getAccessToken: () => null });

async function refreshRequest(refreshToken: string): Promise<SessionTokens | null> {
  // Rejects on network failure (the session must survive being offline).
  const { data, response } = await refreshClient.POST("/api/v1/auth/refresh", {
    body: { refresh_token: refreshToken },
  });
  if (data) return { accessToken: data.access_token, refreshToken: data.refresh_token };
  // 401 "Invalid refresh token" (or any other 4xx): the server rejected it. A 5xx is an outage,
  // not a verdict on the token, so it throws and the session is kept.
  if (response.status >= 400 && response.status < 500) return null;
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
