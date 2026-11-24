# SOP: Patient booking flow and payment screens match the Figma exports (slice 2)

| | |
|---|---|
| **What shipped** | Booking step 1 and step 2, Booking Summary, "Payment Failed! Try Again" and "Payment Successful. Booking Confirmed" now follow the Figma frames in `ss/patient` (1.17.07 and 1.18.28 booking, 1.18.39 payment). Two slice-1 extras: a small "Create account" link on Login, and the account-created sentence reads "Let the care journey begin!". |
| **Branch / PR** | `feat/patient-booking-parity`, monorepo PR (see the PR for the number). |
| **Why** | The owner demands exact parity with the designs. Audit rows: `ledgers/PARITY-patient-A.md` gap rows 1, 2, 3, 6, 7 (4 and 5 deferred, below). |
| **Verified** | **iOS simulator only** (iPhone 17 Pro, Debug build, scratch local backend and a fake Paystack, no real e-mail, no real Paystack key). Screenshots in `ledgers/sim-patient-2/`. Jest for the files touched and the tests that pin them, `tsc --noEmit` (patient, caregiver, admin, api-client), ESLint. **Nothing was seen on Android or a real phone, and real Paystack was not exercised** (the simulator opened Paystack's public checkout host with a fake access code, which answers "We could not start this transaction"; the payment itself was settled with a signed fake webhook). |

## What the backend offers, and what was built from it
| Figma | Data source | Built? |
|---|---|---|
| "What Services are you Booking ?" | `GET /booking/services` (catalogue, only enabled and priced services). The app offers only `nurse` (`OFFERED_SERVICES`): doctor, physio and nutrition flows are out of v1 | Yes, a dropdown; the nurse is preselected when it is the only one. Empty catalogue: "No services are available right now" and the button is off |
| "Duration" | the catalogue's `min_minutes`, `step_minutes`, `max_minutes` (today 60 to 1440 in 30-minute steps); the app sends `duration_minutes` | Yes, a dropdown ("1 hour 30 minutes"). Lengths are never hard-coded |
| "Who are you Booking for ?", "What Assistance Do You Need?", "Do You Have Any Common Conditions?", "State", "Language", "Gender" | the API takes all of these as free text | Yes, dropdowns with the app's own lists (`domain/bookingChoices.ts`); "Other" opens a typed answer. The lists are **our wording** (owner to confirm) |
| "Select Preferred Date and Time" | `scheduled_date` | Yes, a calendar field written "March 20th 10:00 am", a JS calendar sheet (no native module, so no rebuild); past days and today's passed hours cannot be chosen |
| "Phone Number", "Email Address" | **no booking field exists** | Built, prefilled from `/auth/me`, editable, validated; they travel inside `special_instructions` as "Contact phone: ..." / "Contact email: ..." (the same pattern gender and language already used). Owner to decide whether the caregiver should see them |
| "Estimated Cost" | `POST /booking/preview` | Yes, from the server only; the service and platform fee lines and the surge / discount notices stay under the cost bar |
| Payment success rows | the booking (`booking_code`, `total_amount`) and the verify answer | Appointment ID, Amount Paid, PAID. "View Caregiver" only when the booking has a caregiver; otherwise "View Booking" (right after payment there is none) |

## What was decided (and where it differs from Figma)
| Topic | Decision |
|---|---|
| **"Payment Details" method screen (Card Payment / Bank Transfer / Oakly Wallet): DEFERRED** | `POST /booking/create` and Paystack's initialise take **no channel parameter** (`PaystackService.initialize_transaction` sends email, amount, reference, callback, metadata only), so a Card / Bank Transfer choice could not be honoured; Paystack's own page shows the channels the merchant enabled. The wallet is not built (owner). A screen with a choice that does nothing was not built. "Proceed to Payment" still creates the booking and opens Paystack. Needs a backend change (a `channels` list) if the owner wants it |
| Card form sheet (Card Number, CVV...) | Never built: the app never collects card data; payment stays on Paystack's hosted checkout |
| "Payment Failed! Try Again" | Shown only when Paystack itself answers that the payment was `abandoned`, `failed` or `reversed` (a closed or cancelled checkout). Typo "Agin" fixed. Title is coral, not Figma's green (a failure in green misleads). Body is "Your payment did not go through. Nothing is charged unless a payment succeeds, so you can try again." (not "choose another Payment Details": no choice exists). Added a small "Already paid? Check again" (a bank transfer can settle late). If Paystack gives no answer or says it is still going on, the older "Payment not confirmed yet" screen (Pay now / Check again) stays: it is never called failed |
| Success body | Figma says the confirmation was sent to the e-mail; **the backend sends no such e-mail**, so the body reads "Your payment was received. We are now finding a caregiver for you." |
| Choose Service Time, "Immediate booking, Nurse arrives ASAP" | **Deferred**: it is drawn only in the Wound Care variant; there is no wound-care service and the backend has no "arrive ASAP" concept (only a `scheduled_date`) |
| Step bar | Figma draws the same fill on step 1 and step 2 (a design copy); the app grows it, half then full |
| Duplicate address | Figma has "Address" under "Where do you need Care ?" and "House Address" under Contact Details; one field "House Address" under the first heading. City, the "Use my current location" card (the API needs coordinates) and "Notes for the caregiver (optional)" are kept: not in Figma, needed by the backend or already there |
| Gender and Language | Required-star as drawn, always satisfied: "No preference" is the default |
| Copy kept as drawn | "Book your Appointments in 2 steps", "Who are you Booking for ?", "Where do you need Care ?", "Nil" for an empty summary value |
| Summary | "Edit" with the pencil at the top right; labels are the question each answer belongs to (Figma's frame has its values under the wrong labels, a design glitch). "You pay by card." removed (Paystack offers more than cards) |

## How
| Area | Change |
|---|---|
| API client | `packages/api-client` re-synced from the backend (`GET /booking/services`, `duration_minutes`, admin catalogue routes). Additive; the new required `duration_minutes` response field made eight test fixtures in the caregiver and admin apps fail `tsc`, so `duration_minutes: 120` was added to them (types only; their Jest and Vitest files were re-run) |
| Kit | `components/ui/select.tsx` (teal field + bottom sheet), `date-time-field.tsx` (calendar sheet), `components/booking/StepBar.tsx`; `FieldLabel` and `Input` take `required` (red star); `AuthPage` takes `titleRight` |
| Domain | `domain/bookingChoices.ts` (lists, `durationChoices`, `durationLabel`, `offeredServices`), `domain/slots.ts` (`formatSlot`, `monthWeeks`, `isPastDay`, `ordinal`; the chip date list is gone), `BookingDraft` (minutes, service, contact, "Other" texts), `helpNeeded`, `conditionText` |
| Data | `bookingService.services()`, `preview` and `create` send `duration_minutes` and the chosen `service_type`; `readPaymentCheck` keeps Paystack's `payment_status`; `usePaymentCheck` marks `declined`; `Booking.durationMinutes` (falls back to hours for older answers), Booking Details shows "1 hour 30 minutes" |
| Screens | `BookingStep1`, `BookingStep2`, `BookingSummary`, `PaymentResult` (a shared `Frame`: faint page tint over the status bar and home indicator, round close at the top left, close goes to the bookings list) |

## Files
`packages/api-client/{openapi.json,src/schema.d.ts}`, `apps/patient/src/{components/ui/{select,date-time-field,field-label,input,auth-page}.tsx,components/booking/StepBar.tsx,domain/{bookingChoices,booking,slots}.ts,hooks/{bookingDraft,useBookings,usePaymentCheck}.ts,services/{booking.service,bookingMapper}.ts,api/keys.ts,screens/booking/{BookingStep1,BookingStep2,BookingSummary,PaymentResult,BookingDetails}.tsx,screens/auth/{Login,AccountCreated}.tsx}`, tests `bookingFlows`, `bookingUnits`, `domain`, `typing`, `authFlows`, capture `201-p-services-nurse-only` (copied from `backend/docs/fe-captures/patient`), and the eight caregiver / admin fixtures above.

## Verification
- Jest (files touched and pinning tests only): `bookingFlows` (38), `bookingUnits`, `domain`, `slots`, `typing`, `authFlows`, `v1Routes`, `appScreens`; caregiver `directions`, `home`, `notifications`, `offers`, `push`; admin `bookings.test`, `booking-actions.test`, `booking-detail.test`. New cases: dropdown steps and the calendar sheet, required messages, lengths from the catalogue, empty catalogue, contact validation, failed vs not-confirmed vs success, receipt without an e-mail claim, "View Booking" with no caregiver.
- Simulator walk (`ledgers/sim-patient-2/`): Login with the link, step 1 (empty, each sheet, filled), step 2, summary with the server price, the real create call, Paystack's page, the capped polling, the failed frame, a signed fake webhook then "Already paid? Check again", the success frame, Booking Details with "1 hour 30 minutes".
- Not seen: Android, a real phone, a small iPhone, Dynamic Type, real Paystack, the failed frame after its status-bar tint was added (the tint was seen on the success frame, same `Frame`).

## Operate / roll back
Revert the PR. No backend or migration change. Needs a backend with `GET /booking/services` and minutes (backend #55 and #56, already on `develop`). The app sends `duration_minutes`; an older backend would reject it.

## Follow-ups / decisions for the owner
- ~~**Payment Details method screen**: needs a `channels` parameter on the booking pay link (backend).~~ Done 2026-11-24 (backend #71, [SOP](2026-11-24-patient-payment-details.md)); the wallet stays off.
- Confirm the app's own lists (relations, assistance, conditions) and whether the caregiver may see the contact phone and e-mail.
- Confirm the coral failure title and the step bar growth (both differ from Figma on purpose).
- "Choose Service Time / Immediate booking" and Wound Care need a backend service and an ASAP rule.
- The calendar sheet and selects are plain RN: check them on Android and with large text.
- Rows 8 to 22 of audit A (tracking, bookings list, details sheet, cancel, reschedule...) are slice 3.
