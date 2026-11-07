import type { AppNotification } from "@/src/domain/notifications";

/** Placeholder feed until the notifications slice reads the patient feed. */
export function sampleNotifications(now = Date.now()): AppNotification[] {
  return [
    {
      id: "n1",
      title: "Caregiver assigned",
      body: "A caregiver has accepted your booking OC-10001.",
      receivedAt: new Date(now - 3_600_000).toISOString(),
      read: false,
    },
    {
      id: "n2",
      title: "Payment received",
      body: "Your payment for booking OC-10002 was successful.",
      receivedAt: new Date(now - 26 * 3_600_000).toISOString(),
      read: true,
    },
  ];
}
