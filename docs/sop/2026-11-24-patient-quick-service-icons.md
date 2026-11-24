# SOP: patient Quick Service artwork replaced with the owner's own icons

| | |
|---|---|
| **What shipped** | The four illustrations the owner exported are now in `apps/patient/assets/images/quick/` under clear names, and the Home "Book a Nurse" tile uses the sharp nurse art instead of the blurry crop of the Figma screenshot. |
| **Why** | Patient slice 1 cropped the tile from the Figma PNG (about 64 px, upscaled): soft on a high-resolution phone. The owner supplied proper artwork on 2026-11-24. |
| **Not verified** | On a screen: the tile (circle plus art) was composed in a preview image and Jest/tsc/ESLint pass, but it has not been seen in the app. |

## What's involved
| File | What it is | Used now? |
|---|---|---|
| `quick/book-a-nurse.png` (170x136) | the two nurses with a folder | Yes: Home, "Book a Nurse" |
| `quick/prescription-request.png` (145x145) | capsule and tablet | No: the Prescription Request service is not built |
| `quick/physiotherapy-request.png` (136x141) | elderly man and woman | No: Physiotherapy Request is not built |
| `quick/medication-reminder.png` (188x188) | 3D capsule in a grey circle | No: the Medication Reminder card is not built |

`src/screens/home/Home.tsx`: the tile now draws its own 62 px pale pink circle (`#FCEDEB`, the tint the old crop carried) with the art centred inside it (`resizeMode="contain"`); the old `home-quick-nurse.png` is deleted. The other three pictures are kept for when those services get built (owner rule: unbuilt stays off, so they are not shown).

## Verification
Jest (the whole patient suite ran by mistake instead of a named file set: 25 suites, 297 tests pass), `tsc --noEmit` and ESLint on `Home.tsx` clean; no reference to the old file remains in code. A preview of the circle with the art was checked by eye.

## Operate / roll back
Revert the PR. To show another service tile, add it next to `QUICK_NURSE` with its own picture from `quick/` and wire its route.

## Follow-ups
- The files are small (about 140-190 px wide): sharp at the 62 px tile on a 3x phone only just; a 3x export (about 190+ px tiles) would be ideal if the designer has one.
- Look at the tile on a real phone next to the Figma frame (size of the art inside the circle).
