# SOP: Admin console scaffold and caregiver verification (A1)

| | |
|---|---|
| **Date** | 2026-10-06 |
| **Branch** | `feat/admin-console` (base `main` at `af96091`) |
| **Plan** | Backend repo `docs/plans/2026-10-06-admin-console.md`, A0 (auth contract) and A1; PRD `PRD-admin-console.md` 6, 7.2, 7.17, 8.2, 9 |
| **Builds on** | [Monorepo scaffold SOP](2026-10-05-monorepo-scaffold.md) and the caregiver approval API (backend `docs/sop/2026-10-05-caregiver-approval.md`) |
| **Status** | Verified locally against a stand-in for the A0 auth routes. **Not run against the real A0 backend** (not merged). |

## What shipped
A new Next.js 16 app, `apps/admin`, where Oakly staff sign in with a password and an authenticator code and review caregiver applications end to end.

| Area | Result |
|---|---|
| Sign-in | Email and password, then a 6-digit code. First login enrolls MFA: QR code from `otpauth_uri` plus the manual secret. |
| Session | Access token in memory only. Refresh token in an httpOnly cookie held by Next route handlers (BFF). Silent refresh on load and on a 401. Idle warning at 25 minutes, sign-out at 30. |
| Shell | Left nav grouped as in PRD section 9. Items are hidden when `permissions[]` lacks them. Admin menu with sign out. |
| Pages | Overview (placeholder), Caregiver applications queue, Application detail, Admin users, Accept invite. |
| Application detail | Profile, consents, inline PDF/image documents, document / identity / background-check decisions, skills editor, approve (409 `unmet` list inline), reject, request changes, suspend, reinstate, caregiver audit history. |
| Admin users | Invite (link shown once), edit roles, disable and enable, reset MFA. |

## Why
Approval needs a human surface. The backend approval API (E5) and admin identity (A0) exist only as routes; staff need a console that makes the mandatory background check and the "what's still missing" list impossible to miss.

## How
| Decision | Choice | Why |
|---|---|---|
| Stack | Next.js 16 App Router, TypeScript strict, Tailwind 4, hand-written shadcn-style components on Radix (dialog, label, slot), TanStack Query 5.104.1 (same pin as the caregiver app) | Radix gives the focus trap and Escape handling for the confirm dialogs. Only the components used were added. |
| React | Exactly `19.2.3`, same as the caregiver app. `pnpm -r why react` shows one `react` and one `react-dom`. | One React across the repo (README rule). |
| Backend access | The browser calls this app's own `/api/v1/*`; `app/api/v1/[...path]/route.ts` proxies to `OAKLY_API_ORIGIN` (server env, read at runtime). `@oakly/api-client` is created with the app's origin as `baseUrl`. | No CORS, no backend origin in the bundle. Rejected: `next.config` rewrites (origin baked in at build time) and calling the backend cross-origin (needs CORS at the edge). |
| Refresh token | Only the BFF routes `/api/auth/mfa/verify`, `/refresh`, `/logout` see it. Cookie `oakly_admin_rt`: httpOnly, `Secure` in production, `SameSite=Strict`, path `/api/auth`. The proxy returns 404 for the three backend auth routes the BFF owns, so the token can't leak through it. | JavaScript never holds the refresh token. The narrow cookie path means it isn't even sent with page or API requests. |
| Refresh failure | 401/403 from the backend clears the cookie and signs the admin out with a notice. 502 or a network error keeps the cookie and shows a retry screen. | A network blip must not sign people out. A reused or revoked token must. |
| Single-flight refresh | One in-flight refresh is shared by all callers. | Refresh tokens rotate and reuse revokes every session, so two parallel refreshes would sign the admin out. |
| Idle limit | Activity (pointer, key, wheel, touch) is tracked in the tab. A proactive refresh at 80% of `expires_in` runs only if the admin was active since the last one. An idle admin lets the token lapse, which matches the backend's idle-through-refresh rule. Warning dialog at 25 minutes (only its buttons keep the session); sign-out at 30. | Mirrors the backend rule without a ping loop. |
| Permissions | `lib/nav.ts` holds the full PRD section 9 tree; only `available` modules render, and only with a matching permission. Pages also guard themselves (`RequirePermission`). Approve, reject, request changes, decisions and skills need `caregivers.approve`; suspend and reinstate need `caregivers.suspend`; viewing documents needs `documents.read`. | The PRD catalogue gives Operations "suspend" only. The backend stays the authority; the UI only avoids showing dead buttons. |
| Confirm pattern | One `ConfirmActionDialog`: states the side effects, requires a non-blank reason when asked (saved in the audit log), stays open with the error on failure. | PRD section 9: destructive actions show side effects and need a reason. |
| Documents | Fetched through `GET /api/v1/caregiver/documents/{id}/file` with the bearer token as a blob, shown in an `iframe` (PDF) or `next/image` (images), URL revoked on unmount. Loaded only when "View" is pressed. | The route needs `Authorization`, so a plain `src` can't work. |
| Approve 409 | `unmetFromError` reads `{"detail": {"message", "unmet": [{code, message}]}}` and the list renders inline under the Decision heading. Reinstate does the same. | Matches the backend SOP. All missing items show at once. |
| Auto-suspend | Failed identity, failed background check, or rejecting the last verified licence on an approved caregiver returns `auto_suspended` and `affected_bookings`; the page says so. | The backend suspends in the same transaction; staff must not be surprised. |
| Admin auth types | Hand-written `src/lib/admin-auth-contract.ts` mirroring the plan's A0 table. Guesses are marked `GUESS` in the file. | A0 isn't merged, so the routes aren't in the generated schema. |
| Times and money | `formatWat` (Africa/Lagos, naive backend timestamps read as UTC), `formatNaira` (kobo to ₦). | PRD section 9. |

