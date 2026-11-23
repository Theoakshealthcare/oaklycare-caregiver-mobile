import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert, Linking } from "react-native";

import { ABOUT_URL, FAQ_URL } from "../src/config/contact";
import Profile from "../src/screens/account/Profile";

jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({ type: "dismiss" })) }));
jest.mock("../src/components/back/HeaderBack", () => ({ __esModule: true, default: () => null }));
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: jest.fn(), goBack: jest.fn() } }),
}));
jest.mock("../src/hooks/queries", () => ({
  useMe: () => ({ data: { full_name: "Placeholder Nurse", email: "nurse@example.test", profile_image_url: null } }),
  useCaregiverHome: () => ({ data: undefined }),
}));

const WebBrowser = jest.requireMock("expo-web-browser") as { openBrowserAsync: jest.Mock };

beforeEach(() => WebBrowser.openBrowserAsync.mockClear());
afterEach(() => jest.restoreAllMocks());

describe("Profile: FAQs and About us open in the in-app browser", () => {
  it.each([
    ["FAQs", FAQ_URL],
    ["About Us", ABOUT_URL],
  ])("%s opens in the in-app browser with a close button, never Safari", async (label, url) => {
    const safari = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await render(<Profile />);
    await fireEvent.press(screen.getByText(label));
    await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(url, { dismissButtonStyle: "close" }));
    expect(safari).not.toHaveBeenCalled();
  });

  it("says so in the app's alert when the page cannot open, and does not fall back to Safari", async () => {
    WebBrowser.openBrowserAsync.mockRejectedValueOnce(new Error("no browser"));
    const safari = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<Profile />);
    await fireEvent.press(screen.getByText("FAQs"));
    await waitFor(() => expect(alert).toHaveBeenCalledWith("Couldn't open FAQs", "Check your internet connection and try again."));
    expect(safari).not.toHaveBeenCalled();
  });
});
