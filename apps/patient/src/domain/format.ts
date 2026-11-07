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
