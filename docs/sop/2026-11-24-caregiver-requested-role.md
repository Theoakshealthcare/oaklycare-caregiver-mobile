# SOP: "I apply as" in caregiver setup, and the console's "Requested by the caregiver"

| | |
|---|---|
| **What shipped** | The caregiver app's setup step 2 has a multi-select **I apply as** (the five roles); the admin console's caregiver page shows **Requested by the caregiver: Nurse, Caregiver** and opens the skills editor with those roles already in the list, tagged **requested**. Shared types regenerated from the backend. Backend half: Theoakshealthcare/backend#76 (migration `0028`, [SOP](https://github.com/Theoakshealthcare/backend/blob/develop/docs/sop/2026-11-24-caregiver-requested-role.md) once merged). |
| **Why** | An admin cannot approve a caregiver without at least one skill, but the caregiver never said which role they apply as, so admins had to guess. Skills stay admin-confirmed (nobody can claim to be a doctor); this only tells the admin what to confirm. Owner decision 2026-11-24. **Not drawn in Figma: a deliberate addition.** |
| **Not changed** | Approval rules (at least one admin-confirmed skill) and the skills endpoint. The app never presents the choice as a qualification: the label is "I apply as", and nothing shows the role anywhere else. |

## How

| Area | Decision |
|---|---|
| Types | `OAKLY_BACKEND_DIR=<backend> pnpm api:sync`: the diff adds only `applying_as` (step 2 request, profile), `requested_skills` (admin detail), `roles` / `RoleOption` (form options). |
| App field | Same `Select` `multiple` as "Choose Service areas", placed right after "Select years of Experience". Label **I apply as**, placeholder **Select your role(s)**, options and labels from `GET /caregiver/form-options` `roles` (a built-in list of the same five is used only if an older backend sends none). |
| Required | Save & Continue shows "Select at least one role" and sends nothing until one is picked. Sent as `applying_as` with the other step-2 fields. |
| Resume / edit | The screen reads the caregiver profile; a saved `applying_as` shows until the caregiver changes it, and counts as chosen. (Only this field is prefilled; the other step-2 fields were never prefilled and are unchanged.) |
| Console line | Under the **Skills** heading, hidden when `requested_skills` is empty or absent. Role names are capitalised ("nurse" becomes "Nurse"). Visible to readers too. |
| Console editor | While **no skill is confirmed**, the editor opens with the requested roles as rows, each tagged "requested", Save skills enabled, and a note: "Filled in from what the caregiver asked for. Nothing is confirmed until you press Save skills." Saving is the admin's explicit click and sends exactly the rows shown (they may remove or add first). Once skills exist nothing is pre-selected. The console has an inline editor, not a dialog, so the pre-selection lives there. |

## What's involved
`packages/api-client/openapi.json`, `src/schema.d.ts`; `apps/caregiver/src/screens/setup/CaregiverSetupStep2.tsx`, `src/services/caregiver.service.ts` (`FormOptions.roles`, `RoleOption`, `FALLBACK_ROLES`); `apps/admin/src/components/skills-editor.tsx`, `src/app/(console)/caregivers/applications/[id]/detail.tsx`, `src/lib/caregivers.ts` (`requested_skills`, `roleLabel`).

## Verification
| Check | Result |
|---|---|
| `apps/caregiver/__tests__/setupStep2Roles.test.tsx` (new): label and placeholder, position after years of experience, the five labelled options, required, sent as `applying_as`, saved value shown on resume and accepted, `parseFormOptions` | pass |
| Pinning caregiver files: `account`, `onboardingGate`, `gate`, `onboardingParity` (`account.test.tsx` mock gained `roles`) | pass (Jest, `--runInBand`) |
| `apps/admin/.../[id]/requested-roles.test.tsx` (new, 9 tests): line shown / hidden / absent field / reader; pre-selected and tagged, nothing sent until Save skills, saves exactly the shown rows, a role can be removed first, no pre-selection once skills exist, no request = unchanged editor | pass |
| Pinning admin files: `detail.test.tsx`, `application-actions.test.tsx`, `identity-card.test.tsx` | pass (Vitest) |
| `tsc --noEmit` in caregiver, admin and patient; eslint on touched files | clean (one old import warning in `CaregiverSetupStep2.tsx`) |
| Not run | the admin Playwright e2e (CI; the flow without a request is unchanged), real device or simulator |

## Operate / roll back
The app change needs the backend PR (a first step-2 save without `applying_as` is `422`; an older backend ignores the field). Merge the backend first on staging, then this. Revert the PR to roll back; the admin side tolerates a backend without `requested_skills`.

## Owner notes
- **Step 2 may now scroll** (one more field on a screen that already had five).
- Display order in the field's summary follows the list order (Nurse, Doctor, ...), not the order tapped.

## Follow-ups
- A visual pass on the new field and on the console editor (no simulator or browser run was done here).
- Nothing yet compares the requested role with the uploaded licence; the admin judges that.
