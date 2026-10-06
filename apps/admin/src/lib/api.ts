import { createOaklyClient, errorMessage } from "@oakly/api-client";

import { getAccessToken, recoverFromUnauthorized } from "./session";

/**
 * Typed backend client in browser mode. `baseUrl` is this app's own origin: `/api/v1/*` is
 * proxied to the backend (see `app/api/v1/[...path]/route.ts`), so there is no CORS and no backend
 * origin in the bundle. A 401 triggers one silent refresh through the BFF and a single retry.
 */
let client: ReturnType<typeof createOaklyClient> | null = null;

export function getApi() {
  if (!client) {
    client = createOaklyClient({
      baseUrl: window.location.origin,
      getAccessToken,
      onUnauthorized: recoverFromUnauthorized,
      // Resolve fetch per call (not once at creation) so tests can stub it.
      fetch: (input, init) => globalThis.fetch(input, init),
    });
  }
  return client;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Throw an `ApiError` carrying the status and body, or return the data. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || !result.response.ok) {
    throw new ApiError(errorMessage(result.error), result.response.status, result.error);
  }
  return result.data as T;
}

/** The signed-in admin and their permissions. The refresh response has no `admin`, so this fills it in. */
export async function fetchMe() {
  return unwrap(await getApi().GET("/api/v1/admin/me"));
}

export { errorMessage };
