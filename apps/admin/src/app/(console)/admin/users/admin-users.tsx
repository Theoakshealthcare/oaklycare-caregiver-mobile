"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, UserPlus } from "lucide-react";
import * as React from "react";

import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import {
  ADMIN_AUTH_PATHS,
  ADMIN_ROLES,
  type AdminUserRow,
  type InviteAdminRequest,
  type PatchAdminRequest,
  extractInviteToken,
  parseAdminList,
} from "@/lib/admin-auth-contract";
import { adminRequest, errorMessage } from "@/lib/api";
import { formatWat, humanize } from "@/lib/format";

const roleLabel = (slug: string) => ADMIN_ROLES.find((r) => r.slug === slug)?.label ?? humanize(slug);

export function AdminUsers() {
  const { admin: me } = useAuth();
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => parseAdminList(await adminRequest<unknown>("GET", ADMIN_AUTH_PATHS.admins)),
  });
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteLink, setInviteLink] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<AdminUserRow | null>(null);
  const [disabling, setDisabling] = React.useState<AdminUserRow | null>(null);
  const [resetting, setResetting] = React.useState<AdminUserRow | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  const patch = (id: string, body: PatchAdminRequest) =>
    adminRequest<unknown>("PATCH", `${ADMIN_AUTH_PATHS.admins}/${id}`, body);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Admin users</h1>
          <p className="text-sm text-muted-foreground">Invite staff, change their roles, and disable access.</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus aria-hidden /> Invite admin
        </Button>
      </div>

      {notice ? (
        <p role="status" className="rounded-md border border-success/40 p-3 text-sm">
          {notice}
        </p>
      ) : null}

      {list.isPending ? (
        <div className="grid gap-2" aria-busy="true" aria-label="Loading admin users">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState message={`We couldn't load admin users. ${errorMessage({ detail: list.error.message }, "")}`.trim()} onRetry={() => void list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState title="No other admins yet" hint="Invite a teammate to give them access." />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <caption className="sr-only">Admin users</caption>
            <thead className="border-b bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2">Name</th>
                <th scope="col" className="px-3 py-2">Roles</th>
                <th scope="col" className="px-3 py-2">Status</th>
                <th scope="col" className="px-3 py-2">Last sign-in</th>
                <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((row) => {
                const self = row.id === me?.id;
                return (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.full_name}{self ? " (you)" : ""}</div>
                      <div className="text-xs text-muted-foreground">{row.email}</div>
                    </td>
                    <td className="px-3 py-2">{row.roles.map(roleLabel).join(", ") || "—"}</td>
                    <td className="px-3 py-2"><StatusBadge value={row.status === "active" ? "approved" : row.status === "disabled" ? "suspended" : "pending"} /></td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatWat(row.last_login_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
                          Edit roles<span className="sr-only"> for {row.full_name}</span>
                        </Button>
                        {!self ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setResetting(row)}>
                              Reset MFA<span className="sr-only"> for {row.full_name}</span>
                            </Button>
                            {row.status === "disabled" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  void patch(row.id, { status: "active" }).then(() => {
                                    setNotice(`${row.full_name} can sign in again.`);
                                    refresh();
                                  }).catch((e: unknown) => setNotice(errorMessage({ detail: e instanceof Error ? e.message : "" }, "We couldn't enable that account.")));
                                }}
                              >
                                Enable<span className="sr-only"> {row.full_name}</span>
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => setDisabling(row)}>
                                Disable<span className="sr-only"> {row.full_name}</span>
                              </Button>
                            )}
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={(token) => {
          setInviteLink(`${window.location.origin}/accept-invite?token=${encodeURIComponent(token)}`);
          refresh();
        }}
      />
      <InviteLinkDialog link={inviteLink} onClose={() => setInviteLink(null)} />

      <EditRolesDialog
        row={editing}
        onClose={() => setEditing(null)}
        onSave={async (row, roles) => {
          await patch(row.id, { roles });
          setNotice(`${row.full_name}'s roles were updated.`);
          refresh();
        }}
      />

      <ConfirmActionDialog
        open={disabling !== null}
        onOpenChange={(o) => !o && setDisabling(null)}
        title={`Disable ${disabling?.full_name ?? ""}?`}
        sideEffects="They can't sign in until you enable them again. The last Super Admin can't be disabled."
        confirmLabel="Disable account"
        destructive
        onConfirm={async () => {
          if (!disabling) return;
          await patch(disabling.id, { status: "disabled" });
          setNotice(`${disabling.full_name} was disabled.`);
          refresh();
        }}
      />

      <ConfirmActionDialog
        open={resetting !== null}
        onOpenChange={(o) => !o && setResetting(null)}
        title={`Reset MFA for ${resetting?.full_name ?? ""}?`}
        sideEffects="They must enroll an authenticator again at their next sign-in before they can get in."
        confirmLabel="Reset MFA"
        destructive
        onConfirm={async () => {
          if (!resetting) return;
          await adminRequest<unknown>("POST", `${ADMIN_AUTH_PATHS.admins}/${resetting.id}/reset-mfa`);
          setNotice(`${resetting.full_name} must set up MFA again at next sign-in.`);
          refresh();
        }}
      />
    </div>
  );
}

