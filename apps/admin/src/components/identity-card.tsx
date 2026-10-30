"use client";

import Link from "next/link";
import * as React from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { DecisionControl } from "@/components/decision-control";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import type { IdentityAttempt, IdentityBlock, ProfileStatus } from "@/lib/caregivers";
import { formatWat } from "@/lib/format";
import { OPEN_ATTEMPT_STATUSES, matchWords, reasonWords, scoreWords } from "@/lib/identity";

interface Props {
  identity: IdentityBlock;
  profileStatus: ProfileStatus;
  /** `caregivers.approve`: decide and reset. Reading is gated by the page. */
  canDecide: boolean;
  onDecide: (decision: "verified" | "failed", notes: string) => Promise<void>;
  onReset: (notes: string) => Promise<void>;
}

/**
 * The identity (KYC) check: what the provider said, attempt by attempt, and the admin's actions.
 * Only references, scores, yes/no results and reason codes appear here: Oakly stores no ID number
 * or image, so there is nothing else to show.
 */
export function IdentityCard({ identity, profileStatus, canDecide, onDecide, onReset }: Props) {
  const [resetOpen, setResetOpen] = React.useState(false);
  const duplicate = identity.duplicate_of_caregiver_id;

  return (
    <div className="grid gap-3 rounded-md border p-3" data-testid="identity-card">
      <DecisionControl
        title="Identity"
        status={identity.status}
        positive={{ decision: "verified", label: "Mark verified" }}
        negative={{ decision: "failed", label: "Mark failed" }}
        positiveSideEffects={
          duplicate
            ? "Another account already passed with this ID number. Verify only if you have checked that this is allowed. This records that you checked the caregiver's identity, which approval requires."
            : "Records that you checked this caregiver's identity. Required for approval."
        }
        negativeSideEffects={
          profileStatus === "approved"
            ? "This caregiver is approved. A failed identity check suspends them immediately and emails them."
            : "Records a failed identity check. The caregiver can't be approved until it is verified."
        }
        canDecide={canDecide}
        onDecide={(decision, notes) => onDecide(decision as "verified" | "failed", notes)}
        extraActions={
          canDecide && identity.can_reset ? (
            <Button size="sm" variant="outline" onClick={() => setResetOpen(true)}>
              Allow another attempt
            </Button>
          ) : null
        }
      />

      <ConfirmActionDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Identity: allow another attempt"
        sideEffects={`The caregiver goes back to Pending with a fresh set of ${identity.attempts_max} attempts. The attempts so far stay in the history but no longer count. Nobody is told: the app picks the change up the next time the caregiver opens it.`}
        confirmLabel="Allow another attempt"
        reasonLabel="Notes (why another attempt is allowed)"
        onConfirm={onReset}
      />

      {identity.review_reason ? (
        <p className="text-sm" data-testid="review-reason">
          <span className="font-medium">Why a person has to look: </span>
          <span title={identity.review_reason}>{reasonWords(identity.review_reason)}</span>
        </p>
      ) : null}

      {duplicate ? (
        <p className="text-sm">
          <span className="font-medium">Same ID number as another caregiver: </span>
          <Link href={`/caregivers/applications/${duplicate}`} className="underline underline-offset-4">
            Open that caregiver
          </Link>
        </p>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Attempts used: {identity.attempts_used} of {identity.attempts_max}. Oakly does not keep ID numbers or images. To see the person, search the identity provider&apos;s dashboard for the provider reference (outside Oakly).
      </p>

      {identity.attempts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attempts yet. The caregiver has not started the identity check.</p>
      ) : (
        <ol className="grid gap-2" aria-label="Identity attempts, newest first">
          {identity.attempts.map((a) => (
            <AttemptItem key={a.id} attempt={a} />
          ))}
        </ol>
      )}
    </div>
  );
}

function AttemptItem({ attempt: a }: { attempt: IdentityAttempt }) {
  const open = OPEN_ATTEMPT_STATUSES.includes(a.status);
  return (
    <li className="grid gap-2 rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">Attempt {a.attempt_no}</span>
        <StatusBadge value={a.status} />
      </div>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <Item label="Started" value={formatWat(a.created_at)} />
        <Item label="Finished" value={a.completed_at ? formatWat(a.completed_at) : open ? "Waiting for the provider" : "—"} />
        <Item label="ID type" value={a.id_type ? a.id_type.toUpperCase() : "Not reported"} />
        <Item label="Decided by" value={a.decided_via ? (a.decided_via === "admin" ? "An admin" : "The system") : "Not decided"} />
        <Item
          label="Face match score"
          value={a.face_threshold !== null && a.face_threshold !== undefined ? `${scoreWords(a.face_confidence)} (pass mark ${a.face_threshold})` : scoreWords(a.face_confidence)}
        />
        <Item label="Liveness score" value={scoreWords(a.liveness_confidence)} />
        <Item label="Name" value={matchWords(a.name_match)} />
        <Item label="Date of birth" value={matchWords(a.dob_match)} />
        <Item label="Provider reference" value={a.provider_reference ?? "No reference supplied"} />
      </dl>
      {a.reason_codes.length > 0 ? (
        <div>
          <p className="text-xs text-muted-foreground">Reasons</p>
          <ul className="grid gap-1">
            {a.reason_codes.map((code) => (
              <li key={code} title={code}>
                {reasonWords(code)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
