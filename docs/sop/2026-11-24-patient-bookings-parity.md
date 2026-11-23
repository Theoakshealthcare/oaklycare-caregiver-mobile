# SOP: Patient Bookings area matches the Figma exports (slice 3)

| | |
|---|---|
| **What shipped** | The Bookings list (provider photo, name, Track chip, month heading and week strip), the Booking Details bottom sheet, the cancel dialogs, Caregiver Details (tracking) and the chat now follow the Figma frames in `ss/patient` (1.14.47, 1.15.13, 1.17.20, 1.19.00). |
| **Branch / PR** | `feat/patient-bookings-parity`, monorepo PR (see the PR for the number). |
| **Why** | The owner demands exact parity with the designs. Audit rows: `ledgers/PARITY-patient-A.md` gap rows 8, 9, 10, 17, 18, 19, 20, 35 and `PARITY-patient-B.md` rows 40, 41 (11 to 16, 21, 22 are unbuilt features and stay off). |
| **Verified** | **iOS simulator only** (iPhone 17 Pro, Debug build, scratch local backend with bookings seeded in every state, fake Paystack, no real e-mail or key). Screenshots in `ledgers/sim-patient-3/`. Jest for the files touched and the tests that pin them, `tsc --noEmit`, ESLint. **Nothing was seen on Android or a real phone.** |

## What the backend gives, and what was built from it
| Figma | Data | Built? |
|---|---|---|
| Provider photo, name, role | `caregiver_details.profile_image_url`, `full_name` (first name only, as before), `specialization` | Yes. The photo is shown only when it is an `https` address; otherwise (or if it fails to load) a letter tile. Role falls back to "Health Care Provider" |
| "Today, 2:00 PM · 1 hour" | `scheduled_date`, `duration_minutes` | Yes (`src/domain/bookingList.ts`; the design's "1hour" is spaced) |
| Month heading and date strip | the bookings' dates | Yes: a Monday-to-Sunday week, tap a day to filter, tap again to clear, a dot on days with bookings, arrows to change week. Local state only |
| Track | `status` accepted / en_route / in_progress | Yes: the chip on the card; on Caregiver Details a teal "Track" button opens the phone's maps app (the in-app map stays off: no maps key) |
| Booking Details rows | the booking (`booking_code`, status, price from `total_amount`, `payment_status`) | Yes; refund and fee text comes from the server |
| Cancel dialogs | `cancel-terms`, `cancel` (unchanged); fee text from the server | Restyled only |
| Stage cards "Caregiver is 20 min away" | live-tracking ETA, only when the position is fresh (not stale) | Yes; no stage is invented |
| "Enter Booking Code" | none: no endpoint claims a booking by a code | **Not built** (link stays off) |
| Nurse prescription note after a visit | none visible to the family | **Not built** |

## How
- `ProviderAvatar` (new) draws the photo or the letter tile; the mapper (`bookingMapper.ts`) now carries `photoUrl` and `role`.
- Booking Details and Cancel are registered as **transparent modal** routes (`StackNavigator.tsx`) over a new `Overlay` (dim backdrop, white card, `bottom` sheet or `center` dialog). Two rules found on the simulator: (1) a page pushed on top of a transparent one is drawn as an offset card, so the sheet and dialog **replace** themselves when they open another page (Track, Chat, Pay now, Cancel, Contact); (2) navigating to `Tabs` from the dialog also left the list drawn offset, so "Back to Bookings" simply goes back.
- Teal header: the Bookings and Chat screens ask for a teal status strip (`useTopBand`), and `MainApp` draws the status bar light while that strip is teal.
- `SegmentedControl` gained `tone="onTeal"` (white track, teal pill) for Bookings; Vitals keeps the default.
- `Card` now applies its `accessibilityLabel` also when it is not pressable (the list card is `Booking <code>`, which the tests find).

## What's involved
`src/screens/booking/{Bookings,BookingDetails,CancelBooking}.tsx`, `src/screens/tracking/{CaregiverDetail,Chat}.tsx`, `src/components/booking/ProviderAvatar.tsx`, `src/components/ui/{overlay,segmented-control,card}.tsx`, `src/domain/{booking,bookingList}.ts`, `src/services/bookingMapper.ts`, `src/navigation/StackNavigator.tsx`, `MainApp.tsx`. Tests: `__tests__/bookingsList.test.ts` (new), and edits to `bookingFlows`, `trackingChat`, `notifications`, `push` (new wording: "Booking Details", "Yes, Cancel", "Booking Canceled Successfully", the Track button replaces "Open in Maps").

## Decisions the owner should confirm (all listed in the PR)
1. **Names stay first names** ("Saliu"), not Figma's full names (existing rule, pinned by tests).
2. **No verified tick, no "TAG / OAK123" chip**: the API has no such data and a tick would claim a verification the screen cannot show.
3. **Refund wording**: the cancel success dialog says the refund goes to the original payment method (Figma says wallet; the wallet is off).
4. **Chat header** shows the specialization where Figma has "Active" (no presence data), and has no call / AI icons or microphone.
5. **Week strip is seven days**, not five.
6. **Caregiver Details subtitle**: Figma's "Book your Appointments in 2 steps" is a copy-paste; replaced by "Follow your visit, step by step".
7. Booking Details keeps rows Figma does not draw (Status, Service, Booked for, Duration, Address): they are real data.

## Operate / roll back
No backend or migration change. Revert the PR to go back to the previous screens. Nothing to configure.

## Follow-ups
- Deferred (reason in the ledger): Enter Booking Code (no backend), post-visit summary and nurse note (no patient endpoint), in-app map (no maps key), "Booking Canceled from website".
- Not built, stay off (owner): Reschedule, Change Care Provider, ratings (Rate Doctor), video / audio call, AI notetaker, prescription / nutritionist / physio flows, Healthcare Providers list.
- The status strip above the dim overlay shows white while a sheet or dialog is open over the teal Bookings header (the screen under it is no longer focused). Cosmetic.
- One slice-2 test (`bookingFlows` step 1 validation messages) failed twice under heavy machine load and passed alone and in later runs: treat as a timing flake if CI shows it once.
- Not seen on Android or a real phone.