## What's involved
- `apps/admin/` (new): `src/app/` (routes: `login`, `accept-invite`, `(console)/` overview, `caregivers/applications`, `caregivers/applications/[id]`, `admin/users`; `api/auth/*`, `api/v1/[...path]`, `api/health`), `src/components/` (auth provider, login flow, shell, side nav, confirm dialog, document viewer and card, decision control, skills editor, application actions, `ui/`), `src/lib/` (`session.ts`, `api.ts`, `caregivers.ts`, `admin-auth-contract.ts`, `nav.ts`, `format.ts`, `redirect.ts`, `server/backend.ts`), `e2e/`, `.env.example`.
- `next.config.ts`: `transpilePackages` for `@oakly/api-client` (ships TypeScript), security headers (`X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`), `allowedDevOrigins: ["127.0.0.1"]` (dev only; without it Next blocks hydration for 127.0.0.1), `agentRules: false` (stops `next dev` writing `AGENTS.md`/`CLAUDE.md` into the repo).
- `.github/workflows/ci.yml`: new step `pnpm --filter admin build`.
- `README.md`: apps table (admin: Active), setup and checks.
- `pnpm-lock.yaml`.
- Config: `OAKLY_API_ORIGIN` (server only; default in `.env.example` is `http://127.0.0.1:8000`). No `NEXT_PUBLIC_*` variables. Set it for `next build` too: it is only read at request time, but the build in CI sets it for parity.

### Where the contract was inferred (confirm when A0 lands)
| Item | Assumed | Source of the guess |
|---|---|---|
| Refresh response | `{access_token, refresh_token, expires_in, admin?}`; if `admin` is absent the console calls `GET /admin/me` | Plan says only "a new token pair" |
| Admin list | A bare array or `{items: [...]}` with `id, email, full_name, roles[], status, mfa_enabled?, last_login_at?` | Plan says "List admins" |
| Invite response | A token in `invite_token`, `token`, or the tail of `invite_url`/`invite_link`/`link`. The console builds `/accept-invite?token=...` itself. | Plan says "returns a single-use invite link token" |
| Role slugs | `super_admin, operations, verification, finance, support, clinical_reviewer, read_only_analyst` (hardcoded; there is no roles endpoint) | Plan names the roles, not their identifiers |
| Permission strings | `caregivers.read`, `caregivers.approve`, `caregivers.suspend`, `documents.read`, `dashboard.read`, `admins.manage` | PRD 8.2 (`caregivers.approve / suspend` read as two permissions) |
| Refresh cookie lifetime | 7 days | Plan doesn't give one; the backend enforces the real TTL |
| Response shapes of the caregiver routes | From `app/services/caregiver_approval.py`; the generated schema types them `unknown` | Backend code, not a live capture |
| Reinstate | Sent with no reason | The backend route takes no body; the dialog states the side effects but can't collect a reason |

