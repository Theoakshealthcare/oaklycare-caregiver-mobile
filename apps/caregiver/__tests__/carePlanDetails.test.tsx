import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import { ApiError } from "../src/api/errors";
import { session } from "../src/auth";
import CarePlanDetails from "../src/screens/careplan/CarePlanDetails";
import { carePlansService } from "../src/services/carePlans.service";
import { clientsService, type ClientProfile } from "../src/services/clients.service";
import { renderWithClient, routeProps } from "../test-utils/carePlanHarness";
import { GOAL_ID, NOT_A_NURSE, NO_ACCESS, PLAN_ID, dayView, notePage, plan, readOnlyPlan, versionConflict } from "../test-utils/carePlanFixtures";

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, goBack: mockGoBack, replace: jest.fn() } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

const clientProfile = {
  booking_id: "bd787ad8-949e-4cb5-a428-39c61cd5fd03",
  patient_id: "22222222-2222-4222-8222-222222222222",
  full_name: "Placeholder Client",
  profile_image_url: null,
  booking_for: "myself",
  age: 71,
  gender: "female",
  emergency_contact: { name: "Placeholder Kin", phone: "+2340000000888", relationship: "Daughter" },
  medical_history: { blood_group: "O+", allergies: "Record allergen", medical_conditions: "Record condition", medications: null, records: [] },
  latest_vitals: null,
} as unknown as ClientProfile;

beforeEach(async () => {
  await session.signIn({ accessToken: "access", refreshToken: "refresh" });
  // The tasks section is part of this screen (M2); its own behaviour is tested in carePlanTasks.test.tsx.
  jest.spyOn(carePlansService, "getTaskDay").mockResolvedValue(dayView());
  jest.spyOn(carePlansService, "listNotes").mockResolvedValue(notePage([]));
});
afterEach(async () => {
  jest.restoreAllMocks();
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  await session.signOut();
});

const renderDetails = () =>
  renderWithClient(<CarePlanDetails {...routeProps<React.ComponentProps<typeof CarePlanDetails>>({ planId: PLAN_ID })} />);

const goal = (over: Record<string, unknown> = {}) => ({
  id: GOAL_ID,
  title: "Placeholder goal",
  target: "Placeholder target",
  frequency: "daily" as const,
  status: "active" as const,
  ...over,
});

describe("Care plan details", () => {
  it("shows the header: client, status, diagnosis, risk, dates, review and author", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(
      plan({ template: { id: "t", name: "Stroke Recovery", version: 1 } }),
    );
    await renderDetails();
    expect(await screen.findByTestId("details-client-name")).toHaveTextContent("Placeholder Client");
    expect(screen.getByText("Age 71. Female")).toBeTruthy();
    expect(screen.getByTestId("details-status")).toHaveTextContent("Active Care Plan");
    expect(screen.getByText("Placeholder diagnosis")).toBeTruthy();
    expect(screen.getByTestId("details-risk")).toHaveTextContent("High risk");
    expect(screen.getByText("Starts 28 Oct 2026 · 30 days")).toBeTruthy();
    expect(screen.getByTestId("details-review")).toHaveTextContent("Review every 14 days (next 11 Nov 2026)");
    expect(screen.getByTestId("details-author")).toHaveTextContent("Created by Placeholder Nurse · Stroke Recovery template");
  });

  it("lists the goals (discontinued ones hidden) and the allergies and instructions", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(
      plan({ goals: [goal(), goal({ id: "g2", title: "Hidden goal", status: "discontinued" }), goal({ id: "g3", title: "Done goal", status: "achieved" })] }),
    );
    await renderDetails();
    expect(await screen.findByText("Placeholder goal")).toBeTruthy();
    expect(screen.queryByText("Hidden goal")).toBeNull();
    expect(screen.getByTestId("goal-achieved-g3")).toBeTruthy();

    // Allergies and special instructions open on demand.
    expect(screen.queryByText("Placeholder allergen")).toBeNull();
    await fireEvent.press(screen.getByTestId("section-notes-toggle"));
    expect(screen.getByText("Placeholder allergen")).toBeTruthy();
    expect(screen.getByText("Placeholder instruction")).toBeTruthy();
  });

  it("says so when there are no goals or notes", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan({ goals: [], allergies: [], special_instructions: [] }));
    await renderDetails();
    expect(await screen.findByTestId("goals-empty")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("section-notes-toggle"));
    expect(screen.getAllByText("None recorded.")).toHaveLength(2);
  });

  it("loads the client's profile only when that section is opened, labelling the record's own allergies", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const get = jest.spyOn(clientsService, "getClientProfile").mockResolvedValue(clientProfile);
    await renderDetails();
    await screen.findByTestId("details-client-name");
    expect(get).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("section-client-toggle"));
    expect(await screen.findByTestId("details-client")).toBeTruthy();
    expect(get).toHaveBeenCalledWith("bd787ad8-949e-4cb5-a428-39c61cd5fd03");
    expect(screen.getByText("Allergies on the client's record")).toBeTruthy();
    expect(screen.getByText("Record allergen")).toBeTruthy();
  });

  it("shows a spinner, then an error with retry", async () => {
    const get = jest.spyOn(carePlansService, "getPlan").mockRejectedValueOnce(new Error("boom"));
    await renderDetails();
    expect(await screen.findByText("Try again")).toBeTruthy();
    get.mockResolvedValue(plan());
    await fireEvent.press(screen.getByText("Try again"));
    expect(await screen.findByTestId("details-client-name")).toBeTruthy();
  });

  it("shows the not-available notice when the visit no longer gives access", async () => {
    jest.spyOn(carePlansService, "getPlan").mockRejectedValue(NO_ACCESS);
    await renderDetails();
    expect(await screen.findByText("This care plan isn't available")).toBeTruthy();
    expect(screen.getByText(/accepted, on the way or in progress/)).toBeTruthy();
    await fireEvent.press(screen.getByText("Go back"));
    expect(mockGoBack).toHaveBeenCalled();
  });
});

