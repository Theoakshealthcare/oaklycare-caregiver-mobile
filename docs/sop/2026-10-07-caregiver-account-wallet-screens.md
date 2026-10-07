# SOP: Caregiver account, wallet and notifications screens

| | |
|---|---|
| **Date** | 2026-10-07 |
| **Branch** | `feat/caregiver-account-wallet-screens` (from monorepo `main` `8267a0b`) |
| **Builds on** | [Supply SOP](2026-10-06-caregiver-supply.md): `api`, query hooks, `ApiError` / `messageForError`, `authService.logout`, Home |
| **Backend contract** | Backend `docs/fe-integration-guide-caregiver.md`, sections 7 (notifications) and 10 (wallet); the generated `@oakly/api-client` schema for the rest |
| **Design** | `ss/caregiver` screenshots 08 to 12, 16, 18 (layout and teal style only) |

## What shipped
Everything below is reachable from Home: the **bell** opens notifications, the **avatar** opens the profile menu (it used to sign out directly).

| Screen | Route | Endpoints |
|---|---|---|
| Notifications (list, empty state, pull to refresh) | `Notifications` | `GET /booking/caregiver/notifications` |
| Profile settings menu | `Profile` | `GET /auth/me` (name, email, photo) |
| Edit profile (+ photo) | `EditProfile` | `GET /caregiver/profile`, `PUT /auth/profile`, `PUT /caregiver/profile/step1` (state only), `POST /auth/profile/upload-image` |
| Logout, Delete account | `Profile` rows | `DELETE /devices/push-token` (best effort), `DELETE /auth/profile` |
| Payment & earnings | `Wallet` | `GET /caregiver/wallet`, `GET /caregiver/wallet/transactions?month=`, `GET /caregiver/wallet/payslip?month=`, `GET /caregiver/bank-account` |
| Payment details | `BankDetails` | `GET` and `PUT /caregiver/bank-account` |
| Get directions | `BookingDetails` | none (coordinates from the booking already loaded) |
| About us, FAQs, Contact us | `About`, `Faq`, `Contact` | none (static) |

## Why
The app had no way to see notifications, edit a profile, see earnings or leave the account, and Home's avatar signed out with no menu. These are the "quick wins" that only need endpoints that already exist.

## How
| Decision | Choice | Why |
|---|---|---|
| Units | Wallet endpoints are integer **kobo**; `formatKobo()` divides by 100. `/caregiver/home` stays naira. | Guide section 10 / 12. |
| Transactions | Fetched per month (`?month=YYYY-MM`, default current month, 6-month picker), grouped by **Africa/Lagos** day (today / yesterday / dated) by `groupTransactions()`. A pending withdrawal reads "Withdrawal requested". | The backend has no payout process; "pending" never becomes "paid" yet. Lagos day matches the home endpoint's definition of a day. |
| No Withdraw button | `POST /caregiver/wallet/withdraw` exists but is not used. The screen says earnings appear after completed visits are credited and are paid out on a schedule. | Owner decision: scheduled payouts only. Credits (A3) are not built, so balances are 0 today. |
| Payslip | `getPayslipCsv()` reads the body as **text** (`parseAs: "text"`; the schema types it `unknown`), `sharePayslip()` writes `payslip_<month>.csv` to the cache with `expo-file-system` (`File`/`Paths`) and opens `expo-sharing`. | The endpoint answers CSV, not JSON. Cache + share sheet needs no storage permission. |
| Bank account | Free-text `bank_name`, `account_number` (10 digits), `account_name`: exactly `CaregiverBankAccountUpdate`. 404 on GET means "none yet" (`null`), not an error. | The schema needs no bank code, so the form is built. **Nothing is verified against a bank**: no bank list and no account-name lookup exist; the form says so. |
| Edit profile | Name, phone, address, gender, date of birth, emergency phone through `PUT /auth/profile` (only changed, non-empty fields: the backend ignores empties). `state` is not part of that endpoint, so a changed state goes through `PUT /caregiver/profile/step1` with all five fields. Email is shown read-only. | Verified in the backend source (`auth.py` `update_profile`). Neither call changes `profile_status`. |
| Left out of Edit profile | Password change; emergency contact name and address; age. | No change-password endpoint (the `password` field of `PUT /auth/profile` exists but needs no old password, so it is not exposed); the caregiver profile read does not return emergency name/address, so they could not be prefilled; the backend ignores `age`. |
| Photo | `expo-image-picker` (added), square crop, `POST /auth/profile/upload-image` multipart with a hand-built `FormData` and no Content-Type header, as for document upload. | Same pattern as `uploadDocument`. Answers `{ profile_image_url }` (backend source; the schema types it a free object). |
| Logout / Delete | Both behind a confirm `Alert`. Delete states it is permanent and cannot be undone. `authService.deleteAccount()` forgets the push token **first**, then `DELETE /auth/profile`, then signs out, so a failed delete leaves the caregiver signed in with an error shown. | The backend hard-deletes with no password check and no undo. |
| Notifications | An item with no `caregiver_id` opens as an **offer** (`toOffer`), otherwise by id. | Offer-view rule: patient data is null before accept, and `GET /booking/{id}` is 403 for an un-accepted job. |
| Directions | `directionsTarget()` returns coordinates only for `accepted`, `en_route`, `in_progress` with finite, non-0,0 coordinates; `buildDirectionsUrl()` gives an Apple Maps URL on iOS, a Google Maps directions URL elsewhere, opened with `Linking`. The old inline `maps.google.com` link was replaced. | The button now hides itself rather than opening a wrong location. |
| Static content | FAQ questions come from the design; answers, the About copy and the WhatsApp number are placeholders marked `CONTENT: owner to supply` (`src/content/faq.ts`, `src/content/about.ts`, `src/config/contact.ts`). WhatsApp shows "Not available yet" while the number is empty. | Nothing invented that looks real. |

