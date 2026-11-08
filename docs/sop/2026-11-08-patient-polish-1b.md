# SOP: Patient app, polish pass 1b (ten findings from the first device pass)

| | |
|---|---|
| **What shipped** | Ten small JS-only fixes in `apps/patient` from `LEDGER-device-patient-pass-1.md`: **P1-07** past start times for today cannot be picked, **P1-08** a cancelled booking shows its refund state instead of PAID and offers no chat, **P1-09** Log out asks first, **P1-11** layout slips (bottom room, onboarding colour to the screen edge), **P1-12** "Password changed" uses the app's own dialog, **P1-13** the vitals sharing screen shows first name and last initial, **P1-14** FAQs and About open in the in-app browser, **P1-05** clearer FallGuard text when personal tips are missing, **P1-18** dead `SampleNotice` removed, **P1-04** keystroke loss: code audited, regression test added, still to confirm on a real phone. |
| **Branch / commits** | `fix/patient-polish-pass-1b`, cut from `oakly/main` `58535ec`, one commit per finding (`2680e69` P1-07, `61523aa` P1-08, `5eb6325` P1-09, `80efa61` P1-12, `837e46c` P1-11, `3c39dfe` P1-13, `7c3cc97` P1-14, `8d32b75` P1-05, `90a8c71` P1-18, `d9278a5` P1-04 test) plus this SOP. Not pushed. |
| **Device-verified** | **No.** Jest only. No simulator was used; the layout items (P1-11) in particular are padding changes that still need a look on a screen. |
| **Tests** | Patient Jest 220 pass (20 suites, exits at once); `pnpm typecheck` and `pnpm lint` for every package clean; `pnpm api:generate` leaves `schema.d.ts` unchanged; frozen install clean. Caregiver Jest and the admin build were not run (another session owns the caregiver suite; nothing outside `apps/patient` changed). |

## Why

The first device pass (ledger) found 17 open items after the three fixes in #37. Eight of them were small, owner-decided or owner-delegated, and JS only, so they went into one branch to give testers a cleaner first build.

## What changed

| ID | Change | Files |
|---|---|---|
| P1-07 | `ChipSelect` takes `disabledValues`; the start-time chips earlier than now are greyed, marked disabled for screen readers and ignore presses. They are read at render, so the list follows the clock. Choosing today after an earlier-day time that is already past clears the time. `isPastSlot` is the one rule, also used by the "Save & Continue" check. | `src/domain/slots.ts`, `src/components/ui/chip-select.tsx`, `src/screens/booking/BookingStep1.tsx` |
| P1-08 | `paymentChip` and `canChat` moved into the domain. A **cancelled** booking never says PAID: refund `refunded` is REFUNDED, `declined` is REFUND DECLINED, any other refund state is REFUND PENDING, no refund and nothing refunded is CANCELED (a failed payment still says PAYMENT FAILED). The Chat button is hidden once cancelled. Other statuses keep their old chips. The owner left the wording to me; I kept it to the refund states the screen already shows below. | `src/domain/booking.ts`, `src/screens/booking/BookingDetails.tsx` |
| P1-09 | Log out opens the same `ConfirmDialog` as Delete account ("Log out?", "Yes, log out" / "No, stay signed in"). | `src/screens/profile/AccountData.tsx` |
| P1-11 | `Screen` (scroll) and the four tab pages get `paddingBottom: xxl` so the last button (Chat under the visit-code card) and the Vitals "History" row clear the edge and the floating tab bar. Onboarding grows its colour into the home-indicator area (negative bottom margin plus the same padding) so the white band under it is gone. | `src/components/ui/screen.tsx`, `Home.tsx`, `Bookings.tsx`, `Vitals.tsx`, `Fall.tsx`, `src/screens/auth/Onboarding.tsx` |
| P1-12 | New `NoticeDialog` (one-button card, same look as `ConfirmDialog`). Change password shows its success in it and goes back on OK; the failure that has no field now uses the existing `ErrorDialog`. No native `Alert` is left in the app. | `src/components/ui/notice-dialog.tsx`, `src/screens/profile/ChangePassword.tsx` |
| P1-13 | New `src/domain/names.ts`: `firstNameAndInitial` ("Adamu Titilayo" is "Adamu T."; a single word as is; extra spaces, tabs, lowercase and a leading title handled; middle names skipped) and `firstNameOf` (moved here from the booking mapper, same behaviour). Only the vitals sharing hook uses the initial; every other screen keeps the first name. | `src/domain/names.ts`, `src/hooks/useVitalAccess.ts`, `src/services/bookingMapper.ts` |
| P1-14 | `openPage(url)` opens `expo-web-browser` `openBrowserAsync` (the browser the payment page uses); only if that throws does it fall back to `Linking.openURL`. URLs unchanged (`FAQ_URL`, `ABOUT_URL`). | `src/services/inAppBrowser.ts`, `src/screens/profile/Profile.tsx` |
| P1-05 | Fallback line is now: "Your score is saved to your account. Personal tips are not available right now. If you are worried about falls, please speak to your doctor or nurse." Advice rendering unchanged. | `src/screens/fall/FallResult.tsx` |
| P1-18 | `src/components/ui/sample-notice.tsx` deleted (nothing imported it; older SOPs still mention it as history). | |

