"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import QRCode from "qrcode";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthError } from "@/lib/session";

type Step =
  | { kind: "credentials" }
  | { kind: "mfa"; mfaToken: string }
  | { kind: "enroll"; mfaToken: string; otpauthUri: string; secret: string };

export function lockoutMessage(retryAfter?: number): string {
  if (!retryAfter) return "Too many failed attempts. Try again later.";
  const minutes = Math.ceil(retryAfter / 60);
  return `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

export function LoginFlow({ onSignedIn }: { onSignedIn: () => void }) {
  const { signIn, completeMfa, notice } = useAuth();
  const [step, setStep] = React.useState<Step>({ kind: "credentials" });
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await signIn(email.trim(), password);
      setPassword("");
      setCode("");
      if ("mfa_enrollment_required" in res) {
        setStep({ kind: "enroll", mfaToken: res.mfa_token, otpauthUri: res.otpauth_uri, secret: res.secret });
      } else {
        setStep({ kind: "mfa", mfaToken: res.mfa_token });
      }
    } catch (err) {
      if (err instanceof AuthError && err.status === 423) setError(lockoutMessage(err.retryAfter));
      else setError(err instanceof Error ? err.message : "Sign-in failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (step.kind === "credentials") return;
    setError(null);
    setBusy(true);
    try {
      await completeMfa(step.mfaToken, code.trim());
      onSignedIn();
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setError("That code didn't work. Check your authenticator app and try again, or start over if it has been a few minutes.");
      } else if (err instanceof AuthError && err.status === 423) {
        setError(lockoutMessage(err.retryAfter));
      } else {
        setError(err instanceof Error ? err.message : "Verification failed. Try again.");
      }
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setStep({ kind: "credentials" });
    setError(null);
    setCode("");
  }

  return (
    <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-2">
        <ShieldCheck className="size-6 text-primary" aria-hidden />
        <h1 className="text-lg font-semibold">Oakly admin</h1>
      </div>

      {notice && step.kind === "credentials" ? (
        <p role="status" className="mb-4 rounded-md border border-warning/40 p-3 text-sm">
          {notice}
        </p>
      ) : null}

      {step.kind === "credentials" ? (
        <form onSubmit={submitCredentials} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error ? <FormError message={error} /> : null}
          <Button type="submit" disabled={busy || !email || !password}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Continue
          </Button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="grid gap-4" noValidate>
          {step.kind === "enroll" ? (
            <EnrollmentPanel otpauthUri={step.otpauthUri} secret={step.secret} />
          ) : (
            <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="code">{step.kind === "enroll" ? "Code from the app" : "Authentication code"}</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]*"
              autoFocus
              required
              className="tracking-widest"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          {error ? <FormError message={error} /> : null}
          <Button type="submit" disabled={busy || code.length !== 6}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {step.kind === "enroll" ? "Verify and finish setup" : "Verify"}
          </Button>
          <Button variant="ghost" onClick={startOver}>
            Start over
          </Button>
        </form>
      )}
    </div>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

function EnrollmentPanel({ otpauthUri, secret }: { otpauthUri: string; secret: string }) {
  const [qr, setQr] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(otpauthUri, { margin: 1, width: 192 })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [otpauthUri]);

  return (
    <div className="grid gap-3">
      <p className="text-sm">
        Set up two-step verification. Scan this code with an authenticator app (1Password, Google Authenticator,
        Authy), then enter the 6-digit code it shows.
      </p>
      <div className="flex justify-center rounded-md bg-white p-2">
        {qr ? (
          <Image unoptimized src={qr} width={192} height={192} alt="QR code for your authenticator app" />
        ) : (
          <div className="size-48" aria-hidden />
        )}
      </div>
      <div className="grid gap-1">
        <span className="text-xs text-muted-foreground">Can&apos;t scan? Enter this key manually</span>
        <code data-testid="mfa-secret" className="select-all break-all rounded bg-muted px-2 py-1 text-sm">
          {secret}
        </code>
      </div>
    </div>
  );
}
