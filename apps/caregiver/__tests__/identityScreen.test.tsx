import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Linking } from "react-native";

import { ApiError } from "../src/api/errors";
import { session as authSession } from "../src/auth";
import { CONSENT_BODY, type IdentityState } from "../src/identity/identityModel";
import { setWidgetLauncher, unavailableWidgetLauncher, type IdentityWidgetLauncher, type WidgetOutcome } from "../src/identity/widget";
import IdentityVerification from "../src/screens/setup/IdentityVerification";
import { identityService } from "../src/services/identity.service";
import { renderWithClient } from "../test-utils/carePlanHarness";
import {
  VERIFICATION_ID,
  checking,
  errored,
  exhausted,
  expired,
  fresh,
  providerDown,
  rejected,
  session,
  started,
  tryAgain,
  underReview,
  verified,
} from "../test-utils/identityFixtures";

const mockNavigate = jest.fn();
const mockGetState = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, goBack: jest.fn(), getState: mockGetState } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
}));

/** The server as the screen sees it: `current` is what `getState` answers; tests move it like the backend would. */
let current: IdentityState;
let getState: jest.SpyInstance;
let startSession: jest.SpyInstance;
let sendClientEvent: jest.SpyInstance;
let defer: jest.SpyInstance;
let open: jest.Mock;

function widget(outcome: WidgetOutcome | Error): IdentityWidgetLauncher {
  open = jest.fn(async () => {
    if (outcome instanceof Error) throw outcome;
    return outcome;
  });
  return { open };
}

beforeEach(async () => {
  await authSession.signIn({ accessToken: "access", refreshToken: "refresh" });
  mockGetState.mockReturnValue({ routeNames: ["CaregiverSetupStep1", "IdentityVerification", "ConsentScreen"] });
  current = fresh();
  getState = jest.spyOn(identityService, "getState").mockImplementation(async () => current);
  startSession = jest.spyOn(identityService, "startSession").mockImplementation(async () => {
    current = started();
    return session(current);
  });
  sendClientEvent = jest.spyOn(identityService, "sendClientEvent").mockImplementation(async () => current);
  defer = jest.spyOn(identityService, "defer").mockImplementation(async () => current);
  setWidgetLauncher(widget({ kind: "completed", sessionId: "placeholder-session-001" }));
});
afterEach(async () => {
  jest.restoreAllMocks();
  setWidgetLauncher(unavailableWidgetLauncher);
  mockNavigate.mockClear();
  await authSession.signOut();
});

const renderScreen = () => renderWithClient(<IdentityVerification />);
const tick = async () => fireEvent.press(await screen.findByTestId("identity-consent-check"));
const press = async (id: string) => fireEvent.press(await screen.findByTestId(id));

describe("intro and consent (design 11.3, state 1)", () => {
  it("shows the separate consent text and keeps Start off until the box is ticked", async () => {
    await renderScreen();
    expect(await screen.findByTestId("identity-consent-text")).toHaveTextContent(CONSENT_BODY);
    const check = screen.getByTestId("identity-consent-check");
    expect(check.props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByTestId("identity-start").props.accessibilityState?.disabled ?? screen.getByTestId("identity-start").props.disabled).toBeTruthy();
    await fireEvent.press(screen.getByTestId("identity-start"));
    expect(startSession).not.toHaveBeenCalled();

    await fireEvent.press(check);
    expect(screen.getByTestId("identity-consent-check").props.accessibilityState).toMatchObject({ checked: true });
  });

  it("starts with the explicit consent and the version it showed, opens the widget with the server's config, and sends hints", async () => {
    await renderScreen();
    await tick();
    await press("identity-start");

    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect(startSession).toHaveBeenCalledWith({ consent: true, policyVersion: "kyc-2026-10" });
    expect(open).toHaveBeenCalledWith(session().widget);
    await waitFor(() => expect(sendClientEvent).toHaveBeenCalledWith(VERIFICATION_ID, "completed", "placeholder-session-001"));
    expect(sendClientEvent).toHaveBeenCalledWith(VERIFICATION_ID, "opened", undefined);
  });

  it("shows 'Checking...' after the widget finishes and never calls the widget's word 'verified'", async () => {
    current = started();
    sendClientEvent.mockImplementation(async () => {
      current = checking();
      return current;
    });
    await renderScreen();
    await press("identity-start");
    expect(await screen.findByTestId("identity-checking")).toBeTruthy();
    expect(screen.queryByTestId("identity-verified")).toBeNull();
    expect(screen.getByText("Checking your details...")).toBeTruthy();
  });
});

