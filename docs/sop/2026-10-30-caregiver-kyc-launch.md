# SOP: Caregiver KYC, slice K7b (launch the hosted Dojah page from the app)

| | |
|---|---|
| **Date** | 2026-10-30 |
| **Branch / PR** | `feat/kyc-mobile-launch`, cut from `oakly/main` `f14a9a3` (K7a merged). Not pushed; the lead session pushes and opens the PR. |
| **Depends on** | Backend K2 (merged) and **backend slice KD2** (in progress when this was written): `POST /caregiver/identity-verification/sessions` gains `widget_url`, and the backend serves the page. Provider: Dojah (switched from Prembly 2026-10-30); backend `docs/sop/2026-10-30-kyc-dojah-adapter.md` ("Live sandbox pass"). |
| **Device status** | **NOT device-verified.** Jest only, with a mocked `expo-web-browser`, a faked server behind `fetch`, and a hand-written `widget_url` type. Needs the owner's phone and a **new dev build**. Nothing here has opened a real browser, a camera or Dojah. |

## What shipped
The identity step can now run end to end in the app, behind the same switch as K7a. In `api` mode the app asks the backend for a session, opens the page the backend hosts (`widget_url`) in the system browser session, and when that closes, **however it closes**, shows "Checking" and polls the server. The app never decides the result.

| Piece | What it does |
|---|---|
| Browser launcher | `openAuthSessionAsync(widget_url, "oaklycarecaregivermobile://kyc/return")` from `expo-web-browser`. Only an absolute `https:` URL is opened (the value comes from a response body). |
| Outcomes | Redirect to the return page -> `completed` (hint `completed`). Cancel, dismiss, locked, opened -> `dismissed` (hint `closed`). Native error, or no usable `widget_url` -> `error` (hint `error`, "Something went wrong", no attempt used). |
| Checking state | A dismissal is **not a failure**: the screen shows "Checking your details..." and polls. After about a minute: "Still checking. This can take a few minutes. You can leave this screen; we will tell you when it is done." |
| Continue verification | After a dismissal the checking screen offers **Continue verification**, which calls `POST .../sessions` again with the same body. The server resumes the open attempt (`200`, same reference, a fresh `widget_url`) or, if it expired, the state changes to "That session timed out / Start again" with a new consent tick. No new endpoint. |
| Prembly wording | The consent draft named "Prembly"; it names "Dojah". No other Prembly text was in the app (K7a kept the name in one constant). |

## Why
K7a built every screen against a mock and left the widget behind a seam (`IdentityWidgetLauncher`). The owner decided the app would not embed Dojah's React Native / Expo SDK (native code on a build that already fails to link on this Mac, no stated Expo SDK 57 support, extra privacy prompts: delta plan section 3, "main risk") and would instead open a page the backend hosts. That keeps the provider out of the app binary, and the backend page is one place to change when Dojah changes.

Two facts from the live sandbox pass shaped the states: the widget's own callbacks cannot be trusted or even observed (so the return redirect is only "the page is done"), and Dojah's webhook can be missing, in which case the server's reconcile job settles the attempt about **six minutes** later. Hence: a dismissal is not a failure, the wait copy promises a few minutes, and the polling screen says the person may leave.