describe("Care plan details: who can change it", () => {
  it("gives a caregiver without edit rights no edit, add or goal controls", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(readOnlyPlan());
    await renderDetails();
    await screen.findByText("Placeholder goal");
    expect(screen.queryByTestId("details-edit")).toBeNull();
    expect(screen.queryByTestId("goal-add")).toBeNull();
    expect(screen.queryByTestId(`goal-menu-${GOAL_ID}`)).toBeNull();
    await fireEvent.press(screen.getByTestId("section-notes-toggle"));
    expect(screen.queryByTestId("edit-allergies")).toBeNull();
    expect(screen.queryByTestId("edit-instructions")).toBeNull();
  });

  it("shows a read-only banner for a completed plan", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(readOnlyPlan({ status: "completed" }));
    await renderDetails();
    expect(await screen.findByTestId("details-read-only")).toHaveTextContent("This plan is completed and can't be changed.");
    expect(screen.getByTestId("details-status")).toHaveTextContent("Completed");
    expect(screen.queryByTestId("details-edit")).toBeNull();
  });

  it("shows the controls to a nurse on an active plan", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    await renderDetails();
    expect(await screen.findByTestId("details-edit")).toBeTruthy();
    expect(screen.getByTestId("goal-add")).toBeTruthy();
    expect(screen.queryByTestId("details-read-only")).toBeNull();
  });
});

