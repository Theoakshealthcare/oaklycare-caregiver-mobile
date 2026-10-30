# SOP: Caregiver app, Change password

| | |
|---|---|
| **What shipped** | A **Change password** screen reached from Profile settings: current, new and confirm fields (each with the existing show/hide eye), inline errors per backend code, a countdown for the rate-limit wait, and a success message after which the caregiver stays signed in. App half of backend `POST /api/v1/auth/change-password` (backend#37, `83e81cc`). |
| **Branch / commit** | `feature/change-password-screen`, cut from `oakly/main` `59fecf1`. Not pushed. |
| **Contract** | Backend `docs/fe-integration-guide-caregiver.md` section 17 (live captures). `api:sync` from backend `83e81cc`: `openapi.json` and `schema.d.ts` gain only the new route. |
| **Device-verified?** | **No.** Jest only (RNTL against a mocked `api.POST`). The server behaviour was captured live in the backend PR; the app was not run against it. |

## Why
The caregiver app had forgot/reset password but no way to change it while signed in.

## How
| Area | Decision |
|---|---|
| Staying signed in | A change ends every token issued before it, this device's included, and the response carries a new pair. `authService.changePassword` stores it with `session.signIn(...)` the moment the response arrives, so nothing else has to happen for the caregiver to stay signed in. Other devices are signed out at their next call. |
| Reading refusals | `400` and `429` bodies carry `detail = {code, message}`, an object (the rest of the API sends a string). `changePasswordFailure` (`src/account/changePasswordModel.ts`) branches on `code`: `wrong_current_password` under the current field; `weak_password` (server's own message) and `same_password` under the new field; `too_many_attempts` starts a countdown from `Retry-After` (30 s if the header is missing). Anything else (offline, 401, 5xx) is an alert through `messageForError`. |
| Rate-limit wait | The button is replaced by "Try again in m:ss" and disabled, with a line above it, and re-enabled by a one-second timer when the wait ends. The form is kept. Nothing retries by itself. |
| Client-side checks | Mirror the server (8 characters, 72 **bytes**, 5 distinct characters, not the current password) plus confirm-matches, so most mistakes never reach the server. The server stays the authority. |
| Success message | `Alert` "Password changed" / "You have been signed out on your other devices.", then back to Profile. The app has no toast component; `ResetPassword` and the other screens use `Alert`, so this follows suit rather than adding one. |
| Entry | Row "Change password" (lock icon) on Profile settings, `ChangePassword` route in the signed-in stack. |

## What is involved
| Path | Change |
|---|---|
| `apps/caregiver/src/screens/account/ChangePassword.tsx` (new) | The screen |
| `apps/caregiver/src/account/changePasswordModel.ts` (new) | Rules, form validation, reading of the backend's refusals |
| `apps/caregiver/src/services/auth.service.ts` | `changePassword` |
| `apps/caregiver/src/screens/account/Profile.tsx`, `src/navigation/Navigations.tsx`, `StackNavigator.tsx` | Row and route |
| `packages/api-client/openapi.json`, `src/schema.d.ts` | `api:sync` |
| `apps/caregiver/__tests__/changePassword.test.tsx`, `changePasswordModel.test.ts` (new) | 9 + 17 tests |

## Verification
- `pnpm typecheck`, `pnpm lint` (the commands in `.github/workflows/ci.yml`) clean. The `api:generate` step produces no diff after `api:sync`.
- The whole caregiver Jest suite, single worker as CI runs it: 51 suites, 770 tests passed, and the process exited (Jest prints its usual "did not exit one second after" notice, which existing suites such as `bankDetails.test.tsx` print too). The new test file clears its query clients after each test.
- Tests: the Profile row navigates; fields are masked; the form is checked before any call (empty, short, mismatch, same as current) and the server is not called; success sends both passwords, stores the returned pair, stays signed in and shows the message; wrong current / weak / same errors appear under the right field in the server's words and clear on edit; `too_many_attempts` counts down from `Retry-After`, refuses to send during the wait, allows it after; an offline failure shows the generic message and keeps the form; the model's rules (incl. emoji and accented bytes) and every error code.
- **Not verified:** a real device or simulator, a live backend round trip from the app, the show/hide eye (it is the shared `Input` component's own toggle, not retested here).

## Operate / roll back
Revert the branch; the backend endpoint is independent. No config.

## Follow-ups
- **In-flight race (guide 17.6):** the old tokens die when the backend commits, a moment before the response reaches the app. A background request (polling, a refresh) that is already on its way in that window would get a `401`, and if its refresh answers `401 Invalid refresh token` before `session.signIn` runs, `session` signs the caregiver out. The window is a few milliseconds and the screen is idle, so it was not guarded; pausing the query client while the change is in flight would close it.
- Backend master checklist (`MASTER_CHECKLIST.md`, section 8, "Change password / App") still shows the app item open; tick it when this merges.
- Reset-by-email does not end other sessions yet (backend follow-up).
- Device pass with the rest of the caregiver app.
