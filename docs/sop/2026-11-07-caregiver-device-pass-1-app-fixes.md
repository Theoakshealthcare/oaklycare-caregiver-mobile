# SOP: Caregiver app, device-pass-1 fixes (uploads, keyboard, note times, Home spinner)

| | |
|---|---|
| **What shipped** | Four app-side findings from the first simulator pass (device-pass-1, 2026-11-07, Release build): **DP1-02** (blocker) multipart uploads never left the device; **DP1-03** the keyboard covered inputs and primary buttons; **DP1-04** AI note times showed UTC as local; **DP1-07** Home went blank with a stuck spinner after returning from a visit or Notifications. |
| **Branch / commits** | `fix/dp1-upload-keyboard-home` (PR #19, merged), cut from `oakly/main` `312eaa5`. **DP1-02 was corrected afterwards** on `fix/dp1-upload-expo-fetch` (see the DP1-02 section): PR #19's upload fix did not work on a device. |
| **Source** | `ledgers/LEDGER-device-pass-1.md`, rows DP1-02, DP1-03, DP1-04, DP1-07. |
| **Device-verified?** | DP1-03, DP1-04, DP1-07: yes (`ledgers/LEDGER-device-recheck-1.md`, all PASS). **DP1-02: PR #19's version FAILED on the simulator** (re-check 1); the corrected version is proven on the simulator (`ledgers/device-upload-fix/`). |

## DP1-02 Multipart uploads (blocker), corrected after the device re-check

> **PR #19's account of this fix was wrong.** It blamed React Native's `Request` and moved the body out of it, and it was merged on mocked Jest tests. The first real simulator run (`ledgers/LEDGER-device-recheck-1.md`, DP1-02 a/b/c, RC1-01) showed both uploads still failed and the network message had stopped appearing at all. This section replaces that account. Rule from this: anything that crosses the React Native native boundary is not fixed until it has run on the simulator.

**Root cause (proven on the device).** In an Expo app the global `fetch` is **`expo/fetch`** (installed by `expo/src/winter/runtime.native.ts`), not React Native's. Its `convertFormDataAsync` (`expo/src/winter/fetch/convertFormData.ts`) accepts a part that is a string, a `Blob`, or **an object with a `bytes()` method**. The classic React Native file part `{ uri, name, type }` is none of those, so `fetch` threw `Error: Unsupported FormDataPart implementation` while building the body, before any request was made (the backend log showed nothing; Metro showed the warning). `Request` was never the problem. Two things hid it: Jest mocks `fetch`, and `unwrap` then reported the failure as a generic error.

**RC1-01 (introduced by #19).** #19 made `unwrap` say "Can't reach Oakly" only for a `TypeError`. `expo/fetch` does not reject with a `TypeError`: a refused connection or being offline rejects with a plain `Error` whose message starts `fetch failed:` (Metro: `Error: fetch failed: UnexpectedException: Could not connect to the server.`). So the network message never appeared, not even for login.

**How it is fixed.**
| Area | Decision |
|---|---|
| File part | `filePart(file, readBytes)` in `packages/api-client/src/index.ts` returns `{ uri, name, type, bytes() }`. `name` and `type` become the part's filename and Content-Type (expo reads them off the object); `bytes()` reads the file only when the request is sent. The reader is injected so the package has no native dependency. `appendFilePart(form, field, part)` does the `Blob` cast in one place. |
| App wiring | `apps/caregiver/src/api/filePart.ts`: `appendPickedFile(form, field, file)` = `filePart` + `(uri) => new File(uri).bytes()` from `expo-file-system`. **Both** builders use it: `buildDocumentForm` (`caregiver.service.ts`) and `buildImageForm` (`account.service.ts`). |
| Transport | Unchanged from #19: `uploadMultipart` in `packages/api-client` calls plain `fetch(url, { method, headers, body: formData })`, bearer token, **no** manual `Content-Type` (fetch adds the boundary), one refresh-and-retry on 401 re-sending the same FormData. |
| Classifier | `isNetworkFailure(error)` (same file) decides "the request never completed": RN fetch `TypeError: Network request failed` / `timed out`; `expo/fetch` `Error: fetch failed: ...` (not its own "operation was aborted"); undici `TypeError: fetch failed`; browser `Failed to fetch` / `Load failed`. `unwrap` uses it; everything else becomes `ApiError` status `-1` ("Something went wrong"), so a client bug such as the FormData error never says "Can't reach Oakly". |
| Alternatives rejected | Sending `new File(uri)` directly (what the experiment did): works, but takes `name`/`type` from the file system (type is not what the picker reported) and is not testable under Jest; an object with `bytes()` keeps the picker's values and a fakeable reader. Patching `Request` or `fetch`: fragile across SDK upgrades. A `.ts` split of the helper files: the apps' `tsconfig` (expo base) does not allow `.ts` import extensions and `node --test` needs them, so the helpers live in `index.ts`. |

**For the patient app (and any new app).** Build every multipart file with `appendFilePart`/`filePart` and `new File(uri).bytes()`; never `form.append("file", { uri, name, type })`. Use `isNetworkFailure` in its `unwrap` (the patient app's `settle` currently maps every throw to the network message, which is wrong in the other direction). Short note in `packages/api-client/README.md`.

**Tests.** `packages/api-client/test/networkFailure.test.ts` (node:test): the classifier against the exact shapes above (including the Metro line from the device and `Unsupported FormDataPart implementation` as a non-network error) and `filePart`. `apps/caregiver/__tests__/expoFormData.test.ts`: the builders' output goes through **expo's real `convertFormDataAsync`** (loaded with `jest.requireActual("expo/src/winter/fetch/convertFormData")`, React Native's FormData patched by expo's own `installFormDataPatch`): the old `{ uri, name, type }` part throws `Unsupported FormDataPart implementation` (this guards the bug), the new parts yield a multipart body with the right filename, Content-Type, text field and the file's bytes. `__tests__/errors.test.ts`: the `expo/fetch` shapes map to status 0 + network message; the FormData error and a stray `TypeError` map to status -1. Existing `multipartUpload.test.ts` still covers the plain-fetch transport. **What Jest cannot cover:** `NativeRequest.start` (the native request) and the real `File.bytes()`; the file read is faked in Jest. Those are covered by the simulator run below.

**Simulator proof** (iPhone 17 Pro, iOS 26.2, Debug build via `ios-debug.sh dev --clean`, Metro without `CI`, `EXPO_PUBLIC_API_URL=http://localhost:8001`; backend `oakly/main` `de0a0fa` on :8001, scratch Postgres 16 and Redis 7; screenshots and logs in `ledgers/device-upload-fix/`):
| Check | Result |
|---|---|
| Licence upload, onboarding step 2, 51 KB PNG (`02-licence-upload-result.png`) | Alert "Uploaded: Your document was uploaded. An admin will review it."; backend log `POST /api/v1/caregiver/documents/upload 200`; the file on the server has the same SHA-256 as the source file (51385 bytes), so the bytes arrive intact. |
| Profile photo, Edit profile > Upload image, library photo (`04-profile-photo-result.png`) | `POST /api/v1/auth/profile/upload-image 200`; the photo shows on the profile. **Cloudinary was a local stub**: the backend's Cloudinary SDK was pointed at a scratch HTTP stub through `CLOUDINARY_URL` with `upload_prefix` (the stub returns a fixed URL), so this proves the app-to-backend leg, not a real Cloudinary account. |
| Backend stopped, Login (`01-offline-login-cant-reach-oakly.png`) | "Login failed: Can't reach Oakly. Check your internet connection and try again." (RC1-01 fixed.) |
| Backend stopped, licence upload (`03-offline-upload-cant-reach-oakly.png`) | "Upload failed: Can't reach Oakly. ..." (The file was read first, so the failure is the network one, not the FormData one.) |

## DP1-03 Keyboard handling

**Why.** Only Login fit: the scroll screens had no keyboard inset, so the focused field (sign-up password, house address, care-plan note box) or the primary button (Change password, Start visit, Submit Observation) sat under the keyboard. Chat already had a `KeyboardAvoidingView`, but it measures its frame once on layout, and in a stack screen that happens mid-transition, so its padding was wrong and the composer sat under the keyboard.

**How.**
| Area | Decision |
|---|---|
| Shared scroll wrapper | `src/components/ui/keyboard-scroll-view.tsx`: a `ScrollView` with `automaticallyAdjustKeyboardInsets` (iOS insets itself by the keyboard and scrolls the focused field into view), `keyboardShouldPersistTaps="handled"` (a button tap works with the keyboard open) and `keyboardDismissMode` interactive (iOS) / on-drag. Optional `scrollToEndOnKeyboardShow` scrolls to the bottom when the keyboard opens, so a button under the last field lands above it. |
| Where used | `ScreenShell` (so Care plan details and its notes, Edit profile, Bank details, Wallet screens), Change password and Visit flow (visit code + Start visit), both with `scrollToEndOnKeyboardShow`; Sign-up, Onboarding step 1 and 2, AI note taker. |
| Chat | `src/components/ui/keyboard-inset-view.tsx`: on iOS it pads the bottom by how far the keyboard's top edge is above the window bottom (from the `keyboardWillChangeFrame` event, minus the home-indicator inset the app root already pads), instead of a measured frame. Hidden keyboard = 0 (the reported `height` stays full when it slides away, so the top edge is used). Other platforms keep `KeyboardAvoidingView`. The message list scrolls to the latest message when its height changes. |
| Not changed | `ModalFrame` (care-plan sheets) already had `keyboardShouldPersistTaps`; its keyboard overlap was not reported in the ledger and was left alone. Login is untouched (fits). |

**Tests.** `__tests__/keyboardInset.test.tsx`: the wrapper's props, the iOS padding arithmetic (300pt keyboard, 34pt inset = 266) and the return to 0. Layout on a real keyboard is **not** testable in Jest; that is the device re-check.

## DP1-04 AI note times

**Why.** The API sends UTC timestamps without a "Z". `new Date("2026-11-07T10:56:00")` reads that as device-local, so a note saved at 11:56 in Lagos was listed as 10:56. Every other screen already used `parseBackendDate` (`src/utils/dates.ts`); `AINoteTaker.tsx` was the only raw `new Date(created_at)` left (a grep for `new Date(` over `src/` finds no other backend timestamp parsed raw).

**How.** `AINoteTaker` now calls the shared `parseBackendDate`. **Tests.** `__tests__/noteTimestamps.test.tsx`: a naive and a Z-suffixed string give the same UTC instant, an offset string too; `formatVisitTime` shows 11:56 for 10:56Z in Lagos; the AI note list renders both note kinds at the UTC instant. The assertions pin the instant, not formatted text, so they hold on a UTC CI runner (where local and UTC agree and a text assertion would pass for the bug).

## DP1-07 Home blank area and stuck spinner

**Why.** `RefreshControl.refreshing` was `home.isRefetching`. Returning to Home runs `useFocusEffect` -> `refetch()`, which flipped `isRefetching` with no user pull; the native refresh control then started its own animation/offset and stayed stuck, pushing the content down ~700px.

**How.** `Home.tsx` keeps a local `pulling` flag that is true only between a user pull (`onRefresh`) and the end of that refetch. The focus refetch and the polling refetch stay silent. **Tests.** `__tests__/home.test.tsx`: `refreshing` stays false while the focus refetch is pending and after it finishes; a pull sets it true and it clears when the refetch ends. The Home query client in that file now uses `gcTime: Infinity` (see Verification).

## What is involved
| Path | Change |
|---|---|
| `packages/api-client/src/index.ts`, `test/client.test.ts`, `test/networkFailure.test.ts` | `uploadMultipart` + 3 tests (#19); `filePart`, `appendFilePart`, `isNetworkFailure` + tests (correction) |
| `apps/caregiver/src/api/unwrap.ts`, `errors.ts` | Network vs client failure (`isNetworkFailure`); `CLIENT_FAILURE_STATUS`, exported `FALLBACK_MESSAGE` |
| `apps/caregiver/src/api/filePart.ts` (correction) | `appendPickedFile`: `filePart` + `expo-file-system` `File.bytes()` |
| `apps/caregiver/src/services/caregiver.service.ts`, `account.service.ts` | Use `api.uploadMultipart` and `appendPickedFile` |
| `apps/caregiver/src/components/ui/keyboard-scroll-view.tsx`, `keyboard-inset-view.tsx` (new) | Shared keyboard wrappers |
| `ScreenShell.tsx`, `ChangePassword.tsx`, `VisitFlow.tsx`, `CreateAccount.tsx`, `CaregiverSetupStep1/2.tsx`, `AINoteTaker.tsx`, `ChatScreen.tsx` | Switched to the wrappers |
| `apps/caregiver/src/screens/home/Home.tsx` | `pulling` state, `testID="home-scroll"` |
| `__tests__/multipartUpload.test.ts`, `keyboardInset.test.tsx`, `noteTimestamps.test.tsx`, `expoFormData.test.ts` (new); `errors.test.ts`, `home.test.tsx` | Tests |

## Verification
- `pnpm typecheck` clean (api-client, caregiver, admin). `pnpm lint` reports 28 problems (1 error, 27 warnings), all in lines this change did not touch (the error is `BankDetails.tsx:186`); the files touched here carry 3 warnings, all on untouched lines (`AINoteTaker.tsx:45`, the `Select` import name in onboarding steps 1 and 2).
- `packages/api-client` node tests: 12 passed. Caregiver Jest, whole suite, single worker (`--maxWorkers=1`), foreground, on the final branch: 54 suites, 784 tests passed, process exited 0 (no `--forceExit`). Jest may print its "did not exit one second after" notice and wait up to ~5 minutes to exit, because suites that build a React Query client leave its default 5-minute cache-gc timer pending; this predates the change (the Home test client now sets `gcTime: Infinity` as a first step).
- The timestamp test was mutation-checked: with `AINoteTaker` reverted to `new Date(created_at)` it fails, with the fix it passes.
- DP1-02 correction: `pnpm typecheck` and `pnpm lint` clean for all workspaces; api-client node tests 17 passed; caregiver Jest for the touched suites (`expoFormData`, `errors`, `multipartUpload`) 26 passed, single worker, foreground, exit 0.
- **Not verified:** Android (keyboard behaviour; and an upload from a `content://` document-picker uri, which `File.bytes()` was not exercised on), a real Cloudinary account (the photo leg ran against a local stub), a large (multi-MB) file: `bytes()` reads the whole file into memory before sending.

## Operate / roll back
Revert the commit for the finding; the four are independent. No config, no backend change. (Reverting the DP1-02 correction restores the broken upload.)

## Re-verify on a device (iPhone simulator, same Release build as device-pass-1)
1. **DP1-02 (done on the simulator, see above):** sign up or use an incomplete caregiver > Onboarding step 2 > "Upload Certifications" > pick a PNG from Files. Expect "Uploaded" and a backend log line `POST /api/v1/caregiver/documents/upload`. Then Profile > change photo: expect the new photo. Turn Wi-Fi off and upload again: expect the "Can't reach Oakly" alert, and only then.
2. **DP1-03:** tap into Sign-up Password, Onboarding step 1 House Address, Care plan > Notes box, Chat message box, Change password Confirm, the visit code (4 digits). The focused field must stay visible, the primary button (Create account, Change password, Start visit, Submit Observation) must be visible or reachable by a short scroll with the keyboard up, and the chat composer must sit directly on top of the keyboard and drop back when it is dismissed.
3. **DP1-04:** during a visit open Visit notes > add title and note > Save. The saved note shows the Lagos time (11:56, not 10:56).
4. **DP1-07:** open a visit (or Notifications) and press Back to Home. Home shows immediately with no spinner and no grey gap. Pull down on Home: the spinner shows and then clears.

## Follow-ups
- Android keyboard behaviour (edge-to-edge): not exercised; revisit with the first Android pass.
- DP1-05 (visit rules) and DP1-06 (decline semantics) need owner decisions and are not part of this change.
- A global `gcTime` fix for the test query clients (or a shared test helper) would remove the 5-minute exit wait for every suite.