describe("Care plan details: goals", () => {
  const openAddGoal = async () => {
    await fireEvent.press(await screen.findByTestId("goal-add"));
    expect(screen.getByTestId("goal-modal")).toBeTruthy();
  };

  it("adds a goal with the plan's version and moves to the success page", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const add = jest.spyOn(carePlansService, "addGoal").mockResolvedValue({
      goal: goal({ id: "new", title: "Placeholder goal two", target: null, frequency: "weekly" }),
      plan_version: 2,
    });
    await renderDetails();
    await openAddGoal();
    await fireEvent.press(screen.getByTestId("goal-save"));
    expect(screen.getByText("Enter the goal.")).toBeTruthy();
    expect(add).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId("goal-title"), "Placeholder goal two");
    await fireEvent.press(screen.getByTestId("goal-frequency-weekly"));
    await fireEvent.press(screen.getByTestId("goal-save"));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("CarePlanSuccess", { kind: "goal_added", planId: PLAN_ID }));
    // Adding never overwrites anything, so no version is sent.
    expect(add).toHaveBeenCalledWith(PLAN_ID, { title: "Placeholder goal two", target: null, frequency: "weekly" });
    expect(screen.queryByTestId("goal-modal")).toBeNull();
    expect(await screen.findByText("Placeholder goal two")).toBeTruthy();
  });

  it("on a goal edit conflict keeps the typed text, then saves only the changed field against the current version", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    // Someone else changed the goal's target meanwhile; the nurse only retitles it.
    const theirs = plan({ version: 3, goals: [goal({ target: "Their new target" })] });
    const patch = jest
      .spyOn(carePlansService, "patchGoal")
      .mockRejectedValueOnce(versionConflict(theirs))
      .mockResolvedValueOnce({ goal: goal({ title: "Typed title", target: "Their new target" }), plan_version: 4 });
    await renderDetails();
    await fireEvent.press(await screen.findByTestId(`goal-menu-${GOAL_ID}`));
    await fireEvent.press(screen.getByTestId(`goal-edit-${GOAL_ID}`));
    await fireEvent.changeText(screen.getByTestId("goal-title"), "Typed title");
    await fireEvent.press(screen.getByTestId("goal-save"));

    expect(await screen.findByTestId("goal-error")).toHaveTextContent(/Someone just changed this plan/);
    expect(screen.getByTestId("goal-title").props.value).toBe("Typed title");

    await fireEvent.press(screen.getByTestId("goal-save"));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(patch.mock.calls[0]).toEqual([GOAL_ID, 1, { title: "Typed title" }]);
    // The colleague's target is not sent back, so it is not reverted.
    expect(patch.mock.calls[1]).toEqual([GOAL_ID, 3, { title: "Typed title" }]);
  });

  it("closes an unchanged goal edit without a call", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const patch = jest.spyOn(carePlansService, "patchGoal");
    await renderDetails();
    await fireEvent.press(await screen.findByTestId(`goal-menu-${GOAL_ID}`));
    await fireEvent.press(screen.getByTestId(`goal-edit-${GOAL_ID}`));
    await fireEvent.press(screen.getByTestId("goal-save"));
    expect(patch).not.toHaveBeenCalled();
    expect(screen.queryByTestId("goal-modal")).toBeNull();
  });

  it("clears an earlier goal error after a later change succeeds", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    jest
      .spyOn(carePlansService, "patchGoal")
      .mockRejectedValueOnce(versionConflict(plan({ version: 2 })))
      .mockResolvedValueOnce({ goal: goal({ status: "achieved" }), plan_version: 3 });
    await renderDetails();
    await fireEvent.press(await screen.findByTestId(`goal-menu-${GOAL_ID}`));
    await fireEvent.press(screen.getByTestId(`goal-status-${GOAL_ID}`));
    expect(await screen.findByTestId("goals-error")).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`goal-menu-${GOAL_ID}`));
    await fireEvent.press(screen.getByTestId(`goal-status-${GOAL_ID}`));
    await waitFor(() => expect(screen.queryByTestId("goals-error")).toBeNull());
  });

  it("drops the sheet and the controls when the plan was completed elsewhere (plan_not_editable)", async () => {
    const get = jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    jest.spyOn(carePlansService, "addGoal").mockRejectedValue(
      new ApiError(409, { detail: { code: "plan_not_editable", message: "This care plan is completed or archived and can no longer be changed." } }, "x"),
    );
    await renderDetails();
    await openAddGoal();
    await fireEvent.changeText(screen.getByTestId("goal-title"), "Typed goal");
    get.mockResolvedValue(readOnlyPlan({ version: 2, status: "completed" }));
    await fireEvent.press(screen.getByTestId("goal-save"));
    await waitFor(() => expect(screen.queryByTestId("goal-modal")).toBeNull());
    expect(await screen.findByTestId("details-read-only")).toBeTruthy();
    expect(screen.queryByTestId("goal-add")).toBeNull();
  });

  it("says only nurses can change a plan on a 403", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    jest.spyOn(carePlansService, "addGoal").mockRejectedValue(NOT_A_NURSE);
    await renderDetails();
    await openAddGoal();
    await fireEvent.changeText(screen.getByTestId("goal-title"), "Typed goal");
    await fireEvent.press(screen.getByTestId("goal-save"));
    expect(await screen.findByTestId("goal-error")).toHaveTextContent("Only nurses can change a care plan.");
  });

  it("shows the not-available notice if access is lost while saving", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    jest.spyOn(carePlansService, "addGoal").mockRejectedValue(NO_ACCESS);
    const { client } = await renderDetails();
    await openAddGoal();
    await fireEvent.changeText(screen.getByTestId("goal-title"), "Typed goal");
    await fireEvent.press(screen.getByTestId("goal-save"));
    expect(await screen.findByText("This care plan isn't available")).toBeTruthy();
    // The client's plan is not kept in memory once access has ended.
    expect(client.getQueryData(["care-plan", PLAN_ID])).toBeUndefined();
  });

  it("edits a goal through the options row", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const patch = jest
      .spyOn(carePlansService, "patchGoal")
      .mockResolvedValue({ goal: goal({ title: "Renamed goal", target: null }), plan_version: 2 });
    await renderDetails();
    await fireEvent.press(await screen.findByTestId(`goal-menu-${GOAL_ID}`));
    await fireEvent.press(screen.getByTestId(`goal-edit-${GOAL_ID}`));
    expect(screen.getByTestId("goal-title").props.value).toBe("Placeholder goal");
    await fireEvent.changeText(screen.getByTestId("goal-title"), "Renamed goal");
    await fireEvent.changeText(screen.getByTestId("goal-target"), "");
    await fireEvent.press(screen.getByTestId("goal-save"));
    await waitFor(() => expect(patch).toHaveBeenCalledWith(GOAL_ID, 1, { title: "Renamed goal", target: null }));
    expect(await screen.findByText("Renamed goal")).toBeTruthy();
    // An edit does not go to the success page.
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("marks a goal achieved, then uses the new version for the next write", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const patch = jest
      .spyOn(carePlansService, "patchGoal")
      .mockResolvedValueOnce({ goal: goal({ status: "achieved" }), plan_version: 2 })
      .mockResolvedValueOnce({ goal: goal({ status: "active" }), plan_version: 3 });
    await renderDetails();
    await fireEvent.press(await screen.findByTestId(`goal-menu-${GOAL_ID}`));
    await fireEvent.press(screen.getByTestId(`goal-status-${GOAL_ID}`));
    expect(await screen.findByTestId(`goal-achieved-${GOAL_ID}`)).toBeTruthy();
    expect(patch).toHaveBeenLastCalledWith(GOAL_ID, 1, { status: "achieved" });

    await fireEvent.press(screen.getByTestId(`goal-menu-${GOAL_ID}`));
    await fireEvent.press(screen.getByTestId(`goal-status-${GOAL_ID}`));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(patch).toHaveBeenLastCalledWith(GOAL_ID, 2, { status: "active" });
  });

  it("asks before discontinuing a goal, then hides it", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const patch = jest.spyOn(carePlansService, "patchGoal").mockResolvedValue({ goal: goal({ status: "discontinued" }), plan_version: 2 });
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    await renderDetails();
    await fireEvent.press(await screen.findByTestId(`goal-menu-${GOAL_ID}`));
    await fireEvent.press(screen.getByTestId(`goal-discontinue-${GOAL_ID}`));
    expect(patch).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0]?.[2] ?? [];
    await act(async () => {
      buttons.find((b) => b.text === "Discontinue")?.onPress?.();
    });
    await waitFor(() => expect(patch).toHaveBeenCalledWith(GOAL_ID, 1, { status: "discontinued" }));
    await waitFor(() => expect(screen.queryByText("Placeholder goal")).toBeNull());
  });

  it("shows a failed status change under the goals", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    jest.spyOn(carePlansService, "patchGoal").mockRejectedValue(versionConflict(plan({ version: 5 })));
    await renderDetails();
    await fireEvent.press(await screen.findByTestId(`goal-menu-${GOAL_ID}`));
    await fireEvent.press(screen.getByTestId(`goal-status-${GOAL_ID}`));
    expect(await screen.findByTestId("goals-error")).toHaveTextContent(/Someone just changed this plan/);
  });
});

