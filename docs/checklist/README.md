# Checklist

The single master checklist for all of Oakly (backend, caregiver app, admin console, WhatsApp
channel) lives in the backend repo: `docs/checklist/MASTER_CHECKLIST.md`. Update it there.

## Caregiver iOS dev loop
- [x] iOS **Debug** build links and runs on the simulator with Metro hot reload; one script, `pnpm --filter oaklycare-caregiver-mobile ios:debug dev` (2026-11-07, branch `chore/ios-debug-build`, see docs/sop/2026-11-07-caregiver-ios-debug-build.md). A JS edit shows on the simulator in seconds without a rebuild; no Release workaround, no manual `React.framework` copy
- [ ] Physical iPhone build and signing (this script is simulator only)

## Caregiver UI polish
- [x] Fixed, width-damped type scale and capped OS text scaling (2026-10-07, see docs/sop/2026-10-07-caregiver-typography-layout.md)
- [x] Onboarding Skip safe area, Login link on all slides, Back to home lands on Home
- [ ] Owner visual pass on device

## Device pass 1 app fixes (2026-11-07)
- [x] DP1-02 (blocker), **corrected 2026-11-07**: PR #19's upload fix failed on the simulator (`expo/fetch` rejects the `{ uri, name, type }` file part, `Unsupported FormDataPart implementation`) and broke the network message (RC1-01). Fixed on `fix/dp1-upload-expo-fetch`: shared `filePart` with `bytes()` for both builders, `isNetworkFailure` classifier; **proved on the simulator** (licence 200, photo reaches the backend against a local Cloudinary stub, "Can't reach Oakly" for login and upload with the backend stopped); see docs/sop/2026-11-07-caregiver-device-pass-1-app-fixes.md
- [x] DP1-03: shared `KeyboardScrollView` (sign-up, onboarding 1-2, care-plan details/notes via ScreenShell, change password, visit code, AI notes) and iOS keyboard-inset chat root
- [x] DP1-04: AI note times parsed as UTC through `parseBackendDate`
- [x] DP1-07: Home pull-to-refresh spinner follows only a user pull, not the focus refetch
- [x] Device re-check of DP1-03/04/07 passed (re-check 1); DP1-02 re-proved after its correction
- [ ] Android keyboard pass; patient app to adopt `filePart` and `isNetworkFailure` when it gets uploads
- [ ] DP1-05 (visit rules) and DP1-06 (decline semantics): owner decisions pending

## Caregiver vitals (Client care v1, part 1)
- [x] Vitals tab: six-vital grid for the patient on the in-progress visit; "available during an active visit" on 403 or before the visit starts (2026-10-27, see docs/sop/2026-10-27-caregiver-vitals-tab.md)
- [x] Per-vital chart (Day / Week / Month) and history; manual entry for all six (glucose mg/dL / mmol/L with RBS / FBS / PP); report download then native share, temp file deleted
- [x] No blank tab: each tab carries its page; Fall tab says "coming soon"
- [x] Vitals polish (2026-10-30, see docs/sop/2026-10-30-caregiver-vitals-home-polish.md): blood pressure chart as bars from the bottom to the top number; "View all History" screen (every reading on record, grouped by day); sleep entry and chart confirmed already shipped
- [x] Home polish (2026-10-30): visit address on each visit row; wallet card opens Wallet and shows pending earnings
- [ ] Home gaps that need backend or a design answer: week strip ("Weekly Availability"), weekly earnings summary
- [ ] Critical / Normal chips (needs clinical sign-off and a status in the API)
- [ ] Insights (clinical and privacy sign-off)
- [ ] Live check against the backend and a device pass (share sheet, entry modal keyboard)
- [ ] FallGuard report (needs a source of incidents)

## Caregiver client profile (Client care v1, part 2)
- [x] Client profile screen from Job details (live visit only): name, age, sex, latest vitals, medical history if stored, emergency contact with call, Add notes (2026-10-27, see docs/sop/2026-10-27-caregiver-client-profile.md). Stacked on the Vitals tab PR; needs the backend endpoint
- [x] Care plan summary row on the client profile (2026-10-28, care plans M1, see docs/sop/2026-10-28-caregiver-care-plans-hub.md)
- [ ] FallGuard entry (no source)
- [x] Full `api:sync` from backend `main` (2026-10-28, care plans M1)
- [ ] Device pass

