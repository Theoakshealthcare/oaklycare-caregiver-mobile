"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";

import { EarningDrawer } from "@/components/earning-drawer";
import { EarningStatusBadge } from "@/components/earning-status-badge";
import { Pager } from "@/components/pager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import {
  EARNINGS_KEY,
  type Earning,
  HOLD_KIND_LABEL,
  PAGE_SIZE,
  TABS,
  TYPE_LABEL,
  type TabId,
  fetchAllHeld,
  fetchEarnings,
  holdKind,
  isAdminHold,
  needsReview,
  reasonSummary,
} from "@/lib/earnings";
import { formatNaira, formatWat } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGED_STATUS = { pending: "pending_clearance", released: "successful", all: undefined } as const;

const EMPTY: Record<TabId, string> = {
  review: "Nothing is waiting for review. Short visits and no-show flags show up here.",
  admin: "No earning is on hold by an admin.",
  pending: "No earning is waiting to be released.",
  released: "No earning has been released yet.",
  all: "Earnings appear once a visit is completed.",
};

/** Rows for one tab. The two held tabs split one read of every held earning; the others page through the API. */
function useTabRows(tab: TabId, offset: number) {
  const held = tab === "review" || tab === "admin";
  const heldQuery = useQuery({ queryKey: [...EARNINGS_KEY, "held"], queryFn: fetchAllHeld, enabled: held });
  const status = held ? undefined : PAGED_STATUS[tab];
  const paged = useQuery({
    queryKey: [...EARNINGS_KEY, "list", tab, offset],
    queryFn: () => fetchEarnings({ status, offset }),
    enabled: !held,
  });
  if (held) {
    const items = heldQuery.data?.items.filter(tab === "review" ? needsReview : isAdminHold);
    return { query: heldQuery, items, total: items?.length ?? 0, pageable: false };
  }
  return { query: paged, items: paged.data?.items, total: paged.data?.total ?? 0, pageable: true };
}

export function EarningsList() {
  const [tab, setTab] = React.useState<TabId>("review");
  const [offset, setOffset] = React.useState(0);
  const [notice, setNotice] = React.useState<string | null>(null);
  // The row as it was when opened, not looked up again: a failed action refreshes the list, and the row may leave this tab.
  const [open, setOpen] = React.useState<Earning | null>(null);
  const { query, items, total, pageable } = useTabRows(tab, offset);
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Earnings</h1>
        <p className="text-sm text-muted-foreground">
          What caregivers have earned from visits, newest first. An earning is held for a dispute window before it reaches the
          caregiver&apos;s balance.
        </p>
      </div>

      <div role="tablist" aria-label="Earnings" className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`earnings-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={t.id === tab}
            aria-controls="earnings-panel"
            onClick={() => {
              setTab(t.id);
              setOffset(0);
            }}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              t.id === tab ? "border-foreground font-medium" : "border-transparent text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id="earnings-panel" role="tabpanel" aria-labelledby={`earnings-tab-${tab}`} className="grid gap-4">
        <p className="text-sm text-muted-foreground">{current.hint}</p>
        {notice ? (
          <p role="status" className="rounded-md border border-success/40 p-3 text-sm">
            {notice}
          </p>
        ) : null}

        {query.isPending ? (
          <div className="grid gap-2" aria-busy="true" aria-label="Loading earnings">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState
            message={`We couldn't load earnings. ${errorMessage({ detail: query.error.message }, "")}`.trim()}
            onRetry={() => void query.refetch()}
          />
        ) : !items || items.length === 0 ? (
          <EmptyState title="No earnings" hint={EMPTY[tab]} />
        ) : (
          <>
            <EarningsTable earnings={items} onOpen={setOpen} />
            {pageable ? <Pager offset={offset} pageSize={PAGE_SIZE} total={total} onChange={setOffset} /> : null}
          </>
        )}
      </div>

      {open ? <EarningDrawer earning={open} onClose={() => setOpen(null)} onDone={setNotice} /> : null}
    </div>
  );
}

function Why({ e }: { e: Earning }) {
  const kind = holdKind(e);
  const summary = reasonSummary(e);
  if (!kind && !summary) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="grid gap-1 text-xs">
      {kind ? (
        <div>
          <Badge tone={kind === "admin" ? "neutral" : "warning"}>{HOLD_KIND_LABEL[kind]}</Badge>
        </div>
      ) : null}
      {summary ? <p>{summary}</p> : null}
    </div>
  );
}

function EarningsTable({ earnings, onOpen }: { earnings: Earning[]; onOpen: (e: Earning) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[64rem] text-left text-sm">
        <caption className="sr-only">Earnings</caption>
        <thead className="border-b bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2">Caregiver</th>
            <th scope="col" className="px-3 py-2">Booking</th>
            <th scope="col" className="px-3 py-2 text-right">Amount</th>
            <th scope="col" className="px-3 py-2">Status</th>
            <th scope="col" className="px-3 py-2">Why</th>
            <th scope="col" className="px-3 py-2">Dates</th>
            <th scope="col" className="px-3 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {earnings.map((e) => (
            <tr key={e.id} className="border-b align-top last:border-0">
              <td className="px-3 py-2 font-medium">{e.caregiver_name ?? "—"}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {e.booking_id && e.booking_code ? (
                  <Link href={`/bookings/${e.booking_id}`} className="underline underline-offset-2">
                    {e.booking_code}
                  </Link>
                ) : (
                  "—"
                )}
                {e.type !== "earning" ? <div className="text-xs text-muted-foreground">{TYPE_LABEL[e.type]}</div> : null}
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">{formatNaira(e.amount_kobo)}</td>
              <td className="px-3 py-2">
                <EarningStatusBadge status={e.status} />
              </td>
              <td className="px-3 py-2">
                <Why e={e} />
              </td>
              <td className="px-3 py-2 text-xs whitespace-nowrap">
                <div>Credited {formatWat(e.created_at)}</div>
                <div className="text-muted-foreground">
                  {e.released_at ? `Released ${formatWat(e.released_at)}` : `Clears after ${formatWat(e.available_at)}`}
                </div>
              </td>
              <td className="px-3 py-2 text-right">
                <Button size="sm" variant="outline" onClick={() => onOpen(e)}>
                  Review<span className="sr-only"> earning of {formatNaira(e.amount_kobo)} for {e.caregiver_name ?? "caregiver"}</span>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
