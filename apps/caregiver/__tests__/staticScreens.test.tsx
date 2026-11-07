import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Linking } from "react-native";

import { CONTACT_EMAIL, whatsappUrl } from "../src/config/contact";
import Contact from "../src/screens/account/Contact";

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  useNavigationState: (select: (state: { index: number }) => unknown) => select({ index: 1 }),
}));

describe("whatsappUrl", () => {
  it("is null until the owner supplies a number", () => {
    expect(whatsappUrl("")).toBeNull();
    expect(whatsappUrl("  ")).toBeNull();
  });

  it("builds a wa.me link from the digits only", () => {
    expect(whatsappUrl("+234 800 000 0000")).toBe("https://wa.me/2348000000000");
  });
});

describe("Contact", () => {
  let open: jest.SpyInstance;
  beforeEach(() => {
    open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    open.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  it("opens the mail app for the support email", async () => {
    await render(<Contact />);
    expect(screen.getByText(CONTACT_EMAIL)).toBeTruthy();
    expect(CONTACT_EMAIL).toBe("info@theoakshealthcare.com");
    await fireEvent.press(screen.getByText(CONTACT_EMAIL));
    expect(open).toHaveBeenCalledWith(`mailto:${CONTACT_EMAIL}`);
  });

  it("shows no WhatsApp row while there is no number: no dead row, no call or phone entry (DP1-24)", async () => {
    await render(<Contact />);
    expect(screen.queryByText("WhatsApp")).toBeNull();
    expect(screen.queryByText("Not available yet")).toBeNull();
    expect(screen.queryByText(/call/i)).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });
});
