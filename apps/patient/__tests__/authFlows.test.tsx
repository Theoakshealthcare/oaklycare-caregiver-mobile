import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";

import { queryClient } from "../src/api/queryClient";
import { hideToast } from "../src/components/ui/toast";
import { liveReply } from "../test-utils/live";
import { disableCacheGcForTests, keychainKeys, patientUser, routeFetch, tokens } from "../test-utils/fakeApi";
import { openCreateAccount, renderSignedOut, renderUnverified } from "../test-utils/renderApp";

jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));

const press = (name: string) => fireEvent.press(screen.getByRole("button", { name }));
const type = (label: string, value: string) => fireEvent.changeText(screen.getByLabelText(label), value);

async function fillRegistration(email = "new.person@example.com") {
  await type("Full Name", "New Person");
  await type("Email Address", email);
  await type("Create Password", "placeholder-pass");
  await fireEvent.press(screen.getByRole("checkbox"));
  await press("Create Account");
}

describe("auth flows", () => {
  beforeAll(() => disableCacheGcForTests(queryClient));
  afterAll(() => queryClient.clear());
  // The toast host is one global store: a toast from one test must not be on screen in the next.
  afterEach(() => hideToast());

  describe("register", () => {
    it("checks the form before calling the server", async () => {
      const { calls, view } = await renderSignedOut();
      await openCreateAccount();
      await press("Create Account");
      expect(await screen.findByText("Full name is required")).toBeTruthy();
      expect(screen.getByText("Email is required")).toBeTruthy();
      expect(screen.getByText("Password is required")).toBeTruthy();
      expect(screen.getByText("Please accept the terms to continue")).toBeTruthy();
      await type("Email Address", "not-an-email");
      await type("Create Password", "short");
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
      await openCreateAccount();
      await fillRegistration();
      expect(await screen.findByText("Enter the OTP code sent to your mail, new.person@example.com.")).toBeTruthy();
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
      await openCreateAccount();
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
      await openCreateAccount();
      await fillRegistration();
      expect(await screen.findByText("value is not a valid email address")).toBeTruthy();
      view.unmount();
    });
  });

  describe("verify email", () => {
    it("takes the code, then 'account created', then Start Booking Journey signs in and opens the booking form", async () => {
      const { calls, view } = await renderSignedOut({
        "POST /api/v1/auth/register": () => ({ status: 200, body: { ...patientUser, is_verified: false } }),
        "POST /api/v1/auth/verify-email": () => ({ status: 200, body: { message: "Email verified successfully" } }),
        "POST /api/v1/auth/login/mobile": () => ({ status: 200, body: tokens }),
        "GET /api/v1/auth/me": () => ({ status: 200, body: patientUser }),
        "GET /api/v1/booking/patient/bookings": () => ({ status: 200, body: [] }),
        "GET /api/v1/patient/notifications": () => liveReply("feed-empty"),
      });
      await openCreateAccount();
      await fillRegistration();
      await screen.findByText("Enter the OTP code sent to your mail, new.person@example.com.");
      // Resend is closed for the first 30 seconds after a code was sent.
      expect(screen.getByRole("button", { name: "Resend Code (30s)" })).toBeDisabled();

      await type("Verification code", "12345");
      expect(await screen.findByText("Congratulations! Your account setup is complete!")).toBeTruthy();
      expect(calls.find((c) => c.path === "/api/v1/auth/verify-email")?.body).toEqual({
        email: "new.person@example.com",
        code: "12345",
      });
      // The password typed on the sign-up form signs the person in; Home then opens the booking form.
      await press("Start Booking Journey");
      expect(await screen.findByText("Book an Appointment")).toBeTruthy();
      expect(calls.find((c) => c.path === "/api/v1/auth/login/mobile")?.body).toEqual({
        email_or_phone: "new.person@example.com",
        password: "placeholder-pass",
      });
      view.unmount();
    });

    it("Start Booking Journey falls back to Login when the sign-in fails", async () => {
      const { view } = await renderSignedOut({
        "POST /api/v1/auth/register": () => ({ status: 200, body: { ...patientUser, is_verified: false } }),
        "POST /api/v1/auth/verify-email": () => ({ status: 200, body: { message: "Email verified successfully" } }),
        "POST /api/v1/auth/login/mobile": () => ({ status: 401, body: { detail: "Incorrect email or password" } }),
      });
      await openCreateAccount();
      await fillRegistration();
      await type("Verification code", "12345");
      await press("Start Booking Journey");
      expect(await screen.findByLabelText("Input Password")).toBeTruthy();
      view.unmount();
    });

    it("ignores letters and extra digits in the code", async () => {
      const { calls, view } = await renderSignedOut({
        "POST /api/v1/auth/register": () => ({ status: 200, body: patientUser }),
        "POST /api/v1/auth/verify-email": () => ({ status: 400, body: { detail: "Invalid verification code" } }),
      });
      await openCreateAccount();
      await fillRegistration();
      await screen.findByText("Enter the OTP code sent to your mail, new.person@example.com.");
      await type("Verification code", "1a2b3c4d5e6f");
      await waitFor(() => expect(calls.find((c) => c.path === "/api/v1/auth/verify-email")?.body).toMatchObject({ code: "12345" }));
      view.unmount();
    });

    it("shows the server's 400 for a wrong or expired code and clears the boxes", async () => {
      const { view } = await renderSignedOut({
        "POST /api/v1/auth/register": () => ({ status: 200, body: patientUser }),
        "POST /api/v1/auth/verify-email": () => ({ status: 400, body: { detail: "Invalid verification code" } }),
      });
      await openCreateAccount();
      await fillRegistration();
      await screen.findByText("Enter the OTP code sent to your mail, new.person@example.com.");
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
        await press("Resend Code");
        expect(await screen.findByText("A new code has been sent to ada.placeholder@example.com.")).toBeTruthy();
        expect(calls.find((c) => c.path === "/api/v1/auth/resend-verification")?.body).toEqual({ email: "ada.placeholder@example.com" });
        expect(screen.getByRole("button", { name: "Resend Code (30s)" })).toBeDisabled();
        view.unmount();
      });

      it("shows 'Sending code...' while the server has not answered, then says the code was sent", async () => {
        let answer!: () => void;
        const slow = new Promise<{ status: number; body: unknown }>((resolve) => {
          answer = () => resolve({ status: 200, body: { message: "Verification code sent" } });
        });
        const { view } = await openGate({ "POST /api/v1/auth/resend-verification": () => slow });
        await press("Resend Code");
        expect(await screen.findByRole("button", { name: "Sending code..." })).toBeDisabled();
        await act(async () => answer());
        expect(await screen.findByText("A new code has been sent to ada.placeholder@example.com.")).toBeTruthy();
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
        await press("Resend Code");
        expect(await screen.findByText("Too many attempts. Please try again in 45 seconds.")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Resend Code (45s)" })).toBeDisabled();
        view.unmount();
      });

      it("shows 'already verified' (400) as the server words it", async () => {
        const { view } = await openGate({
          "POST /api/v1/auth/resend-verification": () => ({ status: 400, body: { detail: "Email already verified" } }),
        });
        await press("Resend Code");
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
        expect(await screen.findByText(/Hello Ada,/)).toBeTruthy();
        view.unmount();
      });
    });
  });

  describe("forgot and reset password", () => {
    it("asks for the email, always moves on (the server answers 200 for any address), and shows the 5-box code step", async () => {
      const { calls, view } = await renderSignedOut({
        "POST /api/v1/auth/password-recovery": () => ({ status: 200, body: { message: "Password recovery email sent" } }),
      });
      await press("Forgot Password");
      await press("Send Recovery Link");
      expect(await screen.findByText("Email is required")).toBeTruthy();
      await type("Email Address", "nobody@example.com");
      await press("Send Recovery Link");
      expect(await screen.findByText(/Enter the OTP code sent to your mail, nobody@example.com/)).toBeTruthy();
      expect(screen.getByLabelText("Reset code")).toBeTruthy();
      expect(calls.find((c) => c.path === "/api/v1/auth/password-recovery")?.body).toEqual({ email: "nobody@example.com" });
      view.unmount();
    });

    /** Signed-out journey to the code step, with the given reset-password reply. */
    async function openCodeStep(reply: () => { status: number; body?: unknown; headers?: Record<string, string> }) {
      const rig = await renderSignedOut({
        "POST /api/v1/auth/password-recovery": () => ({ status: 200, body: { message: "Password recovery email sent" } }),
        "POST /api/v1/auth/reset-password": reply,
      });
      await press("Forgot Password");
      await type("Email Address", " ada.placeholder@example.com ");
      await press("Send Recovery Link");
      await screen.findByText(/Enter the OTP code sent to your mail/);
      return rig;
    }
    /** The five digits are collected on the code screen; the server only checks them together with the new password. */
    const enterCode = async (code = "13579") => {
      await type("Reset code", code);
      await screen.findByLabelText("Create New Password");
    };
    const fillPasswords = async (password = "a-new-password") => {
      await type("Create New Password", password);
      await type("Confirm New Password", password);
      await press("Reset Password");
    };
    const coded = (status: number, code: string, message: string, headers?: Record<string, string>) => () => ({
      status,
      body: { detail: { code, message } },
      headers,
    });

    it("reset: the code screen hands the code on, the passwords are checked, {email, code, new_password} is sent, then Login with a toast", async () => {
      const { calls, view } = await openCodeStep(() => ({ status: 200, body: { message: "Password updated successfully" } }));
      await enterCode();

      await press("Reset Password");
      expect(await screen.findByText("Password is required")).toBeTruthy();
      expect(screen.getByText("Please confirm your password")).toBeTruthy();

      await type("Create New Password", "a-new-password");
      await type("Confirm New Password", "different-password");
      await press("Reset Password");
      expect(await screen.findByText("Passwords do not match")).toBeTruthy();
      expect(calls.some((c) => c.path === "/api/v1/auth/reset-password")).toBe(false);

      await type("Confirm New Password", "a-new-password");
      await press("Reset Password");
      expect(await screen.findByLabelText("Input Password")).toBeTruthy();
      expect(await screen.findByText("Password has been Reset Successfully")).toBeTruthy();
      // The email is the trimmed string the code was requested with; no `token` field exists any more.
      expect(calls.find((c) => c.path === "/api/v1/auth/password-recovery")?.body).toEqual({ email: "ada.placeholder@example.com" });
      expect(calls.find((c) => c.path === "/api/v1/auth/reset-password")?.body).toEqual({
        email: "ada.placeholder@example.com",
        code: "13579",
        new_password: "a-new-password",
      });
      view.unmount();
    });

    it("reset: a wrong or expired code (400 invalid_or_expired_code) says so, goes back to the code screen with empty boxes and keeps Resend", async () => {
      const { view } = await openCodeStep(
        coded(400, "invalid_or_expired_code", "This code is incorrect or has expired. Request a new code."),
      );
      await enterCode();
      await fillPasswords();
      expect(await screen.findByText("That code isn't right or has expired. Request a new one.")).toBeTruthy();
      expect(screen.getByLabelText("Reset code").props.value).toBe("");
      expect(screen.getByRole("button", { name: /^Resend Code/ })).toBeTruthy();
      view.unmount();
    });

    it("reset: a weak password (400 weak_password) shows the server's sentence under the password and stays on the reset screen", async () => {
      const { view } = await openCodeStep(coded(400, "weak_password", "Password is too repetitive."));
      await enterCode();
      await fillPasswords("aaaaaaaaaa");
      expect(await screen.findByText("Password is too repetitive.")).toBeTruthy();
      expect(screen.getByLabelText("Create New Password")).toBeTruthy();
      view.unmount();
    });

    it("reset: five wrong codes (429 too_many_attempts) ask for a new code and keep Resend", async () => {
      const { view } = await openCodeStep(coded(429, "too_many_attempts", "Too many incorrect attempts. Request a new code."));
      await enterCode();
      await fillPasswords();
      expect(await screen.findByText("Too many tries. Request a new code.")).toBeTruthy();
      expect(screen.getByRole("button", { name: /^Resend Code/ })).toBeTruthy();
      view.unmount();
    });

    it("reset: the 24-hour budget (429 with Retry-After) says when to come back", async () => {
      const { view } = await openCodeStep(
        coded(429, "too_many_attempts", "Please try again later.", { "Retry-After": "3600" }),
      );
      await enterCode();
      await fillPasswords();
      expect(await screen.findByText("Too many tries. Try again in 60 minutes.")).toBeTruthy();
      view.unmount();
    });

    it("reset: a server failure is shown as a plain sentence, never the raw body", async () => {
      const { view } = await openCodeStep(() => ({ status: 500, body: { detail: "boom" } }));
      await enterCode();
      await fillPasswords();
      expect(await screen.findByText("Something went wrong on our side. Please try again in a moment.")).toBeTruthy();
      view.unmount();
    });

    it("code screen: Resend Code is closed for a minute, then asks for a new code with the same email and says to use the newest", async () => {
      jest.useFakeTimers();
      try {
        const { calls, view } = await openCodeStep(() => ({ status: 200, body: {} }));
        expect(screen.getByRole("button", { name: "Resend Code (60s)" })).toBeDisabled();
        // The countdown re-arms a one-second timer after every render, so it is ticked one second at a time.
        for (let second = 0; second < 60; second += 1) {
          await act(async () => {
            jest.advanceTimersByTime(1000);
          });
        }
        await press("Resend Code");
        expect(await screen.findByText(/we've sent a new code\. Use the newest email and check your spam folder\./)).toBeTruthy();
        const recoveries = calls.filter((c) => c.path === "/api/v1/auth/password-recovery");
        expect(recoveries.map((c) => c.body)).toEqual([{ email: "ada.placeholder@example.com" }, { email: "ada.placeholder@example.com" }]);
        expect(screen.getByRole("button", { name: "Resend Code (60s)" })).toBeDisabled();
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
      await press("Forgot Password");
      await type("Email Address", "ada.placeholder@example.com");
      await press("Send Recovery Link");
      expect(await screen.findByText("Can't reach Oakly. Check your internet connection and try again.")).toBeTruthy();
      view.unmount();
    });
  });

  describe("log in with the keyboard", () => {
    it("the keyboard's Go key on the password field logs in, like the Login button (which can sit under the keyboard)", async () => {
      const { calls, view } = await renderSignedOut({
        "POST /api/v1/auth/login/mobile": () => ({ status: 401, body: { detail: "Incorrect email or password" } }),
      });
      await type("Email Address", "ada.placeholder@example.com");
      await type("Input Password", "placeholder-password");
      const password = screen.getByLabelText("Input Password");
      expect(password.props.returnKeyType).toBe("go");
      fireEvent(password, "submitEditing");
      expect(await screen.findByText("Incorrect email or password.")).toBeTruthy();
      expect(calls.filter((c) => c.path === "/api/v1/auth/login/mobile")).toHaveLength(1);
      view.unmount();
    });

    it("Go with an empty password asks for it and does not call the server", async () => {
      const { calls, view } = await renderSignedOut();
      await type("Email Address", "ada.placeholder@example.com");
      fireEvent(screen.getByLabelText("Input Password"), "submitEditing");
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
      await type("Email Address", "ada.placeholder@example.com");
      await type("Input Password", "placeholder-password");
      await press("Login");
      expect(await screen.findByText(/Enter the OTP code sent to your mail, ada.placeholder@example.com/)).toBeTruthy();
      view.unmount();
    });
  });

});
