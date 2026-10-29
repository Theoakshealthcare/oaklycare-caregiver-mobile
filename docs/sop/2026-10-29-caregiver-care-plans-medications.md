# SOP: Caregiver care plans, slice M3 (medications)

| | |
|---|---|
| **Date** | 2026-10-29 |
| **Branch / PR** | `feat/caregiver-care-plans-meds`, cut from `oakly/main` `d8ecda8` (M1 #10 and M2 #11 merged). Not pushed; the lead session pushes and opens the PR. |
| **Depends on** | Backend B3 (backend#31, merged). Contract: backend `docs/fe-integration-guide-caregiver.md` sections 16.21 to 16.25 (captures 240 to 244) and `docs/sop/2026-10-28-care-plans-medications.md`. Design: backend `docs/plans/2026-10-27-caregiver-care-plans-design.md` sections 5.6, 8, 9, 14 (decision D4). Figma exports `8.23.17`, `8.23.28`. |
| **Device status** | **Not verified on a device or simulator.** Jest only, against mocked services shaped after the backend's captured responses. |

## What shipped
**Care Plan Details** has a new **Medication schedules** section (between the goals and the daily tasks). It always shows the "not clinical advice" notice, then the medicines that are active, then the stopped ones greyed under a **Stopped** heading. A nurse (server flag `can_edit_plan`) sees **Add Medication**: a form, then the shared success page ("Medication added successfully", "View Medications" goes back). Medications are **a record only** (D4): no reminders, no "given" ticks, no "due" or "overdue", nothing computed from the times.

## Why
Backend B3 is merged, so a plan carries a `medications` list and nurses can add to it. M3 is the last care-plans mobile slice (design section 14). Medicines are what a visiting caregiver most needs to know about a client, but the product must not look as if it manages them, hence the notice and the lack of behaviour.

## How
| Decision | Choice |
|---|---|
| Where it lives | A section of Care Plan Details, not a new screen: medications arrive on the plan (`GET /caregiver/care-plans/{id}`), so there is **no query of their own**. The write puts the answer into the cached plan (`applyMedicationResult`: a new active medicine goes after the last active one and before the stopped history, as the server lists them) and takes `plan_version`, so the next goal or plan edit is not stale. |
| The notice | Always visible: the section is a plain bordered block, **not an `Accordion`**, so it cannot be collapsed away. Shown to everyone who can see the plan, including read-only caregivers and completed plans, and when the list is empty. |
| Where the notice text comes from | **The backend does not serve the text in any response body.** It exists only in the OpenAPI descriptions of the three medication routes and of the plan's `medications` field (backend `MEDICATION_NOTICE`). The app therefore holds it in one string, `MEDICATION_NOTICE` in `carePlanModel.ts`, and `carePlanMedicationsModel.test.ts` fails if that string is not contained in all four of those descriptions in the committed `packages/api-client/openapi.json`. After a clinician changes the wording, `pnpm api:sync` plus that failing test tell the next person to update the one string. Not paraphrased. |
| Who may add | Only the server flag `capabilities.can_edit_plan` shows the button (it is false on a completed or archived plan). A `403 not_a_nurse` anyway shows "Only nurses can change a care plan." |
| Add Medication form | Name (required, 120), strength, dose, dose unit, route (60 each), reason (200), prescribed by (120), how often (chips for the seven server values, default once daily), times (24-hour `HH:MM`, comma separated, at most 12, once each), start date (blank = today, the backend's Lagos date), end date (blank = ongoing), notes (1000). All dose fields are free text, as the server stores them. Checked against the server's limits before sending; the typed text stays on every failure. |
| Request body | Only filled fields are sent, trimmed; times sorted. **No `expected_version`** (adding overwrites nothing; the backend makes it optional), so the form cannot hit `version_conflict`; if a `409` arrives anyway its `plan` is kept (`keepConflictPlan`), and `plan_not_editable` reloads the plan so the button goes away. |
| Refusals | Plain `404` -> the screen's not-available notice and the plan is dropped from memory (same as goals and tasks). `422 invalid_care_plan` "end_date cannot be before start_date" -> shown on the end date; the same code for the 40-active limit -> the server's words above the button. A `422` validation list -> the message on the field it names. Offline -> error and Try again; **nothing is queued**. |
| No optimistic write | The list changes only when the `201` arrives. Nothing is persisted, logged or cached beyond the plan query (`gcTime` 2 minutes, cleared on sign-out). |
| Design changes | The design's "Reminder Notes" field is labelled **Notes** (there are no reminders). The design's Goal and Outcome fields are dropped (backend decision: a goal belongs in Care Goals). The design's "Reason is pre-filled with the drug name" is a design slip and is not copied. "Duration" is not offered: the end date is typed. |
| Left out on purpose | Editing and stopping a medication (not drawn in the design; backend `PATCH` and `.../stop` exist; guide trap 3 says to warn that stopped is permanent when it is added), a native date and time picker, family view (medications are not family-visible). |
| Test harness fix | `test-utils/carePlanHarness.tsx` now destroys **every** query and mutation a client ever held, including those a screen removed from the cache on lost access. Before, removed entries could re-arm their 2-minute gc timer after the cleanup and keep a single-worker Jest run alive; this already affected `carePlanDetailsTasks.test.tsx` on `oakly/main` (the file did not exit alone with `--runInBand`). |

## What's involved
| Area | Paths |
|---|---|
| API client | `packages/api-client/openapi.json` and `src/schema.d.ts` regenerated from backend `main` (`650afbc`, B3 and B4): adds the three caregiver medication routes, `medications` on the plan, and the admin care-plan routes (B4; the app does not call them). |
| Data layer | `apps/caregiver/src/services/carePlans.service.ts` (`addMedication`, types), `src/hooks/useCarePlanMedications.ts` (new, `useAddMedication`) |
| Rules | `src/careplan/carePlanModel.ts` (`MEDICATION_NOTICE`, labels, limits, draft, `validateMedication`, `buildMedicationBody`, `medicationGroups`, dose, schedule and date lines, `applyMedicationResult`) |
| Components | `src/components/careplan/MedicationsSection.tsx`, `MedicationModal.tsx` (new) |
| Screens | `CarePlanDetails.tsx` (section and modal), `CarePlanSuccess.tsx` (`medication_added`); `src/navigation/Navigations.tsx` (kind) |
| Tests | `__tests__/carePlanMedicationsModel.test.ts` (12), `carePlanMedications.test.tsx` (25); fixtures `medication`, `minimalMedication`, `stoppedMedication` in `test-utils/carePlanFixtures.ts` (the placeholders from captures 240 to 242; `plan()` now has `medications: []`) |

No migration. No new env.

## Verification
Local CI parity in the worktree: frozen install; `pnpm api:generate` and `git diff --exit-code packages/api-client/src/schema.d.ts`; `pnpm typecheck`; `pnpm lint`; `pnpm test` (caregiver run with `--runInBand`: **40 suites, 587 tests**, up from 38 / 550 on M2; api-client 9; admin 290) and the process **exits on its own** (no `--forceExit`), but only about 5 minutes after the tests end: 14 older test files (account, home, wallet, visit, vitals, hub, clock-out and others) leave react-query's default 5-minute gc timers armed, on `oakly/main` too. The care plan medication files and `carePlanDetailsTasks` exit at once; `OAKLY_API_ORIGIN=http://127.0.0.1:8000 pnpm --filter admin build`. Tests cover: the notice shown with no medicines, to a read-only caregiver and on a completed plan; each field of a medicine as recorded and a minimal one; stopped ones under their heading with when they were stopped; nothing reminder-like on screen; the add body (minimal and full, trimmed, times sorted, no version); the cached plan taking the medicine and the version; every refusal above; the form kept after a failure; closing leaves nothing behind; the success page; and the spec pin.
**Sonnet review (one pass), 8 findings, all applied with tests except where noted:** adding sends no version, so a cached plan that another nurse had moved on would have taken `plan_version` and hidden that change (the cache now trusts the answer only when it is exactly one past, else reloads the plan); Close and back were live while the save was open, losing its answer and inviting a duplicate (ignored while pending; `TaskModal` has the same gap, not touched); inputs had no accessible name (each has `accessibilityLabel`); a refused field kept its message while typing (cleared); stopped rows used reduced opacity (colour token only); the 40-medicine refusal wording and the `version_conflict` test are assumed shapes (the guide has no live capture for the limit) and are labelled as such.
**Not verified:** a device or simulator (the form with the keyboard, the length of a 40-medicine list); a running backend (shapes come from the captured bodies); the wording itself (awaiting clinical sign-off).

## Operate / roll back
App-only change; revert the PR. Needs backend B3 deployed (the `medications` key on the plan and the add route).

## Follow-ups
- **Go-live gate:** a clinician signs off the notice wording; then change `MEDICATION_NOTICE` (and the backend constant) together and re-sync.
- Edit and stop a medication (nurses), with "a stopped medicine can't be edited or restarted" before confirming.
- Native date and time pickers (the form takes `YYYY-MM-DD` and `HH:MM` as text, like M1 and M2).
- Device pass: the form with the keyboard, the section on a small screen with many medicines.
- If the backend ever serves the notice in a response, read it from there and drop the pin test.
