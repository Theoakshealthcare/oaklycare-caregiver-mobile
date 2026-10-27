# SOP: Caregiver Vitals tab (and a Fall placeholder)

| | |
|---|---|
| **Date** | 2026-10-27 |
| **Branch / PR** | `feat/caregiver-vitals` off `oakly/main` 4b28b7b; PR number set by the lead when it opens it. |
| **Depends on** | Backend `main` f4b2f80, `app/api/v1/endpoints/vitals.py` (no backend change). Design: Figma exports `8.20.40`, `8.21.23`, `8.21.38`, `8.21.51`, `8.22.05`; gap analysis section 5 (`backend/docs/plans/2026-10-06-caregiver-design-gap-analysis.md`). |

## What shipped
- The **Vitals** tab: the six-vital grid (heart rate, blood pressure, temperature, respiration, glucose, sleep) for the patient on the caregiver's in-progress visit, a per-vital screen with a Day / Week / Month chart and its history, **manual entry** for each vital, and report **download then share** through the native share sheet.
- The **Fall** tab shows "FallGuard is coming soon".
- **No tab is ever blank:** `BottomNavigation` had four tabs and two pages (Vitals and Fall were commented out). Each tab now carries its own page in one array, so a tab without a page can no longer be written.

## Why
Gap analysis section 5: with patients on WhatsApp there is no wearable, so readings the caregiver takes by hand are the main source of vitals, and the tab was blank. FallGuard is out of scope: its data starts on the patient side (the patient questionnaire, later a WhatsApp Flow) and there is no incident log to read, so it gets an honest placeholder.

## How
| Decision | Choice |
|---|---|
| Which patient | `useBookingsTab("upcoming")` (accepted, en_route, in_progress). The patients of `in_progress` bookings are offered (a switcher if two). Visits only accepted or en route show **"Available during an active visit"**; no visits shows "No active visit". |
| Access | The backend allows a caregiver only during an `in_progress` visit (or an explicit patient grant, which the app cannot see). A 403 `{"detail": "Access denied"}` on any call renders the same "Available during an active visit" state, never a workaround. Matched exactly (`isVitalsAccessDenied`). |
| Status chips | **None.** The vitals response has no status and thresholds need clinical sign-off, so readings are shown neutrally and the grid says "Oakly does not rate them". Input checks (a positive number, systolic above diastolic, sleep at most 24 h) are hygiene, not clinical ranges. |
| `vital_type` vocabulary | The backend stores free text. The app uses `heart_rate`, `blood_pressure`, `temperature`, `respiratory_rate`, `blood_glucose`, `sleep_duration` (the model's comment names the first three). Other types are ignored. |
| Value format | Strings: `"84"`, blood pressure `"138/85"` with unit `mmHg`, temperature `°C` or `°F` (the design's "98.6 °C" is a Fahrenheit number; both units are offered), glucose `mg/dL` or `mmol/L`, sleep `hrs`. |
| Glucose RBS / FBS / PP | The API has no field for it, so the code is stored in the reading's `notes` and read back for display. Follow-up: a real field. |
| Data window | One call per patient, `start` = 30 days back (UTC without a zone, as the backend stores it). The grid (latest of each), every chart and the history read that one call. Day / Week / Month filter it on the device. |
| Chart | Plain Views, one bar per reading, scaled between the lowest and highest shown. Rejected: adding a charting library (a new native dependency for one chart). Blood pressure plots systolic. |
| Report | "Download report" fetches `GET /vitals/{patient_id}/download` into memory and shows "Vital report downloaded". "Share report" writes a temporary CSV (the share sheet needs a file), opens the sheet, and **deletes the file** when it closes (also on error). The file name has no patient name or id. |
| Health-data hygiene | No logging of readings, no persistent cache: responses live only in the in-memory query cache (`gcTime` 2 minutes, cleared on sign-out by the existing `onSignedOut`). |
| Fetching | The pager keeps every page mounted and remounts on each tab press, so Vitals takes `active` and fetches readings only while its tab is showing. |
| Insights | **Not shown.** `GET /vitals/{id}/insights` returns Gemini-written summary and recommendations; clinical advice plus a third-party processor need sign-off first. |
| Add to Care Note | Not built (care notes belong to a booking; the design button is left out). |

## What's involved
All under `apps/caregiver`; no `packages/api-client` change (the vitals, booking and `/auth/me` schemas are identical in backend main f4b2f80; `pnpm api:sync` against it only adds the admin refunds routes, left to the refunds console PR).

| Area | Files |
|---|---|
| Screens | `src/screens/vitals/Vitals.tsx`, `VitalDetail.tsx`, `AddVitals.tsx`; `src/screens/fall/Fall.tsx` |
| Components | `src/components/vitals/ReadingChart.tsx`, `VitalEntryModal.tsx`, `VitalsStates.tsx` |
| Logic | `src/vitals/vitalsModel.ts` (kinds, parsing, ranges, chart bars, entry validation, patient choice, 403 matcher), `src/vitals/report.ts` (share and delete) |
| Data | `src/services/vitals.service.ts`, `src/hooks/queries.ts` (`useVitals`, `useCreateVital`), `src/api/keys.ts` |
| Navigation | `src/navigation/BottomNavigation.tsx` (tab and page together), `Navigations.tsx` (`VitalDetail`, `AddVitals`), `StackNavigator.tsx` |

`POST /vitals/` needs `recorded_by_user_id` in the body: the app sends the caregiver's id from `GET /auth/me`.

## Verification
Local CI, as `.github/workflows/ci.yml` runs it (frozen install, api types drift, typecheck, lint, test, admin build): see the report. New tests (62): `__tests__/vitalsModel.test.ts` (parsing, ranges, bars, validation, patient choice, 403 matcher), `__tests__/vitals.test.tsx` (loading, no visit, visit not started, 403, grid with no status text, patient switch, retry, navigation, fetch only when active, download and share, refused download, failed share, chart and Day / Week / Month, empty chart, every entry modal, validation, glucose context and unit, 403 and network errors), `__tests__/vitalsReport.test.ts` (temp file is shared then deleted, also on failure), `__tests__/bottomNavigation.test.tsx` (four tabs, four pages, Fall not blank). The typography test still enforces the six type tokens.

**Not verified:** against a live backend (no stack was started on this RAM-constrained Mac, and no vitals capture exists in the caregiver guide yet), on a simulator or device (layout, share sheet, keyboard over the entry modal), and the `start` filter's behaviour server-side. Fixtures follow the schema (`PatientVitalResponse`: string value, UTC timestamp without `Z`), not a capture.

## Operate / roll back
Pure app change; revert the PR. No config, migration or dependency.

## Follow-ups
- Critical / Normal chips and the grid colours: clinical sign-off on thresholds, and a `status` in the API response.
- Insights ("History & Insights"): after clinical and privacy sign-off.
- Backend: `POST /vitals/` trusts `recorded_by_user_id` from the body (a caregiver could name someone else); set it from the caller. Pin `vital_type` to an enum and add a glucose `context` field. `GET /vitals/{id}` has no limit or paging (the app sends `start`).
- The explicit-access grant is invisible to the app, so a caregiver without an in-progress visit never sees a patient even if granted. A caregiver-facing list of granted patients is needed to use it.
- "Add to Care Note", a client search, and the FallGuard report once an incident source exists.
- Capture a vitals flow in `scripts/capture_caregiver_flow.py` and add a guide section; verify on a device.
