import type { BankReview } from "@/lib/bank-reviews";

// Shapes copied from the backend's live captures (970-finance-bank-reviews, 972-finance-bank-review-approve,
// 974-finance-bank-review-reject); review tokens are the captured placeholders; ids, names and account numbers are placeholders.
export function makeBankReview(overrides: Partial<BankReview> = {}): BankReview {
  return {
    caregiver_id: "642c0f16-f324-442f-948b-8e5a412208e0",
    caregiver_name: "Placeholder Tosin",
    account_name: "SAMPLE OTHERPERSON",
    bank_name: "Placeholder Bank",
    account_number: "******0011",
    status: "pending",
    balance_kobo: 0,
    submitted_at: "2026-11-25T13:29:55.421264",
    decided_at: null,
    review_token: "ff1f29d3cbc6004970579d8665ce435c",
    ...overrides,
  };
}

export const PENDING = makeBankReview();
/** A second held account, with money in the wallet, to prove rows are decided independently. */
export const PENDING_FUNDED = makeBankReview({
  caregiver_id: "4a1a7d2c-6f0e-4d57-a6a4-1f6a3a6f9c10",
  caregiver_name: "Placeholder Ada",
  account_name: "ANOTHER STRANGER NAME",
  account_number: "******0012",
  balance_kobo: 1250000,
  submitted_at: "2026-11-25T14:02:10.000000",
  review_token: "45697bf411033579c2c8b4166c074da6",
});
export const STALE_MESSAGE = "The caregiver changed their account since you opened it. Refresh and look again.";
export const NOT_WAITING_MESSAGE = "This account is not waiting for a name review";
