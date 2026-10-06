/**
 * Typed client for the Oakly backend.
 *
 * Types come from `schema.d.ts`, generated from the backend's OpenAPI spec (`pnpm api:sync`).
 * A backend change that renames or removes a field breaks the build of every app that uses it.
 *
 *   const api = createOaklyClient({ baseUrl, getAccessToken, onUnauthorized });
 *   const { data, error, response } = await api.GET("/api/v1/auth/me");
 *
 * Errors follow FastAPI's shape: `{ detail: string | object }`. Use `errorMessage()` to show one.
 */
import createClient, { type Middleware } from "openapi-fetch";

import type { components, paths } from "./schema";

export type { components, paths };
export type Schemas = components["schemas"];

export interface OaklyClientOptions {
  /** Server origin, e.g. "https://api.oaklycare.com" (paths already include /api/v1). */
  baseUrl: string;
  /** Current access token, or null when signed out. */
  getAccessToken: () => string | null | Promise<string | null>;
  /**
   * Called once on a 401 for an authenticated request. Return a new access token to retry the
   * request once (e.g. after POST /auth/refresh), or null to give up (sign the user out).
   */
  onUnauthorized?: () => Promise<string | null>;
  fetch?: typeof globalThis.fetch;
}

const RETRIED = "x-oakly-retried";

export function createOaklyClient(options: OaklyClientOptions) {
  const client = createClient<paths>({ baseUrl: options.baseUrl, fetch: options.fetch });
  // Unread clones of authenticated requests, keyed by the request openapi-fetch sends.
  const unread = new WeakMap<Request, Request>();

  const auth: Middleware = {
    async onRequest({ request }) {
      const token = await options.getAccessToken();
      if (token && !request.headers.has("Authorization")) {
        request.headers.set("Authorization", `Bearer ${token}`);
      }
      // fetch consumes the request body, so keep an unread copy in case a 401 needs a retry.
      if (options.onUnauthorized && request.headers.has("Authorization")) {
        unread.set(request, request.clone());
      }
      return request;
    },
    async onResponse({ request, response }) {
      if (
        response.status !== 401 ||
        !options.onUnauthorized ||
        !request.headers.has("Authorization") ||
        request.headers.has(RETRIED)
      ) {
        return response;
      }
      const original = unread.get(request);
      unread.delete(request);
      if (!original) return response;
      const fresh = await options.onUnauthorized();
      if (!fresh) return response;
      const retry = new Request(original, { headers: new Headers(original.headers) });
      retry.headers.set("Authorization", `Bearer ${fresh}`);
      retry.headers.set(RETRIED, "1");
      return (options.fetch ?? globalThis.fetch)(retry);
    },
  };
  client.use(auth);
  return client;
}

export type OaklyClient = ReturnType<typeof createOaklyClient>;

/** Human-readable message from a FastAPI error body (`detail` may be a string, list or object). */
export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!error || typeof error !== "object") return fallback;
  const detail = (error as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: unknown } | undefined;
    return typeof first?.msg === "string" ? first.msg : fallback;
  }
  if (detail && typeof detail === "object") {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}
