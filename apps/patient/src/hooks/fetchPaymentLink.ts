import { paymentLinkOutcome } from "@/src/api/bookingErrors";
import { bookingService } from "@/src/services/booking.service";

/** How long "Pay now" waits for a first request for the same booking that is still running (`409 payment_link_in_progress`). */
export const paymentLinkRetry = { attempts: 3, delayMs: 1_000 };

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Asks the backend for a checkout link for an unpaid booking (`POST /booking/{id}/payment-link`). A request that is still
 * running for the same booking is not an error: it is asked again a second later, a few times. Any other refusal is thrown
 * for the screen to read with `paymentLinkOutcome` / `paymentLinkErrorMessage`.
 */
export async function fetchPaymentLink(bookingId: string): Promise<string> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return (await bookingService.paymentLink(bookingId)).paymentUrl;
    } catch (error) {
      if (paymentLinkOutcome(error) !== "wait" || attempt >= paymentLinkRetry.attempts) throw error;
      await wait(paymentLinkRetry.delayMs);
    }
  }
}
