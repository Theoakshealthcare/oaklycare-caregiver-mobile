# SOP: Caregiver care plans, slice M1 (hub, create, details, goals)

| | |
|---|---|
| **Date** | 2026-10-28 |
| **Branch / PR** | `feat/caregiver-care-plans-hub`, from `oakly/main` `88f8341`. Not pushed; the lead session pushes and opens the PR. |
| **Depends on** | Backend care plans B1 (`feat/care-plans-core`, backend#26) and B2 (backend#29), both merged. Contract: backend `docs/fe-integration-guide-caregiver.md` section 16 (captures 200-222). Design: backend `docs/plans/2026-10-27-caregiver-care-plans-design.md` sections 5, 8, 9, 14. Figma exports `ss/caregiver/` `8.20.26`, `8.22.56`, `8.23.17`, `8.23.57`. |
| **Device status** | **Not verified on a device or simulator** (not approved for this slice). Jest only, against mocked services shaped after the backend's captured responses. |

## What shipped
A nurse can open **Care plans** from Home, browse **Assigned** plans and **Templates**, preview a template, pick a client, fill in the create form, see a success page, and open **Care Plan Details** to read and change the goals, the allergies and special instructions, and the header (edit sheet, complete, archive). The client profile gained a **Care plan** row with Open / Create / "Use a template". Any assigned caregiver can open a plan read-only. **Not in this slice:** daily tasks, ticks, observations, progress (M2) and medications (M3); the Fall tab stays "Coming soon".

## Why
Backend B1 and B2 are merged, so the care plan endpoints exist. M1 is the first mobile slice of the care plan work (design section 14).

## How
| Decision | Choice |
|---|---|
| Who sees authoring | Only the server flags decide: Home `can_author_care_plans` (card and hub "Create New Care Plan"), the visit summary's `can_author` (profile row), the plan's `capabilities.can_edit_plan` (every edit control). The app never reads the nurse skill (it is not in any response). |
| Entry points | Home card (nurse) -> hub. Client profile row -> Open (any caregiver), Create / Use a template (nurse). "Use a template" from a profile opens the hub's Templates tab with `bookingId`, so "Use template" skips the client picker. |
| Create flow | Template preview -> client picker (`GET /care-plans/candidates`) -> form pre-filled from the template (diagnosis stays empty and required) -> `POST /bookings/{id}/care-plan` -> success page -> details. The form always sends its goal, task and instruction lists, because the backend lets a list you send win over the template's (an empty list too), so removing a template item removes it from the plan. |
| Start date, duration | Blank start date means "today", resolved by the backend in Africa/Lagos (no device time zone logic). A text field `YYYY-MM-DD` instead of a native picker: simpler and testable; a picker is a follow-up. |
| `expected_version` | Taken from the plan in the query cache at the moment of the write. Adding a goal sends none (the backend makes it optional: adding never overwrites). A goal write answers `plan_version`, which is put into the cached plan (`applyGoalResult`), so the next write is not stale. |
| `version_conflict` | The 409's `detail.plan` replaces the cached plan, the sheet shows "Someone just changed this plan..." and **keeps the typed text**; the next save uses the new version. The edit sheet and goal modal diff against a snapshot taken when they opened and send only the fields the nurse changed, so a retry never reverts a field another author changed (Sonnet review finding, tested). `plan_not_editable` reloads the plan; the open sheet is dropped once it reloads read-only. |
| Header edit | The sheet sends only the fields the nurse changed. Complete / Archive are one-way and sit behind a confirm. |
| 404 | The plain `"Care plan not found"` (no live visit) shows a `GateMessage`-style full-screen notice with the spec wording, not an error with retry. `care_plan_exists` opens the existing plan. `client_not_identified`, `not_a_nurse` show their messages. 422 lists put the message under its field. |
| Goals | Discontinued goals are hidden (the API keeps them). Per-goal options row: Edit, Mark achieved / Mark active, Discontinue (confirm). Adding a goal ends on the shared success page ("New Care Goal has been added"), "View Care Goal" goes back. |
| Allergies | The plan's list is labelled "Allergies (care team)"; the client profile section labels the patient record's own allergies separately (design assumption A11: show both, never merge). |
| Privacy | Every query and mutation is in memory only (`gcTime` 2 minutes) and the cache is cleared on sign-out (existing `onSignedOut`). Nothing is logged or written to disk. |
| Type tokens | `Text` variants only; no raw `fontSize` (the existing typography test still passes). The success page reuses the `Done` badge. |
| Left out on purpose | Creating a plan with tasks that have a time (`time_of_day`): the in-form task adder sets a slot and days only; template tasks keep their times. Search on Assigned uses the server `q` (debounced 300 ms); Templates search filters the loaded list. |

## What's involved
| Area | Paths |
|---|---|
| API contract | `packages/api-client/openapi.json`, `src/schema.d.ts` (full `OAKLY_BACKEND_DIR=... pnpm api:sync` from backend `main` `11f7e48`; it also carries the already-merged KYC routes) |
| Data layer | `apps/caregiver/src/services/carePlans.service.ts`, `src/hooks/useCarePlans.ts`, `src/hooks/use-debounced.ts`, `src/api/keys.ts` |
| Rules | `src/careplan/carePlanModel.ts` (labels, error-body readers, draft, validation, request body, goal-result merge) |
| Screens | `src/screens/careplan/` (`CarePlans`, `CarePlanTemplate`, `CarePlanClients`, `CreateCarePlan`, `CarePlanSuccess`, `CarePlanDetails`) |
| Components | `src/components/careplan/` (`parts`, `GoalModal`, `EditPlanSheet`, `ListEditModal`, `ClientCarePlanRow`) |
| Wiring | `src/navigation/Navigations.tsx`, `StackNavigator.tsx` (6 routes), `src/screens/home/Home.tsx` + `src/home/homeModel.ts` (card), `src/screens/booking/ClientProfile.tsx` (row) |
| Tests | `__tests__/carePlanModel.test.ts` (23), `carePlanHub.test.tsx` (24), `carePlanCreate.test.tsx` (13), `carePlanDetails.test.tsx` (31), additions to `home.test.tsx` and `clientProfile.test.tsx`; fixtures in `test-utils/` (shaped after captures 205-222; outside `__tests__` so Jest does not run them as suites) |

## Verification
Local CI parity, run in the worktree: `pnpm install --frozen-lockfile`; `pnpm api:generate` then `git diff --exit-code packages/api-client/src/schema.d.ts` (clean); `pnpm typecheck`; `pnpm lint`; `pnpm test` (caregiver 33 suites, all green); `OAKLY_API_ORIGIN=http://127.0.0.1:8000 pnpm --filter admin build`. The tests cover each screen's loading, empty, error, 404 and capability-hidden states, the request bodies, version handling and conflict recovery. Routine Sonnet review done: 4 real findings fixed with tests (conflict retry reverting another author's field, Active plans shown under the Completed filter while loading, `plan_not_editable` leaving stale controls, goal edit sending unchanged fields) plus small ones (search shared between tabs, stale goal error, plan kept in memory after access ended, mutation `gcTime`). Not done: the `care_plan_exists` redirect gives no one-line notice.
**Not verified:** a device or simulator (layout, keyboard behaviour in the modals, the `Done` gif); a running backend (shapes come from the backend's captured test harness, not the compose stack); a template with `clinical_review_status: "approved"` (none exists yet; the note simply disappears).

## Operate / roll back
App-only change plus a regenerated API spec. Revert the PR. A nurse needs an admin-assigned `nurse` skill for the Home card and every authoring control to appear.

## Follow-ups
- M2: daily tasks, ticks, observations, View Progress (the hub's progress bar already reads `progress_percent`). M3: medications.
- A native date picker for the start date; a time-of-day field for tasks added in the create form.
- Device pass: modals with the keyboard open, small screens, `Done` gif.
- Clinical sign-off on the seeded templates and wording ("Not yet clinically reviewed" shows until each template is approved).
- The Assigned tab shows a "Completed" filter but no way to start a new plan for a client from a completed one other than the profile row.
