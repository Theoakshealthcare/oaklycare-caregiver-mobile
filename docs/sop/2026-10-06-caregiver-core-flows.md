# SOP: Caregiver core flows on the typed client (C2)

| | |
|---|---|
| **Date** | 2026-10-06 |
| **Branch** | `feat/caregiver-core-flows` |
| **Plan** | [Caregiver app plan](../plans/2026-10-05-caregiver-app.md), C2 |
| **Backend contract** | Backend `docs/fe-integration-guide-caregiver.md` (C3, merged at 06dfb75) |

## What shipped
Every network call in `apps/caregiver` now goes through one `@oakly/api-client` instance with `@tanstack/react-query` on top. The app has an auth gate (session restore, then `/auth/me` and `profile_status` decide the screen), working register / verify / login / recovery, onboarding that matches the backend payloads, a verification-status screen for every `profile_status`, and bookings with accept / decline and mapped errors. The old hand-written `services/api.ts`, the zustand auth store and the hand-copied types are gone.

## Why
The old app called the backend with a fetch wrapper and copied types, and most flows were broken against the real API: login never navigated (`ForgotPassword` and `checkAndRedirect` pointed nowhere), step 1 sent `house_address` (backend wants `address`), the document upload JSON-stringified the `FormData`, identity "verification" used Onfido-style endpoints that no longer exist and a fake success, and BookingDetails / chat / notes were unreachable.

## How
| Decision | Choice | Why |
|---|---|---|
| Base URL | `EXPO_PUBLIC_API_URL` is the **origin only** (`http://localhost:8000`) | Generated paths already start with `/api/v1`. `.env.example` updated. |
| Session | `src/auth/session.ts`: pure state machine (`restoring`, `signedOut`, `signedIn`) over an injectable `TokenStorage`; tokens in `expo-secure-store` | Testable without native modules. Auth state is tokens only; the user and status come from queries. |
| Refresh | `session.refresh()` is single-flight; `api` passes it as `onUnauthorized`. A server 4xx on `/auth/refresh` signs out; a network error or 5xx does **not** | Signing a caregiver out because they went through a tunnel is wrong. A rejected token is final. |
| Gate | `src/navigation/gate.ts` `resolveGate()` (pure) plus conditional navigators in `StackNavigator.tsx` | Screens are only registered when reachable; the navigator re-keys on a gate change, so no manual `navigate` after login or consent. |
| Errors | `ApiError` (status 0 = offline) and `messageForError(err, context)` | Accept 409 "taken by another caregiver", accept 403 "profile isn't approved yet", "not offered" and unpaid variants, login 401, 429, 5xx. Matches `detail` strings exactly, never by prefix. |
| Untyped responses | `verification-status`, `form-options` and the action response are free-form objects in the OpenAPI schema; they are narrowed at the service boundary (`parseVerificationStatus` etc.) from the guide's captures | Only these three are hand-shaped. An unknown `profile_status` throws and shows a retry, it is not guessed. |
| Offers | UI is built from a narrow `Offer` type (`toOffer`), never a `Booking`. The offer detail screen fetches nothing (an un-accepted booking answers 403) | Patient identity cannot reach an offer screen even if the server's offer view leaked a field. |
| Upload | `FormData` with a `{ uri, name, type }` file part through `bodySerializer`; no `Content-Type` header | fetch sets the multipart boundary. |
| Identity | `IdentityVerification`, `DocumentScan`, `ProfileCompleted` deleted; initiate / complete calls removed | Identity is an admin decision now. |
| Chat | The dead WebSocket hook (`/api/v1/ws/{token}` does not exist) was removed; chat polls `GET .../chat/{id}/messages` every 5 s | Only the location WebSocket exists in the contract (C4). |

## What's involved
- **Data layer:** `src/api/{client,config,errors,unwrap,keys,queryClient}.ts`, `src/auth/{session,secureStorage,index}.ts`, `src/hooks/{queries,useOfferActions}.ts`, `src/services/{auth,caregiver,booking}.service.ts`, `src/utils/dates.ts` (backend timestamps are UTC **without** a `Z`).
- **Navigation:** `src/navigation/{gate.ts,StackNavigator.tsx,Navigations.tsx}`; `App.tsx` (QueryClientProvider), `MainApp.tsx` (restore on launch, fake 2 s splash removed).
- **Screens:** auth (`Login`, `CreateAccount` now asks email, optional phone, `VerifyEmail`, `AccountCreated`, `RecoverPassword`, `ResetPassword` now takes the emailed code), setup (`Step1`, `Step2`, `ConsentScreen`, new `VerificationStatus`), bookings (`CaregiverBookings`, `BookingDetails`, new `components/booking/OfferCard`), chat / call / notes (typed params, query hooks). `Home` only gained sign-out on the avatar (the rest is C4).
- **Registered screens:** `BookingDetails`, `ChatScreen`, `CallScreen`, `AINoteTaker` in the approved stack.
- **Cleanup:** all `any` removed from `src`; `HeaderBack` hides when there is nothing to go back to; the voice-note stub no longer fabricates a transcript.
- **Schema:** `packages/api-client/openapi.json` synced to backend C3 (92 paths: `devices/push-token`, `caregiver/availability`, `caregiver/home`, `dispatch_state`, `en_route`).
- **Logout:** clears secure storage and the query cache. It calls `DELETE /api/v1/devices/push-token` when a token is stored under `oakly.push_token`; nothing writes that key until C4 registers the token (`pushTokenStorage.set`).

