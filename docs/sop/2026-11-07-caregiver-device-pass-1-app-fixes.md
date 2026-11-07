# SOP: Caregiver app, device-pass-1 fixes (uploads, keyboard, note times, Home spinner)

| | |
|---|---|
| **What shipped** | Four app-side findings from the first simulator pass (device-pass-1, 2026-11-07, Release build): **DP1-02** (blocker) multipart uploads never left the device; **DP1-03** the keyboard covered inputs and primary buttons; **DP1-04** AI note times showed UTC as local; **DP1-07** Home went blank with a stuck spinner after returning from a visit or Notifications. |
| **Branch / commits** | `fix/dp1-upload-keyboard-home`, cut from `oakly/main` `312eaa5`. One commit per finding (a PR can be cut from each) plus a docs commit. Not pushed. |
| **Source** | `ledgers/LEDGER-device-pass-1.md`, rows DP1-02, DP1-03, DP1-04, DP1-07. |
| **Device-verified?** | **No.** Jest and node tests only; the simulator was in use by the Debug-build session. The re-check steps are at the bottom. |

## DP1-02 Multipart uploads (blocker)

**Why.** `openapi-fetch` turns every call into `new Request(url, { body })` and then calls `fetch(request)`. React Native's `Request` cannot carry a FormData whose file part is a `{ uri, name, type }` descriptor, so the call died before it left the device (the backend log showed no request). `unwrap` then mapped *any* thrown error to "Can't reach Oakly", which sent the owner chasing the network.

**How.**
| Area | Decision |
|---|---|
| Multipart path | `createOaklyClient` now also returns `uploadMultipart(path, formData, method?)` (`packages/api-client/src/index.ts`). It calls plain `fetch(url, { method, headers, body: formData })`: bearer token, `Accept: application/json`, and **no** `Content-Type` (fetch adds `multipart/form-data` with the boundary). |
| Auth | Same contract as the JSON client: one refresh-and-retry on 401 through `onUnauthorized`, the retry re-sends the same FormData (a file part is a descriptor, not a stream). Result shape matches openapi-fetch (`{ data }` / `{ error }` + `response`), so `unwrap` is unchanged for callers. |
| Callers | Every multipart endpoint the app uses: `caregiverService.uploadDocument` (licence) and `accountService.uploadProfileImage` (profile photo). A grep for `FormData` / `bodySerializer` finds no others in `apps/caregiver` or `apps/admin`; the schema's third multipart route (prescription doctor note) is not used by any app. `uploadMultipart<T>` takes the response type from the generated schema. |
| Error mapping | `unwrap` (`src/api/unwrap.ts`) now says "Can't reach Oakly" only for a `TypeError` (what `fetch` rejects with when the request never completed). Any other throw becomes `ApiError` with status `-1` (`CLIENT_FAILURE_STATUS`) and the generic "Something went wrong. Please try again." An existing `ApiError` passes through. A server refusal (400, 413, ...) was already mapped by status and still is. |
| Rejected alternative | Patching the `Request` polyfill or adding a React Native `Request` shim: fragile across SDK upgrades. Bypassing the Request object for the one body type that breaks is smaller and testable. |

**Tests.** `packages/api-client/test/client.test.ts` (node:test): `fetch` is called with a string URL, not a `Request`, `init.body` is the FormData, auth is set, no Content-Type; 401 refreshes once and re-sends the same form; a non-2xx returns its error body; a fetch rejection passes through untouched. `apps/caregiver/__tests__/multipartUpload.test.ts`: both services reach global `fetch` as `(url, init)` with a FormData body (this **fails if a FormData body is routed through a Request**), the network message appears only when `fetch` rejects, a 400 shows the server's detail. `__tests__/errors.test.ts`: a non-fetch failure is not the network message.

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
| `packages/api-client/src/index.ts`, `test/client.test.ts` | `uploadMultipart` + 3 tests |
| `apps/caregiver/src/api/unwrap.ts`, `errors.ts` | Network vs client failure; `CLIENT_FAILURE_STATUS`, exported `FALLBACK_MESSAGE` |
| `apps/caregiver/src/services/caregiver.service.ts`, `account.service.ts` | Use `api.uploadMultipart` |
| `apps/caregiver/src/components/ui/keyboard-scroll-view.tsx`, `keyboard-inset-view.tsx` (new) | Shared keyboard wrappers |
| `ScreenShell.tsx`, `ChangePassword.tsx`, `VisitFlow.tsx`, `CreateAccount.tsx`, `CaregiverSetupStep1/2.tsx`, `AINoteTaker.tsx`, `ChatScreen.tsx` | Switched to the wrappers |
| `apps/caregiver/src/screens/home/Home.tsx` | `pulling` state, `testID="home-scroll"` |
| `__tests__/multipartUpload.test.ts`, `keyboardInset.test.tsx`, `noteTimestamps.test.tsx` (new); `errors.test.ts`, `home.test.tsx` | Tests |

## Verification
- `pnpm typecheck` clean (api-client, caregiver, admin). `pnpm lint` reports 28 problems (1 error, 27 warnings), all in lines this change did not touch (the error is `BankDetails.tsx:186`); the files touched here carry 3 warnings, all on untouched lines (`AINoteTaker.tsx:45`, the `Select` import name in onboarding steps 1 and 2).
- `packages/api-client` node tests: 12 passed. Caregiver Jest, whole suite, single worker (`--maxWorkers=1`), foreground, on the final branch: 54 suites, 784 tests passed, process exited 0 (no `--forceExit`). Jest may print its "did not exit one second after" notice and wait up to ~5 minutes to exit, because suites that build a React Query client leave its default 5-minute cache-gc timer pending; this predates the change (the Home test client now sets `gcTime: Infinity` as a first step).
- The timestamp test was mutation-checked: with `AINoteTaker` reverted to `new Date(created_at)` it fails, with the fix it passes.
- **Not verified:** a real device or simulator, a real upload to the backend (the licence was never exercised live from the app), Android keyboard behaviour (the iOS inset prop is a no-op on Android; the wrapper keeps `KeyboardAvoidingView` only on chat).

## Operate / roll back
Revert the commit for the finding; the four are independent. No config, no backend change.

## Re-verify on a device (iPhone simulator, same Release build as device-pass-1)
1. **DP1-02:** sign up or use an incomplete caregiver > Onboarding step 2 > "Upload Certifications" > pick a PNG from Files. Expect "Uploaded" and a backend log line `POST /api/v1/caregiver/documents/upload`. Then Profile > change photo: expect the new photo. Turn Wi-Fi off and upload again: expect the "Can't reach Oakly" alert, and only then.
2. **DP1-03:** tap into Sign-up Password, Onboarding step 1 House Address, Care plan > Notes box, Chat message box, Change password Confirm, the visit code (4 digits). The focused field must stay visible, the primary button (Create account, Change password, Start visit, Submit Observation) must be visible or reachable by a short scroll with the keyboard up, and the chat composer must sit directly on top of the keyboard and drop back when it is dismissed.
3. **DP1-04:** during a visit open Visit notes > add title and note > Save. The saved note shows the Lagos time (11:56, not 10:56).
4. **DP1-07:** open a visit (or Notifications) and press Back to Home. Home shows immediately with no spinner and no grey gap. Pull down on Home: the spinner shows and then clears.

## Follow-ups
- Android keyboard behaviour (edge-to-edge): not exercised; revisit with the first Android pass.
- DP1-05 (visit rules) and DP1-06 (decline semantics) need owner decisions and are not part of this change.
- A global `gcTime` fix for the test query clients (or a shared test helper) would remove the 5-minute exit wait for every suite.
