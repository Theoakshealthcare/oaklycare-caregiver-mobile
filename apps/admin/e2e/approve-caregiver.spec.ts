import { expect, test, type Page } from "@playwright/test";

import { totp } from "./totp";

/**
 * Real-backend e2e: sign in, enrol MFA, review two seeded caregivers.
 *
 * Skipped unless OAKLY_E2E=1. Needs the backend stack, a Super Admin and two seeded caregivers
 * (see e2e/README.md). One serial run shares a browser page, because an authenticator code works
 * once and a fresh sign-in would otherwise have to wait for the next 30-second step.
 */
const enabled = process.env.OAKLY_E2E === "1";
const email = process.env.OAKLY_E2E_ADMIN_EMAIL ?? "";
const password = process.env.OAKLY_E2E_ADMIN_PASSWORD ?? "";
const approvable = process.env.OAKLY_E2E_CAREGIVER_NAME ?? "";
const unmet = process.env.OAKLY_E2E_UNMET_CAREGIVER_NAME ?? "";

/** Alerts rendered by the app (Next also injects an empty route announcer with role=alert). */
const alerts = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

const nav = (page: Page, name: string) => page.getByRole("navigation", { name: "Main" }).getByRole("link", { name });

let secret = process.env.OAKLY_E2E_ADMIN_TOTP_SECRET ?? "";
let lastCode = "";

/** A code that the server has not seen yet: wait for the next 30-second step if this one was used. */
async function freshCode(): Promise<string> {
  for (let i = 0; i < 70; i++) {
    const code = totp(secret);
    if (code !== lastCode) {
      lastCode = code;
      return code;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("no fresh TOTP code");
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();

  const codeBox = page.getByLabel(/Authentication code|Code from the app/);
  await expect(codeBox).toBeVisible();
  if (await page.getByTestId("mfa-secret").isVisible()) {
    secret = ((await page.getByTestId("mfa-secret").textContent()) ?? "").trim();
  }
  expect(secret, "TOTP secret (enrolment screen or OAKLY_E2E_ADMIN_TOTP_SECRET)").toBeTruthy();
  await codeBox.fill(await freshCode());
  await page.getByRole("button", { name: /^Verify/ }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

async function openCaregiver(page: Page, name: string) {
  await nav(page, "Applications").click();
  await page.getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

test.describe.serial("admin console against the real backend", () => {
  test.skip(!enabled, "set OAKLY_E2E=1 with a running backend to run");
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    test.skip(!email || !password || !approvable || !unmet, "OAKLY_E2E_ADMIN_EMAIL, OAKLY_E2E_ADMIN_PASSWORD, OAKLY_E2E_CAREGIVER_NAME and OAKLY_E2E_UNMET_CAREGIVER_NAME are required");
    page = await (await browser.newContext()).newPage();
  });
  test.afterAll(async () => {
    await page?.context().close();
  });

  test("a wrong password gets the generic message", async () => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("not-the-password-123");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(alerts(page)).toContainText("don't match");
  });

  test("sign in enrols MFA with a generated code and lands on the overview", async () => {
    await signIn(page);
    await expect(page).toHaveURL(/\/$/);
  });

  test("the queue lists both seeded caregivers", async () => {
    await nav(page, "Applications").click();
    await expect(page.getByRole("link", { name: approvable })).toBeVisible();
    await expect(page.getByRole("link", { name: unmet })).toBeVisible();
  });

  test("approving without the requirements shows the unmet list (409)", async () => {
    await openCaregiver(page, unmet);
    await page.getByRole("button", { name: "Approve" }).click();
    const alert = alerts(page).filter({ hasText: "Fix these first" });
    await expect(alert).toBeVisible();
    await expect(alert.getByRole("listitem").first()).toBeVisible();
    await expect(page.getByText("Approved", { exact: true })).toHaveCount(0);
  });

  test("document, identity, background check, skills, then approve", async () => {
    await openCaregiver(page, approvable);

    await page.getByRole("button", { name: /^Verify / }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Verify document" }).click();
    await expect(page.getByRole("status").filter({ hasText: /verified/i })).toBeVisible();

    await page.getByRole("button", { name: "Mark verified" }).first().click();
    await page.getByRole("dialog").getByLabel(/Notes/).fill("E2E: identity checked");
    await page.getByRole("dialog").getByRole("button", { name: "Mark verified" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Identity marked verified" })).toBeVisible();

    await page.getByRole("button", { name: "Mark cleared" }).click();
    await page.getByRole("dialog").getByLabel(/Notes/).fill("E2E: background check cleared");
    await page.getByRole("dialog").getByRole("button", { name: "Mark cleared" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Background check marked cleared" })).toBeVisible();

    await page.getByRole("button", { name: "Add skill" }).click();
    await page.getByRole("button", { name: "Save skills" }).click();
    await expect(page.getByRole("button", { name: "Save skills" })).toBeDisabled();

    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByRole("status").filter({ hasText: "is approved" })).toBeVisible();
    await expect(page.getByText("Approved").first()).toBeVisible();
  });

  test("the session survives a hard reload (refresh cookie, BFF, new access token)", async () => {
    await page.reload();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    const cookies = await page.context().cookies();
    const rt = cookies.find((c) => c.name === "oakly_admin_rt");
    expect(rt?.httpOnly).toBe(true);
    expect(rt?.sameSite).toBe("Strict");
  });

  test("several tabs refreshing at once do not sign the admin out", async () => {
    // A second page shares the cookie. Both reload at the same moment, so both call the BFF refresh with the same cookie.
    const other = await page.context().newPage();
    await Promise.all([page.reload(), other.goto("/")]);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(other.getByRole("button", { name: "Sign out" })).toBeVisible();
    await other.close();
    await page.reload();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  test("sign out, then sign in again with the enrolled authenticator", async () => {
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await signIn(page);
  });
});
