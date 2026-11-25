# SOP: Care alerts page in the admin console (slice 1c)

| | |
|---|---|
| **What shipped** | A **Care alerts** page in `apps/admin` under Queues (`/queues/care-alerts`): the admin queue for out-of-range readings and missed care-plan tasks, with acknowledge and resolve (each with an optional note) and a detail view. Branch `feature/care-alerts-console`, one PR to `main`, **stacked on #75 (`feature/vitals-flags-badges`): merge that first**. Backend: branch `feature/care-alerts` (SOP `docs/sop/2026-11-25-care-alerts.md`, FE guide `docs/fe-integration-guide-care-alerts.md`, stacked on backend #84). |
| **Why** | The clinical lead asked for an alert when a reading is out of range or a task is missed; the owner decided (2026-11-25) it goes to the family contact and an admin queue. The family only receives a message (no family screen in the v1 apps); this page is where a person works the queue. |
| **Verified** | `tsc --noEmit` and ESLint over `apps/admin`, Vitest for the new page (13 tests) and the side-nav test, single worker. The request and response shapes are the backend's live captures. **Not run in a browser against the running backend; no Playwright run.** |

## Changes

| Where | Change |
|---|---|
| `packages/api-client` | Regenerated from the backend: the four `/admin/care-alerts` routes and `CareAlertOut`, `CareAlertList`, `CareAlertCounts`, `AlertDetail`, `AlertPartyOut`, `AdminRef`, `AlertActionIn`, `AlertErrorBody`. Additions only (no existing schema changed). |
| `apps/admin/src/lib/care-alerts.ts` | Wire types, filters, query keys, the fetchers, `familyLine`. |
| `apps/admin/src/app/(console)/queues/care-alerts/` | `page.tsx` (guarded by `support.inbox`) and `care-alerts-queue.tsx`: status, severity and type filters; a counts line (critical needing work in red); a table with severity, what happened, patient (the masked marker when the admin lacks `people.pii`), latest time and repeat count, family delivery line, status; Details, Acknowledge and Resolve per row; polls every 45 s. |
| `apps/admin/src/components/care-alert-dialogs.tsx` | The acknowledge and resolve confirmation (optional note, up to 1000 characters; a `409` stays in the dialog with the server's sentence) and the detail body. |
| `apps/admin/src/lib/nav.ts` | "Care alerts" under Queues for admins holding `support.inbox`. |
| Tests | `care-alerts-queue.test.tsx`, `test/care-alert-fixtures.ts` (shapes copied from the backend captures). |

## Decisions

- **The list never loads clinical detail.** The backend's list is summary only; the Details button opens the one-alert route, which is what the audit log records. `detail_masked` from the server decides whether the detail is explained or hidden: the page never guesses permissions.
- **Acknowledge and Resolve do not ask for a reason** (the note is optional and says it is not copied into the audit log), unlike the finance dialogs: an alert is a work item, not a money decision.
- **A `409` reloads the queue** (`already_acknowledged`, `already_resolved`): someone else got there first.
- **No browser notification or sound.** The page polls; the owner has not asked for more. The critical e-mail to admins holding `support.inbox` is the push channel.

## Follow-ups

- Run the page against the running backend once (with a critical reading and a missed task) and read the screen.
- A navigation badge with the open count (the list's `counts` already carries it).
- Add the `care-alerts` e2e to the Playwright suite if the owner wants one (CI runs it).
