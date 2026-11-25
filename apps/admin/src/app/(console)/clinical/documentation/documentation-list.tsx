"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";

import { Pager } from "@/components/pager";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import { formatWat } from "@/lib/format";
import { DOCUMENTATION_KEY, PAGE_SIZE, cleanId, fetchDocumentation } from "@/lib/visit-documentation";

/** What a caregiver wrote in their own documentation space, newest first. Read only; each open of this list is audited. */
export function DocumentationList() {
  const [offset, setOffset] = React.useState(0);
  const [booking, setBooking] = React.useState("");
  const [caregiver, setCaregiver] = React.useState("");
  const bookingId = cleanId(booking);
  const caregiverId = cleanId(caregiver);
  const query = useQuery({
    queryKey: [...DOCUMENTATION_KEY, bookingId ?? null, caregiverId ?? null, offset],
    queryFn: () => fetchDocumentation({ bookingId, caregiverId, offset }),
  });
  const filtered = bookingId !== undefined || caregiverId !== undefined;

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Caregiver documentation</h1>
        <p className="text-sm text-muted-foreground">
          What caregivers wrote in their own documentation space for a visit, newest first. It is private: the family never sees
          it. Opening this page is recorded in the audit log.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Visit (booking id)
          <Input
            value={booking}
            onChange={(e) => {
              setBooking(e.target.value);
              setOffset(0);
            }}
            placeholder="Paste a booking id to filter"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Caregiver id
          <Input
            value={caregiver}
            onChange={(e) => {
              setCaregiver(e.target.value);
              setOffset(0);
            }}
            placeholder="Paste a caregiver id to filter"
          />
        </label>
      </div>

      {query.isError ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <Skeleton className="h-32 w-full" />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          title={filtered ? "Nothing matches that filter." : "No documentation yet."}
          hint={filtered ? "Check the id, or clear the filter." : "Entries appear once a caregiver documents a visit."}
        />
      ) : (
        <ul className="grid gap-3" aria-label="Documentation entries">
          {query.data.items.map((doc) => (
            <li key={doc.id} className="rounded-md border p-4" aria-label={`Entry by ${doc.caregiver.name}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{doc.caregiver.name}</span>
                <span className="text-muted-foreground">{formatWat(doc.created_at)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{doc.body || "Erased."}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                <Link className="underline" href={`/bookings/${doc.booking_id}`}>
                  Open the visit
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}

      {query.data ? <Pager offset={offset} pageSize={PAGE_SIZE} total={query.data.total} onChange={setOffset} /> : null}
    </div>
  );
}
