"use client";

import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/format";
import {
  type Payout,
  PAYOUTS_ACT,
  canCancelPayout,
  canResolvePayout,
  canRetryPayout,
  cancelPayout,
  invalidatePayouts,
  resolvePayout,
  retryPayout,
  unfreezeCaregiver,
} from "@/lib/payouts";

type Dialog = "cancel" | "retry" | "resolve" | null;

/** "₦12,000 to Placeholder Paid (batch 2026-10-19)": names the exact payout in every confirmation. */
function describe(p: Payout) {
  return `${formatNaira(p.amount_kobo)} to ${p.caregiver_name ?? "this caregiver"} (batch ${p.batch_period ?? "—"})`;
}

/**
 * Per-payout actions. Every one needs `ledger.adjust` (Super Admin today), so for anyone else nothing
 * is rendered, not a disabled button. Each goes through the confirm dialog, which names the payout
 * and amount, so the admin sees which money is about to move.
 */
export function PayoutActions({ payout, onDone }: { payout: Payout; onDone?: (notice: string) => void }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = React.useState<Dialog>(null);
  if (!can(PAYOUTS_ACT)) return null;

  const close = (o: boolean) => !o && setDialog(null);
  const done = (notice: string) => async () => {
    await invalidatePayouts(queryClient);
    onDone?.(notice);
  };
  // A refused action can still have changed the payout server-side (e.g. retry refused because Paystack
  // says it was paid, which moves it to needs_attention), so refresh on failure too.
  const act = async (run: () => Promise<unknown>, notice: string) => {
    try {
      await run();
    } catch (e) {
      void invalidatePayouts(queryClient);
      throw e;
    }
    await done(notice)();
  };

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canCancelPayout(payout) ? (
        <Button size="sm" variant="outline" onClick={() => setDialog("cancel")}>
          Cancel<span className="sr-only"> payout of {describe(payout)}</span>
        </Button>
      ) : null}
      {canRetryPayout(payout) ? (
        <Button size="sm" variant="outline" onClick={() => setDialog("retry")}>
          Retry<span className="sr-only"> payout of {describe(payout)}</span>
        </Button>
      ) : null}
      {canResolvePayout(payout) ? (
        <Button size="sm" variant="outline" onClick={() => setDialog("resolve")}>
          Resolve<span className="sr-only"> payout of {describe(payout)}</span>
        </Button>
      ) : null}

      {dialog === "cancel" ? (
        <ConfirmActionDialog
          open
          onOpenChange={close}
          title={`Cancel payout of ${describe(payout)}?`}
          sideEffects="The reserved money goes back to the caregiver's available balance and the next batch can pay it. Only a payout that hasn't been approved can be cancelled."
          confirmLabel="Cancel payout"
          destructive
          reasonLabel="Reason for cancelling"
          onConfirm={async (reason) => {
            await act(() => cancelPayout(payout.id, reason), `Payout to ${payout.caregiver_name ?? "the caregiver"} was cancelled.`);
          }}
        />
      ) : null}
      {dialog === "retry" ? (
        <ConfirmActionDialog
          open
          onOpenChange={close}
          title={`Retry payout of ${describe(payout)}?`}
          sideEffects="Oakly first asks Paystack about the last attempt and only sends again on a definite failure. The money is reserved again and sent as a new attempt, so the caregiver's balance goes down by this amount."
          confirmLabel="Retry payout"
          destructive
          reasonLabel="Reason for retrying"
          onConfirm={async (reason) => {
            await act(() => retryPayout(payout.id, reason), `Payout to ${payout.caregiver_name ?? "the caregiver"} is being sent again.`);
          }}
        />
      ) : null}
      {dialog === "resolve" ? (
        <ResolveDialog
          payout={payout}
          onOpenChange={close}
          onResolve={(body) =>
            act(() => resolvePayout(payout.id, body), `Payout to ${payout.caregiver_name ?? "the caregiver"} was resolved.`)
          }
        />
      ) : null}
    </div>
  );
}

type Outcome = "paid" | "failed";

const RESOLVE_EFFECTS: Record<Outcome | "none", string> = {
  none: "Choose what Paystack shows for this transfer. Oakly asks Paystack first and refuses an answer Paystack contradicts.",
  paid: "Marks the payout as paid. The reserved money is treated as sent and no money moves. If Paystack paid it after money was returned, that money is taken back from the balance as far as it goes.",
  failed:
    "Closes the payout as failed and returns the reserved money to the caregiver's available balance, net of any shortfall they owe. This is refused if Paystack says the transfer was paid.",
};

