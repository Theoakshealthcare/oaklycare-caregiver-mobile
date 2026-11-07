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

// --- One formatter for every date and time the app shows (DP1-28) ---------------------------------
// Always the phone's own zone, always 24-hour, always day-then-month. Nothing else in the app calls
// toLocale*String for display.

const LOCALE = "en-NG";

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : parseBackendDate(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A calendar date with no time ("1990-01-01") read as that day, not shifted by the phone's zone. */
function parseDateOnly(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "YYYY-MM-DD" of a local calendar day (what the API takes for a date field). */
export function toDateOnly(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** "7 Nov 2026" for a date-only value such as a date of birth or a plan start. Empty when unreadable. */
export function formatDate(value: string | Date | null | undefined): string {
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDateOnly(value) : toDate(value);
  return date ? date.toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric" }) : "";
}

/** "Thu, 5 Nov 2026": a day heading. */
export function formatDayHeading(date: Date): string {
  return date.toLocaleDateString(LOCALE, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/** "09:14". */
export function formatClock(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? date.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
}

/** "28 Oct, 09:14". */
export function formatStamp(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? date.toLocaleString(LOCALE, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "";
}
