import { NavigationContainer } from "@react-navigation/native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert, Text } from "react-native";

import { session } from "../src/auth";
import { forgetPendingSignIn, rememberPendingSignIn } from "../src/auth/pendingSignIn";
import { TOAST_MS, ToastHost, hideToast, showToast } from "../src/components/ui/toast";
import { markSetupSubmitted, resetSetupSubmitted, useSetupSubmitted } from "../src/onboarding/setupSubmitted";
import StackNavigator from "../src/navigation/StackNavigator";
import AccountCreated, { ACCOUNT_CREATED_BODY, ACCOUNT_CREATED_TITLE } from "../src/screens/auth/AccountCreated";
import Login from "../src/screens/auth/Login";
import ConsentScreen from "../src/screens/setup/ConsentScreen";
import OnboardingScreen, { slides } from "../src/screens/onboarding-screen";
import IdentityVerificationView, {
  FACE_SCAN_LABEL,
  FACE_SCAN_PLACEHOLDER,
  SCAN_ID_LABEL,
  SCAN_ID_PLACEHOLDER,
} from "../src/screens/setup/IdentityVerificationView";
import ProfileSetupCompleted, { SETUP_COMPLETED_BODY, SETUP_COMPLETED_TITLE } from "../src/screens/setup/ProfileSetupCompleted";
import { authService } from "../src/services/auth.service";
import { caregiverService } from "../src/services/caregiver.service";
import { renderWithClient } from "../test-utils/carePlanHarness";

const mockNavigate = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, goBack: jest.fn() } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  // Screens that draw HeaderBack read their navigator's state; there is no navigator around them here.
  useNavigationState: (select: (state: { index: number }) => unknown) => select({ index: 1 }),
}));

afterEach(() => {
  hideToast();
  mockNavigate.mockClear();
  jest.restoreAllMocks();
  jest.useRealTimers();
  forgetPendingSignIn();
  resetSetupSubmitted();
});

describe("welcome slides (Figma: Splash Screen 1-4)", () => {
  it("are four, in the Figma words, with the FallGuard slide on the coral panel", () => {
    expect(slides).toHaveLength(4);
    expect(slides.map((s) => `${s.title} ${s.subtitle}`)).toEqual([
      "AI-Powered Personalized Smart Care, Tailored for You.",
      "Remote Monitoring & Real-Time Updates.",
      "Oakly FallGuard™ Fall Predictor– Predict. Prevent. Protect.",
      "On-Demand Nursing Care Book a Nurse Instantly.",
    ]);
    expect(slides[2].backgroundColor).not.toBe(slides[0].backgroundColor);
    expect(slides[1].backgroundColor).toBe(slides[0].backgroundColor);
    expect(slides[3].backgroundColor).toBe(slides[0].backgroundColor);
    expect(slides[3].description).toBe("Reliable, professional home nursing—just a tap away.");
  });

  it("show Get Started on every slide, and every one opens sign-up; Skip does too, and Login opens Login", async () => {
    await render(<OnboardingScreen />);
    expect(screen.getAllByText("Get Started")).toHaveLength(4);
    expect(screen.getAllByText("Skip")).toHaveLength(4);
    await fireEvent.press(screen.getAllByText("Get Started")[1]);
    expect(mockNavigate).toHaveBeenLastCalledWith("CreateAccount");
    await fireEvent.press(screen.getAllByText("Skip")[2]);
    expect(mockNavigate).toHaveBeenLastCalledWith("CreateAccount");
    await fireEvent.press(screen.getAllByText("Login")[0]);
    expect(mockNavigate).toHaveBeenLastCalledWith("Login");
    expect(screen.getAllByText(/Already have an account \?/)).toHaveLength(4);
  });
});