describe("waiting for the result", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("polls until the server says verified, then Continue goes to consent", async () => {
    current = checking();
    await renderScreen();
    expect(await screen.findByTestId("identity-checking")).toBeTruthy();
    expect(screen.queryByTestId("identity-slow")).toBeNull();

    current = verified();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3_000);
    });
    expect(await screen.findByTestId("identity-verified")).toBeTruthy();
    expect(screen.getByText("Identity verified")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("identity-continue"));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("ConsentScreen"));
  });

  it("after two minutes says it is taking longer, and after five stops and offers Check again", async () => {
    current = checking();
    await renderScreen();
    await screen.findByTestId("identity-checking");
    await act(async () => {
      await jest.advanceTimersByTimeAsync(125_000);
    });
    expect(screen.getByTestId("identity-slow")).toHaveTextContent("This is taking longer. You can leave this screen; we'll notify you.");
    expect(screen.queryByTestId("identity-check-again")).toBeNull();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(200_000);
    });
    expect(screen.getByTestId("identity-check-again")).toBeTruthy();
    const reads = getState.mock.calls.length;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(120_000);
    });
    expect(getState.mock.calls.length).toBe(reads);

    current = verified();
    await fireEvent.press(screen.getByTestId("identity-check-again"));
    expect(await screen.findByTestId("identity-verified")).toBeTruthy();
  });
});

describe("states the server can give", () => {
  it("try again: a tip from the hint, 'Attempt 2 of 3', and a fresh consent before the new attempt", async () => {
    current = tryAgain();
    await renderScreen();
    expect(await screen.findByTestId("identity-try-again")).toBeTruthy();
    expect(screen.getByTestId("identity-tip")).toHaveTextContent("Find good light, face it, and take off any cap or glasses.");
    expect(screen.getByTestId("identity-attempt")).toHaveTextContent("Attempt 2 of 3");
    expect(screen.getByTestId("identity-consent-check")).toBeTruthy();

    await tick();
    await press("identity-start");
    await waitFor(() => expect(startSession).toHaveBeenCalledTimes(1));
  });

  it.each([
    ["document", "Hold your ID flat and fill the frame, so every corner shows."],
    ["mismatch_generic", "Use the ID that matches the name on your Oakly profile."],
  ] as const)("try again with the %s hint gives that tip, not a reason", async (hint, tip) => {
    current = { ...tryAgain(), failure_hint: hint };
    await renderScreen();
    expect(await screen.findByTestId("identity-tip")).toHaveTextContent(tip);
  });

  it("under review: a person will check, no reason, and the caregiver can continue", async () => {
    current = underReview();
    await renderScreen();
    expect(await screen.findByTestId("identity-under-review")).toBeTruthy();
    expect(screen.getByText(/A person on our team will check this, usually within 24 hours\. You can continue\./)).toBeTruthy();
    expect(screen.queryByText(/duplicate|watch|mismatch|score/i)).toBeNull();
    await fireEvent.press(screen.getByTestId("identity-continue"));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("ConsentScreen"));
  });

  it("attempts used up: says the team will review and lets the caregiver continue, with no Start", async () => {
    current = exhausted();
    await renderScreen();
    expect(await screen.findByTestId("identity-exhausted")).toBeTruthy();
    expect(screen.queryByTestId("identity-start")).toBeNull();
    await fireEvent.press(screen.getByTestId("identity-continue"));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("ConsentScreen"));
  });

  it("unavailable: 'Continue without for now' defers and goes to consent", async () => {
    current = providerDown();
    await renderScreen();
    expect(await screen.findByTestId("identity-unavailable")).toBeTruthy();
    expect(screen.getByText("Verification is temporarily unavailable")).toBeTruthy();
    expect(screen.getByText(/Your progress is saved/)).toBeTruthy();
    expect(screen.queryByTestId("identity-start")).toBeNull();

    await fireEvent.press(screen.getByText("Continue without for now"));
    await waitFor(() => expect(defer).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("ConsentScreen"));
  });

  it("unavailable: Check again re-reads the state, and a refused 'continue' shows the server's message", async () => {
    current = providerDown();
    defer.mockRejectedValue(new ApiError(409, { detail: { code: "PROVIDER_AVAILABLE", message: "Verification is available right now." } }, "Verification is available right now."));
    await renderScreen();
    await screen.findByTestId("identity-unavailable");
    await fireEvent.press(screen.getByTestId("identity-defer"));
    expect(await screen.findByTestId("identity-banner")).toHaveTextContent("Verification is available right now.");
    expect(mockNavigate).not.toHaveBeenCalled();

    current = fresh();
    await fireEvent.press(screen.getByText("Check again"));
    expect(await screen.findByTestId("identity-intro")).toBeTruthy();
  });

  it("expired and error offer a fresh start and say it didn't use up an attempt", async () => {
    current = expired();
    await renderScreen();
    expect(await screen.findByTestId("identity-expired-note")).toHaveTextContent(/That session timed out/);
    expect(screen.getByText(/didn't use up an attempt/)).toBeTruthy();
    expect(screen.getByText("Start again")).toBeTruthy();
  });

  it("an attempt that errored on our side says so", async () => {
    current = errored();
    await renderScreen();
    expect(await screen.findByTestId("identity-check-error")).toBeTruthy();
    expect(screen.getByText("Something went wrong on our side. It didn't use up an attempt.")).toBeTruthy();
  });

  it("rejected by a person: no Start, a way to contact support", async () => {
    current = rejected();
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await renderScreen();
    expect(await screen.findByTestId("identity-rejected")).toBeTruthy();
    expect(screen.queryByTestId("identity-start")).toBeNull();
    await fireEvent.press(screen.getByText("Contact support"));
    expect(open).toHaveBeenCalledWith("mailto:info@theoakshealthcare.com");
  });

  it("an app whose consent text is older than the server's asks to be updated and offers no Start", async () => {
    current = { ...fresh(), policy_version: "kyc-2027-01" };
    await renderScreen();
    expect(await screen.findByTestId("identity-update-required")).toBeTruthy();
    expect(screen.queryByTestId("identity-start")).toBeNull();
    expect(screen.queryByTestId("identity-consent-check")).toBeNull();
  });

  it("resumes a running attempt without asking the consent again", async () => {
    current = started();
    await renderScreen();
    expect(await screen.findByTestId("identity-resume")).toBeTruthy();
    expect(screen.queryByTestId("identity-consent-check")).toBeNull();
    await press("identity-start");
    await waitFor(() => expect(startSession).toHaveBeenCalledWith({ consent: true, policyVersion: "kyc-2026-10" }));
  });
});

