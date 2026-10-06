/** Display conventions from PRD section 9: times in WAT, money as ₦ with kobo storage. */

const WAT = "Africa/Lagos";

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  // The backend sends naive UTC timestamps (`datetime.utcnow()`); treat a missing zone as UTC.
  const text = typeof value === "string" && !/(Z|[+-]\d\d:?\d\d)$/.test(value) ? `${value}Z` : value;
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "6 Oct 2026, 14:05 WAT" */
export function formatWat(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: WAT,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${parts} WAT`;
}

/** "6 Oct 2026" for a calendar date or timestamp (WAT). */
export function formatWatDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: WAT, day: "numeric", month: "short", year: "numeric" }).format(d);
}

/** Kobo (integer) to "₦44,000" or "₦44,000.50". */
export function formatNaira(kobo: number | null | undefined): string {
  if (kobo === null || kobo === undefined || !Number.isFinite(kobo)) return "—";
  const naira = kobo / 100;
  const whole = Number.isInteger(naira);
  return `₦${new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(naira)}`;
}

/** "3 days" / "today" for queue ages. */
export function formatAge(days: number | null | undefined): string {
  if (days === null || days === undefined) return "—";
  if (days <= 0) return "Today";
  return days === 1 ? "1 day" : `${days} days`;
}

/** "under_review" to "Under review". */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
