# SOP: the push-token listener re-registered the device about 12 times a second

| | |
|---|---|
| **What shipped** | Both apps no longer loop on `POST /api/v1/devices/push-token`. The OS "token changed" listener now answers with the token the event carries and never asks the OS for one, duplicate registrations are coalesced, and an unchanged Expo token is not re-sent. |
| **Branch / PR** | `fix/push-token-loop`, monorepo PR (see the PR for the number). |
| **Reported by** | The owner's phone test of the staging APK (2026-11-23): sign-up steps waited 60-300 s. nginx on the VPS counted 11,675 of 11,770 requests (14:10-14:26 WAT) as `POST /api/v1/devices/push-token`. |
| **Not verified** | **On a real device with a new APK.** The loop is reproduced in a Jest test (the old code never settles) and the cause is documented by `expo-notifications` itself, but Android's real event timing was not run. |

## Why
`addPushTokenListener` fired `registerForPush`, which calls `getExpoPushTokenAsync`, which calls `getDevicePushTokenAsync`. `expo-notifications` documents that calling `getDevicePushTokenAsync` inside the listener "triggers the listener and may lead to an infinite loop". On the phone that was about 12 registrations a second until the app was closed. Each one is an API request, so the single staging API worker was kept busy and also recycled itself every ~80 s (`--max-requests`), which made the real sign-up requests stall (see backend `2026-11-23-staging-api-workers.md`).

## How
| Decision | Reason |
|---|---|
| The listener (`onDevicePushToken`) passes the event's native token to `getExpoPushTokenAsync({ projectId, devicePushToken })` | With a token given, Expo does not call `getDevicePushTokenAsync`, so nothing fires the listener again. |
| An event-driven call sends nothing when the Expo token equals the stored one (`status: "unchanged"`) | Even if the OS fires the event again, the second pass ends without a request. A normal call (sign-in) still always POSTs: it heals a token the backend pruned. |
| Single-flight: a call made while one runs joins it | The event our own first request causes arrives while it is still running. |
| Events whose data is not a string are ignored | Nothing safe to answer with; asking the OS would re-open the loop. |
| Same logic in both apps (`registration.ts` is a copy) | The patient app had the identical listener. |

## What's involved
`apps/{caregiver,patient}/src/push/registration.ts` (options, single-flight, `unchanged`), `apps/{caregiver,patient}/src/push/native.ts` (`onDevicePushToken`, `devicePushToken` passed to Expo). Tests: `apps/caregiver/__tests__/push.test.ts`, `apps/patient/__tests__/push.test.tsx` (an OS that fires the listener on every token request ends after one POST; an event for an already-registered token sends nothing; a changed token registers and forgets the old one; three simultaneous calls make one).

## Verification
- Jest for the touched files (caregiver `push` + `pushNative`: 34 passed before the last tidy, `push.test.ts` 25 passed after; patient `push.test.tsx` 9 passed), `tsc --noEmit` in both apps clean, ESLint on the touched files with no errors. CI runs the rest.
- The loop test hangs forever on the old code (it is the loop), and passes on the new.
- **After a new APK is installed:** sign up and wait two minutes, then on the VPS `sudo awk '$4 >= "[<today>:<start>" {print $7}' /var/log/nginx/access.log | grep -c push-token` should show a handful of requests, not thousands.

## Operate / roll back
Revert the PR; ship a new preview APK (`eas build --profile preview`). Old APKs keep the bug until replaced: anyone running the 2026-11-22/23 builds should update.

## Follow-ups
- Backend: rate-limit `POST /devices/push-token` per user, and log request timing, so one misbehaving client cannot hold the API (separate backend PR).
- Request timeout and loading states for Resend and code entry (next PR on this list).
