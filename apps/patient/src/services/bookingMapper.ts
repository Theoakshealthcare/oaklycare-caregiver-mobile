import type { Schemas } from "@oakly/api-client";

import type { Booking, BookingDraft, BookingQuote, CancelResult, CancelTerms, Refund } from "@/src/domain/booking";
import { firstNameOf } from "@/src/domain/names";
import { toLocalDate } from "@/src/domain/slots";

type BookingResponse = Schemas["BookingResponse"];

const SERVICE_LABELS: Record<string, string> = {
  nurse: "Nurse visit",
  doctor: "Doctor visit",
  physiotherapist: "Physiotherapy visit",
  caregiver: "Caregiver visit",
  nutritionist: "Nutrition consult",
};

const refundOf = (refund: BookingResponse["refund"]): Refund | null =>
  refund ? { status: refund.status, amount: refund.amount ?? null } : null;

export function toBooking(b: BookingResponse): Booking {
  const place = [b.patient_address, b.patient_city, b.patient_state].filter((part): part is string => Boolean(part));
  return {
    id: b.id,
    reference: b.booking_code,
    service: SERVICE_LABELS[b.service_type] ?? b.service_type,
    bookingFor: b.booking_for,
    scheduledAt: b.scheduled_date.endsWith("Z") || /[+-]\d\d:\d\d$/.test(b.scheduled_date) ? b.scheduled_date : `${b.scheduled_date}Z`,
    durationHours: b.duration_hours,
    address: place.join(", "),
    amount: b.total_amount,
    paymentStatus: b.payment_status,
    status: b.status,
    dispatchState: b.dispatch_state === "dispatching" || b.dispatch_state === "matched" || b.dispatch_state === "unmatched" ? b.dispatch_state : null,
    caregiver: b.caregiver_details?.full_name ? { firstName: firstNameOf(b.caregiver_details.full_name) } : null,
    visitCode: b.visit_code ?? null,
    cancelFee: b.cancel_fee ?? null,
    cancelFeeTier: b.cancel_fee_tier ?? null,
    refund: refundOf(b.refund),
  };
}

export function toQuote(p: Schemas["BookingPreviewResponse"]): BookingQuote {
  return {
    serviceFee: p.service_fee,
    platformFee: p.platform_fee,
    total: p.total_amount,
    surgeActive: p.surge_pricing_active,
    surgeMultiplier: p.surge_multiplier ?? null,
    discountActive: p.discount_active,
    discountPercent: p.discount_percent ?? null,
    peakHoursWarning: p.peak_hours_warning ?? null,
  };
}

/** Language and gender preference have no backend field, so they ride along inside the special instructions text. */
export function specialInstructions(draft: Pick<BookingDraft, "instructions" | "genderPreference" | "languagePreference">): string | null {
  const lines = [draft.instructions.trim()];
  if (draft.genderPreference && draft.genderPreference !== "any") lines.push(`Preferred caregiver gender: ${draft.genderPreference}`);
  if (draft.languagePreference && draft.languagePreference !== "any") lines.push(`Preferred language: ${draft.languagePreference}`);
  const text = lines.filter(Boolean).join("\n");
  return text || null;
}

export function toCreateBody(draft: BookingDraft): Schemas["BookingCreate"] {
  if (draft.latitude === null || draft.longitude === null) throw new Error("The booking has no location.");
  return {
    service_type: "nurse",
    assistance_type: draft.assistance.trim(),
    condition: draft.condition.trim() || null,
    duration_hours: Number(draft.durationHours),
    scheduled_date: toLocalDate(draft.date, draft.time).toISOString(),
    patient_address: draft.address.trim(),
    patient_latitude: draft.latitude,
    patient_longitude: draft.longitude,
    patient_city: draft.city.trim(),
    patient_state: draft.state.trim(),
    special_instructions: specialInstructions(draft),
    booking_for: draft.forWhom.trim(),
  };
}

export function toCancelTerms(t: Schemas["CancelTermsResponse"]): CancelTerms {
  return {
    bookingId: t.booking_id,
    canCancel: t.can_cancel,
    reason: t.reason ?? null,
    message: t.message ?? null,
    feeTier: t.fee_tier,
    feePercent: t.fee_percent,
    feeAmount: t.fee_amount,
    feeAmountKobo: t.fee_amount_kobo,
    paidAmount: t.paid_amount,
    refundableAmount: t.refundable_amount,
    refundWillBeQueued: t.refund_will_be_queued,
    caregiverAssigned: t.caregiver_assigned,
    policy: t.policy
      ? {
          freeHours: t.policy.free_hours,
          lateHours: t.policy.late_hours,
          feePercent: t.policy.fee_percent,
          lateFeePercent: t.policy.late_fee_percent,
        }
      : null,
  };
}

export function toCancelResult(r: Schemas["CancelBookingResponse"]): CancelResult {
  return {
    bookingId: r.booking_id,
    alreadyCancelled: r.already_cancelled,
    feeTier: r.fee_tier,
    feeAmount: r.fee_amount,
    paidAmount: r.paid_amount,
    refundableAmount: r.refundable_amount,
    refundQueued: r.refund_queued,
    refund: refundOf(r.refund),
  };
}
