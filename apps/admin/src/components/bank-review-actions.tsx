"use client";

import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import {
  type BankReview,
  accountEnding,
  approveBankReview,
  isConflict,
  rejectBankReview,
} from "@/lib/bank-reviews";
import { formatNaira } from "@/lib/format";
import { PAYOUTS_EXECUTE, invalidatePayouts } from "@/lib/payouts";

type Dialog = "approve" | "reject" | null;

/** "Placeholder Tosin, Placeholder Bank ******0011": names the exact account in every confirmation. */
function describe(r: BankReview) {
  return `${r.caregiver_name ?? "this caregiver"}, ${r.bank_name} ${r.account_number}`;
}

/** The two names and the account the reviewer is about to decide on, repeated in the dialog so they confirm what they saw. */
function Summary({ review }: { review: BankReview }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border bg-muted/40 p-3 text-sm">
      <dt className="text-muted-foreground">Profile name</dt>
      <dd className="font-medium">{review.caregiver_name ?? "—"}</dd>
      <dt className="text-muted-foreground">Name at the bank</dt>
      <dd className="font-medium">{review.account_name}</dd>
      <dt className="text-muted-foreground">Account</dt>
      <dd>
        {review.bank_name} {review.account_number}
      </dd>
      <dt className="text-muted-foreground">Balance</dt>
      <dd>{formatNaira(review.balance_kobo)}</dd>
    </dl>
  );
}

/**
 * Approve / Reject for one held account. Both need `payouts.execute` (Finance, Super Admin), so without it nothing is
 * rendered, not a disabled button. The decision carries the row's `review_token`, which names the exact account (number, bank and
 * holder name) the queue showed: if the caregiver has saved another account since the queue loaded, even one ending in
 * the same four digits, the backend answers 409 and nothing has been decided. That, and a 409 for an account already decided, close the dialog, reload the queue, and tell the reviewer
 * with the server's own sentence, so a decision is never made on an account they have not seen.
 */
export function BankReviewActions({
  review,
  onDone,
  onConflict,
}: {
  review: BankReview;
  onDone?: (notice: string) => void;
  onConflict?: (notice: string) => void;
}) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = React.useState<Dialog>(null);
  if (!can(PAYOUTS_EXECUTE) || review.status !== "pending") return null;

  const close = (o: boolean) => !o && setDialog(null);
  const decide = async (run: () => Promise<unknown>, notice: string) => {
    try {
      await run();
    } catch (e) {
      if (!isConflict(e)) throw e;
      // Refused and unchanged: show the row as it is now, not as the reviewer last saw it.
      await invalidatePayouts(queryClient);
      onConflict?.(e.message);
      return;
    }
    await invalidatePayouts(queryClient);
    onDone?.(notice);
  };
  const who = review.caregiver_name ?? "the caregiver";

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button size="sm" variant="outline" onClick={() => setDialog("approve")}>
        Approve<span className="sr-only"> account {describe(review)}</span>
      </Button>
      <Button size="sm" variant="outline" onClick={() => setDialog("reject")}>
        Reject<span className="sr-only"> account {describe(review)}</span>
      </Button>

      {dialog === "approve" ? (
        <ConfirmActionDialog
          open
          onOpenChange={close}
          title={`Approve account ending ${accountEnding(review)} for ${who}?`}
          sideEffects="Confirm the account belongs to this caregiver. Payouts to it resume in the next batch. Check the two names below before you approve."
          confirmLabel="Approve account"
          reasonLabel="Reason for approving (how you checked it is theirs)"
          onConfirm={(reason) => decide(() => approveBankReview(review, reason), `Account for ${who} was approved. Payouts to it resume.`)}
        >
          <Summary review={review} />
        </ConfirmActionDialog>
      ) : null}
      {dialog === "reject" ? (
        <ConfirmActionDialog
          open
          onOpenChange={close}
          title={`Reject account ending ${accountEnding(review)} for ${who}?`}
          sideEffects="No payout is made to this account and the caregiver has to save a different one. Their earnings stay in their balance."
          confirmLabel="Reject account"
          destructive
          reasonLabel="Reason for rejecting"
          onConfirm={(reason) => decide(() => rejectBankReview(review, reason), `Account for ${who} was rejected. They must save a different one.`)}
        >
          <Summary review={review} />
        </ConfirmActionDialog>
      ) : null}
    </div>
  );
}
