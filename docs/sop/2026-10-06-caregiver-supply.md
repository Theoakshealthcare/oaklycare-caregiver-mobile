# SOP: Caregiver supply features (C4)

| | |
|---|---|
| **Date** | 2026-10-06 |
| **Branch** | `feat/caregiver-supply` (on top of C2, `8bb132c`) |
| **Plan** | [Caregiver app plan](../plans/2026-10-05-caregiver-app.md), C4 |
| **Builds on** | [C2 core flows SOP](2026-10-06-caregiver-core-flows.md): the `api` instance, query hooks, `ApiError` / `messageForError`, the `Offer` type, `pushTokenStorage` |
| **Backend contract** | Backend `docs/fe-integration-guide-caregiver.md`, sections 5 to 9 and 12 to 14 |

## What shipped
An approved caregiver can switch availability on and off, share location while available and during a visit, get job-offer pushes, and run a visit from accept to complete. Home is now driven entirely by `GET /caregiver/home`; every mock value is gone.

| Area | Result |
|---|---|
| Availability | Switch on Home. Going on is location-first: permission, one position, one ping, then `POST /caregiver/availability`. Disabled with a message unless `profile_status` is `approved`. |
| Location | Foreground while available; background during an active visit; both stop when unavailable / after complete. One pure decision function. |
| Push | Expo token registered after sign-in and on token change; offer taps open the offer; foreground offers show an in-app banner and refresh home. |
| Visit flow | `VisitFlow` screen: On my way, visit code (3-attempt lock with countdown), Start, Complete, Done. |
| Home | Greeting, availability, stale-location warning, today / upcoming visits, open offers (offer view only), wallet balance in naira. |

## Why
C2 left Home mocked and had no way to be available, be located, be notified or run a visit, so matching had no supply. This closes the loop the plan's C4 describes.

