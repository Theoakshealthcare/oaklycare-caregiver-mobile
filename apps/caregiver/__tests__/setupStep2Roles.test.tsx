import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import { session } from "../src/auth";
import CaregiverSetupStep2 from "../src/screens/setup/CaregiverSetupStep2";
import { authService } from "../src/services/auth.service";
import { caregiverService, FALLBACK_ROLES, parseFormOptions } from "../src/services/caregiver.service";
import { renderWithClient } from "../test-utils/carePlanHarness";

const mockNavigate = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({
    navigation: { navigate: mockNavigate, goBack: jest.fn(), getState: () => ({ routeNames: ["ConsentScreen"] }) },
  }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  useNavigationState: (select: (state: { index: number }) => unknown) => select({ index: 1 }),
}));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));

const options = {
  specializations: ["Elderly Care"],
  service_areas: ["Personal Care"],
  work_hours: ["Flexible Hours"],
  states: ["Lagos"],
  roles: [
    { value: "nurse", label: "Nurse" },
    { value: "doctor", label: "Doctor" },
    { value: "physiotherapist", label: "Physiotherapist" },
    { value: "caregiver", label: "Caregiver" },
    { value: "nutritionist", label: "Nutritionist" },
  ],
};

const profile = (applyingAs: string[] | null) =>
  ({ id: "cg1", applying_as: applyingAs, profile_completion_step: 1 }) as unknown as Awaited<
    ReturnType<typeof caregiverService.getProfile>
  >;

beforeEach(async () => {
  await session.signIn({ accessToken: "access", refreshToken: "refresh" });
  jest.spyOn(authService, "getMe").mockResolvedValue({ user_type: "caregiver", is_verified: true } as never);
  jest.spyOn(caregiverService, "getFormOptions").mockResolvedValue(options);
  jest.spyOn(caregiverService, "getProfile").mockResolvedValue(profile(null));
  jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});
afterEach(async () => {
  jest.restoreAllMocks();
  mockNavigate.mockClear();
  await session.signOut();
});

/** Fills every field except "I apply as". */
async function fillTheRest() {
  await fireEvent.press(await screen.findByText("Select your Specialization"));
  await fireEvent.press(await screen.findByText("Elderly Care"));
  await fireEvent.press(screen.getByText("Select Experience"));
  await fireEvent.press(await screen.findByText("3 years"));
  await fireEvent.press(screen.getByText("Select Work Hours"));
  await fireEvent.press(await screen.findByText("Flexible Hours"));
  await fireEvent.press(screen.getByText("Select Service Areas"));
  await fireEvent.press(await screen.findByText("Personal Care"));
  await fireEvent.press(screen.getByTestId("select-done"));
}

describe("setup step 2: I apply as", () => {
  it("shows the field after the years of experience, with the neutral label and placeholder", async () => {
    await renderWithClient(<CaregiverSetupStep2 />);
    expect(await screen.findByText("I apply as")).toBeTruthy();
    expect(screen.getByText("Select your role(s)")).toBeTruthy();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf("Select years of Experience")).toBeLessThan(tree.indexOf("I apply as"));
    expect(tree.indexOf("I apply as")).toBeLessThan(tree.indexOf("Upload License"));
  });

  it("lists the five roles with the backend's labels", async () => {
    await renderWithClient(<CaregiverSetupStep2 />);
    await fireEvent.press(await screen.findByText("Select your role(s)"));
    for (const label of ["Nurse", "Doctor", "Physiotherapist", "Caregiver", "Nutritionist"]) {
      expect(await screen.findByTestId(`apply-as-option-${label.toLowerCase()}`)).toBeTruthy();
    }
  });

  it("is required: Save & Continue without a role shows an error and sends nothing", async () => {
    const save = jest.spyOn(caregiverService, "updateProfileStep2").mockResolvedValue({} as never);
    await renderWithClient(<CaregiverSetupStep2 />);
    await fillTheRest();
    await fireEvent.press(screen.getByText("Save & Continue"));
    expect(await screen.findByText("Select at least one role")).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
  });

  it("sends the chosen roles as applying_as, with the other step 2 fields", async () => {
    const save = jest.spyOn(caregiverService, "updateProfileStep2").mockResolvedValue({} as never);
    await renderWithClient(<CaregiverSetupStep2 />);
    await fillTheRest();
    await fireEvent.press(screen.getByText("Select your role(s)"));
    await fireEvent.press(await screen.findByTestId("apply-as-option-nurse"));
    await fireEvent.press(screen.getByTestId("apply-as-option-caregiver"));
    await fireEvent.press(screen.getAllByTestId("select-done")[0]);
    expect(await screen.findByText("Nurse, Caregiver")).toBeTruthy();
    await fireEvent.press(screen.getByText("Save & Continue"));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        specialization: "Elderly Care",
        years_of_experience: 3,
        preferred_work_hours: "Flexible Hours",
        service_areas: ["Personal Care"],
        applying_as: ["nurse", "caregiver"],
      }),
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("ConsentScreen"));
  });

  it("shows the saved value when the caregiver comes back to the step", async () => {
    jest.spyOn(caregiverService, "getProfile").mockResolvedValue(profile(["doctor", "nurse"]));
    await renderWithClient(<CaregiverSetupStep2 />);
    expect(await screen.findByText("Nurse, Doctor")).toBeTruthy();
    expect(screen.queryByText("Select your role(s)")).toBeNull();
  });

  it("a saved value counts as chosen: the field does not block Save & Continue", async () => {
    jest.spyOn(caregiverService, "getProfile").mockResolvedValue(profile(["physiotherapist"]));
    const save = jest.spyOn(caregiverService, "updateProfileStep2").mockResolvedValue({} as never);
    await renderWithClient(<CaregiverSetupStep2 />);
    await screen.findByText("Physiotherapist");
    await fillTheRest();
    await fireEvent.press(screen.getByText("Save & Continue"));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ applying_as: ["physiotherapist"] })));
  });
});

describe("form options: roles", () => {
  it("keeps the backend's roles with their labels", () => {
    expect(parseFormOptions(options).roles).toEqual(options.roles);
  });

  it("drops malformed role entries, and falls back to the five roles when the server sends none", () => {
    expect(parseFormOptions({ roles: [{ value: "nurse" }, "doctor", null, { value: "doctor", label: "Doctor" }] }).roles).toEqual([
      { value: "doctor", label: "Doctor" },
    ]);
    expect(parseFormOptions({}).roles).toEqual(FALLBACK_ROLES);
    expect(FALLBACK_ROLES.map((r) => r.value)).toEqual(["nurse", "doctor", "physiotherapist", "caregiver", "nutritionist"]);
  });
});
