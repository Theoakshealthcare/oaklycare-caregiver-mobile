import { act, fireEvent, screen } from "@testing-library/react-native";
import React from "react";

import { session as authSession } from "../src/auth";
import { createMockIdentityService, createMockWidgetLauncher } from "../src/identity/mockIdentityService";
import { setWidgetLauncher, unavailableWidgetLauncher } from "../src/identity/widget";
import IdentityVerification from "../src/screens/setup/IdentityVerification";
import { setIdentityService } from "../src/services/identity.service";
import { renderWithClient } from "../test-utils/carePlanHarness";

const mockNavigate = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({
    navigation: { navigate: mockNavigate, goBack: jest.fn(), getState: () => ({ routeNames: ["IdentityVerification", "ConsentScreen"] }) },
  }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  useNavigationState: (select: (state: { index: number }) => unknown) => select({ index: 1 }),
}));

beforeEach(async () => {
  jest.useFakeTimers();
  await authSession.signIn({ accessToken: "access", refreshToken: "refresh" });
});
afterEach(async () => {
  jest.useRealTimers();
  setIdentityService(createMockIdentityService());
  setWidgetLauncher(unavailableWidgetLauncher);
  mockNavigate.mockClear();
  await authSession.signOut();
});

const settle = (ms = 0) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

async function startAttempt() {
  await fireEvent.press(await screen.findByTestId("identity-consent-check"));
  await fireEvent.press(screen.getByTestId("identity-start"));
  await settle();
}

describe("mock service end to end through the screen", () => {
  it("try_again scenario: fail with a tip, try again, then verified, Continue goes to consent", async () => {
    setIdentityService(createMockIdentityService({ scenario: "try_again", pollsToResolve: 2 }));
    setWidgetLauncher(createMockWidgetLauncher());
    await renderWithClient(<IdentityVerification />);
    await settle();

    await startAttempt();
    expect(await screen.findByTestId("identity-checking")).toBeTruthy();
    await settle(3_000);
    expect(await screen.findByTestId("identity-try-again")).toBeTruthy();
    expect(screen.getByTestId("identity-attempt")).toHaveTextContent("Attempt 2 of 3");
    // The first attempt used its tick up: the new attempt asks again.
    expect(screen.getByTestId("identity-consent-check").props.accessibilityState).toMatchObject({ checked: false });

    await startAttempt();
    expect(await screen.findByTestId("identity-checking")).toBeTruthy();
    await settle(3_000);
    expect(await screen.findByTestId("identity-verified")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("identity-continue"));
    await settle();
    expect(mockNavigate).toHaveBeenCalledWith("ConsentScreen");
  });

  it("needs_review scenario ends under review", async () => {
    setIdentityService(createMockIdentityService({ scenario: "needs_review", pollsToResolve: 1 }));
    setWidgetLauncher(createMockWidgetLauncher());
    await renderWithClient(<IdentityVerification />);
    await settle();
    await startAttempt();
    await settle(3_000);
    expect(await screen.findByTestId("identity-under-review")).toBeTruthy();
  });

  it("provider_down scenario offers 'Continue without for now'", async () => {
    setIdentityService(createMockIdentityService({ scenario: "provider_down" }));
    await renderWithClient(<IdentityVerification />);
    await settle();
    expect(await screen.findByTestId("identity-unavailable")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("identity-defer"));
    await settle();
    expect(mockNavigate).toHaveBeenCalledWith("ConsentScreen");
  });
});
