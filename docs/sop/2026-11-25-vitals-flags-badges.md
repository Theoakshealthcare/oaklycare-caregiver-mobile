# SOP: Normal / High / Low / Critical badges on vitals (caregiver app and patient app), slice 1b

| | |
|---|---|
| **What shipped** | The vitals badges are switched on in `apps/caregiver` and `apps/patient`. Each reading shows the rating the server sends in `flag` (Normal green, High amber, Low blue, Critical red); a critical reading also shows "This may be an emergency. Call 112 now." Branch `feature/vitals-flags-badges`, one PR to `main`. Backend: `Theoakshealthcare/backend#84` (SOP `docs/sop/2026-11-25-vitals-flags.md`, FE guide `docs/fe-integration-guide-vitals-flags.md`). |
| **Why** | The clinical lead supplied the thresholds, so the badges that were built and switched off (owner decision, 2026-11-23) are unblocked. The rating is computed on the server only; an app that rated readings itself would drift from the backend and could show a wrong Normal. |
| **Verified** | `tsc --noEmit` and ESLint (both apps), Jest for the touched files only: caregiver `vitalStatusBadge`, `vitals`, `vitalsModel`, `clientProfile`, `home`, `visit`; patient `vitals`, `domain`. **Not seen on a simulator or device** (plain Views and Text, no native module; visual pass pending). |

## Changes

| Where | Change |
|---|---|
| `packages/api-client` | Regenerated from the backend (`flag`, `glucose_context` on `PatientVitalResponse` and `ClientVital`, new `VitalFlagOut`). |
| Caregiver `src/vitals/vitalFlag.ts` (new), `vitalsModel.ts` | `Reading.flag` carries the server's flag unchanged; an unknown status becomes `null`. |
| Caregiver `VitalStatusBadge.tsx`, `config/vitals.ts` (deleted), `constants/theme.ts` | Badge takes a `flag`; four statuses; tile tint per status; the `VITAL_STATUS_BADGES` switch is gone (the server decides: no flag, no badge). Added `warningLight` and `errorLight` colours. |
| Caregiver screens | Vitals tab tiles, a vital's page (current reading), history rows and the Client Profile "Latest Vitals" show the badge; footnotes now say the flags follow Oakly's clinical thresholds and are not a diagnosis. |
| Patient `domain/vitalStatus.ts`, `domain/vitals.ts` | `VitalReading.flag`; the empty `VITAL_THRESHOLDS` and `VITAL_STATUS_ENABLED` switch are gone. |
| Patient `StatusBadge.tsx` and screens | Badge on the Vitals home tiles, the monitoring page and the history list; the 112 line sits under a critical tile. |
| Admin console | Nothing: it shows no vitals. |

## Decisions

- **No flag, no badge.** Sleep, weight and an unreadable value arrive with `flag: null`; nothing is drawn, and a missing badge never means Normal.
- **The apps never compute a rating, not even offline.** A wrong Normal can delay care and a wrong Critical causes panic (the clinician pack's own warning).
- **Emergency text is the server's `message`**, shown as sent.
- **Family view stays out of v1 apps** (owner decision); the data already carries the flag.

## Follow-ups

- A simulator or device pass over both apps (tile corner with the badge and the "+" button, critical tile text wrapping).
- APKs are built from `main` on 2026-12-01 (Expo plan), so this reaches phones then.
- Slice 1c (alerts) uses the backend hook, not this code.
