/**
 * Loads the REAL responses captured by `scripts/capture-live.mjs` from a running backend (`__tests__/fixtures/live/NN-label.json`).
 * Tests answer the fake fetch with these bodies, so a screen is proven against what the server actually sends, not against
 * a hand-typed guess. Placeholder data only (example.com emails, `<jwt>` for tokens).
 */
import * as fs from "node:fs";
import * as path from "node:path";

const DIR = path.join(__dirname, "..", "__tests__", "fixtures", "live");

export interface LiveCapture {
  request: { method: string; path: string; auth: string | null; body: unknown };
  response: { status: number; retryAfter?: string; body: any };
  note?: string;
}

export function live(label: string): LiveCapture {
  const file = fs.readdirSync(DIR).find((name) => name.replace(/^\d+-/, "").replace(/\.json$/, "") === label);
  if (!file) throw new Error(`no live capture named "${label}"`);
  return JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8")) as LiveCapture;
}

/** The captured response body. */
export const liveBody = <T = any>(label: string): T => live(label).response.body as T;

/** A `routeFetch` reply with the captured status, body and `Retry-After`. Pass `override` to change the body. */
export function liveReply(label: string, override?: (body: any) => unknown) {
  const { response } = live(label);
  return {
    status: response.status,
    body: override ? override(structuredClone(response.body)) : response.body,
    headers: response.retryAfter ? { "Retry-After": response.retryAfter } : undefined,
  };
}
