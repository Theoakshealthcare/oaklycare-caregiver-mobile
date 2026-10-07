import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert, Linking } from "react-native";

import { api } from "../src/api/client";
import { ApiError } from "../src/api/errors";
import { pushTokenStorage } from "../src/auth/secureStorage";
import { session } from "../src/auth";
import EditProfile from "../src/screens/account/EditProfile";
import Profile from "../src/screens/account/Profile";
import { accountService } from "../src/services/account.service";
import { authService } from "../src/services/auth.service";
import { caregiverService } from "../src/services/caregiver.service";

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, goBack: mockGoBack } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
}));
const mockLaunchPicker = jest.fn();
const mockRequestPermission = jest.fn();
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: () => mockRequestPermission(),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchPicker(...args),
}));

const me = {
  email: "ada@example.com",
  full_name: "Ada Obi",
  phone_number: "+2348000000001",
  user_type: "caregiver" as const,
  id: "u1",
  is_active: true,
  is_verified: true,
  profile_image_url: null,
  created_at: "2026-10-01T00:00:00",
  updated_at: "2026-10-01T00:00:00",
};

const caregiverProfile = {
  id: "cg1",
  user_id: "u1",
  email: "ada@example.com",
  full_name: "Ada Obi",
  phone_number: "+2348000000001",
  date_of_birth: "1990-05-01",
  gender: "female",
  state: "Lagos",
  address: "12 Placeholder Street, Lekki",
  emergency_contact_phone: "+2348000000002",
  profile_completion_step: 3,
  identity_verification_status: "verified",
  background_check_status: "passed",
  profile_status: "approved",
  terms_accepted: true,
  privacy_policy_accepted: true,
  background_check_consent: true,
  created_at: "2026-10-01T00:00:00",
  updated_at: "2026-10-01T00:00:00",
} as Awaited<ReturnType<typeof caregiverService.getProfile>>;

