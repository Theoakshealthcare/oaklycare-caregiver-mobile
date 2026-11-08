import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Linking } from "react-native";

import { api } from "../src/api/client";
import { session } from "../src/auth";
import { CONTACT_EMAIL, supportUrl, whatsappUrl } from "../src/config/contact";
import { hasEditedProfile, markProfileEdited, RESUBMIT_HINT, resetProfileEdited } from "../src/onboarding/reviewEdits";
import VerificationStatusScreen from "../src/screens/setup/VerificationStatus";
import type { ProfileStatus, VerificationStatus } from "../src/services/caregiver.service";
import { caregiverService } from "../src/services/caregiver.service";
import { renderWithClient } from "../test-utils/carePlanHarness";

const mockNavigate = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, goBack: jest.fn() } }),
}));

function status(profileStatus: ProfileStatus, extra: Partial<VerificationStatus> = {}): VerificationStatus {
  return {
    profileStatus,
    profileCompletionStep: 3,
    identityVerificationStatus: "verified",
    backgroundCheckStatus: "pending",
    rejectionReason: null,
    changesRequested: null,
    ...extra,
  };
}
const changesRequested = status("changes_requested", {
  changesRequested: { items: ["Upload a clearer licence photo"], note: "The photo is blurry." },
});

beforeEach(async () => {
  resetProfileEdited();
  await session.signIn({ accessToken: "access", refreshToken: "refresh" });
});
afterEach(async () => {
  jest.restoreAllMocks();
  mockNavigate.mockClear();
  await session.signOut();
});

describe("changes requested: Resubmit for review", () => {
  it("is disabled, with a helper line, until something has been changed", async () => {
    jest.spyOn(caregiverService, "getVerificationStatus").mockResolvedValue(changesRequested);
    const consent = jest.spyOn(caregiverService, "updateConsent").mockResolvedValue({} as never);
    await renderWithClient(<VerificationStatusScreen />);
    expect(await screen.findByText("Changes requested")).toBeTruthy();

    expect(screen.getByTestId("resubmit-button")).toBeDisabled();
    expect(screen.getByTestId("resubmit-hint")).toHaveTextContent("Update the item we asked for, then resubmit.");
    expect(RESUBMIT_HINT).toBe("Update the item we asked for, then resubmit.");
    await fireEvent.press(screen.getByTestId("resubmit-button"));
    expect(consent).not.toHaveBeenCalled();
  });

  it("opens once an edit succeeded, resubmits, and starts over for the next request", async () => {
    jest.spyOn(caregiverService, "getVerificationStatus").mockResolvedValue(changesRequested);
    const consent = jest.spyOn(caregiverService, "updateConsent").mockResolvedValue({} as never);
    await renderWithClient(<VerificationStatusScreen />);
    await screen.findByText("Changes requested");

    await act(async () => markProfileEdited());
    expect(screen.getByTestId("resubmit-button")).toBeEnabled();
    expect(screen.queryByTestId("resubmit-hint")).toBeNull();

    await fireEvent.press(screen.getByTestId("resubmit-button"));
    await waitFor(() => expect(consent).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(hasEditedProfile()).toBe(false));
  });

  it("keeps Edit my details available", async () => {
    jest.spyOn(caregiverService, "getVerificationStatus").mockResolvedValue(changesRequested);
    await renderWithClient(<VerificationStatusScreen />);
    await fireEvent.press(await screen.findByText("Edit my details"));
    expect(mockNavigate).toHaveBeenCalledWith("CaregiverSetupStep1");
  });
});

describe("what counts as a change", () => {
  const ok = { data: {}, response: { ok: true, status: 200, headers: new Headers() } };
  const refused = { error: { detail: "No" }, response: { ok: false, status: 422, headers: new Headers() } };

  it("is a successful profile step or document upload, never a failed one", async () => {
    const put = jest.spyOn(api, "PUT").mockResolvedValue(refused as never);
    await expect(caregiverService.updateProfileStep1({} as never)).rejects.toBeTruthy();
    expect(hasEditedProfile()).toBe(false);

    put.mockResolvedValue(ok as never);
    await caregiverService.updateProfileStep2({} as never);
    expect(hasEditedProfile()).toBe(true);

    resetProfileEdited();
    jest.spyOn(api, "uploadMultipart").mockResolvedValue(refused as never);
    await expect(caregiverService.uploadDocument({ uri: "file:///x.jpg", name: "x.jpg" }, "license")).rejects.toBeTruthy();
    expect(hasEditedProfile()).toBe(false);

    jest.spyOn(api, "uploadMultipart").mockResolvedValue(ok as never);
    await caregiverService.uploadDocument({ uri: "file:///x.jpg", name: "x.jpg" }, "license");
    expect(hasEditedProfile()).toBe(true);
  });

  it("is forgotten when the caregiver signs out", async () => {
    markProfileEdited();
    await session.signOut();
    expect(hasEditedProfile()).toBe(false);
  });
});

describe("rejected: Contact support", () => {
  it("shows the reason, Contact support and Sign out, and opens the support link", async () => {
    jest.spyOn(caregiverService, "getVerificationStatus").mockResolvedValue(status("rejected", { rejectionReason: "Licence could not be verified." }));
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await renderWithClient(<VerificationStatusScreen />);
    expect(await screen.findByText("Licence could not be verified.")).toBeTruthy();
    expect(screen.getByText("Sign out")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("contact-support-button"));
    expect(open).toHaveBeenCalledWith(supportUrl());
  });

  it("is not offered on the other states", async () => {
    jest.spyOn(caregiverService, "getVerificationStatus").mockResolvedValue(status("under_review"));
    await renderWithClient(<VerificationStatusScreen />);
    await screen.findByText("Your profile is under review");
    expect(screen.queryByTestId("contact-support-button")).toBeNull();
  });
});

describe("supportUrl", () => {
  it("is the WhatsApp link when a number is configured, and the support email while it is still blank", () => {
    expect(supportUrl("+234 800 000 0000")).toBe("https://wa.me/2348000000000");
    expect(supportUrl("+234 800 000 0000")).toBe(whatsappUrl("+234 800 000 0000"));
    expect(supportUrl("")).toBe(`mailto:${CONTACT_EMAIL}`);
  });
});
