/**
 * Responses captured against the running backend for the post-visit windows (backend #81,
 * `docs/fe-captures/post-visit-windows-location/`, placeholder data), copied to `test-utils/windowCaptures/`.
 * The tests answer with these bodies so the screens are proven against the real shapes.
 */
export function windowCapture(name: string): { status: number; body: any } {
  const file = require(`./windowCaptures/${name}.json`);
  return { status: file.response.status_code, body: file.response.body };
}

/** The moment the captures were taken: every time in them is read against it ("completed 30 h ago" is 30 h before this). */
const CAPTURED_AT = Date.parse("2026-11-25T08:06:02Z");
const TIME_KEYS = ["chat_closes_at", "notes_closes_at", "notes_readable_until"];

/**
 * A captured booking or chat row with its window times moved so the capture's "now" is the real now. The shapes and the gaps
 * between the times stay as captured ("chat closed 6 h ago", "notes close in 1 h"), so the test does not turn false with the date.
 */
export function retimed<T extends Record<string, any>>(row: T): T {
  const shift = Date.now() - CAPTURED_AT;
  const out: Record<string, any> = { ...row };
  for (const key of TIME_KEYS) {
    if (typeof out[key] === "string") out[key] = new Date(Date.parse(`${out[key]}Z`) + shift).toISOString().replace("Z", "");
  }
  return out as T;
}