## How
| Decision | Choice / alternative rejected |
|---|---|
| In-app browser, not a WebView | `openAuthSessionAsync`: on iOS an `ASWebAuthenticationSession` (Safari engine, system camera and permission UI, no cookies or scripts reachable from the app), on Android a Chrome Custom Tab with the app's scheme as the redirect. Rejected: `react-native-webview` (a native dependency, camera permission bookkeeping in the app, and the app could see the page), and Dojah's native SDK (owner decision). |
| One seam, one new outcome | `IdentityWidgetLauncher.open({ config, widgetUrl })` (was `open(config)`); `WidgetOutcome` gains `dismissed`. The screens and view still know no provider type. The mock launcher still plays `closed` (its "closed" screen is kept for a widget that reports a close). |
| Redirect = `completed` hint | The page ends the same way on success, close and error, and the app cannot tell them apart. The `completed` hint only moves the attempt to `awaiting_result` server-side; it cannot verify anyone. **Trade-off:** a person who quit inside the page and then tapped "Done, return to the app" has told the server `completed`, so "Continue verification" is not offered (a second run under one reference is ambiguous and could be billed twice: backend adapter SOP follow-up); they wait for the reconcile job to settle or expire the attempt. If KD2 can tell the cases apart on the return URL, tell the app and this becomes `dismissed`. |
| Continue is conditional | Offered only after a dismissal, while the server shows an open attempt, and never when `last_attempt_status` is `awaiting_result` (`canContinueVerification`). If the attempt expired meanwhile, the polled state wins and the normal "Start again" screen (with consent) replaces it. |
| Dismissal is not a failure | Phase `submitted` with `dismissed: true` resolves to `checking` while the server shows an open attempt; once the server answers (verified, review, failed, expired) its screen replaces it. The "closed / Try again" screen exists only for a launcher that reports `closed`. |
| Polling | **Cadence and cleanup unchanged** (one chain of `setTimeout`s, 3 s / 5 s / 10 s, stop at 5 minutes, "Check again", cleared on unmount and when no longer awaited). Only the "slow" threshold moved from 2 minutes to 1 minute, with the new copy. Note the reconcile job can settle at about 6 minutes, i.e. after the 5-minute stop: the person sees "Check again" (or the push) rather than an endless timer. |
| Consent text version unchanged | The draft now says Dojah. `CONSENT_TEXT_VERSION` stays `kyc-2026-10` because it must equal the backend's `KYC_POLICY_VERSION`, no consent has been recorded for this draft (the switch is off), and counsel has not signed the text. **Set the final text and both versions together** (K7a follow-up). |
| Return URL | `KYC_RETURN_URL` in `src/identity/config.ts` = `oaklycarecaregivermobile://kyc/return`. The scheme is `expo.scheme` in `app.json`. **The brief said `oaklycaregiver://kyc/return`; the app's real scheme is `oaklycarecaregivermobile`**, so the backend setting `KYC_RETURN_URL` must be `oaklycarecaregivermobile://kyc/return` (a test pins the constant to `app.json`). |
| Types | `IdentitySession = Schemas[...] & { widget_url?: string }` in `identityModel.ts`, marked TODO, and `parseSession` reads the field from the untyped body. After KD2 merges and the lead runs `OAKLY_BACKEND_DIR=<backend> pnpm api:sync`, delete the intersection and the spread in `parseSession` (the field is optional so an older backend still works: no url -> widget error, never a result). |

## What's involved
| Area | Paths (under `apps/caregiver` unless noted) |
|---|---|
| Launcher and seam | `src/identity/browserWidgetLauncher.ts` (new), `src/identity/widget.ts` (`IdentityWidgetLaunch`, `dismissed`, `api` mode uses the browser launcher), `src/identity/config.ts` (`KYC_RETURN_URL`, how to turn it on) |
| Model and copy | `src/identity/identityModel.ts` (`widget_url` type, `submitted.dismissed`, `canContinueVerification`, `STILL_CHECKING_TEXT`, `SLOW_AFTER_MS` 60 s, partner name) |
| Service | `src/services/identity.service.ts` (`parseSession` carries `widget_url`) |
| Screens | `src/screens/setup/IdentityVerification.tsx` (opens with `{ config, widgetUrl }`, handles `dismissed`), `IdentityVerificationView.tsx` (slow copy, Continue verification), `src/hooks/useIdentityVerification.ts` (comment only) |
| Dependency | `expo-web-browser ~57.0.3` in `package.json`, `pnpm-lock.yaml`, config plugin added to `app.json` by `expo install`. **Native module: needs a new dev build / production build** (a JS-only update is not enough). |
| Tests | `__tests__/identityBrowserLauncher.test.ts` (new), `__tests__/identityLaunchFlow.test.tsx` (new), additions to `identityModel`, `identityService`; slow-copy edits in `identityScreen`, `identityPolling`; fixtures `sessionWithUrl`, `WIDGET_URL` in `test-utils/identityFixtures.ts`; a default `expo-web-browser` mock in `jest.setup.ts` |

No backend, `apps/admin` or `packages/api-client` change; no migration.

## Verification
Local, in the worktree, as CI runs them: `pnpm install --frozen-lockfile`; `pnpm api:generate` then `git diff --exit-code packages/api-client/src/schema.d.ts` (clean: the schema is unchanged until the sync); `pnpm typecheck` (clean, all workspaces); ESLint on every new and changed file (0 errors; the one repo-wide error, `BankDetails.tsx:186`, is pre-existing on `oakly/main` and untouched); `jest --runInBand` for the whole caregiver app, **48 suites, 726 tests** (up from 46 / 690), exit 0, the process exits on its own (38 s), no `--forceExit`. The admin build and the rest of CI are left to CI.

