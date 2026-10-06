import { expect, test } from "@playwright/test";

import { totp } from "./totp";

/**
 * Login -> MFA (TOTP generated here) -> approve a seeded caregiver.
 *
 * Skipped unless OAKLY_E2E=1. It needs the backend at OAKLY_API_ORIGIN (default http://127.0.0.1:8000)
 * with admin auth (A0) merged, plus this seed (see e2e/README.md):
 *   - a Super Admin: OAKLY_E2E_ADMIN_EMAIL / OAKLY_E2E_ADMIN_PASSWORD
 *       (created with `python -m scripts.create_super_admin`). If MFA is not enrolled yet, the test
 *       enrolls it using the secret shown on the enrollment screen.
 *       If it is already enrolled, set OAKLY_E2E_ADMIN_TOTP_SECRET to the base32 secret.
 *   - a caregiver named OAKLY_E2E_CAREGIVER_NAME in `under_review` with a verified licence, a
 *       verified identity, a cleared background check, at least one skill and all consents.
 *
 * TODO(A0): this file has never run; confirm selectors and seed once A0 merges.
 */
const enabled = process.env.OAKLY_E2E === "1";
const email = process.env.OAKLY_E2E_ADMIN_EMAIL ?? "";
const password = process.env.OAKLY_E2E_ADMIN_PASSWORD ?? "";
const knownSecret = process.env.OAKLY_E2E_ADMIN_TOTP_SECRET;
const caregiver = process.env.OAKLY_E2E_CAREGIVER_NAME ?? "";

test.describe("caregiver approval", () => {
  test.skip(!enabled, "set OAKLY_E2E=1 with a running backend to run");

  test("login, MFA, then approve a seeded caregiver", async ({ page }) => {
    test.skip(!email || !password || !caregiver, "OAKLY_E2E_ADMIN_EMAIL, OAKLY_E2E_ADMIN_PASSWORD and OAKLY_E2E_CAREGIVER_NAME are required");

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Continue" }).click();

    const codeBox = page.getByLabel(/Authentication code|Code from the app/);
    await expect(codeBox).toBeVisible();
    const enrolling = await page.getByTestId("mfa-secret").isVisible().catch(() => false);
    const secret = enrolling ? ((await page.getByTestId("mfa-secret").textContent()) ?? "").trim() : knownSecret;
    expect(secret, "TOTP secret (enrollment screen or OAKLY_E2E_ADMIN_TOTP_SECRET)").toBeTruthy();
    await codeBox.fill(totp(secret as string));
    await page.getByRole("button", { name: /Verify/ }).click();

    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("link", { name: "Applications" }).click();
    await page.getByRole("link", { name: caregiver }).click();

    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByRole("status").filter({ hasText: "is approved" })).toBeVisible();
    await expect(page.getByText("Approved").first()).toBeVisible();

    // The session survives a hard reload (refresh cookie -> BFF -> new access token).
    await page.reload();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  });
});
