# Admin console: caregiver identity (KYC) review

**What shipped.** The caregiver applications screens in `apps/admin` now show and act on the identity check: a queue filter with badges, an Identity card on the detail with every attempt, and Verify / Fail / "Allow another attempt". Slice K6 of the caregiver KYC design. Branch `feat/kyc-admin-console`, built on backend K5 (Theoakshealthcare/backend#34, merge `6d7d315`, no migration). Not pushed or merged when this was written.

## Why
K1 to K5 let the provider (Prembly) decide most identity checks and send the doubtful ones (face score in the grey band, name or date-of-birth mismatch, an ID number already used, a watch-listed number, three failed tries) to a person. The console still showed the old identity block (four fields that had been `null` since the old provider was removed) and had no way to see why a case was in review, find those cases, or let a failed caregiver try again.

## How
Contract is backend `docs/fe-integration-guide-admin.md` section 12.14 (captured against the running app; fixtures in `apps/admin/src/test/identity-fixtures.ts` are copied from captures 600 to 603 with their placeholder ids).

| Decision | Reason |
|---|---|
| `packages/api-client` re-synced from a clean worktree of backend `oakly/main` (`6d7d315`) in its own commit | The local backend checkout was 6 commits behind; the sync script needs the Poetry env, so it was run through a stand-in `poetry` that used the main checkout's venv against the fresh tree. Output is the committed spec, and `pnpm api:generate` shows no drift |
| Identity types come from the generated schema (`IdentityOut`, `IdentityAttemptOut`), not hand-written | K5 declared response models, so the old "write the shape by hand" note in `lib/caregivers.ts` no longer applies for this block |
| Queue filter is three chips plus "Everyone", driven by `?identity=` in the URL; only needs-review and stuck show a badge | The API sends counts for those two only (`needs_review_count`, `stuck_count`), per tab and independent of the filter. `keepPreviousData` keeps the badges on screen while another filter loads |
| Reason codes are shown in words with the code in a tooltip; an unknown code is shown as it is | Guide: the list can grow. Includes `admin_decision` and `admin_reset` (K5 follow-up) |
| Only references, scores, yes/no results and reason codes are shown; the card states that Oakly keeps no ID numbers or images and that the person is seen in the provider's dashboard via `provider_reference` ("No reference supplied" when `null`) | Owner decision (K5); the API returns nothing else |
| Verify / Fail keep the existing labels "Mark verified" / "Mark failed", notes dialog and success notice | Existing e2e (`approve-caregiver.spec.ts`) and users rely on them; `DecisionControl` only gained an `extraActions` slot |
| Decision always sends `expected_status` (the status on screen) | Guide: without it a click can resolve a review the admin never saw |
| On `IDENTITY_CASE_CHANGED` or `IDENTITY_RESET_NOT_ALLOWED` the dialog closes, the page reloads and a notice carries the server's message and reason | Nothing was changed. Keeping the dialog open would let the admin confirm again against the new state without looking at it. Any other refusal (403, 422) stays in the dialog as before |
| "Allow another attempt" is shown only when `can_reset` (server-computed) and the admin holds `caregivers.approve`; confirm dialog with required notes and the side effects in words (fresh attempts, back to Pending, nobody is notified) | Guide and K5 follow-up: the caregiver is not told, the app learns on its next poll |
| Read gated by `caregivers.read` (page), decide and reset by `caregivers.approve` (`useAuth().can`) | Same permissions the API enforces; no new permission |

## What's involved
- `packages/api-client/openapi.json`, `src/schema.d.ts` (own commit)
- `apps/admin/src/lib/caregivers.ts` (types, `identity` filter, `resetIdentity`), `src/lib/identity.ts` (reason words, helpers)
- `apps/admin/src/components/identity-card.tsx` (new), `decision-control.tsx` (`extraActions`), `status-badge.tsx` (`passed`)
- `apps/admin/src/app/(console)/caregivers/applications/queue.tsx`, `[id]/detail.tsx`
- Tests and fixtures: `identity-card.test.tsx`, `queue.test.tsx`, `[id]/detail.test.tsx`, `lib/identity.test.ts`, `test/identity-fixtures.ts`; `application-actions.test.tsx` fixture updated to the new identity shape
- No change to `apps/caregiver` or the backend

## Verification
Vitest/RTL (50 tests in the changed areas): the card for every case in the captures (duplicate, name mismatch, exhausted, no attempts, stuck, passed, failed) including attempts newest first, scores with the pass mark, "Not compared" for `null`, provider reference present and absent, unknown reason code, and no ID number or image; queue filter requests, badges, URL handling and persistence of the counts; verify and fail (notes required, `expected_status`, approved-caregiver warning), `IDENTITY_CASE_CHANGED` and `IDENTITY_RESET_NOT_ALLOWED` (dialog closed, page reloaded, server words shown, one POST only), 403 stays in the dialog, reset (confirm, notes, body, notice, reload), buttons hidden for readers and when `can_reset` is false.
Local CI from the worktree root, as `.github/workflows/ci.yml`: `pnpm install --frozen-lockfile`, `pnpm api:generate` then `git diff --exit-code -- packages/api-client/src/schema.d.ts` (clean), `pnpm typecheck`, `pnpm lint`, `OAKLY_API_ORIGIN=http://127.0.0.1:8000 pnpm --filter admin build`. The full test suite is left to CI.

**Not verified:** no browser pass against a live backend (so layout and real request timing are unchecked); the Playwright approve flow (`e2e/approve-caregiver.spec.ts`) was not run (it needs the seeded backend) but is unchanged on purpose: its identity step uses the same buttons, dialog and notice and the seeded caregiver has `pending` identity with no attempts; the real provider has never been reached, so scores, name / DOB match, ID type and `provider_reference` are shown as the backend stored them (guide: `provider_reference` may always be null).

## Operate / roll back
Pure frontend. Revert the PR to get the old card back, but the old identity fields no longer exist in the API, so the old card would show blanks. Needs backend `6d7d315` or later (the `identity` block, `needs_review_count`, `stuck_count`, `identity-reset`, `expected_status`).

## Follow-ups
- Live browser pass against the local backend, then a Playwright case for review, fail and reset.
- Read access to the identity block (including `duplicate_of_caregiver_id` and watch-list reasons) is held by every `caregivers.read` role, including Finance and Support. If the owner wants it limited to `caregivers.approve`, that is a backend change; the card already copes with no attempts or hidden fields.
- The caregiver is not notified of a reset or decision (backend follow-up K5).
- No event timeline is exposed by the API; add a history view if wanted.
- The "stuck" filter explains nothing on the row; a "stuck since" column would need the API to return the open attempt's age.