async function renderWith(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

let alertSpy: jest.SpyInstance;
beforeEach(async () => {
  await session.signIn({ accessToken: "access", refreshToken: "refresh" });
  jest.spyOn(authService, "getMe").mockResolvedValue(me);
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});
afterEach(async () => {
  jest.restoreAllMocks();
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockLaunchPicker.mockReset();
  mockRequestPermission.mockReset();
  await act(async () => {
    await session.signOut();
  });
});

/** Presses the button with this title in the last Alert.alert call. */
async function pressAlertButton(title: string) {
  const buttons = alertSpy.mock.calls.at(-1)?.[2] as { text: string; onPress?: () => void }[];
  const button = buttons.find((b) => b.text === title);
  if (!button) throw new Error(`no ${title} button`);
  await act(async () => {
    button.onPress?.();
  });
}

describe("Profile screen", () => {
  it("shows the caregiver and only the rows that exist", async () => {
    await renderWith(<Profile />);
    expect(await screen.findByText("Ada Obi")).toBeTruthy();
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    for (const row of ["Edit personal information", "Payment & earnings", "About us", "FAQs", "Contact us", "Logout", "Delete account"]) {
      expect(screen.getByText(row)).toBeTruthy();
    }
    for (const missing of ["Live chat", "Care plan", "Refer and earn", "Complaints", "Security", "Account and data"]) {
      expect(screen.queryByText(new RegExp(missing, "i"))).toBeNull();
    }
  });

  it("still shows the menu while the profile is loading or failed to load", async () => {
    jest.spyOn(authService, "getMe").mockRejectedValue(new ApiError(0, null, "x"));
    await renderWith(<Profile />);
    expect(screen.getByText("Logout")).toBeTruthy();
    expect(screen.queryByText("Ada Obi")).toBeNull();
  });

  it.each([
    ["Edit personal information", "EditProfile"],
    ["Payment & earnings", "Wallet"],
    ["Contact us", "Contact"],
  ])("%s opens %s", async (row, route) => {
    await renderWith(<Profile />);
    await fireEvent.press(screen.getByText(row));
    expect(mockNavigate).toHaveBeenCalledWith(route);
  });

  it.each([
    ["About us", "https://www.oaklycare.com/about"],
    ["FAQs", "https://www.oaklycare.com/faq"],
  ])("%s opens the website page %s", async (row, url) => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await renderWith(<Profile />);
    await fireEvent.press(screen.getByText(row));
    expect(open).toHaveBeenCalledWith(url);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("logout asks first, then uses the auth service logout", async () => {
    const logout = jest.spyOn(authService, "logout").mockResolvedValue();
    await renderWith(<Profile />);
    await fireEvent.press(screen.getByText("Logout"));
    expect(alertSpy).toHaveBeenCalledWith("Log out", "Do you want to log out of Oakly?", expect.any(Array));
    expect(logout).not.toHaveBeenCalled();
    await pressAlertButton("Log out");
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("delete account states the consequence and does nothing until confirmed", async () => {
    const del = jest.spyOn(authService, "deleteAccount").mockResolvedValue();
    await renderWith(<Profile />);
    await fireEvent.press(screen.getByText("Delete account"));
    const [title, message] = alertSpy.mock.calls.at(-1) ?? [];
    expect(title).toBe("Delete your account?");
    expect(message).toMatch(/personal details will be removed/i);
    expect(message).toMatch(/cannot be undone/i);
    expect(message).toMatch(/cannot be undone/i);
    expect(del).not.toHaveBeenCalled();
    await pressAlertButton("Cancel");
    expect(del).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Delete account"));
    await pressAlertButton("Delete account");
    await waitFor(() => expect(del).toHaveBeenCalledTimes(1));
  });

  it("a failed delete keeps the caregiver signed in and says why", async () => {
    jest.spyOn(authService, "deleteAccount").mockRejectedValue(new ApiError(500, null, "Something went wrong on our side. Please try again in a moment."));
    await renderWith(<Profile />);
    await fireEvent.press(screen.getByText("Delete account"));
    await pressAlertButton("Delete account");
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Couldn't delete your account", expect.stringContaining("Something went wrong")));
  });
});

describe("EditProfile screen", () => {
  it("shows a spinner while the profile loads", async () => {
    jest.spyOn(caregiverService, "getProfile").mockReturnValue(new Promise(() => undefined));
    await renderWith(<EditProfile />);
    expect(screen.getByTestId("edit-profile-loading")).toBeTruthy();
  });

  it("shows the error with a retry", async () => {
    const get = jest
      .spyOn(caregiverService, "getProfile")
      .mockRejectedValueOnce(new ApiError(0, null, "x"))
      .mockResolvedValue(caregiverProfile);
    await renderWith(<EditProfile />);
    expect(await screen.findByText(/Can't reach Oakly/)).toBeTruthy();
    await fireEvent.press(screen.getByText("Try again"));
    expect(await screen.findByDisplayValue("12 Placeholder Street, Lekki")).toBeTruthy();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("prefills from the caregiver profile and offers no password field", async () => {
    jest.spyOn(caregiverService, "getProfile").mockResolvedValue(caregiverProfile);
    await renderWith(<EditProfile />);
    expect(await screen.findByDisplayValue("Ada Obi")).toBeTruthy();
    expect(screen.getByDisplayValue("+2348000000001")).toBeTruthy();
    expect(screen.getByDisplayValue("1990-05-01")).toBeTruthy();
    expect(screen.queryByText(/password/i)).toBeNull();
  });

  it("saves only what changed through PUT /auth/profile and goes back", async () => {
    jest.spyOn(caregiverService, "getProfile").mockResolvedValue(caregiverProfile);
    const update = jest.spyOn(accountService, "updateProfile").mockResolvedValue({} as never);
    const step1 = jest.spyOn(caregiverService, "updateProfileStep1");
    await renderWith(<EditProfile />);
    await fireEvent.changeText(await screen.findByDisplayValue("Ada Obi"), "Ada Okafor");
    await fireEvent.press(screen.getByText("Update profile details"));
    await waitFor(() => expect(update).toHaveBeenCalledWith({ full_name: "Ada Okafor" }));
    expect(step1).not.toHaveBeenCalled();
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });

  it("a changed state goes through the step 1 endpoint with all five fields", async () => {
    jest.spyOn(caregiverService, "getProfile").mockResolvedValue(caregiverProfile);
    jest.spyOn(accountService, "updateProfile").mockResolvedValue({} as never);
    jest.spyOn(caregiverService, "getFormOptions").mockResolvedValue({
      specializations: [],
      service_areas: [],
      work_hours: [],
      states: ["Lagos", "Ogun"],
    });
    const step1 = jest.spyOn(caregiverService, "updateProfileStep1").mockResolvedValue({} as never);
    await renderWith(<EditProfile />);
    await screen.findByDisplayValue("Ada Obi");
    await fireEvent.press(screen.getByText("Lagos"));
    await fireEvent.press(await screen.findByText("Ogun"));
    await fireEvent.press(screen.getByText("Update profile details"));
    await waitFor(() =>
      expect(step1).toHaveBeenCalledWith({
        date_of_birth: "1990-05-01",
        gender: "female",
        state: "Ogun",
        address: "12 Placeholder Street, Lekki",
        emergency_contact_phone: "+2348000000002",
      }),
    );
  });

  it("rejects an empty name before any request", async () => {
    jest.spyOn(caregiverService, "getProfile").mockResolvedValue(caregiverProfile);
    const update = jest.spyOn(accountService, "updateProfile");
    await renderWith(<EditProfile />);
    await fireEvent.changeText(await screen.findByDisplayValue("Ada Obi"), "  ");
    await fireEvent.press(screen.getByText("Update profile details"));
    expect(await screen.findByText("Full name is required")).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  it("shows the server error when saving fails", async () => {
    jest.spyOn(caregiverService, "getProfile").mockResolvedValue(caregiverProfile);
    jest.spyOn(accountService, "updateProfile").mockRejectedValue(new ApiError(0, null, "x"));
    await renderWith(<EditProfile />);
    await fireEvent.changeText(await screen.findByDisplayValue("Ada Obi"), "Ada Okafor");
    await fireEvent.press(screen.getByText("Update profile details"));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Couldn't save", expect.stringContaining("Can't reach Oakly")));
  });

  it("uploads a picked photo", async () => {
    jest.spyOn(caregiverService, "getProfile").mockResolvedValue(caregiverProfile);
    mockRequestPermission.mockResolvedValue({ granted: true });
    mockLaunchPicker.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///photo.jpg", fileName: "photo.jpg", mimeType: "image/jpeg" }],
    });
    const upload = jest.spyOn(accountService, "uploadProfileImage").mockResolvedValue("https://img/x.jpg");
    await renderWith(<EditProfile />);
    await fireEvent.press(await screen.findByText("Upload image"));
    await waitFor(() =>
      expect(upload).toHaveBeenCalledWith({ uri: "file:///photo.jpg", fileName: "photo.jpg", mimeType: "image/jpeg" }),
    );
  });

  it("does nothing when the photo picker is cancelled or permission is refused", async () => {
    jest.spyOn(caregiverService, "getProfile").mockResolvedValue(caregiverProfile);
    const upload = jest.spyOn(accountService, "uploadProfileImage");
    mockRequestPermission.mockResolvedValue({ granted: false });
    await renderWith(<EditProfile />);
    await fireEvent.press(await screen.findByText("Upload image"));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Photos are off", expect.any(String)));
    expect(upload).not.toHaveBeenCalled();
  });
});

describe("authService.deleteAccount", () => {
  it("forgets the push token, deletes, then signs out (in that order)", async () => {
    const calls: string[] = [];
    jest.spyOn(pushTokenStorage, "get").mockResolvedValue("ExponentPushToken[placeholder]");
    jest.spyOn(api, "DELETE").mockImplementation((async (path: string) => {
      calls.push(path);
      return { data: {}, response: new Response(null, { status: 200 }) };
    }) as never);
    const signOut = jest.spyOn(session, "signOut").mockImplementation(async () => {
      calls.push("signOut");
    });
    await authService.deleteAccount();
    expect(calls).toEqual(["/api/v1/devices/push-token", "/api/v1/auth/profile", "signOut"]);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("keeps the session when the delete is refused", async () => {
    jest.spyOn(api, "DELETE").mockResolvedValue({ error: { detail: "nope" }, response: new Response(null, { status: 500 }) } as never);
    const signOut = jest.spyOn(session, "signOut");
    await expect(authService.deleteAccount()).rejects.toBeInstanceOf(ApiError);
    expect(signOut).not.toHaveBeenCalled();
  });
});
