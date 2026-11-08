# SOP: Terms of Service and Privacy Policy links (caregiver and patient apps)

| | |
|---|---|
| **What shipped** | Every "Terms of Service" / "Privacy Policy" mention that was plain text or a link with no destination now opens the owner's page in the **in-app browser** (`expo-web-browser`, close button), in both mobile apps. A page that cannot open says so in the app's usual error message. The patient Profile menu gets **Terms of Service** and **Privacy Policy** rows. |
| **Branch / commit** | `feat/terms-privacy-links`, cut from `oakly/main` `f0f9b64`. Not pushed, no PR (the lead pushes after review). Head SHA is in the lead's report. |
| **Device-verified** | **No.** Jest only; nothing was run on a simulator or phone. How a nested link looks and behaves inside the sign-up sentence (wrapping, tap target) still needs one look on a device. |
| **Counsel** | **Counsel still has to sign off the consent wording.** No consent word changed here (see "Consent text" below); only the behaviour of the words that name the Privacy Policy. |
| **Tests** | Caregiver Jest 1030 pass (73 suites), patient Jest 227 pass (21 suites), both run single-worker (`jest -w 1`); `pnpm typecheck` and `pnpm lint` clean for every package; `pnpm api:generate` leaves `schema.d.ts` unchanged; frozen install clean. Admin untouched, so its build was not run. |

## Why

The owner supplied the real pages on 2026-11-08 (Terms `https://www.oaklycare.com/terms`, Privacy `https://www.oaklycare.com/privacy`). Until then the sign-up and consent screens named the documents a person "agrees to" but nothing could be opened, the identity consent had a `[Privacy Policy]` line with no destination, and the patient Profile hid Terms and Privacy because no URL existed. A person cannot meaningfully agree to a document they cannot open, and the app stores expect the privacy policy to be reachable inside the app.

## How

- **One URL pair per app, next to the FAQ/About URLs.** Caregiver: `TERMS_URL` and `PRIVACY_URL` in `apps/caregiver/src/config/contact.ts`. The patient app had no config file (its `FAQ_URL` / `ABOUT_URL` were exported from the Profile screen), so a new `apps/patient/src/config/links.ts` now holds all four and Profile imports them. Values of the existing FAQ/About URLs are unchanged.
- **A `LegalLink` component per app** (`src/components/ui/legal-link.tsx`): React Native's own `Text` with `onPress`, `accessibilityRole="link"`, teal and underlined, taking its size and font from the sentence it sits in. The words are its children, so no consent line is reworded in the component. It is a nested `Text`, not a `Pressable`, so a tap on it is handled by the link alone and is never also a tap on a checkbox row or button around it. (The caregiver `Text` wrapper puts a `View` around its text, which is why the inline link uses the bare RN `Text`.)
- **The existing helper is reused.** Both apps' `openPage(url)` already call `WebBrowser.openBrowserAsync(url, { dismissButtonStyle: "close" })` (the patient one falls back to the phone's browser if the in-app one throws, as before).
- **Failure shows the app's normal message.** Caregiver: new `openPageOrAlert(title, url)` in `src/services/openPageOrAlert.ts` shows the same `Alert` the FAQs/About rows already used (the Profile screen now uses it too; copy unchanged: "Couldn't open FAQs" / "Check your internet connection and try again."). It lives in its own file so the existing `account.test.tsx`, which replaces `openPage` with a spy, still exercises the Profile rows. Patient: the app shows errors in `ErrorDialog`, not `Alert`, so a new `usePageOpener()` hook (`src/hooks/usePageOpener.tsx`) returns `open` and a `dialog` element the screen renders; titled "Couldn't open <page>".
- **Patient sign-up layout.** The old row was one `Pressable` around the icon and the sentence, so a link inside it would have been swallowed by the checkbox. It is now a row with the checkbox `Pressable` (same role, state and `accessibilityLabel`) and the sentence beside it; tapping the sentence still ticks the box (as before), tapping the **Privacy Policy** link opens the page and does not.

### Where the links are

| App | Place | Now tappable |
|---|---|---|
| Caregiver | `src/screens/auth/CreateAccount.tsx` agree line | Terms of Services, Privacy Policy |
| Caregiver | `src/screens/setup/ConsentScreen.tsx` | Terms of Services, Privacy Policy, and the closing "privacy policy" |
| Caregiver | `src/components/identity/ConsentBlock.tsx` (identity consent, design 10.2) | Privacy Policy |
| Patient | `src/screens/auth/CreateAccount.tsx` agree line | Privacy Policy (the line has no "Terms" mention) |
| Patient | `src/screens/profile/Profile.tsx` menu | new rows **Terms of Service**, **Privacy Policy** |

### Consent text (design 10.2): unchanged

