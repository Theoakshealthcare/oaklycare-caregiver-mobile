"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import QRCode from "qrcode";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_DETAIL } from "@/lib/admin-auth-contract";
import { AuthError } from "@/lib/session";

type Step =
  | { kind: "credentials" }
  | { kind: "mfa"; mfaToken: string }
  | { kind: "enroll"; mfaToken: string; otpauthUri: string; secret: string };

/** A wait imposed by the server: 429 = throttled (wrong passwords, or the per-IP limit), 423 = locked after wrong codes. */
interface Wait {
  kind: "throttled" | "locked";
  /** `Date.now()` value when the wait ends. */
  until: number;
}

/** "45 seconds", "15 minutes", "24 hours": rounded up so the admin never retries too early. */
export function formatWait(seconds: number): string {
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (seconds < 60) return plural(Math.max(1, Math.ceil(seconds)), "second");
  if (seconds < 3600) return plural(Math.ceil(seconds / 60), "minute");
  return plural(Math.ceil(seconds / 3600), "hour");
}

/**
 * The same text for every email: the backend answers identically for unknown, invited, disabled and
 * active accounts, and the console must not hint at which it is (guide 3.4).
 */
export function waitMessage(kind: Wait["kind"], seconds: number): string {
  const when = formatWait(seconds);
  return kind === "locked"
    ? `This account is locked after too many wrong codes. Try again in ${when}, or ask a Super Admin to reset your MFA.`
    : `Too many attempts. Try again in ${when}.`;
}

const DEFAULT_WAIT_SECONDS = 30;

export function LoginFlow({ onSignedIn }: { onSignedIn: () => void }) {
  const { signIn, completeMfa, notice } = useAuth();
  const [step, setStep] = React.useState<Step>({ kind: "credentials" });
  const [error, setError] = React.useState<string | null>(null);
  const [wait, setWait] = React.useState<Wait | null>(null);
  const [now, setNow] = React.useState(() => Date.now());
  const [busy, setBusy] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");

  // Tick once a second while a wait is active; clear it when it ends.
  React.useEffect(() => {
    if (!wait) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= wait.until) setWait(null);
    }, 250);
    return () => window.clearInterval(id);
  }, [wait]);

  const waiting = wait !== null && now < wait.until;
  const waitSeconds = wait ? Math.max(0, Math.ceil((wait.until - now) / 1000)) : 0;
  const shownError = waiting && wait ? waitMessage(wait.kind, waitSeconds) : error;

  /** Returns true when the error was a server-imposed wait and has been handled. */
  function startWait(err: unknown): boolean {
    if (!(err instanceof AuthError) || (err.status !== 429 && err.status !== 423)) return false;
    const t = Date.now();
    setNow(t);
    setWait({ kind: err.status === 423 ? "locked" : "throttled", until: t + (err.retryAfter ?? DEFAULT_WAIT_SECONDS) * 1000 });
    setError(null);
    return true;
  }

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (waiting) return;
    setError(null);
    setBusy(true);
    try {
      const res = await signIn(email.trim(), password);
      setPassword("");
      setCode("");
      setWait(null);
      if (res.kind === "enroll") {
        setStep({ kind: "enroll", mfaToken: res.mfaToken, otpauthUri: res.otpauthUri, secret: res.secret });
      } else {
        setStep({ kind: "mfa", mfaToken: res.mfaToken });
      }
    } catch (err) {
      if (!startWait(err)) {
        setError(
          err instanceof AuthError && err.status === 401
            ? "That email and password don't match. Check them and try again."
            : err instanceof Error
              ? err.message
              : "Sign-in failed. Try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (step.kind === "credentials" || waiting) return;
    setError(null);
    setBusy(true);
    try {
      await completeMfa(step.mfaToken, code.trim());
      onSignedIn();
    } catch (err) {
      if (err instanceof AuthError && err.status === 401 && err.message === AUTH_DETAIL.mfaTokenInvalid) {
        // The token is spent, expired or the account changed: another code can't help. Back to the password.
        setStep({ kind: "credentials" });
        setPassword("");
        setError("Your sign-in timed out or was already used. Enter your password again to get a new code prompt.");
      } else if (startWait(err)) {
        // handled
      } else if (err instanceof AuthError && err.status === 401) {
        setError(
          "That code didn't work. If you just signed in, wait for the next code to appear in your authenticator app and try again.",
        );
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
          {shownError ? <FormError message={shownError} /> : null}
          <Button type="submit" disabled={busy || waiting || !email || !password}>
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
          {shownError ? <FormError message={shownError} /> : null}
          <Button type="submit" disabled={busy || waiting || code.length !== 6}>
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
