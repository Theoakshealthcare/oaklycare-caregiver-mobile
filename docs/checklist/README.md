# Checklist

The single master checklist for all of Oakly (backend, caregiver app, admin console, WhatsApp
channel) lives in the backend repo: `docs/checklist/MASTER_CHECKLIST.md`. Update it there.

## Caregiver UI polish
- [x] Fixed, width-damped type scale and capped OS text scaling (2026-10-07, see docs/sop/2026-10-07-caregiver-typography-layout.md)
- [x] Onboarding Skip safe area, Login link on all slides, Back to home lands on Home
- [ ] Owner visual pass on device

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

## Caregiver KYC (Dojah, was Prembly until 2026-10-30)
- [x] K7a Identity step: route after Step 2, intro + consent, checking / verified / try again / under review / unavailable / expired / error states, `setupRouteFor` + gate tests (2026-10-30, branch `feat/kyc-mobile-screens`, see docs/sop/2026-10-30-caregiver-kyc-screens.md; Jest only, mocked service, **not device-verified**, off by default behind `EXPO_PUBLIC_KYC_MODE`)
- [ ] K7b Dojah widget in a dev build (`dojah-kyc-sdk-react-expo`, or react-native-webview as the fallback), camera permissions, server-minted reference, build recipe in the SOP (provider switched from Prembly to Dojah 2026-10-30; see backend `docs/plans/2026-10-30-caregiver-kyc-dojah-delta.md` once KD1 merges)
- [x] K6 Admin console: "Identity needs review" filter and badge, provider summary card, Verify / Fail, Allow another attempt (2026-10-30, branch `feat/kyc-admin-console`, see docs/sop/2026-10-30-admin-kyc-console.md; Vitest/RTL only, **no live browser pass**)
  - [x] `api:sync` from backend `6d7d315` (K5 merged); `identity` block, `needs_review_count` / `stuck_count`, `expected_status`, `identity-reset`
  - [x] Queue: chips Everyone / Identity needs review / stuck / failed (URL `identity=`), badges from the response counts, kept while another filter loads
  - [x] Detail Identity card: status, review reason in words, attempts used of max, attempts newest first (scores with pass mark, name / DOB match, ID type, reason codes in words, provider reference), link to the other caregiver
  - [x] Mark verified / Mark failed with required notes and `expected_status`; `IDENTITY_CASE_CHANGED` reloads and says so; Allow another attempt (only when `can_reset`, confirm + notes), `IDENTITY_RESET_NOT_ALLOWED` handled
  - [x] Read = `caregivers.read`, decide / reset = `caregivers.approve`
  - [ ] Live browser pass against a local backend; Playwright flow for review and reset
- [ ] K8 Device pass against sandbox keys (and one live-key check)
