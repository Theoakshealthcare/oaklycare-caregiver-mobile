import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

import { AuthContext, type AuthContextValue } from "@/components/auth-provider";
import type { AdminProfile } from "@/lib/admin-auth-contract";

export function makeAdmin(permissions: string[], overrides: Partial<AdminProfile> = {}): AdminProfile {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    email: "admin@example.test",
    full_name: "Test Admin",
    roles: ["verification"],
    permissions,
    ...overrides,
  };
}

/** Auth context with fixed values, for components that only read `can()` / `admin`. */
export function withAuth(permissions: string[], ui: React.ReactNode, overrides: Partial<AuthContextValue> = {}) {
  const admin = makeAdmin(permissions);
  const value: AuthContextValue = {
    status: "authenticated",
    admin,
    notice: null,
    idleSecondsLeft: null,
    can: (p) => permissions.includes(p),
    signIn: async () => {
      throw new Error("not used");
    },
    completeMfa: async () => {},
    signOut: async () => {},
    staySignedIn: async () => {},
    retryBoot: () => {},
    reloadProfile: async () => {},
    ...overrides,
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={value}>{ui}</AuthContext.Provider>
    </QueryClientProvider>
  );
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}
