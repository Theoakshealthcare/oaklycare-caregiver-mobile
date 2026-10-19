"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TIER_LABELS, offeredText } from "@/lib/booking-actions-helpers";
import {
  type BookingAction,
  type BookingDetail,
  BOOKINGS_KEY,
  CANCEL_REASON_CODES,
  type CancelReasonCode,
  type CorrectionTarget,
  type RefundChoice,
  assignBooking,
  cancelBooking,
  cancelEstimate,
  confirmAddress,
  correctStatus,
  correctionTargets,
  fetchBookingPolicy,
  fetchCandidates,
  flagNoShow,
  insideNigeria,
  invalidateBookings,
  parseNairaToKobo,
  reassignBooking,
  redispatchBooking,
} from "@/lib/bookings";
import { formatNaira, humanize } from "@/lib/format";

type Dialog = "redispatch" | "assign" | "reassign" | "cancel" | "confirm_address" | "flag_no_show" | "correct_status";

const BUTTONS: { action: Exclude<BookingAction, "force_assign">; dialog: Dialog; label: string }[] = [
  { action: "redispatch", dialog: "redispatch", label: "Re-dispatch" },
  { action: "assign", dialog: "assign", label: "Assign caregiver" },
  { action: "reassign", dialog: "reassign", label: "Reassign" },
  { action: "cancel", dialog: "cancel", label: "Cancel booking" },
  { action: "confirm_address", dialog: "confirm_address", label: "Confirm address" },
  { action: "flag_no_show", dialog: "flag_no_show", label: "Flag no-show" },
  { action: "correct_status", dialog: "correct_status", label: "Correct status" },
];

/**
 * The booking's actions. Which ones show is decided by the backend (`available_actions` combines the admin's
 * permissions with the booking's state), so nothing here re-derives permissions. `force_assign` is not a button: it
 * enables the force checkbox inside the Assign dialog.
 */
export function BookingActions({ booking, onDone }: { booking: BookingDetail; onDone?: (notice: string) => void }) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const available = booking.available_actions;
  const close = (o: boolean) => !o && setDialog(null);

  // A refused action can still mean the booking changed (a 409 says someone else got there first), so the detail is
  // refetched on failure too, then the error goes on to the dialog.
  async function act<T>(run: () => Promise<T>, notice: (result: T) => string) {
    let result: T;
    try {
      result = await run();
    } catch (e) {
      void invalidateBookings(queryClient);
      throw e;
    }
    await invalidateBookings(queryClient);
    onDone?.(notice(result));
  }

  const visible = BUTTONS.filter((b) => available.includes(b.action));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {visible.map((b) => (
        <Button key={b.action} variant="outline" onClick={() => setDialog(b.dialog)}>
          {b.label}
        </Button>
      ))}

      {dialog === "redispatch" ? <RedispatchDialog booking={booking} close={close} act={act} /> : null}
      {dialog === "assign" ? (
        <AssignDialog booking={booking} close={close} act={act} canForce={available.includes("force_assign")} />
      ) : null}
      {dialog === "reassign" ? <ReassignDialog booking={booking} close={close} act={act} /> : null}
      {dialog === "cancel" ? <CancelDialog booking={booking} close={close} act={act} /> : null}
      {dialog === "confirm_address" ? <ConfirmAddressDialog booking={booking} close={close} act={act} /> : null}
      {dialog === "flag_no_show" ? (
        <ConfirmActionDialog
          open
          onOpenChange={close}
          title={`Flag booking ${booking.booking_code} as a no-show?`}
          sideEffects="Records that the caregiver did not show up. It does not cancel or reassign the booking: do that next."
          confirmLabel="Flag no-show"
          reasonLabel="Reason for flagging"
          onConfirm={(reason) =>
            act(() => flagNoShow(booking.id, reason), () => "No-show flagged. Reassign or cancel the booking next.")
          }
        />
      ) : null}
      {dialog === "correct_status" ? <CorrectStatusDialog booking={booking} close={close} act={act} /> : null}
    </div>
  );
}

