# SOP: Caregiver app, device-pass-1 minors and visit-rule follow-ups

| | |
|---|---|
| **What shipped** | The cheap, high-visibility device-pass-1 findings of the caregiver app plus the app follow-ups of the merged backend visit rules (backend `feature/visit-rules`): **DP1-06** (offer with a `response` hides Accept/Decline), **DP1-09, 11, 12, 13, 14, 15, 17, 18, 19, 20, 24, 25, 26, 27, 28, 29, 30, 31 (part), 32**, and a held earning labelled "Under review". |
| **Branch / commits** | `fix/caregiver-device-pass-minors`, cut from `oakly/main` `6fc70e0`, one commit per area (10 commits, `git log oakly/main..HEAD`). Not pushed. |
| **Source** | `ledgers/LEDGER-device-pass-1.md`, `LEDGER-device-recheck-1.md` (RC1-02, RC1-03), `backend/docs/sop/2026-11-07-visit-rules.md` follow-ups. |
| **Device-verified** | Yes, on the iPhone 17 Pro simulator (Debug build, light local stack); per finding in `ledgers/LEDGER-device-caregiver-minors.md`, screenshots in `ledgers/device-caregiver-minors/`. |
| **Tests** | Caregiver Jest 827 pass (59 suites, single worker), patient 73, api-client 12, typecheck of all three apps, `pnpm lint` green, `api:generate` diff clean. |

## What changed and why

| Area | Change | Key files |
|---|---|---|
| **Navigation / welcome** (DP1-18, 11, 12) | Fall tab and its screen removed (FallGuard is patient-side). Three caregiver welcome slides. The session now remembers that this device has signed in (`returning`, kept in the keychain across sign-out); a signed-out returning device starts on Login, a new install on the carousel. | `src/navigation/BottomNavigation.tsx`, `src/screens/onboarding-screen.tsx`, `src/auth/session.ts`, `src/auth/secureStorage.ts`, `src/navigation/gate.ts` (`firstSignedOutRoute`) |
| **Location** (DP1-13, 14) | One sentence, `LOCATION_SHARING_SENTENCE`, used by both permission sheets and the Home card; it matches `decideTracking`. Home shows "Allow location" instead of "out of date" when location was never shared; the foreground ping refetches Home when the held Home still shows a stale location (`shouldRefetchHomeAfterPing`), so the warning clears without a pull. | `src/supply/permissions.ts`, `src/screens/home/Home.tsx`, `src/home/homeModel.ts`, `src/navigation/AppRuntime.tsx` |
| **Jobs and offers** (DP1-15, 20, 06, 31) | Job Details: service name ("Nurse visit"), "Care needed", readable status (`src/utils/labels.ts`), the misleading service-fee row removed, bottom padding. Notification rows are built by `notificationView` from the embedded `booking` (service, visit time, area, distance; no ETA; Open / Accepted / No longer available). An offer whose `response` is not null opens as "No longer available" with no Accept/Decline. | `src/screens/booking/BookingDetails.tsx`, `src/account/notificationModel.ts`, `src/screens/account/Notifications.tsx`, `src/services/booking.service.ts` (`Offer.response`) |
| **Wallet** | Held earning label "Under review" (list row also says Oakly is reviewing the visit). | `src/wallet/walletModel.ts`, `src/screens/account/Wallet.tsx` |
| **Visit** (DP1-19, 32) | "Stops location sharing" and "Location sharing has stopped" only when location permission is granted. "Visit in progress" links to the Care plan (when one exists) and to Record vitals. Tries-left shows once (the error already carries it). | `src/screens/visit/VisitFlow.tsx`, `VisitSteps.tsx` |
| **Dates** (DP1-28, 25) | One formatter set in `src/utils/dates.ts` (`formatDate`, `formatClock`, `formatStamp`, `formatDayHeading`, `toDateOnly`): phone zone, 24-hour, day-month-year. DOB, chat, notes, vitals, care-plan stamps use it. New `DateField` (bottom sheet + Done on iOS, system dialog on Android, `onValueChange`, no deprecated `onChange`) for DOB (onboarding, Edit profile, starts decades back) and the care-plan start date. New plan defaults are real values: today, 30 days, review every 14. | `src/utils/dates.ts`, `src/components/ui/date-field.tsx`, `src/careplan/carePlanModel.ts` |
| **Care plan / vitals navigation** (DP1-26, 30) | "View care plan" after creating resets the stack without the picker, form and success page (`routesAfterPlanCreated`). Client profile "View all" pushes a new `PatientVitals` route (Vitals with a patient and a Back arrow) instead of switching tabs. | `src/navigation/carePlanStack.ts`, `src/screens/vitals/PatientVitals.tsx`, `Vitals.tsx` |
| **Onboarding** (DP1-09, 29) | Sign-up and consent copy name the real buttons; `StepIndicator` counts 4 steps (3 when the identity step is off) on steps 1 to 4. `Select` gained a multi-select mode (stays open, check marks, "Done (n selected)") used for service areas. | `src/components/ui/step-indicator.tsx`, `select.tsx`, `src/screens/setup/*` |
| **Misc** (DP1-17, 24, 27) | AI note taker: microphone asked only on mic tap (refusal explained), recording banner with timer, honest subtitle, empty notes state. Contact us hides the dead WhatsApp row and uses a mail icon. Delete account copy mentions active bookings and wallet money. | `src/screens/chat/AINoteTaker.tsx`, `src/screens/account/Contact.tsx`, `Profile.tsx` |
| **API client** | `OAKLY_BACKEND_DIR=<backend oakly/main worktree> pnpm api:sync` (notification `response`, patient cancel terms). Separate commit. | `packages/api-client/openapi.json`, `src/schema.d.ts` |

## Decisions and rejected alternatives

- **Earning on Job Details:** the API has no caregiver earning, and the policy percentage is admin-only, so the row is removed rather than computing 80% in the app (a guess that would drift from the policy). Backend ask in the ledger.
- **Held label wording:** "Under review" (the owner's word) replaces "Under review by Oakly"; the sub-line says why.
- **Logout memory** is persisted (keychain, survives sign-out) rather than in memory, so a cold start after logout is Login too. Rejected: an in-memory flag (cold start would show the carousel again).
- **Visit copy follows the OS permission**, not "has tracking started": the only state the app can read without a native call.
- **Notification distance** is parsed from the server's message ("0.22km away") because the payload has no field; if the text changes the row simply shows no distance.

## Operate / roll back

Pure app change; revert the commits. A returning device that has the old build never has the keychain flag, so it sees the carousel once, then Login after its next sign-out.

## Follow-ups

- Backend asks (ledger): caregiver earning on the booking, no ETA in offer notifications (plus `distance_km` field), held `status_reason` on the wallet list.
- Welcome slide 3 art shows a "BOOK NOW" phone: needs a design replacement.
- `Select` still has hard-coded colours; the care-plan start-date label weight differs from the other labels; Android not checked.
- Existing test files with unreleased React Query timers (`directions`, `home`, ...) keep Jest from exiting under `-i`; CI's multi-worker run is unaffected. Worth a shared `afterEach(() => client.clear())` helper.
