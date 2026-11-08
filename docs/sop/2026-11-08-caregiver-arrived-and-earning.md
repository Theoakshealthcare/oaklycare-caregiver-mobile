# SOP: Caregiver app, "I've arrived" and the caregiver's own earning

| | |
|---|---|
| **What shipped** | The app side of backend PR #48 (migration 0024): Job Details shows **Your earning** (the backend's `caregiver_earning`, with "Under review" for a held short-visit earning), and the visit screen has a real **I've arrived** action (`POST /booking/caregiver/action/{id}` `{"action":"arrived"}`) whose done state is read from `arrived_at`. |
| **Branch / commits** | `feature/caregiver-arrived-earning-ui`, cut from `oakly/main` `47f31ad`. Not pushed. Needs backend #48 deployed before release (older backends do not know the `arrived` action: 422). |
| **Evidence** | `ledgers/LEDGER-device-caregiver-arrived.md`, screenshots in `ledgers/device-caregiver-arrived/`. |
| **Device-verified** | Yes, on the iOS Simulator against the real #48 backend (light local stack). The patient's `caregiver_arrived` row was proved through the patient API, not the patient app. |

## Why

DP1-15 removed the earning row from Job Details because the booking carried the family's service fee, not the caregiver's pay. #48 adds `caregiver_earning` and an `arrived` action that stores `arrived_at` and tells the family. The old "I've arrived: enter visit code" button only flipped a local flag, so the patient was never told and the state vanished on restart.

## How

- **Earning:** `src/wallet/bookingEarning.ts` formats the backend number with the existing `formatNaira`; nothing is computed. Null (offer, pending, cancelled) shows no row. For a **completed** visit the wallet row for that booking (`booking_id`, `type: earning`) supplies the status with the wallet's own words (`Pending`, `Under review`, `Available`, `Cancelled`) and, for `held`, the wallet's line "Oakly is reviewing this visit before it is paid". The wallet month is taken from the booking's `updated_at` (the booking has no completion time); a visit finished at a month boundary may miss its row and then shows the amount only. The offer screen shows no earning (the backend sends null for an offer).
- **Arrived:** no time window and no client-side time rule (the guide: the action has none; allowed from `accepted` or `en_route`). The button is on the first step (`accepted`) and above the code on the `en_route` step. Tapping sends `arrived`; the booking refetches and the screen reads `arrived_at`: non-null shows "The patient knows you've arrived." and hides the button, and survives an app restart. No optimistic flag. `Job Details` also shows an "Arrival" row.
- **Never blocks the visit:** if the call fails (offline, 409) an alert gives the sentence and the first step offers "Enter the visit code anyway".
- **Errors:** by exact `detail` string (the backend sends plain strings, not `detail.code`, for these routes): `409 Only an accepted booking can be marked as arrived` -> "This visit has already moved past this step. We've refreshed it."; `403 This booking is not assigned to you`; suspended `403` stops the flow like `start`; network 0 -> "Can't reach Oakly...".
- **Rejected:** computing "short visit" or an earning estimate in the app (drifts from the policy); an optimistic local arrived flag (lies if the call fails).

## What's involved

| Area | Files |
|---|---|
| API client | `packages/api-client/openapi.json`, `src/schema.d.ts` (synced from backend `5fa6326`) |
| Earning | `apps/caregiver/src/wallet/bookingEarning.ts`, `src/hooks/queries.ts` (`useBookingEarningRow`), `src/screens/booking/BookingDetails.tsx` |
| Arrived | `src/services/booking.service.ts` (`arrived` action, `arrivedAt`), `src/screens/visit/VisitFlow.tsx`, `VisitSteps.tsx`, `src/api/errors.ts` |
| Admin | `apps/admin/src/test/booking-fixtures.ts`: the synced types make `short_visit_min_percent` required on the booking policy, so the test fixture gained it (no admin UI for the threshold yet) |
| Tests | `__tests__/arrivedEarning.test.tsx` (27), `__tests__/visit.test.tsx` (button label, mock shape) |

## Verification

