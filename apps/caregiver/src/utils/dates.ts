/**
 * The backend sends ISO 8601 timestamps in UTC WITHOUT a "Z" or offset (for example
 * "2026-10-06T08:05:36.281977"); `new Date()` would read that as local time. Treat them as UTC.
 */
export function parseBackendDate(iso: string): Date {
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(iso);
  return new Date(hasZone ? iso : `${iso}Z`);
}

export function formatVisitTime(iso: string, locale = "en-NG"): string {
  const date = parseBackendDate(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(hours: number): string {
  return hours === 1 ? "1 hour" : `${hours} hours`;
}
