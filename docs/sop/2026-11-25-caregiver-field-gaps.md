# SOP: Caregiver field-test gaps (first real Android phone test)

| | |
|---|---|
| **What shipped** | Six fixes in `apps/caregiver` plus one optional field in `packages/api-client`. Branch `fix/caregiver-field-gaps`, one PR to `main` (see the PR for the head SHA). |
| **Why** | The owner's first real-phone (Android) test against staging found: phone fields without `+234`, an editable name after identity verification, letter-only chat avatars, the keyboard covering the chat box, no chat push routing, and buttons flush to the bottom edge. |
| **Verified** | `tsc --noEmit`, ESLint, and Jest for the touched files only (phone, bottomCta, keyboardInset, push, chats, chatParity, account). **Not seen on the iOS simulator or any device**: no simulator build was made (no `ios/` project, and a native build was held back while another session was building). Keyboard, safe-area and push-tap behaviour for Android is reasoned from the existing `KeyboardScrollView` approach, not observed. |

## Changes
| # | Change | Where |
|---|---|---|
| 1 | One phone field. Value is always `+234` + national number; the prefix cannot be deleted (deleting into it restores it); a typed leading 0 or pasted `234` / `+234` is folded in; non-digits ignored; E.164 stored. A saved `0801...` or `234801...` shows as `+234801...`; a saved foreign `+44...` number is kept and edited as plain text. Validation unchanged (setup step 1 still requires digits after the prefix; an unchanged field is not re-sent). Used by Edit Profile (phone, emergency phone) and setup step 1. Login takes email *or* phone in one field, so it is untouched. | `src/utils/phone.ts`, `src/components/ui/phone-input.tsx`, `screens/account/EditProfile.tsx`, `screens/setup/CaregiverSetupStep1.tsx` |
| 2 | Full Name locks once `identity_verification_status === "verified"` (field on the caregiver profile payload; no extra query). Not editable, dimmed like the email field, helper "Your name is verified. To change it, contact support.", and `full_name` is never sent, nor validated, while locked. The email field had no helper text, so the helper is new for the name only. **Server-side enforcement is a separate follow-up.** | `EditProfile.tsx` |
| 3 | Chats avatars: `patient_photo_url` (optional, nullable) added to `CaregiverChatOut` in `openapi.json` and `schema.d.ts` (hand-added until the backend deploys; a later `api:sync` will overwrite it with the real spec). `PatientAvatar` shows the photo (falls back to the letter if it is missing or fails to load) in the list rows, the avatar strip and the chat header; the Chats list passes the photo to `ChatScreen` as an optional route param. The "large circle with a letter" is the Figma avatar strip of the latest chats (frame 8.21.06), not a stray element and not the caregiver's own avatar, so it stays. | `components/chat/PatientAvatar.tsx`, `screens/chats/Chats.tsx`, `screens/chat/ChatScreen.tsx`, `navigation/Navigations.tsx`, `packages/api-client` |
| 4 | Chat keyboard: `KeyboardInsetView` on Android now pads by `keyboardOverlap` (frame bottom minus keyboard top), measured on `keyboardDidShow`, replacing `KeyboardAvoidingView`, which relies on window resize that edge-to-edge no longer does. Same technique as `KeyboardScrollView`. Also wrapped: care-plan `ModalFrame` and `VitalEntryModal` (`outsideAppRoot`, so iOS does not subtract the safe inset a Modal never got). | `components/ui/keyboard-inset-view.tsx`, `components/careplan/parts.tsx`, `components/vitals/VitalEntryModal.tsx` |
| 5 | Push tap routing already existed (`AppRuntime`). `data.type === "chat_message"` + `booking_id` now opens `ChatScreen`; a chat push received in the foreground refreshes that chat and the Chats list. | `push/registration.ts` (`parseChatMessage`), `navigation/AppRuntime.tsx` |
| 6 | `BottomCta`: one container for pinned buttons, 20 pt gap. The app root already insets the navigator by the bottom safe area, so in-screen bars only need the gap; content in a native `Modal` passes `outsideAppRoot` and gets the inset added. Applied to the offer Accept/Decline bar, the care-plan `PlanScreen` footer and the full-page modal footer (the one that had no inset at all). Screens inside `globalStyles.container` already end 6% of the screen height above the edge. | `components/ui/bottom-cta.tsx`, `BookingDetails.tsx`, `PlanScreen.tsx`, `parts.tsx` |

## Findings
- The Age / Gender / Emergency Contact Person **Name** Edit Profile screenshot is the **patient** app. The caregiver Edit Profile has only the emergency contact *phone* (the caregiver profile has no name or age fields; `account.test.tsx` already asserts this).
- Rejected: a second "safe-area + margin" on every screen (would double-pad under the root spacer).

## Tests
New: `phone.test.tsx`, `bottomCta.test.tsx`. Extended: `keyboardInset` (Android and Modal cases), `push` (`parseChatMessage`), `chats` and `chatParity` (photo vs letter, photo handed to the room), `account` (name lock, +234 prefill, leading-0 normalisation, saved local number not re-sent; the three name-editing tests now use an unverified profile).

## Operate / roll back
No migration, no env, no config. Revert the PR. The `patient_photo_url` schema line can stay (optional); the app works without the backend field.

## Follow-ups
- Look at all of it on a real Android phone (keyboard over the chat box and care-plan/vitals modals, bottom gaps on gesture and 3-button navigation, chat push tap cold and warm) and on the iOS simulator.
- Server-side lock of `full_name` after verification.
- Backend: `patient_photo_url` on the chat list, and the `chat_message` push.
- Full-page modal footer (`FullPageFrame`) can still sit under the Android keyboard (its fields scroll above it; wrapping it would double-count with `KeyboardScrollView`).
- Login, reset-password and recover-password forms are short top-aligned forms with no keyboard handling; not changed.
- No test drives `AppRuntime` itself (only the payload parser).
