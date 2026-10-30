import { act, fireEvent, screen } from "@testing-library/react-native";
import * as WebBrowser from "expo-web-browser";
import React from "react";

import { session as authSession } from "../src/auth";
import { createBrowserWidgetLauncher } from "../src/identity/browserWidgetLauncher";
import { KYC_RETURN_URL } from "../src/identity/config";
import type { IdentityState } from "../src/identity/identityModel";
import { setWidgetLauncher, unavailableWidgetLauncher } from "../src/identity/widget";
import IdentityVerification from "../src/screens/setup/IdentityVerification";
import { renderWithClient } from "../test-utils/carePlanHarness";
import { WIDGET_URL, checking, expired, fresh, session, started, tryAgain, underReview, verified } from "../test-utils/identityFixtures";

/**
 * The launch flow end to end: the REAL service (against a faked server behind `fetch`), the REAL browser launcher
 * (against a mocked `expo-web-browser`) and the real screen. Nothing here is a device test.
 */
const mockNavigate = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({
    navigation: { navigate: mockNavigate, goBack: jest.fn(), getState: () => ({ routeNames: ["IdentityVerification", "ConsentScreen"] }) },
  }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
}));
jest.mock("../src/api/client", () => {
  const { createOaklyClient } = jest.requireActual("@oakly/api-client");
  return {
    api: createOaklyClient({
      baseUrl: "http://test.local",
      getAccessToken: () => "access",
      fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
    }),
  };
});

const openAuthSession = WebBrowser.openAuthSessionAsync as jest.Mock;
const BASE = "/api/v1/caregiver/identity-verification";

let server: IdentityState;
let requests: { method: string; path: string; body: unknown }[];
let fetchMock: jest.SpyInstance;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** The slice of the backend this flow touches. `client-event` moves the attempt like K2 does: only `completed` matters. */
async function serve(input: RequestInfo | URL): Promise<Response> {
  const req = input as Request;
  const path = new URL(req.url).pathname.replace(BASE, "") || "/";
  const body = req.method === "POST" ? await req.clone().json().catch(() => null) : null;
  requests.push({ method: req.method, path, body });
  if (req.method === "GET") return json(server);
  if (path === "/sessions") {
    const resumed = !!server.active_verification_id;
    if (!resumed) server = started();
    return json(session(server), resumed ? 200 : 201);
  }
  if (path.endsWith("/client-event")) {
    if ((body as { event?: string } | null)?.event === "completed") server = checking();
    return json(server);
  }
  return json({ detail: "not found" }, 404);
}

const sent = (event: string) => requests.filter((r) => r.path.endsWith("/client-event") && (r.body as { event: string }).event === event);
const sessionCalls = () => requests.filter((r) => r.path === "/sessions");

beforeEach(async () => {
  jest.useFakeTimers();
  server = fresh();
  requests = [];
  openAuthSession.mockReset();
  fetchMock = jest.spyOn(globalThis, "fetch").mockImplementation(serve);
  setWidgetLauncher(createBrowserWidgetLauncher());
  await authSession.signIn({ accessToken: "access", refreshToken: "refresh" });
});
afterEach(async () => {
  jest.useRealTimers();
  fetchMock.mockRestore();
  setWidgetLauncher(unavailableWidgetLauncher);
  mockNavigate.mockClear();
  await authSession.signOut();
});

const settle = (ms = 0) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

async function render() {
  const view = await renderWithClient(<IdentityVerification />);
  await settle();
  return view;
}
async function startFromIntro() {
  await fireEvent.press(await screen.findByTestId("identity-consent-check"));
  await fireEvent.press(screen.getByTestId("identity-start"));
  await settle();
}

describe("the browser returns to the app", () => {
  it("opens the hosted page once, goes to 'Checking', and shows the server's answer when polling finds it", async () => {
    openAuthSession.mockResolvedValue({ type: "success", url: KYC_RETURN_URL });
    await render();
    await startFromIntro();

    expect(openAuthSession).toHaveBeenCalledTimes(1);
    expect(openAuthSession).toHaveBeenCalledWith(WIDGET_URL, KYC_RETURN_URL);
    expect(sent("opened")).toHaveLength(1);
    expect(sent("completed")).toHaveLength(1);
    expect(screen.getByTestId("identity-checking")).toBeTruthy();
    expect(screen.queryByTestId("identity-verified")).toBeNull();
    // Came back through the redirect: the browser did not stop early, so there is nothing to continue.
    expect(screen.queryByTestId("identity-continue-verification")).toBeNull();

    server = verified();
    await settle(3_000);
    expect(screen.getByTestId("identity-verified")).toBeTruthy();
  });

  it("a server that decides 'under review' or 'try again' is shown as the server says", async () => {
    openAuthSession.mockResolvedValue({ type: "success", url: KYC_RETURN_URL });
    await render();
    await startFromIntro();
    server = underReview();
    await settle(3_000);
    expect(screen.getByTestId("identity-under-review")).toBeTruthy();
  });
});