### P1-04: keystroke loss, audit result

Read: `Input` (a plain controlled `TextInput`, props passed straight through), the booking draft store (`zustand`, `patch` merges into the latest state), Booking steps 1 and 2, Edit profile, Add vital, Login, Create account, Change password. Every handler writes the new text with a functional update (`setX(prev => ...)` or `set(s => ...)`); there is no debounce, no async write, no value that is transformed except the digits-only duration (`replace(/\D/g, "")`, idempotent). **I found no code path that can lose an event.** What is left is the likely explanation in the ledger: the simulator tool injects keystrokes faster than a Debug build can re-render, and React Native's controlled input drops a stale JS value when the native side has newer events.

**Simulator artefact most likely, still to confirm on a real phone with a Release build.** Not converted to uncontrolled inputs (no evidence). `__tests__/typing.test.tsx` pins what the code does guarantee: one change event per keystroke ends with the field and the draft holding the full text, and edits to different fields do not overwrite each other. The test renderer cannot overlap events, so it does not prove the native behaviour.

## Decisions and rejected alternatives

- **Disable, not hide,** the earlier chips (the owner asked for "not selectable"); the day's list keeps its shape.
- **Chip after cancel from the refund object, not from `paymentStatus`:** a cancelled booking's `payment_status` stays `paid` (capture 037) while the refund is the live money state.
- **Chat hidden by status** (`cancelled`), not by caregiver: the caregiver stays on the record.
- **Onboarding bleed only at the bottom:** the top is under the status bar with dark icons, and a teal top would make them hard to read.
- **Rejected:** changing the root `SafeAreaView` (every screen leans on it); a native-driven `Modal` alert (the app has one dialog style).
- **Not done:** P1-10 (strong-password sheet), P1-15 (first tap ignored), P1-17 (pull to refresh) were not in scope.

## Verification

- New and updated Jest: `slots.test.tsx` (isPastSlot, disabled chip), `bookingUnits.test.ts` (chip table, `canChat`), `bookingFlows.test.tsx` (cancelled detail from capture 037: REFUND PENDING, no PAID, no Chat), `authGate.test.tsx` and `push.test.tsx` (log out confirm: No keeps the session, Yes ends it), `profile.test.tsx` (success dialog, no native alert; FAQs and About through `openBrowserAsync`, no `Linking`; fallback when the browser throws), `names.test.ts`, `vitals.test.tsx` ("Placeholder E." on the sharing screen), `fallguard.test.tsx` (new wording), `typing.test.tsx`. Clock text is never asserted (the Mac is Lagos, CI is UTC).
- CI steps run locally (`.github/workflows/ci.yml`): `pnpm install --frozen-lockfile`, `pnpm api:generate` and `git diff --exit-code -- packages/api-client/src/schema.d.ts`, `pnpm typecheck`, `pnpm lint`, patient `jest`. Not run locally: caregiver Jest, admin build (CI will).
- **Not verified:** any of it on a screen. Check on the next device pass: today's chips greyed at the right hour, cancelled detail (chip, no Chat), Log out dialog, the password success card over the profile, FAQ and About in the in-app browser with its Done button, the bottom room on booking detail and the four tabs, and the onboarding bottom edge on a phone with a home indicator.

## Operate / roll back

Pure app changes: revert the commits listed above (each is independent except P1-12, which adds `notice-dialog.tsx` used only by Change password). No migration, no config, no new native dependency (`expo-web-browser` was already installed).

## Follow-ups

- Real phone, Release build: confirm or close P1-04; check the layout items above.
- P1-10, P1-15 and P1-17 stay open in the ledger.
- If the first-name-and-initial rule is wanted on other consent screens later, `firstNameAndInitial` is the one place to call.
