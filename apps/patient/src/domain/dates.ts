/**
 * The backend stores and sends UTC timestamps WITHOUT a zone (`2026-11-07T14:45:27.465509`, and for `PUT /auth/profile` even
 * `2026-11-07 15:33:53.445803`). `new Date()` reads such a string as phone-local time, which shifts every time by the
 * phone's offset, so every timestamp the app shows goes through here first.
 */
export function utcIso(raw: string): string {
  const text = raw.trim().replace(" ", "T");
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  return hasZone ? text : `${text}Z`;
}
