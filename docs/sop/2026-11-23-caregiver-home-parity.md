# SOP: Caregiver Home, profile menu and visit dialogs match the Figma exports

| | |
|---|---|
| **What shipped** | The caregiver Home screen (header, week strip, Upcoming Appointments with Clock in / Clock out, New Job Request, Earning Summary, Notification, Client Care Access), the Profile Settings menu, a new Account and Data page, the Figma confirmation dialogs (decline, clock in, clock out) in place of native alerts, the full-page "clocked out" success, the green "Payment Details has been updated" toast, and the Cookies Policy link. |
| **Branch / PR** | `feat/caregiver-home-parity`, monorepo PR (see the PR for the number); first stacked on slice 1, rebased onto `main` after #50 merged (239615d). |
| **Why** | Owner demands exact Figma parity. The read-only audit is `ledgers/PARITY-caregiver.md` (sections A, B, D); this change closes the Home, nav, Profile and visit-dialog rows. Slice 1 (onboarding) was PR #50. |
| **Not verified** | **On a device.** Jest, `tsc --noEmit` and ESLint only; nothing ran on a simulator or phone. Layout, spacing, the dialogs' look and the week strip all need an owner look. |

## How (and what was decided)
| Area | What changed | Decision / reason |
|---|---|---|
| Home header | Round menu button top left (opens Profile Settings), bell top right, "Hello Julius, 👋", "What do you like to do today ?". The avatar-initial button is gone. | Figma draws no drawer, so the menu goes to the one menu the app has. Subtitle spacing before "?" is copied (the export uses it everywhere). |
| Weekly Availability | Month title, green switch, five-day strip (today in the middle, two days either side). The not-approved, stale-location and "Allow location" warnings sit under the strip. | The server holds one availability switch, not one per day, so the strip is a calendar only. Today ± 2 matches Figma (Mon 28 … Fri 2 with Wed 30 selected). |
| CarePlan card | Coral card with "Create Care Plan" (opens the Care plans hub). Only when the server says `can_author_care_plans` (nurses). | Replaces the old "Care plans" row. Figma's sentence is a patient-style line; "Lets" is fixed to "Let's". Owner to confirm the wording suits a nurse. |
| Upcoming Appointments | One list with a count badge (today's visits, then later ones). Today's visits carry **Clock in** (accepted / on the way) and **Clock out** (in progress); the unusable one is dimmed. Tapping the card opens the booking. Empty: "You do not have any appointments". | Avatar is the patient's initial: the home response has no photo. Figma's empty line "Click on start booking to book appointments for your loved ones" tells a patient to book; a caregiver cannot, so it reads "Accepted visits will appear here." |
| New Job Request | Count badge; each row has Accept and Decline pills; tap opens the job. Titled by the service ("Nurse visit"). | The home response carries no patient field before accept (backend rule), so no first-name-and-initial can be shown. See follow-ups. |
| Earning Summary | "Wallet Balance" and "Pending Payment" from the existing home and wallet endpoints; "On hold (under review)" appears only when something is held. Tap opens the Wallet. | Figma says "Weekly Earning": no endpoint returns a weekly figure, so that row is not drawn (nothing invented). The held row is kept because a short visit's pay is held and the caregiver must see it. |
| Notification | Unread count, newest notification, "10 Min Ago" style time, "See all >". Left out when there are none. | From the existing notifications list. |
| Client Care Access | "Clients Profiles - View" opens the client profile of the live visit (else the first accepted one) and is dimmed with a one-line reason when there is none; "Vitals & FallGuard - View" opens the Vitals tab. | The backend serves a client profile only while a visit is accepted, on the way or in progress. There is no clients list endpoint. |
| Bottom navigation | Label "Booking" becomes "Bookings". Still three tabs. | Chats has no list endpoint (chat is per booking only) and Learn has no backend: no dead tabs. |
| Profile Settings | Title, "Verified User" under the name, rows Edit Personal Information, Payment & Earnings, Care Plan (nurses only), About Us, FAQs, Security (the old Change password), Contact Us, Account and Data, in Figma order. | Live Chat, Refer and Earn, Complaints are not built, so they are not drawn. Logout and Delete account moved from the menu to **Account and Data** (`screens/account/AccountData.tsx`), as in Figma; the alerts and wording are unchanged. Figma titles that page "Edit Profile" (same as the personal-information page); it is titled "Account and Data" like the row that opens it. |
| Dialogs | One `ConfirmDialog` (`components/ui/confirm-dialog.tsx`): Close, optional picture or timer, green title, grey text, "No, Go Back" (filled) and the outlined confirm. Used for decline (Home and Bookings, `DeclineDialog`), clock in and clock out. | Decline confirm reads "Yes, Decline" as the lead specified (Figma's frame says "Yes, Cancel"). "Bookings" typo fixed. The dialog also says the decline is final (DP1-06) and, for clock out, the pay-held-for-review notice, the care plan reminder with a "Review care plan" link, and the location-sharing line, so no existing safeguard was dropped with the native alerts. |
| Clock in | After the caregiver types the 4-digit code and taps Start visit, a dialog with a 00:00:00 timer asks "Yes, Clock in"; only then is the code sent. | The patient's code is still the proof of arrival: Figma's dialog has no code box, so it confirms the step instead of replacing it. A wrong code still counts toward the 3-try lock. |
| Clock out | Complete visit opens the clock-out dialog with a running timer (time since the code was accepted). Home's Clock out opens the visit with that dialog already up. | The start time is only known if the app saw it (`visitStarts`); after a restart the dialog shows no timer rather than a made-up one (backend gap, TODO in `visit/visitFlow.ts`). |
| Clocked-out page | Full page: green check, "You have successfully clocked out of your appointment", "You have ended your morning/afternoon/evening appointment" (from the visit's start hour; no word when unknown), Close at the top left. Under it, the earning-under-review line for a short visit or "Thank you", and "Location sharing has stopped". | "Your have" typo fixed. |
| Toast | Saving the bank account also shows the green toast "Payment Details has been updated". The existing banner stays: it carries the 24-hour payout pause notice. | |
| Cookies Policy | `COOKIES_URL` (https://www.oaklycare.com/cookies, from the owner) in `config/contact.ts`; the "Cookies Policy" words on sign-up and the consent screen are now `LegalLink`s like Terms and Privacy. | Lead's addition, 2026-11-23. |

## What's involved
- New: `components/ui/confirm-dialog.tsx`, `components/booking/DeclineDialog.tsx`, `components/home/HomeBlocks.tsx`, `home/homeBlocks.ts`, `visit/clockTimer.ts`, `screens/account/AccountData.tsx`.
- Changed: `screens/home/Home.tsx`, `screens/account/{Profile,BankDetails}.tsx`, `screens/visit/{VisitFlow,VisitSteps}.tsx`, `screens/booking/CaregiverBookings.tsx`, `screens/auth/CreateAccount.tsx`, `screens/setup/ConsentScreen.tsx`, `components/ui/legal-link.tsx`, `constants/offerCopy.ts`, `config/contact.ts`, `navigation/{Navigations,StackNavigator,BottomNavigation}.tsx` (new `AccountData` route; `VisitFlow` takes `clockOut`).
- No backend, API or migration change.

## Verification
- New `__tests__/homeParity.test.tsx` (helpers, dialog, clock-in dialog, Clock out shortcut). Updated: `home`, `account` (Profile and Account and Data), `profileLinks`, `changePassword`, `carePlanClockOut`, `shortVisit`, `visit`, `navigationFixes`, `bankDetails`, `termsPrivacyLinks`.
- Ran only the tests of the touched files and the suites that reference the changed symbols, single worker; `tsc --noEmit` clean; ESLint clean on the touched files except two warnings that were already there (`BottomNavigation` effect, a duplicate import in `visit.test`). CI runs the rest. No test asserts formatted clock text.

## Operate / roll back
Revert the PR. To restore the old Profile menu rows, move the two rows back from `AccountData`.

## Follow-ups
- **Owner decisions:** the CarePlan card wording for a nurse; "Yes, Decline" vs Figma's "Yes, Cancel"; the Account and Data page title; whether Home's menu button should open a drawer rather than Profile Settings.
- **Needs backend:** Profile Completion card (Home is only reachable once approved, so nothing is in progress, and the profile has no completion percentage); a weekly earning figure; a patient first name and last initial on an offer; a Chats list; the clients list behind "Clients Profiles"; `actual_start_time` on the booking so the clock-out timer survives a restart.
- Not built (no backend or switched off by the owner): Chats and Learn tabs, Live Chat, Refer and Earn, Complaints, calling.
- Not in this slice: Bookings cards, Job Details, the Notifications screen ("Notification", "Today" grouping, "No Notification" state), Wallet and Edit Profile screens, vitals and care plan screens.
- Device pass for all of the above.
