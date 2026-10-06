# Plan: Caregiver app (Phase C)

| | |
|---|---|
| **Date** | 2026-10-05 |
| **Goal** | Nurses and caregivers can sign up, get approved, go available, receive job offers by push, accept them, and run the visit. That is the supply side matching needs. |
| **Repos** | This monorepo (`apps/caregiver`, `packages/*`) and the backend repo (C3) |
| **Context** | Backend PRDs: `backend/docs/prd/PRD-whatsapp-patient-channel.md` (§6 P3, WA-FR-28..37) and `PRD-admin-console.md`. Backend Phase 0 is merged; SOPs are in `backend/docs/sop/`. Patients book through WhatsApp; this app is for providers only. |

## Ground rules
- **One branch and one PR per work package.** Write the PR body and every commit message with **no AI attribution**: no `Co-Authored-By`, no "Generated with".
- **Reproduce CI locally before pushing:**
  - `pnpm install --frozen-lockfile`
  - the API-client drift check
  - `pnpm typecheck`
  - `pnpm test`

  The backend has its own four checks; see its README.
- **Call the backend only through `@oakly/api-client`.** No hand-written `fetch` calls or hand-copied types. When a backend change lands, run `pnpm api:sync` and commit the snapshot.
- **Use one React and one React Native version** across the repo.
- **Native config lives in `app.json` and config plugins.** `android/` and `ios/` are generated, never committed.
- **Verify on the iOS Simulator** for UI work. Take screenshots of the key screens and put them in the PR.
- **Write an SOP** in `docs/sop/` for each package. Tick the items in the backend repo's `docs/checklist/MASTER_CHECKLIST.md`, which is the single checklist for all repos.

## C0: Monorepo scaffold ✅ (branch `chore/monorepo`)
- pnpm workspace (`apps/*`, `packages/*`); the app has moved to `apps/caregiver` with its history kept.
- `packages/api-client`, which contains:
  - `openapi.json` snapshot and generated `schema.d.ts`;
  - `createOaklyClient`, which adds the bearer token and refreshes once on a 401;
  - `errorMessage`;
  - 5 tests.
- Root `tsconfig.base.json`, CI (install, API drift check, typecheck, test), README.
- `.env` is no longer tracked. There's an `.env.example`. Signing files and native directories are ignored.

## C1: Expo SDK 57 upgrade and cleanup (branch `chore/caregiver-sdk57`)
1. **Upgrade.**
   - Target SDK 53 → **57** (RN 0.86, React 19.2, TypeScript ~6.0). With no users and no store release, go straight to 57; there's no need to step through each SDK.
   - Run `npx expo install expo@^57 --fix` and `npx expo-doctor`.
   - Configure pnpm `onlyBuiltDependencies` for packages that need install scripts.
2. **Continuous Native Generation.**
   - Delete the committed `android/` and `ios/`.
   - Move every native setting into `app.json`: bundle id and package (`com.oakly.oaklycaregiver`), display name, icons, splash, permissions.
   - `expo prebuild --clean` must reproduce them.
   - `debug.keystore` stays out of git.
