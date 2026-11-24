# SOP: Patient app visual pass on the simulator (2026-11-24)

| | |
|---|---|
| **What shipped** | The differences found by walking the patient app on the iOS simulator against `ss/patient` and fixed in one PR (branch `fix/patient-visual-parity`): the Vitals, FallGuard and Profile screens that slice 4 shipped without ever being seen, plus the dim over the status-bar and home-indicator strips for every sheet and dialog, the Chat bottom edge and the Notification title. Row-by-row table with screenshots: `ledgers/SIM-patient-visual.md`, `ledgers/sim-patient-visual/`. |
| **Why** | The owner demands exact parity and tests once on phones. Slice 4 was Jest-only, and Jest hides layout: a double top inset, a chart that drew as a dotted staircase and cut-off initials were invisible to every test. |
| **Verified** | iOS simulator only (iPhone 17 Pro, Debug build, scratch backend, placeholder data), Jest for the touched files plus every test that pins them, `tsc --noEmit`, ESLint. **Not seen on Android or a real phone.** |

## What changed
| Area | Change |
|---|---|
| Status-bar strips (`MainApp.tsx`, `StatusBar/screenChrome.ts`) | The strips over the clock and under the home indicator sit outside the navigator, so a transparent modal route did not dim them. New `useDimBands(color)` (used by `ui/overlay.tsx` and the manual-entry sheet) makes the root dim the two strips; new `useTabTopBand(color)` keeps a tab's teal band while a modal is over it (Bookings, now Vitals too). The Vitals header runs behind the clock. |
| Sheets (`ui/card-modal.tsx`, `ui/overlay.tsx`, `AddVital.tsx`) | Cards 81% wide as drawn; `compact` title for the delete dialog; BP boxes narrow. |
| Chart (`vitals/AreaChart.tsx`) | Smooth line from short tilted bars, one flat tint (opaque mix, no stripes), six labels (a week: one per day), grid, band round the latest reading. No new native module. |
| FallGuard (`FallAssessment.tsx`, `FallResult.tsx`) | Removed the second status-bar inset (~60 pt gap); question text 17 pt medium; rounded-box options; Back with chevron; thin track. |
| Profile (`menu-row.tsx`, `Profile.tsx`, `AccountData.tsx`, `Contact.tsx`, `avatar.tsx`) | Bare icons and taller rows; red trash icon, Logout without chevron or line; compact first row; initials no longer clipped (line height). |
| Icons (`ui/icon.tsx`, `domain/vitals.ts`) | Outline thermometer, drop and moon; `wind` (Material Community "weather-windy") for respiration. |
| Chat, Notifications | Bottom band in the message bar's colour; centred "Notification". |
| Test | `__tests__/vitalChart.test.ts` (chart helpers, dim store). |

## Left on purpose (owner decisions, nothing invented)
Normal / Critical badges and status tint (until thresholds are signed), FallGuard band label / titles / Next Assessment Due (no signed bands), wearable switch, Heart Alerts, caregiver access requests, support chat and WhatsApp rows, search/filter/medication reminder on Home, Home appointment carousel and caregiver photos (no data), Update Password as a row (server rule), the assessment history (no screen exists and none is drawn).

## Operate / roll back
Revert the PR. No backend, API, migration or native-module change (a JS reload is enough; the Debug build was rebuilt only because slice 4 added native modules).

## Follow-ups
- Walk, on a phone and on Android: onboarding slides 2 to 4, sign-up and recovery, booking step 2 / summary, payment frames, the tracking page (not re-seen in this pass).
- A history of FallGuard assessments (endpoint exists, no design).
- Check a small phone (SE class) and Dynamic Type for the dim strips and the delete dialog buttons (the label is one line and was tuned at 402 pt).
