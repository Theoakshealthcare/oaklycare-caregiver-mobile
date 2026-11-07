import type { CaregiverNotification } from "@/src/services/notification.service";
import { formatDuration, formatVisitTime } from "@/src/utils/dates";
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
