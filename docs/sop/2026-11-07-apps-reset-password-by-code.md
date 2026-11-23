> **Update 2026-11-23 (caregiver only, `2026-11-23-caregiver-onboarding-parity.md`):** the caregiver app now collects the code on its own screen (RecoverCode), Reset Password has only the two password fields, and success is a green toast instead of an alert. The API calls and the failure sentences are unchanged.

# SOP: Reset password by the emailed 5-digit code (patient and caregiver apps)

| | |
|---|---|
| **What shipped** | Both apps now reset a forgotten password with the 5-digit code the backend emails (backend #42): `POST /auth/password-recovery {email}`, then `POST /auth/reset-password {email, code, new_password}`. The patient app's adapter that sent the code as the old long `token` is gone, and the caregiver app's "paste the long token" field is replaced by a 5-digit code field. |
| **Branch / commits** | `feature/apps-reset-by-code`, cut from `oakly/main` (0964956). Not pushed, no PR yet. |
| **Device-verified?** | **No.** Jest only (RNTL against a mocked `fetch` / `api.POST`). The bodies and `detail.code` strings come from the backend's captured guide (`backend/docs/fe-integration-guide-password-reset.md`, captures `docs/fe-captures/password-reset/`), whose own mail transport was faked, so **no real email, inbox, keyboard "code from email" suggestion or phone screen has been exercised**. Walk it in the patient device pass and the second caregiver pass. |

## Why
Backend #42 replaced the 200-character emailed token with a 5-digit code (hashed, 15 minutes, once, 5 tries per code, 3 emails per address per hour, 20 wrong tries per 24 hours). The patient app's reset step already drew five boxes but still posted the code as `token`, so a real reset always ended in 400 "Invalid token". The caregiver app asked the person to paste a ~200-character token from an email.

## How
| Area | Decision |
|---|---|
| Spec | `OAKLY_BACKEND_DIR=<backend @ f3b0a7c> pnpm api:sync`. `PasswordReset` is `{ new_password, email?, code?, token? }`; the apps send only `{ email, code, new_password }`. |
| One call site per app | `authService.resetPassword` (patient `{ email, code, newPassword }`, caregiver `(email, code, newPassword)`). The email is the exact trimmed string the code was requested with: the server counts tries and looks accounts up per exact address, so it is passed through the route params and never lowercased. |
| Reading refusals | A pure `resetFailure(error)` (patient `src/domain/passwordReset.ts`, caregiver `src/account/resetPasswordModel.ts`) branches on `detail.code`, never the message. The body is `{ detail: { code, message } }`, an object. See the table below. |
| Resend | "Resend code" calls the recovery route again with the same email. Closed for 60 s (a code was just sent by the previous screen; the server sends at most 3 an hour and **silently sends nothing** after that, so the screen cannot know). After a resend the screen says "If that email has an account, we've sent a new code. Use the newest email and check your spam folder." (asking again kills the previous code). Hidden after the 24-hour lock. |
| Never reveal the account | Recovery answers 200 for anything, and the apps' wording after it is the same: "If that email has an account...". An unknown email gets the same `invalid_or_expired_code` at the reset step. |
| Success | Patient: "Your password has been reset. Log in with your new password." plus "You've been signed out on your other devices." and a Go to Login button; caregiver: the same in an alert, then Login. No tokens come back from the reset, so nothing is stored. |
| Code field | Patient: the existing `OtpInput` (5 boxes, one-time-code autofill). Caregiver: a single number-pad `Input` (max 5, `oneTimeCode`, digits only through `codeDigits`); the caregiver app has no shared OTP component, and a copy was not worth the time. |
| Legacy token | Nothing of the long-token form remains in either app. The backend still accepts it for the already-installed caregiver build; **`PASSWORD_RESET_LEGACY_TOKEN_ENABLED` was not touched** (backend env, flipped later once that build is retired). |
| Alternatives rejected | Auto-submitting when the fifth digit is typed (the person also has to type a new password, so there is nothing to submit yet). Telling the user how many tries are left (the server does not say). |

### What the person sees
| Server answer | Where | Sentence | Code box | Resend |
|---|---|---|---|---|
| 400 `invalid_or_expired_code` (wrong, expired, used, replaced, malformed, **or no such account**) | under the code | "That code isn't right or has expired. Request a new one." | cleared | stays |
| 400 `weak_password` (code NOT used up) | under the new password | the server's own message | kept | stays |
| 429 `too_many_attempts`, no `Retry-After` (5 wrong codes: the code is dead, even the right one) | under the code | "Too many tries. Request a new code." | cleared | stays |
| 429 `too_many_attempts` with `Retry-After` (20 wrong in 24 h) | under the code | "Too many tries. Try again in N seconds / minutes." | cleared, disabled | hidden, Reset button disabled |
| offline / 5xx / 422 | dialog or alert | the shared `messageForError` sentence | kept | stays |

## What's involved
| Path | What |
|---|---|
| `packages/api-client/openapi.json`, `src/schema.d.ts` | regenerated from backend `f3b0a7c` (also carries the #43 and #44 routes) |
| `apps/patient/src/services/auth.service.ts` | `resetPassword({ email, code, newPassword })`; docs on `requestPasswordReset` |
| `apps/patient/src/domain/passwordReset.ts` (new) | `resetFailure`, sentences, `RESEND_SECONDS` |
| `apps/patient/src/screens/auth/{RecoverPassword,ResetPassword}.tsx` | button now "Send Reset Code"; reset screen with Resend, notices, lock handling |
| `apps/caregiver/src/account/resetPasswordModel.ts` (new), `src/hooks/useCooldown.ts` (new, copy of the patient hook), `src/api/errors.ts` (`waitText`) | model, cooldown, wait wording |
| `apps/caregiver/src/screens/auth/{RecoverPassword,ResetPassword}.tsx`, `src/services/auth.service.ts`, `src/navigation/Navigations.tsx` | code flow; `ResetPassword` route params now `{ email: string }` (required) |
| `apps/patient/__tests__/authFlows.test.tsx` | the three old reset tests replaced by 7 (body, each refusal, lock, server failure, resend with fake timers) |
| `apps/caregiver/__tests__/resetPassword.test.tsx` (new) | 12 tests: model, recover screen, every refusal, resend |

## Verification
- `pnpm install --frozen-lockfile`, api types drift check (`pnpm api:generate` then `git diff --exit-code`), `pnpm typecheck`, `pnpm lint`, `pnpm test` (single worker, as CI) and `pnpm --filter admin build`: see the report for the final run.
- Tests assert only strings and request bodies, never formatted clock text. The new caregiver test uses `gcTime: Infinity` clients and unmounts first so the Jest process exits (it does; no `--forceExit`).
- **Not verified:** a real email, a phone screen, keyboard autofill of the code, the 15-minute expiry and the 24-hour lock (the backend itself proved the expiry and the lock only in tests, and its 24-hour `Retry-After` shape was not captured live, so that branch rests on the guide's description).

## Operate / roll back
Revert the branch. Deploy order does not matter for the apps: the backend accepts both forms today. Once the old caregiver build is retired, set `PASSWORD_RESET_LEGACY_TOKEN_ENABLED=false` on the backend (not done here).

## Follow-ups
- Device walk with a real inbox (patient device pass 1; caregiver second pass).
- The 3-emails-an-hour limit is invisible to the apps; if support hears "no code arrives", that is the first thing to check.
- A shared OTP component for the caregiver app (its verify-email screen has its own keypad).
