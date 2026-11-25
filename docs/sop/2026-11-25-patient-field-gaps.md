# SOP: patient app gaps from the first real-phone test

| | |
|---|---|
| **What shipped** | One `+234` phone input everywhere, one shared pinned-button spacing, the chat composer above the Android keyboard, a visit location that is read back and can be looked up from the typed address, the payment return link, and a chat push tap that opens the chat. Branch `fix/patient-field-gaps`, one PR to `main`. |
| **Why** | The owner's first Android test against staging found: bare phone boxes, "Make Payment" flush with the bottom edge, the keyboard hiding the chat box, "Location saved" showing nothing (and a booking for a parent at another address silently sending the booker's own GPS), no way back from Paystack's page, and chat pushes with no tap target. |
| **Seen on a screen?** | iOS simulator only (list below). **Android was only reasoned**: the keyboard fix, the safe-area spacing on gesture and three-button navigation, the Custom Tab return and the Android geocoder. Nothing was run on a real phone or against real Paystack. |

## How
| # | Decision | Rejected / why |
|---|---|---|
| 1 | `domain/phone.ts` `normalizePhone` + `ui/phone-input.tsx`: "+234" is always in the box, a typed leading 0 or 234 is folded in, the stored value is E.164 (`+2348012345678`). A number that is already clean E.164 (any country) is shown untouched (`displayPhone`), so opening a screen never alters a saved value. The rule "at least 7 digits" now counts digits after the code. EditProfile does not send a box left at the bare "+234". | A separate non-editable "+234" label: cannot take a pasted number. |
| 2 | `ui/bottom-bar.tsx` is the only pinned-footer wrapper (used by `AuthPage` and `Screen`): 24 pt of air under the button. The safe-area inset itself is already added once by `MainApp` (a strip of the inset's height under every screen), so it is not added again. Audit: the only pinned footer is Payment Details; scroll pages already end with 48 pt; Onboarding and the result screens are not pinned. | Adding `useSafeAreaInsets` in the bar: double inset on iPhones. |
| 3 | `KeyboardInsetView` Android branch pads the bottom by how far the keyboard covers its frame (the measurement `KeyboardScrollView` uses). The caregiver photo in the chat header and rows was already wired to the same `booking.caregiver.photoUrl` as Caregiver Details (only `https://` URLs are accepted by `bookingMapper`); a test now pins it. | `adjustResize` / `KeyboardAvoidingView`: no effect in edge-to-edge. |
| 4 | `components/booking/VisitLocationCard.tsx`: "Use my current location" reads the address back (`Location.reverseGeocodeAsync`); "Find this address" geocodes the typed address on the phone (`Location.geocodeAsync`, "..., Nigeria" appended), shows the found address with Confirm / Edit and only Confirm sets the coordinates. Coordinates are cleared (with a message) when the typed address changes after a lookup; a phone position is cleared only if an address already typed at that moment is changed. Nothing found: says so and offers the phone's position. No map key. New draft fields `locationSource`, `locationLabel`, `locationKey`. | A server-side geocode: no endpoint, and no key is available. |
| 5 | `hooks/usePaymentDeepLink.ts` (mounted beside the push effects): `oaklypatient://payment-complete[?booking_id=]` closes the in-app browser (iOS), opens that booking's `PaymentResult` (named in the link, else the open result screen, else the last unpaid checkout kept on this phone, else the bookings tab) and `PaymentResult` calls `check()` (`hooks/paymentReturn.ts`). The link never means "paid": the backend is asked as before; closing the browser by hand works as before. | `NavigationContainer linking`: cannot pick the booking. |
| 6 | `parsePushTap`: `data.type === "chat_message"` with `booking_id` opens `Chat`; everything else is unchanged. | |

## What's involved
`apps/patient/src/domain/{phone,visitLocation,paymentReturn,notifications,booking}.ts`, `src/components/ui/{phone-input,bottom-bar,auth-page,screen,keyboard-inset-view}.tsx`, `src/components/booking/VisitLocationCard.tsx`, `src/screens/booking/{BookingStep2,PaymentResult}.tsx`, `src/screens/profile/EditProfile.tsx`, `src/services/location.ts`, `src/hooks/{bookingDraft,paymentReturn,usePaymentDeepLink}.ts`, `src/push/native.ts`, `src/navigation/StackNavigator.tsx`. No change to `packages/api-client`, `app.json` (the `oaklypatient` scheme and the location permission already existed) or any native module.

## Verification
- Jest (named files, one worker): `fieldGaps.test.ts` (new), `keyboardInsetAndroid.test.tsx` (new), `bookingFlows`, `notifications`, `push`, `profile`, `profileParity`, `trackingChat`, `keyboardScrollAndroid`: 9 suites, all pass. `tsc --noEmit` and ESLint clean.
- **iOS simulator (iPhone 17 Pro, Debug build + Metro from this branch, a throwaway mock API answering captured bodies):** the saved `08012345678` shows as `+2348012345678`; 20 deletes leave `+234`; typing `0803...` gives `+234803...` (no doubled zero); chat shows the caregiver photo in the header and on the caregiver's messages with the composer above the keyboard; step 2 shows the new Visit location card; `xcrun simctl openurl oaklypatient://payment-complete?booking_id=...` asks "Open in Oakly Health?" and then lands on the payment result screen, which calls `verify-payment`.
- **Not seen on any screen:** "Find this address" / Confirm / Edit and the stale-clear (Jest only, with a mocked geocoder), the Payment Details button spacing, the Android keyboard, gesture / three-button Android insets, the Android Custom Tab return, a chat push tap, real Paystack.

## Operate / roll back
No config, migration or native change: revert the PR. The Paystack page must link to `oaklypatient://payment-complete` (backend `GET /api/v1/payment/callback`); a `booking_id` query parameter is read if present but not required.

## Follow-ups
- Owner: check on the Android phone the keyboard, the spacing under "Make Payment" and the return link; check "Find this address" with real Nigerian addresses (Android's geocoder may know fewer streets than Apple's).
- A booking for someone else still sends the booker's phone number and the typed address inside the special instructions only; there is no separate patient contact field in the API.
- The caregiver KYC page (not part of the patient app) has its own `+234` box; it could reuse `normalizePhone` later.
