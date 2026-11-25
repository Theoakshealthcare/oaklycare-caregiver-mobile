# SOP: chat and visit notes close after the visit, and the stale-location nudge (both apps)

| | |
|---|---|
| **What shipped** | Both apps follow the post-visit windows the owner approved on 2026-11-25: the **chat** between patient and caregiver is read-only 24 hours after the visit completes (a cancelled booking at once); the caregiver's **typed notes and AI Notetaker** follow the voice-note windows (add during the visit and for 2 hours after; read for 24 hours after); a tap on the new **`location_stale` push** opens the app and refreshes the position. Typed client, patient chat, caregiver chat room, Chats list, notes screen, push handling. |
| **Branch / PR** | `feature/apps-post-visit-windows`, from `oakly/main` `47369eb`. One PR to `main`; not merged until the owner says "merge #N" with CI green. |
| **Backend** | Theoakshealthcare/backend #81 (merged to `develop`). Contract read from its verified FE guide, `docs/fe-integration-guide-post-visit-windows-location.md`, and its captures `docs/fe-captures/post-visit-windows-location/` (copied into the tests as `apps/patient/test-utils/captures/pvw-*` and `apps/caregiver/test-utils/windowCaptures/`). |
| **Verified** | Jest (the named files below), `tsc`, ESLint, the api-client node tests; **seen on the iOS simulator** against a fake API that answers with the backend's captured bodies. **Nothing seen on Android or a real phone, and no real notification tap.** See Verification. |

## Why
Owner decision 2026-11-25: a chat that stays open for ever keeps a patient and a caregiver in touch after the job; notes written long after a visit are not trustworthy. The backend now says when a chat or a note window is open; the apps must stop offering what the server will refuse, and must take a refusal that races the cutoff without an error toast.

## The contract the apps read (all optional in code: a missing field means open, as before)
| Where | Fields | Meaning |
|---|---|---|
| each item of `GET /caregiver/chats`; every `BookingResponse` (patient bookings, booking detail, caregiver bookings) | `chat_open: bool`, `chat_closes_at: datetime \| null` | open while the booking is live and for 24 h after completion; `chat_closes_at` is set once completed; a cancelled or declined booking is `chat_open: false` with `null` |
| the **assigned caregiver's own** booking payloads | `notes_open`, `notes_closes_at`, `notes_readable_until` | add window = in progress + 2 h after completion; the caregiver can read for 24 h after; `null` for the patient and for everyone else |
| `POST /booking/chat/{id}/send` | `409 { detail: { code: "chat_closed", message } }` | nothing saved, nobody pushed |
| `POST /booking/notes/{id}/create` | `409 { detail: { code: "visit_not_active", message } }` | outside the add window |
| `GET /booking/notes/{id}` (caregiver) | `404 { detail: { code: "not_found", message } }` | after `notes_readable_until` |
| push | `data.type == "location_stale"` (no booking id) | Available caregiver, last fix older than 6 h; sent at most once per 24 h, never 21:00 to 07:00 Lagos |

Timestamps are naive UTC; both apps read them as UTC.

