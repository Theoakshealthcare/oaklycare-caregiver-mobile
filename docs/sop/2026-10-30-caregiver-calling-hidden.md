# SOP: Caregiver app, call buttons hidden until masked calling exists

| | |
|---|---|
| **Date** | 2026-10-30 |
| **Branch** | `feat/kyc-mobile-launch` (bundled with K7b at the lead's request; unrelated to KYC). Not pushed. |
| **Decision** | Owner: the Call screen is a mock, so hide every entry point to it until masked calling exists. |

## What shipped
A single constant, `CALLING_ENABLED = false` in `apps/caregiver/src/config/calling.ts`. While it is `false`:
- the chat header shows no phone or video button (`ChatScreen.tsx`; they were the only two entry points to `CallScreen`);
- the `CallScreen` route is not registered in the app stack (`StackNavigator.tsx`), so nothing can navigate to it either.

`CallScreen.tsx` and the `CallScreen` route type are untouched.

## Why
`CallScreen` has no audio, video or telephony behind it. A caregiver pressing "call" would see a call that goes nowhere. Real calls need masking so caregiver and patient never see each other's numbers.

## How
One constant read in two places rather than deleting code: restoring is a one-line change. Rejected: removing the screen (loses the design) and a build flag (nothing here needs per-build behaviour).

**Not changed on purpose:** the `tel:` link beside an emergency contact in `ClientProfile.tsx` opens the phone's dialler for a contact the family listed; it is not the Call screen.

## Verification
`__tests__/chatCalling.test.tsx`: with calling off the header has no phone or video button; with the constant mocked on, both appear and navigate to `CallScreen` with and without `isVideo`; the shipped value is `false`. Typecheck clean. Not run on a device.

## Operate / roll back
Set `CALLING_ENABLED = true` to restore both entry points and the route. No data or config.

## Follow-ups
Masked calling (backend and app), then flip the constant and replace the mock screen.
