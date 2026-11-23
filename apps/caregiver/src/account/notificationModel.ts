import type { CaregiverNotification } from "@/src/services/notification.service";
import { formatDayHeading, formatDuration, formatVisitTime, parseBackendDate } from "@/src/utils/dates";
import { serviceName } from "@/src/utils/labels";

/** Notification `response` values that mean this caregiver already acted on, or lost, the offer. */
const MINE_AFTER_ACCEPT = new Set(["accept", "assigned_by_admin"]);

export interface NotificationView {
  id: string;
  /** Offers are titled by what is offered; everything else keeps the server's title. */
  title: string;
  /** "Sat, 7 Nov, 14:28 • 2 hours • Lekki, Lagos" for an offer; the server's message otherwise. */
  detail: string;
  /** Distance, when the server's message states one ("0.22 km away"). Never an ETA. */
  distance: string | null;
  /** Offers only: Open, Accepted or No longer available. */
  state: "open" | "accepted" | "unavailable" | null;
  stateLabel: string | null;
  received: string;
  isRead: boolean;
  /** The booking opens as an offer (patient hidden, maybe unavailable) or as the caregiver's own job. */
  opensAs: "offer" | "job";
}

/** "New nurse request - 0.22km away, ETA 5 min" -> "0.22 km away". The ETA is meaningless for a visit days away. */
export function distanceFromMessage(message: string): string | null {
  const match = /(\d+(?:\.\d+)?)\s*km away/i.exec(message);
  return match ? `${match[1]} km away` : null;
}

export function notificationView(n: CaregiverNotification): NotificationView {
  const isOffer = n.notification_type === "new_booking";
  const response = n.response ?? null;
  const assignedToMe = Boolean(n.booking.caregiver_id) && (response === null || MINE_AFTER_ACCEPT.has(response));
  const received = `Received ${formatVisitTime(n.created_at)}`;
  if (!isOffer) {
    return {
      id: n.id, title: n.title, detail: n.message, distance: null, state: null, stateLabel: null,
      received, isRead: n.is_read, opensAs: assignedToMe ? "job" : "offer",
    };
  }
  const area = [n.booking.patient_city, n.booking.patient_state].filter(Boolean).join(", ");
  const detail = [formatVisitTime(n.booking.scheduled_date), formatDuration(n.booking.duration_hours), area]
    .filter(Boolean)
    .join(" • ");
  const state = assignedToMe ? "accepted" : response === null ? "open" : "unavailable";
  return {
    id: n.id,
    title: `${serviceName(n.booking.service_type)} request`,
    detail,
    distance: distanceFromMessage(n.message),
    state,
    stateLabel: state === "accepted" ? "Accepted" : state === "open" ? "Open" : "No longer available",
    received,
    isRead: n.is_read,
    opensAs: assignedToMe ? "job" : "offer",
  };
}

export interface NotificationGroup<T> {
  /** "Today", "Yesterday" or a day heading such as "Thu, 5 Nov 2026". */
  label: string;
  items: T[];
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Groups notifications by the phone's calendar day, newest day first and newest first inside a day: the "Today" header of the
 * Figma list. A notification whose time cannot be read goes under an "Earlier" header at the end.
 */
export function groupNotifications<T extends { created_at: string }>(items: T[], now: Date): NotificationGroup<T>[] {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const sorted = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const groups: NotificationGroup<T>[] = [];
  const unreadable: T[] = [];
  for (const item of sorted) {
    const at = parseBackendDate(item.created_at);
    if (Number.isNaN(at.getTime())) {
      unreadable.push(item);
      continue;
    }
    const label = sameDay(at, now) ? "Today" : sameDay(at, yesterday) ? "Yesterday" : formatDayHeading(at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  if (unreadable.length > 0) groups.push({ label: "Earlier", items: unreadable });
  return groups;
}
