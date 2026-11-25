"use client";

import { useQuery } from "@tanstack/react-query";
import * as React from "react";

import { BankReviewActions } from "@/components/bank-review-actions";
import { Pager } from "@/components/pager";
import { PayoutsTabs } from "@/components/payouts-tabs";
import { StatusBadge } from "@/components/status-badge";
import { Select } from "@/components/ui/input";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import {
  BANK_REVIEWS_KEY,
  BANK_REVIEW_STATUSES,
  type BankReviewStatus,
  fetchBankReviews,
} from "@/lib/bank-reviews";
import { formatNaira, formatWat, humanize } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/payouts";

const EMPTY: Record<BankReviewStatus, { title: string; hint: string }> = {
  pending: { title: "No accounts are waiting for review", hint: "An account appears here when its holder name does not look like the caregiver's profile name." },
  approved: { title: "No approved accounts", hint: "Accounts Finance has approved appear here." },
  rejected: { title: "No rejected accounts", hint: "Accounts Finance has rejected appear here." },
};

type Notice = { tone: "done" | "conflict"; text: string };

export function BankReviewsQueue() {
  const [status, setStatus] = React.useState<BankReviewStatus>("pending");
  const [offset, setOffset] = React.useState(0);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const list = useQuery({
    queryKey: [...BANK_REVIEWS_KEY, status, offset],
    queryFn: () => fetchBankReviews({ status, offset }),
  });

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Account name reviews</h1>
        <p className="text-sm text-muted-foreground">
          A caregiver saved a payout account whose holder name does not look like their profile name. It is held: nothing is
          paid to it until Finance approves it. Compare the two names, then approve or reject. Oldest first.
        </p>
      </div>
      <PayoutsTabs />
      <div className="flex items-center gap-2 text-sm">
        <label htmlFor="bank-review-status">Status</label>
        <Select
          id="bank-review-status"
          className="w-52"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as BankReviewStatus);
            setOffset(0);
            setNotice(null);
          }}
        >
          {BANK_REVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </Select>
      </div>
      {notice ? (
        <p
          role={notice.tone === "conflict" ? "alert" : "status"}
          className={
            notice.tone === "conflict"
              ? "rounded-md border border-warning/40 p-3 text-sm"
              : "rounded-md border border-success/40 p-3 text-sm"
          }
        >
          {notice.text}
        </p>
      ) : null}

      {list.isPending ? (
        <div className="grid gap-2" aria-busy="true" aria-label="Loading account reviews">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState
          message={`We couldn't load the account reviews. ${errorMessage({ detail: list.error.message }, "")}`.trim()}
          onRetry={() => void list.refetch()}
        />
      ) : list.data.items.length === 0 ? (
        <EmptyState {...EMPTY[status]} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[60rem] text-left text-sm">
              <caption className="sr-only">{`${humanize(status)} account name reviews`}</caption>
              <thead className="border-b bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2">Profile name</th>
                  <th scope="col" className="px-3 py-2">Name at the bank</th>
                  <th scope="col" className="px-3 py-2">Account</th>
                  <th scope="col" className="px-3 py-2 text-right">Balance</th>
                  <th scope="col" className="px-3 py-2">Submitted</th>
                  <th scope="col" className="px-3 py-2">Status</th>
                  <th scope="col" className="px-3 py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((r) => (
                  <tr key={r.caregiver_id} className="border-b align-top last:border-0">
                    <td className="px-3 py-2 font-medium">{r.caregiver_name ?? "—"}</td>
                    <td className="px-3 py-2 font-medium">{r.account_name}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.bank_name} {r.account_number}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{formatNaira(r.balance_kobo)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatWat(r.submitted_at)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge value={r.status} />
                      {r.decided_at ? (
                        <div className="mt-1 text-xs text-muted-foreground">{formatWat(r.decided_at)}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <BankReviewActions
                        review={r}
                        onDone={(text) => setNotice({ tone: "done", text })}
                        onConflict={(text) => setNotice({ tone: "conflict", text })}
                      />
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
