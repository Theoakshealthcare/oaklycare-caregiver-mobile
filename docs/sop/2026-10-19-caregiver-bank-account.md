# SOP: Caregiver bank account (Payment details) screen

| | |
|---|---|
| **Date** | 2026-10-19 |
| **Branch / PR** | `feat/caregiver-bank-account`, stacked on `chore/api-client-sync-payouts` (PR #13); retarget to `main` once #13 merges. |
| **Depends on** | Backend payouts slice 2 (Theoakshealthcare/backend#14); contract: backend `docs/fe-integration-guide-caregiver.md` section 10.3. |

## What shipped
The real Payment details screen (view, add, change) with a searchable bank picker and account-name confirmation, plus a "payouts paused" notice on the Wallet screen. Replaces the read-only stopgap from #13.

## Why
`PUT /caregiver/bank-account` now takes only `bank_code` + `account_number`; the backend resolves the holder's name with Paystack and pays only verified accounts. Accounts saved before have no `bank_code` and cannot be paid until saved again.

## How
| Decision | Choice |
|---|---|
| Flow | Pick bank (searchable modal) -> 10-digit number -> `POST /bank-account/resolve` -> show the name -> "Yes, this is my account" -> `PUT`. Changing the bank or number discards the looked-up name, so the saved account is always the one confirmed. |
| Name | Never sent on save; shown from the resolve response only. |
| 24 h pause | After a save whose response has a future `payouts_blocked_until`, a notice says payouts are paused 24 hours "because you changed your bank account", with the local time. The view screen and Wallet show "Payouts are paused until ..." while the time is in the future. A warning is also on the view screen before changing. |
| Errors | New `"bank"` error context: for 400/429/503 the backend's `detail` sentences (guide 10.3 table) are shown as sent, since they are written for the caregiver. Other statuses use the existing generic messages. |
| Legacy accounts | `bank_code` null or `verified` false -> warning banner and "Verify bank account"; Wallet link reads "Verify account". |
| Bank list | `useBanks`, `staleTime` one day (backend caches it too). Search is a client-side case-insensitive contains. |
| Rejected | Reusing `ui/select` (no search; the real list has ~200 banks). |

## What's involved
`src/screens/account/BankDetails.tsx`, `src/components/account/BankPicker.tsx`, `src/services/wallet.service.ts` (`getBanks`, `resolveBankAccount`), `src/hooks/queries.ts` (`useBanks`, `useResolveBankAccount`, `useSaveBankAccount`), `src/api/keys.ts`, `src/api/errors.ts` (`bank` context), `src/wallet/walletModel.ts` (`payoutsPausedUntil`, `bankAccountState`, `accountNumberProblem`, `filterBanks`), `src/screens/account/Wallet.tsx`. Tests: `__tests__/bankDetails.test.tsx`, `__tests__/wallet.test.tsx`. All under `apps/caregiver`. No `packages/api-client` or admin changes.

## Verification
Jest: loading, error+retry, empty/add, view, paused, legacy re-save, validation, resolve success, resolve failures (400/429/503), save success with and without the pause notice, save failure, change/cancel, bank search + load retry, Wallet paused. Fixtures follow captures 124, 125, 127, 178 with placeholder data. Typography test enforces the six type tokens. Not verified: on a device/simulator, or against live Paystack (the guide's captures used a fake Paystack).

## Operate / roll back
Pure app change; revert the PR. No config.

## Follow-ups
- Owner visual pass on device (picker modal, keyboard overlap on small phones).
- The guide marks the 400/429/503 sentences as test-verified only; re-check against live Paystack.