## How
| Decision | Why / alternative rejected |
|---|---|
| **One shared rule in `@oakly/api-client`** (`chatWindow`, `notesWindow`, `errorCode`, `CHAT_CLOSED`, `VISIT_NOT_ACTIVE`, `NOT_FOUND`, `parseUtc`), with node tests. | The two apps must never disagree about when a chat is closed. Rejected: a copy in each app. |
| **The server's `chat_open` wins over the phone's clock.** With `chat_open` sent, the app trusts it (a phone with a wrong clock must not disable a live chat). A `chat_closes_at` already in the past closes the screen only when `chat_open` is **not** sent. | The backend guide says so; the 409 is the final authority either way. |
| **Cancelled vs over is told by `status`** (`cancelled` / `declined`), not by `chat_open`. | The payload carries both; "cancelled" has its own sentence. |
| **A 409 `chat_closed` closes the screen, no toast.** The booking is read again so the next visit to the screen is right. | Brief. The typed words are not kept visible (the composer is gone); the guide's "keep the text visible" was set against the brief's "switch to the closed state". |
| **Closed chat: no input, no send, no quick replies**, a calm line in the composer's place, history scrollable. Open with a `chat_closes_at`: a small grey line "You can chat until 3:00 PM" above the composer (patient 12-hour, caregiver 24-hour clock; "tomorrow" or "28 Nov" when not today). | Brief; no other layout invented. |
| **Chats list: a grey "Closed" under the time**, nothing else changes. | Brief. |
| **Notes closed by the payload (or a 404): both entry forms, the mic and Save Note are removed**, a banner says "Notes for this visit are closed." The notes already written stay readable while they are readable. | Brief ("disable/hide"). |
| **Notes closed by a 409 on save: the typed note stays on screen, the fields lock, Save goes, the banner adds "Your note could not be saved."** | The guide: keep the text, say it cannot be saved, do not retry. |
| **Notes 404 `not_found`, or a cached read after `notes_readable_until`: "These notes are no longer available."** Notes cached past that time are not drawn. | The guide: do not cache them past that time. |
| **`location_stale` tap: navigate to Home (`BottomNavigation`, `tab: "home"`), take one position now and send it** (no `is_available`, so availability is unchanged); a push that arrives with the app open does the same and shows no banner. | The lead's brief said "just opens the app on Home"; the backend guide asks for a fresh ping. The tracker alone only reports a 100 m move or its 60 s heartbeat, and on iOS a stationary caregiver would wait up to a minute. The ping is a no-op when tracking is off (not Available), so it never starts location use. |
| **Fixtures:** the generated schema makes `chat_open` required on `BookingResponse`, so three caregiver test fixtures got `chat_open: true`. | They are typed as the generated type. |

## What's involved
| Path | Change |
|---|---|
| `packages/api-client/openapi.json`, `src/schema.d.ts` | synced from backend `develop` (`c2f5292`): the new fields on `BookingResponse` and `CaregiverChatOut`, plus two pre-existing additions from `develop` (`GET /payment/callback`, the chat photo wording). CI regenerates the file and fails on a diff, so it is committed regenerated. |
| `packages/api-client/src/index.ts`, `test/windows.test.ts` | the shared helpers and their tests (the cases are the capture rows) |
| `apps/patient/src/domain/booking.ts`, `services/bookingMapper.ts`, `domain/format.ts` (`formatUntil`) | `chatOpen`, `chatClosesAt` on the booking |
| `apps/patient/src/screens/tracking/Chat.tsx` | closed line, hint, 409 handling |
| `apps/caregiver/src/screens/chat/ChatScreen.tsx` | the same for the caregiver chat room |
| `apps/caregiver/src/screens/chats/Chats.tsx` | "Closed" label |
| `apps/caregiver/src/screens/chat/AINoteTaker.tsx`, `components/ui/notice.tsx` (new), `utils/dates.ts` (`formatUntil`) | notes windows, banners, 409 and 404 handling |
| `apps/caregiver/src/push/registration.ts` (`isLocationStale`), `push/native.ts` (no foreground banner), `navigation/AppRuntime.tsx` (tap and foreground handling, `sendPing`, `pingNow`) | the nudge |
| tests | `apps/patient/__tests__/chatWindows.test.tsx`; `apps/caregiver/__tests__/chatWindows.test.tsx`, `notesWindows.test.tsx`, `locationStaleTap.test.tsx`, additions to `push.test.ts` and `pushNative.test.ts`; the four test files that mock `hooks/queries` for the notes screen gained `useBooking` |

