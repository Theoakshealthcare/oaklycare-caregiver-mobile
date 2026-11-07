"use client";

import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { formatNairaValue } from "@/lib/format";
import {
  REFUNDS_LIST_KEY,
  STAFF_REASONS,
  type RefundDetail,
  type RefundReason,
  approveRefund,
  closeRefund,
  differentAmountFromError,
  invalidateRefunds,
  nairaInput,
  parseNaira,
  refundDetailKey,
  rejectRefund,
  requestRefund,
  resolveRefund,
  retryRefund,
  submitBankDetails,
  switchRefundToWallet,
} from "@/lib/refunds";

type Dialog = "approve" | "reject" | "retry" | "bank_details" | "switch_to_wallet" | "close" | "resolve" | null;

/** "₦20,000 for booking 780212EB": every confirmation names the money and the booking. */
function describe(r: RefundDetail) {
  const amount = r.amount_naira ?? r.suggested_amount_naira;
  return `${amount === null ? "a refund" : formatNairaValue(amount)} for booking ${r.booking_code ?? "—"}`;
}

const LABELS: Record<Exclude<Dialog, null>, string> = {
  approve: "Approve",
  reject: "Reject",
  retry: "Retry",
  bank_details: "Enter bank details",
  switch_to_wallet: "Switch to wallet",
  close: "Close refund",
  resolve: "Resolve",
};

/**
 * The buttons come only from the server's `available_actions` for this admin: nothing is re-derived from
 * permissions here, so "someone else must approve it", the limit and the Super Admin-only actions all follow
 * the backend. Each action goes through a confirmation that names the refund.
 */
export function RefundActions({ refund, onDone }: { refund: RefundDetail; onDone?: (notice: string) => void }) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const actions = refund.available_actions;
  if (actions.length === 0) return null;

  const close = (o: boolean) => !o && setDialog(null);
  // Every write returns the new detail: put it in the cache, then refresh the lists. A refused write can still have
  // changed the refund (retry refused because Paystack says it was processed moves it to needs_review), so reload on failure.
  const act = async (run: () => Promise<RefundDetail>, notice: (next: RefundDetail) => string) => {
    let next: RefundDetail;
    try {
      next = await run();
    } catch (e) {
      void invalidateRefunds(queryClient);
      throw e;
    }
    queryClient.setQueryData(refundDetailKey(refund.id), next);
    await queryClient.invalidateQueries({ queryKey: REFUNDS_LIST_KEY });
    onDone?.(notice(next));
  };
  const button = (action: Exclude<Dialog, null>, variant: "default" | "outline") => (
    <Button key={action} variant={variant} onClick={() => setDialog(action)}>
      {LABELS[action]}
      <span className="sr-only"> refund of {describe(refund)}</span>
    </Button>
  );
  const has = (a: string) => (actions as string[]).includes(a);
  const who = `refund of ${describe(refund)}`;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {has("approve") ? button("approve", "default") : null}
      {has("bank_details") ? button("bank_details", "default") : null}
      {has("retry") ? button("retry", "default") : null}
      {has("switch_to_wallet") ? button("switch_to_wallet", "outline") : null}
      {has("resolve") ? button("resolve", "default") : null}
      {has("reject") ? button("reject", "outline") : null}
      {has("close") ? button("close", "outline") : null}

      {dialog === "approve" ? (
        <ApproveDialog
          refund={refund}
          onOpenChange={close}
          onApprove={(body) => act(() => approveRefund(refund.id, body), (next) => `Approved ${describe(next)}.`)}
        />
      ) : null}
      {dialog === "reject" ? (
        <ConfirmActionDialog
          open
          onOpenChange={close}
          title={`Reject ${who}?`}
          sideEffects="Rejecting is final. No money moves, and the booking can be refunded again."
          confirmLabel="Reject refund"
          destructive
          reasonLabel="Reason for rejecting"
          onConfirm={async (reason) => {
            await act(() => rejectRefund(refund.id, reason), (next) => `Rejected ${describe(next)}.`);
          }}
        />
      ) : null}
      {dialog === "retry" ? (
        <ConfirmActionDialog
          open
          onOpenChange={close}
          title={`Retry ${who}?`}
          sideEffects="Oakly first asks Paystack whether the last attempt really failed and only goes on if it did. The refund goes back to approved and the send job makes a new attempt within about a minute. The earlier attempt stays on record."
          confirmLabel="Retry refund"
          onConfirm={async () => {
            await act(() => retryRefund(refund.id), (next) => `Retrying ${describe(next)}: the next attempt is sent within about a minute.`);
          }}
        />
      ) : null}
      {dialog === "switch_to_wallet" ? (
        <ConfirmActionDialog
          open
          onOpenChange={close}
          title={`Switch ${who} to the wallet?`}
          sideEffects="Oakly first asks Paystack whether the last attempt really failed. Then the family's Oakly wallet is credited at once and the refund is complete. Only for app bookers; a Super Admin action."
          confirmLabel="Credit the wallet"
          destructive
          onConfirm={async () => {
            await act(() => switchRefundToWallet(refund.id), (next) => `Credited the family's wallet with ${describe(next)}.`);
          }}
        />
      ) : null}
      {dialog === "close" ? (
        <ConfirmActionDialog
          open
          onOpenChange={close}
          title={`Close ${who}?`}
          sideEffects="Oakly first asks Paystack whether the last attempt really failed. The money stays with Oakly, the refund is closed for good and the booking can be refunded again."
          confirmLabel="Close refund"
          destructive
          reasonLabel="Reason for closing"
          onConfirm={async (reason) => {
            await act(() => closeRefund(refund.id, reason), (next) => `Closed ${describe(next)}.`);
          }}
        />
      ) : null}
      {dialog === "bank_details" ? (
        <BankDetailsDialog
          refund={refund}
          onOpenChange={close}
          onSubmit={(body) =>
            act(() => submitBankDetails(refund.id, body), (next) => `Bank details sent to Paystack for ${describe(next)}. Paystack will confirm.`)
          }
        />
      ) : null}
      {dialog === "resolve" ? (
        <ResolveDialog
          refund={refund}
          onOpenChange={close}
          onResolve={(body) => act(() => resolveRefund(refund.id, body), (next) => `Resolved ${describe(next)}.`)}
        />
      ) : null}
    </div>
  );
}

