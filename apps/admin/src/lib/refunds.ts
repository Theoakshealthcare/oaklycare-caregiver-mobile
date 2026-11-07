/**
 * Refunds v2 (backend A3 slice 3, guide section 12.12). Wire types come from the generated schema.
 * Unlike bookings and payouts, **money here is naira as a JSON number** (`55000.0`), never kobo: format it with
 * `formatNairaValue`. Every write returns the refund detail, so the screen swaps it in without another read.
 */
import type { Schemas } from "@oakly/api-client";
import type { QueryClient } from "@tanstack/react-query";

import { ApiError, getApi, unwrap } from "@/lib/api";
import { formatNairaValue } from "@/lib/format";

export type Refund = Schemas["RefundOut"];
export type RefundDetail = Schemas["RefundDetail"];
export type RefundStatus = Refund["status"];
export type RefundAction = RefundDetail["available_actions"][number];
export type RefundAttempt = RefundDetail["attempts"][number];
export type RefundReason = Schemas["RefundRequestIn"]["reason_code"];

/** Reads need any one of these (guide table); the server enforces it, the nav and pages mirror it. */
export const REFUNDS_READ = ["refunds.request", "refunds.approve", "payments.read"];
export const REFUNDS_REQUEST = "refunds.request";
/** Only a Super Admin holds this: approving above the Finance limit, switch-to-wallet, resolve. */
export const REFUNDS_ABOVE_LIMIT = "refunds.approve_above_limit";

export const PAGE_SIZE = 50;

/** The list's own filter values: `open` (the default work list) and `all` are not statuses. */
export type StatusFilter = "open" | "all" | RefundStatus;

export const STATUS_FILTERS: StatusFilter[] = [
  "open",
  "all",
  "pending_approval",
  "approved",
  "processing",
  "needs_attention",
  "needs_review",
  "failed",
  "succeeded",
  "rejected",
  "closed",
];

export const FILTER_LABEL: Record<StatusFilter, string> = {
  open: "Open (needs work)",
  all: "All",
  pending_approval: "Pending approval",
  approved: "Approved",
  processing: "Processing",
  needs_attention: "Needs bank details",
  needs_review: "Needs review",
  failed: "Failed",
  succeeded: "Succeeded",
  rejected: "Rejected",
  closed: "Closed",
};

export const REASON_CODES: RefundReason[] = [
  "cancelled_by_booker",
  "caregiver_cancelled",
  "no_caregiver_found",
  "admin_cancelled",
  "paid_after_expiry",
  "paid_after_cancellation",
  "complaint",
  "other",
];

/** Reasons a person can pick when raising a refund by hand. */
export const STAFF_REASONS: { value: RefundReason; label: string }[] = [
  { value: "complaint", label: "Complaint" },
  { value: "other", label: "Other" },
  { value: "admin_cancelled", label: "Admin cancelled the booking" },
  { value: "cancelled_by_booker", label: "Cancelled by the booker" },
  { value: "caregiver_cancelled", label: "Caregiver cancelled" },
  { value: "no_caregiver_found", label: "No caregiver found" },
];

/** What the console says a refund is doing, per status (guide: "what the console shows or offers"). */
export const STATUS_HINT: Record<RefundStatus, string> = {
  pending_approval: "Waiting for a person to approve or reject it.",
  approved: "Approved, not sent yet. The send job runs about every minute.",
  processing: "Sent to Paystack, waiting for its answer. It is not refunded yet.",
  needs_attention: "Paystack cannot send this to the card and needs the family's bank account.",
  needs_review: "Paystack contradicts what Oakly recorded. Only a Super Admin can resolve it.",
  failed: "Paystack failed it and the money is back with Oakly. It stays open until it is retried, switched or closed.",
  succeeded: "The money has left Oakly.",
  rejected: "Rejected. No money moved.",
  closed: "Closed. No money moved.",
};

/** Finished refunds: the caller-relative fields (`max_approvable_naira`, `needs_super_admin`) mean nothing here. */
export const isTerminal = (status: RefundStatus) =>
  status === "succeeded" || status === "rejected" || status === "closed";

/** While the send job or Paystack's webhook is pending, the detail is re-read (guide: every 30 to 60 seconds). */
export const isInFlight = (status: RefundStatus) => status === "approved" || status === "processing";

export const REFUNDS_KEY = ["refunds"] as const;

export const refundDetailKey = (id: string) => [...REFUNDS_KEY, "detail", id] as const;
export const REFUNDS_LIST_KEY = [...REFUNDS_KEY, "list"] as const;

export function invalidateRefunds(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: REFUNDS_KEY });
}

/** The amount shown for a refund: what was approved, else the suggestion (or nothing: a person must enter it). */
export const shownAmount = (r: Pick<Refund, "amount_naira" | "suggested_amount_naira">) =>
  r.amount_naira ?? r.suggested_amount_naira;

