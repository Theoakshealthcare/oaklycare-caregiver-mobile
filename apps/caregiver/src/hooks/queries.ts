import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/src/api/keys";
import { useSession } from "@/src/auth";
import { authService } from "@/src/services/auth.service";
import { homePollInterval } from "@/src/home/homeModel";
import { bookingService, type BookingAction, type VisitAction } from "@/src/services/booking.service";
import { caregiverService } from "@/src/services/caregiver.service";
import { notificationService } from "@/src/services/notification.service";
import { walletService, type BankAccountInput } from "@/src/services/wallet.service";
import { locationService } from "@/src/supply/locationService";

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

export function useBooking(bookingId: string, enabled = true, refetchInterval?: number) {
  return useQuery({
    queryKey: queryKeys.booking(bookingId),
    queryFn: () => bookingService.getBooking(bookingId),
    enabled,
    refetchInterval,
  });
}

/**
 * GET /caregiver/home: the whole home screen in one call. Polled per the guide (section 13):
 * every 20 s while available or on a visit, every 60 s otherwise; also refetched when the app comes
 * to the foreground (`src/api/focus.ts`) and when the screen regains focus.
 */
export function useCaregiverHome() {
  const enabled = useSignedIn();
  return useQuery({
    queryKey: queryKeys.home,
    queryFn: locationService.getHome,
    enabled,
    refetchInterval: (query) => homePollInterval(query.state.data),
    staleTime: 10_000,
  });
}

/**
 * accept / decline / on_my_way / start / complete. Always refetches the lists and home afterwards,
 * also on failure (a 409 means what is on screen is stale).
 */
export function useBookingAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: { bookingId: string; action: BookingAction | VisitAction; visitCode?: string }) =>
      bookingService.act(vars.bookingId, vars.action, vars.visitCode),
    onSettled: (_data, _error, vars) => {
      void client.invalidateQueries({ queryKey: queryKeys.allBookings });
      void client.invalidateQueries({ queryKey: queryKeys.booking(vars.bookingId) });
      void client.invalidateQueries({ queryKey: queryKeys.home });
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

export function useNotifications() {
  const enabled = useSignedIn();
  return useQuery({ queryKey: queryKeys.notifications, queryFn: notificationService.list, enabled });
}

export function useCaregiverProfile() {
  const enabled = useSignedIn();
  return useQuery({ queryKey: queryKeys.caregiverProfile, queryFn: caregiverService.getProfile, enabled });
}

export function useWallet() {
  const enabled = useSignedIn();
  return useQuery({ queryKey: queryKeys.wallet, queryFn: walletService.getWallet, enabled });
}

export function useWalletTransactions(month: string) {
  const enabled = useSignedIn();
  return useQuery({
    queryKey: queryKeys.walletTransactions(month),
    queryFn: () => walletService.getTransactions(month),
    enabled,
  });
}

/** `null` data means no account is saved yet (404), not an error. */
export function useBankAccount() {
  const enabled = useSignedIn();
  return useQuery({ queryKey: queryKeys.bankAccount, queryFn: walletService.getBankAccount, enabled });
}

/** The bank list changes rarely (the backend caches it for a day), so keep it for the session. */
export function useBanks(enabled = true) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: queryKeys.banks,
    queryFn: walletService.getBanks,
    enabled: signedIn && enabled,
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useResolveBankAccount() {
  return useMutation({ mutationFn: (input: BankAccountInput) => walletService.resolveBankAccount(input) });
}

/** Saving can pause payouts for 24 h, so the wallet is refetched too (it carries `payouts_blocked_until`). */
export function useSaveBankAccount() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: BankAccountInput) => walletService.updateBankAccount(input),
    onSuccess: (account) => {
      client.setQueryData(queryKeys.bankAccount, account);
      void client.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });
}
