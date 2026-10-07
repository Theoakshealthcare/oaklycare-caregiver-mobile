# SOP: On my way window and caregiver drop-out

| | |
|---|---|
| **Date** | 2026-10-07 |
| **Branch** | `feat/caregiver-dropout-onmyway` (from monorepo `main` `f04bcdf`). Not pushed. |
| **Depends on** | Backend PR from `feat/whatsapp-dropout-redispatch-fee-tiers` (SOP `2026-10-07-dropout-redispatch-and-fee-tiers.md`). **Merge this branch only after that backend PR is merged and deployed.** |

## What shipped
- API client re-synced from the drop-out backend branch (`packages/api-client/openapi.json`, `src/schema.d.ts`).
- Visit flow: **On my way** is disabled before the window with a hint showing when it unlocks; the too-early 409 has a friendly message.
- A **"I can't make this visit"** button on the first visit step (the app had no caregiver cancel UI before), with neutral confirmation copy, which sends `cancel`.

## Why
The backend now refuses `on_my_way` earlier than `onmyway_compensation_window_minutes` before the start (409, all bookings), and a caregiver cancel of a WhatsApp booking reopens it as `pending` for re-dispatch instead of ending it. The app must not offer a button the server will refuse, and must not promise the family a refund.

## How
| Decision | Choice |
|---|---|
| 409 mapping | `src/api/errors.ts`: full-sentence regex for `You can mark yourself on the way from <N hours\|minutes> before the visit` (the span follows the policy, so a pure exact match on "2 hours" would miss an edited policy); any other wording falls through to the server text. Result: "You can mark yourself on the way from 2 hours before the visit." |
| Window | `ON_MY_WAY_WINDOW_MINUTES = 120` in `src/visit/visitFlow.ts` (the policy is not in any caregiver response). Server stays authoritative: if an admin changes the policy the 409 message still shows the right span. Button state is re-evaluated every 15 s. |
| Cancel copy | "We'll let the family know and find another professional." No refund or fee wording (a test forbids it). |
| After cancel | `useBookingAction` already invalidates lists, the booking and home on settle; the dropped booking is no longer the caregiver's, so it leaves their lists. The screen then goes Home. Cancel response status (`pending`) is not shown. |

## What's involved
- `src/api/errors.ts`, `src/visit/visitFlow.ts`, `src/services/booking.service.ts` (`cancel` added to `VisitAction`), `src/screens/visit/VisitSteps.tsx` (`OnMyWayStep`), `src/screens/visit/VisitFlow.tsx`.
- Schema drift fixes after the sync (the committed spec predated the account-erasure and WhatsApp work): `email` and `patient_address` are now nullable. `src/navigation/gate.ts`, `src/screens/booking/BookingDetails.tsx`.
- Tests in `apps/caregiver/__tests__/visit.test.tsx`.

## Verification
CI reproduced locally: frozen install, `api:generate` (no diff after commit), typecheck, lint, `pnpm test` (21 suites, 245 tests passed), admin build. Tests cover the 409 mapping, button disabled then enabled with fake timers (and the code entry staying available), the cancel copy, and the invalidation after a cancel. **Not exercised against a running backend or a device** (no simulator by instruction).

## Operate / roll back
Revert the branch. Do not deploy before the backend change: before it, `cancel` ends the booking rather than reopening it, and the copy would then be inaccurate.

## Follow-ups
- Read the unlock time from the policy if the backend ever exposes it.
- Drop-out is only offered while the booking is `accepted`; an `en_route` caregiver cannot cancel from the app (the code step), by design for now.
- Confirm with product that a visible cancel button for the caregiver is wanted.
