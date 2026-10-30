import * as WebBrowser from "expo-web-browser";

import { createBrowserWidgetLauncher, isOpenableWidgetUrl, outcomeFromBrowserResult } from "../src/identity/browserWidgetLauncher";
import { KYC_RETURN_URL } from "../src/identity/config";
import { session, WIDGET_URL } from "../test-utils/identityFixtures";

const openAuthSession = WebBrowser.openAuthSessionAsync as jest.Mock;
const launch = (widgetUrl: string | undefined) => ({ config: session().widget, widgetUrl: widgetUrl as string });

beforeEach(() => openAuthSession.mockReset());

describe("browser launcher: what it opens", () => {
  it("opens the hosted page once, with the app's return URL (which must match the backend's KYC_RETURN_URL)", async () => {
    openAuthSession.mockResolvedValue({ type: "success", url: `${KYC_RETURN_URL}` });
    await createBrowserWidgetLauncher().open(launch(WIDGET_URL));
    expect(openAuthSession).toHaveBeenCalledTimes(1);
    expect(openAuthSession).toHaveBeenCalledWith(WIDGET_URL, KYC_RETURN_URL);
    expect(KYC_RETURN_URL).toBe("oaklycarecaregivermobile://kyc/return");
  });

  it("uses the scheme the app registers in app.json", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { expo } = require("../app.json");
    expect(KYC_RETURN_URL.startsWith(`${expo.scheme}://`)).toBe(true);
  });

  it.each([
    ["no url (an older backend)", undefined],
    ["an empty url", ""],
    ["a plain http url", "http://api.example.test/kyc/widget/x"],
    ["a custom scheme", "otherapp://kyc/widget/x"],
    ["a javascript url", "javascript:alert(1)"],
    ["something that is not a url", "not a url"],
  ])("never opens %s: reports an error", async (_label, url) => {
    await expect(createBrowserWidgetLauncher().open(launch(url))).resolves.toEqual({ kind: "error" });
    expect(openAuthSession).not.toHaveBeenCalled();
  });

  it("accepts only absolute https urls", () => {
    expect(isOpenableWidgetUrl(WIDGET_URL)).toBe(true);
    expect(isOpenableWidgetUrl("http://x.test")).toBe(false);
    expect(isOpenableWidgetUrl(undefined)).toBe(false);
  });
});

describe("browser launcher: how the browser ended", () => {
  it("a redirect to the return page is 'completed'", async () => {
    openAuthSession.mockResolvedValue({ type: "success", url: KYC_RETURN_URL });
    await expect(createBrowserWidgetLauncher().open(launch(WIDGET_URL))).resolves.toEqual({ kind: "completed" });
  });

  it.each(["cancel", "dismiss", "locked", "opened"] as const)("'%s' is 'dismissed', never a failure", async (type) => {
    openAuthSession.mockResolvedValue({ type });
    await expect(createBrowserWidgetLauncher().open(launch(WIDGET_URL))).resolves.toEqual({ kind: "dismissed" });
  });

  it("a native error is an 'error' outcome, not a rejection", async () => {
    openAuthSession.mockRejectedValue(new Error("no browser"));
    await expect(createBrowserWidgetLauncher().open(launch(WIDGET_URL))).resolves.toEqual({ kind: "error" });
  });

  it("maps results with the pure helper too", () => {
    expect(outcomeFromBrowserResult({ type: "success", url: "x://y" })).toEqual({ kind: "completed" });
    expect(outcomeFromBrowserResult({ type: "cancel" } as WebBrowser.WebBrowserAuthSessionResult)).toEqual({ kind: "dismissed" });
  });

  it("the fixture session carries the hosted url", () => {
    expect(session().widget_url).toBe(WIDGET_URL);
  });
});
