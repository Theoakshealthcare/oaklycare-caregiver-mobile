"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";

import { Pager } from "@/components/pager";
import { PayoutsTabs } from "@/components/payouts-tabs";
import { StatusBadge } from "@/components/status-badge";
import { Select } from "@/components/ui/input";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import { formatNaira, formatWat, humanize } from "@/lib/format";
import { BATCH_STATUSES, type BatchStatus, PAGE_SIZE, PAYOUTS_KEY, fetchBatches } from "@/lib/payouts";

export function PayoutBatches() {
  const [status, setStatus] = React.useState<BatchStatus | "">("");
  const [offset, setOffset] = React.useState(0);
  const list = useQuery({
    queryKey: [...PAYOUTS_KEY, "batches", status, offset],
    queryFn: () => fetchBatches({ status: status || undefined, offset }),
  });

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Payouts</h1>
        <p className="text-sm text-muted-foreground">
          Caregivers are paid on a schedule. Each payout day makes one batch; nothing is sent to the bank until a Super
          Admin approves it.
        </p>
      </div>
      <PayoutsTabs />
      <div className="flex items-center gap-2 text-sm">
        <label htmlFor="batch-status">Status</label>
        <Select
          id="batch-status"
          className="w-48"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as BatchStatus | "");
            setOffset(0);
          }}
        >
          <option value="">All</option>
          {BATCH_STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </Select>
      </div>

      {list.isPending ? (
        <div className="grid gap-2" aria-busy="true" aria-label="Loading batches">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState
          message={`We couldn't load payout batches. ${errorMessage({ detail: list.error.message }, "")}`.trim()}
          onRetry={() => void list.refetch()}
        />
      ) : list.data.items.length === 0 ? (
        <EmptyState title="No payout batches" hint="The scheduled job makes a batch on each payout day." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <caption className="sr-only">Payout batches</caption>
              <thead className="border-b bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2">Payout day</th>
                  <th scope="col" className="px-3 py-2">Status</th>
                  <th scope="col" className="px-3 py-2 text-right">Payouts</th>
                  <th scope="col" className="px-3 py-2 text-right">Total</th>
                  <th scope="col" className="px-3 py-2">Made</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <Link className="font-medium underline-offset-2 hover:underline" href={`/money/payouts/batches/${b.id}`}>
                        {b.period_key}
                      </Link>
                      <div className="text-xs text-muted-foreground">{humanize(b.cadence)}</div>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge value={b.status} />
                    </td>
                    <td className="px-3 py-2 text-right">{b.payout_count}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{formatNaira(b.total_kobo)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatWat(b.created_at)}</td>
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
