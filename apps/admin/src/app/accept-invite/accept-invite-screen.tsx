"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_AUTH_PATHS } from "@/lib/admin-auth-contract";
import { errorMessage } from "@/lib/api";

/** Set a password from an invite link. MFA enrollment is forced on the first login that follows. */
export function AcceptInviteScreen() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(ADMIN_AUTH_PATHS.inviteAccept, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invite_token: token, password }),
      });
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        setError(
          res.status === 404 || res.status === 410
            ? "This invite link has expired or was already used. Ask a Super Admin for a new one."
            : errorMessage(body, "We couldn't set your password. Try again."),
        );
        return;
      }
      setDone(true);
    } catch {
      setError("We couldn't reach Oakly. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="mb-4 text-lg font-semibold">Set your password</h1>
        {!token ? (
          <p role="alert" className="text-sm text-destructive">
            This invite link is missing its token. Ask a Super Admin to send it again.
          </p>
        ) : done ? (
          <div className="grid gap-4 text-sm">
            <p>Password saved. Sign in next; you&apos;ll set up two-step verification on your first login.</p>
            <Button asChild>
              <Link href="/login">Go to sign in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4" noValidate>
            <div className="grid gap-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={busy || !password || !confirm}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Save password
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
