import { create } from "zustand";

interface PaymentLinks {
  urls: Record<string, string>;
  remember: (bookingId: string, url: string) => void;
  forget: (bookingId: string) => void;
  clear: () => void;
}

/**
 * The Paystack checkout URL of each booking created on this phone, so an unpaid booking can be paid from the list.
 * `POST /booking/create` is the only call that returns the URL (no endpoint gives a fresh one), so it lives in memory
 * only: nothing is written to disk, it is cleared on sign-out, and after an app restart "Pay now" has no link to open.
 */
export const usePaymentLinks = create<PaymentLinks>((set) => ({
  urls: {},
  remember: (bookingId, url) => set((s) => ({ urls: { ...s.urls, [bookingId]: url } })),
  forget: (bookingId) =>
    set((s) => {
      const { [bookingId]: _gone, ...rest } = s.urls;
      return { urls: rest };
    }),
  clear: () => set({ urls: {} }),
}));
