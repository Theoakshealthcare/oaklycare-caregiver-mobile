# SOP: Patient app UI port and auth wiring (P1b + P3)

| | |
|---|---|
| **What shipped** | `apps/patient` now has the v1 navigation tree (intro, auth stack, four tabs, stacks for booking, bookings, tracking and chat, vitals, FallGuard, profile), a small UI kit, **one sample-data hook per screen** so later slices swap a hook and not a screen, and the **auth flows wired to the backend** through `@oakly/api-client`: register, verify email (5 digits) with resend, login, forgot password, reset (behind one adapter), plus real **delete account** and logout. |
| **Branch / commits** | `feature/patient-ui-port-auth`, cut from `oakly/main` `93cea8b`. Not pushed. Commits are listed in the PR / lead report. |
| **Device-verified?** | **No.** Jest only (RNTL against a fake `fetch`). Nothing was built, run in a simulator or called against a live backend; no layout has been looked at on a screen. |

## Why
P1a landed a shell (login and a placeholder home). The owner wants a usable patient test build within about two days. This slice puts the whole v1 UI in place from the owner's 51 designs (`LEDGER-patient-screens.md`, "build now" rows) and makes the sign-up path work end to end, so the remaining slices are "replace one hook with a real query".

## How
| Area | Decision |
|---|---|
| Navigation | Same libraries and pattern as `apps/caregiver`: `@react-navigation/stack` plus a custom floating bottom bar (no pager and no new native module, so the existing dev build still runs it). Tabs, in the designs' order: Home, Booking, Vitals, Fall. Profile opens from the Home menu icon, notifications from the bell. |
| One list of routes | `src/navigation/routes.ts` holds `AUTH_SCREENS`, `APP_SCREENS`, `VERIFY_SCREENS`; the navigator registers exactly those, and `v1Routes.test.tsx` pins them. A screen outside v1 cannot be reached by registering a route elsewhere. |
| Gate | The auth gate keeps the foundation's table. `verifyEmail` now renders the real verify screen under its own route name `GateVerifyEmail`: the root navigation state outlives a gate switch, and a shared name carried the verify screen into the signed-out stack after "Use a different account" (found by a test). |
| Intro | Four slides, once per install. The only extra thing on the device besides tokens is the flag `oakly.onboarding_seen` in secure-store; sign-out leaves it alone. |
| Brand | Caregiver theme tokens (`#168283` / `#FD5E52`), caregiver typography scale (`theme.sizes`, no raw font sizes), GT Walsheim families. Design hexes were not used (owner decision). Pill buttons, 16 px inputs, dark floating tab bar (`theme.colors.dark`). |
| Sample data | `src/hooks/use*.ts` return `useFixtureQuery` results (`src/hooks/fixture.ts`) over `src/fixtures/*`; a screen sees `{ data, isLoading, isError, refetch }` exactly as a real query. Mutation hooks edit the sample cache in place (cancel, add vital, send chat, create booking). Every such screen draws `SampleNotice` ("shows sample information, not connected to your account yet"); **a screen without that notice shows real data**, so the slice that wires a screen deletes that one line. The cache is cleared on sign-out. |
| Fixes of the design mistakes (LEDGER §5) | Units: heart rate `bpm`, blood pressure `mmHg`, temperature `°C`, respiratory `breaths/min`, glucose `mg/dL`, sleep `hrs` (a test pins them and bans "bpr", "mgd/dl"). "Last synced" is "Last entry". Currency is `₦250,000`. Typos not copied ("Agin", "Hompage", "Forget Password", "Recieve", "Referal"). No "Critical" chips (the caregiver checklist already says they need clinical sign-off). FallGuard shows no per-option scores. |
| Left out on purpose (not reachable, tested) | Wallet, reschedule, provider list and "Change Care Provider", prescriptions, nutritionist, physio, ratings, drug reminders, family details, subscriptions, referrals, video call, AI note taker, call buttons, voice note, support chat / WhatsApp row, wearables, Heart Alerts, caregiver access-request modal, "Enter Booking Code", Request Refund, photo upload (upload fix is in flight on `fix/dp1-upload-expo-fetch`), share/download of the vitals report and FallGuard result. |

## Auth wiring (what the backend really does, read from `backend/app/api/v1/endpoints/auth.py` at `de0a0fa`)
| Flow | Call | Real answers surfaced |
|---|---|---|
| Register | `POST /auth/register` `{ email, password, full_name, user_type: "patient" }` (no phone: email path only) | **400** `A user with this email already exists` (it is a 400, not a 409); **422** shows the first pydantic `msg`. The answer has no tokens, so the person verifies and then signs in. The backend sets no password rule; the app asks for 8+ characters. |
| Verify email | `POST /auth/verify-email` `{ email, code }`, 5 digits, auto-submits on the last digit | **400** `Invalid verification code` (wrong or expired, 10 min); boxes clear. |
| Resend | `POST /auth/resend-verification` `{ email }`; 30 s cooldown after a code was sent; none right after a login that landed on the verify step | **400** `Email already verified`, **404** `User not found`, and a **429 with `Retry-After`** becomes "try again in N seconds" plus a disabled `Resend code (Ns)`. **The backend sends no 429 on this route today** (no rate limit exists on verify or resend); the 429 path is tested against a fake header, **not** a live response. |
| Login | `POST /auth/login/mobile` then `GET /auth/me` before the session opens (foundation); non-patient refused; `is_verified: false` lands on the verify step | 401 "Incorrect email or password." |
| Forgot password | `POST /auth/password-recovery`; the backend answers 200 for any email, so the app always moves to the reset step and never says whether the email has an account | Network failure shown. |
| Reset | `authService.resetPassword({ code, newPassword })` in `src/services/auth.service.ts` is **the single adapter**: it calls today's `POST /auth/reset-password` with `{ token: code, new_password }` | **400** `Invalid token` / `Invalid or expired token` shown as sent. |
| Delete account | `DELETE /auth/profile`, then sign out | **409** with the backend's sentence shown in the dialog; stays signed in. |
| Logout | `session.signOut()` clears memory, secure-store and the query cache (unchanged from the foundation) | |

