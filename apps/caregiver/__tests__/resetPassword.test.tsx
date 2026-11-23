import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import { codeDigits, resetFailure } from "../src/account/resetPasswordModel";
import { api } from "../src/api/client";
import { ApiError } from "../src/api/errors";
import RecoverCode from "../src/screens/auth/RecoverCode";
import RecoverPassword from "../src/screens/auth/RecoverPassword";
import ResetPassword from "../src/screens/auth/ResetPassword";
import { ToastHost, hideToast } from "../src/components/ui/toast";

const mockNavigate = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, goBack: jest.fn() } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  // HeaderBack reads its navigator's state (hides the arrow on a screen that is first in its stack); there is no navigator here.
  useNavigationState: (select: (state: { index: number }) => unknown) => select({ index: 1 }),
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

const route = { params: { email: EMAIL, code: "13579" } } as never;
const renderReset = () =>
  renderWith(
    <>
      <ResetPassword navigation={{} as never} route={route} />
      <ToastHost />
    </>,
  );
const setPasswords = async (next: string, confirm = next) => {
  const fields = screen.getAllByPlaceholderText("Enter New Password");
  await fireEvent.changeText(fields[0], next);
  await fireEvent.changeText(fields[1], confirm);
};
/** The heading and the button share a title; the button is the last one on the screen. */
const press = () => fireEvent.press(screen.getAllByText("Reset Password").at(-1) as never);
afterEach(() => hideToast());

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

