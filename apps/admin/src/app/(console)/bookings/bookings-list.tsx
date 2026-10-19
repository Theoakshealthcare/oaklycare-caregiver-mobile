"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";

import { useAuth } from "@/components/auth-provider";
import { PatientCell, channelLabel } from "@/components/booking-cells";
import { Pager } from "@/components/pager";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import {
  BOOKINGS_KEY,
  BOOKING_STATUSES,
  CHANNELS,
  DISPATCH_STATES,
  EMPTY_FILTERS,
  PAGE_SIZE,
  PAYMENT_STATUSES,
  PEOPLE_PII,
  type BookingFilters,
  type BookingListItem,
  fetchBookings,
} from "@/lib/bookings";
import { formatMinutes, formatNaira, formatWat, humanize } from "@/lib/format";

function Flags({ b }: { b: BookingListItem }) {
  const flags = [
    b.needs_address_check ? "Address check" : null,
    b.refund_required ? "Refund requested" : null,
    b.no_show_flagged_at ? "No-show flagged" : null,
    b.no_show_suspected ? "Possible no-show" : null,
  ].filter((f): f is string => f !== null);
  if (flags.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {flags.map((f) => (
        <Badge key={f} tone="warning">
          {f}
        </Badge>
      ))}
    </div>
  );
}

export function BookingsList() {
  const { can } = useAuth();
  const [filters, setFilters] = React.useState<BookingFilters>(EMPTY_FILTERS);
  const [qDraft, setQDraft] = React.useState("");
  const [cityDraft, setCityDraft] = React.useState("");
  const [offset, setOffset] = React.useState(0);
  const list = useQuery({
    queryKey: [...BOOKINGS_KEY, "list", filters, offset],
    queryFn: () => fetchBookings(filters, offset),
  });

  function change(patch: Partial<BookingFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setOffset(0);
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Bookings</h1>
        <p className="text-sm text-muted-foreground">Newest first. Open a booking to see its dispatch, payment and timeline.</p>
      </div>

      <form
        className="grid gap-3 rounded-lg border bg-card p-3 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          change({ q: qDraft, city: cityDraft });
        }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <label htmlFor="booking-q">Search</label>
            <Input id="booking-q" className="w-64" value={qDraft} onChange={(e) => setQDraft(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <label htmlFor="booking-city">City</label>
            <Input id="booking-city" className="w-40" value={cityDraft} onChange={(e) => setCityDraft(e.target.value)} />
          </div>
          <Button type="submit">Search</Button>
        </div>
        {!can(PEOPLE_PII) ? (
          <p className="text-xs text-muted-foreground">
            Search by booking code. Names and phone numbers need the people.pii permission.
          </p>
        ) : null}
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <label htmlFor="booking-status">Status</label>
            <Select
              id="booking-status"
              className="w-40"
              value={filters.status}
              onChange={(e) => change({ status: e.target.value as BookingFilters["status"] })}
            >
              <option value="">All</option>
              {BOOKING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1">
            <label htmlFor="booking-payment">Payment</label>
            <Select
              id="booking-payment"
              className="w-36"
              value={filters.paymentStatus}
              onChange={(e) => change({ paymentStatus: e.target.value as BookingFilters["paymentStatus"] })}
            >
              <option value="">All</option>
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1">
            <label htmlFor="booking-dispatch">Dispatch</label>
            <Select
              id="booking-dispatch"
              className="w-36"
              value={filters.dispatchState}
              onChange={(e) => change({ dispatchState: e.target.value as BookingFilters["dispatchState"] })}
            >
              <option value="">All</option>
              {DISPATCH_STATES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1">
            <label htmlFor="booking-channel">Channel</label>
            <Select
              id="booking-channel"
              className="w-36"
              value={filters.channel}
              onChange={(e) => change({ channel: e.target.value as BookingFilters["channel"] })}
            >
              <option value="">All</option>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {channelLabel(c)}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1">
            <label htmlFor="booking-from">Scheduled from</label>
            <Input id="booking-from" type="date" className="w-40" value={filters.scheduledFrom} onChange={(e) => change({ scheduledFrom: e.target.value })} />
          </div>
          <div className="grid gap-1">
            <label htmlFor="booking-to">Scheduled to</label>
            <Input id="booking-to" type="date" className="w-40" value={filters.scheduledTo} onChange={(e) => change({ scheduledTo: e.target.value })} />
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={filters.needsAddressCheck} onChange={(e) => change({ needsAddressCheck: e.target.checked })} />
            Needs address check
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={filters.noShow} onChange={(e) => change({ noShow: e.target.checked })} />
            No-show (flagged or suspected)
          </label>
        </div>
      </form>

      {list.isPending ? (
        <div className="grid gap-2" aria-busy="true" aria-label="Loading bookings">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState
          message={`We couldn't load bookings. ${errorMessage({ detail: list.error.message }, "")}`.trim()}
          onRetry={() => void list.refetch()}
        />
      ) : list.data.items.length === 0 ? (
        <EmptyState title="No bookings match these filters" hint="Clear a filter or widen the dates." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[72rem] text-left text-sm">
              <caption className="sr-only">Bookings</caption>
              <thead className="border-b bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2">Code</th>
                  <th scope="col" className="px-3 py-2">Scheduled</th>
                  <th scope="col" className="px-3 py-2">Service</th>
                  <th scope="col" className="px-3 py-2">City</th>
                  <th scope="col" className="px-3 py-2">Patient</th>
                  <th scope="col" className="px-3 py-2">Caregiver</th>
                  <th scope="col" className="px-3 py-2">Status</th>
                  <th scope="col" className="px-3 py-2">Payment</th>
                  <th scope="col" className="px-3 py-2 text-right">Total</th>
                  <th scope="col" className="px-3 py-2">Channel</th>
                  <th scope="col" className="px-3 py-2">Age</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((b) => (
                  <tr key={b.id} className="border-b align-top last:border-0">
                    <td className="px-3 py-2">
                      <Link href={`/bookings/${b.id}`} className="font-mono text-primary underline-offset-4 hover:underline">
                        {b.booking_code}
                      </Link>
                      <Flags b={b} />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatWat(b.scheduled_date)}</td>
                    <td className="px-3 py-2">{humanize(b.service_type)}</td>
                    <td className="px-3 py-2">{b.city ?? "—"}</td>
                    <td className="px-3 py-2">
                      <PatientCell patient={b.patient} />
                    </td>
                    <td className="px-3 py-2">{b.caregiver?.full_name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <StatusBadge value={b.status} />
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge value={b.payment_status} />
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{formatNaira(b.total_amount_kobo)}</td>
                    <td className="px-3 py-2">{channelLabel(b.channel)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatMinutes(b.age_minutes)}</td>
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
