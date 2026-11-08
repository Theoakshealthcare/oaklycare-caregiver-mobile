# SOP: Caregiver AI voice notes, app side (against a documented contract, fake service only)

> **Update 2026-11-08:** the real service is now wired in code (docs/sop/2026-11-08-caregiver-ai-voice-notes-wiring.md): the `TODO(phase-B)` seams below are done, `live` mode exists, and the types come from the generated client. The flag is still off by default. This page is the record of the UI as first shipped.

| | |
|---|---|
| **What shipped** | The caregiver app side of AI note transcription: a consent step, record, upload, a "transcribing" state with retry, an edit screen (transcript and summary), Save and Discard, saved voice notes showing the final text. It is built against the contract in `backend/docs/plans/2026-11-07-ai-note-transcription.md` through a typed service with an in-memory fake. **It is NOT wired to a real backend: the endpoints do not exist yet**, and the feature is **off by default** (`EXPO_PUBLIC_VOICE_NOTES` unset). |
| **Branch / commits** | `feature/caregiver-ai-notes-ui` on `oakly/main` `b07ed64`. Not pushed. Commit SHA in the lead report. |
| **Device-verified?** | **No.** Jest only (no simulator in phase A). The recorder, the file delete and the keyboard are native: do not treat them as proven until a device run. |
| **Owner decisions applied (2026-11-07)** | Audio deleted as soon as the text exists (D1); consent line that names an external AI service, flag stored per visit (D2); English and Pidgin (D4); transcript and summary both editable before saving (D5). Transcript privacy (D3) is a backend matter. |

## Why
The note taker had a mic that recorded and then told the caregiver "voice transcription isn't available yet". The owner accepted defaults for consent, privacy, languages and output, so the app side can be built now against a written contract, and the backend (phase B) can follow without the UI waiting.

