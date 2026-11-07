/**
 * What the patient screens know about a booking. The real booking slice maps the api-client `BookingResponse` to this
 * shape (statuses and `dispatch_state` as the backend sends them), so the screens never change.
 */
export type BookingStatus = "pending" | "accepted" | "en_route" | "in_progress" | "completed" | "cancelled" | "declined";
export type DispatchState = "dispatching" | "matched" | "unmatched";
export type PaymentState = "paid" | "pending" | "refunded";
export type BookingTab = "upcoming" | "completed" | "canceled";

export interface Booking {
  id: string;
  /** The code shown to the family, e.g. "OC-12443". */
  reference: string;
  service: string;
  bookingFor: string;
  scheduledAt: string;
  durationHours: number;
  address: string;
  amount: number;
  paymentStatus: PaymentState;
  status: BookingStatus;
  dispatchState: DispatchState | null;
  caregiver: { name: string } | null;
  /** The 4-digit code the patient reads out to the caregiver on arrival; only present while accepted / en route. */
  visitCode: string | null;
}

export function tabForStatus(status: BookingStatus): BookingTab {
  if (status === "completed") return "completed";
  if (status === "cancelled" || status === "declined") return "canceled";
  return "upcoming";
}

/** One plain sentence for where a booking is, including the "still looking" and "nobody found" dispatch states. */
export function statusLabel(booking: Pick<Booking, "status" | "dispatchState">): string {
  switch (booking.status) {
    case "pending":
      return booking.dispatchState === "unmatched" ? "No caregiver found yet" : "Looking for a caregiver";
    case "accepted":
      return "Caregiver assigned";
    case "en_route":
      return "Caregiver is on the way";
    case "in_progress":
      return "Visit in progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Canceled";
    case "declined":
      return "Declined";
  }
}

/** The visit code is only for the patient to read out, and only until the visit starts. */
export function showsVisitCode(booking: Pick<Booking, "status" | "visitCode">): boolean {
  return booking.visitCode !== null && (booking.status === "accepted" || booking.status === "en_route");
}

/** A booking can be canceled in the app until the visit is under way. */
export function canCancel(booking: Pick<Booking, "status">): boolean {
  return booking.status === "pending" || booking.status === "accepted";
}

export function canTrack(booking: Pick<Booking, "status">): boolean {
  return booking.status === "accepted" || booking.status === "en_route" || booking.status === "in_progress";
}

/** How much of the service fee is kept if the family cancels now: free, 20% or 50% (the backend's three tiers). */
export interface CancelTerms {
  feePercent: 0 | 20 | 50;
  feeAmount: number;
  refundAmount: number;
}

export interface BookingDraft {
  forWhom: string;
  service: string;
  assistance: string;
  condition: string;
  date: string;
  time: string;
  durationHours: string;
  state: string;
  city: string;
  address: string;
  instructions: string;
}

export interface BookingQuote {
  amount: number;
}

export interface ChatMessage {
  id: string;
  from: "me" | "caregiver";
  text: string;
  sentAt: string;
}