## Caregiver care plans (backend B1-B4 merged; mobile M1-M3)
- [x] M1 Hub, create, details, goals (2026-10-28, branch `feat/caregiver-care-plans-hub`, see docs/sop/2026-10-28-caregiver-care-plans-hub.md; Jest only, **not device-verified**)
  - [x] Home "Care plans" card from the server field `can_author_care_plans`
  - [x] Hub: Assigned / Templates tabs, search, Active / Completed filter, "Create New Care Plan"
  - [x] Template preview and client picker; create form (pre-filled from a template) and success page
  - [x] Care Plan Details accordions: client profile, goals (add / edit / achieve / discontinue), allergies and special instructions
  - [x] Edit plan sheet (diagnosis, risk, dates, complete, archive) with `expected_version` and conflict recovery
  - [x] Client profile "Care plan" row: Open / Create / Use a template; read-only for non-nurses
  - [x] Spec wording for 404, `client_not_identified`, `not_a_nurse`, `care_plan_exists`, `version_conflict`
  - [ ] Native date picker; task time in the create form; device pass
- [x] M2 Daily tasks, ticks, add task, notes and observations, View Progress (2026-10-28, branch `feat/caregiver-care-plans-tasks`, stacked on M1, see docs/sop/2026-10-28-caregiver-care-plans-tasks.md; Jest only, **not device-verified**)
  - [x] Daily care tasks section: Mon-Sun tabs around the server's "today", tasks by slot with times, "done by name, time"
  - [x] Tick / untick: never optimistic, confirm before unticking, every refusal handled (visit not in progress, midnight, not scheduled, plan closed, 404)
  - [x] Add New Task modal (nurses only) and the shared success page
  - [x] Notes and observations, and special notes under Allergies: newest first, keyset paging, append-only wording, text kept on failure
  - [x] View Progress screen (from the details header and the hub cards): "No visits yet" instead of 0%
  - [x] "Add notes before you finish?" prompt before Complete visit; never blocks completing
  - [ ] Edit / remove a task (nurse); native time picker; device pass
- [x] M3 Medications: list, Add Medication form and success page, the "not clinical advice" notice (2026-10-29, branch `feat/caregiver-care-plans-meds`, see docs/sop/2026-10-29-caregiver-care-plans-medications.md; Jest only, **not device-verified**)
  - [x] "Medication schedules" section on Care Plan Details, never collapsed so the notice is always on screen; active first, stopped greyed under "Stopped"
  - [x] Add Medication (nurses only, from `can_edit_plan`): name, strength, dose, route, reason, prescriber, how often, times, dates, notes; checked before sending; success page
  - [x] Record only: no reminders, no "given" ticks, no due or overdue, nothing calculated from a time (design D4)
  - [x] A test pins the notice to the wording in the committed OpenAPI spec
  - [ ] Edit and stop a medication (backend routes exist; not drawn in the design); native date and time pickers; device pass
  - [ ] Clinician sign-off of the notice wording (go-live gate; one string, `MEDICATION_NOTICE`)
- [ ] Clinical sign-off of seeded templates and copy (go-live gate)

