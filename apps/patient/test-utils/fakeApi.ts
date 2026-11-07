/**
 * A tiny fake backend for tests. Bodies mirror the generated api-client types (`Schemas`), with obviously fake
 * placeholder values; none of this is a captured response.
 */
import type { Schemas } from "@oakly/api-client";

export type FakeUser = Schemas["UserWithTypeData"];

export const patientUser: FakeUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "ada.placeholder@example.com",
  phone_number: null,
  full_name: "Ada Placeholder",
  user_type: "patient",
  profile_image_url: null,
  is_active: true,
  is_verified: true,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
  patient: null,
  caregiver: null,
};

export const caregiverUser: FakeUser = { ...patientUser, user_type: "caregiver", full_name: "Cora Placeholder" };

export const tokens = { access_token: "access-1", refresh_token: "refresh-1", token_type: "bearer" };

export interface RecordedCall {
  method: string;
  path: string;
  authorization: string | null;
  body: unknown;
}

type Handler = (call: RecordedCall) => { status: number; body?: unknown } | Promise<{ status: number; body?: unknown }>;

/** Routes the global fetch mock by "METHOD /path". Returns the list of calls it has served. */
export function routeFetch(routes: Record<string, Handler>): RecordedCall[] {
  const calls: RecordedCall[] = [];
  (globalThis.fetch as jest.Mock).mockImplementation(async (input: Request) => {
    const url = new URL(input.url);
    const text = await input.clone().text();
    const call: RecordedCall = {
      method: input.method,
      path: url.pathname,
      authorization: input.headers.get("Authorization"),
      body: text ? JSON.parse(text) : null,
    };
    calls.push(call);
    const handler = routes[`${call.method} ${call.path}`];
    if (!handler) throw new TypeError(`unrouted ${call.method} ${call.path}`);
    const { status, body } = await handler(call);
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  return calls;
}

/**
 * React Query keeps a 5-minute gc timer per finished mutation and per unobserved query, and `queryClient.clear()` does
 * not cancel the ones whose observer is still mounted (sign-out clears the cache under a mounted screen), so any test
 * that signs out would keep the jest worker alive. Call once per test file; the app's own defaults are untouched.
 */
export function disableCacheGcForTests(client: import("@tanstack/react-query").QueryClient): void {
  const defaults = client.getDefaultOptions();
  client.setDefaultOptions({
    queries: { ...defaults.queries, gcTime: Infinity },
    mutations: { ...defaults.mutations, gcTime: Infinity },
  });
}
