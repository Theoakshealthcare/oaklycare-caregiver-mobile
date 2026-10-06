import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/src/api/keys";
import { useSession } from "@/src/auth";
import { authService } from "@/src/services/auth.service";
import { bookingService, type BookingAction } from "@/src/services/booking.service";
import { caregiverService } from "@/src/services/caregiver.service";

function useSignedIn(): boolean {
  return useSession((s) => s.status === "signedIn");
}

export function useMe() {
  const enabled = useSignedIn();
  return useQuery({ queryKey: queryKeys.me, queryFn: authService.getMe, enabled });
}

export function useVerificationStatus(enabled = true, refetchInterval?: number) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: queryKeys.verificationStatus,
    queryFn: caregiverService.getVerificationStatus,
    enabled: signedIn && enabled,
    refetchInterval,
  });
}

export function useFormOptions() {
  return useQuery({ queryKey: queryKeys.formOptions, queryFn: caregiverService.getFormOptions, staleTime: Infinity });
}

/** The three lists on the bookings screen. */
export type BookingsTab = "new_requests" | "upcoming" | "completed";

export function useBookingsTab(tab: BookingsTab) {
  return useQuery({
    queryKey: queryKeys.bookings(tab),
    queryFn: () =>
      tab === "upcoming"
        ? bookingService.listActive()
        : bookingService.listCaregiverBookings(tab === "completed" ? "completed" : "new_requests"),
  });
}

export function useBooking(bookingId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.booking(bookingId),
    queryFn: () => bookingService.getBooking(bookingId),
    enabled,
  });
}

/** accept / decline. Always refetches the lists afterwards, also on failure (a 409 means the list is stale). */
export function useBookingAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: { bookingId: string; action: BookingAction }) => bookingService.act(vars.bookingId, vars.action),
    onSettled: (_data, _error, vars) => {
      void client.invalidateQueries({ queryKey: queryKeys.allBookings });
      void client.invalidateQueries({ queryKey: queryKeys.booking(vars.bookingId) });
    },
  });
}

export function useChatMessages(bookingId: string) {
  return useQuery({
    queryKey: queryKeys.chat(bookingId),
    queryFn: () => bookingService.listChatMessages(bookingId),
    refetchInterval: 5_000,
  });
}

export function useSendChatMessage(bookingId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => bookingService.sendChatMessage(bookingId, message),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.chat(bookingId) }),
  });
}

export function useNotes(bookingId: string) {
  return useQuery({ queryKey: queryKeys.notes(bookingId), queryFn: () => bookingService.listNotes(bookingId) });
}

export function useCreateNote(bookingId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: { title: string; content: string }) =>
      bookingService.createNote(bookingId, vars.title, vars.content),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.notes(bookingId) }),
  });
}
