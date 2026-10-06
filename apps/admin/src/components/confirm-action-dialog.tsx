"use client";

import { Loader2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What will happen, in plain words, before the admin confirms (PRD section 9). */
  sideEffects: string;
  confirmLabel: string;
  destructive?: boolean;
  /** When set, a reason is required and passed to `onConfirm`. */
  reasonLabel?: string;
  /** Extra fields shown above the reason (e.g. the items list for "request changes"). */
  children?: React.ReactNode;
  /** Parent-owned validation for the extra fields. */
  extraValid?: boolean;
  onConfirm: (reason: string) => Promise<void>;
}

/**
 * The single confirmation pattern for consequential actions: it states the side effects, requires a
 * non-blank reason when asked, and keeps the dialog open with the error if the request fails.
 * Radix provides the focus trap and Escape handling, and unmounts the form when closed, so the
 * reason and error always start empty.
 */
export function ConfirmActionDialog({ open, onOpenChange, ...rest }: Props) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => (busy ? undefined : onOpenChange(o))}>
      <DialogContent>
        <ConfirmForm {...rest} busy={busy} setBusy={setBusy} close={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ConfirmForm({
  title,
  sideEffects,
  confirmLabel,
  destructive,
  reasonLabel,
  children,
  extraValid = true,
  onConfirm,
  busy,
  setBusy,
  close,
}: Omit<Props, "open" | "onOpenChange"> & {
  busy: boolean;
  setBusy: (b: boolean) => void;
  close: () => void;
}) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const reasonId = React.useId();

  const needsReason = reasonLabel !== undefined;
  const canConfirm = !busy && extraValid && (!needsReason || reason.trim().length > 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      close();
    } catch (err) {
      setError(errorMessage({ detail: err instanceof Error ? err.message : "" }, "That didn't go through. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{sideEffects}</DialogDescription>
      </DialogHeader>
      {children}
      {needsReason ? (
        <div className="grid gap-1.5">
          <Label htmlFor={reasonId}>{reasonLabel}</Label>
          <Textarea id={reasonId} required value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} />
          <p className="text-xs text-muted-foreground">Required. It is saved in the audit log.</p>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button variant="outline" onClick={close} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={!canConfirm}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
