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

/** "Wed 08:00" for a day inside the last week, "28 Oct, 09:14" before that: the stamp between chat message groups. */
export function formatChatStamp(value: string | Date | null | undefined, now: Date = new Date()): string {
  const date = toDate(value);
  if (!date) return "";
  const days = (now.getTime() - date.getTime()) / 86_400_000;
  if (days >= 6 || days < -1) return formatStamp(date);
  return `${date.toLocaleDateString(LOCALE, { weekday: "short" })} ${formatClock(date)}`;
}

/** "Today", "Tomorrow", or "Thu, 5 Nov" for the day of `value`, read in the phone's zone. */
export function formatRelativeDay(value: string | Date | null | undefined, now: Date = new Date()): string {
  const date = toDate(value);
  if (!date) return "";
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOf(date) - startOf(now)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return date.toLocaleDateString(LOCALE, { weekday: "short", day: "numeric", month: "short" });
}

/** "5 minutes ago" style: "Just now", "2 mins ago", "3 hrs ago", "2 days ago". */
export function formatTimeAgo(value: string | Date | null | undefined, now: Date = new Date()): string {
  const date = toDate(value);
  if (!date) return "";
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "min" : "mins"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hr" : "hrs"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}
