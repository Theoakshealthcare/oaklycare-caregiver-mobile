# SOP: Admin console, booking policy screen and cancellation terms on the booking detail

| | |
|---|---|
| **What shipped** | `apps/admin`: **(1)** a "Cancellation terms" card on the booking detail from the backend's new `cancel_terms`; **(2)** a Booking policy screen (`/settings/booking-policy`) that shows every policy value and lets an admin with `settings.write` edit the short-visit threshold (`short_visit_min_percent`, backend #48) with a reason. |
| **Branch** | `feat/admin-booking-policy-short-visit`, cut from `oakly/main` `e24f43d`. Not pushed; the lead pushes. **Depends on the backend branch `fix/arrived-errors-admin-cancel-terms`** (the regenerated API types include `cancel_terms`): open this PR stacked on it or after it merges. |
| **API** | `GET /admin/bookings/{id}` (`cancel_terms`), `GET` and `PATCH /admin/booking-policy`. Types regenerated with `OAKLY_BACKEND_DIR=../wt-be-small pnpm api:sync` (`packages/api-client/openapi.json`, `src/schema.d.ts`). |

## Why
- The booking detail could not say what the family would pay to cancel or what they paid; the cancel dialog's estimate came from the live policy and warned that the booking "may have been quoted different terms".
- Backend #48 made the short-visit threshold an admin policy field, but the console had no policy screen at all, so the only way to change it was the API.

## How (decisions)
| Decision | Why |
|---|---|
| The card reads the server's `cancel_terms` and does no tier arithmetic (`lib/cancel-terms.ts` only words it) | One source of truth with the family's own quote |
| It says where the terms come from ("Saved on this booking" or "The current booking policy (nothing is saved on this booking yet)") | App bookings store no snapshot until the family cancels; a null snapshot is normal, not an error |
| Policy screen: all values shown, **only the short-visit threshold editable** | What was asked; the other fields move cancellation and money rules and each deserves its own review. The edit goes through the shared `ConfirmActionDialog` (reason required, audit entry on the server, error kept in the dialog) |
| Client validation: a whole number 0 to 100 (`parsePercent`) | Mirrors the server rule (guide 12.9); the server's message is still shown if it refuses |
| Nav item under Admin, visible with `bookings.read`; the Edit button needs `settings.write` | Same split as the backend: Support can read the policy, Operations and Super Admin can change it |
| The policy query shares the cancel dialog's key (`["bookings","policy"]`), so a save refreshes the dialog's estimate | No stale second copy |
| The cancel dialog is left alone | Its estimate still works; replacing it with `would_apply_now` is a follow-up so the money dialog is not changed in a UI slice |

## What's involved
| Path | Change |
|---|---|
| `apps/admin/src/app/(console)/bookings/booking-detail.tsx` | `CancelTermsCard` |
| `apps/admin/src/lib/cancel-terms.ts` (new) | wording for the terms |
| `apps/admin/src/app/(console)/settings/booking-policy/{page,booking-policy}.tsx` (new) | the screen and the threshold dialog |
| `apps/admin/src/lib/booking-policy.ts` (new), `lib/nav.ts`, `lib/bookings.ts` | data layer, nav item, `CancelTerms` type |
| `apps/admin/src/test/booking-fixtures.ts` | `cancel_terms` in `makeDetail` (values copied from backend captures `admin/803`, `805`, `806`) |
| `packages/api-client/{openapi.json,src/schema.d.ts}` | regenerated from the backend branch |

## Verification
| Check | Result |
|---|---|
| Admin tests | 27 files, 341 tests pass (`pnpm --filter admin test`): the card (live-policy late tier, applied tier from a snapshot, unpaid) and the policy screen (values, read-only without `settings.write`, save sends `{reason, short_visit_min_percent}`, 101 / 4.5 / text / empty are not savable, server refusal keeps the dialog, load error) |
| Gates | `pnpm install --frozen-lockfile`, `pnpm typecheck` (all three apps), `pnpm lint`, `pnpm --filter admin build` pass; the API client regenerates identically. The caregiver and patient Jest suites were not run (nothing in them changed; CI runs them) |
| **Not verified** | **No browser pass** against a running backend and console: only unit tests with fixtures copied from live captures. No screenshot was taken |

## Operate / roll back
Revert the commit; the console reads the backend field only when present in the type, but a console built from this branch against an older backend would show a broken card (`cancel_terms` missing), so deploy the backend first.

## Follow-ups
1. Live browser pass of the card and the screen (against the local backend with `OAKLY_API_ORIGIN=http://127.0.0.1:8001 npx next dev --port 3001`).
2. Use `would_apply_now` in the cancel dialog and drop the "may have been quoted different terms" line.
3. Edit the other policy fields (each with its own copy of the server rules).
