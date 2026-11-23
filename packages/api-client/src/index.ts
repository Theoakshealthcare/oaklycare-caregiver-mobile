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
  /** Give up on a request that has not answered after this many milliseconds. Default 20 s. */
  timeoutMs?: number;
  /** The same for a file upload, which is allowed longer. Default 120 s. */
  uploadTimeoutMs?: number;
}

const RETRIED = "x-oakly-retried";

export const DEFAULT_TIMEOUT_MS = 20_000;
export const DEFAULT_UPLOAD_TIMEOUT_MS = 120_000;

/**
 * Wraps a fetch so a request with no answer after `ms` is abandoned. Without this, a stalled connection leaves
 * the app on a spinner for as long as the OS keeps the socket (minutes: the owner waited 60-300 s on staging).
 * The failure is a `TypeError("Network request timed out")`, which `isNetworkFailure` already reports as "never
 * completed", so every screen shows its usual "can't reach Oakly" message. The timer ends when the response
 * starts, so a slow body read is not cut off. A caller's own abort signal still works.
 */
export function withTimeout(getFetch: () => typeof globalThis.fetch, ms: number): typeof globalThis.fetch {
  return async (input, init) => {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ms);
    const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const onCallerAbort = () => controller.abort();
    if (callerSignal?.aborted) controller.abort();
    else callerSignal?.addEventListener("abort", onCallerAbort, { once: true });
    try {
      return await getFetch()(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (timedOut) throw new TypeError("Network request timed out");
      throw error;
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener("abort", onCallerAbort);
    }
  };
}

export function createOaklyClient(options: OaklyClientOptions) {
  // Resolved per call, so a fetch installed after the client was built is used.
  const baseFetch = () => options.fetch ?? globalThis.fetch;
  const timedFetch = withTimeout(baseFetch, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const client = createClient<paths>({ baseUrl: options.baseUrl, fetch: timedFetch });
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
    // Return undefined to keep the response as is. openapi-fetch rejects any returned value that is not
    // `instanceof` the global Response, and React Native's fetch returns responses that fail that check,
    // so handing the original back broke every call in the app (login included).
    async onResponse({ request, response }) {
      if (
        response.status !== 401 ||
        !options.onUnauthorized ||
        !request.headers.has("Authorization") ||
        request.headers.has(RETRIED)
      ) {
        return undefined;
      }
      const original = unread.get(request);
      unread.delete(request);
      if (!original) return undefined;
      const fresh = await options.onUnauthorized();
      if (!fresh) return undefined;
      const retry = new Request(original, { headers: new Headers(original.headers) });
      retry.headers.set("Authorization", `Bearer ${fresh}`);
      retry.headers.set(RETRIED, "1");
      // Typed structurally: on React Native this is often NOT a global Response, even though the DOM
      // types say fetch always returns one.
      const retried: Pick<Response, "text" | "status" | "statusText" | "headers"> = await timedFetch(retry);
      if (retried instanceof Response) return retried;
      // Same React Native mismatch: rebuild it as a global Response so openapi-fetch accepts it.
      return new Response(await retried.text(), {
        status: retried.status,
        statusText: retried.statusText,
        headers: retried.headers,
      });
    },
  };
  client.use(auth);

  const send = withTimeout(baseFetch, options.uploadTimeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS);
  const baseUrl = options.baseUrl.replace(/\/+$/, "");

  /**
   * Multipart upload (`FormData` body), sent with plain `fetch(url, init)` and never through a
   * `Request` object. openapi-fetch wraps every call in `new Request(url, { body })`, and React Native's
   * `Request` cannot carry a `{ uri, name, type }` file part: the call dies before leaving the device
   * and surfaces as a bogus network error. Content-Type is deliberately not set, so fetch adds
   * `multipart/form-data` with the boundary. Auth matches the client: bearer token, and one
   * refresh-and-retry on 401 (the same FormData is re-sent; a file part is a descriptor, not a stream).
   *
   * A rejection from `fetch` means the request never completed (offline, DNS, refused, timeout) and is
   * passed up as is. Resolves like openapi-fetch: `{ data }` on 2xx, `{ error }` otherwise, plus `response`.
   */
  async function sendBody<T = unknown>(
    path: string,
    body: BodyInit,
    method: "POST" | "PUT" | "PATCH",
    contentType?: string,
  ): Promise<{ data?: T; error?: unknown; response: Response }> {
    const url = `${baseUrl}${path}`;
    const attempt = (token: string | null): Promise<Response> => {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (contentType) headers["Content-Type"] = contentType;
      if (token) headers.Authorization = `Bearer ${token}`;
      return send(url, { method, headers, body });
    };

    const token = await options.getAccessToken();
    let response = await attempt(token);
    if (response.status === 401 && token && options.onUnauthorized) {
      const fresh = await options.onUnauthorized();
      if (fresh) response = await attempt(fresh);
    }

    const text = await response.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = undefined;
      }
    }
    // The caller names the response type from the generated schema; the body is not validated here.
    return response.ok ? { data: parsed as T | undefined, response } : { error: parsed ?? {}, response };
  }

  async function uploadMultipart<T = unknown>(
    path: string,
    form: FormData,
    method: "POST" | "PUT" | "PATCH" = "POST",
  ): Promise<{ data?: T; error?: unknown; response: Response }> {
    return sendBody<T>(path, form, method);
  }

  /**
   * A raw request body (an audio recording), sent the same way as `uploadMultipart`: plain `fetch(url, init)`, never a `Request`,
   * with the bearer token and one refresh-and-retry on 401 (the same bytes are re-sent). `Content-Type` is the file's own type.
   * A rejection from `fetch` means the request never completed and is passed up as is.
   */
  async function uploadBytes<T = unknown>(
    path: string,
    bytes: Uint8Array,
    contentType: string,
    method: "POST" | "PUT" | "PATCH" = "PUT",
  ): Promise<{ data?: T; error?: unknown; response: Response }> {
    return sendBody<T>(path, bytes as unknown as BodyInit, method, contentType);
  }

  return Object.assign(client, { uploadMultipart, uploadBytes });
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