## What's involved
- New: `src/screens/account/*` (Notifications, Profile, EditProfile, Wallet, BankDetails, About, Faq, Contact), `src/components/account/*`, `src/services/{wallet,notification,account}.service.ts`, `src/wallet/{walletModel,payslip}.ts`, `src/utils/maps.ts`, `src/config/contact.ts`, `src/content/*`.
- Changed: `Home.tsx` (bell + avatar to Profile), `BookingDetails.tsx` (directions), `auth.service.ts` (`deleteAccount`, shared `forgetPushToken`), `hooks/queries.ts`, `api/keys.ts`, `navigation/{Navigations,StackNavigator}.tsx`.
- Dependencies (`npx expo install`, SDK 57 aligned): `expo-file-system ~57.0.7`, `expo-sharing ~57.0.22`, `expo-image-picker ~57.0.20`; config plugins `expo-sharing` and `expo-image-picker` (photo permission text) in `app.json`. **These are native modules: a new dev build is needed before they work on a device.**

## Verification
- Jest (RTL, services mocked as in the existing tests): loading, empty, error (with retry) and success states for notifications, edit profile, wallet and bank details; delete-account confirmation (consequence text, cancel does nothing, failure keeps the session); `deleteAccount` call order; payslip share call and its failure paths; maps URL builder and the directions button; pull to refresh; static screens.
- CI reproduced locally exactly as `.github/workflows/ci.yml`: frozen install, `api:generate` with no diff, typecheck, lint, test, admin build: all green.
- **No device or simulator run** (owner rule). Not verified live: the native share sheet, the image picker, the maps hand-off, and the backend response of delete/upload against a real server (shapes come from the generated schema and backend source, not a capture).

## Operate / roll back
No backend or migration change. Revert the branch; remove the three packages and the two plugin entries from `app.json` if backing out the native modules.

## Follow-ups
- Owner: FAQ answers, About copy, WhatsApp number.
- Backend: bank list + account-name resolve (then replace the free-text bank fields), type `/auth/profile/upload-image`, `DELETE /auth/profile` and the payslip response in OpenAPI, return emergency contact name/address on the caregiver profile read, and confirm `DELETE /auth/profile` for a caregiver who has bookings or transactions (foreign keys).
- A3 (crediting earnings) so the wallet is non-zero.
- Rows left out because the feature does not exist: Live chat, Care plan, Refer and earn, Complaints, Security, Account and data.
