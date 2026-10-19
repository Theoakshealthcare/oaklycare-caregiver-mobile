# Admin console: bookings operations (A2) — design and plan

Contract: backend `docs/fe-integration-guide-admin.md` section 12 (captures 079–118 under `backend/docs/fe-captures/admin/`).
PRD: `backend/docs/prd/PRD-admin-console.md` §7.4 (AD-FR-19 to 26). Pattern to copy: the payouts screens (`apps/admin`, PRs #3/#5).

## Intent

Ops staff need to find any booking, see everything that happened to it, and step in: re-dispatch, assign, reassign,
cancel (with a refund choice), confirm a WhatsApp booking's address, flag a no-show, and (Super Admin) correct a stuck
status. The PRD's success measure: no paid booking sits unmatched for 2 hours without an owner (G2).

Anti-goals: a button the API will refuse; an admin cancelling and believing money moved; a clinical reader generating
audit entries by the page polling in the background.

## Screens

| Route | Component | Guard (page) | Nav |
|---|---|---|---|
| `/bookings` | `BookingsList` | `bookings.read` | Bookings → Bookings (`bookings.read`) |
| `/bookings/[id]` | `BookingView` | `bookings.read` | — |
| `/queues/unmatched` | `UnmatchedQueue` | `bookings.read` | Queues → Unmatched (`bookings.dispatch` / `bookings.assign` / `bookings.address`) |

**List** (AD-FR-19): search box (`q`, submit on Enter/button; hint that name/phone search needs `people.pii`), selects for
status, payment status, channel, dispatch state; city text; scheduled from/to date inputs (WAT days); two checkboxes
"Needs address check" and "No-show (flagged or suspected)". Every filter change resets `offset`. Table columns: code
(link to detail), scheduled (WAT), service, city, patient (masked marker), caregiver, status, payment, total (₦), channel,
age; row flags as text badges (address check, refund requested, no-show). Pager, `PAGE_SIZE` 25.

**Detail** (AD-FR-20): header with code, status badge, channel, created/age; action bar from `available_actions` only;
cards: Visit (service, assistance, schedule, duration, actual start/end), People (patient, caregiver, masked note),
Address (line + coordinates only when `visible`; otherwise "Area only: you need bookings.address"; held-address
warning), Clinical (text only when unmasked; otherwise "Recorded, hidden: needs clinical.read"), Price & payment
(total/service/platform fee, payment status, Paystack ref, refund requested + amount + reason code, attempts), Dispatch
(state, started, waves, offers with responses), Timeline (oldest first, kind, title, actor, detail).
404 → error state with the server's "Booking not found".

**Unmatched queue** (AD-FR-21): reason filter (all / address check / unmatched / SLA breached), rows sorted as returned
(soonest visit first) showing reason badge, waiting minutes, scheduled time, patient, city, total, and an "Open" link to
the detail where the actions live.

## Actions (all from the detail page)

Shown exactly when `available_actions` contains them (guide 12.4 says do not hard-code the permission table). Every
dialog uses `ConfirmActionDialog` (reason required, server error shown verbatim, dialog stays open). After success or
failure the detail is refetched (a `409` means someone else changed it).

| Action | Dialog content and consequence text |
|---|---|
| Re-dispatch | optional radius km (1–100), "also offer to caregivers already notified". Result `notified_caregivers: 0` → notice "No one available", not an error. |
| Assign | candidate list (fetched on open, optional radius, best match first), radio pick. Default = offer: "stays pending until they accept in the app; refresh to see it". `force_assign` present → checkbox "Assign now without their accept" with its consequence (accepted at once, visit code made, other offers closed). |
| Reassign | candidate picker (current caregiver excluded); consequence: new caregiver assigned directly, old one told, status back to accepted, no-show flag cleared, visit code kept. |
| Cancel | reason code select, refund choice radios (nothing preselected; unpaid → only "No refund"), partial amount in ₦ (> 0, < amount paid). **Policy guide**: tier + fee + suggested refund computed from the live booking policy and the visit time, with a "Use this" button; labelled as an estimate (the booking keeps the terms it was quoted, which the console cannot see). Consequences: "Cancelling does not refund: it requests a refund for Finance"; refund none → "the patient is NOT messaged; contact them yourself"; accepted caregiver is notified. Irreversible. |
| Confirm address | latitude, longitude (client range check 3.5–14 / 2.5–15, swapped-pair hint), optional street address; consequence: clears the hold and starts dispatch immediately (paid) or only clears the flag (unpaid). |
| Flag no-show | reason; consequence: records the flag only, then reassign or cancel. |
| Correct status | target select, forward-only from current status; consequence: sets start/end timestamps like the caregiver's own; completing credits the caregiver's earning and cannot be undone. |

## Decisions (my calls, for the owner to check)

1. **Gating = `available_actions`**, plus the page guard `bookings.read`. Force-assign checkbox only with `force_assign`.
2. **Detail is never polled or refetched on focus** (`refetchOnWindowFocus: false`, no interval): each fetch by a
   `clinical.read` admin is an audit entry. A manual "Refresh" button instead (needed to see an offer being accepted).
3. **Cancel policy guide is an estimate from the live policy**; the backend's admin cancel never applies the fee itself, the
   admin chooses. En-route bookings are shown as "late tier if the caregiver's on-my-way tap qualifies". Follow-up for the
   backend: expose the booking's own cancel terms on the detail.
4. Unmatched nav entry visible to admins who can act on it; readers can still open the URL.
5. Date filters are WAT calendar days sent as naive UTC (`2026-10-09T23:00:00`), matching the backend's naive timestamps.
6. Filters live in component state (as payouts), not the URL.

## Non-goals

Booking-policy editing screen (12.9), audit log screen, attention panel on Overview, CSV export, contact-patient link.

## Plan (TDD, one commit per task)

1. `lib/bookings.ts` (+test): types from `Schemas`, permission constants, fetchers for list/unmatched/detail/candidates/
   policy and the seven actions, `BOOKINGS_KEY` + invalidate, `cancelEstimate(detail, policy, now)`,
   `correctionTargets(status)`, WAT day → naive UTC helpers, naira→kobo parse. Fixtures in `test/booking-fixtures.ts`
   copied from captures 079/083/085/087/088/089/090/093/096–117.
2. Nav + routes: enable Bookings and Unmatched in `nav.ts` (+ side-nav test), page files with guards.
3. `BookingsList` screen + test (filters build the right query, masked marker, pager, empty/error).
4. `UnmatchedQueue` screen + test.
5. `BookingView` detail + test (cards, masking states, timeline, 404, no focus refetch, only listed actions render).
6. `booking-actions.tsx` dialogs + tests (each action's body, consequences, 409 verbatim, refetch, force gating,
   cancel estimate and refund validation, confirm-address range check, correction targets).
7. SOP `docs/sop/2026-10-19-admin-bookings-ops-console.md`, checklist, ledger; full CI mirror.
