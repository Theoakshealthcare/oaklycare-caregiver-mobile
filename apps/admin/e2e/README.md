# Admin console e2e

Skipped unless `OAKLY_E2E=1`. It drives a real browser (headless Chromium) against the running
console and the real backend. No mocks.

## Run it

1. Start the backend stack from the backend repo (temp env file, see its
   `docs/sop/2026-10-05-secrets-and-rotation.md`; note `TRUSTED_PROXIES=[]` if the env file has the
   empty `.env.example` line, which the settings parser rejects):
   ```bash
   OAKLY_ENV_FILE_PATH=/path/to/temp.env docker compose -p oakly-e2e up --build -d db redis api
   OAKLY_ENV_FILE_PATH=/path/to/temp.env docker compose -p oakly-e2e exec -T \
     -e OAKLY_BOOTSTRAP_PASSWORD='<a strong password>' api \
     python -m scripts.create_super_admin --email e2e-boss@example.com --name "E2E Boss"
   ```
2. Seed two caregivers (in `under_review`, nothing verified) through the API, with the backend's
   Python environment:
   ```bash
   cd <backend repo> && poetry run python <this repo>/apps/admin/e2e/seed_caregivers.py
   # {"approvable": "E2E Approvable ab12cd", "unmet": "E2E Unmet ab12cd"}
   ```
3. Run the tests (the Playwright config starts `next dev` on port 3100):
   ```bash
   pnpm --filter admin exec playwright install chromium     # once
   OAKLY_E2E=1 \
   OAKLY_E2E_ADMIN_EMAIL=e2e-boss@example.com OAKLY_E2E_ADMIN_PASSWORD='<the password above>' \
   OAKLY_E2E_CAREGIVER_NAME="E2E Approvable ab12cd" OAKLY_E2E_UNMET_CAREGIVER_NAME="E2E Unmet ab12cd" \
   pnpm --filter admin e2e
   ```
4. `docker compose -p oakly-e2e down -v` when you are done.

The Super Admin starts without MFA, so the first sign-in enrols it: the test reads the secret from the
enrolment screen and generates codes with `e2e/totp.ts`. Set `OAKLY_E2E_ADMIN_TOTP_SECRET` only to reuse
an admin that already enrolled. The suite is serial and needs a fresh pair of caregivers per run.

## What it covers
Wrong password (generic message), sign-in with MFA enrolment, the queue, the 409 "unmet requirements"
list, document / identity / background-check decisions, skills, approve, a hard reload keeping the
session (httpOnly `SameSite=Strict` cookie), two tabs refreshing at once (the BFF serialises refresh),
sign out, and sign in again through the already-enrolled code step.
