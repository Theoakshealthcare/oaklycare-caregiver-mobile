"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { useAuth } from "@/components/auth-provider";
import { RefundActions } from "@/components/refund-actions";
import { RefundRules } from "@/components/refund-rules";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import { formatNairaValue, formatWat, humanize } from "@/lib/format";
import {
  type RefundDetail,
  STATUS_HINT,
  fetchRefund,
  isInFlight,
  isTerminal,
  refundDetailKey,
  shownAmount,
} from "@/lib/refunds";

/** The guide's polling cadence while a refund waits for the send job or Paystack's webhook. */
const POLL_MS = 30_000;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="grid content-start gap-2 rounded-lg border p-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[11rem_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/queues/refunds" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
      <ArrowLeft className="size-4" aria-hidden /> Refunds
    </Link>
  );
}

export function RefundView({ id }: { id: string }) {
  const [notice, setNotice] = React.useState<string | null>(null);
  const { admin } = useAuth();
  const refund = useQuery({
    queryKey: refundDetailKey(id),
    queryFn: () => fetchRefund(id),
    refetchInterval: (q) => (q.state.data && isInFlight(q.state.data.status) ? POLL_MS : false),
  });

  if (refund.isPending) return <Skeleton className="h-48 w-full" aria-label="Loading refund" />;
  if (refund.isError) {
    return (
      <div className="grid gap-4">
        <BackLink />
        <ErrorState
          message={`We couldn't load this refund. ${errorMessage({ detail: refund.error.message }, "")}`.trim()}
          onRetry={() => void refund.refetch()}
        />
      </div>
    );
  }
  const r = refund.data;
  const terminal = isTerminal(r.status);
  const raisedByMe = r.requested_by !== null && r.requested_by === admin?.id;
  const approveMissingForMe = r.status === "pending_approval" && raisedByMe && !r.available_actions.includes("approve");

  return (
    <div className="grid gap-4">
      <BackLink />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
            Refund for booking {r.booking_code ?? "—"} <StatusBadge value={r.status} />
          </h1>
          <p className="text-sm text-muted-foreground">
            {humanize(r.reason_code)} · {r.origin === "staff" ? "raised by staff" : "raised by the system"} · created{" "}
            {formatWat(r.created_at)}
          </p>
          <p className="text-sm">{STATUS_HINT[r.status]}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => void refund.refetch()} disabled={refund.isFetching}>
            <RefreshCw className="size-4" aria-hidden /> Refresh
          </Button>
          <RefundActions refund={r} onDone={setNotice} />
        </div>
      </div>

      {notice ? (
        <p role="status" className="rounded-md border border-success/40 p-3 text-sm">
          {notice}
        </p>
      ) : null}
      {r.review_flagged_at ? (
        <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm">
          <p className="font-medium">Flagged for review since {formatWat(r.review_flagged_at)}</p>
          <p>{r.review_reason ?? "Paystack contradicts what Oakly recorded."}</p>
          <p className="text-muted-foreground">
            Check the Paystack dashboard before resolving. Only a Super Admin can resolve a refund in review.
          </p>
        </div>
      ) : null}
      {approveMissingForMe ? (
        <p role="note" className="rounded-md border border-warning/40 p-3 text-sm">
          Another admin must approve this refund. You raised it, so you can reject it but not approve it.
        </p>
      ) : null}
      {r.status === "pending_approval" && r.needs_super_admin && r.available_actions.includes("approve") ? (
        <p role="note" className="rounded-md border border-warning/40 p-3 text-sm">
          A Super Admin must approve this. It is {formatNairaValue(shownAmount(r))}, above the {formatNairaValue(r.max_approvable_naira)}{" "}
          you can approve now. You can approve a lower amount, up to that.
        </p>
      ) : null}
      {r.status === "processing" ? (
        <p role="note" className="rounded-md border p-3 text-sm">
          Paystack has not finished this yet, so it is not refunded. This page re-checks every 30 seconds.
        </p>
      ) : null}
      {r.status === "succeeded" ? (
        <p role="note" className="rounded-md border p-3 text-sm">
          {r.destination === "wallet"
            ? "The family's Oakly wallet was credited."
            : "Paystack has refunded it; it can take up to 10 business days to appear in the family's account."}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Amount">
          <dl className="grid gap-2">
            <Row label="Suggested">
              {r.suggested_amount_naira === null ? "None: a person enters the amount" : formatNairaValue(r.suggested_amount_naira)}
              <span className="block text-xs text-muted-foreground">{r.suggestion_why}</span>
            </Row>
            <Row label="Approved amount">{r.amount_naira === null ? "Not approved yet" : formatNairaValue(r.amount_naira)}</Row>
            <Row label="Goes to">
              {r.destination === null
                ? "Chosen at approval"
                : r.destination === "wallet"
                  ? "The family's Oakly wallet"
                  : "The family's original payment method"}
            </Row>
            {!terminal && r.status === "pending_approval" ? (
              <Row label="You can approve up to">{formatNairaValue(r.max_approvable_naira)}</Row>
            ) : null}
            <Row label="Finance limit">{formatNairaValue(r.limit_naira)} per booking, cumulative</Row>
            {r.processed_at ? <Row label="Processed">{formatWat(r.processed_at)}</Row> : null}
            {r.approved_at ? <Row label="Approved">{formatWat(r.approved_at)}</Row> : null}
          </dl>
        </Section>

        <Section title="Booking">
          <dl className="grid gap-2">
            <Row label="Booking">
              <Link href={`/bookings/${r.booking_id}`} className="underline underline-offset-4">
                {r.booking.code ?? r.booking_id}
              </Link>{" "}
              <StatusBadge value={r.booking.status} />
            </Row>
            <Row label="Channel">{humanize(r.booking.channel)}</Row>
            <Row label="Paid">{formatNairaValue(r.booking.total_naira)}</Row>
            <Row label="Committed to refunds">{formatNairaValue(r.booking.refunded_naira)}</Row>
            <Row label="Still refundable">{formatNairaValue(r.booking.refundable_naira)}</Row>
            <Row label="Paystack fee">
              {r.booking.paystack_fee_naira === null ? "Not recorded" : formatNairaValue(r.booking.paystack_fee_naira)}
              <span className="block text-xs text-muted-foreground">Oakly absorbs it: the family gets the whole refund.</span>
            </Row>
            {r.booking.cancel_fee_tier ? (
              <Row label="Cancellation fee">
                {humanize(r.booking.cancel_fee_tier)}
                {r.booking.cancel_fee_naira !== null ? `, ${formatNairaValue(r.booking.cancel_fee_naira)}` : ""}
              </Row>
            ) : null}
            <Row label="Visit">{r.booking.completed ? "Completed" : r.booking.caregiver_arrived ? "Caregiver arrived" : r.booking.caregiver_assigned ? "Caregiver assigned" : "No caregiver"}</Row>
          </dl>
        </Section>
      </div>

      <TakeBack refund={r} />
      <Notes refund={r} />
      <Attempts refund={r} />
      <RefundRules limitNaira={r.limit_naira} />
    </div>
  );
}

/** The take-back preview for a refund of a completed visit, and what was agreed and collected afterwards. */
function TakeBack({ refund: r }: { refund: RefundDetail }) {
  const preview = r.take_back_preview_naira;
  if (!r.booking.completed && !r.take_back_from_caregiver) return null;
  return (
    <Section title="Caregiver take-back">
      <dl className="grid gap-2">
        {preview !== null && preview > 0 ? (
          <Row label="Would be taken back">
            {formatNairaValue(preview)}
            <span className="block text-xs text-muted-foreground">
              The caregiver&apos;s share of what is refunded. The approver may take it back; nothing is taken until Paystack says
              the money has left. The caregiver is never asked to repay.
            </span>
          </Row>
        ) : null}
        {r.take_back_from_caregiver ? (
          <>
            <Row label="Agreed at approval">{formatNairaValue(r.take_back_naira)}</Row>
            {r.take_back_reason ? <Row label="Reason">{r.take_back_reason}</Row> : null}
            {r.take_back_debited_naira !== null ? (
              <Row label="Debited from the wallet">{formatNairaValue(r.take_back_debited_naira)}</Row>
            ) : null}
            {r.take_back_owed_naira !== null ? (
              <Row label="Owed, recovered from next earnings">{formatNairaValue(r.take_back_owed_naira)}</Row>
            ) : null}
          </>
        ) : preview === null || preview === 0 ? (
          <p className="text-sm text-muted-foreground">No share is being taken back.</p>
        ) : null}
      </dl>
    </Section>
  );
}

function Notes({ refund: r }: { refund: RefundDetail }) {
  if (!r.note && !r.rejected_reason && !r.failure_reason) return null;
  return (
    <Section title="Notes">
      <dl className="grid gap-2">
        {r.note ? <Row label="Note">{r.note}</Row> : null}
        {r.rejected_reason ? <Row label="Rejected because">{r.rejected_reason}</Row> : null}
        {r.failure_reason ? <Row label="Paystack or Oakly said">{r.failure_reason}</Row> : null}
      </dl>
    </Section>
  );
}

function Attempts({ refund: r }: { refund: RefundDetail }) {
  return (
    <Section title="Attempts">
      {r.attempts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing has been sent to Paystack yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Attempts to refund through Paystack, oldest first</caption>
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="py-1 pr-3 font-medium">Attempt</th>
                <th scope="col" className="py-1 pr-3 font-medium">Status</th>
                <th scope="col" className="py-1 pr-3 font-medium">Paystack refund</th>
                <th scope="col" className="py-1 pr-3 font-medium">Bank</th>
                <th scope="col" className="py-1 pr-3 font-medium">Account</th>
                <th scope="col" className="py-1 pr-3 font-medium">Sent</th>
              </tr>
            </thead>
            <tbody>
              {r.attempts.map((a) => (
                <tr key={a.attempt} className="border-b last:border-0 align-top">
                  <td className="py-1 pr-3">{a.attempt}</td>
                  <td className="py-1 pr-3">
                    {humanize(a.status)}
                    {a.failure_reason ? <span className="block text-xs text-muted-foreground">{a.failure_reason}</span> : null}
                  </td>
                  <td className="py-1 pr-3">{a.paystack_refund_id ?? "—"}</td>
                  <td className="py-1 pr-3">{a.bank_code ?? "—"}</td>
                  <td className="py-1 pr-3">
                    {a.account_last4 ? `•••• ${a.account_last4}` : "—"}
                    {a.account_name ? <span className="block text-xs text-muted-foreground">{a.account_name}</span> : null}
                  </td>
                  <td className="py-1 pr-3 whitespace-nowrap">{formatWat(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Bank details are blank for roles that can only raise refunds. The full account number is never stored.
      </p>
    </Section>
  );
}