describe("the widget closes, fails or is refused", () => {
  it("closed: 'You closed verification before finishing', a closed hint, and Try again reopens the same attempt", async () => {
    setWidgetLauncher(widget({ kind: "closed" }));
    await renderScreen();
    await tick();
    await press("identity-start");
    expect(await screen.findByTestId("identity-closed")).toBeTruthy();
    expect(screen.getByText("You closed verification before finishing")).toBeTruthy();
    expect(sendClientEvent).toHaveBeenCalledWith(VERIFICATION_ID, "closed", undefined);

    await press("identity-start");
    await waitFor(() => expect(startSession).toHaveBeenCalledTimes(2));
  });

  it("error in the widget (or the launcher throwing): 'Something went wrong', an error hint, Try again", async () => {
    setWidgetLauncher(widget(new Error("boom")));
    await renderScreen();
    await tick();
    await press("identity-start");
    expect(await screen.findByTestId("identity-widget-error")).toBeTruthy();
    expect(sendClientEvent).toHaveBeenCalledWith(VERIFICATION_ID, "error", undefined);
    expect(screen.getByText(/didn't use up an attempt/)).toBeTruthy();
  });

  it("api mode before the widget exists ends as a widget error, never as a result", async () => {
    setWidgetLauncher(unavailableWidgetLauncher);
    await renderScreen();
    await tick();
    await press("identity-start");
    expect(await screen.findByTestId("identity-widget-error")).toBeTruthy();
    expect(screen.queryByTestId("identity-verified")).toBeNull();
  });

  it("camera permission refused: explains why, opens Settings, and Try again starts over", async () => {
    setWidgetLauncher(widget({ kind: "permissionDenied" }));
    const settings = jest.spyOn(Linking, "openSettings").mockResolvedValue();
    await renderScreen();
    await tick();
    await press("identity-start");
    expect(await screen.findByTestId("identity-permission-denied")).toBeTruthy();
    expect(screen.getByText(/Turn on camera access for Oakly in Settings/)).toBeTruthy();
    await fireEvent.press(screen.getByText("Open Settings"));
    expect(settings).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByText("Try again"));
    await waitFor(() => expect(startSession).toHaveBeenCalledTimes(2));
  });

  it("a failed hint never blocks the caregiver", async () => {
    sendClientEvent.mockRejectedValue(new ApiError(0, null, "offline"));
    await renderScreen();
    await tick();
    await press("identity-start");
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId("identity-checking")).toBeTruthy();
  });
});

