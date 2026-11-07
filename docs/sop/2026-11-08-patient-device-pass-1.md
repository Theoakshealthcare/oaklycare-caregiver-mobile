# SOP: Patient app, first full device pass and three small fixes

| | |
|---|---|
| **What shipped** | The first full iOS Simulator walk of the patient app (sign-up to log-out, 22 flows) and three small fixes found on the way: **P1-01** the booking screens follow a booking (detail keeps reading during the visit, lists read again when a screen comes to the front), **P1-02** the keyboard's Go key logs in, **P1-03** the code boxes take the keyboard back after a wrong code. |
| **Branch / commits** | `fix/patient-device-pass-1`, cut from `oakly/main` `22490ef`: `7936a62`, `2500546`, `6f3b5d2` (+ this SOP and checklist line). Not pushed. |
| **Source / evidence** | `ledgers/LEDGER-device-patient-pass-1.md` (20 findings: 1 High, 5 Medium, 8 Low, 6 Info; 3 fixed, 17 open), 98 screenshots in `ledgers/device-patient-pass-1/`, scratch tools in `ledgers/device-patient-pass-1/tools/`. |
| **Device-verified** | The walk, yes (Debug build, light local stack, fake Paystack). P1-02 and P1-03 on the simulator (shots 95, 96); P1-01 shown on the simulator for the list (shot 97), the detail part by Jest (it was seen failing on a device before, shots 46-48). |
| **Tests** | Patient Jest 203 pass (17 suites, in band, exits at once), caregiver Jest 848, admin vitest 332, api-client node tests 17, typecheck of every package, `pnpm lint`, `api:generate` diff clean, admin build. The new tests fail on the unfixed source (6 failures) and pass with the fix. |

## Why

Everything in the patient app had been proven in pieces (booking and cancel on a simulator, the rest by Jest and captures). Nobody had walked all of it on a screen, and the owner wants a test build fast. The walk found no blocker for a first test build, one real bug that would have misled every tester (a booking screen left open never followed the booking), and two keyboard problems that only show on a device.

## What changed

| Area | Change | Files |
|---|---|---|
| Booking currency (P1-01) | `isActive` includes `in_progress`, so the detail reads every 20 s through the whole visit and follows it to "Completed". `useBookings` (Bookings tab, Home, vitals candidates) reads again when its screen comes to the front if the data is stale, and every 20 s while one is in front and any booking is still moving (`listRefresh.intervalMs`). | `apps/patient/src/domain/booking.ts`, `src/hooks/useBookings.ts` |
| Login Go key (P1-02) | The password field has `returnKeyType="go"` and `onSubmitEditing={submit}`: same validation as the button. | `apps/patient/src/screens/auth/Login.tsx` |
| Code boxes (P1-03) | `OtpInput` remembers whether its hidden input had the focus and takes it back when `editable` turns on again (iOS drops the focus when the input is switched off while the code is checked). A blur while editable means the person left. | `apps/patient/src/components/ui/otp-input.tsx` |
| Tests | `domain.test.ts` (isActive list), `bookingFlows.test.tsx` (detail follows in-progress to completed; list reads on tab return; list polls while moving and goes quiet), `authFlows.test.tsx` (Go key, empty password), new `otpInput.test.tsx` (refocus after a check, no refocus when the person left). | `apps/patient/__tests__/` |

## Decisions and rejected alternatives

- **Lists poll only while a booking is moving and the screen is in front,** the same rule the detail already had. A permanent poll would keep the radio awake for nothing; a pull-to-refresh alone would leave a patient staring at a stale screen.
- **Refresh on focus only when stale** (the global `staleTime` is 15 s), so flipping between tabs does not hammer the API.
- **OTP focus is restored by the component, not each screen:** the same boxes serve the verify and the reset screens.
- **Not fixed here (ledger):** fast-typing keystroke loss (P1-04: needs a real phone and a Release build before choosing uncontrolled inputs), anything that needs an owner call (cancelled booking still offering Chat, "PAID" chip after cancel, log-out confirm, full name on the sharing screen, FAQ/About in-app).

## Verification

Walk: `ledgers/LEDGER-device-patient-pass-1.md` (coverage table with screenshot numbers). Local CI as in `.github/workflows/ci.yml`: frozen install, `pnpm api:generate` plus `git diff --exit-code -- packages/api-client/src/schema.d.ts`, `pnpm typecheck`, `pnpm lint`, Jest in band for patient and caregiver (the caregiver process stays alive about 5 minutes after the last test, a known timer on `main`, P1-20), api-client and admin tests, `pnpm --filter admin build`. Stack for the walk: Postgres 16 and Redis 7 containers, `alembic upgrade head` from the backend checkout, uvicorn on 8001, ARQ worker, a fake Paystack, `ios-debug.sh --app patient`, `tools/pp1_driver.py` for the seed and the caregiver side.

## Operate / roll back

Pure app changes; revert the three code commits. No migration, no config. To repeat the walk: the recipe in the ledger's Setup section, including the two corrections (the reset code is not logged, so overwrite its hash with `tools/setcode.py`; dispatch needs the worker or `tools/redispatch.py`).

## Follow-ups

- Slices S1-S5 in the ledger: test-backend readiness (SMTP, worker, pricing row, FallGuard seed, Gemini key), a real-phone pass (keystrokes, push, Android, Release build, live Paystack), booking/detail polish, copy and consent decisions, the Jest timer.
- `sample-notice.tsx` is dead code (P1-18).
- Move the Firebase Admin SDK file out of the main checkout's `apps/patient/` folder (P1-19).