## Verification
**Jest (single worker, only the named files; the full suites are CI's):** patient `chatWindows`, `trackingChat`, `bookingUnits`, `bookingFlows`, `push` (126 tests); caregiver `chatWindows`, `notesWindows`, `locationStaleTap`, `push`, `pushNative`, `aiNoteTaker`, `noteEntryForm`, `noteTimestamps`, `voiceNoteFlow`, `voiceNoteReview`, `chatParity`, `chatCalling`, `chats`, `chatsModel`, `directions`, `notifications`, `offers`, `visualPassFixes`, `clientProfile`, `keyboardInset`, `errors` (224 tests); api-client `node --test` (31 tests). `tsc --noEmit` clean in `packages/api-client`, `apps/caregiver`, `apps/patient`, `apps/admin`; ESLint 0 errors in both apps (no new warnings in the touched files).

**iOS simulator (iPhone 17, iOS 26.2, the existing Debug builds, Metro from this branch, a fake API answering with the backend's captured bodies and `EXPO_PUBLIC_VOICE_NOTES=fake`; evidence in `ledgers/sim-apps-windows/`):**
| Seen | Evidence |
|---|---|
| Patient chat, completed and open: "You can chat until 3:00 PM" above the composer; with the keyboard up the composer and the line sit above it | p1, p2 |
| Patient chat, a send that races the cutoff (409 `chat_closed`): the screen switches to "This chat has closed because the visit is over.", keyboard gone, no error | p3 |
| Patient chat opened after the chat closed: same line, history shown, no composer | p4 |
| Caregiver Chats list: "Closed" on closed rows, nothing else moved | c1 |
| Caregiver chat room closed: the same line in place of the composer and quick replies, history and booking card kept | c2 |
| Caregiver notes, closed and 404: "Notes for this visit are closed.", no forms, no Save Note, "These notes are no longer available." | c3 |
| Caregiver notes, open after completion: "Visit complete. You can add notes until 11:04." | c4 |
| Caregiver notes, a save refused with 409 `visit_not_active`: banner "Notes for this visit are closed. Your note could not be saved.", the typed title and note stay, the fields are locked, Save Note gone, no alert | c5 |
| Caregiver opened as Available (cold start): the foreground tracker started and a `POST /booking/caregiver/location` followed | fake API log |
| A `location_stale` push delivered with `xcrun simctl push` while the app was open (payload `body: { type: "location_stale" }`, the shape Expo's push service uses): a position was sent about 3 s later, twice in a row; no banner, no alert | c6 |

**Not seen, plainly:**
- **A notification tap.** The simulator never asked for notification permission (the app skips push registration on a simulator), so nothing could be tapped. The tap path (navigate to Home, one ping, handled once per notification, nothing sent when not Available) is **Jest only** (`locationStaleTap.test.tsx`, with `expo-notifications` mocked). The cold-start tap is the same handler fed by `useLastNotificationResponse`.
- **Android**, anything on a real phone, the cancelled-booking line on a screen (Jest only), a window that closes while the screen is open without a send, and a real push reaching a phone.
- The Home banner "You are not receiving offers: your location is out of date" in c6 comes from the fake API's `location_updated_at: null`, not from the app.

## Tracker on open (the lead's question)
Confirmed on iOS: an approved, Available caregiver who opens the app gets the foreground tracker started from `GET /caregiver/home` (`decideTracking` returns `foreground`), and a first ping goes out at once. Reasoned (not seen): on a warm return from the background the tracker is not restarted (the mode did not change); the 60 s heartbeat then sends the next position, which is why the tap also sends one directly.

## Operate / roll back
No config. Revert the PR: both apps go back to an always-open chat and notes; the fields are additive on the server and can stay. Merge after backend #81 is on the environment the app talks to (it is on `develop` and staging).

## Follow-ups
- A real notification tap on a device or an Android build (and the Android keyboard with the closed banner in place of the composer).
- The chat can close while the patient screen is open and nothing is sent (the booking is not polled once completed): the 409 handles it, but the hint then stays until a send.
- Care-plan observations are untouched (in progress only, per the backend guide).