## How
| Decision | Choice | Why |
|---|---|---|
| Pings and availability | A ping body is built by `buildPing()` and **never** contains `is_available`. Only `POST /caregiver/availability` changes the switch. | Guide section 5: an omitted flag leaves availability unchanged; a first ping creates the record unavailable. **The guide contradicts itself:** section 14.2 says omitting means `true`. Section 5 is the one with a capture (`051`/`052`) and the schema description agrees, so this follows section 5. Backend docs should drop 14.2. |
| Going available | `goAvailable()` (pure, injected deps): permission, position, ping, switch. A failure at any step stops before the switch. | The backend answers `409 Share your location before going available` without a record, and offers need a location newer than 15 min anyway. |
| Tracking decision | `decideTracking()` in `src/supply/tracking.ts`: `off` / `foreground` / `background` from profile status, availability, today's visit statuses and the two OS permissions. | Testable without native modules. A visit makes tracking `background` (falls back to `foreground` without "Always"); available with no visit is `foreground`; otherwise `off`. |
| What counts as a visit | Statuses in home `today_visits` only (accepted, en_route, in_progress). `upcoming_visits` (tomorrow or later) do not start tracking. | The plan says "accepted/en_route/in_progress". Tracking from the moment of accept, days ahead, is battery drain and a privacy cost. An overdue `accepted` visit stays in `today_visits`, so it still tracks until completed or cancelled. |
| Foreground cadence | `watchPositionAsync` (100 m) plus a 60 s heartbeat, both through `shouldSendForeground()`: send if no previous send, 60 s elapsed, or more than 100 m moved. | iOS ignores the watch's time interval, and a caregiver standing still must still refresh `location_updated_at`. A failed send does not count, so the next fix retries at once. |
| Background cadence | `startLocationUpdatesAsync`, 15 s interval (guide: 10 to 15 s), Android foreground-service notification, iOS background indicator. Task logic is in `backgroundLocationTask.ts`; it restores the session if started headless and stops itself when signed out. | Task is defined at module scope and imported from `index.ts` so the OS can run it before React renders. |
| Permissions | `permissions.ts` shows an in-app explanation (`Alert`) before every OS prompt. If the OS will not ask again it points to Settings. Foreground is asked on going available; "Always" on **On my way** (never blocks the visit) or from a Home banner during a visit. | The plan asks for explanation first; asking for "Always" only when a visit starts is the review-friendly moment. |
| Push registration | `registerForPush()` (injected deps): skip on a simulator, without `extra.eas.projectId`, or without permission (dev log, no crash); otherwise `POST /devices/push-token`, store under `oakly.push_token`, and `DELETE` the previous token when it changed. | The POST is an idempotent upsert, so it is repeated each launch / sign-in, which also heals a token the backend pruned. `pushTokenStorage` is the C2 key, confirmed by test (register, then logout sends `DELETE` with that token). |
| Offer from a push | `data.type == "job_offer"` + `booking_id`. The offer view is taken from `open_offers` in a fresh `GET /caregiver/home` (`resolveOffer`), because `GET /booking/booking/{id}` is 403 before accept. If it is gone: "Job no longer available". | The push carries no patient data and an un-accepted booking cannot be fetched. `Offer.assistanceType` became nullable because home offers only have `service_type`. |
| Foreground push | The notification handler suppresses the system banner for job offers; `InAppBanner` shows instead and home / bookings are invalidated. Tap on the banner or a notification (also cold start, via `useLastNotificationResponse`) opens the offer. | Push is a hint, not a guarantee (guide 14.9): home stays the source of truth. |
| Polling | Home: `refetchInterval` 20 s when available or on a visit, 60 s otherwise; refetch when the app returns to the foreground (`focusManager` wired to `AppState`) and on screen focus. Visit booking detail: 20 s. | Guide section 13: 15 to 30 s while available. |
| Visit code | `submitVisitCode()`: refuses locally while locked (the backend would 423 even for the right code), refuses non-4-digit input, maps 400 "N attempts left", 423 + `Retry-After` (fallback 900 s), and the suspension 403. Lock end is kept per booking in memory so leaving the screen does not reset the countdown. | Guide 14.5: tell them the tries left, then the countdown, and not to guess. The caregiver never sees the code. |
| Suspended | `403 Your account is not approved to start visits` on On my way / Start stops the flow with that message ("Contact Oakly support"). Complete from `in_progress` is still allowed. | Guide section 11. |
| Errors | `messageForError(e, "availability")` and `messageForError(e, "visit")` plus `visitCodeFailure()`, `isSuspendedStop()`. `ApiError` now carries `retryAfterSeconds`, read from the `Retry-After` header in `unwrap`. | Backend `detail` strings are matched exactly; only the attempts-left sentence is matched by prefix because the number is inside it (as the guide says). |
| Home model | `homeModel.ts` maps the response (naira formatting, first name, stale location = available and older than 15 min as of the fetch time). Offers are built with `homeOfferToOffer`, the same narrow type C2 uses. | No patient field can reach an offer card. |

Rejected: the WebSocket `/booking/ws/caregiver/location` for pings (REST is enough at these intervals and survives the background task); a global "tracking" store (the decision is derived from home and the permission store each render).

