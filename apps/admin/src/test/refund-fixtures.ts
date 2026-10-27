import type { Refund, RefundDetail } from "@/lib/refunds";

// Shapes copied from the backend's live captures (guide section 12.12: 307 list, 313 detail, 365 take-back preview,
// 373 failed, 352 needs attention, 392 needs review); ids, codes and names are placeholders.
export const REFUND_ID = "7903c1f2-5fbd-4628-aab9-b5ce9e83a600";
export const BOOKING_ID = "4ec47135-8b9b-46cc-83d5-92f12d18b440";

export function makeRefund(overrides: Partial<Refund> = {}): Refund {
  return {
    id: REFUND_ID,
    booking_id: BOOKING_ID,
    booking_code: "780212EB",
    status: "pending_approval",
    reason_code: "admin_cancelled",
    origin: "system",
    suggested_amount_naira: 12000.0,
    amount_naira: null,
    destination: null,
    take_back_from_caregiver: false,
    take_back_naira: 0.0,
    failure_reason: null,
    note: null,
    rejected_reason: null,
    requested_by: null,
    approved_by: null,
    review_flagged_at: null,
    review_reason: null,
    created_at: "2026-10-21T14:29:06.229633",
    approved_at: null,
    processed_at: null,
    max_approvable_naira: 50000.0,
    available_actions: ["approve", "reject"],
    ...overrides,
  };
}

export function makeDetail(overrides: Partial<RefundDetail> = {}): RefundDetail {
  return {
    ...makeRefund({ suggested_amount_naira: 55000.0 }),
    booking: {
      code: "780212EB",
      status: "cancelled",
      channel: "app",
      cancel_fee_tier: null,
      cancel_fee_naira: null,
      caregiver_assigned: false,
      caregiver_arrived: false,
      completed: false,
      total_naira: 55000.0,
      paystack_fee_naira: 825.0,
      refunded_naira: 0.0,
      refundable_naira: 55000.0,
    },
    suggestion_why: "Set by the admin who cancelled the booking.",
    attempts: [],
    take_back_reason: null,
    take_back_preview_naira: 0.0,
    take_back_debited_naira: null,
    take_back_owed_naira: null,
    needs_super_admin: true,
    limit_naira: 50000.0,
    ...overrides,
  };
}

export const ATTEMPT = {
  attempt: 1,
  status: "failed",
  failure_reason: "Paystack reported the refund as failed",
  paystack_refund_id: "1005",
  bank_code: null,
  account_last4: null,
  account_name: null,
  bank_details_submitted_at: null,
  created_at: "2026-10-21T14:29:17.801827",
};

/** Capture 373: a failed refund of a WhatsApp booker (no wallet to switch to). */
export const FAILED = makeDetail({
  status: "failed",
  amount_naira: 55000.0,
  destination: "original_method",
  failure_reason: "Paystack reported the refund as failed",
  attempts: [ATTEMPT],
  available_actions: ["retry", "close"],
  booking: { ...makeDetail().booking, channel: "whatsapp", refunded_naira: 55000.0, refundable_naira: 0.0 },
});

/** Capture 365: a completed visit with the take-back preview. */
export const COMPLETED = makeDetail({
  suggested_amount_naira: 20000.0,
  max_approvable_naira: 50000.0,
  needs_super_admin: false,
  take_back_preview_naira: 14545.45,
  booking: { ...makeDetail().booking, code: "A18FA979", status: "completed", caregiver_assigned: true, caregiver_arrived: true, completed: true },
});

/** Capture 352 / 358: waiting for the family's bank details; holder fields are null for roles without access. */
export const NEEDS_ATTENTION = makeDetail({
  status: "needs_attention",
  amount_naira: 20000.0,
  destination: "original_method",
  needs_super_admin: false,
  attempts: [{ ...ATTEMPT, status: "needs_attention", failure_reason: null, paystack_refund_id: "1001" }],
  available_actions: ["bank_details"],
});

/** Capture 392: Paystack processed 54,000.00 where Oakly asked for 55,000.00. */
export const NEEDS_REVIEW = makeDetail({
  status: "needs_review",
  amount_naira: 55000.0,
  destination: "original_method",
  failure_reason: "Paystack reported processed for 5400000 kobo, but this refund is 5500000 kobo.",
  review_flagged_at: "2026-10-21T14:29:21.705900",
  review_reason: "Paystack reported processed for 5400000 kobo, but this refund is 5500000 kobo.",
  available_actions: ["resolve"],
});
