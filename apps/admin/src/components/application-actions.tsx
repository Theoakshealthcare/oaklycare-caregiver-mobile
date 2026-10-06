"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import * as React from "react";

import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { errorMessage } from "@/lib/api";
import {
  type ApplicationDetail,
  approveCaregiver,
  reinstateCaregiver,
  rejectCaregiver,
  requestChanges,
  suspendCaregiver,
  unmetFromError,
} from "@/lib/caregivers";
import { humanize } from "@/lib/format";

type Dialog = "reject" | "changes" | "suspend" | "reinstate" | null;

interface Unmet {
  message: string;
  unmet: { code: string; message: string }[];
}

/**
 * The decision panel: approve (with the backend's "unmet" list rendered inline on 409), plus the
 * confirmed actions reject, request changes, suspend and reinstate. Which buttons appear follows the
 * backend state machine and the admin's permissions.
 */
export function ApplicationActions({ detail }: { detail: ApplicationDetail }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const { id, full_name: name, profile_status: status } = detail.profile;
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const [unmet, setUnmet] = React.useState<Unmet | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [changeItems, setChangeItems] = React.useState("");

  const canDecide = can("caregivers.approve");
  const canSuspend = can("caregivers.suspend");

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["caregiver-application", id] });
    void queryClient.invalidateQueries({ queryKey: ["caregiver-applications"] });
  };

  const approve = useMutation({
    mutationFn: () => approveCaregiver(id),
    onMutate: () => {
      setUnmet(null);
      setNotice(null);
      setActionError(null);
    },
    onSuccess: () => {
      setNotice(`${name} is approved and can now receive bookings. They have been emailed.`);
      refresh();
    },
    onError: (err) => {
      const u = unmetFromError(err);
      if (u) setUnmet(u);
      else setActionError(errorMessage({ detail: err.message }, "We couldn't approve this application."));
    },
  });

  const items = changeItems
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const afterAction = (message: string) => {
    setUnmet(null);
    setActionError(null);
    setNotice(message);
    refresh();
  };

  const available = {
    approve: status === "under_review" && canDecide,
    reject: (status === "under_review" || status === "changes_requested") && canDecide,
    changes: status === "under_review" && canDecide,
    suspend: status === "approved" && canSuspend,
    reinstate: status === "suspended" && canSuspend,
  };
  const anyAvailable = Object.values(available).some(Boolean);

  return (
    <div className="grid gap-4">
      {notice ? (
        <p role="status" className="flex items-start gap-2 rounded-md border border-success/40 p-3 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          {notice}
        </p>
      ) : null}

      {unmet ? (
        <div role="alert" className="rounded-md border border-destructive/40 p-4">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4 text-destructive" aria-hidden />
            {unmet.message}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Fix these first, then try again:</p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {unmet.unmet.map((u) => (
              <li key={u.code}>{u.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {actionError ? (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {anyAvailable ? (
        <div className="flex flex-wrap gap-2">
          {available.approve ? (
            <Button onClick={() => approve.mutate()} disabled={approve.isPending}>
              {approve.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Approve
            </Button>
          ) : null}
          {available.changes ? (
            <Button variant="outline" onClick={() => setDialog("changes")}>
              Request changes
            </Button>
          ) : null}
          {available.reject ? (
            <Button variant="outline" onClick={() => setDialog("reject")}>
              Reject
            </Button>
          ) : null}
          {available.suspend ? (
            <Button variant="destructive" onClick={() => setDialog("suspend")}>
              Suspend
            </Button>
          ) : null}
          {available.reinstate ? (
            <Button onClick={() => setDialog("reinstate")}>Reinstate</Button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {!canDecide && !canSuspend
            ? "You can view this application but your role can't decide it."
            : `No actions are available while the application is ${humanize(status).toLowerCase()}.`}
        </p>
      )}

      <ConfirmActionDialog
        open={dialog === "reject"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Reject ${name}?`}
        sideEffects={`This closes the application and emails ${name} your reason. It is recorded in the audit log.`}
        confirmLabel="Reject application"
        destructive
        reasonLabel="Reason for rejection"
        onConfirm={async (reason) => {
          await rejectCaregiver(id, reason);
          afterAction(`${name}'s application was rejected and they were emailed.`);
        }}
      />

      <ConfirmActionDialog
        open={dialog === "changes"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Request changes from ${name}`}
        sideEffects={`${name} is emailed the items below and your note, and can fix and resubmit in the app.`}
        confirmLabel="Send request"
        reasonLabel="Note to the caregiver"
        extraValid={items.length > 0}
        onConfirm={async (note) => {
          await requestChanges(id, items, note);
          setChangeItems("");
          afterAction(`Changes requested. ${name} was emailed.`);
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="change-items">What needs fixing (one item per line)</Label>
          <Textarea id="change-items" value={changeItems} onChange={(e) => setChangeItems(e.target.value)} placeholder={"Licence photo is blurry\nAddress is incomplete"} />
        </div>
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === "suspend"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Suspend ${name}?`}
        sideEffects={`${name} is taken out of matching immediately and cannot start visits. They are emailed your reason. Any upcoming accepted bookings are listed for reassignment.`}
        confirmLabel="Suspend caregiver"
        destructive
        reasonLabel="Reason for suspension"
        onConfirm={async (reason) => {
          const res = (await suspendCaregiver(id, reason)) as { affected_bookings?: string[] };
          const n = res.affected_bookings?.length ?? 0;
          afterAction(
            n > 0
              ? `${name} is suspended. ${n} upcoming accepted ${n === 1 ? "booking needs" : "bookings need"} reassignment.`
              : `${name} is suspended.`,
          );
        }}
      />

      <ConfirmActionDialog
        open={dialog === "reinstate"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Reinstate ${name}?`}
        sideEffects={`${name} becomes bookable again. The approval checks run again first, so this fails with a list if anything is no longer valid.`}
        confirmLabel="Reinstate caregiver"
        onConfirm={async () => {
          try {
            await reinstateCaregiver(id);
          } catch (err) {
            const u = unmetFromError(err);
            if (!u) throw err;
            setUnmet(u);
            setNotice(null);
            return;
          }
          afterAction(`${name} is reinstated.`);
        }}
      />
    </div>
  );
}