## Verification
Run 2026-10-06 from the repo root: `pnpm install --frozen-lockfile`, `pnpm api:generate` then `git diff --exit-code -- packages/api-client/src/schema.d.ts`, `pnpm typecheck`, `pnpm lint` (0 errors; warnings are the C1 React Compiler rules in screens not rewritten), `pnpm test`, `npx expo-doctor` (21/21), `npx expo export --platform ios` (bundles to Hermes bytecode).

Jest (49 tests in `apps/caregiver`, plus the 5 api-client tests):
- `session.test.ts`: restore, unreadable keychain, signIn / signOut persistence, **refresh single-flight** (3 callers, 1 request), sign-out on a rejected refresh, no sign-out when offline, sign-out during a flight wins, and an end-to-end run with the typed client (3 parallel 401s, 1 refresh, all retried with the new token).
- `errors.test.ts`: error to message mapping for every context, `unwrap`.
- `gate.test.ts`: the whole gate decision table, `profile_status` parsing from the guide's captured bodies, status copy.
- `offers.test.tsx`: `toOffer` and `OfferCard` / the New Request tab render **no** patient name, phone, condition, instructions, exact address or coordinates even when the input booking carries decoys; multipart part is the `{ uri, name, type }` object.
- `App.test.tsx`: restore with an empty keychain shows onboarding.

**Not verified:**
- **Simulator / device.** Not run: the Xcode 26.2 build of SDK 57 fails on this machine (see the C1 SOP), so no screen was exercised live and no screenshots exist.
- **Against a running backend.** No request was made to a live server; shapes follow the guide's captures and the generated types.
- Document upload on a real device (RN multipart and the one-retry-after-401 path with a `FormData` body).
- Email OTP delivery, password-recovery token format (the guide does not cover recovery; the screen asks for the emailed code and sends it as `token`), and whether `login/mobile` accepts an unverified email (the gate handles both outcomes).
- `suspended` status (not captured live in the guide).

## Operate / roll back
- Set `EXPO_PUBLIC_API_URL` to the backend origin with **no** `/api/v1` (LAN IP on a physical device).
- Refresh the contract with `OAKLY_BACKEND_DIR=../backend pnpm api:sync`.
- Roll back by reverting the branch; no native config or migrations changed (adds `@tanstack/react-query` 5.104.1, exact pin).

## Follow-ups
- **Backend schema gaps:** type `GET /caregiver/verification-status`, `GET /caregiver/form-options` and the booking action response so the three narrowings can be deleted.
- No endpoint lists uploaded documents, so step 2 cannot show what was already uploaded after a relaunch and does not force an upload.
- Password-recovery contract needs a captured guide section; the reset-code UX is a guess.
- AI voice notes: no audio upload or transcription endpoint; recording is disabled in effect.
- Still warnings, not errors: `react-hooks/refs` in `onboarding-screen`, `set-state-in-effect` in `AINoteTaker`, unused imports in old UI components.
- C4: availability, location, push registration (then write `pushTokenStorage`), home summary, visit flow (on my way, visit code, complete).

## Addendum: review fixes (2026-10-06)
An Opus review returned approve-with-fixes. Fixed:
- **`@oakly/api-client` retried a 401 request by rebuilding it from the request that had already been sent.** `fetch` consumes the body, so any request with a body threw "Already read" once a token expired: accept, decline, profile saves, consent, upload and the push-token delete. Fix: an unread clone is kept for each authenticated request and the retry is built from it. Test: a POST with a body is retried after a refresh, against a `fetch` that consumes the body.
- **A refresh that finished after a sign-out, or after a different user signed in, could overwrite or sign out the new session.** Fix: the result is applied only if the session still holds the tokens that started that refresh. Tests: two race cases.
- **Sign-out on refresh failure is now 401-only.** A 429, a 422 or an outage keeps the session.

**Known:** Jest sometimes reports that a worker "failed to exit gracefully" during a full parallel run. No single test file leaks (each was checked on its own), so it is worker teardown noise. Revisit if a test starts hanging.
