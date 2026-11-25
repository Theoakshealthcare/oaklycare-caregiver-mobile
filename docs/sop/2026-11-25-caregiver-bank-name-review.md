# SOP: caregiver app, a payout account in another name is saved and held

| | |
|---|---|
| **What shipped** | The bank screen no longer treats a different holder name as an error. When the lookup answers `needs_review`, the app shows a warning and a "Save for review" button; a saved account shows a pending or rejected notice. Backend side and decisions: [backend SOP](../../../backend/docs/sop/2026-11-25-bank-name-review.md). Branch `feature/bank-name-review` (not yet pushed). |
| **Why** | The old rule refused `Adebayo Tosin` against an account held as `Victor Oluwatosin Adebayo`, with only "Contact support" as a way out. |
| **How** | `BankDetails.tsx` reads `resolved.needs_review` (a masked name comes back) and `account.name_review_status`. `pending` shows "Our team is checking that this account is yours"; `rejected` shows that the account cannot be paid, with a Contact support action. The old `422` handling (`BANK_NAME_MISMATCH_*`, `isBankNameMismatch`) is removed from `errors.ts`. `packages/api-client` regenerated from the backend spec. |
| **Verification** | `tsc --noEmit`, eslint on the three touched files and `bankDetails.test.tsx` (30 tests) pass locally; the api-client typechecks. Response shapes come from the backend's live captures 970-975. **Not verified:** the screen on a device or simulator. |
| **Operate / roll back** | Ship after the backend migration `0030`. An older app build ignores the new fields and does not warn that the account is held. Revert the PR to restore the old screen (it would then show no error for a mismatch, since the backend no longer sends the `422`). |
| **Follow-ups** | Admin console page for the review queue; tell the caregiver when a decision is made; show a held payout on the wallet screen. |
