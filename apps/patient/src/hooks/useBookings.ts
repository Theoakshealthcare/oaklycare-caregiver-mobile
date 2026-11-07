import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Booking, BookingDraft, BookingQuote, CancelTerms, ChatMessage } from "@/src/domain/booking";
import { sampleBookings, sampleChat } from "@/src/fixtures/bookings";

import { sampleKeys, useFixtureQuery } from "./fixture";

/** Sample data until the booking slice reads `GET /booking/patient/bookings`. */
export function useBookings() {
  return useFixtureQuery(["bookings"], () => sampleBookings());
}

/** One booking, from the same cache as the list. */
export function useBooking(id: string) {
  const list = useBookings();
  return { ...list, data: list.data?.find((b) => b.id === id) };
}

/** What canceling costs right now (free / 20% / 50%). Sample: always the 20% tier. */
export function useCancelTerms(id: string) {
  const booking = useBooking(id);
  const terms: CancelTerms | undefined = booking.data && {
    feePercent: 20,
    feeAmount: Math.round(booking.data.amount * 0.2),
    refundAmount: booking.data.amount - Math.round(booking.data.amount * 0.2),
  };
  return { ...booking, data: terms };
}

export function useCancelBooking(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      client.setQueryData<Booking[]>(sampleKeys.bookings, (list) =>
        list?.map((b) => (b.id === id ? { ...b, status: "cancelled", visitCode: null, paymentStatus: "refunded" } : b)),
      );
    },
  });
}

/** The price shown on the summary. Sample: a flat hourly rate. */
export function useBookingQuote(draft: BookingDraft) {
  const hours = Number(draft.durationHours) || 0;
  return useFixtureQuery<BookingQuote>(["quote", draft.durationHours], () => ({ amount: hours * 6250 }));
}

/** Creates the booking and answers with its id. Sample: adds it to the list as an unpaid, pending booking. */
export function useCreateBooking() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (draft: BookingDraft): Promise<string> => {
      const id = `sample-new-${Date.now()}`;
      const created: Booking = {
        id,
        reference: "OC-NEW",
        service: draft.service,
        bookingFor: draft.forWhom,
        scheduledAt: new Date().toISOString(),
        durationHours: Number(draft.durationHours) || 1,
        address: draft.address,
        amount: (Number(draft.durationHours) || 1) * 6250,
        paymentStatus: "pending",
        status: "pending",
        dispatchState: "dispatching",
        caregiver: null,
        visitCode: null,
      };
      client.setQueryData<Booking[]>(sampleKeys.bookings, (list) => [created, ...(list ?? [])]);
      return id;
    },
  });
}

/** Sample chat for a booking. */
export function useChat(bookingId: string) {
  return useFixtureQuery(["chat", bookingId], () => sampleChat());
}

export function useSendMessage(bookingId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (text: string) => {
      const message: ChatMessage = { id: `m-${Date.now()}`, from: "me", text, sentAt: new Date().toISOString() };
      client.setQueryData<ChatMessage[]>(sampleKeys.chat(bookingId), (list) => [...(list ?? []), message]);
    },
  });
}
