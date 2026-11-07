import { useIsFocused } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { queryKeys } from "@/src/api/keys";
import { isActive, type Booking, type BookingDraft, type CancelResult } from "@/src/domain/booking";
import { bookingService, type CreatedBooking } from "@/src/services/booking.service";

import { usePaymentLinks } from "./paymentLinks";

/** How often the open detail of an active booking is read again (the visit code and the status live there). */
export const detailRefresh = { intervalMs: 20_000 };

/** How often the lists are read again while one is in front and a booking in them is still moving. */
export const listRefresh = { intervalMs: 20_000 };

/**
 * The patient's bookings, newest first (`GET /booking/patient/bookings`). The list never carries the visit code.
 *
 * A screen of tabs stays mounted, so "the app came back to the foreground" is not the only moment it can be out of date:
 * showing the screen again reads the list if it has gone stale (a caregiver may have accepted, or the visit ended, while the
 * patient was elsewhere in the app), and while a booking is still moving the screen in front keeps reading it.
 */
export function useBookings() {
  const focused = useIsFocused();
  const query = useQuery({
    queryKey: queryKeys.bookings,
    queryFn: bookingService.list,
    refetchInterval: (q) => (focused && q.state.data?.some(isActive) ? listRefresh.intervalMs : false),
  });
  const { isStale, isFetching, refetch } = query;
  useEffect(() => {
    if (focused && isStale && !isFetching) void refetch();
    // Only the moment the screen comes to the front matters here; a read already running is left alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);
  return query;
}

/**
 * One booking from `GET /booking/booking/{id}`: the only response that carries the visit code. While the screen is
 * focused and the booking is still active (looking for a caregiver, accepted, on the way, in progress) it is read again every 20 s;
 * a booking that is over, or a screen that is not in front, never polls.
 */
export function useBooking(id: string) {
  const focused = useIsFocused();
  return useQuery({
    queryKey: queryKeys.booking(id),
    queryFn: () => bookingService.get(id),
    refetchInterval: (query) => (focused && query.state.data && isActive(query.state.data) ? detailRefresh.intervalMs : false),
  });
}

/** The price from the backend preview. Never computed on the device. */
export function useBookingQuote(draft: BookingDraft) {
  const hours = Number(draft.durationHours) || 0;
  return useQuery({
    queryKey: queryKeys.quote(hours, draft.latitude, draft.longitude),
    queryFn: () => bookingService.preview({ durationHours: hours, latitude: draft.latitude, longitude: draft.longitude }),
    enabled: hours >= 1 && hours <= 24,
  });
}

/** Creates the booking. The checkout URL is kept (in memory) so "Pay now" can open it again. */
export function useCreateBooking() {
  const client = useQueryClient();
  const remember = usePaymentLinks((s) => s.remember);
  return useMutation({
    mutationFn: (draft: BookingDraft): Promise<CreatedBooking> => bookingService.create(draft),
    onSuccess: ({ booking, paymentUrl }) => {
      if (paymentUrl) remember(booking.id, paymentUrl);
      client.setQueryData<Booking>(queryKeys.booking(booking.id), booking);
      void client.invalidateQueries({ queryKey: queryKeys.bookings });
    },
  });
}

/** What canceling costs right now. Never reused from the cache: the fee changes as the visit gets closer. */
export function useCancelTerms(id: string) {
  return useQuery({
    queryKey: queryKeys.cancelTerms(id),
    queryFn: () => bookingService.cancelTerms(id),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

/** Cancels, sending the fee the person saw. The booking is read again afterwards: its refund summary is the truth. */
export function useCancelBooking(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { acceptedFeeKobo: number; reason?: string }): Promise<CancelResult> => bookingService.cancel(id, input),
    onSuccess: (result) => {
      client.setQueryData<Booking>(queryKeys.booking(id), (booking) =>
        booking
          ? { ...booking, status: "cancelled", visitCode: null, cancelFee: result.feeAmount, cancelFeeTier: result.feeTier, refund: result.refund }
          : booking,
      );
      void client.invalidateQueries({ queryKey: queryKeys.booking(id) });
      void client.invalidateQueries({ queryKey: queryKeys.bookings });
    },
  });
}