describe("the green toast", () => {
  it("shows the words, then goes away by itself; a newer toast replaces the one on screen", async () => {
    jest.useFakeTimers();
    await render(<ToastHost />);
    expect(screen.queryByTestId("toast")).toBeNull();

    await act(async () => showToast("Email Address Verified"));
    expect(screen.getByText("Email Address Verified")).toBeTruthy();
    await act(async () => showToast("Login Successful"));
    expect(screen.queryByText("Email Address Verified")).toBeNull();
    expect(screen.getByText("Login Successful")).toBeTruthy();

    await act(async () => void jest.advanceTimersByTime(TOAST_MS + 50));
    expect(screen.queryByTestId("toast")).toBeNull();
  });

  it("Login shows 'Login Successful' once the server accepts the password", async () => {
    jest.spyOn(authService, "login").mockResolvedValue({} as never);
    await renderWithClient(
      <>
        <Login />
        <ToastHost />
      </>,
    );
    await fireEvent.changeText(screen.getByPlaceholderText("Provide your Email Address"), "cora.placeholder@example.com");
    await fireEvent.changeText(screen.getByPlaceholderText("Input password"), "Placeholder-Pass-1");
    await fireEvent.press(screen.getAllByText("Login").at(-1) as never);
    expect(await screen.findByText("Login Successful")).toBeTruthy();
    expect(screen.getByText("Forgot Password")).toBeTruthy();
    expect(screen.queryByText("Forget Password")).toBeNull();
  });
});

