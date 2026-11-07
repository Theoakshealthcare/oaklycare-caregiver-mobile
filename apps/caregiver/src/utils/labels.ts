/** Human wording for backend enums, shared so every screen says the same thing (DP1-15). */

const BOOKING_STATUS: Record<string, string> = {
  pending: "Waiting for a caregiver",
  accepted: "Accepted",
  en_route: "On the way",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Declined",
};

export function bookingStatusLabel(status: string): string {
  return BOOKING_STATUS[status] ?? status.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** "nurse" -> "Nurse visit": the same name Home uses for the visit. */
export function serviceName(serviceType: string): string {
  const name = serviceType.replace(/_/g, " ").trim();
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} visit`;
}