function RoleChecklist({ value, onChange }: { value: string[]; onChange: (roles: string[]) => void }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Roles</legend>
      {ADMIN_ROLES.map((role) => (
        <label key={role.slug} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={value.includes(role.slug)}
            onChange={(e) => onChange(e.target.checked ? [...value, role.slug] : value.filter((s) => s !== role.slug))}
          />
          {role.label}
        </label>
      ))}
    </fieldset>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onInvited: (token: string) => void;
}) {
  const [email, setEmail] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [roles, setRoles] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const invite = useMutation({
    mutationFn: (body: InviteAdminRequest) => adminRequest<unknown>("POST", ADMIN_AUTH_PATHS.admins, body),
    onSuccess: (res) => {
      const token = extractInviteToken(res);
      if (!token) {
        setError("The admin was created but the server didn't return an invite link. Check the admin list.");
        return;
      }
      setEmail("");
      setFullName("");
      setRoles([]);
      onOpenChange(false);
      onInvited(token);
    },
    onError: (e) => setError(errorMessage({ detail: e.message }, "We couldn't send that invite.")),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setError(null); }}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            invite.mutate({ email: email.trim(), full_name: fullName.trim(), roles });
          }}
        >
          <DialogHeader>
            <DialogTitle>Invite an admin</DialogTitle>
            <DialogDescription>You&apos;ll get a single-use link to send them. It is shown once.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="invite-name">Full name</Label>
            <Input id="invite-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <RoleChecklist value={roles} onChange={setRoles} />
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={invite.isPending || !email || !fullName || roles.length === 0}>
              Create invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The invite token is only available in this response; once closed it can't be shown again. */
function InviteLinkDialog({ link, onClose }: { link: string | null; onClose: () => void }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Dialog open={link !== null} onOpenChange={(o) => { if (!o) { setCopied(false); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite link</DialogTitle>
          <DialogDescription>
            Copy this link now. It works once, expires in 48 hours, and won&apos;t be shown again. Send it to the new
            admin yourself.
          </DialogDescription>
        </DialogHeader>
        <Input readOnly aria-label="Invite link" value={link ?? ""} onFocus={(e) => e.currentTarget.select()} />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link ?? "");
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button onClick={() => { setCopied(false); onClose(); }}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditRolesDialog({
  row,
  onClose,
  onSave,
}: {
  row: AdminUserRow | null;
  onClose: () => void;
  onSave: (row: AdminUserRow, roles: string[]) => Promise<void>;
}) {
  // Re-mount per row so the checklist starts from that admin's current roles.
  return row ? <EditRolesForm key={row.id} row={row} onClose={onClose} onSave={onSave} /> : null;
}

function EditRolesForm({
  row,
  onClose,
  onSave,
}: {
  row: AdminUserRow;
  onClose: () => void;
  onSave: (row: AdminUserRow, roles: string[]) => Promise<void>;
}) {
  const [roles, setRoles] = React.useState(row.roles);
  return (
    <ConfirmActionDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Roles for ${row.full_name}`}
      sideEffects="Changes take effect for them once their session refreshes (access tokens last 15 minutes)."
      confirmLabel="Save roles"
      extraValid={roles.length > 0}
      onConfirm={() => onSave(row, roles)}
    >
      <RoleChecklist value={roles} onChange={setRoles} />
    </ConfirmActionDialog>
  );
}
