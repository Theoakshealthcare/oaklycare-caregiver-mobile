# SOP: Caregiver Vitals and Home polish

| | |
|---|---|
| **Date** | 2026-10-30 |
| **Branch / PR** | `feature/vitals-home-polish` off `oakly/main` f14a9a3; PR opened by the lead. |
| **Depends on** | Nothing new. App only; no `packages/api-client` change. |

## What shipped
- **Vitals:** a real **blood pressure chart** (a bar per reading from the bottom number to the top number, with a one-line hint); a **"View all History"** screen (`VitalHistory`) reached from each vital's detail screen; sleep checked and left as is.
- **Home:** the **patient address** on each visit row; the **Wallet card** opens the Wallet screen and shows **pending earnings** when there are any.
- Not changed: the "Critical" thresholds (there are none; the app still rates nothing), the call buttons and `src/identity`.

## Why
The design audit in `HANDOFF-master.md` ("Design coverage") listed the BP chart, a sleep entry and "view all history" as missing from Vitals, and Home as short of the design. Checking the code first: **the sleep entry and a sleep detail screen already existed** (`sleep_duration` is one of the six kinds in `vitalsModel.ts`, with `Enter sleep duration manually` on `AddVitals` and a test), and BP already had a detail screen that plotted the systolic number only. So the real gaps were the BP chart and the history screen.

## How
| Decision | Choice |
|---|---|
| BP chart | One floating bar per reading, from diastolic to systolic, on one scale across both numbers (`pressureBars` in `vitalsModel.ts`; `low` on `ChartBar`). Plain Views again, no charting library. A value that isn't `n/n` is skipped. |
| Which charts use it | Any set where every reading is blood pressure. Other vitals are unchanged (`low` is absent). |
| "View all History" | A separate screen, because the detail screen's list is limited to the Day / Week / Month range. It calls `GET /vitals/{patient_id}` **with no `start`**, so it shows everything on record (the endpoint takes `start` and `end` only; it has no paging). Rows are grouped under Today, Yesterday or the date. |
| Query key | `["vitals", patientId, "all"]`, under the existing `vitals` prefix so saving a reading refreshes it; same 2-minute `gcTime`, cleared on sign-out like the rest. |
| Sleep | No change needed. |
| Home address | `VisitView.address` was already mapped from the response but never drawn. |
| Home wallet | `useWallet()` (`GET /caregiver/wallet`) gives `pending_balance`, shown through the existing `walletBalances()`. If that call fails, nothing extra is shown and Home works as before. The headline balance is still `wallet_balance_naira` from `GET /caregiver/home`. |

## What's involved
All under `apps/caregiver`.

| Area | Files |
|---|---|
| Logic | `src/vitals/vitalsModel.ts` (`parsePressure`, `pressureBars`, `groupReadingsByDay`, `formatTime`, `ChartBar.low`) |
| Screens | `src/screens/vitals/VitalHistory.tsx` (new), `VitalDetail.tsx` ("View all History" link), `src/screens/home/Home.tsx` |
| Components | `src/components/vitals/ReadingChart.tsx` (floating bars and hint) |
| Data / nav | `src/hooks/queries.ts` (`useVitalHistory`), `src/api/keys.ts` (`vitalsAll`), `src/navigation/Navigations.tsx` and `StackNavigator.tsx` (`VitalHistory`) |
| Tests | `__tests__/vitalsModel.test.ts`, `vitals.test.tsx`, `home.test.tsx` |

## Verification
Run as `.github/workflows/ci.yml` runs them: `pnpm typecheck` and `pnpm lint` (clean), and jest for the touched area: `vitals*`, `home`, `typography`, `bottomNavigation`, `wallet*`, `navigationFixes`, `App`, `gate`, `clientProfile`, `staticScreens` (all pass). New tests cover pressure parsing and bars (shared scale, bad value skipped, single and flat readings), day grouping, the BP chart and hint, sleep in hours, the link to the history, the history screen (all readings requested with no `start`, glucose context, empty, 403, network error), the Home address, the wallet link and the pending line (shown, absent, wallet failure).

**Not verified:** on a simulator or device (how the floating bars look at phone width), or against a live backend. Fixtures follow the schema, not a capture. The full unit suite and the admin build are left to CI.

## Operate / roll back
Pure app change; revert the PR.

## Follow-ups
- The history screen loads everything the backend has for the patient in one response (the endpoint has no paging); add `limit` / `before` to the API if a long stay makes it heavy.
- Home: the week strip ("Weekly Availability") needs a backend model and a design answer on what it means; a weekly earnings summary has no endpoint (the wallet gives a balance and pending amount only). The "profile completion card" is not needed: caregivers who are not approved never reach Home (the gate shows their status screen).
- Critical / Normal chips and the BP chart colours stay blocked on clinical sign-off.