// ---- Multipart file parts (the expo/fetch trap) ----

/**
 * Multipart file parts that the React Native `fetch` of an Expo app can actually send.
 *
 * The trap: an Expo app's global `fetch` is `expo/fetch` (installed by `expo/src/winter/runtime.native.ts`),
 * not React Native's own. Its FormData conversion (`convertFormDataAsync`) accepts a string, a `Blob` or
 * any object with a `bytes()` method. React Native's classic `{ uri, name, type }` file descriptor is none
 * of those, so `fetch` throws `Unsupported FormDataPart implementation` before any request is made and
 * nothing reaches the server. Jest tests that mock `fetch` never see it.
 *
 * `filePart` builds a part `expo/fetch` accepts: `name` and `type` become the part's filename and
 * Content-Type, and `bytes()` reads the file only when the request is sent. The reader is injected so
 * this package keeps no native dependency; each app passes
 * `(uri) => new File(uri).bytes()` from `expo-file-system`.
 */

/** A local file as the pickers report it. */
export interface FilePartDescriptor {
  uri: string;
  name: string;
  type: string;
}

/** Reads a local file (a `file://` uri) into memory. */
export type ReadFileBytes = (uri: string) => Promise<Uint8Array>;

/** What `expo/fetch` accepts as a FormData file part (an object with `bytes()` plus `name` and `type`). */
export interface FilePart {
  readonly uri: string;
  readonly name: string;
  readonly type: string;
  bytes(): Promise<Uint8Array>;
}

export function filePart(file: FilePartDescriptor, readBytes: ReadFileBytes): FilePart {
  return {
    uri: file.uri,
    name: file.name,
    type: file.type,
    bytes: () => readBytes(file.uri),
  };
}

/** Appends a file part to a FormData (the DOM typings only know `Blob`, hence the cast). */
export function appendFilePart(form: FormData, field: string, part: FilePart): void {
  form.append(field, part as unknown as Blob);
}

// ---- Did the request never complete? ----

/**
 * Did a request fail because it never completed (offline, DNS, refused connection, timeout), as opposed
 * to a failure inside our own code (building the request, reading a file)?
 *
 * Each `fetch` reports "never completed" in its own way, so a plain `instanceof TypeError` is not enough:
 *   - React Native's fetch:  `TypeError: Network request failed` (or `... timed out`).
 *   - `expo/fetch`:          a plain `Error` whose message starts `fetch failed:`, e.g.
 *                            `fetch failed: UnexpectedException: Could not connect to the server.`
 *                            Only the native request raises this, so it always means the request ran.
 *   - Node (undici):         `TypeError: fetch failed`.
 *   - Browsers:              `TypeError: Failed to fetch` (Chrome), `Load failed` (Safari),
 *                            `NetworkError when attempting to fetch resource.` (Firefox).
 *
 * A programming or client error, such as expo/fetch's `Error: Unsupported FormDataPart implementation`
 * thrown while converting the body, matches none of them and must not blame the connection.
 */
const EXPO_FETCH_PREFIX = /^fetch failed(?::|$)/;
const EXPO_FETCH_ABORTED = /^fetch failed: The operation was aborted\.?$/;
const TYPE_ERROR_NETWORK = /^(Network request (failed|timed out)|Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?)$/;

export function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const { message } = error;
  if (EXPO_FETCH_PREFIX.test(message)) return !EXPO_FETCH_ABORTED.test(message);
  return error instanceof TypeError && TYPE_ERROR_NETWORK.test(message);
}