## What's involved
- **New:** `src/supply/{tracking,availabilityFlow,locationService,foregroundTracker,backgroundLocationTask,coords,permissions,permissionState}.ts`, `src/push/{registration,native,openOffer,banner}.ts`, `src/home/homeModel.ts`, `src/visit/visitFlow.ts`, `src/services/push.service.ts`, `src/hooks/useAvailability.ts`, `src/navigation/{AppRuntime.tsx,navigationRef.ts}`, `src/components/booking/InAppBanner.tsx`, `src/screens/visit/{VisitFlow,VisitSteps}.tsx`.
- **Changed:** `src/screens/home/Home.tsx` (rewritten), `src/api/{errors,unwrap,keys,queryClient}.ts`, `src/hooks/queries.ts` (`useCaregiverHome`, `useBookingAction` takes visit actions, `useBooking` poll), `src/services/booking.service.ts` (`VisitAction`, `act(..., visitCode)`, `homeOfferToOffer`, nullable `assistanceType`), `src/navigation/{StackNavigator,Navigations}.tsx` (`VisitFlow` route, `AppRuntime`), `BookingDetails.tsx` ("Open visit steps"), `OfferCard.tsx`, `App.tsx` (navigation ref), `MainApp.tsx` (push registration, notification handler), `index.ts` (imports the background task), `jest.setup.ts` (native module mocks).
- **Dependencies:** `expo-task-manager ~57.0.21`, `expo-device` (via `npx expo install`).
- **Native config:** nothing new was needed in `app.json`. `expo prebuild --clean --platform ios` produced `UIBackgroundModes` with `location` and the three `NSLocation*UsageDescription` strings from the existing `expo-location` plugin config (`isIosBackgroundLocationEnabled`); Android permissions and `isAndroidForegroundServiceEnabled` were already there. `extra.eas.projectId` is **not** set (see Owner actions).
- **API:** `POST /api/v1/caregiver/availability`, `POST /api/v1/booking/caregiver/location`, `GET /api/v1/caregiver/home`, `POST|DELETE /api/v1/devices/push-token`, `POST /api/v1/booking/caregiver/action/{id}` with `on_my_way`, `start` (+ `visit_code`), `complete`. All through `@oakly/api-client`; the schema was already synced (`pnpm api:generate` leaves no diff).

## Verification
Run 2026-10-06 from the repo root: `pnpm install --frozen-lockfile`, `pnpm api:generate` then `git diff --exit-code -- packages/api-client/src/schema.d.ts` (clean), `pnpm typecheck` (strict, no `any` / `ts-ignore`), `pnpm lint` (0 errors; the 23 warnings are the C1 React Compiler ones in untouched screens), `pnpm test`, `cd apps/caregiver && npx expo-doctor` (21/21), `npx expo export --platform ios` (bundles to Hermes bytecode), `npx expo prebuild --clean --platform ios` (succeeds; native output not committed).

Jest: 159 tests in `apps/caregiver` (12 suites) plus the 5 api-client tests.
- `tracking.test.ts`: decision table (off / foreground / background, fallbacks, not approved, no permission, stop after complete), the 60 s / 100 m throttle.
- `locationPings.test.ts`: `is_available` is absent from the ping body built directly, through `locationService`, from the foreground tracker and from the background task executor (which also restores the session and stops itself when signed out); retry after a dropped ping.
- `availability.test.ts`: location-first order, permission refused / no position / ping fails each stop before the switch, 403 and 409 message mapping.
- `home.test.tsx`: `mapHome` against shapes from the guide's captures (091, 073), naira, greeting, stale rule, poll interval, and the Home screen end to end with mocked services: renders from `/caregiver/home`, approval gate disables the switch, stale warning, toggle calls permission, position, ping, availability in that order, mapped 409 alert, no request when permission is refused.
- `push.test.ts` / `pushNative.test.ts`: every skip path (simulator, no `projectId`, permission refused) sends nothing; first registration; unchanged token; token change deletes the old one; failures never throw; `projectId` read from `Constants.expoConfig.extra.eas.projectId`; the token stored by registration is the one logout deletes; `parseJobOffer`; `resolveOffer`.
- `visit.test.tsx`: status to step, code sanitising, every visit error string, the captured wrong, wrong, lock sequence with `Retry-After` and local refusal during the lock, the lock expiring, the suspension stop, and `VisitCodeStep` rendering (input gating, attempts left, ticking countdown).

**Not verified:**
- **Simulator / device.** Xcode 26.2 cannot build SDK 57 (see the C1 SOP), so no screen was run and there are no screenshots. Everything native is exercised only through mocks: real `expo-location` permission dialogs, `startLocationUpdatesAsync` while backgrounded, the Android foreground-service notification, `expo-notifications` taps and cold start.
- **Against a running backend.** No live request; shapes and strings come from the guide's captures and generated types. The 15-minute lock expiry and real Expo push delivery are unverified in the guide too.
- Background location on iOS needs a real build with "Always" granted; battery impact unmeasured.
- Push on a physical device needs an EAS project and APNs / FCM credentials (Owner actions).

