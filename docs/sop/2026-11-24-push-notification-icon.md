# SOP: push notifications show the Oakly logo, not a bell (both apps)

| | |
|---|---|
| **What shipped** | A new Android notification icon, a white silhouette of the Oakly logo (heart in hands), 96x96 on a transparent background, in both apps (`assets/images/notification-icon.png`), with the brand teal as the tint (`color: "#168283"`). The patient app now configures the icon at all (it had none). |
| **Reported by** | The owner, on the first real-phone test (2026-11-24): the push notification carried a bell, not the logo. |
| **Not verified** | On a phone: the plugin settings are baked in at build time, so a NEW APK of each app is needed, and an Android phone has to show the push. iOS shows the app icon by itself and was never affected. |

## Why
- Caregiver app: the file the plugin pointed at (`notification-icon.png`) was itself a drawing of a bell, so Android showed a bell.
- Patient app: `expo-notifications` was listed with no options, so Android showed the system default.
- Android draws only the alpha channel of a notification small icon, so a coloured logo would become a white square: the icon must be a silhouette.

## How
The silhouette is derived from the existing logo (`adaptive-icon.png`): every non-white pixel becomes opaque white, the white background and the thin gaps between the shapes stay transparent, then it is centred in 96x96 with a 6 px margin. Both apps use the same file; the tint colour is the brand teal (the old caregiver value was white). Rejected: shipping the full-colour logo (shows as a white square) and a designer redraw (not needed for now; a hand-drawn 96x96 mono icon from the designer can replace the file with no code change).

## What's involved
`apps/caregiver/assets/images/notification-icon.png` (replaced), `apps/patient/assets/images/notification-icon.png` (new), `apps/{caregiver,patient}/app.json` (the `expo-notifications` plugin options). No code change. `expo config` evaluates for both apps.

## Verification
The generated icon was rendered on a dark background and checked by eye. `npx expo config --json` runs for both apps and shows the plugin options.

## Operate / roll back
Revert the PR; rebuild. To change the look, replace the PNG (white on transparent, 96x96) and rebuild.

## Follow-ups
Ask the designer for a hand-tuned mono icon; check how it looks on a real Android phone in the shade and on the lock screen (small icons are shown at about 24 dp).
