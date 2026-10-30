"use client";

import * as React from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  title: string;
  status: string;
  positive: { decision: string; label: string };
  negative: { decision: string; label: string };
  /** Extra warning when a negative decision has more consequences (e.g. auto-suspend after approval). */
  negativeSideEffects: string;
  positiveSideEffects: string;
  canDecide: boolean;
  /** Offer an optional "provider reference" field (background checks). */
  withProviderReference?: boolean;
  /** Extra buttons next to the two decisions (e.g. "Allow another attempt"); shown only to deciders. */
  extraActions?: React.ReactNode;
  onDecide: (decision: string, notes: string, providerReference: string | null) => Promise<void>;
}

/** A status plus the two possible decisions, each confirmed with required notes. */
export function DecisionControl({
  title,
  status,
  positive,
  negative,
  positiveSideEffects,
  negativeSideEffects,
  canDecide,
  withProviderReference,
  extraActions,
  onDecide,
}: Props) {
  const [open, setOpen] = React.useState<"positive" | "negative" | null>(null);
  const [providerRef, setProviderRef] = React.useState("");

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
      <div className="grid gap-1">
        <span className="text-sm font-medium">{title}</span>
        <StatusBadge value={status} />
      </div>
      {canDecide ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen("positive")}>
            {positive.label}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpen("negative")}>
            {negative.label}
          </Button>
          {extraActions}
        </div>
      ) : null}

      {(["positive", "negative"] as const).map((kind) => {
        const choice = kind === "positive" ? positive : negative;
        return (
          <ConfirmActionDialog
            key={kind}
            open={open === kind}
            onOpenChange={(o) => !o && setOpen(null)}
            title={`${title}: ${choice.label.toLowerCase()}`}
            sideEffects={kind === "positive" ? positiveSideEffects : negativeSideEffects}
            confirmLabel={choice.label}
            destructive={kind === "negative"}
            reasonLabel="Notes (what you checked)"
            onConfirm={(notes) => onDecide(choice.decision, notes, providerRef.trim() || null)}
          >
            {withProviderReference ? (
              <div className="grid gap-1.5">
                <Label htmlFor={`provider-ref-${kind}`}>Provider reference (optional)</Label>
                <Input id={`provider-ref-${kind}`} maxLength={200} value={providerRef} onChange={(e) => setProviderRef(e.target.value)} />
              </div>
            ) : null}
          </ConfirmActionDialog>
        );
      })}
    </div>
  );
}
