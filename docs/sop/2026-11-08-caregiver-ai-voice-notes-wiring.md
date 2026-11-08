# SOP: Caregiver AI voice notes wired to the real backend routes (off by default)

| | |
|---|---|
| **What shipped** | The caregiver app's voice note flow (UI merged in #36) now has a real service: `realVoiceNoteService` calls the backend routes through the generated api-client; the recording is sent as a raw body by a new `uploadBytes` in the api-client. A third flag value, `EXPO_PUBLIC_VOICE_NOTES=live`, selects it. **The flag stays `off` by default**, so a normal build is unchanged until the backend is deployed and switched on. |
| **Branch / commits** | `feature/caregiver-ai-notes-wiring` on `oakly/main` `47f31ad`. Not pushed. Commit SHA in the lead report. |
| **Backend** | Routes come from backend branch `feature/ai-note-transcription` (migration `0025`), cut from the slice 2 branch. **Not merged.** `pnpm api:sync` was run against it, but that backend branch is cut from slice 2, and slice 2's schema changes (for example `short_visit_min_percent`) broke the admin console's typecheck here. So the committed `openapi.json` is **`oakly/main`'s spec plus only the voice note paths and schemas** (6 paths, 8 schemas, `Detail`): the app is independent of merge order. After both backend branches merge, a plain `api:sync` converges to the same voice note types. |
| **Device-verified?** | **No.** Jest only. Never run against a real backend, the real Gemini, or a phone. |
| **FE guide** | Backend `docs/fe-integration-guide-caregiver-ai-notes.md`, rendered from live captures; the fixtures here are copies of those captures. |

## Why
The UI was built first against a documented contract with a fake (#36). The backend is built; this swaps the fake for the real calls without changing a screen, and proves the app's wording and the fake still match what the backend actually answers.

## How (decisions)
| Area | Decision | Rejected / why |
|---|---|---|
| Types | `fromWire(Schemas["VoiceNoteOut"])` builds the app's `VoiceNote` (absent nullable fields become `null`, the failure code is narrowed). It takes the generated type as its parameter, so a backend rename breaks the build here. | Using the generated type directly: its nullable fields are optional, and every screen would need `?? null`. |
| Audio upload | New `uploadBytes(path, bytes, contentType)` in `@oakly/api-client`, built like `uploadMultipart`: plain `fetch(url, init)`, never a `Request`, bearer token, one refresh-and-retry on 401, `Content-Type` is the file's own. The file is read with `File.bytes()` **inside** the promise, so a read failure is an app failure ("Something went wrong"), not "Can't reach Oakly". | `api.PUT` with a typed body: openapi-fetch wraps it in a `Request`, the trap of DP1-02 (Jest passed, the device failed). Whether `expo/fetch` sends a `Uint8Array` body correctly on a device is **unproven** (see follow-ups). |
| Errors | The voice routes answer `{"detail": {"code", "message"}}`; `unwrap` keeps the body, `requestCodeOf` reads `detail.code`. A 422 (a list, no code) falls back to the general wording. | |
| Flag | `off` (default) / `fake` / `live`. `live` shows no "test mode" banner. | Turning `live` on by default: the backend is not deployed, and its own switch is off. |
| Fixtures | The backend's 40 captured responses are copied to `test-utils/voice-note-captures/` (README says where from). Tests assert the real service's calls against them, that **every captured error code has the app's exact sentence**, that the captured failure sentences match, and that the **fake answers the same fields as the real backend** in each state. | Hand-written response fixtures. |

## What's involved
| Path | What |
|---|---|
| `packages/api-client/openapi.json`, `src/schema.d.ts` | Synced from the backend branch (`OAKLY_BACKEND_DIR=... pnpm api:sync`), then reduced to main's spec plus the voice note additions (see above); `pnpm api:generate` reproduces `schema.d.ts` exactly |
| `packages/api-client/src/index.ts`, `test/client.test.ts` | `uploadBytes` and its tests (raw body through plain fetch, content type, refresh once, error body, offline) |
| `apps/caregiver/src/voiceNotes/realService.ts`, `service.ts`, `types.ts` | The real service, the factory (`live`), `fromWire` |
| `apps/caregiver/src/config/voiceNotes.ts` | `live` mode |
| `apps/caregiver/test-utils/voice-note-captures/`, `voiceNoteCaptures.ts` | The captured fixtures and their reader |
| `apps/caregiver/__tests__/voiceNotesRealService.test.ts`, `voiceNoteFlow.test.tsx` | New tests |

## Verification
| Check | Result |
|---|---|
| Frozen install, `api:generate` reproduces `schema.d.ts`, typecheck (all four packages), lint (0 errors), admin build | pass. Lint had 4 errors that blocked CI: 3 in the merged voice note UI (two unescaped apostrophes, an effect declared before the function it calls) and 1 in `BankDetails.tsx` (an unescaped apostrophe, from #35): all fixed here |
| Jest (caregiver, single worker) | **952 tests, 68 suites pass** (35 new: the real service against captures, errors, the app's copy against every captured error, the fake against the real field set, the factory, the banner); api-client 19 pass (2 new for `uploadBytes`). The process lingers about five minutes after the run (older suites' react-query timers; same with or without the new tests). `carePlanDetailsTasks` failed once under parallel load with a backend test run, and passed three times alone |
| **Not verified** | A device or simulator run; `expo/fetch` sending the raw audio body; a real backend; the real Gemini (and whether it accepts the phone's m4a); Android |

## Operate / roll back
- **Turn on:** build with `EXPO_PUBLIC_VOICE_NOTES=live`, pointed (`EXPO_PUBLIC_API_URL`) at a backend that has `VOICE_NOTES_ENABLED` on. Not before the backend is deployed and the live smoke has passed.
- **Roll back:** revert the branch; the flag is off by default so nothing else depends on it. The synced `openapi.json` and `schema.d.ts` revert with it.

## Follow-ups
1. **Merge order:** none required for the app (its spec holds only the voice note additions); the backend voice notes branch depends on slice 2 for the migration chain.
2. **Device proof** of the whole flow: the recorder file, the raw upload with `expo/fetch`, the file delete, the keyboard. A mocked Jest pass is exactly what failed in DP1-02.
3. **Live smoke** with the owner's Gemini key (backend follow-up 1): m4a acceptance decides whether the recorder preset changes or the backend transcodes.
4. Counsel review of the consent copy; owner answers (retention, patient transcript view, patient opt-out).
5. Android microphone and keyboard pass.
