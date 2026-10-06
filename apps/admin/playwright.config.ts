import { defineConfig } from "@playwright/test";

/**
 * E2E runs against a real backend at OAKLY_API_ORIGIN (default http://127.0.0.1:8000), so it is
 * opt-in: `OAKLY_E2E=1 pnpm --filter admin e2e`. See e2e/README.md for the seeded data it needs.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  webServer: process.env.OAKLY_E2E
    ? {
        command: "pnpm exec next dev -p 3100",
        url: "http://127.0.0.1:3100/api/health",
        reuseExistingServer: true,
        env: { OAKLY_API_ORIGIN: process.env.OAKLY_API_ORIGIN ?? "http://127.0.0.1:8000" },
      }
    : undefined,
});
