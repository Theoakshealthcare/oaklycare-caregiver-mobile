# SOP: Caregiver app, device-pass-2 decisions (DP2-01, DP2-04, DP2-05) and the Jest exit (P1-20)

| | |
|---|---|
| **What shipped** | Five app-side items from the device-pass-2 ledger, built on the lead's recommendations because the owner had not answered: (1) **DP2-01** the caregiver is told before and after completing a short visit that the pay is held for Finance review; (2) **DP2-04** "Resubmit for review" stays disabled until something was changed, and the rejected screen has "Contact support"; (3) **DP2-05** the bank add/change flow maps the backend's `bank_account_name_mismatch` 422 to an inline message with a support link; (4) **P1-20** the caregiver Jest suite now exits on its own (5 min 59 s wall before, 37 s after); (5) **owner addition** FAQs and About us on the Profile screen open in the in-app browser, not Safari. |
| **Branch / commits** | `fix/caregiver-dp2-decisions`, cut from `oakly/main` `58535ec`. Seven commits (Jest exit, DP2-01, DP2-04, DP2-05, DP2-01 correction, docs, in-app browser). **Not pushed, no PR.** |
| **Device-verified** | **No.** Jest only (no simulator by instruction). The things that cross the native boundary here are `Linking.openURL` for WhatsApp/mail and `Alert.alert`; both are mocked in the tests. Show them on a device before release. |
| **Backend dependency** | DP2-05 needs the backend branch that answers 422 `detail = {code: "bank_account_name_mismatch", message}`. It is not merged and not in `packages/api-client/openapi.json` yet; the app handles the shape without touching generated files. Until it ships, the new branch is simply never taken. |

## Why

| Item | Problem |
|---|---|
| DP2-01 | A caregiver who finished before half of the booked time saw the same "Complete this visit?" and "Thank you" as everyone else, then found 40,000 on hold in the Wallet. The backend holds the earning for Finance review when the time on site is under `short_visit_min_percent` (default 50). |
| DP2-04 | (a) "Resubmit for review" sent a changes-requested profile straight back to review without anything having been changed. (b) The rejected screen had only "Sign out": no way to reach Oakly. |
| DP2-05 | The backend will refuse a bank account whose resolved name is not the caregiver's profile name. Without a mapping the app would show the raw 422 text or a generic error. |
| P1-20 | "Jest did not exit one second after the test run", 5 min 43 s wall time with all tests green: any CI step that waits for the exit waits for that. |

## How

**P1-20 (root cause).** Measured first: `jest --detectOpenHandles` reported nothing, the tests took 62 s, the process lived to 5:59. A global teardown listing active handles showed only `Timeout`s. A temporary patch of `setTimeout` recording a stack for every timer of 1 s or more still alive at the end of each file showed they were all React Query **gc timers** (`Query.scheduleGc`, `Mutation.scheduleGc`): 300 000 ms by default (5 minutes, exactly the hang), 120 000 ms for the care-plan hooks. 18 test files build their own `QueryClient` (and `App.test` uses the app's), and a query nobody watches arms that timer on unmount, after the test is over. `src/api/queryClient.ts` and the production behaviour are untouched.
Fix: `apps/caregiver/jest.queryTimers.ts` (new `setupFilesAfterEnv`) hands React Query a timeout provider that remembers each timer it arms and clears the pending ones after each test and once more after the last. One place covers every present and future test file. First attempt (cancel in `afterEach` only) was not enough: Testing Library unmounts in its own `afterEach`, which runs after ours and arms the timers, hence the extra `afterAll` sweep after a tick. Rejected: `--forceExit` (hides leaks), `gcTime: 0` per client (18 files to edit, misses the singleton), mocking the timers globally (changes what tests can wait on).

**DP2-01.** The 50% rule lives in `src/visit/visitFlow.ts`: `isShortVisit(startMs, endMs, durationHours, minPercent)` is the backend's `is_short_visit` (strictly under; unknown start or duration is never short). `SHORT_VISIT_MIN_PERCENT = 50` is a named constant with a TODO: **no response exposes the policy percentage** (it is copied onto the booking's `earnings_terms`, which no caregiver response carries).
**Deviation from the brief:** the brief assumed the app has the visit's actual start. It does not: the caregiver's `BookingResponse` has `scheduled_date` and `duration_hours` but **no `actual_start_time`/`actual_end_time`** (those exist only in the admin `BookingDetail` and in the `start`/`complete` **action** responses, `CaregiverActionBooking`). Typecheck caught it after the first version read them from the booking. So:
- `bookingService.act` now also returns `actualStartTime` and `actualEndTime` from the action answer.
- Before the tap: `visitStarts` (in memory, filled when the `start` answer arrives) gives the real start; the dialog compares it with `now()` (injected, default `Date.now`). Message exactly: "You have been on site for less than half of the booked time. If you complete now, your pay for this visit is held for Finance review." With a care-plan clock-out prompt open it is appended to that prompt's text. A visit resumed after an app restart has no remembered start and gets today's plain dialog (the hold still happens).
- After the tap: the `complete` answer carries both instants the backend judged; the same `isShortVisit` decides the result screen, so it cannot disagree with the hold. Short: "Visit completed" + "Your ₦40,000.00 is under review by Finance, and we will tell you when it is decided." (amount from the booking's `caregiver_earning` through `formatNaira`, so it has the two decimals the rest of the app shows; "Your earning" when the booking has none). Normal: "Thank you." as before.
- Rejected: using `scheduled_date` as the start (wrong when the caregiver starts early or late, the backend measures actual time).

**DP2-04.** (a) The status text only names requested items as free sentences, so the app cannot tell which one an edit answers. Rule: `src/onboarding/reviewEdits.ts` keeps an in-memory "edited since the request" flag, set when `updateProfileStep1`, `updateProfileStep2` or `uploadDocument` **succeeds** (set in `caregiver.service.ts`, so any screen counts), cleared after a successful resubmit and on sign-out (`src/auth/index.ts` `onSignedOut`). While it is false the button is disabled and the line "Update the item we asked for, then resubmit." shows. (b) `rejected` gets "Contact support" (outline) above "Sign out"; it opens `supportUrl()` from `src/config/contact.ts`.

**DP2-05.** `src/api/errors.ts`: `detailCodeOf(body)` reads `detail.code` (the backend convention for structured errors), `isBankNameMismatch(error)` is 422 + `bank_account_name_mismatch`, and `messageForStatus` in the `bank` context returns the app's own sentence "The account name must match the name on your Oakly profile. If your name is different, contact support." (the code is the contract, the backend's wording may change). `BankDetails.tsx` shows it in the existing failure slot at both steps (lookup and save) with a "Contact support" button that opens `supportUrl()`; it clears when the caregiver changes the bank or number.

