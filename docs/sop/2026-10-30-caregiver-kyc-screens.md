# SOP: Caregiver KYC, slice K7a (identity screens and states, mocked service)

| | |
|---|---|
| **Date** | 2026-10-30 |
| **Branch / PR** | `feat/kyc-mobile-screens`, cut from `oakly/main` `a997182` (care plans M3 merged). Not pushed; the lead session pushes and opens the PR. |
| **Depends on** | Backend K2 (merged): `GET/POST /caregiver/identity-verification...`, already in `packages/api-client` (not regenerated or edited here). Contract: backend `docs/fe-integration-guide-caregiver.md` section 4 and captures `200`-`225`; backend SOP `2026-10-28-kyc-caregiver-api.md`. Design: backend `docs/plans/2026-10-27-caregiver-kyc-design.md` sections 6, 7.2, 10.2, 11.3, 12.1, 14. |
| **Device status** | **Not verified on a device or simulator.** Jest only, against a mocked service and bodies copied from the backend captures. **No real widget, no real provider, no camera.** The consent copy is **awaiting counsel review**. |

## What shipped
A new onboarding step, **IdentityVerification**, between Step 2 and Consent, with every screen and state of design 11.3 that does not need the widget itself, behind a service interface with a real implementation (K2 endpoints) and an in-memory mock. **Off by default** (see Operate).