function ResolveDialog({
  payout,
  onOpenChange,
  onResolve,
}: {
  payout: Payout;
  onOpenChange: (open: boolean) => void;
  onResolve: (body: { outcome: Outcome; reason: string; force: boolean }) => Promise<void>;
}) {
  // Nothing is preselected: the admin must state the outcome, so a stray click can't pick one.
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);
  const [force, setForce] = React.useState(false);
  return (
    <ConfirmActionDialog
      open
      onOpenChange={onOpenChange}
      title={`Resolve payout of ${describe(payout)}?`}
      sideEffects={RESOLVE_EFFECTS[outcome ?? "none"]}
      confirmLabel={outcome === "failed" ? "Resolve as failed" : outcome === "paid" ? "Resolve as paid" : "Resolve"}
      destructive
      reasonLabel="Reason (how you checked Paystack)"
      extraValid={outcome !== null}
      onConfirm={async (reason) => {
        if (!outcome) return;
        await onResolve({ outcome, reason, force });
      }}
    >
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Outcome</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="outcome" className="size-4" checked={outcome === "paid"} onChange={() => setOutcome("paid")} />
          Paid: Paystack shows the transfer succeeded
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="outcome" className="size-4" checked={outcome === "failed"} onChange={() => setOutcome("failed")} />
          Failed: the transfer did not go through
        </label>
      </fieldset>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 size-4" checked={force} onChange={(e) => setForce(e.target.checked)} />
        <span>
          Force. Tick only when Paystack&apos;s answer isn&apos;t final (pending, waiting for an OTP, no record, or
          unreachable) and you have checked another way. It never overrides a definite answer. If Paystack later answers
          differently, this payout needs attention again and the caregiver is frozen; a forced Failed returns the money
          while Paystack may still pay, which can mean paying twice.
        </span>
      </label>
    </ConfirmActionDialog>
  );
}

/** Unfreeze one caregiver. The confirmation spells out the shortfall debit and the write-off. */
export function UnfreezeButton({
  caregiverId,
  name,
  shortfallKobo,
  onDone,
}: {
  caregiverId: string;
  name: string | null;
  shortfallKobo: number;
  onDone?: (notice: string) => void;
}) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  if (!can(PAYOUTS_ACT)) return null;
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Unfreeze<span className="sr-only"> {name ?? "caregiver"}</span>
      </Button>
      {open ? (
        <UnfreezeDialog
          name={name}
          shortfallKobo={shortfallKobo}
          onOpenChange={setOpen}
          onConfirm={async (reason, writeOff) => {
            const res = await unfreezeCaregiver(caregiverId, { reason, write_off_shortfall: writeOff });
            await invalidatePayouts(queryClient);
            onDone?.(
              `${name ?? "The caregiver"} can be paid again. Debited from their balance: ${formatNaira(res.debited_from_balance_kobo)}. Written off: ${formatNaira(res.written_off_shortfall_kobo)}.`,
            );
          }}
        />
      ) : null}
    </>
  );
}

function UnfreezeDialog({
  name,
  shortfallKobo,
  onOpenChange,
  onConfirm,
}: {
  name: string | null;
  shortfallKobo: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string, writeOff: boolean) => Promise<void>;
}) {
  const [writeOff, setWriteOff] = React.useState(false);
  // The shortfall we can see is only what the loaded payouts show, so the write-off option appears once
  // the server itself says a shortfall is left (its refusal names the amount), or when we already see one.
  const [offerWriteOff, setOfferWriteOff] = React.useState(shortfallKobo > 0);
  const owed =
    shortfallKobo > 0
      ? `Paystack paid ${formatNaira(shortfallKobo)} beyond what they earned. `
      : "No shortfall is recorded on the payouts shown here. ";
  return (
    <ConfirmActionDialog
      open
      onOpenChange={onOpenChange}
      title={`Unfreeze ${name ?? "this caregiver"}?`}
      sideEffects={`${owed}Earnings that built up while they were frozen are debited from their available balance first to cover any shortfall, so their balance can only go down. If a shortfall is still left the unfreeze is refused, unless you write it off below, which is permanent. After this they are included in the next batch.`}
      confirmLabel="Unfreeze"
      destructive
      reasonLabel="Reason for unfreezing"
      onConfirm={async (reason) => {
        try {
          await onConfirm(reason, writeOff);
        } catch (e) {
          if (e instanceof Error && e.message.includes("write_off_shortfall")) setOfferWriteOff(true);
          throw e;
        }
      }}
    >
      {offerWriteOff ? (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 size-4" checked={writeOff} onChange={(e) => setWriteOff(e.target.checked)} />
          <span>Write off any shortfall their balance cannot cover. This cannot be undone.</span>
        </label>
      ) : null}
    </ConfirmActionDialog>
  );
}