`CONSENT_TITLE`, `CONSENT_BODY`, `CONSENT_LABEL` and `CONSENT_TEXT_VERSION` (`kyc-2026-10`) in `apps/caregiver/src/identity/identityModel.ts` are untouched; only the comment above them changed (the link now has a destination). A test asserts the words and the version. The server records the version the caregiver saw, so no word or version change means no backend coordination.

### Decisions and judgement calls

- **Patient Profile rows were added although the sign-up already mentions the Privacy Policy.** The brief allowed rows "if the patient app has no such text on sign-up"; it does have some. The Profile's own comment said Terms and Privacy were "hidden until their URLs are known", and the URLs are now known, so the rows are in. They are two lines in `Profile.tsx`; drop them if the owner wants the sign-up link only. The old patient test that asserted "no Terms or Privacy row" was replaced by tests that assert the opposite.
- **Cookies Policy stays plain text.** No URL was supplied for it. In the caregiver sign-up and consent screens it is still styled like a link with no destination (unchanged, as before).
- **Caregiver Profile menu has no Terms/Privacy rows.** Not asked; the links are on sign-up and consent. See follow-ups.
- **The patient FAQ/About URLs have no `www.`** (`https://oaklycare.com/...`) while the new ones do, as the owner gave them. Left as they were.

## Files

| Area | Files |
|---|---|
| Caregiver | `src/config/contact.ts`, `src/components/ui/legal-link.tsx` (new), `src/services/inAppBrowser.ts` (comment), `src/services/openPageOrAlert.ts` (new), `src/screens/auth/CreateAccount.tsx`, `src/screens/setup/ConsentScreen.tsx`, `src/components/identity/ConsentBlock.tsx`, `src/identity/identityModel.ts` (comment only), `src/screens/account/Profile.tsx` (uses the shared helper) |
| Patient | `src/config/links.ts` (new), `src/components/ui/legal-link.tsx` (new), `src/hooks/usePageOpener.tsx` (new), `src/screens/auth/CreateAccount.tsx`, `src/screens/profile/Profile.tsx` |
| Tests | `apps/caregiver/__tests__/termsPrivacyLinks.test.tsx` (new), `apps/patient/__tests__/legalLinks.test.tsx` (new), `apps/patient/__tests__/profile.test.tsx` (the "no Terms or Privacy row" assertion removed) |
| Admin | Untouched (its "terms" hits are cancellation terms). No admin change, so no admin build. |

## Verification

All Jest (expo-web-browser mocked), no device:

- Each link opens the right URL with `{ dismissButtonStyle: "close" }` and never `Linking.openURL` (caregiver sign-up, consent screen x3 links, identity consent block; patient sign-up, Profile rows).
- **No accidental toggle.** Caregiver sign-up: after submitting empty, the "You must agree to the terms" error stays when a link is tapped (ticking the box would clear it). Identity `ConsentBlock`: tapping the link never calls `onToggle`, tapping the tick box calls it once, and it is still not pre-ticked. Caregiver `ConsentScreen`: link taps do not call `updateConsent`; the button still does, once. Patient sign-up: link tap leaves the box and the "Please accept the terms" error alone; the box and the sentence still tick it.
- **Failure path.** A rejected open shows the Alert (caregiver) or the error dialog (patient, after the phone-browser fallback also fails).
- The existing caregiver `account.test.tsx` and `profileLinks.test.tsx`, patient `profile.test.tsx` and `authFlows.test.tsx` still pass.
- **Test-run note.** Full parallel `pnpm test` runs here showed 1 to 6 timeouts in unrelated files that differed from run to run (bookings, FallGuard, vitals, typing, care-plan tasks) and passed alone and in the single-worker runs reported above; the machine was loaded by other sessions. A CI run on the pushed head is the authority.

## Operate / roll back

Nothing to deploy server-side. Ships with the next app build. Revert = revert the branch's commit; the pages themselves are on the website and changing their text needs no app release. If the owner changes a URL, change `TERMS_URL` / `PRIVACY_URL` in the config file of the app.

## Follow-ups

- Look at the sign-up sentence and the consent screens on a device (link wrapping inside the sentence, tap size, the in-app browser's close button). Not done.
- **Counsel sign-off** on the consent wording (identity consent design 10.2, background-check consent) is still open; this change does not alter it.
- Owner: a URL for the **Cookies Policy**, or drop the mention; today it is not tappable.
- Optional: Terms/Privacy rows in the caregiver Profile (parity with the patient app), and "Terms of Service" wording on the patient sign-up line (today it mentions only the Privacy and Cookies policies; changing that is a wording decision for the owner).
- The patient FAQ/About URLs could move to `www.oaklycare.com` for consistency if the bare domain does not redirect.
