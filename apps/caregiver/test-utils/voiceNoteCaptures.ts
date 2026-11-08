/** Reads a response (or request) captured from the real backend app. See test-utils/voice-note-captures/README.md. */
export interface Capture {
  request: { method: string; path: string; body: unknown };
  response: { status_code: number; headers: Record<string, string>; body: unknown };
}

export function capture(name: string): Capture {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(`./voice-note-captures/${name}.json`) as Capture;
}

export const body = (name: string): Record<string, unknown> => capture(name).response.body as Record<string, unknown>;
