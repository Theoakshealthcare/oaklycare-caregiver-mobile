# SOP: Caregiver onboarding visual fixes (simulator pass)

| | |
|---|---|
| **What shipped** | Every visual difference found by the simulator pass of the merged onboarding (`ledgers/SIM-onboarding.md`, rows G1-G7 and each screen row) is fixed, except one behaviour row (below). Branch `fix/caregiver-onboarding-visual`, one PR. |
| **Why** | The owner demands exact parity with `ss/caregiver`; the pass found ~35 differences (teal bands, border colours, label sizes, slide layout, hidden Login link, keyboard over the sign-up button, toast position). |
| **Verified** | On the **iOS simulator only** (iPhone 17 Pro, Debug build, scratch local backend, mock KYC), every fixed screen compared with its Figma frame; screenshots in `ledgers/sim-onboarding-after/`. Jest for the touched files, `tsc --noEmit`, ESLint. **Not seen on Android or a real phone.** |

## Key decision: the brand colours were NOT changed
The Figma PNGs are Display P3. Converting the app's sRGB `#168283` / `#FD5E52` to P3 pixels gives `#3D8082` / `#EB695A`, exactly what the audit measured, so the app already matched. Changing the tokens would have drifted from the design. Real differences: toast green (pixel `#65C466` = sRGB `#35C759`, token `theme.colors.toast`) and success-page title (`#43976F` = `#00996C`, `theme.colors.successTitle`). The success illustration colours were converted the same way.

## How
| Area | Change |
|---|---|
| Safe-area bands (G1) | `components/StatusBar/screenChrome.ts` (zustand store: top, bottom, bar style, bottom override). `MainApp.tsx` draws the top band as the `SafeAreaView` background and the bottom band as a spacer. `StackNavigator` sets white chrome for signed-out, verify-email, setup and status; the signed-in app keeps teal. The welcome slides paint the bottom band in the panel colour (`useBottomBand`). |
| Fields (G3, G4) | `input.tsx`, `select.tsx`, `date-field.tsx`: teal border, radius 16, min height 48. New `field-label.tsx` used by all three. Setup screens space fields with a 22 pt column gap (`containerStyle` prop on Select/DateField). |
| Fonts | New theme sizes `pageTitle` (22) and `fine` (11) with `Text` variants `page` and `fine`; `__tests__/typography.test.tsx` lists them. Slides scale their text with the full width (Figma is a 375 pt frame). |
| Buttons (G5) | Disabled buttons are flat grey `#9A9A9A` (Figma), no longer faded teal. Success pages use a ~66-72% pill. |
| Links (G6) | `legal-link.tsx` sets the font explicitly (the last link of a line rendered bold and larger). |
| Back (G7) | `HeaderBack` takes an optional `onFallback` for the first screen of a stack: Login goes to the welcome slides, setup step 1 asks to sign out. |
| Slides | `onboarding-slide.tsx` rewritten: art positioned from the Figma pixel positions, white area 56% of the screen, explicit line breaks (`headlineLines`, `descriptionLines`), round dots, Login link always visible. `onboarding-3.png` is the 1442x1288 artwork (it was replaced in the working folder during this session by someone else; kept because it is the sharp version of the same art). |
| Sign-up | Terms line moved under the button (Figma), fine print, `scrollToEndOnKeyboardShow` so the button and terms stay above the keyboard. Box stays unticked (owner). |
| Success pages | `success-illustration.tsx` redrawn from the Figma pixels; titles in two lines; button width. |
| Setup | Step 2 fits one screen (upload box 48 pt dashed, "Selected:" line removed). Step 1 "+234" is prefilled (the digits after it are required). Identity: rows not dimmed, extra heading removed (`ConsentBlock`; the consent words and tick box stay), `__tests__/termsPrivacyLinks.test.tsx` updated. |
| Toast | Below the status bar over the Back row/title, `toast` green, stacked-check icon, `minWidth` 62%. |

## Files
`MainApp.tsx`, `src/navigation/StackNavigator.tsx`, `src/components/StatusBar/screenChrome.ts` (new), `src/components/ui/{field-label (new),input,select,date-field,button,legal-link,otp-boxes,step-indicator,success-illustration,text,toast}.tsx`, `src/components/{back/HeaderBack,identity/ConsentBlock,onboarding/onboarding-slide}.tsx`, `src/constants/{theme,styles}`, `src/screens/{onboarding-screen}.tsx`, `src/screens/auth/*`, `src/screens/setup/*`, tests: `headerBack`, `screenChrome` (new), `typography`, `termsPrivacyLinks`, `navigationFixes`.

## Operate / roll back
Revert the PR. No backend, API or migration change. The colour finding can be undone in one place (`theme.ts`) if the owner disagrees.

## Follow-ups / decisions for the owner
- B2: with `EXPO_PUBLIC_KYC_MODE=mock` the status screen loops (Verify, "Identity verified", Continue, "not verified"); staging/QA must use Dojah or the mock path must write a verified state. Not changed (behaviour).
- Setup step 1 Back signs the person out after a confirm (there is no earlier page); say if Figma's Back should do something else.
- Terms line kept unticked (owner); Cookies Policy has no page URL yet.
- Check on Android and a small iPhone (SE class); the slide layout scales by width/height but was only seen at 402x874.
- Figma's Terms of Service link is plain black and Privacy/Cookies bold teal; all three are teal regular here (instruction: same weight).