interface DialogProps {
  booking: BookingDetail;
  close: (open: boolean) => void;
  act: <T>(run: () => Promise<T>, notice: (result: T) => string) => Promise<void>;
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function RedispatchDialog({ booking, close, act }: DialogProps) {
  const [radius, setRadius] = React.useState("");
  const [again, setAgain] = React.useState(false);
  const radiusId = React.useId();
  const blank = radius.trim() === "";
  const km = Number(radius);
  const valid = blank || (Number.isFinite(km) && km >= 1 && km <= 100);
  return (
    <ConfirmActionDialog
      open
      onOpenChange={close}
      title={`Re-dispatch booking ${booking.booking_code}?`}
      sideEffects="Starts a new dispatch wave for this paid booking. Caregivers get a push and must accept in the app."
      confirmLabel="Re-dispatch"
      reasonLabel="Reason for re-dispatching"
      extraValid={valid}
      onConfirm={(reason) =>
        act(
          () =>
            redispatchBooking(booking.id, {
              reason,
              ...(blank ? {} : { radius_km: km }),
              include_previously_notified: again,
            }),
          (res) =>
            res.notified_caregivers === 0
              ? "No one available: nobody eligible was found, so the booking is still unmatched. Try a wider radius or assign someone."
              : offeredText(res.notified_caregivers),
        )
      }
    >
      <Field label="Search radius (km)" id={radiusId}>
        <Input id={radiusId} type="number" inputMode="decimal" min={1} max={100} value={radius} onChange={(e) => setRadius(e.target.value)} />
        <p className={valid ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
          Optional, 1 to 100. Leave empty for the default.
        </p>
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 size-4" checked={again} onChange={(e) => setAgain(e.target.checked)} />
        <span>Also offer it to caregivers an earlier wave already notified</span>
      </label>
    </ConfirmActionDialog>
  );
}

/** Candidate list for assign and reassign: fetched on open, optional radius, nothing preselected. */
function CandidatePicker({
  bookingId,
  excludeId,
  selected,
  onSelect,
}: {
  bookingId: string;
  excludeId?: string;
  selected: string | null;
  onSelect: (id: string | null, name: string) => void;
}) {
  const [radiusText, setRadiusText] = React.useState("");
  const [radius, setRadius] = React.useState<number | undefined>(undefined);
  const radiusId = React.useId();
  const candidates = useQuery({
    queryKey: [...BOOKINGS_KEY, "candidates", bookingId, radius ?? null],
    queryFn: () => fetchCandidates(bookingId, radius),
    refetchOnWindowFocus: false,
  });
  const km = Number(radiusText);
  const blank = radiusText.trim() === "";
  const radiusValid = blank || (Number.isFinite(km) && km >= 1 && km <= 100);
  const items = (candidates.data?.items ?? []).filter((c) => c.caregiver_id !== excludeId);

  return (
    <div className="grid gap-2">
      <div className="flex items-end gap-2">
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor={radiusId}>Search radius (km)</Label>
          <Input id={radiusId} type="number" inputMode="decimal" min={1} max={100} value={radiusText} onChange={(e) => setRadiusText(e.target.value)} />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!radiusValid}
          onClick={() => {
            setRadius(blank ? undefined : km);
            onSelect(null, "");
          }}
        >
          Search
        </Button>
      </div>
      {candidates.isPending ? (
        <p className="text-sm text-muted-foreground">Loading caregivers…</p>
      ) : candidates.isError ? (
        <p className="text-sm text-destructive">We couldn&apos;t load caregivers. {candidates.error.message}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No approved, available caregiver with a recent location is nearby. Widen the radius.
        </p>
      ) : (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Caregiver</legend>
          {items.map((c) => (
            <label key={c.caregiver_id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="caregiver"
                className="size-4"
                checked={selected === c.caregiver_id}
                onChange={() => onSelect(c.caregiver_id, c.full_name)}
              />
              <span>
                {c.full_name} · {humanize(c.specialization)} · {c.distance_km} km · ETA {c.estimated_arrival_minutes} min
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}

function AssignDialog({ booking, close, act, canForce }: DialogProps & { canForce: boolean }) {
  const [picked, setPicked] = React.useState<string | null>(null);
  const [force, setForce] = React.useState(false);
  const [name, setName] = React.useState("");
  const forcing = canForce && force;
  return (
    <ConfirmActionDialog
      open
      onOpenChange={close}
      title={`Assign a caregiver to booking ${booking.booking_code}?`}
      sideEffects={
        forcing
          ? "The booking is accepted for this caregiver at once, a visit code is generated, every other open offer is closed and the caregiver is told. This can't be undone here (use Reassign or Cancel)."
          : "The visit is offered to this caregiver only; they get a push and must still accept in the app. The booking stays pending until then: use Refresh to see their answer."
      }
      confirmLabel={forcing ? "Assign now" : "Offer to caregiver"}
      reasonLabel="Reason for assigning"
      extraValid={Boolean(picked)}
      onConfirm={(reason) => {
        const id = picked;
        if (!id) return Promise.resolve();
        return act(
          () => assignBooking(booking.id, { caregiver_id: id, reason, force: forcing }),
          () => (forcing ? `Assigned to ${name}.` : `Offered to ${name}. Waiting for them to accept.`),
        );
      }}
    >
      <CandidatePicker
        bookingId={booking.id}
        selected={picked}
        onSelect={(id, n) => {
          setPicked(id);
          setName(n);
        }}
      />
      {canForce ? (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 size-4" checked={force} onChange={(e) => setForce(e.target.checked)} />
          <span>Assign now, without waiting for them to accept (Super Admin)</span>
        </label>
      ) : null}
    </ConfirmActionDialog>
  );
}

function ReassignDialog({ booking, close, act }: DialogProps) {
  const [picked, setPicked] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const current = booking.caregiver?.full_name ?? "the current caregiver";
  return (
    <ConfirmActionDialog
      open
      onOpenChange={close}
      title={`Reassign booking ${booking.booking_code}?`}
      sideEffects={`The new caregiver is assigned directly and told; ${current} is told the visit was reassigned. The status goes back to accepted, any no-show flag is cleared, and the patient's visit code stays the same.`}
      confirmLabel="Reassign"
      reasonLabel="Reason for reassigning"
      extraValid={Boolean(picked)}
      onConfirm={(reason) => {
        const id = picked;
        if (!id) return Promise.resolve();
        return act(() => reassignBooking(booking.id, { caregiver_id: id, reason }), () => `Reassigned to ${name}.`);
      }}
    >
      <CandidatePicker
        bookingId={booking.id}
        excludeId={booking.caregiver?.id}
        selected={picked}
        onSelect={(id, n) => {
          setPicked(id);
          setName(n);
        }}
      />
    </ConfirmActionDialog>
  );
}

function CancelDialog({ booking, close, act }: DialogProps) {
  const paid = booking.payment.status === "paid";
  const total = booking.price.total_kobo;
  const [code, setCode] = React.useState<CancelReasonCode | "">("");
  const [refund, setRefund] = React.useState<RefundChoice | null>(null);
  const [amountText, setAmountText] = React.useState("");
  const codeId = React.useId();
  const amountId = React.useId();
  const policy = useQuery({
    queryKey: [...BOOKINGS_KEY, "policy"],
    queryFn: fetchBookingPolicy,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const estimate = policy.data ? cancelEstimate(booking, policy.data, new Date()) : null;

  const partialKobo = parseNairaToKobo(amountText);
  const partialValid = partialKobo !== null && partialKobo < total;
  const refundValid = refund === "partial" ? partialValid : refund !== null;

  function applyEstimate() {
    if (!estimate) return;
    if (estimate.refundKobo === total) {
      setRefund("full");
      setAmountText("");
    } else {
      setRefund("partial");
      const naira = estimate.refundKobo / 100;
      setAmountText(Number.isInteger(naira) ? String(naira) : naira.toFixed(2));
    }
  }

  return (
    <ConfirmActionDialog
      open
      onOpenChange={close}
      title={`Cancel booking ${booking.booking_code}?`}
      sideEffects="Cancelling can't be undone. It does not refund anyone: it marks the booking for Finance's refund queue (refund requested, not refunded). A caregiver who accepted is notified and open offers are closed."
      confirmLabel="Cancel booking"
      destructive
      reasonLabel="Reason (saved in the audit log)"
      extraValid={code !== "" && refundValid}
      onConfirm={(reason) => {
        if (code === "" || refund === null) return Promise.resolve();
        const amount = refund === "partial" ? partialKobo : null;
        return act(
          () =>
            cancelBooking(booking.id, {
              reason_code: code,
              reason,
              refund,
              ...(refund === "partial" && amount !== null ? { refund_amount_kobo: amount } : {}),
            }),
          () => {
            if (refund === "none") return "Booking cancelled. No refund.";
            return `Booking cancelled. Refund requested: ${formatNaira(refund === "full" ? total : amount)}.`;
          },
        );
      }}
    >
      <Field label="Reason code" id={codeId}>
        <Select id={codeId} value={code} onChange={(e) => setCode(e.target.value as CancelReasonCode | "")}>
          <option value="">Choose a reason code</option>
          {CANCEL_REASON_CODES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
      </Field>

      {paid && policy.isError ? (
        <p className="text-xs text-muted-foreground">Couldn&apos;t load the cancellation policy</p>
      ) : null}
      {estimate ? (
        <div className="grid gap-1 rounded-md border p-3 text-sm">
          <p>
            Policy guide (estimate): {TIER_LABELS[estimate.tier]} — fee {estimate.feePercent}% of the service fee ={" "}
            {formatNaira(estimate.feeKobo)}; the family would get {formatNaira(estimate.refundKobo)} back.
          </p>
          {estimate.dependsOnOnMyWay ? (
            <p>Only if the caregiver&apos;s on-my-way tap qualifies; otherwise the standard tier applies.</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Based on the current policy; this booking may have been quoted different terms.
          </p>
          <Button type="button" size="sm" variant="outline" className="w-fit" onClick={applyEstimate}>
            Use this amount
          </Button>
        </div>
      ) : null}

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Refund</legend>
        {paid ? (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="refund" className="size-4" checked={refund === "full"} onChange={() => setRefund("full")} />
              Full refund ({formatNaira(total)})
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="refund" className="size-4" checked={refund === "partial"} onChange={() => setRefund("partial")} />
              Partial refund
            </label>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Not paid, so there is nothing to refund.</p>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="refund" className="size-4" checked={refund === "none"} onChange={() => setRefund("none")} />
          No refund
        </label>
      </fieldset>

      {paid && refund === "partial" ? (
        <Field label="Refund amount (₦)" id={amountId}>
          <Input id={amountId} inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
          {!partialValid ? (
            <p role="note" className="text-xs text-destructive">
              Enter an amount above ₦0 and below the {formatNaira(total)} paid.
            </p>
          ) : null}
        </Field>
      ) : null}

      {refund === "none" ? (
        <p role="note" className="rounded-md border border-warning/40 p-3 text-sm">
          The patient is not sent any cancellation message when there is no refund. Contact them yourself.
        </p>
      ) : null}
    </ConfirmActionDialog>
  );
}

function ConfirmAddressDialog({ booking, close, act }: DialogProps) {
  const paid = booking.payment.status === "paid";
  const [latText, setLatText] = React.useState("");
  const [lngText, setLngText] = React.useState("");
  const [line, setLine] = React.useState(booking.address.line ?? "");
  const latId = React.useId();
  const lngId = React.useId();
  const lineId = React.useId();
  const parse = (t: string) => (t.trim() === "" ? Number.NaN : Number(t));
  const lat = parse(latText);
  const lng = parse(lngText);
  const parsed = Number.isFinite(lat) && Number.isFinite(lng);
  const inside = parsed && insideNigeria(lat, lng);
  return (
    <ConfirmActionDialog
      open
      onOpenChange={close}
      title={`Confirm the address for booking ${booking.booking_code}?`}
      sideEffects={
        paid
          ? "Clears the hold, saves the coordinates and starts dispatch immediately: caregivers nearby are offered the visit."
          : "Clears the hold and saves the coordinates. Dispatch starts once the booking is paid."
      }
      confirmLabel="Confirm address"
      reasonLabel="Reason (how you confirmed the address)"
      extraValid={inside}
      onConfirm={(reason) =>
        act(
          () =>
            confirmAddress(booking.id, {
              reason,
              latitude: lat,
              longitude: lng,
              ...(line.trim() ? { address: line.trim() } : {}),
            }),
          (res) => (res.notified_caregivers > 0 ? `Address confirmed. ${offeredText(res.notified_caregivers)}` : "Address confirmed."),
        )
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <Field label="Latitude" id={latId}>
          <Input id={latId} type="number" step="any" value={latText} onChange={(e) => setLatText(e.target.value)} />
        </Field>
        <Field label="Longitude" id={lngId}>
          <Input id={lngId} type="number" step="any" value={lngText} onChange={(e) => setLngText(e.target.value)} />
        </Field>
      </div>
      {parsed && !inside ? (
        <p role="note" className="text-xs text-destructive">
          Outside Nigeria. Check the latitude and longitude are not swapped.
        </p>
      ) : null}
      <Field label="Street address" id={lineId}>
        <Input id={lineId} value={line} onChange={(e) => setLine(e.target.value)} />
      </Field>
    </ConfirmActionDialog>
  );
}

function CorrectStatusDialog({ booking, close, act }: DialogProps) {
  const [target, setTarget] = React.useState<CorrectionTarget | "">("");
  const targetId = React.useId();
  const targets = correctionTargets(booking.status);
  return (
    <ConfirmActionDialog
      open
      onOpenChange={close}
      title={`Correct the status of booking ${booking.booking_code}?`}
      sideEffects={
        target === ""
          ? "Corrections only move forward and can't be undone."
          : `Moves the booking forward to ${humanize(target).toLowerCase()} and sets the same start/end times the caregiver's app would. Corrections only move forward and can't be undone.${
              target === "completed" ? " Completing credits the caregiver's earning for this visit." : ""
            }`
      }
      confirmLabel="Correct status"
      destructive
      reasonLabel="Reason (required, saved in the audit log)"
      extraValid={target !== ""}
      onConfirm={(reason) => {
        if (target === "") return Promise.resolve();
        return act(
          () => correctStatus(booking.id, { status: target, reason }),
          () => `Status corrected to ${humanize(target).toLowerCase()}.`,
        );
      }}
    >
      <Field label="New status" id={targetId}>
        <Select id={targetId} value={target} onChange={(e) => setTarget(e.target.value as CorrectionTarget | "")}>
          <option value="">Choose a status</option>
          {targets.map((t) => (
            <option key={t} value={t}>
              {humanize(t)}
            </option>
          ))}
        </Select>
      </Field>
    </ConfirmActionDialog>
  );
}
