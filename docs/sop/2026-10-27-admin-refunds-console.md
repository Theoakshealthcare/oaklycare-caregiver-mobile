# Admin console: refunds

**What shipped.** Refunds screens in `apps/admin`: a queue (default "open", status filter, paging, total, raise-a-refund) and a refund detail with every action the backend offers. Branch `feat/admin-refunds-console`, built on backend Refunds v2 (Theoakshealthcare/backend#19, `f4b2f80`, API only). Not pushed or merged when this was written.

## Why
Refunds v2 moves refunds into a queue that a person always approves and Paystack finishes. The API had no console, so Finance could not approve, reject, retry or enter bank details, and a Super Admin could not clear a refund Paystack contradicted.

## How
Contract is backend `docs/fe-integration-guide-admin.md` section 12.12 (captured against the running app; fixtures in `apps/admin/src/test/refund-fixtures.ts` are copied from those captures with placeholder ids). Decisions:

| Decision | Reason |
|---|---|
| **Money is naira as a JSON number** here, shown with new `formatNairaValue`; `formatNaira` (kobo) is untouched | Refunds is the one admin API that speaks naira. The single kobo message (`between 1 and N kobo`) is reworded to naira in `friendlyRefundError`; every other server message is shown verbatim |
| Nav "Refunds" (already in the nav, was unavailable) is now on, visible to any of `refunds.request`, `refunds.approve`, `payments.read` | The three read permissions in the guide |
| Buttons come **only from `available_actions`**; nothing re-derives permissions | Guide: "render buttons from this list". "Another admin must approve" and the limit follow the server |
| Approve dialog: amount prefilled with `min(suggested, max_approvable_naira)`; confirm disabled outside `0.01` to `max_approvable_naira` or with more than 2 decimals | Approve a lower amount, never above the caller's max; the API would answer 422/403 anyway |
| Wallet destination offered only when the admin holds `refunds.approve_above_limit` **and** the booking channel is `app` | A UI hint only (the API has no flag for it); the server still refuses a Finance or WhatsApp wallet refund and its message is shown |
| Take-back: shown only for a completed visit with `take_back_preview_naira > 0`; the preview is stated first, the reason is required when chosen, the amount is never editable | Guide: proportional, not editable, reason required (422 otherwise) |
| Bank details: bank code plus exactly 10 digits, nothing kept after the dialog closes; the screen shows only `account_last4`, bank code and account name (blank for roles without access) | Never show or store a full account number; the API never returns one |
| Resolve has no preselected outcome. On the "different amount" 409 the dialog reveals an amount field prefilled (kobo converted to naira) and the next call carries `amount_naira` | Mirrors guide capture 398/399; the admin must still check the Paystack dashboard |
| Raise a refund by booking id (UUID) from the queue, gated by `refunds.request` | The API takes `booking_id`; the notice says another admin must approve it |
| A refused write refreshes all refund queries; a successful one puts the returned detail in the cache | A refused retry can move a refund to `needs_review`; the write already returns the new detail |
| Detail re-reads every 30 s while `approved` or `processing`, then stops | Guide polling cadence |
| Rules shown as text on the list and the detail: Finance cumulative limit per booking (detail uses the real `limit_naira`), Super Admin above it or for wallet credit, staff-raised refunds need a different approver, "processed is not in the family's account" | Spec |

## What's involved
- `apps/admin/src/lib/refunds.ts` (types from the generated schema, API calls, `parseNaira`, state predicates, kobo-message and different-amount helpers)
- `apps/admin/src/components/refund-actions.tsx` (all dialogs, `RequestRefundButton`), `refund-rules.tsx`
- `apps/admin/src/app/(console)/queues/refunds/` (`page`, `refunds-list`, `[id]/page`, `refund-detail`)
- `apps/admin/src/lib/format.ts` (`formatNairaValue`), `lib/nav.ts`, `components/status-badge.tsx` (`succeeded`, `needs_review`)
- `packages/api-client/openapi.json` and `src/schema.d.ts` re-synced from backend `f4b2f80` (own commit)
- No change to `apps/caregiver`.

## Verification
Vitest/RTL, fixtures from the guide's captures: list (default `status=open`, total, paging, every status filter, empty, error, flags and "Needs you", booking link); detail for every status, buttons only from `available_actions` (including a Super Admin not seeing Approve when the server omits it), raised-by-me and above-limit notices, review flag on a finished refund, attempts with holder fields null, take-back preview and debited/owed; approve (lower amount, amount bounds, suggestion null, wallet gating, take-back with reason, server refusal verbatim, double click sends once), reject, retry (with refusal), close, switch to wallet, bank details (10 digits, last4 only afterwards, refusal), resolve (explicit outcome, different-amount second call), refusal-triggered re-read; raise refund (permission, body, amount validation, kobo message in naira); `parseNaira` and message helpers; nav gating. Local CI from the worktree root, as `.github/workflows/ci.yml`: `pnpm install --frozen-lockfile`, `pnpm api:generate` then `git diff --exit-code -- packages/api-client/src/schema.d.ts`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter admin build`.

**Not verified:** no browser pass against a live backend (no Docker stack on this machine), so layout and real request timing are unchecked; real Paystack timings and WhatsApp delivery are labelled not live in the guide; the 30 s polling is not covered by a test; system-origin refunds from the caregiver-cancel, WhatsApp-cancel and paid-after-expiry paths are tests-only in the backend.

## Operate / roll back
Pure frontend. Revert the PR and the nav item disappears (it returns to `available: false`). No config or migration. The backend must be at `f4b2f80` or later.

## Follow-ups
- Live browser pass against the local backend, then Playwright e2e for approve and bank details.
- Backend: an admin-readable Paystack bank list (only `/caregiver/banks` exists), so bank details can use a picker instead of a typed code.
- Backend: admin names for `requested_by` / `approved_by` (the API returns ids only, so the screen does not show who).
- A "Raise a refund" entry on the booking detail (it would pass the booking id), and the `above_limit` and `reason_code` filters on the queue.