## Operate / roll back
- Needs a development build (not Expo Go) for push and background location.
- Without an EAS `projectId` push registration logs `[push] skipped: no EAS projectId ...` in dev and does nothing else.
- Roll back by reverting the branch. No migrations. `expo-task-manager` and `expo-device` are the only new dependencies; reverting removes the `location` background mode from the next prebuild only if the plugin flags are also reverted (they were not changed here).

## Owner actions
1. **EAS project.** Run `eas init` in `apps/caregiver` and commit the `extra.eas.projectId` it writes to `app.json`. Until then push is skipped on every device.
2. **Push credentials.** iOS: an APNs key (EAS can generate and store it, `eas credentials`). Android: an FCM v1 service account key uploaded to EAS, and `google-services.json` referenced from `app.json` (`android.googleServicesFile`). Then test a real push on a physical device: Expo delivery and receipts were never verified (guide section 6).
3. **Backend config.** Confirm the backend's Expo push access token / sender settings if it uses an enhanced-security token.
4. **Background location review notes** (App Store and Play both scrutinise this):
   - Justify it as a core feature: location is shared **only during an accepted visit** (on my way to complete) so the patient and Oakly can confirm arrival; foreground-only otherwise, and only while the caregiver chose to be available.
   - iOS: the usage strings in `app.json` already say this; App Review will want a demo video of a visit showing the explanation screen, the "Always" prompt and the blue background-location indicator.
   - Android: the Play Console **background location declaration** form needs the same justification and a video; the foreground-service type is `location` and the notification reads "Oakly visit in progress". Add a prominent in-app disclosure link in the store listing and privacy policy.
   - Update the privacy policy to say location is collected during visits and while available, and how long it is kept.
5. **Backend doc fix.** Remove the contradicting sentence in guide section 14.2 ("omitting `is_available` means `true`").

## Follow-ups
- Run the whole path on a simulator / device against a local backend with a seeded approved caregiver and a paid booking (the plan's acceptance item); take screenshots for the PR.
- Show the booking `status` transition (and `actual_start_time`) on the in-progress screen; the typed booking does not expose `actual_start_time`.
- `Booking.tsx` tabs (C2) still read the lists directly; they could use `open_offers` from home, and `upcoming_visits` could open the visit flow once due.
- Cancel (allowed from accepted / en_route / in_progress, no reason stored) has no UI yet; the guide asks for a confirmation.
- A failed background ping is dropped silently; there is no in-app indicator that sharing is paused (for example when the OS revokes "Always").
- The lock countdown is held in memory; after an app restart the backend's 423 re-establishes it on the next attempt.
- Jest still reports a worker that "failed to exit gracefully" (same teardown noise as C2; no single file leaks).

## Addendum: review fixes (2026-10-06)
An Opus review returned approve-with-fixes. Fixed:
- **Race: a location watcher could outlive sign-out.** `AppRuntime` applied tracking modes from an un-cancellable async effect. A sign-out, or a quick foreground → background switch, landing during a native `await` could start the foreground watcher *after* cleanup ran, leaving GPS running with nothing able to stop it, and sending pings with the next user's token.
  - **Fix:** `src/supply/trackingController.ts` applies mode changes one at a time and re-checks after every `await` that it's still the latest request. `dispose()` on unmount stops everything.
  - **Tests:** `__tests__/trackingController.test.ts` covers sign-out mid-call, a quick mode switch, and apply after dispose.
- **Background tracking started at `accepted`,** possibly hours before the caregiver left. It now runs only from **On my way (`en_route`) until complete (`in_progress` ends)**, which matches the store-review justification below. An accepted visit is tracked in the foreground only if the caregiver is also available.
- **The background task now stops itself.** Every 5 minutes it re-checks `/caregiver/home` and stops when no visit is en route or in progress, or when the caregiver was suspended. That covers a visit cancelled while the app was closed.
- **Suspension message:** the 403 "Your account is not approved to start visits" is documented in the backend guide ("Suspension during a job"). Its source is the backend tests; the live capture run doesn't cover it.
