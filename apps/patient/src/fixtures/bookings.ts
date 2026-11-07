import type { Booking, ChatMessage } from "@/src/domain/booking";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Placeholder bookings for the screens until the booking slice reads `GET /booking/patient/bookings`. Dates are
 * relative to now so "upcoming" always is. Names, codes and amounts are made up.
 */
export function sampleBookings(now = Date.now()): Booking[] {
  const at = (offset: number) => new Date(now + offset).toISOString();
  return [
    {
      id: "sample-1",
      reference: "OC-10001",
      service: "Nurse visit",
      bookingFor: "Sample patient",
      scheduledAt: at(DAY),
      durationHours: 4,
      address: "12 Sample Street, Ikeja, Lagos",
      amount: 25000,
      paymentStatus: "paid",
      status: "accepted",
      dispatchState: "matched",
      caregiver: { name: "Sample Nurse" },
      visitCode: "0000",
    },
    {
      id: "sample-2",
      reference: "OC-10002",
      service: "Nurse visit",
      bookingFor: "Sample patient",
      scheduledAt: at(3 * DAY),
      durationHours: 2,
      address: "12 Sample Street, Ikeja, Lagos",
      amount: 12500,
      paymentStatus: "paid",
      status: "pending",
      dispatchState: "dispatching",
      caregiver: null,
      visitCode: null,
    },
    {
      id: "sample-3",
      reference: "OC-10003",
      service: "Nurse visit",
      bookingFor: "Sample patient",
      scheduledAt: at(-5 * DAY),
      durationHours: 3,
      address: "12 Sample Street, Ikeja, Lagos",
      amount: 18750,
      paymentStatus: "paid",
      status: "completed",
      dispatchState: "matched",
      caregiver: { name: "Sample Nurse" },
      visitCode: null,
    },
    {
      id: "sample-4",
      reference: "OC-10004",
      service: "Nurse visit",
      bookingFor: "Sample patient",
      scheduledAt: at(-9 * DAY),
      durationHours: 2,
      address: "12 Sample Street, Ikeja, Lagos",
      amount: 12500,
      paymentStatus: "refunded",
      status: "cancelled",
      dispatchState: null,
      caregiver: null,
      visitCode: null,
    },
  ];
}

export function sampleChat(now = Date.now()): ChatMessage[] {
  return [
    { id: "m1", from: "caregiver", text: "Hello, I have been assigned to your visit.", sentAt: new Date(now - 2 * HOUR).toISOString() },
    { id: "m2", from: "me", text: "Thank you. Please call the gate when you arrive.", sentAt: new Date(now - HOUR).toISOString() },
  ];
}
