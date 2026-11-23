# SOP: Patient onboarding, sign-in and Home match the Figma exports (slice 1)

| | |
|---|---|
| **What shipped** | The patient app's welcome slides, sign-up, code screen, account-created page, login, password recovery (code screen, then reset) and Home now follow the Figma exports in `ss/patient` (frames 1.13.11 to 1.16.36). One green toast ("Login Successful", "Password has been Reset Successfully", "Email Address Verified" on the unverified-login path). |
| **Branch / PR** | `feat/patient-onboarding-parity`, monorepo PR (see the PR for the number). |
| **Why** | The owner demands exact parity with the designs. The read-only audit is `ledgers/PARITY-patient-A.md` (rows 23-24, 27-34, 36, status table at the top). |
| **Verified** | On the **iOS simulator only** (iPhone 17 Pro, Debug build, scratch local backend, no real e-mail): every screen compared with its Figma frame, screenshots in `ledgers/sim-patient-1/`. Jest for the touched files and the tests that pin them, `tsc --noEmit`, ESLint. **Nothing was seen on Android or a real phone.** |

## What was decided (and where it differs from Figma)
| Topic | Decision |
|---|---|
| Sign-up e-mail box | Email only: Figma's "Email Address/Phone Number" box says **Email Address**. Phone sign-in and an OTP on every login stay off (owner). |
| Terms box | **Unticked** by default (owner decision, same as the caregiver app); Figma shows it ticked. The line still says "By tapping Get Started" as drawn (`TERMS_ACTION` in `CreateAccount.tsx`). |
| Typos fixed, not copied | "AI- Powered" to "AI-Powered", "Terms of Services" to "Terms of Service", "recieve" to "receive", "Forget Password" to "Forgot Password", "Lets help you" to "Let's help you". |
| Kept as drawn | "Let the learning journey begin!" on the account-created page; "Send Recovery Link" (it sends a code); "What do you like to do today?" (only the space before "?" dropped); "Didn't receive a code ?". |
| After verification | "Start Booking Journey" signs in with the e-mail and password typed on the sign-up form (kept in memory only, `src/auth/pendingSignIn.ts`) and Home opens the booking form once. If the sign-in fails or the app was restarted it goes to Login. |
| Recover flow | Recover (e-mail) -> `RecoverCode` (five boxes, resend) -> Reset Password (two fields). The server checks the code only together with the new password, so a wrong code is reported by the reset screen, which goes back to the code screen with empty boxes and the message. No "Email Address Verified" toast on this path. |
| Home, not built | AI search field + filter, Medication Reminder, loved-ones carousel (photo, arrows, dots), Quick Service tiles Prescription / Physiotherapy / Nutrition, "See all" (not in Figma). Quick Service shows only **Book a Nurse**. |
| Colours | Brand teal and coral are **not changed**: the Figma PNGs are Display P3 and the app's sRGB tokens already equal them. New tokens: `toast` `#35C759`, `successTitle` `#00996C`, `pageTint` `#F9FBFB`. |

## How
| Area | Change |
|---|---|
| Shared kit | `Input` teal border at rest (2 px on focus), 48 px high, one `FieldLabel`; eye shows "hidden" as the slashed eye. `OtpInput` boxes restyled (60 pt, pale teal, pale blue when typed) plus `OtpResendRow`. `Button`: a disabled primary is flat grey. `Text` variants `page` (22) and `fine` (11). `LegalLink` also opens the Cookies Policy (`COOKIES_URL`). |
| Auth chrome | `AuthPage` (Back link, 22 pt title, grey subtitle, 22 pt between fields) and `HeaderBack` (Back, or a fallback on the first screen of a stack: Login goes to the slides). |
| Toast | `components/ui/toast.tsx` (one global host in `MainApp`, below the status bar over the Back row). |
| Safe-area strips | `components/StatusBar/screenChrome.ts`: the strip under the home indicator and over the status bar can take a screen's colour (slide panel, Home tint). |
| Slides | `Onboarding.tsx` rewritten from the Figma pixel positions (same layout as the caregiver app); the four slide images are the 4x artwork from the caregiver app (same art). Get Started / Login are pushed (not reset), so Back returns to the slides. |
| Success art | `components/ui/success-illustration.tsx` (copied from the caregiver app). |
| Home | `screens/home/Home.tsx`, `components/home/book-banner-art.tsx` (leaf art with plain views), `empty-calendar.tsx`, `assets/images/home-quick-nurse.png` (see follow-ups). |
| Routes | `RecoverCode` added to `AUTH_SCREENS` (pinned in `__tests__/v1Routes.test.tsx`); `ResetPassword` takes `{ email, code }`. |

## Files
`apps/patient/MainApp.tsx`, `src/navigation/{Navigations,routes,Tabs}`, `src/screens/auth/*` (new `RecoverCode.tsx`), `src/screens/home/Home.tsx`, `src/components/{back/HeaderBack,StatusBar/screenChrome,home/*,NotificationBell}`, `src/components/ui/{auth-page,field-label,toast,success-illustration,input,button,otp-input,legal-link,text}.tsx`, `src/auth/pendingSignIn.ts`, `src/domain/{passwordReset,tracking}.ts`, `src/constants/theme.ts`, `src/config/links.ts`, tests `authFlows`, `authGate`, `legalLinks`, `v1Routes`, `appScreens`, `refreshFailure`, `test-utils/renderApp.tsx` (new `openCreateAccount`).

## Operate / roll back
Revert the PR. No backend, API or migration change. Note for tests: Login no longer has a "Create account" link (Figma has none); sign-up is reached through Back to the slides, then Get Started (`openCreateAccount()`).

## Follow-ups / decisions for the owner
- **Quick Service artwork:** the Book a Nurse circle is cropped from the Figma PNG (about 64 px, upscaled) because no export is in the repo: blurry on a retina phone. Please export it (and the other three tiles) at 3x.
- Login now has no way to reach sign-up except Back to the slides (Figma). Say if a "Create account" link should come back.
- Sign-up terms box unticked and "By tapping Get Started" wording (caregiver parity): confirm.
- Account-created body "Let the learning journey begin!": say if it should read "care journey".
- "Email Address Verified" after a recovery code needs a backend that verifies the code before the new password.
- Not built, so off: AI search + filter, Medication Reminder, loved-ones carousel, other Quick Service tiles.
- Check on Android and a small iPhone (SE class): the slide layout scales by width and height but was only seen at 402x874. The iOS Strong Password overlay blocks the simulator's typing into a password field until the eye is toggled (a simulator quirk; a person can type).
- Other screens still use the old round Back header and the Input/Button changes apply to them too (teal field borders everywhere): slice 2 checks them against their frames.
