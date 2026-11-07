# Admin console: hide the wallet-credit refund destination

**What shipped.** In `apps/admin`, the refund approve dialog no longer offers "The family's Oakly wallet"; it always sends `destination: "original_method"`. Refund errors now read `detail.code` (an object detail), with a clear sentence for `wallet_refunds_disabled`. Branch `fix/admin-hide-wallet-refund` (not pushed). Follows backend PR #41.

## Why
Owner decision 2026-11-07: wallet-credit refunds are off for app users in v1 (the patient wallet is hidden). Backend #41 added `REFUND_WALLET_CREDIT_ENABLED` (default false) and answers 409 `{"detail":{"code":"wallet_refunds_disabled","message":...}}` to the wallet destination. The console still showed the option to a Super Admin on an app booking, so choosing it could only fail.

## How
| Decision | Reason |
|---|---|
| Removed the destination fieldset and its state from `ApproveDialog`; `ORIGINAL_METHOD` constant with a comment naming `REFUND_WALLET_CREDIT_ENABLED` | Only visible choice is the original payment method. API types and `RefundDetail.destination` rendering are untouched, so a refund already credited to a wallet still reads correctly |
| Did **not** touch the "Switch to wallet" button | It is server-driven: the backend drops `switch_to_wallet` from `available_actions` while the flag is off (`admin_refunds.py:89`) |
| `errorCodeOf(body)` and `refundErrorMessage(message, body)` in `lib/refunds.ts`, applied in the existing `call()` wrapper | Every refund call gets the same handling. A known code maps to our sentence (`REFUND_ERROR_CODES`); an unknown code, a string detail or a list detail keep the server message with the existing kobo rewording |
| Message: "Refunds to the Oakly wallet are switched off for now. Choose the family's original payment method instead." | Does not depend on the server's wording |
| Rules panel no longer says "every refund to the Oakly wallet" needs a Super Admin; resolve text no longer says "switched to the wallet" | They described an option the console no longer offers |
| Generated API client **not** re-synced | `pnpm api:sync` against backend `main` only added unrelated optional fields from backend #43 (vitals access names); no refund route changed. Left for the patient session's own sync to avoid a conflict |

## What's involved
- `apps/admin/src/components/refund-actions.tsx` (picker removed), `refund-rules.tsx`
- `apps/admin/src/lib/refunds.ts` (`errorCodeOf`, `refundErrorMessage`, `REFUND_ERROR_CODES`, `call()`)
- Tests: `lib/refunds.test.ts` (code parsing and wording), `queues/refunds/refund-detail.test.tsx` (no picker for a Super Admin on an app booking and `original_method` sent; the 409 shows the sentence and keeps the dialog open)
- Docs: this SOP, the 2026-10-27 console SOP (wallet row marked superseded), `docs/checklist/README.md`

## Verification
Local, single worker, processes exited on their own: admin Vitest 26 files / 332 tests; caregiver Jest 60 / 832; patient Jest 15 / 147 (its first run in the parallel `pnpm test` hit 5 s timeouts under machine load, load average about 40, and passed alone); api-client 17; `pnpm install --frozen-lockfile`; api types drift check (regenerate, `git diff --exit-code`); typecheck; lint; `pnpm --filter admin build`. Not checked in a browser against a live backend.

## Operate / roll back
No config or migration. When the owner turns `REFUND_WALLET_CREDIT_ENABLED` on, restore the picker in `ApproveDialog` (see the git history of this change); the 409 handling stays harmless.

## Follow-ups
- Re-sync the API client on the next backend-type change (stale only by backend #43's vitals fields).
- Live browser pass of the approve dialog against the local backend.
