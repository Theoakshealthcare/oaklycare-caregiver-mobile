# SOP: Patient "Payment Details" screen (Card Payment / Bank Transfer)

| | |
|---|---|
| **What shipped** | A "Payment Details" screen between Booking Summary and Paystack's hosted checkout. The person picks Card Payment or Bank Transfer and presses "Make Payment"; the app creates the booking with that choice as `channels` on `POST /booking/create`. Backend side: `Theoakshealthcare/backend` #71 (develop `71a6d57`). |
| **Branch / PR** | `feat/patient-payment-details`, monorepo PR (see the PR for the number). |
| **Why** | The owner demands exact parity with the Figma exports. Ledger row 4 (`ledgers/PARITY-patient-A.md`) was deferred in slice 2 because the pay link took no Paystack channel; #71 added an optional `channels` list. |
| **Verified** | Jest, `tsc --noEmit` (patient, caregiver, admin, api-client), ESLint, api-client `node --test`. **Visual pass pending** (the simulator was held by another session). Real Paystack **not** exercised. |

## Figma and what was built
Frames `1.17.07 PM` and `1.18.28 PM` (4th phone), `ss/patient`: "< Back", title "Payment Details", subtitle "Book your Appointments in 2 steps", three chevron rows (Card Payment, Bank Transfer, Oakly Wallet), a button at the bottom ("Make Payment" in one export, "Save & Continue" in the other). `1.18.39 PM` shows a card-entry sheet over the same screen.

| Figma | Built? |
|---|---|
| Heading, subtitle, Back | Yes, as drawn (`AuthPage`; Back goes to the summary with the form intact) |
| "Card Payment", "Bank Transfer" rows with a chevron | Yes. A row is tappable and selects that method. **The design draws no selected state**: a teal outline on the chosen row is the only addition (not copy, only a state) |
| The grey sub-line of each row | **Not built.** Figma has "Lorem ipsum dolor sit amet consectetur." placeholder text. No copy was invented in its place |
| "Oakly Wallet (N250,000 Balance)" | **Not built, stays off** (owner: the wallet is not built; a test pins that no row or text mentions a wallet) |
| Button | "Make Payment" (the action creates the booking and opens Paystack; "Save & Continue" would mislead). Enabled with nothing picked, as drawn |
| Button pinned to the bottom of the screen | **Not done**: every other Figma-parity screen in the app puts its button in the scrolling content, so this one does too. Check in the visual pass whether the owner wants it pinned |
| Card sheet (Card Number, Name, Expiry, CVV, Pay Now) | **Never built**: the app never collects card data; the card is entered on Paystack's hosted page |

## What the app sends
| Situation | Request |
|---|---|
| Card Payment picked | `POST /api/v1/booking/create` with the usual booking fields plus `"channels": ["card"]` |
| Bank Transfer picked | same, `"channels": ["bank_transfer"]` |
| Nothing picked | same, **no `channels` key** (Paystack shows every method it has enabled) |

Never an amount, a price or card data: the amount stays the server's. `POST /booking/{id}/payment-link` ("Pay now" after a restart) is unchanged and still sends no body: the first link wins, so it hands back the link made at create.

## How
| Decision | Why / alternative rejected |
|---|---|
| **`channels` goes on `/create`, the call that first makes the link.** | The backend stores the first link and returns it from `/payment-link` whatever that request names (guide section 14). Sending it only on `/payment-link` would never reach Paystack. |
| **The booking is now created on Payment Details, not on the summary.** | The choice must exist when the call is made. "Proceed to Payment" on the summary now only navigates; "Make Payment" runs `useCreateBooking` and then does exactly what the summary did (reset the form, open Paystack via `PaymentResult`). So Back from Payment Details creates nothing. |
| **One constant for the allowed channels:** `PAYMENT_CHANNELS` in `src/domain/paymentMethods.ts`. | It is typed with `satisfies` against the generated `BookingCreate.channels` type, so the app and the API cannot drift silently. The rows, the labels and the request all derive from it. |
| Errors. | A `422` whose body names `channels` reads "That payment method can't be used right now. Please choose another one and try again." (`paymentMethodErrorMessage`), never FastAPI's English validation sentence. Any other `422`, and the coded `503 payment_link_unavailable`, use the existing booking messaging (`bookingErrorMessage`: the server's own `message` for a coded 5xx). The dialog is the same one the summary used; the person stays on the screen and can pick again. |
| Selection is local screen state, not part of the booking draft. | It is not part of the booking; it must not survive a finished booking. |

