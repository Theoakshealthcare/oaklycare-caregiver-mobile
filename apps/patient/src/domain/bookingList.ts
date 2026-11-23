import { durationLabel } from "@/src/domain/bookingChoices";
import { formatDate, formatTime } from "@/src/domain/format";

/** What the Bookings list needs to write a date the way the design does ("Today, 2:00 PM · 1 hour") and to draw its week strip. */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Today", "Tomorrow", the weekday for the rest of the next week, else the plain date; all in the phone's own time zone. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const day = startOfDay(new Date(iso));
  const today = startOfDay(now);
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return WEEKDAYS[day.getDay()];
  return formatDate(iso);
}

/** "Today, 2:00 PM · 1 hour" (the design writes "1hour": the space is fixed). */
export function visitLine(iso: string, durationMinutes: number, now: Date = new Date()): string {
  return `${dayLabel(iso, now)}, ${formatTime(iso)} · ${durationLabel(durationMinutes)}`;
}

/** The Monday of the week that holds `date`. */
export function weekStart(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Monday to Sunday of the week that starts at `start`. */
export function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** "November 2026": the month the middle of the strip is in. */
export function monthHeading(start: Date): string {
  const middle = addDays(start, 3);
  return `${MONTH_NAMES[middle.getMonth()]} ${middle.getFullYear()}`;
}
