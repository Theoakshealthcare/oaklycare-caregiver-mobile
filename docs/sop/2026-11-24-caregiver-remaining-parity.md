# SOP: Caregiver care plans, chat, vitals, bookings and account screens match the Figma exports (remaining rows)

| | |
|---|---|
| **What shipped** | The built features that were still untouched in `ledgers/PARITY-caregiver.md`: the care plan system (hub, details, goals, medications, tasks, notes, create form, success pages), chat and the AI Notetaker, vitals (tab, detail charts, entry modals, report-downloaded page, a status badge that stays off), Bookings and Job Details, Notifications, Payment & Earning, Earning Payment, payslip success, Update Payment Details, Edit Profile, Contact Us, and the Client Profile headings. |
| **Branch / PR** | `feat/caregiver-remaining-parity` (see the PR for the number). Follows PRs #50, #51, #52. |
| **Why** | The owner wants exact Figma parity for everything that is built, so they can test once. Rows for features that are not built stay off. |
| **Not verified** | **On a device.** Jest on the touched suites, `tsc --noEmit` and ESLint only. The simulator was in use by another session, so no visual pass was made: layout, colours (Display P3 exports), the chart and orb drawn from views, pinned buttons and every modal need an owner look. |

## How (and what was decided)
| Area | What changed | Decision / reason |
|---|---|---|
| Care plan hub | Teal header with round back, "Careplan System", "+ Create New Care Plan" (only when the server's `can_author_care_plans` is true), pill tabs, search plus a filter button that opens the Active / Completed choice, template cards with Preview / Use buttons, assigned cards with coloured Risk / Status and a percent bar. | The templates tab has no search (Figma draws none). Button labels are singular ("Preview Template"): the plural is a Figma slip. |
| Care Plan Details | Header card (initial, "Female · 71", "Active Care Plan" chip, Edit Plan), six white accordions, all closed, in Figma order and with "&". Client Profile holds diagnosis, risk, primary contact, plan duration, review, creator and View Progress. | No address or "Assigned Caregiver" line: neither exists in the plan or client data. The sections open by default only when the caregiver comes from the clock-out prompt (tasks, notes). |
| Medication Schedules | Now a section like the rest. The "not clinical advice" notice (`MEDICATION_NOTICE`, unchanged words) is the first thing inside it. | **Owner to confirm:** the earlier design (D4) kept this section never collapsed. The notice still always sits with the list. |
| Add Medication | Full-page modal: Figma labels, usage-time dropdown, date pickers, pinned "Save Medication". | Medication Goal / Outcome / Duration have no backend field: not drawn. Strength, unit, route, prescribed by and clock times stay (the list shows them). "Reminder Notes" is "Medication Notes": Oakly sends no reminders. |
| Add Task, Create form | Task Routine and Frequency dropdowns ("Choose days" shows day buttons); Create New Care Plan with Risk dropdown, "Activities" rows with bin icons, pinned Create button. | Age, Gender, Patient Tag, Address, Emergency Contact are not in the create call (the client comes from the visit): not drawn. |
| Success pages | One page for plan / goal / task / medication: Close, check picture, green title, "for <client>" line, button. A new plan has a title only and Close opens it. | The task success is a page, not a dialog. The client name comes from the cached plan; without it the line is left out. |
| Chat, AI Notetaker | Teal header, booking card, day stamps, quick replies (plain text), mic and teal send; Notetaker with "I'm Listening", an orb and the "Voice to text" pill when voice notes are on. | No "Active" dot (no presence signal), no AI-orb header icon (duplicate of the mic), phone hidden (calling off), no "Wound Dressing" chip. 24-hour times (DP1-28). |
| Vitals | "Clients Vitals", client row, "<Vital> Monitoring" with "Last synced" and an area chart, Figma-labelled entry modals, "Vital Report Downloaded" page with Share Report. `VitalStatusBadge` is built behind `VITAL_STATUS_BADGES = false`. | No search or "Stable" chip. Insights not wired (untyped endpoint, no live capture). Glucose keeps one value plus context chips. |
| Bookings, Job Details, Notifications | Bell, "New Request", Figma cards with icons and pills, Start Service and Get Direction on Upcoming, Job Details cards, "Notification" with Today / Yesterday groups. | An offer has no patient name or caregiver earning before acceptance: titled by service, no price line (the family's total is never shown). |
| Wallet and account | "Payment & Earning" with eye toggle, new "Earning Payment" screen, payslip success page, Update Payment Details labels, Edit Profile and Contact Us labels. | The bank-name confirm step and the 24-hour payout pause banner stay. Age, emergency contact name / address: not drawn. |
| Client Profile | Title and section headings in Figma case, "Add Notes" pill. | No FallGuards button (no data). |

## What's involved
- New: `components/careplan/PlanScreen.tsx`, `components/booking/{BookingBlocks,AssignedCard}.tsx`, `components/chat/*`, `components/vitals/VitalStatusBadge.tsx`, `components/account/MonthChip.tsx`, `config/vitals.ts`, `booking/bookingCardModel.ts`, `vitals/{chartMath,reportStore}.ts`, screens `account/{EarningPayment,PayslipDownloaded}`, `vitals/VitalReportDownloaded`.
- Changed: the care plan screens and components, chat, vitals, booking and account screens listed above; `components/careplan/parts.tsx` (Accordion, AddLink, ModalFrame, FullPageFrame, RoundBack); shared and additive: `constants/theme.ts` (`careBackground`), `components/ui/select.tsx` (`testID`), `utils/dates.ts`, `hooks/queries.ts` (`useClientProfile` optional argument), `navigation/{Navigations,StackNavigator}.tsx` (routes `EarningPayment`, `PayslipDownloaded`, `VitalReportDownloaded`).
- No backend, api-client or migration change; no new dependency (the chart and orb are drawn with views).

## Verification
- Jest, single worker, on every suite that pins the changed code: the `carePlan*` suites, `clientProfile`, `visit`, `shortVisit`, `navigationFixes`, `chatParity`, `chatCalling`, `aiNoteTaker`, `voiceNoteFlow`, `vitals*`, `chartMath`, `bottomNavigation`, `bookingsParity`, `offers`, `offerUnavailable`, `directions`, `arrivedEarning`, `notifications`, `wallet`, `earningPayment`, `bankDetails`, `account`, `staticScreens`, `home`, `homeParity`. `tsc --noEmit` clean; ESLint: 0 errors. CI runs the rest.
- Care plan tests open the (now closed) sections with `openAllSections()` in `test-utils/carePlanHarness.tsx`.

## Operate / roll back
Revert the PR. `VITAL_STATUS_BADGES` and `CALLING_ENABLED` stay false; nothing here switches a flag on.

## Follow-ups
- **Owner decisions:** medication section collapsed (D4); "Total Amount Paid in / Withdrawn" labels; "Continue Service" on an in-progress card; Close opening the new plan; the plural "Templates" buttons; the app's lock-screen name.
- **Needs backend or content:** a Chats list; FallGuard reads for caregivers (the FallGuard tab, button and report); a patient first name and last initial on offers; caregiver earning before acceptance; FAQ and About copy for in-app pages; emergency contact name / address on the caregiver profile; typed insights for vitals.
- Not built, stays off: Learn, Refer and Earn, Support chat, Complaints, calling, wallet refunds.
- A device pass for all of the above (the simulator was busy).
