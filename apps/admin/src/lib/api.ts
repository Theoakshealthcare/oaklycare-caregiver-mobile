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

/**
 * For routes that are not in the generated schema yet (the A0 admin-users routes). Same token and
 * refresh behaviour as the typed client. TODO(A0): delete once these routes are generated.
 */
export async function adminRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const send = (token: string | null) =>
    fetch(path, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

  let res = await send(getAccessToken());
  if (res.status === 401) {
    const fresh = await recoverFromUnauthorized();
    if (fresh) res = await send(fresh);
  }
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  if (!res.ok) throw new ApiError(errorMessage(parsed), res.status, parsed);
  return parsed as T;
}

export { errorMessage };
