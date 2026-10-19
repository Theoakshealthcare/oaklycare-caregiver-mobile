"use client";

import { useQuery } from "@tanstack/react-query";
import * as React from "react";

import { Pager } from "@/components/pager";
import { PayoutsTable } from "@/components/payouts-table";
import { PayoutsTabs } from "@/components/payouts-tabs";
import { Select } from "@/components/ui/input";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import { humanize } from "@/lib/format";
import { PAGE_SIZE, PAYOUTS_KEY, PAYOUT_STATUSES, type PayoutStatus, fetchPayouts } from "@/lib/payouts";

export function AllPayouts() {
  const [status, setStatus] = React.useState<PayoutStatus | "">("");
  const [offset, setOffset] = React.useState(0);
  const [notice, setNotice] = React.useState<string | null>(null);
  const list = useQuery({
    queryKey: [...PAYOUTS_KEY, "list", status, offset],
    queryFn: () => fetchPayouts({ status: status || undefined, offset }),
  });

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">All payouts</h1>
        <p className="text-sm text-muted-foreground">Newest first. Filter by status to find payouts that need a hand.</p>
      </div>
      <PayoutsTabs />
      <div className="flex items-center gap-2 text-sm">
        <label htmlFor="payout-status">Status</label>
        <Select
          id="payout-status"
          className="w-52"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as PayoutStatus | "");
            setOffset(0);
          }}
        >
          <option value="">All</option>
          {PAYOUT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </Select>
      </div>
      {notice ? (
        <p role="status" className="rounded-md border border-success/40 p-3 text-sm">
          {notice}
        </p>
      ) : null}

      {list.isPending ? (
        <div className="grid gap-2" aria-busy="true" aria-label="Loading payouts">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState
          message={`We couldn't load payouts. ${errorMessage({ detail: list.error.message }, "")}`.trim()}
          onRetry={() => void list.refetch()}
        />
      ) : list.data.items.length === 0 ? (
        <EmptyState title="No payouts" hint={status ? "Nothing has this status." : "Payouts appear once a batch is made."} />
      ) : (
        <>
          <PayoutsTable payouts={list.data.items} caption="Payouts" onDone={setNotice} />
          <Pager offset={offset} pageSize={PAGE_SIZE} total={list.data.total} onChange={setOffset} />
        </>
      )}
    </div>
  );
}
