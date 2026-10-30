import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import { api } from "../src/api/client";
import { session } from "../src/auth";
import ChangePassword from "../src/screens/account/ChangePassword";
import Profile from "../src/screens/account/Profile";
import { authService } from "../src/services/auth.service";

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, goBack: mockGoBack } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
}));

// Placeholder values, never real credentials.
const CURRENT = "Old-Placeholder-1";
const NEW = "Brand-New-Pass-42";

// react-query re-arms its gc timer for a mutation that never settles, and Jest then never exits (guide: the care-plan
// harness clears its client after each test); so every client is kept and cleared in afterEach.
const clients: QueryClient[] = [];

async function renderWith(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

function refuse(status: number, code: string, message = "m", headers: Record<string, string> = {}) {
  return { error: { detail: { code, message } }, response: json(status, { detail: { code, message } }, headers) };
}

let post: jest.SpyInstance;
let alertSpy: jest.SpyInstance;
beforeEach(async () => {
  await session.signIn({ accessToken: "old-access", refreshToken: "old-refresh" });
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  post = jest.spyOn(api, "POST");
});
afterEach(async () => {
  jest.useRealTimers();
  clients.splice(0).forEach((client) => client.clear());
  jest.restoreAllMocks();
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  await act(async () => {
    await session.signOut();
  });
});

async function fill(current: string, next: string, confirm: string) {
  await fireEvent.changeText(screen.getByPlaceholderText("Enter current password"), current);
  await fireEvent.changeText(screen.getByPlaceholderText("At least 8 characters"), next);
  await fireEvent.changeText(screen.getByPlaceholderText("Enter the new password again"), confirm);
}

/** The heading and the button share a title; the button is the last one on the screen. */
const submit = async () => fireEvent.press(screen.getAllByText(/^(Change password|Try again in .*)$/).at(-1) as never);

describe("Profile", () => {
  it("has a Change password row that opens the screen", async () => {
    jest.spyOn(authService, "getMe").mockResolvedValue({ full_name: "Ada Obi", email: "ada@example.com" } as never);
    await renderWith(<Profile />);
    await fireEvent.press(screen.getByText("Change password"));
    expect(mockNavigate).toHaveBeenCalledWith("ChangePassword");
  });
});

describe("Change password screen", () => {
  it("masks all three fields", async () => {
    await renderWith(<ChangePassword />);
    for (const placeholder of ["Enter current password", "At least 8 characters", "Enter the new password again"]) {
      expect(screen.getByPlaceholderText(placeholder).props.secureTextEntry).toBe(true);
    }
  });

  it("checks the form before it calls the server", async () => {
    await renderWith(<ChangePassword />);
    await submit();
    expect(screen.getByText("Enter your current password")).toBeTruthy();
    expect(screen.getByText("Enter a new password")).toBeTruthy();
    expect(screen.getByText("Please confirm your new password")).toBeTruthy();

    await fill(CURRENT, "short1", "short1");
    await submit();
    expect(screen.getByText("Password must be at least 8 characters.")).toBeTruthy();

    await fill(CURRENT, NEW, "Different-Pass-1");
    await submit();
    expect(screen.getByText("Passwords do not match")).toBeTruthy();

    await fill(CURRENT, CURRENT, CURRENT);
    await submit();
    expect(screen.getByText("Choose a password you are not using now.")).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it("sends both passwords, keeps the caregiver signed in on the returned tokens and says what happened", async () => {
    post.mockResolvedValue({
      data: { access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", detail: "Password changed." },
      response: json(200, {}),
    });
    await renderWith(<ChangePassword />);
    await fill(CURRENT, NEW, NEW);
    await submit();

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Password changed", "You have been signed out on your other devices.", expect.any(Array)));
    expect(post).toHaveBeenCalledWith("/api/v1/auth/change-password", { body: { current_password: CURRENT, new_password: NEW } });
    expect(session.store.getState().status).toBe("signedIn");
    expect(session.store.getState().tokens).toEqual({ accessToken: "new-access", refreshToken: "new-refresh" });

    const buttons = alertSpy.mock.calls.at(-1)?.[2] as { onPress?: () => void }[];
    await act(async () => buttons[0].onPress?.());
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it("puts a wrong current password under that field and keeps what was typed", async () => {
    post.mockResolvedValue(refuse(400, "wrong_current_password"));
    await renderWith(<ChangePassword />);
    await fill(CURRENT, NEW, NEW);
    await submit();
    expect(await screen.findByText("Your current password is incorrect.")).toBeTruthy();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("At least 8 characters").props.value).toBe(NEW);
    expect(session.store.getState().tokens?.accessToken).toBe("old-access");
  });

  it("puts a weak password under the new field, in the server's words, and clears it when edited", async () => {
    post.mockResolvedValue(refuse(400, "weak_password", "Password is too repetitive."));
    await renderWith(<ChangePassword />);
    await fill(CURRENT, "aaaaabbbbb", "aaaaabbbbb");
    await submit();
    expect(await screen.findByText("Password is too repetitive.")).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText("At least 8 characters"), "aaaaabbbbbc");
    expect(screen.queryByText("Password is too repetitive.")).toBeNull();
  });

  it("puts same_password under the new field", async () => {
    post.mockResolvedValue(refuse(400, "same_password"));
    await renderWith(<ChangePassword />);
    await fill(CURRENT, NEW, NEW);
    await submit();
    expect(await screen.findByText("Choose a password you are not using now.")).toBeTruthy();
  });

  it("on too_many_attempts counts down the Retry-After wait, blocks sending, then allows it again", async () => {
    jest.useFakeTimers();
    post.mockResolvedValueOnce(refuse(429, "too_many_attempts", "m", { "Retry-After": "30" }));
    await renderWith(<ChangePassword />);
    await fill(CURRENT, NEW, NEW);
    await submit();
    expect(await screen.findByText(/You can try again in 0:30/)).toBeTruthy();
    expect(screen.getAllByText("Try again in 0:30").length).toBe(1);

    await submit(); // refused on the spot, the server is not asked
    expect(post).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(screen.getByText(/You can try again in 0:20/)).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });
    expect(screen.queryByText(/You can try again/)).toBeNull();
    post.mockResolvedValueOnce({
      data: { access_token: "a2", refresh_token: "r2", token_type: "bearer", detail: "Password changed." },
      response: json(200, {}),
    });
    await submit();
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  });

  it("shows anything else (offline, server error) as a message and keeps the form", async () => {
    post.mockRejectedValue(new TypeError("Network request failed"));
    await renderWith(<ChangePassword />);
    await fill(CURRENT, NEW, NEW);
    await submit();
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith("Couldn't change your password", expect.stringContaining("Can't reach Oakly")),
    );
    expect(screen.getByPlaceholderText("Enter current password").props.value).toBe(CURRENT);
  });
});