What the new tests prove:
- **Launcher** (`identityBrowserLauncher`, `expo-web-browser` mocked): opens the URL exactly once with the return URL; never opens a missing, `http:`, `javascript:` or malformed URL; `success` -> `completed`; `cancel`, `dismiss`, `locked`, `opened` -> `dismissed`; a rejected native call -> `error`, never a rejection; the return URL's scheme equals `app.json`.
- **Flow** (`identityLaunchFlow`): the real service against a faked server (paths, bodies and the `201`/`200` split as in K2), the real launcher, the real screen, fake timers. Return -> Checking, hints `opened` + `completed`; dismissal -> Checking (no failure screen), hint `closed`, Continue shown, polling continues, "Still checking" copy after a minute, the server's answer wins (verified / under review / try again / expired); Continue resumes the same attempt with the same request body and reopens the page; Continue hidden once the server has `awaiting_result`; missing `widget_url` and native errors end as a widget error; **unmount while the browser is open** sends nothing and sets no state when it later ends; unmount while dismissed leaves no timer (`jest.getTimerCount() === 0`).
- **Model/service**: `canContinueVerification` table, the dismissal resolves to the server's screen, `widget_url` carried only when a string, no "Prembly" in the consent.

**NOT verified (needs the owner's phone and a new dev build):**
- That the page loads, the Dojah widget runs, and **the camera works inside the browser session**. This is the main risk: `ASWebAuthenticationSession` is built for sign-in, and I could not confirm from documentation that it grants `getUserMedia` to a web page. If it does not, the fallback to evaluate is `WebBrowser.openBrowserAsync` (a Safari view controller / Custom Tab) plus a `Linking` listener for the return URL; the launcher is the only file that changes.
- That the redirect to `oaklycarecaregivermobile://kyc/return` closes the session on iOS and Android and what a stray tap on the system "Cancel" returns.
- That the device's Dojah finishing produces a result the backend settles (backend K8), and the `~6 minute` reconcile case in the app.
- The real `widget_url` response (hand-written type until the sync) and the KD2 page copy ("Done, return to the app").
- Layout of the new text and button on small screens and with large text.

**What I checked about camera permissions:** `app.json` already carries the `expo-camera` plugin (iOS `NSCameraUsageDescription`: "Oakly uses your camera to capture your identity and credential documents.") and Android `CAMERA`, from the document-photo feature. The capture here does not use the app's camera: it runs in a Safari-engine / Chrome session that asks for the site's camera access itself, so **no new Info.plist string or Android permission is added** and none is needed for this flow. K7a's `permissionDenied` screen (Open Settings) is not reachable from the browser launcher, which cannot see a denial; a denied camera shows up as the page's own message and a dismissal. The existing string would be shown only if something in the app asked for the camera.

## Operate / roll back
- **Turn it on** (dev build or release): build with `EXPO_PUBLIC_KYC_MODE=api` (Expo inlines it at build time; for Metro, restart with `--clear`). Default is unset = `off`: Step 2 goes to Consent exactly as before, so merging this changes nothing for users. `mock` still works for screens without a backend. **Before turning `api` on for anyone:** KD2 deployed with `KYC_RETURN_URL=oaklycarecaregivermobile://kyc/return`, the backend `KYC_POLICY_VERSION` equal to the app's `CONSENT_TEXT_VERSION`, and a build that includes `expo-web-browser`.
- **New native dependency:** make a new dev build (`npx expo prebuild`/EAS or the project's usual recipe) before testing on a device. Expo Go is not the target.
- **Roll back:** revert the PR (the switch is off by default, so there is nothing to undo in config). The lockfile and `app.json` plugin go with it.

## Follow-ups
| Item | Owner / slice |
|---|---|
| `pnpm api:sync` after KD2 merges; then drop the hand-written `widget_url` type and the spread in `parseSession`, make the field required if the schema does | lead (told when) |
| Device pass: camera in the browser session on iOS and Android, redirect back, Continue verification, large text (K8) | owner |
| If the camera fails in `ASWebAuthenticationSession`: switch the launcher to `openBrowserAsync` + a `Linking` return listener | K7b follow-up |
| Ask KD2 whether the return URL can say how the page ended (for example a query value); today a quit-then-"Done" looks like `completed` | KD2 / lead |
| The 5-minute polling stop is shorter than the ~6-minute reconcile case; consider 8 minutes, or polling again when the app comes to the foreground / on the push (the delta plan suggests polling from app launch) | lead / next slice |
| Final consent text with counsel, then text and `KYC_POLICY_VERSION` change together | owner / counsel |
| The "Verification is open" placeholder and K7a's `permissionDenied` screen are now only reachable with another launcher; keep or remove after the device pass | later |