/**
 * Wallet-credit refunds are off for app users in v1 (owner decision 2026-11-07): the backend setting
 * `REFUND_WALLET_CREDIT_ENABLED` is false and it answers 409 `wallet_refunds_disabled` to the wallet destination. So the
 * approve dialog offers no destination choice and always sends the original payment method. The API type still allows
 * `"wallet"`; when the flag is turned on, bring the picker back here.
 */
const ORIGINAL_METHOD = "original_method" as const;

function ApproveDialog({
  refund,
  onOpenChange,
  onApprove,
}: {
  refund: RefundDetail;
  onOpenChange: (open: boolean) => void;
  onApprove: (body: {
    amount_naira: number;
    destination: "original_method" | "wallet";
    take_back_from_caregiver: boolean;
    take_back_reason?: string;
    note?: string;
  }) => Promise<void>;
}) {
  const max = refund.max_approvable_naira;
  const suggested = refund.suggested_amount_naira;
  // Start from the suggestion, or from the most this admin may approve when the suggestion is above it.
  const [amount, setAmount] = React.useState(nairaInput(suggested === null ? null : Math.min(suggested, max)));
  const [takeBack, setTakeBack] = React.useState(false);
  const [takeBackReason, setTakeBackReason] = React.useState("");
  const [note, setNote] = React.useState("");
  const value = parseNaira(amount);
  const withinMax = value !== null && value <= max + 1e-9;
  const preview = refund.take_back_preview_naira ?? 0;
  const canTakeBack = refund.booking.completed && preview > 0;
  const valid = withinMax && (!takeBack || takeBackReason.trim().length > 0);
  return (
    <ConfirmActionDialog
      open
      onOpenChange={onOpenChange}
      title={`Approve refund for booking ${refund.booking_code ?? "—"}?`}
      sideEffects="Approving does not send the money. The send job sends it to Paystack within about a minute and Paystack's answer finishes it. You can approve less than suggested, never more than the most you are allowed."
      confirmLabel="Approve refund"
      extraValid={valid}
      onConfirm={async () => {
        if (value === null) return;
        await onApprove({
          amount_naira: value,
          destination: ORIGINAL_METHOD,
          take_back_from_caregiver: canTakeBack && takeBack,
          take_back_reason: canTakeBack && takeBack ? takeBackReason.trim() : undefined,
          note: note.trim() || undefined,
        });
      }}
    >
      {refund.needs_super_admin ? (
        <p className="rounded-md border border-warning/40 p-3 text-sm">
          This refund ({formatNairaValue(suggested)}) is above the most you can approve now ({formatNairaValue(max)}). A
          Super Admin must approve the full amount. You can approve up to {formatNairaValue(max)}.
        </p>
      ) : null}
      <div className="grid gap-1.5">
        <label htmlFor="approve-amount" className="text-sm font-medium">
          Amount to refund (₦)
        </label>
        <Input
          id="approve-amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-describedby="approve-amount-hint"
          aria-invalid={!withinMax}
        />
        <p id="approve-amount-hint" className={`text-xs ${withinMax ? "text-muted-foreground" : "text-destructive"}`}>
          {suggested === null ? "No amount was suggested: enter the one to refund. " : `Suggested ${formatNairaValue(suggested)}. `}
          Between {formatNairaValue(0.01)} and {formatNairaValue(max)}, the most you can approve now.
        </p>
      </div>
      {canTakeBack ? (
        <div className="grid gap-2 rounded-md border p-3 text-sm">
          <p>
            This visit was completed. Taking back the caregiver&apos;s share would be{" "}
            <strong>{formatNairaValue(preview)}</strong> at the suggested amount (it is proportional to what you refund, and
            you can&apos;t edit it). Nothing is taken until Paystack says the money has left; what the caregiver&apos;s wallet can&apos;t cover
            is recovered from their next earnings. The caregiver is never asked to repay.
          </p>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 size-4" checked={takeBack} onChange={(e) => setTakeBack(e.target.checked)} />
            <span>Take the caregiver&apos;s share back</span>
          </label>
          {takeBack ? (
            <div className="grid gap-1.5">
              <label htmlFor="take-back-reason" className="font-medium">
                Reason for taking it back
              </label>
              <Textarea id="take-back-reason" value={takeBackReason} onChange={(e) => setTakeBackReason(e.target.value)} maxLength={2000} />
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <label htmlFor="approve-note" className="text-sm font-medium">
          Note (optional)
        </label>
        <Textarea id="approve-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
      </div>
    </ConfirmActionDialog>
  );
}

function BankDetailsDialog({
  refund,
  onOpenChange,
  onSubmit,
}: {
  refund: RefundDetail;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: { bank_code: string; account_number: string }) => Promise<void>;
}) {
  const [bankCode, setBankCode] = React.useState("");
  const [accountNumber, setAccountNumber] = React.useState("");
  const valid = bankCode.trim().length > 0 && /^\d{10}$/.test(accountNumber);
  return (
    <ConfirmActionDialog
      open
      onOpenChange={onOpenChange}
      title={`Enter bank details for refund of ${describe(refund)}`}
      sideEffects="Get the family's bank account by phone. Paystack could not send this back to their card. The account number goes to Paystack only: Oakly never stores or shows it again, just its last four digits and the name Paystack finds. You can't enter them if you approved or raised this refund."
      confirmLabel="Send bank details"
      extraValid={valid}
      onConfirm={async () => {
        await onSubmit({ bank_code: bankCode.trim(), account_number: accountNumber });
      }}
    >
      <div className="grid gap-1.5">
        <label htmlFor="bank-code" className="text-sm font-medium">
          Bank code
        </label>
        <Input id="bank-code" value={bankCode} onChange={(e) => setBankCode(e.target.value)} autoComplete="off" maxLength={10} />
        <p className="text-xs text-muted-foreground">Paystack&apos;s bank code, for example 058. Paystack refuses a code it does not know.</p>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="account-number" className="text-sm font-medium">
          Account number
        </label>
        <Input
          id="account-number"
          inputMode="numeric"
          autoComplete="off"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
        />
        <p className="text-xs text-muted-foreground">Exactly 10 digits.</p>
      </div>
    </ConfirmActionDialog>
  );
}

type Outcome = "succeeded" | "failed";

const RESOLVE_EFFECTS: Record<Outcome | "none", string> = {
  none: "Look at the refund on the Paystack dashboard first, then say what Paystack shows. Oakly asks Paystack again and refuses an answer it contradicts.",
  succeeded:
    "Records the refund as complete once: the booking's payment status, any caregiver take-back and the family's message. If Paystack processed a different amount, the server says so and you resolve again with that amount.",
  failed:
    "Marks the refund failed so it can be retried or closed. Refused if the money already left; reversing that is done on the Paystack dashboard.",
};

function ResolveDialog({
  refund,
  onOpenChange,
  onResolve,
}: {
  refund: RefundDetail;
  onOpenChange: (open: boolean) => void;
  onResolve: (body: { outcome: Outcome; note: string; amount_naira?: number }) => Promise<void>;
}) {
  // Nothing is preselected, so a stray click can't pick an outcome.
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);
  // Offered once the server says Paystack confirmed a different amount (it names it in kobo).
  const [offerAmount, setOfferAmount] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const value = parseNaira(amount);
  const amountOk = !offerAmount || value !== null;
  return (
    <ConfirmActionDialog
      open
      onOpenChange={onOpenChange}
      title={`Resolve refund of ${describe(refund)}?`}
      sideEffects={RESOLVE_EFFECTS[outcome ?? "none"]}
      confirmLabel={outcome === "failed" ? "Resolve as failed" : outcome === "succeeded" ? "Resolve as succeeded" : "Resolve"}
      destructive
      reasonLabel="Note (what you checked on the Paystack dashboard)"
      extraValid={outcome !== null && amountOk}
      onConfirm={async (note) => {
        if (!outcome) return;
        try {
          await onResolve({ outcome, note, ...(offerAmount && value !== null ? { amount_naira: value } : {}) });
        } catch (e) {
          const different = e instanceof Error ? differentAmountFromError(e.message) : null;
          if (different) {
            setOfferAmount(true);
            if (different.naira !== null) setAmount(nairaInput(different.naira));
          }
          throw e;
        }
      }}
    >
      {refund.review_reason ? (
        <p className="rounded-md border border-warning/40 p-3 text-sm">Why it needs a person: {refund.review_reason}</p>
      ) : null}
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">What Paystack shows</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="outcome" className="size-4" checked={outcome === "succeeded"} onChange={() => setOutcome("succeeded")} />
          Succeeded: the refund was processed
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="outcome" className="size-4" checked={outcome === "failed"} onChange={() => setOutcome("failed")} />
          Failed: no refund went out
        </label>
      </fieldset>
      {offerAmount ? (
        <div className="grid gap-1.5">
          <label htmlFor="resolve-amount" className="text-sm font-medium">
            Amount Paystack processed (₦)
          </label>
          <Input id="resolve-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <p className="text-xs text-muted-foreground">Check it against the Paystack dashboard before you confirm.</p>
        </div>
      ) : null}
    </ConfirmActionDialog>
  );
}

/** Raise a refund by hand (a complaint, say). The person who raises it can never approve it. */
export function RequestRefundButton({ onDone }: { onDone?: (notice: string) => void }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  if (!can("refunds.request")) return null;
  return (
    <>
      <Button onClick={() => setOpen(true)}>Raise a refund</Button>
      {open ? (
        <RequestDialog
          onOpenChange={setOpen}
          onRequest={async (body) => {
            const created = await requestRefund(body);
            queryClient.setQueryData(refundDetailKey(created.id), created);
            await invalidateRefunds(queryClient);
            onDone?.(
              `Refund raised for booking ${created.booking_code ?? "—"}. Another admin has to approve it: you can't approve a refund you raised.`,
            );
          }}
        />
      ) : null}
    </>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function RequestDialog({
  onOpenChange,
  onRequest,
}: {
  onOpenChange: (open: boolean) => void;
  onRequest: (body: { booking_id: string; amount_naira: number; reason_code: RefundReason; note?: string }) => Promise<void>;
}) {
  const [bookingId, setBookingId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState<RefundReason>("complaint");
  const [note, setNote] = React.useState("");
  const value = parseNaira(amount);
  return (
    <ConfirmActionDialog
      open
      onOpenChange={onOpenChange}
      title="Raise a refund"
      sideEffects="Raising a refund moves no money. It joins the queue as pending approval and a different admin has to approve it. Only for a paid booking that is completed or cancelled, and a booking can't have two open refunds."
      confirmLabel="Raise refund"
      extraValid={UUID.test(bookingId.trim()) && value !== null}
      onConfirm={async () => {
        if (value === null) return;
        await onRequest({
          booking_id: bookingId.trim(),
          amount_naira: value,
          reason_code: reason,
          note: note.trim() || undefined,
        });
      }}
    >
      <div className="grid gap-1.5">
        <label htmlFor="request-booking" className="text-sm font-medium">
          Booking ID
        </label>
        <Input id="request-booking" value={bookingId} onChange={(e) => setBookingId(e.target.value)} autoComplete="off" />
        <p className="text-xs text-muted-foreground">The long id in the booking page&apos;s address, not the 8-character code.</p>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="request-amount" className="text-sm font-medium">
          Amount (₦)
        </label>
        <Input id="request-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <p className="text-xs text-muted-foreground">Up to two decimals. It can&apos;t be more than is still refundable on the booking.</p>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="request-reason" className="text-sm font-medium">
          Reason
        </label>
        <Select id="request-reason" value={reason} onChange={(e) => setReason(e.target.value as RefundReason)}>
          {STAFF_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="request-note" className="text-sm font-medium">
          Note (optional)
        </label>
        <Textarea id="request-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
      </div>
    </ConfirmActionDialog>
  );
}