describe("Recover password screen (Figma: Recover Password)", () => {
  it("has the Figma subtitle and button, asks for a code, and moves to the code screen with the same email without saying whether the account exists", async () => {
    post.mockResolvedValue(ok({ message: "Password recovery email sent" }));
    await renderWith(<RecoverPassword />);
    expect(screen.getByText("Provide your email address to recover your password")).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText("Provide your Email Address"), ` ${EMAIL} `);
    await fireEvent.press(screen.getByText("Send Recovery Link"));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("RecoverCode", { email: EMAIL }));
    expect(post).toHaveBeenCalledWith("/api/v1/auth/password-recovery", { body: { email: EMAIL } });
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

describe("Recover code screen (Figma: Verify Email Address)", () => {
  const renderCode = (cleared?: number) =>
    renderWith(<RecoverCode navigation={{} as never} route={{ params: { email: EMAIL, cleared } } as never} />);
  const typeCode = async (digits: string) => {
    let index = 0;
    for (const digit of digits) await fireEvent.changeText(screen.getByTestId(`otp-box-${index++}`), digit);
  };

  it("has the Figma wording, and the fifth digit hands the code to Reset Password without calling the server", async () => {
    await renderCode();
    expect(screen.getByText("Verify Email Address")).toBeTruthy();
    expect(screen.getByText(`Enter the OTP code sent to your mail, ${EMAIL}`)).toBeTruthy();
    expect(screen.getByText("Didn't receive a code ?")).toBeTruthy();
    await typeCode("13579");
    expect(mockNavigate).toHaveBeenCalledWith("ResetPassword", { email: EMAIL, code: "13579" });
    // The server checks the code together with the new password, so nothing is sent here.
    expect(post).not.toHaveBeenCalled();
  });

  it("clears the boxes when a wrong code sends the caregiver back", async () => {
    const view = await renderCode(1);
    await typeCode("1357");
    expect(screen.getAllByDisplayValue(/^\d$/)).toHaveLength(4);
    await view.rerender(
      <QueryClientProvider client={clients[0]}>
        <RecoverCode navigation={{} as never} route={{ params: { email: EMAIL, cleared: 2 } } as never} />
      </QueryClientProvider>,
    );
    expect(screen.queryAllByDisplayValue(/^\d$/)).toHaveLength(0);
  });

  it("Resend Code is closed for a minute, then asks for a new code for the same email and says to use the newest", async () => {
    jest.useFakeTimers();
    post.mockResolvedValue(ok({ message: "Password recovery email sent" }));
    await renderCode();
    expect(screen.getByText("Resend Code (60s)")).toBeTruthy();
    // The countdown re-arms a one-second timer after every render, so it is ticked one second at a time.
    for (let second = 0; second < 60; second += 1) {
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    }
    await fireEvent.press(screen.getByText("Resend Code"));
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith("Check your email", expect.stringContaining("Use the newest email and check your spam folder.")),
    );
    expect(post).toHaveBeenCalledWith("/api/v1/auth/password-recovery", { body: { email: EMAIL } });
    expect(screen.getByText("Resend Code (60s)")).toBeTruthy();
  });
});

describe("Reset password screen (Figma: Reset Password)", () => {
  it("has the Figma heading, subtitle and two password fields, and no code field", async () => {
    await renderReset();
    expect(screen.getAllByText("Reset Password").length).toBe(2);
    expect(screen.getByText("Reset your Password")).toBeTruthy();
    expect(screen.getByText("Create New Password")).toBeTruthy();
    expect(screen.getByText("Confirm New Password")).toBeTruthy();
    expect(screen.queryByPlaceholderText("5-digit code")).toBeNull();
  });

  it("checks the form before it calls the server", async () => {
    await renderReset();
    await press();
    expect(screen.getByText("Password is required")).toBeTruthy();
    expect(screen.getByText("Please confirm your password")).toBeTruthy();

    await setPasswords("short1");
    await press();
    expect(screen.getAllByText("Password must be at least 8 characters.").length).toBeGreaterThan(0);

    await setPasswords(NEW, "Different-Pass-1");
    await press();
    expect(screen.getByText("Passwords do not match")).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it("sends {email, code, new_password}, shows the green 'Password has been Reset Successfully' toast, then goes to Login", async () => {
    post.mockResolvedValue(ok({ message: "Password updated successfully" }));
    await renderReset();
    await setPasswords(NEW);
    await press();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("Login"));
    expect(post).toHaveBeenCalledWith("/api/v1/auth/reset-password", { body: { email: EMAIL, code: "13579", new_password: NEW } });
    expect(await screen.findByText("Password has been Reset Successfully")).toBeTruthy();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("a wrong or expired code says so and sends the caregiver back to the code screen to enter a new one", async () => {
    post.mockResolvedValue(refuse(400, "invalid_or_expired_code"));
    await renderReset();
    await setPasswords(NEW);
    await press();
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Error", "That code isn't right or has expired. Request a new one."));
    expect(mockNavigate).toHaveBeenCalledWith("RecoverCode", { email: EMAIL, cleared: expect.any(Number) });
  });

  it("a weak password goes under the password, in the server's words, and the caregiver stays here", async () => {
    post.mockResolvedValue(refuse(400, "weak_password", "Password is too repetitive."));
    await renderReset();
    await setPasswords("aaaaabbbbb");
    await press();
    expect(await screen.findByText("Password is too repetitive.")).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("five wrong codes (429, no Retry-After) ask for a new code on the code screen", async () => {
    post.mockResolvedValue(refuse(429, "too_many_attempts"));
    await renderReset();
    await setPasswords(NEW);
    await press();
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Error", "Too many tries. Request a new code."));
    expect(mockNavigate).toHaveBeenCalledWith("RecoverCode", { email: EMAIL, cleared: expect.any(Number) });
  });

  it("the 24-hour budget (429 with Retry-After) says when to come back", async () => {
    post.mockResolvedValue(refuse(429, "too_many_attempts", "Please try again later.", { "Retry-After": "3600" }));
    await renderReset();
    await setPasswords(NEW);
    await press();
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Error", "Too many tries. Try again in 60 minutes."));
  });

  it("anything else (offline) is an alert in plain words and keeps the caregiver here", async () => {
    post.mockRejectedValue(new TypeError("Network request failed"));
    await renderReset();
    await setPasswords(NEW);
    await press();
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Error", expect.stringContaining("Can't reach Oakly")));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
