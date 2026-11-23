# SOP: Patient profile, vitals and FallGuard screens match the Figma exports (slice 4)

| | |
|---|---|
| **What shipped** | Profile Settings, Edit Profile (photo upload, gender, age), Account and Data, Contact Us; the Vitals home (Download Report, History & Insights), the manual-entry sheet for each vital, the "<Vital> Monitoring" pages, History & Insights, "Vital Report Downloaded Successfully"; FallGuard intro, question screens with section titles, progress bar and the server's scores, and the result screen. |
| **Branch / PR** | `feat/patient-profile-vitals-parity`, monorepo PR (see the PR for the number). |
| **Why** | The owner demands exact parity with the designs in `ss/patient`. Audit rows: `ledgers/PARITY-patient-B.md` rows 2 to 10, 12, 15 (kept as the sharing screen), 16 to 20, 22 to 25 (contact only), 36 to 38 (closed or deferred row by row below). |
| **Verified** | Jest for the files touched and every test that pins them, `tsc --noEmit`, ESLint (patient app). **Nothing was seen on a device in this slice: the iOS simulator was in use by another session, so the visual pass is pending.** The AI insights success shape, the CSV download and the photo upload answer were not captured against a live backend (see "Not live"). |

## What was built, row by row
| Figma | Result |
|---|---|
| Profile Settings | Back circle, large "Profile Settings", card with the photo (initials when there is none), name and "Verified User" (only when `is_verified`). Rows: Edit Personal Information, FAQs, About Us, Contact Us, then Terms of Service and Privacy Policy (not in the design, required to be reachable), Account and Data. **Not built, so left out:** Family Details, Wallet, Subscription Plan, Live Chat, Drug Reminder, Satisfaction Score, Refer and Earn, Complaints. "Change password" left the menu: it is the "Update Password" row of Edit Profile |
| Edit Profile | Centred title, photo with "Upload Image" (expo-image-picker, then `POST /auth/profile/upload-image`, then `/auth/me` again), Figma labels and order, Select Gender (Female / Male / Other, `PUT /auth/profile` `gender`), Enter Age, "Update Password", green top toast "Profile has been updated". Email stays read-only with the support note (the server refuses a changed email) |
| Account and Data | Centred title, Delete Account first, then Logout in coral. Delete dialog is the design's card ("Close", "Are you sure you want to Delete Account", "Once you delete your account all your data will be deleted.", "Yes Delete Account" / "No, Go Back"); the two typos of the design are fixed |
| Contact Us | Centred title, one row "Send an email" (opens the mail app). Chat needs the support chat (not in v1), WhatsApp is a placeholder number |
| Vitals home | Teal header "Vitals / Real-time Health Metrics" with "Download Report"; six tiles in the design's order and names (Heart Rate, Blood Pressure, Temperature, Respiration Rate, Blood Glucose, Sleep Duration) with value, unit and "Updated at 10:45am"; "History & Insights" with the first two notes and "View all History". Typos fixed: "bpr" and "bpm" under blood pressure are the real units, "mgd/dl" is mg/dL |
| Manual entry | Now a card over the dimmed page (transparent modal route `AddVital`): vital icon, teal title, help line, button named for it ("Update Heart Rate" ...). Blood pressure is one "120 / 80" row. Glucose has a unit choice (mg/dL, mmol/L) and three boxes (Random, Fasting, Post-prandial): each filled box is one reading with its context in `notes`. Sleep has two pickers (every quarter hour, "10:00 pm") and a read-only total ("7 hours"). Temperature has °C / °F. Each unit is checked against the server's own range for it. Typos fixed: "Enter Heart Rate (pm)" appears as "(bpm)" and the respiratory sheet asks for the respiratory rate |
| Monitoring page | "<Vital> Monitoring" / "Vital Monitoring", the vital's card with "Last synced: 2 mins ago", an area chart with the latest reading marked, "Current" with unit, Day / Week / Month, then "History & Insights". Readings saved in the other unit of a pair are drawn in the unit of the latest one. Blood pressure plots the top number |
| History & Insights | The AI's notes with red dots, then every reading on record ("All readings", not in the design, kept because it is the only list of past readings) |
| Download Report | `GET /vitals/{patient_id}/download` (CSV) to a temporary file, then the phone's share sheet, then the full-screen "Vital Report Downloaded Successfully". The file is deleted when the sheet closes |
| FallGuard intro | Title, the design's paragraph, the illustration, "Why This Matters" with three numbered facts, "What Will Be Assessed ?" with four red bullets, "How Long Will It Take?", "Start Assessment" ("Assessments" in the design is a typo). The tagline "Predict. Prevent. Protect." (not in the design) is gone |
| FallGuard questions | "Back" link, section title and grey line, "N of 24 questions", thin progress bar, option cards "text ... Score : N" (the server's score, never added up on the phone), outlined Back button. No Next or Submit: choosing an answer moves on, choosing the 24th sends the assessment. Section titles are applied by position (1-4, 5-10, 11-14, 15-19, 20-24) and only while the list has 24 questions |
| FallGuard result | Back link, "Assessment Results" with a Share button (the score as a text message), score badge with "Total Risk Score", "What does this mean?" (the server's AI summary, when there is one), "Recommendations / Based on your assessment" as cards with a check, "Book a Home Visit". The extra "Done" button is gone |

## Owner decisions applied
| Decision | Where |
|---|---|
| FallGuard scores ARE shown, only the server's values | `domain/fallguard.ts` (`score` doc), `FallAssessment.tsx` |
| Normal / Critical badges: component built, OFF | `components/vitals/StatusBadge.tsx`, `domain/vitalStatus.ts` (`VITAL_STATUS_ENABLED = false`, empty `VITAL_THRESHOLDS`). The design's "Critical" on 138/85 and 16 breaths a minute is sample data |
| Unbuilt things stay OFF: wearable link and switch, Heart Alerts, caregiver access requests, wallet, chat, ... | Left out; `v1Routes` still pins the route list and the out-of-v1 words |
| Figma typos fixed, not copied | listed in the rows above |

## Where I did not follow Figma, and why
| Figma | What the app does | Why |
|---|---|---|
| Risk-band badge "11 / Moderate Risk", "What does this mean?" sentence, "Next Steps" / "Next Assessment Due" | The score shows with "Total Risk Score" and "out of 40"; no band label, no due date | The server returns no band and no interval; the clinician pack (section 4) says the old bands do not fit a 0 to 40 score. A label made up on the phone would be a clinical claim nobody signed. `RISK_BANDS` (`domain/fallguard.ts`) is the empty table: fill it only with signed bands and the badge, label and sentence appear (a test proves it) |
| Recommendation titles ("Regular Exercise"...) | The check card shows the server's sentence | The server sends sentences only |
| Result download button | Left out | There is no report to download. Share sends the score as text |
| Wearable / Manual switch, "Connect to Wearable Device", Heart Alerts, Recent Caregiver Access section | Left out. The older "Who can see my vitals" row stays | Owner: not built. The sharing screen is built (grant, list, revoke) and is a privacy control, so it stays reachable |
| Manual list with "Enter X Manually" | The tiles carry the "+" instead | With the wearable switch off, the manual list and the tiles would show the same six vitals twice. The "+" sits where the status badge will go |
| Total Sleep Duration as a typed field | Read-only, from the two pickers | Hours are already fixed by the two times; a third editable value could disagree |
| Age typed in | Saved as a birth date (`date_of_birth` = today minus that many years) | The server stores a birth date, not an age (`age` is ignored). Reads back as the same age; the exact day is not known |
| Password as one masked box | A row that opens the Change password screen | A password change needs the current password and the server refuses a password on `PUT /auth/profile` (`use_change_password`) |
| Logout with no dialog | Still asks first | Earlier audit decision P1-09; the design shows no dialog |
| Track pages (B rows 40, 41) | Not touched | The tracking screens belong to slice 3 (bookings); the in-app map stays off (no Maps key) |
| FAQs as a native accordion | Still opens the web page | The design shows questions only, no answers; needs copy from the owner |

## Backend used
| Call | Use | Evidence |
|---|---|---|
| `PUT /auth/profile`, `GET /auth/me` | name, phone, address, gender, birth date, emergency contact | `backend/docs/fe-integration-guide-patient-profile-vitals.md` section 3 (captured) |
| `POST /auth/profile/upload-image` | photo | multipart; caregiver app proves the call; **not captured live for the patient** |
| `GET /vitals/{patient_id}`, `POST /vitals/` | readings | guide section 4 (captured), unit and range rules per section 4.1 |
| `GET /vitals/{patient_id}/download` | CSV report | **not live**: no capture; the caregiver app reads it the same way |
| `GET /vitals/{patient_id}/insights` | AI notes | **not live for success**: the only capture is the "Unable to analyze vitals." stand-in (no Gemini key locally); the app reads `summary`, `concerns` and `recommendations` defensively. The backend calls the AI on every request, so the app keeps the answer for 30 minutes and waits for a first reading |
| `GET /fallguard/questions`, `POST /fallguard/submit` | assessment | `backend/docs/fe-integration-guide-patient-fallguard.md` (captured) |

## Files
`apps/patient/src/{domain/{vitals,vitalStatus,fallguard,format}.ts,hooks/{useVitals,useProfile}.ts,services/{vitals.service,vitalsReport,auth.service}.ts,api/filePart.ts,components/ui/{avatar,card-modal,page-header,screen}.tsx,components/vitals/{AreaChart,InsightList,StatusBadge,UnitChecks}.tsx,screens/{profile/*,vitals/*,fall/*}.tsx,navigation/{routes,Navigations,StackNavigator}}`, `apps/patient/{package.json,app.json}`, `pnpm-lock.yaml`, tests `vitals`, `profile`, `profileParity`, `fallguard`, `appScreens`, `authGate`, `push`, `v1Routes`.

**New native modules: `expo-image-picker`, `expo-file-system`, `expo-sharing` (plugins added to `app.json`). The patient dev build must be rebuilt; a JS reload is not enough.**

## Verification
- Jest (bounded): `vitals` (32), `profile` (16), `profileParity` (9), `fallguard` (17), `appScreens`, `authGate`, `push`, `v1Routes`, `domain`, `typing`, `legalLinks`, `keyboardScrollAndroid`, `refreshFailure`, `notifications`, `names`, `bookingFlows`, `bookingUnits`; `tsc --noEmit` and ESLint on the patient app (only warnings that were already there).
- Proved by tests: each sheet's text and request body, per-unit ranges, one request per glucose box, the sleep total, the Day / Week / Month windows, unit conversion on the chart, insights and CSV paths, the photo going out as plain-fetch multipart, section titles by position, "Score : N" from the server, no Next button, no band label until a band exists, no Normal / Critical anywhere.
- **Not seen:** any of it on a screen (iOS simulator was busy; Android and a real phone never). Layout, the chart, the sheet over the dimmed page, keyboard behaviour in the sheet, the photo picker, the share sheet.

## Operate / roll back
Revert the PR. No backend or migration change. The three native modules need a new dev build (`pnpm --filter patient ios:debug` or an EAS build) before the photo picker, the report share and the sheet's keyboard can be tried.

## Follow-ups / decisions for the owner
- **Visual pass on the simulator** (pending), then Android.
- **Clinician sign-off:** vitals Normal / Critical thresholds (pack section 3), FallGuard bands and the reassessment interval (section 4). Showing the scores makes the three questions that look reversed (21, 23, 24: drowsy medicines "Daily" = 0, balanced meals "Yes" = 1, alcohol "Never" = 1) visible to patients: confirm them before release.
- Confirm the age-as-birth-date approach, or ask for a date of birth instead.
- FAQ answers (native accordion), a real support number for WhatsApp, the support chat.
- The AI insight and FallGuard summary words are unreviewed clinical text; decide whether a "not a diagnosis" line goes under them.
- Last-question tap sends the assessment at once, as drawn: say if you want a confirm.
- Track pages (B rows 40, 41) with slice 3.
