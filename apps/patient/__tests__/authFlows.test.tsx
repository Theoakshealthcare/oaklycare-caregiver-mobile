import { fireEvent, screen, waitFor } from "@testing-library/react-native";

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
      await press("Send Recovery Email");
      expect(await screen.findByText("Email is required")).toBeTruthy();
      await type("Email address", "nobody@example.com");
      await press("Send Recovery Email");
      expect(await screen.findByText(/Enter the 5-digit code we emailed to nobody@example.com/)).toBeTruthy();
      expect(calls.find((c) => c.path === "/api/v1/auth/password-recovery")?.body).toEqual({ email: "nobody@example.com" });
      view.unmount();
    });

    it("reset: checks the code and passwords, calls today's endpoint with the code as the token, then back to Login", async () => {
      const { calls, view } = await renderSignedOut({
        "POST /api/v1/auth/password-recovery": () => ({ status: 200, body: { message: "Password recovery email sent" } }),
        "POST /api/v1/auth/reset-password": () => ({ status: 200, body: { message: "Password updated successfully" } }),
      });
      await press("Forgot password?");
      await type("Email address", "ada.placeholder@example.com");
      await press("Send Recovery Email");
      await screen.findByText(/Enter the 5-digit code we emailed to/);

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
      // The one adapter: today's endpoint takes `token`, so the 5-digit code goes there until the backend slice lands.
      expect(calls.find((c) => c.path === "/api/v1/auth/reset-password")?.body).toEqual({ token: "13579", new_password: "a-new-password" });
      await press("Go to Login");
      expect(await screen.findByText("Sign in to your Oakly Health account")).toBeTruthy();
      view.unmount();
    });

    it("reset: today's backend refuses a 5-digit code as the token (400 'Invalid token'), shown as sent", async () => {
      const { view } = await renderSignedOut({
        "POST /api/v1/auth/password-recovery": () => ({ status: 200, body: { message: "Password recovery email sent" } }),
        "POST /api/v1/auth/reset-password": () => ({ status: 400, body: { detail: "Invalid token" } }),
      });
      await press("Forgot password?");
      await type("Email address", "ada.placeholder@example.com");
      await press("Send Recovery Email");
      await screen.findByText(/Enter the 5-digit code we emailed to/);
      await type("Reset code", "13579");
      await type("Create new password", "a-new-password");
      await type("Confirm new password", "a-new-password");
      await press("Reset Password");
      expect(await screen.findByText("Invalid token")).toBeTruthy();
      view.unmount();
    });

    it("recovery: shows a network failure instead of moving on", async () => {
      const { view } = await renderSignedOut({});
      await press("Forgot password?");
      await type("Email address", "ada.placeholder@example.com");
      await press("Send Recovery Email");
      expect(await screen.findByText("Can't reach Oakly. Check your internet connection and try again.")).toBeTruthy();
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
