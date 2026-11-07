import type { Schemas } from "@oakly/api-client";

import { api } from "@/src/api/client";
import { unwrap } from "@/src/api/unwrap";

export type Booking = Schemas["BookingResponse"];
export type BookingStatus = Schemas["BookingStatus"];
export type ChatMessage = Schemas["ChatMessageResponse"];
export type BookingNote = Schemas["BookingNoteResponse"];

/** Values GET /booking/caregiver/bookings?status= accepts (backend guide, section 7). */
export type BookingListFilter = "new_requests" | BookingStatus;

/**
 * What the caregiver may see about a job they have NOT accepted yet.
 *
 * The backend already strips patient identity from offers (patient_details, condition and
 * special_instructions are null, the address is the area only), but the app does not rely on that:
 * the offer UI is built from this narrow type, so a patient field can never reach the screen even
 * if the server's offer view were to carry one by mistake.
 */
export interface Offer {
  id: string;
  serviceType: string;
  /** Null for an offer built from the home summary, which carries only `service_type`. */
  assistanceType: string | null;
  durationHours: number;
  scheduledDate: string;
  scheduledEndDate: string;
  /** "<city>, <state>", the only location shown before accepting. */
  area: string;
  /**
   * The caregiver's own answer to this offer, from the notification list: null while unanswered. Anything
   * else (declined, taken by someone else, cancelled, reassigned) means Accept/Decline must not be offered:
   * the backend refuses an accept after a decline (403 "You declined this offer").
   */
  response?: string | null;
}

export function toOffer(booking: Booking, response?: string | null): Offer {
  return {
    id: booking.id,
    serviceType: booking.service_type,
    assistanceType: booking.assistance_type,
    durationHours: booking.duration_hours,
    scheduledDate: booking.scheduled_date,
    scheduledEndDate: booking.scheduled_end_date,
    area: [booking.patient_city, booking.patient_state].filter(Boolean).join(", "),
    ...(response !== undefined ? { response } : {}),
  };
}

/** An offer from `open_offers` in GET /caregiver/home. It never had patient data to begin with. */
export function homeOfferToOffer(offer: Schemas["HomeOffer"]): Offer {
  return {
    id: offer.booking_id,
    serviceType: offer.service_type,
    assistanceType: null,
    durationHours: offer.duration_hours,
    scheduledDate: offer.scheduled_date,
    scheduledEndDate: offer.scheduled_end_date,
    area: [offer.area, offer.state].filter(Boolean).join(", "),
  };
}

export type BookingAction = "accept" | "decline";
export type VisitAction = "on_my_way" | "start" | "complete" | "cancel";

function byScheduledDate(a: Booking, b: Booking): number {
  return a.scheduled_date.localeCompare(b.scheduled_date);
}

export const bookingService = {
  listCaregiverBookings(filter: BookingListFilter) {
    return unwrap(api.GET("/api/v1/booking/caregiver/bookings", { params: { query: { status: filter } } }));
  },

  /** Jobs the caregiver has accepted and not finished: one call per status, merged soonest first. */
  async listActive(): Promise<Booking[]> {
    const statuses: BookingStatus[] = ["accepted", "en_route", "in_progress"];
    const lists = await Promise.all(statuses.map((s) => bookingService.listCaregiverBookings(s)));
    return lists.flat().sort(byScheduledDate);
  },

  /** Only for a booking assigned to this caregiver; an un-accepted offer answers 403 "Access denied". */
  getBooking(bookingId: string) {
    return unwrap(api.GET("/api/v1/booking/booking/{booking_id}", { params: { path: { booking_id: bookingId } } }));
  },

  /**
   * accept / decline. The response is an untyped raw booking dict in the schema; the app only
   * reads the new `status` from it and refetches the typed booking for everything else.
   */
  async act(
    bookingId: string,
    action: BookingAction | VisitAction,
    visitCode?: string,
  ): Promise<{ status: string | null }> {
    const raw: unknown = await unwrap(
      api.POST("/api/v1/booking/caregiver/action/{booking_id}", {
        params: { path: { booking_id: bookingId } },
        // visit_code only travels with `start`; the caregiver types it, the patient reads it out.
        body: action === "start" ? { action, visit_code: visitCode } : { action },
      }),
    );
    const booking = raw && typeof raw === "object" ? (raw as { booking?: unknown }).booking : undefined;
    const status = booking && typeof booking === "object" ? (booking as { status?: unknown }).status : undefined;
    return { status: typeof status === "string" ? status : null };
  },

  listChatMessages(bookingId: string) {
    return unwrap(api.GET("/api/v1/booking/chat/{booking_id}/messages", { params: { path: { booking_id: bookingId } } }));
  },

  sendChatMessage(bookingId: string, message: string) {
    return unwrap(
      api.POST("/api/v1/booking/chat/{booking_id}/send", {
        params: { path: { booking_id: bookingId } },
        body: { message, message_type: "text" },
      }),
    );
  },

  listNotes(bookingId: string) {
    return unwrap(api.GET("/api/v1/booking/notes/{booking_id}", { params: { path: { booking_id: bookingId } } }));
  },

  createNote(bookingId: string, title: string, content: string) {
    return unwrap(
      api.POST("/api/v1/booking/notes/{booking_id}/create", {
        params: { path: { booking_id: bookingId } },
        body: { title, content },
      }),
    );
  },
};
