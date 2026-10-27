"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";

import { Pager } from "@/components/pager";
import { RefundRules } from "@/components/refund-rules";
import { RequestRefundButton } from "@/components/refund-actions";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import { formatNairaValue, formatWat, humanize } from "@/lib/format";
import {
  FILTER_LABEL,
  PAGE_SIZE,
  REFUNDS_LIST_KEY,
  STATUS_FILTERS,
  type StatusFilter,
  fetchRefunds,
  shownAmount,
} from "@/lib/refunds";

export function RefundsList() {
  const [status, setStatus] = React.useState<StatusFilter>("open");
  const [offset, setOffset] = React.useState(0);
  const [notice, setNotice] = React.useState<string | null>(null);
  const list = useQuery({
    queryKey: [...REFUNDS_LIST_KEY, status, offset],
    queryFn: () => fetchRefunds({ status, offset }),
  });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Refunds</h1>
          <p className="text-sm text-muted-foreground">
            Newest first. The default list is every refund that still needs a person, plus finished ones flagged for review.
          </p>
        </div>
        <RequestRefundButton onDone={setNotice} />
      </div>
      <RefundRules />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label htmlFor="refund-status">Status</label>
        <Select
          id="refund-status"
          className="w-56"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as StatusFilter);
            setOffset(0);
          }}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {FILTER_LABEL[s]}
            </option>
          ))}
        </Select>
        {list.data ? <span aria-live="polite">{list.data.total} {list.data.total === 1 ? "refund" : "refunds"}</span> : null}
      </div>
      {notice ? (
        <p role="status" className="rounded-md border border-success/40 p-3 text-sm">
          {notice}
        </p>
      ) : null}

      {list.isPending ? (
        <div className="grid gap-2" aria-busy="true" aria-label="Loading refunds">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState
          message={`We couldn't load refunds. ${errorMessage({ detail: list.error.message }, "")}`.trim()}
          onRetry={() => void list.refetch()}
        />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          title="No refunds"
          hint={status === "open" ? "Nothing needs a person right now." : "No refund has this status."}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Refunds</caption>
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Booking</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 font-medium">Amount</th>
                  <th scope="col" className="px-3 py-2 font-medium">Reason</th>
                  <th scope="col" className="px-3 py-2 font-medium">Raised</th>
                  <th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((r) => (
                  <tr key={r.id} aria-label={`Refund for booking ${r.booking_code ?? r.id}`} className="border-b last:border-0 align-top">
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/bookings/${r.booking_id}`} className="underline-offset-4 hover:underline">
                        {r.booking_code ?? "—"}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <StatusBadge value={r.status} />
                        {r.review_flagged_at ? <Badge tone="danger">Flagged for review</Badge> : null}
                        {r.available_actions.length > 0 ? <Badge tone="warning">Needs you</Badge> : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {formatNairaValue(shownAmount(r))}
                      {r.amount_naira === null && r.suggested_amount_naira !== null ? (
                        <span className="block text-xs text-muted-foreground">suggested</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {humanize(r.reason_code)}
                      <span className="block text-xs text-muted-foreground">{r.origin === "staff" ? "Raised by staff" : "Raised by the system"}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatWat(r.created_at)}</td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/queues/refunds/${r.id}`} className="underline-offset-4 hover:underline">
                        View<span className="sr-only"> refund for booking {r.booking_code ?? r.id}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager offset={offset} pageSize={PAGE_SIZE} total={list.data.total} onChange={setOffset} />
        </>
      )}
    </div>
  );
}