describe("Care plan details: edit plan sheet", () => {
  const openSheet = async () => {
    await fireEvent.press(await screen.findByTestId("details-edit"));
    expect(screen.getByTestId("edit-plan")).toBeTruthy();
  };

  it("sends only the fields that changed, with the plan's version", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const patch = jest.spyOn(carePlansService, "patchPlan").mockResolvedValue(plan({ version: 2, risk_level: "low", diagnosis: "New diagnosis" }));
    await renderDetails();
    await openSheet();
    expect(screen.getByTestId("edit-diagnosis").props.value).toBe("Placeholder diagnosis");
    await fireEvent.changeText(screen.getByTestId("edit-diagnosis"), "New diagnosis");
    await fireEvent.press(screen.getByTestId("edit-risk-low"));
    await fireEvent.press(screen.getByTestId("edit-save"));

    await waitFor(() => expect(patch).toHaveBeenCalledWith(PLAN_ID, { expected_version: 1, diagnosis: "New diagnosis", risk_level: "low" }));
    await waitFor(() => expect(screen.queryByTestId("edit-plan")).toBeNull());
    expect(screen.getByTestId("details-risk")).toHaveTextContent("Low risk");
    expect(screen.getByText("New diagnosis")).toBeTruthy();
  });

  it("closes without a call when nothing changed", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const patch = jest.spyOn(carePlansService, "patchPlan");
    await renderDetails();
    await openSheet();
    await fireEvent.press(screen.getByTestId("edit-save"));
    expect(patch).not.toHaveBeenCalled();
    expect(screen.queryByTestId("edit-plan")).toBeNull();
  });

  it("clears the review date by sending null", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const patch = jest.spyOn(carePlansService, "patchPlan").mockResolvedValue(plan({ version: 2, review_every_days: null, review_due_on: null }));
    await renderDetails();
    await openSheet();
    await fireEvent.changeText(screen.getByTestId("edit-review"), "");
    await fireEvent.press(screen.getByTestId("edit-save"));
    await waitFor(() => expect(patch).toHaveBeenCalledWith(PLAN_ID, { expected_version: 1, review_every_days: null }));
  });

  it("validates before sending", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const patch = jest.spyOn(carePlansService, "patchPlan");
    await renderDetails();
    await openSheet();
    await fireEvent.changeText(screen.getByTestId("edit-diagnosis"), "  ");
    await fireEvent.changeText(screen.getByTestId("edit-duration"), "999");
    await fireEvent.press(screen.getByTestId("edit-save"));
    expect(screen.getByText("Enter the diagnosis.")).toBeTruthy();
    expect(screen.getByText(/whole number of days from 1 to 365/)).toBeTruthy();
    expect(patch).not.toHaveBeenCalled();
  });

  it("keeps the draft on a version conflict and then saves against the current version", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const patch = jest
      .spyOn(carePlansService, "patchPlan")
      .mockRejectedValueOnce(versionConflict(plan({ version: 4 })))
      .mockResolvedValueOnce(plan({ version: 5, diagnosis: "My edit" }));
    await renderDetails();
    await openSheet();
    await fireEvent.changeText(screen.getByTestId("edit-diagnosis"), "My edit");
    await fireEvent.press(screen.getByTestId("edit-save"));
    expect(await screen.findByTestId("edit-error")).toHaveTextContent(/Someone just changed this plan/);
    expect(screen.getByTestId("edit-diagnosis").props.value).toBe("My edit");

    await fireEvent.press(screen.getByTestId("edit-save"));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(patch.mock.calls[1]?.[1]).toEqual({ expected_version: 4, diagnosis: "My edit" });
  });

  it("does not revert a field another author changed during a conflict", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    // The other author lowered the risk while the nurse was editing only the diagnosis.
    const patch = jest
      .spyOn(carePlansService, "patchPlan")
      .mockRejectedValueOnce(versionConflict(plan({ version: 2, risk_level: "low" })))
      .mockResolvedValueOnce(plan({ version: 3, risk_level: "low", diagnosis: "My edit" }));
    await renderDetails();
    await openSheet();
    await fireEvent.changeText(screen.getByTestId("edit-diagnosis"), "My edit");
    await fireEvent.press(screen.getByTestId("edit-save"));
    await screen.findByTestId("edit-error");
    await fireEvent.press(screen.getByTestId("edit-save"));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(patch.mock.calls[1]?.[1]).toEqual({ expected_version: 2, diagnosis: "My edit" });
    await waitFor(() => expect(screen.getByTestId("details-risk")).toHaveTextContent("Low risk"));
  });

  it("marks the plan completed after a confirmation, then shows it read-only", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const patch = jest.spyOn(carePlansService, "patchPlan").mockResolvedValue(readOnlyPlan({ version: 2, status: "completed" }));
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    await renderDetails();
    await openSheet();
    await fireEvent.press(screen.getByTestId("edit-complete"));
    expect(patch).not.toHaveBeenCalled();
    expect(alert.mock.calls[0]?.[0]).toBe("Mark this plan completed?");

    alert.mock.calls[0]?.[2]?.find((b) => b.text === "Mark completed")?.onPress?.();
    await waitFor(() => expect(patch).toHaveBeenCalledWith(PLAN_ID, { expected_version: 1, status: "completed" }));
    expect(await screen.findByTestId("details-read-only")).toBeTruthy();
    expect(screen.queryByTestId("details-edit")).toBeNull();
  });

  it("archives the plan after a confirmation", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const patch = jest.spyOn(carePlansService, "patchPlan").mockResolvedValue(readOnlyPlan({ version: 2, status: "archived" }));
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    await renderDetails();
    await openSheet();
    await fireEvent.press(screen.getByTestId("edit-archive"));
    alert.mock.calls[0]?.[2]?.find((b) => b.text === "Archive")?.onPress?.();
    await waitFor(() => expect(patch).toHaveBeenCalledWith(PLAN_ID, { expected_version: 1, status: "archived" }));
    expect(await screen.findByTestId("details-status")).toHaveTextContent("Archived");
  });
});

