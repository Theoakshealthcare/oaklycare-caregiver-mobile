# SOP: Caregiver app, iOS Debug build with Metro hot reload (simulator)

| | |
|---|---|
| **What shipped** | `apps/caregiver/scripts/ios-debug.sh` (run as `pnpm --filter oaklycare-caregiver-mobile ios:debug <cmd>`): prebuild, Pods, a **Debug** `xcodebuild`, install on the simulator and Metro with file watching, in one command. A JS edit now appears on the simulator in seconds with no rebuild. |
| **Branch / commit** | `chore/ios-debug-build`, cut from `oakly/main` `312eaa5`. Not pushed. |
| **Why it was needed** | Only a Release build worked, so every fix cost about 10 minutes (build, manual copy of `React.framework`, codesign) before the owner could look at it. |
| **Tracked changes** | The script, one `package.json` script (`ios:debug`), this SOP, a line in `docs/checklist/README.md`. No app code, no Podfile or config-plugin change was needed (see Why it failed). |

## Run it
```bash
cd apps/caregiver
pnpm install --frozen-lockfile                 # once per checkout / worktree
bash scripts/ios-debug.sh dev --clean          # first time, or after any native dependency change
bash scripts/ios-debug.sh dev                  # later: reuses ios/, builds incrementally, starts Metro, launches the app
```
Pieces, if you want them apart: `setup [--clean]`, `build`, `install`, `metro`. Edit any file under `apps/caregiver/src`, save, and the running app updates (Fast Refresh). Rebuild (`build`, then `install`) only after a native change (a new Expo module, `app.json` plugins, `Podfile.properties.json`).

Environment: `SIM_UDID` / `SIM_NAME` (default iPhone 17 Pro; a booted simulator wins), `EXPO_PUBLIC_API_URL` (default `http://localhost:8000`), `METRO_PORT` (default 8081, which is where the Debug app looks).

## Why it failed before (and what the cause really was)
The handoff listed four symptoms. Starting from a clean checkout, **none reproduced**: a fresh `expo prebuild` plus `pod install` plus a plain `xcodebuild -configuration Debug` linked and ran first time. So the cause was the **stale `ios/` tree in the main checkout**, not the project config.

| Symptom (handoff §7) | What is actually going on |
|---|---|
| Debug link fails, missing `getDebugProps` and friends | React Native 0.86 ships a prebuilt `React.xcframework` for **both** configurations. `pod install` downloads `reactnative-core-0.86.3-{debug,release}.tar.gz` (and the same pair for Hermes and ReactNativeDependencies) into `Pods/*-artifacts/`, and the `[RNCore] Replace React Native Core for the right configuration` script phase (`react-native/scripts/replace-rncore-version.js`) extracts the one matching the build configuration. The main checkout's `Pods/ReactNativeCore-artifacts/` held **only the release tarball**, so Debug had nothing to swap in and linked against release symbols. A fresh `pod install` fetches both (debug 99 MB, release 31 MB for RN core). The debug tarball exists on Maven Central for 0.86.3; nothing needs building from source and `ios.buildReactNativeFromSource` stays off. |
| `React.xcframework` slices missing the `React` binary | Same stale Pods tree (a hand-extracted or half-swapped xcframework). A clean `pod install` gives every slice its binary. `verify_pods` in the script checks the tarballs and the device and simulator slices and says "run `setup --clean`" if anything is missing, instead of a link error 5 minutes later. |
| `.xcode.env.local` pins a Node that no longer exists | The "Bundle React Native code and images" phase runs `$NODE_BINARY`. `setup` rewrites the file with `command -v node` every time. |
| Release workaround skipped Embed and needed a manual `React.framework` copy and codesign | Not needed with a Debug build: the normal Embed Frameworks phase embeds and signs `React.framework` for the simulator. |

I could not establish *how* the main checkout ended up release-only (an earlier offline or env-flagged `pod install`, probably); the recipe makes that irrelevant because `--clean` regenerates everything.

