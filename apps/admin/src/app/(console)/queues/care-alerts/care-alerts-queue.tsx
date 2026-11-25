"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { type AlertAction, AlertActionDialog, AlertDetailBody } from "@/components/care-alert-dialogs";
import { PatientCell } from "@/components/booking-cells";
import { Pager } from "@/components/pager";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select } from "@/components/ui/input";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import {
  CARE_ALERTS_LIST_KEY,
  PAGE_SIZE,
  POLL_MS,
  STATUS_FILTERS,
  STATUS_LABEL,
  TYPE_LABEL,
  type CareAlert,
  type CareAlertSeverity,
  type CareAlertType,
  type StatusFilter,
  acknowledgeCareAlert,
  careAlertKey,
  familyLine,
  fetchCareAlert,
  fetchCareAlerts,
  invalidateCareAlerts,
  resolveCareAlert,
} from "@/lib/care-alerts";
import { formatWat } from "@/lib/format";

export function CareAlertsQueue() {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<StatusFilter>("active");
  const [severity, setSeverity] = React.useState<CareAlertSeverity | "">("");
  const [type, setType] = React.useState<CareAlertType | "">("");
  const [offset, setOffset] = React.useState(0);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [acting, setActing] = React.useState<{ alert: CareAlert; action: AlertAction } | null>(null);
  const [viewing, setViewing] = React.useState<CareAlert | null>(null);

  const list = useQuery({
    queryKey: [...CARE_ALERTS_LIST_KEY, status, severity, type, offset],
    queryFn: () => fetchCareAlerts({ status, severity: severity || undefined, type: type || undefined, offset }),
    refetchInterval: POLL_MS,
  });

  const reset = (apply: () => void) => {
    apply();
    setOffset(0);
  };

  async function confirm(alert: CareAlert, action: AlertAction, note: string) {
    try {
      const next = await (action === "acknowledge" ? acknowledgeCareAlert : resolveCareAlert)(alert.id, note);
      queryClient.setQueryData(careAlertKey(alert.id), next);
      setNotice(action === "acknowledge" ? "Alert acknowledged." : "Alert resolved.");
    } catch (e) {
      // A 409 means someone else got there first: show the server's sentence in the dialog and reload the row underneath.
      void invalidateCareAlerts(queryClient);
      throw e;
    }
    await invalidateCareAlerts(queryClient);
  }

  const counts = list.data?.counts;

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Care alerts</h1>
        <p className="text-sm text-muted-foreground">
          A reading outside the safe range, or a care task not done by the end of a visit. Critical alerts come first. The family contact has
          already been messaged when they allowed it and could be reached.
        </p>
      </div>

      {counts ? (
        <p className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
          <Badge tone={counts.critical_active > 0 ? "danger" : "neutral"}>{counts.critical_active} critical need work</Badge>
          <span>{counts.open} open</span>
          <span aria-hidden>·</span>
          <span>{counts.acknowledged} acknowledged</span>
          <span aria-hidden>·</span>
          <span>{counts.resolved} resolved</span>
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-md border border-success/40 px-3 py-2 text-sm text-success">
          {notice}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label htmlFor="alert-status">Status</label>
        <Select id="alert-status" className="w-60" value={status} onChange={(e) => reset(() => setStatus(e.target.value as StatusFilter))}>
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <label htmlFor="alert-severity">Severity</label>
        <Select
          id="alert-severity"
          className="w-36"
          value={severity}
          onChange={(e) => reset(() => setSeverity(e.target.value as CareAlertSeverity | ""))}
        >
          <option value="">All</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
        </Select>
        <label htmlFor="alert-type">Type</label>
        <Select id="alert-type" className="w-52" value={type} onChange={(e) => reset(() => setType(e.target.value as CareAlertType | ""))}>
          <option value="">All</option>
          {(Object.keys(TYPE_LABEL) as CareAlertType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </div>

      {list.isPending ? (
        <div className="grid gap-2" aria-busy="true" aria-label="Loading the alerts">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState
          message={`We couldn't load the alerts. ${errorMessage({ detail: list.error.message }, "")}`.trim()}
          onRetry={() => void list.refetch()}
        />
      ) : list.data.items.length === 0 ? (
        <EmptyState title="No alerts here" hint="Nothing matches these filters. New alerts appear on their own while this page is open." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[64rem] text-left text-sm">
              <caption className="sr-only">Care alerts</caption>
              <thead className="border-b bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2">Severity</th>
                  <th scope="col" className="px-3 py-2">What happened</th>
                  <th scope="col" className="px-3 py-2">Patient</th>
                  <th scope="col" className="px-3 py-2">Latest</th>
                  <th scope="col" className="px-3 py-2">Family</th>
                  <th scope="col" className="px-3 py-2">Status</th>
                  <th scope="col" className="px-3 py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((a) => (
                  <tr key={a.id} className="border-b align-top last:border-0" aria-label={`${a.severity} alert: ${a.summary}`}>
                    <td className="px-3 py-2">
                      <Badge tone={a.severity === "critical" ? "danger" : "warning"}>{a.severity === "critical" ? "Critical" : "Warning"}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div>{a.summary}</div>
                      <div className="text-xs text-muted-foreground">
                        {TYPE_LABEL[a.type]}
                        {a.occurrence_count > 1 ? ` · ${a.occurrence_count} times` : ""}
                      </div>
                      {a.severity === "critical" ? <div className="text-xs font-medium text-destructive">Emergency: call 112.</div> : null}
                    </td>
                    <td className="px-3 py-2">
                      <PatientCell patient={a.patient} />
                      {a.care_recipient_name ? <div className="text-xs text-muted-foreground">for {a.care_recipient_name}</div> : null}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatWat(a.last_occurred_at)}</td>
                    <td className="px-3 py-2 text-xs">{familyLine(a)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge value={a.status} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setViewing(a)}>
                          Details
                          <span className="sr-only"> of {a.summary}</span>
                        </Button>
                        {a.status === "open" ? (
                          <Button size="sm" variant="outline" onClick={() => setActing({ alert: a, action: "acknowledge" })}>
                            Acknowledge
                            <span className="sr-only"> {a.summary}</span>
                          </Button>
                        ) : null}
                        {a.status !== "resolved" ? (
                          <Button size="sm" onClick={() => setActing({ alert: a, action: "resolve" })}>
                            Resolve
                            <span className="sr-only"> {a.summary}</span>
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager offset={offset} pageSize={PAGE_SIZE} total={list.data.total} onChange={setOffset} />
        </>
      )}

      <AlertActionDialog alert={acting?.alert ?? null} action={acting?.action ?? null} onClose={() => setActing(null)} onConfirm={confirm} />
      <AlertDetailDialog alert={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

/** Opens one alert through the detail route: that read is what the audit log records. */
function AlertDetailDialog({ alert, onClose }: { alert: CareAlert | null; onClose: () => void }) {
  const detail = useQuery({
    queryKey: careAlertKey(alert?.id ?? "none"),
    queryFn: () => fetchCareAlert(alert!.id),
    enabled: alert !== null,
  });
  return (
    <Dialog open={alert !== null} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Care alert</DialogTitle>
          <DialogDescription>Opening the clinical detail is recorded in the audit log.</DialogDescription>
        </DialogHeader>
        {detail.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : detail.isError ? (
          <ErrorState message={`We couldn't open this alert. ${errorMessage({ detail: detail.error.message }, "")}`.trim()} onRetry={() => void detail.refetch()} />
        ) : (
          <AlertDetailBody alert={detail.data} />
        )}
      </DialogContent>
    </Dialog>
  );
}