## What's involved
- New: `apps/patient/src/screens/booking/PaymentDetails.tsx`, `apps/patient/src/domain/paymentMethods.ts`.
- Changed: `BookingSummary.tsx` (button navigates), `services/bookingMapper.ts` (`toCreateBody(draft, channel?)`), `services/booking.service.ts` (`create(draft, channel?)`), `hooks/useBookings.ts` (`useCreateBooking` takes `{ draft, channel }`), `api/bookingErrors.ts` (`paymentMethodErrorMessage`), `navigation/{routes,Navigations}.ts(x)` (`PaymentDetails`).
- Shared types: `packages/api-client/{openapi.json,src/schema.d.ts}` re-synced from backend develop `71a6d57` (exported read-only with `git archive`, because the backend folder was on another branch). The diff is only `channels` on `BookingCreate`, the new `PaymentLinkRequest`, and the optional body on `/payment-link`.
- Tests: `bookingFlows` (existing flows now pass through Payment Details; new "Payment Details" block), `bookingUnits`, `v1Routes` (the route list pins `PaymentDetails`).

## Verification
- `bookingFlows.test.tsx` (47), `bookingUnits.test.ts` (25), `v1Routes.test.tsx`: the screen is drawn without a wallet row, card fields or placeholder text; nothing is created before "Make Payment"; Back returns to the summary; Card sends exactly `["card"]`, Bank Transfer exactly `["bank_transfer"]`, the last pick wins, no pick sends no `channels` key, no amount-like key is ever sent; a `422` (the body printed in the backend guide, section 14.1: an in-process run, **not** a live capture) and a `503 payment_link_unavailable` show their message, open no checkout and allow a retry that succeeds; a lost network shows "Can't reach Oakly".
- The create/checkout/verify answers in those tests are the earlier live captures; **no live capture of `channels` exists**.
- **Not verified:** the screen on a simulator, Android or a phone; what Paystack's real checkout shows for a single channel (below).

## Risk the owner must close: a single channel can leave a dead checkout
The backend guide (section 14.2) warns that if only `["card"]` or only `["bank_transfer"]` is sent and that channel is **not enabled on Oakly's Paystack merchant account**, Paystack may not reject the initialise: the booking is made and a link is returned, but the page can offer no usable method. Because the first link wins, "Pay now" keeps returning that same link and the patient is stuck until the 30-minute payment window ends. The API cannot detect this and the app cannot either.

This screen sends a single channel, as specified, so **before a build with this screen goes to patients the owner should, in Paystack test mode, run each single channel once**: check the channels enabled for the integration, open one `card` link and one `bank_transfer` link, and confirm each page offers a usable method. The Figma shows no warning copy, so none was added.

If the check fails for a channel, the cheapest safe change is in one place: make that channel's row send both channels (or none) until the merchant account is fixed (`toCreateBody` / `PAYMENT_CHANNELS`).

## Operate / roll back
Revert the PR: the summary goes back to creating the booking itself, and the backend still accepts the absent field. Needs a backend with #71 (an older backend would ignore or reject `channels`).

## Follow-ups
- Owner: the per-channel Paystack test-mode check above.
- Visual pass on the simulator (spacing, selected outline, whether the button should be pinned to the bottom, row height without the placeholder sub-line).
- Owner to say if "Payment Details" should show the amount (Figma does not).
- The wallet row stays off until a wallet exists.
