# SOP: Visual pass of the signed-in caregiver app (simulator) and fixes

| | |
|---|---|
| **What shipped** | The differences found by walking the signed-in caregiver app on the iOS simulator against `ss/caregiver`, fixed in one PR: safe-area strips per screen, a `Text` layout bug, type sizes, Home header and cards, Bookings, chat, Job Details, Profile, Wallet, Notifications, Contact, clock dialogs, Client Profile, and a new AI Notetaker consent card (owner asked for it). Branch `fix/caregiver-screens-visual` (see the PR for the number). Ledger: `ledgers/SIM-caregiver-visual.md` (every row: Figma frame, difference, fixed or not, screenshot, file, size). |
| **Why** | PRs #51 and #57 were only Jest-tested; earlier visual passes always found real differences after Jest-only slices. The owner will test once on phones. |
| **Verified** | iOS simulator only (iPhone 17 Pro, Debug build, scratch backend, fake voice notes): before and after screenshots in `ledgers/sim-caregiver-visual/`. Jest for every suite that pins what changed (the 34 files listed below), `tsc --noEmit`, ESLint (0 errors). **Nothing was seen on Android, a real phone, a small iPhone or with Dynamic Type.** |

## Root causes found
| Cause | Effect | Fix |
|---|---|---|
| `Text` wraps its text in a plain `View`, so `style={{ flex: 1 }}` landed on the inner text only | In a row the text never wrapped: the AI Notetaker consent line ran off the screen edge; Profile / Account rows put the chevron next to the label | `components/ui/text.tsx` copies flex, flexGrow, flexShrink and alignSelf to the wrapper |
| One teal safe-area strip for the whole signed-in app (set in the previous visual pass) | Every white page had a teal band top and bottom; Figma is white with dark status icons and the bottom bar on white | `screenChrome.ts` `chromeForRoute`, applied by a `focus` listener on the signed-in stack: teal top only for BottomNavigation (Home, Bookings, Vitals), ChatScreen, CarePlans; off-white strips for the care plan pages; white under the bottom bar everywhere (pale teal under the chat composer) |
| Several teal headers added ~50 pt of padding on top of that strip | Home, chat and care plan hub headers 27-75 pt too tall | padding cut in `Home.tsx`, `ChatScreen.tsx`, `CarePlans.tsx` |
| Type 20-40% bigger than the design | Chips wrapped, headings dominated | New size tokens `micro` 10, `label` 12, `compact` 14 (ascending in `theme.sizes`, listed in `typography.test.tsx`) and `Text` variants `micro`, `label`, `compact`, `subtitle`; screen titles use `page` (22) |

## How (decisions)
- Colours: the Figma PNGs are Display P3; every colour was converted to sRGB (converter in the session scratch; teal and coral stay as they were). New tokens: `background` `#F9FBFB`, `promoBackground` `#FFF6F5`, `switchTrack`, `sectionTitle`, `muted`, `navIcon`, `navBar`, `bubbleReceived`, `bubbleSent`.
- Home cards: Clock in / Clock out / Accept / Decline stacked on the right as drawn; 64 pt avatar; the location notices stay (they explain what the app shares, not in Figma).
- Chat booking card: compact and centred (about 72% wide) as drawn.
- Consent card (`ConsentCard.tsx`): shield and title, a square checkbox row (the whole row is the tap target), hairline, lock note. The counsel-reviewed words (`consentCopy.ts`) and the testIDs are unchanged.
- Wallet card: taller, a touch lighter, two translucent discs for Figma's wave shapes (no image asset).
- Notifications and Contact Us: Figma's arrow / round back button with a centred title (`ScreenShell` gets a `centered` option).
- Not changed: anything off by owner rule (calling, Learn, Refer and Earn, support chat, Chats list, vitals badges, FallGuard button), the visit flow pages (no Figma frame).

## What's involved
`constants/theme.ts`, `constants/styles.tsx`, `components/ui/{text,confirm-dialog}.tsx`, `components/StatusBar/screenChrome.ts`, `navigation/{StackNavigator,BottomNavigation}.tsx`, `components/home/HomeBlocks.tsx`, `components/booking/BookingBlocks.tsx`, `components/chat/BookingContextCard.tsx`, `components/account/ScreenShell.tsx`, `components/careplan/{PlanScreen,parts,ClientCarePlanRow}.tsx`, screens Home, ChatScreen, AINoteTaker, VoiceNoteReview, ConsentCard, BookingDetails, CaregiverBookings, ClientProfile, CarePlans, Vitals, VitalDetail, Profile, AccountData, ChangePassword, EarningPayment, Wallet, Notifications, Contact. New test `__tests__/visualPassFixes.test.tsx` (Text wrapper, ConsentCard, chrome per route); `typography.test.tsx` lists the new sizes. No backend, api-client or patient change (the patient app has its own `Text`).

## Verification
- Jest, single worker, on the 34 suites that touch the changed code: `account`, `aiNoteTaker`, `arrivedEarning`, `bookingsParity`, `bottomNavigation`, `carePlanCreate`, `carePlanDetails`, `carePlanDetailsTasks`, `carePlanHub`, `carePlanMedications`, `changePassword`, `chatCalling`, `chatParity`, `clientProfile`, `directions`, `earningPayment`, `headerBack`, `home`, `homeParity`, `navigationFixes`, `notifications`, `offerUnavailable`, `offers`, `onboardingParity`, `screenChrome`, `shortVisit`, `staticScreens`, `typography`, `visit`, `visualPassFixes`, `vitals`, `voiceNoteFlow`, `voiceNoteReview`, `wallet`: all pass. `tsc --noEmit` clean, ESLint 0 errors. CI runs the rest.
- Simulator: see the ledger; the screens not re-seen after the last changes are listed there.

## Operate / roll back
Revert the PR. The strip colours are decided in one function (`chromeForRoute`); the type scale in `theme.sizes`. No flag changes.

## Follow-ups
- Vital detail: round back button and a smooth chart fill (the area fill shows thin vertical lines); Notetaker round back button; clock-out / clock-in dialogs open over the visit page, Figma shows them over Home (owner decision).
- Re-check on Android and a small iPhone; not seen: Care plan hub, Contact Us, vital detail, clocked-out page, change password, add-vitals modals, Completed tab, offer Job Details.
- Needs backend or content (unchanged): Chats list, bank logos, FallGuard for caregivers, weekly earning.
