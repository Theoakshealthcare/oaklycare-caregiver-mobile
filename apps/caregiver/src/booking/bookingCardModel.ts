import { formatNaira } from "@/src/home/homeModel";
import type { Booking } from "@/src/services/booking.service";

/** The grey chip at the top right of a Bookings card. Figma calls an accepted visit "Confirmed". */
const STATUS_CHIP: Record<string, string> = {
  accepted: "Confirmed",
  en_route: "On the way",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function statusChip(status: string): string {
  return STATUS_CHIP[status] ?? status.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/**
 * "₦16,000.00 (90 min session)": the caregiver's own earning (`caregiver_earning`, from the terms copied onto the booking) and
 * the session length. Null when the booking carries no earning, which is every offer before it is accepted: the booking's
 * total is what the family pays and is never shown here.
 */
export function sessionLine(booking: Pick<Booking, "caregiver_earning" | "duration_minutes">): string | null {
  if (booking.caregiver_earning == null) return null;
  return `${formatNaira(booking.caregiver_earning)} (${booking.duration_minutes} min session)`;
}

/** The label of the card button that opens the visit steps; null once the visit is over. */
export function startLabel(status: string): "Start Service" | "Continue Service" | null {
  if (status === "accepted" || status === "en_route") return "Start Service";
  if (status === "in_progress") return "Continue Service";
  return null;
}
