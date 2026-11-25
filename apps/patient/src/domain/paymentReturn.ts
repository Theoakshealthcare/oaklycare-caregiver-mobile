/**
 * The link the backend's payment return page ("Return to the app", `GET /api/v1/payment/callback`) opens once Paystack is done.
 * The app's scheme is `oaklypatient` (app.json).
 */
export const PAYMENT_RETURN_URL = "oaklypatient://payment-complete";

export interface PaymentReturn {
  /** The booking named by the link (`?booking_id=` or `?bookingId=`), when it names one; today's page links without it. */
  bookingId: string | null;
}

/**
 * Reads a URL the app was opened with. Null for anything that is not the payment return link (other links are none of this
 * code's business). The link means only "the person is back from the checkout": it never says the payment succeeded, the
 * backend is asked as always (`usePaymentCheck`).
 */
export function parsePaymentReturn(url: string | null | undefined): PaymentReturn | null {
  if (!url) return null;
  const match = /^oaklypatient:\/\/payment-complete\/?(?:\?([^#]*))?(?:#.*)?$/i.exec(url.trim());
  if (!match) return null;
  const query = match[1] ?? "";
  for (const pair of query.split("&")) {
    const [key, value = ""] = pair.split("=");
    if ((key === "booking_id" || key === "bookingId") && value) {
      try {
        return { bookingId: decodeURIComponent(value) };
      } catch {
        return { bookingId: null };
      }
    }
  }
  return { bookingId: null };
}
