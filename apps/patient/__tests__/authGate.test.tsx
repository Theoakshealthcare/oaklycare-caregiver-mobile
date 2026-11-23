import { fireEvent, render, screen } from "@testing-library/react-native";

import { queryClient } from "../src/api/queryClient";
import { session } from "../src/auth";
import {
  caregiverUser,
  disableCacheGcForTests,
  keychainKeys,
  patientUser,
  routeFetch,
  setIntroSeen,
  tokens,
} from "../test-utils/fakeApi";

import App from "../App";

jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));

async function signInThroughTheForm() {
  await fireEvent.changeText(await screen.findByLabelText("Email Address"), "ada.placeholder@example.com");
  await fireEvent.changeText(screen.getByLabelText("Input Password"), "placeholder-password");
  await fireEvent.press(screen.getByRole("button", { name: "Login" }));
}

describe("auth gate (App)", () => {
  beforeAll(() => disableCacheGcForTests(queryClient));

  beforeEach(async () => {
    await session.signOut();
    await setIntroSeen(true);
  });

  afterAll(() => {
    // React Query keeps gc timers per cache entry; clear them so the worker can exit.
    queryClient.clear();
  });

  it("opens on the intro slides on a fresh install, and Skip goes to Login", async () => {
    await setIntroSeen(false);
    const view = await render(<App />);
    expect(await screen.findByText("AI-Powered Personalized Care")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Skip" }));
    expect(await screen.findByLabelText("Input Password")).toBeTruthy();
    view.unmount();
  });

  it("does not show the intro again once it has been seen", async () => {
    const view = await render(<App />);
    expect(await screen.findByLabelText("Input Password")).toBeTruthy();
    expect(screen.queryByText("AI-Powered Personalized Care")).toBeNull();
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

  it("signs in with email and password, lands on Home from /auth/me, and logout clears everything", async () => {
    const calls = routeFetch({
      "POST /api/v1/auth/login/mobile": () => ({ status: 200, body: tokens }),
      "GET /api/v1/auth/me": () => ({ status: 200, body: patientUser }),
    });
    const view = await render(<App />);
    await signInThroughTheForm();

    expect(await screen.findByText(/Hello Ada,/)).toBeTruthy();
    expect(calls[0]).toMatchObject({
      method: "POST",
      path: "/api/v1/auth/login/mobile",
      body: { email_or_phone: "ada.placeholder@example.com", password: "placeholder-password" },
    });
    expect(calls.find((c) => c.path === "/api/v1/auth/me")?.authorization).toBe("Bearer access-1");
    expect(keychainKeys().length).toBeGreaterThan(0);
    expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByRole("button", { name: "Open profile" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Account and data" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Log out" }));
    // Log out asks first (P1-09): "No, stay signed in" changes nothing, "Yes, log out" ends the session.
    expect(await screen.findByText("Log out?")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "No, stay signed in" }));
    expect(session.getAccessToken()).not.toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Log out" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Yes, log out" }));

    expect(await screen.findByLabelText("Input Password")).toBeTruthy();
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
    expect(screen.getByLabelText("Email Address")).toBeTruthy();
    view.unmount();
  });

  it("restores a stored session on launch and goes straight to Home", async () => {
    await session.signIn({ accessToken: "access-stored", refreshToken: "refresh-stored" });
    routeFetch({ "GET /api/v1/auth/me": () => ({ status: 200, body: patientUser }) });
    const view = await render(<App />);
    expect(await screen.findByText(/Hello Ada,/)).toBeTruthy();
    view.unmount();
  });

  it("sends a signed-in account with an unverified email to the verify step, and signing out leaves it", async () => {
    await session.signIn({ accessToken: "access-stored", refreshToken: "refresh-stored" });
    routeFetch({ "GET /api/v1/auth/me": () => ({ status: 200, body: { ...patientUser, is_verified: false } }) });
    const view = await render(<App />);
    expect(await screen.findByText(/Enter the OTP code sent to your mail, ada.placeholder@example.com/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Go back" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Use a different account" }));
    expect(await screen.findByLabelText("Input Password")).toBeTruthy();
    expect(keychainKeys()).toEqual([]);
    view.unmount();
  });
});
