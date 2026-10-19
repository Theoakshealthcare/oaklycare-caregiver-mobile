"use client";

import { useQuery } from "@tanstack/react-query";
import * as React from "react";

import { PayoutsTable } from "@/components/payouts-table";
import { UnfreezeButton } from "@/components/payout-actions";
import { PayoutsTabs } from "@/components/payouts-tabs";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import { formatNaira, formatWat } from "@/lib/format";
import { PAYOUTS_KEY, type Payout, fetchPayouts, groupFrozen } from "@/lib/payouts";

const WINDOW = 200;

export function Attention() {
  const [notice, setNotice] = React.useState<string | null>(null);
  const attention = useQuery({
    queryKey: [...PAYOUTS_KEY, "attention"],
    queryFn: () => fetchPayouts({ status: "needs_attention", offset: 0, limit: WINDOW }),
  });
  // The backend has no "frozen caregivers" list. A caregiver stays frozen after their last open payout is
  // resolved, until someone unfreezes them, so also scan the most recent payouts for the freeze fields.
  const recent = useQuery({
    queryKey: [...PAYOUTS_KEY, "recent"],
    queryFn: () => fetchPayouts({ offset: 0, limit: WINDOW }),
  });

  const frozen = React.useMemo(() => {
    const byId = new Map<string, Payout>();
    for (const p of [...(recent.data?.items ?? []), ...(attention.data?.items ?? [])]) byId.set(p.id, p);
    return groupFrozen([...byId.values()]);
  }, [recent.data, attention.data]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Needs attention</h1>
        <p className="text-sm text-muted-foreground">
          Paystack&apos;s word contradicted what Oakly recorded. These caregivers are frozen: nothing is sent for them and no
          money returns until an admin resolves the payout and unfreezes them.
        </p>
      </div>
      <PayoutsTabs />
      {notice ? (
        <p role="status" className="rounded-md border border-success/40 p-3 text-sm">
          {notice}
        </p>
      ) : null}

      <section className="grid gap-3" aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="text-lg font-semibold">
          Payouts needing attention
        </h2>
        {attention.isPending ? (
          <Skeleton className="h-16 w-full" aria-label="Loading payouts needing attention" />
        ) : attention.isError ? (
          <ErrorState
            message={`We couldn't load these payouts. ${errorMessage({ detail: attention.error.message }, "")}`.trim()}
            onRetry={() => void attention.refetch()}
          />
        ) : attention.data.items.length === 0 ? (
          <EmptyState title="Nothing needs attention" hint="No payout is waiting for a person." />
        ) : (
          <>
            <PayoutsTable payouts={attention.data.items} caption="Payouts needing attention" onDone={setNotice} />
            {attention.data.total > attention.data.items.length ? (
              <p className="text-sm text-muted-foreground">
                Showing {attention.data.items.length} of {attention.data.total}. Resolve these to see the rest.
              </p>
            ) : null}
          </>
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="frozen-heading">
        <h2 id="frozen-heading" className="text-lg font-semibold">
          Frozen caregivers
        </h2>
        <p className="text-sm text-muted-foreground">
          Found from the {WINDOW} most recent payouts and every payout needing attention. Unfreezing is refused while any of
          the caregiver&apos;s payouts is still processing or needs attention.
        </p>
        {recent.isPending || attention.isPending ? (
          <Skeleton className="h-16 w-full" aria-label="Loading frozen caregivers" />
        ) : recent.isError ? (
          <ErrorState
            message={`We couldn't load frozen caregivers. ${errorMessage({ detail: recent.error.message }, "")}`.trim()}
            onRetry={() => void recent.refetch()}
          />
        ) : frozen.length === 0 ? (
          <EmptyState title="No frozen caregivers" hint="Every caregiver can be paid." />
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <caption className="sr-only">Frozen caregivers</caption>
              <thead className="border-b bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2">Caregiver</th>
                  <th scope="col" className="px-3 py-2">Frozen</th>
                  <th scope="col" className="px-3 py-2">Why</th>
                  <th scope="col" className="px-3 py-2 text-right">Shortfall</th>
                  <th scope="col" className="px-3 py-2 text-right">Open payouts</th>
                  <th scope="col" className="px-3 py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {frozen.map((c) => (
                  <tr key={c.caregiverId} className="border-b align-top last:border-0">
                    <td className="px-3 py-2 font-medium">{c.name ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatWat(c.frozenAt)}</td>
                    <td className="px-3 py-2 text-xs">{c.reason ?? "—"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{formatNaira(c.shortfallKobo)}</td>
                    <td className="px-3 py-2 text-right">{c.openCount}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end">
                        <UnfreezeButton
                          caregiverId={c.caregiverId}
                          name={c.name}
                          shortfallKobo={c.shortfallKobo}
                          onDone={setNotice}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
