import { fireEvent, screen } from "@testing-library/react-native";
import React from "react";

import { session } from "../src/auth";
import VerificationStatusScreen, { identityEntry } from "../src/screens/setup/VerificationStatus";
import type { ProfileStatus, VerificationStatus } from "../src/services/caregiver.service";
import { caregiverService } from "../src/services/caregiver.service";
import { renderWithClient } from "../test-utils/carePlanHarness";

const mockNavigate = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, goBack: jest.fn() } }),
}));
jest.mock("../src/identity/config", () => ({
  ...jest.requireActual("../src/identity/config"),
  kycEnabled: () => true,
}));

function status(profileStatus: ProfileStatus, identity: string): VerificationStatus {
  return {
    profileStatus,
    profileCompletionStep: 3,
    identityVerificationStatus: identity,
    backgroundCheckStatus: "pending",
    rejectionReason: null,
    changesRequested: null,
  };
}

describe("identityEntry (status screen, design 11.3 last paragraph)", () => {
  it("offers to open the identity step when it is still to do and the application is open", () => {
    for (const identity of ["pending", "in_progress"]) {
      for (const profile of ["under_review", "changes_requested"] as const) {
        expect(identityEntry(status(profile, identity), true)).toMatchObject({ canOpen: true });
      }
    }
  });

  it("only reads a line when the case is with a person or a person turned it down, and says no reason", () => {
    const review = identityEntry(status("under_review", "needs_review"), true);
    expect(review).toEqual({ line: "Your identity check is with our team.", canOpen: false });
    const failed = identityEntry(status("rejected", "failed"), true);
    expect(failed?.canOpen).toBe(false);
    expect(failed?.line).toMatch(/couldn't confirm your identity/);
  });

  it("shows nothing once verified, for a blocked application that is not about identity, or when the feature is off", () => {
    expect(identityEntry(status("under_review", "verified"), true)).toBeNull();
    expect(identityEntry(status("suspended", "pending"), true)).toBeNull();
    expect(identityEntry(status("rejected", "pending"), true)).toBeNull();
    expect(identityEntry(status("under_review", "pending"), false)).toBeNull();
  });
});

describe("status screen", () => {
  beforeEach(async () => {
    await session.signIn({ accessToken: "access", refreshToken: "refresh" });
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    mockNavigate.mockClear();
    await session.signOut();
  });

  it("opens the identity step from 'Verify your identity'", async () => {
    jest.spyOn(caregiverService, "getVerificationStatus").mockResolvedValue(status("under_review", "pending"));
    await renderWithClient(<VerificationStatusScreen />);
    expect(await screen.findByText("Your profile is under review")).toBeTruthy();
    expect(screen.getByTestId("status-identity")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("status-identity-open"));
    expect(mockNavigate).toHaveBeenCalledWith("IdentityVerification");
  });

  it("has no identity block for a verified caregiver", async () => {
    jest.spyOn(caregiverService, "getVerificationStatus").mockResolvedValue(status("under_review", "verified"));
    await renderWithClient(<VerificationStatusScreen />);
    await screen.findByText("Your profile is under review");
    expect(screen.queryByTestId("status-identity")).toBeNull();
  });
});
