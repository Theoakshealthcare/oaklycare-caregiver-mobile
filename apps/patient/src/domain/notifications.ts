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
  /** Where the tap goes: the booking's details sheet, or (a new chat message) that booking's chat. */
  destination: "booking" | "chat";
}

/**
 * A chat message push is `{ type: "chat_message", booking_id }` (no `target`) and opens that booking's chat. Everything else
 * opens a booking only with `target: "booking_detail"`; anything the app does not know stays where it is.
 */
export function parsePushTap(data: unknown): PushTap | null {
  if (!data || typeof data !== "object") return null;
  const { notification_id: notificationId, type, booking_id: chatBookingId } = data as { notification_id?: unknown; type?: unknown; booking_id?: unknown };
  const id = typeof notificationId === "string" && notificationId.length > 0 ? notificationId : null;
  if (type === "chat_message" && typeof chatBookingId === "string" && chatBookingId.length > 0) {
    return { bookingId: chatBookingId, notificationId: id, destination: "chat" };
  }
  const bookingId = bookingIdOf(data);
  if (!bookingId) return null;
  return { bookingId, notificationId: id, destination: "booking" };
}
