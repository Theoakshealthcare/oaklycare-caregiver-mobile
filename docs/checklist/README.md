# Checklist

The single master checklist for all of Oakly (backend, caregiver app, admin console, WhatsApp
channel) lives in the backend repo: `docs/checklist/MASTER_CHECKLIST.md`. Update it there.

## Caregiver UI polish
- [x] Fixed, width-damped type scale and capped OS text scaling (2026-10-07, see docs/sop/2026-10-07-caregiver-typography-layout.md)
- [x] Onboarding Skip safe area, Login link on all slides, Back to home lands on Home
- [ ] Owner visual pass on device

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
