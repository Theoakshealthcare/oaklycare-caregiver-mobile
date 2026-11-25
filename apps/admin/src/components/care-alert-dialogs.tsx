"use client";

import { Loader2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/api";
import { type CareAlert, familyLine, TYPE_LABEL } from "@/lib/care-alerts";
import { formatWat, humanize } from "@/lib/format";

export type AlertAction = "acknowledge" | "resolve";

const COPY: Record<AlertAction, { title: string; sideEffects: string; confirm: string }> = {
  acknowledge: {
    title: "Acknowledge this alert",
    sideEffects: "Marks the alert as being handled and records you and the time. Nobody is messaged.",
    confirm: "Acknowledge",
  },
  resolve: {
    title: "Resolve this alert",
    sideEffects:
      "Closes the alert. If the same patient has another out-of-range reading or missed task later, a new alert opens and the family is told again.",
    confirm: "Resolve",
  },
};

/** The confirmation for acknowledge and resolve. The note is optional (up to 1000 characters) and is stored encrypted, not in the audit log. */
export function AlertActionDialog({
  alert,
  action,
  onClose,
  onConfirm,
}: {
  alert: CareAlert | null;
  action: AlertAction | null;
  onClose: () => void;
  onConfirm: (alert: CareAlert, action: AlertAction, note: string) => Promise<void>;
}) {
  const open = alert !== null && action !== null;
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => (!o && !busy ? onClose() : undefined)}>
      <DialogContent>
        {alert && action ? (
          <NoteForm alert={alert} action={action} busy={busy} setBusy={setBusy} onClose={onClose} onConfirm={onConfirm} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function NoteForm({
  alert,
  action,
  busy,
  setBusy,
  onClose,
  onConfirm,
}: {
  alert: CareAlert;
  action: AlertAction;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onClose: () => void;
  onConfirm: (alert: CareAlert, action: AlertAction, note: string) => Promise<void>;
}) {
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const noteId = React.useId();
  const copy = COPY[action];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(alert, action, note.trim());
      onClose();
    } catch (err) {
      setError(errorMessage({ detail: err instanceof Error ? err.message : "" }, "That didn't go through. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>{copy.sideEffects}</DialogDescription>
      </DialogHeader>
      <p className="rounded-md bg-muted px-3 py-2 text-sm">{alert.summary}</p>
      <div className="grid gap-1.5">
        <Label htmlFor={noteId}>Note (optional)</Label>
        <Textarea id={noteId} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        <p className="text-xs text-muted-foreground">Kept with the alert, encrypted. It is not copied into the audit log.</p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {copy.confirm}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** The one alert's detail: the clinical content comes only from the detail route, and only for an admin who may read it. */
export function AlertDetailBody({ alert }: { alert: CareAlert }) {
  const d = alert.detail;
  return (
    <dl className="grid gap-3 text-sm">
      <Row label="What">
        {TYPE_LABEL[alert.type]}: {alert.summary}
      </Row>
      {alert.occurrence_count > 1 ? (
        <Row label="Repeats">
          {alert.occurrence_count} times, latest {formatWat(alert.last_occurred_at)}
        </Row>
      ) : null}
      {alert.care_recipient_name ? <Row label="About">{alert.care_recipient_name}</Row> : null}
      {alert.booking_code ? <Row label="Visit">{alert.booking_code}</Row> : null}
      {alert.detail_masked ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-muted-foreground">
          Clinical detail needs the Clinical Reviewer or Super Admin role.
        </p>
      ) : d ? (
        <>
          {d.vital_type ? (
            <Row label="Reading">
              {humanize(d.vital_type)} {d.value} {d.unit} ({humanize(d.status)})
            </Row>
          ) : null}
          {d.reason ? <Row label="Why it was flagged">{d.reason}</Row> : null}
          {d.tasks && d.tasks.length > 0 ? (
            <Row label="Not marked done">
              <ul className="list-disc pl-5">
                {d.tasks.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
              {d.days && d.days.length > 0 ? <span className="text-xs text-muted-foreground">On {d.days.join(", ")}</span> : null}
            </Row>
          ) : null}
        </>
      ) : null}
      <Row label="Family">{familyLine(alert)}</Row>
      {alert.admin_notified_at ? <Row label="Admins e-mailed">{formatWat(alert.admin_notified_at)}</Row> : null}
      {alert.acknowledged_by ? (
        <Row label="Acknowledged">
          {alert.acknowledged_by.email}, {formatWat(alert.acknowledged_at)}
        </Row>
      ) : null}
      {alert.resolved_by ? (
        <Row label="Resolved">
          {alert.resolved_by.email}, {formatWat(alert.resolved_at)}
        </Row>
      ) : null}
      {alert.note ? <Row label="Note">{alert.note}</Row> : null}
    </dl>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
