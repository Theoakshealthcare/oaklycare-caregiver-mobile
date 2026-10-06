# SOP: Frontend monorepo scaffold (C0)

| | |
|---|---|
| **Date** | 2026-10-05 |
| **Branch** | `chore/monorepo` |
| **Plan** | [Caregiver app plan](../plans/2026-10-05-caregiver-app.md), C0 |

## What shipped
The caregiver app repo is now a **pnpm workspace** for all Oakly frontends:
- **The app** has moved to `apps/caregiver`, with its git history kept.
- **New `packages/api-client`:** a typed backend client generated from the backend's OpenAPI spec.
- **Supporting setup:** a root tsconfig, CI, a README, and this plan.

## Why
- **Duplicated, drifting code.** The patient and caregiver apps shared about 30 copy-pasted files and had already drifted apart.
- **API mismatches.** Both apps had hand-written API layers, and most of their mismatches with the backend came from that.
- **More frontends are coming.** The admin console and the patient web companion are next.
- **One contract.** A workspace with a generated client means one contract for every frontend, and a backend rename breaks the build instead of production.

## How
| Decision | Choice | Why |
|---|---|---|
| Package manager | pnpm 10 workspaces, pinned through `packageManager` | Expo supports pnpm isolated installs from SDK 54, and Metro is configured automatically |
| Repo | The existing `oaklycare-caregiver-mobile` repo, restructured | Keeps history, and no new repo is needed. It can be renamed to `oakly-apps` later. |
| API client | `openapi-typescript` (types) + `openapi-fetch` (runtime, about 6 kB) | Types match the backend exactly, with no code generation at runtime |
| Spec source | A committed `openapi.json` snapshot, refreshed by `pnpm api:sync` (dumped from the backend's Poetry env, or fetched from a running server) | Builds are reproducible offline, and CI checks the generated types match the snapshot |
| Auth in the client | Middleware adds the bearer token. On a 401 it calls `onUnauthorized()` **once** and retries the request; it never loops. | The app supplies the token storage and refresh call |
| Patient app | Not moved in. It stays frozen in its own repo. | Patients move to WhatsApp and the web companion |

## What's involved
- **Root:** `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `.gitignore`, `README.md`, `.github/workflows/ci.yml`.
- **`packages/api-client/`:** `src/index.ts`, generated `src/schema.d.ts`, `openapi.json` (89 paths), `scripts/sync-openapi.mjs`, `test/client.test.ts`.
- **`apps/caregiver/`:** all previous app files, moved. `.env` is no longer tracked and `.env.example` is added. `package-lock.json` is removed.

## Verification
- `pnpm install --frozen-lockfile` succeeds.
- The drift check passes: regenerating gives the same `schema.d.ts`.
- `pnpm typecheck` passes for the api-client. The app gets a typecheck script in C1.
- `pnpm test` passes 5 api-client tests: the bearer token is added; on a 401 the client refreshes once and retries; a token rejected again doesn't loop; refresh returning null gives up; and `errorMessage` reads every FastAPI `detail` shape.

## Follow-ups
- C1: SDK 57, native projects generated instead of committed, app scripts added to CI.
- Optionally rename the GitHub repo to `oakly-apps`.