3. **Remove unused dependencies.** Remove `axios`, `@react-navigation/bottom-tabs`, `@react-navigation/elements`, `expo-router` and its plugin, `expo-blur`, `expo-haptics`, `expo-symbols`, `expo-web-browser`, `react-native-webview`, `react-native-web` and `react-dom` (unless web stays), plus any other dependency nothing imports. Keep `expo-location` and `expo-notifications`; they're needed in C4.
4. **Replace and remove broken code.**
   - Replace `expo-av` with `expo-audio`, used by the AI note recorder.
   - Delete dead code: `AuthNavigator` (it imports a package that isn't installed), the root `hooks/` template leftovers, unused UI components, the duplicate `storage.service.ts`.
5. **Storage.** Tokens move to **`expo-secure-store`**; the hardcoded MMKV encryption key is gone. Non-secret UI state may stay in MMKV v4 (Nitro) or AsyncStorage.
6. **Tooling.**
   - Add `typecheck` (`tsc --noEmit`), `lint` (`expo lint`) and `test` (jest-expo, a smoke test that renders `App`) scripts, so CI covers the app.
   - Fix the type errors the upgrade surfaces. Don't paper over them with `any`.
7. **Acceptance:**
   - `expo-doctor` is clean.
   - The app builds and launches on the iOS Simulator and shows onboarding.
   - Typecheck, lint and test pass, and CI covers the app.

## C3: Backend support for the app (backend repo, branch `feat/caregiver-mobile-support`). Runs in parallel with C1.
1. **Push tokens.**
   - New table `push_tokens`: `user_id`, `token` (Expo push token), `platform`, `created_at`, `last_seen_at`, unique `token`.
   - Endpoints: `POST /api/v1/devices/push-token` (register or refresh) and `DELETE /api/v1/devices/push-token`.
   - New `PushService` sends through the Expo Push API (`https://exp.host/--/api/v2/push/send`) using `httpx` with a timeout. It sends in batches, removes tokens that come back `DeviceNotRegistered`, and is mocked in tests.
2. **Job offers by push.** When a dispatch wave notifies caregivers, push "New visit request" with only the booking ID and the area/time: no patient name, no condition. Send after commit, best effort; a failure is logged and doesn't affect dispatch.
3. **Availability.** Add `POST /api/v1/caregiver/availability` `{is_available}` (approved caregivers only), or document that the existing `POST /booking/caregiver/location` with `is_available` is the contract. Pick one and test it. Going unavailable must stop new offers. Accepted bookings are unaffected.
4. **Visit lifecycle** (WA-FR-34/35). These are backend-only today:
   - Add `en_route` to the booking flow (`accepted → en_route → in_progress`) via a new caregiver action `on_my_way`, keeping the client enum change minimal.
   - At accept time, generate a 4-digit **visit code**. Store only its hash. It will be sent to the booker over WhatsApp later; for now the patient-facing `GET /booking/booking/{id}` returns it to the patient only.
   - The `start` action requires the code: 3 wrong attempts lock it for 15 minutes.
5. **Caregiver home summary.** `GET /api/v1/caregiver/home` returns:
   - profile status;
   - availability;
   - today's and upcoming visits;
   - open offers;
   - wallet balance in naira.

   This is one call for the home screen, which is all mocked today.
6. **FE integration guide (required).** Write `docs/fe-integration-guide-caregiver.md`. Every request and response body, status code and error string in it must be **captured from the running app**: docker compose stack plus a scripted end-to-end run, with the captures committed under `docs/fe-captures/caregiver/`. Cover:
   - auth (register, verify, login, refresh, me);
   - onboarding (step 1, step 2, document upload, consent, verification status with `rejection_reason` and `changes_requested`);
   - availability and location (REST and the WebSocket close codes 4401/4403);
   - push token;
   - offers and bookings: list, detail, accept, decline, on-my-way, start with code, complete, cancel, each with its 403/409 bodies;
   - home summary;
   - wallet and withdrawal.

   Anything that couldn't run live (the real Expo push delivery) is marked inline. Field-nesting traps, state machines, polling cadence and UX consequences are written out, and the guide ends with a verification table.
7. One Alembic migration on top of `0001_baseline`.
8. **An Opus review is required** (auth, push, the visit code).

## C2: Core flows on the typed client (after C1; uses C3 where available)
- **Data layer.** Add `@tanstack/react-query` and an `api` instance from `createOaklyClient`. `onUnauthorized` calls `/auth/refresh` with the stored refresh token, and signs the user out on failure.
- **Auth.**
  - Restore the session on launch: an auth gate decides between onboarding, login and the app.
  - Fix login navigation.
  - Register, then verify email with the right payloads.
  - Password recovery and reset.
  - Logout clears secure storage.
- **Onboarding.**
  - Step 1 sends `address` (not `house_address`).
  - Step 2.
  - Document upload uses real `FormData`, so the multipart boundary is set.
  - Consent.
  - The verification-status screen shows `under_review`, `changes_requested` (with the items to fix and a resubmit action), `rejected` (with the reason), `approved` and `suspended`.
  - The fake identity-scan "success" is removed. Identity is now decided by an admin.
- **Bookings.**
  - Offers and lists use `dispatch_state` and status.
  - Booking detail, accept and decline.
  - The 403 and 409 responses are mapped to clear messages ("This job was taken by someone else", "You're not approved yet").
  - Register the screens that exist but aren't reachable: BookingDetails, chat, notes.
- **Tests.** Jest tests for the auth state machine and the API error mapping.

## C4: Supply features (after C2 and C3)
- **Availability toggle** on home, backed by the backend.
- **Location.**
  - While available: foreground location, sent at most every 60 s and whenever the caregiver moves more than 100 m.
  - During an active visit: background location (`expo-location` + `expo-task-manager`), sent to `POST /booking/caregiver/location`.
  - Permissions explained before the OS prompt.
  - Stops when unavailable or after check-out.
- **Push.**
  - Register the Expo push token after login, and again when it changes.
  - Tapping a job-offer notification opens the offer.
  - Foreground notifications show an in-app banner.
- **Visit flow:** accept → on my way → enter the visit code (start) → complete. Each step is a clear screen.
- **Home screen** runs on `GET /caregiver/home`, replacing every hardcoded value.
- **Simulator verification** of the whole path against a local backend, with a seeded approved caregiver and a paid booking.

## Order and parallelism
1. C0 (done).
2. **C1 and C3 in parallel**: different repos, no overlap.
3. C2, after C1 merges.
4. C4, after C2 and C3 merge.