## Verification
- **Unit and component tests (Vitest + Testing Library), 46 passing:**
  - auth flow: login then MFA, first-time enrollment (QR and secret), wrong code, 423 lockout with `Retry-After`, session restore on load, refresh rejected on load, BFF unreachable on load, a 401 that can't be refreshed signs out with a notice, a 401 retried once with the new token, idle warning then sign-out;
  - permission-gated nav (Verification vs Super Admin vs no permissions, unbuilt modules hidden, PRD group order);
  - approve with the 409 `unmet` list, success clearing it, a plain error; reject, suspend and request changes need a non-blank reason; the dialog stays open on failure; actions follow the backend state machine and permissions; reinstate shows `unmet`;
  - BFF handlers: cookie is httpOnly, `SameSite=Strict`, path `/api/auth`; refresh token never in the body; rotation; cookie cleared on 401 but kept on 502; cross-origin POST refused; the proxy forwards the bearer token, drops cookies and refuses the three BFF-owned routes;
  - formatters (WAT, ₦), `safeNext` (open-redirect guard), contract helpers.
- **Root CI checks, all green:** `pnpm install --frozen-lockfile`; `pnpm api:generate` with no diff in `schema.d.ts`; `pnpm typecheck`; `pnpm lint`; `pnpm test` (api-client 6, admin 46, caregiver 168); `pnpm --filter admin build`; `npx expo-doctor` in `apps/caregiver` (21/21).
- **Manual:** `pnpm --filter admin dev`, `curl /login` returns 200 with the form. A throwaway stand-in server (not committed) implemented the A0 auth contract; with it, curl confirmed login, MFA verify (cookie set, no refresh token in the body), refresh rotation, the proxy refusing `/admin/auth/refresh`, logout clearing the cookie and the next refresh being 401. In the browser pane: login, code, land on Overview, hard reload keeps the session. The TOTP helper used by the e2e matches the RFC 6238 test vector.
- **Not verified:** anything against the real backend (A0 not merged); the queue, detail page and admin-users page against live data (only their component logic is tested); the Playwright e2e has never run.

## Operate / roll back
- Run: `cp apps/admin/.env.example apps/admin/.env.local`, start the backend, `pnpm --filter admin dev`. Production: `pnpm --filter admin build && pnpm --filter admin start` with `OAKLY_API_ORIGIN` set; serve over HTTPS (the cookie is `Secure` when `NODE_ENV=production`).
- e2e: `OAKLY_E2E=1 pnpm --filter admin e2e` after A0 merges; see `apps/admin/e2e/README.md` for the seed it needs. Without `OAKLY_E2E=1` it skips.
- Roll back: revert the branch. `apps/admin` is self-contained; the only shared edits are the CI step, README rows and the lockfile.

## Follow-ups
- When A0 merges: sync the OpenAPI snapshot, delete `admin-auth-contract.ts` and `adminRequest` in favour of generated types, confirm every `GUESS`, run the e2e, and capture the real shapes for the backend's FE integration guide.
- The caregiver routes need declared response models so `ApplicationDetail` can come from the schema.
- Profile fields (phone, address, date of birth) are shown unmasked; masking with a reveal reason is A5.
- Queue filters are limited to status and a client-side name/state search; the API has no city or specialization filter yet.
- Audit viewer page waits on `GET /admin/audit` (A5 if A0 doesn't ship it). The caregiver history on the detail page shows admin IDs, not names.
- Reinstate and admin disable can't collect a reason because the routes take none.
- Overview is a placeholder until A2/A3.
