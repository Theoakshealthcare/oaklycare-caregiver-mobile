import type { Schemas } from "@oakly/api-client";

import { utcIso } from "./dates";

/** One row of the notification feed, as the screen reads it. */
export interface AppNotification {
  id: string;
  /** Open set: an unknown value is shown with its own title and body and the generic icon. */
  type: string;
  title: string;
  body: string;
  /** ISO, with a zone (the backend sends none; see `utcIso`). */
  createdAt: string;
  read: boolean;
  /** The booking this notice is about, when it points at one the app can open. */
  bookingId: string | null;
}

type NotificationOut = Schemas["NotificationOut"];

/** Only `target: "booking_detail"` with a string `booking_id` opens a booking; anything else stays on the list. */
export function bookingIdOf(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const { target, booking_id: bookingId } = data as { target?: unknown; booking_id?: unknown };
  return target === "booking_detail" && typeof bookingId === "string" && bookingId.length > 0 ? bookingId : null;
}

export function toNotification(item: NotificationOut): AppNotification {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    body: item.body,
    createdAt: utcIso(item.created_at),
    read: item.read_at !== null && item.read_at !== undefined,
    bookingId: bookingIdOf(item.data),
  };
}

/** What a tap on a push carries. Unlike the feed row, `type` and the notification id live INSIDE `data` here. */
export interface PushTap {
  bookingId: string;
  notificationId: string | null;
}

export function parsePushTap(data: unknown): PushTap | null {
  const bookingId = bookingIdOf(data);
  if (!bookingId) return null;
  const { notification_id: notificationId } = data as { notification_id?: unknown };
  return { bookingId, notificationId: typeof notificationId === "string" && notificationId.length > 0 ? notificationId : null };
}
