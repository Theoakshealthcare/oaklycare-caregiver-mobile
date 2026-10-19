import type { BatchDetail, Payout } from "@/lib/payouts";

// Shapes copied from the backend's live captures (187-payout-batch-detail, 248-payouts-list-needs-attention,
// 185-payout-batches-list); ids, names and account numbers are placeholders.
export function makePayout(overrides: Partial<Payout> = {}): Payout {
  return {
    id: "05e5c555-de52-4080-8071-575e11acb302",
    batch_id: "240f7286-ecd6-4511-ab8a-32a5b75c967e",
    batch_period: "2026-10-19",
    caregiver_id: "3302d88e-e1e4-482d-90d5-c636d2afb9c4",
    caregiver_name: "Placeholder Paid",
    amount_kobo: 1200000,
    status: "pending_approval",
    bank_name: "Placeholder Bank",
    account_number: "******0011",
    account_name: "PLACEHOLDER PAID",
    reference: "po-05e5c555de5240808071575e11acb302-1",
    transfer_code: null,
    attempts: 1,
    attempt_history: [
      {
        attempt: 1,
        reference: "po-05e5c555de5240808071575e11acb302-1",
        status: "pending",
        failure_reason: null,
        created_at: "2026-10-12T16:52:06.582997",
      },
    ],
    shortfall_kobo: 0,
    returned_kobo: 0,
    netted_kobo: 0,
    caregiver_payouts_frozen_at: null,
    caregiver_payouts_frozen_reason: null,
    failure_reason: null,
    initiated_at: null,
    completed_at: null,
    approved_by: null,
    approved_at: null,
    cancelled_by: null,
    cancelled_at: null,
    cancel_reason: null,
    created_at: "2026-10-12T16:52:06.580618",
    ...overrides,
  };
}

export const BATCH_ID = "240f7286-ecd6-4511-ab8a-32a5b75c967e";

export function makeBatchDetail(payouts: Payout[], overrides: Partial<BatchDetail> = {}): BatchDetail {
  const live = payouts.filter((p) => p.status !== "cancelled");
  const counts: Record<string, number> = {};
  for (const p of payouts) counts[p.status] = (counts[p.status] ?? 0) + 1;
  return {
    id: BATCH_ID,
    period_key: "2026-10-19",
    cadence: "weekly",
    min_payout_kobo: 500000,
    status: "pending_approval",
    approved_by: null,
    approved_at: null,
    approval_reason: null,
    created_at: "2026-10-12T16:52:06.569281",
    payout_count: payouts.length,
    total_kobo: live.reduce((s, p) => s + p.amount_kobo, 0),
    counts,
    payouts,
    ...overrides,
  };
}

export const FAILING = makePayout({
  id: "93d04961-704d-4177-abfa-39f35a0b7b76",
  caregiver_id: "86f02657-cb3e-40b0-8870-a924cd8ff1d9",
  caregiver_name: "Placeholder Failing",
  amount_kobo: 3000000,
  status: "failed",
  failure_reason: "Paystack refused the transfer: Your balance is not enough to fulfil this request",
  attempt_history: [
    {
      attempt: 1,
      reference: "po-93d04961704d4177abfa39f35a0b7b76-1",
      status: "refused",
      failure_reason: "Paystack refused the transfer: Your balance is not enough to fulfil this request",
      created_at: "2026-10-12T16:52:06.591410",
    },
  ],
});

export const LATE_SUCCESS = makePayout({
  id: "b10cabbd-4b38-450f-8bdd-4ed37ebfbb94",
  caregiver_id: "f33a040b-ed24-4418-b312-80e690394377",
  caregiver_name: "Placeholder Late Success",
  amount_kobo: 1100000,
  status: "needs_attention",
  shortfall_kobo: 800000,
  caregiver_payouts_frozen_at: "2026-10-12T16:52:20.042261",
  caregiver_payouts_frozen_reason:
    "Payout b10cabbd-4b38-450f-8bdd-4ed37ebfbb94: Paystack paid attempt 1 after the payout was marked failed; 300000 kobo was taken back from the available balance, 800000 kobo could not be recovered (shortfall).",
  failure_reason:
    "Paystack reported the transfer as failed Paystack paid attempt 1 after the payout was marked failed; 300000 kobo was taken back from the available balance, 800000 kobo could not be recovered (shortfall).",
});

export const OTP_STUCK = makePayout({
  id: "cb440ea3-64c2-477c-8fb9-b789f993c434",
  caregiver_id: "77897624-ee68-4c1f-9b43-1535ec6f26b7",
  caregiver_name: "Placeholder Stuck At Otp",
  amount_kobo: 1500000,
  status: "processing",
  transfer_code: "TRF_76abe567e61f",
  failure_reason:
    "Paystack is waiting for an OTP to release this transfer. Turn off OTP for transfers made through the API in the Paystack dashboard, then resolve this payout with Paystack.",
});