/**
 * Parse a naira amount typed by an admin. At most two decimals and more than zero, or `null`: the API answers 422
 * for anything else, so a bad amount never leaves the form.
 */
export function parseNaira(text: string): number | null {
  const trimmed = text.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 ? value : null;
}

/** Plain text for an amount input from a naira number. */
export const nairaInput = (naira: number | null | undefined) => (naira === null || naira === undefined ? "" : String(naira));

/**
 * One 422 (raising too much) quotes the limit in kobo inside a naira API. Show it in naira; leave every other
 * message exactly as the server sent it.
 */
export function friendlyRefundError(message: string): string {
  return message.replace(
    /between 1 and (\d+) kobo/,
    (_m, kobo: string) => `between ${formatNairaValue(0.01)} and ${formatNairaValue(Number(kobo) / 100)}`,
  );
}

/** The amount (kobo) the resolve 409 names when Paystack processed a different amount, as naira; else `null`. */
export function differentAmountFromError(message: string): { naira: number | null } | null {
  if (!/processed a different amount/i.test(message)) return null;
  const match = /\((\d+) kobo\)/.exec(message);
  return { naira: match ? Number(match[1]) / 100 : null };
}

/**
 * Stable error codes the refund routes answer inside an object detail: `{"detail": {"code": "...", "message": "..."}}`.
 * The sentence is ours so it does not depend on the server's wording.
 */
const REFUND_ERROR_CODES: Record<string, string> = {
  wallet_refunds_disabled: "Refunds to the Oakly wallet are switched off for now. Choose the family's original payment method instead.",
};

/** The `detail.code` of an error body (`detail` an object), or `null` for a string or list detail. */
export function errorCodeOf(body: unknown): string | null {
  const detail = body && typeof body === "object" ? (body as { detail?: unknown }).detail : undefined;
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  const code = (detail as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/** What to show for a failed refund call: our sentence for a known `detail.code`, else the server's message (kobo reworded). */
export function refundErrorMessage(message: string, body: unknown): string {
  const code = errorCodeOf(body);
  return (code !== null ? REFUND_ERROR_CODES[code] : undefined) ?? friendlyRefundError(message);
}

/** Run an API call, rewording known errors and keeping the status and body for callers that branch on them. */
async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof ApiError) throw new ApiError(refundErrorMessage(e.message, e.body), e.status, e.body);
    throw e;
  }
}

export async function fetchRefunds(params: { status: StatusFilter; offset: number }) {
  return call(async () =>
    unwrap(
      await getApi().GET("/api/v1/admin/refunds", {
        params: { query: { status: params.status, limit: PAGE_SIZE, offset: params.offset } },
      }),
    ),
  );
}

export async function fetchRefund(id: string) {
  return call(async () =>
    unwrap(await getApi().GET("/api/v1/admin/refunds/{refund_id}", { params: { path: { refund_id: id } } })),
  );
}

export async function requestRefund(body: Schemas["RefundRequestIn"]) {
  return call(async () => unwrap(await getApi().POST("/api/v1/admin/refunds", { body })));
}

export async function approveRefund(id: string, body: Schemas["RefundApproveIn"]) {
  return call(async () =>
    unwrap(await getApi().POST("/api/v1/admin/refunds/{refund_id}/approve", { params: { path: { refund_id: id } }, body })),
  );
}

export async function rejectRefund(id: string, reason: string) {
  return call(async () =>
    unwrap(
      await getApi().POST("/api/v1/admin/refunds/{refund_id}/reject", { params: { path: { refund_id: id } }, body: { reason } }),
    ),
  );
}

export async function retryRefund(id: string) {
  return call(async () =>
    unwrap(await getApi().POST("/api/v1/admin/refunds/{refund_id}/retry", { params: { path: { refund_id: id } } })),
  );
}

/** The account number goes straight to Paystack through the API; nothing here keeps or returns it. */
export async function submitBankDetails(id: string, body: Schemas["RefundBankDetailsIn"]) {
  return call(async () =>
    unwrap(await getApi().POST("/api/v1/admin/refunds/{refund_id}/bank-details", { params: { path: { refund_id: id } }, body })),
  );
}

export async function switchRefundToWallet(id: string) {
  return call(async () =>
    unwrap(await getApi().POST("/api/v1/admin/refunds/{refund_id}/switch-to-wallet", { params: { path: { refund_id: id } } })),
  );
}

export async function closeRefund(id: string, reason: string) {
  return call(async () =>
    unwrap(
      await getApi().POST("/api/v1/admin/refunds/{refund_id}/close", { params: { path: { refund_id: id } }, body: { reason } }),
    ),
  );
}

export async function resolveRefund(id: string, body: Schemas["RefundResolveIn"]) {
  return call(async () =>
    unwrap(await getApi().POST("/api/v1/admin/refunds/{refund_id}/resolve", { params: { path: { refund_id: id } }, body })),
  );
}