## How (decisions)
| Area | Decision | Rejected / why |
|---|---|---|
| Service seam | `VoiceNoteService` (`src/voiceNotes/service.ts`) has one method per contract route: `create`, `sendAudio`, `get`, `listForVisit`, `retry`, `save`, `discard`. `FakeVoiceNoteService` implements it in memory and follows the spec's state machine and error codes. Every seam to the real thing is marked `TODO(phase-B)`. | Hand-writing the real calls now: the generated api-client has no such paths, so they could not type-check, and the contract is a proposal until captured. The API sync was **not** run. |
| Flag | `EXPO_PUBLIC_VOICE_NOTES=fake` turns the flow on (`src/config/voiceNotes.ts`); anything else is `off` and the screen behaves exactly as before (the old "not transcribed yet" alert). In fake mode the screen says "Test mode: voice notes use sample text. Nothing you record leaves this phone." | A `live` value now: nothing could back it. Phase B adds it and makes it the default. |
| Consent | Inline card before the first recording: the exact line from the spec (version `2026-11-v1`, names Google Gemini as an external AI service) and a checkbox. The mic is disabled until it is ticked. The tick is remembered **per visit** in `expo-secure-store` as the consent *version*, so an older wording never counts and another visit starts unticked. Every create call still sends `consent_confirmed: true` plus the version, so the server stores proof per recording. "Undo" takes the tick back. | A modal (blocks the typed note); remembering a plain boolean (a changed wording would keep counting). |
| Upload | Two calls, as the contract defines: create (stores the consent, idempotent on a per-recording `client_request_id`), then send the audio. A retry re-runs both with the **same** request id; `already_processing` on the second send counts as success. | One multipart call: the contract avoids it (server temp files). |
| States | Sending, transcribing (polls every 2 s for ten reads, then 5 s; after 3 minutes says "taking longer than usual" with Check again and Discard), ready (opens the review screen at once for the recording just made, else a "ready to check" card), failed (sentence from `error.code`; **Try again only when `retryable`**; otherwise "Type my note" and Discard), unsent. | Giving up silently after a timeout. |
| Retry | Asks the server to retry; on `audio_expired` the app sends its own copy of the recording again. So the file stays on the phone until the note is `ready`, then it is deleted (also on discard, and at sign-out through the session's `onSignedOut`). | Deleting the file after upload (would make `audio_expired` unrecoverable). |
| Review screen | `VoiceNoteReview`: an "AI draft, check it" notice, summary and transcript in editable fields (limits 2,000 and 20,000 characters, transcript required), Save, Discard. Discard asks first, then **deletes the note on the server**. A summary the server could not write says so and can be written by hand. A saved note opens read-only. A failed save keeps the text and shows the `detail.code` sentence. | Auto-saving the draft (a model's text must be checked by a person). |
| Saved notes | Under "Voice notes" on the note screen: the final summary and transcript as saved, with "edited by you" when changed. The AI draft is not shown once the final text exists. | Writing voice notes into the existing typed-notes list (that table is plaintext; the contract keeps voice notes apart). |
| Errors | `requestCodeOf` reads `detail.code` (the voice routes' object-shaped `detail`; the app's `ApiError.detail` only holds string details), `voiceNoteErrorMessage` maps each code to a sentence, then falls back to the app's general wording (network, 5xx). A test fails if the code list drifts from the spec. | |
| Typed note | Untouched: same title and text, same `createNote`, same list. Tested in both modes. | |

## What's involved
| Path | What |
|---|---|
| `apps/caregiver/src/voiceNotes/` | `types.ts` (hand-written from the spec), `consentCopy.ts`, `messages.ts`, `service.ts` (interface and factory), `fakeService.ts`, `localAudio.ts`, `useVisitConsent.ts` |
| `apps/caregiver/src/hooks/useVoiceNotes.ts` | The queries and mutations; `submitRecording` and `retryVoiceNote` hold the retry logic |
| `apps/caregiver/src/screens/chat/AINoteTaker.tsx` | Hosts the consent card, language choice (English / Pidgin), mic gating, the state cards and saved voice notes; typed path unchanged |
| `apps/caregiver/src/screens/chat/voice/` | `ConsentCard`, `VoiceNoteCards` (transcribing, failed, ready, pending, unsent, saved) |
| `apps/caregiver/src/screens/chat/VoiceNoteReview.tsx` | The edit screen; route `VoiceNoteReview` in `Navigations.tsx` and `StackNavigator.tsx` |
| `apps/caregiver/src/api/keys.ts`, `src/auth/index.ts` | Query keys; sign-out deletes held recordings |
| `apps/caregiver/__tests__/voiceNote*.test.ts(x)` | 57 new tests in 5 files |

## Verification
| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, admin build | pass |
| Caregiver Jest, single worker (`jest --runInBand`) | **889 tests, 65 suites pass**; the 57 new tests cover: consent copy exact text and the spec's code lists; consent required, remembered per visit and per version; no create or upload without the tick; the full fake state machine (idempotent create, processing, ready, audio dropped, retry, `audio_expired`, save rules, discard, errors); upload, transcribing, slow state, each failure code, retry, and re-send after `audio_expired`; too-short and ten-minute recordings; review edit, save, discard (server delete), empty fields, stale save, read-only saved note; saved voice notes show the final text; the typed note path |
| Clock text | Never asserted (Mac is Lagos, CI is UTC): tests assert calls, codes and sentences |
| Exit | The new tests alone exit in about 5 s. The **full** single-worker run left the Jest process alive for about five minutes after the tests finished, **with or without the new files** (react-query's default 5-minute cache timers in older suites); it exits on its own. Not caused by this change, not fixed here |
| **Not verified** | A device or simulator run; Android; the real recorder file (`recorder.uri`), `File.delete()` on a device; any real backend or Gemini (none exists) |

## Operate / roll back
- **Turn on for a design review:** build with `EXPO_PUBLIC_VOICE_NOTES=fake` (for the simulator, `EXPO_PUBLIC_VOICE_NOTES=fake npx expo start`). Off by default, so a normal build is unchanged.
- **Roll back:** revert the branch; nothing else depends on it (no migration, no generated types, no backend change).
- **No FE integration guide yet:** that guide must come from live captures, and no endpoint exists. It is written in phase B.

## Follow-ups
1. **Phase B (backend slices B1 to B4 in the plan):** then `pnpm api:sync`, replace `types.ts` with the generated schema types, add `RealVoiceNoteService` (the audio as a raw body, not multipart), add the `live` mode and make it the default. Every `TODO(phase-B)` marks a seam.
2. Confirm on a real device that the m4a the recorder writes is accepted (spec risk R3) and that the upload works with `expo/fetch` (the DP1-02 lesson: a mocked Jest pass does not prove a native upload).
3. The consent wording is a v1 draft that counsel must review before release; a change means a new `CONSENT_VERSION`.
4. Owner answers still open: wording of "deleted as soon as the transcript is saved", whether the patient sees the transcript, retention, patient opt-out (plan section 15).
5. Android keyboard and microphone pass; device pass of the whole flow.
6. The full-suite Jest linger above (about five minutes) deserves its own look.
