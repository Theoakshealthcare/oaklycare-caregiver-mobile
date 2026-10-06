"use client";

import { Eye, EyeOff, FileText } from "lucide-react";
import * as React from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { DocumentViewer } from "@/components/document-viewer";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DocumentRow } from "@/lib/caregivers";
import { formatWat, formatWatDate, humanize } from "@/lib/format";

interface Props {
  doc: DocumentRow;
  canView: boolean;
  canDecide: boolean;
  onDecide: (docId: string, decision: "verified" | "rejected", reason: string | null, expiresOn: string | null) => Promise<void>;
}

export function DocumentCard({ doc, canView, canDecide, onDecide }: Props) {
  const [showing, setShowing] = React.useState(false);
  const [dialog, setDialog] = React.useState<"verify" | "reject" | null>(null);
  const [expiresOn, setExpiresOn] = React.useState("");

  return (
    <li className="grid gap-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" aria-hidden />
          <div>
            <div className="text-sm font-medium">
              {humanize(doc.document_type)} <span className="font-normal text-muted-foreground">· {doc.document_name}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Uploaded {formatWat(doc.uploaded_at)}
              {doc.expires_on ? ` · expires ${formatWatDate(doc.expires_on)}` : ""}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={doc.verification_status} />
          {canView ? (
            <Button size="sm" variant="outline" aria-expanded={showing} onClick={() => setShowing((s) => !s)}>
              {showing ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
              {showing ? "Hide" : "View"}
              <span className="sr-only"> {doc.document_name}</span>
            </Button>
          ) : null}
          {canDecide ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setDialog("verify")}>
                Verify<span className="sr-only"> {doc.document_name}</span>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDialog("reject")}>
                Reject<span className="sr-only"> {doc.document_name}</span>
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {doc.rejection_reason ? <p className="text-sm text-destructive">Rejected: {doc.rejection_reason}</p> : null}
      {showing ? <DocumentViewer documentId={doc.id} name={doc.document_name} mimeType={doc.mime_type} /> : null}

      <ConfirmActionDialog
        open={dialog === "verify"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Verify ${doc.document_name}?`}
        sideEffects="Marks this document verified. A verified licence is one of the requirements for approval."
        confirmLabel="Verify document"
        onConfirm={() => onDecide(doc.id, "verified", null, expiresOn || null)}
      >
        <div className="grid gap-1.5">
          <Label htmlFor={`expires-${doc.id}`}>Expiry date (optional)</Label>
          <Input id={`expires-${doc.id}`} type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className="w-48" />
        </div>
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === "reject"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Reject ${doc.document_name}?`}
        sideEffects="Marks this document rejected. If it was the last verified licence of an approved caregiver, they are suspended immediately and any upcoming accepted bookings are listed for reassignment."
        confirmLabel="Reject document"
        destructive
        reasonLabel="Reason for rejection"
        onConfirm={(reason) => onDecide(doc.id, "rejected", reason, null)}
      />
    </li>
  );
}
