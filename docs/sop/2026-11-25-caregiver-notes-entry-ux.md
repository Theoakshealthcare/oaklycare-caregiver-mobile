# SOP: Caregiver typed visit-note entry (AI Notetaker screen)

| | |
|---|---|
| **What shipped** | The typed note form on the visit-notes / AI Notetaker screen is now two labelled, outlined fields (Title, Note) with a pinned "Save Note" bar that stays above the keyboard. Branch `fix/caregiver-notes-entry-ux`, one PR to `main` (see the PR for the head SHA). `apps/caregiver` only. |
| **Why** | The owner tested on a real Android phone and could not tell the title and body were text inputs: no label, no border or background, and the body was easy to miss. (The old fields did carry grey placeholders, "Note title..." and "Write your observations here...", but with no outline they still read as plain text.) |
| **Verified** | `tsc --noEmit`, ESLint (0 errors) and Jest on the touched files only. **Seen on the iOS simulator (iPhone 17 Pro, iOS 26.2, Debug build)**; **Android is reasoned, not seen** (see below). |

## What changed
| # | Change | Where |
|---|---|---|
| 1 | Both fields use the shared `Input` (label above, 16 pt outline, teal border, thicker on focus). Title: label "Title", placeholder "Note title". Body: label "Note", placeholder "Write your note here". A "Write a note" heading starts the form. | `src/screens/chat/AINoteTaker.tsx` |
| 2 | Body is `multiline`, `minHeight` 140, `maxHeight` 200, top aligned. Past 200 pt it scrolls inside itself, so the caret line always stays inside the area above the keyboard (a field that grew without limit would push the caret under it). | same |
| 3 | "Save Note" moved out of the scroll into a pinned `BottomCta` (shared 20 pt gap, #68) inside a `KeyboardInsetView` (the chat helper): the bar rides on top of the keyboard on both platforms. | same |
| 4 | Because the pinned bar and the keyboard inset shrink the scroll area, neither platform's own "scroll the focused field into view" sees a covered field. The screen scrolls the form to the top of the visible area when a field takes focus (at once if the keyboard is already up, otherwise when the scroll area resizes). `KeyboardScrollView` gained an optional `innerScrollRef` (a `scrollTo`-only handle); nothing else in it changed. | `src/components/ui/keyboard-scroll-view.tsx` |
| 5 | Untouched: the AI Notetaker header and subtitle, the orb / "Voice to text" panel and consent (voice on), the round mic (voice off), recording indicator, Voice notes list, Previous Notes. | |

Figma (`ss/caregiver`) has no typed-note form (the Notetaker frames show only the orb and "Voice to text"), so the form keeps its place under that block; only its fields were restyled.

**Decision to flag:** Save Note is pinned to the bottom, not inline under the body. Reason: with Voice notes and Previous Notes below the form, an inline button would sit mid-page and could be hidden by the keyboard. Tradeoff: the button stays visible while the page is scrolled to Previous Notes, and it saves whatever is in the two fields. If the owner prefers inline, move the `Button` back into the form block and drop the `KeyboardInsetView` + focus-scroll code.

## Verification
- Jest (single worker, named files): new `__tests__/noteEntryForm.test.tsx` (labels and placeholders exist, outlined style, multiline with min height 140 and top alignment, Save Note in the pinned `note-save-bar` saves trimmed values, empty save alerts and saves nothing); updated placeholders in `voiceNoteFlow.test.tsx`; also `aiNoteTaker`, `noteTimestamps`, `keyboardScrollAndroid`, `keyboardInset`, `visualPassFixes`, `chatParity`, `clientProfile` all pass (79 tests).
- iOS simulator (scratch harness rendering only this screen with seeded notes, voice notes off = the staging default; the harness was not committed): fields show label, placeholder and teal outline at rest; tapping the body scrolls the form to the top of the area with the body, caret and Save Note all above the keyboard; 299 + 152 typed characters: the body stops at 200 pt and scrolls inside itself with the caret visible; tapping Title while the keyboard is up keeps everything visible; keyboard closed: Save Note keeps the bottom gap and Previous Notes scroll above it.
- **Not seen: Android.** Reasoned from the code: `KeyboardInsetView` pads the bottom by `keyboardOverlap` on `keyboardDidShow` (shipped in #68 for chat), the scroll area's `onLayout` then fires and the form is scrolled into view. Risks to check on the phone: nested scroll of the body inside the page, timing of that `onLayout` after the keyboard animation, three-button navigation gap.

## Backend rule for TYPED notes (reported, not changed)
`POST /api/v1/booking/notes/{booking_id}/create` (backend `develop`, `app/api/v1/endpoints/booking.py` `create_booking_note`, service `BookingService.create_booking_note`): requires a caregiver user whose profile owns the booking (`Booking.caregiver_id == caregiver.id`, else 404 "Booking not found or access denied"). **No booking-status check and no time window**: a typed note can be added before, during or any time after the visit, including cancelled or completed ones. No length limit in `BookingNoteCreate` (`title` required string, `content` optional). Compare voice notes: start within 120 min, edit within 24 h of completion, `visit_not_active` 409. `GET /notes/{booking_id}` has no window either. The app does not check status either.

## Operate / roll back
No migration, env or config. Revert the PR.

## Follow-ups
- Look at it on the Android phone (items above).
- Decide a window for typed notes with the backend owner (currently unlimited), and a length cap.
- The empty-save alert still says "Please enter both title and note content"; a per-field inline error under each field would be clearer.