describe("the browser is dismissed before the return page", () => {
  it.each(["cancel", "dismiss", "locked"] as const)("'%s': goes to 'Checking' (not a failure) and offers Continue verification", async (type) => {
    openAuthSession.mockResolvedValue({ type });
    await render();
    await startFromIntro();

    expect(screen.getByTestId("identity-checking")).toBeTruthy();
    expect(screen.queryByTestId("identity-closed")).toBeNull();
    expect(screen.queryByTestId("identity-widget-error")).toBeNull();
    expect(screen.getByTestId("identity-continue-verification")).toBeTruthy();
    expect(sent("closed")).toHaveLength(1);
    expect(sent("completed")).toHaveLength(0);
  });

  it("keeps polling while dismissed, and the server's answer wins (finished on another device)", async () => {
    openAuthSession.mockResolvedValue({ type: "dismiss" });
    await render();
    await startFromIntro();
    const reads = () => requests.filter((r) => r.method === "GET").length;
    const before = reads();
    await settle(6_000);
    expect(reads()).toBeGreaterThan(before);

    server = verified();
    await settle(3_000);
    expect(screen.getByTestId("identity-verified")).toBeTruthy();
    expect(screen.queryByTestId("identity-continue-verification")).toBeNull();
  });

  it("after about a minute says 'Still checking', still with no failure", async () => {
    openAuthSession.mockResolvedValue({ type: "dismiss" });
    await render();
    await startFromIntro();
    await settle(30_000);
    expect(screen.queryByTestId("identity-slow")).toBeNull();
    await settle(31_000);
    expect(screen.getByTestId("identity-slow")).toHaveTextContent(
      "Still checking. This can take a few minutes. You can leave this screen; we will tell you when it is done.",
    );
    expect(screen.queryByTestId("identity-closed")).toBeNull();
    expect(screen.queryByTestId("identity-widget-error")).toBeNull();
  });

  it("Continue verification resumes the SAME open attempt (200, one start, no new consent) and opens the page again", async () => {
    openAuthSession.mockResolvedValueOnce({ type: "cancel" }).mockResolvedValueOnce({ type: "success", url: KYC_RETURN_URL });
    await render();
    await startFromIntro();
    expect(sessionCalls()).toHaveLength(1);

    await fireEvent.press(screen.getByTestId("identity-continue-verification"));
    await settle();
    expect(sessionCalls()).toHaveLength(2);
    expect(sessionCalls()[1].body).toEqual({ consent: true, policy_version: "kyc-2026-10" });
    expect(openAuthSession).toHaveBeenCalledTimes(2);
    expect(sent("completed")).toHaveLength(1);
    expect(screen.queryByTestId("identity-continue-verification")).toBeNull();
    expect(screen.getByTestId("identity-checking")).toBeTruthy();
  });

  it("does not offer Continue once the server has heard 'completed' (a second run under one reference is ambiguous)", async () => {
    openAuthSession.mockResolvedValue({ type: "cancel" });
    await render();
    await startFromIntro();
    expect(screen.getByTestId("identity-continue-verification")).toBeTruthy();

    server = checking();
    await settle(3_000);
    expect(screen.getByTestId("identity-checking")).toBeTruthy();
    expect(screen.queryByTestId("identity-continue-verification")).toBeNull();
  });

  it("if the attempt timed out meanwhile, the server's state wins: 'Start again' with a fresh consent, no Continue", async () => {
    openAuthSession.mockResolvedValue({ type: "cancel" });
    await render();
    await startFromIntro();

    server = expired();
    await settle(3_000);
    expect(screen.getByTestId("identity-expired")).toBeTruthy();
    expect(screen.queryByTestId("identity-continue-verification")).toBeNull();
    expect(screen.getByTestId("identity-consent-check")).toBeTruthy();
  });

  it("if the server turned the attempt down meanwhile, 'Try again' is shown, not Checking", async () => {
    openAuthSession.mockResolvedValue({ type: "dismiss" });
    await render();
    await startFromIntro();
    server = tryAgain();
    await settle(3_000);
    expect(screen.getByTestId("identity-try-again")).toBeTruthy();
  });
});

describe("the page cannot be opened", () => {
  it("a session response without widget_url is refused: nothing opens, a banner shows, and the server's state decides the screen", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const res = await serve(input);
      const req = input as Request;
      if (req.method === "POST" && new URL(req.url).pathname.endsWith("/sessions")) {
        const body = await res.json();
        delete body.widget_url;
        return json(body, res.status);
      }
      return res;
    });
    await render();
    await startFromIntro();
    expect(openAuthSession).not.toHaveBeenCalled();
    expect(screen.getByTestId("identity-banner")).toBeTruthy();
    expect(screen.queryByTestId("identity-verified")).toBeNull();
    // The attempt exists on the server, so the open attempt can be continued.
    expect(screen.getByTestId("identity-resume")).toBeTruthy();
  });

  it("a native browser error ends as a widget error", async () => {
    openAuthSession.mockRejectedValue(new Error("no browser"));
    await render();
    await startFromIntro();
    expect(screen.getByTestId("identity-widget-error")).toBeTruthy();
  });
});

describe("leaving the screen", () => {
  it("a browser that ends after the screen is gone changes nothing and sends nothing", async () => {
    let finish: (value: WebBrowser.WebBrowserAuthSessionResult) => void = () => {};
    openAuthSession.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    const view = await render();
    await startFromIntro();
    expect(screen.getByTestId("identity-widget")).toBeTruthy();
    const calls = requests.length;

    await view.unmount();
    await act(async () => {
      finish({ type: "success", url: KYC_RETURN_URL });
    });
    await settle(30_000);
    expect(requests).toHaveLength(calls);
    expect(sent("completed")).toHaveLength(0);
  });

  it("stops polling on unmount while dismissed, with no timer left", async () => {
    openAuthSession.mockResolvedValue({ type: "dismiss" });
    const view = await render();
    await startFromIntro();
    await view.unmount();
    const calls = requests.length;
    await settle(60_000);
    expect(requests).toHaveLength(calls);
    expect(jest.getTimerCount()).toBe(0);
  });
});
