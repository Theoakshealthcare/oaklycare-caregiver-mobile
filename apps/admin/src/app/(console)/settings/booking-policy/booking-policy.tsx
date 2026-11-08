"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import {
  BOOKING_POLICY_KEY,
  BOOKING_POLICY_WRITE,
  fetchBookingPolicy,
  invalidateBookingPolicy,
  parsePercent,
  policyGroups,
  updateShortVisitThreshold,
} from "@/lib/booking-policy";
import { formatWat } from "@/lib/format";

export function BookingPolicyView() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const policy = useQuery({ queryKey: BOOKING_POLICY_KEY, queryFn: fetchBookingPolicy });

  if (policy.isPending) return <Skeleton className="h-48 w-full" aria-label="Loading booking policy" />;
  if (policy.isError) {
    return (
      <ErrorState
        message={`We couldn't load the booking policy. ${errorMessage({ detail: policy.error.message }, "")}`.trim()}
        onRetry={() => void policy.refetch()}
      />
    );
  }
  const p = policy.data;
  const mayEdit = can(BOOKING_POLICY_WRITE);

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Booking policy</h1>
        <p className="text-sm text-muted-foreground">
          The cancellation, drop-out and earning rules.{" "}
          {p.updated_at ? `Last changed ${formatWat(p.updated_at)}.` : "Never changed from the defaults."} Changes affect
          bookings made afterwards; a booking keeps the earning terms it was created with.
        </p>
      </div>
      {notice ? (
        <p role="status" className="rounded-md border border-success/40 p-3 text-sm">
          {notice}
        </p>
      ) : null}
      {policyGroups(p).map((group) => (
        <section key={group.title} aria-labelledby={`g-${group.title}`} className="grid content-start gap-2 rounded-lg border p-4">
          <h2 id={`g-${group.title}`} className="text-base font-semibold">
            {group.title}
          </h2>
          <dl className="grid gap-2">
            {group.rows.map((row) => (
              <div key={row.key} className="grid gap-1 text-sm sm:grid-cols-[14rem_1fr_auto] sm:items-start sm:gap-3">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd>
                  <span className="font-medium">{row.value}</span>
                  <span className="block text-xs text-muted-foreground">{row.help}</span>
                </dd>
                {row.key === "short_visit_min_percent" && mayEdit ? (
                  <Button size="sm" variant="outline" aria-label="Edit the short-visit threshold" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                ) : null}
              </div>
            ))}
          </dl>
        </section>
      ))}
      {!mayEdit ? (
        <p className="text-xs text-muted-foreground">Changing the policy needs the settings.write permission.</p>
      ) : null}
      {editing ? (
        <ThresholdDialog
          current={p.short_visit_min_percent}
          onClose={() => setEditing(false)}
          onSaved={async (value) => {
            await invalidateBookingPolicy(queryClient);
            setNotice(`The short-visit threshold is now ${value}%. It applies to bookings made from now on.`);
          }}
        />
      ) : null}
    </div>
  );
}

function ThresholdDialog({
  current,
  onClose,
  onSaved,
}: {
  current: number;
  onClose: () => void;
  onSaved: (value: number) => Promise<void>;
}) {
  const [text, setText] = React.useState(String(current));
  const inputId = React.useId();
  const value = parsePercent(text);
  return (
    <ConfirmActionDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Change the short-visit threshold"
      sideEffects="A completed visit with less time on site than this share of the booked time is credited to the caregiver already held for Finance review. It applies to bookings made from now on; existing bookings keep the threshold they were created with."
      confirmLabel="Save threshold"
      reasonLabel="Why are you changing it?"
      extraValid={value !== null}
      onConfirm={async (reason) => {
        if (value === null) return;
        await updateShortVisitThreshold(value, reason);
        await onSaved(value);
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor={inputId}>Minimum time on site (percent of the booked time)</Label>
        <Input id={inputId} inputMode="numeric" value={text} onChange={(e) => setText(e.target.value)} aria-invalid={value === null} />
        <p className="text-xs text-muted-foreground">
          A whole number from 0 to 100. Exactly this share is not short; 0 turns the hold off.
        </p>
      </div>
    </ConfirmActionDialog>
  );
}
