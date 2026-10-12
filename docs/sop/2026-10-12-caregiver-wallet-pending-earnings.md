# SOP: Wallet pending and held earnings, weekly payouts

| | |
|---|---|
| **Date** | 2026-10-12 |
| **Branch** | `feat/wallet-pending-earnings` (from `main` `3bfb150`). Not pushed. |
| **Depends on** | Backend PR #34 (caregiver earnings, backend `main` `ba61e65`). |

## What shipped
API client re-synced; the wallet screen shows Available, Pending and On hold balances, a weekly-payout info card, and plain-English earning rows.

## Why
Visits credit 80% of the service fee as pending for 24h before release; support can hold an earning. Caregivers no longer withdraw: Oakly pays out weekly once the available balance is at least ₦5,000.

## How
| Decision | Choice |
|---|---|
| Headline number | `available_balance` (not the legacy `balance`), labelled "Available balance". |
| Pending | Shown only when `pending_balance > 0`: "₦X pending · available from <local date/time>". `next_available_at` is naive UTC, read with `parseBackendDate`, formatted in the phone's locale/zone. |
| On hold | Shown only when `held_balance > 0`, with "Under review by Oakly". |
| Withdraw | The app had no withdraw button or service call already (the wallet shipped as read-only); a test pins that. An info card states the weekly ₦5,000 rule. Bank details link kept. |
| Earning row labels | Captures show earning statuses `pending_clearance`, `held`, `successful`, `voided` (not `completed`/`void`) and types `earning`, `late_cancel_compensation`, `withdrawal`: labelled Pending / Under review by Oakly / Available / Cancelled. Withdrawal labels unchanged. |

## What's involved
`apps/caregiver/src/wallet/walletModel.ts` (`walletBalances`, `availableFromText`, `transactionView`), `src/screens/account/Wallet.tsx`, tests `__tests__/walletModel.test.ts` and `__tests__/wallet.test.tsx`, `packages/api-client/{openapi.json,src/schema.d.ts}`.

## Verification
Jest (274 tests), typecheck, lint, api types drift check, admin build, all green locally. Shapes follow backend captures 154, 155, 158, 159, 164.

## Operate / roll back
Revert the branch. The new fields are additive on the backend.

## Follow-ups
- Backend payout slice 2 (weekly transfer) is separate; copy assumes it ships.
- Not verified on a device or simulator.
