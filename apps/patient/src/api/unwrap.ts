import { ApiError, NETWORK_MESSAGE, messageForStatus } from "./errors";

/** The part of an openapi-fetch result the data layer reads. */
interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

async function settle<T>(call: Promise<FetchResult<T>>): Promise<FetchResult<T>> {
  let result: FetchResult<T>;
  try {
    result = await call;
  } catch (error) {
    // fetch rejects (TypeError) when the request never completed: offline, DNS, refused connection.
    if (__DEV__) console.warn("[api] request failed before a response was read:", error);
    throw new ApiError(0, null, NETWORK_MESSAGE);
  }
  if (result.error !== undefined || !result.response.ok) {
    const { status } = result.response;
    const body = result.error ?? null;
    const detail =
      body && typeof body === "object" && typeof (body as { detail?: unknown }).detail === "string"
        ? (body as { detail: string }).detail
        : null;
    const header = Number(result.response.headers.get("Retry-After"));
    const retryAfter = Number.isFinite(header) && header > 0 ? header : null;
    throw new ApiError(status, body, messageForStatus(status, detail, body, "default"), retryAfter);
  }
  return result;
}

/** Resolves with the typed body of a successful call, or throws an {@link ApiError}. */
export async function unwrap<T>(call: Promise<FetchResult<T>>): Promise<T> {
  const result = await settle(call);
  if (result.data === undefined) {
    throw new ApiError(result.response.status, null, "The server sent an empty response.");
  }
  return result.data;
}

/** For endpoints that answer with no body (204). */
export async function unwrapEmpty(call: Promise<FetchResult<unknown>>): Promise<void> {
  await settle(call);
}
