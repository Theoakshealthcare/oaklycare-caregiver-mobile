# SOP: admin console, payout bank-account name review queue

| | |
|---|---|
| **What shipped** | A Finance page at **Money > Payouts > Account reviews** (`/money/payouts/bank-reviews`) listing payout accounts held because the holder name did not look like the caregiver's profile name, with Approve and Reject. Branch `feature/admin-bank-name-reviews` (PR linked from the branch). Backend side: [backend SOP](../../../backend/docs/sop/2026-11-25-bank-name-review.md), branch `feature/bank-name-review`, migration `0030`, **not merged yet**. Caregiver app side: [SOP](2026-11-25-caregiver-bank-name-review.md). |
| **Why** | The owner chose (2026-11-25) to stop refusing an account in another name: it is saved and held until Finance decides. Until this page existed Finance had to call the API by hand. |
| **Depends on** | Backend `feature/bank-name-review` (PR #83) merged and deployed (routes and migration `0030`), or the page gets 404s. Merge the backend first. |

## How
| Decision | Choice |
|---|---|
| Where | A fourth tab on the payouts pages (`PayoutsTabs`), not a new nav group: the routes live in the payouts router, and Finance already enters through Money > Payouts. The page needs `payments.read` (`RequirePermission`); the nav entry is unchanged. |
| Layout | One table, oldest first as the API returns it: profile name and the name the bank holds in adjacent columns, bank and masked number, available balance, submitted time, status badge (with the decision time once decided). Status filter `pending` (default), `rejected`, `approved`; offset paging at 50. |
| Permissions | Approve and Reject render only for `payouts.execute` (Finance, Super Admin) and only on `pending` rows. A reader without it sees the queue and no buttons; nothing is shown disabled. |
| Decision | Each action opens `ConfirmActionDialog` with a required reason and a summary of both names, the account and the balance, so the reviewer confirms what they compared. The body is `{reason, review_token}` where `review_token` is the token the queue returned on the **row**, which names the exact account (number, bank, holder name), so a decision is bound to the account the reviewer was looking at even if the caregiver saves one ending in the same four digits. (An earlier version of this page sent `account_last4`; the backend replaced it in backend PR #83.) Approve is a normal button; Reject is destructive. |
| 409 | Two causes, both the server's own sentence: "The caregiver changed their account since you opened it. Refresh and look again." and "This account is not waiting for a name review". The dialog **closes** (it would otherwise sit over a row that just changed), the queue reloads (`invalidatePayouts`; the key sits under the `payouts` prefix) and a warning alert shows the message. No success notice is shown. Any other error (403, 422, 5xx) keeps the dialog open with the message, like the other payout dialogs. |
| Rejected alternative | A new "Queues" nav item with a pending-count badge (as Earnings has). Not done: it needs a count endpoint or a separate query, and the queue is small. Listed below. |

## What's involved
| Path | Change |
|---|---|
| `apps/admin/src/lib/bank-reviews.ts` | types from the generated schema, `accountEnding` (title text only), `isConflict`, fetch / approve / reject |
| `apps/admin/src/components/bank-review-actions.tsx` | `BankReviewActions`: permission gate, dialogs, 409 handling |
| `apps/admin/src/app/(console)/money/payouts/bank-reviews-queue.tsx`, `bank-reviews/page.tsx` | the page |
| `apps/admin/src/components/payouts-tabs.tsx` | "Account reviews" tab |
| `packages/api-client/openapi.json`, `src/schema.d.ts` | regenerated with `OAKLY_BACKEND_DIR=... pnpm api:sync`. The type diff adds only the three bank-reviews routes, `BankReview*` schemas, `needs_review` and `name_review_status`. `openapi.json` shows ~1000 changed lines because the backend now prints whole-number floats as `5000` not `5000.0`; sorted-key comparison shows no other differences in meaning that this page uses. The caregiver-app branch carries the same regeneration, so the two merge cleanly in either order. |
| `apps/admin/src/test/bank-review-fixtures.ts` | fixtures copied from live captures 970, 972, 974, 971, 973 (placeholder names) |

## Verification
- `tsc --noEmit` (`pnpm typecheck` in `apps/admin`) clean; eslint clean on the touched files and the payouts folder.
- vitest: `bank-reviews-queue.test.tsx` (12 tests) and `bank-reviews.test.ts` (2) pass, and the whole payouts folder (52 tests, five files) still passes. Covered: names side by side, balance and masked account; approve and reject send the reason and that row's `review_token`, and after a 409 reload the next decision sends the reloaded row's token; no reason, no request; both 409 messages (dialog closes, row reloads to the new account or drops, alert shown, no success notice); a 403 keeps the dialog open; actions hidden without `payouts.execute`; status filter and no actions on decided rows; paging; empty and error states.
- Response shapes and error strings come from the backend's live captures 970-974 on `feature/bank-name-review` at `bfa3615` (against a fake Paystack); the api-client was regenerated from that commit. **Not verified:** the page in a browser or against a running backend; the full suite and `next build` run on CI only.

## Operate / roll back
Merge after the backend branch. Revert the PR to remove the page and the tab; nothing else depends on it. Without it Finance can still decide through the API.

## Follow-ups
- A pending-count badge or Queues entry so Finance notices a held account without opening the tab (the backend e-mails `payouts.execute` admins when an account is flagged, so this is not urgent).
- Backend checklist (`backend/docs/checklist/MASTER_CHECKLIST.md`, line for the bank-holder name review) still lists "console page for the queue" as open. **Not edited from this session** because the backend working tree was being edited by another session; tick it when this PR merges.
- The backend does not tell the caregiver when a decision is made; unchanged here.
- Playwright e2e for the queue.
