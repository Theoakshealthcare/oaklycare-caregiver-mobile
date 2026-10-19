"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { PayoutsTable } from "@/components/payouts-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import { formatNaira, formatWat, humanize } from "@/lib/format";
import { type BatchDetail, PAYOUTS_ACT, PAYOUTS_KEY, approveBatch, cancelBatch, fetchBatch, invalidatePayouts } from "@/lib/payouts";

export function BatchView({ id }: { id: string }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = React.useState<"approve" | "cancel" | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const batch = useQuery({ queryKey: [...PAYOUTS_KEY, "batch", id], queryFn: () => fetchBatch(id) });

  if (batch.isPending) return <Skeleton className="h-48 w-full" aria-label="Loading batch" />;
  if (batch.isError) {
    return (
      <ErrorState
        message={`We couldn't load this batch. ${errorMessage({ detail: batch.error.message }, "")}`.trim()}
        onRetry={() => void batch.refetch()}
      />
    );
  }
  const b = batch.data;
  const waiting = b.payouts.filter((p) => p.status === "pending_approval");
  const canAct = can(PAYOUTS_ACT) && b.status === "pending_approval" && waiting.length > 0;

  return (
    <div className="grid gap-4">
      <Link href="/money/payouts" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> All batches
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            Batch {b.period_key} <StatusBadge value={b.status} />
          </h1>
          <p className="text-sm text-muted-foreground">
            {humanize(b.cadence)} · {b.payout_count} payout{b.payout_count === 1 ? "" : "s"} · {formatNaira(b.total_kobo)} · made{" "}
            {formatWat(b.created_at)}
          </p>
          <p className="text-xs text-muted-foreground">
            {Object.entries(b.counts)
              .map(([s, n]) => `${n} ${humanize(s).toLowerCase()}`)
              .join(", ")}
          </p>
          {b.approval_reason ? <p className="text-sm">Approved: {b.approval_reason}</p> : null}
        </div>
        {canAct ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDialog("cancel")}>
              Cancel batch
            </Button>
            <Button onClick={() => setDialog("approve")}>Approve batch</Button>
          </div>
        ) : null}
      </div>

      {notice ? (
        <p role="status" className="rounded-md border border-success/40 p-3 text-sm">
          {notice}
        </p>
      ) : null}

      <PayoutsTable payouts={b.payouts} caption={`Payouts in batch ${b.period_key}`} onDone={setNotice} />

      {dialog === "approve" ? (
        <ApproveDialog
          id={id}
          onOpenChange={(o) => !o && setDialog(null)}
          onApproved={async (res) => {
            await invalidatePayouts(queryClient);
            const cancelled = res.counts.cancelled ?? 0;
            setNotice(
              `Batch approved: ${res.counts.processing ?? 0} payout${(res.counts.processing ?? 0) === 1 ? "" : "s"} totalling ${formatNaira(res.total_kobo)} will be sent.${
                cancelled > 0 ? ` ${cancelled} cancelled at approval (caregiver suspended or bank account changed); their money was returned.` : ""
              } The send job posts each transfer to Paystack within a minute; this click sent nothing itself.`,
            );
          }}
        />
      ) : null}
      {dialog === "cancel" ? (
        <ConfirmActionDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={`Cancel batch ${b.period_key}?`}
          sideEffects={`Cancels all ${waiting.length} payout${waiting.length === 1 ? "" : "s"} still waiting (${formatNaira(
            waiting.reduce((sum, p) => sum + p.amount_kobo, 0),
          )}) and returns each caregiver's reserved money to their available balance. The batch can't be approved afterwards.`}
          confirmLabel="Cancel batch"
          destructive
          reasonLabel="Reason for cancelling"
          onConfirm={async (reason) => {
            await cancelBatch(id, reason);
            await invalidatePayouts(queryClient);
            setNotice("Batch cancelled and the reserved money returned.");
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Approval moves money, so the numbers it asks for confirmation on are fetched fresh when the dialog
 * opens (a payout may have been cancelled since the page loaded), never taken from the page's cache.
 * The confirm button stays disabled until that fresh read has arrived and the batch is still waiting.
 */
function ApproveDialog({
  id,
  onOpenChange,
  onApproved,
}: {
  id: string;
  onOpenChange: (open: boolean) => void;
  onApproved: (res: BatchDetail) => Promise<void>;
}) {
  const fresh = useQuery({
    queryKey: [...PAYOUTS_KEY, "batch-approve", id],
    queryFn: () => fetchBatch(id),
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const waiting = fresh.data?.payouts.filter((p) => p.status === "pending_approval") ?? [];
  const total = waiting.reduce((sum, p) => sum + p.amount_kobo, 0);
  const ready = fresh.data !== undefined && !fresh.isFetching && fresh.data.status === "pending_approval" && waiting.length > 0;

  let sideEffects = "Checking the batch's current totals…";
  if (fresh.isError) sideEffects = `We couldn't re-check this batch, so it can't be approved yet. ${errorMessage({ detail: fresh.error.message }, "")}`.trim();
  else if (fresh.data && !ready && !fresh.isFetching)
    sideEffects = `This batch is ${humanize(fresh.data.status).toLowerCase()} with ${waiting.length} payout${waiting.length === 1 ? "" : "s"} waiting for approval, so there is nothing to approve. Close this and reload.`;
  else if (ready)
    sideEffects = `Approving ${waiting.length} payout${waiting.length === 1 ? "" : "s"} totalling ${formatNaira(total)} for the ${fresh.data?.period_key} payout day. Each caregiver is checked again first; anyone suspended or whose bank account changed is cancelled and their money returned. Approving can't be undone: transfers are sent to Paystack within a minute.`;

  return (
    <ConfirmActionDialog
      open
      onOpenChange={onOpenChange}
      title={ready ? `Approve ${formatNaira(total)} to ${waiting.length} caregiver${waiting.length === 1 ? "" : "s"}?` : "Approve batch?"}
      sideEffects={sideEffects}
      confirmLabel="Approve batch"
      destructive
      reasonLabel="Reason for approving (what you checked)"
      extraValid={ready}
      onConfirm={async (reason) => {
        await onApproved(await approveBatch(id, reason));
      }}
    />
  );
}
