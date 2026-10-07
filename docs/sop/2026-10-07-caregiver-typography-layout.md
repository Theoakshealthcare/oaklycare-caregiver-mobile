# Caregiver typography and layout polish (2026-10-07)

**What shipped:** a fixed, width-damped type scale with capped OS text scaling; button and tab labels that no longer break mid-word; safe-area-aware Skip button and banner; Login link on every onboarding slide; "Back to home" after a visit lands on the Home tab. Branch `fix/caregiver-typography-layout`.

## Why
Running on an iPhone 17 Pro showed "Declin/e", "Complete/d" and a two-line "New Request". Root cause in `apps/caregiver/src/constants/theme.ts`:
- Sizes were derived from screen HEIGHT (`height * 0.015`, ...). Font size then tracked screen height while the containers track width, so tall phones got oversized text in unchanged-width boxes.
- Every size was divided by `PixelRatio.getFontScale()`, which cancelled the user's accessibility text size (and the sizes doubled as padding, so layout moved with it).

## How
| Decision | Detail |
|---|---|
| Six font tokens only | `theme.sizes`: caption 12, body 15, subtitle 17, title 20, heading 24, display 28 (at the 390 pt design width). Old names (nano, base, small, font, medium, large, extraLarge, xxl, xxxl, button) removed; spacing uses went to `theme.spacing`. |
| Width-damped scale | `scaleFactor(w) = clamp(1 + (w/390 - 1) * 0.5, 0.9, 1.15)`, computed once from `Dimensions`. Applied to sizes and `theme.spacing`. Never height. |
| Accessibility | RN applies the OS text size natively; we cap it with `maxFontSizeMultiplier = 1.3` (`MAX_FONT_SCALE`) in `Text`, `Input`, `Button` labels and raw `TextInput`s. `allowFontScaling` stays on. |
| Labels | `Button` labels: `numberOfLines={1}`, `adjustsFontSizeToFit`, `minimumFontScale={0.85}`, horizontal padding 16 (was ~23). Job card actions: `flex: 1`, padding 8, gap 8. Bookings tabs: one line, fit-to-width, padding 4; label "New request" (kept; fit-to-width covers 375 pt). |
| Text variants | h1 display, h2 heading, h3 title, body body, small and caption both caption (12); line height = 1.35 x size (`lineHeightFor`). |
| Guard | `__tests__/typography.test.tsx` fails if a raw numeric `fontSize:` appears anywhere in `src/` outside `theme.ts`. |
| Safe area | `SafeAreaProvider` added in `App.tsx`; onboarding Skip uses `max(insets.top, 8)`; `InAppBanner` uses `insets.top`. Jest uses the library mock. |
| Login link | `isLast` prop removed from the slide; link always rendered. |
| Back to home | `VisitFlow.goHome` -> `popTo("BottomNavigation", { tab: "home", at: Date.now() })`. `BottomNavigation` reads `route.params` and switches tab (it kept the previously selected Bookings tab because its tab state is local). |

Rejected: `allowFontScaling={false}` (breaks accessibility); height-based scaling (the original bug); per-device font tables.

## Files
`src/constants/theme.ts`, `styles.tsx`, `components/ui/{text,button,input,select,box,ErrorDialog}.tsx`, `components/back/HeaderBack.tsx`, `components/booking/{OfferCard,InAppBanner}.tsx`, `components/onboarding/onboarding-slide.tsx`, `screens/onboarding-screen.tsx`, `screens/booking/CaregiverBookings.tsx`, `screens/visit/{VisitFlow,VisitSteps}.tsx`, `screens/chat/{ChatScreen,AINoteTaker}.tsx`, `screens/auth/{VerifyEmail,AccountCreated}.tsx`, `navigation/{BottomNavigation,Navigations}.tsx`, `App.tsx`, `jest.setup.ts`.

Screens whose layout changed (check visually): onboarding (all slides: Skip, Login link, type), Home and Bookings job cards (3-button row), Bookings tab pill, visit flow (all steps incl. code input), Verify email (OTP boxes), chat and AI note taker inputs, Select modal, error dialog, every screen using `Text`/`Input`/`Button`/`Box` (sizes and paddings now fixed values).

## Verification
Jest: scale function at 320/375/390/430/768 and clamps; sizes unchanged with mocked `getFontScale` = 2; `Text` and `Button` props; no raw `fontSize`; onboarding Login on slide 1; "Back to home" calls `popTo` with the Home tab. Typecheck, lint, test, admin build run as in CI. Not verified on a device (owner visual pass).

## Operate / roll back
Pure client change; revert the branch. No API or migration changes.

## Follow-ups
- Visual pass on a 375 pt and a large-text setting; confirm Skip is not double-padded under the existing `SafeAreaView` in `MainApp`.
- Many screens still use literal paddings and radii (only fonts are guarded).
