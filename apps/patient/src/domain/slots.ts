const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11-08" in the phone's own time zone. */
export const isoDate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Hourly start times from 07:00 to 20:00 ("7:00 AM"), valued "07:00". */
export function timeOptions(): { value: string; label: string }[] {
  return Array.from({ length: 14 }, (_, i) => {
    const hour = 7 + i;
    const shown = hour % 12 === 0 ? 12 : hour % 12;
    return { value: `${pad(hour)}:00`, label: `${shown}:00 ${hour < 12 ? "AM" : "PM"}` };
  });
}

/** The chosen date and time as a local Date (the booking slice turns it into the ISO `scheduled_date`). */
export function toLocalDate(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

/** True when the chosen date and time have already passed (so the start-time chip for it cannot be picked). */
export function isPastSlot(date: string, time: string, now: number = Date.now()): boolean {
  return toLocalDate(date, time).getTime() < now;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const monthName = (month: number): string => MONTH_NAMES[month];

/** 1 to 31 with its English ending: 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st. */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** The field text Figma draws: "March 20th 10:00 am". */
export function formatSlot(date: string, time: string): string {
  const d = toLocalDate(date, time || "00:00");
  const hour = d.getHours();
  const clock = `${hour % 12 === 0 ? 12 : hour % 12}:${pad(d.getMinutes())} ${hour < 12 ? "am" : "pm"}`;
  return `${MONTH_NAMES[d.getMonth()]} ${ordinal(d.getDate())}${time ? ` ${clock}` : ""}`;
}

/**
 * The weeks of a month for the calendar sheet: rows of seven (Sunday first), `null` for the blanks before the 1st and after
 * the last day. `month` is 0 to 11.
 */
export function monthWeeks(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/** True when the whole day is before today (so it cannot be chosen). */
export function isPastDay(year: number, month: number, day: number, now: Date = new Date()): boolean {
  return new Date(year, month, day).getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}
