import { create } from "zustand";

interface PaymentReturnState {
  /** Bookings whose checkout the person has just come back from; the result screen of each takes its entry and asks the backend. */
  pending: Record<string, true>;
  signal: (bookingId: string) => void;
  consume: (bookingId: string) => void;
}

/**
 * "The person came back from the payment page" (the payment return link was opened), for the result screen of that booking to
 * pick up, whether it was already on screen or is only opened because of the link. It carries no payment result: the screen
 * answers it by asking the backend.
 */
export const usePaymentReturn = create<PaymentReturnState>((set) => ({
  pending: {},
  signal: (bookingId) => set((s) => ({ pending: { ...s.pending, [bookingId]: true } })),
  consume: (bookingId) =>
    set((s) => {
      const { [bookingId]: _taken, ...rest } = s.pending;
      return { pending: rest };
    }),
}));
