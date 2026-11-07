import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import { codeDigits, resetFailure } from "../src/account/resetPasswordModel";
import { api } from "../src/api/client";
import { ApiError } from "../src/api/errors";
import RecoverPassword from "../src/screens/auth/RecoverPassword";
import ResetPassword from "../src/screens/auth/ResetPassword";

const mockNavigate = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, goBack: jest.fn() } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
}));

// Placeholder values, never real credentials.
const EMAIL = "cora.placeholder@example.com";
const NEW = "Brand-New-Pass-42";

// Every client is kept and cleared in afterEach, or a never-settling mutation keeps Jest alive (see the change-password test).
const clients: QueryClient[] = [];
const views: { unmount: () => void }[] = [];
async function renderWith(ui: React.ReactElement) {
  // gcTime Infinity: no 5-minute gc timer holding Jest open after the last test.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  const view = await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  views.push(view);
  return view;
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
function refuse(status: number, code: string, message = "m", headers: Record<string, string> = {}) {
  return { error: { detail: { code, message } }, response: json(status, { detail: { code, message } }, headers) };
}
const ok = (body: unknown = { message: "ok" }) => ({ data: body, response: json(200, body) });

let post: jest.SpyInstance;
let alertSpy: jest.SpyInstance;
beforeEach(() => {
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  post = jest.spyOn(api, "POST");
});
afterEach(() => {
  // Unmount first: clearing a client under a mounted observer re-arms react-query's gc timer and Jest never exits.
  views.splice(0).forEach((view) => view.unmount());
  jest.useRealTimers();
  clients.splice(0).forEach((client) => client.clear());
  jest.restoreAllMocks();
  mockNavigate.mockClear();
});

const route = { params: { email: EMAIL } } as never;
const renderReset = () => renderWith(<ResetPassword navigation={{} as never} route={route} />);
const setCode = (value: string) => fireEvent.changeText(screen.getByPlaceholderText("5-digit code"), value);
const setPasswords = async (next: string, confirm = next) => {
  const fields = screen.getAllByPlaceholderText("Enter New Password");
  await fireEvent.changeText(fields[0], next);
  await fireEvent.changeText(fields[1], confirm);
};
/** The heading and the button share a title; the button is the last one on the screen. */
const press = () => fireEvent.press(screen.getAllByText("Reset Password").at(-1) as never);

describe("resetFailure / codeDigits", () => {
  it("reads detail.code, not the message", () => {
    const err = (status: number, code: string, headers: number | null = null) =>
      new ApiError(status, { detail: { code, message: "ignored" } }, "m", headers);
    expect(resetFailure(err(400, "invalid_or_expired_code")).kind).toBe("invalid_code");
    expect(resetFailure(err(400, "weak_password"))).toEqual({ kind: "weak_password", message: "ignored" });
    expect(resetFailure(err(429, "too_many_attempts")).kind).toBe("request_new_code");
    expect(resetFailure(err(429, "too_many_attempts", 45))).toEqual({ kind: "locked", message: "Too many tries. Try again in 45 seconds." });
    expect(resetFailure(new ApiError(400, { detail: "Invalid token" }, "m")).kind).toBe("other");
    expect(resetFailure(new Error("x")).kind).toBe("other");
  });

  it("keeps only the first five digits", () => {
    expect(codeDigits(" 12-3456 7")).toBe("12345");
  });
});

describe("Recover password screen", () => {
  it("asks for a code, says nothing about whether the account exists, then moves to the code screen with the same email", async () => {
    post.mockResolvedValue(ok({ message: "Password recovery email sent" }));
    await renderWith(<RecoverPassword />);
    await fireEvent.changeText(screen.getByPlaceholderText("Provide your Email Address"), ` ${EMAIL} `);
    await fireEvent.press(screen.getByText("Send Reset Code"));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Check your email", expect.stringContaining("If that email has an account"), expect.any(Array)));
    expect(post).toHaveBeenCalledWith("/api/v1/auth/password-recovery", { body: { email: EMAIL } });
    const buttons = alertSpy.mock.calls.at(-1)?.[2] as { onPress?: () => void }[];
    await act(async () => buttons[0].onPress?.());
    expect(mockNavigate).toHaveBeenCalledWith("ResetPassword", { email: EMAIL });
  });
});

describe("Reset password screen", () => {
  it("has no field for the old long token and takes digits only", async () => {
    await renderReset();
    expect(screen.queryByPlaceholderText("Paste the code from your email")).toBeNull();
    await setCode("12a-3456");
    expect(screen.getByPlaceholderText("5-digit code").props.value).toBe("12345");
    expect(screen.getByPlaceholderText("5-digit code").props.maxLength).toBe(5);
  });

  it("checks the form before it calls the server", async () => {
    await renderReset();
    await press();
    expect(screen.getByText("Enter the 5-digit code from your email")).toBeTruthy();
    expect(screen.getByText("Password is required")).toBeTruthy();
    expect(screen.getByText("Please confirm your password")).toBeTruthy();

    await setCode("12345");
    await setPasswords("short1");
    await press();
    expect(screen.getAllByText("Password must be at least 8 characters.").length).toBeGreaterThan(0);

    await setPasswords(NEW, "Different-Pass-1");
    await press();
    expect(screen.getByText("Passwords do not match")).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it("sends {email, code, new_password}, tells the caregiver they were signed out elsewhere, then goes to Login", async () => {
    post.mockResolvedValue(ok({ message: "Password updated successfully" }));
    await renderReset();
    await setCode("13579");
    await setPasswords(NEW);
    await press();

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith("Password reset", expect.stringContaining("signed out on your other devices"), expect.any(Array)),
    );
    expect(post).toHaveBeenCalledWith("/api/v1/auth/reset-password", { body: { email: EMAIL, code: "13579", new_password: NEW } });
    const buttons = alertSpy.mock.calls.at(-1)?.[2] as { onPress?: () => void }[];
    await act(async () => buttons[0].onPress?.());
    expect(mockNavigate).toHaveBeenCalledWith("Login");
  });

  it("a wrong or expired code is said plainly under the box, the box is cleared and Resend stays", async () => {
    post.mockResolvedValue(refuse(400, "invalid_or_expired_code"));
    await renderReset();
    await setCode("13579");
    await setPasswords(NEW);
    await press();
    expect(await screen.findByText("That code isn't right or has expired. Request a new one.")).toBeTruthy();
    expect(screen.getByPlaceholderText("5-digit code").props.value).toBe("");
    expect(screen.getByText(/^Resend code/)).toBeTruthy();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("a weak password goes under the password, in the server's words, and the code is kept", async () => {
    post.mockResolvedValue(refuse(400, "weak_password", "Password is too repetitive."));
    await renderReset();
    await setCode("13579");
    await setPasswords("aaaaabbbbb");
    await press();
    expect(await screen.findByText("Password is too repetitive.")).toBeTruthy();
    expect(screen.getByPlaceholderText("5-digit code").props.value).toBe("13579");
  });

  it("five wrong codes (429, no Retry-After) ask for a new code and keep Resend", async () => {
    post.mockResolvedValue(refuse(429, "too_many_attempts"));
    await renderReset();
    await setCode("13579");
    await setPasswords(NEW);
    await press();
    expect(await screen.findByText("Too many tries. Request a new code.")).toBeTruthy();
    expect(screen.getByText(/^Resend code/)).toBeTruthy();
  });

  it("the 24-hour budget (429 with Retry-After) says when to come back, hides Resend and stops sending", async () => {
    post.mockResolvedValue(refuse(429, "too_many_attempts", "Please try again later.", { "Retry-After": "3600" }));
    await renderReset();
    await setCode("13579");
    await setPasswords(NEW);
    await press();
    expect(await screen.findByText("Too many tries. Try again in 60 minutes.")).toBeTruthy();
    expect(screen.queryByText(/^Resend code/)).toBeNull();
    await press();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("anything else (offline) is an alert in plain words", async () => {
    post.mockRejectedValue(new TypeError("Network request failed"));
    await renderReset();
    await setCode("13579");
    await setPasswords(NEW);
    await press();
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Error", expect.stringContaining("Can't reach Oakly")));
  });

  it("Resend code is closed for a minute, then asks for a new code for the same email and says to use the newest", async () => {
    jest.useFakeTimers();
    post.mockResolvedValue(ok({ message: "Password recovery email sent" }));
    await renderReset();
    expect(screen.getByText("Resend code (60s)")).toBeTruthy();
    // The countdown re-arms a one-second timer after every render, so it is ticked one second at a time.
    for (let second = 0; second < 60; second += 1) {
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    }
    await fireEvent.press(screen.getByText("Resend code"));
    expect(await screen.findByText(/we've sent a new code\. Use the newest email and check your spam folder\./)).toBeTruthy();
    expect(post).toHaveBeenCalledWith("/api/v1/auth/password-recovery", { body: { email: EMAIL } });
    expect(screen.getByText("Resend code (60s)")).toBeTruthy();
  });
});
