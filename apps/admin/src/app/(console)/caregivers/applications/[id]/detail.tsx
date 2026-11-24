"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { ApplicationActions } from "@/components/application-actions";
import { useAuth } from "@/components/auth-provider";
import { DecisionControl } from "@/components/decision-control";
import { DocumentCard } from "@/components/document-card";
import { IdentityCard } from "@/components/identity-card";
import { SkillsEditor } from "@/components/skills-editor";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { ApiError, errorMessage } from "@/lib/api";
import {
  type ApplicationDetail,
  decideBackgroundCheck,
  decideDocument,
  decideIdentity,
  getApplication,
  resetIdentity,
  roleLabel,
  saveSkills,
  unmetFromError,
} from "@/lib/caregivers";
import { asIdentityStatus } from "@/lib/identity";
import { formatWat, formatWatDate, humanize } from "@/lib/format";

export function ApplicationDetailView({ id }: { id: string }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["caregiver-application", id], queryFn: () => getApplication(id) });
  const [notice, setNotice] = React.useState<string | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["caregiver-application", id] });
    void queryClient.invalidateQueries({ queryKey: ["caregiver-applications"] });
  };

  const back = (
    <Link href="/caregivers/applications" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden /> Applications
    </Link>
  );

  if (query.isPending) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Loading application">
        {back}
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="grid gap-4">
        {back}
        {notFound ? (
          <EmptyState title="Application not found" hint="It may have been removed, or the link is wrong." />
        ) : (
          <ErrorState message={`We couldn't load this application. ${errorMessage({ detail: query.error.message }, "")}`.trim()} onRetry={() => void query.refetch()} />
        )}
      </div>
    );
  }

  const detail: ApplicationDetail = query.data;
  const { profile } = detail;
  const canDecide = can("caregivers.approve");
  // The roles the caregiver asked for. A request only: `detail.skills` is what an admin has confirmed.
  const requested = detail.requested_skills ?? [];

  /** Negative decisions on an approved caregiver auto-suspend; tell the admin when it happened. */
  const report = (result: unknown, done: string) => {
    const r = result as { auto_suspended?: boolean; affected_bookings?: string[] } | null;
    if (r?.auto_suspended) {
      const n = r.affected_bookings?.length ?? 0;
      setNotice(
        `${profile.full_name} was suspended automatically.` +
          (n > 0 ? ` ${n} upcoming accepted ${n === 1 ? "booking needs" : "bookings need"} reassignment.` : ""),
      );
    } else {
      setNotice(done);
    }
    refresh();
  };

  /**
   * Run an identity write. When the server says the case moved (`IDENTITY_CASE_CHANGED`) or a reset
   * is no longer allowed, nothing was changed: reload, close the dialog and say so, so the admin looks
   * at the new state instead of confirming again blind.
   */
  async function settleIdentity(write: () => Promise<void>) {
    try {
      await write();
    } catch (error) {
      const conflict = unmetFromError(error);
      const code = conflict?.unmet[0]?.code;
      if (conflict && (code === "IDENTITY_CASE_CHANGED" || code === "IDENTITY_RESET_NOT_ALLOWED")) {
        setNotice([conflict.message, ...conflict.unmet.map((u) => u.message)].join(". ") + ". The page was reloaded.");
        refresh();
        return;
      }
      throw error;
    }
  }

  return (
    <div className="grid max-w-5xl gap-6">
      {back}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{profile.full_name}</h1>
          <p className="text-sm text-muted-foreground">
            {profile.specialization ?? "No specialization"} · {profile.state ?? "No state"} · applied {formatWat(profile.created_at)}
          </p>
        </div>
        <StatusBadge value={profile.profile_status} />
      </header>

      {notice ? (
        <p role="status" className="rounded-md border border-warning/40 p-3 text-sm">
          {notice}
        </p>
      ) : null}

      <Section title="Decision">
        <ApplicationActions detail={detail} />
      </Section>

      <Section title="Profile">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Field label="Email" value={profile.email} />
          <Field label="Phone" value={profile.phone_number} />
          <Field label="Date of birth" value={profile.date_of_birth ? formatWatDate(profile.date_of_birth) : null} />
          <Field label="Gender" value={profile.gender ? humanize(profile.gender) : null} />
          <Field label="Address" value={profile.address} />
          <Field label="Emergency contact phone" value={profile.emergency_contact_phone} />
          <Field label="Experience" value={profile.years_of_experience !== null ? `${profile.years_of_experience} years` : null} />
          <Field label="Preferred hours" value={profile.preferred_work_hours} />
          <Field label="Service areas" value={profile.service_areas?.join(", ") ?? null} />
        </dl>
      </Section>

      <Section title="Consents">
        <ul className="grid gap-1 text-sm">
          <Consent label="Terms of service" accepted={detail.consents.terms_accepted} />
          <Consent label="Privacy policy" accepted={detail.consents.privacy_policy_accepted} />
          <Consent label="Background check consent" accepted={detail.consents.background_check_consent} />
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Consented {formatWat(detail.consents.consent_date)}</p>
      </Section>

      <Section title="Documents">
        {detail.documents.length === 0 ? (
          <EmptyState title="No documents uploaded" hint="The caregiver hasn't uploaded anything yet." />
        ) : (
          <ul className="grid gap-3">
            {detail.documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                canView={can("documents.read")}
                canDecide={canDecide}
                onDecide={async (docId, decision, reason, expiresOn) => {
                  const res = await decideDocument(docId, {
                    decision,
                    reason: reason ?? undefined,
                    expires_on: expiresOn ?? undefined,
                  });
                  report(res, decision === "verified" ? "Document verified." : "Document rejected.");
                }}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Verification checks">
        <div className="grid gap-3">
          <IdentityCard
            identity={detail.identity}
            profileStatus={profile.profile_status}
            canDecide={canDecide}
            onDecide={(decision, notes) =>
              settleIdentity(async () => {
                // expected_status makes the server refuse if the case moved since this page loaded.
                const res = await decideIdentity(id, { decision, notes, expected_status: asIdentityStatus(detail.identity.status) });
                report(res, `Identity marked ${decision}.`);
              })
            }
            onReset={(notes) =>
              settleIdentity(async () => {
                const res = await resetIdentity(id, { notes });
                report(res, `Another attempt allowed. ${profile.full_name} can start the identity check again.`);
              })
            }
          />
          <DecisionControl
            title="Background check"
            status={detail.background_check.status}
            positive={{ decision: "cleared", label: "Mark cleared" }}
            negative={{ decision: "failed", label: "Mark failed" }}
            positiveSideEffects="Records a cleared background check. It is mandatory before approval."
            negativeSideEffects={
              profile.profile_status === "approved"
                ? "This caregiver is approved. A failed background check suspends them immediately and emails them."
                : "Records a failed background check. The caregiver can't be approved."
            }
            canDecide={canDecide}
            withProviderReference
            onDecide={async (decision, notes, providerReference) => {
              const res = await decideBackgroundCheck(id, {
                decision: decision as "cleared" | "failed",
                notes,
                provider_reference: providerReference ?? undefined,
              });
              report(res, `Background check marked ${decision}.`);
            }}
          />
          {detail.background_check.decided_at ? (
            <p className="text-xs text-muted-foreground">Background check decided {formatWat(detail.background_check.decided_at)}</p>
          ) : null}
        </div>
      </Section>

      <Section title="Skills">
        {requested.length > 0 ? (
          <p data-testid="requested-roles" className="text-sm">
            Requested by the caregiver: {requested.map(roleLabel).join(", ")}
          </p>
        ) : null}
        <SkillsEditor
          key={JSON.stringify([detail.skills, requested])}
          skills={detail.skills}
          requested={requested}
          editable={canDecide}
          onSave={async (skills) => {
            await saveSkills(id, skills);
            setNotice("Skills saved.");
            refresh();
          }}
        />
      </Section>

      <Section title="History">
        {detail.audit_history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No admin actions recorded yet.</p>
        ) : (
          <ol className="grid gap-2 text-sm">
            {detail.audit_history.map((h) => (
              <li key={h.id} className="rounded-md border p-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{h.action}</span>
                  <time dateTime={h.created_at} className="text-xs text-muted-foreground">
                    {formatWat(h.created_at)}
                  </time>
                </div>
                {h.reason ? <p className="text-muted-foreground">{h.reason}</p> : null}
                <p className="text-xs text-muted-foreground">Admin {h.admin_user_id ?? "unknown"}</p>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = React.useId();
  return (
    <section aria-labelledby={id} className="rounded-lg border bg-card p-4">
      <h2 id={id} className="mb-3 text-base font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}

function Consent({ label, accepted }: { label: string; accepted: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden>{accepted ? "✓" : "✗"}</span>
      <span>
        {label}: {accepted ? "accepted" : "not accepted"}
      </span>
    </li>
  );
}
