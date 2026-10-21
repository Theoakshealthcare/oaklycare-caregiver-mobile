# Admin console: bookings operations (A2 screens)

**What shipped.** Bookings screens in `apps/admin`: the bookings list (search, filters, paging), the unmatched queue, booking detail with its timeline, and seven action dialogs (re-dispatch, assign/force-assign, reassign, cancel with refund choice, confirm address, flag no-show, correct status). Branch `feat/admin-a2-bookings` (worktree `wt-a2-console`), on top of `oakly/main` 96ee6f4. Backend contract: Theoakshealthcare/backend#26, guide `docs/fe-integration-guide-admin.md` §12. Design and plan: `docs/plans/2026-10-19-admin-a2-bookings.md`.

## Why
The A2 API (merged 2026-10-06) lets staff find a booking and step in, but there was no console screen for it, so a paid booking that nobody accepted (or a WhatsApp booking held for an address check) could sit unnoticed. PRD AD-FR-19 to 26, goal G2: no paid booking unmatched for 2 hours without an owner.

## How

| Decision | Reason |
|---|---|
| Action buttons come **only** from the detail's `available_actions`; `force_assign` only enables the "Assign now" checkbox in the Assign dialog. An open dialog closes if a refetch drops its action, and a withdrawn `force_assign` sends `force: false` | Guide 12.4: the backend already combines permission and state; a hard-coded table would drift |
| Pages guarded by `bookings.read`; nav "Bookings" on `bookings.read`, "Unmatched" on any of `bookings.dispatch` / `assign` / `address` (readers can still open the URL) | The queue is a work list for the people who can act on it |
| Detail never polled: no refetch on focus/reconnect, no interval, `gcTime: 0`; a manual **Refresh** button | Each detail fetch by a `clinical.read` admin writes a `booking.clinical_view` audit entry (guide 12.4) |
| Masking shown honestly: "masked" marker on shortened patient and caregiver names, "Area only" address, clinical "recorded, hidden" | `people.pii`, `bookings.address`, `clinical.read` change what the response contains |
| Cancel: nothing preselected; unpaid offers "No refund" only; partial amount in ₦, > 0 and < total; **policy guide** shows tier, fee and suggested refund with "Use this amount" | The admin cancel never applies the fee itself; the guide is an estimate from the **live** policy (the booking's quoted copy and the on-my-way qualification are not on the detail) |
| Cancel copy: "does not refund anyone, it requests a refund for Finance"; refund "none" warns that the patient gets no message | Guide 12.6 UX the console must surface |
| Every action requires a reason; server 409/403/422 shown verbatim in the dialog; the detail is refetched on success and failure | Guide 12.5: a 409 says what to do, and means someone else changed the booking |
| Re-dispatch with `notified_caregivers: 0` is a notice ("No one available"), not an error | Guide 12.6 |
| Date filters are WAT days sent as naive UTC (`2026-10-09T23:00:00`, `to` exclusive) | Backend timestamps are naive UTC |

Rejected: polling the detail to watch an offer get accepted (audit noise for clinical readers); computing the cancel fee as the refund automatically (the backend leaves the choice to the admin).

## What's involved
- `apps/admin/src/lib/bookings.ts` (+ test): types from the generated schema, fetchers, the seven actions, `listQuery`, `watDayStartUtc`, `cancelEstimate`, `correctionTargets`, `insideNigeria`, `parseNairaToKobo`
- `apps/admin/src/app/(console)/bookings/` (`page`, `[id]/page`, `bookings-list`, `booking-detail` + tests)
- `apps/admin/src/app/(console)/queues/unmatched/` (`page`, `unmatched-queue` + test)
- `apps/admin/src/components/booking-actions.tsx` (+ test), `booking-cells.tsx`, `status-badge.tsx` (booking tones)
- `apps/admin/src/lib/{nav,format,booking-actions-helpers}.ts`, `src/test/booking-fixtures.ts` (shapes from captures 079–119, placeholder data)
- No change to `packages/api-client` (schema already in sync), backend or `apps/caregiver`.

## Review
Opus read-only review of permission gating: no high findings. Fixed: a stale open dialog after a refetch dropped its action (now closes), the masked caregiver name in the list (now marked). Left: the Unmatched nav entry does not check `bookings.read` (a custom role with an action permission but no read would see a link to a no-access page; no stock role is affected).

## Verification
Vitest/RTL, 241 admin tests: list query string for every filter, paging reset, masked markers, flags, 422 list error; unmatched reason filter, empty/error; detail cards for Ops, Finance (masked, area-only), Clinical Reviewer, held address, refund requested, dispatch offers, timeline order, 404, fetched once with no refetch on focus, Refresh; each action's exact body and path, consequence text, verbatim 409/403/422, force gating, dialog closing when the action is withdrawn, cancel policy guide numbers, refund validation, confirm-address range check, forward-only status targets. Full local CI from the worktree root (mirrors `.github/workflows/ci.yml`): frozen install, `pnpm api:generate` + schema diff clean, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter admin build`. **Not verified live:** no run against the local backend (the shared Docker stack was not started for this slice).

## Operate / roll back
Pure frontend. Revert the PR; the nav items return to hidden. No config or migration.

## Follow-ups
- Backend: expose the booking's own cancel terms (`cancel_policy` snapshot, tier the backend would apply) on the admin detail so the policy guide is exact.
- Live browser pass against the local backend (Ops, Finance, Super Admin, Clinical Reviewer logins).
- Booking-policy edit screen (12.9), audit log screen, Overview attention panel, CSV export, contact-patient link.
- Playwright e2e for assign and cancel.
