import type { ChatSummary } from "@/src/services/chats.service";
import { formatClock, parseBackendDate } from "@/src/utils/dates";

/** The Figma avatar row shows a handful of the latest conversations. */
export const AVATAR_ROW_LIMIT = 8;

/** Shown under the name while nobody has written in the conversation yet. */
export const NO_MESSAGES_YET = "No messages yet";

/** The patient's first letter, as the chat header and the Bookings cards draw it. */
export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "P";
}

/** The conversations whose patient name contains `query` (ignoring case and surrounding spaces); all of them for a blank query. */
export function filterChats(chats: ChatSummary[], query: string): ChatSummary[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return chats;
  return chats.filter((chat) => chat.patient_name.toLowerCase().includes(needle));
}

/** "14:05" for today, "Wed" inside the last week, "28 Oct" before that (24-hour clock, as everywhere in the app). */
export function listTime(sentAt: string, now: Date = new Date()): string {
  const date = parseBackendDate(sentAt);
  if (Number.isNaN(date.getTime())) return "";
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (days <= 0) return formatClock(date);
  if (days < 7) return date.toLocaleDateString("en-NG", { weekday: "short" });
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}
