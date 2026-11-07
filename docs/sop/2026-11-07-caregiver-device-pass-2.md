# SOP: Caregiver app, device pass 2 and two small fixes

| | |
|---|---|
| **What shipped** | The second iOS Simulator walk of the caregiver app (the flows pass 1 and the re-check skipped) plus two small fixes: **DP2-F1** the decline confirmation says a decline is final, **DP2-F2** the vitals entry clears an old validation error when the reading is edited. |
| **Branch / commits** | `fix/caregiver-device-pass-2`, cut from `oakly/main` `0964956`. Not pushed. |
| **Source / evidence** | `ledgers/LEDGER-device-pass-2.md` (9 findings, 2 fixed), screenshots in `ledgers/device-pass-2/`. |
| **Device-verified** | The walk, yes (Debug build, light local stack). DP2-F1 on the simulator (New request tab modal, shot 069). DP2-F2 is JS-only; the stale message was seen before the fix. |
| **Tests** | Caregiver Jest 836 pass (60 suites, single worker), admin vitest 332, api-client node tests, typecheck of all apps, `pnpm lint`, `api:generate` diff clean, admin build. Patient app tests not run (no shared code touched). |

## Why

Pass 1 found 33 problems; about half the flows had never been on a screen. Pass 2 walked: accept and decline an offer, the "No longer available" state, wallet pending/available/on hold, bank add and change with the 24 h pause, payslip, vitals entry, completing a normal and a short visit, the under-review / changes-requested / rejected states, the note taker with the microphone, logout, Home, Job Details and the offers list.

Result: most pass-1 findings in these flows are fixed (listed in the ledger). One **major** finding remains (DP2-01: nothing tells the caregiver, before or after completing, that a visit under half its booked time is held for Finance review). It needs wording from the owner, so it is a finding, not a fix.

## What changed

| Area | Change | Files |
|---|---|---|
| Decline copy (DP2-F1) | `DECLINE_TITLE` / `DECLINE_MESSAGE` in one module, used by the Home alert, the Job Request alert and the New request tab modal: "It will be offered to other caregivers. You won't be able to accept it afterwards." (The server already answers `403 You declined this offer`, DP1-06.) | `apps/caregiver/src/constants/offerCopy.ts`, `src/screens/home/Home.tsx`, `src/screens/booking/BookingDetails.tsx`, `src/screens/booking/CaregiverBookings.tsx` |
| Vitals error (DP2-F2) | `VitalEntryModal` wraps every field setter so an edit clears the previous error. | `apps/caregiver/src/components/vitals/VitalEntryModal.tsx` |
| Tests | One test per fix at the screen level (each opens the real confirmation / the real entry modal); `vitals.test.tsx` also clears its query clients after each test. | `__tests__/home.test.tsx`, `offers.test.tsx`, `offerUnavailable.test.tsx`, `vitals.test.tsx` |

## Decisions and rejected alternatives

- **Copy lives in a constant, not in three strings,** so the wording cannot drift between the three places that ask.
- **DP2-01 not fixed:** the 50% rule is a backend policy value (`booking_policy` follow-up); hard-coding "half the booked time" in the app would drift. Needs the owner's wording and ideally the earning status in the `complete` response.
- **Not fixed (polish, ledger only):** bank form spacing and the picker's top inset (DP2-06), the Login screen's different layout after logout (DP2-07).

## Verification

Walk and per-flow evidence: `ledgers/LEDGER-device-pass-2.md`. Server probe: a direct `accept` of a declined offer answered `403 {"detail":"You declined this offer"}`. Local CI as in `.github/workflows/ci.yml`: frozen install, `pnpm api:generate` (no diff), `pnpm typecheck`, `pnpm lint`, caregiver Jest in-band, `pnpm --filter admin build`.

## Operate / roll back

Pure app changes; revert the two code commits. No migration, no config. Note: after the last test the Jest process stays alive for about 5 minutes before exiting by itself (a component-test timer, present on `main` as well); it is not a failure, but a CI step that waits for exit takes that long.

## Follow-ups

- DP2-01 (major): owner wording for the complete-visit dialog and result screen; backend: earning status in the `complete` response.
- DP2-02: payslip is header-only for a month with only pending/held earnings, and a raw CSV (DP1-22).
- DP2-03: Home wallet card should show the held amount; wallet "paid in / paid out" wording.
- DP2-04: changes-requested resubmit does not check the requested fix; rejected screen has no support route.
- DP2-05, 06, 07, 08: see the ledger.
- Not walked: the "I've arrived" step, reset-by-code screens, cancel/drop-out, Android, push, location, keyboard (simulator hardware keyboard hides the soft keyboard).
