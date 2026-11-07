import { render, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";

import { queryClient } from "../src/api/queryClient";
import { session } from "../src/auth";
import { disableCacheGcForTests, patientUser, routeFetch, tokens } from "../test-utils/fakeApi";

import App from "../App";

jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));

const keychainKeys = () => (SecureStore as unknown as { __keys: () => string[] }).__keys();

describe("token refresh through the real client", () => {
  beforeAll(() => disableCacheGcForTests(queryClient));

  beforeEach(async () => {
    await session.signOut();
    await session.signIn({ accessToken: "access-stale", refreshToken: "refresh-stale" });
  });

  afterAll(() => {
    queryClient.clear();
  });

  it("a 401 on the refresh call itself logs the user out instead of hanging", async () => {
    const calls = routeFetch({
      "GET /api/v1/auth/me": () => ({ status: 401, body: { detail: "Could not validate credentials" } }),
      "POST /api/v1/auth/refresh": () => ({ status: 401, body: { detail: "Invalid refresh token" } }),
    });
    const view = await render(<App />);

    expect(await screen.findByText("Sign in to your Oakly Health account")).toBeTruthy();
    expect(session.store.getState()).toEqual({ status: "signedOut", tokens: null });
    expect(keychainKeys()).toEqual([]);
    // One /auth/me, one refresh, and the retried /auth/me never happens: the refresh verdict ends the session.
    expect(calls.filter((c) => c.path === "/api/v1/auth/refresh")).toHaveLength(1);
    expect(calls.find((c) => c.path === "/api/v1/auth/refresh")?.body).toEqual({ refresh_token: "refresh-stale" });
    expect(calls.find((c) => c.path === "/api/v1/auth/refresh")?.authorization).toBeNull();
    view.unmount();
  });

  it("a refresh outage (5xx) keeps the session and offers a retry", async () => {
    routeFetch({
      "GET /api/v1/auth/me": () => ({ status: 401, body: { detail: "Could not validate credentials" } }),
      "POST /api/v1/auth/refresh": () => ({ status: 503, body: { detail: "down" } }),
    });
    const view = await render(<App />);
    expect(await screen.findByText("We couldn't load your account")).toBeTruthy();
    expect(session.store.getState().status).toBe("signedIn");
    expect(keychainKeys().length).toBeGreaterThan(0);
    view.unmount();
  });

  it("a good refresh rotates the tokens and retries the request once", async () => {
    let refreshCalls = 0;
    const calls = routeFetch({
      "GET /api/v1/auth/me": (call) =>
        call.authorization === "Bearer access-stale" ? { status: 401, body: { detail: "expired" } } : { status: 200, body: patientUser },
      "POST /api/v1/auth/refresh": () => {
        refreshCalls += 1;
        return { status: 200, body: { ...tokens, access_token: "access-fresh", refresh_token: "refresh-fresh" } };
      },
    });
    const view = await render(<App />);
    expect(await screen.findByText("Welcome, Ada Placeholder")).toBeTruthy();
    expect(refreshCalls).toBe(1);
    expect(calls.filter((c) => c.path === "/api/v1/auth/me").map((c) => c.authorization)).toEqual([
      "Bearer access-stale",
      "Bearer access-fresh",
    ]);
    await waitFor(() => expect(session.getAccessToken()).toBe("access-fresh"));
    view.unmount();
  });
});
