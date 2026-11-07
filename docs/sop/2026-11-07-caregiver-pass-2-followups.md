# SOP: Caregiver app, device pass 2 follow-ups (payslip, wallet wording, bank form, Login Back)

| | |
|---|---|
| **What shipped** | The buildable findings of device pass 2: **DP2-02** a readable payslip that includes pending and held earnings, **DP2-03** held amount on Home, clearer Wallet wording and one payout banner, **DP2-06** bank form spacing, picker inset and Back, **DP2-07** no dead Back arrow on Login after a sign-out. |
| **Branch / commits** | `fix/caregiver-pass-2-followups`, cut from `oakly/main` `b07ed64`. Not pushed. |
| **Source / evidence** | `ledgers/LEDGER-device-pass-2.md` (addendum), screenshots `ledgers/device-pass-2/100`-`113`, payslip sample `110-payslip_2026-11.txt`. |
| **Device-verified** | Yes, every item, on the iPhone 17 Pro simulator (Debug build, Metro serving this worktree). |
| **Tests** | Caregiver Jest single worker (see the PR for the final count), admin vitest, api-client, typecheck of all apps, `pnpm lint`, `api:generate` diff clean, admin build. |

## What changed and why

| Finding | Change | Files |
|---|---|---|
| DP2-02 payslip | `buildPayslipText(month, txs)` writes a plain-text payslip from the payments the Wallet already loaded: sections Available / Pending / Under review / Cancelled / Payouts to your bank, a count and total each, "Available from" for pending, and a closing line. `sharePayslip(month, txs)` saves `payslip_YYYY-MM.txt` and shares it as `text/plain`. Wallet checks first: still loading, or no payments, gives an alert instead of an empty file. `monthLabel` added. Why: the backend CSV only lists paid transactions, so a caregiver with pending or held earnings got a header-only file. | `src/wallet/payslip.ts`, `src/wallet/walletModel.ts`, `src/screens/account/Wallet.tsx` |
| DP2-03 wallet | Home card adds "on hold (under review)"; Wallet totals read "Total earned" / "Paid out to your bank"; one banner while paused (pause + weekly rule together). | `src/screens/home/Home.tsx`, `src/screens/account/Wallet.tsx` |
| DP2-06 bank | 16 px gaps in the form; picker padding is the safe-area top inset + 12 with a Back link and the title under it. | `src/screens/account/BankDetails.tsx`, `src/components/account/BankPicker.tsx` |
| DP2-07 Login | `HeaderBack` reads `useNavigationState(state.index > 0)`. Right after a sign-out the new signed-out stack still answered `navigation.canGoBack()` with the old stack's history, so Login drew a Back arrow that did nothing (`GO_BACK` was not handled) and sat lower than the cold-start Login. | `src/components/back/HeaderBack.tsx` |
| Tests | New `headerBack.test.tsx` (real stack navigator), rewritten `payslip.test.ts`, additions to `wallet`, `walletModel`, `home`, `bankDetails` tests; 20 test files that mock `@react-navigation/native` gained a `useNavigationState` mock. | `apps/caregiver/__tests__/*` |

## Decisions and rejected alternatives

- **Payslip is built in the app, as text.** Rejected: changing the backend payslip to include pending and held rows (a backend change and a new FE guide capture for a file nobody parses) and generating a PDF (needs a new native module, `expo-print`, and a rebuild). If Finance wants an official payslip later, that is a backend document.
- **No file for an empty month,** an alert instead: sharing an empty document helps nobody.
- **`HeaderBack` ignores parent navigators' history.** Every screen that uses it sits in a stack where back means "previous screen of this stack"; checked: sign-up flow, recover/reset, account screens, setup steps.

## Verification

Per item on the simulator (ledger addendum, shots 100-113). The payslip file was read from the app's cache after the share sheet opened. Local CI as in `.github/workflows/ci.yml`.

## Operate / roll back

App-only; revert the commits. No migration, no config.

## Follow-ups

- Still open from pass 2: DP2-01 (owner wording for the complete-visit dialog), DP2-04, DP2-05 (decisions), DP2-08 (not reproduced).
- If an official payslip document is wanted (letterhead, PDF), do it on the backend.