Jest: every state (earning, null, held, pending, lookup failure, offer; arrive tap, reload, en route, 409, failure-then-continue). The new test file sets `gcTime: 0` and unmounts before clearing so a single-worker Jest exits. Simulator: arrive tap (shots 01-02), state after a fresh app launch (03-04), Job Details of the normal booking (09, earning, arrival row) and the completed short visit (07, "Under review"), a second tap (API, same `arrived_at`, one `caregiver_arrived` event), and the 409 alert when the visit was started elsewhere (12). Patient feed: `GET /patient/notifications` shows "Your caregiver has arrived" once after two taps (worker running).

## Operate / roll back

Pure app change, no config. Revert the commit; the generated client changes are additive. Ship after backend #48.

## Follow-ups

- Admin console: no field to edit `short_visit_min_percent` yet (the API accepts it).
- Booking has no completion time: ask the backend for `completed_at` (or the earning status on the booking) so the status line needs no wallet lookup.
- The patient app does not yet render `caregiver_arrived` specially (it is in the feed); not run on a patient simulator.
- DP2-01 (a warning before completing a short visit) is still open: this slice shows the held state only after completion.

## Update 2026-11-08 (later): the arrived errors as `{code, message}`, and the arrival window

**What shipped.** The app reads the backend's new "I've arrived" errors from `detail.code` instead of matching sentences, and explains the new early-tap refusal. Branch `fix/caregiver-arrived-error-codes` (cut from `oakly/main` `e24f43d`; not pushed). Needs the backend branch `fix/arrived-errors-admin-cancel-terms` (the `422 arrived_too_early` rule and the coded errors); the backend SOP is `docs/sop/2026-11-08-arrival-window.md` in the backend repo.

| Decision | Why |
|---|---|
| `src/api/errors.ts` reads `detail.code` for `booking_not_assigned`, `caregiver_not_approved`, `booking_not_arrivable`, `booking_not_found`, `caregiver_profile_not_found` and `arrived_too_early`; the existing plain-string matching stays | An older backend (plain strings) and every other action (still strings) keep working; the code is the contract, the sentence may change |
| The app's own wording is shown, not the backend's `message`, except as the fallback for `arrived_too_early` | Same rule as the bank-name error: the wording is the app's; the message is only a fallback |
| `arrived_too_early`: "It's too early to mark yourself as arrived. You can do it from <local day and time>." built from `earliest_at` (naive UTC, parsed as UTC, shown in the phone's local time via the existing `formatStamp`) | The window is 60 minutes today but a server setting, so the app never hard-codes it |
| The early tap keeps the button, sets `arrivalFailed` so the caregiver can still go on to the visit code, and uses the alert title "Too early to mark arrival" | Arrival never blocks a visit (unchanged) |
| A `caregiver_not_approved` code stops the visit like the plain string did (`isSuspendedStop`) | Same behaviour on the new shape |
| API types were **not** regenerated | `pnpm api:sync` from the backend branch changed only the admin `cancel_terms` schemas (the action errors are not in the OpenAPI document); those belong to the admin console branch |

**Files.** `apps/caregiver/src/api/errors.ts`, `apps/caregiver/src/screens/visit/VisitFlow.tsx`, `apps/caregiver/__tests__/arrivedEarning.test.tsx`.

**Verification.** `arrivedEarning`, `errors`, `visit` and `shortVisit` suites pass (111 tests, run single-worker, the process exits); typecheck and lint pass for all three apps. New tests cover every code, a reworded message still mapping by code, the plain-string fallback, the suspended stop on the code, the early message built from `earliest_at` (asserted by calling the same formatter, no typed clock text, so it holds in Lagos and in UTC), the fallbacks without a usable time, a validation 422 list not being read as early, and the screen alert plus the way on to the code. **Not verified:** nothing was run on a simulator or device against the real backend; the full caregiver Jest suite was not run (CI runs it).

**Follow-ups.** Disable the button, or show "available from <time>", before the window opens (needs `scheduled_date` minus the window: the app does not know the setting, so ask the backend to send it on the booking, or accept the refusal as the signal). Ship this app change before or with the backend deploy.
