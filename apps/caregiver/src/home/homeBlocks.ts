/**
 * Small pure helpers for the Home blocks drawn in the Figma export (greeting, week strip, "10 Min Ago", ...).
 * Nothing here reads a clock: every function takes `now`, so tests fix it.
 */
import { parseBackendDate } from "@/src/utils/dates";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "Hello Julius, 👋": Figma puts a comma after the name and a waving hand after it. Without a name it is "Hello 👋". */
export function greetingLine(firstNameOrNull: string | null): string {
  return firstNameOrNull ? `Hello ${firstNameOrNull}, 👋` : "Hello 👋";
}

/** Figma's wording, spaces and all: other screens in the export use the same "word ?" spacing. */
export const HOME_SUBTITLE = "What do you like to do today ?";

/** "March 2025": the title under "Weekly Availability". */
export function monthTitle(now: Date): string {
  return `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

export interface WeekDay {
  /** "Mon" */
  label: string;
  /** Day of the month. */
  date: number;
  isToday: boolean;
}

/**
 * The five days of the Figma strip: today in the middle with two days either side (Figma: Mon 28, Tue 29, **Wed 30**,
 * Thu 1, Fri 2). It is a calendar strip only: the server holds one availability switch, not one per day.
 */
export function weekStrip(now: Date): WeekDay[] {
  const days: WeekDay[] = [];
  for (let offset = -2; offset <= 2; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    days.push({ label: WEEKDAYS[day.getDay()] ?? "", date: day.getDate(), isToday: offset === 0 });
  }
  return days;
}

/** "Just now", "10 Min Ago", "2 Hr Ago", "3 Days Ago": the notification row's right-hand text. */
export function timeAgo(iso: string, now: number): string {
  const at = parseBackendDate(iso).getTime();
  if (Number.isNaN(at)) return "";
  const minutes = Math.floor(Math.max(0, now - at) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} Min Ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} Hr Ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "Day" : "Days"} Ago`;
}

/** "morning" / "afternoon" / "evening" for the hour a visit was due ("... ended your morning appointment"); null when the hour is unknown. */
export function partOfDay(hour: number): "morning" | "afternoon" | "evening" | null {
  if (Number.isNaN(hour)) return null;
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
