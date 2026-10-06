# Admin console e2e

Skipped unless `OAKLY_E2E=1`. Needs the backend running at `OAKLY_API_ORIGIN` (default
`http://127.0.0.1:8000`) with the admin auth routes (backend A0) merged.

```bash
OAKLY_E2E=1 \
OAKLY_E2E_ADMIN_EMAIL=... OAKLY_E2E_ADMIN_PASSWORD=... \
OAKLY_E2E_CAREGIVER_NAME="..." \
pnpm --filter admin e2e
```

`OAKLY_E2E_ADMIN_TOTP_SECRET` is only needed when the admin already enrolled MFA; on a fresh
account the test reads the secret from the enrollment screen. Install the browser once with
`pnpm --filter admin exec playwright install chromium`.
