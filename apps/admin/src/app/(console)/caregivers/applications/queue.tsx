"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { type ProfileStatus, PROFILE_STATUSES, listApplications } from "@/lib/caregivers";
import { errorMessage } from "@/lib/api";
import { formatAge, formatWat, humanize } from "@/lib/format";

const PAGE_SIZE = 25;

function parseStatus(value: string | null): ProfileStatus {
  return (PROFILE_STATUSES as string[]).includes(value ?? "") ? (value as ProfileStatus) : "under_review";
}

export function ApplicationsQueue() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status = parseStatus(params.get("status"));
  const page = Math.max(0, Number(params.get("page") ?? 0) || 0);
  const [search, setSearch] = React.useState("");
  const tbody = React.useRef<HTMLTableSectionElement>(null);

  const query = useQuery({
    queryKey: ["caregiver-applications", status, page],
    queryFn: () => listApplications(status, PAGE_SIZE, page * PAGE_SIZE),
    // The queue is a work list: keep it fresh while someone is looking at it.
    refetchInterval: 60_000,
  });

  function setParams(next: { status?: ProfileStatus; page?: number }) {
    const sp = new URLSearchParams(params.toString());
    if (next.status) sp.set("status", next.status);
    if (next.page !== undefined) sp.set("page", String(next.page));
    router.replace(`${pathname}?${sp.toString()}`);
  }

  const items = (query.data?.items ?? []).filter((r) => {
    const q = search.trim().toLowerCase();
    return !q || r.full_name.toLowerCase().includes(q) || (r.state ?? "").toLowerCase().includes(q);
  });
  const total = query.data?.total ?? 0;

  // Up/Down move between rows so a reviewer can work the queue from the keyboard; Enter opens (it's a link).
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const links = Array.from(tbody.current?.querySelectorAll<HTMLAnchorElement>("a[data-row-link]") ?? []);
    const idx = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (idx === -1) return;
    e.preventDefault();
    links[Math.min(links.length - 1, Math.max(0, idx + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Caregiver applications</h1>
        <p className="text-sm text-muted-foreground">Oldest submission first. Use the arrow keys to move between rows.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <label htmlFor="status-filter" className="text-sm font-medium">
            Status
          </label>
          <Select id="status-filter" value={status} onChange={(e) => setParams({ status: e.target.value as ProfileStatus, page: 0 })} className="w-48">
            {PROFILE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1">
          <label htmlFor="queue-search" className="text-sm font-medium">
            Find on this page
          </label>
          <Input id="queue-search" type="search" placeholder="Name or state" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
        </div>
        {query.data ? (
          <p className="ml-auto text-sm text-muted-foreground" aria-live="polite">
            {total} {total === 1 ? "application" : "applications"}
          </p>
        ) : null}
      </div>

      {query.isPending ? (
        <div className="grid gap-2" aria-busy="true" aria-label="Loading applications">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState message={`We couldn't load the queue. ${errorMessage(query.error, "")}`.trim()} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        search ? (
          <EmptyState title="No one on this page matches" hint="Clear the search to see everyone on this page." action={<Button variant="outline" onClick={() => setSearch("")}>Clear search</Button>} />
        ) : (
          <EmptyState title={`No ${humanize(status).toLowerCase()} applications`} hint={status === "under_review" ? "New submissions will show up here." : "Try another status."} />
        )
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <caption className="sr-only">Caregiver applications, oldest first</caption>
            <thead className="border-b bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2">Name</th>
                <th scope="col" className="px-3 py-2">State</th>
                <th scope="col" className="px-3 py-2">Specialization</th>
                <th scope="col" className="px-3 py-2">Submitted</th>
                <th scope="col" className="px-3 py-2">Age</th>
                <th scope="col" className="px-3 py-2">Docs</th>
                <th scope="col" className="px-3 py-2">Identity</th>
                <th scope="col" className="px-3 py-2">Background</th>
              </tr>
            </thead>
            <tbody ref={tbody} onKeyDown={onKeyDown}>
              {items.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="px-3 py-2 font-medium">
                    <Link data-row-link href={`/caregivers/applications/${row.id}`} className="rounded underline-offset-4 hover:underline">
                      {row.full_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{row.state ?? "—"}</td>
                  <td className="px-3 py-2">{row.specialization ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatWat(row.submitted_at)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatAge(row.age_in_days)}</td>
                  <td className="px-3 py-2">{row.document_count}</td>
                  <td className="px-3 py-2"><StatusBadge value={row.identity_verification_status} /></td>
                  <td className="px-3 py-2"><StatusBadge value={row.background_check_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {query.data && total > PAGE_SIZE ? (
        <div className="flex items-center justify-between">
          <Button variant="outline" disabled={page === 0} onClick={() => setParams({ page: page - 1 })}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}
          </span>
          <Button variant="outline" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setParams({ page: page + 1 })}>
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