describe("account created (Figma: the green check frame)", () => {
  it("has the Figma words and no 'Skip, Go to Homepage' (an unapproved caregiver cannot reach the app)", async () => {
    await render(<AccountCreated />);
    expect(screen.getByText(ACCOUNT_CREATED_TITLE)).toBeTruthy();
    expect(screen.getByText(ACCOUNT_CREATED_BODY)).toBeTruthy();
    expect(screen.getByText("Set up your Account")).toBeTruthy();
    expect(screen.getByText("Close")).toBeTruthy();
    expect(screen.queryByText(/Skip, Go to Homepage/)).toBeNull();
  });

  it("'Set up your Account' signs in with the sign-up details so the gate opens the setup, and forgets them", async () => {
    const login = jest.spyOn(authService, "login").mockResolvedValue({} as never);
    rememberPendingSignIn("cora.placeholder@example.com", "Placeholder-Pass-1");
    await render(<AccountCreated />);
    await fireEvent.press(screen.getByText("Set up your Account"));
    await waitFor(() => expect(login).toHaveBeenCalledWith("cora.placeholder@example.com", "Placeholder-Pass-1"));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("without remembered details (app restarted) it opens the Login screen", async () => {
    const login = jest.spyOn(authService, "login").mockResolvedValue({} as never);
    await render(<AccountCreated />);
    await fireEvent.press(screen.getByText("Set up your Account"));
    expect(mockNavigate).toHaveBeenCalledWith("Login");
    expect(login).not.toHaveBeenCalled();
  });

  it("falls back to the Login screen when the automatic sign-in fails", async () => {
    jest.spyOn(authService, "login").mockRejectedValue(new Error("nope"));
    rememberPendingSignIn("cora.placeholder@example.com", "Placeholder-Pass-1");
    await render(<AccountCreated />);
    await fireEvent.press(screen.getByText("Set up your Account"));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("Login"));
  });
});

describe("identity step (Figma: Identity Verification)", () => {
  const onStart = jest.fn();
  const view = (consentChecked: boolean) => (
    <IdentityVerificationView
      screen="intro"
      consentChecked={consentChecked}
      onToggleConsent={() => undefined}
      onStart={onStart}
      onContinue={() => undefined}
      onDefer={() => undefined}
      onReload={() => undefined}
      onCheckAgain={() => undefined}
      onOpenSettings={() => undefined}
      onContactSupport={() => undefined}
    />
  );
  beforeEach(() => onStart.mockClear());

  it("has the header, the step bar, the two rows with fixed spelling, and a grey Save & Continue", async () => {
    await render(view(true));
    expect(screen.getByText("Set up your Account")).toBeTruthy();
    expect(screen.getByTestId("step-label")).toHaveTextContent("Step 3");
    expect(screen.getByText("Identity Verification")).toBeTruthy();
    expect(screen.getByText(SCAN_ID_LABEL)).toBeTruthy();
    expect(screen.getByText(FACE_SCAN_LABEL)).toBeTruthy();
    expect(SCAN_ID_PLACEHOLDER).toBe("National ID, Passport, or Driver’s License");
    expect(FACE_SCAN_PLACEHOLDER).toBe("Turn on your Camera");
    expect(screen.getByText(SCAN_ID_PLACEHOLDER)).toBeTruthy();
    expect(screen.getByText(FACE_SCAN_PLACEHOLDER)).toBeTruthy();
    expect(screen.getByTestId("identity-save")).toBeDisabled();
  });

  it("either row starts the check once the identity consent is ticked, and neither does before", async () => {
    const screenView = await render(view(false));
    await fireEvent.press(screen.getByTestId("identity-start"));
    await fireEvent.press(screen.getByTestId("identity-start-face"));
    expect(onStart).not.toHaveBeenCalled();

    await screenView.rerender(view(true));
    await fireEvent.press(screen.getByTestId("identity-start"));
    await fireEvent.press(screen.getByTestId("identity-start-face"));
    expect(onStart).toHaveBeenCalledTimes(2);
  });
});

describe("Profile Setup Completed (Figma frame, after consent)", () => {
  it("consent raises the success page flag only once the server accepted it", async () => {
    const Probe = () => <Text testID="flag">{String(useSetupSubmitted())}</Text>;
    const consent = jest.spyOn(caregiverService, "updateConsent").mockRejectedValueOnce(new Error("offline")).mockResolvedValue({} as never);
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    await renderWithClient(
      <>
        <ConsentScreen />
        <Probe />
      </>,
    );
    await fireEvent.press(screen.getByText("Give Consent"));
    await waitFor(() => expect(consent).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("flag")).toHaveTextContent("false");

    await fireEvent.press(screen.getByText("Give Consent"));
    await waitFor(() => expect(screen.getByTestId("flag")).toHaveTextContent("true"));
  });

  it("has the Figma words with 'notified' and 'Homepage' spelled right", async () => {
    await render(<ProfileSetupCompleted />);
    expect(SETUP_COMPLETED_TITLE).toBe("Profile Setup Completed");
    expect(SETUP_COMPLETED_BODY).toBe("Your Profile verification is under review, you will be notified in 24hrs.");
    expect(screen.getByText(SETUP_COMPLETED_TITLE)).toBeTruthy();
    expect(screen.getByText(SETUP_COMPLETED_BODY)).toBeTruthy();
    expect(screen.getByText("Go to Homepage")).toBeTruthy();
    expect(screen.queryByText(/Homeoage|uploaded/)).toBeNull();
    expect(screen.getByTestId("success-illustration")).toBeTruthy();
  });

  describe("in the navigator", () => {
    beforeEach(async () => {
      resetSetupSubmitted();
      jest.spyOn(authService, "getMe").mockResolvedValue({
        user_type: "caregiver",
        is_verified: true,
        email: "cora.placeholder@example.com",
      } as never);
      jest.spyOn(caregiverService, "getVerificationStatus").mockResolvedValue({
        profileStatus: "under_review",
        profileCompletionStep: 3,
        identityVerificationStatus: "verified",
        backgroundCheckStatus: "pending",
        rejectionReason: null,
        changesRequested: null,
      });
      await session.signIn({ accessToken: "access", refreshToken: "refresh" });
    });
    afterEach(async () => {
      await session.signOut();
    });

    it("an under-review profile with no fresh submission goes straight to the status screen", async () => {
      await renderWithClient(
        <NavigationContainer>
          <StackNavigator />
        </NavigationContainer>,
      );
      expect(await screen.findByText("Your profile is under review")).toBeTruthy();
      expect(screen.queryByText(SETUP_COMPLETED_TITLE)).toBeNull();
    });

    it("right after consent is submitted the success page shows first, and Go to Homepage opens the status screen", async () => {
      markSetupSubmitted();
      await renderWithClient(
        <NavigationContainer>
          <StackNavigator />
        </NavigationContainer>,
      );
      expect(await screen.findByText(SETUP_COMPLETED_TITLE)).toBeTruthy();
      expect(screen.queryByText("Your profile is under review")).toBeNull();

      await fireEvent.press(screen.getByText("Go to Homepage"));
      expect(await screen.findByText("Your profile is under review")).toBeTruthy();
    });
  });
});