### Reset password cannot finish end to end yet
The screen asks for the 5-digit code, but the backend still emails a **long token in a link** (`oaklycare://reset-password?token=...`) and today's route takes that token, so a typed 5-digit code is answered `400 Invalid token`. This is the known gap the queued backend reset-by-code slice closes. **When it lands, change only `resetPassword` in `auth.service.ts`** (new route or body); the screen, its error handling and the tests' wording stay, only the expected request body in `authFlows.test.tsx` changes. Until then, treat password recovery as **not usable** in a test build (a long token cannot be typed into five boxes).

## What's involved
| Path | What |
|---|---|
| `apps/patient/src/components/ui/*` | Kit: button (primary / outline / danger / light, small), input (password eye), icon, screen + header, card / chip / detail row / empty state, segmented control, confirm dialog, OTP boxes (one hidden input, paste and one-time-code work), chip select (date and time without a native picker), menu row, text link, sample notice, `KeyboardScrollView` and `KeyboardInsetView` (copied from the caregiver app, DP1-03; **not device-checked here**) |
| `apps/patient/src/navigation/{Navigations,routes,Tabs,StackNavigator,gate}.ts*` | Param lists, route lists, tab bar, gate-driven stacks |
| `apps/patient/src/screens/{auth,home,booking,tracking,vitals,fall,profile}/` | 30 screens |
| `apps/patient/src/domain/*`, `src/fixtures/*`, `src/hooks/use*.ts`, `bookingDraft.ts`, `useCooldown.ts` | Types and pure helpers, sample data, one hook per data need |
| `apps/patient/src/auth/onboarding.ts` | "Intro seen" flag |
| `apps/patient/src/api/errors.ts`, `unwrap.ts` | `Retry-After` wording on 429, `register` context |
| `apps/patient/src/services/auth.service.ts` | register, verify, resend, request reset, `resetPassword` adapter, delete account |
| `apps/patient/assets/images/{tabs,onboarding,pngs}` | Tab icons, intro art and FallGuard art copied from the old app (images only) |
| `apps/patient/__tests__/*`, `test-utils/*` | 73 tests |
| `docs/checklist/README.md` | Patient section |

## Verification
- `tsc --noEmit`, `expo lint`: clean. No api-client or spec change, so no `api:sync`.
- Jest, single worker, foreground, **no `--forceExit`**: 8 suites, **73 tests passed** and the process exited on its own (about 6 s). New: `authFlows` (register happy / client checks / 400 duplicate / 422; verify happy / digits-only / 400 wrong code / resend / 429 / already verified / right code through the gate; forgot; reset happy / client checks / backend 400 / network), `authGate` (intro once, login, logout via the menu, caregiver refused, restore, unverified gate), `v1Routes` (the pinned route list, the four tabs, a text scan of tabs, menu and edit profile for out-of-v1 words), `appScreens` (bookings tabs and actions, visit code rules, cancel with the fee shown first, booking flow, track and chat, vitals units and entry and ranges, FallGuard, profile, delete account 409 and success), `domain`.
- Test bodies are typed placeholders; **none is a captured live response**, so this is not an FE integration guide. A live capture of register / verify / resend / forgot / delete against the running backend is still owed.
- **Not verified:** any device or simulator, layouts and fonts on screen, the keyboard helpers on a phone, Android, a live backend call of any flow, the 429 on resend (no such backend behaviour yet), email delivery of the verification code.

## Operate / roll back
`pnpm patient` with `EXPO_PUBLIC_API_URL`. Revert the branch to go back to the shell. No backend or api-client change.

## Follow-ups (per slice; each replaces one hook and removes one `SampleNotice`)
| Slice | Hook(s) to replace |
|---|---|
| Booking (P5) | **Done** on `feature/patient-booking`, see `2026-11-07-patient-booking-wiring-and-device-proof.md` (all six hooks replaced, Paystack in the system browser, location, chip dates). "Enter Booking Code" stays deferred. Open: a fresh payment link and address geocoding on the backend |
| Tracking and chat (P9) | `useChat`, `useSendMessage`, the status steps; the live map and its native module |
| Vitals (P6) | `useVitalReadings`, `useAddVital`, `useVitalAccess`, `useSetVitalAccess` (backend patient-id bug); insights, glucose sub-fields and sleep start/wake, report download |
| FallGuard (P7) | `useFallguardQuestions` (fixture holds 6 of the 24), `useSubmitFallguard` (server score), history screen |
| Notifications (P8) | `useNotifications` |
| Profile | `useUpdateProfile` (`PUT /auth/profile` then re-read `/auth/me`), change password screen (`POST /auth/change-password`, copy the caregiver screen), FAQs and About (owner copy needed), Terms / Privacy / Cookies links (URLs needed), photo upload (after the upload fix) |
| Backend | reset by 5-digit code (then edit `resetPassword`); rate limit and `Retry-After` on verify and resend |
| Open owner questions still unanswered | visit code direction (the app shows the code to read out, as the backend works today), booking language / gender / "immediate" fields (dropped), FallGuard history screen, share/download of results |
