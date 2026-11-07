# SOP: Patient app live tracking and chat wired to the backend (P9)

| | |
|---|---|
| **What shipped** | The sample `useChat` hook and the sample tracking screen in `apps/patient` are replaced by real calls: the caregiver's position as text (distance, estimated arrival, how fresh) from `GET /booking/booking/{id}/live-tracking`, polled; and the real chat (`GET .../chat/{id}/messages`, `POST .../chat/{id}/send`), polled. Proved on the iOS simulator against a local backend. |
| **Branch / commits** | `feature/patient-tracking-chat` on `oakly/main` `fc5572a`. Not pushed. Commit SHA in the lead report. |
| **Device-verified?** | **Yes, iPhone 17 Pro simulator (iOS 26.2)**: every step in `ledgers/LEDGER-device-patient-tracking-chat.md`. Not Android, not a physical phone, not a real caregiver phone sending positions (a driver script posts them through the real caregiver endpoint). |

## Why
Tracking and chat were the last two patient screens still on sample data (a `SampleNotice` on each). The family needs to see the caregiver is coming, and to talk to them.

## How (decisions)
| Area | Decision | Rejected / why |
|---|---|---|
| Map | **None.** Distance ("3.3 km away"), estimated arrival ("about 5 minutes", only once the caregiver is on the way) and "Updated 2 minutes ago", as text, plus an **Open in Maps** button. A map needs a native module (`react-native-maps`) and a Google Maps key; the owner has no key and the legacy app's committed key must never be reused. | A map screen with a placeholder key |
| Open in Maps | A plain https link with the caregiver's coordinates, opened with `Linking`: iOS gets `maps.apple.com` (opens the Maps app at once), others get the Google Maps link. First tried with the Google link on iOS: the simulator's Safari showed Google's cookie-consent wall instead of a map, so iOS got the Apple link. **This sends the caregiver's coordinates to Apple / Google when the patient taps**; the owner may prefer to drop the button. | Reverse geocoding or an embedded web map |
| WebSocket | **Not used.** Polling every 15 s while the screen is focused and the caregiver is accepted or on the way. The backend socket (`/booking/ws/patient/tracking`, `?token=` or `Sec-WebSocket-Protocol: bearer, <jwt>`, message `tracking_subscribe`, broadcast `location_broadcast`) is cheap to add later, but it needs a token refresh and reconnect story on the phone and was not worth the risk here. | Polling plus a socket |
| States | `live` (position known), `waiting` (404 `No tracking data available`: the caregiver's phone has not shared a position), `closed` (409: the booking is not accepted / on the way / in progress), anything else is an error with Try again. The two "nothing to show" answers are **plain `detail` strings, not `detail.code`**, so they are told apart by **status**. | Parsing the English `detail` |
| Staleness | A position **5 minutes or older** is shown as "Last position 5 minutes ago. It may be out of date." in the warning colour instead of "Updated ...". Ages are measured at the moment the position was read, not at render time. | Showing an old position as live |
| When it asks | Only while the booking is `accepted` or `en_route` and the screen is focused. Once the visit starts the caregiver is at the door and the estimate means nothing. **A query that is switched off keeps its last answer**, so the card is also hidden by status (found on the simulator: after the visit started the old "Location not shared yet" card stayed; regression test added). | |
| Time zone | The API's `created_at` / `last_updated` are zone-less UTC strings; all go through `utcIso` (`domain/dates.ts`). On the simulator "8:41 PM" matched the device clock (Lagos). Tests assert instants and relative text, never a clock string. | |
| Chat list | One call, the whole conversation, oldest first (no paging); re-read every **5 s** while the chat screen is focused; no push or unread feed exists for chat. A message is mine when `sender_id` equals the `id` of `GET /auth/me` (a USER id, not the patient id). The screen scrolls to the newest message. | |
| Chat send | Trimmed text, `message_type: "text"` (required by the generated type), cap 1,000 characters in the composer (the API has none). The stored message is added to the list at once and the next read confirms it (deduplicated by id). While sending the message shows faded with "Sending...". **If it fails the words go back into the box** (unless the person already typed something else) and a notice says why ("Can't reach Oakly..."). A blank message is never sent. The API **does** store an empty message if asked (`chat-send-blank` capture), so the app also hides empty messages. | Optimistic add with a retry queue |
| Errors | Read through `ApiError` as everywhere: `detail.code` where the route has one (these routes do not), the network sentence only for a request that never completed. Chat of someone else's booking answers 403 `Access denied`. | |

## What's involved
| Path | What |
|---|---|
| `apps/patient/src/domain/tracking.ts`, `chat.ts` | Types, `toPosition`, age / distance / arrival wording, `mapsUrl`, `toChatMessage`, `withMessage`, `MAX_MESSAGE_LENGTH` |
| `apps/patient/src/services/tracking.service.ts`, `chat.service.ts` | The calls (the live-tracking path has "booking" twice) |
| `apps/patient/src/hooks/useTracking.ts`, `useChat.ts`, `api/keys.ts` | `useLiveTracking` (`trackingRefresh`), `useChat` (`chatRefresh`), `useSendMessage` |
| `apps/patient/src/screens/tracking/CaregiverDetail.tsx`, `Chat.tsx` | The screens; the `SampleNotice` is gone from both |
| `apps/patient/src/domain/booking.ts` | `ChatMessage` is now `{ id, senderId, text, sentAt }` (no `from`) |
| deleted | `hooks/fixture.ts` (`useFixtureQuery`, `sampleKeys`) and `fixtures/bookings.ts`: nothing reads sample data any more |
| `apps/patient/scripts/capture-tracking-chat.mjs`, `__tests__/fixtures/live/63-83*.json` | 21 live captures (accepted, closer, en route, in progress, no caregiver yet, no position, after cancel, other patient, no token, unknown booking; chat list, send, blank, no body, other patient, unknown booking) |
| `apps/patient/__tests__/trackingChat.test.tsx` | 23 tests |

## Verification
**Jest (single worker, foreground, no `--forceExit`, exited by itself):** the whole monorepo CI run locally: frozen install, API types drift (none), typecheck, lint, patient 16 suites / 170 tests, caregiver 60 / 832, admin vitest 26 files / 329, api-client 17, `admin build`. Jest ran single worker in the foreground and exited by itself. `trackingChat.test.tsx` runs the real screens through a fake `fetch` answering with the **live captures**: the distance and freshness while accepted (no guessed arrival), the arrival text on the way, an old position called out of date, 404 and 409 handling, offline with Try again and recovery, polling on its own, no asking once the visit started, the card dropping when the visit starts while open (fails without the fix), Open in Maps, the real conversation, empty state, send (body, trimmed, box cleared, stored message shown), failed send (words returned, reason shown), 403, the reply appearing by polling.
**Device proof:** `ledgers/LEDGER-device-patient-tracking-chat.md` (PASS / FAIL per step, screenshots `ledgers/device-patient-tracking-chat/`): real position and visit code, the screen updating by itself when the caregiver set off and moved closer, Open in Maps opening the Maps app, chat both ways (the reply appeared by polling), the soft keyboard lifting the composer (`KeyboardInsetView`, previously "not device-checked"), the out-of-date warning after 5 minutes, the API stopped (tracking and chat send both say "Can't reach Oakly", the words stay in the box), recovery after restart, no position, visit started.
**Live shapes (for the FE guide, which is the backend's):** `live-tracking` answers `{booking_id, caregiver_id, caregiver_name, current_latitude, current_longitude, distance_km, estimated_arrival_minutes, last_updated (zone-less UTC), is_moving, booking_status}`; ETA is the straight-line distance at 25 km/h and never under 5 minutes. A `pending` booking answers 409, not 404.

## Operate / roll back
No backend change and no migration. Revert the branch to go back to sample data. To re-capture: run the stack as in the ledger, then `PATIENT_PASSWORD=<the seeded patient's password> node apps/patient/scripts/capture-tracking-chat.mjs --api ... --ctl ... --pg ...` (after `capture-live.mjs`, which wipes the folder).

## Follow-ups
| Item | Detail |
|---|---|
| In-app map | Needs `react-native-maps` (native) and a Google Maps key (owner). Then a map under the text card; keep the text. |
| WebSocket | Optional later; see above. |
| Chat push / unread | No backend support (no unread count, `is_read` is never set, no notification on a new chat message); a patient only sees a reply while the chat is open. A backend slice. |
| Caregiver position source | Positions come from the caregiver app's location pings. Real-phone behaviour (battery, background updates, how often they post) is not proven; a stale position is called out after 5 minutes. |
| Backend | `pending` booking answers 409 (not 404) for live tracking; empty chat messages are stored; both are harmless to the app. The estimated arrival is crude (straight line at 25 km/h). |
| Android, physical phone | Not run (the Maps link on Android and the keyboard helper `KeyboardAvoidingView` path are unverified). |
