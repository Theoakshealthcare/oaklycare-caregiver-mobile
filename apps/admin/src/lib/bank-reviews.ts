/**
 * Payout bank-account name reviews (backend guide section 12.11, "Bank-account name reviews"). A caregiver may save
 * an account whose holder name does not look like their profile name; it is held until Finance approves it.
 * Wire types come from the generated schema. Money is integer kobo; format with `formatNaira` only at the edge.
 */
import { getApi, unwrap } from "@/lib/api";
import { PAGE_SIZE } from "@/lib/payouts";
import type { Schemas } from "@oakly/api-client";

export type BankReview = Schemas["BankReviewOut"];
export type BankReviewStatus = BankReview["status"];

/** The queue is `pending` by default; the others are the audit view of past decisions. */
export const BANK_REVIEW_STATUSES: BankReviewStatus[] = ["pending", "rejected", "approved"];

/** Every bank-review screen shares this key prefix. It sits under the payouts prefix, so one payouts invalidation refreshes it too. */
export const BANK_REVIEWS_KEY = ["payouts", "bank-reviews"] as const;

/**
 * The 409 for a decision on an account that moved on: the caregiver saved another account since the queue loaded, or
 * somebody else already decided it. The server's own sentence tells the reviewer which.
 */
export const isConflict = (e: unknown): e is Error & { status: number } =>
  e instanceof Error && (e as { status?: unknown }).status === 409;

/**
 * The last four digits of the account the reviewer is looking at. The number arrives masked ("******0011"); the
 * backend refuses the decision when these are not the digits of the account it currently holds.
 */
export const accountLast4 = (r: Pick<BankReview, "account_number">) => r.account_number.slice(-4);

export async function fetchBankReviews(params: { status: BankReviewStatus; offset: number }) {
  return unwrap(
    await getApi().GET("/api/v1/admin/payouts/bank-reviews", {
      params: { query: { status: params.status, limit: PAGE_SIZE, offset: params.offset } },
    }),
  );
}

export async function approveBankReview(review: BankReview, reason: string) {
  return unwrap(
    await getApi().POST("/api/v1/admin/payouts/bank-reviews/{caregiver_id}/approve", {
      params: { path: { caregiver_id: review.caregiver_id } },
      body: { reason, account_last4: accountLast4(review) },
    }),
  );
}

export async function rejectBankReview(review: BankReview, reason: string) {
  return unwrap(
    await getApi().POST("/api/v1/admin/payouts/bank-reviews/{caregiver_id}/reject", {
      params: { path: { caregiver_id: review.caregiver_id } },
      body: { reason, account_last4: accountLast4(review) },
    }),
  );
}
