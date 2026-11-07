import { fireEvent, render, screen } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";

import { queryClient } from "../src/api/queryClient";
import { session } from "../src/auth";
import { caregiverUser, disableCacheGcForTests, patientUser, routeFetch, tokens } from "../test-utils/fakeApi";

import App from "../App";

jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));

const keychainKeys = () => (SecureStore as unknown as { __keys: () => string[] }).__keys();

async function signInThroughTheForm() {
  await fireEvent.changeText(await screen.findByLabelText("Email address"), "ada.placeholder@example.com");
  await fireEvent.changeText(screen.getByLabelText("Password"), "placeholder-password");
  await fireEvent.press(screen.getByRole("button", { name: "Login" }));
}

describe("auth gate (App)", () => {
  beforeAll(() => disableCacheGcForTests(queryClient));

  beforeEach(async () => {
    await session.signOut();
  });

  afterAll(() => {
    // React Query keeps gc timers per cache entry; clear them so the worker can exit.
    queryClient.clear();
  });

  it("boots to the Login screen when nothing is stored", async () => {
    const view = await render(<App />);
    expect(await screen.findByText("Sign in to your Oakly Health account")).toBeTruthy();
    expect(screen.getByLabelText("Email address")).toBeTruthy();
    view.unmount();
  });

  it("validates the form before calling the server", async () => {
    const calls = routeFetch({});
    const view = await render(<App />);
    await fireEvent.press(await screen.findByRole("button", { name: "Login" }));
    expect(await screen.findByText("Email is required")).toBeTruthy();
    expect(screen.getByText("Password is required")).toBeTruthy();
    expect(calls).toHaveLength(0);
    view.unmount();
  });

  it("signs in with email and password, shows the user from /auth/me, and logout clears everything", async () => {
    const calls = routeFetch({
      "POST /api/v1/auth/login/mobile": () => ({ status: 200, body: tokens }),
      "GET /api/v1/auth/me": () => ({ status: 200, body: patientUser }),
    });
    const view = await render(<App />);
    await signInThroughTheForm();

    expect(await screen.findByText("Welcome, Ada Placeholder")).toBeTruthy();
    expect(calls[0]).toMatchObject({
      method: "POST",
      path: "/api/v1/auth/login/mobile",
      body: { email_or_phone: "ada.placeholder@example.com", password: "placeholder-password" },
    });
    expect(calls.find((c) => c.path === "/api/v1/auth/me")?.authorization).toBe("Bearer access-1");
    expect(keychainKeys().length).toBeGreaterThan(0);
    expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByText("Sign in to your Oakly Health account")).toBeTruthy();
    expect(keychainKeys()).toEqual([]);
    expect(session.getAccessToken()).toBeNull();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    view.unmount();
  });

  it("shows the server's verdict on a wrong password and stays signed out", async () => {
    routeFetch({
      "POST /api/v1/auth/login/mobile": () => ({ status: 401, body: { detail: "Incorrect email or password" } }),
    });
    const view = await render(<App />);
    await signInThroughTheForm();
    expect(await screen.findByText("Incorrect email or password.")).toBeTruthy();
    expect(keychainKeys()).toEqual([]);
    view.unmount();
  });

  it("signs a caregiver account straight back out", async () => {
    routeFetch({
      "POST /api/v1/auth/login/mobile": () => ({ status: 200, body: tokens }),
      "GET /api/v1/auth/me": () => ({ status: 200, body: caregiverUser }),
    });
    const view = await render(<App />);
    await signInThroughTheForm();
    expect(await screen.findByText(/This app is for patients and families/)).toBeTruthy();
    // Refused before a session was ever opened: nothing stored, still signed out, Login still on screen.
    expect(keychainKeys()).toEqual([]);
    expect(session.store.getState().status).toBe("signedOut");
    expect(screen.getByLabelText("Email address")).toBeTruthy();
    view.unmount();
  });

  it("restores a stored session on launch and goes straight to Home", async () => {
    await session.signIn({ accessToken: "access-stored", refreshToken: "refresh-stored" });
    routeFetch({ "GET /api/v1/auth/me": () => ({ status: 200, body: patientUser }) });
    const view = await render(<App />);
    expect(await screen.findByText("Welcome, Ada Placeholder")).toBeTruthy();
    view.unmount();
  });
});
