# SOP: final visual pass over the screens never seen on a screen

| | |
|---|---|
| **What shipped** | Differences found by walking, on the iOS simulator, the merged-but-never-seen screens of both apps against the Figma PNGs, fixed in one PR (branch `fix/final-visual-pass`). Row-by-row table with the Figma frame of each row: `ledgers/SIM-final.md` (outside the repo, next to the other simulator ledgers); screenshots `ledgers/sim-final/before|after/`. |
| **Why** | The owner demands exact parity and tests on phones once. Payment Details, the summary-to-result flow, the Home tile art, setup step 2 with "I apply as" and the Chats tab were only Jest-tested; earlier passes always found real differences after Jest-only slices. |
| **Verified** | iOS simulator (iPhone 17 Pro, Debug build, scratch backend, fake Paystack, placeholder data), named Jest files (patient: `bookingFlows`, `authFlows`, `appScreens`, `legalLinks`, `keyboardScrollAndroid`, `v1Routes`; caregiver: `errors`, `chats`, `chatsModel`, `setupStep2Roles`, `onboardingParity`, `onboardingCopy`, `bottomNavigation`), `tsc --noEmit` and ESLint in both apps. **Nothing was seen on Android or a real phone; real Paystack was not exercised.** |

## Method
Each screen was captured at 3x and laid next to the Figma frame at the same width (content width matched to the same fraction of the screen), so sizes and gaps are compared as proportions. Figma PNGs are Display P3: colours were converted to sRGB before use (patient title green `#55AB68` becomes `#26AD61`).

## What changed
| Area | Change |
|---|---|
| `components/ui/auth-page.tsx` (patient) | `booking` flag: 24 pt title (the booking frames; sign-in stays 22) and 10 pt more before the subtitle; `footer` slot pinned under the scrolling form. |
| Booking step 1/2, Summary | use `booking`; summary labels dark 15 pt, rows about 75 pt apart (was 61), "Estimated Cost" row at the drawn size. |
| Payment Details | "Make Payment" pinned at the bottom as drawn (was under the rows). |
| Payment success (`PaymentResult.tsx`, `constants/theme.ts`) | content starts under the close button (was centred, 36 pt too low), title in the patient Figma green (`paymentSuccess`), receipt card 80% wide. |
| Home tile (`Home.tsx`) | label medium weight and the 1 px ring round the circle; the art size already matched Figma. |
| Caregiver Login (`Login.tsx`, `api/errors.ts`) | label "Email Address" and error "Incorrect email or password." (phone sign-in is off; sign-up has no phone field). |
| Caregiver setup step 2 | "Work & Experience" heading one size down. |
| Caregiver Chats | header 24 pt shorter, search box 42 pt, avatars keep their place. |
| Tests | `errors.test.ts` (new wording), `onboardingCopy.test.tsx` (login asks only for an email). |

## Left on purpose (owner decisions, nothing invented)
Payment Details sub-lines and wallet row; the summary's fee breakdown (the server's quote); "Payment Failed" stays coral (Figma shows it green) and keeps the honest sentence and the "Already paid? Check again" link; the success copy says what is true (no e-mail promise, "View Booking" until a caregiver exists); Chats with 24-hour times and no unread badges; "I apply as" (not in Figma).

## Operate / roll back
Revert the PR. No backend, API, migration or native-module change (a JS reload is enough).

## Follow-ups
- Walk both apps on a phone and on Android; a small iPhone and Dynamic Type for the pinned button and the Chats header.
- Not seen on a screen: setup step 2 required error and the saved role on resume (needs the licence upload), Chats empty/search/error states, patient Profile menu.
- Admin console: "Requested by the caregiver: Nurse, Caregiver" and the pre-selected, tagged roles were confirmed from the page text only (the built-in browser pane was hidden, so no screenshot).
- Real Paystack single-channel check (see the Payment Details SOP) is still the owner's.
