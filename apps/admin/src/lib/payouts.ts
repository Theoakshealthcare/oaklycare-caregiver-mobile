/**
 * Caregiver payouts (backend A3 slice 2, guide section 12.11). Wire types come from the generated schema.
 * Money is integer kobo throughout; format with `formatNaira` only at the edge.
 */
import type { Schemas } from "@oakly/api-client";
import type { QueryClient } from "@tanstack/react-query";

import { getApi, unwrap } from "@/lib/api";

export type Payout = Schemas["PayoutOut"];
export type PayoutStatus = Payout["status"];
export type Batch = Schemas["BatchOut"];
export type BatchDetail = Schemas["BatchDetail"];
export type BatchStatus = Batch["status"];

/**
 * Reads need `payments.read`. Approving a batch and cancelling a batch or a payout need `payouts.execute` (Finance,
 * Super Admin); retry, resolve and unfreeze need `ledger.adjust` (Super Admin only). The backend enforces both.
 */
export const PAYOUTS_READ = "payments.read";
export const PAYOUTS_EXECUTE = "payouts.execute";
export const PAYOUTS_ADJUST = "ledger.adjust";

export const PAGE_SIZE = 50;

export const PAYOUT_STATUSES: PayoutStatus[] = [
  "pending_approval",
  "processing",
  "success",
  "failed",
  "reversed",
  "cancelled",
  "needs_attention",
];

export const BATCH_STATUSES: BatchStatus[] = ["pending_approval", "approved", "cancelled"];

/** Statuses a person can still act on from the console, per the guide's state machine. */
export const canCancelPayout = (p: Payout) => p.status === "pending_approval";
/** A frozen caregiver's payout is never retried (the backend refuses it). */
export const canRetryPayout = (p: Payout) =>
  (p.status === "failed" || p.status === "reversed") && p.caregiver_payouts_frozen_at === null;
export const canResolvePayout = (p: Payout) => p.status === "processing" || p.status === "needs_attention";

/** The caregiver-level freeze, as one row per frozen caregiver, built from payouts already loaded. */
export interface FrozenCaregiver {
  caregiverId: string;
  name: string | null;
  frozenAt: string;
  reason: string | null;
  payouts: Payout[];
  /** Sum of `shortfall_kobo` over the loaded payouts: money Paystack paid beyond the caregiver's earnings. */
  shortfallKobo: number;
  /** Payouts that block the unfreeze (the backend refuses while any is `needs_attention` or `processing`). */
  openCount: number;
}

export function groupFrozen(payouts: Payout[]): FrozenCaregiver[] {
  const byCaregiver = new Map<string, FrozenCaregiver>();
  for (const p of payouts) {
    if (!p.caregiver_payouts_frozen_at) continue;
    let row = byCaregiver.get(p.caregiver_id);
    if (!row) {
      row = {
        caregiverId: p.caregiver_id,
        name: p.caregiver_name,
        frozenAt: p.caregiver_payouts_frozen_at,
        reason: p.caregiver_payouts_frozen_reason,
        payouts: [],
        shortfallKobo: 0,
        openCount: 0,
      };
      byCaregiver.set(p.caregiver_id, row);
    }
    row.payouts.push(p);
    row.shortfallKobo += p.shortfall_kobo;
    if (p.status === "needs_attention" || p.status === "processing") row.openCount += 1;
  }
  return [...byCaregiver.values()];
}

/** Every payout screen shares this key prefix so one invalidation refreshes them all. */
export const PAYOUTS_KEY = ["payouts"] as const;

export function invalidatePayouts(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: PAYOUTS_KEY });
}

export async function fetchBatches(params: { status?: BatchStatus; offset: number }) {
  return unwrap(
    await getApi().GET("/api/v1/admin/payouts/batches", {
      params: { query: { status: params.status, limit: PAGE_SIZE, offset: params.offset } },
    }),
  );
}

export async function fetchBatch(id: string) {
  return unwrap(
    await getApi().GET("/api/v1/admin/payouts/batches/{batch_id}", { params: { path: { batch_id: id } } }),
  );
}

export async function fetchPayouts(params: { status?: PayoutStatus; offset: number; limit?: number; batchId?: string }) {
  return unwrap(
    await getApi().GET("/api/v1/admin/payouts", {
      params: {
        query: {
          status: params.status,
          batch_id: params.batchId,
          limit: params.limit ?? PAGE_SIZE,
          offset: params.offset,
        },
      },
    }),
  );
}

export async function approveBatch(id: string, reason: string) {
  return unwrap(
    await getApi().POST("/api/v1/admin/payouts/batches/{batch_id}/approve", {
      params: { path: { batch_id: id } },
      body: { reason },
    }),
  );
}

export async function cancelBatch(id: string, reason: string) {
  return unwrap(
    await getApi().POST("/api/v1/admin/payouts/batches/{batch_id}/cancel", {
      params: { path: { batch_id: id } },
      body: { reason },
    }),
  );
}

export async function cancelPayout(id: string, reason: string) {
  return unwrap(
    await getApi().POST("/api/v1/admin/payouts/{payout_id}/cancel", {
      params: { path: { payout_id: id } },
      body: { reason },
    }),
  );
}

export async function retryPayout(id: string, reason: string) {
  return unwrap(
    await getApi().POST("/api/v1/admin/payouts/{payout_id}/retry", {
      params: { path: { payout_id: id } },
      body: { reason },
    }),
  );
}

export async function resolvePayout(id: string, body: { outcome: "paid" | "failed"; reason: string; force: boolean }) {
  return unwrap(
    await getApi().POST("/api/v1/admin/payouts/{payout_id}/resolve", {
      params: { path: { payout_id: id } },
      body,
    }),
  );
}

export async function unfreezeCaregiver(caregiverId: string, body: { reason: string; write_off_shortfall: boolean }) {
  return unwrap(
    await getApi().POST("/api/v1/admin/payouts/caregivers/{caregiver_id}/unfreeze", {
      params: { path: { caregiver_id: caregiverId } },
      body,
    }),
  );
}
