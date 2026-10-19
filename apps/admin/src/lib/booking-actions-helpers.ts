import type { BookingActionResult, CancelTier } from "@/lib/bookings";

export const TIER_LABELS: Record<CancelTier, string> = {
  free: "Free cancellation",
  standard: "Standard fee",
  late: "Late fee",
};

/** "Offered to 2 caregivers." / "Offered to 1 caregiver." */
export function offeredText(count: number): string {
  return `Offered to ${count} caregiver${count === 1 ? "" : "s"}.`;
}

export function isNoOneAvailable(result: Pick<BookingActionResult, "notified_caregivers">): boolean {
  return result.notified_caregivers === 0;
}
