# SOP: sign-up and other forms could not be scrolled above the Android keyboard

| | |
|---|---|
| **What shipped** | The shared `KeyboardScrollView` (both apps) now works on Android: the scroll area ends where the keyboard begins, so every field can be scrolled above it and the field being typed in is brought into view. iOS behaviour is unchanged. |
| **Branch / PR** | `fix/auth-screens-keyboard`, monorepo PR (see the PR for the number). |
| **Reported by** | The owner, on the first real Android phone test of the staging APK (2026-11-23): on the sign-up page of the caregiver app the keyboard covered the lower fields (the phone number), the page would not scroll up, and the owner had to close the keyboard to move between fields. The patient app uses the same component. |
| **Not verified** | **On a real Android device.** There is no Android emulator on the build machine; the iOS simulator does not run this code path. Needs a new preview APK and a manual pass (see Verification). |

## Why
`KeyboardScrollView` relied on `automaticallyAdjustKeyboardInsets`, which exists only on iOS (its own comment said "Android: unverified"). On Android the app draws edge to edge (Expo SDK 57), and in that mode the system no longer resizes the window when the keyboard opens. The scroll view therefore kept its full height under the keyboard, its scroll range ended at the end of the content, and the last fields could never be scrolled above the keyboard.

## How
On Android the scroll view is wrapped in a frame whose bottom padding equals how far the keyboard covers the frame: the frame's bottom edge (measured in window coordinates) minus the keyboard's top edge (`screenY` from `keyboardDidShow`), never negative. If a device does resize the window itself, the frame already ends above the keyboard and the padding is 0, so nothing is added twice. After the padding applies, the focused input is measured and the scroll view scrolled just enough to show it with 24 px to spare. Moving focus to another field while the keyboard stays open is handled by the native scroll view, because its visible area already ends at the keyboard. Rejected: `react-native-keyboard-controller` (a new native dependency for one component), and `KeyboardAvoidingView` (measures its frame once and was already wrong inside stack screens, see `keyboard-inset-view.tsx`).

## What's involved
| Path | Change |
|---|---|
| `apps/caregiver/src/components/ui/keyboard-scroll-view.tsx` | Android frame, overlap maths (`keyboardOverlap`), scroll-to-focused-field |
| `apps/patient/src/components/ui/keyboard-scroll-view.tsx` | the same component |
| `apps/*/__tests__/keyboardScrollAndroid.test.tsx` | new tests (see below) |

## Verification
Run locally: `tsc --noEmit` clean in both apps; eslint clean on the touched files; new tests 4 passed per app (padding equals the overlap, clears when the keyboard hides, adds nothing when the window was already resized, the scroll view keeps its tap and dismiss props); the existing keyboard tests and the 14 caregiver and 2 patient suites that use the component still pass (183 and 27 tests). **Not run:** an Android device, and the full suites (CI runs those).

**Manual pass to do on the new APK** (the proof): caregiver sign-up and patient sign-up: tap the phone number field: it must sit above the keyboard and you must be able to scroll the form up and down with the keyboard open; tab or tap through every field; the Create button must be reachable; close the keyboard and the extra space must disappear. Repeat on one screen that uses `ScreenShell` (care-plan notes) and on Change password.

## Operate / roll back
Revert the PR; no data or API is involved. A new preview APK is needed to see the change.

## Follow-ups
1. Device check on Android (above); then update the DP1-03 notes that still say "Android: unverified".
2. Login, recover and reset in the caregiver app are plain views, not scroll views: fine on a normal phone, but they would clip on a small screen with the keyboard open. Move them to the same component if the owner sees it.
