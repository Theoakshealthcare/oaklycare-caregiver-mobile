import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";

import { queryClient } from "../src/api/queryClient";
import { PRIVACY_URL, TERMS_URL } from "../src/config/links";
import { disableCacheGcForTests } from "../test-utils/fakeApi";
import { renderSignedIn, renderSignedOut } from "../test-utils/renderApp";

jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({ type: "dismiss" })) }));

const WebBrowser = jest.requireMock("expo-web-browser") as { openBrowserAsync: jest.Mock };
const CLOSE_BUTTON = { dismissButtonStyle: "close" };

const press = (name: string) => fireEvent.press(screen.getByRole("button", { name }));
const checkbox = () => screen.getByRole("checkbox");

describe("Terms and Privacy links", () => {
  beforeAll(() => disableCacheGcForTests(queryClient));
  afterAll(() => queryClient.clear());
  // Linking.openURL is a shared jest.fn in the RN preset: clear its call history so one test's calls are not the next test's.
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  it("the URLs are the ones the owner supplied", () => {
    expect(TERMS_URL).toBe("https://www.oaklycare.com/terms");
    expect(PRIVACY_URL).toBe("https://www.oaklycare.com/privacy");
  });

  describe("sign-up agree line", () => {
    it("the Privacy Policy opens in the in-app browser (not Safari) and does not tick the box", async () => {
      const safari = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
      const { view } = await renderSignedOut();
      await press("Create account");
      expect(checkbox().props.accessibilityState.checked).toBe(false);
      await fireEvent.press(screen.getByText("Privacy Policy"));
      await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(PRIVACY_URL, CLOSE_BUTTON));
      expect(safari).not.toHaveBeenCalled();
      expect(checkbox().props.accessibilityState.checked).toBe(false);
      view.unmount();
    });

    it("a link tap leaves the 'accept the terms' error in place; the box and the sentence still tick it", async () => {
      const { view } = await renderSignedOut();
      await press("Create account");
      await press("Create Account");
      expect(await screen.findByText("Please accept the terms to continue")).toBeTruthy();
      await fireEvent.press(screen.getByText("Privacy Policy"));
      expect(screen.getByText("Please accept the terms to continue")).toBeTruthy();
      await fireEvent.press(checkbox());
      expect(checkbox().props.accessibilityState.checked).toBe(true);
      expect(screen.queryByText("Please accept the terms to continue")).toBeNull();
      await fireEvent.press(screen.getByText(/^I agree to the/));
      expect(checkbox().props.accessibilityState.checked).toBe(false);
      view.unmount();
    });

    it("says so in the app's error dialog when the page cannot open at all", async () => {
      WebBrowser.openBrowserAsync.mockRejectedValueOnce(new Error("no browser"));
      jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no browser either"));
      const { view } = await renderSignedOut();
      await press("Create account");
      await fireEvent.press(screen.getByText("Privacy Policy"));
      expect(await screen.findByText("Couldn't open Privacy Policy")).toBeTruthy();
      expect(screen.getByText("Check your internet connection and try again.")).toBeTruthy();
      view.unmount();
    });
  });

  describe("profile menu", () => {
    it.each([
      ["Terms of Service", TERMS_URL],
      ["Privacy Policy", PRIVACY_URL],
    ])("%s opens in the in-app browser, never Safari", async (label, url) => {
      const safari = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
      const { view } = await renderSignedIn();
      await press("Open profile");
      await press(label);
      await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenLastCalledWith(url, CLOSE_BUTTON));
      expect(safari).not.toHaveBeenCalled();
      view.unmount();
    });

    it("says so in the app's error dialog when the page cannot open at all", async () => {
      WebBrowser.openBrowserAsync.mockRejectedValueOnce(new Error("no browser"));
      jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no browser either"));
      const { view } = await renderSignedIn();
      await press("Open profile");
      await press("Terms of Service");
      expect(await screen.findByText("Couldn't open Terms of Service")).toBeTruthy();
      view.unmount();
    });
  });
});
