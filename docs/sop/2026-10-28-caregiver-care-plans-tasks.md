# SOP: Caregiver care plans, slice M2 (daily tasks, ticks, notes, progress)

| | |
|---|---|
| **Date** | 2026-10-28 |
| **Branch / PR** | `feat/caregiver-care-plans-tasks`, rebased onto `oakly/main` `29ccd31` after M1 (monorepo PR #10) merged. Not pushed; the lead session pushes and opens the PR. |
| **Depends on** | Backend B2 (backend#29, merged). Contract: backend `docs/fe-integration-guide-caregiver.md` sections 16.13 to 16.20 (captures 230 to 238). Design: backend `docs/plans/2026-10-27-caregiver-care-plans-design.md` sections 5.5, 5.7, 8, 9, 14. Figma exports `ss/caregiver/` `8.23.45`, `8.23.57`. |
| **Device status** | **Not verified on a device or simulator** (not approved for this slice). Jest only, against mocked services shaped after the backend's captured responses. |

## What shipped
On **Care Plan Details** a caregiver now sees **Daily care tasks** (Monday to Sunday tabs, tasks by slot, a tick box per task), **Notes and observations**, and, inside Allergies and special instructions, **Special notes**. Nurses can **Add New Task** (modal and the shared success page). **View progress** opens a new screen (percent over visit days, "Day N of M", review date, goal counts, the last visit days) from the details header and from every card on the hub's Assigned tab. **Before "Complete visit"**, a client with an active plan gets a prompt to review the plan first. Task edit and remove, and medications (M3), are not in this slice.

## Why
Backend B2 is merged (ticks, notes, progress), so the endpoints exist. M2 is the second mobile slice (design section 14). The point of a shared plan is that **any caregiver on the visit** ticks tasks and writes notes; only authoring (add task) needs the nurse flag.

## How
| Decision | Choice |
|---|---|
| Who may do what | Only server flags decide. Add Task: `capabilities.can_edit_plan`. Tick boxes: the day view's `can_tick` (true only for **today**, plan active, and the caller's own visit in progress). Note box: `capabilities.can_add_observation`. Non-authors tick and note but never see Add Task. |
| "Today" | Never the phone's clock. The default day query sends **no `date`**, so the backend resolves today in Africa/Lagos; its `date` answer drives the week tabs (`weekOf`, pure UTC calendar arithmetic). Another tab sends its `YYYY-MM-DD`. Tapping today's tab goes back to the default query. |
| Ticks | **Never optimistic, never retried or queued** (guide 16.19). The box is busy while the call is open and changes only when the `200` arrives; the answer's `done_by` / `done_at` is what is shown, so a colleague who ticked first is shown as the one who did it, with no error. The answer is written into every cached copy of that day. **Unticking always asks first** (it is recorded in the plan's history and may undo a colleague's tick). |
| Refusals | One mapping, `tickFailure`: `visit_not_in_progress` ("Available during an active visit.", reload plan and day), `task_date_not_today` ("The day changed, so your tick was not saved", reload the day), `task_not_scheduled`, `plan_not_editable` (reload plan), plain 404 -> the screen's not-available notice and the plan, day, notes and progress are dropped from memory. Offline or other errors show the normal message; nothing is queued. |
| Add task | Name, routine (slot chips), optional 24-hour `HH:MM` time, frequency (Daily / Weekdays / Weekends presets plus a chip per day). Sends no `expected_version` (adding overwrites nothing); the answer's `plan_version` goes into the cached plan so the next goal or plan edit is not stale. Ends on the shared success page ("New Daily Task added successfully", "View Task" goes back). |
| Notes | Two lists on one component: `observation` (Notes and observations) and `special_note` (Allergies and special instructions, "Add Special Notes"). Newest first, **keyset paging with both cursor halves** (`before` + `before_id`) through `useInfiniteQuery` ("Show older notes"). A submit trims, checks 1 to 2000 characters, and says up front that a note **cannot be edited or deleted**. On any refusal the typed text stays. After a successful add the list reloads so the note appears at the top with its author. Collapsed sections do not load until opened. |
| Hints | Boxes disabled before the visit starts: "Available during an active visit." (day and notes). Other days: "Only today's tasks can be ticked. Other days are read-only." A completed or archived plan shows M1's read-only banner and no extra hint; its notes stay readable. |
| View progress | `overall_percent` null shows **"No visits yet", never 0%**; the explanation "Only days with a visit for this client are counted..." sits beside the percent (guide trap 8). Day before the plan starts shows "Not started yet". |
| Clock-out prompt | `VisitFlow` looks up the visit's plan only while the booking is `in_progress` (existing `useVisitCarePlan`). If it has an **active** plan, "Complete visit" first asks "Add your notes before you finish?" with **Review care plan** (opens the details with the tasks and notes open, `from: "clock_out"`), **Complete visit** and **Not yet**. No plan, a completed plan, a 404, a failed lookup, or a lookup still loading all fall back to the old plain confirmation: **the lookup can never block completing a visit.** |
| Collapsing | The tasks, notes and allergies sections stay mounted once opened (`Accordion keepMounted`), so a typed note and the chosen day survive closing the section. Nothing loads before a section is first opened. |
| Privacy | Same as M1: in-memory queries (`gcTime` 2 minutes), cleared on sign-out, nothing persisted or logged. |
| Type tokens | `Text` variants only; no raw `fontSize` (the typography test still passes). |
| Left out on purpose | Editing and removing a task (the design does not draw them; backend routes exist, warn "edits change every day" when added), a native time picker, family view. |

## What's involved
| Area | Paths |
|---|---|
| Data layer | `apps/caregiver/src/services/carePlans.service.ts` (day view, add task, tick, notes list/add, progress), `src/hooks/useCarePlanTasks.ts` (new), `src/api/keys.ts`, `src/hooks/useCarePlans.ts` (`keepConflictPlan` exported; `useVisitCarePlan(enabled)`) |
| Rules | `src/careplan/carePlanModel.ts` (week tabs, clock and slot labels, task draft and body, `applyTaskResult`, `applyCompletion`, `tickFailure`, note validation, progress wording, clock-out copy) |
| Components | `src/components/careplan/DailyTasks.tsx`, `TaskModal.tsx`, `NotesSection.tsx` (new) |
| Screens | `src/screens/careplan/CarePlanProgress.tsx` (new); `CarePlanDetails.tsx` (three sections, View progress, `from: "clock_out"`), `CarePlans.tsx` (View progress button), `CarePlanSuccess.tsx` (`task_added`), `src/screens/visit/VisitFlow.tsx` (prompt) |
| Wiring | `src/navigation/Navigations.tsx`, `StackNavigator.tsx` (`CarePlanProgress`; `CarePlanSuccess.kind`, `CarePlanDetails.from`) |
| Tests | `__tests__/carePlanTasksModel.test.ts` (25), `carePlanTasks.test.tsx` (22), `carePlanNotesProgress.test.tsx` (19), `carePlanDetailsTasks.test.tsx` (12), `carePlanClockOut.test.tsx` (9), additions to `carePlanHub.test.tsx`; fixtures in `test-utils/carePlanFixtures.ts` (shaped after captures 233 to 237) |

No migration, no new endpoints, no API-client change (M1 already synced B2).

## Verification
Local CI parity in the worktree: `pnpm install --frozen-lockfile`; `pnpm api:generate` + `git diff --exit-code packages/api-client/src/schema.d.ts` (clean); `pnpm typecheck`; `pnpm lint`; `pnpm test` (caregiver **38 suites, 550 tests**, all green; M1 had 33 / 463); `OAKLY_API_ORIGIN=http://127.0.0.1:8000 pnpm --filter admin build`. Tests cover: week tabs (month and year ends), the default day sending no `date`, a tick shown only after the answer, a colleague's earlier tick, confirm-before-untick, every refusal code, midnight, a 404 from the day view, a tick, a note, a task add and progress (dropping the plan, tasks, notes and progress from memory), non-author gating, completed-plan read-only, cursor paging, note validation and text kept on every failure, the add-task body, progress "No visits yet", and the clock-out prompt in all its fallbacks. Routine Sonnet review done: 3 real findings fixed with tests (a second tap while a tick is open could lose the first one's refusal message, so all boxes now wait for the open tick; a half-written note or the chosen day was lost when a section was collapsed, so `Accordion` now has `keepMounted` after the first open; a note refused with `plan_not_editable` left the box live, so the plan now reloads). Also fixed a timing flake in the clock-out test (it presses until the prompt appears).
**Not verified:** a device or simulator (layout of the tabs and the modal with the keyboard, the busy spinner in the box); a running backend (shapes come from the backend's captured harness, not the compose stack); the real midnight cut-off (backend-side, covered by its own tests); a visit that ends while the screen is open (covered by mocks only).

## Operate / roll back
App-only change; revert the PR. Needs M1 (already merged in #10). A tick or note works only for a caregiver whose own visit with that client is in progress; a nurse skill is needed only for Add New Task.

## Follow-ups
- Edit and remove a task (nurse), with the "applies to every day" warning (backend `PATCH`/`DELETE` exist).
- A time-of-day field is plain text `HH:MM`; a native picker later (same as M1's date picker follow-up).
- Device pass: day tabs on small screens, the add-task modal with the keyboard, the tick spinner, the clock-out alert.
- The clock-out prompt uses the plain `Alert`; a tick count ("3 of 5 tasks left") would need the day view on the visit screen.
- M3 medications (after backend B3).
