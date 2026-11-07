import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";

import { queryClient } from "../src/api/queryClient";
import { disableCacheGcForTests, keychainKeys, patientUser, routeFetch, tokens } from "../test-utils/fakeApi";
import { renderSignedOut, renderUnverified } from "../test-utils/renderApp";

jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));

const press = (name: string) => fireEvent.press(screen.getByRole("button", { name }));
const type = (label: string, value: string) => fireEvent.changeText(screen.getByLabelText(label), value);

async function fillRegistration(email = "new.person@example.com") {
  await type("Full name", "New Person");
  await type("Email address", email);
  await type("Create password", "placeholder-pass");
  await fireEvent.press(screen.getByRole("checkbox"));
  await press("Create Account");
}

describe("auth flows", () => {
  beforeAll(() => disableCacheGcForTests(queryClient));
  afterAll(() => queryClient.clear());

  describe("register", () => {
    it("checks the form before calling the server", async () => {
      const { calls, view } = await renderSignedOut();
      await press("Create account");
      await press("Create Account");
      expect(await screen.findByText("Full name is required")).toBeTruthy();
      expect(screen.getByText("Email is required")).toBeTruthy();
      expect(screen.getByText("Password is required")).toBeTruthy();
      expect(screen.getByText("Please accept the terms to continue")).toBeTruthy();
      await type("Email address", "not-an-email");
      await type("Create password", "short");
      await press("Create Account");
      expect(await screen.findByText("Enter a valid email address")).toBeTruthy();
      expect(screen.getByText("Password must be at least 8 characters")).toBeTruthy();
      expect(calls).toHaveLength(0);
      view.unmount();
    });

    it("registers a patient (email only) and moves on to the 5-digit code step", async () => {
      const { calls, view } = await renderSignedOut({
        "POST /api/v1/auth/register": () => ({ status: 200, body: { ...patientUser, is_verified: false } }),
      });
      await press("Create account");
      await fillRegistration();
      expect(await screen.findByText("Enter the 5-digit code we sent to new.person@example.com")).toBeTruthy();
      expect(calls[0]).toMatchObject({
        method: "POST",
        path: "/api/v1/auth/register",
        body: { email: "new.person@example.com", password: "placeholder-pass", full_name: "New Person", user_type: "patient" },
      });
      expect(keychainKeys()).toEqual([]);
      view.unmount();
    });

    it("shows the backend's own words for a duplicate email (400)", async () => {
      const { view } = await renderSignedOut({
        "POST /api/v1/auth/register": () => ({ status: 400, body: { detail: "A user with this email already exists" } }),
      });
      await press("Create account");
      await fillRegistration("taken@example.com");
      expect(await screen.findByText("A user with this email already exists")).toBeTruthy();
      view.unmount();
    });

    it("shows the backend's validation message for a 422", async () => {
      const { view } = await renderSignedOut({
        "POST /api/v1/auth/register": () => ({
          status: 422,
          body: { detail: [{ type: "value_error", loc: ["body", "email"], msg: "value is not a valid email address" }] },
        }),
      });
      await press("Create account");
      await fillRegistration();
      expect(await screen.findByText("value is not a valid email address")).toBeTruthy();
      view.unmount();
    });
  });

  describe("verify email", () => {
    it("takes the code, then 'account created', then Login", async () => {
      const { calls, view } = await renderSignedOut({
        "POST /api/v1/auth/register": () => ({ status: 200, body: { ...patientUser, is_verified: false } }),
        "POST /api/v1/auth/verify-email": () => ({ status: 200, body: { message: "Email verified successfully" } }),
      });
      await press("Create account");
      await fillRegistration();
      await screen.findByText("Enter the 5-digit code we sent to new.person@example.com");
      // Resend is closed for the first 30 seconds after a code was sent.
      expect(screen.getByRole("button", { name: "Resend code (30s)" })).toBeDisabled();

      await type("Verification code", "12345");
      expect(await screen.findByText("Congratulations!")).toBeTruthy();
      expect(calls.find((c) => c.path === "/api/v1/auth/verify-email")?.body).toEqual({
        email: "new.person@example.com",
        code: "12345",
      });
      await press("Log in to continue");
      expect(await screen.findByText("Sign in to your Oakly Health account")).toBeTruthy();
      view.unmount();
    });

    it("ignores letters and extra digits in the code", async () => {
      const { calls, view } = await renderSignedOut({
        "POST /api/v1/auth/register": () => ({ status: 200, body: patientUser }),
        "POST /api/v1/auth/verify-email": () => ({ status: 400, body: { detail: "Invalid verification code" } }),
      });
      await press("Create account");
      await fillRegistration();
      await screen.findByText("Enter the 5-digit code we sent to new.person@example.com");
      await type("Verification code", "1a2b3c4d5e6f");
      await waitFor(() => expect(calls.find((c) => c.path === "/api/v1/auth/verify-email")?.body).toMatchObject({ code: "12345" }));
      view.unmount();
    });

    it("shows the server's 400 for a wrong or expired code and clears the boxes", async () => {
      const { view } = await renderSignedOut({
        "POST /api/v1/auth/register": () => ({ status: 200, body: patientUser }),
        "POST /api/v1/auth/verify-email": () => ({ status: 400, body: { detail: "Invalid verification code" } }),
      });
      await press("Create account");
      await fillRegistration();
      await screen.findByText("Enter the 5-digit code we sent to new.person@example.com");
      await type("Verification code", "00000");
      expect(await screen.findByText("Invalid verification code")).toBeTruthy();
      expect(screen.getByLabelText("Verification code").props.value).toBe("");
      expect(screen.queryByText("Congratulations!")).toBeNull();
      view.unmount();
    });

    describe("signed in with an unverified email (resend is open at once)", () => {
      const unverified = { ...patientUser, is_verified: false };
      const openGate = renderUnverified;

      it("resend sends a new code and says so, then waits 30 seconds", async () => {
        const { calls, view } = await openGate({
          "POST /api/v1/auth/resend-verification": () => ({ status: 200, body: { message: "Verification code sent" } }),
        });
        await press("Resend code");
        expect(await screen.findByText("A new code has been sent to ada.placeholder@example.com.")).toBeTruthy();
        expect(calls.find((c) => c.path === "/api/v1/auth/resend-verification")?.body).toEqual({ email: "ada.placeholder@example.com" });
        expect(screen.getByRole("button", { name: "Resend code (30s)" })).toBeDisabled();
        view.unmount();
      });

      it("shows the wait the server asks for on a 429 (Retry-After)", async () => {
        const { view } = await openGate({
          "POST /api/v1/auth/resend-verification": () => ({
            status: 429,
            body: { detail: "Too many requests" },
            headers: { "Retry-After": "45" },
          }),
        });
        await press("Resend code");
        expect(await screen.findByText("Too many attempts. Please try again in 45 seconds.")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Resend code (45s)" })).toBeDisabled();
        view.unmount();
      });

      it("shows 'already verified' (400) as the server words it", async () => {
        const { view } = await openGate({
          "POST /api/v1/auth/resend-verification": () => ({ status: 400, body: { detail: "Email already verified" } }),
        });
        await press("Resend code");
        expect(await screen.findByText("Email already verified")).toBeTruthy();
        view.unmount();
      });

      it("a right code re-reads /auth/me and lets the person into the app", async () => {
        let verified = false;
        const { view } = await openGate({
          "GET /api/v1/auth/me": () => ({ status: 200, body: verified ? patientUser : unverified }),
          "POST /api/v1/auth/verify-email": () => {
            verified = true;
            return { status: 200, body: { message: "Email verified successfully" } };
          },
        });
        await type("Verification code", "54321");
        expect(await screen.findByText("Hello, Ada")).toBeTruthy();
        view.unmount();
      });
    });
  });

  describe("forgot and reset password", () => {
    it("asks for the email, always moves on (the server answers 200 for any address), and shows the 5-box reset step", async () => {
      const { calls, view } = await renderSignedOut({
        "POST /api/v1/auth/password-recovery": () => ({ status: 200, body: { message: "Password recovery email sent" } }),
      });
      await press("Forgot password?");
      await press("Send Reset Code");
      expect(await screen.findByText("Email is required")).toBeTruthy();
      await type("Email address", "nobody@example.com");
      await press("Send Reset Code");
      expect(await screen.findByText(/Enter the 5-digit code we emailed to nobody@example.com/)).toBeTruthy();
      expect(calls.find((c) => c.path === "/api/v1/auth/password-recovery")?.body).toEqual({ email: "nobody@example.com" });
      view.unmount();
    });

    /** Signed-out journey to the reset step, with the given reset-password reply. */
    async function openResetStep(reply: () => { status: number; body?: unknown; headers?: Record<string, string> }) {
      const rig = await renderSignedOut({
        "POST /api/v1/auth/password-recovery": () => ({ status: 200, body: { message: "Password recovery email sent" } }),
        "POST /api/v1/auth/reset-password": reply,
      });
      await press("Forgot password?");
      await type("Email address", " ada.placeholder@example.com ");
      await press("Send Reset Code");
      await screen.findByText(/Enter the 5-digit code we emailed to/);
      return rig;
    }
    const fillReset = async (code = "13579", password = "a-new-password") => {
      await type("Reset code", code);
      await type("Create new password", password);
      await type("Confirm new password", password);
      await press("Reset Password");
    };
    const coded = (status: number, code: string, message: string, headers?: Record<string, string>) => () => ({
      status,
      body: { detail: { code, message } },
      headers,
    });

    it("reset: checks the code and passwords, sends {email, code, new_password}, then back to Login", async () => {
      const { calls, view } = await openResetStep(() => ({ status: 200, body: { message: "Password updated successfully" } }));

      await press("Reset Password");
      expect(await screen.findByText("Enter the 5-digit code")).toBeTruthy();
      expect(screen.getByText("Password is required")).toBeTruthy();
      expect(screen.getByText("Please confirm your password")).toBeTruthy();

      await type("Reset code", "13579");
      await type("Create new password", "a-new-password");
      await type("Confirm new password", "different-password");
      await press("Reset Password");
      expect(await screen.findByText("Passwords do not match")).toBeTruthy();
      expect(calls.some((c) => c.path === "/api/v1/auth/reset-password")).toBe(false);

      await type("Confirm new password", "a-new-password");
      await press("Reset Password");
      expect(await screen.findByText("Your password has been reset. Log in with your new password.")).toBeTruthy();
      expect(screen.getByText("You've been signed out on your other devices.")).toBeTruthy();
      // The email is the trimmed string the code was requested with; no `token` field exists any more.
      expect(calls.find((c) => c.path === "/api/v1/auth/password-recovery")?.body).toEqual({ email: "ada.placeholder@example.com" });
      expect(calls.find((c) => c.path === "/api/v1/auth/reset-password")?.body).toEqual({
        email: "ada.placeholder@example.com",
        code: "13579",
        new_password: "a-new-password",
      });
      await press("Go to Login");
      expect(await screen.findByText("Sign in to your Oakly Health account")).toBeTruthy();
      view.unmount();
    });

    it("reset: a wrong or expired code (400 invalid_or_expired_code) says so under the boxes, clears them and keeps Resend", async () => {
      const { view } = await openResetStep(
        coded(400, "invalid_or_expired_code", "This code is incorrect or has expired. Request a new code."),
      );
      await fillReset();
      expect(await screen.findByText("That code isn't right or has expired. Request a new one.")).toBeTruthy();
      expect(screen.getByLabelText("Reset code").props.value).toBe("");
      expect(screen.getByRole("button", { name: /^Resend code/ })).toBeTruthy();
      view.unmount();
    });

    it("reset: a weak password (400 weak_password) shows the server's sentence under the password and keeps the code", async () => {
      const { view } = await openResetStep(coded(400, "weak_password", "Password is too repetitive."));
      await fillReset("13579", "aaaaaaaaaa");
      expect(await screen.findByText("Password is too repetitive.")).toBeTruthy();
      expect(screen.getByLabelText("Reset code").props.value).toBe("13579");
      view.unmount();
    });

    it("reset: five wrong codes (429 too_many_attempts) ask for a new code and keep Resend", async () => {
      const { view } = await openResetStep(coded(429, "too_many_attempts", "Too many incorrect attempts. Request a new code."));
      await fillReset();
      expect(await screen.findByText("Too many tries. Request a new code.")).toBeTruthy();
      expect(screen.getByRole("button", { name: /^Resend code/ })).toBeTruthy();
      view.unmount();
    });

    it("reset: the 24-hour budget (429 with Retry-After) says when to come back and hides Resend", async () => {
      const { view } = await openResetStep(
        coded(429, "too_many_attempts", "Please try again later.", { "Retry-After": "3600" }),
      );
      await fillReset();
      expect(await screen.findByText("Too many tries. Try again in 60 minutes.")).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^Resend code/ })).toBeNull();
      expect(screen.getByRole("button", { name: "Reset Password" })).toBeDisabled();
      view.unmount();
    });

    it("reset: a server failure is shown as a plain sentence, never the raw body", async () => {
      const { view } = await openResetStep(() => ({ status: 500, body: { detail: "boom" } }));
      await fillReset();
      expect(await screen.findByText("Something went wrong on our side. Please try again in a moment.")).toBeTruthy();
      view.unmount();
    });

    it("reset: Resend code is closed for a minute, then asks for a new code with the same email and says to use the newest", async () => {
      jest.useFakeTimers();
      try {
        const { calls, view } = await openResetStep(() => ({ status: 200, body: {} }));
        expect(screen.getByRole("button", { name: "Resend code (60s)" })).toBeDisabled();
        // The countdown re-arms a one-second timer after every render, so it is ticked one second at a time.
        for (let second = 0; second < 60; second += 1) {
          await act(async () => {
            jest.advanceTimersByTime(1000);
          });
        }
        await press("Resend code");
        expect(await screen.findByText(/we've sent a new code\. Use the newest email and check your spam folder\./)).toBeTruthy();
        const recoveries = calls.filter((c) => c.path === "/api/v1/auth/password-recovery");
        expect(recoveries.map((c) => c.body)).toEqual([{ email: "ada.placeholder@example.com" }, { email: "ada.placeholder@example.com" }]);
        expect(screen.getByRole("button", { name: "Resend code (60s)" })).toBeDisabled();
        view.unmount();
      } finally {
        jest.useRealTimers();
      }
    });

    it("recovery: shows a network failure instead of moving on", async () => {
      // React Native's fetch reports a request that never completed as `TypeError: Network request failed`.
      const { view } = await renderSignedOut({
        "POST /api/v1/auth/password-recovery": () => {
          throw new TypeError("Network request failed");
        },
      });
      await press("Forgot password?");
      await type("Email address", "ada.placeholder@example.com");
      await press("Send Reset Code");
      expect(await screen.findByText("Can't reach Oakly. Check your internet connection and try again.")).toBeTruthy();
      view.unmount();
    });
  });

  describe("log in with the keyboard", () => {
    it("the keyboard's Go key on the password field logs in, like the Login button (which can sit under the keyboard)", async () => {
      const { calls, view } = await renderSignedOut({
        "POST /api/v1/auth/login/mobile": () => ({ status: 401, body: { detail: "Incorrect email or password" } }),
      });
      await type("Email address", "ada.placeholder@example.com");
      await type("Password", "placeholder-password");
      const password = screen.getByLabelText("Password");
      expect(password.props.returnKeyType).toBe("go");
      fireEvent(password, "submitEditing");
      expect(await screen.findByText("Incorrect email or password.")).toBeTruthy();
      expect(calls.filter((c) => c.path === "/api/v1/auth/login/mobile")).toHaveLength(1);
      view.unmount();
    });

    it("Go with an empty password asks for it and does not call the server", async () => {
      const { calls, view } = await renderSignedOut();
      await type("Email address", "ada.placeholder@example.com");
      fireEvent(screen.getByLabelText("Password"), "submitEditing");
      expect(await screen.findByText("Password is required")).toBeTruthy();
      expect(calls).toHaveLength(0);
      view.unmount();
    });
  });

  describe("sign-in with an unverified account", () => {
    it("lands on the verify step, not the app", async () => {
      const { view } = await renderSignedOut({
        "POST /api/v1/auth/login/mobile": () => ({ status: 200, body: tokens }),
        "GET /api/v1/auth/me": () => ({ status: 200, body: { ...patientUser, is_verified: false } }),
      });
      await type("Email address", "ada.placeholder@example.com");
      await type("Password", "placeholder-password");
      await press("Login");
      expect(await screen.findByText(/Enter the 5-digit code we sent to ada.placeholder@example.com/)).toBeTruthy();
      view.unmount();
    });
  });

});
