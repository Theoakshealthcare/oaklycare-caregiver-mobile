# SOP: Admin console scaffold and caregiver verification (A1)

| | |
|---|---|
| **Date** | 2026-10-06 |
| **Branch** | `feat/admin-console` (base `main` at `af96091`) |
| **Plan** | Backend repo `docs/plans/2026-10-06-admin-console.md`, A0 (auth contract) and A1; PRD `PRD-admin-console.md` 6, 7.2, 7.17, 8.2, 9 |
| **Builds on** | [Monorepo scaffold SOP](2026-10-05-monorepo-scaffold.md) and the caregiver approval API (backend `docs/sop/2026-10-05-caregiver-approval.md`) |
| **Status** | Reconciled with the merged A0 backend (`feat/admin-auth`, backend PR #21). Playwright e2e passes against the real docker stack. |
| **Contract source** | Backend `docs/fe-integration-guide-admin.md` (live captures in `docs/fe-captures/admin/`) |

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
| Refresh failure | 401/403 from the backend clears the cookie and signs the admin out with a notice. 502 or a network error keeps the cookie and shows a retry screen. A refresh is **never retried** after a network error. | A network blip must not sign people out. A reused or revoked token must. A retry after a lost answer would look like theft to the backend (guide 4.2). |
| Single-flight refresh | Two layers. **Browser:** one in-flight call to the BFF is shared by every caller in the tab (`session.ts: refreshSession`). **BFF:** `app/api/auth/refresh/route.ts` serialises per refresh token with `lib/server/single-flight.ts`: concurrent requests carrying the same cookie share one upstream call and each gets the same new access token and the same rotated `Set-Cookie`. The settled result is kept for 10 s for a caller that still carries the old cookie (a second tab, or a request sent before the browser applied the new cookie). The map key is a SHA-256 of the token. | Refresh tokens rotate and a second use of one revokes **every** session of the admin. The browser layer cannot protect two tabs; only the server can, because they share the cookie. Rejected: a lock in the cookie or a client-side `BroadcastChannel` (does not cover requests already in flight). **Limit:** the map is in process memory, so it protects one Next.js instance; with several instances the proxy must pin an admin session to one, or the lock must move to Redis. |
| Idle limit | Activity (pointer, key, wheel, touch) is tracked in the tab. A proactive refresh at 80% of `expires_in` runs only if the admin was active since the last one. An idle admin lets the token lapse, which matches the backend's idle-through-refresh rule. Warning dialog at 25 minutes (only its buttons keep the session); sign-out at 30. | Mirrors the backend rule without a ping loop. |
| Permissions | `lib/nav.ts` holds the full PRD section 9 tree; only `available` modules render, and only with a matching permission. Pages also guard themselves (`RequirePermission`). Approve, reject, request changes, decisions and skills need `caregivers.approve`; suspend and reinstate need `caregivers.suspend`; viewing documents needs `documents.read`. | The PRD catalogue gives Operations "suspend" only. The backend stays the authority; the UI only avoids showing dead buttons. |
| Confirm pattern | One `ConfirmActionDialog`: states the side effects, requires a non-blank reason when asked (saved in the audit log), stays open with the error on failure. | PRD section 9: destructive actions show side effects and need a reason. |
| Documents | Fetched through `GET /api/v1/caregiver/documents/{id}/file` with the bearer token as a blob, shown in an `iframe` (PDF) or `next/image` (images), URL revoked on unmount. Loaded only when "View" is pressed. | The route needs `Authorization`, so a plain `src` can't work. |
| Approve 409 | `unmetFromError` reads `{"detail": {"message", "unmet": [{code, message}]}}` and the list renders inline under the Decision heading. Reinstate does the same. | Matches the backend SOP. All missing items show at once. |
| Auto-suspend | Failed identity, failed background check, or rejecting the last verified licence on an approved caregiver returns `auto_suspended` and `affected_bookings`; the page says so. | The backend suspends in the same transaction; staff must not be surprised. |
| Admin auth types | `src/lib/admin-auth-contract.ts` re-exports the generated schema types (`AdminOut`, `MfaVerifyOut`, `TokenPairOut`, `AdminListItem`, `AdminInviteOut`, ...). Admin routes are called through the typed client; `adminRequest` is gone. | One source of truth: a backend change that renames a field breaks the build. |
| Login errors | `429` (wrong passwords, or the per-IP limit) and `423` (locked after wrong codes, only visible after a correct password) both carry `Retry-After`; the form shows a live countdown and disables itself. Same text for every email. A `401 Invalid or expired MFA token` on the code step sends the admin back to the password step. A refused code says to wait for the next code (a used code is dead, guide 3.3). | Guide 3.2.1, 3.3, 3.4. The BFF `mfa/verify` route forwards `Retry-After`; without it the countdown would be blind. |
| Times and money | `formatWat` (Africa/Lagos, naive backend timestamps read as UTC), `formatNaira` (kobo to ₦). | PRD section 9. |

## What's involved
- `apps/admin/` (new): `src/app/` (routes: `login`, `accept-invite`, `(console)/` overview, `caregivers/applications`, `caregivers/applications/[id]`, `admin/users`; `api/auth/*`, `api/v1/[...path]`, `api/health`), `src/components/` (auth provider, login flow, shell, side nav, confirm dialog, document viewer and card, decision control, skills editor, application actions, `ui/`), `src/lib/` (`session.ts`, `api.ts`, `caregivers.ts`, `admin-auth-contract.ts`, `nav.ts`, `format.ts`, `redirect.ts`, `server/backend.ts`), `e2e/`, `.env.example`.
- `next.config.ts`: `transpilePackages` for `@oakly/api-client` (ships TypeScript), security headers (`X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`), `allowedDevOrigins: ["127.0.0.1"]` (dev only; without it Next blocks hydration for 127.0.0.1), `agentRules: false` (stops `next dev` writing `AGENTS.md`/`CLAUDE.md` into the repo).
- `.github/workflows/ci.yml`: new step `pnpm --filter admin build`.
- `README.md`: apps table (admin: Active), setup and checks.
- `pnpm-lock.yaml`.
- Config: `OAKLY_API_ORIGIN` (server only; default in `.env.example` is `http://127.0.0.1:8000`). No `NEXT_PUBLIC_*` variables. Set it for `next build` too: it is only read at request time, but the build in CI sets it for parity.

### What is still hand-written, and why
Every `GUESS` is gone: each was either replaced by a generated type or confirmed against the guide.

| Item | Where | Why it is not generated |
|---|---|---|
| Login result narrowing (`classifyLogin`) | `admin-auth-contract.ts` | The schema types `LoginOut` as one object with every field optional; the backend omits the keys of the other shape. We branch on which key is present, as the guide says. |
| Role keys and names (7) | `ADMIN_ROLES` | The schema types roles as `string[]` and there is no roles endpoint. Copied from guide section 10. |
| Permission names (33) | `KNOWN_PERMISSIONS` | The schema types permissions as `string[]`. Copied from the backend's `app/core/admin_permissions.py`; a test checks that every nav permission is in the set. |
| The exact `detail` of a spent MFA token | `AUTH_DETAIL.mfaTokenInvalid` | It is the only way to tell it from a wrong code (same `401`). Guide 3.2. |
| BFF responses (`RefreshedSession`, `SignInSession`) | `admin-auth-contract.ts` | The BFF is this app, not the backend. The refresh response has no `admin`; the console reads `GET /admin/me`. |
| Caregiver route responses (`ApplicationRow`, `ApplicationDetail`, ...) | `lib/caregivers.ts` | The caregiver routes still return plain dicts, so the schema types them `unknown`. Written from the backend service code, not live captures. Unchanged by A0. |
| Refresh cookie lifetime | `lib/server/backend.ts` | 12 hours: the backend's absolute session cap (guide 4.3). It only has to outlive the backend's own limits. |

Corrections found while reconciling: the invite token comes back as `invite_token` in the `201` of `POST /admin/admins` (the console builds `/accept-invite?token=...`); the admin list is a bare array; `POST /admin/auth/refresh` returns no `admin`; invite accept answers `400` (not 404/410) for a bad link, and the accept body field is `invite_token`.

## Verification
- **Unit and component tests (Vitest + Testing Library), 95 passing in `apps/admin`:**
  - auth flow: login then MFA, first-time enrolment (QR and secret), wrong code (with the "wait for the next code" text), spent or expired MFA token back to the password step, `429` countdown that disables the form and re-enables at zero (no hint about the email), `423` with `Retry-After` in minutes and hours (86400 shows "24 hours"), `429` and `423` on the code step, session restore through refresh then `/admin/me`, refresh rejected on load, BFF unreachable on load, a 401 that can't be refreshed signs out with a notice, a 401 retried once, idle warning then sign-out;
  - **refresh single-flight (client):** five simultaneous callers (proactive refresh and 401 recoveries) make exactly one BFF call; a failed refresh is not retried;
  - **refresh single-flight (BFF):** six concurrent requests with one cookie make exactly one upstream refresh and all get the same access token and rotated cookie; a late caller with the old cookie is served from the same result; different sessions don't block each other; a rejection is shared and clears the cookie for every waiter; a network error is not retried and not remembered (`single-flight.test.ts` covers the primitive);
  - BFF handlers: cookie is httpOnly, `SameSite=Strict`, path `/api/auth`; refresh token never in the body; `Retry-After` forwarded on `423`/`429`; cross-origin POST refused; the proxy forwards the bearer token, drops cookies and refuses the three BFF-owned routes;
  - admin users: bare-array list, the invite link built from `invite_token`, the server's `409` message shown, "Disable" off for the last active Super Admin;
  - permission-gated nav, approve with the 409 `unmet` list, reject/suspend/request-changes reasons, formatters, `safeNext`, contract helpers (`classifyLogin`, permission and role sets).
- **Root CI checks:** `pnpm install --frozen-lockfile`; `pnpm api:generate` with no diff in `schema.d.ts`; `pnpm typecheck`; `pnpm lint` (no warnings); `pnpm test` (api-client 6, admin 95, caregiver 168); `pnpm --filter admin build`. `npx expo-doctor` reports 20 of 21 checks: the failing one is a patch-version advisory for `expo`, `expo-asset`, `expo-constants` and `expo-notifications` (newer SDK 57 patches published), in `apps/caregiver`, which this branch does not touch.
- **Playwright e2e, real backend, headless Chromium, 8 of 8 passing (about 30 s):** backend `feat/admin-auth` merged `main` in docker (`db`, `redis`, `api`), Super Admin from `scripts.create_super_admin`, two caregivers seeded through the API by `e2e/seed_caregivers.py`. Covered: wrong password (generic message); sign-in with MFA enrolment (secret read from the screen, codes generated by `e2e/totp.ts`); the queue; approve with nothing verified, which shows the `409` unmet list; document, identity and background-check decisions, skills, approve; a hard reload keeping the session (httpOnly, `SameSite=Strict` cookie); two tabs reloading at the same moment (both signed in; the backend audit log has no `admin.refresh_token_reuse` and the API log shows only successful refreshes); sign-out and a second sign-in through the already-enrolled code step. The stack was shut down with `down -v` afterwards. The run needed a second admin enrolment after a selector fix, so the Super Admin's MFA was reset in the throwaway DB between runs.
- **Not verified live:** `429`/`423` countdowns against the real throttle (covered by component tests with the guide's captured shapes; the backend's own captures cover the server side); the 30-minute idle and 12-hour cap (backend-simulated only); invite creation and accept through the browser (component tests only, shapes from guide captures 025 and 032); `Retry-After` readable by browser JavaScript is moot because the console is same-origin (the BFF forwards it).

## Operate / roll back
- Run: `cp apps/admin/.env.example apps/admin/.env.local`, start the backend, `pnpm --filter admin dev`. Production: `pnpm --filter admin build && pnpm --filter admin start` with `OAKLY_API_ORIGIN` set; serve over HTTPS (the cookie is `Secure` when `NODE_ENV=production`).
- e2e: see `apps/admin/e2e/README.md` (stack, Super Admin, `seed_caregivers.py`, env vars). Without `OAKLY_E2E=1` it skips.
- Deploying more than one Next.js instance: pin each admin session to one instance (sticky cookie) or move the refresh lock to Redis, otherwise the BFF serialisation only holds per instance.
- Roll back: revert the branch. `apps/admin` is self-contained; the only shared edits are the CI step, README rows and the lockfile.

## Follow-ups
- The caregiver routes need declared response models so `ApplicationDetail` can come from the schema.
- Backend: `.env.example` ships `TRUSTED_PROXIES=` empty, which the settings parser rejects when the file is used as the compose env file (set `TRUSTED_PROXIES=[]`). Worth fixing there.
- Move the refresh lock to Redis if the console is ever run on several instances.
- The console doesn't refetch `/admin/me` on a `403` yet (only after the admin edits their own roles); guide section 5 recommends both.
- No resend or re-issue for invites on the backend yet, so an expired invite needs a developer; the accept screen says so.
- Profile fields (phone, address, date of birth) are shown unmasked; masking with a reveal reason is A5.
- Queue filters are limited to status and a client-side name/state search; the API has no city or specialization filter yet.
- Audit viewer page: `GET /admin/audit` now exists (`audit.read`); the page is not built. The caregiver history on the detail page shows admin IDs, not names.
- Reinstate and admin disable can't collect a reason because the routes take none.
- Overview is a placeholder until A2/A3.
