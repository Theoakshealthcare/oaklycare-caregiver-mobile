/**
 * Did a request fail because it never completed (offline, DNS, refused connection, timeout), as opposed to a failure
 * inside our own code (building the request, reading a file)?
 *
 * Same classifier as `isNetworkFailure` in `@oakly/api-client` on `fix/dp1-upload-expo-fetch` (PR #22, not merged when
 * this was written). When that lands, delete this file and import it from `@oakly/api-client`; the cases and tests
 * are identical on purpose.
 *
 * Each `fetch` reports "never completed" in its own way, so `instanceof TypeError` alone is not enough:
 *   - React Native's fetch: `TypeError: Network request failed` (or `... timed out`).
 *   - `expo/fetch`: a plain `Error` whose message starts `fetch failed:`, e.g. `fetch failed: Could not connect to the
 *     server.` Only the native request raises it, so it always means the request ran.
 *   - Node (undici): `TypeError: fetch failed`.
 *   - Browsers: `Failed to fetch` (Chrome), `Load failed` (Safari), `NetworkError when attempting to fetch resource.`
 *
 * A programming error (a bad FormData part, a typo that throws a TypeError of its own) matches none of them and must
 * not blame the connection.
 */
const EXPO_FETCH_PREFIX = /^fetch failed(?::|$)/;
const EXPO_FETCH_ABORTED = /^fetch failed: The operation was aborted\.?$/;
const TYPE_ERROR_NETWORK =
  /^(Network request (failed|timed out)|Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?)$/;

export function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const { message } = error;
  if (EXPO_FETCH_PREFIX.test(message)) return !EXPO_FETCH_ABORTED.test(message);
  return error instanceof TypeError && TYPE_ERROR_NETWORK.test(message);
}