describe("Care plan details: allergies and special instructions", () => {
  const openList = async (testID: string) => {
    await screen.findByTestId("details-client-name");
    await fireEvent.press(screen.getByTestId("section-notes-toggle"));
    await fireEvent.press(screen.getByTestId(testID));
    expect(screen.getByTestId("list-edit")).toBeTruthy();
  };

  it("saves the lines as a list", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const patch = jest
      .spyOn(carePlansService, "patchPlan")
      .mockResolvedValue(plan({ version: 2, allergies: ["Placeholder allergen", "Second allergen"] }));
    await renderDetails();
    await openList("edit-allergies");
    expect(screen.getByTestId("list-edit-text").props.value).toBe("Placeholder allergen");
    await fireEvent.changeText(screen.getByTestId("list-edit-text"), "Placeholder allergen\n\nSecond allergen\n");
    await fireEvent.press(screen.getByTestId("list-edit-save"));
    await waitFor(() => expect(patch).toHaveBeenCalledWith(PLAN_ID, { expected_version: 1, allergies: ["Placeholder allergen", "Second allergen"] }));
    expect(await screen.findByText("Second allergen")).toBeTruthy();
  });

  it("clears the special instructions with null when the box is emptied", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const patch = jest.spyOn(carePlansService, "patchPlan").mockResolvedValue(plan({ version: 2, special_instructions: [] }));
    await renderDetails();
    await openList("edit-instructions");
    await fireEvent.changeText(screen.getByTestId("list-edit-text"), "");
    await fireEvent.press(screen.getByTestId("list-edit-save"));
    await waitFor(() => expect(patch).toHaveBeenCalledWith(PLAN_ID, { expected_version: 1, special_instructions: null }));
  });

  it("refuses more than 30 lines before sending", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const patch = jest.spyOn(carePlansService, "patchPlan");
    await renderDetails();
    await openList("edit-allergies");
    await fireEvent.changeText(screen.getByTestId("list-edit-text"), "a\n".repeat(31));
    await fireEvent.press(screen.getByTestId("list-edit-save"));
    expect(screen.getByTestId("list-edit-error")).toHaveTextContent("Add at most 30 lines.");
    expect(patch).not.toHaveBeenCalled();
  });
});
