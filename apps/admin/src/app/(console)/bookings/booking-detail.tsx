"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { BookingActions } from "@/components/booking-actions";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import { type BookingDetail, BOOKINGS_KEY, fetchBooking } from "@/lib/bookings";
import { cancelTermsSummary } from "@/lib/cancel-terms";
import { formatMinutes, formatNaira, formatWat, humanize } from "@/lib/format";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid content-start gap-2 rounded-lg border p-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function BookingView({ id }: { id: string }) {
  const [notice, setNotice] = React.useState<string | null>(null);
  // Every fetch by a clinical.read admin is an audit entry, so this is never polled and never refetched on focus or
  // reconnect: the Refresh button (and an action finishing) are the only triggers. gcTime 0 drops the clinical text
  // from the cache once the page is left.
  const booking = useQuery({
    queryKey: [...BOOKINGS_KEY, "detail", id],
    queryFn: () => fetchBooking(id),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    staleTime: 0,
    gcTime: 0,
  });

  if (booking.isPending) return <Skeleton className="h-48 w-full" aria-label="Loading booking" />;
  if (booking.isError) {
    return (
      <div className="grid gap-4">
        <BackLink />
        <ErrorState
          message={`We couldn't load this booking. ${errorMessage({ detail: booking.error.message }, "")}`.trim()}
          onRetry={() => void booking.refetch()}
        />
      </div>
    );
  }
  const b = booking.data;

  return (
    <div className="grid gap-4">
      <BackLink />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
            Booking {b.booking_code} <StatusBadge value={b.status} />
          </h1>
          <p className="text-sm text-muted-foreground">
            {humanize(b.channel)} · created {formatWat(b.created_at)} · {formatMinutes(b.age_minutes)}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => void booking.refetch()} disabled={booking.isFetching}>
            <RefreshCw className="size-4" aria-hidden /> Refresh
          </Button>
          <BookingActions booking={b} onDone={setNotice} />
        </div>
      </div>

      {notice ? (
        <p role="status" className="rounded-md border border-success/40 p-3 text-sm">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <VisitCard b={b} />
        <PeopleCard b={b} />
        <AddressCard b={b} />
        <ClinicalCard b={b} />
        <PriceCard b={b} />
        <CancelTermsCard b={b} />
        <NoShowCard b={b} />
        <DispatchCard b={b} />
        <TimelineCard b={b} />
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/bookings" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline">
      <ArrowLeft className="size-4" aria-hidden /> All bookings
    </Link>
  );
}

function VisitCard({ b }: { b: BookingDetail }) {
  return (
    <Section title="Visit">
      <dl className="grid gap-1">
        <Row label="Service">{humanize(b.service_type)}</Row>
        <Row label="Assistance">{b.assistance_type}</Row>
        <Row label="Booked for">{humanize(b.booking_for)}</Row>
        <Row label="Scheduled">
          {formatWat(b.scheduled_date)} to {formatWat(b.scheduled_end_date)}
        </Row>
        <Row label="Duration">
          {b.duration_hours} hour{b.duration_hours === 1 ? "" : "s"}
        </Row>
        <Row label="Actual start">{formatWat(b.actual_start_time)}</Row>
        <Row label="Actual end">{formatWat(b.actual_end_time)}</Row>
        {b.cancel_reason ? <Row label="Cancel reason">{humanize(b.cancel_reason)}</Row> : null}
      </dl>
      <p className="text-xs text-muted-foreground">
        {b.note_count} visit note{b.note_count === 1 ? "" : "s"} (not shown here)
      </p>
    </Section>
  );
}

function PeopleCard({ b }: { b: BookingDetail }) {
  const masked = b.patient.masked || Boolean(b.caregiver?.masked);
  return (
    <Section title="People">
      <dl className="grid gap-1">
        <Row label="Patient">
          {b.patient.full_name ?? "—"} · {b.patient.phone ?? "—"}
        </Row>
        <Row label="Caregiver">
          {b.caregiver ? `${b.caregiver.full_name ?? "—"} · ${b.caregiver.phone ?? "—"}` : "Not assigned yet"}
        </Row>
      </dl>
      {masked ? (
        <p className="text-xs text-muted-foreground">Names and phones are shortened: you need the people.pii permission.</p>
      ) : null}
    </Section>
  );
}

function AddressCard({ b }: { b: BookingDetail }) {
  const a = b.address;
  return (
    <Section title="Address">
      <dl className="grid gap-1">
        <Row label="City, state">
          {a.city}, {a.state}
        </Row>
        {a.visible ? (
          <>
            <Row label="Address">{a.line ?? "—"}</Row>
            <Row label="Coordinates">
              {a.latitude}, {a.longitude}
            </Row>
          </>
        ) : null}
      </dl>
      {!a.visible ? (
        <p className="text-xs text-muted-foreground">Area only. The full address needs the bookings.address permission.</p>
      ) : null}
      {a.needs_address_check ? (
        <p role="note" className="rounded-md border border-warning/40 p-3 text-sm">
          Held: this WhatsApp booking&apos;s map pin is a city-centre placeholder, so it was paid but not dispatched. Confirm
          the address to start dispatch.
        </p>
      ) : null}
    </Section>
  );
}

function ClinicalCard({ b }: { b: BookingDetail }) {
  const c = b.clinical;
  if (c.masked) {
    return (
      <Section title="Clinical">
        {c.has_condition ? <p className="text-sm">A condition was recorded.</p> : null}
        {c.has_special_instructions ? <p className="text-sm">Special instructions were recorded.</p> : null}
        {c.has_condition || c.has_special_instructions ? (
          <p className="text-sm text-muted-foreground">They are hidden: reading them needs the clinical.read permission.</p>
        ) : (
          <p className="text-sm text-muted-foreground">No condition or special instructions were recorded.</p>
        )}
      </Section>
    );
  }
  return (
    <Section title="Clinical">
      <dl className="grid gap-1">
        <Row label="Condition">{c.condition ?? "—"}</Row>
        <Row label="Special instructions">{c.special_instructions ?? "—"}</Row>
      </dl>
      <p className="text-xs text-muted-foreground">Your view of this was recorded in the audit log.</p>
    </Section>
  );
}

function PriceCard({ b }: { b: BookingDetail }) {
  const p = b.payment;
  return (
    <Section title="Price & payment">
      <dl className="grid gap-1">
        <Row label="Total">{formatNaira(b.price.total_kobo)}</Row>
        <Row label="Service fee">{formatNaira(b.price.service_fee_kobo)}</Row>
        <Row label="Platform fee">{formatNaira(b.price.platform_fee_kobo)}</Row>
        <Row label="Payment">
          <StatusBadge value={p.status} />
        </Row>
        <Row label="Paystack reference">{p.paystack_reference ?? "—"}</Row>
        {p.failure_reason ? <Row label="Failure reason">{p.failure_reason}</Row> : null}
      </dl>
      {p.refund_required ? (
        <p role="note" className="rounded-md border border-warning/40 p-3 text-sm">
          Refund requested:{" "}
          {p.refund_amount_kobo === null || p.refund_amount_kobo === undefined
            ? "amount decided by the refund queue"
            : formatNaira(p.refund_amount_kobo)}{" "}
          ({humanize(p.refund_required_reason)}). Not refunded yet: Finance&apos;s refund queue pays it.
        </p>
      ) : null}
      {p.attempts.length > 0 ? (
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Payment attempts</caption>
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col">Type</th>
              <th scope="col">Status</th>
              <th scope="col">Amount</th>
              <th scope="col">Reference</th>
              <th scope="col">When</th>
            </tr>
          </thead>
          <tbody>
            {p.attempts.map((a) => (
              <tr key={a.id}>
                <td>{humanize(a.type)}</td>
                <td>{humanize(a.status)}</td>
                <td>{formatNaira(a.amount_kobo)}</td>
                <td>{a.paystack_reference ?? "—"}</td>
                <td>{formatWat(a.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </Section>
  );
}

function CancelTermsCard({ b }: { b: BookingDetail }) {
  const t = b.cancel_terms;
  const summary = cancelTermsSummary(t);
  return (
    <Section title="Cancellation terms">
      <dl className="grid gap-1">
        <Row label="Terms from">{summary.source}</Row>
        <Row label="Free">{summary.free}</Row>
        <Row label="Standard fee">{summary.standard}</Row>
        <Row label="Late fee">{summary.late}</Row>
        <Row label="If cancelled now">{summary.now}</Row>
        {summary.applied ? <Row label="Applied">{summary.applied}</Row> : null}
      </dl>
      <p className="text-xs text-muted-foreground">
        {summary.asOf} These are the family&apos;s terms; cancelling as an admin chooses its own refund.
      </p>
    </Section>
  );
}

function NoShowCard({ b }: { b: BookingDetail }) {
  return (
    <Section title="No-show">
      {b.no_show_flagged_at ? (
        <p className="text-sm">Flagged as a no-show {formatWat(b.no_show_flagged_at)}.</p>
      ) : b.no_show_suspected ? (
        <p className="text-sm">Possible no-show: the caregiver has not started 15 minutes after the start time.</p>
      ) : (
        <p className="text-sm text-muted-foreground">No no-show flagged or suspected.</p>
      )}
    </Section>
  );
}

function DispatchCard({ b }: { b: BookingDetail }) {
  const d = b.dispatch;
  return (
    <Section title="Dispatch">
      <dl className="grid gap-1">
        <Row label="State">{d.state ? <StatusBadge value={d.state} /> : "Not dispatched"}</Row>
        <Row label="Started">{formatWat(d.started_at)}</Row>
      </dl>
      {d.waves.length > 0 ? (
        <ul className="grid gap-1 text-sm">
          {d.waves.map((w) => (
            <li key={w.wave_no}>
              Wave {w.wave_no} sent {formatWat(w.sent_at)} · {w.notified_count} caregiver{w.notified_count === 1 ? "" : "s"}
            </li>
          ))}
        </ul>
      ) : null}
      {d.offers.length > 0 ? (
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Offers</caption>
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col">Caregiver</th>
              <th scope="col">Offered</th>
              <th scope="col">Response</th>
            </tr>
          </thead>
          <tbody>
            {d.offers.map((o) => (
              <tr key={`${o.caregiver_id}-${o.offered_at}`}>
                <td>{o.caregiver_name ?? "—"}</td>
                <td>{formatWat(o.offered_at)}</td>
                <td>{o.response ? humanize(o.response) : "No answer yet"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </Section>
  );
}

function TimelineCard({ b }: { b: BookingDetail }) {
  return (
    <Section title="Timeline">
      <ol className="grid gap-2 text-sm">
        {b.timeline.map((t, i) => (
          <li key={`${t.at}-${i}`} className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">{formatWat(t.at)}</span>
            <span>
              {t.title}
              {t.actor ? <span className="text-muted-foreground"> · {t.actor}</span> : null}
            </span>
            {t.detail ? <span className="text-muted-foreground">{t.detail}</span> : null}
          </li>
        ))}
      </ol>
    </Section>
  );
}
