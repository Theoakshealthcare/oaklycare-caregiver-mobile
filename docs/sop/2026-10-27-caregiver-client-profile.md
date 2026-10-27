# SOP: Caregiver Client profile screen

| | |
|---|---|
| **Date** | 2026-10-27 |
| **Branch / PR** | `feat/caregiver-client-profile`, **stacked on `feat/caregiver-vitals`** (891f7be; it reuses `src/vitals/vitalsModel.ts` and the `BottomNavigation` tab list). Retarget to `main` after the Vitals PR merges. |
| **Depends on** | Backend `GET /api/v1/caregiver/bookings/{booking_id}/client` (backend branch `feat/caregiver-client-profile`, which carries the vitals 500 fix). Contract: backend `docs/fe-integration-guide-caregiver.md`, section 7 "Client profile" (captures 190-195). Design: Figma `8.20.01`, `8.20.26`. |

## What shipped
A **Client profile** screen, opened from "Client profile" on Job details while the visit is accepted, on the way or in progress: avatar or initial, name, age and sex, booking code, **Latest vitals** (View all opens the Vitals tab), **Medical history** (only what is stored), **Emergency contact** with a call button, and **Add notes**.

## Why
Gap analysis section 5: the caregiver saw the client only as booking details. The design's profile needs the caregiver-scoped endpoint above.

## How
| Decision | Choice |
|---|---|
| Entry | A button on `BookingDetails` for `accepted`, `en_route`, `in_progress` only (the backend refuses anything else). Route param `{ bookingId, bookingCode }`; the code comes from the booking already loaded. |
| `404` | "Client details aren't available" (not an error with a retry): the visit ended, moved or was never theirs. Other failures get the standard error and retry. |
| `latest_vitals` | `null` = "Vitals are available during an active visit." `[]` = "No readings recorded yet." Otherwise the newest reading of each known vital, neutral (no status chips; same rule as the Vitals tab). Unknown types are left out. |
| Someone else's visit | `booking_for` other than `myself` (compared case-insensitively: the patient app sends `Myself`) shows "Booked by a family member for this client." The backend already swaps in the relative's name and hides the booker's history. |
| Left out | **Care Plan** section (care plans are not built), the **FallGuards** button (no data source), the design's "Stable" tag and the placeholder amounts next to medical history (a design leftover). |
| Data | Responses live in the in-memory query cache only (`gcTime` 2 minutes, cleared on sign-out); nothing is logged or written to disk. |
| `packages/api-client` | **Surgical spec update, not a full `api:sync`:** only the new path and its five schemas were added to `openapi.json` (the vitals SOP explains why a full sync is left to the refunds console PR: it adds nine admin refunds routes). `pnpm api:generate` is clean against it. After that PR merges, a full `OAKLY_BACKEND_DIR=... pnpm api:sync` will produce the same entries. |

## What's involved
`src/screens/booking/ClientProfile.tsx` (new), `src/services/clients.service.ts` (new), `src/hooks/queries.ts` (`useClientProfile`), `src/api/keys.ts`, `src/navigation/Navigations.tsx` (`ClientProfile` route; `BottomNavigation` tab may now be `vitals`), `StackNavigator.tsx`, `src/screens/booking/BookingDetails.tsx` (button), `packages/api-client/openapi.json` and `src/schema.d.ts`. Tests: `__tests__/clientProfile.test.tsx` (14).

## Verification
Jest (14): loading; name, age and sex, booking code; vitals neutral and unknown types ignored; `null` and `[]` vitals; View all and Add notes navigation; medical history shown; nothing on file; emergency contact call (`tel:`); booked for someone else; capitalised `Myself`; 404 state; retry; the Job details button for a live visit and none for a completed one. Fixtures follow the live captures 190-192 (placeholder data). Full local CI: see the report. **Not verified:** on a device or simulator, or against a running backend (the shape was captured on the backend test harness).

## Operate / roll back
Pure app change; revert the PR. The button just disappears.

## Follow-ups
- Care plan summary once care plans exist; FallGuard entry once there is an incident source.
- Visual pass on a device (card layout, avatar image).
- Retarget the PR after the Vitals PR merges; run a full `api:sync` after the refunds console PR.
