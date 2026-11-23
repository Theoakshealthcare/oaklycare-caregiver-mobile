import type { Schemas } from "@oakly/api-client";

import { api } from "@/src/api/client";
import { ApiError } from "@/src/api/errors";
import { unwrap } from "@/src/api/unwrap";
import type { BookableService, Booking, BookingDraft, BookingQuote, CancelResult, CancelTerms } from "@/src/domain/booking";

import { toBookableServices, toBooking, toCancelResult, toCancelTerms, toCreateBody, toQuote } from "./bookingMapper";

/** What `POST /booking/create` gives back: the booking, and where to pay for it. */
export interface CreatedBooking {
  booking: Booking;
  /** The Paystack checkout URL. Only this response carries it; no other endpoint gives it again. */
  paymentUrl: string | null;
  /** Set when the payment could not be started: the backend cancelled the booking and marked payment failed. */
  paymentError: string | null;
}

/**
 * What `POST /booking/booking/{id}/verify-payment` says. The route is untyped in the OpenAPI (it answers `unknown`),
 * so the shape is read from the live responses in `backend/docs/fe-captures` and the route's code: `status` is
 * "success" (paid), "pending" (Paystack says not paid yet) or "error" (Paystack could not confirm).
 */
export type PaymentCheck =
  | { kind: "paid" }
  /** Paid, but the booking stays cancelled (the payment link had expired): a refund is coming. */
  | { kind: "paid_refund_required" }
  /** `paystackStatus` is Paystack's own word when the answer carries one ("abandoned": the checkout was left; "failed"). */
  | { kind: "not_paid"; message: string; paystackStatus: string | null };

export function readPaymentCheck(body: unknown): PaymentCheck {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (b.status === "success" && b.refund_required === true) return { kind: "paid_refund_required" };
  if (b.status === "success" && b.payment_status === "paid") return { kind: "paid" };
  return {
    kind: "not_paid",
    message: typeof b.message === "string" ? b.message : "Payment not confirmed yet",
    paystackStatus: typeof b.payment_status === "string" ? b.payment_status : null,
  };
}

/** `detail.terms` of a `409 terms_changed`: the new fee to show before asking again. Null for any other error. */
export function termsFromChangedError(error: unknown): CancelTerms | null {
  if (!(error instanceof ApiError) || error.code !== "terms_changed") return null;
  const detail = (error.body as { detail?: { terms?: Parameters<typeof toCancelTerms>[0] } }).detail;
  return detail?.terms ? toCancelTerms(detail.terms) : null;
}

export const bookingService = {
  /** The price. Public route; location is optional but changes surge pricing and availability. */
  async preview(input: { serviceType: string; durationMinutes: number; latitude: number | null; longitude: number | null }): Promise<BookingQuote> {
    const body = await unwrap(
      api.POST("/api/v1/booking/preview", {
        body: {
          service_type: input.serviceType as Schemas["BookingPreviewRequest"]["service_type"],
          duration_minutes: input.durationMinutes,
          patient_latitude: input.latitude,
          patient_longitude: input.longitude,
        },
      }),
    );
    return toQuote(body);
  },

  /** The services on sale now (enabled and priced) with the visit lengths each allows. No prices. */
  async services(): Promise<BookableService[]> {
    return toBookableServices(await unwrap(api.GET("/api/v1/booking/services")));
  },

  async create(draft: BookingDraft): Promise<CreatedBooking> {
    const body = await unwrap(api.POST("/api/v1/booking/create", { body: toCreateBody(draft) }));
    return { booking: toBooking(body), paymentUrl: body.payment_url ?? null, paymentError: body.payment_error ?? null };
  },

  async list(): Promise<Booking[]> {
    const body = await unwrap(api.GET("/api/v1/booking/patient/bookings", { params: { query: {} } }));
    return body.map(toBooking);
  },

  /** The detail is the only response that carries the visit code. (The path really has "booking" twice.) */
  async get(id: string): Promise<Booking> {
    const body = await unwrap(api.GET("/api/v1/booking/booking/{booking_id}", { params: { path: { booking_id: id } } }));
    return toBooking(body);
  },

  /**
   * `POST /booking/{id}/payment-link` (no body): a checkout link for an unpaid booking whose `/create` URL this phone no
   * longer has (restart). The booking keeps ONE Paystack reference, so asking again is the same payment. Refusals are
   * `detail = { code, message }`: see `paymentLinkErrorMessage` and `paymentLinkOutcome`. Until the backend stores the
   * Paystack URL at create, a real Paystack may refuse a repeated reference: `503 payment_link_unavailable`.
   */
  async paymentLink(id: string): Promise<{ paymentUrl: string; expiresAt: string | null }> {
    const body = await unwrap(api.POST("/api/v1/booking/{booking_id}/payment-link", { params: { path: { booking_id: id } } }));
    if (!body.payment_url) throw new ApiError(502, { detail: { code: "payment_link_unavailable", message: "" } }, "No payment link in the answer");
    return { paymentUrl: body.payment_url, expiresAt: body.payment_expires_at ?? null };
  },

  async verifyPayment(id: string): Promise<PaymentCheck> {
    const body = await unwrap(
      api.POST("/api/v1/booking/booking/{booking_id}/verify-payment", { params: { path: { booking_id: id } } }),
    );
    return readPaymentCheck(body);
  },

  async cancelTerms(id: string): Promise<CancelTerms> {
    const body = await unwrap(api.GET("/api/v1/booking/{booking_id}/cancel-terms", { params: { path: { booking_id: id } } }));
    return toCancelTerms(body);
  },

  /** Always sends `accepted_fee_kobo`: if the fee is higher by now nothing is cancelled and the answer is 409 `terms_changed`. */
  async cancel(id: string, input: { acceptedFeeKobo: number; reason?: string }): Promise<CancelResult> {
    const body = await unwrap(
      api.POST("/api/v1/booking/{booking_id}/cancel", {
        params: { path: { booking_id: id } },
        body: { accepted_fee_kobo: input.acceptedFeeKobo, ...(input.reason ? { reason: input.reason } : {}) },
      }),
    );
    return toCancelResult(body);
  },
};
