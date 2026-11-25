# SOP: admin console Earnings page (Money > Earnings)

| | |
|---|---|
| **What shipped** | A new **Earnings** page in the admin console under Money (beside Payouts) that lists caregiver earnings and lets Finance **hold**, **release a hold on** and **void** them, each with a required reason and a confirm step. A "held for review" count badge on the nav item, and a "Caregiver earning" card on the admin booking detail page. |
| **Branch / PR** | `feature/admin-earnings-page`, cut from `oakly/main` `e814516`. PR: see the branch on `Theoakshealthcare/oaklycare-caregiver-mobile`. Not merged by this session. |
| **Backend** | None changed. Uses the existing `GET /admin/earnings`, `POST /admin/earnings/{id}/hold`, `/release-hold`, `/void` (`backend/app/api/v1/endpoints/admin_earnings.py`, already in the generated api-client). |
| **Not verified** | Against a live API: no local stack or staging login was available, so fixtures follow the backend schema and service code, not captured responses. No browser pass. |

## Why
A visit shorter than `short_visit_min_percent` (50 %) of the booked time is credited already `held` for Finance review, and the caregiver app shows it as "Under review". The owner finished a short test visit and found nothing to review in the console: no page used the earnings endpoints.

## How
| Decision | Why / alternative rejected |
|---|---|
| **One page, in-page tabs** (Held for review, On hold by admin, Pending, Released, All; default Held for review), not one route per tab. | The tabs are filters over one list. Query-string tabs would need `useSearchParams` (a Suspense boundary at build); the nav and badge simply open the default tab, which is the useful one. |
| **"Why it is held" is read off `status_reason` and `status_changed_by`** (`holdKind` in `lib/earnings.ts`): "Short visit..." is a short visit; "No-show flagged..." is a no-show flag; any other reason with no admin is a system hold; the rest were typed by an admin. | The API has no hold-kind field and the backend writes those two wordings itself (`services/earnings.py`). Alternative rejected: a backend change (out of scope). The brittleness is the wording match; the unit tests pin both strings. |
| **Held tabs split one read of every held earning** (pages of 200, at most 5 pages) in the browser. Pending, Released and All page through the API (50 a page). | The API filters by status only, so "for review" vs "by admin" cannot be asked of it. Held earnings are few; a truncation is flagged by `truncated` (the badge then shows `N+`). |
| **Detail is a side drawer** (Radix dialog styled to the right edge) from a "Review" button, not a detail route. | There is no get-one endpoint, so a route would have to refetch a list. The drawer keeps the row as it was opened, so a refused action (which refreshes the list) cannot make it vanish under the admin. |
| **Actions follow Payouts' RBAC: not rendered without the permission.** Hold and Release hold need `ledger.adjust_request` (Finance); Void needs `ledger.adjust` (Super Admin); releasing a **no-show** hold also needs `ledger.adjust`, so Finance sees a note saying so instead of the button. Status gates what is offered: Hold on pending only, Release hold on held only, Void on pending or held, nothing on released or voided. | Mirrors the backend; the backend remains the authority, and its refusal (403, 404, 409) is shown verbatim in the confirm dialog (`ConfirmActionDialog`). |
| **Failed actions still refresh the list and the badge.** | The release job may have paid the earning a moment earlier. |
| **Nav badge** via an optional `badges` prop on `SideNav`, fed by `useHeldForReviewCount` in `ConsoleShell` (same held read, 60 s stale time, 2 min refetch, silent on failure, only for `payments.read`). | `SideNav` stays a pure component (its tests render without a query client). The badge has a spoken label. |
| **Booking detail shows the earning's status from the earnings API** (`?booking_id=`), not from the booking payload. | The booking payload carries only `caregiver_earning` (an amount), not the status. This reads an existing endpoint (no new backend), is gated by `payments.read`, and renders nothing when there is no earning or the read fails. |

## What's involved
| Path | Change |
|---|---|
| `apps/admin/src/lib/earnings.ts` (new) | types, permissions, tabs, `holdKind`, fetchers and the three actions, `useHeldForReviewCount` |
| `apps/admin/src/app/(console)/money/earnings/page.tsx`, `earnings-list.tsx` (new) | the page and the list/tabs |
| `apps/admin/src/components/earning-drawer.tsx`, `earning-status-badge.tsx` (new) | detail drawer with the three actions; status badge |
| `apps/admin/src/lib/nav.ts`, `components/side-nav.tsx`, `components/console-shell.tsx` | Earnings nav item (`payments.read`), badge |
| `apps/admin/src/app/(console)/bookings/booking-detail.tsx` | "Caregiver earning" card |
| `apps/admin/src/test/earning-fixtures.ts`; `lib/earnings.test.ts`; `money/earnings/earnings-list.test.tsx`; additions to `side-nav.test.tsx`, `booking-detail.test.tsx` | tests |

## Verification
- Vitest (single worker) on the five files above: all pass. `pnpm typecheck` and `pnpm lint` in `apps/admin`: clean (the exact CI steps; CI also runs the full suite and `next build`).
- The tests cover: tab filters and the status sent to the API; the held split; booking link; per-role actions (reader, Finance, no-show for Finance, Super Admin, released/voided); each action's body and notice; the API's 403/404/409 text verbatim; refresh after a refusal; badge; booking card (shown, hidden without `payments.read`, silent on error).
- Fixtures are built from `admin_earning.py` and `services/earnings.py`, **not** from live responses (no stack was running).

## Operate / roll back
Pure front end: revert the PR. No migration, no config, no backend deploy.

## Follow-ups
- Capture real responses against staging and check `holdKind`'s wording against live rows.
- A backend hold-kind field (or `reason_code`) would replace the wording match; a get-one endpoint would allow a detail route.
- Playwright e2e for the earnings flow (none yet).