| Design 11.3 state | Where | What the caregiver sees |
|---|---|---|
| 1 Intro and consent | `intro` | "Verify your identity", the design 10.2 text, its own tick box (not pre-ticked), "Start" off until ticked |
| 2 Camera permission denied | `permissionDenied` | Why the camera is needed, "Open Settings" (`Linking.openSettings`), "Try again" |
| 3 Widget open | `widget` | "Verification is open" placeholder while the launcher is open (the real UI is K7b's) |
| 4 Checking | `checking` | "Checking your details...", polling; after 2 min "This is taking longer. You can leave this screen; we'll notify you."; after 5 min polling stops and "Check again" appears |
| 5 Verified | `verified` | "Identity verified", Continue |
| 6 Try again | `tryAgain` | A tip from `failure_hint` (never a reason), "Attempt 2 of 3", the consent again (one consent per attempt) |
| 7 Under review | `underReview` | "A person on our team will check this, usually within 24 hours. You can continue." No reason, ever |
| 8 Provider unavailable | `unavailable` | "Verification is temporarily unavailable. Your progress is saved." and **Continue without for now** (`defer`) |
| 9 Expired | `expired` | "That session timed out", "Start again" (does not use an attempt) |
| 10 Rejected (admin `failed`) | `rejected` | "We couldn't confirm your identity", Contact support (mailto) |
| 11 Closed or error in the widget | `closed`, `widgetError` | "You closed verification before finishing" / "Something went wrong", Try again; neither uses an attempt |
| 12 Offline | `offline` | "You're offline", Try again |
| (extra) | `resume`, `exhausted`, `error`, `loadError`, `updateRequired` | Resume the running attempt without asking the consent again; attempts used up ("Our team will review your case", Continue); an attempt that errored on our side; a failed load; an app older than the server's consent text |

The **status screen** shows an identity line and a "Verify your identity" button when identity is still `pending`/`in_progress` and the application is under review or has changes requested (a caregiver who used "Continue without for now"), and a plain line when the case is with a person or was turned down.

## Why
Backend K2 is merged and K3/K4 are on their way, so the mobile side needs its screens and a place to plug the widget in (K7b, provider not final). Building the states first against a mock lets design, copy and the gate be reviewed without a native dependency, and fixes the contract the widget will plug into.

## How
| Decision | Choice |
|---|---|
| Pure resolver | `resolveIdentityScreen(state, phase)` in `src/identity/identityModel.ts` is the whole decision table (unit tested): the **server's** decision (`verified`, `needs_review`, `failed`) always beats a local widget moment. The widget's "completed" is a hint: it shows "Checking" and nothing else (guide rule 1). |
| View vs container | `IdentityVerificationView` is presentational (screen, state, callbacks; no request, no provider type; `onStart` is "start verification"). `IdentityVerification` holds the queries, mutations, navigation and the widget call. |
| Widget seam | `IdentityWidgetLauncher.open(config) -> outcome` (`completed` / `closed` / `error` / `permissionDenied`) in `src/identity/widget.ts`. K7b puts the real widget behind it with `setWidgetLauncher`. In `api` mode before K7b the launcher reports `error`, so a real attempt can never finish. |
| Service | `IdentityVerificationService` (`getState`, `startSession`, `sendClientEvent`, `defer`) in `src/services/identity.service.ts`; `identityService` delegates to the active implementation, so tests `jest.spyOn` it. Real implementation uses the generated client; `POST .../sessions` `200` (resume) is **untyped in the generated schema** (`content?: never`), so its body is narrowed at the boundary (`parseSession`), like `parseVerificationStatus`. |
| Mock | `createMockIdentityService({ scenario })`: `pass`, `try_again`, `exhausted`, `needs_review`, `expired`, `error`, `provider_down`, `rejected`. It plays the **server's** part (a hint never verifies; the answer arrives after N state reads, **no timers**). |
| Polling | `useIdentityPolling(enabled, refetch)`: one chain of `setTimeout`s, the next scheduled only after the read finished; 3 s, 5 s after 30 s, 10 s after 60 s; "slow" at 2 min; stops at 5 min; cleaned on unmount or when no longer awaiting. Rejected: `refetchInterval` (the awaiting flag depends on the data it polls, and it would never stop). |
| Consent | Text of design 10.2, versioned in the app (`CONSENT_TEXT_VERSION = "kyc-2026-10"`). The app sends **its** version; Start is offered only if the server's `policy_version` equals it, else "Update the app" (the append-only consent record must not hold words the person did not read). One tick per **new** attempt, consumed on a successful start; resuming the running attempt does not ask again. The provider's name sits in one constant. The "Privacy Policy" link has no destination yet. |
| Errors | Identity errors have `detail` as `{code, message}`. The server's `message` is shown as written (even on the `503`); `ATTEMPTS_EXHAUSTED`, `ALREADY_VERIFIED`, `UNDER_REVIEW`, `IDENTITY_REJECTED` need no banner because the re-read state explains them. A refused start re-reads the state. |
| Routing | `setupRouteFor(step, kycEnabled)`: step 2 -> `IdentityVerification` when on, else `ConsentScreen` as before; 3+ -> `ConsentScreen` (the **server** sets step 3 on a result or on `defer`). Step 2 "Save" navigates the same way. "Continue" goes to `ConsentScreen` in the setup stack and back to `VerificationStatus` in the status stack (no consent step there). The identity screen is also registered in the status stack. |
| Typography | Only `Text` variants (the six theme tokens); no raw `fontSize` (the repo's guard test still passes). |

## What's involved
| Area | Paths (all under `apps/caregiver`) |
|---|---|
| Model and config | `src/identity/identityModel.ts`, `src/identity/config.ts`, `src/identity/widget.ts`, `src/identity/mockIdentityService.ts` |
| Data layer | `src/services/identity.service.ts`, `src/hooks/useIdentityVerification.ts`, `src/api/keys.ts` (`identity`) |
| Screens | `src/screens/setup/IdentityVerification.tsx`, `IdentityVerificationView.tsx`, `src/components/identity/ConsentBlock.tsx`; `VerificationStatus.tsx` (`identityEntry`) |
| Routing | `src/navigation/gate.ts`, `Navigations.tsx`, `StackNavigator.tsx`, `src/screens/setup/CaregiverSetupStep2.tsx` |
| Tests | `__tests__/identityModel.test.ts`, `identityService.test.ts`, `identityPolling.test.tsx`, `identityScreen.test.tsx`, `identityMockFlow.test.tsx`, `identityStatusEntry.test.tsx`, additions to `gate.test.ts`; fixtures `test-utils/identityFixtures.ts` (bodies copied from backend captures `200`, `204`, `205`, `207`, `210`, `211`, `213`, `218`; states without a capture are labelled "assumed") |

No migration, no `packages/api-client` change, **no new dependency** (no WebView, no provider package).

## Verification
Local CI parity in the worktree: frozen install; `pnpm typecheck` clean; ESLint clean on all new and changed files (one **pre-existing** error in `src/screens/account/BankDetails.tsx:186`, an unescaped `'`, is on `oakly/main` and untouched here, so repo-wide `pnpm lint` exits non-zero until it is fixed); `jest --runInBand` for the caregiver app: **46 suites, 690 tests** (up from 40 / 587), exit code 0, and the process **exits on its own** (no `--forceExit`; about 5 minutes after the last test, because older test files leave react-query's 5-minute gc timers, as recorded in the M3 SOP; the new suites alone finish in seconds). Every new screen test clears the react-query client through `renderWithClient` and the polling hook is tested with fake timers, including that nothing is left running after unmount or when the wait ends.
Tests cover: the whole resolver table; server beats widget; the consent text, the tick, and Start gating; the exact request bodies and paths (against a faked `fetch`); the `200` resume with no typed body; the object-shaped errors and their codes; hints sent and a failed hint not blocking; every state above, including permission denied, closed, error, offline, unavailable then `defer`, exhausted, under review with no reason, rejected, update required; polling cadence, slow, stop, restart and cleanup; the mock service per scenario; the mock end to end through the screen; the gate table with the switch on and off; the status-screen entry.
**Not verified:** a device or simulator (layout, keyboard, safe areas, small screens, large text); any real widget, camera permission prompt, or provider; the real endpoints running (shapes follow the backend captures; the K3/K4-produced states are seeded in those captures, not real); the consent wording (counsel); push on result (backend K4).

## Operate / roll back
- **Switch:** `EXPO_PUBLIC_KYC_MODE` = `off` (default; Step 2 goes to Consent exactly as before) | `mock` (in-memory service and simulated widget; pick the outcome with `EXPO_PUBLIC_KYC_MOCK_SCENARIO`, default `pass`) | `api` (real endpoints; the widget is not integrated until K7b, so an attempt cannot finish). **Do not set `api` in a release build before K7b ships**, and never `mock` (it verifies instantly).
- Merging this to `main` changes nothing for users while the variable is unset.
- Roll back: revert the PR. No data, no config.

## Follow-ups
| Item | Owner / slice |
|---|---|
| **K7b:** the real widget behind `IdentityWidgetLauncher` (WebView, camera permission, `permissionDenied` mapping, dev-build recipe), forwarding `opened`/`completed`/`closed`/`error` (the container already calls them), the "Close" control of design state 3 | K7b |
| Counsel review of the consent text, the lawful basis for biometric data and whether a DPIA applies; then set the final text and `KYC_POLICY_VERSION` together | owner / counsel |
| **Question for lead/counsel:** resuming the *same* attempt (closed/errored widget, relaunch) sends `consent: true` without a new tick, because the backend requires the literal on every call and the consent for that attempt was already recorded. If counsel wants a tick on every open, show the box on `resume`/`closed`/`widgetError` too (one line in `asksConsent`) | counsel |
| "Privacy Policy" has no destination (the existing consent screen's links are also inert) | owner |
| Backend: add `responses={200: IdentityVerificationSessionOut}` to `POST .../sessions` so the next `api:sync` types the resume; then `parseSession` can shrink | backend / kyc-k6 sync |
| The 5-minute "stopped" state and the 2-minute "slow" text are measured from when the checking screen mounted, not from when the attempt began; a relaunch restarts them | accepted |
| After `defer` a caregiver at step 3 cannot reach the identity step except through the status screen; that entry exists but only for `under_review`/`changes_requested` | accepted |
| Device pass; copy review of all the states; Figma frames for the states the design lacked | owner |
| Repo-wide `pnpm lint` fails on a pre-existing error in `BankDetails.tsx:186` | lead |
