import type { Booking, ChatMessage } from "@/src/services/booking.service";
import { formatChatStamp, formatClock, formatRelativeDay, parseBackendDate } from "@/src/utils/dates";
import { serviceName } from "@/src/utils/labels";

/** A new day/time stamp appears between two messages at least this far apart (15 minutes), and above the first message. */
export const STAMP_GAP_MS = 15 * 60 * 1000;

/**
 * The quick replies of the Figma composer. Plain text sent through the same path as a typed message; the backend
 * relay applies no content rule to it. The Figma "Wound Dressing" chip (the service name) is left out: sending a
 * service name as a message says nothing to the client.
 */
export const QUICK_REPLIES = ["I'm on my way", "I've arrived", "I'll be there in 10 Mins"] as const;

export type ChatRow = { kind: "stamp"; key: string; label: string } | { kind: "message"; key: string; message: ChatMessage };

/** Messages with a stamp row above the first one and above any message sent 15 minutes or more after the one before. */
export function withStamps(messages: ChatMessage[], now: Date = new Date()): ChatRow[] {
  const rows: ChatRow[] = [];
  let previous: number | null = null;
  for (const message of messages) {
    const at = parseBackendDate(message.created_at).getTime();
    if (!Number.isNaN(at) && (previous === null || at - previous >= STAMP_GAP_MS)) {
      rows.push({ kind: "stamp", key: `stamp-${message.id}`, label: formatChatStamp(message.created_at, now) });
    }
    if (!Number.isNaN(at)) previous = at;
    rows.push({ kind: "message", key: message.id, message });
  }
  return rows;
}

export interface BookingContext {
  /** The care needed ("Wound Dressing"), else the visit's service name. */
  title: string;
  /** The service chip ("Nurse visit"), omitted when it would repeat the title. */
  chip: string | null;
  /** The street address the caregiver may see; null while the server withholds it (before acceptance). */
  address: string | null;
  /** "Tomorrow, 10:00 - 11:30". */
  when: string;
}

/**
 * What the chat's booking card shows, from the booking the caregiver already has. The address is the booking's
 * `patient_address`: the server sends it only after the caregiver accepts, and when it is missing the card shows the
 * city and state (the area) instead, never a guess.
 */
export function bookingContext(booking: Booking): BookingContext {
  const service = serviceName(booking.service_type);
  const title = booking.assistance_type?.trim() || service;
  const area = [booking.patient_city, booking.patient_state].filter(Boolean).join(", ");
  const start = formatClock(booking.scheduled_date);
  const end = formatClock(booking.scheduled_end_date);
  const day = formatRelativeDay(booking.scheduled_date);
  return {
    title,
    chip: title === service ? null : service,
    address: booking.patient_address?.trim() || area || null,
    when: [day, end && start !== end ? `${start} - ${end}` : start].filter(Boolean).join(", "),
  };
}
