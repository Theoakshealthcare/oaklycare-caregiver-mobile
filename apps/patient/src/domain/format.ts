/** "₦250,000" (the designs mix "N", "₦" and "NGN"; the app always uses the naira sign with thousands commas). */
export function formatNaira(amount: number): string {
  const rounded = Math.round(amount);
  return `₦${String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n: number) => String(n).padStart(2, "0");

/** "7 Nov 2026" in the phone's own time zone. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "2:30 PM" in the phone's own time zone. */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  const hours = d.getHours();
  return `${hours % 12 === 0 ? 12 : hours % 12}:${pad(d.getMinutes())} ${hours < 12 ? "AM" : "PM"}`;
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

/** "just now", "2 mins ago", "3 hrs ago", "2 days ago": how long before `now` a reading was taken. */
export function formatAgo(iso: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "min" : "mins"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hr" : "hrs"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

/** "Updated at 10:45am" for a reading taken today, else "Updated 7 Nov" (the Vitals tiles). */
export function formatUpdated(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString()) {
    const hours = d.getHours();
    return `Updated at ${hours % 12 === 0 ? 12 : hours % 12}:${pad(d.getMinutes())}${hours < 12 ? "am" : "pm"}`;
  }
  return `Updated ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
