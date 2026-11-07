import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { queryKeys } from "@/src/api/keys";
import { ApiError, messageForError } from "@/src/api/errors";
import { bookingService } from "@/src/services/booking.service";

import { usePaymentLinks } from "./paymentLinks";

/** After the checkout closes: ask the backend up to this many times, this far apart, then say it is not confirmed yet. */
export const paymentPolling = { attempts: 6, intervalMs: 3_000 };

export type PaymentState =
  /** Nothing asked yet (the checkout is open, or has not been opened). */
  | { kind: "waiting" }
  | { kind: "checking"; attempt: number }
  | { kind: "paid" }
  /** Paid, but the booking stays cancelled (the payment link had expired): a refund is coming. */
  | { kind: "paid_refund_required" }
  /** The cap ran out, or the backend could not be asked. Nothing is marked paid. */
  | { kind: "not_confirmed"; message: string | null };

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Confirms a payment by asking the backend (`verify-payment`), never by trusting that the browser closed: a checkout
 * that was cancelled or dismissed answers "not paid" and nothing changes. `check()` polls with a cap and settles on
 * "paid" or "not_confirmed"; a second call while one is running is ignored.
 */
export function usePaymentCheck(bookingId: string) {
  const client = useQueryClient();
  const forget = usePaymentLinks((s) => s.forget);
  const [state, setState] = useState<PaymentState>({ kind: "waiting" });
  const running = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const check = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    let lastError: string | null = null;
    try {
      for (let attempt = 1; attempt <= paymentPolling.attempts; attempt++) {
        if (!alive.current) return;
        setState({ kind: "checking", attempt });
        try {
          const result = await bookingService.verifyPayment(bookingId);
          lastError = null;
          if (result.kind === "paid" || result.kind === "paid_refund_required") {
            forget(bookingId);
            void client.invalidateQueries({ queryKey: queryKeys.bookings });
            if (alive.current) setState({ kind: result.kind });
            return;
          }
        } catch (error) {
          lastError = messageForError(error);
          // A refusal (not your booking, amount mismatch, no payment reference) will not change by asking again.
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) break;
        }
        if (attempt < paymentPolling.attempts) await wait(paymentPolling.intervalMs);
      }
      if (alive.current) setState({ kind: "not_confirmed", message: lastError });
    } finally {
      running.current = false;
    }
  }, [bookingId, client, forget]);

  return { state, check };
}