## Gotchas this work found
| Gotcha | Detail |
|---|---|
| **Never start Metro with `CI=1`** | Expo CLI turns file watching off under `CI`. Metro still serves the bundle, and the app still loads, but a saved edit produces **no HMR message at all**, so hot reload silently does nothing. Proved by connecting a WebSocket client to `/hot`: no `update-start` after an edit with `CI=1`, one on every edit without it. The script runs Metro with `env -u CI`. (`CI=1` is fine for `expo prebuild`, where it only suppresses prompts.) |
| Expo rewrites `tsconfig.json` | `expo start` edits `apps/caregiver/tsconfig.json` (drops `.expo/types`, reformats). The script sets `EXPO_NO_TYPESCRIPT_SETUP=1`; if you start Metro another way, `git checkout apps/caregiver/tsconfig.json` before committing. |
| Screenshots lag | A simulator screenshot taken the instant after saving can still show the old text. Wait a second or two before concluding hot reload failed. |
| LogBox toast covers taps | In a Debug build any warning raises a dark "Open debugger to view warnings" toast over the bottom 50 px (it covers the tab bar and the welcome "Login" link). Tap its X before concluding a tap does nothing (device re-check 1, RC1-02). |
| Metro port | The Debug app has no dev launcher; it reads `localhost:8081`. Other port: shake the device for the dev menu and set the bundler location. |

## What is involved
| Path | Change |
|---|---|
| `apps/caregiver/scripts/ios-debug.sh` (new) | `setup`, `build`, `install`, `metro`, `dev` |
| `apps/caregiver/package.json` | script `ios:debug` |
| `apps/caregiver/ios/` (git-ignored, regenerated) | Output of `expo prebuild`; derived data in `ios/build-debug/`, build log in `ios/build-debug.log` |
| `docs/checklist/README.md` | "Caregiver iOS dev loop" |

Not touched: the Podfile (generated), `Podfile.properties.json`, `app.json`, any config plugin. None of them needed a change.

## Verification (all on the iPhone 17 Pro simulator, iOS 26.2, Xcode 27.0, RN 0.86.3, Expo SDK 57, CocoaPods 1.16.2, Node 24)
| Check | Result |
|---|---|
| Fresh worktree: `pnpm install --frozen-lockfile`, `expo prebuild`, `pod install`, `xcodebuild -configuration Debug` | **BUILD SUCCEEDED**, 6m12s cold (pnpm 12 s, prebuild 4 s, pod install 45 s) |
| App installed and launched; Metro served `index.ts` (1851 modules) | Onboarding screen rendered |
| **Hot reload** | Edited the onboarding button label (`Get Started` to `Get Started HOTRELOAD`) and saved: the running app showed the new text with the same process ID (no rebuild, no relaunch). Reverting the edit hot-reloaded back. |
| Clean repeat through the script: `ios-debug.sh dev --clean` (deletes `ios/`, prebuild, Pods, build, Metro, install, launch) | **BUILD SUCCEEDED in 232 s**, app launched by the script, a second label edit (`Get Started CLEANRUN`) appeared without a rebuild |
| Incremental rebuild with no native change (`ios-debug.sh build`) | 19 s |
| Metro HMR socket | No `update-start` after an edit with `CI=1`; one after every edit without it |
| Typecheck / lint | Not run: no TypeScript touched (a shell script, a `package.json` script, two docs) |
| **Not verified** | A physical iPhone (needs signing; out of scope). The app against a live backend: the build was only launched to onboarding. Login and the rest of the flows were not exercised. |

## Operate / roll back
Revert the branch; nothing outside `apps/caregiver/scripts/` changes behaviour. If `dev` ever fails at link time with missing React symbols, run `bash scripts/ios-debug.sh setup --clean` first: that is the fix for every symptom above.

## Follow-ups
- Release / TestFlight builds are untouched. If the Release path needs the same care, note that the Release configuration swaps in the release tarball by the same script phase, so a clean `pod install` is the first thing to try there too.
- Physical-device Debug builds need signing set up; the script is simulator only.
- Metro on a non-default port from the script is not supported (the Debug app looks on 8081).