describe("refused starts", () => {
  const detail = (code: string, message: string) => new ApiError(409, { detail: { code, message } }, message);

  it("attempts exhausted: the state is re-read and the screen explains it without a second message", async () => {
    startSession.mockImplementation(async () => {
      current = exhausted();
      throw detail("ATTEMPTS_EXHAUSTED", "You have used all your identity verification attempts. Our team will review your case.");
    });
    await renderScreen();
    await tick();
    await press("identity-start");
    expect(await screen.findByTestId("identity-exhausted")).toBeTruthy();
    expect(screen.queryByTestId("identity-banner")).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });

  it("already verified elsewhere: shows verified", async () => {
    startSession.mockImplementation(async () => {
      current = verified();
      throw detail("ALREADY_VERIFIED", "Identity already verified");
    });
    await renderScreen();
    await tick();
    await press("identity-start");
    expect(await screen.findByTestId("identity-verified")).toBeTruthy();
  });

  it("provider down (503): shows the outage and the way to continue", async () => {
    startSession.mockImplementation(async () => {
      current = providerDown();
      throw new ApiError(503, { detail: { code: "PROVIDER_UNAVAILABLE", message: "Verification is temporarily unavailable." } }, "Verification is temporarily unavailable.");
    });
    await renderScreen();
    await tick();
    await press("identity-start");
    expect(await screen.findByTestId("identity-unavailable")).toBeTruthy();
    expect(screen.getByTestId("identity-banner")).toHaveTextContent("Verification is temporarily unavailable.");
  });

  it("offline while starting: the screen stays, with a banner, and the tick is asked again", async () => {
    startSession.mockRejectedValue(new ApiError(0, null, "Can't reach Oakly. Check your internet connection and try again."));
    await renderScreen();
    await tick();
    await press("identity-start");
    expect(await screen.findByTestId("identity-banner")).toHaveTextContent("Can't reach Oakly. Check your internet connection and try again.");
    expect(screen.getByTestId("identity-intro")).toBeTruthy();
    expect(screen.getByTestId("identity-consent-check").props.accessibilityState).toMatchObject({ checked: false });
  });
});

describe("loading and load failures", () => {
  it("shows a loader first", async () => {
    let release: (state: IdentityState) => void = () => undefined;
    getState.mockImplementation(() => new Promise<IdentityState>((resolve) => (release = resolve)));
    await renderScreen();
    expect(screen.getByTestId("identity-loading")).toBeTruthy();
    // Settle the read before the test ends, so no query is left mid-fetch holding a timer.
    await act(async () => release(fresh()));
    expect(await screen.findByTestId("identity-intro")).toBeTruthy();
  });

  it("offers Try again when the state cannot be loaded, and recovers", async () => {
    getState.mockRejectedValueOnce(new ApiError(500, null, "Something went wrong on our side. Please try again in a moment."));
    await renderScreen();
    expect(await screen.findByTestId("identity-load-error")).toBeTruthy();
    expect(screen.getByText("Something went wrong on our side. Please try again in a moment.")).toBeTruthy();
    await fireEvent.press(screen.getByText("Try again"));
    expect(await screen.findByTestId("identity-intro")).toBeTruthy();
  });

  it("says 'You're offline' when the request never left the phone (design state 12)", async () => {
    getState.mockRejectedValueOnce(new ApiError(0, null, "Can't reach Oakly."));
    await renderScreen();
    expect(await screen.findByTestId("identity-offline")).toBeTruthy();
    expect(screen.getByText("You're offline")).toBeTruthy();
  });
});

describe("in the status-screen stack (no consent step)", () => {
  it("Continue returns to the status screen", async () => {
    mockGetState.mockReturnValue({ routeNames: ["VerificationStatus", "CaregiverSetupStep1", "IdentityVerification"] });
    current = verified();
    await renderScreen();
    await fireEvent.press(await screen.findByTestId("identity-continue"));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("VerificationStatus"));
  });
});
