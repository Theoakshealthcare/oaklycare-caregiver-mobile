# Oakly apps: master checklist

Legend: `[x]` done and verified, `[ ]` not done. Updated 2026-10-06. Snapshot: 3 areas, 2 shipped, 1 on branch `feat/admin-console` (not merged).

## Monorepo and API client (shipped)
- [x] pnpm workspace, shared lockfile, CI (SOP: `docs/sop/2026-10-05-monorepo-scaffold.md`)
- [x] `@oakly/api-client`: OpenAPI snapshot + generated types, typed fetch client with 401 retry
- [x] Snapshot synced with backend A0 (admin auth routes) on 2026-10-06

## Caregiver app (`apps/caregiver`, Expo) (shipped)
- [x] Offers, visit flow, location tracking, push, session handling (168 tests)

## Admin console (`apps/admin`, Next.js) (branch `feat/admin-console`)
- [x] Sign-in with MFA enrolment and verify, BFF refresh cookie, idle timeout
- [x] Generated A0 types, no `GUESS` left (2026-10-06)
- [x] Login throttle (429) and lock (423) countdowns, spent MFA token handling
- [x] Refresh single-flight in the browser and in the BFF (per refresh token)
- [x] Caregiver applications: queue, detail, document / identity / background decisions, skills, approve (409 unmet), reject, request changes, suspend, reinstate
- [x] Admin users: invite (link built from `invite_token`), roles, disable / enable, reset MFA
- [x] Playwright e2e against the real backend, 8/8 (2026-10-06)
- [ ] Merge to `main`

## Backlog
- [ ] Admin audit viewer page (`GET /admin/audit`, `audit.read`)
- [ ] Overview dashboards (A2/A3)
- [ ] Mask caregiver PII with reveal reason (A5)

## Deferred follow-ups
- [ ] Typed caregiver route responses once the backend declares response models
- [ ] Refetch `/admin/me` on 403
- [ ] Redis-backed refresh lock if the console runs on several instances
- [ ] Backend: `.env.example` `TRUSTED_PROXIES=` empty value breaks settings parsing
