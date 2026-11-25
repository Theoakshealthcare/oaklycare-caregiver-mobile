"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";

import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { EarningStatusBadge } from "@/components/earning-status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatNaira, formatWat } from "@/lib/format";
import {
  EARNINGS_CLEAR_NO_SHOW,
  EARNINGS_HOLD,
  EARNINGS_VOID,
  type Earning,
  HOLD_KIND_LABEL,
  TYPE_LABEL,
  canHold,
  canReleaseHold,
  canVoid,
  clearanceHasPassed,
  holdEarning,
  holdKind,
  invalidateEarnings,
  releaseEarningHold,
  voidEarning,
} from "@/lib/earnings";

type Action = "hold" | "release" | "void";

function describe(e: Earning) {
  return `${formatNaira(e.amount_kobo)} for ${e.caregiver_name ?? "this caregiver"} (booking ${e.booking_code ?? "none"})`;
}

function releaseEffects(e: Earning) {
  const when = clearanceHasPassed(e)
    ? `Its clearing time (${formatWat(e.available_at)}) has already passed, so it is paid on the very next release run.`
    : `It is paid on the first release run after ${formatWat(e.available_at)}.`;
  const noShow = holdKind(e) === "no_show" ? " This booking was flagged as a no-show: releasing pays money that flag stopped." : "";
  return `The earning goes back to pending and then into the caregiver's available balance. ${when}${noShow}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/**
 * A side panel with everything the API says about one earning and the actions the admin may take on it. Hold and
 * Release hold need `ledger.adjust_request`; Void needs `ledger.adjust`. An action the admin lacks the permission for is
 * not rendered (as on Payouts). Each action goes through the confirm dialog, which names the earning, says what will
 * happen and requires a reason; the API's own refusal is shown in that dialog as it came back.
 */
export function EarningDrawer({
  earning,
  onClose,
  onDone,
}: {
  earning: Earning;
  onClose: () => void;
  onDone: (notice: string) => void;
}) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [action, setAction] = React.useState<Action | null>(null);

  const kind = holdKind(earning);
  const mayHold = can(EARNINGS_HOLD);
  const mayVoid = can(EARNINGS_VOID);
  const noShowBlocked = kind === "no_show" && !can(EARNINGS_CLEAR_NO_SHOW);
  const showHold = mayHold && canHold(earning);
  const showRelease = mayHold && canReleaseHold(earning) && !noShowBlocked;
  const showVoid = mayVoid && canVoid(earning);
  const who = earning.caregiver_name ?? "the caregiver";

  // A refused action can still mean the earning changed (the release job may have paid it a moment ago), so the list
  // and the nav badge refresh on failure too.
  const act = async (run: () => Promise<unknown>, notice: string) => {
    try {
      await run();
    } catch (e) {
      void invalidateEarnings(queryClient);
      throw e;
    }
    await invalidateEarnings(queryClient);
    onClose();
    onDone(notice);
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="left-auto right-0 top-0 h-full max-w-md translate-x-0 translate-y-0 content-start overflow-y-auto rounded-none">
          <DialogHeader>
            <DialogTitle>
              {formatNaira(earning.amount_kobo)} for {who}
            </DialogTitle>
            <DialogDescription>
              {TYPE_LABEL[earning.type]}
              {earning.booking_code ? ` for booking ${earning.booking_code}` : ""}
            </DialogDescription>
          </DialogHeader>

          <dl className="grid gap-2">
            <Row label="Status">
              <EarningStatusBadge status={earning.status} />
            </Row>
            {kind ? <Row label="Why it is held">{HOLD_KIND_LABEL[kind]}</Row> : null}
            {earning.status_reason ? (
              <Row label={earning.status === "voided" ? "Void reason" : earning.status === "held" ? "Hold reason" : "Last reason"}>
                {earning.status_reason}
              </Row>
            ) : null}
            {earning.status_changed_at ? (
              <Row label="Last change">
                {formatWat(earning.status_changed_at)}
                {earning.status_changed_by ? " by an admin" : " by the system"}
              </Row>
            ) : null}
            <Row label="Caregiver">{earning.caregiver_name ?? "—"}</Row>
            <Row label="Booking">
              {earning.booking_id && earning.booking_code ? (
                <Link href={`/bookings/${earning.booking_id}`} className="underline underline-offset-2">
                  {earning.booking_code}
                </Link>
              ) : (
                "—"
              )}
            </Row>
            <Row label="Share">
              {earning.share_percent !== null && earning.base_amount_kobo !== null
                ? `${earning.share_percent}% of ${formatNaira(earning.base_amount_kobo)}`
                : "—"}
            </Row>
            <Row label="Credited">{formatWat(earning.created_at)}</Row>
            <Row label={earning.status === "successful" ? "Clears at" : "Clears after"}>{formatWat(earning.available_at)}</Row>
            {earning.released_at ? <Row label="Released">{formatWat(earning.released_at)}</Row> : null}
          </dl>

          {noShowBlocked && canReleaseHold(earning) ? (
            <p className="rounded-md border border-warning/40 p-3 text-sm">
              This booking is flagged as a no-show. Releasing its hold needs the ledger.adjust permission, which only a
              Super Admin has.
            </p>
          ) : null}
          {earning.status === "successful" ? (
            <p className="text-sm text-muted-foreground">
              This earning is already in the caregiver&apos;s balance and cannot be changed here. Correct it with a ledger
              adjustment.
            </p>
          ) : null}
          {earning.status === "voided" ? <p className="text-sm text-muted-foreground">This earning was voided and is never paid.</p> : null}

          {showHold || showRelease || showVoid ? (
            <div className="flex flex-wrap gap-2">
              {showRelease ? (
                <Button onClick={() => setAction("release")}>Release hold</Button>
              ) : null}
              {showHold ? (
                <Button variant="outline" onClick={() => setAction("hold")}>
                  Hold
                </Button>
              ) : null}
              {showVoid ? (
                <Button variant="outline" onClick={() => setAction("void")}>
                  Void
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {action === "hold" ? (
        <ConfirmActionDialog
          open
          onOpenChange={(o) => !o && setAction(null)}
          title={`Hold ${describe(earning)}?`}
          sideEffects="The earning stops clearing on its own, so it stays out of the caregiver's available balance until someone releases the hold or voids it."
          confirmLabel="Hold earning"
          reasonLabel="Reason for holding"
          onConfirm={(reason) => act(() => holdEarning(earning.id, reason), `Earning for ${who} is on hold.`)}
        />
      ) : null}
      {action === "release" ? (
        <ConfirmActionDialog
          open
          onOpenChange={(o) => !o && setAction(null)}
          title={`Release the hold on ${describe(earning)}?`}
          sideEffects={releaseEffects(earning)}
          confirmLabel="Release hold"
          destructive
          reasonLabel="Reason for releasing"
          onConfirm={(reason) => act(() => releaseEarningHold(earning.id, reason), `Hold released: the earning for ${who} is pending again.`)}
        />
      ) : null}
      {action === "void" ? (
        <ConfirmActionDialog
          open
          onOpenChange={(o) => !o && setAction(null)}
          title={`Void ${describe(earning)}?`}
          sideEffects="Writes the earning off: the caregiver is never paid this money. It cannot be undone from here."
          confirmLabel="Void earning"
          destructive
          reasonLabel="Reason for voiding"
          onConfirm={(reason) => act(() => voidEarning(earning.id, reason), `Earning for ${who} was voided.`)}
        />
      ) : null}
    </>
  );
}
