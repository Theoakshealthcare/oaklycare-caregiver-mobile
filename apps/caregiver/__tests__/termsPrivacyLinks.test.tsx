import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert, Linking } from "react-native";

import ConsentBlock from "../src/components/identity/ConsentBlock";
import { COOKIES_URL, PRIVACY_URL, TERMS_URL } from "../src/config/contact";
import { CONSENT_BODY, CONSENT_LABEL, CONSENT_TEXT_VERSION, CONSENT_TITLE } from "../src/identity/identityModel";
import CreateAccount from "../src/screens/auth/CreateAccount";
import ConsentScreen from "../src/screens/setup/ConsentScreen";
import { caregiverService } from "../src/services/caregiver.service";

jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({ type: "dismiss" })) }));
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: jest.fn(), goBack: jest.fn() } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  useNavigationState: (select: (state: { index: number }) => unknown) => select({ index: 1 }),
}));

const WebBrowser = jest.requireMock("expo-web-browser") as { openBrowserAsync: jest.Mock };
const CLOSE_BUTTON = { dismissButtonStyle: "close" };

const withClient = (ui: React.ReactElement) => <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>;

beforeEach(() => WebBrowser.openBrowserAsync.mockClear());
afterEach(() => jest.restoreAllMocks());

describe("the URLs", () => {
  it("are the ones the owner supplied", () => {
    expect(TERMS_URL).toBe("https://www.oaklycare.com/terms");
    expect(PRIVACY_URL).toBe("https://www.oaklycare.com/privacy");
    expect(COOKIES_URL).toBe("https://www.oaklycare.com/cookies");
  });
});

describe("sign-up: the agree line", () => {
  it("opens Terms and Privacy in the in-app browser, never Safari", async () => {
    const safari = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await render(withClient(<CreateAccount />));
    await fireEvent.press(screen.getByText("Terms of Services"));
    await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenLastCalledWith(TERMS_URL, CLOSE_BUTTON));
    await fireEvent.press(screen.getByText("Privacy Policy"));
    await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenLastCalledWith(PRIVACY_URL, CLOSE_BUTTON));
    await fireEvent.press(screen.getByText("Cookies Policy"));
    await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenLastCalledWith(COOKIES_URL, CLOSE_BUTTON));
    expect(safari).not.toHaveBeenCalled();
  });

  it("keeps the sentence word for word", async () => {
    await render(withClient(<CreateAccount />));
    expect(screen.getByText(/By tapping Get Started, you agree to our/)).toHaveTextContent(
      "By tapping Get Started, you agree to our Terms of Services. Learn how we process your data in our Privacy Policy and Cookies Policy",
    );
  });

  it("a tap on a link does not tick the agree box (the 'must agree' error stays)", async () => {
    await render(withClient(<CreateAccount />));
    await fireEvent.press(screen.getAllByText("Create Account").at(-1)!);
    expect(await screen.findByText("You must agree to the terms")).toBeTruthy();
    await fireEvent.press(screen.getByText("Terms of Services"));
    await fireEvent.press(screen.getByText("Privacy Policy"));
    // ticking the box clears this error; a link tap must not
    expect(screen.getByText("You must agree to the terms")).toBeTruthy();
  });
});

describe("caregiver consent screen", () => {
  it.each([
    ["Terms of Services", TERMS_URL],
    ["Privacy Policy", PRIVACY_URL],
    ["Cookies Policy", COOKIES_URL],
  ])("%s opens the right page in the in-app browser", async (label, url) => {
    await render(withClient(<ConsentScreen />));
    await fireEvent.press(screen.getByText(label));
    await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(url, CLOSE_BUTTON));
  });

  it("a link tap does not submit consent; the button still does, once", async () => {
    const updateConsent = jest.spyOn(caregiverService, "updateConsent").mockResolvedValue(undefined as never);
    await render(withClient(<ConsentScreen />));
    await fireEvent.press(screen.getByText("Terms of Services"));
    await fireEvent.press(screen.getByText("Privacy Policy"));
    expect(updateConsent).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Give Consent"));
    await waitFor(() => expect(updateConsent).toHaveBeenCalledTimes(1));
  });

  it("says so in the app's alert when a page cannot open", async () => {
    WebBrowser.openBrowserAsync.mockRejectedValueOnce(new Error("no browser"));
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(withClient(<ConsentScreen />));
    await fireEvent.press(screen.getByText("Terms of Services"));
    await waitFor(() => expect(alert).toHaveBeenCalledWith("Couldn't open Terms of Service", "Check your internet connection and try again."));
  });
});

describe("identity consent block (design 10.2)", () => {
  it("opens the privacy policy without touching the consent tick box", async () => {
    const onToggle = jest.fn();
    await render(<ConsentBlock checked={false} onToggle={onToggle} />);
    await fireEvent.press(screen.getByText("Privacy Policy"));
    await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(PRIVACY_URL, CLOSE_BUTTON));
    expect(onToggle).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("identity-consent-check"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("is still not pre-ticked, and its words and text version are unchanged", async () => {
    await render(<ConsentBlock checked={false} onToggle={jest.fn()} />);
    expect(screen.getByTestId("identity-consent-check").props.accessibilityState.checked).toBe(false);
    expect(screen.getByTestId("identity-consent-text")).toHaveTextContent(CONSENT_BODY);
    expect(screen.getByText(CONSENT_TITLE)).toBeTruthy();
    expect(screen.getByText(CONSENT_LABEL)).toBeTruthy();
    expect(CONSENT_TEXT_VERSION).toBe("kyc-2026-10");
  });

  it("says so in the app's alert when the page cannot open", async () => {
    WebBrowser.openBrowserAsync.mockRejectedValueOnce(new Error("no browser"));
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<ConsentBlock checked={false} onToggle={jest.fn()} />);
    await fireEvent.press(screen.getByText("Privacy Policy"));
    await waitFor(() => expect(alert).toHaveBeenCalledWith("Couldn't open Privacy Policy", "Check your internet connection and try again."));
  });
});
