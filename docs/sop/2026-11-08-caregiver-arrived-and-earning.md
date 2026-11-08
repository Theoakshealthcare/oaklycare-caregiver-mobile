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
