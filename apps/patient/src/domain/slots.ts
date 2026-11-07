const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11-08" in the phone's own time zone. */
export const isoDate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The next `count` days, today first, as chips ("Sat 7 Nov"). */
export function dateOptions(count = 14, from = new Date()): { value: string; label: string }[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    return { value: isoDate(d), label: `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}` };
  });
}

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