**In-app browser (owner addition).** `src/services/inAppBrowser.ts` (`openPage(url)` = `WebBrowser.openBrowserAsync(url, { dismissButtonStyle: "close" })`, the patient app's style from `7c3cc97`) replaces `Linking.openURL(ABOUT_URL/FAQ_URL)` in `src/screens/account/Profile.tsx`. A failed open shows the app's usual alert ("Couldn't open FAQs", "Check your internet connection and try again."; the caregiver app has no toast component, `Alert.alert` is its error surface) and does **not** fall back to Safari (the patient app does fall back; the owner asked for not-Safari). tel:, mailto:, WhatsApp and Maps stay on `Linking`. Tests: new `__tests__/profileLinks.test.tsx` (3, `expo-web-browser` mocked: both rows open with `{dismissButtonStyle: "close"}`, `Linking` never called, failure alert); `account.test.tsx` now expects the in-app opener. Not shown on a device (the browser sheet is native).

## What's involved

| Area | Files |
|---|---|
| Jest exit | `apps/caregiver/jest.queryTimers.ts` (new), `apps/caregiver/package.json` (`jest.setupFilesAfterEnv`) |
| DP2-01 | `src/visit/visitFlow.ts` (`isShortVisit`, `SHORT_VISIT_MIN_PERCENT`, `SHORT_VISIT_CONFIRM_MESSAGE`, `shortVisitDoneMessage`, `visitStarts`), `src/screens/visit/VisitFlow.tsx`, `VisitSteps.tsx` (`VisitDoneStep`), `src/services/booking.service.ts` (`act` returns the two times) |
| DP2-04 | `src/onboarding/reviewEdits.ts` (new), `src/screens/setup/VerificationStatus.tsx`, `src/services/caregiver.service.ts`, `src/auth/index.ts`, `src/config/contact.ts` (`supportUrl`) |
| DP2-05 | `src/api/errors.ts`, `src/screens/account/BankDetails.tsx` |
| In-app browser | `src/services/inAppBrowser.ts` (new), `src/screens/account/Profile.tsx`, tests `__tests__/profileLinks.test.tsx` (new, 3), `account.test.tsx` |
| Tests | new `__tests__/shortVisit.test.tsx` (13), `__tests__/onboardingGate.test.tsx` (8); extended `bankDetails.test.tsx` (+4); `arrivedEarning.test.tsx` and `visit.test.tsx` only for the widened `act` mock shape |

## Verification

All commands run in `wt-caregiver-left` on the final head:

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | ok |
| `pnpm api:generate` + `git diff --exit-code packages/api-client/src/schema.d.ts` | no drift |
| `pnpm typecheck` (all workspaces) | green (it caught the missing `actual_start_time`) |
| `pnpm lint` (all workspaces) | green |
| caregiver `jest --runInBand` | 71 suites, 971 tests pass (after the in-app browser change), **36.2 s wall, exits by itself** (baseline on `oakly/main`: 68 suites, 943 tests, 5 min 59 s with "did not exit") |
| caregiver `jest` (default workers) | 968 pass, 12.9 s, no "failed to exit gracefully" |
| `jest --detectOpenHandles` | 968 pass, 59.5 s, nothing reported |

Time is injected everywhere (`now` prop, ISO instants); no test asserts formatted clock text. The 422 test builds the error through the real `unwrap`. The patient app and `apps/admin` were not run or touched.

## Operate / roll back

Pure app change, no config or migration. Revert the commits (independent except that DP2-04 and DP2-05 share `supportUrl`, added in the DP2-04 commit). The Jest change alone is `jest.queryTimers.ts` plus the one `package.json` key.

## Follow-ups

- **Owner to-do: the support number.** `WHATSAPP_NUMBER` in `src/config/contact.ts` is still `""`. Both "Contact support" buttons are rendered anyway and fall back to **mailing `info@theoakshealthcare.com`** until a number is set; then they open WhatsApp with no code change.
- **Backend:** expose `actual_start_time` (and `short_visit_min_percent`) on the caregiver booking response so the short-visit warning survives an app restart and the TODO constant can go; refuse the resubmit server-side when nothing changed (the app gate is advisory and in-memory: an app restart in between asks for one more edit); DP2-05 backend branch to merge, then regenerate the client and drop nothing here (the app never typed the code).
- A re-opened completed visit shows "Thank you" (the short verdict comes from the `complete` answer of that session); Job Details and the Wallet still say "Under review".
- "Contact support" is not on the `suspended` gate, whose text already says to contact support.
- No test for the short warning appended to the care-plan clock-out prompt (the plain path and the shared message are covered).
- Show it on a simulator: WhatsApp/mail hand-off, the short dialog on a real started visit, the disabled Resubmit after a restart.
