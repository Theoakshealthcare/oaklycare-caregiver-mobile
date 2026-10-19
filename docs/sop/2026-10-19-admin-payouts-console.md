# Admin console: caregiver payouts

**What shipped.** Payouts screens in `apps/admin`: batches, batch detail (approve / cancel batch), all payouts (cancel / retry / resolve), and a needs-attention + frozen-caregivers view (unfreeze). Branch `feat/admin-payouts-console`, PR stacked on `chore/api-client-sync-payouts` (#13).

## Why
Payouts slice 2 (backend, Theoakshealthcare/backend#14) pays caregivers weekly through Paystack but only after an admin approves the batch, and it freezes a caregiver whenever Paystack contradicts what Oakly recorded. Without a console, a Super Admin cannot approve money out or clear a frozen caregiver.

## How
Contract is backend `docs/fe-integration-guide-admin.md` §12.11 (captured against the running app). Decisions:

| Decision | Reason |
|---|---|
| Reads gated by `payments.read`; approve batch, cancel batch and cancel payout by `payouts.execute` (Finance, Super Admin), retry, resolve and unfreeze by `ledger.adjust` (Super Admin only), per the 2026-10-19 backend change (#17). Superseded text in this table that says "every action by `ledger.adjust`" is out of date; actions are **not rendered** (not disabled) without it | That is what the backend enforces (Finance reads, Super Admin acts). `payouts.execute` exists but is unused by the API, so the nav item switched from it to `payments.read` |
| Approve dialog **re-fetches the batch on open** and shows the fresh payout count and total; confirm stays disabled until that read lands and the batch is still `pending_approval` | The page may be minutes old; approval moves money for whatever is waiting server-side |
| Every dialog names the payout (amount, caregiver, batch day) in its title | Wrong-button-wrong-payout guard in long tables |
| Resolve has no preselected outcome; `force` is an explicit, explained checkbox, default `false` | `force` only matters when Paystack's answer is not final and never overrides a definite answer |
| Retry hidden when the caregiver is frozen | Guide: a frozen caregiver's payout is never retried |
| Write-off checkbox appears only when a shortfall is visible or after the server's 409 names it; the notice reports debited / written-off amounts | The shortfall shown is limited to loaded payouts; never let an admin write off an amount they have not seen |
| Failed actions still refresh the lists | A refused retry/resolve can have moved the payout server-side (e.g. to `needs_attention`) |
| Unfreeze never pre-disabled; the server's refusal (open payouts, uncovered shortfall) is shown verbatim | Local data can be stale; the backend is the authority |
| Frozen view is derived client-side from needs-attention payouts + the 200 most recent payouts | The API has no frozen-caregiver list (see follow-ups) |
| `ConfirmActionDialog` unchanged: busy state blocks double submit, errors from `detail` shown in the dialog | Reuse of the console's one confirmation pattern |

## What's involved
- `apps/admin/src/lib/payouts.ts` (types from the generated schema, API calls, state-machine predicates, `groupFrozen`)
- `apps/admin/src/components/{payout-actions,payouts-table,payouts-tabs,pager}.tsx`
- `apps/admin/src/app/(console)/money/payouts/` (`page`, `all/`, `attention/`, `batches/[id]/` + screen components)
- `apps/admin/src/lib/nav.ts` (Payouts available, `payments.read`), `status-badge.tsx` (payout statuses)
- `apps/admin/vitest.config.ts` (`testTimeout` 20s: jsdom + Radix dialogs time out when `pnpm -r test` runs suites in parallel)
- No change to `packages/api-client` or `apps/caregiver`. Money is integer kobo, shown with `formatNaira`.

## Review
One Opus read-only review (money/permissions): no wrong-id, double-submit or gating findings; fixed refresh-on-failure, force wording, write-off disclosure, unfreeze and approve result notices, "Approve batch" label, error state for the frozen view. Left as is: cancel-batch dialog uses cached totals (the server cancels what is waiting regardless), Unfreeze not pre-disabled.

## Verification
Vitest/RTL (fixtures copied from the guide's captures): batches list/filter/empty/error; batch detail with approve (fresh totals, reason sent, refusal verbatim, double click sends once, disabled until fresh read, not-waiting-anymore), cancel batch, Finance sees no actions; payouts list filter, per-status action visibility, cancel/retry/resolve success and server refusals, frozen payouts not retryable; attention queue, unfreeze with/without write-off and both 409 messages verbatim; nav gating. Full local CI from the worktree root: `pnpm install --frozen-lockfile`, `pnpm api:generate` + schema diff clean, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter admin build`. **Not verified:** no browser run against a live backend (no Docker stack on this machine), and the backend's Paystack behaviour is a local fake in the guide.

## Operate / roll back
Pure frontend. Revert the PR; the nav item returns to hidden. No config or migration.

## Follow-ups
- Backend list/filter for frozen caregivers (`GET /admin/payouts/caregivers?frozen=true` or `caregiver_payouts_frozen=true`), so the frozen view stops depending on a 200-payout window.
- Approval takes the batch's current waiting payouts server-side; the dialog shows the fresh total but the API has no "expected total" guard. A body field would close the last race.
- Playwright e2e and a run against a live Paystack account.

## Update 2026-10-19: Finance approves and cancels
Backend Theoakshealthcare/backend#17 moved batch approve, batch cancel and payout cancel to `payouts.execute`. In `apps/admin/src/lib/payouts.ts` the single `PAYOUTS_ACT` is split into `PAYOUTS_EXECUTE` and `PAYOUTS_ADJUST`. `batch-detail.tsx` gates Approve/Cancel batch on `payouts.execute`; `payout-actions.tsx` gates Cancel on `payouts.execute` and Retry, Resolve and Unfreeze on `ledger.adjust` (nothing is rendered for an admin with neither). Tests: a Finance user sees batch Approve/Cancel and payout Cancel but no Retry, Resolve or Unfreeze; a reader sees none. No API client change (the OpenAPI is unchanged). Pure frontend; revert the commit to roll back.