## Caregiver change password
- [x] Change password screen from Profile settings: current / new / confirm, inline errors per backend code, Retry-After countdown, stays signed in on the returned tokens (2026-10-30, branch `feature/change-password-screen`, see docs/sop/2026-10-30-caregiver-change-password.md; Jest only, **not device-verified**; backend endpoint is backend#37)
- [ ] Device pass; pause the query client during the change (tiny in-flight 401 window, see the SOP follow-ups)

## Caregiver bank account
- [x] Payment details screen: bank picker, name confirmation, add/change, 24 h pause notice, legacy re-verify (2026-10-19, see docs/sop/2026-10-19-caregiver-bank-account.md)
- [x] Wallet shows "payouts paused until ..."
- [ ] Device check against live Paystack

## Admin console: payouts (A3 slice 2 UI)
- [x] Nav entry "Payouts" gated by `payments.read` (what the backend enforces for reads) (2026-10-19)
- [x] Batches list (status filter, paging) and batch detail with its payouts
- [x] Approve batch (confirm dialog re-reads the batch and shows count + total) and Cancel batch
- [x] All payouts list filtered by status; per-payout Cancel / Retry / Resolve (outcome + reason + `force`)
- [x] Needs-attention queue and frozen-caregiver view with Unfreeze (shortfall debit / write-off explained)
- [x] Actions hidden without their permission; Vitest/RTL for every state and action
- [x] Finance sees Approve batch / Cancel batch / Cancel payout only (`payouts.execute`); Retry, Resolve and Unfreeze need `ledger.adjust` (Super Admin only). Follows backend Theoakshealthcare/backend#17 (2026-10-19), see docs/sop/2026-10-19-admin-payouts-console.md
- [ ] Backend: a frozen-caregivers list/filter so the frozen view is not derived from a 200-payout window
- [ ] Live Paystack account exercised (guide §12.11 captures use a local fake)
- [ ] Playwright e2e for the payouts flow

## Admin console: bookings operations (A2 UI)
- [x] Nav "Bookings" (`bookings.read`) and "Unmatched" (dispatch/assign/address) (2026-10-19, see docs/sop/2026-10-19-admin-bookings-ops-console.md)
- [x] Bookings list: search, status/payment/dispatch/channel/city/date filters, address-check and no-show toggles, paging, masking markers
- [x] Unmatched queue with reason filter and explanations
- [x] Booking detail: visit, people, address, clinical (gated), price and payment, no-show, dispatch waves/offers, timeline; never polled
- [x] Actions from `available_actions` only: re-dispatch, assign (force for Super Admin), reassign, cancel (refund choice + policy guide), confirm address, flag no-show, correct status
- [ ] Live browser pass against the local backend
- [ ] Backend: cancel terms on the admin detail so the policy guide is exact
- [ ] Booking-policy edit screen, audit log screen, Overview attention panel

## Admin console: refunds (A3 slice 3 UI)
- [x] Nav "Refunds" for `refunds.request` / `refunds.approve` / `payments.read` (2026-10-27, see docs/sop/2026-10-27-admin-refunds-console.md)
- [x] Queue: default open, status filter, paging, total; raise a refund by booking id (`refunds.request`)
- [x] Refund detail: amounts in naira, booking link, attempts (holder fields blank for roles without access), review flag, take-back preview and debited/owed
- [x] Actions only from `available_actions`: approve (lower amount, never above `max_approvable_naira`, wallet for a Super Admin on app bookings, take-back with reason), reject, retry, bank details (10 digits, only last four shown), switch to wallet, close, resolve (different-amount second call)
- [x] Rules shown as UI text (Finance cumulative limit, Super Admin above it or for wallet, staff-raised needs another approver); Vitest/RTL for every state and action
- [ ] Live browser pass against the local backend
- [ ] Playwright e2e for approve and bank details
- [ ] Live Paystack account and real WhatsApp delivery (guide §12.12 captures use a local fake)
- [ ] Backend: admin bank list for a picker, and admin names for `requested_by` / `approved_by`
- [ ] "Raise a refund" from the booking detail; `above_limit` and `reason_code` queue filters

## Caregiver chat and calling
- [x] Call buttons hidden: the Call screen is a mock, so no entry point shows until masked calling exists (2026-10-30, `CALLING_ENABLED = false` in `src/config/calling.ts`, see docs/sop/2026-10-30-caregiver-calling-hidden.md)
- [ ] Masked calling (backend + app), then set `CALLING_ENABLED = true`

## Caregiver KYC (Dojah, was Prembly until 2026-10-30)
- [x] K7a Identity step: route after Step 2, intro + consent, checking / verified / try again / under review / unavailable / expired / error states, `setupRouteFor` + gate tests (2026-10-30, branch `feat/kyc-mobile-screens`, see docs/sop/2026-10-30-caregiver-kyc-screens.md; Jest only, mocked service, **not device-verified**, off by default behind `EXPO_PUBLIC_KYC_MODE`)
- [x] K7b Launch the hosted Dojah page from the app (2026-10-30, branch `feat/kyc-mobile-launch`, see docs/sop/2026-10-30-caregiver-kyc-launch.md; Jest only, **not device-verified**, needs a new dev build with `expo-web-browser`; still off by default behind `EXPO_PUBLIC_KYC_MODE`). The app does **not** use Dojah's native SDK: it opens the page the backend hosts (`widget_url`, slice KD2) with `openAuthSessionAsync` and learns the result only by polling
  - [x] Browser launcher (`src/identity/browserWidgetLauncher.ts`): https-only url, return `oaklycarecaregivermobile://kyc/return`, redirect = hint `completed`, cancel / dismiss / locked = `dismissed` (not a failure), native error = `error`
  - [x] Checking state: "Still checking..." copy after a minute, polling cadence and 5-minute stop unchanged, "Continue verification" after a dismissal (same open attempt; never once the server has heard `completed`)
  - [x] Prembly wording removed from the consent draft (names Dojah; text version unchanged until counsel signs off)
  - [x] `api:sync` from backend `780563f` (KD2 merged): `widget_url` is generated; widget block reshaped (`app_id`, `public_key`, `reference_id`), `session_id` dropped from the hint
  - [ ] Device pass: camera inside the browser session on iOS and Android, the redirect back, Continue verification (K8)
- [x] K6 Admin console: "Identity needs review" filter and badge, provider summary card, Verify / Fail, Allow another attempt (2026-10-30, branch `feat/kyc-admin-console`, see docs/sop/2026-10-30-admin-kyc-console.md; Vitest/RTL only, **no live browser pass**)
  - [x] `api:sync` from backend `6d7d315` (K5 merged); `identity` block, `needs_review_count` / `stuck_count`, `expected_status`, `identity-reset`
  - [x] Queue: chips Everyone / Identity needs review / stuck / failed (URL `identity=`), badges from the response counts, kept while another filter loads
  - [x] Detail Identity card: status, review reason in words, attempts used of max, attempts newest first (scores with pass mark, name / DOB match, ID type, reason codes in words, provider reference), link to the other caregiver
  - [x] Mark verified / Mark failed with required notes and `expected_status`; `IDENTITY_CASE_CHANGED` reloads and says so; Allow another attempt (only when `can_reset`, confirm + notes), `IDENTITY_RESET_NOT_ALLOWED` handled
  - [x] Read = `caregivers.read`, decide / reset = `caregivers.approve`
  - [ ] Live browser pass against a local backend; Playwright flow for review and reset
- [ ] K8 Device pass against sandbox keys (and one live-key check)

## Patient app (moved into the monorepo as `apps/patient`; plan from the 2026-11-07 audit, ledger `LEDGER-patient-audit.md` §5)
Owner decisions (2026-11-07): move the old app into the monorepo on SDK 57, copied without git history, using the generated `packages/api-client`; v1 sign-in is email + password only; WhatsApp parked (the app sits beside it later); in-app chat IN; patient wallet HIDDEN (card per booking via Paystack); FallGuard IN; nutritionist, physio, prescriptions, video call, AI note taker, ratings hidden or deferred. Screen map of the 51 owner designs: `LEDGER-patient-screens.md` (outside the repo).
- [x] P0 Decisions: repo move, v1 scope, sign-in (2026-11-07)
- [x] P1a Foundation shell (2026-11-07, branch `feature/patient-app-foundation`, see docs/sop/2026-11-07-patient-app-foundation.md; Jest only, **not device-verified**)
  - [x] `apps/patient` on Expo SDK 57 / RN 0.86 (same versions as the caregiver app), app identity "Oakly Health", slug `oakly-patient`, `com.oakly.oaklypatient`, scheme `oaklypatient`
  - [x] Secure-store session, single-flight refresh (a 401 on the refresh call = logout), React Query client, typed api-client with `EXPO_PUBLIC_API_URL`
  - [x] Auth gate (loading / error / signed out / wrong account / verify email placeholder / app), Login (email + password), placeholder Home from `/auth/me`, Logout clearing keychain and query cache
  - [x] RNTL tests: gate table, session state machine, App boot / login / wrong account / logout, refresh failure through the real client
  - [x] No MMKV, no hard-coded key, no `android/`, no keystore, no `.env`; CI covers the new app through `pnpm -r`
  - [ ] Device pass (iOS and Android) of login / home / logout
- [ ] P1b Port the UI kit, navigation and the live screens from the old app as-is (delete the 4.4k dead lines; one generic FallGuard question screen), against the designs
- [ ] P2 Security: archive the old repo and rotate the old upload key (owner: was `com.oakly.oaklypatient` ever published, is the old repo public?); full logout also unregisters push
- [ ] P3 Auth correctness: register (email only), verify email, forgot to reset with a deep link (decide link vs OTP and the scheme in the reset email), change password, delete account with the 409 text, profile edit refetches `/auth/me`
- [ ] P4-BE Backend: `GET cancel-terms` + `POST cancel` with fee tiers, cancel/refund state on the booking, FE guide with live captures
- [ ] P5 Booking complete: booking detail with the **visit code**, all statuses and `dispatch_state`, cancel with fee confirm, payment polling cap and resume
- [ ] P6 / P6-BE Vitals fix: insights shape, caregiver access list/grant/revoke (backend patient-id vs user-id bug at `vitals.py:151,164,180`)
- [ ] P7 / P7-BE FallGuard tidy: align types, score computed server-side
- [ ] P8-BE / P8 Patient notifications feed + push for app bookers, real Home, Expo push token (owner: Apple / FCM keys)
- [ ] P9 Live tracking (GET + WS) and chat (poll first)
- [ ] P10-P12 Nutritionist / physio, wallet / support, prescriptions / video call / AI note taker / ratings / care-plan view: hidden or deferred per the owner's v1 scope
- [ ] P13 Tests per slice, device pass, EAS builds, TestFlight / Play internal track (owner: Apple / Google accounts)
- [ ] Theme aligned to the designs (primary about `#3D8082`, coral about `#EB695A`; the shell still carries the caregiver tokens; owner to confirm, see `LEDGER-patient-screens.md` §6 Q4)
- [ ] Extract shared auth / theme / ui package (the shell was copied from the caregiver app on purpose; two copies of `session.ts`, `errors.ts`, theme and ui primitives now exist)
- [ ] Production font licence check for GT Walsheim Pro (the files were copied from the caregiver app)

