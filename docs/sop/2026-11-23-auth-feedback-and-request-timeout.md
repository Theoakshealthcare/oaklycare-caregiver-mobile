# SOP: Resend and the code screen give feedback, and every request has a timeout

| | |
|---|---|
| **What shipped** | (1) The shared API client gives up on a request that has not answered after 20 s (120 s for uploads) and reports it as the usual "Can't reach Oakly" network failure. (2) Caregiver code screen: a **Verify** button with a spinner, a "Sending code..." state on Resend, and the typed code is kept after a network failure. (3) Patient code screen: Resend shows "Sending code..." while it runs (the rest was already there). |
| **Branch / PR** | `fix/auth-feedback-and-timeout`, monorepo PR (see the PR for the number). |
| **Reported by** | The owner, on the first real phone test of the staging APK (2026-11-23): Resend did nothing visible and was tapped repeatedly; after the last digit the screen sat for about 120 s with no spinner and no button; then the splash screen for 60 s. |
| **Not verified** | **On a device.** Jest and type-check only. The timeout also needs a look on a phone with a stalled connection (airplane mode toggled mid-request). |

## Why
- The app had no request timeout: a stalled connection left the screen waiting for as long as the OS kept the socket (the owner saw 60-300 s). The stall had a server cause too (see `2026-11-23-push-token-registration-loop.md` and backend `2026-11-23-staging-api-workers.md`), but a client must never wait minutes without a word.
- The caregiver code screen verified as soon as the fifth digit was typed, with no sign that anything was happening and no button to try again; Resend had no busy state, so the person tapped it repeatedly.

## How
| Decision | Reason |
|---|---|
| `withTimeout` in `packages/api-client` wraps the one fetch every call uses (including the 401 retry and uploads) | One place, both apps, nothing to forget per screen. |
| A timeout throws `TypeError("Network request timed out")` | `isNetworkFailure` already treats that exact message as "never completed", so every screen shows its existing network message and no screen needed changing. |
| The timer stops when the response starts | A slow body read is not cut off; the failure we saw is no answer at all. |
| 20 s for requests, 120 s for uploads; both are options on `createOaklyClient` | Sign-up calls answer in under a second when healthy; photos and voice notes take longer. |
| Caregiver code screen: **Verify** button (spinner while open, disabled until five digits) | The same as the patient screen already had; gives a retry that does not need retyping. |
| A network failure keeps the typed code; a wrong code still clears it | Retrying a timeout should not mean typing five digits again. |
| React Query's retry (2 more tries for status 0) is unchanged | Screens using queries can now wait up to about 60 s in the worst case before "Try again" instead of minutes. Not changed here: lowering it is a product call. |

## What's involved
`packages/api-client/src/index.ts` (`withTimeout`, `timeoutMs`, `uploadTimeoutMs`), `packages/api-client/test/client.test.ts`, `apps/caregiver/src/screens/auth/VerifyEmail.tsx`, `apps/patient/src/screens/auth/VerifyEmail.tsx`, tests `apps/caregiver/__tests__/verifyEmail.test.tsx` (new), `apps/patient/__tests__/authFlows.test.tsx`.

## Verification
- `node --test` for the api-client (22 passed, including: a request nobody answers fails as a network failure within the timeout, a fast request leaves no timer, a caller's own abort is not reported as a timeout).
- Jest for the touched screens and the tests that go through the client (caregiver: verify-email, reset-password, multipart upload, voice-note service, push: 87 passed; patient: auth flows and push: 33 passed). `tsc --noEmit` clean in both apps and the client package; ESLint on the touched files with no errors. CI runs the rest.

## Operate / roll back
Revert the PR and ship a new preview APK. To change the limits, pass `timeoutMs` / `uploadTimeoutMs` to `createOaklyClient` in `apps/*/src/api/client.ts`.

## Follow-ups
- Patient app: still shows "Resend code" only as a text link; fine, no change requested.
- Splash screen: after a timeout, the gate shows "We couldn't load your account" with Try again; check on a device that the wording is clear.
- Consider fewer React Query retries for status 0 on the auth gate.
- Backend: rate-limit `POST /devices/push-token` per user.
