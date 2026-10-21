"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";

import { PatientCell } from "@/components/booking-cells";
import { Pager } from "@/components/pager";
import { StatusBadge } from "@/components/status-badge";
import { Select } from "@/components/ui/input";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import { BOOKINGS_KEY, PAGE_SIZE, QUEUE_REASONS, type QueueReason, fetchUnmatched } from "@/lib/bookings";
import { formatMinutes, formatNaira, formatWat, humanize } from "@/lib/format";

const EXPLANATIONS: Record<QueueReason, string> = {
  address_check: "Paid but held: the map pin is a city-centre placeholder. Dispatch has not started.",
  unmatched: "Dispatch found no one.",
  sla_breached: "Still dispatching past the 30-minute target.",
};

export function UnmatchedQueue() {
  const [reason, setReason] = React.useState<QueueReason | "">("");
  const [offset, setOffset] = React.useState(0);
  const list = useQuery({
    queryKey: [...BOOKINGS_KEY, "unmatched", reason, offset],
    queryFn: () => fetchUnmatched({ reason: reason || undefined, offset }),
  });

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Unmatched bookings</h1>
        <p className="text-sm text-muted-foreground">
          Paid bookings still waiting for a caregiver, soonest visit first. Open one to re-dispatch, assign, confirm its address or
          cancel it.
        </p>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <label htmlFor="queue-reason">Reason</label>
        <Select
          id="queue-reason"
          className="w-52"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value as QueueReason | "");
            setOffset(0);
          }}
        >
          <option value="">All</option>
          {QUEUE_REASONS.map((r) => (
            <option key={r} value={r}>
              {humanize(r)}
            </option>
          ))}
        </Select>
      </div>

      {list.isPending ? (
        <div className="grid gap-2" aria-busy="true" aria-label="Loading the queue">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState
          message={`We couldn't load the queue. ${errorMessage({ detail: list.error.message }, "")}`.trim()}
          onRetry={() => void list.refetch()}
        />
      ) : list.data.items.length === 0 ? (
        <EmptyState title="Nothing is waiting" hint="Every paid booking has a caregiver or is still within its first 30 minutes of dispatch." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[60rem] text-left text-sm">
              <caption className="sr-only">Unmatched bookings</caption>
              <thead className="border-b bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2">Reason</th>
                  <th scope="col" className="px-3 py-2">Waiting</th>
                  <th scope="col" className="px-3 py-2">Scheduled</th>
                  <th scope="col" className="px-3 py-2">Code</th>
                  <th scope="col" className="px-3 py-2">Patient</th>
                  <th scope="col" className="px-3 py-2">City</th>
                  <th scope="col" className="px-3 py-2 text-right">Total</th>
                  <th scope="col" className="px-3 py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((b) => (
                  <tr key={b.id} className="border-b align-top last:border-0">
                    <td className="px-3 py-2">
                      <StatusBadge value={b.queue_reason} />
                      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{EXPLANATIONS[b.queue_reason]}</p>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatMinutes(b.waiting_minutes)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatWat(b.scheduled_date)}</td>
                    <td className="px-3 py-2">
                      <Link href={`/bookings/${b.id}`} className="font-mono text-primary underline-offset-4 hover:underline">
                        {b.booking_code}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <PatientCell patient={b.patient} />
                    </td>
                    <td className="px-3 py-2">{b.city ?? "—"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{formatNaira(b.total_amount_kobo)}</td>
                    <td className="px-3 py-2">
                      <Link href={`/bookings/${b.id}`} className="text-primary underline-offset-4 hover:underline">
                        Open
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
