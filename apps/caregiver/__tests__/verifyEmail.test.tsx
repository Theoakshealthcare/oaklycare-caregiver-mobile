import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import { api } from "../src/api/client";
import { NETWORK_MESSAGE } from "../src/api/errors";
import VerifyEmail from "../src/screens/auth/VerifyEmail";

const mockNavigate = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, goBack: jest.fn() } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  useNavigationState: (select: (state: { index: number }) => unknown) => select({ index: 1 }),
}));

// A placeholder address, never a real one.
const EMAIL = "cora.placeholder@example.com";

const clients: QueryClient[] = [];
const views: { unmount: () => void }[] = [];
async function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  const view = await render(
    <QueryClientProvider client={client}>
      <VerifyEmail navigation={{} as never} route={{ params: { email: EMAIL } } as never} />
    </QueryClientProvider>,
  );
  views.push(view);
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const ok = (body: unknown = { message: "ok" }) => ({ data: body, response: json(200, body) });

let post: jest.SpyInstance;
let alertSpy: jest.SpyInstance;
beforeEach(() => {
  jest.useFakeTimers();
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

// The phone's own number pad does the typing: one digit into each box.
const typeCode = async (digits: string) => {
  let index = 0;
  for (const digit of digits) await fireEvent.changeText(screen.getByTestId(`otp-box-${index++}`), digit);
};
/** A call that stays open until the test settles it, like a stalled connection. */
function open<T>() {
  let settle!: (value: T) => void;
  let fail!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { promise, settle, fail };
}

describe("caregiver verify-email screen gives feedback (owner's phone test, 2026-11-23)", () => {
  it("shows Verify as busy from the last digit until the server answers, then moves on", async () => {
    const call = open<unknown>();
    post.mockReturnValue(call.promise);
    await renderScreen();
    // Figma has no Verify button: the fifth digit sends the code by itself.
    expect(screen.queryByText("Verify")).toBeNull();

    await typeCode("12345");
    // A spinner shows while the request is open.
    expect(screen.getByTestId("verify-busy")).toBeTruthy();
    expect(post).toHaveBeenCalledTimes(1);

    await act(async () => call.settle(ok()));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("AccountCreated"));
  });

  it("shows 'Sending code...' while Resend is open and says the code was sent when it ends", async () => {
    const call = open<unknown>();
    post.mockReturnValue(call.promise);
    await renderScreen();
    await act(async () => void jest.advanceTimersByTime(31_000));

    await fireEvent.press(screen.getByText("Resend Code"));
    await waitFor(() => expect(screen.getByText("Sending code...")).toBeTruthy());
    // Pressing again while it is open sends nothing more.
    await fireEvent.press(screen.getByText("Sending code..."));
    expect(post).toHaveBeenCalledTimes(1);

    await act(async () => call.settle(ok()));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Success", expect.stringContaining("new verification code")));
    expect(screen.queryByText("Sending code...")).toBeNull();
  });

  it("a request that never reached the server keeps the code and lets Verify send it again", async () => {
    post.mockRejectedValueOnce(new TypeError("Network request timed out"));
    await renderScreen();
    await typeCode("12345");

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Verification Failed", NETWORK_MESSAGE));
    // The five digits are still in the boxes, and Verify appears and works.
    expect(screen.getAllByDisplayValue(/^[1-5]$/)).toHaveLength(5);
    post.mockResolvedValueOnce(ok());
    await waitFor(() => expect(screen.getByText("Verify")).toBeTruthy());
    await fireEvent.press(screen.getByText("Verify"));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("AccountCreated"));
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("a wrong code is cleared so a new one can be typed", async () => {
    post.mockResolvedValueOnce({ error: { detail: "Invalid verification code" }, response: json(400, { detail: "Invalid verification code" }) });
    await renderScreen();
    await typeCode("12345");

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Verification Failed", expect.any(String)));
    expect(screen.queryAllByDisplayValue(/^[1-5]$/)).toHaveLength(0);
  });
});

describe("verify-email screen follows the Figma frame", () => {
  it("has the heading, the sentence with the address, five boxes, and the resend row with its pill", async () => {
    await renderScreen();
    expect(screen.getByText("Verify Email Address")).toBeTruthy();
    expect(screen.getByText(`Enter the OTP code sent to your mail, ${EMAIL}`)).toBeTruthy();
    expect(screen.getAllByTestId(/^otp-box-/)).toHaveLength(5);
    // Figma's "recieve" typo is fixed; its space before the question mark is kept.
    expect(screen.getByText("Didn't receive a code ?")).toBeTruthy();
    expect(screen.queryByText(/recieve/)).toBeNull();
    expect(screen.getByText(/^Resend Code/)).toBeTruthy();
    // No hand-drawn keypad: the phone's number pad types.
    expect(screen.queryByText("ABC")).toBeNull();
  });

  it("a pasted or auto-filled code spreads over the boxes and verifies", async () => {
    post.mockResolvedValueOnce(ok());
    await renderScreen();
    await fireEvent.changeText(screen.getByTestId("otp-box-0"), "24680");
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][1]).toEqual({ body: { email: EMAIL, code: "24680" } });
  });
});
